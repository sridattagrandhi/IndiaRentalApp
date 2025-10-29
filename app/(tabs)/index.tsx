// app/(tabs)/index.tsx
import { ThemedView } from '@/components/themed-view';
import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { List, LocateFixed, Map, MapPin, Navigation, Search, Star } from 'lucide-react-native'; // ⬅️ added LocateFixed
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
import { useRouter } from 'expo-router'; // Import useRouter
import MapView, { Marker, PROVIDER_DEFAULT, Region, UrlTile } from 'react-native-maps';

// --- API Key and URLs ---
const GEOAPIFY_API_KEY = Constants.expoConfig?.extra?.GEOAPIFY_API_KEY;

if (!GEOAPIFY_API_KEY) {
  console.error("Geoapify API key is missing! Check .env and app.config.js");
  Alert.alert("Configuration Error", "Map API key is missing. Map functionality may be limited.");
}

const GEOAPIFY_TILE_URL = `https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}.png?apiKey=${GEOAPIFY_API_KEY}`;

// --- Data Interfaces ---
interface Property {
  id: string;
  name: string;
  location: string;
  price: number;
  rating: number;
  distance: string;
  image: string;
  features: string[];
  coordinates: [number, number]; // [lng, lat]
}

// --- MODIFIED: Mock Data (San Francisco) ---
const mockProperties: Property[] = [
  {
    id: '1',
    name: 'Cozy Apartment in Mission',
    location: 'Mission District, SF',
    price: 3200,
    rating: 4.8,
    distance: '1.2 km',
    image: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=400&h=400&fit=crop',
    features: ['Parking', 'WiFi', 'AC'],
    coordinates: [-122.4194, 37.7749],
  },
  {
    id: '2',
    name: 'Spacious Villa in Pac Heights',
    location: 'Pacific Heights, SF',
    price: 5500,
    rating: 4.9,
    distance: '3.1 km',
    image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=400&h=400&fit=crop',
    features: ['Pool', 'Parking'],
    coordinates: [-122.4421, 37.7925],
  },
  {
    id: '3',
    name: 'Budget Stay Near Golden Gate',
    location: 'Richmond District, SF',
    price: 1800,
    rating: 4.5,
    distance: '4.2 km',
    image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400&h=400&fit=crop',
    features: ['WiFi', 'Breakfast'],
    coordinates: [-122.4731, 37.7801],
  },
];

const quickFilters = ['Tonight', 'Weekend', '₹ Budget', 'Family', 'Parking'];
const popularAreas = ['San Francisco', 'Oakland', 'San Jose', 'Napa', 'Sacramento'];

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
const PropertyCard = ({ property }: { property: Property }) => (
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
          <Text style={styles.cardName} numberOfLines={1}>{property.name}</Text>
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
          {property.features.map((feature) => (
            <View key={feature} style={styles.cardFeatureTag}>
              <Text style={styles.cardFeatureText}>{feature}</Text>
            </View>
          ))}
        </View>
        <View style={styles.cardRow}>
          <Text style={styles.cardPrice}>₹{property.price}<Text style={styles.cardPriceNight}>/night</Text></Text>
          <TouchableOpacity style={styles.cardViewButton}>
            <Text style={styles.cardViewButtonText}>View</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </TouchableOpacity>
);

