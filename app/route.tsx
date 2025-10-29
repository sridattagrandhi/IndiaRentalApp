import { ThemedView } from '@/components/themed-view';
import { format, parseISO } from 'date-fns';
import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
import {
  ArrowLeft, Calendar, Check, Clock, Fuel, List, Map, MapPin,
  Minus, ParkingCircle, Plus,
  Route as RouteIcon, SlidersHorizontal, Star, Users, X
} from 'lucide-react-native';
import React, { Dispatch, SetStateAction, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Dimensions, Keyboard, LayoutChangeEvent, Modal, SafeAreaView, ScrollView,
  SectionList, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View
} from 'react-native';
import { CalendarList, DateData } from 'react-native-calendars';
import { Gesture, GestureDetector, FlatList as GestureFlatList } from 'react-native-gesture-handler';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT, Region } from 'react-native-maps';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ---- Height constants ----
const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const BOTTOM_SHEET_MIN_HEIGHT = SCREEN_HEIGHT * 0.15;
const DEFAULT_MAX_HEIGHT = SCREEN_HEIGHT * 0.55;
const MAP_MIN_VISIBLE_PX = 180;

// --- Geoapify API ---
const GEOAPIFY_API_KEY = Constants.expoConfig?.extra?.GEOAPIFY_API_KEY;
const GEOAPIFY_GEOCODE_URL = `https://api.geoapify.com/v1/geocode/search?apiKey=${GEOAPIFY_API_KEY}`;
const GEOAPIFY_ROUTING_URL = `https://api.geoapify.com/v1/routing`;

