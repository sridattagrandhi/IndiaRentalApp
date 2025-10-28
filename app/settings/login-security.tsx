// app/settings/login-security.tsx
import { Stack, useRouter } from 'expo-router';
// Import ArrowLeft for custom header
import { ArrowLeft, CheckCircle, Lock, Monitor, Smartphone, XCircle } from 'lucide-react-native';
import React, { useState } from 'react';
// Import necessary components for custom header
import { Alert, Modal, SafeAreaView, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface Device {
  id: string; name: string; type: 'mobile' | 'desktop'; location: string;
  lastActive: string; isCurrent: boolean;
}

const mockDevices: Device[] = [
  { id: '1', name: 'iPhone 14 Pro', type: 'mobile', location: 'Mumbai, MH', lastActive: 'Active now', isCurrent: true },
  { id: '2', name: 'Chrome on Windows', type: 'desktop', location: 'Bangalore, KA', lastActive: '2 days ago', isCurrent: false }
];

export default function LoginSecurityPage() {
  const router = useRouter(); // Use router for back navigation
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showTwoFactorDialog, setShowTwoFactorDialog] = useState(false);
  const [devices] = useState(mockDevices);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  // 2FA state
  const [verificationCode, setVerificationCode] = useState('');


  const handleChangePassword = () => {
    // Add validation logic here
    if (!currentPassword || !newPassword || newPassword !== confirmPassword) {
      Alert.alert('Error', 'Please check your password inputs.');
      return;
    }
    Alert.alert('Password Changed', 'Password updated successfully.');
    setShowPasswordDialog(false);
    // Reset fields
    setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
  };

  const handleToggle2FA = () => {
    if (!twoFactorEnabled) {
      setShowTwoFactorDialog(true); // Show modal to enable
    } else {
      Alert.alert('Disable 2FA?', 'Are you sure you want to disable two-factor authentication?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Disable', style: 'destructive', onPress: () => { setTwoFactorEnabled(false); Alert.alert('2FA Disabled'); } },
      ]);
    }
  };

  const handleEnable2FA = () => {
    // Add verification code validation here
    if (verificationCode !== '123456') { // Mock check
        Alert.alert('Error', 'Invalid verification code.');
        return;
    }
    setTwoFactorEnabled(true);
    setShowTwoFactorDialog(false);
    Alert.alert('2FA Enabled', 'Two-factor authentication is now active.');
    setVerificationCode('');
  };

  const handleRemoveDevice = (deviceName: string) => {
    Alert.alert('Remove Device?', `Are you sure you want to remove ${deviceName}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => Alert.alert('Device Removed') }, // Add actual logic later
    ]);
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
        <Text style={styles.headerTitle}>Login & Security</Text>
        {/* Placeholder for balance */}
        <View style={styles.headerRightPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Password */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardIconBg}><Lock size={20} color="#374151" /></View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitle}>Password</Text>
              <Text style={styles.cardSubtitle}>Last changed 3 months ago</Text>
            </View>
            <TouchableOpacity style={styles.changeButton} onPress={() => setShowPasswordDialog(true)}>
              <Text style={styles.changeButtonText}>Change</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Two-Factor Authentication */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardIconBg}><Smartphone size={20} color="#374151" /></View>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitle}>Two-factor authentication</Text>
              <Text style={styles.cardSubtitle}>Add an extra layer of security</Text>
            </View>
            <Switch value={twoFactorEnabled} onValueChange={handleToggle2FA} trackColor={{ false: '#E5E7EB', true: '#10B981' }} thumbColor="#ffffff" ios_backgroundColor="#E5E7EB"/>
          </View>
          {twoFactorEnabled && (
            <>
              <View style={styles.divider} />
              <View style={styles.successBanner}>
                 <CheckCircle size={16} color="#059669" />
                 <View style={styles.bannerTextContainer}>
                    <Text style={styles.successBannerText}>2FA via SMS enabled</Text>
                    <Text style={styles.successBannerSubtext}>Codes sent to +91 ******3210</Text>
                 </View>
              </View>
            </>
          )}
        </View>

        {/* Connected Devices */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Connected Devices</Text>
          <Text style={styles.sectionSubtitle}>Devices where you're currently logged in</Text>
          {devices.map((device) => (
            <View key={device.id} style={styles.deviceCard}>
              <View style={styles.cardIconBg}>
                {device.type === 'mobile' ? <Smartphone size={20} color="#374151" /> : <Monitor size={20} color="#374151" />}
              </View>
              <View style={styles.deviceInfo}>
                <View style={styles.deviceNameRow}>
                  <Text style={styles.deviceName}>{device.name}</Text>
                  {device.isCurrent && (
                     <View style={styles.thisDeviceBadge}><Text style={styles.thisDeviceBadgeText}>This device</Text></View>
                  )}
                </View>
                <Text style={styles.deviceLocation}>{device.location}</Text>
                <Text style={styles.deviceLastActive}>{device.lastActive}</Text>
              </View>
              {!device.isCurrent && (
                <TouchableOpacity onPress={() => handleRemoveDevice(device.name)}>
                  <Text style={styles.removeButtonText}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>

        {/* Security Recommendations */}
        <View style={styles.recommendationCard}>
           <Text style={styles.recommendationTitle}>Security Recommendations</Text>
           <View style={styles.recommendationItem}>
                {!twoFactorEnabled ? <XCircle size={16} color="#D97706" /> : <CheckCircle size={16} color="#059669" />}
                <Text style={!twoFactorEnabled ? styles.recommendationTextWarning : styles.recommendationTextGood}>
                    {!twoFactorEnabled ? 'Enable two-factor authentication' : 'Two-factor authentication is enabled'}
                </Text>
           </View>
           <View style={styles.recommendationItem}>
                <CheckCircle size={16} color="#059669" />
                <Text style={styles.recommendationTextGood}>Your password is strong</Text>
           </View>
        </View>
      </ScrollView>

      {/* Change Password Modal */}
      <Modal visible={showPasswordDialog} transparent animationType="fade" onRequestClose={() => setShowPasswordDialog(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Change Password</Text>
            <Text style={styles.modalDescription}>Enter current and new password</Text>
            <TextInput style={styles.input} placeholder="Current Password" secureTextEntry value={currentPassword} onChangeText={setCurrentPassword} />
            <TextInput style={styles.input} placeholder="New Password" secureTextEntry value={newPassword} onChangeText={setNewPassword} />
            <TextInput style={styles.input} placeholder="Confirm New Password" secureTextEntry value={confirmPassword} onChangeText={setConfirmPassword} />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalButtonSecondary} onPress={() => setShowPasswordDialog(false)}>
                <Text style={styles.modalButtonTextSecondary}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalButtonPrimary} onPress={handleChangePassword}>
                <Text style={styles.modalButtonTextPrimary}>Change</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

       {/* Enable 2FA Modal */}
       <Modal visible={showTwoFactorDialog} transparent animationType="fade" onRequestClose={() => setShowTwoFactorDialog(false)}>
         <View style={styles.modalOverlay}>
           <View style={styles.modalContent}>
             <Text style={styles.modalTitle}>Enable 2FA</Text>
             <Text style={styles.modalDescription}>We'll send a code via SMS</Text>
             <View style={styles.infoBanner}>
                <Smartphone size={16} color="#2563EB" />
                 <Text style={styles.infoBannerText}>Code sent to +91 ******3210</Text>
             </View>
             <TextInput style={styles.input} placeholder="Enter 6-digit code" keyboardType="number-pad" maxLength={6} value={verificationCode} onChangeText={setVerificationCode} />
             <View style={styles.modalActions}>
               <TouchableOpacity style={styles.modalButtonSecondary} onPress={() => setShowTwoFactorDialog(false)}>
                 <Text style={styles.modalButtonTextSecondary}>Cancel</Text>
               </TouchableOpacity>
               <TouchableOpacity style={styles.modalButtonPrimary} onPress={handleEnable2FA}>
                 <Text style={styles.modalButtonTextPrimary}>Enable</Text>
               </TouchableOpacity>
             </View>
           </View>
         </View>
       </Modal>
    </SafeAreaView>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  // Custom Header Styles
  customHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB', backgroundColor: '#FFFFFF',
  },
  backButton: { padding: 4, width: 40 }, // Fixed width for balance
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#111827', flex: 1, textAlign: 'center' },
  headerRightPlaceholder: { width: 40 }, // Placeholder to balance title
  // End Custom Header Styles
  scrollContent: { padding: 16, gap: 16 },
  card: { backgroundColor: 'white', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardIconBg: {
    width: 40, height: 40, backgroundColor: '#F3F4F6', borderRadius: 20,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  cardTextContainer: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  cardSubtitle: { fontSize: 14, color: '#6B7280' },
  changeButton: {
    borderColor: '#D1D5DB', borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  changeButtonText: { fontSize: 14, fontWeight: '500', color: '#111827' },
  divider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 12 },
  successBanner: {
    backgroundColor: '#ECFDF5', borderColor: '#A7F3D0', borderWidth: 1, borderRadius: 8,
    padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 8,
  },
  bannerTextContainer: { flex: 1 },
  successBannerText: { fontSize: 14, fontWeight: '500', color: '#065F46' },
  successBannerSubtext: { fontSize: 12, color: '#047857', marginTop: 2 },
  section: { gap: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 4 },
  sectionSubtitle: { fontSize: 14, color: '#6B7280', marginBottom: 8 },
  deviceCard: {
    backgroundColor: 'white', borderRadius: 12, padding: 16, borderWidth: 1,
    borderColor: '#E5E7EB', flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  deviceInfo: { flex: 1 },
  deviceNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  deviceName: { fontSize: 16, fontWeight: '600' },
  thisDeviceBadge: { backgroundColor: '#E5E7EB', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  thisDeviceBadgeText: { fontSize: 10, fontWeight: '500', color: '#4B5563' },
  deviceLocation: { fontSize: 14, color: '#6B7280' },
  deviceLastActive: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  removeButtonText: { fontSize: 14, color: '#DC2626', fontWeight: '500' },
  recommendationCard: {
    backgroundColor: '#FFFBEB', borderColor: '#FDE68A', borderWidth: 1, borderRadius: 8, padding: 16, gap: 8,
  },
  recommendationTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  recommendationItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  recommendationTextWarning: { fontSize: 14, color: '#92400E' },
  recommendationTextGood: { fontSize: 14, color: '#374151' },
  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { backgroundColor: 'white', borderRadius: 12, padding: 20, width: '100%', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5, gap: 16 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', textAlign: 'center' },
  modalDescription: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 12, fontSize: 16 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 8 },
  modalButtonPrimary: { backgroundColor: '#111827', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  modalButtonSecondary: { backgroundColor: '#F3F4F6', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  modalButtonTextPrimary: { color: 'white', fontWeight: 'bold' },
  modalButtonTextSecondary: { color: '#111827', fontWeight: 'bold' },
   infoBanner: {
    backgroundColor: '#EFF6FF', borderColor: '#BFDBFE', borderWidth: 1, borderRadius: 8,
    padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  infoBannerText: { fontSize: 14, color: '#1E40AF' },
});