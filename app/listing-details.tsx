// app/listing-details.tsx
import { ThemedView } from '@/components/themed-view';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format, parseISO } from 'date-fns';
import { Image } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  ArrowLeft,
  BadgeCheck,
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coffee,
  Globe,
  Heart,
  MapPin,
  MessageSquare,
  Minus,
  ParkingCircle,
  Plus,
  Share2,
  Shield,
  Star,
  Tv,
  Utensils,
  Wifi,
  Wind,
  X,
} from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { CalendarList, DateData } from 'react-native-calendars';
import MapView, { Marker, PROVIDER_DEFAULT, Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const WISHLISTS_KEY = '@wishlists';
const SAVED_PROPERTIES_KEY = '@saved_properties';

// ⬇️ ADDED: types + tiny storage helpers
type Wishlist = { id: string; name: string; description?: string; count: number; coverImage?: string };
type SavedProperty = {
  id: string;
  name: string;
  location: string;
  price: number;
  rating: number;
  image: string;
  listId: string;
  coordinates?: { latitude: number; longitude: number };
};
async function getData<T>(key: string, fallback: T): Promise<T> {
  try { const raw = await AsyncStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; }
  catch { return fallback; }
}
async function setData<T>(key: string, value: T) { await AsyncStorage.setItem(key, JSON.stringify(value)); }

// ----- Mock data (same as before) -----
const listing = {
  id: '1',
  name: 'Modern Studio in Koramangala',
  locality: 'Koramangala 5th Block, Bangalore',
  rating: 4.8,
  reviewsCount: 127,
  price: 2200,
  coordinates: { latitude: 12.935192, longitude: 77.624481 },
  images: [
    'https://images.unsplash.com/photo-1522708323590-d24dbb6b0D267?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1505693314120-0d443867891c?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1484101403633-562f891dc89a?w=800&h=600&fit=crop',
  ],
  thumbnails: [
    'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=100&h=100&fit=crop',
    'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=100&h=100&fit=crop',
    'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=100&h=100&fit=crop',
    'https://images.unsplash.com/photo-1505693314120-0d443867891c?w=100&h=100&fit=crop',
    'https://images.unsplash.com/photo-1484101403633-562f891dc89a?w=100&h=100&fit=crop',
  ],
  highlights: [
    'Entire apartment to yourself',
    'Self check-in with smart lock',
    'Prime location - 2 min to metro',
    'Fast WiFi perfect for work',
    'Highly rated for cleanliness',
  ],
  amenities: [
    { name: 'WiFi', icon: Wifi },
    { name: 'AC', icon: Wind },
    { name: 'Parking', icon: ParkingCircle },
    { name: 'TV', icon: Tv },
    { name: 'Kitchen', icon: Utensils },
    { name: 'Coffee', icon: Coffee },
    { name: 'Late Check-in', icon: Clock },
    { name: 'Security', icon: Shield },
  ],
  houseRules: ['No smoking', 'No parties or events', 'Suitable for children', 'No pets'],
  checkInWindow: '2:00 PM - 11:00 PM',
  checkOutTime: '11:00 AM',
  safetyFeatures: [
    'KYC-verified host',
    'Community-verified property',
    'Quiet hours enforced (10 PM - 8 AM)',
  ],
  host: {
    name: 'Rajesh Kumar',
    image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop',
    languages: ['English', 'Hindi', 'Kannada'],
    responseTime: 'Within an hour',
    responseRate: '98%',
    verified: true,
  },
  reviews: [
    {
      id: 'r1',
      author: 'Priya Sharma',
      date: '2 weeks ago',
      rating: 5,
      comment:
        'Amazing place! Very clean and the host was super responsive. Perfect location near the metro.',
    },
    {
      id: 'r2',
      author: 'Amit Patel',
      date: '1 month ago',
      rating: 4,
      comment:
        'Great stay. The apartment has everything you need. WiFi was fast and perfect for work.',
    },
  ],
  distanceFromSearch: '1.2 km from searched location',
  instantBook: true,
  taxNote: 'Includes all taxes',
};

// ----- Date picker modal (unchanged) -----
interface DatePickerModalProps {
  isVisible: boolean;
  onClose: () => void;
  checkIn: string | null;
  checkOut: string | null;
  setCheckIn: (date: string | null) => void;
  setCheckOut: (date: string | null) => void;
}
function DatePickerModal({
  isVisible,
  onClose,
  checkIn,
  checkOut,
  setCheckIn,
  setCheckOut,
}: DatePickerModalProps) {
  const [selectedStartDate, setSelectedStartDate] = useState<string | null>(checkIn);
  const [selectedEndDate, setSelectedEndDate] = useState<string | null>(checkOut);
  const [selectingPhase, setSelectingPhase] = useState<'start' | 'end'>(checkIn ? 'end' : 'start');

  useEffect(() => {
    setSelectedStartDate(checkIn);
    setSelectedEndDate(checkOut);
    setSelectingPhase(checkIn ? 'end' : 'start');
  }, [isVisible, checkIn, checkOut]);

  const handleDayPress = (day: DateData) => {
    if (
      selectingPhase === 'start' ||
      (selectedStartDate && selectedEndDate && day.dateString < selectedStartDate!)
    ) {
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
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Select Dates</Text>
          <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
            <X size={24} color="#111827" />
          </TouchableOpacity>
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
            scrollEnabled
            showScrollIndicator
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
        <View style={styles.modalFooter}>
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => {
              setSelectedStartDate(null);
              setSelectedEndDate(null);
              setSelectingPhase('start');
            }}
          >
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
      </View>
    </Modal>
  );
}

export default function ListingDetailsPage() {
  const router = useRouter();
  const { top, bottom } = useSafeAreaInsets();
  const insets = useSafeAreaInsets();
  const [isFavorite, setIsFavorite] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const imageCarouselRef = useRef<FlatList>(null);

  const [checkInDate, setCheckInDate] = useState<string | null>(null);
  const [checkOutDate, setCheckOutDate] = useState<string | null>(null);
  const [guests, setGuests] = useState(2);
  const [isDatePickerVisible, setDatePickerVisible] = useState(false);

  // ⬇️ ADDED: wishlist picker state
  const [wishlists, setWishlists] = useState<Wishlist[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [creatingNew, setCreatingNew] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListDesc, setNewListDesc] = useState('');

  // ⬇️ ADDED: load lists + check if saved anywhere
  useEffect(() => {
    (async () => {
      const lists = await getData<Wishlist[]>(WISHLISTS_KEY, []);
      const saved = await getData<SavedProperty[]>(SAVED_PROPERTIES_KEY, []);
      setWishlists(lists);
      setIsFavorite(saved.some(p => p.id === listing.id));
    })();
  }, []);

  const mapRegion: Region = {
    latitude: listing.coordinates.latitude,
    longitude: listing.coordinates.longitude,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };

  const onCarouselViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) setCurrentImageIndex(viewableItems[0].index);
  }).current;

  const scrollCarousel = (direction: 'next' | 'prev') => {
    const len = listing.images.length;
    const newIndex = direction === 'next' ? (currentImageIndex + 1) % len : (currentImageIndex - 1 + len) % len;
    imageCarouselRef.current?.scrollToIndex({ index: newIndex, animated: true });
  };

  const scrollToThumbnail = (i: number) => imageCarouselRef.current?.scrollToIndex({ index: i, animated: true });

  const displayDates = () => {
    if (checkInDate && checkOutDate)
      return `${format(parseISO(checkInDate), 'MMM dd')} - ${format(parseISO(checkOutDate), 'MMM dd')}`;
    return 'Select dates';
  };

  // ⬇️ ADDED: save helpers
  async function saveToWishlist(targetListId: string) {
    const saved = await getData<SavedProperty[]>(SAVED_PROPERTIES_KEY, []);
    const already = saved.some(p => p.id === listing.id && p.listId === targetListId);
    if (already) { Alert.alert('Already saved', 'This place is already in that list.'); return; }

    const toSave: SavedProperty = {
      id: listing.id,
      name: listing.name,
      location: listing.locality,
      price: listing.price,
      rating: listing.rating,
      image: listing.images[0] ?? '',
      listId: targetListId,
      coordinates: listing.coordinates,
    };
    const updatedSaved = [...saved, toSave];
    await setData(SAVED_PROPERTIES_KEY, updatedSaved);

    const lists = await getData<Wishlist[]>(WISHLISTS_KEY, []);
    const updatedLists = lists.map(l =>
      l.id === targetListId
        ? { ...l, count: (l.count ?? 0) + 1, coverImage: l.coverImage || toSave.image || l.coverImage }
        : l
    );
    await setData(WISHLISTS_KEY, updatedLists);
    setWishlists(updatedLists);

    setIsFavorite(true);
    setPickerVisible(false);
    const listName = updatedLists.find(l => l.id === targetListId)?.name;
    Alert.alert('Saved', `Added to “${listName}”.`);
  }

  async function createListAndSave() {
    const name = newListName.trim();
    if (!name) { Alert.alert('Name required', 'Please enter a list name.'); return; }
    const lists = await getData<Wishlist[]>(WISHLISTS_KEY, []);
    const newList: Wishlist = { id: Date.now().toString(), name, description: newListDesc.trim(), count: 0 };
    const updated = [...lists, newList];
    await setData(WISHLISTS_KEY, updated);
    setWishlists(updated);
    setCreatingNew(false); setNewListName(''); setNewListDesc('');
    await saveToWishlist(newList.id);
  }

  // Header height (white bar below the iOS status area)
  const headerBarHeight = 56;

  return (
    <ThemedView style={styles.container}>
      {/* Keep status bar visible; look white on both platforms */}
      <StatusBar style="dark" backgroundColor="#ffffff" />

      <Stack.Screen options={{ headerShown: false }} />

      {/* Fixed white header (pushes image down) */}
      <View style={[styles.headerContainer, { paddingTop: insets.top, height: insets.top + headerBarHeight }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerIconButton}>
            <ArrowLeft size={20} color="#111827" />
          </TouchableOpacity>

          <View style={styles.headerRightRow}>
            {/* ⬇️ CHANGED: open wishlist picker instead of just toggling */}
            <TouchableOpacity
              onPress={() => setPickerVisible(true)}
              style={styles.headerIconButton}
            >
              <Heart size={20} color="#111827" fill={isFavorite ? '#ef4444' : 'transparent'} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerIconButton}>
              <Share2 size={18} color="#111827" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Spacer to account for the fixed header so content starts below it */}
        <View style={{ height: insets.top + headerBarHeight }} />

        {/* IMAGE CAROUSEL (now sits below the header) */}
        <View style={styles.imageCarouselContainer}>
          <FlatList
            ref={imageCarouselRef}
            data={listing.images}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item}
            renderItem={({ item }) => <Image source={{ uri: item }} style={styles.carouselImage} />}
            onViewableItemsChanged={onCarouselViewableItemsChanged}
            viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
          />

          {/* Instant Book pill on the image */}
          {listing.instantBook && (
            <View style={[styles.instantBadge, { top: 16, left: 16 }]}>
              <Text style={styles.instantBadgeText}>Instant Book</Text>
            </View>
          )}

          {/* Bottom-right counter */}
          <View style={styles.imageCounter}>
            <Text style={styles.imageCounterText}>
              {currentImageIndex + 1} / {listing.images.length}
            </Text>
          </View>

          {/* Centered carousel arrows */}
          <TouchableOpacity
            style={[styles.carouselNav, styles.carouselNavLeft]}
            onPress={() => scrollCarousel('prev')}
          >
            <ChevronLeft size={22} color="#111827" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.carouselNav, styles.carouselNavRight]}
            onPress={() => scrollCarousel('next')}
          >
            <ChevronRight size={22} color="#111827" />
          </TouchableOpacity>
        </View>

        {/* THUMBNAILS */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbnailContainer}>
          {listing.thumbnails.map((thumb, index) => (
            <TouchableOpacity key={index} onPress={() => scrollToThumbnail(index)}>
              <Image
                source={{ uri: thumb }}
                style={[styles.thumbnail, currentImageIndex === index && styles.thumbnailActive]}
              />
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* CONTENT */}
        <View style={styles.contentArea}>
          <Text style={styles.listingName}>{listing.name}</Text>
          <View style={styles.infoRow}>
            <MapPin size={16} color="#4B5563" />
            <Text style={styles.infoText}>{listing.locality}</Text>
          </View>
          <View style={styles.infoRow}>
            <Star size={16} color="#F59E0B" fill="#F59E0B" />
            <Text style={styles.infoTextBold}>{listing.rating}</Text>
            <Text style={styles.infoText}>({listing.reviewsCount} reviews)</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.card}>
            <View style={styles.priceRow}>
              <Text style={styles.priceText}>₹{listing.price.toLocaleString('en-IN')}</Text>
              <Text style={styles.priceNight}>/night</Text>
              <View style={styles.taxBadge}>
                <Text style={styles.taxBadgeText}>{listing.taxNote}</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.dateButton} onPress={() => setDatePickerVisible(true)}>
              <CalendarIcon size={20} color="#374151" />
              <Text style={[styles.dateButtonText, !checkInDate && { color: '#6B7280' }]}>
                {displayDates()}
              </Text>
            </TouchableOpacity>

            <View style={styles.guestRow}>
              <Text style={styles.guestLabel}>Guests</Text>
              <View style={styles.guestControl}>
                <TouchableOpacity
                  style={[styles.guestButton, guests <= 1 && styles.guestButtonDisabled]}
                  onPress={() => setGuests((g) => Math.max(1, g - 1))}
                  disabled={guests <= 1}
                >
                  <Minus size={20} color={guests <= 1 ? '#9CA3AF' : '#111827'} />
                </TouchableOpacity>
                <Text style={styles.guestCount}>{guests}</Text>
                <TouchableOpacity
                  style={[styles.guestButton, guests >= 20 && styles.guestButtonDisabled]}
                  onPress={() => setGuests((g) => Math.min(20, g + 1))}
                  disabled={guests >= 20}
                >
                  <Plus size={20} color={guests >= 20 ? '#9CA3AF' : '#111827'} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>What this place offers</Text>
          <View style={styles.highlightsContainer}>
            {listing.highlights.map((item, index) => (
              <View key={index} style={styles.highlightItem}>
                <CheckCircle2 size={20} color="#10B981" />
                <Text style={styles.highlightText}>{item}</Text>
              </View>
            ))}
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Amenities</Text>
          <View style={styles.amenitiesContainer}>
            {listing.amenities.map((item, index) => (
              <View key={index} style={styles.amenityItem}>
                <item.icon size={24} color="#374151" />
                <Text style={styles.amenityText}>{item.name}</Text>
              </View>
            ))}
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>House rules & Check-in</Text>
          <View style={styles.rulesContainer}>
            <View style={styles.ruleItem}>
              <Clock size={20} color="#4B5563" />
              <View style={styles.ruleTextContainer}>
                <Text style={styles.ruleLabel}>Check-in</Text>
                <Text style={styles.ruleValue}>{listing.checkInWindow}</Text>
              </View>
            </View>

            <View style={styles.ruleItem}>
              <Clock size={20} color="#4B5563" />
              <View style={styles.ruleTextContainer}>
                <Text style={styles.ruleLabel}>Check-out</Text>
                <Text style={styles.ruleValue}>{listing.checkOutTime}</Text>
              </View>
            </View>

            <Text style={styles.ruleSubTitle}>Rules</Text>
            {listing.houseRules.map((rule, index) => (
              <Text key={index} style={styles.ruleList}>
                • {rule}
              </Text>
            ))}
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Location</Text>
          <View style={styles.locationCard}>
            <MapView
              style={styles.map}
              provider={PROVIDER_DEFAULT}
              initialRegion={mapRegion}
              scrollEnabled={false}
              zoomEnabled={false}
              pitchEnabled={false}
              rotateEnabled={false}
            >
              <Marker coordinate={listing.coordinates} />
            </MapView>
            <Text style={styles.locationText}>{listing.locality}</Text>
            <Text style={styles.locationDistance}>{listing.distanceFromSearch}</Text>
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Safety & Verification</Text>
          <View style={styles.safetyContainer}>
            {listing.safetyFeatures.map((item, index) => (
              <View key={index} style={styles.safetyBadge}>
                <Shield size={16} color="#374151" />
                <Text style={styles.safetyBadgeText}>{item}</Text>
              </View>
            ))}
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Meet your host</Text>
          <View style={styles.hostCard}>
            <View style={styles.hostHeader}>
              <Image source={{ uri: listing.host.image }} style={styles.hostAvatar} />
              <View style={styles.hostInfo}>
                <View style={styles.hostNameRow}>
                  <Text style={styles.hostName}>{listing.host.name}</Text>
                  {listing.host.verified && <BadgeCheck size={18} color="#0EA5E9" fill="#E0F2FE" />}
                </View>
                <View style={styles.hostDetailRow}>
                  <Globe size={14} color="#6B7280" />
                  <Text style={styles.hostDetailText}>{listing.host.languages.join(', ')}</Text>
                </View>
                <Text style={styles.hostDetailText}>Response time: {listing.host.responseTime}</Text>
                <Text style={styles.hostDetailText}>Response rate: {listing.host.responseRate}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.hostMessageButton}>
              <MessageSquare size={18} color="#111827" />
              <Text style={styles.hostMessageButtonText}>Message host</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Reviews</Text>
          <View style={styles.reviewCardContainer}>
            {listing.reviews.map((review) => (
              <View key={review.id} style={styles.reviewCard}>
                <View style={styles.reviewAuthorRow}>
                  <View style={styles.reviewAvatar}>
                    <Text style={styles.reviewAvatarLetter}>{review.author.charAt(0)}</Text>
                  </View>
                  <View>
                    <Text style={styles.reviewAuthor}>{review.author}</Text>
                    <View style={styles.starRating}>
                      {Array(5)
                        .fill(0)
                        .map((_, i) => (
                          <Star
                            key={i}
                            size={14}
                            color={i < review.rating ? '#F59E0B' : '#D1D5DB'}
                            fill={i < review.rating ? '#F59E0B' : 'transparent'}
                          />
                        ))}
                    </View>
                  </View>
                  <Text style={styles.reviewDate}>{review.date}</Text>
                </View>
                <Text style={styles.reviewComment}>{review.comment}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity style={styles.showAllButton}>
            <Text style={styles.showAllButtonText}>Show all {listing.reviewsCount} reviews</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Sticky Footer */}
      <View style={[styles.footer, { paddingBottom: bottom + 10 }]}>
        <View>
          <Text style={styles.footerPrice}>₹{listing.price.toLocaleString('en-IN')}<Text style={styles.footerPriceNight}> /night</Text></Text>
        </View>
        <TouchableOpacity 
          style={[styles.reserveButton, (!checkInDate || !checkOutDate) && styles.disabledButton]} 
          disabled={!checkInDate || !checkOutDate}
          onPress={() => {
            if (!checkInDate || !checkOutDate) {
              Alert.alert("Missing Dates", "Please select your check-in and check-out dates first.");
              return;
            }
            router.push({
              pathname: '/booking',
              params: { 
                listingId: listing.id,
                listingName: listing.name,
                listingLocation: listing.locality,
                basePrice: listing.price,
                checkIn: checkInDate,
                checkOut: checkOutDate,
                guests: guests,
                lat: listing.coordinates.latitude,
                lon: listing.coordinates.longitude,
              }
            });
          }}
        >
          <Text style={styles.reserveButtonText}>Reserve</Text>
        </TouchableOpacity>
      </View>

      {/* ⬇️ ADDED: Wishlist Picker Modal */}
      <Modal
        visible={pickerVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setPickerVisible(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setPickerVisible(false)}
          style={styles.wlOverlay}
        >
          <TouchableOpacity activeOpacity={1} style={styles.wlSheet}>
            <View style={styles.wlHeader}>
              <Text style={styles.wlTitle}>Add to a list</Text>
              <Text style={styles.wlSubtitle}>Choose a wishlist to save this place</Text>
            </View>

            {wishlists.map((l) => (
              <TouchableOpacity key={l.id} onPress={() => saveToWishlist(l.id)} style={styles.wlRow}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={styles.wlRowTitle} numberOfLines={1}>{l.name}</Text>
                  <Text style={styles.wlRowSubtitle}>{l.count ?? 0} {l.count === 1 ? 'item' : 'items'}</Text>
                </View>
                <Text style={styles.wlRowAction}>Add</Text>
              </TouchableOpacity>
            ))}

            {!creatingNew ? (
              <TouchableOpacity onPress={() => setCreatingNew(true)} style={styles.wlCreateBtn}>
                <Text style={styles.wlCreateBtnText}>+ Create new list</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.wlCreateForm}>
                <TextInput
                  placeholder="List name (e.g., Weekend Getaways)"
                  value={newListName}
                  onChangeText={setNewListName}
                  style={styles.wlInput}
                  maxLength={50}
                />
                <TextInput
                  placeholder="Description (optional)"
                  value={newListDesc}
                  onChangeText={setNewListDesc}
                  style={[styles.wlInput, { borderColor: '#E5E7EB' }]}
                  maxLength={100}
                />
                <View style={styles.wlFormActions}>
                  <TouchableOpacity
                    onPress={() => { setCreatingNew(false); setNewListName(''); setNewListDesc(''); }}
                    style={styles.wlSecondaryBtn}
                  >
                    <Text style={styles.wlSecondaryBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={createListAndSave} style={styles.wlPrimaryBtn}>
                    <Text style={styles.wlPrimaryBtnText}>Create & Add</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Date Picker */}
      <DatePickerModal
        isVisible={isDatePickerVisible}
        onClose={() => setDatePickerVisible(false)}
        checkIn={checkInDate}
        checkOut={checkOutDate}
        setCheckIn={setCheckInDate}
        setCheckOut={setCheckOutDate}
      />
    </ThemedView>
  );
}

/* ========================= STYLES ========================= */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },

  // --- New fixed header ---
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    zIndex: 20,
  },
  headerRow: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  imageCarouselContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 0.8,
  },
  carouselImage: { width: SCREEN_WIDTH, height: '100%' },

  instantBadge: {
    position: 'absolute',
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  instantBadgeText: { color: 'white', fontSize: 12, fontWeight: 'bold' },

  imageCounter: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  imageCounterText: { color: 'white', fontSize: 12, fontWeight: '500' },

  carouselNav: {
    position: 'absolute',
    top: '50%',
    marginTop: -18,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  carouselNavLeft: { left: 16 },
  carouselNavRight: { right: 16 },

  thumbnailContainer: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  thumbnail: {
    width: 64,
    height: 64,
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 2,
    borderColor: 'transparent',
    opacity: 0.6,
  },
  thumbnailActive: { borderColor: '#111827', opacity: 1 },

  contentArea: { padding: 16 },
  listingName: { fontSize: 24, fontWeight: 'bold', color: '#111827' },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 6 },
  infoText: { fontSize: 14, color: '#4B5563' },
  infoTextBold: { fontSize: 14, color: '#111827', fontWeight: 'bold' },

  divider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 24 },

  card: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  priceRow: { flexDirection: 'row', alignItems: 'baseline' },
  priceText: { fontSize: 22, fontWeight: 'bold', color: '#111827' },
  priceNight: { fontSize: 14, color: '#4B5563', marginLeft: 4 },
  taxBadge: {
    backgroundColor: '#E5E7EB',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 'auto',
  },
  taxBadgeText: { fontSize: 12, color: '#374151', fontWeight: '500' },

  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 14,
    marginTop: 16,
  },
  dateButtonText: { fontSize: 16, color: '#111827', marginLeft: 12 },

  guestRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  guestLabel: { fontSize: 16, color: '#111827', fontWeight: '500' },
  guestControl: { flexDirection: 'row', alignItems: 'center' },
  guestButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#B0B0B0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  guestButtonDisabled: { borderColor: '#E5E7EB' },
  guestCount: { fontSize: 16, fontWeight: 'bold', color: '#111827', marginHorizontal: 16 },

  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#111827', marginBottom: 16 },

  highlightsContainer: { gap: 12 },
  highlightItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  highlightText: { fontSize: 15, color: '#374151', flex: 1 },

  amenitiesContainer: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 16 },
  amenityItem: { width: '50%', flexDirection: 'row', alignItems: 'center', gap: 12 },
  amenityText: { fontSize: 15, color: '#374151' },

  rulesContainer: { gap: 16 },
  ruleItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  ruleTextContainer: { flex: 1 },
  ruleLabel: { fontSize: 15, color: '#111827', fontWeight: '500' },
  ruleValue: { fontSize: 14, color: '#4B5563', marginTop: 2 },
  ruleSubTitle: { fontSize: 15, color: '#111827', fontWeight: '500', marginTop: 8 },
  ruleList: { fontSize: 14, color: '#4B5563', marginLeft: 12 },

  locationCard: { borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden' },
  map: { height: 200, width: '100%' },
  locationText: { fontSize: 15, fontWeight: '500', color: '#111827', padding: 16, paddingBottom: 4 },
  locationDistance: { fontSize: 14, color: '#4B5563', paddingHorizontal: 16, paddingBottom: 16 },

  safetyContainer: { gap: 12 },
  safetyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  safetyBadgeText: { fontSize: 14, color: '#374151', fontWeight: '500' },

  hostCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  hostHeader: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  hostAvatar: { width: 64, height: 64, borderRadius: 32 },
  hostInfo: { flex: 1, gap: 4 },
  hostNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hostName: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  hostDetailRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hostDetailText: { fontSize: 14, color: '#4B5563' },
  hostMessageButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingVertical: 12,
  },
  hostMessageButtonText: { fontSize: 15, fontWeight: 'bold', color: '#111827' },

  reviewsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  reviewCardContainer: { gap: 16 },
  reviewCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  reviewAuthorRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  reviewAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewAvatarLetter: { fontSize: 18, fontWeight: 'bold', color: '#4B5563' },
  reviewAuthor: { fontSize: 15, fontWeight: 'bold', color: '#111827' },
  starRating: { flexDirection: 'row', gap: 2, marginTop: 2 },
  reviewDate: { fontSize: 13, color: '#6B7280', marginLeft: 'auto' },
  reviewComment: { fontSize: 14, color: '#374151', lineHeight: 20 },

  showAllButton: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  showAllButtonText: { fontSize: 15, fontWeight: 'bold', color: '#111827' },

  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  footerPrice: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  footerPriceNight: { fontSize: 14, fontWeight: 'normal', color: '#4B5563' },
  reserveButton: {
    backgroundColor: '#111827',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    flex: 0.6,
    alignItems: 'center',
  },
  reserveButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },

  modalContainer: { flex: 1, backgroundColor: 'white' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: { fontSize: 18, fontWeight: '600' },
  modalCloseButton: { position: 'absolute', right: 16, top: 16, padding: 4 },
  modalFooter: {
    flexDirection: 'row',
    padding: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  clearButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    marginRight: 8,
  },
  clearButtonText: { fontSize: 16, fontWeight: '600', color: '#111827' },
  showButton: {
    flex: 2,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111827',
    marginLeft: 8,
  },
  showButtonText: { fontSize: 16, fontWeight: '600', color: 'white' },
  disabledButton: { backgroundColor: '#D1D5DB' },

  /* ⬇️ ADD THESE NEW STYLES ONLY */
  wlOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  wlSheet: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: 'white',
    borderRadius: 12,
    paddingVertical: 8,
    overflow: 'hidden',
  },
  wlHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  wlTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  wlSubtitle: { marginTop: 2, fontSize: 13, color: '#6B7280' },
  wlRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  wlRowTitle: { fontSize: 15, fontWeight: '600', color: '#111827' },
  wlRowSubtitle: { fontSize: 12, color: '#6B7280' },
  wlRowAction: { fontSize: 12, color: '#9CA3AF' },
  wlCreateBtn: { padding: 16, alignItems: 'center' },
  wlCreateBtnText: { fontSize: 15, fontWeight: '600', color: '#111827' },
  wlCreateForm: { padding: 16, gap: 8 },
  wlInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
  },
  wlFormActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 4,
  },
  wlSecondaryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  wlSecondaryBtnText: { fontWeight: '700', color: '#111827' },
  wlPrimaryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#111827',
    borderRadius: 8,
  },
  wlPrimaryBtnText: { fontWeight: '700', color: 'white' },
});
