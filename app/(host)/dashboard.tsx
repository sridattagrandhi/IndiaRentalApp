import { useTranslation } from 'react-i18next';
// app/(host)/dashboard.tsx
import { apiGet } from '@/services/api';
import { useFocusEffect } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  DollarSign,
  Eye,
  MessageCircle,
  PenLine,
  Plus,
  Star,
  TrendingUp,
} from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

// --- Interfaces and Mock Data ---
interface AlertItem {
  id: string;
  type: 'verification' | 'request' | 'document';
  title: string;
  description: string;
  urgent: boolean;
}

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

type ProfileResponse = {
  name: string | null;
  email?: string | null;
  avatar_url?: string | null;
};

type HostBookingsItem = {
  check_in?: string;
  check_out?: string;
  status?: string;
};

type HostBookingsResponse = {
  requests?: HostBookingsItem[];
  upcoming?: HostBookingsItem[];
  past?: HostBookingsItem[];
  all?: HostBookingsItem[];
};

type DashboardReview = {
  id: string;
  guestName: string;
  guestAvatar: string;
  rating: number;
  comment: string;
  listingName: string;
  date: Date;
};

const mockAlerts: AlertItem[] = [
  { id: '1', type: 'request', title: '3 pending requests', description: 'Respond within 24 hours', urgent: true },
  { id: '2', type: 'verification', title: 'Complete KYC', description: 'Required for payouts', urgent: true },
];

// --- Helper Components ---
interface KpiCardProps {
  icon: React.ReactNode;
  title: string;
  value: string;
  iconBg: string;
  pill?: string;                   // e.g. "+12%", "Nov 5", "Active"
  pillVariant?: 'light' | 'dark';  // dark used for "Active"
}
const KpiCard = ({ icon, title, value, iconBg, pill, pillVariant = 'light' }: KpiCardProps) => (
  <View style={styles.kpiCard}>
    {pill ? (
      <View
        style={[
          styles.kpiPill,
          pillVariant === 'dark' ? styles.kpiPillDark : styles.kpiPillLight,
        ]}
      >
        <Text
          style={[
            styles.kpiPillText,
            pillVariant === 'dark' ? styles.kpiPillTextDark : styles.kpiPillTextLight,
          ]}
        >
          {pill}
        </Text>
      </View>
    ) : null}

    <View style={[styles.kpiIconBg, { backgroundColor: iconBg }]}>{icon}</View>

    <Text style={styles.kpiValue}>{value}</Text>
    <Text style={styles.kpiTitle}>{title}</Text>
  </View>
);

interface QuickActionButtonProps {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}
const QuickActionButton = ({ icon, label, onPress }: QuickActionButtonProps) => (
  <TouchableOpacity style={styles.quickActionCard} onPress={onPress}>
    {icon}
    <Text style={styles.quickActionLabel}>{label}</Text>
  </TouchableOpacity>
);