// --- Main ---
export default function HomePage() {
  const router = useRouter(); // Get the router
  const [viewMode, setViewMode] = useState<'map' | 'list'>('list');
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const mapViewRef = useRef<MapView>(null);
  const [initialRegion, setInitialRegion] = useState<Region | undefined>(undefined);
  const [currentRegion, setCurrentRegion] = useState<Region | undefined>(undefined);
  const [showFindNearMe, setShowFindNearMe] = useState(true);
  const [areaLabel, setAreaLabel] = useState<string>('your area');

  // On mount: set region
  useEffect(() => {
    const getLocationAndSetRegion = async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      let fallback: Region = { latitude: 37.7749, longitude: -122.4194, latitudeDelta: 0.1, longitudeDelta: 0.1 }; // Default to SF
      if (status !== 'granted') { setInitialRegion(fallback); setCurrentRegion(fallback); return; }
      try {
        let loc = await Location.getCurrentPositionAsync({});
        const region = { latitude: loc.coords.latitude, longitude: loc.coords.longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 };
        setInitialRegion(region);
        setCurrentRegion(region);
      } catch {
        setInitialRegion(fallback);
        setCurrentRegion(fallback);
      }
    };
    getLocationAndSetRegion();
  }, []);

  // Reverse geocode center for “Listings in …”
  const fetchAreaLabel = async (lat: number, lon: number) => {
    try {
      if (!GEOAPIFY_API_KEY) return;
      const resp = await fetch(`https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lon}&apiKey=${GEOAPIFY_API_KEY}`);
      const j = await resp.json();
      const p = j?.features?.[0]?.properties;
      const name = p?.city || p?.town || p?.village || p?.county || p?.state || p?.country || 'this area';
      setAreaLabel(name);
    } catch {}
  };

  useEffect(() => {
    const r = currentRegion ?? initialRegion;
    if (r) fetchAreaLabel(r.latitude, r.longitude);
  }, [currentRegion, initialRegion]);

  const toggleFilter = (f: string) =>
    setSelectedFilters(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]);

  // --- MODIFIED: "Find stays near me" handler ---
  const handleFindStaysNearMe = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission denied', 'Enable location services to find stays near you.'); return; }
    
    try {
      let loc = await Location.getCurrentPositionAsync({});
      // Navigate to search page with current location
      router.push({
        pathname: '/search',
        params: { lat: loc.coords.latitude, lon: loc.coords.longitude }
      });
    } catch {
      Alert.alert("Location Error", "Could not fetch your current location. Defaulting to search.");
      router.push('/search'); // Go to search anyway
    }
  };

  // --- MODIFIED: Search bar navigation ---
  const handleNavigateToSearch = () => {
    // Navigate to search page without location params
    router.push('/search');
  };

  // ⬇️ NEW: recenter-to-user for the home map
  const recenterToUser = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location Permission', 'Permission to access location was denied');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const center = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      // Update state for label/logic
      const newRegion: Region = { ...center, latitudeDelta: 0.02, longitudeDelta: 0.02 };
      setCurrentRegion(newRegion);

      // Smooth camera move
      mapViewRef.current?.animateCamera?.({ center, zoom: 15 }, { duration: 350 });
    } catch (e) {
      console.error(e);
      Alert.alert('Location Error', 'Could not get your current location.');
    }
  };
  // ⬆️

  if (!initialRegion) {
    return (<View style={styles.loadingContainer}><Text>Finding your location...</Text></View>);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          {/* Search Bar (Modified to be a button) */}
          <View style={styles.searchContainer}>
            <TouchableOpacity
              style={styles.searchInput}
              onPress={handleNavigateToSearch} // Navigate on press
              activeOpacity={0.8}
            >
              <Text style={styles.searchInputPlaceholder}>
                Search city, landmark, or route (e.g., Mumbai → Pune)
              </Text>
            </TouchableOpacity>
            
            <View style={styles.searchIconWrap} pointerEvents="none">
              <Search size={18} color="#9AA0A6" />
            </View>
          </View>

          {/* Quick Filters */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersContainer}>
            {quickFilters.map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.filterButton, selectedFilters.includes(f) && styles.filterButtonSelected]}
                onPress={() => toggleFilter(f)}
              >
                <Text style={selectedFilters.includes(f) ? styles.filterTextSelected : styles.filterText}>
                  {f}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Content */}
        <View style={styles.contentContainer}>
          {viewMode === 'map' ? (
            <>
              <MapView
                ref={mapViewRef}
                style={styles.map}
                provider={PROVIDER_DEFAULT}
                initialRegion={initialRegion}
                onRegionChangeComplete={setCurrentRegion}
                mapType="none"
                showsUserLocation={true}
              >
                {GEOAPIFY_API_KEY && (
                  <UrlTile urlTemplate={GEOAPIFY_TILE_URL} maximumZ={20} flipY={false} zIndex={-1} />
                )}

                {mockProperties.map((p) => (
                  <Marker
                    key={p.id}
                    coordinate={{ latitude: p.coordinates[1], longitude: p.coordinates[0] }}
                    onPress={() => Alert.alert('Stay Selected', p.name)}
                    anchor={{ x: 0.5, y: 1 }}
                  >
                    <MarkerTag price={p.price} />
                  </Marker>
                ))}
              </MapView>
            </>
          ) : (
            <FlatList<Property>
              data={mockProperties}
              renderItem={({ item }) => <PropertyCard property={item} />}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
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

          {/* ⬇️ NEW: Locate-me button directly under the toggle */}
          {viewMode === 'map' && (
            <TouchableOpacity
              style={styles.locateButton}
              onPress={recenterToUser}
              activeOpacity={0.85}
            >
              <LocateFixed size={18} color="white" />
            </TouchableOpacity>
          )}
          {/* ⬆️ */}
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
          {/* --- MODIFICATION: Added onPress handler --- */}
          <TouchableOpacity 
            style={styles.footerButton}
            onPress={() => router.push('/route')}
          >
            <Text style={styles.footerButtonText}>Plan a route →</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.footerButton}>
            <Text style={styles.footerButtonText}>Explore popular areas</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.popularAreasContainer}>
          {popularAreas.map((area) => (
            <TouchableOpacity key={area} style={styles.popularAreaButton}>
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
    justifyContent: 'center', // Added for TouchableOpacity
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

  listContent: { padding: 16, gap: 16 },

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

  // NEW: Locate-me button (directly under the toggle)
  locateButton: {
    position: 'absolute',
    top: 20 + 48 + 12, // under the toggle (toggle top + toggle height + gap)
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

  // “Listings in …” pill
  locationBadge: {
    position: 'absolute',
    bottom: 20,
    left: '50%',
    transform: [{ translateX: -120 }],
    paddingVertical: 10,
    paddingHorizontal: 18,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
    zIndex: 10,
  },
  locationBadgeText: { fontSize: 14, fontWeight: '600', color: '#111827' },

  // Cards
  card: { backgroundColor: 'white', borderRadius: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2, overflow: 'hidden' },
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
  footer: { backgroundColor: 'white', padding: 16, paddingBottom: 24, borderTopWidth: 1, borderTopColor: '#E6E8EC', gap: 12 },
  findStaysButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: '#0E1320', padding: 14, borderRadius: 16, gap: 8 },
  findStaysButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  footerRow: { flexDirection: 'row', gap: 12 },
  footerButton: { flex: 1, borderWidth: 1, borderColor: '#E6E8EC', padding: 12, borderRadius: 14, alignItems: 'center' },
  footerButtonText: { color: '#0E1320', fontWeight: '500' },
  popularAreasContainer: { flexDirection: 'row', gap: 8, paddingTop: 4 },
  popularAreaButton: { backgroundColor: '#F1F2F5', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  popularAreaText: { fontSize: 14, color: '#374151' },
});
