import { useTranslation } from 'react-i18next';
// app/(host)/all-reviews.tsx
import { apiGet } from '@/services/api';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { ChevronLeft, MessageSquare, Search, SlidersHorizontal, Star, ThumbsUp, TrendingUp } from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Image,
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

type HostReviewRow = {
  review: { id: string | number; rating: number; comment?: string | null; created_at: string };
  listing: { id: string | number; title?: string | null };
  booking: { id: string | number; check_in?: string; check_out?: string };
  guest: { id: string | number; name?: string | null; email?: string | null };
};

type HostReviewsResponse = {
  count: number;
  reviews: HostReviewRow[];
};

type Review = {
  id: string;
  guestName: string;
  guestAvatar: string;
  rating: number; // supports .5 increments
  comment: string;
  listingName: string;
  date: Date;
  responseStatus?: 'responded' | 'pending'; // backend not providing; optional
  helpful?: number; // backend not providing; optional
};

const formatDate = (d: Date) =>
  d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

export default function AllReviewsPageScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Review[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterRating, setFilterRating] = useState<'all' | '5' | '4' | '3' | '2' | '1'>('all');
  const [filterProperty, setFilterProperty] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'oldest' | 'highest' | 'lowest' | 'helpful'>('recent');
  const [showFilters, setShowFilters] = useState(false);

  const loadHostReviews = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiGet<HostReviewsResponse>('/v1/host/reviews');

      const mapped: Review[] = (res?.reviews ?? []).map((r) => {
        const guestLabel = r.guest?.name?.trim() || r.guest?.email?.trim() || 'Guest';
        // stable-ish avatar placeholder
        const guestId = String(r.guest?.id ?? r.review?.id ?? '1');
        const avatar = `https://i.pravatar.cc/150?u=${encodeURIComponent(guestId)}`;

        const rating = Number(r.review?.rating ?? 0);
        const createdAt = r.review?.created_at ? new Date(r.review.created_at) : new Date();

        return {
          id: String(r.review?.id ?? ''),
          guestName: guestLabel,
          guestAvatar: avatar,
          rating: rating,
          comment: (r.review?.comment ?? '').toString(),
          listingName: (r.listing?.title ?? 'Listing').toString(),
          date: createdAt,
          // backend does not have these yet; keep optional to preserve UI slots
          responseStatus: undefined,
          helpful: undefined,
        };
      });

      setRows(mapped);
    } catch (e: any) {
      console.error('Failed to load host reviews', e?.response?.data || e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHostReviews();
    }, [loadHostReviews])
  );

  const stats = useMemo(() => {
    const totalReviews = rows.length;
    const averageRating =
      totalReviews === 0 ? 0 : rows.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / totalReviews;

    const dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } as Record<1|2|3|4|5, number>;

    rows.forEach((r) => {
    const val = Number(r.rating || 0);
    // Put 4.5 into 4 bucket (so it doesn't become 5)
    const bucket = Math.max(1, Math.min(5, Math.floor(val))) as 1|2|3|4|5;
    dist[bucket] += 1;
    });

    // 5-star reviews should mean rating == 5 exactly
    const fiveStarCount = rows.filter(r => Number(r.rating) === 5).length;

    return {
      totalReviews,
      averageRating: totalReviews === 0 ? '0.0' : averageRating.toFixed(1),
      pendingResponses: 0, // backend not providing; keep 0 so card doesn't show
      ratingDistribution: dist,
      fiveStarCount,
    };
  }, [rows]);

  const propertyNames = useMemo(() => {
    return Array.from(new Set(rows.map((r) => r.listingName))).sort();
  }, [rows]);

  const filteredReviews = useMemo(() => {
    let filtered = [...rows];

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.guestName.toLowerCase().includes(q) ||
          r.comment.toLowerCase().includes(q) ||
          r.listingName.toLowerCase().includes(q)
      );
    }

    // Rating filter (your sample only filters whole stars)
    if (filterRating !== 'all') {
      const want = parseInt(filterRating, 10);
      filtered = filtered.filter((r) => Math.round(r.rating) === want);
    }

    // Property filter
    if (filterProperty !== 'all') {
      filtered = filtered.filter((r) => r.listingName === filterProperty);
    }

    // Sort
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
      case 'helpful':
        filtered.sort((a, b) => (b.helpful || 0) - (a.helpful || 0));
        break;
    }

    return filtered;
  }, [rows, searchQuery, filterRating, filterProperty, sortBy]);

  function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
    const r = Number(rating) || 0;
    return (
        <View style={{ flexDirection: 'row', gap: 2 }}>
        {[1,2,3,4,5].map((i) => {
            const full = r >= i;
            const half = !full && r >= i - 0.5;

            return (
            <View key={i} style={{ width: size, height: size }}>
                {/* Base empty star */}
                <Star size={size} color="#D1D5DB" />

                {/* Full fill */}
                {full && (
                <View style={{ position: 'absolute', left: 0, top: 0 }}>
                    <Star size={size} color="#FBBF24" fill="#FBBF24" />
                </View>
                )}

                {/* Half fill */}
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
                    <Star size={size} color="#FBBF24" fill="#FBBF24" />
                </View>
                )}
            </View>
            );
        })}
        </View>
    );
    }


  const FilterSheet = () => (
    <Modal visible={showFilters} animationType="slide" transparent>
      <Pressable style={styles.sheetOverlay} onPress={() => setShowFilters(false)} />
      <View style={styles.sheetContainer} pointerEvents="box-none">
        <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>{t('search.filters')}</Text>

            <Text style={styles.sheetLabel}>{t('reviews.rating')}</Text>
            <View style={styles.pillsRow}>
            {(['all', '5', '4', '3', '2', '1'] as const).map((v) => (
                <TouchableOpacity
                key={v}
                onPress={() => setFilterRating(v)}
                style={[styles.pill, filterRating === v && styles.pillActive]}
                >
                <Text style={[styles.pillText, filterRating === v && styles.pillTextActive]}>
                    {v === 'all' ? 'All' : `${v}★`}
                </Text>
                </TouchableOpacity>
            ))}
            </View>

            <Text style={[styles.sheetLabel, { marginTop: 14 }]}>Sort By</Text>
            <View style={styles.pillsRow}>
            {(['recent', 'oldest', 'highest', 'lowest', 'helpful'] as const).map((v) => (
                <TouchableOpacity
                key={v}
                onPress={() => setSortBy(v)}
                style={[styles.pill, sortBy === v && styles.pillActive]}
                >
                <Text style={[styles.pillText, sortBy === v && styles.pillTextActive]}>
                    {v === 'recent'
                    ? 'Recent'
                    : v === 'oldest'
                    ? 'Oldest'
                    : v === 'highest'
                    ? 'Highest'
                    : v === 'lowest'
                    ? 'Lowest'
                    : 'Helpful'}
                </Text>
                </TouchableOpacity>
            ))}
            </View>

            <Text style={[styles.sheetLabel, { marginTop: 14 }]}>{t('host.host-listing.property')}</Text>
            <ScrollView style={{ maxHeight: 180 }} contentContainerStyle={{ paddingBottom: 8 }}>
            <TouchableOpacity
                onPress={() => setFilterProperty('all')}
                style={[styles.propertyRow, filterProperty === 'all' && styles.propertyRowActive]}
            >
                <Text style={[styles.propertyText, filterProperty === 'all' && styles.propertyTextActive]}>{t('host.all_reviews.all_properties')}</Text>
            </TouchableOpacity>

            {propertyNames.map((name) => (
                <TouchableOpacity
                key={name}
                onPress={() => setFilterProperty(name)}
                style={[styles.propertyRow, filterProperty === name && styles.propertyRowActive]}
                >
                <Text style={[styles.propertyText, filterProperty === name && styles.propertyTextActive]} numberOfLines={1}>
                    {name}
                </Text>
                </TouchableOpacity>
            ))}
            </ScrollView>

            {(filterRating !== 'all' || filterProperty !== 'all' || searchQuery.trim()) && (
            <TouchableOpacity
                style={styles.clearBtn}
                onPress={() => {
                setFilterRating('all');
                setFilterProperty('all');
                setSearchQuery('');
                setSortBy('recent');
                }}
            >
                <Text style={styles.clearBtnText}>{t('reviews.clear_filters')}</Text>
            </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.doneBtn} onPress={() => setShowFilters(false)}>
            <Text style={styles.doneBtnText}>{t('common.done')}</Text>
            </TouchableOpacity>
        </Pressable>
      </View>
    </Modal>
  );

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
          <Text style={styles.headerSub}>{filteredReviews.length} reviews</Text>
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
          placeholder={t('host.all_reviews.search_reviews')}
          placeholderTextColor="#9CA3AF"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <TouchableOpacity style={styles.filterBtn} onPress={() => setShowFilters(true)}>
          <SlidersHorizontal size={18} color="#111827" />
        </TouchableOpacity>
      </View>

      {/* Rating Distribution */}
      {!showFilters && (
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
      )}

      {/* List */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.listContent}>
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator />
            <Text style={styles.loadingText}>Loading reviews…</Text>
          </View>
        ) : filteredReviews.length === 0 ? (
          <View style={styles.emptyCard}>
            <MessageSquare size={44} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>{t('reviews.no_reviews_found')}</Text>
            <Text style={styles.emptySub}>Try adjusting your search or filters</Text>
          </View>
        ) : (
          filteredReviews.map((review) => (
            <View key={review.id} style={styles.reviewCard}>
              <View style={styles.reviewTopRow}>
                <Image source={{ uri: review.guestAvatar }} style={styles.avatar} />
                <View style={{ flex: 1 }}>
                  <View style={styles.nameRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.guestName} numberOfLines={1}>
                        {review.guestName}
                      </Text>
                      <Text style={styles.dateText}>{formatDate(review.date)}</Text>
                    </View>
                    <View style={styles.ratingWrap}>
                        <Stars rating={review.rating} size={14} />
                        <Text style={styles.ratingText}>{Number(review.rating).toFixed(1)}</Text>   
                    </View>
                  </View>
                </View>
              </View>

              <View style={styles.badgesRow}>
                <View style={styles.badge}>
                  <Text style={styles.badgeText} numberOfLines={1}>
                    {review.listingName}
                  </Text>
                </View>

                {/* backend doesn't provide response status yet; keep placeholder style but don't show if undefined */}
                {review.responseStatus ? (
                  <View style={[styles.badge, review.responseStatus === 'responded' ? styles.badgeDark : styles.badgeOutline]}>
                    <Text style={[styles.badgeText, review.responseStatus === 'responded' ? styles.badgeTextDark : styles.badgeTextOutline]}>
                      {review.responseStatus === 'responded' ? '✓ Responded' : 'Pending Response'}
                    </Text>
                  </View>
                ) : null}
              </View>

              {review.comment ? (
                <Text style={styles.commentText}>{review.comment}</Text>
              ) : (
                <Text style={styles.commentEmpty}>{t('reviews.no_written_comment')}</Text>
              )}

              <View style={styles.divider} />

              <View style={styles.bottomRow}>
                <View style={styles.helpfulRow}>
                  <ThumbsUp size={16} color="#6B7280" />
                  <Text style={styles.helpfulText}>
                    {(review.helpful ?? 0) > 0 ? `${review.helpful} found this helpful` : ' '}
                  </Text>
                </View>

                {/* Keep button style (does nothing yet) */}
                <TouchableOpacity style={styles.actionBtnOutline}>
                  <Text style={styles.actionBtnText}>{t('search.view')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <FilterSheet />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    gap: 10,
  },
  headerIconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  headerSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },

  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingTop: 12 },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  statTopRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  statValue: { fontSize: 18, fontWeight: '800', color: '#111827' },
  statLabel: { fontSize: 11, color: '#6B7280' },

  searchWrap: {
    marginTop: 12,
    marginHorizontal: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
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
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },

  distWrap: {
    marginTop: 12,
    marginHorizontal: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
  },
  distTitle: { fontSize: 12, color: '#6B7280', marginBottom: 10, fontWeight: '600' },
  distRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  distLeft: { width: 44, flexDirection: 'row', alignItems: 'center', gap: 4 },
  distNum: { fontSize: 12, color: '#111827' },
  distBarBg: { flex: 1, height: 8, backgroundColor: '#E5E7EB', borderRadius: 999, overflow: 'hidden' },
  distBarFill: { height: 8, backgroundColor: '#FBBF24' },
  distCount: { width: 24, textAlign: 'right', fontSize: 12, color: '#6B7280' },

  listContent: { padding: 14, paddingBottom: 30, gap: 12 },

  loadingBox: { padding: 18, alignItems: 'center', gap: 10 },
  loadingText: { color: '#6B7280' },

  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 22,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  emptySub: { fontSize: 13, color: '#6B7280' },

  reviewCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 14,
  },
  reviewTopRow: { flexDirection: 'row', gap: 12, marginBottom: 10 },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#E5E7EB' },
  nameRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  guestName: { fontSize: 15, fontWeight: '800', color: '#111827' },
  dateText: { marginTop: 2, fontSize: 11, color: '#6B7280' },

  ratingWrap: { alignItems: 'flex-end', gap: 2 },
  starsRow: { flexDirection: 'row', gap: 2 },
  ratingText: { fontSize: 12, color: '#111827', fontWeight: '700' },

  badgesRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 8 },
  badge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    maxWidth: '75%',
  },
  badgeText: { fontSize: 12, color: '#111827', fontWeight: '600' },
  badgeDark: { backgroundColor: '#111827' },
  badgeTextDark: { color: '#FFFFFF' },
  badgeOutline: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB' },
  badgeTextOutline: { color: '#111827' },

  commentText: { fontSize: 13, color: '#111827', lineHeight: 18 },
  commentEmpty: { fontSize: 13, color: '#6B7280', fontStyle: 'italic' },

  divider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 12 },

  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  helpfulRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  helpfulText: { fontSize: 12, color: '#6B7280' },

  actionBtnOutline: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  actionBtnText: { fontSize: 12, fontWeight: '700', color: '#111827' },

  // Filter sheet
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    borderTopWidth: 1,
    borderColor: '#E5E7EB',
  },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: '#111827', marginBottom: 10 },
  sheetLabel: { fontSize: 12, color: '#6B7280', fontWeight: '700', marginBottom: 8 },
  pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: '#F3F4F6' },
  pillActive: { backgroundColor: '#111827' },
  pillText: { fontSize: 12, fontWeight: '700', color: '#111827' },
  pillTextActive: { color: '#FFFFFF' },

  propertyRow: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 8,
  },
  propertyRowActive: { backgroundColor: '#111827', borderColor: '#111827' },
  propertyText: { fontSize: 13, color: '#111827', fontWeight: '700' },
  propertyTextActive: { color: '#FFFFFF' },

  clearBtn: {
    marginTop: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  clearBtnText: { fontSize: 13, fontWeight: '800', color: '#111827' },

  doneBtn: {
    marginTop: 10,
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  doneBtnText: { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
  sheetContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
});
