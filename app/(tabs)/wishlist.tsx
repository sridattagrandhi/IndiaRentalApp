import { useTranslation } from 'react-i18next';
// app/(tabs)/wishlist.tsx
import { apiDelete, apiGet, apiPost, apiPut } from '@/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import {
  ArrowLeft, // Ensure this is imported
  Edit, FolderPlus,
  Heart,
  MapPin,
  MoreHorizontal,
  Plus,
  Star, Trash2,
  X
} from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  SafeAreaView, // Use SafeAreaView for the main views
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// --- Interfaces ---
interface SavedProperty {
  id: string;
  name: string;
  location: string;
  price: number;
  rating: number;
  image: string;
  listId: string;
  coordinates?: { latitude: number; longitude: number; };
}

interface Wishlist {
  id: string;
  name: string;
  description: string;
  count: number;
  coverImage?: string;
}

// --- Backend API types (shape from serializers.py) ---
// add these near your interfaces
type WishlistApiType = {
  id: number;
  name: string;
  description: string | null;
  count: number;
  cover_image: string | null;
};

type SavedItemApiType = {
  id: number;
  listing: {
    id: number;
    title: string;
    city: string;
    price_per_night: number;
    avg_rating?: number | null;
    cover_photo_url?: string | null;
  };
};

// helper to convert backend -> UI type
const backendWishlistToUi = (w: WishlistApiType): Wishlist => ({
  id: String(w.id),
  name: w.name,
  description: w.description ?? '',
  count: w.count ?? 0,
  coverImage: w.cover_image ?? undefined,
});

const backendItemToSavedProperty = (
  x: SavedItemApiType,
  listId: string
): SavedProperty => {
  const l = x.listing;
  return {
    id: String(l.id),
    name: l.title,
    location: l.city,
    price: l.price_per_night,
    rating: l.avg_rating ?? 0,
    image: l.cover_photo_url ?? '',
    listId,
  };
};


// --- AsyncStorage Keys ---
const WISHLISTS_KEY = '@wishlists';
const SAVED_PROPERTIES_KEY = '@saved_properties';

// --- Mock Data (Initial Load Only) ---
// const initialWishlists: Wishlist[] = [
//     { id: '1', name: 'Road trips', description: 'Stays along popular routes', count: 0, coverImage: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=400&h=300&fit=crop'},
//     { id: '2', name: 'Goa villas', description: 'Beach vacation spots', count: 0, coverImage: 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=400&h=300&fit=crop'},
// ];
// const initialSavedProperties: SavedProperty[] = [
//     { id: '1', name: 'Modern Studio', location: 'Koramangala, Bangalore', price: 2200, rating: 4.8, image: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=400&h=300&fit=crop', listId: '1', coordinates: { latitude: 12.935192, longitude: 77.624481 } },
//     { id: '5', name: 'Mountain Cottage', location: 'Lonavala', price: 3500, rating: 4.6, image: 'https://images.unsplash.com/photo-1585544493593-84f1b838493a?w=400&h=300&fit=crop', listId: '1', coordinates: { latitude: 18.7557, longitude: 73.4091 } },
//     { id: '2', name: 'Beachfront Villa', location: 'Candolim, Goa', price: 8500, rating: 4.9, image: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=400&h=300&fit=crop', listId: '2', coordinates: { latitude: 15.5180, longitude: 73.7667 } },
// ];

// --- Helper Functions for AsyncStorage ---
const storeData = async (key: string, value: any) => {
  try {
    const jsonValue = JSON.stringify(value);
    await AsyncStorage.setItem(key, jsonValue);
  } catch (e) { console.error("Error saving data", e); }
};

const getData = async (key: string, defaultValue: any) => {
  try {
    const jsonValue = await AsyncStorage.getItem(key);
    return jsonValue != null ? JSON.parse(jsonValue) : defaultValue;
  } catch (e) { console.error("Error retrieving data", e); return defaultValue; }
};

