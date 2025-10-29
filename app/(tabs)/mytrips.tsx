// app/(tabs)/mytrips.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { addDays, differenceInDays, format, isFuture, isPast } from 'date-fns';
import { Image } from 'expo-image';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Edit,
  FolderPlus,
  MapPin,
  MessageCircle,
  Navigation,
  Plus,
  Star,
  Trash2,
  X,
} from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

/** Types & mock data unchanged **/
interface Trip {
  id: string;
  bookingCode: string;
  listingName: string;
  listingImage: string;
  location: string;
  checkIn: Date;
  checkOut: Date;
  guests: number;
  totalPaid: number;
  status: 'upcoming' | 'completed' | 'cancelled';
  canModify: boolean;
  hostName: string;
  hostPhone: string;
  receiptUrl?: string;
}

const mockTrips: Trip[] = [
  {
    id: '1',
    bookingCode: 'BK7X9K2L4M',
    listingName: 'Modern Studio in Koramangala',
    listingImage:
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=200&h=200&fit=crop',
    location: 'Koramangala 5th Block, Bangalore',
    checkIn: addDays(new Date(), 5),
    checkOut: addDays(new Date(), 8),
    guests: 2,
    totalPaid: 8500,
    status: 'upcoming',
    canModify: true,
    hostName: 'Rajesh Kumar',
    hostPhone: '+91 98765 43210',
  },
  {
    id: '2',
    bookingCode: 'BK3H8P1N6Q',
    listingName: 'Beachfront Villa in Goa',
    listingImage:
      'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=200&h=200&fit=crop',
    location: 'Candolim, North Goa',
    checkIn: addDays(new Date(), 15),
    checkOut: addDays(new Date(), 20),
    guests: 4,
    totalPaid: 35000,
    status: 'upcoming',
    canModify: true,
    hostName: "Maria D'Souza",
    hostPhone: '+91 99887 65432',
  },
  {
    id: '3',
    bookingCode: 'BK9M2N4P8R',
    listingName: 'Cozy Cottage in Manali',
    listingImage:
      'https://images.unsplash.com/photo-1585544493593-84f1b838493a?w=200&h=200&fit=crop',
    location: 'Old Manali, Himachal Pradesh',
    checkIn: addDays(new Date(), -15),
    checkOut: addDays(new Date(), -12),
    guests: 3,
    totalPaid: 12000,
    status: 'completed',
    canModify: false,
    hostName: 'Suresh Sharma',
    hostPhone: '+91 97654 32109',
  },
  {
    id: '4',
    bookingCode: 'BK5K7L3M9P',
    listingName: 'Heritage Home in Jaipur',
    listingImage:
      'https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?w=200&h=200&fit=crop',
    location: 'Pink City, Jaipur',
    checkIn: addDays(new Date(), -45),
    checkOut: addDays(new Date(), -42),
    guests: 2,
    totalPaid: 15600,
    status: 'completed',
    canModify: false,
    hostName: 'Vikram Singh',
    hostPhone: '+91 96543 21098',
  },
];

interface TripSavedItem {
  id: string;
  name: string;
  location: string;
  price: number;
  rating: number;
  image: string;
  listId: string;
  coordinates?: { latitude: number; longitude: number };
}
interface TripList {
  id: string;
  name: string;
  description: string;
  count: number;
  coverImage?: string;
}

const TRIP_LISTS_KEY = '@triplists';
const TRIP_SAVED_KEY = '@trip_saved_trips';

const initialTripLists: TripList[] = [
  {
    id: 't1',
    name: 'Future road trips',
    description: 'Draft itineraries & stays',
    count: 0,
    coverImage:
      'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=400&h=300&fit=crop',
  },
  {
    id: 't2',
    name: 'Beach week 2026',
    description: 'Goa + Gokarna plans',
    count: 0,
    coverImage:
      'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=400&h=300&fit=crop',
  },
];

