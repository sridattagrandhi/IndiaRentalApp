import { useTranslation } from "react-i18next";
// app/(host)/listings/index.tsx
import api from "@/services/api";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import {
  Calendar,
  Edit,
  List,
  MapPin,
  Plus,
  Star,
  Trash2,
} from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// Shape expected back from your backend
type Listing = {
  id: string;
  title: string;
  location: string; // "City, State"
  address?: string;
  image?: string;
  images?: string[];
  status: "live" | "paused" | "review" | "draft";
  pricePerNight: number;
  rating?: number;
  reviewCount?: number;
  amenities?: string[];
  buildingLabel?: string;
  buildingKey?: string;
  unitName?: string;
  propertyType?: string; // ✅ hotel, apartment, home, etc.
  roomTypeCount?: number; // ✅ number of hotel room types
};

type BuildingGroup = {
  key: string;
  buildingLabel: string;
  location: string;
  units: Listing[];
};

export default function HostListingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [filter, setFilter] = useState<
    "All" | "Live" | "Paused" | "In Review" | "Draft"
  >("All");
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);

  // Load host listings
  useEffect(() => {
    let alive = true;

    const toArray = (r: any): Listing[] => {
      const src = r?.data ?? r;

      const arr = Array.isArray(src)
        ? src
        : Array.isArray(src?.results)
          ? src.results
          : Array.isArray(src?.items)
            ? src.items
            : Array.isArray(src?.data)
              ? src.data
              : [];

      return arr.map(
        (l: any): Listing => ({
          id: String(l.id ?? l.listing_id ?? l.uuid),

          title: l.title ?? "",
          location:
            l.location ??
            (l.city ? `${l.city}${l.state ? `, ${l.state}` : ""}` : ""),
          address: l.street ?? l.address,

          image: l.photo_url ?? l.image,
          images: l.images ?? l.photos ?? [],

          status: (l.status ?? "live") as Listing["status"],

          pricePerNight: l.pricePerNight ?? l.price ?? 0,
          rating: l.rating ?? 0,
          reviewCount: l.reviewCount ?? l.review_count ?? 0,

          amenities: l.amenities ?? [],

          buildingLabel: l.buildingLabel ?? l.building_label ?? "Property",
          buildingKey: l.buildingKey ?? l.building_key,
          unitName: l.unitName ?? l.unit_name,
          propertyType: (
            l.property_type ??
            l.propertyType ??
            "home"
          ).toLowerCase(),
          roomTypeCount: Array.isArray(l.room_types) ? l.room_types.length : 0,
        }),
      );
    };

    (async () => {
      setLoading(true);
      try {
        // requires auth header via api wrapper
        const res = await api.get<any>("/v1/my/listings");
        if (alive) setListings(toArray(res.data));
      } catch {
        // fallback: public list
        try {
          const res2 = await api.get<any>("/v1/listings");
          if (alive) setListings(toArray(res2.data));
        } catch {
          if (alive) setListings([]);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const groups: BuildingGroup[] = useMemo(() => {
    const byKey: Record<string, BuildingGroup> = {};
    for (const l of listings) {
      const key = l.buildingKey || `misc:${l.location || "Unknown"}`;
      const label = l.buildingLabel || "Property";

      const shortLocation = (() => {
        if (l.address) {
          const parts = String(l.address)
            .split(",")
            .map((p: string) => p.trim())
            .filter(Boolean);
          return (
            parts.slice(0, 2).join(", ") +
            (l.location ? ` • ${l.location}` : "")
          );
        }
        return l.location || "";
      })();

      if (!byKey[key]) {
        byKey[key] = {
          key,
          buildingLabel: label,
          location: shortLocation,
          units: [],
        };
      }
      byKey[key].units.push(l);
    }
    return Object.values(byKey);
  }, [listings]);

  const filteredGroups = useMemo(() => {
    return groups
      .map((g) => ({
        ...g,
        units: g.units.filter((l) => {
          if (filter === "All") return true;
          const f = filter === "In Review" ? "review" : filter.toLowerCase();
          return (l.status || "").toLowerCase() === f;
        }),
      }))
      .filter((g) => g.units.length > 0);
  }, [groups, filter]);

  const handleAddListing = () => router.push("/(host)/listings/create-listing");

  // ✅ Updated to navigate to edit-listing with id
  const handleEditListing = (id: string) => {
    router.push({
      pathname: "/(host)/listings/edit-listing",
      params: { id },
    });
  };

  const handleViewCalendar = (id: string) =>
    router.push({ pathname: "/(host)/calendar", params: { listingId: id } });

  const deleteListing = async (id: string) => {
    try {
      await api.delete(`/v1/listings/${id}`);
      setListings((prev) => prev.filter((l) => l.id !== id));
    } catch (e: any) {
      Alert.alert(
        t("host.host-listing.delete_failed"),
        e?.message ?? t("host.host-listing.could_not_delete_listing"),
      );
    }
  };

  const handleDeleteListing = (listing: Listing) => {
    Alert.alert(
      t("host.edit_listing.delete_listing"),
      `${t("host.host-listing.this_will_permanently_remove")} "${listing.title}". ${t("host.host-listing.you_cant_undo_this")}.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteListing(listing.id),
        },
      ],
    );
  };

  const getStatusStyle = (status?: string) => {
    switch (status) {
      case "live":
        return styles.badgeLive;
      case "paused":
        return styles.badgePaused;
      case "review":
        return styles.badgeReview;
      case "draft":
        return styles.badgeDraft;
      default:
        return styles.badgePaused;
    }
  };
  const getStatusTextStyle = (status?: string) => {
    switch (status) {
      case "live":
        return styles.badgeTextLive;
      case "paused":
        return styles.badgeTextPaused;
      case "review":
        return styles.badgeTextReview;
      case "draft":
        return styles.badgeTextDraft;
      default:
        return styles.badgeTextPaused;
    }
  };
  const getStatusLabel = (status?: string) => {
    switch (status) {
      case "live":
        return "Live";
      case "paused":
        return "Paused";
      case "review":
        return "In Review";
      case "draft":
        return "Draft";
      default:
        return status || "";
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>
            {t("host.host-listing.your_listings")}
          </Text>
          <Text style={styles.headerSubtitle}>
            {groups.length} {groups.length === 1 ? "property" : "properties"} •{" "}
            {listings.length} units
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addButtonHeader}
          onPress={handleAddListing}
        >
          <Plus size={16} color="white" />
          <Text style={styles.addButtonHeaderText}>
            {t("host.host-listing.add_new_listing")}
          </Text>
        </TouchableOpacity>
      </View>

      <View
        style={{
          paddingBottom: 10,
          borderBottomWidth: 1,
          borderBottomColor: "#EEEFF3",
        }}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContainer}
        >
          {(["All", "Live", "Paused", "In Review", "Draft"] as const).map(
            (f) => (
              <TouchableOpacity
                key={f}
                style={[
                  styles.filterChip,
                  filter === f && styles.filterChipActive,
                ]}
                onPress={() => setFilter(f)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    filter === f && styles.filterChipTextActive,
                  ]}
                >
                  {t(`host.host-listing.${f.toLowerCase().replace(" ", "_")}`)}
                </Text>
              </TouchableOpacity>
            ),
          )}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.listContent}>
        {loading ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {t("host.host-listing.loading")}
            </Text>
          </View>
        ) : filteredGroups.length === 0 ? (
          <View style={styles.emptyContainer}>
            <List size={48} color="#D1D5DB" />
            <Text style={styles.emptyText}>
              {t("host.host-listing.no_listings_for")} "{filter}"
            </Text>
          </View>
        ) : (
          filteredGroups.map((g) => (
            <View key={g.key} style={{ marginBottom: 16 }}>
              {/* Group header */}
              <View style={[styles.card, { marginBottom: 8 }]}>
                <View style={{ padding: 12 }}>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "700",
                      color: "#111827",
                    }}
                  >
                    {g.buildingLabel}{" "}
                    <Text style={{ color: "#6B7280", fontWeight: "500" }}>
                      • {g.location}
                    </Text>
                  </Text>
                  <Text style={{ marginTop: 4, color: "#6B7280" }}>
                    {g.units.length} unit{g.units.length > 1 ? "s" : ""}
                  </Text>
                </View>
              </View>

              {/* Units */}
              {g.units.map((listing) => (
                <View key={listing.id} style={styles.card}>
                  <View style={styles.cardContent}>
                    <Image
                      source={{
                        uri:
                          listing.image ||
                          listing.images?.[0] ||
                          "https://source.unsplash.com/400x400/?apartment,interior",
                      }}
                      style={styles.cardImage}
                    />

                    <View style={styles.cardDetails}>
                      <View style={styles.cardTitleRow}>
                        <Text style={styles.cardTitle} numberOfLines={1}>
                          {listing.propertyType === "hotel"
                            ? listing.title
                            : listing.unitName
                              ? `${listing.unitName} • ` + listing.title
                              : listing.title}
                        </Text>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          {listing.propertyType === "hotel" && (
                            <View style={styles.hotelBadge}>
                              <Text style={styles.hotelBadgeText}>Hotel</Text>
                            </View>
                          )}
                          <View
                            style={[
                              styles.statusBadge,
                              getStatusStyle(listing.status),
                            ]}
                          >
                            <Text
                              style={[
                                styles.statusBadgeText,
                                getStatusTextStyle(listing.status),
                              ]}
                            >
                              {getStatusLabel(listing.status)}
                            </Text>
                          </View>
                        </View>
                      </View>

                      <View style={styles.locationRow}>
                        <MapPin size={12} color="#6B7280" />
                        <Text style={styles.cardLocation} numberOfLines={1}>
                          {g.buildingLabel}, {g.location}
                        </Text>
                      </View>

                      <View style={styles.priceRatingRow}>
                        <View>
                          <Text style={styles.cardPrice}>
                            ₹
                            {(listing.pricePerNight || 0).toLocaleString(
                              "en-IN",
                            )}
                          </Text>
                          <Text style={styles.cardPriceSub}>
                            {listing.propertyType === "hotel" &&
                            listing.roomTypeCount
                              ? `${listing.roomTypeCount} room type${listing.roomTypeCount > 1 ? "s" : ""}`
                              : t("listing.per_night")}
                          </Text>
                        </View>
                        {Number(listing.rating) > 0 && (
                          <View style={styles.ratingContainer}>
                            <Star size={14} color="#FBBF24" fill="#FBBF24" />
                            <Text style={styles.ratingText}>
                              {listing.rating}
                            </Text>
                            <Text style={styles.reviewCount}>
                              ({listing.reviewCount})
                            </Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.actionsContainer}>
                        <TouchableOpacity
                          style={styles.actionButton}
                          onPress={() => handleEditListing(listing.id)}
                        >
                          <Edit size={14} color="#374151" />
                          <Text style={styles.actionText}>
                            {t("common.edit")}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.actionButton}
                          onPress={() => handleViewCalendar(listing.id)}
                        >
                          <Calendar size={14} color="#374151" />
                          <Text style={styles.actionText}>
                            {t("host.host-listing.calendar")}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.actionButton,
                            { backgroundColor: "#FEE2E2" },
                          ]}
                          onPress={() => handleDeleteListing(listing)}
                        >
                          <Trash2 size={14} color="#991B1B" />
                          <Text
                            style={[styles.actionText, { color: "#991B1B" }]}
                          >
                            {t("common.delete")}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#EEEFF3",
  },
  headerTitle: { fontSize: 22, fontWeight: "bold" },
  headerSubtitle: { fontSize: 14, color: "#6B7280" },
  addButtonHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  addButtonHeaderText: { color: "white", fontSize: 14, fontWeight: "500" },
  filterContainer: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "white",
  },
  filterChipActive: { backgroundColor: "#111827", borderColor: "#111827" },
  filterChipText: { fontSize: 13, color: "#374151" },
  filterChipTextActive: { color: "white", fontWeight: "600" },
  listContent: { padding: 16, gap: 12 },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    minHeight: 200,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
  },
  card: {
    backgroundColor: "white",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  cardContent: { flexDirection: "row", padding: 12, gap: 12 },
  cardImage: {
    width: 90,
    height: 90,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
  },
  cardDetails: { flex: 1 },
  cardTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  cardTitle: { fontSize: 16, fontWeight: "600", flex: 1, marginRight: 8 },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: "flex-start",
  },
  statusBadgeText: { fontSize: 10, fontWeight: "500" },
  badgeLive: { backgroundColor: "#D1FAE5" },
  badgeTextLive: { color: "#065F46" },
  badgePaused: { backgroundColor: "#E5E7EB" },
  badgeTextPaused: { color: "#4B5563" },
  badgeReview: { backgroundColor: "#DBEAFE" },
  badgeTextReview: { color: "#1E40AF" },
  badgeDraft: { backgroundColor: "#FEF3C7" },
  badgeTextDraft: { color: "#92400E" },
  hotelBadge: {
    backgroundColor: "#EDE9FE",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  hotelBadgeText: { fontSize: 10, fontWeight: "600", color: "#5B21B6" },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 8,
  },
  cardLocation: { fontSize: 13, color: "#6B7280", flex: 1 },
  priceRatingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  cardPrice: { fontSize: 16, fontWeight: "bold" },
  cardPriceSub: { fontSize: 12, color: "#6B7280" },
  ratingContainer: { flexDirection: "row", alignItems: "center", gap: 4 },
  ratingText: { fontSize: 14, fontWeight: "500" },
  reviewCount: { fontSize: 14, color: "#6B7280" },
  actionsContainer: {
    flexDirection: "row",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    paddingTop: 10,
    marginTop: 4,
    flexWrap: "wrap",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: "#F3F4F6",
  },
  actionText: { fontSize: 12, color: "#374151", fontWeight: "500" },
});
