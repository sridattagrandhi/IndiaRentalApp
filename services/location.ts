import 'react-native-get-random-values';

import {
    CalculateRouteCommand,
    LocationClient,
    SearchPlaceIndexForPositionCommand,
    SearchPlaceIndexForTextCommand,
} from '@aws-sdk/client-location';
import { fromCognitoIdentityPool } from '@aws-sdk/credential-provider-cognito-identity';

const REGION = process.env.EXPO_PUBLIC_AWS_REGION || 'ap-south-1';

const PLACE_INDEX = process.env.EXPO_PUBLIC_LOCATION_PLACE_INDEX!;
const ROUTE_CALC = process.env.EXPO_PUBLIC_LOCATION_ROUTE_CALCULATOR!;
const IDENTITY_POOL_ID = process.env.EXPO_PUBLIC_COGNITO_IDENTITY_POOL_ID!;
const USER_POOL_ID = process.env.EXPO_PUBLIC_COGNITO_USER_POOL_ID!;

function makeClient(idToken: string) {
  if (!idToken) throw new Error('Missing idToken (user not logged in)');

  if (!PLACE_INDEX || !ROUTE_CALC || !IDENTITY_POOL_ID || !USER_POOL_ID) {
    throw new Error(
      'Missing env vars. Need: EXPO_PUBLIC_LOCATION_PLACE_INDEX, EXPO_PUBLIC_LOCATION_ROUTE_CALCULATOR, EXPO_PUBLIC_COGNITO_IDENTITY_POOL_ID, EXPO_PUBLIC_COGNITO_USER_POOL_ID'
    );
  }

  const providerKey = `cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}`;

  return new LocationClient({
    region: REGION,
    credentials: fromCognitoIdentityPool({
      clientConfig: { region: REGION },
      identityPoolId: IDENTITY_POOL_ID,
      logins: {
        [providerKey]: idToken,
      },
    }),
  });
}

export type GeocodeResult = {
  label: string;
  latitude: number;
  longitude: number;
};

export async function geocodeText(text: string, idToken: string): Promise<GeocodeResult | null> {
  const client = makeClient(idToken);

  const out = await client.send(
    new SearchPlaceIndexForTextCommand({
      IndexName: PLACE_INDEX,
      Text: text,
      MaxResults: 1,
      // Keep India bias like you had in Geoapify:
      FilterCountries: ['IND'],
    })
  );

  const first = out.Results?.[0];
  const point = first?.Place?.Geometry?.Point;
  if (!point) return null;

  const [lon, lat] = point;

  return {
    label: first?.Place?.Label ?? text,
    latitude: lat,
    longitude: lon,
  };
}

export async function reverseGeocode(lat: number, lon: number, idToken: string): Promise<string> {
  const client = makeClient(idToken);

  const out = await client.send(
    new SearchPlaceIndexForPositionCommand({
      IndexName: PLACE_INDEX,
      Position: [lon, lat],
      MaxResults: 1,
    })
  );

  return out.Results?.[0]?.Place?.Label ?? 'Current Location';
}

export async function calculateRoute(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
  idToken: string
): Promise<{
  coords: { latitude: number; longitude: number }[];
  distanceKm: number;
  durationMin: number;
} | null> {
  const client = makeClient(idToken);

  const out = await client.send(
    new CalculateRouteCommand({
      CalculatorName: ROUTE_CALC,
      DeparturePosition: [from.longitude, from.latitude],
      DestinationPosition: [to.longitude, to.latitude],
      TravelMode: 'Car',
      IncludeLegGeometry: true,
    })
  );

  const coords: { latitude: number; longitude: number }[] = [];
  for (const leg of out.Legs ?? []) {
    for (const [lng, lt] of leg.Geometry?.LineString ?? []) {
      coords.push({ latitude: lt, longitude: lng });
    }
  }

  if (coords.length < 2) return null;

  return {
    coords,
    distanceKm: (out.Summary?.Distance ?? 0) / 1000,
    durationMin: (out.Summary?.DurationSeconds ?? 0) / 60,
  };
}