const initialTripSaved: TripSavedItem[] = [
  {
    id: 'ts1',
    name: 'Modern Studio',
    location: 'Koramangala, Bangalore',
    price: 2200,
    rating: 4.8,
    image:
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=400&h=300&fit=crop',
    listId: 't1',
    coordinates: { latitude: 12.935192, longitude: 77.624481 },
  },
  {
    id: 'ts2',
    name: 'Beachfront Villa',
    location: 'Candolim, Goa',
    price: 8500,
    rating: 4.9,
    image:
      'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=400&h=300&fit=crop',
    listId: 't2',
    coordinates: { latitude: 15.518, longitude: 73.7667 },
  },
];

const storeData = async (key: string, value: any) => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('Error saving data', e);
  }
};
const getData = async (key: string, defaultValue: any) => {
  try {
    const jsonValue = await AsyncStorage.getItem(key);
    return jsonValue != null ? JSON.parse(jsonValue) : defaultValue;
  } catch (e) {
    console.error('Error retrieving data', e);
    return defaultValue;
  }
};

/** Cards (unchanged visuals) **/
function TripCard({ trip, onDownloadReceipt, onModifyDates, onGetDirections, onMessageHost }: {
  trip: Trip; onDownloadReceipt: () => void; onModifyDates: () => void; onGetDirections: () => void; onMessageHost: () => void;
}) {
  const daysUntil = differenceInDays(trip.checkIn, new Date());
  return (
    <View style={styles.cardContainer}>
      <View style={styles.cardHeader}>
        <Image source={{ uri: trip.listingImage }} style={styles.cardImage} />
        <View style={styles.cardHeaderText}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle} numberOfLines={1}>{trip.listingName}</Text>
            {daysUntil >= 0 && (
              <View style={styles.badge}><Text style={styles.badgeText}>
                {daysUntil} {daysUntil === 1 ? 'day' : 'days'}
              </Text></View>
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
            <Edit size={16} color="#4B5563" /><Text style={styles.actionText}>Change dates</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.actionButton} onPress={onGetDirections}>
          <Navigation size={16} color="#4B5563" /><Text style={styles.actionText}>Directions</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={onMessageHost}>
          <MessageCircle size={16} color="#4B5563" /><Text style={styles.actionText}>Message host</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={onDownloadReceipt}>
          <Download size={16} color="#4B5563" /><Text style={styles.actionText}>Receipt</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function PastTripCard({ trip, onRebook, onReview, onDownloadReceipt }: {
  trip: Trip; onRebook: () => void; onReview: () => void; onDownloadReceipt: () => void;
}) {
  return (
    <View style={styles.cardContainer}>
      <View style={styles.cardHeader}>
        <Image source={{ uri: trip.listingImage }} style={styles.cardImage} />
        <View style={styles.cardHeaderText}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle} numberOfLines={1}>{trip.listingName}</Text>
            <View style={[styles.badge, styles.completedBadge]}>
              <CheckCircle2 size={12} color="#16A34A" />
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
          <Calendar size={16} color="#4B5563" /><Text style={styles.actionText}>Rebook</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={onReview}>
          <Star size={16} color="#4B5563" /><Text style={styles.actionText}>Review</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={onDownloadReceipt}>
          <Download size={16} color="#4B5563" /><Text style={styles.actionText}>Receipt</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/** My Trips list cards **/
function MyTripsPropertyCard({ item, onRemove, onClick }: {
  item: TripSavedItem; onRemove: () => void; onClick: () => void;
}) {
  const imageSource =
    item.image && item.image.startsWith('http')
      ? { uri: item.image }
      : { uri: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=400&h=300&fit=crop' };

  return (
    <TouchableOpacity style={styles.propertyCardContainer} onPress={onClick}>
      <View style={{ position: 'relative' }}>
        <Image source={imageSource} style={styles.propertyImage} />
        <TouchableOpacity style={styles.removeButton} onPress={onRemove}>
          <X size={16} color="#DC2626" />
        </TouchableOpacity>
      </View>
      <View style={styles.propertyContent}>
        <View style={styles.propertyHeader}>
          <Text style={styles.propertyName} numberOfLines={1}>{item.name}</Text>
          <View style={styles.propertyRating}>
            <Star size={14} color="#F59E0B" fill="#F59E0B" />
            <Text style={styles.propertyRatingText}>{item.rating}</Text>
          </View>
        </View>
        <View style={styles.propertyLocationRow}>
          <MapPin size={16} color="#6B7280" />
          <Text style={styles.propertyLocationText} numberOfLines={1}>{item.location}</Text>
        </View>
        <Text style={styles.propertyPrice}>
          ₹{item.price.toLocaleString('en-IN')}
          <Text style={styles.propertyPriceNight}>/night</Text>
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function MyTripsListCard({ list, onClick, onEdit, onDelete }: {
  list: TripList; onClick: () => void; onEdit: () => void; onDelete: () => void;
}) {
  return (
    <TouchableOpacity style={styles.cardContainer} onPress={onClick}>
      <View style={styles.imageContainer}>
        {list.coverImage ? (
          <Image source={{ uri: list.coverImage }} style={styles.cardImageFull} />
        ) : (
          <View style={styles.placeholderImage}>
            <FolderPlus size={48} color="#FECACA" />
          </View>
        )}
        <TouchableOpacity
          style={styles.optionsButton}
          onPress={(e) => {
            e.stopPropagation();
            Alert.alert(`Options for "${list.name}"`, '', [
              { text: 'Edit', onPress: onEdit },
              { text: 'Delete', onPress: onDelete, style: 'destructive' },
              { text: 'Cancel', style: 'cancel' },
            ]);
          }}
        >
          <Trash2 size={18} color="#333" />
        </TouchableOpacity>
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.listcardTitle}>{list.name}</Text>
        {list.description ? (
          <Text style={styles.listcardDescription}>{list.description}</Text>
        ) : null}
        <Text style={styles.listcardCount}>
          {list.count} {list.count === 1 ? 'property' : 'properties'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function MyTripsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] =
    useState<'upcoming' | 'past' | 'mytrips'>('upcoming');

  const upcomingTrips = mockTrips.filter(
    (trip) => trip.status === 'upcoming' && isFuture(trip.checkIn)
  );
  const pastTrips = mockTrips.filter(
    (trip) => trip.status === 'completed' || isPast(trip.checkOut)
  );

  const [tripLists, setTripLists] = useState<TripList[]>([]);
  const [tripSaved, setTripSaved] = useState<TripSavedItem[]>([]);
  const [selectedList, setSelectedList] = useState<TripList | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListDescription, setNewListDescription] = useState('');
  const [editingList, setEditingList] = useState<TripList | null>(null);

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        let loadedLists = await getData(TRIP_LISTS_KEY, []);
        let loadedSaved = await getData(TRIP_SAVED_KEY, []);
        const listsExist = await AsyncStorage.getItem(TRIP_LISTS_KEY);
        const savedExist = await AsyncStorage.getItem(TRIP_SAVED_KEY);

        if (!listsExist && !savedExist) {
          loadedLists = initialTripLists;
          loadedSaved = initialTripSaved;
          await storeData(TRIP_LISTS_KEY, loadedLists);
          await storeData(TRIP_SAVED_KEY, loadedSaved);
        }

        loadedLists = loadedLists.map((l: TripList) => {
          const props = loadedSaved.filter((p: TripSavedItem) => p.listId === l.id);
          return {
            ...l,
            count: props.length,
            coverImage: l.coverImage || props[0]?.image || undefined,
          };
        });

        setTripLists(loadedLists);
        setTripSaved(loadedSaved);
      };
      load();
    }, [])
  );

  const getListItems = (listId: string) => tripSaved.filter((p) => p.listId === listId);

  const resetModals = () => {
    setNewListName('');
    setNewListDescription('');
    setEditingList(null);
    setShowCreateModal(false);
    setShowEditModal(false);
  };

  const openEditModal = (list: TripList) => {
    setEditingList(list);
    setNewListName(list.name);
    setNewListDescription(list.description);
    setShowEditModal(true);
  };

  const handleCreateList = async () => {
    if (!newListName.trim()) {
      Alert.alert('Error', 'Please enter a list name');
      return;
    }
    const newList: TripList = {
      id: Date.now().toString(),
      name: newListName.trim(),
      description: newListDescription.trim(),
      count: 0,
    };
    const updated = [...tripLists, newList];
    setTripLists(updated);
    await storeData(TRIP_LISTS_KEY, updated);
    resetModals();
    Alert.alert('Success', 'List created!');
  };

  const handleEditList = async () => {
    if (!editingList || !newListName.trim()) {
      Alert.alert('Error', 'Please enter a list name');
      return;
    }
    const updatedLists = tripLists.map((l) =>
      l.id === editingList.id
        ? { ...l, name: newListName.trim(), description: newListDescription.trim() }
        : l
    );
    setTripLists(updatedLists);
    await storeData(TRIP_LISTS_KEY, updatedLists);
    if (selectedList?.id === editingList.id) {
      setSelectedList(updatedLists.find((x) => x.id === editingList.id) || null);
    }
    resetModals();
    Alert.alert('Success', 'List updated!');
  };

  const handleDeleteList = (listId: string) => {
    Alert.alert('Delete List', 'Delete this list and all items in it?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const updatedLists = tripLists.filter((l) => l.id !== listId);
          const updatedSaved = tripSaved.filter((p) => p.listId !== listId);
          setTripLists(updatedLists);
          setTripSaved(updatedSaved);
          await storeData(TRIP_LISTS_KEY, updatedLists);
          await storeData(TRIP_SAVED_KEY, updatedSaved);
          setSelectedList(null);
          Alert.alert('Success', 'List deleted.');
        },
      },
    ]);
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!selectedList) return;
    const updatedSaved = tripSaved.filter((p) => p.id !== itemId);
    setTripSaved(updatedSaved);
    await storeData(TRIP_SAVED_KEY, updatedSaved);

    const updatedLists = tripLists.map((l) =>
      l.id === selectedList.id ? { ...l, count: l.count - 1 } : l
    );
    setTripLists(updatedLists);
    await storeData(TRIP_LISTS_KEY, updatedLists);

    setSelectedList((prev) => (prev ? { ...prev, count: prev.count - 1 } : null));
    Alert.alert('Success', 'Removed from list.');
  };

  /** ------- HEADER CONFIG -------- */
  const selectedCount = useMemo(
    () => (selectedList ? getListItems(selectedList.id).length : 0),
    [selectedList, tripSaved]
  );

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          // while browsing tabs:
          title: selectedList ? undefined : 'My Bookings',
          headerLargeTitle: !selectedList,
          headerTitleAlign: selectedList ? 'left' : 'center',
          
          // custom two-line header while inside a list (like Wishlists)
          headerTitle: selectedList
            ? () => (
                <View>
                  <Text style={styles.headerTitleText} numberOfLines={1}>
                    {selectedList?.name || 'My Trips'}
                  </Text>
                  <Text style={styles.headerSubtitleText}>
                    {selectedCount} {selectedCount === 1 ? 'item' : 'items'}
                  </Text>
                </View>
              )
            : undefined,
          headerLeft: selectedList
            ? () => (
                <TouchableOpacity
                  onPress={() => setSelectedList(null)}
                  style={{ paddingHorizontal: 12, paddingVertical: 8 }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <ArrowLeft size={22} color="#111827" />
                </TouchableOpacity>
              )
            : undefined,
          headerRight: selectedList
            ? () => (
                <View style={{ flexDirection: 'row', gap: 12, paddingRight: 8 }}>
                  <TouchableOpacity onPress={() => openEditModal(selectedList!)}>
                    <Edit size={20} color="#111827" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDeleteList(selectedList!.id)}>
                    <Trash2 size={20} color="#DC2626" />
                  </TouchableOpacity>
                </View>
              )
            : undefined,
        }}
      />

      {/* Tabs row — HIDE when a list is open */}
      {!selectedList && (
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

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'mytrips' && styles.tabButtonActive]}
            onPress={() => {
              setSelectedList(null);
              setActiveTab('mytrips');
            }}
          >
            <Text style={[styles.tabText, activeTab === 'mytrips' && styles.tabTextActive]}>
              My Trips
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Bodies */}
      {!selectedList && activeTab !== 'mytrips' ? (
        <ScrollView contentContainerStyle={styles.listContent}>
          {activeTab === 'upcoming' ? (
            upcomingTrips.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Calendar size={64} color="#E5E7EB" />
                <Text style={styles.emptyTitle}>No upcoming trips</Text>
                <Text style={styles.emptySubtitle}>Time to plan your next adventure!</Text>
                <TouchableOpacity
                  style={styles.browseButton}
                  onPress={() => useRouter().push('/(tabs)')}
                >
                  <Text style={styles.browseButtonText}>Explore stays</Text>
                </TouchableOpacity>
              </View>
            ) : (
              upcomingTrips.map((trip) => (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  onDownloadReceipt={() => Alert.alert('Download Receipt')}
                  onModifyDates={() => Alert.alert('Modify Dates')}
                  onGetDirections={() => Alert.alert('Get Directions')}
                  onMessageHost={() => Alert.alert('Message Host')}
                />
              ))
            )
          ) : pastTrips.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Clock size={64} color="#E5E7EB" />
              <Text style={styles.emptyTitle}>No past trips</Text>
              <Text style={styles.emptySubtitle}>Your completed trips will appear here</Text>
            </View>
          ) : (
            pastTrips.map((trip) => (
              <PastTripCard
                key={trip.id}
                trip={trip}
                onRebook={() => Alert.alert('Rebook')}
                onReview={() => Alert.alert('Review')}
                onDownloadReceipt={() => Alert.alert('Download Receipt')}
              />
            ))
          )}
        </ScrollView>
      ) : (
        // My Trips area (overview OR items)
        <>
          {selectedList ? (
            <>
              {selectedCount === 0 ? (
                <View style={styles.emptyContainer}>
                  <FolderPlus size={64} color="#E5E7EB" />
                  <Text style={styles.emptyTitle}>No saved properties</Text>
                  <Text style={styles.emptySubtitle}>Start adding properties to this trip list</Text>
                  <TouchableOpacity
                    style={styles.browseButton}
                    onPress={() => router.push('/(tabs)')}
                  >
                    <Text style={styles.browseButtonText}>Add listings</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <FlatList
                  data={getListItems(selectedList.id)}
                  keyExtractor={(i) => i.id}
                  renderItem={({ item }) => (
                    <MyTripsPropertyCard
                      item={item}
                      onRemove={() => handleRemoveItem(item.id)}
                      onClick={() =>
                        router.push({ pathname: '/listing-details', params: { listingId: item.id } })
                      }
                    />
                  )}
                  contentContainerStyle={styles.listContent}
                />
              )}

              {/* Edit Modal */}
              <Modal visible={showEditModal} transparent animationType="fade" onRequestClose={resetModals}>
                <View style={styles.modalOverlay}>
                  <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>Edit Trip List</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="List name"
                      value={newListName}
                      onChangeText={setNewListName}
                      maxLength={50}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Description (optional)"
                      value={newListDescription}
                      onChangeText={setNewListDescription}
                      maxLength={100}
                    />
                    <View style={styles.modalActions}>
                      <TouchableOpacity style={styles.modalButtonSecondary} onPress={resetModals}>
                        <Text style={styles.modalButtonTextSecondary}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.modalButtonPrimary} onPress={handleEditList}>
                        <Text style={styles.modalButtonTextPrimary}>Save Changes</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </Modal>
            </>
          ) : (
            <>
              <ScrollView contentContainerStyle={styles.listContent}>
                <TouchableOpacity
                  style={[styles.cardContainer, styles.createCard]}
                  onPress={() => setShowCreateModal(true)}
                >
                  <View style={styles.createIconContainer}>
                    <Plus size={24} color="#111827" />
                  </View>
                  <Text style={styles.createTitle}>Create new trip list</Text>
                  <Text style={styles.createSubtitle}>Organize future itineraries & stays</Text>
                </TouchableOpacity>

                {tripLists.map((list) => (
                  <MyTripsListCard
                    key={list.id}
                    list={list}
                    onClick={() => setSelectedList(list)}
                    onEdit={() => openEditModal(list)}
                    onDelete={() => handleDeleteList(list.id)}
                  />
                ))}

                {tripLists.length === 0 && (
                  <View style={styles.emptyContainer}>
                    <FolderPlus size={64} color="#E5E7EB" />
                    <Text style={styles.emptyTitle}>No trip lists yet</Text>
                    <Text style={styles.emptySubtitle}>
                      Create lists to plan upcoming journeys
                    </Text>
                  </View>
                )}
              </ScrollView>

              {/* Create Modal */}
              <Modal visible={showCreateModal} transparent animationType="fade" onRequestClose={resetModals}>
                <View style={styles.modalOverlay}>
                  <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>Create New Trip List</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="List name (e.g., Monsoon Loop)"
                      value={newListName}
                      onChangeText={setNewListName}
                      maxLength={50}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Description (optional)"
                      value={newListDescription}
                      onChangeText={setNewListDescription}
                      maxLength={100}
                    />
                    <View style={styles.modalActions}>
                      <TouchableOpacity style={styles.modalButtonSecondary} onPress={resetModals}>
                        <Text style={styles.modalButtonTextSecondary}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.modalButtonPrimary} onPress={handleCreateList}>
                        <Text style={styles.modalButtonTextPrimary}>Create</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </Modal>
            </>
          )}
        </>
      )}
    </SafeAreaView>
  );
}

