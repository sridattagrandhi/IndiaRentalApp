import { ThemedView } from "@/components/themed-view";
import { calculateRoute, geocodeText } from "@/services/location"; // adjust path if needed
import Slider from "@react-native-community/slider";
import { format, parseISO } from "date-fns";
import { Image } from "expo-image";
import { Stack, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import {
  ArrowLeft,
  Calendar,
  Check,
  List,
  Map,
  MapPin,
  Minus,
  Plus,
  Route as RouteIcon,
  SlidersHorizontal,
  Star,
  Users,
} from "lucide-react-native";
import React, {
  Dispatch,
  SetStateAction,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Dimensions,
  Keyboard,
  LayoutChangeEvent,
  Modal,
  SafeAreaView,
  ScrollView,
  SectionList,
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
import MapView, {
  Marker,
  Polyline,
  PROVIDER_DEFAULT,
  Region,
} from "react-native-maps";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ✅ NEW: call your backend
import { apiGet } from "@/services/api";

// ---- Height constants ----
const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const BOTTOM_SHEET_MIN_HEIGHT = SCREEN_HEIGHT * 0.15;
const DEFAULT_MAX_HEIGHT = SCREEN_HEIGHT * 0.55;
const MAP_MIN_VISIBLE_PX = 180;

// --- Data ---
interface Property {
  id: string;
  name: string;
  location: string;
  price: number;
  rating: number;
  distanceFromRoute: string;
  segmentDistance: string;
  image: string;
  features: string[];
  propertyType?: string | null;
  routeSegment: string;
  coordinates: { latitude: number; longitude: number };
}

type AvailabilityDay = {
  date: string;
  status: "available" | "blocked" | "booked";
  price: number;
};

const mockProperties: Property[] = [
  {
    id: "1",
    name: "Highway Rest Inn",
    location: "Near Panvel Toll Plaza",
    price: 1800,
    rating: 4.5,
    distanceFromRoute: "0.5 km",
    segmentDistance: "42 km from Mumbai",
    image:
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=1200&auto=format&fit=crop",
    features: ["Parking", "24×7 Check-in", "Highway Access"],
    routeSegment: "Near Panvel",
    coordinates: { latitude: 18.9894, longitude: 73.1175 },
  },
  {
    id: "2",
    name: "Riverside Resort",
    location: "Kolad",
    price: 3500,
    rating: 4.8,
    distanceFromRoute: "2.3 km",
    segmentDistance: "118 km from Mumbai",
    image:
      "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?q=80&w=1200&auto=format&fit=crop",
    features: ["Parking", "Restaurant", "EV Charging"],
    routeSegment: "Near Kolad",
    coordinates: { latitude: 18.4116, longitude: 73.3278 },
  },
  {
    id: "3",
    name: "Budget Stay Express",
    location: "Khandala",
    price: 1200,
    rating: 4.2,
    distanceFromRoute: "1.1 km",
    segmentDistance: "68 km from Mumbai",
    image:
      "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?q=80&w=1200&auto=format&fit=crop",
    features: ["Parking", "WiFi", "24×7 Check-in"],
    routeSegment: "Near Khandala",
    coordinates: { latitude: 18.7618, longitude: 73.3768 },
  },
  {
    id: "4",
    name: "Lonavala Lake View",
    location: "Lonavala",
    price: 4200,
    rating: 4.9,
    distanceFromRoute: "3.8 km",
    segmentDistance: "82 km from Mumbai",
    image:
      "https://images.unsplash.com/photo-1444201983204-c43cbd584d93?q=80&w=1200&auto=format&fit=crop",
    features: ["Parking", "Lake View", "Restaurant"],
    routeSegment: "Near Lonavala",
    coordinates: { latitude: 18.7557, longitude: 73.4091 },
  },
  {
    id: "5",
    name: "Expressway Motel",
    location: "Talegaon",
    price: 2100,
    rating: 4.4,
    distanceFromRoute: "0.8 km",
    segmentDistance: "95 km from Mumbai",
    image:
      "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?q=80&w=1200&auto=format&fit=crop",
    features: ["Parking", "24×7 Check-in"],
    routeSegment: "Near Talegaon",
    coordinates: { latitude: 18.7297, longitude: 73.6601 },
  },
];

const mockRegion: Region = {
  latitude: 18.7888,
  longitude: 73.4079,
  latitudeDelta: 0.8,
  longitudeDelta: 0.8,
};

const RoutePropertyCard = ({ property }: { property: Property }) => {
  const { t } = useTranslation();
  return (
    <View style={styles.card}>
      <Image
        source={{ uri: property.image }}
        style={styles.cardImage}
        placeholder={{ blurhash: "LEHV6nWB2yk8pyo0adR*.7kCMdnj" }}
        transition={300}
      />
      <View style={styles.cardDetails}>
        <View style={[styles.cardRow, { marginBottom: 4 }]}>
          <Text style={styles.cardName} numberOfLines={2}>
            {property.name}
          </Text>
          <View style={styles.cardRating}>
            <Star size={14} color="#F59E0B" fill="#F59E0B" />
            <Text style={styles.cardRatingText}>{property.rating}</Text>
          </View>
        </View>
        <View style={[styles.cardRow, { marginBottom: 2 }]}>
          <MapPin size={12} color="#6B7280" />
          <Text style={styles.cardLocation} numberOfLines={1}>
            {property.location}
          </Text>
        </View>
        <Text style={styles.routeDistanceText}>
          {property.segmentDistance} • {property.distanceFromRoute} from route
        </Text>
        <View style={styles.cardFeatures}>
          {property.features.slice(0, 3).map((feature) => (
            <View key={feature} style={styles.cardFeatureTag}>
              <Text style={styles.cardFeatureText}>{feature}</Text>
            </View>
          ))}
        </View>
        <View style={[styles.cardRow, { marginTop: "auto" }]}>
          <Text style={styles.cardPrice}>
            ₹{property.price.toLocaleString("en-IN")}
            <Text style={styles.cardPriceNight}>
              {t("listing.night_short")}
            </Text>
          </Text>
          <TouchableOpacity style={styles.cardViewButton}>
            <Text style={styles.cardViewButtonText}>{t("search.view")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

// --- RouteSegmentsList ---
const RouteSegmentsList = ({ properties }: { properties: Property[] }) => {
  const sections = Object.entries(
    properties.reduce(
      (acc, prop) => {
        (acc[prop.routeSegment] = acc[prop.routeSegment] || []).push(prop);
        return acc;
      },
      {} as Record<string, Property[]>,
    ),
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
const RouteSegmentsGestureList = ({
  properties,
}: {
  properties: Property[];
}) => {
  const groupedData = Object.entries(
    properties.reduce(
      (acc, prop) => {
        (acc[prop.routeSegment] = acc[prop.routeSegment] || []).push(prop);
        return acc;
      },
      {} as Record<string, Property[]>,
    ),
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
          {props.map((prop) => (
            <RoutePropertyCard key={prop.id} property={prop} />
          ))}
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
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  description?: string;
  icon?: React.ReactNode;
}
const CustomCheckbox = ({
  label,
  description,
  value,
  onValueChange,
  icon,
}: CustomCheckboxProps) => (
  <TouchableOpacity
    style={styles.checkRow}
    onPress={() => onValueChange(!value)}
  >
    <View style={[styles.checkbox, value && styles.checkboxChecked]}>
      {value && <Check size={12} color="#FFFFFF" />}
    </View>
    {icon ? <View style={styles.checkIcon}>{icon}</View> : null}
    <View style={styles.checkTextContainer}>
      <Text style={styles.checkLabel}>{label}</Text>
      {description ? (
        <Text style={styles.checkDescription}>{description}</Text>
      ) : null}
    </View>
  </TouchableOpacity>
);

// --- Filters Modal ---
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
}

const PROPERTY_TYPE_OPTIONS = ["room", "home", "hotel"];
const AMENITY_OPTIONS = [
  "AC",
  "Parking",
  "WiFi",
  "Late Check-in",
  "Pool",
  "Breakfast",
];

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
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
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

          {/* Spacer to keep title centered */}
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          style={styles.modalScroll}
          contentContainerStyle={styles.modalScrollContent}
        >
          {/* Price */}
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

          {/* Property type */}
          <View style={styles.filterSection}>
            <Text style={styles.filterTitle}>{t("search.property_type")}</Text>
            {PROPERTY_TYPE_OPTIONS.map((type) => (
              <CustomCheckbox
                key={type}
                label={type[0].toUpperCase() + type.slice(1)}
                value={propertyTypes.includes(type)}
                onValueChange={() => togglePropertyType(type)}
              />
            ))}
          </View>

          {/* Amenities */}
          <View style={styles.filterSection}>
            <Text style={styles.filterTitle}>{t("listing.amenities")}</Text>
            {AMENITY_OPTIONS.map((a) => (
              <CustomCheckbox
                key={a}
                label={a}
                value={amenities.includes(a)}
                onValueChange={() => toggleAmenity(a)}
              />
            ))}
          </View>

          {/* Rating */}
          <View style={[styles.filterSection, { borderBottomWidth: 0 }]}>
            <Text style={styles.filterTitle}>{t("search.minimum_rating")}</Text>
            <CustomRadio
              label="Any"
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
  const { t } = useTranslation();
  const [selectedStartDate, setSelectedStartDate] = useState<string | null>(
    checkIn,
  );
  const [selectedEndDate, setSelectedEndDate] = useState<string | null>(
    checkOut,
  );
  const [selectingPhase, setSelectingPhase] = useState<"start" | "end">(
    checkIn ? "end" : "start",
  );

  useEffect(() => {
    setSelectedStartDate(checkIn);
    setSelectedEndDate(checkOut);
    setSelectingPhase(checkIn ? "end" : "start");
  }, [isVisible, checkIn, checkOut]);

  const handleDayPress = (day: DateData) => {
    if (
      selectingPhase === "start" ||
      (selectedStartDate &&
        selectedEndDate &&
        day.dateString < selectedStartDate!)
    ) {
      setSelectedStartDate(day.dateString);
      setSelectedEndDate(null);
      setSelectingPhase("end");
    } else if (selectedStartDate && day.dateString >= selectedStartDate!) {
      setSelectedEndDate(day.dateString);
      setSelectingPhase("start");
    } else if (!selectedStartDate) {
      setSelectedStartDate(day.dateString);
      setSelectedEndDate(null);
      setSelectingPhase("end");
    }
  };

  const handleConfirm = () => {
    setCheckIn(selectedStartDate);
    setCheckOut(selectedEndDate);
    onClose();
  };

  const markedDates: { [date: string]: any } = {};
  if (selectedStartDate)
    markedDates[selectedStartDate] = {
      startingDay: true,
      color: "#111827",
      textColor: "white",
    };
  if (selectedEndDate) {
    markedDates[selectedEndDate] = {
      endingDay: true,
      color: "#111827",
      textColor: "white",
    };
    if (selectedStartDate && selectedStartDate !== selectedEndDate) {
      let currentDate = new Date(parseISO(selectedStartDate));
      const endDate = new Date(parseISO(selectedEndDate));
      currentDate.setDate(currentDate.getDate() + 1);
      while (currentDate < endDate) {
        const dateString = currentDate.toISOString().split("T")[0];
        markedDates[dateString] = { color: "#F3F4F6", textColor: "#111827" };
        currentDate.setDate(currentDate.getDate() + 1);
      }
      markedDates[selectedStartDate] = {
        ...markedDates[selectedStartDate],
        color: "#111827",
        textColor: "white",
      };
      markedDates[selectedEndDate] = {
        ...markedDates[selectedEndDate],
        color: "#111827",
        textColor: "white",
      };
    } else if (selectedStartDate === selectedEndDate) {
      markedDates[selectedStartDate] = {
        startingDay: true,
        endingDay: true,
        color: "#111827",
        textColor: "white",
      };
    }
  }

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.headerIconButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ArrowLeft size={20} color="#111827" />
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { marginLeft: 8 }]}>
            {t("search.filters")}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <CalendarList
            current={
              selectedStartDate || new Date().toISOString().split("T")[0]
            }
            minDate={new Date().toISOString().split("T")[0]}
            onDayPress={handleDayPress}
            markingType={"period"}
            markedDates={markedDates}
            pastScrollRange={0}
            futureScrollRange={12}
            scrollEnabled
            showScrollIndicator
            theme={{
              backgroundColor: "#FFFFFF",
              calendarBackground: "#FFFFFF",
              textSectionTitleColor: "#111827",
              selectedDayBackgroundColor: "#111827",
              selectedDayTextColor: "#FFFFFF",
              todayTextColor: "#DC2626",
              dayTextColor: "#111827",
              textDisabledColor: "#D1D5DB",
            }}
          />
        </View>
        <View style={styles.datePickerModalFooter}>
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => {
              setSelectedStartDate(null);
              setSelectedEndDate(null);
              setSelectingPhase("start");
            }}
          >
            <Text style={styles.clearButtonText}>{t("common.clear")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.showButton,
              (!selectedStartDate || !selectedEndDate) && styles.disabledButton,
            ]}
            onPress={handleConfirm}
            disabled={!selectedStartDate || !selectedEndDate}
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

// --- Guests Modal ---
interface GuestPickerModalProps {
  isVisible: boolean;
  onClose: () => void;
  guests: number;
  setGuests: (count: number) => void;
}
function GuestPickerModal({
  isVisible,
  onClose,
  guests,
  setGuests,
}: GuestPickerModalProps) {
  const { t } = useTranslation();
  const increment = () => setGuests(Math.min(guests + 1, 20));
  const decrement = () => setGuests(Math.max(guests - 1, 1));
  return (
    <Modal
      visible={isVisible}
      animationType="fade"
      transparent
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
                <Text style={styles.guestLabel}>Guests</Text>
                <View style={styles.guestButtons}>
                  <TouchableOpacity
                    onPress={decrement}
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
                    onPress={increment}
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

// ✅ NEW: helper to normalize what backend wants
const toBackendCoords = (coords: { latitude: number; longitude: number }[]) =>
  coords.map((c) => [c.longitude, c.latitude]);

function thinCoords<T>(arr: T[], maxPoints = 250): T[] {
  if (!arr || arr.length <= maxPoints) return arr;
  const step = Math.ceil(arr.length / maxPoints);
  const thinned = [];
  for (let i = 0; i < arr.length; i += step) thinned.push(arr[i]);
  // always include the last point
  if (thinned[thinned.length - 1] !== arr[arr.length - 1]) {
    thinned.push(arr[arr.length - 1]);
  }
  return thinned;
}

// ✅ NEW: fetch listings along route
async function fetchStaysAlongRoute(
  routeCoords: { latitude: number; longitude: number }[],
  radiusKm: number,
  filters: {
    priceRange: [number, number];
    minRating: string;
    amenities: string[];
    propertyTypes: string[];
  },
  cursor?: number,
) {
  const thinned = thinCoords(routeCoords, 250);

  const params: Record<string, string> = {
    coords: JSON.stringify(toBackendCoords(thinned)),
    radius_km: String(radiusKm),
    limit: "50",
    min_price: String(filters.priceRange[0]),
    max_price: String(filters.priceRange[1]),
  };

  if (cursor != null) params.cursor = String(cursor);
  if (filters.minRating !== "0") params.min_rating = String(filters.minRating);
  if (filters.amenities.length) params.amenities = filters.amenities.join(",");
  if (filters.propertyTypes.length)
    params.property_types = filters.propertyTypes.join(",");

  return apiGet<{ count: number; results: any[]; next_cursor: number | null }>(
    "/v1/route-search",
    { params },
  );
}

export default function RoutePlannerPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const [viewMode, setViewMode] = useState<"map" | "list">("map");
  const [isFilterModalVisible, setFilterModalVisible] = useState(false);
  const [selectedRadius, setSelectedRadius] = useState(t("route.radius_5km"));

  // Inputs accept any text (address/city/POI)
  const [fromLocationInput, setFromLocationInput] = useState("");
  const [toLocationInput, setToLocationInput] = useState("");
  const [fromCoords, setFromCoords] = useState<LatLon | null>(null);
  const [toCoords, setToCoords] = useState<LatLon | null>(null);
  const [lastRouteCoords, setLastRouteCoords] = useState<
    { latitude: number; longitude: number }[] | null
  >(null);

  const [checkInDate, setCheckInDate] = useState<string | null>(null);
  const [checkOutDate, setCheckOutDate] = useState<string | null>(null);
  const [guests, setGuests] = useState(2);
  const [isDatePickerVisible, setDatePickerVisible] = useState(false);
  const [isGuestPickerVisible, setGuestPickerVisible] = useState(false);

  // Filters (same as search.tsx)
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]);
  const [propertyTypes, setPropertyTypes] = useState<string[]>([]);
  const [amenities, setAmenities] = useState<string[]>([]);
  const [minRating, setMinRating] = useState("0");

  // ✅ NEW: live data from backend (replaces mock)
  const [routeListings, setRouteListings] = useState<Property[]>([]);
  const [routeNext, setRouteNext] = useState<number | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);

  // what the UI renders (kept same prop name to avoid UI changes)
  const [filteredProperties, setFilteredProperties] = useState<Property[]>([]);

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

  const radiusOptions = [
    t("route.radius_1km"),
    t("route.radius_3km"),
    t("route.radius_5km"),
    t("route.radius_10km"),
  ];

  const fetchEffectivePriceForListing = async (
    listingId: string,
    basePrice: number,
  ) => {
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
      console.error(
        "Failed to load dynamic price for listing (route)",
        listingId,
        e,
      );
      return basePrice;
    }
  };

  // Sheet helpers
  const adjustZoom = async (delta: number) => {
    if (!mapRef.current) return;
    try {
      const cam = await mapRef.current.getCamera();
      if (typeof cam.zoom === "number") {
        const next = Math.max(2, Math.min(20, cam.zoom + delta));
        mapRef.current.animateCamera({ zoom: next }, { duration: 200 });
        return;
      }
    } catch {
      /* fall through to region method */
    }

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
        200,
      );
    }
  };

  const clampHeightsFromLayout = (containerHeight: number) => {
    const allowedMax = Math.max(
      BOTTOM_SHEET_MIN_HEIGHT,
      Math.min(containerHeight - MAP_MIN_VISIBLE_PX, SCREEN_HEIGHT * 0.9),
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
    .onStart(() => {
      context.value = { y: translateY.value };
    })
    .onUpdate((event) => {
      translateY.value = event.translationY + context.value.y;
      translateY.value = Math.max(
        translateY.value,
        -(maxSheetHeightSV.value - BOTTOM_SHEET_MIN_HEIGHT),
      );
      translateY.value = Math.min(translateY.value, 0);
    });
  const animatedBottomSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    height: maxSheetHeight,
    bottom: -maxSheetHeight + BOTTOM_SHEET_MIN_HEIGHT,
  }));
  useEffect(() => {
    translateY.value = withSpring(0, { damping: 15 });
  }, []);

  // --- Routing helpers ---
  const parseRouteFeature = (feature: any): RouteOption | null => {
    if (!feature) return null;
    const geom = feature.geometry;
    const props = feature.properties || {};
    const lonlatPairs: number[][] =
      geom?.type === "LineString"
        ? geom.coordinates
        : geom?.type === "MultiLineString"
          ? geom.coordinates.flat()
          : [];
    if (!lonlatPairs.length) return null;
    const coords = lonlatPairs.map(([lon, lat]) => ({
      latitude: lat,
      longitude: lon,
    }));
    const distanceMeters = Number(
      props?.distance ?? props?.total_distance ?? 0,
    );
    const timeSeconds = Number(props?.time ?? props?.total_time ?? 0);
    return {
      label: "route",
      coords,
      distanceKm: distanceMeters / 1000,
      timeMin: timeSeconds / 60,
    };
  };

  const pickBest = (routes: RouteOption[]): RouteOption | null => {
    if (!routes.length) return null;
    // prefer lowest time, then distance
    const sorted = routes
      .slice()
      .sort((a, b) =>
        a.timeMin !== b.timeMin
          ? a.timeMin - b.timeMin
          : a.distanceKm - b.distanceKm,
      );
    return sorted[0];
  };

  // Fetch several candidate routes and choose the best
  const fetchBestRoute = async (from: LatLon, to: LatLon) => {
    try {
      setRoutingBusy(true);

      const idToken = (await SecureStore.getItemAsync("idToken")) || "";
      if (!idToken) {
        Alert.alert(
          t("search.login_required"),
          t("search.please_log_in_again"),
        );
        return;
      }

      const out = await calculateRoute(
        { latitude: from.lat, longitude: from.lon },
        { latitude: to.lat, longitude: to.lon },
        idToken,
      );

      if (!out) {
        Alert.alert(
          t("route.route_error"),
          t("route.could_not_calculate_route"),
        );
        setBestRoute(null);
        setAltRoutes([]);
        return;
      }

      const best: RouteOption = {
        label: t("route.best_route"),
        coords: out.coords,
        distanceKm: out.distanceKm,
        timeMin: out.durationMin,
      };

      setBestRoute(best);
      setAltRoutes([]);

      if (mapRef.current && best.coords.length > 1) {
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
      Alert.alert(
        t("route.route_error"),
        e?.message ?? t("route.could_not_calculate_route"),
      );
      setRouteListings([]);
      setFilteredProperties([]);
    } finally {
      setRoutingBusy(false);
    }
  };

  // Debounced version so we don't hammer the API on quick edits
  const debouncedFetch = useMemo(() => debounce(fetchBestRoute, 400), []);

  // Geocode helper (works for city/address/POI)
  const handleLocationSearch = async (type: "from" | "to") => {
    Keyboard.dismiss();
    const query = (
      type === "from" ? fromLocationInput : toLocationInput
    ).trim();
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

      if (type === "from") {
        setFromCoords({ lat: result.latitude, lon: result.longitude });
        setFromLocationInput(result.label);
      } else {
        setToCoords({ lat: result.latitude, lon: result.longitude });
        setToLocationInput(result.label);
      }
    } catch (err: any) {
      console.error("Geocoding failed:", err);
      Alert.alert(
        t("route.route_error"),
        err?.message || t("route.could_not_perform_search"),
      );
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
      return `${format(parseISO(checkInDate), "MMM dd")} - ${format(parseISO(checkOutDate), "MMM dd")}`;
    }
    return t("listing.select_dates");
  };

  // Auto-fetch when both coords are known (debounced)
  useEffect(() => {
    if (fromCoords && toCoords) {
      debouncedFetch(fromCoords, toCoords);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromCoords?.lat, fromCoords?.lon, toCoords?.lat, toCoords?.lon]);

  // ✅ NEW: whenever we have a route & radius, pull listings from backend
  useEffect(() => {
    (async () => {
      if (!bestRoute?.coords?.length) return;
      setLoadingRoute(true);
      try {
        const radiusNum = Number(
          (selectedRadius || "5 km of route").split(" ")[0],
        );
        const filters = { priceRange, minRating, amenities, propertyTypes };

        const data = await fetchStaysAlongRoute(
          bestRoute.coords,
          radiusNum,
          filters,
        );

        let mapped: Property[] = (data.results ?? []).map((it: any) => ({
          id: String(it.id),
          name: it.title ?? it.name ?? "Stay",
          location: it.full_address || it.street || it.city || "—",
          price: Number(it.price ?? 0),
          rating: Number(it.rating ?? 0),
          distanceFromRoute:
            typeof it.distance_from_route_km === "number"
              ? `${it.distance_from_route_km.toFixed(1)} km`
              : "—",
          segmentDistance: "",
          image: it.photo_url ?? "https://picsum.photos/seed/route/640/480",
          features: Array.isArray(it.amenities) ? it.amenities : [],
          propertyType: it.property_type ?? it.propertyType ?? it.type ?? null,
          routeSegment: "Along route",
          coordinates: {
            latitude: Number(
              it.coordinates?.latitude ?? it.latitude ?? it.lat ?? 0,
            ),
            longitude: Number(
              it.coordinates?.longitude ?? it.longitude ?? it.lon ?? 0,
            ),
          },
        }));

        if (checkInDate && checkOutDate) {
          mapped = await Promise.all(
            mapped.map(async (p) => ({
              ...p,
              price: await fetchEffectivePriceForListing(p.id, p.price),
            })),
          );
        }

        setRouteListings(mapped);
        setRouteNext(data.next_cursor ?? null);
        setFilteredProperties(mapped);
      } catch (e: any) {
        Alert.alert(
          "Route search error",
          e?.message ?? "Failed to fetch stays along route.",
        );
        setRouteListings([]);
        setFilteredProperties([]);
      } finally {
        setLoadingRoute(false);
      }
    })();
  }, [
    bestRoute,
    selectedRadius,
    // include these if you want backend refetch on filter changes:
    priceRange,
    minRating,
    amenities,
    propertyTypes,
    // include dates if your pricing depends on them:
    checkInDate,
    checkOutDate,
    i18n.language,
  ]);

  // Filters (logic unchanged—now applied to current list)
  const applyFilters = () => {
    const next = routeListings.filter((p: any) => {
      // price
      const priceOk = p.price >= priceRange[0] && p.price <= priceRange[1];

      // type (if listing doesn't have propertyType yet, don't filter it out)
      const type = (p.propertyType ?? "").toString().toLowerCase();
      const typeOk = propertyTypes.length
        ? type
          ? propertyTypes.includes(type)
          : true
        : true;

      // amenities (require all selected)
      const feats = Array.isArray(p.features)
        ? p.features.map((x: string) => (x ?? "").toLowerCase())
        : [];
      const need = amenities.map((a) => a.toLowerCase());
      const amenOk = need.length ? need.every((a) => feats.includes(a)) : true;

      // rating
      const r = Number(p.rating ?? 0);
      const ratingOk = r >= Number(minRating || "0");

      return priceOk && typeOk && amenOk && ratingOk;
    });

    setFilteredProperties(next);
    setFilterModalVisible(false);
  };

  const clearFilters = () => {
    setPriceRange([0, 10000]);
    setPropertyTypes([]);
    setAmenities([]);
    setMinRating("0");
    setFilteredProperties(routeListings);
  };

  // Optional infinite scroll loader (not wired to UI, keeps UI unchanged)
  const loadMoreRoute = async () => {
    if (routeNext == null || !bestRoute?.coords?.length || loadingRoute) return;
    setLoadingRoute(true);
    try {
      const radiusNum = Number(
        (selectedRadius || "5 km of route").split(" ")[0],
      );
      const filters = { priceRange, minRating, amenities, propertyTypes };

      const data = await fetchStaysAlongRoute(
        bestRoute.coords,
        radiusNum,
        filters,
        routeNext,
      );

      const mapped: Property[] = (data.results ?? []).map((it: any) => ({
        id: String(it.id),
        name: it.title ?? it.name ?? "Stay",
        location: it.full_address || it.street || it.city || "—",
        price: Number(it.price ?? 0),
        rating: Number(it.rating ?? 0),
        distanceFromRoute:
          typeof it.distance_from_route_km === "number"
            ? `${it.distance_from_route_km.toFixed(1)} km`
            : "—",
        segmentDistance: "",
        image: it.photo_url ?? "https://picsum.photos/seed/route/640/480",
        features: Array.isArray(it.amenities) ? it.amenities : [],
        propertyType: it.property_type ?? it.propertyType ?? it.type ?? null,
        routeSegment: t("route.along_route"),
        coordinates: {
          latitude: Number(
            it.coordinates?.latitude ?? it.latitude ?? it.lat ?? 0,
          ),
          longitude: Number(
            it.coordinates?.longitude ?? it.longitude ?? it.lon ?? 0,
          ),
        },
      }));

      setRouteListings((prev) => [...prev, ...mapped]);
      setFilteredProperties((prev) => [...prev, ...mapped]);
      setRouteNext(data.next_cursor ?? null);
    } catch (e: any) {
      Alert.alert(
        "Route search error",
        e?.message ?? "Failed to load more stays.",
      );
    } finally {
      setLoadingRoute(false);
    }
  };

  const renderPriceMarker = (price: number) => (
    <View style={styles.priceTagWrap}>
      <Text style={styles.priceTagText}>₹{(price / 1000).toFixed(1)}k</Text>
    </View>
  );

  return (
    <ThemedView
      key={i18n.language}
      style={[styles.container, { paddingTop: insets.top }]}
    >
      <Stack.Screen
        options={{
          headerShown: true,
          title: t("route.plan_your_route"),
          headerTitleAlign: "left",
          headerShadowVisible: false,
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.push("/"); // or '/(tabs)' if that’s your root
                }
              }}
              style={[styles.headerIconButton, { marginLeft: 8 }]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <ArrowLeft size={20} color="#111827" />
            </TouchableOpacity>
          ),
          headerTitle: (props) => (
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <RouteIcon size={20} color="#111827" />
              <Text style={{ fontSize: 20, fontWeight: "600", marginLeft: 8 }}>
                {props.children}
              </Text>
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
                <Text style={styles.inputLabel}>{t("route.from")}</Text>
                <TextInput
                  value={fromLocationInput}
                  onChangeText={setFromLocationInput}
                  onSubmitEditing={() => handleLocationSearch("from")}
                  placeholder={t("route.city_address_place")}
                  placeholderTextColor="#6B7280"
                  style={styles.textInputStyle}
                  returnKeyType="search"
                />
              </View>
              <View style={styles.inputWrapper}>
                <MapPin size={18} color="#DC2626" />
                <Text style={styles.inputLabel}>{t("route.to")}</Text>
                <TextInput
                  value={toLocationInput}
                  onChangeText={setToLocationInput}
                  onSubmitEditing={() => handleLocationSearch("to")}
                  placeholder={t("route.city_address_place")}
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
                    style={[
                      styles.inputText,
                      (!checkInDate || !checkOutDate) &&
                        styles.inputPlaceholderText,
                    ]}
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
                  <Text
                    style={styles.inputText}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {guests} {t("listing.guests")}
                    {guests > 1 ? "s" : ""}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Radius */}
            <View style={styles.radiusContainer}>
              <Text style={styles.radiusLabel}>{t("route.show_within")}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {radiusOptions.map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.radiusButton,
                      selectedRadius === option && styles.radiusButtonActive,
                    ]}
                    onPress={() => setSelectedRadius(option)}
                  >
                    <Text
                      style={[
                        styles.radiusButtonText,
                        selectedRadius === option &&
                          styles.radiusButtonTextActive,
                      ]}
                    >
                      {option}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Filter bar */}
            <View style={styles.filterBar}>
              <TouchableOpacity
                style={styles.filterButton}
                onPress={() => setFilterModalVisible(true)}
              >
                <SlidersHorizontal size={16} color="#111827" />
                <Text style={styles.filterButtonText}>
                  {t("route.road_trip_filters")}
                </Text>
              </TouchableOpacity>
              <Text style={styles.filterResultText}>
                {filteredProperties.length} stays {t("route.along_route")}{" "}
                {fromLocationInput} → {toLocationInput}
              </Text>
            </View>

            {/* Content (measured for sheet clamp) */}
            <View style={styles.contentArea} onLayout={onContentLayout}>
              {viewMode === "list" && (
                <RouteSegmentsList properties={filteredProperties} />
              )}

              {viewMode === "map" && (
                <>
                  {/* Route summary pill */}
                  {(bestRoute || routingBusy) && (
                    <View style={styles.routeSummaryPill}>
                      <Text style={styles.routeSummaryText}>
                        {routingBusy
                          ? t("route.calculating_routes")
                          : `${t("route.best_route")}: ${bestRoute!.distanceKm.toFixed(1)} km • ${Math.round(bestRoute!.timeMin)} min`}
                      </Text>
                    </View>
                  )}

                  {/* Empty-state hint */}
                  {!routingBusy && !bestRoute && (
                    <View style={[styles.routeSummaryPill, { right: 16 }]}>
                      <Text style={styles.routeSummaryText}>
                        {t("route.no_route_found")}
                      </Text>
                    </View>
                  )}

                  {/* Alternates legend (if any) */}
                  {!!altRoutes.length && (
                    <View style={styles.altLegend}>
                      <View style={styles.legendRow}>
                        <View
                          style={[
                            styles.legendSwatch,
                            {
                              borderColor: "#2563EB",
                              backgroundColor: "#2563EB",
                            },
                          ]}
                        />
                        <Text style={styles.legendText}>Best route</Text>
                      </View>
                      <View style={styles.legendRow}>
                        <View
                          style={[
                            styles.legendSwatch,
                            {
                              borderColor: "#94A3B8",
                              backgroundColor: "transparent",
                            },
                          ]}
                        />
                        <Text style={styles.legendText}>
                          {t("route.alternates")}
                        </Text>
                      </View>
                    </View>
                  )}

                  <MapView
                    ref={mapRef}
                    style={styles.map}
                    provider={PROVIDER_DEFAULT}
                    initialRegion={mockRegion}
                    onRegionChangeComplete={(region) =>
                      (regionRef.current = region)
                    }
                    onMapReady={() =>
                      mapRef.current?.animateCamera(
                        { pitch: 0, heading: 0 },
                        { duration: 0 },
                      )
                    }
                  >
                    {/* 🔁 USE filteredProperties instead of mockProperties so UI stays identical */}
                    {filteredProperties.map((prop) => (
                      <Marker key={prop.id} coordinate={prop.coordinates}>
                        {renderPriceMarker(prop.price)}
                      </Marker>
                    ))}

                    {fromCoords && (
                      <Marker
                        coordinate={{
                          latitude: fromCoords.lat,
                          longitude: fromCoords.lon,
                        }}
                        title="From"
                        pinColor="#16A34A"
                      />
                    )}
                    {toCoords && (
                      <Marker
                        coordinate={{
                          latitude: toCoords.lat,
                          longitude: toCoords.lon,
                        }}
                        title="To"
                        pinColor="#DC2626"
                      />
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
                      <Polyline
                        coordinates={bestRoute.coords}
                        strokeWidth={6}
                        strokeColor="#2563EB"
                      />
                    )}
                  </MapView>

                  <View pointerEvents="box-none" style={styles.zoomControls}>
                    <TouchableOpacity
                      style={styles.zoomBtn}
                      onPress={() => adjustZoom(+1)}
                    >
                      <Plus size={18} color="#111827" />
                    </TouchableOpacity>
                    <View style={{ height: 8 }} />
                    <TouchableOpacity
                      style={styles.zoomBtn}
                      onPress={() => adjustZoom(-1)}
                    >
                      <Minus size={18} color="#111827" />
                    </TouchableOpacity>
                  </View>

                  <Animated.View
                    style={[styles.bottomSheet, animatedBottomSheetStyle]}
                  >
                    <GestureDetector gesture={gesture}>
                      <View style={styles.dragHandleContainer}>
                        <View style={styles.dragHandle} />
                      </View>
                    </GestureDetector>
                    <RouteSegmentsGestureList properties={filteredProperties} />
                  </Animated.View>
                </>
              )}
            </View>

            <TouchableOpacity
              style={styles.mapToggleButton}
              onPress={() =>
                setViewMode((prev) => (prev === "list" ? "map" : "list"))
              }
            >
              {viewMode === "list" ? (
                <Map size={22} color="white" />
              ) : (
                <List size={22} color="white" />
              )}
            </TouchableOpacity>

            <FilterPanel
              isVisible={isFilterModalVisible}
              onClose={() => setFilterModalVisible(false)}
              applyFilters={applyFilters}
              clearFilters={clearFilters}
              filteredCount={filteredProperties.length}
              priceRange={priceRange}
              setPriceRange={setPriceRange}
              propertyTypes={propertyTypes}
              setPropertyTypes={setPropertyTypes}
              amenities={amenities}
              setAmenities={setAmenities}
              minRating={minRating}
              setMinRating={setMinRating}
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
  inputLabel: { fontSize: 12, color: "#6B7280", marginLeft: 12 },
  textInputStyle: {
    flex: 1,
    fontSize: 16,
    color: "#111827",
    marginLeft: 8,
    fontWeight: "500",
  },

  inlineRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    height: 52,
    gap: 8,
  },
  inputInline: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    backgroundColor: "white",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 10,
    height: 40,
  },
  inputText: { flex: 1, fontSize: 16, marginLeft: 8, color: "#111827" },
  inputPlaceholderText: { color: "#6B7280", fontSize: 16, marginLeft: 8 },

  // ADDED styles
  radiusContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginTop: 16,
  },
  radiusLabel: { fontSize: 14, color: "#6B7280", marginRight: 8 },
  radiusButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 99,
    backgroundColor: "#F3F4F6",
    marginRight: 8,
  },
  radiusButtonActive: { backgroundColor: "#111827" },
  radiusButtonText: { fontSize: 13, color: "#374151", fontWeight: "500" },
  radiusButtonTextActive: { color: "#FFFFFF" },

  filterBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
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
  filterResultText: { fontSize: 13, color: "#6B7280", marginLeft: 12, flex: 1 },

  contentArea: { flex: 1, position: "relative" },
  listContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 80 },
  listContentBottomSheet: {
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 80,
  },
  flatListInSheet: { flex: 1 },
  segmentContainer: { marginBottom: 16 },
  segmentHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    marginTop: 8,
  },
  segmentLine: { flex: 1, height: 1, backgroundColor: "#E5E7EB" },
  segmentTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111827",
    paddingHorizontal: 12,
    backgroundColor: "#F3F4F6",
    paddingVertical: 4,
    borderRadius: 99,
  },

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

  // Cards
  card: {
    backgroundColor: "white",
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 16,
    height: 200,
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  cardImage: { width: 140, height: "100%" },
  cardDetails: { flex: 1, padding: 14 },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  cardName: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "600",
    color: "#111827",
    flex: 1,
  },
  cardRating: { flexDirection: "row", alignItems: "center", gap: 4 },
  cardRatingText: { fontSize: 14, fontWeight: "500" },
  cardLocation: { fontSize: 13, color: "#4B5563", flex: 1, marginLeft: 4 },
  routeDistanceText: { fontSize: 13, color: "#4B5563", marginTop: 3 },
  cardFeatures: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  cardFeatureTag: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  cardFeatureText: { fontSize: 10, color: "#374151", fontWeight: "500" },
  cardPrice: {
    fontSize: 16,
    paddingVertical: 10,
    fontWeight: "bold",
    color: "#111827",
  },
  cardPriceNight: { fontSize: 12, color: "#6B7080", fontWeight: "normal" },
  cardViewButton: {
    backgroundColor: "#0E1320",
    paddingHorizontal: 16,
    paddingVertical: 10,
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

  // Bottom sheet
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

  // Modals (shared)
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
  modalCloseButton: { position: "absolute", left: 16, top: 16, padding: 4 },
  modalScroll: { flex: 1 },
  modalScrollContent: { padding: 24, paddingBottom: 24 },
  filterSection: {
    marginBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    paddingBottom: 24,
  },
  checkRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
  checkIcon: { marginLeft: 12 },
  checkTextContainer: { marginLeft: 12, flex: 1 },
  checkLabel: { fontSize: 16, marginLeft: 12, color: "#111827" },
  checkDescription: { fontSize: 13, color: "#6B7280" },
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

  // Filter (search-like)
  slider: { width: "100%", height: 40 },
  priceRangeLabels: { flexDirection: "row", justifyContent: "space-between" },
  priceLabel: { fontSize: 14, color: "#6B7280" },

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
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    padding: 16,
    paddingBottom: 24,
    backgroundColor: "white",
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
  datePickerModalFooter: {
    flexDirection: "row",
    padding: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  disabledButton: { backgroundColor: "#D1D5DB" },

  // Guests modal
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

  // Map & overlays
  map: { flex: 1 },
  routeSummaryPill: {
    position: "absolute",
    top: 8,
    right: 16,
    backgroundColor: "white",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    zIndex: 6,
  },
  routeSummaryText: { fontSize: 12, color: "#111827", fontWeight: "600" },
  altLegend: {
    position: "absolute",
    top: 8,
    left: 16,
    backgroundColor: "white",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    zIndex: 6,
  },
  legendRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  legendSwatch: {
    width: 16,
    height: 6,
    borderRadius: 3,
    marginRight: 8,
    borderWidth: 2,
  },
  legendText: { fontSize: 12, color: "#111827" },
  inlineFlexItem: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 0, // critical to allow text truncation in flex rows on iOS
  },
  zoomControls: {
    position: "absolute",
    right: 12,
    top: 50, // raise if your bottom sheet overlaps; tweak as needed
    alignItems: "center",
    zIndex: 10,
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
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  filterTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },

  filterHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  filterBackButton: { width: 40, alignItems: "flex-start" },
  filterHeaderTitle: { fontSize: 18, fontWeight: "600", color: "#111827" },
});
