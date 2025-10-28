// app/(host)/listings.tsx
import { useRouter } from 'expo-router';
// FIX: Add 'List' to the import statement
import { Calendar, Edit, List, MapPin, Pause, Play, Plus, Star } from 'lucide-react-native';
import React, { useState } from 'react';
import { Alert, Image, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Listing {
  id: string; title: string; location: string; image: string;
  status: 'live' | 'paused' | 'review' | 'draft'; pricePerNight: number;
  rating: number; reviewCount: number;
}

const mockListings: Listing[] = [
  { id: '1', title: 'Modern Studio', location: 'Koramangala, Bangalore', image: 'modern apartment', status: 'live', pricePerNight: 2200, rating: 4.8, reviewCount: 42 },
  { id: '2', title: 'Beachfront Villa', location: 'Candolim, Goa', image: 'beach villa', status: 'live', pricePerNight: 5500, rating: 4.9, reviewCount: 67 },
  { id: '3', title: 'Cozy Cottage', location: 'Old Manali, HP', image: 'mountain cottage', status: 'paused', pricePerNight: 3200, rating: 4.7, reviewCount: 28 },
  { id: '4', title: 'Luxury Apt', location: 'Bandra, Mumbai', image: 'luxury apartment', status: 'review', pricePerNight: 4800, rating: 0, reviewCount: 0 },
  { id: '5', title: 'Heritage Home', location: 'Pink City, Jaipur', image: 'heritage home', status: 'draft', pricePerNight: 3800, rating: 0, reviewCount: 0 }
];

export default function HostListingsScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState('All'); // Example filter state

  const handleAddListing = () => {
    // Navigate to the create listing screen
    router.push('/(host)/listings/create-listing');
  };
  const handleEditListing = (id: string) => Alert.alert('Edit Listing', `Edit listing ${id}...`);
  const handleTogglePause = (listing: Listing) => {
    Alert.alert(listing.status === 'paused' ? 'Activate Listing?' : 'Pause Listing?', `Listing: ${listing.title}`, [
        {text: 'Cancel', style: 'cancel'},
        {text: listing.status === 'paused' ? 'Activate' : 'Pause', onPress: () => Alert.alert('Status Changed')} // Add actual logic
    ]);
  };
  const handleViewCalendar = (id: string) => Alert.alert('View Calendar', `View calendar for listing ${id}...`);

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'live': return styles.badgeLive;
      case 'paused': return styles.badgePaused;
      case 'review': return styles.badgeReview;
      case 'draft': return styles.badgeDraft;
      default: return styles.badgePaused;
    }
  };
   const getStatusTextStyle = (status: string) => {
    switch (status) {
      case 'live': return styles.badgeTextLive;
      case 'paused': return styles.badgeTextPaused;
      case 'review': return styles.badgeTextReview;
      case 'draft': return styles.badgeTextDraft;
      default: return styles.badgeTextPaused;
    }
  };
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'live': return 'Live'; case 'paused': return 'Paused';
      case 'review': return 'In Review'; case 'draft': return 'Draft'; default: return status;
    }
  };

  // Basic filtering - replace with more robust logic if needed
  const filteredListings = mockListings.filter(l => {
      if (filter === 'All') return true;
      // Adjust filter comparison if needed (e.g., 'In Review' vs 'review')
      const filterLower = filter === 'In Review' ? 'review' : filter.toLowerCase();
      return l.status.toLowerCase() === filterLower;
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* Custom header integrated */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Your Listings</Text>
          <Text style={styles.headerSubtitle}>{mockListings.length} properties</Text>
        </View>
        <TouchableOpacity style={styles.addButtonHeader} onPress={handleAddListing}>
          <Plus size={16} color="white" />
          <Text style={styles.addButtonHeaderText}>Add New</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Chips */}
      <View style={{ paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#EEEFF3' }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContainer}>
          {/* Use correct labels for filters */}
          {['All', 'Live', 'Paused', 'In Review', 'Draft'].map(f => (
            <TouchableOpacity key={f} style={[styles.filterChip, filter === f && styles.filterChipActive]} onPress={() => setFilter(f)}>
              <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Listings */}
      <ScrollView contentContainerStyle={styles.listContent}>
        {filteredListings.length === 0 ? (
            <View style={styles.emptyContainer}>
                {/* Error was here: Use the imported 'List' icon */}
                <List size={48} color="#D1D5DB"/>
                <Text style={styles.emptyText}>No listings found for "{filter}"</Text>
            </View>
        ) : (
            filteredListings.map((listing) => (
              <View key={listing.id} style={styles.card}>
                <View style={styles.cardContent}>
                  <Image
                    source={{ uri: `https://source.unsplash.com/400x400/?${encodeURIComponent(listing.image)}` }}
                    style={styles.cardImage}
                    // Add placeholder/transition if using expo-image
                  />
                  <View style={styles.cardDetails}>
                    <View style={styles.cardTitleRow}>
                      <Text style={styles.cardTitle} numberOfLines={1}>{listing.title}</Text>
                       <View style={[styles.statusBadge, getStatusStyle(listing.status)]}>
                           <Text style={[styles.statusBadgeText, getStatusTextStyle(listing.status)]}>{getStatusLabel(listing.status)}</Text>
                       </View>
                    </View>
                    <View style={styles.locationRow}>
                      <MapPin size={12} color="#6B7280" />
                      <Text style={styles.cardLocation} numberOfLines={1}>{listing.location}</Text>
                    </View>
                    <View style={styles.priceRatingRow}>
                      <View>
                        <Text style={styles.cardPrice}>₹{listing.pricePerNight.toLocaleString('en-IN')}</Text>
                        <Text style={styles.cardPriceSub}>per night</Text>
                      </View>
                      {listing.rating > 0 && (
                        <View style={styles.ratingContainer}>
                          <Star size={14} color="#FBBF24" fill="#FBBF24" />
                          <Text style={styles.ratingText}>{listing.rating}</Text>
                          <Text style={styles.reviewCount}>({listing.reviewCount})</Text>
                        </View>
                      )}
                    </View>
                     {/* Actions */}
                    <View style={styles.actionsContainer}>
                       <TouchableOpacity style={styles.actionButton} onPress={() => handleEditListing(listing.id)}>
                           <Edit size={14} color="#374151" /><Text style={styles.actionText}>Edit</Text>
                       </TouchableOpacity>
                       {listing.status !== 'draft' && listing.status !== 'review' && (
                         <TouchableOpacity style={styles.actionButton} onPress={() => handleTogglePause(listing)}>
                            {listing.status === 'paused' ? <Play size={14} color="#374151"/> : <Pause size={14} color="#374151" />}
                            <Text style={styles.actionText}>{listing.status === 'paused' ? 'Activate' : 'Pause'}</Text>
                         </TouchableOpacity>
                       )}
                        <TouchableOpacity style={styles.actionButton} onPress={() => handleViewCalendar(listing.id)}>
                           <Calendar size={14} color="#374151" /><Text style={styles.actionText}>Calendar</Text>
                       </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// --- Styles --- (Keep existing styles)
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#EEEFF3',
  },
  headerTitle: { fontSize: 22, fontWeight: 'bold' },
  headerSubtitle: { fontSize: 14, color: '#6B7280' },
  addButtonHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111827', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, gap: 6 },
  addButtonHeaderText: { color: 'white', fontSize: 14, fontWeight: '500' },
  filterContainer: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: 'white' },
  filterChipActive: { backgroundColor: '#111827', borderColor: '#111827' },
  filterChipText: { fontSize: 13, color: '#374151' },
  filterChipTextActive: { color: 'white', fontWeight: '600' },
  listContent: { padding: 16, gap: 12 },
   emptyContainer: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 32, minHeight: 200 }, // Added flexGrow
  emptyText: { marginTop: 16, fontSize: 16, color: '#6B7280', textAlign: 'center' },
  card: { backgroundColor: 'white', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  cardContent: { flexDirection: 'row', padding: 12, gap: 12 },
  cardImage: { width: 90, height: 90, borderRadius: 8, backgroundColor: '#F3F4F6' },
  cardDetails: { flex: 1 },
  cardTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  cardTitle: { fontSize: 16, fontWeight: '600', flex: 1, marginRight: 8 },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start' },
  statusBadgeText: { fontSize: 10, fontWeight: '500' },
  badgeLive: { backgroundColor: '#D1FAE5'}, badgeTextLive: { color: '#065F46'},
  badgePaused: { backgroundColor: '#E5E7EB'}, badgeTextPaused: { color: '#4B5563'},
  badgeReview: { backgroundColor: '#DBEAFE'}, badgeTextReview: { color: '#1E40AF'},
  badgeDraft: { backgroundColor: '#FEF3C7'}, badgeTextDraft: { color: '#92400E'},
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  cardLocation: { fontSize: 13, color: '#6B7280', flex: 1 },
  priceRatingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardPrice: { fontSize: 16, fontWeight: 'bold' },
  cardPriceSub: { fontSize: 12, color: '#6B7280' },
  ratingContainer: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontSize: 14, fontWeight: '500' },
  reviewCount: { fontSize: 14, color: '#6B7280' },
  actionsContainer: { flexDirection: 'row', gap: 8, borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 10, marginTop: 4, flexWrap: 'wrap' }, // Added flexWrap
  actionButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6, backgroundColor: '#F3F4F6'},
  actionText: { fontSize: 12, color: '#374151', fontWeight: '500'},
});