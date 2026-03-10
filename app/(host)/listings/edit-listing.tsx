import { useTranslation } from "react-i18next";
// app/(host)/listings/edit-listing.tsx
import api from "@/services/api";
import { Image } from "expo-image";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  DollarSign,
  Home,
  Image as ImageIcon,
  MapPin,
  Minus,
  Plus,
  Shield,
  Trash2,
  Upload,
  X,
} from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import GalleryPickerModal from "@/components/GalleryPickerModal";
import Slider from "@react-native-community/slider";
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system";

// Same helpers from create-listing
function computeBuildingKey(
  address?: string,
  city?: string,
  state?: string,
  pincode?: string,
) {
  const norm = (s?: string) =>
    (s || "").trim().toLowerCase().replace(/\s+/g, "-");
  return ["v1", norm(address), norm(city), norm(state), norm(pincode)]
    .filter(Boolean)
    .join(":");
}

const composeDescription = (base?: string, unit?: string) => {
  const unitPart = unit ? `Unit ${unit}` : "";
  return [unitPart, base?.trim() || ""].filter(Boolean).join(" — ");
};

const GEOAPIFY_API_KEY = process.env.EXPO_PUBLIC_GEOAPIFY_KEY;

async function geocodeAddress({
  address,
  city,
  state,
  pincode,
}: {
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
}) {
  const q = [address, city, state, pincode].filter(Boolean).join(", ");
  if (!q || !GEOAPIFY_API_KEY) return undefined;
  try {
    const url = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(q)}&limit=1&apiKey=${GEOAPIFY_API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    const f = data?.features?.[0]?.geometry?.coordinates;
    if (Array.isArray(f) && f.length >= 2)
      return { latitude: f[1], longitude: f[0] };
  } catch {}
  return undefined;
}

async function ensureFileUri(uri: string): Promise<string> {
  // Already a normal file path
  if (uri.startsWith("file://")) return uri;

  // iOS Photos URIs (ph://, ph-upload://, assets-library://) need to be downloaded/copied to cache first
  if (
    uri.startsWith("ph://") ||
    uri.startsWith("ph-upload://") ||
    uri.startsWith("assets-library://")
  ) {
    const asset = Asset.fromURI(uri);
    await asset.downloadAsync(); // copies into the app cache
    const local = asset.localUri || asset.uri;

    // Make sure it became a real file:// URI
    if (!local || !local.startsWith("file://")) {
      throw new Error(`Could not convert photo URI for upload: ${uri}`);
    }
    return local;
  }

  // Android content:// sometimes shows up depending on picker/library
  if (uri.startsWith("content://")) {
    const dir = ((FileSystem as any).cacheDirectory ||
      (FileSystem as any).documentDirectory) as string | undefined;
    if (!dir)
      throw new Error(
        "No writable directory available (expo-file-system types/runtime mismatch)",
      );

    const dest = `${dir}upload-${Date.now()}.jpg`;
    await FileSystem.copyAsync({ from: uri, to: dest });
    return dest;
  }

  return uri;
}

async function uploadWithPresign(
  presignData: any,
  localUri: string,
  contentType: string,
) {
  const postUrl: string | undefined = presignData.url || presignData.upload_url;
  const fields: Record<string, string> | undefined = presignData.fields;

  if (postUrl && fields && typeof fields === "object") {
    const form = new FormData();
    Object.entries(fields).forEach(([k, v]) => form.append(k, v));
    form.append("file", {
      uri: localUri,
      name: `photo.${contentType === "image/png" ? "png" : "jpg"}`,
      type: contentType,
    } as any);

    const resp = await fetch(postUrl, { method: "POST", body: form });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(`S3 POST failed: ${resp.status} ${text}`);
    }
    return;
  }

  const putUrl: string | undefined =
    presignData.presigned_url ||
    presignData.presignedUrl ||
    presignData.put_url ||
    presignData.putUrl;
  if (!putUrl)
    throw new Error("Presign response missing PUT url or POST {url, fields}");

  const fileResp = await fetch(localUri);
  const blob = await fileResp.blob();

  const putResp = await fetch(putUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob,
  });

  if (!putResp.ok) {
    const text = await putResp.text().catch(() => "");
    throw new Error(`S3 PUT failed: ${putResp.status} ${text}`);
  }
}

const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Delhi",
  "Jammu & Kashmir",
  "Ladakh",
  "Chandigarh",
  "Puducherry",
];

type HotelRoomTypeDraft = {
  id?: number;
  name: string;
  floor: number | null;
  quantity: number;
  price: string; // TextInput
  maxGuests: number;
  beds: number | null;
  bathrooms: number | null;
  bedrooms: number | null;
  description: string;
};

type HotelRoomType = {
  id?: string; // optional (backend may assign)
  name: string;
  floor?: number | null;
  quantity: number;
  price?: number | null;
  maxGuests?: number | null;
  description?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  beds?: number | null;
};

type TabId =
  | "basic-info"
  | "details"
  | "rooms"
  | "photos"
  | "pricing"
  | "rules";

interface ListingData {
  id: string;
  title: string;
  propertyType: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  bedrooms: number;
  bathrooms: number;
  guests: number;
  beds: number;
  amenities: string[];
  photos: string[];
  description: string;
  basePrice: string;
  cleaningFee: string;
  checkIn: string;
  checkOut: string;
  rules: string[];
  offers: string[];
  buildingLabel: string;
  unitName: string;
  status: "live" | "paused" | "review" | "draft";
  hotelRoomTypes?: HotelRoomTypeDraft[];
}

