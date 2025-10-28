// app/(host)/bookings.tsx
import { addDays, differenceInDays, format } from 'date-fns';
import { useRouter } from 'expo-router';
import { Calendar, Check, MessageCircle, Users, X } from 'lucide-react-native';
import React, { useState } from 'react';
import { Alert, Image, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Booking {
  id: string; guestName: string; guestAvatar: string; listingName: string;
  checkIn: Date; checkOut: Date; payoutAmount: number; status: 'pending' | 'confirmed' | 'cancelled' | 'completed'; guests: number;
}

const mockRequests: Booking[] = [
  { id: '1', guestName: 'Amit Patel', guestAvatar: 'https://i.pravatar.cc/150?img=15', listingName: 'Modern Studio', checkIn: addDays(new Date(), 5), checkOut: addDays(new Date(), 8), payoutAmount: 6600, status: 'pending', guests: 2 },
  { id: '2', guestName: 'Priya Singh', guestAvatar: 'https://i.pravatar.cc/150?img=9', listingName: 'Beach Villa', checkIn: addDays(new Date(), 10), checkOut: addDays(new Date(), 15), payoutAmount: 27500, status: 'pending', guests: 4 },
];
const mockUpcoming: Booking[] = [
  { id: '4', guestName: 'Sneha Reddy', guestAvatar: 'https://i.pravatar.cc/150?img=5', listingName: 'Modern Studio', checkIn: addDays(new Date(), 2), checkOut: addDays(new Date(), 5), payoutAmount: 6600, status: 'confirmed', guests: 2 },
];
const mockPast: Booking[] = [
  { id: '6', guestName: 'Anjali Sharma', guestAvatar: 'https://i.pravatar.cc/150?img=9', listingName: 'Cozy Cottage', checkIn: addDays(new Date(), -10), checkOut: addDays(new Date(), -7), payoutAmount: 9600, status: 'completed', guests: 2 },
];

// --- Booking Card Component ---
interface BookingCardProps {
  booking: Booking; onAccept?: () => void; onDecline?: () => void;
  onMessage: () => void; showActions: boolean;
}
function BookingCard({ booking, onAccept, onDecline, onMessage, showActions }: BookingCardProps) {
  const nights = differenceInDays(booking.checkOut, booking.checkIn);
  const getStatusStyle = (status: string) => {
    if (status === 'confirmed') return styles.badgeConfirmed;
    if (status === 'pending') return styles.badgePending;
    if (status === 'completed') return styles.badgeCompleted;
    return styles.badgePending; // Default
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
      <View style={styles.payoutRow}>
        <View>
          <Text style={styles.payoutLabel}>Payout amount</Text>
          <Text style={styles.payoutAmount}>₹{booking.payoutAmount.toLocaleString('en-IN')}</Text>
        </View>
         {/* Message button common for all states except pending */}
        {!showActions && (
             <TouchableOpacity style={styles.messageButtonSingle} onPress={onMessage}>
                 <MessageCircle size={16} color="#111827" />
                 <Text style={styles.messageButtonText}>Message Guest</Text>
             </TouchableOpacity>
        )}
      </View>

      {showActions && (
        <View style={styles.actionsContainer}>
          <TouchableOpacity style={[styles.actionButton, styles.acceptButton]} onPress={onAccept}>
            <Check size={16} color="white" /><Text style={styles.acceptButtonText}>Accept</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, styles.declineButton]} onPress={onDecline}>
            <X size={16} color="#374151" /><Text style={styles.declineButtonText}>Decline</Text>
          </TouchableOpacity>
           <TouchableOpacity style={[styles.actionButton, styles.messageButton]} onPress={onMessage}>
             <MessageCircle size={16} color="#374151" />
           </TouchableOpacity>
        </View>
      )}
    </View>
  );
}


