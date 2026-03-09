import { useTranslation } from 'react-i18next';
// app/(host)/profile.tsx
import api from '@/services/api';
import { Href, Link, Stack, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import {
  Bell,
  Camera,
  CheckCircle,
  ChevronRight,
  FileText,
  Globe,
  HelpCircle,
  Home,
  Landmark,
  Lock,
  LogOut,
  Shield,
} from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';



interface SettingsItemProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: Href;
}
function SettingsItem({ icon, title, description, href }: SettingsItemProps) {
  return (
    <Link href={href} asChild>
      <TouchableOpacity style={styles.settingsItemCard}>
        <View style={styles.settingsItemContent}>
          <View style={styles.settingsItemIconBg}>{icon}</View>
          <View style={styles.settingsItemTextContainer}>
            <Text style={styles.settingsItemTitle}>{title}</Text>
            <Text style={styles.settingsItemDescription} numberOfLines={1}>
              {description}
            </Text>
          </View>
          <ChevronRight size={20} color="#6B7280" style={styles.settingsItemChevron} />
        </View>
      </TouchableOpacity>
    </Link>
  );
}

export default function HostProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  type HostData = {
    name: string;
    avatar: string;
    memberSince: string;
    isVerified: boolean;
    email: string;
    kycStatus: 'incomplete' | 'pending' | 'verified';
    bankVerified: boolean;
    propertyVerified: boolean;
  };

  const [hostData, setHostData] = useState<HostData>({
    // sensible defaults while loading
    name: 'Host',
    avatar: 'https://i.pravatar.cc/150?img=12',
    memberSince: '',
    isVerified: false,
    email: '—',
    kycStatus: 'incomplete',
    bankVerified: false,
    propertyVerified: false,
  });

  useEffect(() => {
    (async () => {
      try {
        // token is optional if your api.ts interceptor already adds Authorization,
        // but getting it here is harmless if you need it later.
        const token = await SecureStore.getItemAsync('idToken');
        if (!token) return;

        // call your backend – adjust to /v1/profile if that's what you actually expose
        const res = await api.get('/v1/profile');
        const p = (res as any).data ?? res;

        setHostData(prev => ({
          ...prev,
          name: p.name || prev.name,
          email: p.email || prev.email,
          avatar: p.avatar_url || prev.avatar,
          // you can wire these when backend supports them
          isVerified: !!p.is_verified,
          memberSince: p.member_since || prev.memberSince,
          // keep existing KYC/bank/property flags for now
        }));
      } catch (e) {
        console.log('Failed to load host profile', e);
      }
    })();
  }, []);


  const handleSignOut = () => {
    Alert.alert(
      t('profile.sign_out_title'),
      t('profile.sign_out_desc'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profile.sign_out'),
          style: 'destructive',
          onPress: async () => {
            try {
              // ✅ Clear auth/session-related keys
              await Promise.all([
                SecureStore.deleteItemAsync('idToken'),          // stored during auth :contentReference[oaicite:1]{index=1}
                SecureStore.deleteItemAsync('username'),         // stored during auth :contentReference[oaicite:2]{index=2}
                SecureStore.deleteItemAsync('user_id'),          // used by websocket init
                SecureStore.deleteItemAsync('pendingEmail'),
                SecureStore.deleteItemAsync('pendingUsername'),
                SecureStore.deleteItemAsync('pendingPassword'),
              ]);

              // Optional: if you want auth language to reset each time user signs out
              // await SecureStore.deleteItemAsync('auth_language');

              // ✅ Go to auth flow (pick one)
              router.replace('/(auth)/LanguageSelection'); // recommended (your auth entry) :contentReference[oaicite:3]{index=3}
              // router.replace('/(auth)/LoginPage');      // alternative
            } catch (e) {
              // Even if SecureStore fails, still force navigation out
              router.replace('/(auth)/LanguageSelection');
            }
          },
        },
      ]
    );
  };


  const handleSwitchToGuest = () => {
    Alert.alert('Switch Mode', 'Switch back to Guest mode?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Switch', onPress: () => router.replace('/(tabs)') },
    ]);
  };

  const navigateToSettings = () => router.push('/settings/edit-profile');

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Simple header */}
      <View style={styles.customHeader}>
        <View style={styles.headerPlaceholder} />
        <Text style={styles.headerTitle}>Profile & Settings</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profile card */}
        <View style={styles.card}>
          <View style={styles.profileHeaderMain}>
            <View style={styles.avatarContainer}>
              <Image source={{ uri: hostData.avatar }} style={styles.avatarImage} />
              <TouchableOpacity style={styles.cameraButton} onPress={navigateToSettings}>
                <Camera size={16} color="white" />
              </TouchableOpacity>
            </View>
            <View style={styles.profileInfo}>
              <View style={styles.profileNameRow}>
                <Text style={styles.profileName}>{hostData.name}</Text>
                {hostData.kycStatus === 'verified' && <CheckCircle size={16} color="#16A34A" />}
              </View>
              <Text style={styles.profileEmail}>{hostData.email}</Text>
              <Link href="/settings/edit-profile" asChild>
                <TouchableOpacity style={styles.editProfileButton}>
                  <Text style={styles.editProfileButtonText}>{t('settings_pages.edit_profile.edit_profile')}</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
        </View>

        {/* Host Mode card */}
        <View style={styles.card}>
          <View style={styles.roleHeader}>
            <View style={styles.roleInfo}>
              <View style={styles.roleIconBg}>
                <Home size={18} color="#0F172A" />
              </View>
              <View style={styles.roleTextContainer}>
                <Text style={styles.roleTitle}>Host Mode</Text>
                <Text style={styles.roleSubtitle} numberOfLines={2}>
                  Managing your properties
                </Text>
              </View>
            </View>

            <TouchableOpacity style={styles.switchModePill} onPress={handleSwitchToGuest}>
              <Text style={styles.switchModePillText}>{t('host.profile.switch_to_guest')}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.roleDivider} />

          {/* Status rows */}
          <View style={styles.hostStatusContainer}>
            <View style={styles.hostStatusRow}>
              <Text style={styles.hostStatusLabel}>{t('settings_pages.host_onboarding.kyc_verification')}</Text>
              <View
                style={[
                  styles.statusBadge,
                  hostData.kycStatus === 'verified' ? styles.statusBadgeVerified : styles.statusBadgePending,
                ]}
              >
                {hostData.kycStatus === 'verified' && <CheckCircle size={12} color="#065F46" />}
                <Text
                  style={[
                    styles.statusBadgeText,
                    hostData.kycStatus === 'verified' ? styles.statusTextVerified : styles.statusTextPending,
                  ]}
                >
                  {hostData.kycStatus === 'verified' ? 'Verified' : 'Incomplete'}
                </Text>
              </View>
            </View>

            <View style={styles.hostStatusRow}>
              <Text style={styles.hostStatusLabel}>{t('settings.payments.bank_account')}</Text>
              <View
                style={[
                  styles.statusBadge,
                  hostData.bankVerified ? styles.statusBadgeVerified : styles.statusBadgePending,
                ]}
              >
                {hostData.bankVerified && <CheckCircle size={12} color="#065F46" />}
                <Text
                  style={[
                    styles.statusBadgeText,
                    hostData.bankVerified ? styles.statusTextVerified : styles.statusTextPending,
                  ]}
                >
                  {hostData.bankVerified ? 'Verified' : 'Not verified'}
                </Text>
              </View>
            </View>

            <View style={styles.hostStatusRow}>
              <Text style={styles.hostStatusLabel}>Property Listed</Text>
              <View
                style={[
                  styles.statusBadge,
                  hostData.propertyVerified ? styles.statusBadgeVerified : styles.statusBadgePending,
                ]}
              >
                {hostData.propertyVerified && <CheckCircle size={12} color="#065F46" />}
                <Text
                  style={[
                    styles.statusBadgeText,
                    hostData.propertyVerified ? styles.statusTextVerified : styles.statusTextPending,
                  ]}
                >
                  {hostData.propertyVerified ? 'Active' : 'Not listed'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Settings groups */}
        <View style={styles.settingsGroup}>
          <Text style={styles.settingsGroupTitle}>Account</Text>
          <SettingsItem
            icon={<Lock size={20} color="#4B5563" />}
            title={t('profile.security')}
            description="Password, 2FA, connected devices"
            href="/settings/login-security"
          />
          <SettingsItem
            icon={<Globe size={20} color="#4B5563" />}
            title={t('profile.language_region')}
            description="English (IN), INR, DD/MM/YYYY"
            href="/settings/language-region"
          />
          <SettingsItem
            icon={<Landmark size={20} color="#4B5563" />}
            title={t('profile.payouts')}
            description="Bank account, GSTIN, statements"
            href="/settings/payments"
          />
          <SettingsItem
            icon={<Bell size={20} color="#4B5563" />}
            title={t('profile.notifications')}
            description="Push, SMS, WhatsApp preferences"
            href="/settings/notifications"
          />
          <SettingsItem
            icon={<Shield size={20} color="#4B5563" />}
            title={t('profile.privacy_safety')}
            description="Identity verification, data controls"
            href="/settings/privacy-safety"
          />
        </View>

        <View style={styles.settingsGroup}>
          <Text style={styles.settingsGroupTitle}>{t('profile.support')}</Text>
          <SettingsItem
            icon={<HelpCircle size={20} color="#4B5563" />}
            title={t('profile.help_center')}
            description="FAQs, contact support, report issue"
            href="/settings/help-center"
          />
          <SettingsItem
            icon={<FileText size={20} color="#4B5563" />}
            title={t('profile.legal')}
            description="Terms, privacy policy, licenses"
            href="/settings/help-center"
          />
        </View>

        {/* Sign out */}
        <View style={styles.signOutCard}>
          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <LogOut size={18} color="white" />
            <Text style={styles.signOutButtonText}>{t('profile.sign_out')}</Text>
          </TouchableOpacity>
          <Text style={styles.versionText}>Version 1.0.0 Build 2025.10</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },

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
  headerPlaceholder: { width: 40 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#111827', textAlign: 'center' },

  scrollContent: { padding: 16, gap: 16, paddingBottom: 40 },

  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  // profile block
  profileHeaderMain: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  avatarContainer: { position: 'relative' },
  avatarImage: { width: 80, height: 80, borderRadius: 40 },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    backgroundColor: '#111827',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  profileInfo: { flex: 1 },
  profileNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  profileName: { fontSize: 20, fontWeight: 'bold' },
  profileEmail: { fontSize: 14, color: '#6B7280', marginBottom: 12 },
  editProfileButton: {
    borderColor: '#D1D5DB',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  editProfileButtonText: { fontSize: 14, fontWeight: '500', color: '#111827' },

  // host mode header (formatted like your screenshot)
  roleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 2,
    marginBottom: 8,
  },
  roleInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  roleIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E5E7EB', // soft grey circle
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleTextContainer: { flex: 1 },
  roleTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 2 },
  roleSubtitle: { fontSize: 14, color: '#6B7280', lineHeight: 18 },

  switchModePill: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  switchModePillText: { color: '#0F172A', fontSize: 14, fontWeight: '600' },

  roleDivider: { height: 1, backgroundColor: '#E5E7EB', marginTop: 10, marginBottom: 12 },

  // status rows + chips
  hostStatusContainer: { gap: 10 },
  hostStatusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  hostStatusLabel: { fontSize: 14, color: '#374151' },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusBadgeVerified: { backgroundColor: '#D1FAE5' },
  statusBadgePending: { backgroundColor: '#FEE2E2' },
  statusBadgeText: { fontSize: 12, fontWeight: '600' },
  statusTextVerified: { color: '#065F46' },
  statusTextPending: { color: '#7F1D1D' },

  // settings list
  settingsGroup: { gap: 8 },
  settingsGroupTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
    paddingHorizontal: 8,
    marginBottom: 4,
  },
  settingsItemCard: { backgroundColor: 'white', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  settingsItemContent: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  settingsItemIconBg: {
    width: 40,
    height: 40,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  settingsItemTextContainer: { flex: 1 },
  settingsItemTitle: { fontSize: 16, fontWeight: '500', marginBottom: 2 },
  settingsItemDescription: { fontSize: 14, color: '#6B7280' },
  settingsItemChevron: { flexShrink: 0 },

  // sign out
  signOutCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  signOutButton: {
    backgroundColor: '#DC2626',
    borderRadius: 8,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  signOutButtonText: { fontSize: 16, fontWeight: 'bold', color: 'white' },
  versionText: { fontSize: 12, color: '#6B7280', textAlign: 'center', marginTop: 12 },
});
