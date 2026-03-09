// app/search.tsx
import { ThemedView } from "@/components/themed-view";
import { apiGet } from "@/services/api";
import { geocodeText, reverseGeocode } from "@/services/location";
import Slider from "@react-native-community/slider";
import { format, parseISO } from "date-fns";
import Constants from "expo-constants";
import { Image } from "expo-image";
import * as Location from "expo-location";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  Check,
  ChevronDown,
  List,
  LocateFixed,
  Map,
  MapPin,
  Minus,
  Plus,
  SlidersHorizontal,
  Star,
  Users,
  X,
} from "lucide-react-native";
import React, {
  Dispatch,
  SetStateAction,
  useEffect,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next"; // ✅ ADD THIS
import {
  Alert,
  Dimensions,
  FlatList,
  Keyboard,
  LayoutChangeEvent,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { CalendarList, DateData } from "react-native-calendars";
import {
  Gesture,
  GestureDetector,
  FlatList as GestureFlatList,
} from "react-native-gesture-handler";
import MapView, { Marker, PROVIDER_DEFAULT, Region } from "react-native-maps";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const BOTTOM_SHEET_MIN_HEIGHT = SCREEN_HEIGHT * 0.15;
const DEFAULT_MAX_HEIGHT = SCREEN_HEIGHT * 0.55;
const MAP_MIN_VISIBLE_PX = 180;

const API =
  Constants.expoConfig?.extra?.API_BASE_URL ?? "http://localhost:4000";

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
  property_type?: "home" | "room" | "hotel";
  latitude: number;
  longitude: number;
  coordinates?: Coordinates;
  distance?: string | null;
};
type SearchResp = {
  count: number;
  results: BackendListing[];
  next_cursor?: number | null;
};

type AvailabilityDay = {
  date: string;
  status: "available" | "blocked" | "booked";
  price: number;
};

interface Property {
  id: string;
  name: string;
  location: string;
  price: number;
  rating: number;
  distance: string;
  image: string;
  features: string[];
  type: "room" | "home" | "hotel";
  coordinates: Coordinates;
}

const backendToProperty = (x: BackendListing): Property => {
  const coords: Coordinates = x.coordinates ?? {
    latitude: x.latitude,
    longitude: x.longitude,
  };

  return {
    id: String(x.id),
    name: x.title ?? "Untitled stay",
    location: x.street || x.city || "—",
    price: Number(x.price) || 0,
    rating: Number(x.rating) || 0,
    distance: x.distance || "—",
    image: x.photo_url || "https://picsum.photos/seed/fallback/640/480",
    features: Array.isArray(x.amenities) ? x.amenities : [],
    type: (x.property_type as any) ?? "home",
    coordinates: coords,
  };
};

const toRad = (x: number) => (x * Math.PI) / 180;

const haversineKm = (a: Coordinates, b: Coordinates) => {
  const R = 6371;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
};

const INDIA_REGION: Region = {
  latitude: 22.9734,
  longitude: 78.6569,
  latitudeDelta: 20,
  longitudeDelta: 25,
};

const PropertyCard = ({ property }: { property: Property }) => {
  const router = useRouter();
  const { t } = useTranslation();
  const go = () =>
    router.push({ pathname: "./listing/[id]", params: { id: property.id } });

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.92} onPress={go}>
      <Image
        source={{ uri: property.image }}
        style={styles.cardImage}
        transition={250}
      />
      <View style={styles.cardDetails}>
        <View style={styles.cardRow}>
          <Text style={styles.cardName} numberOfLines={1}>
            {property.name}
          </Text>
          <View style={styles.cardRating}>
            <Star size={14} color="#F59E0B" fill="#F59E0B" />
            <Text style={styles.cardRatingText}>
              {Number.isFinite(property.rating) ? property.rating : "—"}
            </Text>
          </View>
        </View>
        <View style={[styles.cardRow, { marginTop: 4 }]}>
          <MapPin size={12} color="#6B7280" />
          <Text style={styles.cardLocation} numberOfLines={1}>
            {property.location} • {property.distance}
          </Text>
        </View>
        <View style={styles.cardFeatures}>
          {property.features.slice(0, 3).map((f) => (
            <View key={f} style={styles.cardFeatureTag}>
              <Text style={styles.cardFeatureText}>{f}</Text>
            </View>
          ))}
        </View>
        <View style={[styles.cardRow, { marginTop: "auto" }]}>
          <Text style={styles.cardPrice}>
            ₹{Number(property.price).toLocaleString("en-IN")}
            <Text style={styles.cardPriceNight}>
              /{t("listing.price_per_night")}
            </Text>
          </Text>
          <TouchableOpacity
            style={styles.cardViewButton}
            onPress={(e) => {
              e.stopPropagation();
              go();
            }}
          >
            <Text style={styles.cardViewButtonText}>{t("search.view")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
};

interface CustomCheckboxProps {
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}
const CustomCheckbox = ({
  label,
  value,
  onValueChange,
}: CustomCheckboxProps) => (
  <TouchableOpacity
    style={styles.checkRow}
    onPress={() => onValueChange(!value)}
  >
    <View style={[styles.checkbox, value && styles.checkboxChecked]}>
      {value && <Check size={12} color="#fff" />}
    </View>
    <Text style={styles.checkLabel}>{label}</Text>
  </TouchableOpacity>
);

interface CustomRadioProps {
  label: string;
  value: boolean;
  onValueChange: () => void;
  showStar?: boolean;
}
const CustomRadio = ({
  label,
  value,
  onValueChange,
  showStar = false,
}: CustomRadioProps) => (
  <TouchableOpacity style={styles.checkRow} onPress={onValueChange}>
    <View style={[styles.radio, value && styles.radioChecked]}>
      {value && <View style={styles.radioCheckedInner} />}
    </View>
    <Text style={styles.checkLabel}>{label}</Text>
    {showStar && (
      <>
        <Star
          size={14}
          color="#F59E0B"
          fill="#F59E0B"
          style={{ marginLeft: 4 }}
        />
        <Text style={styles.checkLabel}> & up</Text>
      </>
    )}
  </TouchableOpacity>
);

interface FilterPanelProps {
  isVisible: boolean;
  onClose: () => void;
  applyFilters: () => void;
  clearFilters: () => void;
  filteredCount: number;
  priceRange: [number, number];
  setPriceRange: Dispatch<SetStateAction<[number, number]>>;
  propertyTypes: string[];
  setPropertyTypes: Dispatch<SetStateAction<string[]>>;
  amenities: string[];
  setAmenities: Dispatch<SetStateAction<string[]>>;
  minRating: string;
  setMinRating: Dispatch<SetStateAction<string>>;
  instantBookOnly: boolean;
  setInstantBookOnly: Dispatch<SetStateAction<boolean>>;
  radiusKm: number;
  setRadiusKm: Dispatch<SetStateAction<number>>;
}
function FilterPanel(props: FilterPanelProps) {
  const { t } = useTranslation();
  const {
    isVisible,
    onClose,
    applyFilters,
    clearFilters,
    filteredCount,
    priceRange,
    setPriceRange,
    propertyTypes,
    setPropertyTypes,
    amenities,
    setAmenities,
    minRating,
    setMinRating,
    instantBookOnly,
    setInstantBookOnly,
    radiusKm,
    setRadiusKm,
  } = props;

  const togglePropertyType = (type: string) =>
    setPropertyTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );

  const toggleAmenity = (amenity: string) =>
    setAmenities((prev) =>
      prev.includes(amenity)
        ? prev.filter((a) => a !== amenity)
        : [...prev, amenity],
    );

  return (
    <Modal visible={isVisible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.filterHeader}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.filterBackButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ArrowLeft size={20} color="#111827" />
          </TouchableOpacity>

          <Text style={styles.filterHeaderTitle}>{t("search.filters")}</Text>

          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          style={styles.modalScroll}
          contentContainerStyle={styles.modalScrollContent}
        >
          {/* price */}
          <View style={styles.filterSection}>
            <Text style={styles.filterTitle}>
              {t("search.price_range_per_night")}
            </Text>
            <Slider
              style={styles.slider}
              value={priceRange[0]}
              onValueChange={(v) =>
                setPriceRange([Math.round(v), priceRange[1]])
              }
              minimumValue={0}
              maximumValue={10000}
              step={100}
              minimumTrackTintColor="#111827"
              maximumTrackTintColor="#E5E7EB"
              thumbTintColor="#111827"
            />
            <View style={styles.priceRangeLabels}>
              <Text style={styles.priceLabel}>₹{priceRange[0]}</Text>
              <Text style={styles.priceLabel}>₹10000+</Text>
            </View>
          </View>

          {/* radius */}
          <View style={styles.filterSection}>
            <Text style={styles.filterTitle}>{t("search.search_radius")}</Text>
            <Slider
              style={styles.slider}
              value={radiusKm}
              onValueChange={(v) => setRadiusKm(Math.round(v))}
              minimumValue={1}
              maximumValue={50}
              step={1}
              minimumTrackTintColor="#111827"
              maximumTrackTintColor="#E5E7EB"
              thumbTintColor="#111827"
            />
            <View style={styles.radiusLabelContainer}>
              <Text style={styles.radiusLabelText}>
                {t("search.within_km", { km: radiusKm })}
              </Text>
            </View>
          </View>

          {/* type */}
          <View style={styles.filterSection}>
            <Text style={styles.filterTitle}>{t("search.property_type")}</Text>
            {["Room", "Home", "Hotel"].map((type) => (
              <CustomCheckbox
                key={type}
                label={type}
                value={propertyTypes.includes(type.toLowerCase())}
                onValueChange={() => togglePropertyType(type.toLowerCase())}
              />
            ))}
          </View>

          {/* amenities */}
          <View style={styles.filterSection}>
            <Text style={styles.filterTitle}>{t("listing.amenities")}</Text>
            {[
              "AC",
              "Parking",
              "WiFi",
              "Late Check-in",
              "Pool",
              "Breakfast",
            ].map((a) => (
              <CustomCheckbox
                key={a}
                label={a}
                value={amenities.includes(a)}
                onValueChange={() => toggleAmenity(a)}
              />
            ))}
          </View>

          {/* rating */}
          <View style={styles.filterSection}>
            <Text style={styles.filterTitle}>{t("search.minimum_rating")}</Text>
            <CustomRadio
              label={t("reviews.all")}
              value={minRating === "0"}
              onValueChange={() => setMinRating("0")}
            />
            <CustomRadio
              label="3.5"
              value={minRating === "3.5"}
              onValueChange={() => setMinRating("3.5")}
              showStar
            />
            <CustomRadio
              label="4.0"
              value={minRating === "4.0"}
              onValueChange={() => setMinRating("4.0")}
              showStar
            />
            <CustomRadio
              label="4.5"
              value={minRating === "4.5"}
              onValueChange={() => setMinRating("4.5")}
              showStar
            />
          </View>
        </ScrollView>

        <View style={styles.modalFooter}>
          <TouchableOpacity style={styles.clearButton} onPress={clearFilters}>
            <Text style={styles.clearButtonText}>{t("common.clear_all")}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.showButton} onPress={applyFilters}>
            <Text style={styles.showButtonText}>
              {t("search.show_results")}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

interface DatePickerModalProps {
  isVisible: boolean;
  onClose: () => void;
  checkIn: string | null;
  checkOut: string | null;
  setCheckIn: (d: string | null) => void;
  setCheckOut: (d: string | null) => void;
}
function DatePickerModal({
  isVisible,
  onClose,
  checkIn,
  checkOut,
  setCheckIn,
  setCheckOut,
}: DatePickerModalProps) {
  const { t } = useTranslation();
  const [start, setStart] = useState<string | null>(checkIn);
  const [end, setEnd] = useState<string | null>(checkOut);
  const [phase, setPhase] = useState<"start" | "end">(
    checkIn ? "end" : "start",
  );

  useEffect(() => {
    setStart(checkIn);
    setEnd(checkOut);
    setPhase(checkIn ? "end" : "start");
  }, [isVisible, checkIn, checkOut]);

  const handleDay = (d: DateData) => {
    if (phase === "start" || !start) {
      setStart(d.dateString);
      setEnd(null);
      setPhase("end");
      return;
    }
    if (start && d.dateString >= start) {
      setEnd(d.dateString);
      setPhase("start");
      return;
    }
    setStart(d.dateString);
    setEnd(null);
    setPhase("end");
  };

  const confirm = () => {
    setCheckIn(start);
    setCheckOut(end);
    onClose();
  };

  const marked: Record<string, any> = {};
  if (start)
    marked[start] = { startingDay: true, color: "#111827", textColor: "white" };
  if (end) {
    marked[end] = { endingDay: true, color: "#111827", textColor: "white" };
    if (start && start !== end) {
      let cur = new Date(parseISO(start));
      const to = new Date(parseISO(end));
      cur.setDate(cur.getDate() + 1);
      while (cur < to) {
        const s = cur.toISOString().split("T")[0];
        marked[s] = { color: "#F3F4F6", textColor: "#111827" };
        cur.setDate(cur.getDate() + 1);
      }
      marked[start] = {
        ...marked[start],
        color: "#111827",
        textColor: "white",
      };
      marked[end] = { ...marked[end], color: "#111827", textColor: "white" };
    }
  }

  return (
    <Modal visible={isVisible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{t("search.select_dates")}</Text>
          <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
            <X size={24} color="#111827" />
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1 }}>
          <CalendarList
            current={start || new Date().toISOString().split("T")[0]}
            minDate={new Date().toISOString().split("T")[0]}
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
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => {
              setStart(null);
              setEnd(null);
              setPhase("start");
            }}
          >
            <Text style={styles.clearButtonText}>{t("common.clear")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.showButton,
              (!start || !end) && styles.disabledButton,
            ]}
            onPress={confirm}
            disabled={!start || !end}
          >
            <Text style={styles.showButtonText}>
              {t("search.confirm_dates")}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

