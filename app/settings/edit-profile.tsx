// app/settings/edit-profile.tsx
import { Stack, useRouter } from 'expo-router';
import { ArrowLeft, Camera, Mail, Phone } from 'lucide-react-native';
import React, { useState } from 'react';
import { Alert, Image, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function EditProfilePage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    firstName: 'Priya',
    lastName: 'Sharma',
    email: 'priya.sharma@example.com',
    phone: '+91 98765 43210',
    bio: 'Travel enthusiast exploring India one city at a time.',
    avatar: 'https://i.pravatar.cc/150?img=9',
  });

  const handleSave = () => {
    Alert.alert('Profile Updated', 'Your profile has been saved.');
    router.back();
  };

  const handleAvatarChange = () => {
    Alert.alert('Change Photo', 'Implement image picker here.');
    // Integrate ImagePicker logic here
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: false, // Hide the default header completely
        }}
      />
      
      {/* Custom Header */}
      <View style={styles.customHeader}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <TouchableOpacity onPress={handleSave}>
          <Text style={styles.saveButton}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profile Photo */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarContainer}>
            <Image source={{ uri: formData.avatar }} style={styles.avatarImage} />
            <TouchableOpacity style={styles.cameraButton} onPress={handleAvatarChange}>
              <Camera size={16} color="white" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.changePhotoButton} onPress={handleAvatarChange}>
            <Text style={styles.changePhotoButtonText}>Change photo</Text>
          </TouchableOpacity>
        </View>

        {/* Personal Information */}
        <View style={styles.section}>
          <View style={styles.nameRow}>
            <View style={styles.inputGroupHalf}>
              <Text style={styles.label}>First name</Text>
              <TextInput
                style={styles.input}
                value={formData.firstName}
                onChangeText={(text) => setFormData({ ...formData, firstName: text })}
              />
            </View>
            <View style={styles.inputGroupHalf}>
              <Text style={styles.label}>Last name</Text>
              <TextInput
                style={styles.input}
                value={formData.lastName}
                onChangeText={(text) => setFormData({ ...formData, lastName: text })}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Bio (optional)</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              placeholder="Tell us about yourself..."
              value={formData.bio}
              onChangeText={(text) => setFormData({ ...formData, bio: text })}
              multiline
              maxLength={200}
            />
            <Text style={styles.charCount}>{formData.bio.length}/200 characters</Text>
          </View>
        </View>

        {/* Contact Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Information</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email address</Text>
            <View style={styles.inputIconContainer}>
              <Mail size={18} color="#6B7280" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, styles.inputWithIcon]}
                value={formData.email}
                onChangeText={(text) => setFormData({ ...formData, email: text })}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            <Text style={styles.inputHint}>We'll send booking confirmations here</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone number</Text>
            <View style={styles.inputIconContainer}>
              <Phone size={18} color="#6B7280" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, styles.inputWithIcon]}
                value={formData.phone}
                onChangeText={(text) => setFormData({ ...formData, phone: text })}
                keyboardType="phone-pad"
              />
            </View>
            <Text style={styles.inputHint}>Used for OTP and notifications</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
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
  backButton: {
    padding: 4,
    width: 60, // Fixed width to balance the layout
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
    textAlign: 'center',
  },
  saveButton: { 
    color: '#007AFF', 
    fontSize: 16, 
    fontWeight: '600',
    width: 60, // Fixed width to balance the layout
    textAlign: 'right',
  },
  scrollContent: { padding: 16, paddingBottom: 40 },
  avatarSection: { alignItems: 'center', marginBottom: 24, gap: 12 },
  avatarContainer: { position: 'relative' },
  avatarImage: { width: 96, height: 96, borderRadius: 48 },
  cameraButton: {
    position: 'absolute', bottom: 0, right: 0, width: 32, height: 32,
    backgroundColor: '#111827', borderRadius: 16, justifyContent: 'center',
    alignItems: 'center', borderWidth: 2, borderColor: 'white',
  },
  changePhotoButton: {
    borderColor: '#D1D5DB', borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  changePhotoButtonText: { fontSize: 14, fontWeight: '500', color: '#111827' },
  section: { marginBottom: 24, gap: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  nameRow: { flexDirection: 'row', gap: 12 },
  inputGroup: {},
  inputGroupHalf: { flex: 1 },
  label: { fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingHorizontal: 12,
    paddingVertical: 10, fontSize: 16, backgroundColor: 'white',
  },
  textarea: { height: 80, textAlignVertical: 'top' },
  charCount: { fontSize: 12, color: '#6B7280', marginTop: 4, textAlign: 'right' },
  inputIconContainer: { position: 'relative', justifyContent: 'center' },
  inputIcon: { position: 'absolute', left: 12, zIndex: 1 },
  inputWithIcon: { paddingLeft: 40 },
  inputHint: { fontSize: 12, color: '#6B7280', marginTop: 6 },
});