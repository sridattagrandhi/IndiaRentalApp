// app/(tabs)/index.tsx
import { ThemedView } from '@/components/themed-view';
import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { List, LocateFixed, Map, MapPin, Navigation, Search, Star } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import MapView, { Marker, PROVIDER_DEFAULT, Region, UrlTile } from 'react-native-maps';
import { useListings } from '../context/ListingsContext';

// --- API Key and URLs ---
const GEOAPIFY_API_KEY = Constants.expoConfig?.extra?.GEOAPIFY_API_KEY;

if (!GEOAPIFY_API_KEY) {
  console.error('Geoapify API key is missing! Check .env and app.config.js');
  Alert.alert('Configuration Error', 'Map API key is missing. Map functionality may be limited.');
}

const GEOAPIFY_TILE_URL = `https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}.png?apiKey=${GEOAPIFY_API_KEY}`;

// Rough center of India + wide deltas for a country view
const INDIA_REGION = {
  latitude: 22.9734,          // near Nagpur
  longitude: 78.6569,
  latitudeDelta: 20,          // wide enough for pan-India
  longitudeDelta: 20,
};

// (Optional) bounding box, useful if you want a perfect fit
const INDIA_BOUNDS = [
  { latitude: 8.4,  longitude: 68.7 }, // SW (Kanyakumari-ish)
  { latitude: 37.6, longitude: 97.4 }, // NE (Arunachal-ish)
] as const;


// --- Data Interfaces ---
interface Property {
  id: string;
  name: string;
  location: string;
  price: number;
  rating: number;
  distance: string;
  image: string;
  features?: string[];
  coordinates: [number, number]; // [lng, lat]
  images?: string[];
  maxGuests?: number;
  calendar?: Record<string, { status: string }>;
  bookings?: Array<{ start: string; end: string }>;
  blocks?: Array<{ start: string; end: string }>;
  rules?: string[];
  prohibited?: string[];
  amenities?: string[];
  __hostId?: string;
}

// --- Zillow/Airbnb-style price marker ---
const MarkerTag = ({ price }: { price: number }) => (
  <View style={styles.priceTagWrap}>
    <View style={styles.priceTag}>
      <Text style={styles.priceTagText}>₹{Math.round(price / 1000)}k</Text>
    </View>
    <View style={styles.priceTagTail} />
  </View>
);

// --- Property Card ---
const PropertyCard = ({ property, router }: { property: Property; router: ReturnType<typeof useRouter> }) => (
  <TouchableOpacity style={styles.card}>
    <View style={styles.cardContent}>
      <Image
        source={{ uri: property.image }}
        style={styles.cardImage}
        placeholder={{ blurhash: 'L0A,l#~q00D%~qD%00%M00?b-;%M' }}
        transition={300}
      />
      <View style={styles.cardDetails}>
        <View style={styles.cardRow}>
          <Text style={styles.cardName} numberOfLines={1}>
            {property.name}
          </Text>
          <View style={styles.cardRating}>
            <Star size={12} color="#F59E0B" fill="#F59E0B" />
            <Text style={styles.cardRatingText}>{property.rating}</Text>
          </View>
        </View>
        <View style={styles.cardRow}>
          <MapPin size={12} color="#6B7280" />
          <Text style={styles.cardLocation} numberOfLines={1}>
            {property.location} • {property.distance}
          </Text>
        </View>
        <View style={styles.cardFeatures}>
          {property.features?.map((feature) => (
            <View key={feature} style={styles.cardFeatureTag}>
              <Text style={styles.cardFeatureText}>{feature}</Text>
            </View>
          ))}
        </View>
        <View style={styles.cardRow}>
          <Text style={styles.cardPrice}>
            ₹{property.price}
            <Text style={styles.cardPriceNight}>/night</Text>
          </Text>
          <TouchableOpacity
            style={styles.cardViewButton}
            onPress={() => {
              if (property.__hostId) {
                router.push({
                  pathname: '/listing-details',
                  params: { source: 'host', id: property.__hostId },
                });
                return;
              }
              // otherwise send a rich payload
              router.push({
                pathname: '/listing-details',
                params: {
                  source: 'mock',
                  payload: encodeURIComponent(JSON.stringify({
                    id: property.id,
                    name: property.name,
                    location: property.location,
                    price: property.price,
                    rating: property.rating,
                    images: property.images ?? [property.image].filter(Boolean),
                    maxGuests: property.maxGuests ?? 4,
                    calendar: property.calendar ?? undefined,
                    bookings: property.bookings ?? undefined,
                    blocks: property.blocks ?? undefined,
                    coordinates: property.coordinates,
                    rules: property.rules ?? [],
                    prohibited: property.prohibited ?? [],
                    features: property.amenities ?? property.features ?? [],
                  })),
                },
              });
            }}
          >
            <Text style={styles.cardViewButtonText}>View</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </TouchableOpacity>
);

