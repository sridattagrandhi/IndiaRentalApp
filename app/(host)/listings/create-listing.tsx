import { geocodeText } from "@/services/location";
import * as SecureStore from "expo-secure-store";
import { useTranslation } from "react-i18next";
// app/(host)/listings/create-listing.tsx
import api from "@/services/api";
import { Image } from "expo-image";
import { Stack, useRouter } from "expo-router";
import {
  ArrowLeft,
  ArrowRight,
  Bed,
  Check,
  ChevronDown,
  DollarSign,
  FileText,
  Home,
  Image as ImageIcon,
  MapPin,
  Minus,
  Plus,
  Shield,
  Upload,
  X,
} from "lucide-react-native";
import React, { useMemo, useState } from "react";
import {
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

// ✅ NEW: image picker
import GalleryPickerModal from "@/components/GalleryPickerModal";
import Slider from "@react-native-community/slider";
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system";

// -----------------------------
// Small helpers (no context)
// -----------------------------
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

    if (!local || !local.startsWith("file://")) {
      throw new Error(`Could not convert photo URI for upload: ${uri}`);
    }
    return local;
  }

  // Android content:// sometimes shows up depending on picker/library
  if (uri.startsWith("content://")) {
    const dir = ((FileSystem as any).cacheDirectory ||
      (FileSystem as any).documentDirectory) as string | undefined;
    if (!dir) throw new Error("No writable directory available");

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
  // CASE A: Presigned POST
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

  // CASE B: Presigned PUT
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

// ✅ NEW: Indian states / UTs (trimmed list; extend if you like)
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

// Types used by this screen only (match your backend fields)
type StepId =
  | "property-type"
  | "location"
  | "details"
  | "hotel-rooms"
  | "amenities"
  | "photos"
  | "title-description"
  | "pricing"
  | "rules"
  | "review";

type HotelRoomTypeDraft = {
  name: string;
  floor: number | null;
  quantity: number;
  price: string; // string for TextInput
  maxGuests: number;
  beds: number | null;
  bathrooms: number | null;
  bedrooms: number | null;
  description: string;
};

interface NewListingPayload {
  title: string;
  location: string; // "City, State"
  address?: string;
  images?: string[];
  rules?: string[];
  offers?: string[]; // ⭐ NEW: what this place offers
  status: "live" | "paused" | "review" | "draft";
  pricePerNight: number;
  rating: number;
  reviewCount: number;
  amenities: string[];
  buildingLabel?: string;
  buildingKey?: string;
  unitName?: string;
  maxGuests: number;
  description?: string;
  checkIn?: string; // ⭐ NEW: front-end field for time
  checkOut?: string; // ⭐ NEW
  coords?: {
    latitude: number;
    longitude: number;
  };
}

interface StepConfig {
  id: StepId;
  title: string;
  icon: React.ReactNode;
}

const steps: StepConfig[] = [
  {
    id: "property-type",
    title: "Type",
    icon: <Home size={18} color="#4B5563" />,
  },
  {
    id: "location",
    title: "Location",
    icon: <MapPin size={18} color="#4B5563" />,
  },
  { id: "details", title: "Details", icon: <Bed size={18} color="#4B5563" /> },
  {
    id: "hotel-rooms",
    title: "Rooms",
    icon: <Home size={18} color="#4B5563" />,
  },
  {
    id: "amenities",
    title: "Amenities",
    icon: <Check size={18} color="#4B5563" />,
  },
  {
    id: "photos",
    title: "Photos",
    icon: <ImageIcon size={18} color="#4B5563" />,
  },
  {
    id: "title-description",
    title: "Description",
    icon: <FileText size={18} color="#4B5563" />,
  },
  {
    id: "pricing",
    title: "Pricing",
    icon: <DollarSign size={18} color="#4B5563" />,
  },
  { id: "rules", title: "Rules", icon: <Shield size={18} color="#4B5563" /> },
  { id: "review", title: "Review", icon: <Check size={18} color="#4B5563" /> },
];

const ProgressBar = ({ value }: { value: number }) => (
  <View style={styles.progressWrap}>
    <View style={[styles.progressTrack]}>
      <View style={[styles.progressBar, { width: `${value}%` }]} />
    </View>
  </View>
);

export default function CreateListingPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const currentStep = steps[currentStepIndex].id;
  const progressPercent = ((currentStepIndex + 1) / steps.length) * 100;
  const [headerH, setHeaderH] = useState(0);

  const [listingData, setListingData] = useState({
    propertyType: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    bedrooms: 1,
    bathrooms: 1,
    guests: 2,
    beds: 1,
    amenities: [] as string[],
    photos: [] as string[],
    title: "",
    description: "",
    basePrice: "",
    cleaningFee: "",
    // ❌ no more weekend/security here (we removed them from UI)
    checkIn: "14:00",
    checkOut: "11:00",
    rules: [] as string[],
    offers: [] as string[],

    // building inputs
    buildingLabel: "",
    unitName: "", // comma-separated for multiple

    // hotel
    hotelRoomTypes: [] as HotelRoomTypeDraft[],
  });

  const updateData = (u: Partial<typeof listingData>) =>
    setListingData((p) => ({ ...p, ...u }));

  // ✅ include "room" (private room) as unit-based too
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

  // near your other handlers
  const goBackFromHeader = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((i) => Math.max(0, i - 1));
      return;
    }
    try {
      // expo-router ≥ v3 exposes canGoBack()
      // @ts-ignore - optional depending on version
      if (typeof router.canGoBack === "function" && router.canGoBack()) {
        router.back();
      } else {
        router.replace("/(host)/listings");
      }
    } catch {
      router.replace("/(host)/listings");
    }
  };

  const handleNext = () => {
    // ✅ validate hotel rooms step
    if (currentStep === "hotel-rooms" && isHotel) {
      if (!listingData.hotelRoomTypes?.length) {
        Alert.alert(
          t("host.create_listing.add_room_types"),
          t("host.create_listing.hotels_need_at_least_one_room_type"),
        );
        return;
      }
    }

    if (currentStepIndex < steps.length - 1) {
      const nextStep = steps[currentStepIndex + 1]?.id;
      if (!isHotel && nextStep === "hotel-rooms") {
        setCurrentStepIndex((i) => Math.min(steps.length - 1, i + 2));
        return;
      }
      setCurrentStepIndex((i) => i + 1);
    }
  };
  const handlePrevious = () => {
    if (currentStepIndex === 0) router.replace("/(host)/listings");
    else setCurrentStepIndex((i) => Math.max(0, i - 1));
  };

  const buildLocation = (city?: string, state?: string) =>
    `${city || ""}, ${state || ""}`.replace(/^,\s*|\s*,\s*$/g, "");

  const parseUnits = (raw: string): string[] =>
    (raw || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  function makePayload(
    overrides: Partial<NewListingPayload> = {},
  ): NewListingPayload {
    const location = buildLocation(listingData.city, listingData.state);
    const primaryUnit = parseUnits(listingData.unitName)[0]; // for single-description case

    return {
      title: listingData.title || "Untitled Listing",
      location,
      address: listingData.address || undefined,
      images: listingData.photos?.length ? listingData.photos : undefined,
      rules: listingData.rules?.length ? listingData.rules : undefined,
      offers: listingData.offers?.length ? listingData.offers : undefined, // ⭐ new
      status: "live",
      pricePerNight: parseInt(String(listingData.basePrice || 0), 10) || 0,
      rating: 0,
      reviewCount: 0,
      amenities: listingData.amenities?.length ? listingData.amenities : [],
      buildingLabel: listingData.buildingLabel || undefined,
      buildingKey:
        computeBuildingKey(
          listingData.address,
          listingData.city,
          listingData.state,
          listingData.pincode,
        ) || undefined,
      maxGuests: Math.max(1, listingData.guests || 1),
      description: composeDescription(
        listingData.description,
        isUnitBased ? primaryUnit : undefined,
      ),
      checkIn: listingData.checkIn || undefined, // ⭐ new
      checkOut: listingData.checkOut || undefined, // ⭐ new
      ...overrides,
    };
  }

  async function createListingOnBackend(payload: NewListingPayload) {
    const [cityPart] = (payload.location || "").split(",").map((s) => s.trim());

    if (!payload.coords?.latitude || !payload.coords?.longitude) {
      throw new Error("Missing coordinates for this address");
    }

    await api.post("/v1/listings", {
      // required fields
      title: payload.title,
      street: payload.address,
      city: cityPart || payload.location,
      price: payload.pricePerNight,
      latitude: payload.coords.latitude,
      longitude: payload.coords.longitude,

      // keep a nice human-readable location string too
      location: payload.location,

      // optional extras
      rating: payload.rating ?? 0,
      photo_url: payload.images?.[0] ?? null,
      images: payload.images,
      amenities: payload.amenities,

      // house rules & guest count & description
      rules: payload.rules,
      offers: payload.offers, // ⭐ send what this place offers
      check_in_time: payload.checkIn, // ⭐ send times in snake_case
      check_out_time: payload.checkOut,
      max_guests: payload.maxGuests,
      description: payload.description,

      building_key: payload.buildingKey,
      building_label: payload.buildingLabel,
      unit_name: payload.unitName,

      state: listingData.state || null,
      pincode: listingData.pincode || null,
      property_type: (listingData.propertyType || "").toLowerCase() || null,
      room_types:
        (listingData.propertyType || "").toLowerCase() === "hotel"
          ? (listingData.hotelRoomTypes || []).map((rt) => ({
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
          : [],

      bedrooms: listingData.bedrooms ?? null,
      bathrooms: listingData.bathrooms ?? null,
      beds: listingData.beds ?? null,

      status: payload.status ?? "live",
    });
  }

  function guessContentType(uri: string) {
    const lower = uri.toLowerCase();
    if (lower.endsWith(".png")) return "image/png";
    if (lower.endsWith(".webp")) return "image/webp";
    return "image/jpeg";
  }

  function guessFilename(uri: string) {
    const last = uri.split("/").pop() || "photo.jpg";
    // Some Expo URIs don’t have real names; keep it safe
    return last.includes(".") ? last : `photo-${Date.now()}.jpg`;
  }

  async function uploadListingPhotosToS3(photoUris: string[]) {
    const out: string[] = [];

    for (const uri of photoUris || []) {
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

      // ✅ upload the real file:// uri
      await uploadWithPresign(presignData, uploadUri, contentType);

      const publicUrl = presignData.public_url || presignData.publicUrl;
      if (!publicUrl) throw new Error("Presign did not return public_url");

      out.push(publicUrl);
    }

    return out;
  }

  const handleComplete = async () => {
    try {
      const query = [
        listingData.address,
        listingData.city,
        listingData.state,
        listingData.pincode,
      ]
        .filter(Boolean)
        .join(", ")
        .trim();

      if (!query) {
        Alert.alert(
          "Address error",
          "Please enter an address / city / state so we can locate it on the map.",
        );
        return;
      }

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
        Alert.alert(
          "Address error",
          "We could not locate this address on the map. Please double-check it and try again.",
        );
        return;
      }

      const coords = { latitude: result.latitude, longitude: result.longitude };

      if (isUnitBased) {
        const units = parseUnits(listingData.unitName);
        if (units.length === 0) {
          const s3Images = await uploadListingPhotosToS3(
            listingData.photos || [],
          );
          await createListingOnBackend(
            makePayload({ unitName: "Unit 1", coords, images: s3Images }),
          );
        } else {
          const s3Images = await uploadListingPhotosToS3(
            listingData.photos || [],
          );

          for (const u of units) {
            await createListingOnBackend(
              makePayload({
                unitName: u,
                coords,
                images: s3Images,
                description: composeDescription(listingData.description, u),
              }),
            );
          }
        }
      } else {
        const s3Images = await uploadListingPhotosToS3(
          listingData.photos || [],
        );

        // 2) create listing using S3 URLs
        await createListingOnBackend(
          makePayload({
            unitName: undefined,
            buildingLabel: undefined,
            coords,
            images: s3Images, // override
          }),
        );
      }

      router.replace("/(host)/listings");
    } catch (e: any) {
      console.log("Create listing error", e?.response?.data || e);
      Alert.alert(
        "Create failed",
        e?.response?.data?.detail ?? e?.message ?? "Could not create listing",
      );
    }
  };

  const handleSaveDraft = async () => {
    try {
      const query = [
        listingData.address,
        listingData.city,
        listingData.state,
        listingData.pincode,
      ]
        .filter(Boolean)
        .join(", ")
        .trim();

      if (!query) {
        Alert.alert(
          "Address error",
          "Please enter an address / city / state so we can locate it on the map.",
        );
        return;
      }

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
        Alert.alert(
          "Address error",
          "We could not locate this address on the map. Please double-check it and try again.",
        );
        return;
      }

      const coords = { latitude: result.latitude, longitude: result.longitude };

      // ✅ Upload photos once and reuse (so draft is non-local + production safe)
      const s3Images = await uploadListingPhotosToS3(listingData.photos || []);

      if (isUnitBased) {
        const units = parseUnits(listingData.unitName);

        if (units.length === 0) {
          await createListingOnBackend({
            ...makePayload({
              unitName: "Unit 1",
              coords,
              images: s3Images,
              description: composeDescription(
                listingData.description,
                "Unit 1",
              ),
            }),
            status: "draft",
          });
        } else {
          for (const u of units) {
            await createListingOnBackend({
              ...makePayload({
                unitName: u,
                coords,
                images: s3Images,
                description: composeDescription(listingData.description, u),
              }),
              status: "draft",
            });
          }
        }
      } else {
        await createListingOnBackend({
          ...makePayload({
            unitName: undefined,
            buildingLabel: undefined,
            coords,
            images: s3Images,
          }),
          status: "draft",
        });
      }

      router.replace("/(host)/listings");
    } catch (e: any) {
      console.log("Save draft error", e?.response?.data || e);
      Alert.alert(
        "Save draft failed",
        e?.response?.data?.detail ?? e?.message ?? "Could not save draft",
      );
    }
  };

  const jumpToStep = (id: StepId) => {
    const idx = steps.findIndex((s) => s.id === id);
    if (idx >= 0) setCurrentStepIndex(idx);
  };

  // -------- UI (unchanged look) --------
  const renderStepContent = () => {
    switch (currentStep) {
      case "property-type":
        return (
          <PropertyTypeStep
            value={listingData.propertyType}
            onChange={(v) => {
              setListingData((prev) => ({
                ...prev,
                propertyType: v,
                ...(["apartment", "studio", "room", "private room"].includes(
                  v.toLowerCase(),
                )
                  ? {}
                  : { unitName: "", buildingLabel: "" }),
              }));
            }}
          />
        );
      case "location":
        return <LocationStep data={listingData} onChange={updateData} />;
      case "details":
        return <DetailsStep data={listingData} onChange={updateData} />;
      case "hotel-rooms":
        if (!isHotel) return <View />;
        return (
          <HotelRoomsStep
            roomTypes={listingData.hotelRoomTypes}
            onChange={(rt) => updateData({ hotelRoomTypes: rt })}
          />
        );
      case "amenities":
        return (
          <AmenitiesStep
            selected={listingData.amenities}
            onChange={(a) => updateData({ amenities: a })}
          />
        );
      case "photos":
        return (
          <PhotosStep
            photos={listingData.photos}
            onChange={(p) => updateData({ photos: p })}
          />
        );
      case "title-description":
        return (
          <TitleDescriptionStep data={listingData} onChange={updateData} />
        );
      case "pricing":
        return <PricingStep data={listingData} onChange={updateData} />;
      case "rules":
        return <RulesStep data={listingData} onChange={updateData} />;
      case "review":
        return <ReviewStep data={listingData} onEditStep={jumpToStep} />;
      default:
        return <Text>Unknown Step</Text>;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity
            onPress={goBackFromHeader}
            style={styles.headerIconBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ArrowLeft size={22} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {t("host.create_listing.create_listing")}
          </Text>
          <TouchableOpacity
            onPress={handleSaveDraft}
            style={styles.saveDraftBtn}
          >
            <Text style={styles.saveDraftText}>Save Draft</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.headerSubLine}>
          Step {currentStepIndex + 1} of {steps.length}
        </Text>
        <ProgressBar value={progressPercent} />
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        {renderStepContent()}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer} pointerEvents="box-none">
        <View style={styles.footerRow}>
          <TouchableOpacity
            style={[
              styles.navBtn,
              styles.backBtn,
              currentStepIndex === 0 && styles.backBtnEnabled,
            ]}
            onPress={handlePrevious}
          >
            <ArrowLeft size={16} color="#111827" />
            <Text style={styles.backBtnText}>{t("common.back")}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navBtn, styles.nextBtn]}
            onPress={currentStep === "review" ? handleComplete : handleNext}
          >
            <Text style={styles.nextBtnText}>
              {currentStep === "review"
                ? t("host.create_listing.publish_listing")
                : t("common.next")}
            </Text>
            {currentStep !== "review" && (
              <ArrowRight size={16} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

// =========================
// Steps
// =========================

function PropertyTypeStep({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const { t } = useTranslation();
  const items = [
    {
      id: "apartment",
      label: t("host.create_listing.apartment"),
      description: t(
        "host.create_listing.a_place_within_a_multi-unit_building",
      ),
    },
    {
      id: "house",
      label: t("host.create_listing.house"),
      description: t("host.create_listing.a_standalone_home"),
    },
    {
      id: "villa",
      label: t("host.create_listing.villa"),
      description: t("host.create_listing.luxary_standalone_home"),
    },
    {
      id: "hotel",
      label: t("host.create_listing.hotel"),
      description: t("host.create_listing.a_hotel_with_multiple_room_types"),
    },
    {
      id: "studio",
      label: t("host.create_listing.studio"),
      description: t("host.create_listing.small_one_room_place"),
    },
    {
      id: "cottage",
      label: t("host.create_listing.cottage"),
      description: t("host.create_listing.cozy_small_house"),
    },
    {
      id: "room",
      label: t("host.create_listing.private_room"),
      description: t("host.create_listing.a_room_in_a_shared_place"),
    },
  ];

  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>
        {t("host.create_listing.what_type_of_property_is_this")}
      </Text>
      <Text style={styles.stepSubtitle}>
        {t(
          "host.create_listing.choose_the_option_that_best_describes_your_place",
        )}
      </Text>

      <View style={{ gap: 12 }}>
        {items.map((it) => (
          <TouchableOpacity
            key={it.id}
            style={[styles.radioCard]}
            onPress={() => onChange(it.id)}
          >
            <View
              style={[
                styles.radioOuter,
                value === it.id && styles.radioOuterSelected,
              ]}
            >
              {value === it.id && <View style={styles.radioInner} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.radioLabel}>{it.label}</Text>
              <Text style={styles.radioDescription}>{it.description}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function LocationStep({
  data,
  onChange,
}: {
  data: any;
  onChange: (u: any) => void;
}) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();

  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>
        {t("host.create_listing.wheres_your_place_located")}
      </Text>
      <Text style={styles.stepSubtitle}>
        {t(
          "host.create_listing.provide_the_exact_address_to_help_guests_find_your_place",
        )}
      </Text>

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

          {/* Clean inline "select" with modal list */}
          <TouchableOpacity
            style={styles.selectInput}
            onPress={() => setOpen(true)}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text
                style={data.state ? styles.inputText : styles.inputPlaceholder}
              >
                {data.state || "Select State"}
              </Text>
              <ChevronDown size={16} color="#6B7280" />
            </View>
          </TouchableOpacity>

          <Modal
            visible={open}
            transparent
            animationType="fade"
            onRequestClose={() => setOpen(false)}
          >
            <View
              style={{
                flex: 1,
                backgroundColor: "rgba(0,0,0,0.35)",
                justifyContent: "flex-end",
              }}
            >
              <View
                style={{
                  backgroundColor: "white",
                  borderTopLeftRadius: 16,
                  borderTopRightRadius: 16,
                  maxHeight: "60%",
                }}
              >
                <View
                  style={{
                    padding: 14,
                    borderBottomWidth: 1,
                    borderBottomColor: "#E5E7EB",
                  }}
                >
                  <Text style={{ fontSize: 16, fontWeight: "700" }}>
                    {t("host.create_listing.select_state")}
                  </Text>
                </View>
                <ScrollView contentContainerStyle={{ padding: 12 }}>
                  {INDIAN_STATES.map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={{ paddingVertical: 12 }}
                      onPress={() => {
                        onChange({ state: s });
                        setOpen(false);
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 16,
                          color: s === data.state ? "#111827" : "#374151",
                          fontWeight: s === data.state ? "700" : "500",
                        }}
                      >
                        {s}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <View style={{ padding: 12 }}>
                  <TouchableOpacity
                    style={[styles.navBtn, styles.backBtn]}
                    onPress={() => setOpen(false)}
                  >
                    <Text style={styles.backBtnText}>{t("common.close")}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
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
          onChangeText={(t) => onChange({ pincode: t.replace(/[^0-9]/g, "") })}
        />
      </View>
    </View>
  );
}

function DetailsStep({
  data,
  onChange,
}: {
  data: any;
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
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>
        {t("host.create_listing.tell_us_about_your_place")}
      </Text>
      <Text style={styles.stepSubtitle}>
        {t("host.create_listing.basic_property_details")}
      </Text>

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
  );
}

function HotelRoomsStep({
  roomTypes,
  onChange,
}: {
  roomTypes: HotelRoomTypeDraft[];
  onChange: (next: HotelRoomTypeDraft[]) => void;
}) {
  const { t } = useTranslation();

  const addRoomType = () => {
    onChange([
      ...(roomTypes || []),
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
    ]);
  };

  const update = (idx: number, patch: Partial<HotelRoomTypeDraft>) => {
    const next = [...(roomTypes || [])];
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };

  const remove = (idx: number) => {
    const next = [...(roomTypes || [])];
    next.splice(idx, 1);
    onChange(next);
  };

  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>
        {t("host.create_listing.hotel_room_types")}
      </Text>
      <Text style={styles.stepSubtitle}>
        {t("host.create_listing.hotel_room_types_subtitle")}
      </Text>

      <View style={{ gap: 12 }}>
        {(roomTypes || []).map((rt, idx) => (
          <View key={idx} style={styles.card}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
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

            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                {t("host.create_listing.room_type_name")}
              </Text>
              <TextInput
                style={styles.input}
                placeholder={t(
                  "host.create_listing.room_type_name_placeholder",
                )}
                value={rt.name}
                onChangeText={(v) => update(idx, { name: v })}
              />
            </View>

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>
                  {t("host.create_listing.floor_optional")}
                </Text>
                <TextInput
                  style={styles.input}
                  keyboardType="number-pad"
                  placeholder="e.g., 4"
                  value={rt.floor === null ? "" : String(rt.floor)}
                  onChangeText={(v) =>
                    update(idx, { floor: v ? parseInt(v, 10) : null })
                  }
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>
                  {t("host.create_listing.quantity")}
                </Text>
                <TextInput
                  style={styles.input}
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

            <View style={styles.row}>
              <View style={{ flex: 1, justifyContent: "flex-end" }}>
                <Text style={styles.label}>
                  {t("host.create_listing.price_per_night_optional")}
                </Text>
                <TextInput
                  style={styles.input}
                  keyboardType="number-pad"
                  placeholder={t(
                    "host.create_listing.leave_empty_to_use_listing_price",
                  )}
                  value={rt.price}
                  onChangeText={(v) => update(idx, { price: v })}
                />
              </View>
              <View style={{ flex: 1, justifyContent: "flex-end" }}>
                <Text style={styles.label}>
                  {t("host.create_listing.max_guests")}
                </Text>
                <TextInput
                  style={styles.input}
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

            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                {t("host.create_listing.room_description_optional")}
              </Text>
              <TextInput
                style={[styles.input, { height: 80, textAlignVertical: "top" }]}
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
    </View>
  );
}

function AmenitiesStep({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (a: string[]) => void;
}) {
  const { t } = useTranslation();
  const baseList = [
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
  ];

  // Local state so we can extend the list with custom amenities
  const [options, setOptions] = React.useState<string[]>(baseList);
  const [customAmenity, setCustomAmenity] = React.useState("");

  const toggle = (a: string) =>
    onChange(
      selected.includes(a) ? selected.filter((x) => x !== a) : [...selected, a],
    );

  const addCustomAmenity = () => {
    const trimmed = customAmenity.trim();
    if (!trimmed) return;

    // Add to options if it's not already there
    setOptions((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));

    // Auto-select it
    if (!selected.includes(trimmed)) {
      onChange([...selected, trimmed]);
    }

    setCustomAmenity("");
  };

  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>
        {t("host.create_listing.what_amenities_do_you_offer")}
      </Text>
      <Text style={styles.stepSubtitle}>
        {t("host.create_listing.select_all_available_amenities")}
      </Text>

      <View style={styles.amenitiesGrid}>
        {options.map((a) => {
          const on = selected.includes(a);
          return (
            <TouchableOpacity
              key={a}
              style={[styles.amenityCard, on && styles.amenityCardOn]}
              onPress={() => toggle(a)}
            >
              <Text style={[styles.amenityText, on && styles.amenityTextOn]}>
                {a}
              </Text>
              {on && <Check size={16} color="white" />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Add custom amenity */}
      <View style={[styles.inputGroup, { marginTop: 16 }]}>
        <Text style={styles.label}>
          {t("host.create_listing.add_another_amenity")}
        </Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="e.g., Smart lock, Garden access"
            value={customAmenity}
            onChangeText={setCustomAmenity}
            returnKeyType="done"
            onSubmitEditing={addCustomAmenity}
          />
          <TouchableOpacity
            style={[styles.navBtn, styles.backBtn]}
            onPress={addCustomAmenity}
          >
            <Text style={styles.backBtnText}>{t("listing.add")}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.inputHint}>
          {t("host.create_listing.new_amenities_will_be_added_to_the_list")}
        </Text>
      </View>
    </View>
  );
}

function PhotosStep({
  photos,
  onChange,
}: {
  photos: string[];
  onChange: (p: string[]) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const { t } = useTranslation();

  const openPicker = () => setPickerOpen(true);

  const onConfirmPicker = (uris: string[]) => {
    if (!uris?.length) return setPickerOpen(false);
    onChange([...(photos || []), ...uris]);
    setPickerOpen(false);
  };

  const remove = (i: number) => onChange(photos.filter((_, idx) => idx !== i));

  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>
        {t("host.create_listing.add_property_photos")}
      </Text>
      <Text style={styles.stepSubtitle}>
        {t(
          "host.create_listing.add_at_least_5_high_quality_photos_first_photo_is_the_cover",
        )}
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

        <TouchableOpacity style={styles.photoAdd} onPress={openPicker}>
          <Upload size={30} color="#6B7280" />
          <Text style={styles.photoAddText}>
            {t("host.create_listing.upload_photos")}
          </Text>
        </TouchableOpacity>
      </View>

      {!!photos.length && (
        <Text style={styles.photoCount}>
          {photos.length} photo{photos.length !== 1 ? "s" : ""} uploaded
        </Text>
      )}

      {/* Mount modal OUTSIDE the grid */}
      <GalleryPickerModal
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onConfirm={onConfirmPicker}
        max={0} // unlimited; set e.g. 20 to cap
      />
    </View>
  );
}

function TitleDescriptionStep({
  data,
  onChange,
}: {
  data: any;
  onChange: (u: any) => void;
}) {
  const isUnitBased = ["apartment", "studio", "room", "private room"].includes(
    (data.propertyType || "").toLowerCase(),
  );
  const { t } = useTranslation();

  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>
        {t("host.create_listing.title_and_description")}
      </Text>
      <Text style={styles.stepSubtitle}>
        {t("host.create_listing.make_your_listing_appealing")}
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

      {isUnitBased && (
        <>
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
            <Text style={styles.label}>Unit Number(s)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., A-203 or A-101, A-102"
              value={data.unitName}
              onChangeText={(t) => onChange({ unitName: t })}
            />
            <Text style={styles.inputHint}>
              {t("host.create_listing.this_will_be_shown")}
            </Text>
          </View>
        </>
      )}

      <View style={styles.inputGroup}>
        <Text style={styles.label}>{t("host.create_listing.description")}</Text>
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

      <View style={styles.tipsCard}>
        <Text style={styles.tipsTitle}>{t("host.create_listing.tips")}:</Text>
        <Text style={styles.tipsItem}>
          • {t("host.create_listing.highlight_unique_features")}
        </Text>
        <Text style={styles.tipsItem}>
          • {t("host.create_listing.mention_nearby_attractions")}
        </Text>
        <Text style={styles.tipsItem}>
          • {t("host.create_listing.describe_neighborhood")}
        </Text>
      </View>
    </View>
  );
}

function PricingStep({
  data,
  onChange,
}: {
  data: any;
  onChange: (u: any) => void;
}) {
  const { t } = useTranslation();
  const Price = ({ label, placeholder, value, onUpdate, hint }: any) => (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.priceRow}>
        <Text style={styles.currency}>₹</Text>
        <TextInput
          style={styles.priceInput}
          placeholder={placeholder}
          keyboardType="numeric"
          value={value}
          onChangeText={onUpdate}
        />
      </View>
      {!!hint && <Text style={styles.inputHint}>{hint}</Text>}
    </View>
  );

  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>
        {t("host.create_listing.set_your_pricing")}
      </Text>
      <Text style={styles.stepSubtitle}>
        {t("host.create_listing.you_can_change_this_later")}
      </Text>

      <Price
        label={t("host.create_listing.base_price_per_night")}
        placeholder="2000"
        value={data.basePrice}
        onUpdate={(t: string) =>
          onChange({ basePrice: t.replace(/[^0-9]/g, "") })
        }
      />
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
      <Price
        label={t("host.create_listing.cleaning_fee")}
        placeholder="500"
        value={data.cleaningFee}
        onUpdate={(t: string) =>
          onChange({ cleaningFee: t.replace(/[^0-9]/g, "") })
        }
      />
    </View>
  );
}

const BASE_RULES = [
  "No smoking",
  "No pets",
  "No parties or events",
  "Suitable for children",
];

// put near top of file (outside component)
function RulesStep({
  data,
  onChange,
}: {
  data: any; // listingData; includes checkIn, checkOut, rules, offers, etc.
  onChange: (u: any) => void;
}) {
  const { t } = useTranslation();
  const [customRule, setCustomRule] = React.useState("");
  const [offerInput, setOfferInput] = React.useState("");

  const rules: string[] = data.rules || [];
  const offers: string[] = data.offers || [];

  const customRules = React.useMemo(
    () => rules.filter((r) => !BASE_RULES.includes(r)),
    [rules],
  );
  const allRules = React.useMemo(
    () => [...BASE_RULES, ...customRules],
    [customRules],
  );

  const isOn = (r: string) => rules.includes(r);
  const toggle = (r: string) =>
    onChange({
      rules: isOn(r) ? rules.filter((x) => x !== r) : [...rules, r],
    });

  const addCustomRule = () => {
    const r = customRule.trim();
    if (!r) return;
    if (!allRules.includes(r) || !isOn(r)) {
      onChange({ rules: [...rules.filter(Boolean), r] }); // ensure it appears checked
    }
    setCustomRule("");
  };

  // User-defined "What this place offers"
  const addOffer = () => {
    const offerText = offerInput.trim();
    if (!offerText) return;
    onChange({ offers: [...offers, offerText] });
    setOfferInput("");
  };

  const removeOffer = (idx: number) => {
    onChange({ offers: offers.filter((_, i) => i !== idx) });
  };

  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>
        {t("host.create_listing.set_house_rules")}
      </Text>
      <Text style={styles.stepSubtitle}>
        {t("host.create_listing.help_guests_know_what_to_expect")}
      </Text>

      {/* Times */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>{t("host.create_listing.check-in")}</Text>
        <TextInput
          style={styles.input}
          placeholder="14:00"
          value={data.checkIn ?? ""}
          onChangeText={(v) => onChange({ checkIn: v })}
          keyboardType="numbers-and-punctuation"
          returnKeyType="done"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>{t("host.create_listing.check-out")}</Text>
        <TextInput
          style={styles.input}
          placeholder="11:00"
          value={data.checkOut ?? ""}
          onChangeText={(v) => onChange({ checkOut: v })}
          keyboardType="numbers-and-punctuation"
          returnKeyType="done"
        />
      </View>

      {/* Divider */}
      <View
        style={{ height: 1, backgroundColor: "#E5E7EB", marginVertical: 16 }}
      />

      {/* What this place offers (user-defined) */}
      <Text style={styles.label}>{t("listing.what_this_place_offers")}</Text>

      {offers.length > 0 && (
        <View style={{ marginTop: 8, marginBottom: 12, gap: 8 }}>
          {offers.map((i, idx) => (
            <View
              key={`${t}-${idx}`}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 999,
                backgroundColor: "#F3F4F6",
              }}
            >
              <Text style={{ flex: 1, color: "#111827" }}>{i}</Text>
              <TouchableOpacity onPress={() => removeOffer(idx)}>
                <Text style={{ color: "#6B7280", fontSize: 12 }}>
                  {t("host.remove")}
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Add new offer line */}
      <View style={[styles.inputGroup, { marginTop: 4 }]}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Add a short line about your place"
            value={offerInput}
            onChangeText={setOfferInput}
            returnKeyType="done"
            onSubmitEditing={addOffer}
          />
          <TouchableOpacity
            style={[styles.navBtn, styles.backBtn]}
            onPress={addOffer}
          >
            <Text style={styles.backBtnText}>{t("listing.add")}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Divider before rules list */}
      <View
        style={{ height: 1, backgroundColor: "#E5E7EB", marginVertical: 16 }}
      />

      {/* Rules list */}
      <Text style={styles.label}>
        {t("host.create_listing.set_house_rules")}
      </Text>
      <View style={{ gap: 8 }}>
        {allRules.map((r) => {
          const on = isOn(r);
          const isCustom = !BASE_RULES.includes(r);
          return (
            <TouchableOpacity
              key={r}
              style={[styles.ruleCard, on && styles.ruleCardOn]}
              onPress={() => toggle(r)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Text style={[styles.ruleText, on && styles.ruleTextOn]}>
                  {r}
                </Text>
                {isCustom && (
                  <View
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 999,
                      backgroundColor: on
                        ? "rgba(255,255,255,0.15)"
                        : "#EEF2FF",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        color: on ? "#FFFFFF" : "#3730A3",
                      }}
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

      {/* Add your own rule */}
      <View style={[styles.inputGroup, { marginTop: 12 }]}>
        <Text style={styles.label}>
          {t("host.create_listing.add_your_own_rule")}
        </Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="e.g., Quiet hours after 10 PM"
            value={customRule}
            onChangeText={setCustomRule}
            returnKeyType="done"
            onSubmitEditing={addCustomRule}
          />
          <TouchableOpacity
            style={[styles.navBtn, styles.backBtn]}
            onPress={addCustomRule}
          >
            <Text style={styles.backBtnText}>{t("listing.add")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function ReviewStep({
  data,
  onEditStep,
}: {
  data: any;
  onEditStep: (id: StepId) => void;
}) {
  type RowProps = {
    label: string;
    value: string | number;
    stacked?: boolean;
  };
  const { t } = useTranslation();

  const Row = ({ label, value, stacked }: RowProps) => (
    <View
      style={[
        styles.reviewRow,
        stacked && { flexDirection: "column", alignItems: "flex-start" },
      ]}
    >
      <Text style={styles.reviewLabel}>{label}:</Text>
      <Text
        style={[
          styles.reviewValue,
          stacked && { textAlign: "left", marginTop: 2 },
        ]}
      >
        {value}
      </Text>
    </View>
  );

  const isUnitBased = ["apartment", "studio", "room", "private room"].includes(
    (data.propertyType || "").toLowerCase(),
  );

  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>
        {t("host.create_listing.review_your_listing")}
      </Text>
      <Text style={styles.stepSubtitle}>Ensure everything looks good</Text>

      {/* ✅ Property details card */}
      <View style={styles.reviewCard}>
        <View style={styles.reviewCardHeader}>
          <Text style={styles.reviewSection}>Property Details</Text>
          <TouchableOpacity onPress={() => onEditStep("details")}>
            <Text style={styles.reviewEdit}>{t("common.edit")}</Text>
          </TouchableOpacity>
        </View>

        <Row label="Type" value={(data.propertyType || "Not set") as string} />
        <Row
          label={t("listing.location")}
          value={`${data.city || "N/A"}, ${data.state || "N/A"}`}
        />

        {/* Address on its own wrapped block */}
        <Row
          label={t("settings.edit_profile.address")}
          value={(data.address || "Not set") as string}
          stacked
        />

        {isUnitBased && (
          <Row
            label={t("host.create_listing.unit")}
            value={data.unitName || "N/A"}
          />
        )}
        <Row label={t("listing.guests")} value={data.guests} />
        <Row label={t("listing.bedrooms")} value={data.bedrooms} />
        <Row label={t("listing.bathrooms")} value={data.bathrooms} />
      </View>

      <View style={styles.reviewCard}>
        <View style={styles.reviewCardHeader}>
          <Text style={styles.reviewSection}>{t("listing.amenities")}</Text>
          <TouchableOpacity onPress={() => onEditStep("amenities")}>
            <Text style={styles.reviewEdit}>{t("common.edit")}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.amenitiesReviewWrap}>
          {Array.isArray(data.amenities) && data.amenities.length ? (
            data.amenities.map((a: string) => (
              <View key={a} style={styles.amenityBadge}>
                <Text style={styles.amenityBadgeText}>{a}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.muted}>
              {t("host.create_listing.no_amenities_selected")}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.reviewCard}>
        <View style={styles.reviewCardHeader}>
          <Text style={styles.reviewSection}>
            {t("host.create_listing.photos")} ({(data.photos || []).length})
          </Text>
          <TouchableOpacity onPress={() => onEditStep("photos")}>
            <Text style={styles.reviewEdit}>{t("common.edit")}</Text>
          </TouchableOpacity>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginLeft: -4 }}
        >
          {Array.isArray(data.photos) && data.photos.length ? (
            data.photos.map((u: string, i: number) => (
              <Image key={i} source={{ uri: u }} style={styles.photoThumb} />
            ))
          ) : (
            <Text style={styles.muted}>
              {t("host.create_listing.no_photos_uploaded")}
            </Text>
          )}
        </ScrollView>
      </View>

      <View style={styles.reviewCard}>
        <View style={styles.reviewCardHeader}>
          <Text style={styles.reviewSection}>Pricing</Text>
          <TouchableOpacity onPress={() => onEditStep("pricing")}>
            <Text style={styles.reviewEdit}>{t("common.edit")}</Text>
          </TouchableOpacity>
        </View>
        <Row
          label={t("host.create_listing.base_price_per_night")}
          value={`₹${data.basePrice || "0"} / night`}
        />
        {!!data.cleaningFee && (
          <Row
            label={t("host.create_listing.cleaning_fee")}
            value={`₹${data.cleaningFee}`}
          />
        )}
      </View>

      <View style={styles.reviewCard}>
        <View style={styles.reviewCardHeader}>
          <Text style={styles.reviewSection}>
            {t("host.create_listing.description")}
          </Text>
          <TouchableOpacity onPress={() => onEditStep("title-description")}>
            <Text style={styles.reviewEdit}>{t("common.edit")}</Text>
          </TouchableOpacity>
        </View>
        <Text style={{ color: "#111827" }}>
          {composeDescription(
            data.description,
            isUnitBased
              ? (data.unitName || "").split(",")[0]?.trim()
              : undefined,
          )}
        </Text>
      </View>

      <View style={styles.reviewCard}>
        <View style={styles.reviewCardHeader}>
          <Text style={styles.reviewSection}>{t("listing.house_rules")}</Text>
          <TouchableOpacity onPress={() => onEditStep("rules")}>
            <Text style={styles.reviewEdit}>{t("common.edit")}</Text>
          </TouchableOpacity>
        </View>

        <Row label={t("listing.check_in")} value={data.checkIn || "—"} />
        <Row label={t("listing.check_out")} value={data.checkOut || "—"} />

        <View style={{ height: 8 }} />

        {Array.isArray(data.rules) && data.rules.length > 0 ? (
          <View style={styles.ruleChipWrap}>
            {data.rules.map((r: string) => (
              <View key={r} style={styles.ruleChip}>
                <Text style={styles.ruleChipText}>{r}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={{ color: "#6B7280" }}>
            {t("host.create_listing.no_rules_added")}
          </Text>
        )}
      </View>

      <View style={styles.publishCard}>
        <Check size={20} color="#15803D" />
        <Text style={styles.publishText}>
          {t("host.create_listing.ready_to_publish")}
        </Text>
      </View>
    </View>
  );
}

// =========================
// Styles (unchanged look)
// =========================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },

  header: {
    backgroundColor: "white",
    paddingTop: 8,
    paddingBottom: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    zIndex: 2,
    borderBottomColor: "#E5E7EB",
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerIconBtn: { padding: 6, borderRadius: 10 },
  headerTitle: { fontSize: 18, fontWeight: "600", color: "#111827" },
  saveDraftBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
  },
  saveDraftText: { color: "#111827", fontWeight: "600" },
  headerSubLine: { marginTop: 8, fontSize: 13, color: "#6B7280" },

  progressWrap: { marginTop: 8 },
  progressTrack: { height: 3, backgroundColor: "#E5E7EB", borderRadius: 999 },
  progressBar: { height: 3, backgroundColor: "#111827", borderRadius: 999 },

  scroll: { flex: 1, backgroundColor: "#F9FAFB" },
  scrollContent: { padding: 16, paddingBottom: 100 },

  stepContainer: { gap: 14 },
  stepTitle: { fontSize: 22, fontWeight: "700", color: "#111827" },
  stepSubtitle: { fontSize: 15, color: "#6B7280", marginBottom: 6 },

  // Inputs
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
    // same visual as your TextInput
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,

    // center text like a real input
    height: 46,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  // Radio cards
  radioCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#B0B0B0",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  radioOuterSelected: { borderColor: "#111827" },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#111827",
  },
  radioLabel: { fontSize: 16, fontWeight: "600", color: "#111827" },
  radioDescription: { fontSize: 14, color: "#6B7280", marginTop: 2 },

  // Counters
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

  // Amenities
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

  // Photos
  photosGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
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

  textArea: { height: 120, textAlignVertical: "top", paddingTop: 10 },
  charCount: {
    fontSize: 12,
    color: "#9CA3AF",
    textAlign: "right",
    marginTop: 4,
  },

  tipsCard: {
    marginTop: 8,
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE",
    borderWidth: 1,
    padding: 16,
    borderRadius: 12,
  },
  tipsTitle: { fontWeight: "700", color: "#1E40AF", marginBottom: 8 },
  tipsItem: { color: "#1D4ED8", marginBottom: 4 },

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
  inputHint: { fontSize: 12, color: "#9CA3AF", marginTop: 4 },
  divider: { height: 1, backgroundColor: "#E5E7EB", marginVertical: 16 },

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

  reviewCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 16,
    marginBottom: 12,
  },
  reviewSection: { fontSize: 16, fontWeight: "600", marginBottom: 10 },
  reviewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  reviewLabel: { fontSize: 14, color: "#6B7280" },
  reviewValue: { fontSize: 14, fontWeight: "600", textTransform: "capitalize" },
  amenitiesReviewWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  amenityBadge: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  amenityBadgeText: { fontSize: 13 },
  photoThumb: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: "#F3F4F6",
  },
  muted: { color: "#9CA3AF" },

  publishCard: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  publishText: { color: "#065F46", flex: 1 },

  footer: {
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  footerRow: { flexDirection: "row", gap: 12 },
  navBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  backBtn: { backgroundColor: "#F3F4F6", paddingHorizontal: 18 },
  backBtnEnabled: { backgroundColor: "#F3F4F6" },
  backBtnText: { color: "#111827", fontWeight: "700" },
  nextBtn: { flex: 1, backgroundColor: "#111827" },
  nextBtnText: { color: "#fff", fontWeight: "800" },

  ruleChipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  ruleChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#ECFDF5", // soft green
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  ruleChipText: {
    color: "#065F46",
    fontSize: 13,
    fontWeight: "600",
    // marginLeft: 4, // uncomment if you show a check icon
  },
  reviewCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  reviewEdit: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111827",
  },
  // ✅ Hotel room types UI
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
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

// Minimal placeholders (unchanged)
const Select = ({ children, ...props }: any) => (
  <View {...props}>{children}</View>
);
const SelectTrigger = ({ children, ...props }: any) => (
  <TouchableOpacity {...props}>
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      {children}
      <ChevronDown size={16} />
    </View>
  </TouchableOpacity>
);
const SelectValue = ({ placeholder }: any) => (
  <Text style={styles.inputPlaceholder}>{placeholder}</Text>
);
const SelectContent = ({ children, ...props }: any) => (
  <View {...props}>{children}</View>
);
const SelectItem = ({ children, value, ...props }: any) => (
  <TouchableOpacity {...props}>
    <Text>{children}</Text>
  </TouchableOpacity>
);
