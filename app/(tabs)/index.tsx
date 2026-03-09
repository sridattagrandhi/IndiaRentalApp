// app/(tabs)/index.tsx
// app/(tabs)/index.tsx
import { ThemedView } from "@/components/themed-view";
import Constants from "expo-constants";
import { Image } from "expo-image";
import {
  List,
  LocateFixed,
  Map,
  MapPin,
  Navigation,
  Search,
  Star,
} from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import MapView, {
  Marker,
  PROVIDER_DEFAULT,
  Region,
  UrlTile,
} from "react-native-maps";

// API client
import { apiGet } from "@/services/api";

// --- Map tiles
const GEOAPIFY_API_KEY = Constants.expoConfig?.extra?.GEOAPIFY_API_KEY;
const GEOAPIFY_TILE_URL = `https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}.png?apiKey=${GEOAPIFY_API_KEY}`;

type Property = {
  id: string;
  listingId: number;
  name: string;
  location: string; // full address if available
  price: number;
  rating: number;
  distance: string;
  image: string;
  features: string[];
  coordinates: { latitude: number; longitude: number };
};

type ListResponse = {
  results: any[];
  next_cursor?: number | null;
  chips?: string[];
  popular?: string[];
};

// Prefer full address → street + city → city → fallback text
const locationFrom = (it: any) => {
  const full = it.full_address || it.address || it.formatted_address;
  const street = it.street || it.street_name || it.road;
  const city = it.city || it.locality || it.town;
  if (full) return String(full);
  if (street && city) return `${street}, ${city}`;
  if (city) return String(city);
  return "Near you";
};

// Normalize coordinates from tuple/object
const coordsFrom = (it: any) => {
  let latitude = 37.7749;
  let longitude = -122.4194;
  if (Array.isArray(it.coordinates) && it.coordinates.length === 2) {
    longitude = Number(it.coordinates[0]);
    latitude = Number(it.coordinates[1]);
  } else if (it.coordinates && typeof it.coordinates === "object") {
    latitude = Number(it.coordinates.latitude ?? latitude);
    longitude = Number(it.coordinates.longitude ?? longitude);
  } else if (it.lat && it.lon) {
    latitude = Number(it.lat);
    longitude = Number(it.lon);
  }
  return { latitude, longitude };
};

function mapToProperty(it: any): Property {
  const km =
    typeof it.distance === "number"
      ? `${(it.distance / 1000).toFixed(1)} km`
      : (it.distance ?? "");

  return {
    id: String(it.id),
    listingId: Number(it.id),
    name: it.title ?? it.name ?? "Stay",
    location: locationFrom(it),
    price: Number(it.price ?? 0),
    rating: Number(it.rating ?? 4.7),
    distance: km,
    image:
      it.photo_url ?? it.image ?? "https://picsum.photos/seed/stay/400/400",
    features: Array.isArray(it.amenities) ? it.amenities : (it.features ?? []),
    coordinates: coordsFrom(it),
  };
}

type AvailabilityDay = {
  date: string; // 'YYYY-MM-DD'
  status: "available" | "blocked" | "booked";
  price: number;
};

async function fetchEffectivePriceFromCalendar(
  listingId: number,
  fallbackPrice: number,
): Promise<number> {
  const today = new Date();
  const end = new Date();
  end.setDate(today.getDate() + 30); // look at ~next month

  try {
    const res = await apiGet<{ results: AvailabilityDay[] }>(
      `/v1/listings/${listingId}/availability`,
      {
        params: {
          start_date: today.toISOString().slice(0, 10),
          end_date: end.toISOString().slice(0, 10),
        },
      },
    );

    const days = res.results ?? [];
    const availablePrices = days
      .filter((d) => d.status === "available" && typeof d.price === "number")
      .map((d) => d.price);

    if (!availablePrices.length) return fallbackPrice;

    return Math.min(...availablePrices); // e.g. “from ₹X”
  } catch (e) {
    console.error("calendar pricing error", e);
    return fallbackPrice;
  }
}

const MarkerTag = ({ price }: { price: number }) => (
  <View style={styles.priceTagWrap}>
    <View style={styles.priceTag}>
      <Text style={styles.priceTagText}>
        ₹{Math.round(price).toLocaleString("en-IN")}
      </Text>
    </View>
    <View style={styles.priceTagTail} />
  </View>
);