// --- Main ---
export default function HomePage() {
  const router = useRouter();
  const mapViewRef = useRef<MapView>(null);

  const [viewMode, setViewMode] = useState<'map' | 'list'>('list');
  const [initialRegion, setInitialRegion] = useState<Region | undefined>(undefined);
  const [currentRegion, setCurrentRegion] = useState<Region | undefined>(undefined);
  const [showFindNearMe, setShowFindNearMe] = useState(true);

  const { listings } = useListings();

  // derive properties from context listings (only those with coords)
  const listingsWithCoords = listings.filter((l) => l.coords);

  // Cards list (works even if coords are missing)
  const listItems = listings.map((l) => ({
    id: l.id,
    __hostId: l.id, // ← enables the host path
    name: l.title,
    location: l.address ? `${l.address}, ${l.location}` : l.location,
    price: l.pricePerNight,
    rating: l.rating || 0,
    distance: '',
    image: l.image,
    images: l.images ?? (l.image ? [l.image] : []), // ← multiple photos
    maxGuests: l.maxGuests,                          // ← cap
    calendar: l.calendar,                            // ← day map
    bookings: (l as any).bookings,                   // ← ranges, if you store them
    blocks: (l as any).blocks,
    rules: l.rules,
    prohibited: (l as any).prohibited,
    amenities: l.amenities,
    coordinates: [
      l.coords?.longitude ?? (currentRegion?.longitude ?? 77.5946),
      l.coords?.latitude ?? (currentRegion?.latitude ?? 12.9716),
    ] as [number, number],
  }));


  const markers = listingsWithCoords.map((l) => ({
    id: l.id,
    name: l.title,
    price: l.pricePerNight,
    coord: { latitude: l.coords!.latitude, longitude: l.coords!.longitude },
  }));

  // On mount: default to India (Bengaluru) — no GPS prompt
  useEffect(() => {
    const india = { latitude: 12.9716, longitude: 77.5946, latitudeDelta: 0.08, longitudeDelta: 0.08 };
    setInitialRegion(india);
    setCurrentRegion(india);
  }, []);

  // Navigate to Search (with or without GPS)
  const handleFindStaysNearMe = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission denied', 'Enable location services to find stays near you.');
      return;
    }

    try {
      let loc = await Location.getCurrentPositionAsync({});
      // Navigate to search page with current location
      router.push({
        pathname: '/search',
        params: { lat: loc.coords.latitude, lon: loc.coords.longitude },
      });
    } catch {
      Alert.alert('Location Error', 'Could not fetch your current location. Defaulting to search.');
      router.push('/search');
    }
  };

  const handleNavigateToSearch = () => router.push('/search');

  // recenter-to-user for the home map (button)
  const recenterToUser = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location Permission', 'Permission to access location was denied');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const center = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      const newRegion: Region = { ...center, latitudeDelta: 0.02, longitudeDelta: 0.02 };
      setCurrentRegion(newRegion);
      mapViewRef.current?.animateCamera?.({ center, zoom: 15 }, { duration: 350 });
    } catch (e) {
      console.error(e);
      Alert.alert('Location Error', 'Could not get your current location.');
    }
  };

  if (!initialRegion) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Finding your location...</Text>
      </View>
    );
  }

  const popularAreas = [
    'Mumbai', 'Delhi', 'Bengaluru', 'Hyderabad', 'Chennai',
    'Pune', 'Jaipur', 'Goa', 'Kolkata', 'Ahmedabad'
  ] as const;

  const CITY_COORDS: Record<typeof popularAreas[number], { lat: number; lon: number; delta?: number }> = {
    Mumbai:     { lat: 19.0760, lon: 72.8777, delta: 0.18 },
    Delhi:      { lat: 28.6139, lon: 77.2090, delta: 0.22 },
    Bengaluru:  { lat: 12.9716, lon: 77.5946, delta: 0.18 },
    Hyderabad:  { lat: 17.4065, lon: 78.4772, delta: 0.2 },
    Chennai:    { lat: 13.0827, lon: 80.2707, delta: 0.2 },
    Pune:       { lat: 18.5204, lon: 73.8567, delta: 0.2 },
    Jaipur:     { lat: 26.9124, lon: 75.7873, delta: 0.22 },
    Goa:        { lat: 15.2993, lon: 74.1240, delta: 0.3 },   // wider to see coastal area
    Kolkata:    { lat: 22.5726, lon: 88.3639, delta: 0.2 },
    Ahmedabad:  { lat: 23.0225, lon: 72.5714, delta: 0.22 },
  };

  function flyToCity(city: typeof popularAreas[number]) {
    const c = CITY_COORDS[city];
    if (!c || !mapViewRef.current) return;

    // Pick one of the two animations below:

    // (A) animateToRegion (nice if you rely on latitudeDelta/longitudeDelta)
    mapViewRef.current.animateToRegion(
      {
        latitude: c.lat,
        longitude: c.lon,
        latitudeDelta: c.delta ?? 0.2,
        longitudeDelta: (c.delta ?? 0.2) * 1.1,
      },
      800
    );

    // (B) Or animateCamera with zoom (if you prefer zoom levels)
    // mapRef.current.animateCamera(
    //   { center: { latitude: c.lat, longitude: c.lon }, zoom: 12 },
    //   { duration: 800 }
    // );
  }


  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          {/* Search Bar (press to navigate) */}
          <View style={styles.searchContainer}>
            <TouchableOpacity style={styles.searchInput} onPress={handleNavigateToSearch} activeOpacity={0.8}>
              <Text style={styles.searchInputPlaceholder}>
                Search city, state or landmark
              </Text>
            </TouchableOpacity>

            <View style={styles.searchIconWrap} pointerEvents="none">
              <Search size={18} color="#9AA0A6" />
            </View>
          </View>
        </View>

        {/* Content */}
        <View style={styles.contentContainer}>
          {viewMode === 'map' ? (
            <>
              <MapView
                ref={mapViewRef}
                style={styles.map}
                provider={PROVIDER_DEFAULT}
                initialRegion={INDIA_REGION}
                onRegionChangeComplete={setCurrentRegion}
                mapType="none"
                showsUserLocation={true}
              >
                {GEOAPIFY_API_KEY && (
                  <UrlTile urlTemplate={GEOAPIFY_TILE_URL} maximumZ={20} flipY={false} zIndex={-1} />
                )}

                {markers.map((m) => (
                  <Marker
                    key={m.id}
                    coordinate={m.coord}
                    onPress={() => {
                      const listing = listings.find(l => l.id === m.id);
                      if (listing) {
                        router.push({ pathname: '/listing-details', params: { source: 'host', id: listing.id } });
                      }
                    }}
                    anchor={{ x: 0.5, y: 1 }}
                  >
                    <MarkerTag price={m.price} />
                  </Marker>
                ))}
              </MapView>
            </>
          ) : (
            <FlatList
                data={listItems}
                renderItem={({ item }) => <PropertyCard property={item} router={router} />}
              keyExtractor={(item) => item.id}
              ListEmptyComponent={
                <View style={{ padding: 24, alignItems: 'center' }}>
                  <Text>No listings yet. Create one in Host → Listings.</Text>
                </View>
              }
            />
          )}

          {/* Toggle (top-right) */}
          <TouchableOpacity
            style={styles.viewToggleButton}
            onPress={() => setViewMode(viewMode === 'map' ? 'list' : 'map')}
            activeOpacity={0.8}
          >
            {viewMode === 'map' ? <List size={20} color="white" /> : <Map size={20} color="white" />}
          </TouchableOpacity>

          {/* Locate-me button under the toggle */}
          {viewMode === 'map' && (
            <TouchableOpacity style={styles.locateButton} onPress={recenterToUser} activeOpacity={0.85}>
              <LocateFixed size={18} color="white" />
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>

      {/* Footer */}
      <View style={styles.footer}>
        {showFindNearMe && (
          <TouchableOpacity style={styles.findStaysButton} onPress={handleFindStaysNearMe}>
            <Navigation size={16} color="white" />
            <Text style={styles.findStaysButtonText}>Find stays near me</Text>
          </TouchableOpacity>
        )}
        <View style={styles.footerRow}>
          <TouchableOpacity style={styles.footerButton} onPress={() => router.push('/route')}>
            <Text style={styles.footerButtonText}>Plan a route →</Text>
          </TouchableOpacity>
          {/* <TouchableOpacity style={styles.footerButton}>
            <Text style={styles.footerButtonText}>Explore popular areas</Text>
          </TouchableOpacity> */}
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.popularAreasContainer}
        >
          {popularAreas.map((area) => (
            <TouchableOpacity
              key={area}
              style={styles.popularAreaButton}    
              onPress={() => flyToCity(area as typeof popularAreas[number])}
            >
              <Text style={styles.popularAreaText}>{area}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </ThemedView>
  );
}

// --- Styles ---
const INPUT_HEIGHT = 48;
const ICON_SIZE = 18;
const ICON_PAD = 8;
const WRAP_SIZE = ICON_SIZE + ICON_PAD;
const ICON_LEFT = 16;

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'white' },
  container: { flex: 1, backgroundColor: 'white' },
  safeArea: { flex: 1 },
  contentContainer: { flex: 1, position: 'relative' },

  header: {
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEFF3',
    gap: 10,
  },

  // Search
  searchContainer: { position: 'relative', justifyContent: 'center' },
  searchInput: {
    width: '100%',
    height: INPUT_HEIGHT,
    paddingLeft: ICON_LEFT + WRAP_SIZE + 10,
    paddingRight: 16,
    borderWidth: 1,
    borderColor: '#E6E8EC',
    borderRadius: 24,
    backgroundColor: '#F6F7F9',
    justifyContent: 'center',
  },
  searchInputPlaceholder: { fontSize: 16, color: '#9AA0A6' },
  searchIconWrap: {
    position: 'absolute',
    left: ICON_LEFT,
    top: INPUT_HEIGHT / 2,
    transform: [{ translateY: -(WRAP_SIZE / 2) }],
    width: WRAP_SIZE,
    height: WRAP_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 3,
  },

  // Quick filters
  filtersContainer: { flexDirection: 'row', gap: 8, paddingVertical: 6 },
  filterButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E6E8EC',
    backgroundColor: 'white',
  },
  filterButtonSelected: { backgroundColor: '#111827', borderColor: '#111827' },
  filterText: { fontSize: 14, color: '#374151' },
  filterTextSelected: { fontSize: 14, color: 'white', fontWeight: '600' },

  // Map
  map: { flex: 1 },

  // Price tag marker
  priceTagWrap: { alignItems: 'center' },
  priceTag: {
    backgroundColor: 'black',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'black',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 3,
  },
  priceTagText: { color: 'white', fontSize: 13, fontWeight: '700' },
  priceTagTail: {
    marginTop: -2,
    width: 10,
    height: 10,
    backgroundColor: 'white',
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
    transform: [{ rotate: '45deg' }],
  },

  // Toggle (top-right)
  viewToggleButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 48,
    height: 48,
    backgroundColor: '#0E1320',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 10,
  },

  // Locate-me button under the toggle
  locateButton: {
    position: 'absolute',
    top: 20 + 48 + 12,
    right: 20,
    width: 44,
    height: 44,
    backgroundColor: '#0E1320',
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 10,
  },

  // Cards
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  cardContent: { flexDirection: 'row', padding: 12, gap: 12 },
  cardImage: { width: 96, height: 96, borderRadius: 12, backgroundColor: '#F3F4F6' },
  cardDetails: { flex: 1, justifyContent: 'space-between' },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardName: { fontSize: 16, fontWeight: '600', color: '#111827', flex: 1, marginRight: 8 },
  cardRating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardRatingText: { fontSize: 14, fontWeight: '500' },
  cardLocation: { fontSize: 14, color: '#4B5563', flex: 1 },
  cardFeatures: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  cardFeatureTag: { backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  cardFeatureText: { fontSize: 10, color: '#374151', fontWeight: '500' },
  cardPrice: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
  cardPriceNight: { fontSize: 12, color: '#6B7080', fontWeight: 'normal' },
  cardViewButton: { backgroundColor: '#0E1320', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  cardViewButtonText: { color: 'white', fontSize: 14, fontWeight: '500' },

  // Footer
  footer: {
    backgroundColor: 'white',
    padding: 16,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: '#E6E8EC',
    gap: 12,
  },
  findStaysButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0E1320',
    padding: 14,
    borderRadius: 16,
    gap: 8,
  },
  findStaysButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  footerRow: { flexDirection: 'row', gap: 12 },
  footerButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E6E8EC',
    padding: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  footerButtonText: { color: '#0E1320', fontWeight: '500' },
  popularAreasContainer: { flexDirection: 'row', gap: 8 },
  popularAreaButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E6E8EC',
    borderRadius: 16,
  },
  popularAreaText: { color: '#111827' },
});
