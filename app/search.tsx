// app/search.tsx
import { ThemedView } from '@/components/themed-view';
import { apiGet } from '@/services/api';
import Slider from '@react-native-community/slider';
import { format, parseISO } from 'date-fns';
import Constants from 'expo-constants';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft, Calendar as CalendarIcon, Check, ChevronDown, List,
  LocateFixed,
  Map, MapPin,
  Minus, Plus, SlidersHorizontal, Star, Users, X
} from 'lucide-react-native';
import React, { Dispatch, SetStateAction, useEffect, useRef, useState } from 'react';
import {
  Alert, Dimensions, FlatList, Keyboard, LayoutChangeEvent, Modal,
  SafeAreaView, ScrollView,
  StyleSheet,
  Text, TextInput, TouchableOpacity,
  TouchableWithoutFeedback, View
} from 'react-native';
import { CalendarList, DateData } from 'react-native-calendars';
import { Gesture, GestureDetector, FlatList as GestureFlatList } from 'react-native-gesture-handler';
import MapView, { Marker, PROVIDER_DEFAULT, Region } from 'react-native-maps';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const BOTTOM_SHEET_MIN_HEIGHT = SCREEN_HEIGHT * 0.15;
const DEFAULT_MAX_HEIGHT = SCREEN_HEIGHT * 0.55;
const MAP_MIN_VISIBLE_PX = 180;

const GEOAPIFY_API_KEY = Constants.expoConfig?.extra?.GEOAPIFY_API_KEY;
const GEOAPIFY_GEOCODE_URL = `https://api.geoapify.com/v1/geocode/search?apiKey=${GEOAPIFY_API_KEY}`;
const API = Constants.expoConfig?.extra?.API_BASE_URL ?? 'http://localhost:4000';

type Coordinates = { latitude: number; longitude: number };
type BackendListing = {
  id: number;
  title: string;
  street?: string | null;
  city?: string | null;
  price: number;
  rating: number;
  amenities: string[];
  photo_url?: string | null;
  coordinates: Coordinates;
  distance?: string | null;
};
type SearchResp = { count: number; results: BackendListing[]; next_cursor?: number | null };

interface Property {
  id: string;
  name: string;
  location: string;
  price: number;
  rating: number;
  distance: string;
  image: string;
  features: string[];
  type: 'room' | 'home' | 'hotel';
  coordinates: Coordinates;
}

const backendToProperty = (x: BackendListing): Property => ({
  id: String(x.id),
  name: x.title ?? 'Untitled stay',
  // prefer street, then city
  location: (x.street || x.city || '—'),
  price: Number(x.price) || 0,
  rating: Number(x.rating) || 0,
  distance: x.distance || '—',
  image: x.photo_url || 'https://picsum.photos/seed/fallback/640/480',
  features: Array.isArray(x.amenities) ? x.amenities : [],
  type: 'home',
  coordinates: x.coordinates
});

const INDIA_REGION: Region = { latitude: 22.9734, longitude: 78.6569, latitudeDelta: 20, longitudeDelta: 25 };
const sortOptions = ['Best match', 'Lowest price', 'Highest rated', 'Closest'];

const PropertyCard = ({ property }: { property: Property }) => {
  const router = useRouter();
  const go = () => router.push({ pathname: '/listing/[id]', params: { id: property.id } });

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.92} onPress={go}>
      <Image source={{ uri: property.image }} style={styles.cardImage} transition={250} />
      <View style={styles.cardDetails}>
        <View style={styles.cardRow}>
          <Text style={styles.cardName} numberOfLines={1}>{property.name}</Text>
          <View style={styles.cardRating}>
            <Star size={14} color="#F59E0B" fill="#F59E0B" />
            <Text style={styles.cardRatingText}>{Number.isFinite(property.rating) ? property.rating : '—'}</Text>
          </View>
        </View>
        <View style={[styles.cardRow, { marginTop: 4 }]}>
          <MapPin size={12} color="#6B7280" />
          <Text style={styles.cardLocation} numberOfLines={1}>{property.location} • {property.distance}</Text>
        </View>
        <View style={styles.cardFeatures}>
          {property.features.slice(0, 3).map(f => (
            <View key={f} style={styles.cardFeatureTag}><Text style={styles.cardFeatureText}>{f}</Text></View>
          ))}
        </View>
        <View style={[styles.cardRow, { marginTop: 'auto' }]}>
          <Text style={styles.cardPrice}>₹{Number(property.price).toLocaleString('en-IN')}<Text style={styles.cardPriceNight}>/night</Text></Text>
          <TouchableOpacity style={styles.cardViewButton} onPress={(e) => { e.stopPropagation(); go(); }}>
            <Text style={styles.cardViewButtonText}>View</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
};