const PropertyCard = ({ property }: { property: Property }) => {
  const router = useRouter();
  const { t } = useTranslation();
  const go = (id: string) =>
    router.push({ pathname: "./listing/[id]", params: { id } });
  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.9}
      onPress={() => go(property.id)}
    >
      <View style={styles.cardContent}>
        <Image
          source={{ uri: property.image }}
          style={styles.cardImage}
          placeholder={{ blurhash: "L0A,l#~q00D%~qD%00%M00?b-;%M" }}
          transition={300}
        />
        <View style={styles.cardDetails}>
          <View style={styles.cardRow}>
            <Text style={styles.cardName} numberOfLines={1}>
              {property.name}
            </Text>
            <View style={styles.cardRating}>
              <Star size={12} color="#F59E0B" fill="#F59E0B" />
              <Text style={styles.cardRatingText}>
                {property.rating.toFixed(1)}
              </Text>
            </View>
          </View>
          <View style={styles.cardRow}>
            <MapPin size={12} color="#6B7280" />
            <Text style={styles.cardLocation} numberOfLines={1}>
              {property.location}
              {property.distance ? ` • ${property.distance}` : ""}
            </Text>
          </View>
          <View style={styles.cardFeatures}>
            {(property.features ?? []).slice(0, 3).map((feature) => (
              <View key={feature} style={styles.cardFeatureTag}>
                <Text style={styles.cardFeatureText}>{feature}</Text>
              </View>
            ))}
          </View>
          <View style={styles.cardRow}>
            <Text style={styles.cardPrice}>
              ₹{property.price.toLocaleString("en-IN")}
              <Text style={styles.cardPriceNight}>
                {t("listing.night_short")}
              </Text>
            </Text>
            <TouchableOpacity
              style={styles.cardViewButton}
              onPress={(e) => {
                e.stopPropagation();
                go(property.id);
              }}
            >
              <Text style={styles.cardViewButtonText}>{t("listing.view")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default function HomePage() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const [viewMode, setViewMode] = useState<"map" | "list">("list");

  // backend state
  const [chips, setChips] = useState<string[]>([]);
  const [popularAreas, setPopularAreas] = useState<string[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // map state
  const mapViewRef = useRef<MapView>(null);
  const [initialRegion, setInitialRegion] = useState<Region | undefined>(
    undefined,
  );
  const [currentRegion, setCurrentRegion] = useState<Region | undefined>(
    undefined,
  );
  const [showFindNearMe, setShowFindNearMe] = useState(true);

  useEffect(() => {
    const getLocationAndSetRegion = async () => {
      const fallback: Region = {
        latitude: 12.9716,
        longitude: 77.5946,
        latitudeDelta: 0.3,
        longitudeDelta: 0.3,
      };
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setInitialRegion(fallback);
        setCurrentRegion(fallback);
        await loadHome();
        return;
      }
      try {
        let loc = await Location.getCurrentPositionAsync({});
        const region = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        };
        setInitialRegion(region);
        setCurrentRegion(region);
      } catch {
        setInitialRegion(fallback);
        setCurrentRegion(fallback);
      } finally {
        await loadHome();
      }
    };
    getLocationAndSetRegion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadHome = useCallback(async () => {
    if (loading) return;
    setLoading(true);

    try {
      const data = await apiGet<ListResponse>("/v1/listings");

      const raw = data.results ?? [];
      const mapped: Property[] = raw.map(mapToProperty);

      // Pull prices from calendar for each listing
      const withDynamicPrices = await Promise.all(
        mapped.map(async (p) => ({
          ...p,
          price: await fetchEffectivePriceFromCalendar(p.listingId, p.price),
        })),
      );

      setChips(data.chips ?? []);
      setPopularAreas(data.popular ?? []);
      setProperties(withDynamicPrices);
      setNextCursor(data.next_cursor ?? null);
    } catch (e: any) {
      console.error(e);
      Alert.alert("Load error", e?.message ?? "Failed to load home.");
    } finally {
      setLoading(false);
    }
  }, [loading]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);

    try {
      const data = await apiGet<ListResponse>("/v1/listings", {
        params: { cursor: nextCursor },
      });

      const raw = data.results ?? [];
      const mapped: Property[] = raw.map(mapToProperty);

      const withDynamicPrices = await Promise.all(
        mapped.map(async (p) => ({
          ...p,
          price: await fetchEffectivePriceFromCalendar(p.listingId, p.price),
        })),
      );

      setProperties((prev) => [...prev, ...withDynamicPrices]);
      setNextCursor(data.next_cursor ?? null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore]);

  const handleNavigateToSearch = () => router.push("/search");

  const handleFindStaysNearMe = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        t("search.permission_denied"),
        "Enable location services to find stays near you.",
      );
      return;
    }

    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      router.push({
        pathname: "/search",
        params: {
          near_me: "1",
          lat: String(loc.coords.latitude),
          lon: String(loc.coords.longitude),
        },
      });
    } catch {
      Alert.alert("Location Error", "Could not fetch your location.");
      router.push("/search");
    }
  };

  const recenterToUser = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Location Permission",
          "Permission to access location was denied",
        );
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const center = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      };
      const newRegion: Region = {
        ...center,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      };
      setCurrentRegion(newRegion);
      mapViewRef.current?.animateCamera?.(
        { center, zoom: 15 },
        { duration: 350 },
      );
    } catch (e) {
      console.error(e);
      Alert.alert("Location Error", "Could not get your current location.");
    }
  };

  if (!initialRegion) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Finding your location...</Text>
      </View>
    );
  }

  return (
    <ThemedView key={i18n.language} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.searchContainer}>
            <TouchableOpacity
              style={styles.searchInput}
              onPress={handleNavigateToSearch}
              activeOpacity={0.8}
            >
              <Text style={styles.searchInputPlaceholder}>
                {t("search.where_to")}
              </Text>
            </TouchableOpacity>
            <View style={styles.searchIconWrap} pointerEvents="none">
              <Search size={18} color="#9AA0A6" />
            </View>
          </View>

          {/* Quick filters from backend (if provided) */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtersContainer}
          >
            {chips.map((f) => (
              <View key={f} style={styles.filterButton}>
                <Text style={styles.filterText}>{f}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Content */}
        <View style={styles.contentContainer}>
          {viewMode === "map" ? (
            <MapView
              ref={mapViewRef}
              style={styles.map}
              provider={PROVIDER_DEFAULT}
              initialRegion={initialRegion}
              onRegionChangeComplete={(r) => setCurrentRegion(r)}
              mapType="none"
              showsUserLocation={true}
            >
              {!!GEOAPIFY_API_KEY && (
                <UrlTile
                  urlTemplate={GEOAPIFY_TILE_URL}
                  maximumZ={20}
                  flipY={false}
                  zIndex={-1}
                />
              )}
              {properties.map((p) => (
                <Marker
                  key={p.id}
                  coordinate={p.coordinates}
                  anchor={{ x: 0.5, y: 1 }}
                >
                  <MarkerTag price={p.price} />
                </Marker>
              ))}
            </MapView>
          ) : (
            <FlatList<Property>
              data={properties}
              renderItem={({ item }) => <PropertyCard property={item} />}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              onEndReachedThreshold={0.3}
              onEndReached={loadMore}
              ListFooterComponent={
                loadingMore ? (
                  <Text style={{ textAlign: "center", paddingVertical: 8 }}>
                    Loading…
                  </Text>
                ) : null
              }
            />
          )}

          {/* Toggle */}
          <TouchableOpacity
            style={styles.viewToggleButton}
            onPress={() => setViewMode(viewMode === "map" ? "list" : "map")}
            activeOpacity={0.8}
          >
            {viewMode === "map" ? (
              <List size={20} color="white" />
            ) : (
              <Map size={20} color="white" />
            )}
          </TouchableOpacity>

          {/* Locate me on map */}
          {viewMode === "map" && (
            <TouchableOpacity
              style={styles.locateButton}
              onPress={recenterToUser}
              activeOpacity={0.85}
            >
              <LocateFixed size={18} color="white" />
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>

      {/* Footer */}
      <View style={styles.footer}>
        {showFindNearMe && (
          <TouchableOpacity
            style={styles.findStaysButton}
            onPress={handleFindStaysNearMe}
          >
            <Navigation size={16} color="white" />
            <Text style={styles.findStaysButtonText}>
              {t("index.find_stays_near_me")}
            </Text>
          </TouchableOpacity>
        )}
        <View style={styles.footerRow}>
          <TouchableOpacity
            style={styles.footerButton}
            onPress={() => router.push("/route")}
          >
            <Text style={styles.footerButtonText}>
              {t("route.plan_your_route")} →
            </Text>
          </TouchableOpacity>

          {/* Popular areas from backend (if provided) */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.popularAreasContainer}
          >
            {popularAreas.map((area) => (
              <TouchableOpacity
                key={area}
                style={styles.popularAreaButton}
                onPress={() =>
                  router.push({ pathname: "/search", params: { q: area } })
                }
              >
                <Text style={styles.popularAreaText}>{area}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </ThemedView>
  );
}

// ---- styles (your original styles; unchanged except for harmless comments) ----
const INPUT_HEIGHT = 48;
const ICON_SIZE = 18;
const ICON_PAD = 8;
const WRAP_SIZE = ICON_SIZE + ICON_PAD;
const ICON_LEFT = 16;

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "white",
  },
  container: { flex: 1, backgroundColor: "white" },
  safeArea: { flex: 1 },
  contentContainer: { flex: 1, position: "relative" },

  header: {
    backgroundColor: "white",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#EEEFF3",
    gap: 10,
  },

  // Search
  searchContainer: { position: "relative", justifyContent: "center" },
  searchInput: {
    width: "100%",
    height: INPUT_HEIGHT,
    paddingLeft: ICON_LEFT + WRAP_SIZE + 10,
    paddingRight: 16,
    borderWidth: 1,
    borderColor: "#E6E8EC",
    borderRadius: 24,
    backgroundColor: "#F6F7F9",
    justifyContent: "center",
  },
  searchInputPlaceholder: { fontSize: 16, color: "#9AA0A6" },
  searchIconWrap: {
    position: "absolute",
    left: ICON_LEFT,
    top: INPUT_HEIGHT / 2,
    transform: [{ translateY: -(WRAP_SIZE / 2) }],
    width: WRAP_SIZE,
    height: WRAP_SIZE,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 3,
  },

  filtersContainer: { flexDirection: "row", gap: 8, paddingVertical: 6 },
  filterButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E6E8EC",
    backgroundColor: "white",
  },
  filterText: { fontSize: 14, color: "#374151" },

  map: { flex: 1 },

  priceTagWrap: { alignItems: "center" },
  priceTag: {
    backgroundColor: "black",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "black",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 3,
  },
  priceTagText: { color: "white", fontSize: 13, fontWeight: "700" },
  priceTagTail: {
    marginTop: -2,
    width: 10,
    height: 10,
    backgroundColor: "white",
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#E5E7EB",
    transform: [{ rotate: "45deg" }],
  },

  listContent: { padding: 16, gap: 16 },

  // Toggle (top-right)
  viewToggleButton: {
    position: "absolute",
    top: 20,
    right: 20,
    width: 48,
    height: 48,
    backgroundColor: "#0E1320",
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 10,
  },

  // Locate-me button
  locateButton: {
    position: "absolute",
    top: 20 + 48 + 12,
    right: 20,
    width: 44,
    height: 44,
    backgroundColor: "#0E1320",
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 10,
  },

  card: {
    backgroundColor: "white",
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    overflow: "hidden",
  },
  cardContent: { flexDirection: "row", padding: 12, gap: 12 },
  cardImage: {
    width: 96,
    height: 96,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
  },
  cardDetails: { flex: 1, justifyContent: "space-between" },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    flex: 1,
    marginRight: 8,
  },
  cardRating: { flexDirection: "row", alignItems: "center", gap: 4 },
  cardRatingText: { fontSize: 14, fontWeight: "500" },
  cardLocation: { fontSize: 14, color: "#4B5563", flex: 1 },
  cardFeatures: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  cardFeatureTag: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  cardFeatureText: { fontSize: 10, color: "#374151", fontWeight: "500" },
  cardPrice: { fontSize: 16, fontWeight: "bold", color: "#111827" },
  cardPriceNight: { fontSize: 12, color: "#6B7080", fontWeight: "normal" },
  cardViewButton: {
    backgroundColor: "#0E1320",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  cardViewButtonText: { color: "white", fontSize: 14, fontWeight: "500" },

  // Footer
  footer: {
    backgroundColor: "white",
    padding: 16,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: "#E6E8EC",
    gap: 12,
  },
  findStaysButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0E1320",
    padding: 14,
    borderRadius: 16,
    gap: 8,
  },
  findStaysButtonText: { color: "white", fontSize: 16, fontWeight: "600" },
  footerRow: {
    flexDirection: "column",
    gap: 12,
    alignItems: "stretch",
  },
  footerButton: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#E6E8EC",
    padding: 14,
    borderRadius: 16,
    alignItems: "center",
  },
  footerButtonText: { color: "#0E1320", fontWeight: "500" },
  popularAreasContainer: { flexDirection: "row", gap: 8, paddingTop: 4 },
  popularAreaButton: {
    backgroundColor: "#F1F2F5",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  popularAreaText: { fontSize: 14, color: "#374151" },
});