// --- Wishlist Card Component ---
interface WishlistCardProps {
  wishlist: Wishlist;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
}
function WishlistCard({ wishlist, onClick, onEdit, onDelete }: WishlistCardProps) {
  return (
    <TouchableOpacity style={styles.cardContainer} onPress={onClick}>
      <View style={styles.imageContainer}>
        {wishlist.coverImage ? (
          <Image source={{ uri: wishlist.coverImage }} style={styles.cardImage} />
        ) : (
          <View style={styles.placeholderImage}><Heart size={48} color="#FECACA" /></View>
        )}
        <TouchableOpacity style={styles.optionsButton} onPress={(e) => {
          e.stopPropagation();
          Alert.alert(`Options for "${wishlist.name}"`, '', [
              { text: 'Edit', onPress: onEdit },
              { text: 'Delete', onPress: onDelete, style: 'destructive' },
              { text: 'Cancel', style: 'cancel' },
            ]); }}>
          <MoreHorizontal size={20} color="#333" />
        </TouchableOpacity>
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>{wishlist.name}</Text>
        {wishlist.description && (<Text style={styles.cardDescription}>{wishlist.description}</Text>)}
        <Text style={styles.cardCount}>{wishlist.count} {wishlist.count === 1 ? 'property' : 'properties'}</Text>
      </View>
    </TouchableOpacity>
  );
}