interface CustomCheckboxProps { label: string; value: boolean; onValueChange: (v: boolean) => void; }
const CustomCheckbox = ({ label, value, onValueChange }: CustomCheckboxProps) => (
  <TouchableOpacity style={styles.checkRow} onPress={() => onValueChange(!value)}>
    <View style={[styles.checkbox, value && styles.checkboxChecked]}>{value && <Check size={12} color="#fff" />}</View>
    <Text style={styles.checkLabel}>{label}</Text>
  </TouchableOpacity>
);
interface CustomRadioProps { label: string; value: boolean; onValueChange: () => void; showStar?: boolean; }
const CustomRadio = ({ label, value, onValueChange, showStar = false }: CustomRadioProps) => (
  <TouchableOpacity style={styles.checkRow} onPress={onValueChange}>
    <View style={[styles.radio, value && styles.radioChecked]}>{value && <View style={styles.radioCheckedInner} />}</View>
    <Text style={styles.checkLabel}>{label}</Text>
    {showStar && (<><Star size={14} color="#F59E0B" fill="#F59E0B" style={{ marginLeft: 4 }} /><Text style={styles.checkLabel}> & up</Text></>)}
  </TouchableOpacity>
);

interface FilterPanelProps {
  isVisible: boolean; onClose: () => void; applyFilters: () => void; clearFilters: () => void;
  filteredCount: number; priceRange: [number, number]; setPriceRange: Dispatch<SetStateAction<[number, number]>>;
  propertyTypes: string[]; setPropertyTypes: Dispatch<SetStateAction<string[]>>;
  amenities: string[]; setAmenities: Dispatch<SetStateAction<string[]>>;
  minRating: string; setMinRating: Dispatch<SetStateAction<string>>;
  instantBookOnly: boolean; setInstantBookOnly: Dispatch<SetStateAction<boolean>>;
  radiusKm: number; setRadiusKm: Dispatch<SetStateAction<number>>;
}
function FilterPanel(props: FilterPanelProps) {
  const {
    isVisible, onClose, applyFilters, clearFilters, filteredCount,
    priceRange, setPriceRange, propertyTypes, setPropertyTypes,
    amenities, setAmenities, minRating, setMinRating,
    instantBookOnly, setInstantBookOnly, radiusKm, setRadiusKm
  } = props;

  const togglePropertyType = (type: string) =>
    setPropertyTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);

  const toggleAmenity = (amenity: string) =>
    setAmenities(prev => prev.includes(amenity) ? prev.filter(a => a !== amenity) : [...prev, amenity]);

  return (
    <Modal visible={isVisible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Filters</Text>
          <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}><X size={24} color="#111827" /></TouchableOpacity>
        </View>

        <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
          {/* price */}
          <View style={styles.filterSection}>
            <Text style={styles.filterTitle}>Price Range (per night)</Text>
            <Slider
              style={styles.slider}
              value={priceRange[0]}
              onValueChange={v => setPriceRange([Math.round(v), priceRange[1]])}
              minimumValue={0} maximumValue={10000} step={100}
              minimumTrackTintColor="#111827" maximumTrackTintColor="#E5E7EB" thumbTintColor="#111827"
            />
            <View style={styles.priceRangeLabels}>
              <Text style={styles.priceLabel}>₹{priceRange[0]}</Text>
              <Text style={styles.priceLabel}>₹10000+</Text>
            </View>
          </View>

          {/* radius */}
          <View style={styles.filterSection}>
            <Text style={styles.filterTitle}>Search Radius</Text>
            <Slider style={styles.slider} value={radiusKm} onValueChange={v => setRadiusKm(Math.round(v))}
              minimumValue={1} maximumValue={50} step={1}
              minimumTrackTintColor="#111827" maximumTrackTintColor="#E5E7EB" thumbTintColor="#111827" />
            <View style={styles.radiusLabelContainer}><Text style={styles.radiusLabelText}>Within {radiusKm} km</Text></View>
          </View>

          {/* type */}
          <View style={styles.filterSection}>
            <Text style={styles.filterTitle}>Property Type</Text>
            {['Room', 'Home', 'Hotel'].map(type => (
              <CustomCheckbox key={type} label={type}
                value={propertyTypes.includes(type.toLowerCase())}
                onValueChange={() => togglePropertyType(type.toLowerCase())} />
            ))}
          </View>

          {/* amenities */}
          <View style={styles.filterSection}>
            <Text style={styles.filterTitle}>Amenities</Text>
            {['AC', 'Parking', 'WiFi', 'Late Check-in', 'Pool', 'Breakfast'].map(a => (
              <CustomCheckbox key={a} label={a}
                value={amenities.includes(a)} onValueChange={() => toggleAmenity(a)} />
            ))}
          </View>

          {/* rating */}
          <View style={styles.filterSection}>
            <Text style={styles.filterTitle}>Minimum Rating</Text>
            <CustomRadio label="Any" value={minRating === '0'} onValueChange={() => setMinRating('0')} />
            <CustomRadio label="3.5" value={minRating === '3.5'} onValueChange={() => setMinRating('3.5')} showStar />
            <CustomRadio label="4.0" value={minRating === '4.0'} onValueChange={() => setMinRating('4.0')} showStar />
            <CustomRadio label="4.5" value={minRating === '4.5'} onValueChange={() => setMinRating('4.5')} showStar />
          </View>

          <View style={styles.filterSection}>
            <CustomCheckbox label="Instant Book only" value={instantBookOnly} onValueChange={setInstantBookOnly} />
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

// ----- Date & Guest pickers (unchanged UI) -----

interface DatePickerModalProps {
  isVisible: boolean; onClose: () => void; checkIn: string | null; checkOut: string | null;
  setCheckIn: (d: string | null) => void; setCheckOut: (d: string | null) => void;
}
function DatePickerModal({ isVisible, onClose, checkIn, checkOut, setCheckIn, setCheckOut }: DatePickerModalProps) {
  const [start, setStart] = useState<string | null>(checkIn);
  const [end, setEnd] = useState<string | null>(checkOut);
  const [phase, setPhase] = useState<'start' | 'end'>(checkIn ? 'end' : 'start');

  useEffect(() => { setStart(checkIn); setEnd(checkOut); setPhase(checkIn ? 'end' : 'start'); }, [isVisible, checkIn, checkOut]);

  const handleDay = (d: DateData) => {
    if (phase === 'start' || !start) { 
      setStart(d.dateString); 
      setEnd(null); 
      setPhase('end'); 
      return; 
    }
    if (start && d.dateString >= start) { 
      setEnd(d.dateString); 
      setPhase('start'); 
      return; 
    }
    setStart(d.dateString);
    setEnd(null);
    setPhase('end');
  };

  const confirm = () => { setCheckIn(start); setCheckOut(end); onClose(); };

  const marked: Record<string, any> = {};
  if (start) marked[start] = { startingDay: true, color: '#111827', textColor: 'white' };
  if (end) {
    marked[end] = { endingDay: true, color: '#111827', textColor: 'white' };
    if (start && start !== end) {
      let cur = new Date(parseISO(start)); const to = new Date(parseISO(end));
      cur.setDate(cur.getDate() + 1);
      while (cur < to) {
        const s = cur.toISOString().split('T')[0];
        marked[s] = { color: '#F3F4F6', textColor: '#111827' };
        cur.setDate(cur.getDate() + 1);
      }
      marked[start] = { ...marked[start], color: '#111827', textColor: 'white' };
      marked[end] = { ...marked[end], color: '#111827', textColor: 'white' };
    }
  }

  return (
    <Modal visible={isVisible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}><Text style={styles.modalTitle}>Select Dates</Text><TouchableOpacity onPress={onClose} style={styles.modalCloseButton}><X size={24} color="#111827" /></TouchableOpacity></View>
        <View style={{ flex: 1 }}>
          <CalendarList
            current={start || new Date().toISOString().split('T')[0]}
            minDate={new Date().toISOString().split('T')[0]}
            onDayPress={handleDay}
            markingType="period"
            markedDates={marked}
            pastScrollRange={0}
            futureScrollRange={12}
            scrollEnabled
            showScrollIndicator
          />
        </View>
        <View style={styles.modalFooter}>
          <TouchableOpacity style={styles.clearButton} onPress={() => { setStart(null); setEnd(null); setPhase('start'); }}>
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.showButton, (!start || !end) && styles.disabledButton]}
            onPress={confirm} disabled={!start || !end}>
            <Text style={styles.showButtonText}>Confirm Dates</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

interface GuestPickerModalProps { isVisible: boolean; onClose: () => void; guests: number; setGuests: (n: number) => void; }
function GuestPickerModal({ isVisible, onClose, guests, setGuests }: GuestPickerModalProps) {
  const inc = () => setGuests(Math.min(guests + 1, 20));
  const dec = () => setGuests(Math.max(guests - 1, 1));
  return (
    <Modal visible={isVisible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.guestModalOverlay}>
          <TouchableWithoutFeedback>
            <View style={styles.guestModalContent}>
              <Text style={styles.guestModalTitle}>Select Guests</Text>
              <View style={styles.guestControlRow}>
                <Text style={styles.guestLabel}>Guests</Text>
                <View style={styles.guestButtons}>
                  <TouchableOpacity onPress={dec} style={[styles.guestButton, guests <= 1 && styles.disabledGuestButton]} disabled={guests <= 1}><Minus size={20} color={guests <= 1 ? "#9CA3AF" : "#111827"} /></TouchableOpacity>
                  <Text style={styles.guestCount}>{guests}</Text>
                  <TouchableOpacity onPress={inc} style={[styles.guestButton, guests >= 20 && styles.disabledGuestButton]} disabled={guests >= 20}><Plus size={20} color={guests >= 20 ? "#9CA3AF" : "#111827"} /></TouchableOpacity>
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

// ----- Screen -----

export default function SearchPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { q: qFromParams, lat, lon } = useLocalSearchParams<{ q?: string; lat?: string; lon?: string }>();

  const [stayType, setStayType] = useState('Stays');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('map');
  const [sortBy, setSortBy] = useState('Best match');
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  const [searchLocationInput, setSearchLocationInput] = useState(qFromParams || '');
  const [searchLocationDisplay, setSearchLocationDisplay] = useState(qFromParams || 'India');

  const [region, setRegion] = useState<Region>(INDIA_REGION);

  const [checkInDate, setCheckInDate] = useState<string | null>(null);
  const [checkOutDate, setCheckOutDate] = useState<string | null>(null);
  const [guests, setGuests] = useState(2);
  const [isDatePickerVisible, setDatePickerVisible] = useState(false);
  const [isGuestPickerVisible, setGuestPickerVisible] = useState(false);
  const [isFilterModalVisible, setFilterModalVisible] = useState(false);

  // filters
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]);
  const [propertyTypes, setPropertyTypes] = useState<string[]>([]);
  const [amenities, setAmenities] = useState<string[]>([]);
  const [minRating, setMinRating] = useState('0');
  const [instantBookOnly, setInstantBookOnly] = useState(false);
  const [radiusKm, setRadiusKm] = useState(10);

  // data
  const [properties, setProperties] = useState<Property[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [useBbox, setUseBbox] = useState(false);
  const triedNoBboxRef = useRef(false);

  // --- helpers ---

  const buildBbox = (r: Region): string => {
    const minLon = r.longitude - r.longitudeDelta / 2;
    const maxLon = r.longitude + r.longitudeDelta / 2;
    const minLat = r.latitude - r.latitudeDelta / 2;
    const maxLat = r.latitude + r.latitudeDelta / 2;
    return `${minLon},${minLat},${maxLon},${maxLat}`;
  };


  const buildSearchParams = (cursorOverride?: number | null, includeBbox = useBbox) => {
    const qs = new URLSearchParams();

    if (searchLocationInput) qs.append('q', searchLocationInput);
    if (includeBbox && region) qs.append('bbox', buildBbox(region));

    // dates/guests (optional)
    if (checkInDate) qs.append('start', checkInDate);
    if (checkOutDate) qs.append('end', checkOutDate);
    if (guests) qs.append('guests', String(guests));

    // filters -> backend
    qs.append('min_price', String(priceRange[0]));
    qs.append('max_price', String(priceRange[1]));
    if (minRating !== '0') qs.append('min_rating', minRating);
    if (amenities.length) qs.append('amenities', amenities.join(','));

    // sort
    if (sortBy === 'Lowest price') qs.append('sort', 'price_asc');
    else if (sortBy === 'Highest rated') qs.append('sort', 'rating_desc');
    //else if (sortBy === 'Closest') qs.append('sort', 'distance'); // placeholder
    else qs.append('sort', 'newest');

    // pagination
    const c = cursorOverride ?? nextCursor;
    if (c != null) qs.append('cursor', String(c));
    qs.append('limit', '20');

    return qs;
  };

  const fetchSearch = async (cursorOverride: number | null = 0, replace = true, includeBbox = useBbox) => {
    try {
      const qs = buildSearchParams(cursorOverride, includeBbox);
      const params = Object.fromEntries(qs.entries());
      const data = await apiGet<SearchResp>('/v1/search', params);
      const items = (data.results ?? []).map(backendToProperty);

      if (replace || !cursorOverride) {
        setProperties(items);
      } else {
        setProperties(prev => [...prev, ...items]);
      }
      setNextCursor(data.next_cursor ?? null);

      // if first fetch and we have coords, recenter
      if (replace && items.length) {
        const c = items[0].coordinates;
        setRegion({ latitude: c.latitude, longitude: c.longitude, latitudeDelta: 0.2, longitudeDelta: 0.2 });
        triedNoBboxRef.current = false;
      }
      if (replace && includeBbox && items.length === 0 && !triedNoBboxRef.current) {
        triedNoBboxRef.current = true;
        await fetchSearch(0, true, false);
     }
    } catch (e: any) {
      console.error('Search error', e);
      Alert.alert('Search Error', e?.message ?? 'Failed to load results');
    }
  };

  const applyFilters = () => {
    setFilterModalVisible(false);
    setUseBbox(true);
    fetchSearch(0, true, true);
  };
  const clearFilters = () => {
    setPriceRange([0, 10000]);
    setPropertyTypes([]);
    setAmenities([]);
    setMinRating('0');
    setInstantBookOnly(false);
    setRadiusKm(10);
    setUseBbox(false);
    fetchSearch(0, true, false);
  };

  const onEndReached = async () => {
    if (nextCursor == null || loadingMore) return;   // <- key change
    setLoadingMore(true);
    try {
      await fetchSearch(nextCursor, /* replace */ false);
    } finally {
      setLoadingMore(false);
    }
  };

  // --- map bottom-sheet sizing ---
  const [maxSheetHeight, setMaxSheetHeight] = useState(DEFAULT_MAX_HEIGHT);
  const maxSheetHeightSV = useSharedValue(DEFAULT_MAX_HEIGHT);
  const contentContainerHeight = useSharedValue(SCREEN_HEIGHT);
  const translateY = useSharedValue(0);
  const context = useSharedValue({ y: 0 });

  const clampHeightsFromLayout = (h: number) => {
    const allowedMax = Math.max(BOTTOM_SHEET_MIN_HEIGHT, Math.min(h - MAP_MIN_VISIBLE_PX, SCREEN_HEIGHT * 0.9));
    const finalMax = Math.max(allowedMax, BOTTOM_SHEET_MIN_HEIGHT + 1);
    setMaxSheetHeight(finalMax);
    maxSheetHeightSV.value = finalMax;
  };
  const onContentLayout = (e: LayoutChangeEvent) => {
    contentContainerHeight.value = e.nativeEvent.layout.height;
    clampHeightsFromLayout(e.nativeEvent.layout.height);
  };
  const gesture = Gesture.Pan().onStart(() => { context.value = { y: translateY.value }; }).onUpdate((ev) => {
    translateY.value = Math.max(Math.min(ev.translationY + context.value.y, 0), -(maxSheetHeightSV.value - BOTTOM_SHEET_MIN_HEIGHT));
  });
  const animatedBottomSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    height: maxSheetHeight,
    bottom: -maxSheetHeight + BOTTOM_SHEET_MIN_HEIGHT,
  }));
  useEffect(() => { translateY.value = withSpring(0, { damping: 15 }); }, []);

  // initial fetches
  useEffect(() => {
    fetchSearch(0, true, false);

  }, []);

  useEffect(() => {
    if (useBbox) fetchSearch(0, true, true);
  }, [region, useBbox]);

  useEffect(() => {
    // bootstrap from lat/lon (if provided)
    const boot = async (a: number, b: number) => {
      if (!GEOAPIFY_API_KEY) return;
      try {
        const resp = await fetch(`https://api.geoapify.com/v1/geocode/reverse?lat=${a}&lon=${b}&apiKey=${GEOAPIFY_API_KEY}`);
        const j = await resp.json();
        const display = j?.features?.[0]?.properties?.road || j?.features?.[0]?.properties?.formatted || 'Current Location';
        setSearchLocationInput(display);
        setSearchLocationDisplay(display);
        const r: Region = { latitude: a, longitude: b, latitudeDelta: 0.12, longitudeDelta: 0.12 };
        setRegion(r);
        await fetchSearch(0, true);
        setUseBbox(true);
        await fetchSearch(0, true, /* includeBbox */ true);
      } catch {
        // swallow
      }
    };
    if (lat && lon) boot(parseFloat(String(lat)), parseFloat(String(lon)));
  }, [lat, lon]);

  // search bar — geocode then fetch
  const handleLocationSearch = async () => {
    Keyboard.dismiss();
    const query = searchLocationInput.trim();
    if (!query) return;

    if (!GEOAPIFY_API_KEY) { Alert.alert("API Key Error", "Geoapify API key is missing."); return; }
    try {
      const url = `${GEOAPIFY_GEOCODE_URL}&text=${encodeURIComponent(query)}&bias=countrycode:in`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      const f = data?.features?.[0];
      if (!f) { Alert.alert('Not found', `No results for "${query}"`); return; }
      const [lon, lat] = f.geometry.coordinates;
      const props = f.properties;
      const display = props.road || props.formatted || query;
      setSearchLocationDisplay(display);
      const next: Region = { latitude: lat, longitude: lon, latitudeDelta: 0.2, longitudeDelta: 0.2 };
      setRegion(next);
      await fetchSearch(0, true);
      setUseBbox(true);
      await fetchSearch(0, true, /* includeBbox */ true);
    } catch (e: any) {
      console.error(e);
      Alert.alert('Search Error', e?.message ?? 'Failed to find that place');
    }
  };

  // map controls
  const mapRef = useRef<MapView | null>(null);
  const [locating, setLocating] = useState(false);
  const recenterToUser = async () => {
    try {
      setLocating(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission denied', 'Location access was denied'); return; }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const center = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      setRegion({ ...center, latitudeDelta: 0.02, longitudeDelta: 0.02 });
      mapRef.current?.animateCamera?.({ center, zoom: 15 }, { duration: 300 });
      await fetchSearch(0, true);
      setUseBbox(true);
      await fetchSearch(0, true, /* includeBbox */ true);
    } finally { setLocating(false); }
  };
  const zoomBy = (f: number) => setRegion(prev => {
    const next = { ...prev, latitudeDelta: prev.latitudeDelta * f, longitudeDelta: prev.longitudeDelta * f };
    mapRef.current?.animateToRegion(next, 200);
    return next;
  });
  const zoomIn = () => zoomBy(0.6);
  const zoomOut = () => zoomBy(1.4);

  const renderSortDropdown = () => (
    <View style={styles.dropdown}>
      {sortOptions.map(option => (
        <TouchableOpacity key={option} style={styles.dropdownItem} onPress={() => { setSortBy(option); setShowSortDropdown(false); fetchSearch(0, true); }}>
          <Text style={styles.dropdownItemText}>{option}</Text>
          {sortBy === option && <Check size={16} color="#111827" />}
        </TouchableOpacity>
      ))}
    </View>
  );
  const renderPriceMarker = (price: number) => (<View style={styles.priceTagWrap}><Text style={styles.priceTagText}>₹{(price / 1000).toFixed(1)}k</Text></View>);
  const displayDates = () => (checkInDate && checkOutDate ? `${format(parseISO(checkInDate), 'MMM dd')} - ${format(parseISO(checkOutDate), 'MMM dd')}` : 'Select dates');

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: `Stays in ${searchLocationDisplay}`,
          headerShadowVisible: false,
          headerLeft: () => (<TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 0 }}><ArrowLeft size={24} color="#111827" /></TouchableOpacity>),
        }}
      />

      <View style={{ flex: 1, marginTop: -insets.top }}>
        <TouchableWithoutFeedback onPress={() => { setShowSortDropdown(false); Keyboard.dismiss(); }}>
          <View style={styles.flex1}>
            {/* top inputs */}
            <View style={styles.searchInputsContainer}>
              <View style={styles.inputWrapper}>
                <MapPin size={18} color="#6B7280" />
                <TextInput
                  placeholder="Location" value={searchLocationInput} onChangeText={setSearchLocationInput}
                  onSubmitEditing={handleLocationSearch} placeholderTextColor="#6B7280" style={styles.input} returnKeyType="search"
                />
              </View>
              <TouchableOpacity style={styles.inputWrapper} onPress={() => setDatePickerVisible(true)}>
                <CalendarIcon size={18} color="#6B7280" />
                <Text style={[styles.inputText, (!checkInDate || !checkOutDate) && styles.inputPlaceholderText]}>{displayDates()}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.inputWrapper} onPress={() => setGuestPickerVisible(true)}>
                <Users size={18} color="#6B7280" />
                <Text style={styles.inputText}>{guests} Guest{guests > 1 ? 's' : ''}</Text>
              </TouchableOpacity>
            </View>

            {/* tabs */}
            <View style={styles.tabsContainer}>
              {['Stays', 'Monthly', 'Micro-stay'].map(tab => (
                <TouchableOpacity key={tab} style={[styles.tab, stayType === tab && styles.tabActive]} onPress={() => setStayType(tab)}>
                  <Text style={[styles.tabText, stayType === tab && styles.tabTextActive]}>{tab}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* filter/sort */}
            <View style={styles.filterBarContainer}>
              <View style={styles.filterBar}>
                <TouchableOpacity style={styles.filterButton} onPress={() => setFilterModalVisible(true)}>
                  <SlidersHorizontal size={16} color="#111827" /><Text style={styles.filterButtonText}>Filters</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.sortButton} onPress={() => setShowSortDropdown(true)}>
                  <Text style={styles.sortButtonText}>{sortBy}</Text><ChevronDown size={16} color="#6B7280" />
                </TouchableOpacity>
              </View>
              {showSortDropdown && renderSortDropdown()}
            </View>

            {/* content */}
            <View style={styles.contentArea} onLayout={onContentLayout}>
              {viewMode === 'list' && (
                <FlatList
                  data={properties}
                  keyExtractor={(x) => x.id}
                  renderItem={({ item }) => <PropertyCard property={item} />}
                  contentContainerStyle={styles.listContent}
                  onEndReached={onEndReached}
                  onEndReachedThreshold={0.4}
                  showsVerticalScrollIndicator={false}
                />
              )}
              {viewMode === 'map' && (
                <>
                  <View style={styles.mapContainer}>
                    <MapView ref={mapRef} style={styles.mapView} provider={PROVIDER_DEFAULT} initialRegion={region} region={region}>
                      {properties.map(p => (<Marker key={p.id} coordinate={p.coordinates}>{renderPriceMarker(p.price)}</Marker>))}
                    </MapView>

                    {/* floating map controls */}
                    <View pointerEvents="box-none" style={styles.locateControl}>
                      <TouchableOpacity style={[styles.zoomBtn, { marginBottom: 8 }]} onPress={zoomIn}><Text style={{ fontSize: 18, color: '#111827' }}>＋</Text></TouchableOpacity>
                      <TouchableOpacity style={[styles.zoomBtn, { marginBottom: 8 }]} onPress={zoomOut}><Text style={{ fontSize: 22, lineHeight: 22, color: '#111827' }}>－</Text></TouchableOpacity>
                      <TouchableOpacity style={styles.zoomBtn} onPress={recenterToUser} disabled={locating}><LocateFixed size={18} color="#111827" /></TouchableOpacity>
                    </View>
                  </View>

                  <Animated.View style={[styles.bottomSheet, animatedBottomSheetStyle]}>
                    <GestureDetector gesture={gesture}>
                      <View style={styles.dragHandleContainer}><View style={styles.dragHandle} /></View>
                    </GestureDetector>
                    <GestureFlatList
                      data={properties}
                      keyExtractor={(x) => x.id}
                      renderItem={({ item }) => <PropertyCard property={item} />}
                      contentContainerStyle={styles.listContentBottomSheet}
                      style={styles.flatListInSheet}
                      onEndReached={onEndReached}
                      onEndReachedThreshold={0.4}
                      showsVerticalScrollIndicator={false}
                    />
                  </Animated.View>
                </>
              )}
            </View>

            {/* toggle */}
            <TouchableOpacity style={styles.mapToggleButton} onPress={() => setViewMode(v => (v === 'list' ? 'map' : 'list'))}>
              {viewMode === 'list' ? <Map size={22} color="white" /> : <List size={22} color="white" />}
            </TouchableOpacity>

            {/* modals */}
            <FilterPanel
              isVisible={isFilterModalVisible} onClose={() => setFilterModalVisible(false)}
              applyFilters={applyFilters} clearFilters={clearFilters}
              filteredCount={properties.length}
              priceRange={priceRange} setPriceRange={setPriceRange}
              propertyTypes={propertyTypes} setPropertyTypes={setPropertyTypes}
              amenities={amenities} setAmenities={setAmenities}
              minRating={minRating} setMinRating={setMinRating}
              instantBookOnly={instantBookOnly} setInstantBookOnly={setInstantBookOnly}
              radiusKm={radiusKm} setRadiusKm={setRadiusKm}
            />
            <DatePickerModal isVisible={isDatePickerVisible} onClose={() => setDatePickerVisible(false)}
              checkIn={checkInDate} checkOut={checkOutDate} setCheckIn={setCheckInDate} setCheckOut={setCheckOutDate} />
            <GuestPickerModal isVisible={isGuestPickerVisible} onClose={() => setGuestPickerVisible(false)} guests={guests} setGuests={setGuests} />
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
  input: { flex: 1, fontSize: 16, marginLeft: 12, color: '#111827' },
  inputText: { flex: 1, fontSize: 16, marginLeft: 12, color: '#111827' },
  inputPlaceholderText: { color: '#6B7280' },
  tabsContainer: {
    flexDirection: 'row', marginHorizontal: 16, marginTop: 16, backgroundColor: '#F3F4F6',
    borderRadius: 99, padding: 4,
  },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 99, alignItems: 'center' },
  tabActive: {
    backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1, shadowRadius: 2, elevation: 3,
  },
  tabText: { fontSize: 14, fontWeight: '500', color: '#6B7280' },
  tabTextActive: { color: '#111827', fontWeight: '600' },
  filterBarContainer: { paddingHorizontal: 16, marginTop: 16, marginBottom: 8, zIndex: 10 },
  filterBar: { flexDirection: 'row', alignItems: 'center' },
  filterButton: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 99,
  },
  filterButtonText: { fontSize: 14, marginLeft: 6, color: '#111827' },
  sortButton: {
    flexDirection: 'row', alignItems: 'center', marginLeft: 12, paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 99,
  },
  sortButtonText: { fontSize: 14, color: '#111827', marginRight: 4 },
  dropdown: {
    position: 'absolute', top: 48, left: 90, backgroundColor: 'white', borderRadius: 12,
    borderWidth: 1, borderColor: '#E5E7EB', shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 5, width: 200,
  },
  dropdownItem: {
    paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row',
    justifyContent: 'space-between', alignItems: 'center',
  },
  dropdownItemText: { fontSize: 16, color: '#111827' },
  contentArea: { flex: 1, position: 'relative' },
  listContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 80 },
  listContentBottomSheet: { paddingHorizontal: 16, paddingTop: 0, paddingBottom: 30 },
  flatListInSheet: { flex: 1 },
  mapToggleButton: {
    position: 'absolute', bottom: 32, alignSelf: 'center', width: 56, height: 56, backgroundColor: '#111827',
    borderRadius: 28, justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4,
    elevation: 5, zIndex: 10,
  },
  card: {
    backgroundColor: 'white', borderRadius: 16, overflow: 'hidden', marginBottom: 16,
    height: 140, flexDirection: 'row', borderWidth: 1, borderColor: '#E5E7EB',
  },
  cardImage: { width: 120, height: '100%' },
  instantBadge: {
    position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
  },
  instantBadgeText: { color: '#111827', fontSize: 10, fontWeight: 'bold' },
  cardDetails: { flex: 1, padding: 12 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardName: { fontSize: 16, fontWeight: '600', color: '#111827', flex: 1 },
  cardRating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardRatingText: { fontSize: 14, fontWeight: '500' },
  cardLocation: { fontSize: 13, color: '#4B5563', flex: 1, marginLeft: 4 },
  cardFeatures: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  cardFeatureTag: { backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  cardFeatureText: { fontSize: 10, color: '#374151', fontWeight: '500' },
  cardPrice: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
  cardPriceNight: { fontSize: 12, color: '#6B7080', fontWeight: 'normal' },
  cardViewButton: { backgroundColor: '#0E1320', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  cardViewButtonText: { color: 'white', fontSize: 14, fontWeight: '500' },
  priceTagWrap: {
    backgroundColor: '#111827', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 2, elevation: 4,
  },
  priceTagText: { color: 'white', fontSize: 14, fontWeight: 'bold' },
  bottomSheet: {
    position: 'absolute', left: 0, right: 0,
    backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 10, zIndex: 5,
  },
  dragHandleContainer: {
    height: 48, paddingVertical: 16, alignItems: 'center', justifyContent: 'center',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
  },
  dragHandle: { width: 40, height: 5, backgroundColor: '#E5E7EB', borderRadius: 3 },
  // Modal Styles
  modalContainer: { flex: 1, backgroundColor: 'white' },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', position: 'relative',
  },
  modalTitle: { fontSize: 18, fontWeight: '600' },
  modalCloseButton: { position: 'absolute', right: 16, top: 16, padding: 4 },
  modalScroll: { flex: 1 },
  modalScrollContent: { padding: 24, paddingBottom: 100 },
  filterSection: { marginBottom: 24, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingBottom: 24 },
  filterTitle: { fontSize: 18, fontWeight: '600', marginBottom: 16 },
  slider: { width: '100%', height: 40 },
  priceRangeLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  priceLabel: { fontSize: 14, color: '#6B7280' },
  checkRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  checkLabel: { fontSize: 16, marginLeft: 12, color: '#111827' },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: '#B0B0B0', justifyContent: 'center', alignItems: 'center' },
  checkboxChecked: { backgroundColor: '#111827', borderColor: '#111827' },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#B0B0B0', justifyContent: 'center', alignItems: 'center' },
  radioChecked: { borderColor: '#111827' },
  radioCheckedInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#111827' },
  modalFooter: { flexDirection: 'row', padding: 16, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  clearButton: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6', marginRight: 8 },
  clearButtonText: { fontSize: 16, fontWeight: '600', color: '#111827' },
  showButton: { flex: 2, padding: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111827', marginLeft: 8 },
  showButtonText: { fontSize: 16, fontWeight: '600', color: 'white' },
  disabledButton: { backgroundColor: '#D1D5DB' },
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
  radiusLabelContainer: { alignItems: 'center', marginTop: 8 },
  radiusLabelText: { fontSize: 16, color: '#111827', fontWeight: '500' },
  mapContainer: { flex: 1 },
  mapView: { width: '100%', height: '100%' },

  // ⬇️⬇️ NEW: styles for locate button (reuses your zoomBtn style)
  locateControl: {
    position: 'absolute',
    right: 12,
    top: 12, // adjust if the bottom sheet overlaps
    zIndex: 10,
    alignItems: 'center',
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