function guessContentType(uri: string) {
  const lower = uri.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

function guessFilename(uri: string) {
  const last = uri.split("/").pop() || "photo.jpg";
  return last.includes(".") ? last : `photo-${Date.now()}.jpg`;
}

async function uploadListingPhotosToS3(photoUris: string[]) {
  const out: string[] = [];

  for (const uri of photoUris || []) {
    if (typeof uri !== "string") continue;

    if (uri.startsWith("http://") || uri.startsWith("https://")) {
      out.push(uri);
      continue;
    }

    // ✅ IMPORTANT: normalize iOS ph-upload://... into file://...
    const uploadUri = await ensureFileUri(uri);

    const contentType = guessContentType(uploadUri);
    const filename = guessFilename(uploadUri);

    const presignResp = await api.post("/v1/uploads/presign", {
      filename,
      content_type: contentType,
      prefix: "photos/",
    });

    const presignData =
      presignResp?.data && presignResp.data.url
        ? presignResp.data
        : (presignResp?.data ?? presignResp);

    // ✅ use uploadUri here (NOT the original ph-upload://)
    await uploadWithPresign(presignData, uploadUri, contentType);

    const publicUrl = presignData.public_url || presignData.publicUrl;
    if (!publicUrl) throw new Error("Presign did not return public_url");

    out.push(publicUrl);
  }

  return out;
}

function buildAddressKey(
  d: Pick<ListingData, "address" | "city" | "state" | "pincode">,
) {
  return [d.address, d.city, d.state, d.pincode]
    .map((v) =>
      String(v || "")
        .trim()
        .toLowerCase(),
    )
    .join("|");
}

function sameStringArray(a?: string[], b?: string[]) {
  const aa = Array.isArray(a) ? a : [];
  const bb = Array.isArray(b) ? b : [];
  return JSON.stringify(aa) === JSON.stringify(bb);
}

function sanitizeLoadedPhotos(raw: any): string[] {
  const arr: string[] = Array.isArray(raw) ? raw.map(String) : [];
  // Keep only already-uploaded URLs on load. This prevents old bad data (ph://) from breaking edit.
  return arr
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((u) => u.startsWith("http://") || u.startsWith("https://"));
}

export default function EditListingPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams();
  const listingId = params.id as string;

  const [activeTab, setActiveTab] = useState<TabId>("basic-info");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const [listingData, setListingData] = useState<ListingData>({
    id: listingId,
    title: "",
    propertyType: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    bedrooms: 1,
    bathrooms: 1,
    guests: 2,
    beds: 1,
    amenities: [],
    photos: [],
    description: "",
    basePrice: "",
    cleaningFee: "",
    checkIn: "14:00",
    checkOut: "11:00",
    rules: [],
    offers: [],
    buildingLabel: "",
    unitName: "",
    status: "live",
    hotelRoomTypes: [],
  });

  const [originalData, setOriginalData] = useState<ListingData | null>(null);
  const [originalAddressKey, setOriginalAddressKey] = useState<string>("");

  useEffect(() => {
    loadListing();
  }, [listingId]);

  useEffect(() => {
    if (originalData) {
      setHasChanges(
        JSON.stringify(listingData) !== JSON.stringify(originalData),
      );
    }
  }, [listingData, originalData]);

  const loadListing = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/v1/listings/${listingId}`);
      const data = res.data;

      const rawPhotos: string[] = Array.isArray(data.images)
        ? data.images
        : data.photo_url
          ? [data.photo_url]
          : [];

      const loaded: ListingData = {
        id: String(data.id),
        title: data.title || "",
        // ✅ Use the actual value from the API — no default fallback that hides the real type
        propertyType: (data.property_type || "").toLowerCase(),
        address: data.street || data.address || "",
        city: data.city || "",
        // ✅ state and pincode: try both field name variants the API might return
        state: data.state || data.state_en || "",
        pincode: data.pincode || data.pin_code || "",
        bedrooms: data.bedrooms || 1,
        bathrooms: data.bathrooms || 1,
        guests: data.max_guests || 2,
        beds: data.beds || 1,
        amenities: data.amenities || [],
        // ✅ sanitize photos to avoid old bad values (ph:// etc.) breaking edit saves
        photos: sanitizeLoadedPhotos(rawPhotos),
        description: data.description || "",
        basePrice: String(data.price || 0),
        cleaningFee: String(data.cleaning_fee || 0),
        checkIn: data.check_in_time || "14:00",
        checkOut: data.check_out_time || "11:00",
        rules: data.rules || [],
        offers: data.offers || [],
        buildingLabel: data.building_label || "",
        unitName: data.unit_name || "",
        status: data.status || "live",
        // ✅ Map hotel room types from API
        hotelRoomTypes: Array.isArray(data.room_types)
          ? data.room_types.map(
              (rt: any): HotelRoomTypeDraft => ({
                id: rt.id,
                name: rt.name || "",
                floor: rt.floor ?? null,
                quantity: rt.quantity ?? 1,
                price: rt.price != null ? String(rt.price) : "",
                maxGuests: rt.max_guests ?? 2,
                beds: rt.beds ?? null,
                bathrooms: rt.bathrooms ?? null,
                bedrooms: rt.bedrooms ?? null,
                description: rt.description || "",
              }),
            )
          : [],
      };

      setListingData(loaded);
      setOriginalData(loaded);

      // ✅ track address key so we only geocode when address fields change
      setOriginalAddressKey(buildAddressKey(loaded));
    } catch (e: any) {
      Alert.alert(
        t("common.error"),
        e?.response?.data?.detail || e?.message || "Failed to load listing",
      );
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const updateData = (u: Partial<ListingData>) =>
    setListingData((p) => ({ ...p, ...u }));

  const isHotel = useMemo(
    () => (listingData.propertyType || "").toLowerCase() === "hotel",
    [listingData.propertyType],
  );

  const isUnitBased = useMemo(
    () =>
      ["apartment", "studio", "room", "private room"].includes(
        (listingData.propertyType || "").toLowerCase(),
      ),
    [listingData.propertyType],
  );

  const handleSave = async () => {
    try {
      setSaving(true);

      const currentAddressKey = buildAddressKey(listingData);
      const addressChanged = currentAddressKey !== originalAddressKey;

      const photosChanged = !sameStringArray(
        listingData.photos || [],
        originalData?.photos || [],
      );

      // ✅ Geocode only if address changed
      let coords: { latitude: number; longitude: number } | undefined =
        undefined;
      if (addressChanged) {
        coords = await geocodeAddress({
          address: listingData.address,
          city: listingData.city,
          state: listingData.state,
          pincode: listingData.pincode,
        });

        if (!coords) {
          Alert.alert(
            "Address error",
            "Could not locate this address on the map.",
          );
          return;
        }
      }

      // ✅ Upload photos only if photos changed; otherwise keep as-is
      let s3Images: string[] = listingData.photos || [];
      if (photosChanged) {
        s3Images = await uploadListingPhotosToS3(listingData.photos || []);
      }

      const payload: any = {
        // Basic info
        title: listingData.title,
        street: listingData.address,
        city: listingData.city,
        state: listingData.state,
        pincode: listingData.pincode,

        // Pricing
        price: parseFloat(listingData.basePrice) || 0,

        // Property details
        bedrooms: listingData.bedrooms,
        bathrooms: listingData.bathrooms,
        beds: listingData.beds,
        max_guests: listingData.guests,

        // Lists
        amenities: listingData.amenities,
        rules: listingData.rules,
        offers: listingData.offers,

        // Times
        check_in_time: listingData.checkIn,
        check_out_time: listingData.checkOut,

        // Description
        description: composeDescription(
          listingData.description,
          isUnitBased ? listingData.unitName : undefined,
        ),

        // Building info
        building_key: computeBuildingKey(
          listingData.address,
          listingData.city,
          listingData.state,
          listingData.pincode,
        ),
        building_label: listingData.buildingLabel,
        unit_name: listingData.unitName,

        // Status
        status: listingData.status,

        // Property type
        property_type: (listingData.propertyType || "").toLowerCase() || null,

        // Hotel room types
        room_types:
          (listingData.propertyType || "").toLowerCase() === "hotel"
            ? (listingData.hotelRoomTypes || []).map((rt) => ({
                id: rt.id,
                name: rt.name,
                floor: rt.floor,
                quantity: rt.quantity,
                price: rt.price ? Number(rt.price) : null,
                max_guests: rt.maxGuests,
                bedrooms: rt.bedrooms,
                bathrooms: rt.bathrooms,
                beds: rt.beds,
                description: rt.description,
              }))
            : undefined,
      };

      // ✅ Only update coords/location if address changed
      if (addressChanged && coords) {
        const location = `${listingData.city}, ${listingData.state}`.replace(
          /^,\s*|\s*,\s*$/g,
          "",
        );
        payload.latitude = coords.latitude;
        payload.longitude = coords.longitude;
        payload.location = location;
      }

      // ✅ Only update images if photos changed
      if (photosChanged) {
        payload.photo_url = s3Images[0] || null;
        payload.images = s3Images;
      }

      await api.put(`/v1/listings/${listingId}`, payload);

      Alert.alert(t("common.success"), "Listing updated successfully!");
      setHasChanges(false);

      // ✅ Update originals so future edits diff correctly without reload
      const newLoaded: ListingData = {
        ...listingData,
        photos: s3Images,
      };
      setListingData(newLoaded);
      setOriginalData(newLoaded);
      setOriginalAddressKey(buildAddressKey(newLoaded));

      router.back();
    } catch (e: any) {
      Alert.alert(
        t("common.error"),
        e?.response?.data?.detail || e?.message || "Failed to update listing",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    if (originalData) {
      setListingData(originalData);
      setHasChanges(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      t("host.edit_listing.delete_listing"),
      `This will permanently remove "${listingData.title}". You can't undo this.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/v1/listings/${listingId}`);
              Alert.alert(
                t("common.success"),
                t("host.edit_listing.listing_deleted"),
              );
              router.replace("/(host)/listings");
            } catch (e: any) {
              Alert.alert(
                t("common.error"),
                e?.message || "Failed to delete listing",
              );
            }
          },
        },
      ],
    );
  };

  const goBack = () => {
    if (hasChanges) {
      Alert.alert(
        t("host.edit_listing.unsaved_changes"),
        t(
          "host.edit_listing.you_have_unsaved_changes_do_you_want_to_discard_them",
        ),
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => router.back(),
          },
        ],
      );
    } else {
      router.back();
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "basic-info":
        return (
          <BasicInfoTab
            data={listingData}
            onChange={updateData}
            isUnitBased={isUnitBased}
          />
        );
      case "details":
        return <DetailsTab data={listingData} onChange={updateData} />;
      case "rooms":
        if (!isHotel) return <View />;
        return <RoomsTab data={listingData} onChange={updateData} />;
      case "photos":
        return (
          <PhotosTab
            photos={listingData.photos}
            onChange={(p) => updateData({ photos: p })}
          />
        );
      case "pricing":
        return <PricingTab data={listingData} onChange={updateData} />;
      case "rules":
        return <RulesTab data={listingData} onChange={updateData} />;
      default:
        return <Text>{t("host.edit_listing.unknown_tab")}</Text>;
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View
          style={[
            styles.container,
            { justifyContent: "center", alignItems: "center" },
          ]}
        >
          <ActivityIndicator size="large" color="#111827" />
          <Text style={{ marginTop: 16, color: "#6B7280" }}>
            {t("host.edit_listing.loading_listing")}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity onPress={goBack} style={styles.headerIconBtn}>
            <ArrowLeft size={22} color="#111827" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>
              {t("host.edit_listing.edit_listing")}
            </Text>
            <Text style={styles.headerSubtitle}>{listingData.title}</Text>
          </View>
          <View
            style={[styles.statusBadge, getStatusStyle(listingData.status)]}
          >
            <Text
              style={[
                styles.statusBadgeText,
                getStatusTextStyle(listingData.status),
              ]}
            >
              {getStatusLabel(listingData.status)}
            </Text>
          </View>
        </View>

        {/* Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContainer}
        >
          {[
            {
              id: "basic-info" as TabId,
              label: "Basic Info",
              icon: <Home size={16} color="#6B7280" />,
            },
            {
              id: "details" as TabId,
              label: "Details",
              icon: <MapPin size={16} color="#6B7280" />,
            },
            ...(isHotel
              ? [
                  {
                    id: "rooms" as TabId,
                    label: t("host.edit_listing.rooms"),
                    icon: <Home size={16} color="#6B7280" />,
                  },
                ]
              : []),
            {
              id: "photos" as TabId,
              label: "Photos",
              icon: <ImageIcon size={16} color="#6B7280" />,
            },
            {
              id: "pricing" as TabId,
              label: "Pricing",
              icon: <DollarSign size={16} color="#6B7280" />,
            },
            {
              id: "rules" as TabId,
              label: "Rules",
              icon: <Shield size={16} color="#6B7280" />,
            },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tab, activeTab === tab.id && styles.tabActive]}
              onPress={() => setActiveTab(tab.id)}
            >
              {tab.icon}
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab.id && styles.tabTextActive,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        {renderTabContent()}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.footerRow}>
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
            <Trash2 size={16} color="#DC2626" />
            <Text style={styles.deleteBtnText}>{t("common.delete")}</Text>
          </TouchableOpacity>

          <View
            style={{
              flexDirection: "row",
              gap: 8,
              flex: 1,
              justifyContent: "flex-end",
            }}
          >
            {hasChanges && (
              <TouchableOpacity
                style={styles.discardBtn}
                onPress={handleDiscard}
              >
                <Text style={styles.discardBtnText}>
                  {t("host.edit_listing.discard")}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.5 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <Check size={16} color="white" />
                  <Text style={styles.saveBtnText}>
                    {t("host.edit_listing.save_changes")}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

// Tab Components
function BasicInfoTab({
  data,
  onChange,
  isUnitBased,
}: {
  data: ListingData;
  onChange: (u: any) => void;
  isUnitBased: boolean;
}) {
  const [stateModalOpen, setStateModalOpen] = useState(false);
  const { t } = useTranslation();

  return (
    <View style={styles.tabContent}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          {t("host.edit_listing.property_information")}
        </Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            {t("host.create_listing.listing_title")}
          </Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Cozy 2BHK Apartment"
            value={data.title}
            onChangeText={(t) => onChange({ title: t })}
            maxLength={60}
          />
          <Text
            style={[
              styles.charCount,
              { color: data.title.length < 20 ? "#DC2626" : "#16A34A" },
            ]}
          >
            {data.title.length}/60
          </Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t("search.property_type")}</Text>
          <View style={styles.propertyTypeGrid}>
            {(
              [
                { id: "apartment", label: t("host.create_listing.apartment") },
                { id: "house", label: t("host.create_listing.house") },
                { id: "villa", label: t("host.create_listing.villa") },
                { id: "hotel", label: t("host.create_listing.hotel") },
                { id: "studio", label: t("host.create_listing.studio") },
                { id: "cottage", label: t("host.create_listing.cottage") },
                { id: "room", label: t("host.create_listing.private_room") },
              ] as const
            ).map((pt) => {
              const selected =
                (data.propertyType || "").toLowerCase() === pt.id;
              return (
                <TouchableOpacity
                  key={pt.id}
                  style={[styles.ptChip, selected && styles.ptChipSelected]}
                  onPress={() => onChange({ propertyType: pt.id })}
                >
                  <Text
                    style={[
                      styles.ptChipText,
                      selected && styles.ptChipTextSelected,
                    ]}
                  >
                    {pt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {(data.propertyType || "").toLowerCase() === "hotel" && (
            <View style={styles.hotelHint}>
              <Text style={styles.hotelHintText}>
                🏨 Switch to the{" "}
                <Text style={{ fontWeight: "800" }}>Rooms</Text> tab to manage
                room types
              </Text>
            </View>
          )}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            {t("host.create_listing.description")}
          </Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Describe your space..."
            value={data.description}
            onChangeText={(t) => onChange({ description: t })}
            multiline
            maxLength={500}
          />
          <Text style={styles.charCount}>{data.description.length}/500</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t("listing.location")}</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            {t("host.create_listing.street_address")}
          </Text>
          <TextInput
            style={styles.input}
            placeholder={t("host.create_listing.enter_street_address")}
            value={data.address}
            onChangeText={(t) => onChange({ address: t })}
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>{t("settings.edit_profile.city")}</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Bengaluru"
              value={data.city}
              onChangeText={(t) => onChange({ city: t })}
            />
          </View>

          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>{t("settings.edit_profile.state")}</Text>
            <TouchableOpacity
              style={styles.selectInput}
              onPress={() => setStateModalOpen(true)}
            >
              <Text
                style={data.state ? styles.inputText : styles.inputPlaceholder}
              >
                {data.state || "Select State"}
              </Text>
              <ChevronDown size={16} color="#6B7280" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t("host.create_listing.pin_code")}</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., 560001"
            keyboardType="number-pad"
            maxLength={6}
            value={data.pincode}
            onChangeText={(t) =>
              onChange({ pincode: t.replace(/[^0-9]/g, "") })
            }
          />
        </View>
      </View>

      {isUnitBased && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {t("host.edit_listing.building_details")}
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              {t("host.edit_listing.building_name")}
            </Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Sunrise Apartments"
              value={data.buildingLabel}
              onChangeText={(t) => onChange({ buildingLabel: t })}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              {t("host.edit_listing.unit_number")}
            </Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., A-203"
              value={data.unitName}
              onChangeText={(t) => onChange({ unitName: t })}
            />
          </View>
        </View>
      )}

      <Modal
        visible={stateModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setStateModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {t("host.create_listing.select_state")}
              </Text>
            </View>
            <ScrollView>
              {INDIAN_STATES.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={styles.modalItem}
                  onPress={() => {
                    onChange({ state: s });
                    setStateModalOpen(false);
                  }}
                >
                  <Text
                    style={[
                      styles.modalItemText,
                      s === data.state && styles.modalItemTextActive,
                    ]}
                  >
                    {s}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setStateModalOpen(false)}
            >
              <Text style={styles.modalCloseText}>{t("common.close")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function DetailsTab({
  data,
  onChange,
}: {
  data: ListingData;
  onChange: (u: any) => void;
}) {
  const { t } = useTranslation();
  const Counter = ({ label, value, onDec, onInc, min = 0 }: any) => (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <View style={styles.counterControls}>
        <TouchableOpacity
          onPress={onDec}
          style={[styles.counterBtn, value <= min && styles.counterBtnDisabled]}
          disabled={value <= min}
        >
          <Minus size={18} color={value <= min ? "#9CA3AF" : "#111827"} />
        </TouchableOpacity>
        <Text style={styles.counterValue}>{value}</Text>
        <TouchableOpacity onPress={onInc} style={styles.counterBtn}>
          <Plus size={18} color="#111827" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.tabContent}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Property Details</Text>

        <Counter
          label={t("listing.guests")}
          value={data.guests}
          min={1}
          onDec={() => onChange({ guests: Math.max(1, data.guests - 1) })}
          onInc={() => onChange({ guests: data.guests + 1 })}
        />
        <Counter
          label={t("listing.bedrooms")}
          value={data.bedrooms}
          onDec={() => onChange({ bedrooms: Math.max(0, data.bedrooms - 1) })}
          onInc={() => onChange({ bedrooms: data.bedrooms + 1 })}
        />
        <Counter
          label={t("listing.beds")}
          value={data.beds}
          min={1}
          onDec={() => onChange({ beds: Math.max(1, data.beds - 1) })}
          onInc={() => onChange({ beds: data.beds + 1 })}
        />
        <Counter
          label={t("listing.bathrooms")}
          value={data.bathrooms}
          min={1}
          onDec={() => onChange({ bathrooms: Math.max(1, data.bathrooms - 1) })}
          onInc={() => onChange({ bathrooms: data.bathrooms + 1 })}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t("listing.amenities")}</Text>

        <View style={styles.amenitiesGrid}>
          {[
            t("search.wiFi"),
            t("search.airConditioning"),
            t("search.kitchen"),
            t("search.washing_machine"),
            t("search.TV"),
            t("search.freeParking"),
            t("search.pool"),
            t("search.gym"),
            t("search.hot_water"),
            t("search.work_space"),
          ].map((a) => {
            const on = data.amenities.includes(a);
            return (
              <TouchableOpacity
                key={a}
                style={[styles.amenityCard, on && styles.amenityCardOn]}
                onPress={() => {
                  // ✅ Toggle: if selected, remove it; if not, add it
                  const newAmenities = on
                    ? data.amenities.filter((x) => x !== a) // Remove
                    : [...data.amenities, a]; // Add
                  onChange({ amenities: newAmenities });
                }}
              >
                <Text style={[styles.amenityText, on && styles.amenityTextOn]}>
                  {a}
                </Text>
                {on && <Check size={16} color="white" />}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ✅ ADD: Custom amenity input (like in create-listing) */}
        <View style={[styles.inputGroup, { marginTop: 16 }]}>
          <Text style={styles.label}>
            {t("host.edit_listing.add_custom_amenity")}
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="e.g., Smart lock"
              onSubmitEditing={(e) => {
                const val = e.nativeEvent.text.trim();
                if (val && !data.amenities.includes(val)) {
                  onChange({ amenities: [...data.amenities, val] });
                }
              }}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

function RoomsTab({
  data,
  onChange,
}: {
  data: ListingData;
  onChange: (u: Partial<ListingData>) => void;
}) {
  const { t } = useTranslation();

  const roomTypes: HotelRoomTypeDraft[] = data.hotelRoomTypes ?? [];

  const addRoomType = () => {
    onChange({
      hotelRoomTypes: [
        ...roomTypes,
        {
          name: "",
          floor: null,
          quantity: 1,
          price: "",
          maxGuests: 2,
          beds: 1,
          bathrooms: 1,
          bedrooms: 1,
          description: "",
        },
      ],
    });
  };

  const update = (idx: number, patch: Partial<HotelRoomTypeDraft>) => {
    const next = [...roomTypes];
    next[idx] = { ...next[idx], ...patch };
    onChange({ hotelRoomTypes: next });
  };

  const remove = (idx: number) => {
    const next = [...roomTypes];
    next.splice(idx, 1);
    onChange({ hotelRoomTypes: next });
  };

  return (
    <ScrollView
      style={styles.tabScroll}
      contentContainerStyle={styles.tabContent}
    >
      <Text style={styles.sectionTitle}>
        {t("host.create_listing.hotel_room_types")}
      </Text>
      <Text style={styles.sectionSubTitle}>
        {t("host.create_listing.hotel_room_types_subtitle")}
      </Text>

      <View style={{ gap: 12 }}>
        {roomTypes.map((rt: HotelRoomTypeDraft, idx: number) => (
          <View key={idx} style={styles.card}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: "700" }}>
                {t("host.create_listing.room_type")} {idx + 1}
              </Text>
              <TouchableOpacity
                onPress={() => remove(idx)}
                style={styles.dangerPill}
              >
                <Text style={{ color: "#B91C1C", fontWeight: "700" }}>
                  {t("host.create_listing.remove")}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                {t("host.create_listing.room_type_name")}
              </Text>
              <TextInput
                style={styles.textInput}
                value={rt.name}
                placeholder={t(
                  "host.create_listing.room_type_name_placeholder",
                )}
                onChangeText={(v) => update(idx, { name: v })}
              />
            </View>

            <View style={styles.rowFields}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>
                  {t("host.create_listing.floor_optional")}
                </Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="number-pad"
                  value={rt.floor === null ? "" : String(rt.floor)}
                  onChangeText={(v) =>
                    update(idx, { floor: v ? parseInt(v, 10) : null })
                  }
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>
                  {t("host.create_listing.quantity")}
                </Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="number-pad"
                  value={String(rt.quantity ?? 1)}
                  onChangeText={(v) =>
                    update(idx, {
                      quantity: Math.max(1, parseInt(v || "1", 10)),
                    })
                  }
                />
              </View>
            </View>

            <View style={styles.rowFields}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>
                  {t("host.create_listing.price_per_night_optional")}
                </Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="number-pad"
                  value={rt.price}
                  placeholder={t(
                    "host.create_listing.leave_empty_to_use_listing_price",
                  )}
                  onChangeText={(v) => update(idx, { price: v })}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>
                  {t("host.create_listing.max_guests")}
                </Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="number-pad"
                  value={String(rt.maxGuests ?? 2)}
                  onChangeText={(v) =>
                    update(idx, {
                      maxGuests: Math.max(1, parseInt(v || "2", 10)),
                    })
                  }
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                {t("host.create_listing.room_description_optional")}
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  { height: 90, textAlignVertical: "top" },
                ]}
                multiline
                value={rt.description}
                onChangeText={(v) => update(idx, { description: v })}
              />
            </View>
          </View>
        ))}
      </View>

      <TouchableOpacity style={styles.primaryOutlineBtn} onPress={addRoomType}>
        <Text style={styles.primaryOutlineBtnText}>
          {t("host.create_listing.add_room_type")}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function PhotosTab({
  photos,
  onChange,
}: {
  photos: string[];
  onChange: (p: string[]) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const { t } = useTranslation();

  const onConfirmPicker = (uris: string[]) => {
    if (!uris?.length) return setPickerOpen(false);
    onChange([...(photos || []), ...uris]);
    setPickerOpen(false);
  };

  const remove = (i: number) => onChange(photos.filter((_, idx) => idx !== i));

  return (
    <View style={styles.tabContent}>
      <View style={styles.card}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <Text style={styles.cardTitle}>
            {t("settings_pages.host_onboarding.property_photos")}
          </Text>
          <TouchableOpacity
            style={styles.uploadBtn}
            onPress={() => setPickerOpen(true)}
          >
            <Upload size={14} color="#111827" />
            <Text style={styles.uploadBtnText}>
              {t("settings.privacy_safety.upload")}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.inputHint}>
          {t("host.edit_listing.add_at_least_5_photos")}
        </Text>

        <View style={styles.photosGrid}>
          {photos.map((uri, i) => (
            <View key={i} style={styles.photoBox}>
              <Image source={{ uri }} style={styles.photoImg} />
              <TouchableOpacity
                style={styles.photoRemove}
                onPress={() => remove(i)}
              >
                <X size={14} color="white" />
              </TouchableOpacity>
              {i === 0 && (
                <View style={styles.coverBadge}>
                  <Text style={styles.coverBadgeText}>Cover</Text>
                </View>
              )}
            </View>
          ))}

          <TouchableOpacity
            style={styles.photoAdd}
            onPress={() => setPickerOpen(true)}
          >
            <Upload size={30} color="#6B7280" />
            <Text style={styles.photoAddText}>
              {t("host.edit_listing.add_photo")}
            </Text>
          </TouchableOpacity>
        </View>

        {!!photos.length && (
          <Text style={styles.photoCount}>
            {photos.length} {t("host.edit_listing.photos")}s{" "}
            {t("host.edit_listing.uploaded")}
          </Text>
        )}
      </View>

      <GalleryPickerModal
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onConfirm={onConfirmPicker}
        max={0}
      />
    </View>
  );
}