// --- Data ---
interface Property {
  id: string; name: string; location: string; price: number; rating: number;
  distanceFromRoute: string; segmentDistance: string; image: string; features: string[];
  routeSegment: string; coordinates: { latitude: number; longitude: number; };
}
const mockProperties: Property[] = [
  { id: '1', name: 'Highway Rest Inn', location: 'Near Panvel Toll Plaza', price: 1800, rating: 4.5, distanceFromRoute: '0.5 km', segmentDistance: '42 km from Mumbai', image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=1200&auto=format&fit=crop', features: ['Parking', '24×7 Check-in', 'Highway Access'], routeSegment: 'Near Panvel', coordinates: { latitude: 18.9894, longitude: 73.1175 } },
  { id: '2', name: 'Riverside Resort', location: 'Kolad', price: 3500, rating: 4.8, distanceFromRoute: '2.3 km', segmentDistance: '118 km from Mumbai', image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?q=80&w=1200&auto=format&fit=crop', features: ['Parking', 'Restaurant', 'EV Charging'], routeSegment: 'Near Kolad', coordinates: { latitude: 18.4116, longitude: 73.3278 } },
  { id: '3', name: 'Budget Stay Express', location: 'Khandala', price: 1200, rating: 4.2, distanceFromRoute: '1.1 km', segmentDistance: '68 km from Mumbai', image: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?q=80&w=1200&auto=format&fit=crop', features: ['Parking', 'WiFi', '24×7 Check-in'], routeSegment: 'Near Khandala', coordinates: { latitude: 18.7618, longitude: 73.3768 } },
  { id: '4', name: 'Lonavala Lake View', location: 'Lonavala', price: 4200, rating: 4.9, distanceFromRoute: '3.8 km', segmentDistance: '82 km from Mumbai', image: 'https://images.unsplash.com/photo-1444201983204-c43cbd584d93?q=80&w=1200&auto=format&fit=crop', features: ['Parking', 'Lake View', 'Restaurant'], routeSegment: 'Near Lonavala', coordinates: { latitude: 18.7557, longitude: 73.4091 } },
  { id: '5', name: 'Expressway Motel', location: 'Talegaon', price: 2100, rating: 4.4, distanceFromRoute: '0.8 km', segmentDistance: '95 km from Mumbai', image: 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?q=80&w=1200&auto=format&fit=crop', features: ['Parking', '24×7 Check-in'], routeSegment: 'Near Talegaon', coordinates: { latitude: 18.7297, longitude: 73.6601 } },
];

const mockRegion: Region = {
  latitude: 18.7888, longitude: 73.4079, latitudeDelta: 0.8, longitudeDelta: 0.8,
};

const radiusOptions = ['1 km of route', '3 km of route', '5 km of route', '10 km of route'];

const RoutePropertyCard = ({ property }: { property: Property }) => (
  <View style={styles.card}>
    <Image source={{ uri: property.image }} style={styles.cardImage}
      placeholder={{ blurhash: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj' }} transition={300} />
    <View style={styles.cardDetails}>
      <View style={[styles.cardRow, { marginBottom: 4 }]}>
        <Text style={styles.cardName} numberOfLines={2}>{property.name}</Text>
        <View style={styles.cardRating}><Star size={14} color="#F59E0B" fill="#F59E0B" /><Text style={styles.cardRatingText}>{property.rating}</Text></View>
      </View>
      <View style={[styles.cardRow, { marginBottom: 2 }]}>
        <MapPin size={12} color="#6B7280" />
        <Text style={styles.cardLocation} numberOfLines={1}>{property.location}</Text>
      </View>
      <Text style={styles.routeDistanceText}>{property.segmentDistance} • {property.distanceFromRoute} from route</Text>
      <View style={styles.cardFeatures}>
        {property.features.slice(0, 3).map((feature) => (
          <View key={feature} style={styles.cardFeatureTag}><Text style={styles.cardFeatureText}>{feature}</Text></View>
        ))}
      </View>
      <View style={[styles.cardRow, { marginTop: 'auto' }]}>
        <Text style={styles.cardPrice}>₹{property.price.toLocaleString('en-IN')}<Text style={styles.cardPriceNight}>/night</Text></Text>
        <TouchableOpacity style={styles.cardViewButton}><Text style={styles.cardViewButtonText}>View</Text></TouchableOpacity>
      </View>
    </View>
  </View>
);

// --- RouteSegmentsList ---
const RouteSegmentsList = ({ properties }: { properties: Property[] }) => {
  const sections = Object.entries(
    properties.reduce((acc, prop) => {
      (acc[prop.routeSegment] = acc[prop.routeSegment] || []).push(prop);
      return acc;
    }, {} as Record<string, Property[]>)
  ).map(([title, data]) => ({ title, data }));

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <RoutePropertyCard property={item} />}
      renderSectionHeader={({ section: { title } }) => (
        <View style={styles.segmentHeader}>
          <View style={styles.segmentLine} />
          <Text style={styles.segmentTitle}>{title}</Text>
          <View style={styles.segmentLine} />
        </View>
      )}
      contentContainerStyle={styles.listContent}
      style={styles.flatListInSheet}
      showsVerticalScrollIndicator={false}
      stickySectionHeadersEnabled={false}
      ListFooterComponent={<View style={{ height: 40 }} />}
    />
  );
};

// --- RouteSegmentsGestureList (inside sheet) ---
const RouteSegmentsGestureList = ({ properties }: { properties: Property[] }) => {
  const groupedData = Object.entries(
    properties.reduce((acc, prop) => {
      (acc[prop.routeSegment] = acc[prop.routeSegment] || []).push(prop);
      return acc;
    }, {} as Record<string, Property[]>)
  );

  return (
    <GestureFlatList
      data={groupedData}
      keyExtractor={([segment]) => segment}
      renderItem={({ item: [segment, props] }) => (
        <View style={styles.segmentContainer}>
          <View style={styles.segmentHeader}>
            <View style={styles.segmentLine} />
            <Text style={styles.segmentTitle}>{segment}</Text>
            <View style={styles.segmentLine} />
          </View>
          {props.map((prop) => (<RoutePropertyCard key={prop.id} property={prop} />))}
        </View>
      )}
      contentContainerStyle={styles.listContentBottomSheet}
      style={styles.flatListInSheet}
      showsVerticalScrollIndicator={false}
      ListFooterComponent={<View style={{ height: 50 }} />}
    />
  );
};

// --- Checkbox ---
interface CustomCheckboxProps {
  label: string; description: string; value: boolean; onValueChange: (v: boolean) => void; icon: React.ReactNode;
}
const CustomCheckbox = ({ label, description, value, onValueChange, icon }: CustomCheckboxProps) => (
  <TouchableOpacity style={styles.checkRow} onPress={() => onValueChange(!value)}>
    <View style={[styles.checkbox, value && styles.checkboxChecked]}>{value && <Check size={12} color="#FFFFFF" />}</View>
    <View style={styles.checkIcon}>{icon}</View>
    <View style={styles.checkTextContainer}><Text style={styles.checkLabel}>{label}</Text><Text style={styles.checkDescription}>{description}</Text></View>
  </TouchableOpacity>
);

// --- Filters Modal ---
interface RoadTripFilterPanelProps {
  isVisible: boolean; onClose: () => void; applyFilters: () => void; clearFilters: () => void;
  filteredCount: number; hasParking: boolean; setHasParking: Dispatch<SetStateAction<boolean>>;
  has24x7Checkin: boolean; setHas24x7Checkin: Dispatch<SetStateAction<boolean>>;
  hasHighwayAccess: boolean; setHasHighwayAccess: Dispatch<SetStateAction<boolean>>;
  hasEvCharging: boolean; setHasEvCharging: Dispatch<SetStateAction<boolean>>;
}
function RoadTripFilterPanel(props: RoadTripFilterPanelProps) {
  const {
    isVisible, onClose, applyFilters, clearFilters, filteredCount,
    hasParking, setHasParking, has24x7Checkin, setHas24x7Checkin,
    hasHighwayAccess, setHasHighwayAccess, hasEvCharging, setHasEvCharging,
  } = props;

  return (
    <Modal visible={isVisible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Road Trip Filters</Text>
          <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}><X size={24} color="#111827" /></TouchableOpacity>
        </View>
        <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
          <View style={styles.filterSection}>
            <CustomCheckbox label="Parking Available" description="Secure parking for your vehicle" value={hasParking} onValueChange={setHasParking} icon={<ParkingCircle size={22} color="#111827" />} />
            <CustomCheckbox label="24x7 Check-in" description="Arrive anytime, day or night" value={has24x7Checkin} onValueChange={setHas24x7Checkin} icon={<Clock size={22} color="#111827" />} />
            <CustomCheckbox label="Highway Access" description="Easy access from highway" value={hasHighwayAccess} onValueChange={setHasHighwayAccess} icon={<RouteIcon size={22} color="#111827" />} />
            <CustomCheckbox label="EV Charging" description="Electric vehicle charging available" value={hasEvCharging} onValueChange={setHasEvCharging} icon={<Fuel size={22} color="#111827" />} />
          </View>
        </ScrollView>
        <View style={styles.modalFooter}>
          <TouchableOpacity style={styles.clearButton} onPress={clearFilters}><Text style={styles.clearButtonText}>Clear all</Text></TouchableOpacity>
          <TouchableOpacity style={styles.showButton} onPress={applyFilters}><Text style={styles.showButtonText}>Show {filteredCount} results</Text></TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// --- Date Picker ---
interface DatePickerModalProps {
  isVisible: boolean; onClose: () => void; checkIn: string | null; checkOut: string | null;
  setCheckIn: (date: string | null) => void; setCheckOut: (date: string | null) => void;
}
function DatePickerModal({ isVisible, onClose, checkIn, checkOut, setCheckIn, setCheckOut }: DatePickerModalProps) {
  const [selectedStartDate, setSelectedStartDate] = useState<string | null>(checkIn);
  const [selectedEndDate, setSelectedEndDate] = useState<string | null>(checkOut);
  const [selectingPhase, setSelectingPhase] = useState<'start' | 'end'>(checkIn ? 'end' : 'start');

  useEffect(() => {
    setSelectedStartDate(checkIn);
    setSelectedEndDate(checkOut);
    setSelectingPhase(checkIn ? 'end' : 'start');
  }, [isVisible, checkIn, checkOut]);

  const handleDayPress = (day: DateData) => {
    if (selectingPhase === 'start' || (selectedStartDate && selectedEndDate && day.dateString < selectedStartDate!)) {
      setSelectedStartDate(day.dateString);
      setSelectedEndDate(null);
      setSelectingPhase('end');
    } else if (selectedStartDate && day.dateString >= selectedStartDate!) {
      setSelectedEndDate(day.dateString);
      setSelectingPhase('start');
    } else if (!selectedStartDate) {
      setSelectedStartDate(day.dateString);
      setSelectedEndDate(null);
      setSelectingPhase('end');
    }
  };

  const handleConfirm = () => {
    setCheckIn(selectedStartDate);
    setCheckOut(selectedEndDate);
    onClose();
  };

  const markedDates: { [date: string]: any } = {};
  if (selectedStartDate) markedDates[selectedStartDate] = { startingDay: true, color: '#111827', textColor: 'white' };
  if (selectedEndDate) {
    markedDates[selectedEndDate] = { endingDay: true, color: '#111827', textColor: 'white' };
    if (selectedStartDate && selectedStartDate !== selectedEndDate) {
      let currentDate = new Date(parseISO(selectedStartDate));
      const endDate = new Date(parseISO(selectedEndDate));
      currentDate.setDate(currentDate.getDate() + 1);
      while (currentDate < endDate) {
        const dateString = currentDate.toISOString().split('T')[0];
        markedDates[dateString] = { color: '#F3F4F6', textColor: '#111827' };
        currentDate.setDate(currentDate.getDate() + 1);
      }
      markedDates[selectedStartDate] = { ...markedDates[selectedStartDate], color: '#111827', textColor: 'white' };
      markedDates[selectedEndDate] = { ...markedDates[selectedEndDate], color: '#111827', textColor: 'white' };
    } else if (selectedStartDate === selectedEndDate) {
      markedDates[selectedStartDate] = { startingDay: true, endingDay: true, color: '#111827', textColor: 'white' };
    }
  }

  return (
    <Modal visible={isVisible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Select Dates</Text>
          <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}><X size={24} color="#111827" /></TouchableOpacity>
        </View>
        <View style={{ flex: 1 }}>
          <CalendarList
            current={selectedStartDate || new Date().toISOString().split('T')[0]}
            minDate={new Date().toISOString().split('T')[0]}
            onDayPress={handleDayPress}
            markingType={'period'}
            markedDates={markedDates}
            pastScrollRange={0}
            futureScrollRange={12}
            scrollEnabled showScrollIndicator
            theme={{
              backgroundColor: '#FFFFFF',
              calendarBackground: '#FFFFFF',
              textSectionTitleColor: '#111827',
              selectedDayBackgroundColor: '#111827',
              selectedDayTextColor: '#FFFFFF',
              todayTextColor: '#DC2626',
              dayTextColor: '#111827',
              textDisabledColor: '#D1D5DB',
            }}
          />
        </View>
        <View style={styles.datePickerModalFooter}>
          <TouchableOpacity style={styles.clearButton} onPress={() => { setSelectedStartDate(null); setSelectedEndDate(null); setSelectingPhase('start'); }}>
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.showButton, (!selectedStartDate || !selectedEndDate) && styles.disabledButton]}
            onPress={handleConfirm}
            disabled={!selectedStartDate || !selectedEndDate}
          >
            <Text style={styles.showButtonText}>Confirm Dates</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// --- Guests Modal ---
interface GuestPickerModalProps { isVisible: boolean; onClose: () => void; guests: number; setGuests: (count: number) => void; }
function GuestPickerModal({ isVisible, onClose, guests, setGuests }: GuestPickerModalProps) {
  const increment = () => setGuests(Math.min(guests + 1, 20));
  const decrement = () => setGuests(Math.max(guests - 1, 1));
  return (
    <Modal visible={isVisible} animationType="fade" transparent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.guestModalOverlay}>
          <TouchableWithoutFeedback>
            <View style={styles.guestModalContent}>
              <Text style={styles.guestModalTitle}>Select Guests</Text>
              <View style={styles.guestControlRow}>
                <Text style={styles.guestLabel}>Guests</Text>
                <View style={styles.guestButtons}>
                  <TouchableOpacity onPress={decrement} style={[styles.guestButton, guests <= 1 && styles.disabledGuestButton]} disabled={guests <= 1}><Minus size={20} color={guests <= 1 ? "#9CA3AF" : "#111827"} /></TouchableOpacity>
                  <Text style={styles.guestCount}>{guests}</Text>
                  <TouchableOpacity onPress={increment} style={[styles.guestButton, guests >= 20 && styles.disabledGuestButton]} disabled={guests >= 20}><Plus size={20} color={guests >= 20 ? "#9CA3AF" : "#111827"} /></TouchableOpacity>
                </View>
              </View>
              <TouchableOpacity style={styles.confirmGuestButton} onPress={onClose}><Text style={styles.confirmGuestButtonText}>Confirm</Text></TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

// --- Utils ---
const debounce = (fn: (...a: any[]) => void, ms = 400) => {
  let t: any;
  return (...a: any[]) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
};

// --- Main Page ---
type LatLon = { lat: number; lon: number };
type RouteOption = {
  label: string;
  coords: { latitude: number; longitude: number }[];
  distanceKm: number;
  timeMin: number;
};

export default function RoutePlannerPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [isFilterModalVisible, setFilterModalVisible] = useState(false);
  const [selectedRadius, setSelectedRadius] = useState('5 km of route');

  // Inputs accept any text (address/city/POI)
  const [fromLocationInput, setFromLocationInput] = useState('Mumbai');
  const [toLocationInput, setToLocationInput] = useState('Pune');
  const [fromCoords, setFromCoords] = useState<LatLon | null>({ lat: 19.0760, lon: 72.8777 });
  const [toCoords, setToCoords] = useState<LatLon | null>({ lat: 18.5204, lon: 73.8567 });

  const [checkInDate, setCheckInDate] = useState<string | null>(null);
  const [checkOutDate, setCheckOutDate] = useState<string | null>(null);
  const [guests, setGuests] = useState(2);
  const [isDatePickerVisible, setDatePickerVisible] = useState(false);
  const [isGuestPickerVisible, setGuestPickerVisible] = useState(false);

  // Filters
  const [hasParking, setHasParking] = useState(false);
  const [has24x7Checkin, setHas24x7Checkin] = useState(false);
  const [hasHighwayAccess, setHasHighwayAccess] = useState(false);
  const [hasEvCharging, setHasEvCharging] = useState(false);
  const [filteredProperties, setFilteredProperties] = useState(mockProperties);

  // Bottom sheet state
  const [maxSheetHeight, setMaxSheetHeight] = useState(DEFAULT_MAX_HEIGHT);
  const contentContainerHeight = useSharedValue(SCREEN_HEIGHT);
  const maxSheetHeightSV = useSharedValue(DEFAULT_MAX_HEIGHT);
  const translateY = useSharedValue(0);
  const context = useSharedValue({ y: 0 });
  const INITIAL_TRANSLATE_Y = -BOTTOM_SHEET_MIN_HEIGHT;

  // Map & routing state
  const mapRef = useRef<MapView | null>(null);
  const [bestRoute, setBestRoute] = useState<RouteOption | null>(null);
  const [altRoutes, setAltRoutes] = useState<RouteOption[]>([]);
  const [routingBusy, setRoutingBusy] = useState(false);

  const regionRef = useRef<Region | null>(null);

  // Sheet helpers
  const adjustZoom = async (delta: number) => {
    if (!mapRef.current) return;
    try {
      const cam = await mapRef.current.getCamera();
      if (typeof cam.zoom === 'number') {
        const next = Math.max(2, Math.min(20, cam.zoom + delta));
        mapRef.current.animateCamera({ zoom: next }, { duration: 200 });
        return;
      }
    } catch { /* fall through to region method */ }

    // Fallback: scale region deltas
    const r = regionRef.current;
    if (r) {
      const factor = delta > 0 ? 0.5 : 2; // zoom in halves deltas, zoom out doubles
      mapRef.current.animateToRegion(
        {
          ...r,
          latitudeDelta: Math.max(0.0005, r.latitudeDelta * factor),
          longitudeDelta: Math.max(0.0005, r.longitudeDelta * factor),
        },
        200
      );
    }
  };


  const clampHeightsFromLayout = (containerHeight: number) => {
    const allowedMax = Math.max(
      BOTTOM_SHEET_MIN_HEIGHT,
      Math.min(containerHeight - MAP_MIN_VISIBLE_PX, SCREEN_HEIGHT * 0.9)
    );
    const finalMax = Math.max(allowedMax, BOTTOM_SHEET_MIN_HEIGHT + 1);
    setMaxSheetHeight(finalMax);
    maxSheetHeightSV.value = finalMax;
  };
  const onContentLayout = (event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    contentContainerHeight.value = height;
    clampHeightsFromLayout(height);
  };
  const gesture = Gesture.Pan()
    .onStart(() => { context.value = { y: translateY.value }; })
    .onUpdate((event) => {
      translateY.value = event.translationY + context.value.y;
      translateY.value = Math.max(translateY.value, -(maxSheetHeightSV.value - BOTTOM_SHEET_MIN_HEIGHT));
      translateY.value = Math.min(translateY.value, 0);
    });
  const animatedBottomSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    height: maxSheetHeight,
    bottom: -maxSheetHeight + BOTTOM_SHEET_MIN_HEIGHT,
  }));
  useEffect(() => { translateY.value = withSpring(0, { damping: 15 }); }, []);

  // --- Routing helpers ---
  const parseRouteFeature = (feature: any): RouteOption | null => {
    if (!feature) return null;
    const geom = feature.geometry;
    const props = feature.properties || {};
    const lonlatPairs: number[][] =
      geom?.type === 'LineString' ? geom.coordinates :
      geom?.type === 'MultiLineString' ? geom.coordinates.flat() : [];
    if (!lonlatPairs.length) return null;
    const coords = lonlatPairs.map(([lon, lat]) => ({ latitude: lat, longitude: lon }));
    const distanceMeters = Number(props?.distance ?? props?.total_distance ?? 0);
    const timeSeconds = Number(props?.time ?? props?.total_time ?? 0);
    return {
      label: 'route',
      coords,
      distanceKm: distanceMeters / 1000,
      timeMin: timeSeconds / 60,
    };
  };

  const pickBest = (routes: RouteOption[]): RouteOption | null => {
    if (!routes.length) return null;
    // prefer lowest time, then distance
    const sorted = routes.slice().sort((a, b) =>
      a.timeMin !== b.timeMin ? a.timeMin - b.timeMin : a.distanceKm - b.distanceKm
    );
    return sorted[0];
  };

  // Fetch several candidate routes and choose the best
  const fetchBestRoute = async (from: LatLon, to: LatLon) => {
    if (!GEOAPIFY_API_KEY) {
      Alert.alert('API Key Error', 'Geoapify API key is missing.');
      return;
    }
    try {
      setRoutingBusy(true);

      const waypoints = `${from.lat},${from.lon}|${to.lat},${to.lon}`;

      // Two candidates: optimize by time and by distance
      const candidates = [
        { label: 'Fastest', query: `mode=drive&optimize=time` },
        { label: 'Shortest', query: `mode=drive&optimize=distance` },
      ];

      const fetched: RouteOption[] = [];
      for (const c of candidates) {
        const url = `${GEOAPIFY_ROUTING_URL}?waypoints=${encodeURIComponent(waypoints)}&${c.query}&apiKey=${GEOAPIFY_API_KEY}`;
        const res = await fetch(url);
        if (!res.ok) continue;
        const json = await res.json();
        const option = parseRouteFeature(json?.features?.[0]);
        if (option) {
          option.label = c.label;
          fetched.push(option);
        }
      }

      // Fallback single standard route if above didn't return
      if (!fetched.length) {
        const fallbackUrl = `${GEOAPIFY_ROUTING_URL}?waypoints=${encodeURIComponent(waypoints)}&mode=drive&apiKey=${GEOAPIFY_API_KEY}`;
        const res = await fetch(fallbackUrl);
        if (!res.ok) throw new Error(`Routing API Error: ${res.status}`);
        const json = await res.json();
        const option = parseRouteFeature(json?.features?.[0]);
        if (option) {
          option.label = 'Default';
          fetched.push(option);
        }
      }

      const best = pickBest(fetched);
      setBestRoute(best);
      setAltRoutes(best ? fetched.filter(r => r !== best) : fetched);

      // Fit map
      if (mapRef.current && best?.coords && best.coords.length > 1) {
        mapRef.current.fitToCoordinates(best.coords, {
          edgePadding: {
            top: 120,
            right: 40,
            bottom: Math.max(120, Math.floor(maxSheetHeight) + 40),
            left: 40,
          },
          animated: true,
        });
      }
    } catch (e: any) {
      console.error('Routing failed:', e);
      Alert.alert('Routing Error', e?.message || 'Unable to fetch route.');
    } finally {
      setRoutingBusy(false);
    }
  };

  // Debounced version so we don't hammer the API on quick edits
  const debouncedFetch = useMemo(() => debounce(fetchBestRoute, 400), []);

  // Geocode helper (works for city/address/POI)
  const handleLocationSearch = async (type: 'from' | 'to') => {
    Keyboard.dismiss();
    const query = (type === 'from' ? fromLocationInput : toLocationInput).trim();
    if (!query) return;
    if (!GEOAPIFY_API_KEY) { Alert.alert('API Key Error', 'Geoapify API key is missing.'); return; }

    try {
      const biasParam = `&bias=countrycode:in`;
      const url = `${GEOAPIFY_GEOCODE_URL}&text=${encodeURIComponent(query)}${biasParam}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`API Error: ${response.status}`);

      const data = await response.json();
      if (data.features && data.features.length > 0) {
        const first = data.features[0];
        const [lon, lat] = first.geometry.coordinates;
        const label = first.properties.formatted || query;

        if (type === 'from') {
          setFromCoords({ lat, lon });
          setFromLocationInput(label);
        } else {
          setToCoords({ lat, lon });
          setToLocationInput(label);
        }
      } else {
        Alert.alert('Not Found', `No results for "${query}"`);
      }
    } catch (err: any) {
      console.error('Geocoding failed:', err);
      Alert.alert('Search Error', err?.message || 'Could not perform search.');
    }
  };

  const swapEnds = () => {
    setFromLocationInput((prev) => {
      const tmpText = toLocationInput;
      setToLocationInput(prev);
      return tmpText;
    });
    setFromCoords((prev) => {
      const tmp = toCoords;
      setToCoords(prev);
      return tmp!;
    });
  };

  const displayDates = () => {
    if (checkInDate && checkOutDate) {
      return `${format(parseISO(checkInDate), 'MMM dd')} - ${format(parseISO(checkOutDate), 'MMM dd')}`;
    }
    return 'Select dates';
  };

  // Auto-fetch when both coords are known (debounced)
  useEffect(() => {
    if (fromCoords && toCoords) {
      debouncedFetch(fromCoords, toCoords);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromCoords?.lat, fromCoords?.lon, toCoords?.lat, toCoords?.lon]);

  const applyFilters = () => { setFilteredProperties(mockProperties); setFilterModalVisible(false); };
  const clearFilters = () => {
    setHasParking(false); setHas24x7Checkin(false); setHasHighwayAccess(false); setHasEvCharging(false);
    setFilteredProperties(mockProperties);
  };

  const renderPriceMarker = (price: number) => (
    <View style={styles.priceTagWrap}><Text style={styles.priceTagText}>₹{(price / 1000).toFixed(1)}k</Text></View>
  );

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Plan Your Route',
          headerTitleAlign: 'left',
          headerShadowVisible: false,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
              <ArrowLeft size={24} color="#111827" />
            </TouchableOpacity>
          ),
          headerTitle: (props) => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <RouteIcon size={20} color="#111827" />
              <Text style={{ fontSize: 20, fontWeight: '600', marginLeft: 8 }}>{props.children}</Text>
            </View>
          ),
        }}
      />

      <View style={{ flex: 1, marginTop: -insets.top }}>
        <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
          <View style={styles.flex1}>
            {/* Search row */}
            <View style={styles.searchInputsContainer}>
              <View style={styles.inputWrapper}>
                <MapPin size={18} color="#16A34A" />
                <Text style={styles.inputLabel}>From</Text>
                <TextInput
                  value={fromLocationInput}
                  onChangeText={setFromLocationInput}
                  onSubmitEditing={() => handleLocationSearch('from')}
                  placeholder="City / Address / Place"
                  placeholderTextColor="#6B7280"
                  style={styles.textInputStyle}
                  returnKeyType="search"
                />
              </View>
              <View style={styles.inputWrapper}>
                <MapPin size={18} color="#DC2626" />
                <Text style={styles.inputLabel}>To</Text>
                <TextInput
                  value={toLocationInput}
                  onChangeText={setToLocationInput}
                  onSubmitEditing={() => handleLocationSearch('to')}
                  placeholder="City / Address / Place"
                  placeholderTextColor="#6B7280"
                  style={styles.textInputStyle}
                  returnKeyType="search"
                />
              </View>

              <View style={styles.inlineRow}>

                <TouchableOpacity
                  style={[styles.inputInline, styles.inlineFlexItem]}
                  onPress={() => setDatePickerVisible(true)}
                >
                  <Calendar size={18} color="#6B7280" />
                  <Text
                    style={[styles.inputText, (!checkInDate || !checkOutDate) && styles.inputPlaceholderText]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {displayDates()}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.inputInline, styles.inlineFlexItem]}
                  onPress={() => setGuestPickerVisible(true)}
                >
                  <Users size={18} color="#6B7280" />
                  <Text style={styles.inputText} numberOfLines={1} ellipsizeMode="tail">
                    {guests} Guest{guests > 1 ? 's' : ''}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Radius */}
            <View style={styles.radiusContainer}>
              <Text style={styles.radiusLabel}>Show within:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {radiusOptions.map(option => (
                  <TouchableOpacity
                    key={option}
                    style={[styles.radiusButton, selectedRadius === option && styles.radiusButtonActive]}
                    onPress={() => setSelectedRadius(option)}
                  >
                    <Text style={[styles.radiusButtonText, selectedRadius === option && styles.radiusButtonTextActive]}>{option}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Filter bar */}
            <View style={styles.filterBar}>
              <TouchableOpacity style={styles.filterButton} onPress={() => setFilterModalVisible(true)}>
                <SlidersHorizontal size={16} color="#111827" /><Text style={styles.filterButtonText}>Road Trip Filters</Text>
              </TouchableOpacity>
              <Text style={styles.filterResultText}>
                {filteredProperties.length} stays along {fromLocationInput} → {toLocationInput}
              </Text>
            </View>

            {/* Content (measured for sheet clamp) */}
            <View style={styles.contentArea} onLayout={onContentLayout}>
              {viewMode === 'list' && <RouteSegmentsList properties={filteredProperties} />}

              {viewMode === 'map' && (
                <>
                  {/* Route summary pill */}
                  {(bestRoute || routingBusy) && (
                    <View style={styles.routeSummaryPill}>
                      <Text style={styles.routeSummaryText}>
                        {routingBusy
                          ? 'Calculating routes…'
                          : `Best: ${bestRoute!.distanceKm.toFixed(1)} km • ${Math.round(bestRoute!.timeMin)} min`}
                      </Text>
                    </View>
                  )}

                  {/* Empty-state hint */}
                  {!routingBusy && !bestRoute && (
                    <View style={[styles.routeSummaryPill, { right: 16 }]}>
                      <Text style={styles.routeSummaryText}>No route found. Try different locations.</Text>
                    </View>
                  )}

                  {/* Alternates legend (if any) */}
                  {!!altRoutes.length && (
                    <View style={styles.altLegend}>
                      <View style={styles.legendRow}>
                        <View style={[styles.legendSwatch, { borderColor: '#2563EB', backgroundColor: '#2563EB' }]} />
                        <Text style={styles.legendText}>Best route</Text>
                      </View>
                      <View style={styles.legendRow}>
                        <View style={[styles.legendSwatch, { borderColor: '#94A3B8', backgroundColor: 'transparent' }]} />
                        <Text style={styles.legendText}>Alternates</Text>
                      </View>
                    </View>
                  )}

                  <MapView ref={mapRef} style={styles.map} provider={PROVIDER_DEFAULT} initialRegion={mockRegion} onRegionChangeComplete={(region) => (regionRef.current = region)} onMapReady={() => mapRef.current?.animateCamera({ pitch: 0, heading: 0 }, { duration: 0 })}>
                    {mockProperties.map(prop => (
                      <Marker key={prop.id} coordinate={prop.coordinates}>
                        {renderPriceMarker(prop.price)}
                      </Marker>
                    ))}

                    {fromCoords && (
                      <Marker coordinate={{ latitude: fromCoords.lat, longitude: fromCoords.lon }} title="From" pinColor="#16A34A" />
                    )}
                    {toCoords && (
                      <Marker coordinate={{ latitude: toCoords.lat, longitude: toCoords.lon }} title="To" pinColor="#DC2626" />
                    )}

                    {/* Alternate routes (dashed) */}
                    {altRoutes.map((r, idx) => (
                      <Polyline
                        key={`alt-${idx}`}
                        coordinates={r.coords}
                        strokeWidth={4}
                        strokeColor="#94A3B8"
                        lineDashPattern={[8, 8]}
                      />
                    ))}

                    {/* Best route (solid) */}
                    {bestRoute && (
                      <Polyline coordinates={bestRoute.coords} strokeWidth={6} strokeColor="#2563EB" />
                    )}
                  </MapView>

                  <View pointerEvents="box-none" style={styles.zoomControls}>
                      <TouchableOpacity style={styles.zoomBtn} onPress={() => adjustZoom(+1)}>
                        <Plus size={18} color="#111827" />
                      </TouchableOpacity>
                      <View style={{ height: 8 }} />
                      <TouchableOpacity style={styles.zoomBtn} onPress={() => adjustZoom(-1)}>
                        <Minus size={18} color="#111827" />
                      </TouchableOpacity>
                  </View>

                  <Animated.View style={[styles.bottomSheet, animatedBottomSheetStyle]}>
                    <GestureDetector gesture={gesture}>
                      <View style={styles.dragHandleContainer}><View style={styles.dragHandle} /></View>
                    </GestureDetector>
                    <RouteSegmentsGestureList properties={filteredProperties} />
                  </Animated.View>
                </>
              )}
            </View>

            <TouchableOpacity style={styles.mapToggleButton} onPress={() => setViewMode(prev => (prev === 'list' ? 'map' : 'list'))}>
              {viewMode === 'list' ? <Map size={22} color="white" /> : <List size={22} color="white" />}
            </TouchableOpacity>

            <RoadTripFilterPanel
              isVisible={isFilterModalVisible} onClose={() => setFilterModalVisible(false)}
              applyFilters={applyFilters} clearFilters={clearFilters}
              filteredCount={filteredProperties.length}
              hasParking={hasParking} setHasParking={setHasParking}
              has24x7Checkin={has24x7Checkin} setHas24x7Checkin={setHas24x7Checkin}
              hasHighwayAccess={hasHighwayAccess} setHasHighwayAccess={setHasHighwayAccess}
              hasEvCharging={hasEvCharging} setHasEvCharging={setHasEvCharging}
            />

            <DatePickerModal
              isVisible={isDatePickerVisible}
              onClose={() => setDatePickerVisible(false)}
              checkIn={checkInDate}
              checkOut={checkOutDate}
              setCheckIn={setCheckInDate}
              setCheckOut={setCheckOutDate}
            />
            <GuestPickerModal
              isVisible={isGuestPickerVisible}
              onClose={() => setGuestPickerVisible(false)}
              guests={guests}
              setGuests={setGuests}
            />
          </View>
        </TouchableWithoutFeedback>
      </View>
    </ThemedView>
  );
}


// --- Styles ---
const styles = StyleSheet.create({
  flex1: { flex: 1 },
  container: { flex: 1, backgroundColor: '#FFFFFF' },

  searchInputsContainer: {
    paddingHorizontal: 16, marginTop: 8, borderRadius: 12, backgroundColor: '#F3F4F6',
    overflow: 'hidden', marginHorizontal: 16,
  },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center', height: 52,
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB', paddingHorizontal: 12,
  },
  inputLabel: { fontSize: 12, color: '#6B7280', marginLeft: 12 },
  textInputStyle: { flex: 1, fontSize: 16, color: '#111827', marginLeft: 8, fontWeight: '500' },

  inlineRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 52, gap: 8 },
  inputInline: { flexDirection: 'row', alignItems: 'center', flex: 1, backgroundColor: 'white', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 10, height: 40 },
  inputText: { flex: 1, fontSize: 16, marginLeft: 8, color: '#111827' },
  inputPlaceholderText: { color: '#6B7280', fontSize: 16, marginLeft: 8 },

  // ADDED styles
  radiusContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginTop: 16 },
  radiusLabel: { fontSize: 14, color: '#6B7280', marginRight: 8 },
  radiusButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99, backgroundColor: '#F3F4F6', marginRight: 8 },
  radiusButtonActive: { backgroundColor: '#111827' },
  radiusButtonText: { fontSize: 13, color: '#374151', fontWeight: '500' },
  radiusButtonTextActive: { color: '#FFFFFF' },

  filterBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginTop: 16, marginBottom: 8 },
  filterButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 99 },
  filterButtonText: { fontSize: 14, marginLeft: 6, color: '#111827' },
  filterResultText: { fontSize: 13, color: '#6B7280', marginLeft: 12, flex: 1 },

  contentArea: { flex: 1, position: 'relative' },
  listContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 80 },
  listContentBottomSheet: { paddingHorizontal: 16, paddingTop: 0, paddingBottom: 80 },
  flatListInSheet: { flex: 1 },
  segmentContainer: { marginBottom: 16 },
  segmentHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, marginTop: 8 },
  segmentLine: { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
  segmentTitle: { fontSize: 13, fontWeight: '600', color: '#111827', paddingHorizontal: 12, backgroundColor: '#F3F4F6', paddingVertical: 4, borderRadius: 99 },

  mapToggleButton: {
    position: 'absolute', bottom: 32, alignSelf: 'center', width: 56, height: 56, backgroundColor: '#111827',
    borderRadius: 28, justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 5, zIndex: 10,
  },

  // Cards
  card: { backgroundColor: 'white', borderRadius: 16, overflow: 'hidden', marginBottom: 16, height: 200, flexDirection: 'row', borderWidth: 1, borderColor: '#E5E7EB' },
  cardImage: { width: 140, height: '100%' },
  cardDetails: { flex: 1, padding: 14 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardName: { fontSize: 16, lineHeight: 22, fontWeight: '600', color: '#111827', flex: 1 },
  cardRating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardRatingText: { fontSize: 14, fontWeight: '500' },
  cardLocation: { fontSize: 13, color: '#4B5563', flex: 1, marginLeft: 4 },
  routeDistanceText: { fontSize: 13, color: '#4B5563', marginTop: 3 },
  cardFeatures: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  cardFeatureTag: { backgroundColor: '#F3F4F6', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  cardFeatureText: { fontSize: 10, color: '#374151', fontWeight: '500' },
  cardPrice: { fontSize: 16, paddingVertical: 10, fontWeight: 'bold', color: '#111827' },
  cardPriceNight: { fontSize: 12, color: '#6B7080', fontWeight: 'normal' },
  cardViewButton: { backgroundColor: '#0E1320', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  cardViewButtonText: { color: 'white', fontSize: 14, fontWeight: '500' },

  priceTagWrap: { backgroundColor: '#111827', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 2, elevation: 4 },
  priceTagText: { color: 'white', fontSize: 14, fontWeight: 'bold' },

  // Bottom sheet
  bottomSheet: {
    position: 'absolute', left: 0, right: 0, backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 10, zIndex: 5,
  },
  dragHandleContainer: { height: 48, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  dragHandle: { width: 40, height: 5, backgroundColor: '#E5E7EB', borderRadius: 3 },

  // Modals (shared)
  modalContainer: { flex: 1, backgroundColor: 'white' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', position: 'relative' },
  modalTitle: { fontSize: 18, fontWeight: '600' },
  modalCloseButton: { position: 'absolute', left: 16, top: 16, padding: 4 },
  modalScroll: { flex: 1 },
  modalScrollContent: { padding: 24, paddingBottom: 100 },
  filterSection: { gap: 16 },
  checkRow: { flexDirection: 'row', alignItems: 'center' },
  checkIcon: { marginLeft: 12 },
  checkTextContainer: { marginLeft: 12, flex: 1 },
  checkLabel: { fontSize: 16, color: '#111827' },
  checkDescription: { fontSize: 13, color: '#6B7280' },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: '#B0B0B0', justifyContent: 'center', alignItems: 'center' },
  checkboxChecked: { backgroundColor: '#111827', borderColor: '#111827' },
  modalFooter: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', padding: 16, paddingBottom: 24, backgroundColor: 'white', borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  clearButton: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6', marginRight: 8 },
  clearButtonText: { fontSize: 16, fontWeight: '600', color: '#111827' },
  showButton: { flex: 2, padding: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111827', marginLeft: 8 },
  showButtonText: { fontSize: 16, fontWeight: '600', color: 'white' },
  datePickerModalFooter: { flexDirection: 'row', padding: 16, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  disabledButton: { backgroundColor: '#D1D5DB' },

  // Guests modal
  guestModalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.4)', justifyContent: 'center', alignItems: 'center' },
  guestModalContent: { backgroundColor: 'white', borderRadius: 16, padding: 24, width: '85%', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 },
  guestModalTitle: { fontSize: 18, fontWeight: '600', marginBottom: 20, textAlign: 'center' },
  guestControlRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  guestLabel: { fontSize: 16, color: '#374151' },
  guestButtons: { flexDirection: 'row', alignItems: 'center' },
  guestButton: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: '#D1D5DB', justifyContent: 'center', alignItems: 'center', marginHorizontal: 8 },
  disabledGuestButton: { borderColor: '#E5E7EB' },
  guestCount: { fontSize: 18, fontWeight: '600', minWidth: 30, textAlign: 'center' },
  confirmGuestButton: { backgroundColor: '#111827', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  confirmGuestButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },

  // Map & overlays
  map: { flex: 1 },
  routeSummaryPill: {
    position: 'absolute', top: 8, right: 16, backgroundColor: 'white',
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: '#E5E7EB', shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2, zIndex: 6,
  },
  routeSummaryText: { fontSize: 12, color: '#111827', fontWeight: '600' },
  altLegend: {
    position: 'absolute', top: 8, left: 16, backgroundColor: 'white', borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2, zIndex: 6,
  },
  legendRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  legendSwatch: { width: 16, height: 6, borderRadius: 3, marginRight: 8, borderWidth: 2 },
  legendText: { fontSize: 12, color: '#111827' },
  inlineFlexItem: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 0,            // critical to allow text truncation in flex rows on iOS
  },
  zoomControls: {
    position: 'absolute',
    right: 12,
    top: 50,           // raise if your bottom sheet overlaps; tweak as needed
    alignItems: 'center',
    zIndex: 10,
  },
  zoomBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 2,
  },
});