// --- Property Card Component (Single Column) ---
interface PropertyCardProps {
  property: SavedProperty;
  onRemove: () => void;
  onClick: () => void;
}
function PropertyCard({ property, onRemove, onClick }: PropertyCardProps) {
    const imageSource = property.image && property.image.startsWith('http')
        ? { uri: property.image }
        : { uri: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=400&h=300&fit=crop' }; // Default image
    const { t, i18n } = useTranslation();

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
          <Text style={styles.propertyName} numberOfLines={1}>{property.name}</Text>
          <View style={styles.propertyRating}>
            <Star size={14} color="#F59E0B" fill="#F59E0B" />
            <Text style={styles.propertyRatingText}>{property.rating}</Text>
          </View>
        </View>
        <View style={styles.propertyLocationRow}>
          <MapPin size={16} color="#6B7280" />
          <Text style={styles.propertyLocationText} numberOfLines={1}>{property.location}</Text>
        </View>
        <Text style={styles.propertyPrice}>
          ₹{property.price.toLocaleString('en-IN')}
          <Text style={styles.propertyPriceNight}>{t('listing.night_short')}</Text>
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// --- Main Wishlist Page ---
export default function WishlistPage() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [wishlists, setWishlists] = useState<Wishlist[]>([]);
  const [savedProperties, setSavedProperties] = useState<SavedProperty[]>([]);
  const [selectedList, setSelectedList] = useState<Wishlist | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListDescription, setNewListDescription] = useState('');
  const [editingList, setEditingList] = useState<Wishlist | null>(null);

  // --- Load Data on Focus ---
  useFocusEffect(
    useCallback(() => {
      let alive = true;

      const load = async () => {
        try {
          // 1) load all wishlists
          const res = await apiGet<{ wishlists: WishlistApiType[] }>(
            '/v1/wishlists'
          );

          if (!alive) return;

          setWishlists(res.wishlists.map(backendWishlistToUi));

          // 2) if a list is selected, load its items
          if (selectedList) {
            const detail = await apiGet<{
              wishlist: WishlistApiType;
              items: {
                id: number;
                title: string;
                location: string;
                price: number;
                rating: number;
                image: string | null;
                wishlist_item_id: number;
              }[];
            }>(`/v1/wishlists/${selectedList.id}`);

            if (!alive) return;

            setSavedProperties(
              (detail.items ?? []).map((it) => ({
                id: String(it.id),
                name: it.title,
                location: it.location,
                price: Number(it.price ?? 0),
                rating: Number(it.rating ?? 0),
                image: it.image ?? '',
                listId: String(selectedList.id),
              }))
            );
          } else {
            setSavedProperties([]);
          }
        } catch (err) {
          console.error('[wishlist] load failed', err);
        }
      };

      load();
      return () => {
        alive = false;
      };
    }, [selectedList?.id, i18n.language])
  );



  // --- CRUD Operations ---
  const handleCreateList = async () => {
    if (!newListName.trim()) {
      Alert.alert(t('common.error'), 'Please enter a list name');
      return;
    }

    try {
      const payload = {
        name: newListName.trim(),
        description: newListDescription.trim() || null,
      };

      const created = await apiPost<WishlistApiType>('/v1/wishlists', payload);
      const newList = backendWishlistToUi(created);

      setWishlists((prev) => [...prev, newList]);
      resetAndCloseModals();
      Alert.alert(t('common.success'), 'List created!');
    } catch (err) {
      console.error('[wishlist] create failed', err);
      Alert.alert(t('common.error'), 'Could not create list. Please try again.');
    }
  };


  const handleEditList = async () => {
    if (!editingList || !newListName.trim()) {
      Alert.alert(t('common.error'), 'Please enter a list name');
      return;
    }

    try {
      const payload = {
        name: newListName.trim(),
        description: newListDescription.trim() || null,
      };

      const updated = await apiPut<WishlistApiType>(
        `/v1/wishlists/${editingList.id}`,
        payload
      );
      const updatedUi = backendWishlistToUi(updated);

      setWishlists((prev) =>
        prev.map((list) =>
          list.id === updatedUi.id ? { ...list, ...updatedUi } : list
        )
      );

      if (selectedList?.id === updatedUi.id) {
        setSelectedList((prev) => (prev ? { ...prev, ...updatedUi } : prev));
      }

      resetAndCloseModals();
      Alert.alert(t('common.success'), 'List updated!');
    } catch (err) {
      console.error('[wishlist] update failed', err);
      Alert.alert(t('common.error'), 'Could not update list. Please try again.');
    }
  };


  const handleDeleteList = (listId: string) => {
    Alert.alert(t('mybookings.delete_list'),
      'Are you sure you want to delete this list and all its saved properties?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiDelete(`/v1/wishlists/${listId}`);

              setWishlists((prev) => prev.filter((l) => l.id !== listId));
              setSavedProperties((prev) =>
                prev.filter((p) => p.listId !== listId)
              );
              if (selectedList?.id === listId) setSelectedList(null);

              Alert.alert(t('common.success'), 'List deleted.');
            } catch (err) {
              console.error('[wishlist] delete failed', err);
              Alert.alert(t('common.error'), 'Could not delete list. Please try again.');
            }
          },
        },
      ]
    );
  };


  const handleRemoveProperty = async (listingId: string) => {
    if (!selectedList) return;

    try {
      await apiDelete(
        `/v1/wishlists/${selectedList.id}/items/${listingId}`
      );

      setSavedProperties((prev) =>
        prev.filter(
          (p) => !(p.listId === selectedList.id && p.id === listingId)
        )
      );

      setWishlists((prev) =>
        prev.map((list) =>
          list.id === selectedList.id
            ? { ...list, count: Math.max(0, list.count - 1) }
            : list
        )
      );

      setSelectedList((prev) =>
        prev ? { ...prev, count: Math.max(0, prev.count - 1) } : prev
      );

      Alert.alert(t('common.success'), 'Removed from list.');
    } catch (err) {
      console.error('[wishlist] remove item failed', err);
      Alert.alert(t('common.error'), 'Could not remove this stay. Please try again.');
    }
  };


  const openEditModal = (list: Wishlist) => {
    setEditingList(list); setNewListName(list.name); setNewListDescription(list.description); setShowEditModal(true);
  };

  const resetAndCloseModals = () => {
    setNewListName(''); setNewListDescription(''); setEditingList(null); setShowCreateModal(false); setShowEditModal(false);
  };

  const getListProperties = (listId: string) => savedProperties.filter(prop => prop.listId === listId);

  // --- Render Logic ---
  if (selectedList) {
    const properties = getListProperties(selectedList.id);
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        {/* Custom Header */}
        <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => setSelectedList(null)}><ArrowLeft size={24} color="#111827" /></TouchableOpacity>
            <View style={styles.headerTitleContainer}><Text style={styles.headerTitle} numberOfLines={1}>{selectedList.name}</Text><Text style={styles.headerSubtitle}>{properties.length} {properties.length === 1 ? 'item' : 'items'}</Text></View>
            <TouchableOpacity style={styles.headerButton} onPress={() => openEditModal(selectedList)}><Edit size={20} color="#111827" /></TouchableOpacity>
            <TouchableOpacity style={styles.headerButton} onPress={() => handleDeleteList(selectedList.id)}><Trash2 size={20} color="#DC2626" /></TouchableOpacity>
        </View>
        {/* Property List */}
        {properties.length === 0 ? (
          <View style={styles.emptyContainer}><Heart size={64} color="#E5E7EB" /><Text style={styles.emptyTitle}>{t('wishlist.no_saved_properties')}</Text><Text style={styles.emptySubtitle}>{t('wishlist.start_saving_properties')}</Text><TouchableOpacity style={styles.browseButton} onPress={() => router.push('/(tabs)')}><Text style={styles.browseButtonText}>Browse stays</Text></TouchableOpacity></View>
        ) : (
          <FlatList
            data={properties}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <PropertyCard
                property={item}
                onRemove={() => handleRemoveProperty(item.id)}
                // Navigate to listing details - adjust params as needed
                onClick={() => router.push({ pathname: '/listing/[id]', params: { id: item.id }, })}
              />
            )}
            contentContainerStyle={styles.listContent}
            numColumns={1} // Single column
          />
        )}
         {/* Edit Modal */}
        <Modal visible={showEditModal} transparent animationType="fade" onRequestClose={resetAndCloseModals}>
             <View style={styles.modalOverlay}><View style={styles.modalContent}><Text style={styles.modalTitle}>{t('wishlist.edit_list')}</Text><TextInput style={styles.input} placeholder="List name" value={newListName} onChangeText={setNewListName} /><TextInput style={styles.input} placeholder={t('listing.description_optional')} value={newListDescription} onChangeText={setNewListDescription} /><View style={styles.modalActions}><TouchableOpacity style={styles.modalButtonSecondary} onPress={resetAndCloseModals}><Text style={styles.modalButtonTextSecondary}>{t('common.cancel')}</Text></TouchableOpacity><TouchableOpacity style={styles.modalButtonPrimary} onPress={handleEditList}><Text style={styles.modalButtonTextPrimary}>{t('host.edit_listing.save_changes')}</Text></TouchableOpacity></View></View></View>
        </Modal>
      </SafeAreaView>
    );
  }

  // Main Wishlist View
  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: t('wishlist.my_wishlists'), headerLargeTitle: true }} />
      <ScrollView contentContainerStyle={styles.listContent}>
        {/* Create Card */}
        <TouchableOpacity style={[styles.cardContainer, styles.createCard]} onPress={() => setShowCreateModal(true)}><View style={styles.createIconContainer}><Plus size={24} color="#111827" /></View><Text style={styles.createTitle}>{t('wishlist.create_new_wishlist')}</Text><Text style={styles.createSubtitle}>{t('wishlist.organize_your_saved_properties')}</Text></TouchableOpacity>
        {/* Existing Lists */}
        {wishlists.map((list) => ( <WishlistCard key={list.id} wishlist={list} onClick={() => setSelectedList(list)} onEdit={() => openEditModal(list)} onDelete={() => handleDeleteList(list.id)} /> ))}
        {wishlists.length === 0 && ( <View style={styles.emptyContainerLarge}><FolderPlus size={64} color="#E5E7EB" /><Text style={styles.emptyTitle}>{t('wishlist.no_wishlists')}</Text><Text style={styles.emptySubtitle}>{t('wishlist.create_your_first_wishlist')}</Text></View> )}
      </ScrollView>
      {/* Create Modal */}
      <Modal visible={showCreateModal} transparent animationType="fade" onRequestClose={resetAndCloseModals}>
          <View style={styles.modalOverlay}><View style={styles.modalContent}><Text style={styles.modalTitle}>{t('wishlist.create_new_wishlist')}</Text><TextInput style={styles.input} placeholder={t('listing.list_name_placeholder')} value={newListName} onChangeText={setNewListName} maxLength={50}/><TextInput style={styles.input} placeholder={t('listing.description_optional')} value={newListDescription} onChangeText={setNewListDescription} maxLength={100}/><View style={styles.modalActions}><TouchableOpacity style={styles.modalButtonSecondary} onPress={resetAndCloseModals}><Text style={styles.modalButtonTextSecondary}>{t('common.cancel')}</Text></TouchableOpacity><TouchableOpacity style={styles.modalButtonPrimary} onPress={handleCreateList}><Text style={styles.modalButtonTextPrimary}>{t('wishlist.create')}</Text></TouchableOpacity></View></View></View>
      </Modal>
        {/* Edit Modal */}
        <Modal visible={showEditModal} transparent animationType="fade" onRequestClose={resetAndCloseModals}>
            <View style={styles.modalOverlay}><View style={styles.modalContent}><Text style={styles.modalTitle}>{t('wishlist.edit_list')}</Text><TextInput style={styles.input} placeholder="List name" value={newListName} onChangeText={setNewListName} maxLength={50}/><TextInput style={styles.input} placeholder={t('listing.description_optional')} value={newListDescription} onChangeText={setNewListDescription} maxLength={100}/><View style={styles.modalActions}><TouchableOpacity style={styles.modalButtonSecondary} onPress={resetAndCloseModals}><Text style={styles.modalButtonTextSecondary}>{t('common.cancel')}</Text></TouchableOpacity><TouchableOpacity style={styles.modalButtonPrimary} onPress={() => handleEditList()}><Text style={{ color: '#FFFFFF', fontWeight: 'bold' }}>{t('host.edit_listing.save_changes')}</Text></TouchableOpacity></View></View></View>
        </Modal>
    </SafeAreaView>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  listContent: { padding: 16 },
  header: {
      flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
      backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
   backButton: {
    padding: 8,
    borderRadius: 999,
    marginRight: 8,
  },
   headerTitleContainer: { flex: 1 },
   headerTitle: { fontSize: 18, fontWeight: 'bold' },
   headerSubtitle: { fontSize: 14, color: '#6B7280' },
   headerButton: { marginLeft: 12, padding: 4 },

  cardContainer: {
    backgroundColor: 'white', borderRadius: 12, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1, shadowRadius: 3, elevation: 2,
  },
  imageContainer: { height: 150, borderTopLeftRadius: 12, borderTopRightRadius: 12, overflow: 'hidden' },
  cardImage: { width: '100%', height: '100%' },
  placeholderImage: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FEE2E2' },
  optionsButton: {
    position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 15, width: 30, height: 30, justifyContent: 'center', alignItems: 'center'
  },
  cardContent: { padding: 12 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  cardDescription: { fontSize: 13, color: '#6B7280', marginBottom: 8 },
  cardCount: { fontSize: 13, color: '#6B7280' },

  createCard: { borderWidth: 2, borderColor: '#D1D5DB', borderStyle: 'dashed', alignItems: 'center', paddingVertical: 24 },
  createIconContainer: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  createTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  createSubtitle: { fontSize: 13, color: '#6B7280', textAlign: 'center' },

  propertyCardContainer: { // Single Column Style
    backgroundColor: 'white', borderRadius: 12, marginBottom: 16,
    flexDirection: 'column', overflow: 'hidden', shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2,
  },
  propertyImage: { // Larger Image
    width: '100%', height: 200, borderTopLeftRadius: 12, borderTopRightRadius: 12,
  },
  propertyContent: { padding: 12 },
  propertyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  propertyName: { fontSize: 18, fontWeight: '600', flex: 1, marginRight: 8 },
  propertyRating: {
    flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F3F4F6',
    borderRadius: 4, paddingHorizontal: 6, paddingVertical: 3,
  },
  propertyRatingText: { fontSize: 14, color: '#374151', fontWeight: '500' },
  propertyLocationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  propertyLocationText: { fontSize: 15, color: '#6B7280', flex: 1 },
  // propertyFooter style removed as X button moved
  propertyPrice: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  propertyPriceNight: { fontSize: 14, color: '#6B7280', fontWeight: 'normal' },
  removeButton: { // Positioned over image
    position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 15, width: 30, height: 30, justifyContent: 'center', alignItems: 'center',
  },

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
    emptyContainerLarge: { alignItems: 'center', padding: 32, marginTop: 20 },
    emptyTitle: { fontSize: 18, fontWeight: 'bold', marginTop: 16, marginBottom: 8 },
    emptySubtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 16 },
    browseButton: { backgroundColor: '#111827', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
    browseButtonText: { color: 'white', fontWeight: 'bold' },

  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { backgroundColor: 'white', borderRadius: 12, padding: 20, width: '100%', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 12 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 16 },
  modalButtonPrimary: { backgroundColor: '#111827', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  modalButtonSecondary: { backgroundColor: '#F3F4F6', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  modalButtonTextPrimary: { color: 'white', fontWeight: 'bold' },
  modalButtonTextSecondary: { color: '#111827', fontWeight: 'bold' },
});