// --- Main Dashboard Screen ---
export default function HostDashboardScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const [userName, setUserName] = useState<string>('Host');
  const [occupancyRate, setOccupancyRate] = useState<number>(0);
  const [viewsThisWeek, setViewsThisWeek] = useState<number>(0);
  const [confirmedBookings, setConfirmedBookings] = useState<number>(0);
  const [statsLoading, setStatsLoading] = useState(false);

  const [recentReviews, setRecentReviews] = useState<DashboardReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);

  const loadProfileAndStats = useCallback(async () => {
    try {
      setStatsLoading(true);

      const [profile, bookings] = await Promise.all([
        apiGet<ProfileResponse>('/v1/profile'),
        apiGet<HostBookingsResponse>('/v1/host/bookings'),
      ]);

      const displayName =
        profile?.name?.trim() ||
        profile?.email?.split('@')?.[0]?.trim() ||
        'Host';
      setUserName(displayName);

      const upcoming = bookings?.upcoming ?? [];
      setConfirmedBookings(upcoming.length);

      // Occupancy (simple MVP):
      // booked nights in the next 30 days divided by 30 (assumes “one main property”).
      const today = new Date();
      const windowEnd = new Date(today);
      windowEnd.setDate(windowEnd.getDate() + 30);

      let bookedNights = 0;
      for (const b of upcoming) {
        if (!b.check_in || !b.check_out) continue;
        const start = new Date(b.check_in);
        const end = new Date(b.check_out);

        const overlapStart = start > today ? start : today;
        const overlapEnd = end < windowEnd ? end : windowEnd;

        const ms = overlapEnd.getTime() - overlapStart.getTime();
        if (ms > 0) bookedNights += Math.ceil(ms / (1000 * 60 * 60 * 24));
      }

      const occ = Math.max(0, Math.min(100, Math.round((bookedNights / 30) * 100)));
      setOccupancyRate(occ);

      // Views tracking not implemented yet in backend; keep 0 for now.
      setViewsThisWeek(0);
    } catch (e: any) {
      console.error('Failed to load dashboard stats', e?.response?.data || e);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const loadRecentReviews = useCallback(async () => {
    try {
      setReviewsLoading(true);
      const res = await apiGet<HostReviewsResponse>('/v1/host/reviews');

      // sort newest first, then take only 2
      const sorted = [...(res?.reviews ?? [])].sort((a, b) => {
        const ad = a.review?.created_at ? new Date(a.review.created_at).getTime() : 0;
        const bd = b.review?.created_at ? new Date(b.review.created_at).getTime() : 0;
        return bd - ad;
      });

      const top2: DashboardReview[] = sorted.slice(0, 2).map((r) => {
        const guestLabel = r.guest?.name?.trim() || r.guest?.email?.trim() || 'Guest';
        const guestId = String(r.guest?.id ?? r.review?.id ?? '1');
        const avatar = `https://i.pravatar.cc/150?u=${encodeURIComponent(guestId)}`;

        return {
          id: String(r.review?.id ?? ''),
          guestName: guestLabel,
          guestAvatar: avatar,
          rating: Number(r.review?.rating ?? 0),
          comment: (r.review?.comment ?? '').toString(),
          listingName: (r.listing?.title ?? 'Listing').toString(),
          date: r.review?.created_at ? new Date(r.review.created_at) : new Date(),
        };
      });

      setRecentReviews(top2);
    } catch (e: any) {
      console.error('Failed to load recent reviews', e?.response?.data || e);
      setRecentReviews([]);
    } finally {
      setReviewsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProfileAndStats();
      loadRecentReviews();
    }, [loadProfileAndStats, loadRecentReviews])
  );

  const handleQuickAction = (action: string) => Alert.alert(t('host.dashboard.quick_action'), `Navigating to ${action}...`);
  const handleAlertClick = (alert: AlertItem) => Alert.alert(t('host.dashboard.alert'), `Navigating to handle: ${alert.title}`);

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Custom Header */}
      <View style={styles.customHeader}>
        <View style={styles.headerPlaceholder} />
        <Text style={styles.headerTitle}>{t('host.dashboard.dashboard')}</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Greeting */}
        <View style={styles.greetingContainer}>
          <Text style={styles.greetingTitle}>{t('host.dashboard.hi')} {userName} 👋</Text>
          <Text style={styles.greetingSubtitle}>{t('host.dashboard.here_s_what_s_happening_with_your_properties')}</Text>
        </View>

        {/* KPI Grid */}
        <View style={styles.kpiGrid}>
          <View style={styles.kpiCard}>
            <View style={[styles.kpiIconBg, { backgroundColor: '#ECFDF5' }]}>
              <TrendingUp size={20} color="#059669" />
            </View>
            <Text style={styles.kpiValue}>{occupancyRate}%</Text>
            <Text style={styles.kpiTitle}>{t('host.dashboard.occupancy_rate')}</Text>
          </View>

          <View style={styles.kpiCard}>
            <View style={[styles.kpiIconBg, { backgroundColor: '#E5EDFF' }]}>
              <Eye size={20} color="#2563EB" />
            </View>
            <Text style={styles.kpiValue}>{viewsThisWeek}</Text>
            <Text style={styles.kpiTitle}>{t('host.dashboard.views_this_week')}</Text>
          </View>

          <View style={styles.kpiCard}>
            {/* pill */}
            {confirmedBookings > 0 ? (
              <View style={[styles.kpiPill, styles.kpiPillDark]}>
                <Text style={[styles.kpiPillText, styles.kpiPillTextDark]}>{t('host.dashboard.active')}</Text>
              </View>
            ) : null}

            <View style={[styles.kpiIconBg, { backgroundColor: '#F3E8FF' }]}>
              <Calendar size={20} color="#7C3AED" />
            </View>
            <Text style={styles.kpiValue}>{confirmedBookings}</Text>
            <Text style={styles.kpiTitle}>{t('host.dashboard.confirmed_bookings')}</Text>
          </View>

          <View style={styles.kpiCard}>
            {/* pill */}
            <View style={[styles.kpiPill, styles.kpiPillLight]}>
              <Text style={[styles.kpiPillText, styles.kpiPillTextLight]}>{t('host.dashboard.nov_5')}</Text>
            </View>

            <View style={[styles.kpiIconBg, { backgroundColor: '#FFF7E6' }]}>
              <DollarSign size={20} color="#D97706" />
            </View>
            <Text style={styles.kpiValue}>₹45,600</Text>
            <Text style={styles.kpiTitle}>{t('host.dashboard.next_payout')}</Text>
          </View>
        </View>

        {/* Alerts */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('host.dashboard.alerts')}</Text>

          {mockAlerts.map((alert) => (
            <TouchableOpacity
              key={alert.id}
              style={[
                styles.alertCard,
                alert.urgent ? styles.alertCardUrgent : null,
              ]}
              onPress={() => handleAlertClick(alert)}
            >
              <View
                style={[
                  styles.alertIconBg,
                  alert.urgent ? styles.alertIconBgUrgent : styles.alertIconBgInfo,
                ]}
              >
                <AlertCircle
                  size={20}
                  color={alert.urgent ? '#B45309' : '#2563EB'}
                />
              </View>

              <View style={styles.alertTextContainer}>
                <View style={styles.alertTitleRow}>
                  <Text style={styles.alertTitle}>{alert.title}</Text>
                  {alert.urgent ? (
                    <View style={styles.urgentBadge}>
                      <Text style={styles.urgentBadgeText}>{t('host.dashboard.urgent')}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.alertDescription}>{alert.description}</Text>
              </View>

              <ArrowRight size={18} color="#6B7280" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('host.dashboard.quick_actions')}</Text>

          <View style={styles.quickActionsGrid}>
            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => router.push('/(host)/listings')}
            >
              <Plus size={22} color="#111827" />
              <Text style={styles.quickActionLabel}>{t('host.dashboard.new_listing')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => handleQuickAction('Adjust Pricing')}
            >
              <PenLine size={22} color="#111827" />
              <Text style={styles.quickActionLabel}>{t('host.dashboard.adjust_pricing')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => handleQuickAction('Message Guest')}
            >
              <MessageCircle size={22} color="#111827" />
              <Text style={styles.quickActionLabel}>{t('host.dashboard.message_guest')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Reviews */}
        <View style={styles.section}>
          <View style={styles.reviewHeader}>
            <Text style={styles.sectionTitle}>{t('host.dashboard.recent_reviews')}</Text>
            <TouchableOpacity onPress={() => router.push('/(host)/all-reviews')}>
              <Text style={styles.viewAllLink}>{t('host.dashboard.view_all')}</Text>
            </TouchableOpacity>
          </View>

          {reviewsLoading ? (
            <View style={styles.emptyReviewCard}>
              <Text style={styles.emptyReviewText}>{t('host.dashboard.loading_reviews')}</Text>
            </View>
          ) : recentReviews.length === 0 ? (
            <View style={styles.emptyReviewCard}>
              <Text style={styles.emptyReviewText}>{t('host.dashboard.no_reviews')}</Text>
            </View>
          ) : (
            recentReviews.map((review) => (
              <View key={review.id} style={styles.reviewCard}>
                <View style={styles.reviewAuthorRow}>
                  <Image source={{ uri: review.guestAvatar }} style={styles.reviewAvatar} />

                  <View style={styles.reviewAuthorInfo}>
                    <Text style={styles.reviewAuthorName}>{review.guestName}</Text>

                    {/* Date now goes under the name */}
                    <Text style={styles.reviewDate}>
                      {review.date.toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </Text>
                  </View>

                  {/* Rating now goes on the right */}
                  <View style={styles.ratingRow}>
                    <Star size={16} color="#F59E0B" />
                    <Text style={styles.reviewRatingText}>{review.rating.toFixed(1)}</Text>
                  </View>
                </View>

                <Text style={styles.reviewListingName}>{review.listingName}</Text>
                <Text style={styles.reviewComment} numberOfLines={3}>
                  {review.comment || '—'}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },

  // Custom Header
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  headerPlaceholder: { width: 40 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#111827', textAlign: 'center' },

  scrollContent: { padding: 16, paddingBottom: 40 },

  // Greeting
  greetingContainer: { marginBottom: 12 },
  greetingTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 4 },
  greetingSubtitle: { fontSize: 16, color: '#6B7280' },

  // KPI grid & cards
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  kpiCard: {
    width: '48%', // two columns
    backgroundColor: 'white',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    marginBottom: 12,
    minHeight: 150,
    position: 'relative',
  },
  kpiIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  kpiPill: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  kpiPillLight: { backgroundColor: '#F3F4F6' },
  kpiPillDark: { backgroundColor: '#0F172A' },
  kpiPillText: { fontSize: 12, fontWeight: '600' },
  kpiPillTextLight: { color: '#111827' },
  kpiPillTextDark: { color: '#FFFFFF' },
  kpiValue: { fontSize: 30, fontWeight: '800', marginTop: 2 },
  kpiTitle: { marginTop: 6, fontSize: 13, color: '#6B7280' },

  // Sections
  section: { marginTop: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12 },

  // Alerts
  alertCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  alertCardUrgent: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  alertIconBg: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  alertIconBgUrgent: { backgroundColor: '#FEF3C7' },
  alertIconBgInfo: { backgroundColor: '#DBEAFE' },
  alertTextContainer: { flex: 1 },
  alertTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  alertTitle: { fontSize: 16, fontWeight: '500' },
  urgentBadge: { backgroundColor: '#FEE2E2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  urgentBadgeText: { fontSize: 10, fontWeight: '500', color: '#B91C1C' },
  alertDescription: { fontSize: 14, color: '#6B7280' },

  // Quick actions
  quickActionsGrid: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  quickActionCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    gap: 8,
  },
  quickActionLabel: { fontSize: 12, fontWeight: '500', textAlign: 'center' },

  // Reviews
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  viewAllLink: { fontSize: 14, color: '#007AFF', fontWeight: '500' },
  reviewCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  reviewAuthorRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  reviewAvatar: { width: 40, height: 40, borderRadius: 20 },
  reviewAuthorInfo: { flex: 1 },
  reviewAuthorName: { fontSize: 16, fontWeight: '600' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  reviewRatingText: { fontSize: 14, marginLeft: 2, fontWeight: '500' },
  reviewDate: { fontSize: 12, color: '#6B7280' },
  reviewListingName: { fontSize: 14, color: '#6B7280', marginBottom: 8 },
  reviewComment: { fontSize: 14, lineHeight: 20 },
  emptyReviewCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  emptyReviewText: { fontSize: 14, color: '#6B7280' },
});
