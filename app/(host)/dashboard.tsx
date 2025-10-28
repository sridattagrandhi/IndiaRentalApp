// app/(host)/dashboard.tsx
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
import React from 'react';
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
interface Review {
  id: string;
  guestName: string;
  guestAvatar: string;
  rating: number;
  comment: string;
  listingName: string;
  date: Date;
}

const mockAlerts: AlertItem[] = [
  { id: '1', type: 'request', title: '3 pending requests', description: 'Respond within 24 hours', urgent: true },
  { id: '2', type: 'verification', title: 'Complete KYC', description: 'Required for payouts', urgent: true },
];

const mockReviews: Review[] = [
  {
    id: '1',
    guestName: 'Amit P.',
    guestAvatar: 'https://i.pravatar.cc/150?img=15',
    rating: 5,
    comment: 'Amazing property! Clean & responsive host.',
    listingName: 'Modern Studio',
    date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
  },
  {
    id: '2',
    guestName: 'Priya S.',
    guestAvatar: 'https://i.pravatar.cc/150?img=9',
    rating: 4,
    comment: 'Great location. Minor issues but pleasant.',
    listingName: 'Beach Villa',
    date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5),
  },
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
  const router = useRouter();
  const userName = 'Rajesh';

  const handleQuickAction = (action: string) => Alert.alert('Quick Action', `Navigating to ${action}...`);
  const handleAlertClick = (alert: AlertItem) => Alert.alert('Alert', `Navigating to handle: ${alert.title}`);

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Custom header */}
      <View style={styles.customHeader}>
        <View style={styles.headerPlaceholder} />
        <Text style={styles.headerTitle}>Dashboard</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Greeting */}
        <View style={styles.greetingContainer}>
          <Text style={styles.greetingTitle}>Hi, {userName} 👋</Text>
          <Text style={styles.greetingSubtitle}>
            Here's what's happening with your properties
          </Text>
        </View>

        {/* KPI Cards */}
        <View style={styles.kpiGrid}>
          <KpiCard
            icon={<TrendingUp size={20} color="#059669" />}
            title="Occupancy rate"
            value="78%"
            pill="+12%"
            iconBg="#ECFDF5"
          />
          <KpiCard
            icon={<Eye size={20} color="#2563EB" />}
            title="Views this week"
            value="1,248"
            pill="+23%"
            iconBg="#E5EDFF"
          />
          <KpiCard
            icon={<Calendar size={20} color="#7C3AED" />}
            title="Confirmed bookings"
            value="12"
            pill="Active"
            pillVariant="dark"
            iconBg="#F3E8FF"
          />
          <KpiCard
            icon={<DollarSign size={20} color="#D97706" />}
            title="Next payout"
            value="₹45,600"
            pill="Nov 5"
            iconBg="#FFF7E6"
          />
        </View>

        {/* Alerts Section */}
        {mockAlerts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>⚠️ Alerts</Text>
            {mockAlerts.map((alert) => (
              <TouchableOpacity
                key={alert.id}
                style={[styles.alertCard, alert.urgent && styles.alertCardUrgent]}
                onPress={() => handleAlertClick(alert)}
              >
                <View
                  style={[
                    styles.alertIconBg,
                    alert.urgent ? styles.alertIconBgUrgent : styles.alertIconBgInfo,
                  ]}
                >
                  <AlertCircle size={20} color={alert.urgent ? '#B45309' : '#2563EB'} />
                </View>
                <View style={styles.alertTextContainer}>
                  <View style={styles.alertTitleRow}>
                    <Text style={styles.alertTitle}>{alert.title}</Text>
                    {alert.urgent && (
                      <View style={styles.urgentBadge}>
                        <Text style={styles.urgentBadgeText}>Urgent</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.alertDescription}>{alert.description}</Text>
                </View>
                <ArrowRight size={18} color="#6B7280" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsGrid}>
            <QuickActionButton
              icon={<Plus size={24} color="#374151" />}
              label="New Listing"
              onPress={() => handleQuickAction('New Listing')}
            />
            <QuickActionButton
              icon={<PenLine size={24} color="#374151" />}
              label="Adjust Pricing"
              onPress={() => handleQuickAction('Adjust Pricing')}
            />
            <QuickActionButton
              icon={<MessageCircle size={24} color="#374151" />}
              label="Message Guest"
              onPress={() => handleQuickAction('Message Guest')}
            />
          </View>
        </View>

        {/* Recent Reviews */}
        <View style={styles.section}>
          <View style={styles.reviewHeader}>
            <Text style={styles.sectionTitle}>Recent Reviews</Text>
            <TouchableOpacity onPress={() => Alert.alert('Navigate', 'View all reviews')}>
              <Text style={styles.viewAllLink}>View all →</Text>
            </TouchableOpacity>
          </View>

          {mockReviews.map((review) => (
            <View key={review.id} style={styles.reviewCard}>
              <View style={styles.reviewAuthorRow}>
                <Image source={{ uri: review.guestAvatar }} style={styles.reviewAvatar} />
                <View style={styles.reviewAuthorInfo}>
                  <Text style={styles.reviewAuthorName}>{review.guestName}</Text>
                  <View style={styles.ratingRow}>
                    {Array(5)
                      .fill(0)
                      .map((_, i) => (
                        <Star
                          key={i}
                          size={14}
                          color={i < review.rating ? '#FBBF24' : '#D1D5DB'}
                          fill={i < review.rating ? '#FBBF24' : 'transparent'}
                        />
                      ))}
                    {review.rating > 0 && <Text style={styles.reviewRatingText}>{review.rating}</Text>}
                  </View>
                </View>
                <Text style={styles.reviewDate}>
                  {review.date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                </Text>
              </View>
              <Text style={styles.reviewListingName}>{review.listingName}</Text>
              <Text style={styles.reviewComment} numberOfLines={3}>
                {review.comment}
              </Text>
            </View>
          ))}

          {mockReviews.length === 0 && (
            <View style={styles.emptyReviewCard}>
              <Text style={styles.emptyReviewText}>No reviews yet.</Text>
            </View>
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