/** Styles **/
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },

  // two-line header text (like Wishlists)
  headerTitleText: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  headerSubtitleText: { fontSize: 13, color: '#6B7280', marginTop: 2 },

  // Tabs (hidden when selectedList is set)
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: { borderBottomColor: '#111827' },
  tabText: { fontSize: 16, color: '#6B7280' },
  tabTextActive: { color: '#111827', fontWeight: 'bold' },

  listContent: { padding: 16 },

  // Trip cards
  cardContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', padding: 12 },
  cardImage: { width: 80, height: 80, borderRadius: 8, marginRight: 12 },
  cardHeaderText: { flex: 1 },
  cardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    flexShrink: 1,
    marginRight: 8,
  },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  cardSubtitle: { fontSize: 13, color: '#6B7280', flexShrink: 1 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  dateText: { fontSize: 13, color: '#374151' },
  bookingCodeText: {
    fontSize: 12,
    color: '#6B7280',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  totalPaidText: { fontSize: 13, color: '#6B7280', marginTop: 4 },

  badge: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: { fontSize: 12, fontWeight: '500', color: '#374151' },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 6,
  },
  completedBadgeText: { color: '#065F46' },

  createCard: {
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
    alignItems: 'center',
    paddingVertical: 24,
  },
  createIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  createTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  createSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
  },

  cardDivider: { height: 1, backgroundColor: '#E5E7EB' },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
    flexWrap: 'wrap',
    rowGap: 8,
  },
  cardActionsPast: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
  },
  actionButton: { alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4 },
  actionText: { fontSize: 13, color: '#4B5563', marginTop: 2 },

  // Empty states
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    marginTop: 40,
  },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', marginTop: 16, marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 16 },
  browseButton: {
    backgroundColor: '#111827',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  browseButtonText: { color: 'white', fontWeight: 'bold' },

  // Wishlist-style list overview cards
  imageContainer: {
    height: 150,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    overflow: 'hidden',
  },
  cardImageFull: { width: '100%', height: '100%' },
  placeholderImage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
  },
  optionsButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: { padding: 12 },
  listcardTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  listcardDescription: { fontSize: 13, color: '#6B7280', marginBottom: 8 },
  listcardCount: { fontSize: 13, color: '#6B7280' },

  // Property cards within a list
  propertyCardContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  propertyImage: { width: '100%', height: 200 },
  propertyContent: { padding: 12 },
  propertyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  propertyName: { fontSize: 18, fontWeight: '600', flex: 1, marginRight: 8 },
  propertyRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  propertyRatingText: { fontSize: 14, color: '#374151', fontWeight: '500' },
  propertyLocationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  propertyLocationText: { fontSize: 15, color: '#6B7280', flex: 1 },
  propertyPrice: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  propertyPriceNight: { fontSize: 14, color: '#6B7280', fontWeight: 'normal' },
  removeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Custom header for selected list
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: { marginRight: 12 },
  headerTitleContainer: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  headerSubtitle: { fontSize: 14, color: '#6B7280' },
  headerButton: { marginLeft: 12, padding: 4 },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 16 },
  modalButtonPrimary: {
    backgroundColor: '#111827',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  modalButtonSecondary: {
    backgroundColor: '#F3F4F6',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  modalButtonTextPrimary: { color: 'white', fontWeight: 'bold' },
  modalButtonTextSecondary: { color: '#111827', fontWeight: 'bold' },
});
