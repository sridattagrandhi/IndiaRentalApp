// app/search.tsx
import { ThemedView } from '@/components/themed-view';
import Slider from '@react-native-community/slider';
import { format, parseISO } from 'date-fns';
import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { Link, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft, Calendar as CalendarIcon, Check, ChevronDown, List, Map, MapPin, Minus, Plus,
  SlidersHorizontal, Star, Users, X
} from 'lucide-react-native';
import React, { Dispatch, SetStateAction, useEffect, useRef, useState } from 'react'; // ⬅️ added useRef
import {
  Alert, Dimensions,
  FlatList,
  Keyboard,
  LayoutChangeEvent,
  Modal, SafeAreaView, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity,
  TouchableWithoutFeedback, View
} from 'react-native';
import { CalendarList, DateData } from 'react-native-calendars';
import { Gesture, GestureDetector, FlatList as GestureFlatList } from 'react-native-gesture-handler';
import MapView, { Marker, PROVIDER_DEFAULT, Region } from 'react-native-maps';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ⬇️⬇️ NEW: locate-me imports
import * as Location from 'expo-location';
import { LocateFixed } from 'lucide-react-native';
// ⬆️⬆️

// ---- Height constants ----
const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const BOTTOM_SHEET_MIN_HEIGHT = SCREEN_HEIGHT * 0.15;
const DEFAULT_MAX_HEIGHT = SCREEN_HEIGHT * 0.55;
const MAP_MIN_VISIBLE_PX = 180;

const GEOAPIFY_API_KEY = Constants.expoConfig?.extra?.GEOAPIFY_API_KEY;
const GEOAPIFY_GEOCODE_URL = `https://api.geoapify.com/v1/geocode/search?apiKey=${GEOAPIFY_API_KEY}`;

// --- Data & Interfaces ---
interface Property {
  id: string; name: string; location: string; price: number; rating: number;
  distance: string; image: string; features: string[]; type: 'room' | 'home' | 'hotel';
  instantBook: boolean; coordinates: { latitude: number; longitude: number; };
}

