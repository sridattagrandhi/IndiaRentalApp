// app/settings/notifications.tsx
import { Stack, useRouter } from 'expo-router';
// Import ArrowLeft for custom header
import { ArrowLeft, Bell, MessageSquare, Smartphone } from 'lucide-react-native';
import React, { useState } from 'react';
// Import necessary components for custom header
import { Alert, SafeAreaView, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';

interface NotificationSetting {
  id: string; title: string; description: string;
  channels: { push: boolean; sms: boolean; whatsapp: boolean; email: boolean; };
}

export default function NotificationsPage() {
  const router = useRouter(); // Use router for back navigation
  const [settings, setSettings] = useState<NotificationSetting[]>([
    { id: 'bookings', title: 'Booking confirmations', description: 'Confirmed or modified bookings', channels: { push: true, sms: true, whatsapp: true, email: true } },
    { id: 'messages', title: 'Host messages', description: 'Notifications from hosts', channels: { push: true, sms: false, whatsapp: true, email: false } },
    { id: 'trip-reminders', title: 'Trip reminders', description: 'Before check-in/out', channels: { push: true, sms: true, whatsapp: false, email: true } },
    { id: 'promotions', title: 'Promotions & offers', description: 'Special deals & discounts', channels: { push: false, sms: false, whatsapp: true, email: true } },
  ]);

  const toggleChannel = (settingId: string, channel: keyof NotificationSetting['channels']) => {
    setSettings(prev => prev.map(setting =>
      setting.id === settingId
        ? { ...setting, channels: { ...setting.channels, [channel]: !setting.channels[channel] } }
        : setting
    ));
    Alert.alert('Preferences Updated');
  };

  const handleSave = () => {
    Alert.alert('Settings Saved');
    // Add logic to persist settings
    router.back();
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
        <Text style={styles.headerTitle}>Notifications</Text>
        <TouchableOpacity onPress={handleSave} style={styles.saveButtonContainer}>
          <Text style={styles.saveButton}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Info Card */}
        <View style={styles.infoBanner}>
          <Bell size={16} color="#2563EB" />
          <Text style={styles.infoBannerText}>Choose how you want to receive notifications</Text>
        </View>

        {/* Channel Legend */}
        <View style={styles.legendContainer}>
          <View style={styles.legendItem}>
             <View style={styles.legendIconBg}><Smartphone size={16} color="#4B5563" /></View>
             <Text style={styles.legendText}>Push</Text>
          </View>
           <View style={styles.legendItem}>
             <View style={styles.legendIconBg}><MessageSquare size={16} color="#4B5563" /></View>
             <Text style={styles.legendText}>SMS</Text>
          </View>
           <View style={styles.legendItem}>
             <View style={styles.legendIconBg}><MessageSquare size={16} color="#4B5563" /></View>
             <Text style={styles.legendText}>WhatsApp</Text>
          </View>
           <View style={styles.legendItem}>
             <View style={styles.legendIconBg}><MessageSquare size={16} color="#4B5563" /></View>
             <Text style={styles.legendText}>Email</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Notification Settings */}
        {settings.map((setting) => (
          <View key={setting.id} style={styles.card}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>{setting.title}</Text>
              <Text style={styles.settingDescription}>{setting.description}</Text>
            </View>
            <View style={styles.switchesContainer}>
              <View style={styles.switchItem}>
                <Text style={styles.switchLabel}>Push</Text>
                <Switch
                    value={setting.channels.push}
                    onValueChange={() => toggleChannel(setting.id, 'push')}
                    trackColor={{ false: '#E5E7EB', true: '#10B981' }} thumbColor="#ffffff"
                    ios_backgroundColor="#E5E7EB"
                />
              </View>
               <View style={styles.switchItem}>
                <Text style={styles.switchLabel}>SMS</Text>
                <Switch
                    value={setting.channels.sms}
                    onValueChange={() => toggleChannel(setting.id, 'sms')}
                     trackColor={{ false: '#E5E7EB', true: '#10B981' }} thumbColor="#ffffff"
                    ios_backgroundColor="#E5E7EB"
                />
              </View>
              <View style={styles.switchItem}>
                <Text style={styles.switchLabel}>WhatsApp</Text>
                <Switch
                    value={setting.channels.whatsapp}
                    onValueChange={() => toggleChannel(setting.id, 'whatsapp')}
                     trackColor={{ false: '#E5E7EB', true: '#10B981' }} thumbColor="#ffffff"
                    ios_backgroundColor="#E5E7EB"
                />
              </View>
              <View style={styles.switchItem}>
                <Text style={styles.switchLabel}>Email</Text>
                <Switch
                    value={setting.channels.email}
                    onValueChange={() => toggleChannel(setting.id, 'email')}
                     trackColor={{ false: '#E5E7EB', true: '#10B981' }} thumbColor="#ffffff"
                    ios_backgroundColor="#E5E7EB"
                />
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
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
  backButton: { padding: 4, width: 60 }, // Fixed width
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#111827', flex: 1, textAlign: 'center' },
  saveButtonContainer: { width: 60, alignItems: 'flex-end' }, // Fixed width for balance
  saveButton: { color: '#007AFF', fontSize: 16, fontWeight: '600' },
  // End Custom Header Styles
  scrollContent: { padding: 16, gap: 16 },
  infoBanner: {
    backgroundColor: '#EFF6FF', borderColor: '#BFDBFE', borderWidth: 1, borderRadius: 8,
    padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  infoBannerText: { fontSize: 14, color: '#1E40AF', flex: 1 },
  legendContainer: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 8 },
  legendItem: { alignItems: 'center', gap: 4 },
  legendIconBg: { width: 36, height: 36, backgroundColor: '#F3F4F6', borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  legendText: { fontSize: 12, color: '#6B7280' },
  divider: { height: 1, backgroundColor: '#E5E7EB' },
  card: { backgroundColor: 'white', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  settingInfo: { marginBottom: 16 },
  settingTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  settingDescription: { fontSize: 14, color: '#6B7280' },
  switchesContainer: { flexDirection: 'row', justifyContent: 'space-around' },
  switchItem: { alignItems: 'center', gap: 6 },
  switchLabel: { fontSize: 12, color: '#6B7280' },
});