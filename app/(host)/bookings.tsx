import { useTranslation } from 'react-i18next';
// app/(host)/bookings.tsx
import { apiGet, apiPut } from '@/services/api';
import { differenceInDays, format } from 'date-fns';
import { useRouter } from 'expo-router';
import { Calendar, MessageCircle, Users, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Image, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Booking {
  id: string;
  bookingCode?: string;
  guestName: string;
  guestAvatar: string;
  guestEmail?: string;
  listingName: string;
  checkIn: Date;
  checkOut: Date;
  payoutAmount: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  guests: number;
}

// --- Booking Card Component ---
interface BookingCardProps {
  booking: Booking;
  onAccept?: () => void;
  onDecline?: () => void;
  onCancel?: () => void;
  onMessage: () => void;
  showActions: boolean;
}

function BookingCard({
  booking,
  onAccept,
  onDecline,
  onCancel,
  onMessage,
  showActions,
}: BookingCardProps) {
  const { t } = useTranslation();
  const nights = differenceInDays(booking.checkOut, booking.checkIn);
  const getStatusStyle = (status: string) => {
    if (status === 'confirmed') return styles.badgeConfirmed;
    if (status === 'pending') return styles.badgePending;
    if (status === 'completed') return styles.badgeCompleted;
    return styles.badgePending;
  };
  const getStatusTextStyle = (status: string) => {
    if (status === 'confirmed') return styles.badgeTextConfirmed;
    if (status === 'pending') return styles.badgeTextPending;
    if (status === 'completed') return styles.badgeTextCompleted;
    return styles.badgeTextPending;
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Image source={{ uri: booking.guestAvatar }} style={styles.avatar} />
        <View style={styles.headerText}>
          <View style={styles.nameRow}>
            <Text style={styles.guestName}>{booking.guestName}</Text>
            <View style={[styles.statusBadge, getStatusStyle(booking.status)]}>
              <Text style={[styles.statusBadgeText, getStatusTextStyle(booking.status)]}>{booking.status}</Text>
            </View>
          </View>
          <Text style={styles.listingName} numberOfLines={1}>{booking.listingName}</Text>
        </View>
      </View>
      
      <View style={styles.detailsContainer}>
        <View style={styles.detailRow}>
          <Calendar size={16} color="#6B7280" />
          <Text style={styles.detailText}>
            {format(booking.checkIn, 'MMM dd')} → {format(booking.checkOut, 'MMM dd, yyyy')}
            <Text style={styles.nightsText}> ({nights} night{nights !== 1 ? 's' : ''})</Text>
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Users size={16} color="#6B7280" />
          <Text style={styles.detailText}>{booking.guests} guest{booking.guests !== 1 ? 's' : ''}</Text>
        </View>
      </View>
      
      <View style={styles.divider} />
      
      <View style={styles.payoutSection}>
        <Text style={styles.payoutLabel}>{t('host.bookings.payout_amount')}</Text>
        <Text style={styles.payoutAmount}>₹{booking.payoutAmount.toLocaleString('en-IN')}</Text>
      </View>
      
      {/* Action buttons section */}
      <View style={styles.actionButtonsContainer}>
        <TouchableOpacity style={styles.messageButton} onPress={onMessage}>
          <MessageCircle size={18} color="#111827" />
          <Text style={styles.messageButtonText}>{t('host.bookings.message_guest')}</Text>
        </TouchableOpacity>
        
        {onCancel && booking.status !== 'cancelled' && booking.status !== 'completed' && (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onCancel}
          >
            <X size={18} color="#DC2626" />
            <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// --- Main Screen Component ---
export default function HostBookingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [requests, setRequests] = useState<Booking[]>([]);
  const [upcoming, setUpcoming] = useState<Booking[]>([]);
  const [past, setPast] = useState<Booking[]>([]);

  const loadHostBookings = useCallback(async () => {
    try {
      const data = await apiGet<{
        requests: any[];
        upcoming: any[];
        past: any[];
        all: any[];
      }>('/v1/host/bookings');

      const mapBooking = (b: any): Booking => {
        // Use actual guest avatar from profile if available, otherwise fallback
        const guestAvatar = b.guest_avatar_url || 
                          (b.guest_email ? `https://i.pravatar.cc/150?u=${b.guest_email}` : 
                           `https://i.pravatar.cc/150?u=${b.guest_name}`);
        
        return {
          id: String(b.booking_id ?? b.id),
          bookingCode: b.booking_code,
          guestName: b.guest_name,
          guestAvatar: guestAvatar,
          guestEmail: b.guest_email,
          listingName: b.listing_name,
          checkIn: new Date(b.check_in),
          checkOut: new Date(b.check_out),
          guests: b.guests,
          payoutAmount: Number(b.payout_amount ?? b.total_paid ?? 0),
          status: b.status,
        };
      };

      setRequests((data.requests || []).map(mapBooking));
      setUpcoming((data.upcoming || []).map(mapBooking));
      setPast((data.past || []).map(mapBooking));
    } catch (err) {
      console.error('Failed to load host bookings:', err);
    }
  }, []);

  const openBookingChat = async (bookingId: string) => {
    try {
      await apiGet(`/v1/chats/${bookingId}/messages`);
      router.push(`/chats/${bookingId}`);
    } catch (e: any) {
      console.error('Failed to open chat', e);
      Alert.alert('Chat error', e?.message ?? 'Could not open chat');
    }
  };

  useEffect(() => {
    loadHostBookings();
  }, [loadHostBookings]);

  const handleCancelUpcoming = (bookingId: string) => {
    Alert.alert('Cancel booking?', 'Are you sure you want to cancel this booking?', [
      { text: 'Keep booking', style: 'cancel' },
      {
        text: 'Cancel booking',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiPut(`/v1/host/bookings/${bookingId}`, { action: 'cancel' });
            Alert.alert('Cancelled', 'Booking has been cancelled.');
            await loadHostBookings();
          } catch (err) {
            console.error('Failed to cancel booking', err);
            Alert.alert(t('common.error'), 'Failed to cancel booking.');
          }
        },
      },
    ]);
  };

  const renderContent = () => {
    if (activeTab === 'upcoming') {
      return upcoming.length === 0
        ? <EmptyState type="upcoming" />
        : upcoming.map(b => (
            <BookingCard
              key={b.id}
              booking={b}
              onMessage={() => openBookingChat(b.id)}
              showActions={false}
              onCancel={() => handleCancelUpcoming(b.id)}
            />
          ));
    }

    if (activeTab === 'past') {
      return past.length === 0
        ? <EmptyState type="past" />
        : past.map(b => (
            <BookingCard
              key={b.id}
              booking={b}
              onMessage={() => openBookingChat(b.id)}
              showActions={false}
            />
          ));
    }
    return null;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Custom Header */}
      <View style={styles.customHeader}>
        <View style={styles.headerPlaceholder} />
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>{t('tabs.bookings')}</Text>
        </View>
        <View style={styles.headerPlaceholder} />
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TabButton title={t('host.bookings.upcoming')} isActive={activeTab === 'upcoming'} onPress={() => setActiveTab('upcoming')} />
        <TabButton title={t('host.bookings.past')} isActive={activeTab === 'past'} onPress={() => setActiveTab('past')} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {renderContent()}
      </ScrollView>
    </SafeAreaView>
  );
}

