// app/(tabs)/mytrips.tsx
import { apiDelete, apiGet, apiPost, apiPut } from "@/services/api";
import { differenceInDays, format, isPast } from "date-fns";
import { Image } from "expo-image";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { t } from "i18next";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Edit,
  FolderPlus,
  MapPin,
  MessageCircle,
  Navigation,
  Plus,
  Star,
  Trash2,
  X,
} from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

/** Types **/
interface Trip {
  id: string;
  bookingCode: string;
  listingName: string;
  listingImage: string;
  location: string;
  checkIn: Date;
  checkOut: Date;
  guests: number;
  totalPaid: number;
  status: "upcoming" | "completed" | "cancelled";
  canModify: boolean;
  hostName: string;
  hostPhone: string;
  receiptUrl?: string;
  roomTypeName?: string | null; // ✅ hotel room type
}

interface TripSavedItem {
  id: string;
  name: string;
  location: string;
  price: number;
  rating: number;
  image: string;
  listId: string;
  coordinates?: { latitude: number; longitude: number };
}

interface TripList {
  id: string;
  name: string;
  description: string;
  count: number;
  coverImage?: string;
}

/** Cards (unchanged visuals) **/
function TripCard({
  trip,
  onDownloadReceipt,
  onModifyDates,
  onGetDirections,
  onMessageHost,
  onCancelBooking,
  alreadyReviewed,
  onWriteReview,
}: {
  trip: Trip;
  onDownloadReceipt: () => void;
  onModifyDates: () => void;
  onGetDirections: () => void;
  onMessageHost: () => void;
  onCancelBooking?: () => void;
  alreadyReviewed: boolean;
  onWriteReview: () => void;
}) {
  const daysUntil = differenceInDays(trip.checkIn, new Date());
  const { t, i18n } = useTranslation();
  return (
    <View style={styles.cardContainer}>
      <View style={styles.cardHeader}>
        <Image source={{ uri: trip.listingImage }} style={styles.cardImage} />
        <View style={styles.cardHeaderText}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {trip.listingName}
            </Text>
            {daysUntil >= 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {daysUntil} {daysUntil === 1 ? "day" : "days"}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.locationRow}>
            <MapPin size={14} color="#6B7280" />
            <Text style={styles.cardSubtitle} numberOfLines={1}>
              {trip.location}
            </Text>
          </View>
          {trip.roomTypeName && (
            <View style={styles.roomTypeBadgeRow}>
              <Text style={styles.roomTypeBadgeText}>{trip.roomTypeName}</Text>
            </View>
          )}
          <View style={styles.dateRow}>
            <Calendar size={14} color="#6B7280" />
            <Text style={styles.dateText}>
              {format(trip.checkIn, "MMM dd")} -{" "}
              {format(trip.checkOut, "MMM dd, yyyy")}
            </Text>
          </View>
          <Text style={styles.bookingCodeText}>
            Booking code: {trip.bookingCode}
          </Text>
        </View>
      </View>
      <View style={styles.cardDivider} />
      <View style={styles.cardActions}>
        {trip.canModify && (
          <TouchableOpacity style={styles.actionButton} onPress={onModifyDates}>
            <Edit size={16} color="#4B5563" />
            <Text style={styles.actionText}>Change dates</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.actionButton} onPress={onGetDirections}>
          <Navigation size={16} color="#4B5563" />
          <Text style={styles.actionText}>Directions</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={onMessageHost}>
          <MessageCircle size={16} color="#4B5563" />
          <Text style={styles.actionText}>{t("listing.message_host")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={onDownloadReceipt}
        >
          <Download size={16} color="#4B5563" />
          <Text style={styles.actionText}>Receipt</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function PastTripCard({
  trip,
  onRebook,
  onOpenReview,
  onDownloadReceipt,
  canReview,
}: {
  trip: Trip;
  onRebook: () => void;
  onOpenReview: () => void;
  onDownloadReceipt: () => void;
  canReview: boolean;
}) {
  const isCancelled = trip.status === "cancelled";
  const { t, i18n } = useTranslation();

  return (
    <View style={styles.cardContainer}>
      <View style={styles.cardHeader}>
        <Image source={{ uri: trip.listingImage }} style={styles.cardImage} />
        <View style={styles.cardHeaderText}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {trip.listingName}
            </Text>

            <View
              style={[
                styles.badge,
                isCancelled ? styles.cancelledBadge : styles.completedBadge,
              ]}
            >
              {isCancelled ? (
                <X size={12} color="#DC2626" />
              ) : (
                <CheckCircle2 size={12} color="#16A34A" />
              )}
              <Text
                style={[
                  styles.badgeText,
                  isCancelled
                    ? styles.cancelledBadgeText
                    : styles.completedBadgeText,
                ]}
              >
                {isCancelled ? "Cancelled" : "Completed"}
              </Text>
            </View>
          </View>

          <View style={styles.locationRow}>
            <MapPin size={14} color="#6B7280" />
            <Text style={styles.cardSubtitle} numberOfLines={1}>
              {trip.location}
            </Text>
          </View>
          {trip.roomTypeName && (
            <View style={styles.roomTypeBadgeRow}>
              <Text style={styles.roomTypeBadgeText}>{trip.roomTypeName}</Text>
            </View>
          )}

          <View style={styles.dateRow}>
            <Calendar size={14} color="#6B7280" />
            <Text style={styles.dateText}>
              {format(trip.checkIn, "MMM dd")} -{" "}
              {format(trip.checkOut, "MMM dd, yyyy")}
            </Text>
          </View>

          <Text style={styles.totalPaidText}>
            Total paid: ₹{trip.totalPaid.toLocaleString("en-IN")}
          </Text>
        </View>
      </View>

      <View style={styles.cardDivider} />

      <View style={styles.cardActionsPast}>
        <TouchableOpacity style={styles.actionButton} onPress={onRebook}>
          <Calendar size={16} color="#4B5563" />
          <Text style={styles.actionText}>Rebook</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={onOpenReview}
          disabled={!canReview}
        >
          <Star size={16} color={canReview ? "#4B5563" : "#9CA3AF"} />
          <Text style={[styles.actionText, !canReview && { color: "#9CA3AF" }]}>
            Review
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={onDownloadReceipt}
        >
          <Download size={16} color="#4B5563" />
          <Text style={styles.actionText}>Receipt</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/** My Trips list cards **/
function MyTripsPropertyCard({
  item,
  onRemove,
  onClick,
}: {
  item: TripSavedItem;
  onRemove: () => void;
  onClick: () => void;
}) {
  const imageSource =
    item.image && item.image.startsWith("http")
      ? { uri: item.image }
      : {
          uri: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=400&h=300&fit=crop",
        };
  const { t, i18n } = useTranslation();

  return (
    <TouchableOpacity style={styles.propertyCardContainer} onPress={onClick}>
      <View style={{ position: "relative" }}>
        <Image source={imageSource} style={styles.propertyImage} />
        <TouchableOpacity style={styles.removeButton} onPress={onRemove}>
          <X size={16} color="#DC2626" />
        </TouchableOpacity>
      </View>
      <View style={styles.propertyContent}>
        <View style={styles.propertyHeader}>
          <Text style={styles.propertyName} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={styles.propertyRating}>
            <Star size={14} color="#F59E0B" fill="#F59E0B" />
            <Text style={styles.propertyRatingText}>{item.rating}</Text>
          </View>
        </View>
        <View style={styles.propertyLocationRow}>
          <MapPin size={16} color="#6B7280" />
          <Text style={styles.propertyLocationText} numberOfLines={1}>
            {item.location}
          </Text>
        </View>
        <Text style={styles.propertyPrice}>
          ₹{item.price.toLocaleString("en-IN")}
          <Text style={styles.propertyPriceNight}>
            {t("listing.night_short")}
          </Text>
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function MyTripsListCard({
  list,
  onClick,
  onEdit,
  onDelete,
}: {
  list: TripList;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <TouchableOpacity style={styles.cardContainer} onPress={onClick}>
      <View style={styles.imageContainer}>
        {list.coverImage ? (
          <Image
            source={{ uri: list.coverImage }}
            style={styles.cardImageFull}
          />
        ) : (
          <View style={styles.placeholderImage}>
            <FolderPlus size={48} color="#FECACA" />
          </View>
        )}
        <TouchableOpacity
          style={styles.optionsButton}
          onPress={(e) => {
            e.stopPropagation();
            Alert.alert(t("mybookings.options_for", { name: list.name }), "", [
              { text: t("common.edit"), onPress: onEdit },
              {
                text: t("common.delete"),
                onPress: onDelete,
                style: "destructive",
              },
              { text: t("common.cancel"), style: "cancel" },
            ]);
          }}
        >
          <Trash2 size={18} color="#333" />
        </TouchableOpacity>
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.listcardTitle}>{list.name}</Text>
        {list.description ? (
          <Text style={styles.listcardDescription}>{list.description}</Text>
        ) : null}
        <Text style={styles.listcardCount}>
          {list.count} {list.count === 1 ? "property" : "properties"}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function StarRatingInput({
  value,
  onChange,
  size = 28,
}: {
  value: number; // e.g. 0, 3.5, 5
  onChange: (v: number) => void;
  size?: number;
}) {
  const stars = [1, 2, 3, 4, 5];

  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      {stars.map((i) => {
        const full = value >= i;
        const half = !full && value >= i - 0.5;

        return (
          <Pressable
            key={i}
            onPressIn={(e) => {
              const locationX = e.nativeEvent.locationX ?? 0;
              const halfOrFull = locationX < size / 2 ? i - 0.5 : i;
              onChange(halfOrFull);
            }}
            style={{ width: size, height: size }}
            hitSlop={8}
          >
            {/* pointerEvents="none" so the SVG never steals the touch */}
            <View pointerEvents="none">
              <Star size={size} color="#9CA3AF" />

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
          </Pressable>
        );
      })}
    </View>
  );
}

export default function MyTripsPage() {
  const router = useRouter();
  const { t, i18n } = useTranslation();

  const [activeTab, setActiveTab] = useState<"upcoming" | "past" | "mytrips">(
    "upcoming",
  );

  // backend-only: start empty
  const [trips, setTrips] = useState<Trip[]>([]);

  const upcomingTrips = trips.filter(
    (trip) => trip.status === "upcoming" && !isPast(trip.checkOut),
  );
  const pastTrips = trips.filter(
    (trip) =>
      trip.status === "completed" ||
      trip.status === "cancelled" ||
      isPast(trip.checkOut),
  );

  const [tripLists, setTripLists] = useState<TripList[]>([]);
  const [tripSaved, setTripSaved] = useState<TripSavedItem[]>([]);
  const [selectedList, setSelectedList] = useState<TripList | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newListDescription, setNewListDescription] = useState("");
  const [editingList, setEditingList] = useState<TripList | null>(null);

  const [reviewedBookingIds, setReviewedBookingIds] = useState<Set<string>>(
    new Set(),
  );
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewBookingId, setReviewBookingId] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState<number>(0);
  const [reviewComment, setReviewComment] = useState("");

  useEffect(() => {
    const debugAuth = async () => {
      console.log("=".repeat(80));
      console.log("🔍 FRONTEND DEBUG - Checking Authentication State");
      console.log("=".repeat(80));

      try {
        // Check if user_id is stored
        const userId = await SecureStore.getItemAsync("user_id");
        console.log("✅ user_id stored:", userId);

        // Check if idToken is stored (if you store it)
        const idToken = await SecureStore.getItemAsync("idToken");
        if (idToken) {
          console.log("✅ idToken exists:", idToken.substring(0, 50) + "...");

          // Decode the token to see what claims it has
          try {
            const parts = idToken.split(".");
            if (parts.length === 3) {
              const payload = parts[1];
              // Add padding
              let paddedPayload = payload;
              while (paddedPayload.length % 4 !== 0) {
                paddedPayload += "=";
              }

              // const decoded = JSON.parse(
              //   atob(paddedPayload.replace(/-/g, '+').replace(/_/g, '/'))
              //     .split('')
              //     .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
              //     .join('')
              // );

              // console.log('🔓 Token claims:', Object.keys(decoded));
              // console.log('🔓 sub:', decoded.sub);
              // console.log('🔓 cognito:username:', decoded['cognito:username']);
              // console.log('🔓 email:', decoded.email);
            }
          } catch (e) {
            console.error("❌ Failed to decode token:", e);
          }
        } else {
          console.warn("⚠️ No idToken stored");
        }

        // Check API base URL
        console.log("🌐 API Base URL:", process.env.EXPO_PUBLIC_API_BASE_URL);
      } catch (error) {
        console.error("❌ Debug check failed:", error);
      }

      console.log("=".repeat(80));
    };

    debugAuth();
  }, []);

  const openReview = (bookingId: string) => {
    setReviewBookingId(bookingId);
    setReviewRating(0);
    setReviewComment("");
    setShowReviewModal(true);
  };

  const loadMyReviews = useCallback(async () => {
    try {
      const res = await apiGet<any>("/v1/reviews/mine");
      const ids = new Set<string>(
        (res?.reviews ?? []).map((r: any) => String(r.booking_id)),
      );
      setReviewedBookingIds(ids);
    } catch (e) {
      console.error("Failed to load my reviews", e);
      setReviewedBookingIds(new Set());
    }
  }, []);

  const submitReview = async () => {
    if (!reviewBookingId) return;

    if (reviewRating < 1) {
      Alert.alert(
        t("mybookings.rating_required"),
        t("mybookings.please_select_a_star_rating"),
      );
      return;
    }

    // enforce 0.5 step
    const rounded = Math.round(reviewRating * 2) / 2;

    try {
      await apiPost("/v1/reviews", {
        booking_id: Number(reviewBookingId),
        rating: rounded,
        comment: reviewComment.trim() || null,
      });

      setShowReviewModal(false);

      // refresh review ids + bookings (booking cards update automatically)
      await loadMyReviews();
      await loadBookings();

      Alert.alert(
        t("common.thank_you"),
        t("mybookings.your_review_has_been_posted"),
      );
    } catch (e: any) {
      console.error(e);
      Alert.alert(
        t("common.error"),
        e?.response?.data?.detail || t("mybookings.failed_to_post_review"),
      );
    }
  };

  const loadBookings = useCallback(async () => {
    try {
      const data = await apiGet<{ bookings: any[] }>("/v1/bookings");

      const mapped: Trip[] = (data.bookings || []).map((b) => ({
        id: String(b.booking_id ?? b.id),
        bookingCode: b.booking_code ?? "",
        listingName: b.listing_name ?? "",
        listingImage:
          b.listing_image ||
          "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=200&h=200&fit=crop",
        location: b.listing_location || "",
        checkIn: new Date(b.check_in),
        checkOut: new Date(b.check_out),
        guests: Number(b.guests ?? 1),
        totalPaid: Number(b.total_paid ?? 0),
        status:
          b.status === "confirmed"
            ? "upcoming"
            : b.status === "completed"
              ? "completed"
              : b.status === "cancelled"
                ? "cancelled"
                : "upcoming",
        canModify: b.status === "pending" || b.status === "confirmed",
        hostName: b.host_name ?? "Host",
        hostPhone: b.host_phone ?? "",
        roomTypeName: b.room_type_name ?? null,
      }));

      setTrips(mapped);
    } catch (err) {
      console.error(t("mybookings.failed_to_load_bookings"), err);
    }
  }, []);

  const loadTripLists = useCallback(async () => {
    try {
      const res = await apiGet<any>("/v1/trip-lists");
      const raw = (res?.trip_lists ??
        res?.tripLists ??
        res?.lists ??
        []) as any[];

      const mapped: TripList[] = raw.map((l) => ({
        id: String(l.id ?? l.trip_list_id ?? ""),
        name: l.name ?? "",
        description: l.description ?? "",
        count: Number(l.count ?? l.items_count ?? 0),
        coverImage: l.cover_image ?? l.coverImage ?? undefined,
      }));

      setTripLists(mapped);
    } catch (e: any) {
      console.error(
        t("mybookings.failed_to_load_trip_lists"),
        e?.response?.data || e,
      );
      setTripLists([]);
    }
  }, []);

  const loadTripListItems = useCallback(async (tripListId: string) => {
    try {
      // If your backend uses a different shape, adjust this response mapping only.
      const res = await apiGet<any>(`/v1/trip-lists/${tripListId}`);
      const items = (res?.items ??
        res?.trip_list?.items ??
        res?.tripList?.items ??
        []) as any[];

      const mapped: TripSavedItem[] = items.map((it) => {
        // ✅ Support nested shape: { id, listing: { id, title, city, price_per_night, avg_rating, cover_photo_url } }
        const l = it.listing ?? it.property ?? it.listing_detail ?? null;

        const listingId = l?.id ?? it.listing_id ?? it.id ?? it.item_id ?? "";

        const title =
          l?.title ?? l?.name ?? it.title ?? it.name ?? it.listing_name ?? "";

        const street =
          l?.street ??
          l?.address ??
          l?.formatted_address ??
          it.street ??
          it.address ??
          null;
        const city = l?.city ?? it.city ?? null;

        const location =
          l?.street ||
          it.street ||
          l?.city ||
          it.city ||
          l?.location ||
          it.location ||
          "—";

        const price =
          l?.price_per_night ??
          l?.nightly_price ??
          it.price ??
          it.nightly_price ??
          0;

        const rating =
          l?.avg_rating ?? l?.rating ?? it.avg_rating ?? it.rating ?? 0;

        const image =
          l?.cover_photo_url ??
          l?.photo_url ??
          l?.image ??
          it.photo_url ??
          it.cover_photo_url ??
          it.image ??
          it.listing_image ??
          "";

        return {
          id: String(listingId),
          name: String(title),
          location: String(location),
          price: Number(price) || 0,
          rating: Number(rating) || 0,
          image: String(image || ""),
          listId: String(tripListId),
          coordinates: it.coordinates ?? it.coords ?? undefined,
        };
      });

      setTripSaved(mapped);
    } catch (e) {
      console.error("Failed to load trip list items", e);
      setTripSaved([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      // Always load backend state on focus
      loadBookings();
      loadTripLists();
      loadMyReviews();

      // if a list is open, refresh its items too
      if (selectedList?.id) {
        loadTripListItems(selectedList.id);
      }
    }, [
      loadBookings,
      loadTripLists,
      loadTripListItems,
      selectedList?.id,
      i18n.language,
    ]),
  );

  const getListItems = (listId: string) =>
    tripSaved.filter((p) => p.listId === listId);

  const resetModals = () => {
    setNewListName("");
    setNewListDescription("");
    setEditingList(null);
    setShowCreateModal(false);
    setShowEditModal(false);
  };

  const openEditModal = (list: TripList) => {
    setEditingList(list);
    setNewListName(list.name);
    setNewListDescription(list.description);
    setShowEditModal(true);
  };

  const handleCreateList = async () => {
    if (!newListName.trim()) {
      Alert.alert(t("common.error"), "Please enter a list name");
      return;
    }
    try {
      await apiPost("/v1/trip-lists", {
        name: newListName.trim(),
        description: newListDescription.trim(),
      });
      resetModals();
      await loadTripLists();
      Alert.alert(t("common.success"), "List created!");
    } catch (e: any) {
      console.error(e);
      Alert.alert(
        t("common.error"),
        e?.response?.data?.error || "Failed to create list",
      );
    }
  };

  const handleEditList = async () => {
    if (!editingList || !newListName.trim()) {
      Alert.alert(t("common.error"), t("mybookings.please_enter_a_list_name"));
      return;
    }
    try {
      await apiPut(`/v1/trip-lists/${editingList.id}`, {
        name: newListName.trim(),
        description: newListDescription.trim(),
      });
      resetModals();
      await loadTripLists();
      if (selectedList?.id === editingList.id) {
        setSelectedList((prev) =>
          prev
            ? {
                ...prev,
                name: newListName.trim(),
                description: newListDescription.trim(),
              }
            : prev,
        );
      }
      Alert.alert(t("common.success"), t("mybookings.list_updated"));
    } catch (e: any) {
      console.error(e);
      Alert.alert(
        t("common.error"),
        e?.response?.data?.error || t("mybookings.failed_to_update_list"),
      );
    }
  };

  const handleDeleteList = (listId: string) => {
    Alert.alert(t("mybookings.delete_list"), t("mybookings.delete_this_list"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: async () => {
          try {
            await apiDelete(`/v1/trip-lists/${listId}`);
            setSelectedList(null);
            setTripSaved([]);
            await loadTripLists();
            Alert.alert(t("common.success"), t("mybookings.list_deleted"));
          } catch (e: any) {
            console.error(e);
            Alert.alert(
              t("common.error"),
              e?.response?.data?.error || t("mybookings.failed_to_delete_list"),
            );
          }
        },
      },
    ]);
  };

  const handleRemoveItem = async (listingId: string) => {
    if (!selectedList) return;
    try {
      await apiDelete(`/v1/trip-lists/${selectedList.id}/items/${listingId}`);
      await loadTripListItems(selectedList.id);
      await loadTripLists(); // refresh counts
      Alert.alert(t("common.success"), "Removed from list.");
    } catch (e: any) {
      console.error(e);
      Alert.alert(
        t("common.error"),
        e?.response?.data?.error || "Failed to remove item",
      );
    }
  };

  const selectedCount = useMemo(
    () => (selectedList ? getListItems(selectedList.id).length : 0),
    [selectedList, tripSaved],
  );

  const handleCancelBooking = (bookingId: string) => {
    Alert.alert(
      "Cancel booking?",
      "Are you sure you want to cancel this booking?",
      [
        { text: "Keep booking", style: "cancel" },
        {
          text: "Cancel booking",
          style: "destructive",
          onPress: async () => {
            try {
              await apiDelete(`/v1/bookings/${bookingId}`);
              await loadBookings();
              Alert.alert("Cancelled", "Your booking has been cancelled.");
            } catch (err) {
              console.error("Failed to cancel booking", err);
              Alert.alert(
                t("common.error"),
                "Failed to cancel booking. Please try again.",
              );
            }
          },
        },
      ],
    );
  };

  // Key fix in mytrips.tsx - replace the openBookingChat function

  const openBookingChat = async (bookingId: string) => {
    try {
      // Log what we're sending
      const userId = await SecureStore.getItemAsync("user_id");
      const openRes = await apiPost(`/v1/chats/${bookingId}/open`);
      router.push(`/chats/${bookingId}`);
    } catch (e: any) {
      const errorMsg =
        e?.response?.data?.detail || e?.message || "Could not open chat";
      Alert.alert("Chat Error", errorMsg);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: selectedList ? undefined : t("mybookings.title"),
          headerLargeTitle: !selectedList,
          headerTitleAlign: selectedList ? "left" : "center",

          headerTitle: selectedList
            ? () => (
                <View>
                  <Text style={styles.headerTitleText} numberOfLines={1}>
                    {selectedList?.name || "My Trips"}
                  </Text>
                  <Text style={styles.headerSubtitleText}>
                    {selectedCount} {selectedCount === 1 ? "item" : "items"}
                  </Text>
                </View>
              )
            : undefined,
          headerLeft: selectedList
            ? () => (
                <TouchableOpacity
                  onPress={() => {
                    setSelectedList(null);
                    setTripSaved([]);
                  }}
                  style={{ paddingHorizontal: 12, paddingVertical: 8 }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <ArrowLeft size={22} color="#111827" />
                </TouchableOpacity>
              )
            : undefined,
          headerRight: selectedList
            ? () => (
                <View
                  style={{ flexDirection: "row", gap: 12, paddingRight: 8 }}
                >
                  <TouchableOpacity
                    onPress={() => openEditModal(selectedList!)}
                  >
                    <Edit size={20} color="#111827" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeleteList(selectedList!.id)}
                  >
                    <Trash2 size={20} color="#DC2626" />
                  </TouchableOpacity>
                </View>
              )
            : undefined,
        }}
      />

      {!selectedList && (
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === "upcoming" && styles.tabButtonActive,
            ]}
            onPress={() => setActiveTab("upcoming")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "upcoming" && styles.tabTextActive,
              ]}
            >
              {t("mybookings.upcoming")} ({upcomingTrips.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === "past" && styles.tabButtonActive,
            ]}
            onPress={() => setActiveTab("past")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "past" && styles.tabTextActive,
              ]}
            >
              {t("mybookings.past")} ({pastTrips.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === "mytrips" && styles.tabButtonActive,
            ]}
            onPress={() => {
              setSelectedList(null);
              setTripSaved([]);
              setActiveTab("mytrips");
            }}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "mytrips" && styles.tabTextActive,
              ]}
            >
              {t("mybookings.my_trips")}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {!selectedList && activeTab !== "mytrips" ? (
        <ScrollView contentContainerStyle={styles.listContent}>
          {activeTab === "upcoming" ? (
            upcomingTrips.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Calendar size={64} color="#E5E7EB" />
                <Text style={styles.emptyTitle}>
                  {t("mybookings.no_upcoming_trips")}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {t("mybookings.time_to_plan_your_next_adventure")}
                </Text>
                <TouchableOpacity
                  style={styles.browseButton}
                  onPress={() => router.push("/(tabs)")}
                >
                  <Text style={styles.browseButtonText}>
                    {t("mybookings.explore_stays")}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              upcomingTrips.map((trip) => (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  onDownloadReceipt={() =>
                    Alert.alert(t("settings.payments.download_receipt_title"))
                  }
                  onModifyDates={() => Alert.alert("Modify Dates")}
                  onGetDirections={() => Alert.alert("Get Directions")}
                  onMessageHost={() => openBookingChat(trip.id)}
                  onCancelBooking={() => handleCancelBooking(trip.id)}
                  alreadyReviewed={reviewedBookingIds.has(trip.id)}
                  onWriteReview={() => openReview(trip.id)}
                />
              ))
            )
          ) : pastTrips.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Clock size={64} color="#E5E7EB" />
              <Text style={styles.emptyTitle}>
                {t("mybookings.no_past_trips")}
              </Text>
              <Text style={styles.emptySubtitle}>
                {t("mybookings.your_completed_trips_will_appear_here")}
              </Text>
            </View>
          ) : (
            pastTrips.map((trip) => {
              const canReview =
                trip.status === "completed" && !reviewedBookingIds.has(trip.id);

              return (
                <PastTripCard
                  key={trip.id}
                  trip={trip}
                  onRebook={() => Alert.alert("Rebook")}
                  onDownloadReceipt={() =>
                    Alert.alert(t("settings.payments.download_receipt_title"))
                  }
                  canReview={canReview}
                  onOpenReview={() => {
                    if (!canReview) return;
                    openReview(trip.id);
                  }}
                />
              );
            })
          )}
        </ScrollView>
      ) : (
        <>
          {selectedList ? (
            <>
              {selectedCount === 0 ? (
                <View style={styles.emptyContainer}>
                  <FolderPlus size={64} color="#E5E7EB" />
                  <Text style={styles.emptyTitle}>
                    {t("mybookings.no_saved_properties")}
                  </Text>
                  <Text style={styles.emptySubtitle}>
                    {t("mybookings.start_saving_properties")}
                  </Text>
                  <TouchableOpacity
                    style={styles.browseButton}
                    onPress={() => router.push("/(tabs)")}
                  >
                    <Text style={styles.browseButtonText}>
                      {t("mybookings.add_listings")}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <FlatList
                  data={getListItems(selectedList.id)}
                  keyExtractor={(i) => i.id}
                  renderItem={({ item }) => (
                    <MyTripsPropertyCard
                      item={item}
                      onRemove={() => handleRemoveItem(item.id)}
                      onClick={() =>
                        router.push({
                          pathname: "/listing/[id]",
                          params: { id: item.id },
                        })
                      }
                    />
                  )}
                  contentContainerStyle={styles.listContent}
                />
              )}

              <Modal
                visible={showEditModal}
                transparent
                animationType="fade"
                onRequestClose={resetModals}
              >
                <TouchableOpacity
                  activeOpacity={1}
                  onPress={resetModals} // ✅ close edit modal on background tap
                  style={styles.modalOverlay}
                >
                  <TouchableOpacity
                    activeOpacity={1}
                    onPress={() => {}}
                    style={styles.modalContent} // ✅ the white card
                  >
                    <Text style={styles.modalTitle}>
                      {t("mybookings.edit_trip_list")}
                    </Text>

                    <TextInput
                      style={styles.input}
                      placeholder={t("listing.list_name_placeholder")} // ✅ was: "List name"
                      value={newListName}
                      onChangeText={setNewListName}
                      maxLength={50}
                    />

                    <TextInput
                      style={styles.input}
                      placeholder={t("listing.description_optional")} // ✅ was: "Description (optional)"
                      value={newListDescription}
                      onChangeText={setNewListDescription}
                      maxLength={100}
                    />

                    <View style={styles.modalActions}>
                      <TouchableOpacity
                        style={styles.modalButtonSecondary}
                        onPress={resetModals}
                      >
                        <Text style={styles.modalButtonTextSecondary}>
                          {t("common.cancel")}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.modalButtonPrimary}
                        onPress={handleEditList}
                      >
                        <Text style={styles.modalButtonTextPrimary}>
                          {t("common.save")}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                </TouchableOpacity>
              </Modal>
            </>
          ) : (
            <>
              <ScrollView contentContainerStyle={styles.listContent}>
                <TouchableOpacity
                  style={[styles.cardContainer, styles.createCard]}
                  onPress={() => setShowCreateModal(true)}
                >
                  <View style={styles.createIconContainer}>
                    <Plus size={24} color="#111827" />
                  </View>
                  <Text style={styles.createTitle}>
                    {t("mybookings.create_new_trip_list")}
                  </Text>
                  <Text style={styles.createSubtitle}>
                    {t("mybookings.organize_future_itineraries")}
                  </Text>
                </TouchableOpacity>

                {tripLists.map((list) => (
                  <MyTripsListCard
                    key={list.id}
                    list={list}
                    onClick={async () => {
                      setSelectedList(list);
                      await loadTripListItems(list.id);
                    }}
                    onEdit={() => openEditModal(list)}
                    onDelete={() => handleDeleteList(list.id)}
                  />
                ))}

                {tripLists.length === 0 && (
                  <View style={styles.emptyContainer}>
                    <FolderPlus size={64} color="#E5E7EB" />
                    <Text style={styles.emptyTitle}>
                      {t("mybookings.no_trips")}
                    </Text>
                    <Text style={styles.emptySubtitle}>
                      {t("mybookings.create_lists_to_plan")}
                    </Text>
                  </View>
                )}
              </ScrollView>

              <Modal
                visible={showCreateModal}
                transparent
                animationType="fade"
                onRequestClose={resetModals}
              >
                <View style={styles.modalOverlay}>
                  <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>
                      {t("mybookings.create_new_trip_list")}
                    </Text>
                    <TextInput
                      style={styles.input}
                      placeholder={t("mybookings.list_name_placeholder")}
                      value={newListName}
                      onChangeText={setNewListName}
                      maxLength={50}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Description (optional)"
                      value={newListDescription}
                      onChangeText={setNewListDescription}
                      maxLength={100}
                    />
                    <View style={styles.modalActions}>
                      <TouchableOpacity
                        style={styles.modalButtonSecondary}
                        onPress={resetModals}
                      >
                        <Text style={styles.modalButtonTextSecondary}>
                          {t("mybookings.cancel")}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.modalButtonPrimary}
                        onPress={handleCreateList}
                      >
                        <Text style={styles.modalButtonTextPrimary}>
                          {t("mybookings.create")}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </Modal>
            </>
          )}
        </>
      )}
      <Modal
        visible={showReviewModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowReviewModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {t("mybookings.write_a_review")}
            </Text>

            <Text
              style={{ marginBottom: 10, color: "#111827", fontWeight: "600" }}
            >
              {t("mybookings.rating")}
            </Text>

            <StarRatingInput value={reviewRating} onChange={setReviewRating} />
            <Text style={{ marginTop: 8, color: "#6B7280" }}>
              {reviewRating ? `${reviewRating} / 5` : "Tap to rate"}
            </Text>

            <Text
              style={{ marginBottom: 6, color: "#111827", fontWeight: "600" }}
            >
              {t("mybookings.comment")}
            </Text>

            <TextInput
              value={reviewComment}
              onChangeText={setReviewComment}
              style={[styles.input, { height: 100, textAlignVertical: "top" }]}
              multiline
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalButtonSecondary}
                onPress={() => setShowReviewModal(false)}
              >
                <Text style={styles.modalButtonTextSecondary}>
                  {t("mybookings.cancel")}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalButtonPrimary}
                onPress={submitReview}
              >
                <Text style={styles.modalButtonTextPrimary}>
                  {t("mybookings.post")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/** Styles **/
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },

  headerTitleText: { fontSize: 18, fontWeight: "bold", color: "#111827" },
  headerSubtitleText: { fontSize: 13, color: "#6B7280", marginTop: 2 },

  tabContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabButtonActive: { borderBottomColor: "#111827" },
  tabText: { fontSize: 16, color: "#6B7280" },
  tabTextActive: { color: "#111827", fontWeight: "bold" },

  listContent: { padding: 16 },

  cardContainer: {
    backgroundColor: "white",
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  cardHeader: { flexDirection: "row", padding: 12 },
  cardImage: { width: 80, height: 80, borderRadius: 8, marginRight: 12 },
  cardHeaderText: { flex: 1 },
  cardTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#111827",
    flexShrink: 1,
    marginRight: 8,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
  },
  cardSubtitle: { fontSize: 13, color: "#6B7280", flexShrink: 1 },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 6,
  },
  dateText: { fontSize: 13, color: "#374151" },
  bookingCodeText: {
    fontSize: 12,
    color: "#6B7280",
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    alignSelf: "flex-start",
  },
  roomTypeBadgeRow: { flexDirection: "row", marginBottom: 4 },
  roomTypeBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#5B21B6",
    backgroundColor: "#EDE9FE",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  totalPaidText: { fontSize: 13, color: "#6B7280", marginTop: 4 },

  badge: {
    backgroundColor: "#E5E7EB",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: { fontSize: 12, fontWeight: "500", color: "#374151" },
  completedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#D1FAE5",
    paddingHorizontal: 6,
  },
  completedBadgeText: { color: "#065F46" },

  createCard: {
    borderWidth: 2,
    borderColor: "#D1D5DB",
    borderStyle: "dashed",
    alignItems: "center",
    paddingVertical: 24,
  },
  createIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  createTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
  },
  createSubtitle: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
  },

  cardDivider: { height: 1, backgroundColor: "#E5E7EB" },
  cardActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 8,
    flexWrap: "wrap",
    rowGap: 8,
  },
  cardActionsPast: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 8,
  },
  actionButton: {
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  actionText: { fontSize: 13, color: "#4B5563", marginTop: 2 },

  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    marginTop: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 16,
  },
  browseButton: {
    backgroundColor: "#111827",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  browseButtonText: { color: "white", fontWeight: "bold" },

  imageContainer: {
    height: 150,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    overflow: "hidden",
  },
  cardImageFull: { width: "100%", height: "100%" },
  placeholderImage: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FEE2E2",
  },
  optionsButton: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  cardContent: { padding: 12 },
  listcardTitle: { fontSize: 16, fontWeight: "bold", marginBottom: 4 },
  listcardDescription: { fontSize: 13, color: "#6B7280", marginBottom: 8 },
  listcardCount: { fontSize: 13, color: "#6B7280" },

  propertyCardContainer: {
    backgroundColor: "white",
    borderRadius: 12,
    marginBottom: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  propertyImage: { width: "100%", height: 200 },
  propertyContent: { padding: 12 },
  propertyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  propertyName: { fontSize: 18, fontWeight: "600", flex: 1, marginRight: 8 },
  propertyRating: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F3F4F6",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  propertyRatingText: { fontSize: 14, color: "#374151", fontWeight: "500" },
  propertyLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  propertyLocationText: { fontSize: 15, color: "#6B7280", flex: 1 },
  propertyPrice: { fontSize: 18, fontWeight: "bold", color: "#111827" },
  propertyPriceNight: { fontSize: 14, color: "#6B7280", fontWeight: "normal" },
  removeButton: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "rgba(255,255,255,0.7)",
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: "center",
    alignItems: "center",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 20,
    width: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 16,
  },
  modalButtonPrimary: {
    backgroundColor: "#111827",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  modalButtonSecondary: {
    backgroundColor: "#F3F4F6",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  modalButtonTextPrimary: { color: "white", fontWeight: "bold" },
  modalButtonTextSecondary: { color: "#111827", fontWeight: "bold" },

  cancelContainer: {
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 8,
    alignItems: "flex-start",
  },
  cancelButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#FEE2E2",
  },
  cancelButtonText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#B91C1C",
  },
  cancelledBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 6,
  },
  cancelledBadgeText: { color: "#991B1B" },
});
