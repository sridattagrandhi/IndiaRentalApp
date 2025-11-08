// app/(auth)/PersonalDetails.tsx
import { FontAwesome } from '@expo/vector-icons';
import { format, isValid, parse } from 'date-fns';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DropDownPicker from 'react-native-dropdown-picker';
import { MaskedTextInput } from 'react-native-mask-text';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { SafeAreaView } from 'react-native-safe-area-context';

// 🔐 Cognito helpers
import { updateAttributes } from '@/services/auth';
import Constants from 'expo-constants';

// -----------------------------
// Dropdown options
// -----------------------------
const genderItems = [
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Other', value: 'other' },
  { label: 'Prefer not to say', value: 'prefer-not-to-say' },
];

// Countries for phone
const countryItems = [
  { label: 'India (+91)', value: 'IN', dial: '+91', placeholder: 'XXXXX XXXXX' },
  { label: 'United States (+1)', value: 'US', dial: '+1', placeholder: '(555) 555-1234' },
];

const stateItems = [
  { label: 'Andhra Pradesh', value: 'andhra-pradesh' },
  { label: 'Assam', value: 'assam' },
  { label: 'Bihar', value: 'bihar' },
  { label: 'Chhattisgarh', value: 'chhattisgarh' },
  { label: 'Goa', value: 'goa' },
  { label: 'Gujarat', value: 'gujarat' },
  { label: 'Haryana', value: 'haryana' },
  { label: 'Himachal Pradesh', value: 'himachal-pradesh' },
  { label: 'Jharkhand', value: 'jharkhand' },
  { label: 'Karnataka', value: 'karnataka' },
  { label: 'Kerala', value: 'kerala' },
  { label: 'Madhya Pradesh', value: 'madhya-pradesh' },
  { label: 'Maharashtra', value: 'maharashtra' },
  { label: 'Manipur', value: 'manipur' },
  { label: 'Meghalaya', value: 'meghalaya' },
  { label: 'Mizoram', value: 'mizoram' },
  { label: 'Nagaland', value: 'nagaland' },
  { label: 'Odisha', value: 'odisha' },
  { label: 'Punjab', value: 'punjab' },
  { label: 'Rajasthan', value: 'rajasthan' },
  { label: 'Sikkim', value: 'sikkim' },
  { label: 'Tamil Nadu', value: 'tamil-nadu' },
  { label: 'Telangana', value: 'telangana' },
  { label: 'Tripura', value: 'tripura' },
  { label: 'Uttar Pradesh', value: 'uttar-pradesh' },
  { label: 'Uttarakhand', value: 'uttarakhand' },
  { label: 'West Bengal', value: 'west-bengal' },
];

// -----------------------------
// Utils
// -----------------------------
const onlyDigits = (s: string) => s.replace(/\D/g, '');

function toE164(raw: string, country: 'IN' | 'US') {
  const clean = onlyDigits(raw);
  if (raw.trim().startsWith('+')) {
    // assume already E.164
    return `+${onlyDigits(raw)}`;
  }
  if (country === 'IN') {
    // Indian mobile numbers are typically 10 digits
    return `+91${clean}`;
  }
  // US numbers: 10 digits without country code
  return `+1${clean}`;
}

function validPhone(raw: string, country: 'IN' | 'US') {
  const digits = onlyDigits(raw);
  if (raw.trim().startsWith('+')) {
    // very light E.164 check
    return /^\+\d{8,15}$/.test(`+${onlyDigits(raw)}`);
  }
  // country-specific quick checks (keep forgiving)
  if (country === 'IN') return digits.length === 10;
  if (country === 'US') return digits.length === 10;
  return digits.length >= 8;
}