function PricingTab({
  data,
  onChange,
}: {
  data: ListingData;
  onChange: (u: any) => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.tabContent}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t("host.edit_listing.pricing")}</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            {t("host.edit_listing.base_price_per_night")}
          </Text>
          <View style={styles.priceRow}>
            <Text style={styles.currency}>₹</Text>
            <TextInput
              style={styles.priceInput}
              placeholder="2000"
              keyboardType="numeric"
              value={data.basePrice}
              onChangeText={(t) =>
                onChange({ basePrice: t.replace(/[^0-9]/g, "") })
              }
            />
          </View>
        </View>

        <Slider
          style={{ width: "100%", height: 40 }}
          minimumValue={500}
          maximumValue={20000}
          step={100}
          minimumTrackTintColor="#111827"
          maximumTrackTintColor="#E5E7EB"
          value={Number(data.basePrice) || 0}
          onValueChange={(v) => onChange({ basePrice: String(Math.round(v)) })}
        />
        <Text style={{ color: "#6B7280", marginTop: 4 }}>
          ₹{data.basePrice || 0}
        </Text>

        <View style={styles.divider} />

        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            {t("host.edit_listing.cleaning_fee_optional")}
          </Text>
          <View style={styles.priceRow}>
            <Text style={styles.currency}>₹</Text>
            <TextInput
              style={styles.priceInput}
              placeholder="500"
              keyboardType="numeric"
              value={data.cleaningFee}
              onChangeText={(t) =>
                onChange({ cleaningFee: t.replace(/[^0-9]/g, "") })
              }
            />
          </View>
        </View>
      </View>
    </View>
  );
}

