// app/(tabs)/profile.tsx
import { Href, Link, Stack, useRouter } from 'expo-router'; // useRouter is imported
import {
  AlertCircle,
  Bell,
  Camera, CheckCircle,
  ChevronRight,
  CreditCard,
  FileText,
  Globe,
  HelpCircle,
  Home,
  Landmark,
  Lock,
  LogOut,
  Shield
} from 'lucide-react-native';
import React, { useState } from 'react';
import { Alert, Image, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Helper component for Settings items
interface SettingsItemProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: Href; // Use href for Link navigation
}

function SettingsItem({ icon, title, description, href }: SettingsItemProps) {
  return (
    <Link href={href} asChild>
      <TouchableOpacity style={styles.settingsItemCard}>
        <View style={styles.settingsItemContent}>
          <View style={styles.settingsItemIconBg}>{icon}</View>
          <View style={styles.settingsItemTextContainer}>
            <Text style={styles.settingsItemTitle}>{title}</Text>
            <Text style={styles.settingsItemDescription} numberOfLines={1}>{description}</Text>
          </View>
          <ChevronRight size={20} color="#6B7280" style={styles.settingsItemChevron} />
        </View>
      </TouchableOpacity>
    </Link>
  );
}

// Main Profile Screen
export default function ProfileScreen() {
  const router = useRouter(); // Initialize router
  // This state is now less critical for navigation but can be kept for UI elements on this page
  const [userRole, setUserRole] = useState<'guest' | 'host'>('guest');

  // Mock user data (adapt as needed)
  const userData = {
    name: 'Priya Sharma',
    email: 'priya.sharma@example.com',
    phone: '+91 98765 43210',
    avatar: 'https://i.pravatar.cc/150?img=9',
    isVerified: false,
    kycStatus: 'incomplete' as 'incomplete' | 'pending' | 'verified',
    bankVerified: false,
    propertyVerified: false
  };

  const handleSignOut = () => {
    Alert.alert('Sign out?', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          Alert.alert('Signed Out', 'You have been signed out.');
          // Add actual sign-out logic here (e.g., clear tokens, navigate to auth)
          // For now, just navigate home or to login screen
          router.replace('/'); // Example: Navigate to root (might be login)
        },
      },
    ]);
  };

  // --- UPDATED handleRoleSwitch ---
  const handleRoleSwitch = () => {
    // Navigate to the host layout group using replace
    router.replace('/(host)/dashboard'); // Navigates to app/(host)/_layout.tsx

    // Show a confirmation (optional)
    Alert.alert('Mode Switched', `Switched to Host mode`);
  };
  // --- END UPDATED handleRoleSwitch ---

  return (
    <SafeAreaView style={styles.container}>
      {/* Use Stack.Screen to configure the header */}
      <Stack.Screen options={{ title: 'Profile', headerLargeTitle: true }} />

      <ScrollView>
        <View style={styles.contentContainer}>
          {/* Profile Header Card */}
          <View style={styles.card}>
            <View style={styles.profileHeader}>
              <View style={styles.avatarContainer}>
                <Image source={{ uri: userData.avatar }} style={styles.avatarImage} />
                <TouchableOpacity style={styles.cameraButton}>
                  <Camera size={16} color="white" />
                </TouchableOpacity>
              </View>

              <View style={styles.profileInfo}>
                <View style={styles.profileNameRow}>
                  <Text style={styles.profileName}>{userData.name}</Text>
                  {userData.isVerified && <CheckCircle size={16} color="#16A34A" />}
                </View>
                <Text style={styles.profileEmail}>{userData.email}</Text>
                <Link href="/settings/edit-profile" asChild>
                  <TouchableOpacity style={styles.editProfileButton}>
                    <Text style={styles.editProfileButtonText}>Edit profile</Text>
                  </TouchableOpacity>
                </Link>
              </View>
            </View>

            {!userData.isVerified && (
              <View style={styles.verificationBanner}>
                <AlertCircle size={16} color="#B45309" style={styles.verificationIcon} />
                <View style={styles.verificationTextContainer}>
                  <Text style={styles.verificationText}>Complete verification to unlock all features</Text>
                  <Link href="/settings/privacy-safety" asChild>
                    <TouchableOpacity>
                      <Text style={styles.verificationLink}>Verify now →</Text>
                    </TouchableOpacity>
                  </Link>
                </View>
              </View>
            )}
          </View>

          {/* Role & Hosting */}
          <View style={styles.card}>
            <View style={styles.roleHeader}>
              <View style={styles.roleInfo}>
                <View style={styles.roleIconBg}>
                  <Home size={20} color="#111827" />
                </View>
                <View>
                  <Text style={styles.roleTitle}>Role & Hosting</Text>
                  <Text style={styles.roleSubtitle}>Current mode: <Text style={styles.capitalize}>{userRole}</Text></Text>
                </View>
              </View>
              {/* This button now navigates */}
              <TouchableOpacity style={styles.switchRoleButton} onPress={handleRoleSwitch}>
                <Text style={styles.switchRoleButtonText}>Switch to Host</Text>
              </TouchableOpacity>
            </View>

            {/* This section will likely only show when userRole state is 'host', which won't happen often now */}
            {userRole === 'host' && (
              <>
                <View style={styles.divider} />
                <View style={styles.hostStatusContainer}>
                  {/* ... host status rows ... */}
                  <Link href="/settings/host-onboarding" asChild>
                    <TouchableOpacity style={styles.completeSetupButton}>
                      <Text style={styles.completeSetupButtonText}>Complete host setup</Text>
                    </TouchableOpacity>
                  </Link>
                </View>
              </>
            )}
          </View>

          {/* Account Settings */}
          <View style={styles.settingsGroup}>
            <Text style={styles.settingsGroupTitle}>Account</Text>
            <SettingsItem
              icon={<Lock size={20} color="#4B5563" />}
              title="Login & Security"
              description="Password, 2FA, connected devices"
              href="/settings/login-security"
            />
            <SettingsItem
              icon={<Globe size={20} color="#4B5563" />}
              title="Language & Region"
              description="English (IN) • ₹ INR • DD/MM/YYYY"
              href="/settings/language-region"
            />
             <SettingsItem
              // Icon and titles dynamically change based on local userRole state
              icon={userRole === 'guest' ? <CreditCard size={20} color="#4B5563" /> : <Landmark size={20} color="#4B5563" />}
              title={userRole === 'guest' ? 'Payments' : 'Payouts'}
              description={userRole === 'guest' ? 'Methods, receipts' : 'Bank account, statements'}
              href="/settings/payments" // The payments page should handle role internally or receive it via params if needed
            />
            <SettingsItem
              icon={<Bell size={20} color="#4B5563" />}
              title="Notifications"
              description="Push, SMS, WhatsApp preferences"
              href="/settings/notifications"
            />
            <SettingsItem
              icon={<Shield size={20} color="#4B5563" />}
              title="Privacy & Safety"
              description="Identity verification, data controls"
              href="/settings/privacy-safety"
            />
          </View>

          {/* Support */}
          <View style={styles.settingsGroup}>
            <Text style={styles.settingsGroupTitle}>Support</Text>
            <SettingsItem
              icon={<HelpCircle size={20} color="#4B5563" />}
              title="Help Center"
              description="FAQs, contact support, report issue"
              href="/settings/help-center"
            />
            <SettingsItem
              icon={<FileText size={20} color="#4B5563" />}
              title="Legal"
              description="Terms, privacy policy, licenses"
              href="/settings/help-center" // Link to Help Center for now, or create separate legal page
            />
          </View>

          {/* Sign Out */}
          <View style={styles.signOutCard}>
            <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
              <LogOut size={18} color="white" />
              <Text style={styles.signOutButtonText}>Sign out</Text>
            </TouchableOpacity>
            <Text style={styles.versionText}>Version 1.0.0 • Build 2025.10</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  contentContainer: { padding: 16, gap: 16 },
  card: { backgroundColor: 'white', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  profileHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  avatarContainer: { position: 'relative' },
  avatarImage: { width: 80, height: 80, borderRadius: 40 },
  cameraButton: {
    position: 'absolute', bottom: 0, right: 0, width: 28, height: 28,
    backgroundColor: '#111827', borderRadius: 14, justifyContent: 'center',
    alignItems: 'center', borderWidth: 2, borderColor: 'white',
  },
  profileInfo: { flex: 1 },
  profileNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  profileName: { fontSize: 20, fontWeight: 'bold' },
  profileEmail: { fontSize: 14, color: '#6B7280', marginBottom: 12 },
  editProfileButton: {
    borderColor: '#D1D5DB', borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start',
  },
  editProfileButtonText: { fontSize: 14, fontWeight: '500', color: '#111827' },
  verificationBanner: {
    marginTop: 16, backgroundColor: '#FEF3C7', borderColor: '#FDE68A',
    borderWidth: 1, borderRadius: 8, padding: 12, flexDirection: 'row',
    alignItems: 'flex-start', gap: 8,
  },
  verificationIcon: { marginTop: 2 },
  verificationTextContainer: { flex: 1 },
  verificationText: { fontSize: 14, color: '#92400E' },
  verificationLink: { fontSize: 14, color: '#92400E', fontWeight: 'bold', marginTop: 4 },
  roleHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  roleInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  roleIconBg: {
    width: 40, height: 40, backgroundColor: '#F3F4F6', borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
  },
  roleTitle: { fontSize: 16, fontWeight: 'bold' },
  roleSubtitle: { fontSize: 14, color: '#6B7280' },
  capitalize: { textTransform: 'capitalize' },
  switchRoleButton: {
    borderColor: '#D1D5DB', borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  switchRoleButtonText: { fontSize: 14, fontWeight: '500', color: '#111827' },
  divider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 12 },
  hostStatusContainer: { gap: 8 },
  hostStatusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  hostStatusLabel: { fontSize: 14, color: '#374151' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusBadgeVerified: { backgroundColor: '#D1FAE5' },
  statusBadgePending: { backgroundColor: '#FEE2E2' },
  statusBadgeText: { fontSize: 12, fontWeight: '500', color: '#1F2937' },
  completeSetupButton: {
    borderColor: '#D1D5DB', borderWidth: 1, borderRadius: 8,
    paddingVertical: 8, alignItems: 'center', marginTop: 8,
  },
  completeSetupButtonText: { fontSize: 14, fontWeight: '500', color: '#111827' },
  settingsGroup: { gap: 8 },
  settingsGroupTitle: { fontSize: 14, fontWeight: '500', color: '#6B7280', paddingHorizontal: 8, marginBottom: 4 },
  settingsItemCard: { backgroundColor: 'white', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  settingsItemContent: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  settingsItemIconBg: {
    width: 40, height: 40, backgroundColor: '#F3F4F6', borderRadius: 20,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  settingsItemTextContainer: { flex: 1 },
  settingsItemTitle: { fontSize: 16, fontWeight: '500', marginBottom: 2 },
  settingsItemDescription: { fontSize: 14, color: '#6B7280' },
  settingsItemChevron: { flexShrink: 0 },
  signOutCard: { backgroundColor: 'white', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  signOutButton: {
    backgroundColor: '#DC2626', borderRadius: 8, paddingVertical: 12,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
  },
  signOutButtonText: { fontSize: 16, fontWeight: 'bold', color: 'white' },
  versionText: { fontSize: 12, color: '#6B7280', textAlign: 'center', marginTop: 12 },
});