import { useTranslation } from 'react-i18next';
// app/listing/[id]/reviews.tsx
import { apiGet } from '@/services/api';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  ChevronLeft,
  MessageSquare,
  Search,
  SlidersHorizontal,
  Star,
  TrendingUp,
} from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ListingReviewApi = {
  id: string | number;
  rating: number;
  comment?: string | null;
  created_at?: string;
  guest?: { id: string | number; name?: string | null; email?: string | null };
};

type ListingReviewsResponse = {
  count: number;
  reviews: ListingReviewApi[];
};

type Review = {
  id: string;
  guestName: string;
  guestAvatar: string;
  rating: number;
  comment: string;
  date: Date;
};

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

// Helper to determine which star bucket a rating belongs to
// Rounds to nearest whole number: 4.5 rounds to 5, 4.4 rounds to 4, etc.
const getRatingBucket = (rating: number): 1 | 2 | 3 | 4 | 5 => {
  const rounded = Math.round(rating);
  return Math.max(1, Math.min(5, rounded)) as 1 | 2 | 3 | 4 | 5;
};

function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  const safe = clamp(rating, 0, 5);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {[1, 2, 3, 4, 5].map((star) => {
        const full = safe >= star;
        const half = !full && safe >= star - 0.5;

        return (
          <View key={star} style={{ width: size, height: size, marginRight: 2 }}>
            <Star size={size} color="#D1D5DB" fill="transparent" />
            {full && (
              <View style={{ position: 'absolute', left: 0, top: 0 }}>
                <Star size={size} color="#F59E0B" fill="#F59E0B" />
              </View>
            )}
            {!full && half && (
              <View
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: size / 2,
                  height: size,
                  overflow: 'hidden',
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

export default function ListingReviewsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id, listingName } = useLocalSearchParams<{ id: string; listingName?: string }>();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Review[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterRating, setFilterRating] = useState<'all' | '5' | '4' | '3' | '2' | '1'>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'oldest' | 'highest' | 'lowest'>('recent');
  const [showFilters, setShowFilters] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiGet<ListingReviewsResponse>(`/v1/listings/${id}/reviews`);

      const mapped: Review[] = (res?.reviews ?? []).map((r) => {
        const guestLabel =
          r.guest?.name?.trim() ||
          r.guest?.email?.trim() ||
          'Guest';
        const guestId = String(r.guest?.id ?? r.id ?? '1');
        const avatar = `https://i.pravatar.cc/150?u=${encodeURIComponent(guestId)}`;

        const createdAt = r.created_at ? new Date(r.created_at) : new Date();

        return {
          id: String(r.id),
          guestName: guestLabel,
          guestAvatar: avatar,
          rating: Number(r.rating ?? 0),
          comment: String(r.comment ?? ''),
          date: createdAt,
        };
      });

      setRows(mapped);
    } catch (e) {
      console.error('Failed to load listing reviews', e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const totalReviews = rows.length;
    const avg =
      totalReviews === 0 ? 0 : rows.reduce((sum, r) => sum + r.rating, 0) / totalReviews;

    // Fixed: Use getRatingBucket to properly round ratings
    const distribution = {
      5: rows.filter((r) => getRatingBucket(r.rating) === 5).length,
      4: rows.filter((r) => getRatingBucket(r.rating) === 4).length,
      3: rows.filter((r) => getRatingBucket(r.rating) === 3).length,
      2: rows.filter((r) => getRatingBucket(r.rating) === 2).length,
      1: rows.filter((r) => getRatingBucket(r.rating) === 1).length,
    };

    return {
      totalReviews,
      averageRating: avg.toFixed(1),
      ratingDistribution: distribution,
    };
  }, [rows]);

  const filteredReviews = useMemo(() => {
    let filtered = [...rows];

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      filtered = filtered.filter((r) => {
        return (
          r.guestName.toLowerCase().includes(q) ||
          r.comment.toLowerCase().includes(q)
        );
      });
    }

    // Fixed: Use getRatingBucket for filtering too
    if (filterRating !== 'all') {
      const targetBucket = parseInt(filterRating, 10) as 1 | 2 | 3 | 4 | 5;
      filtered = filtered.filter((r) => getRatingBucket(r.rating) === targetBucket);
    }

    switch (sortBy) {
      case 'recent':
        filtered.sort((a, b) => b.date.getTime() - a.date.getTime());
        break;
      case 'oldest':
        filtered.sort((a, b) => a.date.getTime() - b.date.getTime());
        break;
      case 'highest':
        filtered.sort((a, b) => b.rating - a.rating);
        break;
      case 'lowest':
        filtered.sort((a, b) => a.rating - b.rating);
        break;
    }

    return filtered;
  }, [rows, searchQuery, filterRating, sortBy]);

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerIconBtn} onPress={() => router.back()}>
          <ChevronLeft size={26} color="#111827" />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>All Reviews</Text>
          <Text style={styles.headerSub}>
            {filteredReviews.length} review{filteredReviews.length !== 1 ? 's' : ''}{listingName ? ` · ${listingName}` : ''}
          </Text>
        </View>

        <View style={{ width: 40 }} />
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <View style={styles.statTopRow}>
            <Star size={18} color="#FBBF24" fill="#FBBF24" />
            <Text style={styles.statValue}>{stats.averageRating}</Text>
          </View>
          <Text style={styles.statLabel}>{t('reviews.avg_rating')}</Text>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statTopRow}>
            <MessageSquare size={18} color="#2563EB" />
            <Text style={styles.statValue}>{stats.totalReviews}</Text>
          </View>
          <Text style={styles.statLabel}>{t('reviews.total_reviews')}</Text>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statTopRow}>
            <TrendingUp size={18} color="#16A34A" />
            <Text style={styles.statValue}>{stats.ratingDistribution[5]}</Text>
          </View>
          <Text style={styles.statLabel}>{t('reviews.five_star_reviews')}</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Search size={16} color="#6B7280" />
        <TextInput
          style={styles.searchInput}
          placeholder={t('reviews.search_placeholder')}
          placeholderTextColor="#9CA3AF"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <TouchableOpacity style={styles.filterBtn} onPress={() => setShowFilters(true)}>
          <SlidersHorizontal size={18} color="#111827" />
        </TouchableOpacity>
      </View>

      {/* Rating Distribution */}
      <View style={styles.distWrap}>
        <Text style={styles.distTitle}>{t('reviews.rating_distribution')}</Text>
        {[5, 4, 3, 2, 1].map((rating) => {
          const count = stats.ratingDistribution[rating as 1 | 2 | 3 | 4 | 5] || 0;
          const pct = stats.totalReviews === 0 ? 0 : (count / stats.totalReviews) * 100;

          return (
            <View key={rating} style={styles.distRow}>
              <View style={styles.distLeft}>
                <Text style={styles.distNum}>{rating}</Text>
                <Star size={12} color="#FBBF24" fill="#FBBF24" />
              </View>
              <View style={styles.distBarBg}>
                <View style={[styles.distBarFill, { width: `${pct}%` }]} />
              </View>
              <Text style={styles.distCount}>{count}</Text>
            </View>
          );
        })}
      </View>

      {/* List */}
      <ScrollView contentContainerStyle={styles.listWrap}>
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator />
            <Text style={{ marginTop: 10, color: '#6B7280' }}>Loading reviews…</Text>
          </View>
        ) : filteredReviews.length === 0 ? (
          <View style={styles.emptyCard}>
            <MessageSquare size={34} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>{t('reviews.no_reviews_found')}</Text>
            <Text style={styles.emptySub}>Try adjusting your search or filters</Text>
          </View>
        ) : (
          filteredReviews.map((r) => (
            <View key={r.id} style={styles.reviewCard}>
              <View style={styles.reviewTopRow}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>{r.guestName.charAt(0).toUpperCase()}</Text>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.reviewGuest}>{r.guestName}</Text>
                  <Text style={styles.reviewDate}>
                    {r.date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </Text>
                </View>

                <View style={{ alignItems: 'flex-end' }}>
                  <StarRating rating={r.rating} size={14} />
                  <Text style={styles.reviewRatingNum}>{Number(r.rating).toFixed(1)}</Text>
                </View>
              </View>

              <Text style={styles.reviewComment}>{r.comment || 'No written comment.'}</Text>
            </View>
          ))
        )}
      </ScrollView>

      {/* Filters Modal */}
      <Modal visible={showFilters} animationType="fade" transparent onRequestClose={() => setShowFilters(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowFilters(false)}>
          <Pressable
            style={[
                styles.modalSheet,
                {
                paddingBottom: insets.bottom + 8,
                },
            ]}
            onPress={() => {}}
            >
            <Text style={styles.modalTitle}>{t('search.filters')}</Text>

            <Text style={styles.modalLabel}>{t('reviews.rating')}</Text>
            <View style={styles.pillsRow}>
              {(['all', '5', '4', '3', '2', '1'] as const).map((v) => (
                <TouchableOpacity
                  key={v}
                  style={[styles.pill, filterRating === v && styles.pillActive]}
                  onPress={() => setFilterRating(v)}
                >
                  <Text style={[styles.pillText, filterRating === v && styles.pillTextActive]}>
                    {v === 'all' ? 'All' : `${v}★`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.modalLabel}>{t('common.sort')}</Text>
            <View style={styles.pillsRow}>
              {(['recent', 'oldest', 'highest', 'lowest'] as const).map((v) => (
                <TouchableOpacity
                  key={v}
                  style={[styles.pill, sortBy === v && styles.pillActive]}
                  onPress={() => setSortBy(v)}
                >
                  <Text style={[styles.pillText, sortBy === v && styles.pillTextActive]}>
                    {v === 'recent'
                      ? 'Recent'
                      : v === 'oldest'
                      ? 'Oldest'
                      : v === 'highest'
                      ? 'Highest'
                      : 'Lowest'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {(filterRating !== 'all' || searchQuery.trim() || sortBy !== 'recent') && (
              <TouchableOpacity
                style={styles.clearBtn}
                onPress={() => {
                  setFilterRating('all');
                  setSortBy('recent');
                  setSearchQuery('');
                }}
              >
                <Text style={styles.clearBtnText}>{t('reviews.clear_filters')}</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.doneBtn} onPress={() => setShowFilters(false)}>
              <Text style={styles.doneBtnText}>{t('common.done')}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  headerSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },

  statsRow: { flexDirection: 'row', gap: 10, padding: 14 },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
  },
  statTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statValue: { fontSize: 18, fontWeight: '800', color: '#111827' },
  statLabel: { fontSize: 12, color: '#6B7280', marginTop: 6 },

  searchWrap: {
    marginHorizontal: 14,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#111827' },
  filterBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },

  distWrap: {
    marginHorizontal: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  distTitle: { fontSize: 14, fontWeight: '700', marginBottom: 10, color: '#111827' },
  distRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 10 },
  distLeft: { width: 44, flexDirection: 'row', alignItems: 'center', gap: 6 },
  distNum: { fontSize: 12, color: '#111827', width: 10 },
  distBarBg: {
    flex: 1,
    height: 10,
    backgroundColor: '#E5E7EB',
    borderRadius: 999,
    overflow: 'hidden',
  },
  distBarFill: { height: 10, backgroundColor: '#FBBF24' },
  distCount: { width: 24, textAlign: 'right', color: '#6B7280', fontSize: 12 },

  listWrap: { paddingHorizontal: 14, paddingBottom: 30 },
  loadingBox: { padding: 24, alignItems: 'center' },

  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  emptyTitle: { marginTop: 10, fontSize: 16, fontWeight: '700', color: '#111827' },
  emptySub: { marginTop: 4, fontSize: 12, color: '#6B7280' },

  reviewCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  reviewTopRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontWeight: '800', color: '#111827' },
  reviewGuest: { fontSize: 14, fontWeight: '700', color: '#111827' },
  reviewDate: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  reviewRatingNum: { fontSize: 12, color: '#111827', marginTop: 2, fontWeight: '700' },
  reviewComment: { fontSize: 13, color: '#111827', lineHeight: 18 },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 14,
  },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#111827', marginBottom: 10 },
  modalLabel: { fontSize: 12, color: '#6B7280', marginTop: 10, marginBottom: 6 },
  pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
  },
  pillActive: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
  pillText: { fontSize: 12, color: '#111827', fontWeight: '700' },
  pillTextActive: { color: '#FFFFFF' },

  clearBtn: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  clearBtnText: { fontWeight: '800', color: '#111827' },

  doneBtn: {
    marginTop: 10,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#0F172A',
  },
  doneBtnText: { fontWeight: '800', color: '#FFFFFF' },
});