// --- Main Screen Component ---
export default function HostBookingsScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('requests');
  const [requests, setRequests] = useState(mockRequests); // Manage requests state

  const handleAccept = (bookingId: string) => {
    setRequests(prev => prev.filter(r => r.id !== bookingId));
    Alert.alert('Accepted', 'Booking confirmed!');
    // Move booking to 'upcoming' list in a real app
  };

  const handleDecline = (bookingId: string) => {
     Alert.alert('Decline Booking?', 'Are you sure?', [
        {text: 'Cancel', style: 'cancel'},
        {text: 'Decline', style: 'destructive', onPress: () => {
             setRequests(prev => prev.filter(r => r.id !== bookingId));
             Alert.alert('Declined', 'Booking declined.');
        }}
     ]);
  };

  const handleMessageGuest = (guestName: string) => Alert.alert('Message Guest', `Opening chat with ${guestName}...`);

  const renderContent = () => {
    if (activeTab === 'requests') {
      return requests.length === 0 ? <EmptyState type="requests"/> : requests.map(b => <BookingCard key={b.id} booking={b} onAccept={() => handleAccept(b.id)} onDecline={() => handleDecline(b.id)} onMessage={() => handleMessageGuest(b.guestName)} showActions={true} />);
    }
    if (activeTab === 'upcoming') {
       return mockUpcoming.length === 0 ? <EmptyState type="upcoming"/> : mockUpcoming.map(b => <BookingCard key={b.id} booking={b} onMessage={() => handleMessageGuest(b.guestName)} showActions={false} />);
    }
    if (activeTab === 'past') {
       return mockPast.length === 0 ? <EmptyState type="past"/> : mockPast.map(b => <BookingCard key={b.id} booking={b} onMessage={() => handleMessageGuest(b.guestName)} showActions={false} />);
    }
    return null;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Custom Header */}
      <View style={styles.customHeader}>
         <View style={styles.headerPlaceholder} />{/* Left Placeholder */}
         <View style={styles.headerTitleContainer}>
             <Text style={styles.headerTitle}>Bookings</Text>
             {requests.length > 0 && <Text style={styles.headerSubtitle}>{requests.length} pending request{requests.length !== 1 ? 's' : ''}</Text>}
         </View>
         <View style={styles.headerPlaceholder} />{/* Right Placeholder */}
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TabButton title="Requests" isActive={activeTab === 'requests'} onPress={() => setActiveTab('requests')} badgeCount={requests.length} />
        <TabButton title="Upcoming" isActive={activeTab === 'upcoming'} onPress={() => setActiveTab('upcoming')} />
        <TabButton title="Past" isActive={activeTab === 'past'} onPress={() => setActiveTab('past')} />
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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB', backgroundColor: '#FFFFFF',
  },
  headerPlaceholder: { width: 40 }, // Placeholder width
  headerTitleContainer: { alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#111827' },
  headerSubtitle: { fontSize: 14, color: '#6B7280', marginTop: 2 },
  tabsContainer: { flexDirection: 'row', backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  tabActive: { borderBottomColor: '#111827' },
  tabText: { fontSize: 14, fontWeight: '500', color: '#6B7280' },
  tabTextActive: { color: '#111827', fontWeight: '600' },
  tabBadge: { backgroundColor: '#DC2626', borderRadius: 10, width: 20, height: 20, justifyContent: 'center', alignItems: 'center' },
  tabBadgeText: { color: 'white', fontSize: 10, fontWeight: 'bold' },
  scrollContent: { padding: 16, gap: 12 },
  emptyContainer: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '600' },
  emptySubtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center' },
  card: { backgroundColor: 'white', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  headerText: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  guestName: { fontSize: 16, fontWeight: 'bold' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeConfirmed: { backgroundColor: '#D1FAE5' }, badgeTextConfirmed: { color: '#065F46' },
  badgePending: { backgroundColor: '#FEF3C7' }, badgeTextPending: { color: '#92400E' },
  badgeCompleted: { backgroundColor: '#F3F4F6' }, badgeTextCompleted: { color: '#4B5563' },
  statusBadgeText: { fontSize: 12, fontWeight: '500', textTransform: 'capitalize' },
  listingName: { fontSize: 14, color: '#6B7280' },
  detailsContainer: { gap: 8, marginBottom: 12 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailText: { fontSize: 14 },
  nightsText: { color: '#6B7280' },
  divider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 12 },
  payoutRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  payoutLabel: { fontSize: 14, color: '#6B7280', marginBottom: 2 },
  payoutAmount: { fontSize: 18, fontWeight: '600' },
   messageButtonSingle: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8 },
   messageButtonText: { fontSize: 14, fontWeight: '500', color: '#111827' },
  actionsContainer: { flexDirection: 'row', gap: 8 },
  actionButton: { paddingVertical: 10, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  acceptButton: { flex: 1, backgroundColor: '#111827' }, acceptButtonText: { color: 'white', fontWeight: 'bold' },
  declineButton: { flex: 1, backgroundColor: '#F3F4F6' }, declineButtonText: { color: '#374151', fontWeight: 'bold' },
  messageButton: { backgroundColor: '#F3F4F6', paddingHorizontal: 10 }, // Icon only
});