function RulesTab({
  data,
  onChange,
}: {
  data: ListingData;
  onChange: (u: any) => void;
}) {
  const { t } = useTranslation();
  const [customRule, setCustomRule] = useState("");
  const [offerInput, setOfferInput] = useState("");

  const BASE_RULES = [
    "No smoking",
    "No pets",
    "No parties or events",
    "Suitable for children",
  ];
  const rules: string[] = data.rules || [];
  const offers: string[] = data.offers || [];

  const customRules = rules.filter((r) => !BASE_RULES.includes(r));
  const allRules = [...BASE_RULES, ...customRules];

  const isOn = (r: string) => rules.includes(r);
  const toggle = (r: string) =>
    onChange({
      rules: isOn(r) ? rules.filter((x) => x !== r) : [...rules, r],
    });

  const addCustomRule = () => {
    const r = customRule.trim();
    if (!r) return;
    if (!allRules.includes(r) || !isOn(r)) {
      onChange({ rules: [...rules.filter(Boolean), r] });
    }
    setCustomRule("");
  };

  const addOffer = () => {
    const t = offerInput.trim();
    if (!t) return;
    onChange({ offers: [...offers, t] });
    setOfferInput("");
  };

  const removeOffer = (idx: number) => {
    onChange({ offers: offers.filter((_, i) => i !== idx) });
  };

  return (
    <View style={styles.tabContent}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t("booking.guest.check_in_out")}</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t("host.edit_listing.check-in")}</Text>
          <TextInput
            style={styles.input}
            placeholder="14:00"
            value={data.checkIn}
            onChangeText={(v) => onChange({ checkIn: v })}
            keyboardType="numbers-and-punctuation"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t("host.edit_listing.check-out")}</Text>
          <TextInput
            style={styles.input}
            placeholder="11:00"
            value={data.checkOut}
            onChangeText={(v) => onChange({ checkOut: v })}
            keyboardType="numbers-and-punctuation"
          />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          {t("listing.what_this_place_offers")}
        </Text>

        {offers.length > 0 && (
          <View style={{ marginTop: 8, marginBottom: 12, gap: 8 }}>
            {offers.map((i, idx) => (
              <View key={`${t}-${idx}`} style={styles.offerItem}>
                <Text style={{ flex: 1, color: "#111827" }}>{i}</Text>
                <TouchableOpacity onPress={() => removeOffer(idx)}>
                  <Text style={{ color: "#6B7280", fontSize: 12 }}>
                    {t("settings.login_security.remove")}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <View style={[styles.inputGroup, { marginTop: 4 }]}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Add what your place offers"
              value={offerInput}
              onChangeText={setOfferInput}
              returnKeyType="done"
              onSubmitEditing={addOffer}
            />
            <TouchableOpacity style={styles.addBtn} onPress={addOffer}>
              <Text style={styles.addBtnText}>{t("listing.add")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t("listing.house_rules")}</Text>

        <View style={{ gap: 8 }}>
          {allRules.map((r) => {
            const on = isOn(r);
            const isCustom = !BASE_RULES.includes(r);
            return (
              <TouchableOpacity
                key={r}
                style={[styles.ruleCard, on && styles.ruleCardOn]}
                onPress={() => toggle(r)}
              >
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                >
                  <Text style={[styles.ruleText, on && styles.ruleTextOn]}>
                    {r}
                  </Text>
                  {isCustom && (
                    <View style={styles.customBadge}>
                      <Text
                        style={[
                          styles.customBadgeText,
                          on && { color: "#FFFFFF" },
                        ]}
                      >
                        {t("host.edit_listing.custom")}
                      </Text>
                    </View>
                  )}
                </View>
                {on && <Check size={16} color="white" />}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={[styles.inputGroup, { marginTop: 12 }]}>
          <Text style={styles.label}>Add your own rule</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="e.g., Quiet hours after 10 PM"
              value={customRule}
              onChangeText={setCustomRule}
              returnKeyType="done"
              onSubmitEditing={addCustomRule}
            />
            <TouchableOpacity style={styles.addBtn} onPress={addCustomRule}>
              <Text style={styles.addBtnText}>{t("listing.add")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

// Helper functions for status badges
function getStatusStyle(status?: string) {
  switch (status) {
    case "live":
      return { backgroundColor: "#D1FAE5" };
    case "paused":
      return { backgroundColor: "#E5E7EB" };
    case "review":
      return { backgroundColor: "#DBEAFE" };
    case "draft":
      return { backgroundColor: "#FEF3C7" };
    default:
      return { backgroundColor: "#E5E7EB" };
  }
}

function getStatusTextStyle(status?: string) {
  switch (status) {
    case "live":
      return { color: "#065F46" };
    case "paused":
      return { color: "#4B5563" };
    case "review":
      return { color: "#1E40AF" };
    case "draft":
      return { color: "#92400E" };
    default:
      return { color: "#4B5563" };
  }
}

function getStatusLabel(status?: string) {
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
}

// Styles
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  header: {
    backgroundColor: "white",
    paddingTop: 8,
    paddingBottom: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  headerIconBtn: { padding: 6, borderRadius: 10 },
  headerTitle: { fontSize: 18, fontWeight: "600", color: "#111827" },
  headerSubtitle: { fontSize: 13, color: "#6B7280", marginTop: 2 },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeText: { fontSize: 11, fontWeight: "600" },

  tabsContainer: { paddingVertical: 8, gap: 8 },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "white",
  },
  tabActive: {
    backgroundColor: "#111827",
    borderColor: "#111827",
  },
  tabText: { fontSize: 13, color: "#6B7280", fontWeight: "500" },
  tabTextActive: { color: "white", fontWeight: "600" },

  scroll: { flex: 1, backgroundColor: "#F9FAFB" },
  scrollContent: { padding: 16, paddingBottom: 100 },

  tabContent: { gap: 16 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 16,
  },

  inputGroup: { marginBottom: 14 },
  label: { fontSize: 15, fontWeight: "500", color: "#374151", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
    fontSize: 16,
    color: "#111827",
  },
  inputText: { color: "#111827", fontSize: 16 },
  inputPlaceholder: { color: "#9CA3AF", fontSize: 16 },
  row: { flexDirection: "row", gap: 12 },
  selectInput: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    height: 46,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  textArea: { height: 120, textAlignVertical: "top", paddingTop: 10 },
  charCount: {
    fontSize: 12,
    color: "#9CA3AF",
    textAlign: "right",
    marginTop: 4,
  },
  inputHint: { fontSize: 12, color: "#9CA3AF", marginTop: 4 },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "white",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "60%",
  },
  modalHeader: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  modalTitle: { fontSize: 16, fontWeight: "700" },
  modalItem: { paddingVertical: 12, paddingHorizontal: 16 },
  modalItemText: { fontSize: 16, color: "#374151", fontWeight: "500" },
  modalItemTextActive: { color: "#111827", fontWeight: "700" },
  modalClose: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  modalCloseText: {
    textAlign: "center",
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },

  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  detailLabel: { fontSize: 16, color: "#374151" },
  counterControls: { flexDirection: "row", alignItems: "center" },
  counterBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#B0B0B0",
    alignItems: "center",
    justifyContent: "center",
  },
  counterBtnDisabled: { borderColor: "#E5E7EB" },
  counterValue: {
    minWidth: 28,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "700",
    marginHorizontal: 14,
  },

  amenitiesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  amenityCard: {
    width: "48%",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  amenityCardOn: { backgroundColor: "#111827", borderColor: "#111827" },
  amenityText: { color: "#374151", fontSize: 14 },
  amenityTextOn: { color: "#FFFFFF", fontWeight: "600" },

  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
  },
  uploadBtnText: { fontSize: 13, fontWeight: "600", color: "#111827" },

  photosGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 12,
  },
  photoBox: {
    width: "48%",
    aspectRatio: 1,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#F3F4F6",
    position: "relative",
  },
  photoImg: { width: "100%", height: "100%" },
  photoRemove: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(220,38,38,0.85)",
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  coverBadge: {
    position: "absolute",
    bottom: 8,
    left: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  coverBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  photoAdd: {
    width: "48%",
    aspectRatio: 1,
    borderRadius: 12,
    borderStyle: "dashed",
    borderWidth: 2,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#F9FAFB",
  },
  photoAddText: { color: "#6B7280", fontSize: 14 },
  photoCount: { marginTop: 6, color: "#6B7280" },

  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    backgroundColor: "#fff",
  },
  currency: { paddingLeft: 12, color: "#6B7280", fontSize: 16 },
  priceInput: {
    flex: 1,
    height: 46,
    fontSize: 16,
    paddingHorizontal: 12,
    color: "#111827",
  },
  divider: { height: 1, backgroundColor: "#E5E7EB", marginVertical: 16 },

  offerItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "#F3F4F6",
  },

  ruleCard: {
    padding: 12,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  ruleCardOn: { backgroundColor: "#111827", borderColor: "#111827" },
  ruleText: { color: "#374151", fontSize: 14 },
  ruleTextOn: { color: "#fff", fontWeight: "600" },
  customBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "#EEF2FF",
  },
  customBadgeText: { fontSize: 12, color: "#3730A3" },

  addBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  addBtnText: { color: "#111827", fontWeight: "700" },

  footer: {
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#FEE2E2",
  },
  deleteBtnText: { color: "#DC2626", fontWeight: "600", fontSize: 13 },
  discardBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
  },
  discardBtnText: { color: "#111827", fontWeight: "600" },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#111827",
    borderRadius: 12,
  },
  saveBtnText: { color: "#fff", fontWeight: "800" },
  tabScroll: { flex: 1 },
  propertyTypeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  ptChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },
  ptChipSelected: { backgroundColor: "#111827", borderColor: "#111827" },
  ptChipText: { fontSize: 14, color: "#374151", fontWeight: "500" },
  ptChipTextSelected: { color: "#FFFFFF", fontWeight: "700" },
  hotelHint: {
    marginTop: 10,
    backgroundColor: "#EDE9FE",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#DDD6FE",
  },
  hotelHintText: { fontSize: 13, color: "#5B21B6" },

  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 6,
  },

  sectionSubTitle: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 14,
  },

  fieldGroup: {
    marginTop: 12,
  },

  fieldLabel: {
    fontSize: 13,
    color: "#374151",
    fontWeight: "700",
    marginBottom: 6,
  },

  textInput: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    fontSize: 15,
  },

  rowFields: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },

  dangerPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#FEE2E2",
  },

  primaryOutlineBtn: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: "#111827",
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
  },

  primaryOutlineBtnText: {
    fontWeight: "800",
    color: "#111827",
  },
});