const mockProperties: Property[] = [
  { id: '1', name: 'Modern Studio in...', location: 'Koramangala, Bangalore', price: 2200, rating: 4.8, distance: '1.2 km', image: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=400&h=400&fit=crop', features: ['WiFi', 'AC', 'Parking'], type: 'room', instantBook: true, coordinates: { latitude: 12.935192, longitude: 77.624481 } },
  { id: '2', name: 'Luxury Villa with Pool', location: 'Whitefield, Bangalore', price: 5500, rating: 4.9, distance: '8.5 km', image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=400&h=400&fit=crop', features: ['Pool', 'Parking', 'Late Check-in'], type: 'home', instantBook: false, coordinates: { latitude: 12.9698, longitude: 77.7499 } },
  { id: '3', name: 'Budget Hotel near Airport', location: 'Devanahalli, Bangalore', price: 1500, rating: 4.3, distance: '15.2 km', image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400&h=400&fit=crop', features: ['WiFi', 'Breakfast', 'AC'], type: 'hotel', instantBook: true, coordinates: { latitude: 13.1979, longitude: 77.7068 } },
  { id: '4', name: 'City Center Suite', location: 'MG Road, Bangalore', price: 4000, rating: 4.7, distance: '2.5 km', image: 'https://images.unsplash.com/photo-1444201983204-c43cbd584d93?w=400&h=400&fit=crop', features: ['Restaurant', 'AC'], type: 'hotel', instantBook: true, coordinates: { latitude: 12.9740, longitude: 77.6132 } },
  { id: '5', name: 'Quiet Retreat', location: 'Jayanagar, Bangalore', price: 2800, rating: 4.6, distance: '5.0 km', image: 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=400&h=400&fit=crop', features: ['Garden', 'WiFi'], type: 'home', instantBook: false, coordinates: { latitude: 12.9250, longitude: 77.5800 } },
];

const mockRegion: Region = { latitude: 12.9716, longitude: 77.5946, latitudeDelta: 0.3, longitudeDelta: 0.3, };
const sortOptions = ['Best match', 'Lowest price', 'Highest rated', 'Closest'];

// --- Components ---
const PropertyCard = ({ property }: { property: Property }) => (
  <View style={styles.card}>
    <Image source={{ uri: property.image }} style={styles.cardImage}
      placeholder={{ blurhash: 'L0A,l#~q00D%~qD%00%M00?b-;%M' }} transition={300} />
    {property.instantBook && (
      <View style={styles.instantBadge}><Text style={styles.instantBadgeText}>Instant</Text></View>
    )}
    <View style={styles.cardDetails}>
      <View style={styles.cardRow}>
        <Text style={styles.cardName} numberOfLines={1}>{property.name}</Text>
        <View style={styles.cardRating}>
          <Star size={14} color="#F59E0B" fill="#F59E0B" />
          <Text style={styles.cardRatingText}>{property.rating}</Text>
        </View>
      </View>
      <View style={[styles.cardRow, { marginTop: 4 }]}>
        <MapPin size={12} color="#6B7280" />
        <Text style={styles.cardLocation} numberOfLines={1}>
          {property.location} • {property.distance}
        </Text>
      </View>
      <View style={styles.cardFeatures}>
        {property.features.slice(0, 3).map((feature) => (
          <View key={feature} style={styles.cardFeatureTag}>
            <Text style={styles.cardFeatureText}>{feature}</Text>
          </View>
        ))}
      </View>
      <View style={[styles.cardRow, { marginTop: 'auto' }]}>
        <Text style={styles.cardPrice}>
          ₹{property.price.toLocaleString('en-IN')}
          <Text style={styles.cardPriceNight}>/night</Text>
        </Text>
        <Link href="/listing-details" asChild>
          <TouchableOpacity style={styles.cardViewButton}>
            <Text style={styles.cardViewButtonText}>View</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </View>
  </View>
);

interface CustomCheckboxProps { label: string; value: boolean; onValueChange: (v: boolean) => void; }
const CustomCheckbox = ({ label, value, onValueChange }: CustomCheckboxProps) => (
  <TouchableOpacity style={styles.checkRow} onPress={() => onValueChange(!value)}>
    <View style={[styles.checkbox, value && styles.checkboxChecked]}>
      {value && <Check size={12} color="#FFFFFF" />}
    </View>
    <Text style={styles.checkLabel}>{label}</Text>
  </TouchableOpacity>
);

interface CustomRadioProps { label: string; value: boolean; onValueChange: () => void; showStar?: boolean; }
const CustomRadio = ({ label, value, onValueChange, showStar = false }: CustomRadioProps) => (
  <TouchableOpacity style={styles.checkRow} onPress={onValueChange}>
    <View style={[styles.radio, value && styles.radioChecked]}>
      {value && <View style={styles.radioCheckedInner} />}
    </View>
    <Text style={styles.checkLabel}>{label}</Text>
    {showStar && (<><Star size={14} color="#F59E0B" fill="#F59E0B" style={{ marginLeft: 4 }} /><Text style={styles.checkLabel}> & up</Text></>)}
  </TouchableOpacity>
);

interface FilterPanelProps {
  isVisible: boolean; onClose: () => void; applyFilters: () => void; clearFilters: () => void;
  filteredCount: number; priceRange: number[]; setPriceRange: Dispatch<SetStateAction<number[]>>;
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
    <Modal visible={isVisible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Filters</Text>
          <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}><X size={24} color="#111827" /></TouchableOpacity>
        </View>
        <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
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

          <View style={styles.filterSection}>
            <Text style={styles.filterTitle}>Search Radius</Text>
            <Slider
              style={styles.slider}
              value={radiusKm}
              onValueChange={value => setRadiusKm(Math.round(value))}
              minimumValue={1}
              maximumValue={50}
              step={1}
              minimumTrackTintColor="#111827"
              maximumTrackTintColor="#E5E7EB"
              thumbTintColor="#111827"
            />
            <View style={styles.radiusLabelContainer}>
              <Text style={styles.radiusLabelText}>Within {radiusKm} km</Text>
            </View>
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.filterTitle}>Property Type</Text>
            {['Room', 'Home', 'Hotel'].map(type => (
              <CustomCheckbox key={type} label={type}
                value={propertyTypes.includes(type.toLowerCase())}
                onValueChange={() => togglePropertyType(type.toLowerCase())} />
            ))}
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.filterTitle}>Amenities</Text>
            {['AC', 'Parking', 'WiFi', 'Late Check-in', 'Pool', 'Breakfast'].map(a => (
              <CustomCheckbox key={a} label={a}
                value={amenities.includes(a)} onValueChange={() => toggleAmenity(a)} />
            ))}
          </View>

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

// --- Date Picker Modal ---
interface DatePickerModalProps {
  isVisible: boolean;
  onClose: () => void;
  checkIn: string | null;
  checkOut: string | null;
  setCheckIn: (date: string | null) => void;
  setCheckOut: (date: string | null) => void;
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
  if (selectedStartDate) {
    markedDates[selectedStartDate] = { startingDay: true, color: '#111827', textColor: 'white' };
  }
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
            scrollEnabled={true}
            showScrollIndicator={true}
            theme={{
              backgroundColor: '#FFFFFF',
              calendarBackground: '#FFFFFF',
              textSectionTitleColor: '#111827',
              selectedDayBackgroundColor: '#111827',
              selectedDayTextColor: '#FFFFFF',
              todayTextColor: '#DC2626',
              dayTextColor: '#111827',
              textDisabledColor: '#D1D5DB',
              dotColor: '#111827',
              selectedDotColor: '#FFFFFF',
              arrowColor: '#111827',
              disabledArrowColor: '#d9e1e8',
              monthTextColor: '#111827',
              indicatorColor: '#111827',
              textDayFontWeight: '400',
              textMonthFontWeight: 'bold',
              textDayHeaderFontWeight: '500',
              textDayFontSize: 16,
              textMonthFontSize: 18,
              textDayHeaderFontSize: 13,
            }}
          />
        </View>

        <View style={styles.modalFooter}>
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

// --- Guest Picker Modal ---
interface GuestPickerModalProps {
  isVisible: boolean;
  onClose: () => void;
  guests: number;
  setGuests: (count: number) => void;
}
function GuestPickerModal({ isVisible, onClose, guests, setGuests }: GuestPickerModalProps) {
  const increment = () => setGuests(Math.min(guests + 1, 20));
  const decrement = () => setGuests(Math.max(guests - 1, 1));

  return (
    <Modal visible={isVisible} animationType="fade" transparent={true} onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.guestModalOverlay}>
          <TouchableWithoutFeedback>
            <View style={styles.guestModalContent}>
              <Text style={styles.guestModalTitle}>Select Guests</Text>
              <View style={styles.guestControlRow}>
                <Text style={styles.guestLabel}>Guests</Text>
                <View style={styles.guestButtons}>
                  <TouchableOpacity onPress={decrement} style={[styles.guestButton, guests <= 1 && styles.disabledGuestButton]} disabled={guests <= 1}>
                    <Minus size={20} color={guests <= 1 ? "#9CA3AF" : "#111827"} />
                  </TouchableOpacity>
                  <Text style={styles.guestCount}>{guests}</Text>
                  <TouchableOpacity onPress={increment} style={[styles.guestButton, guests >= 20 && styles.disabledGuestButton]} disabled={guests >= 20}>
                    <Plus size={20} color={guests >= 20 ? "#9CA3AF" : "#111827"} />
                  </TouchableOpacity>
                </View>
              </View>
              <TouchableOpacity style={styles.confirmGuestButton} onPress={onClose}>
                <Text style={styles.confirmGuestButtonText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

// --- Main Page ---
export default function SearchPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { lat, lon } = useLocalSearchParams<{ lat: string, lon: string }>();

  const [stayType, setStayType] = useState('Stays');
  const [isFilterModalVisible, setFilterModalVisible] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('map');
  const [sortBy, setSortBy] = useState('Best match');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [searchLocationInput, setSearchLocationInput] = useState('Bangalore');
  const [searchLocationDisplay, setSearchLocationDisplay] = useState('Bangalore');
  const [region, setRegion] = useState(mockRegion);

  const [checkInDate, setCheckInDate] = useState<string | null>(null);
  const [checkOutDate, setCheckOutDate] = useState<string | null>(null);
  const [guests, setGuests] = useState(2);
  const [isDatePickerVisible, setDatePickerVisible] = useState(false);
  const [isGuestPickerVisible, setGuestPickerVisible] = useState(false);

  // Filters
  const [priceRange, setPriceRange] = useState([0, 10000]);
  const [propertyTypes, setPropertyTypes] = useState<string[]>([]);
  const [amenities, setAmenities] = useState<string[]>([]);
  const [minRating, setMinRating] = useState('0');
  const [instantBookOnly, setInstantBookOnly] = useState(false);
  const [radiusKm, setRadiusKm] = useState(10);
  const [filteredProperties, setFilteredProperties] = useState(mockProperties);

  // ---- Bottom sheet sizing & animation ----
  const [maxSheetHeight, setMaxSheetHeight] = useState(DEFAULT_MAX_HEIGHT);
  const maxSheetHeightSV = useSharedValue(DEFAULT_MAX_HEIGHT);
  const contentContainerHeight = useSharedValue(SCREEN_HEIGHT);

  const translateY = useSharedValue(0);
  const context = useSharedValue({ y: 0 });
  const INITIAL_TRANSLATE_Y = -BOTTOM_SHEET_MIN_HEIGHT;

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
      const currentMaxHeight = maxSheetHeightSV.value;
      translateY.value = Math.max(translateY.value, -(currentMaxHeight - BOTTOM_SHEET_MIN_HEIGHT));
      translateY.value = Math.min(translateY.value, 0);
    });

  const animatedBottomSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    height: maxSheetHeight,
    bottom: -maxSheetHeight + BOTTOM_SHEET_MIN_HEIGHT,
  }));

  useEffect(() => { translateY.value = withSpring(0, { damping: 15 }); }, []);

  useEffect(() => {
    const fetchLocationName = async (latitude: number, longitude: number) => {
      if (!GEOAPIFY_API_KEY) { Alert.alert("API Key Error", "Geoapify API key is missing."); return; }
      try {
        const resp = await fetch(`https://api.geoapify.com/v1/geocode/reverse?lat=${latitude}&lon=${longitude}&apiKey=${GEOAPIFY_API_KEY}`);
        const j = await resp.json();
        const name = j?.features?.[0]?.properties?.city || 'Current Location';
        setSearchLocationInput(name);
        setSearchLocationDisplay(name);
        setRegion({ latitude, longitude, latitudeDelta: 0.1, longitudeDelta: 0.1 });
      } catch (e) {
        console.error("Failed to reverse geocode", e);
        setSearchLocationInput('Current Location');
        setSearchLocationDisplay('Current Location');
      }
    };
    if (lat && lon) fetchLocationName(parseFloat(lat), parseFloat(lon));
  }, [lat, lon]);

  const handleLocationSearch = async () => {
    Keyboard.dismiss();
    const query = searchLocationInput.trim();
    if (!query) return;

    if (!GEOAPIFY_API_KEY) { Alert.alert("API Key Error", "Geoapify API key is missing."); return; }
    try {
      let biasParam = '';
      if (region) {
        biasParam = `&bias=proximity:${region.longitude},${region.latitude}`;
      }
      const url = `${GEOAPIFY_GEOCODE_URL}&text=${encodeURIComponent(query)}${biasParam}`;
      const response = await fetch(url);

      if (!response.ok) throw new Error(`API Error: ${response.status}`);

      const data = await response.json();

      if (data.features && data.features.length > 0) {
        const firstResult = data.features[0];
        const [lon, lat] = firstResult.geometry.coordinates;
        const properties = firstResult.properties;
        const displayName = properties.formatted || query;

        setSearchLocationDisplay(displayName);

        let delta = 0.1;
        if (properties.result_type === 'city') delta = 0.5;
        else if (properties.result_type === 'state') delta = 2.0;
        else if (properties.result_type === 'country') delta = 15.0;

        setRegion({ latitude: lat, longitude: lon, latitudeDelta: delta, longitudeDelta: delta });
      } else {
        Alert.alert("Location Not Found", `Could not find results for "${query}"`);
      }
    } catch (error: any) {
      console.error("Geocoding failed:", error);
      Alert.alert("Search Error", `Could not perform search. ${error.message || ''}`);
    }
  };

  const applyFilters = () => { setFilteredProperties(mockProperties); setFilterModalVisible(false); };
  const clearFilters = () => { setFilteredProperties(mockProperties); };
  const onSelectSort = (opt: string) => { setSortBy(opt); setShowSortDropdown(false); };

  const renderSortDropdown = () => (
    <View style={styles.dropdown}>
      {sortOptions.map(option => (
        <TouchableOpacity key={option} style={styles.dropdownItem} onPress={() => onSelectSort(option)}>
          <Text style={styles.dropdownItemText}>{option}</Text>
          {sortBy === option && <Check size={16} color="#111827" />}
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderPriceMarker = (price: number) => (
    <View style={styles.priceTagWrap}><Text style={styles.priceTagText}>₹{(price / 1000).toFixed(1)}k</Text></View>
  );

  const displayDates = () => {
    if (checkInDate && checkOutDate) {
      return `${format(parseISO(checkInDate), 'MMM dd')} - ${format(parseISO(checkOutDate), 'MMM dd')}`;
    }
    return 'Select dates';
  };

  // ⬇️⬇️ NEW: locate-me refs/state + function
  const mapRef = useRef<MapView | null>(null);
  const [locating, setLocating] = useState(false);

  const recenterToUser = async () => {
    try {
      setLocating(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location Permission', 'Permission to access location was denied');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const center = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };

      setRegion({ ...center, latitudeDelta: 0.02, longitudeDelta: 0.02 });
      mapRef.current?.animateCamera?.({ center, zoom: 15 }, { duration: 350 });
    } catch (e) {
      console.error(e);
      Alert.alert('Location Error', 'Could not get your current location.');
    } finally {
      setLocating(false);
    }
  };
  // ⬆️⬆️

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: `Stays in ${searchLocationDisplay}`,
          headerShadowVisible: false,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 0 }}>
              <ArrowLeft size={24} color="#111827" />
            </TouchableOpacity>
          ),
        }}
      />

      <View style={{ flex: 1, marginTop: -insets.top }}>
        <TouchableWithoutFeedback onPress={() => { setShowSortDropdown(false); Keyboard.dismiss(); }}>
          <View style={styles.flex1}>
            {/* Search Inputs */}
            <View style={styles.searchInputsContainer}>
              <View style={styles.inputWrapper}>
                <MapPin size={18} color="#6B7280" />
                <TextInput
                  placeholder="Location" value={searchLocationInput} onChangeText={setSearchLocationInput}
                  onSubmitEditing={handleLocationSearch}
                  placeholderTextColor="#6B7280" style={styles.input} returnKeyType="search"
                />
              </View>
              <TouchableOpacity style={styles.inputWrapper} onPress={() => setDatePickerVisible(true)}>
                <CalendarIcon size={18} color="#6B7280" />
                <Text style={[styles.inputText, (!checkInDate || !checkOutDate) && styles.inputPlaceholderText]}>
                  {displayDates()}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.inputWrapper} onPress={() => setGuestPickerVisible(true)}>
                <Users size={18} color="#6B7280" />
                <Text style={styles.inputText}>
                  {guests} Guest{guests > 1 ? 's' : ''}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Segment Tabs */}
            <View style={styles.tabsContainer}>
              {['Stays', 'Monthly', 'Micro-stay'].map(tab => (
                <TouchableOpacity key={tab}
                  style={[styles.tab, stayType === tab && styles.tabActive]}
                  onPress={() => setStayType(tab)}>
                  <Text style={[styles.tabText, stayType === tab && styles.tabTextActive]}>{tab}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Filter/Sort Bar */}
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

            {/* Content Area */}
            <View style={styles.contentArea} onLayout={onContentLayout}>
              {viewMode === 'list' && (
                <FlatList
                  data={filteredProperties} renderItem={({ item }) => <PropertyCard property={item} />}
                  keyExtractor={item => item.id} contentContainerStyle={styles.listContent}
                  showsVerticalScrollIndicator={false}
                />
              )}

              {viewMode === 'map' && (
                <>
                  <View style={styles.mapContainer}>
                    <MapView
                      ref={mapRef} // ⬅️ NEW
                      style={styles.mapView}
                      provider={PROVIDER_DEFAULT}
                      initialRegion={region}
                      region={region}
                    >
                      {filteredProperties.map(prop => (
                        <Marker key={prop.id} coordinate={prop.coordinates}>
                          {renderPriceMarker(prop.price)}
                        </Marker>
                      ))}
                    </MapView>

                    {/* ⬇️ NEW: floating Locate Me button */}
                    <View pointerEvents="box-none" style={styles.locateControl}>
                      <TouchableOpacity style={styles.zoomBtn} onPress={recenterToUser} disabled={locating}>
                        <LocateFixed size={18} color="#111827" />
                      </TouchableOpacity>
                    </View>
                    {/* ⬆️ NEW */}
                  </View>

                  <Animated.View style={[styles.bottomSheet, animatedBottomSheetStyle]}>
                    <GestureDetector gesture={gesture}>
                      <View style={styles.dragHandleContainer}><View style={styles.dragHandle} /></View>
                    </GestureDetector>
                    <GestureFlatList
                      data={filteredProperties}
                      renderItem={({ item }) => <PropertyCard property={item} />}
                      keyExtractor={item => item.id}
                      contentContainerStyle={styles.listContentBottomSheet}
                      style={styles.flatListInSheet}
                      showsVerticalScrollIndicator={false}
                    />
                  </Animated.View>
                </>
              )}
            </View>

            {/* Map/List Toggle */}
            <TouchableOpacity style={styles.mapToggleButton} onPress={() => setViewMode(prev => (prev === 'list' ? 'map' : 'list'))}>
              {viewMode === 'list' ? <Map size={22} color="white" /> : <List size={22} color="white" />}
            </TouchableOpacity>

            {/* Filter Modal */}
            <FilterPanel
              isVisible={isFilterModalVisible} onClose={() => setFilterModalVisible(false)}
              applyFilters={applyFilters} clearFilters={clearFilters}
              filteredCount={filteredProperties.length}
              priceRange={priceRange} setPriceRange={setPriceRange}
              propertyTypes={propertyTypes} setPropertyTypes={setPropertyTypes}
              amenities={amenities} setAmenities={setAmenities}
              minRating={minRating} setMinRating={setMinRating}
              instantBookOnly={instantBookOnly} setInstantBookOnly={setInstantBookOnly}
              radiusKm={radiusKm} setRadiusKm={setRadiusKm}
            />

            {/* Date & Guest Modals */}
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
  // ⬆️⬆️
});