// --- Helper Components ---
const TabButton = ({ title, isActive, onPress, badgeCount = 0 }: { title: string; isActive: boolean; onPress: () => void; badgeCount?: number }) => (
  <TouchableOpacity style={[styles.tab, isActive && styles.tabActive]} onPress={onPress}>
    <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{title}</Text>
    {badgeCount > 0 && (
      <View style={styles.tabBadge}><Text style={styles.tabBadgeText}>{badgeCount}</Text></View>
    )}
  </TouchableOpacity>
);

const EmptyState = ({ type }: { type: string }) => (
  <View style={styles.emptyContainer}>
    <Calendar size={48} color="#D1D5DB" />
    <Text style={styles.emptyTitle}>No {type} bookings</Text>
    <Text style={styles.emptySubtitle}>Your {type} bookings will appear here.</Text>
  </View>
);

// --- Styles ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
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
  headerTitleContainer: { alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#111827' },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  tabActive: { borderBottomColor: '#111827' },
  tabText: { fontSize: 14, fontWeight: '500', color: '#6B7280' },
  tabTextActive: { color: '#111827', fontWeight: '600' },
  tabBadge: {
    backgroundColor: '#DC2626',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabBadgeText: { color: 'white', fontSize: 10, fontWeight: 'bold' },
  scrollContent: { padding: 16, gap: 12 },
  emptyContainer: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '600' },
  emptySubtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center' },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  headerText: { flex: 1 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  guestName: { fontSize: 16, fontWeight: '600', color: '#111827' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeConfirmed: { backgroundColor: '#D1FAE5' },
  badgeTextConfirmed: { color: '#065F46' },
  badgePending: { backgroundColor: '#FEF3C7' },
  badgeTextPending: { color: '#92400E' },
  badgeCompleted: { backgroundColor: '#F3F4F6' },
  badgeTextCompleted: { color: '#4B5563' },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  listingName: { fontSize: 14, color: '#6B7280' },
  detailsContainer: { gap: 8, marginBottom: 12 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailText: { fontSize: 14, color: '#374151' },
  nightsText: { color: '#6B7280' },
  divider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 12 },
  payoutSection: {
    marginBottom: 12,
  },
  payoutLabel: { fontSize: 14, color: '#6B7280', marginBottom: 4 },
  payoutAmount: { fontSize: 20, fontWeight: '600', color: '#111827' },
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  messageButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  messageButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: '#FEE2E2',
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#DC2626',
  },
});