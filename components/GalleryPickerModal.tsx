// components/GalleryPickerModal.tsx
import { Image } from "expo-image";
import * as MediaLibrary from "expo-media-library";
import { X } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";

type Props = {
  visible: boolean;
  onClose: () => void;
  onConfirm: (uris: string[]) => void; // return selected URIs
  max?: number; // optional cap, default unlimited
};

type Asset = MediaLibrary.Asset;

export default function GalleryPickerModal({
  visible,
  onClose,
  onConfirm,
  max = 0,
}: Props) {
  const [status, requestPermission] = MediaLibrary.usePermissions();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [endCursor, setEndCursor] = useState<string | null>(null);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // NEW: prevent double-taps on Add while resolving
  const [confirming, setConfirming] = useState(false);

  // reset selection when reopened/closed
  useEffect(() => {
    if (!visible) {
      setSelected(new Set());
      setConfirming(false);
    }
  }, [visible]);

  const toggle = useCallback(
    (asset: Asset) => {
      const next = new Set(selected);
      if (next.has(asset.id)) next.delete(asset.id);
      else {
        if (max > 0 && next.size >= max) return; // enforce cap
        next.add(asset.id);
      }
      setSelected(next);
    },
    [selected, max]
  );

  // Keep selected asset objects (instead of URIs)
  const selectedAssets = useMemo(
    () => assets.filter((a) => selected.has(a.id)),
    [assets, selected]
  );

  // NEW: resolve selected assets to real file:// URIs (fixes iOS ph:// issue)
  const resolveSelectedFileUris = useCallback(async (): Promise<string[]> => {
    const out: string[] = [];

    for (const a of selectedAssets) {
      // Android often already gives file:// content URIs; keep if already file://
      if (a.uri?.startsWith("file://")) {
        out.push(a.uri);
        continue;
      }

      // On iOS MediaLibrary Asset uri can be ph://...; resolve via getAssetInfoAsync
      try {
        const info = await MediaLibrary.getAssetInfoAsync(a.id);
        const local = info.localUri || info.uri; // localUri is ideal
        if (local) {
          out.push(local);
        } else {
          // last resort: fall back to original uri (may still fail later, but better than empty)
          out.push(a.uri);
        }
      } catch {
        // if something goes wrong, fall back
        if (a.uri) out.push(a.uri);
      }
    }

    // remove empties
    return out.filter(Boolean);
  }, [selectedAssets]);

  const load = useCallback(
    async (cursor?: string | null) => {
      if (loading) return;
      setLoading(true);
      try {
        const res = await MediaLibrary.getAssetsAsync({
          first: 60,
          mediaType: "photo",
          sortBy: [["creationTime", false]],
          after: cursor ?? undefined,
        });
        setAssets((prev) => (cursor ? [...prev, ...res.assets] : res.assets));
        setEndCursor(res.endCursor ?? null);
        setHasNextPage(res.hasNextPage);
      } finally {
        setLoading(false);
      }
    },
    [loading]
  );

  useEffect(() => {
    if (!visible) return;
    (async () => {
      if (status?.granted) {
        await load(null);
      } else {
        const r = await requestPermission();
        if (r?.granted) await load(null);
      }
    })();
  }, [visible, status?.granted, requestPermission, load]);

  const renderItem = ({ item }: { item: Asset }) => {
    const isOn = selected.has(item.id);
    return (
      <Pressable onPress={() => toggle(item)} style={styles.cell}>
        <Image source={{ uri: item.uri }} style={styles.thumb} />
        {isOn && (
          <View style={styles.checkBadge}>
            <Text style={styles.checkText}>✓</Text>
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <Modal visible={visible} onRequestClose={onClose} animationType="slide">
      <SafeAreaView style={styles.wrap}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={onClose}
            hitSlop={10}
            style={styles.headerBtn}
            accessibilityLabel="Close"
          >
            <X size={22} color="#111827" />
          </Pressable>
          <Text style={styles.title}>Select photos</Text>

          <Pressable
            disabled={selected.size === 0 || confirming}
            onPress={async () => {
              if (selected.size === 0) return;
              if (confirming) return;

              try {
                setConfirming(true);
                const uris = await resolveSelectedFileUris();
                onConfirm(uris);
              } finally {
                setConfirming(false);
              }
            }}
            style={[
              styles.confirmBtn,
              (selected.size === 0 || confirming) && { opacity: 0.6 },
            ]}
            accessibilityLabel="Add selected photos"
          >
            <Text style={styles.confirmText}>
              {confirming
                ? "Adding..."
                : `Add${selected.size ? ` (${selected.size})` : ""}`}
            </Text>
          </Pressable>
        </View>

        {/* Grid */}
        {!status?.granted ? (
          <View style={styles.center}>
            <Text style={{ color: "#6B7280" }}>
              Grant photo access to pick images.
            </Text>
          </View>
        ) : (
          <>
            <FlatList
              data={assets}
              keyExtractor={(a) => a.id}
              numColumns={3}
              renderItem={renderItem}
              contentContainerStyle={styles.grid}
              onEndReached={() =>
                hasNextPage && !loading ? load(endCursor) : undefined
              }
              onEndReachedThreshold={0.5}
            />
            {loading && (
              <View style={styles.loading}>
                <ActivityIndicator />
              </View>
            )}
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#FFFFFF" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerBtn: {
    padding: 6,
    borderRadius: 10,
  },
  title: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  confirmBtn: {
    backgroundColor: "#111827",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  confirmText: { color: "#FFF", fontWeight: "800" },

  grid: { padding: 6 },
  cell: {
    width: "33.3333%",
    aspectRatio: 1,
    padding: 4,
  },
  thumb: {
    width: "100%",
    height: "100%",
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
  },
  checkBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(17,24,39,0.9)",
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  checkText: { color: "#fff", fontWeight: "800", fontSize: 12 },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  loading: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 16 : 8,
    alignSelf: "center",
  },
});
