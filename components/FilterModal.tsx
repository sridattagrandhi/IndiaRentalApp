// components/FilterModal.tsx
import { X } from 'lucide-react-native'; // Import an icon for closing
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Modal from 'react-native-modal';
import { SafeAreaView } from 'react-native-safe-area-context';

// Props interface: function to close the modal
interface FilterModalProps {
  isVisible: boolean;
  onClose: () => void;
  onApplyFilters: (filters: any) => void; // Replace 'any' with your filter type later
}

export default function FilterModal({ isVisible, onClose, onApplyFilters }: FilterModalProps) {
  // Placeholder state for filters - you'll expand this
  const [numGuests, setNumGuests] = React.useState(1);
  const [priceRange, setPriceRange] = React.useState([0, 5000]); // Example: min/max

  const handleApply = () => {
    // Collect filter values and pass them back
    const appliedFilters = { numGuests, priceRange /*, etc */ };
    onApplyFilters(appliedFilters);
    onClose(); // Close modal after applying
  };

  const handleClear = () => {
    // Reset local state here if needed
    setNumGuests(1);
    setPriceRange([0, 5000]);
    // Potentially call onApplyFilters with empty/default values
    onApplyFilters({}); // Pass empty object or defaults
    onClose();
  }

  return (
    <Modal
      isVisible={isVisible}
      onSwipeComplete={onClose}
      swipeDirection={['down']} // Allow swiping down to close
      style={styles.modal}
      onBackdropPress={onClose} // Close when tapping background
      avoidKeyboard // Automatically handles keyboard appearance
    >
      {/* Use SafeAreaView for content inside modal */}
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Filters</Text>
            <TouchableOpacity onPress={handleClear}>
               <Text style={styles.clearButtonText}>Clear all</Text>
            </TouchableOpacity>
          </View>

          {/* Scrollable Filter Options */}
          <ScrollView style={styles.optionsContainer}>
            {/* Example: Number of Guests */}
            <View style={styles.filterSection}>
              <Text style={styles.sectionTitle}>Number of Guests</Text>
              {/* Replace with +/- buttons or slider */}
              <Text>Current: {numGuests}</Text>
              {/* Add guest selection controls here */}
            </View>

            {/* Example: Price Range */}
            <View style={styles.filterSection}>
              <Text style={styles.sectionTitle}>Price Range</Text>
              {/* Replace with a slider component */}
              <Text>Current: ₹{priceRange[0]} - ₹{priceRange[1]}</Text>
              {/* Add price slider here */}
            </View>

            {/* Add more filter sections: Property Type, Amenities, etc. */}
            <View style={styles.filterSection}>
                <Text style={styles.sectionTitle}>Property Type (Placeholder)</Text>
            </View>
             <View style={styles.filterSection}>
                <Text style={styles.sectionTitle}>Amenities (Placeholder)</Text>
            </View>

          </ScrollView>

          {/* Footer with Apply Button */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.applyButton} onPress={handleApply}>
              <Text style={styles.applyButtonText}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// Styles matching your app's theme
const styles = StyleSheet.create({
  modal: {
    justifyContent: 'flex-end', // Position modal at the bottom
    margin: 0,
  },
  safeArea: {
    maxHeight: '85%', // Limit modal height
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  content: {
    // SafeAreaView handles padding, but add internal padding if needed
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  closeButton: {
    padding: 4, // Make tap area larger
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  clearButtonText: {
     fontSize: 16,
     fontWeight: '500',
     color: '#007AFF', // Or your app's link color
     textDecorationLine: 'underline',
  },
  optionsContainer: {
    padding: 16,
    // Max height ensures footer is visible
    maxHeight: '70%', // Adjust as needed
  },
  filterSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#1F2937',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  applyButton: {
    backgroundColor: '#1F2937', // Your primary button color
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  applyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});