interface GuestPickerModalProps {
  isVisible: boolean;
  onClose: () => void;
  guests: number;
  setGuests: (n: number) => void;
}
function GuestPickerModal({
  isVisible,
  onClose,
  guests,
  setGuests,
}: GuestPickerModalProps) {
  const { t } = useTranslation();
  const inc = () => setGuests(Math.min(guests + 1, 20));
  const dec = () => setGuests(Math.max(guests - 1, 1));
  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.guestModalOverlay}>
          <TouchableWithoutFeedback>
            <View style={styles.guestModalContent}>
              <Text style={styles.guestModalTitle}>
                {t("search.select_guests")}
              </Text>
              <View style={styles.guestControlRow}>
                <Text style={styles.guestLabel}>{t("listing.guests")}</Text>
                <View style={styles.guestButtons}>
                  <TouchableOpacity
                    onPress={dec}
                    style={[
                      styles.guestButton,
                      guests <= 1 && styles.disabledGuestButton,
                    ]}
                    disabled={guests <= 1}
                  >
                    <Minus
                      size={20}
                      color={guests <= 1 ? "#9CA3AF" : "#111827"}
                    />
                  </TouchableOpacity>
                  <Text style={styles.guestCount}>{guests}</Text>
                  <TouchableOpacity
                    onPress={inc}
                    style={[
                      styles.guestButton,
                      guests >= 20 && styles.disabledGuestButton,
                    ]}
                    disabled={guests >= 20}
                  >
                    <Plus
                      size={20}
                      color={guests >= 20 ? "#9CA3AF" : "#111827"}
                    />
                  </TouchableOpacity>
                </View>
              </View>
              <TouchableOpacity
                style={styles.confirmGuestButton}
                onPress={onClose}
              >
                <Text style={styles.confirmGuestButtonText}>
                  {t("common.confirm")}
                </Text>
              </TouchableOpacity>
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
  const { t, i18n } = useTranslation();
  const {
    q: qFromParams,
    lat,
    lon,
    near_me,
  } = useLocalSearchParams<{
    q?: string;
    lat?: string;
    lon?: string;
    near_me?: string;
  }>();

  const [viewMode, setViewMode] = useState<"list" | "map">("map");
  const [sortBy, setSortBy] = useState(t("search.sort_lowest_price"));
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  const [searchLocationInput, setSearchLocationInput] = useState(
    qFromParams || "",
  );
  const [searchLocationDisplay, setSearchLocationDisplay] = useState(
    qFromParams || "India",
  );

  const [region, setRegion] = useState<Region>(INDIA_REGION);

  const [checkInDate, setCheckInDate] = useState<string | null>(null);
  const [checkOutDate, setCheckOutDate] = useState<string | null>(null);
  const [guests, setGuests] = useState(2);
  const [isDatePickerVisible, setDatePickerVisible] = useState(false);
  const [isGuestPickerVisible, setGuestPickerVisible] = useState(false);
  const [isFilterModalVisible, setFilterModalVisible] = useState(false);

  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]);
  const [propertyTypes, setPropertyTypes] = useState<string[]>([]);
  const [amenities, setAmenities] = useState<string[]>([]);
  const [minRating, setMinRating] = useState("0");
  const [instantBookOnly, setInstantBookOnly] = useState(false);
  const [radiusKm, setRadiusKm] = useState(10);

  const [properties, setProperties] = useState<Property[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [useBbox, setUseBbox] = useState(false);
  const triedNoBboxRef = useRef(false);

  const sortOptions = [
    t("search.sort_lowest_price"),
    t("search.sort_highest_rated"),
    t("search.sort_closest"),
  ];

  // --- helpers ---

  const fetchEffectivePriceForListing = async (
    listingId: string,
    basePrice: number,
  ) => {
    // If no dates selected, just return the base price
    if (!checkInDate || !checkOutDate) return basePrice;

    try {
      const res = await apiGet<{ results: AvailabilityDay[] }>(
        `/v1/listings/${listingId}/availability`,
        {
          params: {
            start_date: checkInDate,
            end_date: checkOutDate,
          },
        },
      );

      const days = (res.results ?? []).filter(
        (d) => d.status === "available" || d.status === "booked",
      );
      if (!days.length) return basePrice;

      const total = days.reduce((sum, d) => sum + (d.price || basePrice), 0);

      return total / days.length;
    } catch (e) {
      console.error("Failed to load dynamic price for listing", listingId, e);
      return basePrice;
    }
  };

  const buildBbox = (r: Region): string => {
    const minLon = r.longitude - r.longitudeDelta / 2;
    const maxLon = r.longitude + r.longitudeDelta / 2;
    const minLat = r.latitude - r.latitudeDelta / 2;
    const maxLat = r.latitude + r.latitudeDelta / 2;
    return `${minLon},${minLat},${maxLon},${maxLat}`;
  };

  const buildSearchParams = (
    cursorOverride?: number | null,
    includeBbox = useBbox,
  ) => {
    const qs = new URLSearchParams();

    const isNearMe = String(near_me) === "1";
    if (!isNearMe && searchLocationInput) qs.append("q", searchLocationInput);
    if (includeBbox && region) qs.append("bbox", buildBbox(region));

    // dates/guests (optional)
    if (checkInDate) qs.append("start", checkInDate);
    if (checkOutDate) qs.append("end", checkOutDate);
    if (guests) qs.append("guests", String(guests));

    // filters -> backend
    qs.append("min_price", String(priceRange[0]));
    qs.append("max_price", String(priceRange[1]));
    if (minRating !== "0") qs.append("min_rating", minRating);
    if (amenities.length) qs.append("amenities", amenities.join(","));
    if (propertyTypes.length)
      qs.append("property_types", propertyTypes.join(","));

    // sort (backend supports price_asc and rating_desc; closest is client-side)
    if (sortBy === "Lowest price") qs.append("sort", "price_asc");
    else if (sortBy === "Highest rated") qs.append("sort", "rating_desc");
    else qs.append("sort", "newest");

    // pagination
    const c = cursorOverride ?? nextCursor;
    if (c != null) qs.append("cursor", String(c));
    qs.append("limit", "20");

    return qs;
  };

  const fetchSearch = async (
    cursorOverride: number | null = 0,
    replace = true,
    includeBbox = useBbox,
  ) => {
    try {
      const qs = buildSearchParams(cursorOverride, includeBbox);
      const params = Object.fromEntries(qs.entries());

      // IMPORTANT: apiGet should receive { params } (your earlier snippet is correct)
      const data = await apiGet<SearchResp>("/v1/search", { params });

      let items = (data.results ?? []).map(backendToProperty);

      // -----------------------------
      // 1) Radius KM + distance calc (client-side)
      // -----------------------------
      const center: Coordinates = {
        latitude: region.latitude,
        longitude: region.longitude,
      };

      items = items
        .map((p: any) => {
          const km = haversineKm(center, p.coordinates);
          return {
            ...p,
            distance: `${km.toFixed(1)} km`,
            _distanceKm: km,
          };
        })
        .filter((p: any) =>
          Number.isFinite(p._distanceKm) ? p._distanceKm <= radiusKm : true,
        );

      // -----------------------------
      // 2) Type filter (client-side)
      // -----------------------------
      // propertyTypes is your selected filter array (e.g. ['home','room','hotel'] or labels)
      // This assumes Property.type is REAL (not hardcoded to 'home').
      // If your UI stores labels like "Home", normalize them to match your Property.type.
      if (propertyTypes?.length) {
        const selected = new Set(
          propertyTypes.map((t: string) => String(t).trim().toLowerCase()),
        );

        items = items.filter((p: any) =>
          selected.has(
            String(p.type ?? "")
              .trim()
              .toLowerCase(),
          ),
        );
      }

      // -----------------------------
      // 3) Availability filtering + effective price
      // -----------------------------
      if (checkInDate && checkOutDate) {
        // (a) filter by availability
        const availabilityFlags = await Promise.all(
          items.map((p: any) => isListingAvailableForRange(p.id)),
        );
        items = items.filter((_: any, idx: number) => availabilityFlags[idx]);

        // (b) compute effective price only for remaining listings
        items = await Promise.all(
          items.map(async (p: any) => ({
            ...p,
            price: await fetchEffectivePriceForListing(p.id, p.price),
          })),
        );
      }

      // -----------------------------
      // 4) Sort (client-side where needed)
      // -----------------------------
      if (sortBy === "Closest") {
        items.sort(
          (a: any, b: any) => (a._distanceKm ?? 1e9) - (b._distanceKm ?? 1e9),
        );
      } else if (sortBy === "Lowest price") {
        items.sort((a: any, b: any) => (a.price ?? 0) - (b.price ?? 0));
      } else if (sortBy === "Highest rated") {
        items.sort((a: any, b: any) => (b.rating ?? 0) - (a.rating ?? 0));
      }
      // else backend order (newest) is fine

      // -----------------------------
      // 5) Set state + pagination
      // -----------------------------
      if (replace || !cursorOverride) {
        setProperties(items);
      } else {
        setProperties((prev) => [...prev, ...items]);
      }

      setNextCursor(data.next_cursor ?? null);

      // -----------------------------
      // 6) Recenter + bbox fallback
      // -----------------------------
      if (replace && items.length) {
        const c = items[0].coordinates;
        setRegion({
          latitude: c.latitude,
          longitude: c.longitude,
          latitudeDelta: 0.2,
          longitudeDelta: 0.2,
        });
        triedNoBboxRef.current = false;
      }

      if (
        replace &&
        includeBbox &&
        items.length === 0 &&
        !triedNoBboxRef.current
      ) {
        triedNoBboxRef.current = true;
        await fetchSearch(0, true, false);
      }
    } catch (e: any) {
      console.error("Search error", e);
      Alert.alert("Search Error", e?.message ?? "Failed to load results");
    }
  };

  const isListingAvailableForRange = async (listingId: string) => {
    if (!checkInDate || !checkOutDate) return true;

    try {
      const res = await apiGet<{ results: AvailabilityDay[] }>(
        `/v1/listings/${listingId}/availability`,
        { params: { start_date: checkInDate, end_date: checkOutDate } },
      );

      const days = res.results ?? [];
      if (!days.length) return false;

      // IMPORTANT: only show if ALL days are "available"
      return days.every((d) => d.status === "available");
    } catch (e) {
      console.error("availability check failed", listingId, e);
      // safest behavior: don't hide listing if availability fails
      return true;
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
    setMinRating("0");
    setInstantBookOnly(false);
    setRadiusKm(10);
    setUseBbox(false);
    fetchSearch(0, true, false);
  };

  const onEndReached = async () => {
    if (nextCursor == null || loadingMore) return; // <- key change
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
    const allowedMax = Math.max(
      BOTTOM_SHEET_MIN_HEIGHT,
      Math.min(h - MAP_MIN_VISIBLE_PX, SCREEN_HEIGHT * 0.9),
    );
    const finalMax = Math.max(allowedMax, BOTTOM_SHEET_MIN_HEIGHT + 1);
    setMaxSheetHeight(finalMax);
    maxSheetHeightSV.value = finalMax;
  };
  const onContentLayout = (e: LayoutChangeEvent) => {
    contentContainerHeight.value = e.nativeEvent.layout.height;
    clampHeightsFromLayout(e.nativeEvent.layout.height);
  };
  const gesture = Gesture.Pan()
    .onStart(() => {
      context.value = { y: translateY.value };
    })
    .onUpdate((ev) => {
      translateY.value = Math.max(
        Math.min(ev.translationY + context.value.y, 0),
        -(maxSheetHeightSV.value - BOTTOM_SHEET_MIN_HEIGHT),
      );
    });
  const animatedBottomSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    height: maxSheetHeight,
    bottom: -maxSheetHeight + BOTTOM_SHEET_MIN_HEIGHT,
  }));
  useEffect(() => {
    translateY.value = withSpring(0, { damping: 15 });
  }, []);

  // initial fetches
  useEffect(() => {
    // When language changes, refetch so listing title/ugc comes back translated
    fetchSearch(0, true, useBbox);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18n.language]);

  useEffect(() => {
    if (useBbox) fetchSearch(0, true, true);
  }, [region, useBbox]);

  useEffect(() => {
    // bootstrap from lat/lon (if provided)
    const boot = async (a: number, b: number) => {
      try {
        const idToken = (await SecureStore.getItemAsync("idToken")) || "";
        if (!idToken) return;

        const display = await reverseGeocode(a, b, idToken);

        const isNearMe = String(near_me) === "1";
        setSearchLocationInput(display);
        setSearchLocationDisplay(display);

        if (isNearMe) setSearchLocationInput("");

        const r: Region = {
          latitude: a,
          longitude: b,
          latitudeDelta: 0.12,
          longitudeDelta: 0.12,
        };
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

    try {
      const idToken = (await SecureStore.getItemAsync("idToken")) || "";
      if (!idToken) {
        Alert.alert(
          t("search.login_required"),
          t("search.please_log_in_again"),
        );
        return;
      }

      const result = await geocodeText(query, idToken);
      if (!result) {
        Alert.alert(t("common.error"), `No results for "${query}"`);
        return;
      }

      setSearchLocationDisplay(result.label);

      const next: Region = {
        latitude: result.latitude,
        longitude: result.longitude,
        latitudeDelta: 0.2,
        longitudeDelta: 0.2,
      };

      setRegion(next);
      await fetchSearch(0, true);
      setUseBbox(true);
      await fetchSearch(0, true, /* includeBbox */ true);
    } catch (e: any) {
      console.error(e);
      Alert.alert(t("common.error"), e?.message ?? "Failed to find that place");
    }
  };

  // map controls
  const mapRef = useRef<MapView | null>(null);
  const [locating, setLocating] = useState(false);
  const recenterToUser = async () => {
    try {
      setLocating(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          t("search.permission_denied"),
          t("search.location_access_denied"),
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
      setRegion({ ...center, latitudeDelta: 0.02, longitudeDelta: 0.02 });
      mapRef.current?.animateCamera?.({ center, zoom: 15 }, { duration: 300 });
      await fetchSearch(0, true);
      setUseBbox(true);
      await fetchSearch(0, true, /* includeBbox */ true);
    } finally {
      setLocating(false);
    }
  };
  const zoomBy = (f: number) =>
    setRegion((prev) => {
      const next = {
        ...prev,
        latitudeDelta: prev.latitudeDelta * f,
        longitudeDelta: prev.longitudeDelta * f,
      };
      mapRef.current?.animateToRegion(next, 200);
      return next;
    });
  const zoomIn = () => zoomBy(0.6);
  const zoomOut = () => zoomBy(1.4);

  const renderSortDropdown = () => (
    <View style={styles.dropdown}>
      {sortOptions.map((option) => (
        <TouchableOpacity
          key={option}
          style={styles.dropdownItem}
          onPress={() => {
            setSortBy(option);
            setShowSortDropdown(false);
            fetchSearch(0, true);
          }}
        >
          <Text style={styles.dropdownItemText}>{option}</Text>
          {sortBy === option && <Check size={16} color="#111827" />}
        </TouchableOpacity>
      ))}
    </View>
  );
  const renderPriceMarker = (price: number) => (
    <View style={styles.priceTagWrap}>
      <Text style={styles.priceTagText}>₹{(price / 1000).toFixed(1)}k</Text>
    </View>
  );
  const displayDates = () =>
    checkInDate && checkOutDate
      ? `${format(parseISO(checkInDate), "MMM dd")} - ${format(parseISO(checkOutDate), "MMM dd")}`
      : t("listing.select_dates");

  return (
    <ThemedView
      key={i18n.language}
      style={[styles.container, { paddingTop: insets.top }]}
    >
      <Stack.Screen
        options={{
          headerShown: true,
          title: `${t("tabs.search")} in ${searchLocationDisplay}`,
          headerShadowVisible: false,
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.push("/");
                }
              }}
              style={[styles.headerIconButton, { marginLeft: 8 }]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <ArrowLeft size={20} color="#111827" />
            </TouchableOpacity>
          ),
        }}
      />

      <View style={{ flex: 1, marginTop: -insets.top }}>
        <TouchableWithoutFeedback
          onPress={() => {
            setShowSortDropdown(false);
            Keyboard.dismiss();
          }}
        >
          <View style={styles.flex1}>
            {/* top inputs */}
            <View style={styles.searchInputsContainer}>
              <View style={styles.inputWrapper}>
                <MapPin size={18} color="#6B7280" />
                <TextInput
                  placeholder={t("listing.location")}
                  value={searchLocationInput}
                  onChangeText={setSearchLocationInput}
                  onSubmitEditing={handleLocationSearch}
                  placeholderTextColor="#6B7280"
                  style={styles.input}
                  returnKeyType="search"
                />
              </View>
              <TouchableOpacity
                style={styles.inputWrapper}
                onPress={() => setDatePickerVisible(true)}
              >
                <CalendarIcon size={18} color="#6B7280" />
                <Text
                  style={[
                    styles.inputText,
                    (!checkInDate || !checkOutDate) &&
                      styles.inputPlaceholderText,
                  ]}
                >
                  {displayDates()}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.inputWrapper}
                onPress={() => setGuestPickerVisible(true)}
              >
                <Users size={18} color="#6B7280" />
                <Text style={styles.inputText}>
                  {guests} {t("host.dashboard.guest")}
                  {guests > 1 ? "s" : ""}
                </Text>
              </TouchableOpacity>
            </View>

            {/* filter/sort */}
            <View style={styles.filterBarContainer}>
              <View style={styles.filterBar}>
                <TouchableOpacity
                  style={styles.filterButton}
                  onPress={() => setFilterModalVisible(true)}
                >
                  <SlidersHorizontal size={16} color="#111827" />
                  <Text style={styles.filterButtonText}>
                    {t("search.filters")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.sortButton}
                  onPress={() => setShowSortDropdown(true)}
                >
                  <Text style={styles.sortButtonText}>{sortBy}</Text>
                  <ChevronDown size={16} color="#6B7280" />
                </TouchableOpacity>
              </View>
              {showSortDropdown && renderSortDropdown()}
            </View>

            {/* content */}
            <View style={styles.contentArea} onLayout={onContentLayout}>
              {viewMode === "list" && (
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
              {viewMode === "map" && (
                <>
                  <View style={styles.mapContainer}>
                    <MapView
                      ref={mapRef}
                      style={styles.mapView}
                      provider={PROVIDER_DEFAULT}
                      initialRegion={region}
                      region={region}
                    >
                      {properties.map((p) => (
                        <Marker key={p.id} coordinate={p.coordinates}>
                          {renderPriceMarker(p.price)}
                        </Marker>
                      ))}
                    </MapView>

                    {/* floating map controls */}
                    <View pointerEvents="box-none" style={styles.locateControl}>
                      <TouchableOpacity
                        style={[styles.zoomBtn, { marginBottom: 8 }]}
                        onPress={zoomIn}
                      >
                        <Text style={{ fontSize: 18, color: "#111827" }}>
                          ＋
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.zoomBtn, { marginBottom: 8 }]}
                        onPress={zoomOut}
                      >
                        <Text
                          style={{
                            fontSize: 22,
                            lineHeight: 22,
                            color: "#111827",
                          }}
                        >
                          －
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.zoomBtn}
                        onPress={recenterToUser}
                        disabled={locating}
                      >
                        <LocateFixed size={18} color="#111827" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <Animated.View
                    style={[styles.bottomSheet, animatedBottomSheetStyle]}
                  >
                    <GestureDetector gesture={gesture}>
                      <View style={styles.dragHandleContainer}>
                        <View style={styles.dragHandle} />
                      </View>
                    </GestureDetector>
                    <GestureFlatList
                      data={properties}
                      keyExtractor={(x) => x.id}
                      renderItem={({ item }) => (
                        <PropertyCard property={item} />
                      )}
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
            <TouchableOpacity
              style={styles.mapToggleButton}
              onPress={() =>
                setViewMode((v) => (v === "list" ? "map" : "list"))
              }
            >
              {viewMode === "list" ? (
                <Map size={22} color="white" />
              ) : (
                <List size={22} color="white" />
              )}
            </TouchableOpacity>

            {/* modals */}
            <FilterPanel
              isVisible={isFilterModalVisible}
              onClose={() => setFilterModalVisible(false)}
              applyFilters={applyFilters}
              clearFilters={clearFilters}
              filteredCount={properties.length}
              priceRange={priceRange}
              setPriceRange={setPriceRange}
              propertyTypes={propertyTypes}
              setPropertyTypes={setPropertyTypes}
              amenities={amenities}
              setAmenities={setAmenities}
              minRating={minRating}
              setMinRating={setMinRating}
              instantBookOnly={instantBookOnly}
              setInstantBookOnly={setInstantBookOnly}
              radiusKm={radiusKm}
              setRadiusKm={setRadiusKm}
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
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  searchInputsContainer: {
    paddingHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    overflow: "hidden",
    marginHorizontal: 16,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    height: 52,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    paddingHorizontal: 12,
  },
  input: { flex: 1, fontSize: 16, marginLeft: 12, color: "#111827" },
  inputText: { flex: 1, fontSize: 16, marginLeft: 12, color: "#111827" },
  inputPlaceholderText: { color: "#6B7280" },
  tabsContainer: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: "#F3F4F6",
    borderRadius: 99,
    padding: 4,
  },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 99, alignItems: "center" },
  tabActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 3,
  },
  tabText: { fontSize: 14, fontWeight: "500", color: "#6B7280" },
  tabTextActive: { color: "#111827", fontWeight: "600" },
  filterBarContainer: {
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    zIndex: 10,
  },
  filterBar: { flexDirection: "row", alignItems: "center" },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 99,
  },
  filterButtonText: { fontSize: 14, marginLeft: 6, color: "#111827" },
  sortButton: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 99,
  },
  sortButtonText: { fontSize: 14, color: "#111827", marginRight: 4 },
  dropdown: {
    position: "absolute",
    top: 48,
    left: 90,
    backgroundColor: "white",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    width: 200,
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dropdownItemText: { fontSize: 16, color: "#111827" },
  contentArea: { flex: 1, position: "relative" },
  listContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 80 },
  listContentBottomSheet: {
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 30,
  },
  flatListInSheet: { flex: 1 },
  mapToggleButton: {
    position: "absolute",
    bottom: 32,
    alignSelf: "center",
    width: 56,
    height: 56,
    backgroundColor: "#111827",
    borderRadius: 28,
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
    overflow: "hidden",
    marginBottom: 16,
    height: 140,
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  cardImage: { width: 120, height: "100%" },
  instantBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  instantBadgeText: { color: "#111827", fontSize: 10, fontWeight: "bold" },
  cardDetails: { flex: 1, padding: 12 },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  cardName: { fontSize: 16, fontWeight: "600", color: "#111827", flex: 1 },
  cardRating: { flexDirection: "row", alignItems: "center", gap: 4 },
  cardRatingText: { fontSize: 14, fontWeight: "500" },
  cardLocation: { fontSize: 13, color: "#4B5563", flex: 1, marginLeft: 4 },
  cardFeatures: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
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
  priceTagWrap: {
    backgroundColor: "#111827",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 4,
  },
  priceTagText: { color: "white", fontSize: 14, fontWeight: "bold" },
  bottomSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    backgroundColor: "white",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 10,
    zIndex: 5,
  },
  dragHandleContainer: {
    height: 48,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  dragHandle: {
    width: 40,
    height: 5,
    backgroundColor: "#E5E7EB",
    borderRadius: 3,
  },
  // Modal Styles
  modalContainer: { flex: 1, backgroundColor: "white" },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    position: "relative",
  },
  modalTitle: { fontSize: 18, fontWeight: "600" },
  modalCloseButton: { position: "absolute", right: 16, top: 16, padding: 4 },
  modalScroll: { flex: 1 },
  modalScrollContent: { padding: 24, paddingBottom: 100 },
  filterSection: {
    marginBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    paddingBottom: 24,
  },
  //filterTitle: { fontSize: 18, fontWeight: '600', marginBottom: 16 },
  slider: { width: "100%", height: 40 },
  priceRangeLabels: { flexDirection: "row", justifyContent: "space-between" },
  priceLabel: { fontSize: 14, color: "#6B7280" },
  checkRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
  checkLabel: { fontSize: 16, marginLeft: 12, color: "#111827" },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#B0B0B0",
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxChecked: { backgroundColor: "#111827", borderColor: "#111827" },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#B0B0B0",
    justifyContent: "center",
    alignItems: "center",
  },
  radioChecked: { borderColor: "#111827" },
  radioCheckedInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#111827",
  },
  modalFooter: {
    flexDirection: "row",
    padding: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  clearButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
    marginRight: 8,
  },
  clearButtonText: { fontSize: 16, fontWeight: "600", color: "#111827" },
  showButton: {
    flex: 2,
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111827",
    marginLeft: 8,
  },
  showButtonText: { fontSize: 16, fontWeight: "600", color: "white" },
  disabledButton: { backgroundColor: "#D1D5DB" },
  guestModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  guestModalContent: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 24,
    width: "85%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  guestModalTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 20,
    textAlign: "center",
  },
  guestControlRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  guestLabel: { fontSize: 16, color: "#374151" },
  guestButtons: { flexDirection: "row", alignItems: "center" },
  guestButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 8,
  },
  disabledGuestButton: { borderColor: "#E5E7EB" },
  guestCount: {
    fontSize: 18,
    fontWeight: "600",
    minWidth: 30,
    textAlign: "center",
  },
  confirmGuestButton: {
    backgroundColor: "#111827",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  confirmGuestButtonText: { color: "white", fontSize: 16, fontWeight: "600" },
  radiusLabelContainer: { alignItems: "center", marginTop: 8 },
  radiusLabelText: { fontSize: 16, color: "#111827", fontWeight: "500" },
  mapContainer: { flex: 1 },
  mapView: { width: "100%", height: "100%" },

  // ⬇️⬇️ NEW: styles for locate button (reuses your zoomBtn style)
  locateControl: {
    position: "absolute",
    right: 12,
    top: 12, // adjust if the bottom sheet overlaps
    zIndex: 10,
    alignItems: "center",
  },
  zoomBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 2,
  },

  headerIconButton: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
  },

  filterHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
    backgroundColor: "#fff",
  },

  filterBackButton: {
    width: 40,
    alignItems: "flex-start",
    justifyContent: "center",
  },

  filterTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },

  filterHeaderTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 24,
    fontWeight: "600",
    color: "#111827",
  },
});