// -----------------------------
// Screen
// -----------------------------
export default function PersonalDetails() {
  // text fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [pincode, setPincode] = useState('');

  // Country dropdown for phone
  const [countryOpen, setCountryOpen] = useState(false);
  const [countryValue, setCountryValue] = useState<'IN' | 'US'>('IN');
  const [countryList, setCountryList] = useState(countryItems);

  // DOB: support typing + calendar modal
  const [dobText, setDobText] = useState(''); // mm/dd/yyyy
  const [dobDate, setDobDate] = useState<Date | null>(null);
  const [isDateModalVisible, setDateModalVisible] = useState(false);

  // Dropdowns
  const [genderOpen, setGenderOpen] = useState(false);
  const [genderValue, setGenderValue] = useState<string | null>(null);
  const [genderList, setGenderList] = useState(genderItems);

  const [stateOpen, setStateOpen] = useState(false);
  const [stateValue, setStateValue] = useState<string | null>(null);
  const [stateList, setStateList] = useState(stateItems);

  // make dropdowns not overlap
  const onGenderOpen = useCallback(() => { setStateOpen(false); setCountryOpen(false); }, []);
  const onStateOpen = useCallback(() => { setGenderOpen(false); setCountryOpen(false); }, []);
  const onCountryOpen = useCallback(() => { setGenderOpen(false); setStateOpen(false); }, []);

  // dates / validation
  const today = new Date();
  const eighteenAgo = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());

  const parsedDob = useMemo(() => {
    if (!dobText) return null;
    const d = parse(dobText, 'MM/dd/yyyy', new Date());
    return isValid(d) ? d : null;
  }, [dobText]);

  const dobValidAndAdult = useMemo(() => {
    const d = dobDate || parsedDob;
    if (!d) return false;
    if (d > today) return false;
    return d <= eighteenAgo;
  }, [dobDate, parsedDob]);

  const handleConfirmDate = (date: Date) => {
    setDateModalVisible(false);
    setDobDate(date);
    setDobText(format(date, 'MM/dd/yyyy'));
  };

  const handleContinue = async () => {
    const finalDob = dobDate || parsedDob;

    if (!fullName.trim() || !finalDob || !genderValue || !phone.trim() || !address.trim() || !city.trim() || !stateValue || !pincode.trim()) {
      Alert.alert('Missing info', 'Please fill in all required fields.');
      return;
    }
    if (!dobValidAndAdult) {
      Alert.alert('Invalid DOB', 'Enter a valid DOB (must be 18+ and not in the future).');
      return;
    }
    if (!validPhone(phone.trim(), countryValue)) {
      Alert.alert('Invalid phone', 'Enter a valid phone number.');
      return;
    }
    if (!/^\d{5,6}$/.test(pincode.trim())) {
      Alert.alert('Invalid postal code', 'Enter a 6-digit PIN (IN) or 5-digit ZIP (US).');
      return;
    }

    try {
      const storedUsername = await SecureStore.getItemAsync('username');
      if (!storedUsername) {
        Alert.alert('Session expired', 'Please log in again.');
        router.replace('/(auth)/LoginPage');
        return;
      }

      // Normalize + persist minimal attrs to Cognito (NO SMS OTP)
      const e164 = toE164(phone, countryValue);
      const yyyyMMDD = format(finalDob, 'yyyy-MM-dd'); // Cognito birthdate format
      await updateAttributes(storedUsername, {
        name: fullName,
        birthdate: yyyyMMDD,
        phone_number: e164, // stored but not verified for now
      });

      const token = await SecureStore.getItemAsync('idToken');

      // Store full profile locally for Profile.tsx to render
      const userProfile = {
        name: fullName,
        birthdate: yyyyMMDD,
        gender: genderValue,
        phone: e164,
        address,
        city,
        state: stateValue,
        pincode,
        country: countryValue,
      };
      await SecureStore.setItemAsync('userProfile', JSON.stringify(userProfile));

      await fetch(`${Constants.expoConfig?.extra?.API_URL}/v1/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          name: fullName,
          birthdate: yyyyMMDD,      // 'YYYY-MM-DD'
          gender: genderValue,
          phone: e164,
          address, city,
          state: stateValue,
          pincode,
          country: countryValue,
        })
      });

      // Go straight to success (no phone OTP page)
      router.push('/(auth)/SuccessPage');
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not save your details');
    }
  };


  // figure out a nice phone placeholder based on country
  const phonePlaceholder = (() => {
    const meta = countryItems.find((c) => c.value === countryValue);
    return meta ? `${meta.dial} ${meta.placeholder}` : '+XX…';
  })();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.headerIcon}>
            <FontAwesome name="user-o" size={28} color="#fff" />
          </View>
          <Text style={styles.title}>Personal Details</Text>
          <Text style={styles.subtitle}>Please provide your personal information</Text>

          {/* Full Name */}
          <Field label="Full Name *">
            <TextInput
              placeholder="Enter your full name"
              placeholderTextColor="#9AA0A6"
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
              returnKeyType="next"
            />
          </Field>

          {/* DOB (typed + calendar) */}
          <Field label="Date of Birth *">
            <View style={styles.inputRow}>
              <MaskedTextInput
                mask="99/99/9999"
                placeholder="mm/dd/yyyy"
                placeholderTextColor="#9AA0A6"
                keyboardType="number-pad"
                value={dobText}
                onChangeText={setDobText}
                style={[styles.input, { flex: 1, paddingRight: 56 }]}
              />
              <TouchableOpacity style={styles.iconHit} onPress={() => setDateModalVisible(true)}>
                <View style={styles.iconBtn}>
                  <FontAwesome name="calendar-o" size={20} color="#6B7280" />
                </View>
              </TouchableOpacity>
            </View>

            <DateTimePickerModal
              isVisible={isDateModalVisible}
              mode="date"
              date={dobDate || parsedDob || new Date(2000, 0, 1)}
              maximumDate={today}
              onConfirm={handleConfirmDate}
              onCancel={() => setDateModalVisible(false)}
            />
          </Field>

          {/* Gender */}
          <Field label="Gender *">
            <DropDownPicker
              open={genderOpen}
              value={genderValue}
              items={genderList}
              setOpen={setGenderOpen}
              setValue={setGenderValue}
              setItems={setGenderList}
              placeholder="Select gender"
              listMode="SCROLLVIEW"
              dropDownDirection="BOTTOM"
              onOpen={onGenderOpen}
              style={styles.dropdown}
              dropDownContainerStyle={styles.dropdownContainer}
              zIndex={3000}
              zIndexInverse={1000}
            />
          </Field>

          {/* Country + Phone in a row */}
          <Field label="Phone Number *">
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 0.9 }}>
                <DropDownPicker
                  open={countryOpen}
                  value={countryValue}
                  items={countryList}
                  setOpen={setCountryOpen}
                  setValue={setCountryValue as any}
                  setItems={setCountryList}
                  placeholder="Country"
                  listMode="SCROLLVIEW"
                  onOpen={onCountryOpen}
                  style={styles.dropdown}
                  dropDownContainerStyle={styles.dropdownContainer}
                  zIndex={4000}
                  zIndexInverse={3000}
                />
              </View>
              <View style={{ flex: 1.6 }}>
                <TextInput
                  placeholder={phonePlaceholder}
                  placeholderTextColor="#9AA0A6"
                  style={styles.input}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
              </View>
            </View>
          </Field>

          {/* Address */}
          <Field label="Address *">
            <TextInput
              placeholder="Street address"
              placeholderTextColor="#9AA0A6"
              style={styles.input}
              value={address}
              onChangeText={setAddress}
            />
          </Field>

          {/* City */}
          <Field label="City *">
            <TextInput
              placeholder="City"
              placeholderTextColor="#9AA0A6"
              style={styles.input}
              value={city}
              onChangeText={setCity}
            />
          </Field>

          {/* State */}
          <Field label="State *">
            <DropDownPicker
              open={stateOpen}
              value={stateValue}
              items={stateList}
              setOpen={setStateOpen}
              setValue={setStateValue}
              setItems={setStateList}
              placeholder="Select state"
              searchable
              searchPlaceholder="Search states"
              listMode="SCROLLVIEW"
              dropDownDirection="BOTTOM"
              onOpen={onStateOpen}
              style={styles.dropdown}
              dropDownContainerStyle={styles.dropdownContainer}
              zIndex={2000}
              zIndexInverse={2000}
            />
          </Field>

          {/* Pincode / ZIP */}
          <Field label="PIN / ZIP *">
            <TextInput
              placeholder={countryValue === 'IN' ? '000000' : '00000'}
              placeholderTextColor="#9AA0A6"
              style={styles.input}
              value={pincode}
              onChangeText={setPincode}
              keyboardType="number-pad"
              maxLength={countryValue === 'IN' ? 6 : 5}
            />
          </Field>

          <TouchableOpacity style={styles.button} onPress={handleContinue}>
            <Text style={styles.buttonText}>Continue</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// tiny labeled wrapper
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

// -----------------------------
// Styles
// -----------------------------
const styles = StyleSheet.create({
  container: {
    padding: 18,
    paddingTop: 24,
    backgroundColor: '#FFFFFF',
  },
  headerIcon: {
    alignSelf: 'center',
    backgroundColor: '#0F172A',
    width: 64,
    height: 64,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    color: '#111827',
  },
  subtitle: {
    textAlign: 'center',
    color: '#6B7280',
    marginBottom: 16,
    marginTop: 4,
    fontSize: 15,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111827',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 1,
  },
  inputRow: { position: 'relative' },
  iconHit: {
    position: 'absolute',
    right: 10,
    top: 0,
    bottom: 0,
    width: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E5E7EB',
  },
  dropdown: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E5E7EB',
    borderRadius: 14,
    minHeight: 52,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 1,
  },
  dropdownContainer: {
    borderColor: '#E5E7EB',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
  },
  button: {
    backgroundColor: '#0B0B0C',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 28,
  },
  buttonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: '700',
  },
});
