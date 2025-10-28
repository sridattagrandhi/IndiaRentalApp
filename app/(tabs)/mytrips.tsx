// app/(tabs)/mytrips.tsx
import { addDays, differenceInDays, format, isFuture, isPast } from 'date-fns';
import { Image } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
import {
    Calendar,
    CheckCircle2,
    Clock,
    Download, Edit,
    MapPin, MessageCircle, Navigation,
    Star
} from 'lucide-react-native';
import React, { useState } from 'react';
import {
    Alert,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// --- Interfaces ---
interface Trip {
  id: string;
  bookingCode: string;
  listingName: string;
  listingImage: string; // URL for the image
  location: string;
  checkIn: Date;
  checkOut: Date;
  guests: number;
  totalPaid: number;
  status: 'upcoming' | 'completed' | 'cancelled'; // Added cancelled for completeness
  canModify: boolean;
  hostName: string;
  hostPhone: string;
  receiptUrl?: string; // Optional URL for receipt download
}

// --- Mock Data (Use Dates for comparison) ---
const mockTrips: Trip[] = [
  {
    id: '1', bookingCode: 'BK7X9K2L4M', listingName: 'Modern Studio in Koramangala',
    listingImage: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=200&h=200&fit=crop', // Example image URL
    location: 'Koramangala 5th Block, Bangalore', checkIn: addDays(new Date(), 5), checkOut: addDays(new Date(), 8),
    guests: 2, totalPaid: 8500, status: 'upcoming', canModify: true, hostName: 'Rajesh Kumar', hostPhone: '+91 98765 43210'
  },
  {
    id: '2', bookingCode: 'BK3H8P1N6Q', listingName: 'Beachfront Villa in Goa',
    listingImage: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=200&h=200&fit=crop',
    location: 'Candolim, North Goa', checkIn: addDays(new Date(), 15), checkOut: addDays(new Date(), 20),
    guests: 4, totalPaid: 35000, status: 'upcoming', canModify: true, hostName: 'Maria D\'Souza', hostPhone: '+91 99887 65432'
  },
  {
    id: '3', bookingCode: 'BK9M2N4P8R', listingName: 'Cozy Cottage in Manali',
    listingImage: 'https://images.unsplash.com/photo-1585544493593-84f1b838493a?w=200&h=200&fit=crop',
    location: 'Old Manali, Himachal Pradesh', checkIn: addDays(new Date(), -15), checkOut: addDays(new Date(), -12),
    guests: 3, totalPaid: 12000, status: 'completed', canModify: false, hostName: 'Suresh Sharma', hostPhone: '+91 97654 32109'
  },
  {
    id: '4', bookingCode: 'BK5K7L3M9P', listingName: 'Heritage Home in Jaipur',
    listingImage: 'https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?w=200&h=200&fit=crop',
    location: 'Pink City, Jaipur', checkIn: addDays(new Date(), -45), checkOut: addDays(new Date(), -42),
    guests: 2, totalPaid: 15600, status: 'completed', canModify: false, hostName: 'Vikram Singh', hostPhone: '+91 96543 21098'
  }
];

// --- Upcoming Trip Card Component ---
interface TripCardProps {
  trip: Trip;
  onDownloadReceipt: () => void;
  onModifyDates: () => void; // Simple trigger for now
  onGetDirections: () => void;
  onMessageHost: () => void;
}
function TripCard({ trip, onDownloadReceipt, onModifyDates, onGetDirections, onMessageHost }: TripCardProps) {
  const daysUntil = differenceInDays(trip.checkIn, new Date());

  return (
    <View style={styles.cardContainer}>
      <View style={styles.cardHeader}>
        <Image source={{ uri: trip.listingImage }} style={styles.cardImage} />
        <View style={styles.cardHeaderText}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle} numberOfLines={1}>{trip.listingName}</Text>
            {daysUntil >= 0 && (
                <View style={styles.badge}>
                    <Text style={styles.badgeText}>{daysUntil} {daysUntil === 1 ? 'day' : 'days'}</Text>
                </View>
            )}
          </View>
          <View style={styles.locationRow}>
            <MapPin size={14} color="#6B7280" />
            <Text style={styles.cardSubtitle} numberOfLines={1}>{trip.location}</Text>
          </View>
          <View style={styles.dateRow}>
            <Calendar size={14} color="#6B7280" />
            <Text style={styles.dateText}>
              {format(trip.checkIn, 'MMM dd')} - {format(trip.checkOut, 'MMM dd, yyyy')}
            </Text>
          </View>
           <Text style={styles.bookingCodeText}>Booking code: {trip.bookingCode}</Text>
        </View>
      </View>
      <View style={styles.cardDivider} />
      <View style={styles.cardActions}>
        {trip.canModify && (
          <TouchableOpacity style={styles.actionButton} onPress={onModifyDates}>
            <Edit size={16} color="#4B5563" />
            <Text style={styles.actionText}>Change dates</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.actionButton} onPress={onGetDirections}>
          <Navigation size={16} color="#4B5563" />
          <Text style={styles.actionText}>Directions</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={onMessageHost}>
          <MessageCircle size={16} color="#4B5563" />
          <Text style={styles.actionText}>Message host</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={onDownloadReceipt}>
          <Download size={16} color="#4B5563" />
          <Text style={styles.actionText}>Receipt</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// --- Past Trip Card Component ---
interface PastTripCardProps {
  trip: Trip;
  onRebook: () => void;
  onReview: () => void; // Simple trigger for now
  onDownloadReceipt: () => void;
}
function PastTripCard({ trip, onRebook, onReview, onDownloadReceipt }: PastTripCardProps) {
    return (
        <View style={styles.cardContainer}>
            <View style={styles.cardHeader}>
                <Image source={{ uri: trip.listingImage }} style={styles.cardImage} />
                <View style={styles.cardHeaderText}>
                     <View style={styles.cardTitleRow}>
                        <Text style={styles.cardTitle} numberOfLines={1}>{trip.listingName}</Text>
                        <View style={[styles.badge, styles.completedBadge]}>
                             <CheckCircle2 size={12} color="#16A34A"/>
                            <Text style={[styles.badgeText, styles.completedBadgeText]}>Completed</Text>
                        </View>
                    </View>
                    <View style={styles.locationRow}>
                        <MapPin size={14} color="#6B7280" />
                        <Text style={styles.cardSubtitle} numberOfLines={1}>{trip.location}</Text>
                    </View>
                     <View style={styles.dateRow}>
                        <Calendar size={14} color="#6B7280" />
                        <Text style={styles.dateText}>
                        {format(trip.checkIn, 'MMM dd')} - {format(trip.checkOut, 'MMM dd, yyyy')}
                        </Text>
                    </View>
                     <Text style={styles.totalPaidText}>Total paid: ₹{trip.totalPaid.toLocaleString('en-IN')}</Text>
                </View>
            </View>
            <View style={styles.cardDivider} />
             <View style={styles.cardActionsPast}>
                <TouchableOpacity style={styles.actionButton} onPress={onRebook}>
                    <Calendar size={16} color="#4B5563" />
                    <Text style={styles.actionText}>Rebook</Text>
                </TouchableOpacity>
                 <TouchableOpacity style={styles.actionButton} onPress={onReview}>
                    <Star size={16} color="#4B5563" />
                    <Text style={styles.actionText}>Review</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={onDownloadReceipt}>
                    <Download size={16} color="#4B5563" />
                    <Text style={styles.actionText}>Receipt</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

// --- Main My Trips Page ---
export default function MyTripsPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState('upcoming'); // 'upcoming' or 'past'
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);

  // Filter trips based on status
  const upcomingTrips = mockTrips.filter(trip => trip.status === 'upcoming' && isFuture(trip.checkIn));
  const pastTrips = mockTrips.filter(trip => trip.status === 'completed' || isPast(trip.checkOut));

  // --- Mock Handlers (Replace with actual logic) ---
  const handleDownloadReceipt = (trip: Trip) => Alert.alert('Download Receipt', `Downloading receipt for ${trip.bookingCode}`);
  const handleModifyDates = (trip: Trip) => Alert.alert('Modify Dates', `Request date change for ${trip.bookingCode}`); // In real app, open a date picker modal
  const handleGetDirections = (trip: Trip) => Alert.alert('Get Directions', `Getting directions to ${trip.location}`); // In real app, open maps
  const handleMessageHost = (trip: Trip) => Alert.alert('Message Host', `Messaging ${trip.hostName}`); // In real app, navigate to chat
  const handleRebook = (trip: Trip) => Alert.alert('Rebook', `Rebooking ${trip.listingName}`); // In real app, navigate to booking flow
  const handleReview = (trip: Trip) => Alert.alert('Leave Review', `Leaving review for ${trip.listingName}`); // In real app, open review modal/screen

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'My Trips', headerLargeTitle: true }} />

      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'upcoming' && styles.tabButtonActive]}
          onPress={() => setActiveTab('upcoming')}
        >
          <Text style={[styles.tabText, activeTab === 'upcoming' && styles.tabTextActive]}>
            Upcoming ({upcomingTrips.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'past' && styles.tabButtonActive]}
          onPress={() => setActiveTab('past')}
        >
          <Text style={[styles.tabText, activeTab === 'past' && styles.tabTextActive]}>
            Past ({pastTrips.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Trip List */}
      <ScrollView contentContainerStyle={styles.listContent}>
        {activeTab === 'upcoming' && (
          <>
            {upcomingTrips.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Calendar size={64} color="#E5E7EB" />
                <Text style={styles.emptyTitle}>No upcoming trips</Text>
                <Text style={styles.emptySubtitle}>Time to plan your next adventure!</Text>
                <TouchableOpacity style={styles.browseButton} onPress={() => router.push('/(tabs)')}>
                     <Text style={styles.browseButtonText}>Explore stays</Text>
                </TouchableOpacity>
              </View>
            ) : (
              upcomingTrips.map((trip) => (
                <TripCard
                  key={trip.id} trip={trip}
                  onDownloadReceipt={() => handleDownloadReceipt(trip)}
                  onModifyDates={() => handleModifyDates(trip)}
                  onGetDirections={() => handleGetDirections(trip)}
                  onMessageHost={() => handleMessageHost(trip)}
                />
              ))
            )}
          </>
        )}

        {activeTab === 'past' && (
          <>
            {pastTrips.length === 0 ? (
               <View style={styles.emptyContainer}>
                <Clock size={64} color="#E5E7EB" />
                <Text style={styles.emptyTitle}>No past trips</Text>
                <Text style={styles.emptySubtitle}>Your completed trips will appear here</Text>
              </View>
            ) : (
              pastTrips.map((trip) => (
                <PastTripCard
                    key={trip.id} trip={trip}
                    onRebook={() => handleRebook(trip)}
                    onReview={() => handleReview(trip)}
                    onDownloadReceipt={() => handleDownloadReceipt(trip)}
                />
              ))
            )}
          </>
        )}
      </ScrollView>

      {/* Add Modals for Modify Dates and Review later if needed */}

    </SafeAreaView>
  );
}

