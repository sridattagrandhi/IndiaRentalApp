import { useTranslation } from "react-i18next";
// app/listing/[id].tsx
import { ThemedView } from "@/components/themed-view";
import { apiGet, apiPost } from "@/services/api";
import { format, parseISO } from "date-fns";
import { Image } from "expo-image";
import {
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import * as SecureStore from "expo-secure-store";
import { StatusBar } from "expo-status-bar";
import {
  ArrowLeft,
  BadgeCheck,
  Bath,
  Bed,
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
  Users,
  Utensils,
  Wifi,
  Wind,
  X,
} from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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
} from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT, Region } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  hi: "Hindi",
  te: "Telugu",
  ta: "Tamil",
  kn: "Kannada",
  ml: "Malayalam",
  mr: "Marathi",
  gu: "Gujarati",
  bn: "Bengali",
  pa: "Punjabi",
  ur: "Urdu",
};

function getLanguageName(code: string): string {
  return LANGUAGE_NAMES[code] || code.toUpperCase();
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const testLanguageHeader = async () => {
  await SecureStore.setItemAsync("preferred_language", "hi");

  try {
    const listing = await apiGet("/v1/listings/1");
    console.log("📦 Response:", {
      title: listing.title,
      lang: listing.lang,
      translated: listing.translated,
    });
  } catch (e) {
    console.error("Test failed:", e);
  }
};

type Wishlist = {
  id: string;
  name: string;
  description?: string;
  count: number;
  coverImage?: string;
};

type BackendListing = {
  id: number;
  title: string;
  street?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  price: number;
  rating: number;
  location?: string | null;
  review_count?: number | null;
  max_guests?: number | null;
  description?: string | null;
  status?: "live" | "paused" | "review" | "draft" | null;
  amenities?: string[] | null;
  photo_url?: string | null;
  images?: string[] | null;
  rules?: string[] | null;
  offers?: string[] | null;
  building_label?: string | null;
  building_key?: string | null;
  unit_name?: string | null;
  check_in_time?: string | null;
  check_out_time?: string | null;
  latitude: number;
  longitude: number;
  bedrooms?: number | null;
  bathrooms?: number | null;
  beds?: number | null;
  host?: {
    name?: string | null;
    image?: string | null;
    languages?: string[] | null;
    responseTime?: string | null;
    responseRate?: string | null;
    verified?: boolean | null;
  } | null;
  source_language?: string | null; // Original language listing was written in
  lang?: string | null; // Language user is currently viewing in
  translated?: boolean | null;
  property_type?: string | null;
  room_types?: Array<{
    id: number;
    name: string;
    floor?: number | null;
    description?: string | null;
    quantity: number;
    price?: number | null;
    max_guests: number;
    bedrooms?: number | null;
    bathrooms?: number | null;
    beds?: number | null;
    amenities?: string[] | null;
  }> | null;
};

type AvailabilityDay = {
  date: string;
  status: "available" | "blocked" | "booked";
  price: number;
};

type AvailabilityByDate = Record<string, AvailabilityDay>;

type ListingReviewApi = {
  id: string | number;
  listing_id: number;
  booking_id: number;
  rating: number;
  comment?: string | null;
  created_at?: string;
  guest?: { id: string | number; name?: string | null; email?: string | null };
};

type ListingReviewsResponse = {
  count: number;
  reviews: ListingReviewApi[];
};

type ListingReview = {
  id: string;
  author: string;
  rating: number;
  comment: string;
  date: string;
};

type UserProfile = {
  user_id: string;
  name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
};

// Helper to format full address
function formatAddress(listing: {
  street?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  location?: string | null;
}): string {
  const parts: string[] = [];

  if (listing.street) parts.push(listing.street);
  if (listing.city) parts.push(listing.city);
  if (listing.state) parts.push(listing.state);
  if (listing.pincode) parts.push(listing.pincode);

  if (parts.length > 0) {
    return parts.join(", ");
  }

  return listing.location || "Location not available";
}

// Helper to format short location (city, state)
function formatShortLocation(listing: {
  city?: string | null;
  state?: string | null;
  location?: string | null;
}): string {
  const parts: string[] = [];

  if (listing.city) parts.push(listing.city);
  if (listing.state) parts.push(listing.state);

  if (parts.length > 0) {
    return parts.join(", ");
  }

  return listing.location || "Location not available";
}

const AMENITY_ICON_MAP: Record<string, any> = {
  wifi: Wifi,
  "wi-fi": Wifi,
  "wi fi": Wifi,
  internet: Wifi,
  ac: Wind,
  "air conditioning": Wind,
  parking: ParkingCircle,
  tv: Tv,
  kitchen: Utensils,
  coffee: Coffee,
  "late check-in": Clock,
  security: Shield,
};

const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const addMonths = (d: Date, m: number) =>
  new Date(d.getFullYear(), d.getMonth() + m, 1);

interface DatePickerModalProps {
  isVisible: boolean;
  onClose: () => void;
  checkIn: string | null;
  checkOut: string | null;
  setCheckIn: (date: string | null) => void;
  setCheckOut: (date: string | null) => void;
  availabilityByDate?: AvailabilityByDate;
  // ✅ When a hotel room type is selected, override calendar prices with this
  roomTypePrice?: number | null;
}

function DatePickerModal({
  isVisible,
  onClose,
  checkIn,
  checkOut,
  setCheckIn,
  setCheckOut,
  availabilityByDate = {},
  roomTypePrice,
}: DatePickerModalProps) {
  const [selectedStartDate, setSelectedStartDate] = useState<string | null>(
    checkIn,
  );
  const [selectedEndDate, setSelectedEndDate] = useState<string | null>(
    checkOut,
  );
  const [selectingPhase, setSelectingPhase] = useState<"start" | "end">(
    checkIn ? "end" : "start",
  );
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    const base = checkIn ? new Date(checkIn) : new Date();
    return startOfMonth(base);
  });

  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const todayDate = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  })();

  const minMonth = startOfMonth(todayDate);
  const maxMonth = addMonths(minMonth, 3);

  useEffect(() => {
    setSelectedStartDate(checkIn);
    setSelectedEndDate(checkOut);
    setSelectingPhase(checkIn ? "end" : "start");
    const base = checkIn ? new Date(checkIn) : new Date();
    setCurrentMonth(startOfMonth(base));
  }, [isVisible, checkIn, checkOut]);

  const handleDayPress = (iso: string) => {
    const info = availabilityByDate[iso];
    if (info && info.status !== "available") return;

    const d = new Date(iso);
    d.setHours(0, 0, 0, 0);
    if (d < todayDate) return;

    if (
      selectingPhase === "start" ||
      (selectedStartDate && selectedEndDate && iso < selectedStartDate)
    ) {
      setSelectedStartDate(iso);
      setSelectedEndDate(null);
      setSelectingPhase("end");
    } else if (selectedStartDate && iso >= selectedStartDate) {
      setSelectedEndDate(iso);
      setSelectingPhase("start");
    } else if (!selectedStartDate) {
      setSelectedStartDate(iso);
      setSelectedEndDate(null);
      setSelectingPhase("end");
    }
  };

  const handleConfirm = () => {
    setCheckIn(selectedStartDate);
    setCheckOut(selectedEndDate);
    onClose();
  };

  const calendarCells = (() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    type Cell = {
      key: string;
      date?: Date;
      iso?: string;
      info?: AvailabilityDay;
    };
    const cells: Cell[] = [];

    for (let i = 0; i < firstDay; i++) {
      cells.push({ key: `pad-${i}` });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const iso = date.toISOString().slice(0, 10);
      const info = availabilityByDate[iso];
      cells.push({ key: iso, date, iso, info });
    }

    return cells;
  })();

  const canGoPrev = currentMonth > minMonth;
  const canGoNext = currentMonth < maxMonth;

  return (
    <Modal
      visible={isVisible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.dpOverlay,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
        ]}
      >
        <View style={styles.dpSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t("listing.select_dates")}</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
              <X size={22} color="#111827" />
            </TouchableOpacity>
          </View>

          <View>
            <View style={styles.monthHeader}>
              <TouchableOpacity
                onPress={() =>
                  canGoPrev && setCurrentMonth(addMonths(currentMonth, -1))
                }
                disabled={!canGoPrev}
                style={styles.monthHeaderNavButton}
              >
                <ChevronLeft
                  size={18}
                  color={canGoPrev ? "#111827" : "#D1D5DB"}
                />
              </TouchableOpacity>
              <Text style={styles.monthHeaderTitle}>
                {format(currentMonth, "MMMM yyyy")}
              </Text>
              <TouchableOpacity
                onPress={() =>
                  canGoNext && setCurrentMonth(addMonths(currentMonth, 1))
                }
                disabled={!canGoNext}
                style={styles.monthHeaderNavButton}
              >
                <ChevronRight
                  size={18}
                  color={canGoNext ? "#111827" : "#D1D5DB"}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.weekdayRow}>
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <Text key={d} style={styles.weekdayLabel}>
                  {d}
                </Text>
              ))}
            </View>

            <View style={styles.monthGrid}>
              {calendarCells.map((cell) => {
                if (!cell.date || !cell.iso) {
                  return <View key={cell.key} style={styles.dayCell} />;
                }

                const iso = cell.iso;
                const info = cell.info;
                const isPast = cell.date < todayDate;
                const isUnavailable =
                  isPast || (info && info.status !== "available");

                const isStart = selectedStartDate === iso;
                const isEnd = selectedEndDate === iso;
                const inRange =
                  selectedStartDate &&
                  selectedEndDate &&
                  iso > selectedStartDate &&
                  iso < selectedEndDate;

                const dayInnerStyles = [
                  styles.dayInner,
                  (isStart || isEnd) && styles.dayInnerSelected,
                  inRange && styles.dayInnerInRange,
                ];

                const dayTextStyles = [
                  styles.dayNumber,
                  isUnavailable && styles.dayNumberDisabled,
                  (isStart || isEnd) && styles.dayNumberSelected,
                ];

                const priceTextStyles = [
                  styles.dayPrice,
                  isUnavailable && styles.dayPriceDisabled,
                ];

                return (
                  <View key={cell.key} style={styles.dayCell}>
                    <TouchableOpacity
                      disabled={isUnavailable}
                      onPress={() => handleDayPress(iso)}
                      activeOpacity={0.85}
                    >
                      <View style={dayInnerStyles}>
                        <Text style={dayTextStyles}>{cell.date.getDate()}</Text>
                      </View>
                    </TouchableOpacity>
                    {/* ✅ Show room type price if selected, else availability price */}
                    {(() => {
                      const displayPrice = roomTypePrice ?? info?.price ?? null;
                      return displayPrice ? (
                        <Text style={priceTextStyles}>
                          ₹
                          {displayPrice.toLocaleString("en-IN", {
                            maximumFractionDigits: 0,
                          })}
                        </Text>
                      ) : (
                        <Text style={priceTextStyles}>{""}</Text>
                      );
                    })()}
                  </View>
                );
              })}
            </View>
          </View>

          <View style={styles.modalFooter}>
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
                (!selectedStartDate || !selectedEndDate) &&
                  styles.disabledButton,
              ]}
              onPress={handleConfirm}
              disabled={!selectedStartDate || !selectedEndDate}
            >
              <Text style={styles.showButtonText}>
                {t("search.confirm_dates")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  const safe = Math.max(0, Math.min(5, rating));
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      {[1, 2, 3, 4, 5].map((star) => {
        const full = safe >= star;
        const half = !full && safe >= star - 0.5;

        return (
          <View
            key={star}
            style={{ width: size, height: size, marginRight: 2 }}
          >
            <Star size={size} color="#D1D5DB" fill="transparent" />
            {full && (
              <View style={{ position: "absolute", left: 0, top: 0 }}>
                <Star size={size} color="#F59E0B" fill="#F59E0B" />
              </View>
            )}
            {!full && half && (
              <View
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: size / 2,
                  height: size,
                  overflow: "hidden",
                }}
              >
                <Star size={size} color="#F59E0B" fill="#F59E0B" />
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

function SourceLanguageBadge({
  sourceLanguage,
  currentLanguage,
}: {
  sourceLanguage?: string | null;
  currentLanguage?: string | null;
}) {
  const { t } = useTranslation();

  // Don't show badge if:
  // 1. No source language
  // 2. Source is English and user is viewing in English
  // 3. User is viewing in the original language
  if (!sourceLanguage) return null;
  if (sourceLanguage === "en" && (!currentLanguage || currentLanguage === "en"))
    return null;
  if (sourceLanguage === currentLanguage) return null;

  return (
    <View style={styles.languageBadge}>
      <Globe size={14} color="#3B82F6" />
      <Text style={styles.languageBadgeText}>
        Originally written in {getLanguageName(sourceLanguage)}
      </Text>
    </View>
  );
}

export default function ListingDetailsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isFavorite, setIsFavorite] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const imageCarouselRef = useRef<FlatList>(null);

  const [checkInDate, setCheckInDate] = useState<string | null>(null);
  const [checkOutDate, setCheckOutDate] = useState<string | null>(null);
  const [guests, setGuests] = useState(2);
  const [isDatePickerVisible, setDatePickerVisible] = useState(false);

  const [wishlists, setWishlists] = useState<Wishlist[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [creatingNew, setCreatingNew] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newListDesc, setNewListDesc] = useState("");

  const { id } = useLocalSearchParams<{ id: string }>();
  const [listingData, setListingData] = useState<BackendListing | null>(null);
  const [availabilityByDate, setAvailabilityByDate] =
    useState<AvailabilityByDate>({});
  const [listingReviews, setListingReviews] = useState<ListingReview[]>([]);
  const [reviewsCount, setReviewsCount] = useState<number>(0);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const maxGuestsAllowed = listingData?.max_guests ?? 20;

  // ✅ Hotel: selected room type drives price and guest cap
  const [selectedRoomTypeId, setSelectedRoomTypeId] = useState<number | null>(
    null,
  );
  const isHotel =
    (listingData?.property_type ?? "").toLowerCase() === "hotel" &&
    Array.isArray(listingData?.room_types) &&
    (listingData?.room_types?.length ?? 0) > 0;
  const selectedRoomType =
    (listingData?.room_types ?? []).find(
      (rt) => rt.id === selectedRoomTypeId,
    ) ?? null;
  const activePrice = selectedRoomType?.price ?? listingData?.price ?? 0;
  const activeMaxGuests = selectedRoomType
    ? selectedRoomType.max_guests
    : maxGuestsAllowed;

  // Fetch user profile
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const profile = await apiGet<UserProfile>("/v1/profile");
        setUserProfile(profile);
      } catch (e) {
        console.log("User not logged in or profile fetch failed");
      }
    };
    fetchProfile();
  }, []);

  // Fetch listing details
  useFocusEffect(
    useCallback(() => {
      if (!id) return;

      let cancelled = false;

      const fetchListingDetails = async () => {
        setLoading(true);
        try {
          const preferred =
            await SecureStore.getItemAsync("preferred_language");
          console.log("🌐 preferred_language in SecureStore:", preferred);
          const data = await apiGet<BackendListing>(`/v1/listings/${id}`);
          if (cancelled) return;

          console.log("🔤 title from API:", data.title);
          console.log("🧾 description from API:", data.description);
          console.log("🌐 lang from API:", (data as any).lang);
          console.log("✅ translated from API:", (data as any).translated);
          console.log("🔤 title from API:", data.title);
          setListingData(data);
        } catch (e) {
          console.error("Failed to load listing", e);
          Alert.alert(t("common.error"), "Could not load listing details");
        } finally {
          if (!cancelled) setLoading(false);
        }
      };

      const loadListingReviews = async () => {
        try {
          const res = await apiGet<ListingReviewsResponse>(
            `/v1/listings/${id}/reviews`,
          );
          if (cancelled) return;

          const mapped: ListingReview[] = (res?.reviews ?? []).map((r) => {
            const author =
              r.guest?.name?.trim() || r.guest?.email?.trim() || "Guest";
            const createdAt = r.created_at
              ? new Date(r.created_at)
              : new Date();
            const dateStr = createdAt.toLocaleDateString("en-IN", {
              month: "short",
              day: "numeric",
              year: "numeric",
            });
            return {
              id: String(r.id),
              author,
              rating: Number(r.rating ?? 0),
              comment: String(r.comment ?? ""),
              date: dateStr,
            };
          });

          setListingReviews(mapped);
          setReviewsCount(Number(res?.count ?? mapped.length));
        } catch (e) {
          console.error("Failed to load listing reviews", e);
        }
      };

      const loadAvailability = async () => {
        try {
          const today = new Date();
          const end = new Date();
          end.setMonth(end.getMonth() + 3);
          const startStr = today.toISOString().slice(0, 10);
          const endStr = end.toISOString().slice(0, 10);

          const res = await apiGet<{ results: AvailabilityDay[] }>(
            `/v1/listings/${id}/availability`,
            { params: { start_date: startStr, end_date: endStr } },
          );

          if (cancelled) return;

          const map: AvailabilityByDate = {};
          (res.results ?? []).forEach((day) => {
            map[day.date] = day;
          });
          setAvailabilityByDate(map);
        } catch (e) {
          console.error("availability error", e);
        }
      };

      // run all
      fetchListingDetails();
      loadListingReviews();
      loadAvailability();

      // cleanup
      return () => {
        cancelled = true;
      };
    }, [id]),
  );

  // Load wishlists
  useEffect(() => {
    if (!id) return;

    (async () => {
      try {
        const res = await apiGet<{
          wishlists: {
            id: number;
            name: string;
            description: string | null;
            count: number;
            cover_image: string | null;
          }[];
        }>("/v1/wishlists");

        const lists: Wishlist[] = res.wishlists.map((w) => ({
          id: String(w.id),
          name: w.name,
          description: w.description ?? "",
          count: w.count ?? 0,
          coverImage: w.cover_image ?? undefined,
        }));

        setWishlists(lists);

        const listingIdNum = Number(id);
        let inAny = false;

        for (const w of res.wishlists) {
          if (inAny) break;
          const detail = await apiGet<{
            wishlist: any;
            items: { id: number }[];
          }>(`/v1/wishlists/${w.id}`);
          if ((detail.items ?? []).some((it) => it.id === listingIdNum)) {
            inAny = true;
          }
        }

        setIsFavorite(inAny);
      } catch (e) {
        console.error("[listing] load wishlists failed", e);
      }
    })();
  }, [id]);

  const saveToWishlist = async (targetListId: string) => {
    try {
      if (!id) return;
      const listingIdNum = Number(id);

      const detail = await apiGet<{ wishlist: any; items: { id: number }[] }>(
        `/v1/wishlists/${targetListId}`,
      );

      const already = (detail.items ?? []).some((it) => it.id === listingIdNum);
      if (already) {
        Alert.alert(
          t("listing.already_saved"),
          t("listing.listing_already_in_wishlist"),
        );
        return;
      }

      await apiPost(`/v1/wishlists/${targetListId}/items`, {
        listing_id: listingIdNum,
      });

      setIsFavorite(true);
      setWishlists((prev) =>
        prev.map((w) =>
          w.id === targetListId ? { ...w, count: w.count + 1 } : w,
        ),
      );

      setPickerVisible(false);
    } catch (e) {
      console.error("[listing] save to wishlist failed", e);
      Alert.alert(t("common.error"), t("listing.could_not_save_to_wishlist"));
    }
  };

  async function createListAndSave() {
    const name = newListName.trim();
    if (!name) {
      Alert.alert(
        t("listing.name_required"),
        t("listing.please_enter_list_name"),
      );
      return;
    }

    try {
      const res = await apiPost<{
        wishlist: {
          id: number;
          name: string;
          description: string | null;
          count: number;
          cover_image: string | null;
        };
      }>("/v1/wishlists", { name, description: newListDesc.trim() || null });

      const w = res.wishlist;
      const newList: Wishlist = {
        id: String(w.id),
        name: w.name,
        description: w.description ?? "",
        count: w.count ?? 0,
        coverImage: w.cover_image ?? undefined,
      };

      setWishlists((prev) => [...prev, newList]);
      setCreatingNew(false);
      setNewListName("");
      setNewListDesc("");

      await saveToWishlist(newList.id);
    } catch (e) {
      console.error("[listing] createListAndSave failed", e);
      Alert.alert(t("common.error"), t("listing.could_not_create_wishlist"));
    }
  }

  const computeStayPricing = () => {
    if (!checkInDate || !checkOutDate || !listingData) {
      return { nights: 0, subtotal: 0, averageNightly: activePrice };
    }
    const start = new Date(checkInDate);
    const end = new Date(checkOutDate);
    let nights = 0,
      subtotal = 0;
    const cursor = new Date(start);
    while (cursor < end) {
      const key = cursor.toISOString().slice(0, 10);
      const info = availabilityByDate[key];
      // Room-type price overrides calendar price for hotels
      const nightly = selectedRoomType?.price ?? info?.price ?? activePrice;
      subtotal += nightly;
      nights += 1;
      cursor.setDate(cursor.getDate() + 1);
    }
    const averageNightly =
      nights > 0 ? Math.round(subtotal / nights) : activePrice;
    return { nights, subtotal, averageNightly };
  };

  const { nights, subtotal, averageNightly } = computeStayPricing();

  const onCarouselViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) setCurrentImageIndex(viewableItems[0].index);
  }).current;

  const scrollCarousel = (direction: "next" | "prev") => {
    if (!listingData) return;
    const len = (listingData.images || []).length;
    const newIndex =
      direction === "next"
        ? (currentImageIndex + 1) % len
        : (currentImageIndex - 1 + len) % len;
    imageCarouselRef.current?.scrollToIndex({
      index: newIndex,
      animated: true,
    });
  };

  const scrollToThumbnail = (i: number) =>
    imageCarouselRef.current?.scrollToIndex({ index: i, animated: true });

  const displayDates = () => {
    if (checkInDate && checkOutDate)
      return `${format(parseISO(checkInDate), "MMM dd")} - ${format(parseISO(checkOutDate), "MMM dd")}`;
    return "Select dates";
  };

  const headerBarHeight = 56;

  if (loading || !listingData) {
    return (
      <ThemedView
        style={[
          styles.container,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <ActivityIndicator size="large" color="#111827" />
      </ThemedView>
    );
  }

  const images =
    listingData.images && listingData.images.length > 0
      ? listingData.images
      : listingData.photo_url
        ? [listingData.photo_url]
        : [
            "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&h=600&fit=crop",
          ];

  const amenities = (listingData.amenities || []).map((raw) => {
    const name = String(raw);
    const key = name.toLowerCase();
    const icon = AMENITY_ICON_MAP[key] ?? Shield;
    return { name, icon };
  });

  const mapRegion: Region = {
    latitude: listingData.latitude,
    longitude: listingData.longitude,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };

  return (
    <ThemedView style={styles.container}>
      <StatusBar style="dark" backgroundColor="#ffffff" />
      <Stack.Screen options={{ headerShown: false }} />

      <View
        style={[
          styles.headerContainer,
          { paddingTop: insets.top, height: insets.top + headerBarHeight },
        ]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.headerIconButton}
          >
            <ArrowLeft size={20} color="#111827" />
          </TouchableOpacity>

          <View style={styles.headerRightRow}>
            <TouchableOpacity
              onPress={() => setPickerVisible(true)}
              style={styles.headerIconButton}
            >
              <Heart
                size={20}
                color="#111827"
                fill={isFavorite ? "#ef4444" : "transparent"}
              />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerIconButton}>
              <Share2 size={18} color="#111827" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={{ height: insets.top + headerBarHeight }} />

        <View style={styles.imageCarouselContainer}>
          <FlatList
            ref={imageCarouselRef}
            data={images}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item, idx) => `${item}-${idx}`}
            renderItem={({ item }) => (
              <Image source={{ uri: item }} style={styles.carouselImage} />
            )}
            onViewableItemsChanged={onCarouselViewableItemsChanged}
            viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
          />

          <View style={styles.imageCounter}>
            <Text style={styles.imageCounterText}>
              {currentImageIndex + 1} / {images.length}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.carouselNav, styles.carouselNavLeft]}
            onPress={() => scrollCarousel("prev")}
          >
            <ChevronLeft size={22} color="#111827" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.carouselNav, styles.carouselNavRight]}
            onPress={() => scrollCarousel("next")}
          >
            <ChevronRight size={22} color="#111827" />
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.thumbnailContainer}
        >
          {images.map((thumb, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => scrollToThumbnail(index)}
            >
              <Image
                source={{ uri: thumb }}
                style={[
                  styles.thumbnail,
                  currentImageIndex === index && styles.thumbnailActive,
                ]}
              />
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.contentArea}>
          <Text style={styles.listingName}>{listingData.title}</Text>

          {/* Property details row */}
          <View style={styles.propertyDetailsRow}>
            {listingData.bedrooms ? (
              <View style={styles.propertyDetail}>
                <Bed size={16} color="#4B5563" />
                <Text style={styles.propertyDetailText}>
                  {listingData.bedrooms} bed
                  {listingData.bedrooms > 1 ? "s" : ""}
                </Text>
              </View>
            ) : null}
            {listingData.bathrooms ? (
              <View style={styles.propertyDetail}>
                <Bath size={16} color="#4B5563" />
                <Text style={styles.propertyDetailText}>
                  {listingData.bathrooms} bath
                  {listingData.bathrooms > 1 ? "s" : ""}
                </Text>
              </View>
            ) : null}
            {listingData.max_guests ? (
              <View style={styles.propertyDetail}>
                <Users size={16} color="#4B5563" />
                <Text style={styles.propertyDetailText}>
                  Up to {listingData.max_guests} guests
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.locationRow}>
            <MapPin size={16} color="#4B5563" />
            <Text style={styles.locationText}>
              {formatShortLocation(listingData)}
            </Text>
          </View>

          <View style={styles.ratingRow}>
            <Star size={16} color="#F59E0B" fill="#F59E0B" />
            <Text style={styles.ratingText}>
              {listingData.rating.toFixed(1)}
            </Text>
            <Text style={styles.reviewCountText}>({reviewsCount} reviews)</Text>
          </View>

          <View style={styles.divider} />

          {listingData.description && (
            <>
              <Text style={styles.sectionTitle}>
                {t("listing.about_this_place")}
              </Text>
              <Text style={styles.descriptionText}>
                {listingData.description}
              </Text>
              <View style={styles.divider} />
            </>
          )}

          {/* ─── Hotel room type selector ─────────────────────────── */}
          {isHotel && (
            <>
              <Text style={styles.sectionTitle}>
                {t("listing.room_types") || "Choose a Room"}
              </Text>
              <Text style={styles.roomTypeSubtitle}>
                Select a room to see its price and availability
              </Text>
              {(listingData.room_types ?? []).map((rt) => {
                const sel = selectedRoomTypeId === rt.id;
                const price = rt.price ?? listingData.price;
                return (
                  <TouchableOpacity
                    key={rt.id}
                    activeOpacity={0.8}
                    onPress={() => {
                      setSelectedRoomTypeId(sel ? null : rt.id);
                      // Cap guests to room max
                      if (!sel) setGuests((g) => Math.min(g, rt.max_guests));
                    }}
                    style={[styles.rtCard, sel && styles.rtCardSelected]}
                  >
                    {/* top row */}
                    <View style={styles.rtTopRow}>
                      <Text style={styles.rtName}>{rt.name}</Text>
                      <View>
                        <Text style={styles.rtPrice}>
                          ₹{price.toLocaleString("en-IN")}
                        </Text>
                        <Text style={styles.rtPriceNight}>/ night</Text>
                      </View>
                    </View>
                    {/* pills */}
                    <View style={styles.rtPills}>
                      {rt.floor != null && (
                        <View style={styles.rtPill}>
                          <Text style={styles.rtPillText}>
                            Floor {rt.floor}
                          </Text>
                        </View>
                      )}
                      <View style={styles.rtPill}>
                        <Users size={11} color="#6B7280" />
                        <Text style={styles.rtPillText}>
                          Up to {rt.max_guests}
                        </Text>
                      </View>
                      {rt.beds != null && (
                        <View style={styles.rtPill}>
                          <Bed size={11} color="#6B7280" />
                          <Text style={styles.rtPillText}>
                            {rt.beds} bed{rt.beds !== 1 ? "s" : ""}
                          </Text>
                        </View>
                      )}
                      {rt.bathrooms != null && (
                        <View style={styles.rtPill}>
                          <Bath size={11} color="#6B7280" />
                          <Text style={styles.rtPillText}>
                            {rt.bathrooms} bath{rt.bathrooms !== 1 ? "s" : ""}
                          </Text>
                        </View>
                      )}
                      <View style={styles.rtPill}>
                        <Text style={styles.rtPillText}>
                          {rt.quantity} avail.
                        </Text>
                      </View>
                    </View>
                    {rt.description ? (
                      <Text style={styles.rtDesc}>{rt.description}</Text>
                    ) : null}
                    {/* amenities mini-list */}
                    {rt.amenities && rt.amenities.length > 0 && (
                      <View style={[styles.rtPills, { marginTop: 6 }]}>
                        {rt.amenities.slice(0, 4).map((a) => (
                          <View
                            key={a}
                            style={[
                              styles.rtPill,
                              {
                                backgroundColor: "#F0FDF4",
                                borderColor: "#BBF7D0",
                              },
                            ]}
                          >
                            <Text
                              style={[styles.rtPillText, { color: "#15803D" }]}
                            >
                              {a}
                            </Text>
                          </View>
                        ))}
                        {rt.amenities.length > 4 && (
                          <Text
                            style={{
                              fontSize: 11,
                              color: "#6B7280",
                              alignSelf: "center",
                            }}
                          >
                            +{rt.amenities.length - 4} more
                          </Text>
                        )}
                      </View>
                    )}
                    {sel && (
                      <View style={styles.rtSelectedBadge}>
                        <CheckCircle2 size={13} color="#fff" />
                        <Text style={styles.rtSelectedBadgeText}>Selected</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
              <View style={styles.divider} />
            </>
          )}
          {/* ─────────────────────────────────────────────────────── */}

          <View style={styles.card}>
            {/* Price row — reflects selected room type */}
            <View style={styles.priceRow}>
              <Text style={styles.priceText}>
                ₹{activePrice.toLocaleString("en-IN")}
              </Text>
              <Text style={styles.priceNight}>{t("listing.night_short")}</Text>
              {selectedRoomType && (
                <View style={styles.rtActivePill}>
                  <Text style={styles.rtActivePillText}>
                    {selectedRoomType.name}
                  </Text>
                </View>
              )}
            </View>

            {/* Hotel with room types but none selected → nudge */}
            {isHotel && !selectedRoomTypeId && (
              <View style={styles.rtNudge}>
                <Text style={styles.rtNudgeText}>
                  👆 Select a room type above to see its price
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setDatePickerVisible(true)}
            >
              <CalendarIcon size={20} color="#374151" />
              <Text
                style={[
                  styles.dateButtonText,
                  !checkInDate && { color: "#6B7280" },
                ]}
              >
                {displayDates()}
              </Text>
            </TouchableOpacity>

            <View style={styles.guestRow}>
              <View>
                <Text style={styles.guestLabel}>{t("listing.guests")}</Text>
                {selectedRoomType && (
                  <Text
                    style={{ fontSize: 11, color: "#6B7280", marginTop: 1 }}
                  >
                    Max {selectedRoomType.max_guests} for this room
                  </Text>
                )}
              </View>
              <View style={styles.guestControl}>
                <TouchableOpacity
                  style={[
                    styles.guestButton,
                    guests <= 1 && styles.guestButtonDisabled,
                  ]}
                  onPress={() => setGuests((g) => Math.max(1, g - 1))}
                  disabled={guests <= 1}
                >
                  <Minus
                    size={20}
                    color={guests <= 1 ? "#9CA3AF" : "#111827"}
                  />
                </TouchableOpacity>
                <Text style={styles.guestCount}>{guests}</Text>
                <TouchableOpacity
                  style={[
                    styles.guestButton,
                    guests >= activeMaxGuests && styles.guestButtonDisabled,
                  ]}
                  onPress={() =>
                    setGuests((g) => Math.min(activeMaxGuests, g + 1))
                  }
                  disabled={guests >= activeMaxGuests}
                >
                  <Plus
                    size={20}
                    color={guests >= activeMaxGuests ? "#9CA3AF" : "#111827"}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {checkInDate && checkOutDate && (
              <View style={styles.pricingBreakdown}>
                <View style={styles.pricingRow}>
                  <Text style={styles.pricingLabel}>
                    ₹{averageNightly.toLocaleString("en-IN")} × {nights} night
                    {nights > 1 ? "s" : ""}
                  </Text>
                  <Text style={styles.pricingValue}>
                    ₹{subtotal.toLocaleString("en-IN")}
                  </Text>
                </View>
                <View style={styles.pricingDivider} />
                <View style={styles.pricingRow}>
                  <Text style={styles.pricingTotal}>{t("listing.total")}</Text>
                  <Text style={styles.pricingTotal}>
                    ₹{subtotal.toLocaleString("en-IN")}
                  </Text>
                </View>
              </View>
            )}
          </View>

          <View style={styles.divider} />

          {listingData.offers && listingData.offers.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>
                {t("listing.what_this_place_offers")}
              </Text>
              <View style={styles.highlightsContainer}>
                {listingData.offers.map((item, index) => (
                  <View key={index} style={styles.highlightItem}>
                    <CheckCircle2 size={20} color="#10B981" />
                    <Text style={styles.highlightText}>{item}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.divider} />
            </>
          )}

          {amenities.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>{t("listing.amenities")}</Text>
              <View style={styles.amenitiesContainer}>
                {amenities.map((item, index) => (
                  <View key={index} style={styles.amenityItem}>
                    <item.icon size={24} color="#374151" />
                    <Text style={styles.amenityText}>{item.name}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.divider} />
            </>
          )}

          <Text style={styles.sectionTitle}>
            {t("listing.check_in_details")}
          </Text>
          <View style={styles.checkInCard}>
            {listingData.check_in_time && (
              <View style={styles.checkInRow}>
                <Clock size={20} color="#4B5563" />
                <View style={styles.checkInTextContainer}>
                  <Text style={styles.checkInLabel}>
                    {t("listing.check_in")}
                  </Text>
                  <Text style={styles.checkInValue}>
                    {listingData.check_in_time}
                  </Text>
                </View>
              </View>
            )}

            {listingData.check_out_time && (
              <View style={styles.checkInRow}>
                <Clock size={20} color="#4B5563" />
                <View style={styles.checkInTextContainer}>
                  <Text style={styles.checkInLabel}>
                    {t("listing.check_out")}
                  </Text>
                  <Text style={styles.checkInValue}>
                    {listingData.check_out_time}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {listingData.rules && listingData.rules.length > 0 && (
            <View style={styles.rulesSection}>
              <Text style={styles.rulesTitle}>House rules</Text>
              {listingData.rules.map((rule, index) => (
                <Text key={index} style={styles.ruleList}>
                  • {rule}
                </Text>
              ))}
            </View>
          )}

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>{t("listing.location")}</Text>
          <Text style={styles.fullAddress}>{formatAddress(listingData)}</Text>
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
              <Marker
                coordinate={{
                  latitude: listingData.latitude,
                  longitude: listingData.longitude,
                }}
              />
            </MapView>
          </View>

          <View style={styles.divider} />

          {listingData.host && (
            <>
              <Text style={styles.sectionTitle}>
                {t("listing.meet_your_host")}
              </Text>
              <View style={styles.hostCard}>
                <View style={styles.hostHeader}>
                  <Image
                    source={{
                      uri:
                        listingData.host.image ||
                        "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop",
                    }}
                    style={styles.hostAvatar}
                  />
                  <View style={styles.hostInfo}>
                    <View style={styles.hostNameRow}>
                      <Text style={styles.hostName}>
                        {listingData.host.name || "Host"}
                      </Text>
                      {listingData.host.verified && (
                        <BadgeCheck size={18} color="#0EA5E9" fill="#E0F2FE" />
                      )}
                    </View>
                    {listingData.host.languages &&
                      listingData.host.languages.length > 0 && (
                        <View style={styles.hostDetailRow}>
                          <Globe size={14} color="#6B7280" />
                          <Text style={styles.hostDetailText}>
                            {listingData.host.languages.join(", ")}
                          </Text>
                        </View>
                      )}
                    {listingData.host.responseTime && (
                      <Text style={styles.hostDetailText}>
                        Response time: {listingData.host.responseTime}
                      </Text>
                    )}
                    {listingData.host.responseRate && (
                      <Text style={styles.hostDetailText}>
                        Response rate: {listingData.host.responseRate}
                      </Text>
                    )}
                  </View>
                </View>
                <TouchableOpacity style={styles.hostMessageButton}>
                  <MessageSquare size={18} color="#111827" />
                  <Text style={styles.hostMessageButtonText}>
                    {t("listing.message_host")}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.divider} />
            </>
          )}

          <Text style={styles.sectionTitle}>{t("listing.reviews")}</Text>
          <View style={styles.reviewCardContainer}>
            {listingReviews.slice(0, 3).map((review) => (
              <View key={review.id} style={styles.reviewCard}>
                <View style={styles.reviewAuthorRow}>
                  <View style={styles.reviewAvatar}>
                    <Text style={styles.reviewAvatarLetter}>
                      {review.author.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.reviewAuthor}>{review.author}</Text>
                    <StarRating rating={review.rating} size={14} />
                  </View>
                  <Text style={styles.reviewDate}>{review.date}</Text>
                </View>
                <Text style={styles.reviewComment}>{review.comment}</Text>
              </View>
            ))}

            {listingReviews.length === 0 && (
              <View style={styles.emptyReviewCard}>
                <Text style={styles.emptyReviewText}>
                  {t("listing.no_reviews_first")}
                </Text>
              </View>
            )}
          </View>

          {reviewsCount > 0 && (
            <TouchableOpacity
              style={styles.showAllButton}
              onPress={() => {
                router.push({
                  pathname: "/listing/[id]/reviews",
                  params: { id: String(id), listingName: listingData.title },
                });
              }}
            >
              <Text style={styles.showAllButtonText}>
                {reviewsCount > 3
                  ? `Show all ${reviewsCount} reviews`
                  : "View reviews"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 10 }]}>
        <View>
          <Text style={styles.footerPrice}>
            ₹{activePrice.toLocaleString("en-IN")}
            <Text style={styles.footerPriceNight}>
              {t("listing.night_short")}
            </Text>
          </Text>
          {selectedRoomType && (
            <Text style={styles.footerRoomType}>{selectedRoomType.name}</Text>
          )}
        </View>
        <TouchableOpacity
          style={[
            styles.reserveButton,
            (!checkInDate ||
              !checkOutDate ||
              (isHotel && !selectedRoomTypeId)) &&
              styles.disabledButton,
          ]}
          disabled={
            !checkInDate || !checkOutDate || (isHotel && !selectedRoomTypeId)
          }
          onPress={() => {
            if (!checkInDate || !checkOutDate) {
              Alert.alert(
                t("listing.missing_dates"),
                t("listing.please_select_dates_first"),
              );
              return;
            }
            if (isHotel && !selectedRoomTypeId) {
              Alert.alert(
                "Select a Room",
                "Please choose a room type before reserving.",
              );
              return;
            }
            router.push({
              pathname: "/booking",
              params: {
                listingId: listingData.id,
                listingName: listingData.title,
                listingLocation: formatShortLocation(listingData),
                basePrice: activePrice,
                checkIn: checkInDate,
                checkOut: checkOutDate,
                guests: guests,
                lat: listingData.latitude,
                lon: listingData.longitude,
                roomTypeId: selectedRoomTypeId ?? undefined,
                roomTypeName: selectedRoomType?.name ?? undefined,
              },
            });
          }}
        >
          <Text style={styles.reserveButtonText}>{t("listing.reserve")}</Text>
        </TouchableOpacity>
      </View>

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
              <Text style={styles.wlTitle}>{t("listing.add_to_list")}</Text>
              <Text style={styles.wlSubtitle}>
                {t("listing.choose_wishlist")}
              </Text>
            </View>

            {wishlists.map((l) => (
              <TouchableOpacity
                key={l.id}
                onPress={() => saveToWishlist(l.id)}
                style={styles.wlRow}
              >
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={styles.wlRowTitle} numberOfLines={1}>
                    {l.name}
                  </Text>
                  <Text style={styles.wlRowSubtitle}>
                    {l.count ?? 0} {l.count === 1 ? "item" : "items"}
                  </Text>
                </View>
                <Text style={styles.wlRowAction}>{t("listing.add")}</Text>
              </TouchableOpacity>
            ))}

            {!creatingNew ? (
              <TouchableOpacity
                onPress={() => setCreatingNew(true)}
                style={styles.wlCreateBtn}
              >
                <Text style={styles.wlCreateBtnText}>
                  {t("listing.create_new_list")}
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.wlCreateForm}>
                <TextInput
                  placeholder={t("listing.list_name_placeholder")}
                  value={newListName}
                  onChangeText={setNewListName}
                  style={styles.wlInput}
                  maxLength={50}
                />
                <TextInput
                  placeholder={t("listing.description_optional")}
                  value={newListDesc}
                  onChangeText={setNewListDesc}
                  style={[styles.wlInput, { borderColor: "#E5E7EB" }]}
                  maxLength={100}
                />
                <View style={styles.wlFormActions}>
                  <TouchableOpacity
                    onPress={() => {
                      setCreatingNew(false);
                      setNewListName("");
                      setNewListDesc("");
                    }}
                    style={styles.wlSecondaryBtn}
                  >
                    <Text style={styles.wlSecondaryBtnText}>
                      {t("common.cancel")}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={createListAndSave}
                    style={styles.wlPrimaryBtn}
                  >
                    <Text style={styles.wlPrimaryBtnText}>Create & Add</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <DatePickerModal
        isVisible={isDatePickerVisible}
        onClose={() => setDatePickerVisible(false)}
        checkIn={checkInDate}
        checkOut={checkOutDate}
        setCheckIn={setCheckInDate}
        setCheckOut={setCheckOutDate}
        availabilityByDate={availabilityByDate}
        roomTypePrice={selectedRoomType?.price ?? null}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  headerContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    zIndex: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerRow: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerRightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerIconButton: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  imageCarouselContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 0.75,
    backgroundColor: "#F3F4F6",
  },
  carouselImage: { width: SCREEN_WIDTH, height: "100%" },
  imageCounter: {
    position: "absolute",
    bottom: 16,
    right: 16,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  imageCounterText: { color: "white", fontSize: 12, fontWeight: "500" },
  carouselNav: {
    position: "absolute",
    top: "50%",
    marginTop: -18,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  carouselNavLeft: { left: 16 },
  carouselNavRight: { right: 16 },
  thumbnailContainer: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  thumbnail: {
    width: 64,
    height: 64,
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 2,
    borderColor: "transparent",
    opacity: 0.6,
  },
  thumbnailActive: { borderColor: "#111827", opacity: 1 },
  contentArea: { padding: 20 },
  listingName: {
    fontSize: 26,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
  },
  propertyDetailsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 8,
  },
  propertyDetail: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  propertyDetailText: { fontSize: 14, color: "#4B5563", fontWeight: "500" },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 6,
  },
  locationText: { fontSize: 15, color: "#4B5563" },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  ratingText: { fontSize: 15, color: "#111827", fontWeight: "600" },
  reviewCountText: { fontSize: 14, color: "#6B7280" },
  divider: { height: 1, backgroundColor: "#E5E7EB", marginVertical: 24 },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 16,
  },
  descriptionText: { fontSize: 15, color: "#374151", lineHeight: 24 },
  card: {
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  priceRow: { flexDirection: "row", alignItems: "baseline", marginBottom: 16 },
  priceText: { fontSize: 24, fontWeight: "700", color: "#111827" },
  priceNight: { fontSize: 15, color: "#4B5563", marginLeft: 4 },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  dateButtonText: {
    fontSize: 16,
    color: "#111827",
    marginLeft: 12,
    fontWeight: "500",
  },
  guestRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  guestLabel: { fontSize: 16, color: "#111827", fontWeight: "600" },
  guestControl: { flexDirection: "row", alignItems: "center" },
  guestButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "white",
  },
  guestButtonDisabled: { borderColor: "#E5E7EB", opacity: 0.5 },
  guestCount: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginHorizontal: 20,
  },
  pricingBreakdown: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  pricingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  pricingLabel: { fontSize: 15, color: "#4B5563" },
  pricingValue: { fontSize: 15, color: "#111827", fontWeight: "500" },
  pricingDivider: { height: 1, backgroundColor: "#E5E7EB", marginVertical: 12 },
  pricingTotal: { fontSize: 16, fontWeight: "700", color: "#111827" },
  highlightsContainer: { gap: 12 },
  highlightItem: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  highlightText: { fontSize: 15, color: "#374151", flex: 1, lineHeight: 22 },
  amenitiesContainer: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  amenityItem: {
    width: "46%",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  amenityText: { fontSize: 15, color: "#374151" },
  checkInCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 16,
  },
  checkInRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  checkInTextContainer: { flex: 1 },
  checkInLabel: {
    fontSize: 15,
    color: "#111827",
    fontWeight: "600",
    marginBottom: 4,
  },
  checkInValue: { fontSize: 14, color: "#4B5563" },
  rulesSection: { marginTop: 16, gap: 8 },
  rulesTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 8,
  },
  ruleList: { fontSize: 14, color: "#4B5563", marginLeft: 8, lineHeight: 22 },
  fullAddress: { fontSize: 15, color: "#4B5563", marginBottom: 12 },
  locationCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  map: { height: 240, width: "100%" },
  hostCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  hostHeader: { flexDirection: "row", gap: 16, marginBottom: 16 },
  hostAvatar: { width: 64, height: 64, borderRadius: 32 },
  hostInfo: { flex: 1, gap: 6 },
  hostNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  hostName: { fontSize: 18, fontWeight: "700", color: "#111827" },
  hostDetailRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  hostDetailText: { fontSize: 14, color: "#4B5563" },
  hostMessageButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 12,
    paddingVertical: 14,
  },
  hostMessageButtonText: { fontSize: 15, fontWeight: "600", color: "#111827" },
  reviewCardContainer: { gap: 16 },
  reviewCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  reviewAuthorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  reviewAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E5E7EB",
    justifyContent: "center",
    alignItems: "center",
  },
  reviewAvatarLetter: { fontSize: 18, fontWeight: "700", color: "#4B5563" },
  reviewAuthor: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  reviewDate: { fontSize: 13, color: "#6B7280", marginLeft: "auto" },
  reviewComment: { fontSize: 14, color: "#374151", lineHeight: 22 },
  emptyReviewCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  emptyReviewText: { fontSize: 15, color: "#6B7280" },
  showAllButton: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 16,
    backgroundColor: "white",
  },
  showAllButtonText: { fontSize: 15, fontWeight: "600", color: "#111827" },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
    elevation: 8,
  },
  footerPrice: { fontSize: 20, fontWeight: "700", color: "#111827" },
  footerPriceNight: { fontSize: 15, fontWeight: "normal", color: "#4B5563" },
  reserveButton: {
    backgroundColor: "#111827",
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    flex: 0.6,
    alignItems: "center",
  },
  reserveButtonText: { color: "white", fontSize: 16, fontWeight: "700" },
  disabledButton: { backgroundColor: "#D1D5DB", opacity: 0.6 },

  // Modal styles
  dpOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  dpSheet: {
    width: "100%",
    maxWidth: 480,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  modalCloseButton: { position: "absolute", right: 16, top: 16, padding: 4 },
  monthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  monthHeaderTitle: { fontSize: 17, fontWeight: "600", color: "#111827" },
  monthHeaderNavButton: { padding: 8 },
  weekdayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 4,
  },
  weekdayLabel: {
    width: "14.28%",
    textAlign: "center",
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
  },
  monthGrid: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 16,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCell: { width: "14.28%", alignItems: "center", marginVertical: 4 },
  dayInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  dayInnerSelected: { backgroundColor: "#111827" },
  dayInnerInRange: { backgroundColor: "#F3F4F6" },
  dayNumber: { fontSize: 14, color: "#111827" },
  dayNumberDisabled: { color: "#D1D5DB" },
  dayNumberSelected: { color: "#FFFFFF", fontWeight: "600" },
  dayPrice: { fontSize: 10, marginTop: 2, color: "#4B5563" },
  dayPriceDisabled: { color: "#D1D5DB" },
  modalFooter: {
    flexDirection: "row",
    padding: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    gap: 12,
  },
  clearButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
  },
  clearButtonText: { fontSize: 16, fontWeight: "600", color: "#111827" },
  showButton: {
    flex: 2,
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111827",
  },
  showButtonText: { fontSize: 16, fontWeight: "600", color: "white" },

  // Wishlist modal
  wlOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  wlSheet: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: "white",
    borderRadius: 16,
    paddingVertical: 8,
    overflow: "hidden",
  },
  wlHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  wlTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  wlSubtitle: { marginTop: 4, fontSize: 14, color: "#6B7280" },
  wlRow: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  wlRowTitle: { fontSize: 15, fontWeight: "600", color: "#111827" },
  wlRowSubtitle: { fontSize: 13, color: "#6B7280", marginTop: 2 },
  wlRowAction: { fontSize: 14, color: "#111827", fontWeight: "600" },
  wlCreateBtn: { padding: 20, alignItems: "center" },
  wlCreateBtnText: { fontSize: 15, fontWeight: "600", color: "#111827" },
  wlCreateForm: { padding: 20, gap: 12 },
  wlInput: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    backgroundColor: "white",
  },
  wlFormActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 8,
  },
  wlSecondaryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: "#F3F4F6",
    borderRadius: 10,
  },
  wlSecondaryBtnText: { fontWeight: "600", color: "#111827" },
  wlPrimaryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: "#111827",
    borderRadius: 10,
  },
  wlPrimaryBtnText: { fontWeight: "600", color: "white" },
  languageBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#EFF6FF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    marginBottom: 12,
  },
  languageBadgeText: { fontSize: 13, color: "#1E40AF", fontWeight: "500" },
  // ─── Hotel room type card ──────────────────────────────────────
  roomTypeSubtitle: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: -10,
    marginBottom: 14,
  },
  rtCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    padding: 14,
    backgroundColor: "#FAFAFA",
    marginBottom: 10,
  },
  rtCardSelected: {
    borderColor: "#111827",
    backgroundColor: "#F8F8F8",
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  rtTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  rtName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    flex: 1,
    marginRight: 8,
  },
  rtPrice: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
    textAlign: "right",
  },
  rtPriceNight: { fontSize: 12, color: "#6B7280", textAlign: "right" },
  rtPills: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 4 },
  rtPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  rtPillText: { fontSize: 11, color: "#6B7280", fontWeight: "500" },
  rtDesc: { fontSize: 13, color: "#374151", lineHeight: 19, marginTop: 6 },
  rtSelectedBadge: {
    marginTop: 10,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#111827",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  rtSelectedBadgeText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  rtActivePill: {
    marginLeft: 8,
    backgroundColor: "#EDE9FE",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "center",
  },
  rtActivePillText: { fontSize: 12, color: "#5B21B6", fontWeight: "600" },
  rtNudge: {
    backgroundColor: "#FFFBEB",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  rtNudgeText: { fontSize: 13, color: "#92400E" },
  footerRoomType: {
    fontSize: 12,
    color: "#5B21B6",
    fontWeight: "600",
    marginTop: 2,
  },
});
