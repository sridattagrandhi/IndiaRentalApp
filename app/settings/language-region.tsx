// app/settings/language-region.tsx
import { Stack, useRouter } from 'expo-router';
// Import ArrowLeft for custom header
import { ArrowLeft, Check, Globe } from 'lucide-react-native';
import React, { useState } from 'react';
// Import necessary components for custom header
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const languages = [
  { code: 'en', name: 'English', nativeName: 'English' }, { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' }, { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்' },
];

const dateFormats = [
  { id: 'dmy', label: 'DD/MM/YYYY', example: '25/10/2025' }, { id: 'mdy', label: 'MM/DD/YYYY', example: '10/25/2025' },
  { id: 'ymd', label: 'YYYY-MM-DD', example: '2025-10-25' }
];

const numberFormats = [
  { id: 'in', label: 'Indian (1,00,000)', example: '₹1,00,000.00' },
  { id: 'intl', label: 'International (100,000)', example: '₹100,000.00' }
];

export default function LanguageRegionPage() {
  const router = useRouter(); // Use router for back navigation
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [selectedDateFormat, setSelectedDateFormat] = useState('dmy');
  const [selectedNumberFormat, setSelectedNumberFormat] = useState('in');

  const handleSave = () => {
    Alert.alert('Settings Saved', 'Language and region preferences updated.');
    // Add logic to persist settings
    router.back();
  };

  // Helper to render radio items (same as before)
  const renderRadioItem = (item: { code: string; name: string; nativeName: string } | { id: string; label: string; example: string }, type: 'language' | 'date' | 'number') => {
    const id = type === 'language' ? (item as any).code : (item as any).id;
    const isSelected = (type === 'language' && selectedLanguage === id) ||
                       (type === 'date' && selectedDateFormat === id) ||
                       (type === 'number' && selectedNumberFormat === id);
    const label = type === 'language' ? (item as any).name : (item as any).label;
    const description = type === 'language' ? (item as any).nativeName : (item as any).example;

    const handlePress = () => {
        if (type === 'language') setSelectedLanguage(id);
        else if (type === 'date') setSelectedDateFormat(id);
        else if (type === 'number') setSelectedNumberFormat(id);
    };

    return (
      <TouchableOpacity key={id} style={styles.radioCard} onPress={handlePress}>
        <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
          {isSelected && <View style={styles.radioInner} />}
        </View>
        <View style={styles.radioTextContainer}>
          <Text style={styles.radioLabel}>{label}</Text>
          <Text style={styles.radioDescription}>{description}</Text>
        </View>
        {isSelected && <Check size={20} color="#111827" style={styles.checkIcon} />}
      </TouchableOpacity>
    );
  };


  return (
    <SafeAreaView style={styles.container}>
       {/* Hide default header */}
      <Stack.Screen options={{ headerShown: false }} />

      {/* Custom Header */}
      <View style={styles.customHeader}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Language & Region</Text>
        <TouchableOpacity onPress={handleSave} style={styles.saveButtonContainer}>
          <Text style={styles.saveButton}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Language Selection */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Globe size={20} color="#4B5563" />
            <Text style={styles.sectionTitle}>Language</Text>
          </View>
          <Text style={styles.sectionDescription}>Choose your preferred language for the app interface.</Text>
          <View style={styles.radioGroup}>
            {languages.map(lang => renderRadioItem(lang, 'language'))}
          </View>
        </View>

        <View style={styles.divider} />

        {/* Currency */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Currency</Text>
          <View style={styles.currencyCard}>
            <View>
              <Text style={styles.radioLabel}>Indian Rupee</Text>
              <Text style={styles.radioDescription}>₹ INR</Text>
            </View>
            <Check size={20} color="#111827" />
          </View>
          <Text style={styles.currencyNote}>Currency is based on your location and cannot be changed.</Text>
        </View>

        <View style={styles.divider} />

        {/* Date Format */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Date Format</Text>
          <Text style={styles.sectionDescription}>Choose how dates are displayed.</Text>
           <View style={styles.radioGroup}>
            {dateFormats.map(format => renderRadioItem(format, 'date'))}
          </View>
        </View>

        <View style={styles.divider} />

        {/* Number Format */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Number Format</Text>
          <Text style={styles.sectionDescription}>Choose how numbers and prices are displayed.</Text>
          <View style={styles.radioGroup}>
            {numberFormats.map(format => renderRadioItem(format, 'number'))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  // Custom Header Styles
  customHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB', backgroundColor: '#FFFFFF',
  },
  backButton: { padding: 4, width: 60 }, // Fixed width
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#111827', flex: 1, textAlign: 'center' },
  saveButtonContainer: { width: 60, alignItems: 'flex-end' }, // Fixed width for balance
  saveButton: { color: '#007AFF', fontSize: 16, fontWeight: '600' },
  // End Custom Header Styles
  scrollContent: { padding: 16, paddingBottom: 40, gap: 24 },
  section: { gap: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#111827' },
  sectionDescription: { fontSize: 14, color: '#6B7280' },
  radioGroup: { gap: 8 },
  radioCard: {
    flexDirection: 'row', alignItems: 'center', padding: 16,
    backgroundColor: 'white', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB',
  },
  radioOuter: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#B0B0B0',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
   radioOuterSelected: { borderColor: '#111827' },
   radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#111827' },
   radioTextContainer: { flex: 1 },
   radioLabel: { fontSize: 16, fontWeight: '500', color: '#111827' },
   radioDescription: { fontSize: 14, color: '#6B7280', marginTop: 2 },
   checkIcon: { marginLeft: 'auto' }, // Push check to the right
   divider: { height: 1, backgroundColor: '#E5E7EB' },
   currencyCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16,
    backgroundColor: '#F9FAFB', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB',
  },
  currencyNote: { fontSize: 12, color: '#6B7280', marginTop: 8 },
});