// --- Styles --- (Adapted from web example)
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  tabContainer: {
    flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8,
    backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  tabButton: {
    flex: 1, paddingVertical: 10, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabButtonActive: { borderBottomColor: '#111827' },
  tabText: { fontSize: 16, color: '#6B7280' },
  tabTextActive: { color: '#111827', fontWeight: 'bold' },

  listContent: { padding: 16 },

  cardContainer: {
    backgroundColor: 'white', borderRadius: 12, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1, shadowRadius: 3, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', padding: 12 },
  cardImage: { width: 80, height: 80, borderRadius: 8, marginRight: 12 },
  cardHeaderText: { flex: 1 },
  cardTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#111827', flexShrink: 1, marginRight: 8 }, // Allow shrinking
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  cardSubtitle: { fontSize: 13, color: '#6B7280', flexShrink: 1 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  dateText: { fontSize: 13, color: '#374151' },
  bookingCodeText: { fontSize: 12, color: '#6B7280', backgroundColor: '#F3F4F6', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4, alignSelf: 'flex-start' },
  totalPaidText: { fontSize: 13, color: '#6B7280', marginTop: 4 },

  badge: { backgroundColor: '#E5E7EB', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 12, fontWeight: '500', color: '#374151' },
    completedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#D1FAE5', paddingHorizontal: 6}, // Greenish background
    completedBadgeText: { color: '#065F46' }, // Dark green text


  cardDivider: { height: 1, backgroundColor: '#E5E7EB' },
  cardActions: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 8, flexWrap: 'wrap', rowGap: 8 }, // Allow wrapping
    cardActionsPast: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 8 },
  actionButton: { alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4 }, // Add padding
  actionText: { fontSize: 13, color: '#4B5563', marginTop: 2 },

    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, marginTop: 40 },
    emptyTitle: { fontSize: 18, fontWeight: 'bold', marginTop: 16, marginBottom: 8 },
    emptySubtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 16 },
    browseButton: { backgroundColor: '#111827', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
    browseButtonText: { color: 'white', fontWeight: 'bold' },
});