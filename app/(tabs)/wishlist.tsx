// app/(tabs)/wishlist.tsx
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

// --- AsyncStorage Keys ---
const WISHLISTS_KEY = '@wishlists';
const SAVED_PROPERTIES_KEY = '@saved_properties';

// --- Mock Data (Initial Load Only) ---
const initialWishlists: Wishlist[] = [
    { id: '1', name: 'Road trips', description: 'Stays along popular routes', count: 0, coverImage: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=400&h=300&fit=crop'},
    { id: '2', name: 'Goa villas', description: 'Beach vacation spots', count: 0, coverImage: 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=400&h=300&fit=crop'},
];
const initialSavedProperties: SavedProperty[] = [
    { id: '1', name: 'Modern Studio', location: 'Koramangala, Bangalore', price: 2200, rating: 4.8, image: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=400&h=300&fit=crop', listId: '1', coordinates: { latitude: 12.935192, longitude: 77.624481 } },
    { id: '5', name: 'Mountain Cottage', location: 'Lonavala', price: 3500, rating: 4.6, image: 'https://images.unsplash.com/photo-1585544493593-84f1b838493a?w=400&h=300&fit=crop', listId: '1', coordinates: { latitude: 18.7557, longitude: 73.4091 } },
    { id: '2', name: 'Beachfront Villa', location: 'Candolim, Goa', price: 8500, rating: 4.9, image: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=400&h=300&fit=crop', listId: '2', coordinates: { latitude: 15.5180, longitude: 73.7667 } },
];

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
          <Text style={styles.propertyPriceNight}>/night</Text>
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// --- Main Wishlist Page ---
export default function WishlistPage() {
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
      const loadData = async () => {
        let loadedWishlists = await getData(WISHLISTS_KEY, []);
        let loadedProperties = await getData(SAVED_PROPERTIES_KEY, []);
        const wishlistsExist = await AsyncStorage.getItem(WISHLISTS_KEY);
        const propertiesExist = await AsyncStorage.getItem(SAVED_PROPERTIES_KEY);

        if (!wishlistsExist && !propertiesExist) {
          console.log("First run: Seeding with initial data.");
          loadedWishlists = initialWishlists;
          loadedProperties = initialSavedProperties;
          await storeData(WISHLISTS_KEY, loadedWishlists);
          await storeData(SAVED_PROPERTIES_KEY, loadedProperties);
        }

        loadedWishlists = loadedWishlists.map((list: Wishlist) => {
          const propsInList = loadedProperties.filter((prop: SavedProperty) => prop.listId === list.id);
          return {
            ...list,
            count: propsInList.length,
            coverImage: list.coverImage || propsInList[0]?.image || undefined
          };
        });
        setWishlists(loadedWishlists);
        setSavedProperties(loadedProperties);
      };
      loadData();
    }, [])
  );

  // --- CRUD Operations ---
  const handleCreateList = async () => {
    if (!newListName.trim()) { Alert.alert('Error', 'Please enter a list name'); return; }
    const newList: Wishlist = {
      id: Date.now().toString(), name: newListName.trim(),
      description: newListDescription.trim(), count: 0
    };
    const updatedWishlists = [...wishlists, newList];
    setWishlists(updatedWishlists);
    await storeData(WISHLISTS_KEY, updatedWishlists);
    resetAndCloseModals();
    Alert.alert('Success', 'List created!');
  };

  const handleEditList = async () => {
    if (!editingList || !newListName.trim()) { Alert.alert('Error', 'Please enter a list name'); return; }
    const updatedWishlists = wishlists.map(list =>
      list.id === editingList.id ? { ...list, name: newListName.trim(), description: newListDescription.trim() } : list
    );
    setWishlists(updatedWishlists);
    await storeData(WISHLISTS_KEY, updatedWishlists);
    if (selectedList?.id === editingList.id) { setSelectedList(updatedWishlists.find(l => l.id === editingList.id) || null); }
    resetAndCloseModals();
    Alert.alert('Success', 'List updated!');
  };

  const handleDeleteList = (listId: string) => {
    Alert.alert('Delete List', 'Are you sure you want to delete this list and all its saved properties?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive',
          onPress: async () => {
            const updatedWishlists = wishlists.filter(list => list.id !== listId);
            const updatedProperties = savedProperties.filter(prop => prop.listId !== listId);
            setWishlists(updatedWishlists);
            setSavedProperties(updatedProperties);
            await storeData(WISHLISTS_KEY, updatedWishlists);
            await storeData(SAVED_PROPERTIES_KEY, updatedProperties);
            setSelectedList(null);
            Alert.alert('Success', 'List deleted.');
          }
        }
      ]
    );
  };

  const handleRemoveProperty = async (propertyId: string) => {
    if (!selectedList) return;
    const updatedProperties = savedProperties.filter(prop => prop.id !== propertyId);
    setSavedProperties(updatedProperties);
    await storeData(SAVED_PROPERTIES_KEY, updatedProperties);

    const updatedWishlists = wishlists.map(list =>
      list.id === selectedList.id ? { ...list, count: list.count - 1 } : list
    );
    setWishlists(updatedWishlists);
    await storeData(WISHLISTS_KEY, updatedWishlists);
    setSelectedList(prev => prev ? { ...prev, count: prev.count - 1 } : null);
    Alert.alert('Success', 'Removed from list.');
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
          <View style={styles.emptyContainer}><Heart size={64} color="#E5E7EB" /><Text style={styles.emptyTitle}>No saved properties</Text><Text style={styles.emptySubtitle}>Start adding properties to this list</Text><TouchableOpacity style={styles.browseButton} onPress={() => router.push('/(tabs)')}><Text style={styles.browseButtonText}>Browse stays</Text></TouchableOpacity></View>
        ) : (
          <FlatList
            data={properties}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <PropertyCard
                property={item}
                onRemove={() => handleRemoveProperty(item.id)}
                // Navigate to listing details - adjust params as needed
                onClick={() => router.push({ pathname: '/listing-details', params: { listingId: item.id } })}
              />
            )}
            contentContainerStyle={styles.listContent}
            numColumns={1} // Single column
          />
        )}
         {/* Edit Modal */}
        <Modal visible={showEditModal} transparent animationType="fade" onRequestClose={resetAndCloseModals}>
             <View style={styles.modalOverlay}><View style={styles.modalContent}><Text style={styles.modalTitle}>Edit List</Text><TextInput style={styles.input} placeholder="List name" value={newListName} onChangeText={setNewListName} /><TextInput style={styles.input} placeholder="Description (optional)" value={newListDescription} onChangeText={setNewListDescription} /><View style={styles.modalActions}><TouchableOpacity style={styles.modalButtonSecondary} onPress={resetAndCloseModals}><Text style={styles.modalButtonTextSecondary}>Cancel</Text></TouchableOpacity><TouchableOpacity style={styles.modalButtonPrimary} onPress={handleEditList}><Text style={styles.modalButtonTextPrimary}>Save Changes</Text></TouchableOpacity></View></View></View>
        </Modal>
      </SafeAreaView>
    );
  }

  // Main Wishlist View
  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Wishlists', headerLargeTitle: true }} />
      <ScrollView contentContainerStyle={styles.listContent}>
        {/* Create Card */}
        <TouchableOpacity style={[styles.cardContainer, styles.createCard]} onPress={() => setShowCreateModal(true)}><View style={styles.createIconContainer}><Plus size={24} color="#111827" /></View><Text style={styles.createTitle}>Create new list</Text><Text style={styles.createSubtitle}>Organize your saved properties</Text></TouchableOpacity>
        {/* Existing Lists */}
        {wishlists.map((list) => ( <WishlistCard key={list.id} wishlist={list} onClick={() => setSelectedList(list)} onEdit={() => openEditModal(list)} onDelete={() => handleDeleteList(list.id)} /> ))}
        {wishlists.length === 0 && ( <View style={styles.emptyContainerLarge}><FolderPlus size={64} color="#E5E7EB" /><Text style={styles.emptyTitle}>No lists yet</Text><Text style={styles.emptySubtitle}>Create lists to organize saved properties</Text></View> )}
      </ScrollView>
      {/* Create Modal */}
      <Modal visible={showCreateModal} transparent animationType="fade" onRequestClose={resetAndCloseModals}>
          <View style={styles.modalOverlay}><View style={styles.modalContent}><Text style={styles.modalTitle}>Create New List</Text><TextInput style={styles.input} placeholder="List name (e.g., Weekend Getaways)" value={newListName} onChangeText={setNewListName} maxLength={50}/><TextInput style={styles.input} placeholder="Description (optional)" value={newListDescription} onChangeText={setNewListDescription} maxLength={100}/><View style={styles.modalActions}><TouchableOpacity style={styles.modalButtonSecondary} onPress={resetAndCloseModals}><Text style={styles.modalButtonTextSecondary}>Cancel</Text></TouchableOpacity><TouchableOpacity style={styles.modalButtonPrimary} onPress={handleCreateList}><Text style={styles.modalButtonTextPrimary}>Create</Text></TouchableOpacity></View></View></View>
      </Modal>
        {/* Edit Modal */}
        <Modal visible={showEditModal} transparent animationType="fade" onRequestClose={resetAndCloseModals}>
            <View style={styles.modalOverlay}><View style={styles.modalContent}><Text style={styles.modalTitle}>Edit List</Text><TextInput style={styles.input} placeholder="List name" value={newListName} onChangeText={setNewListName} maxLength={50}/><TextInput style={styles.input} placeholder="Description (optional)" value={newListDescription} onChangeText={setNewListDescription} maxLength={100}/><View style={styles.modalActions}><TouchableOpacity style={styles.modalButtonSecondary} onPress={resetAndCloseModals}><Text style={styles.modalButtonTextSecondary}>Cancel</Text></TouchableOpacity><TouchableOpacity style={styles.modalButtonPrimary} onPress={handleEditList}><Text style={styles.modalButtonTextPrimary}>Save Changes</Text></TouchableOpacity></View></View></View>
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
   backButton: { marginRight: 12 },
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