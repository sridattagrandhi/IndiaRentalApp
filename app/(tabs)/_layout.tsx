// app/(tabs)/_layout.tsx
import { apiGet } from '@/services/api';
import { Tabs } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { Briefcase, Heart, Home, MessageCircle, User } from 'lucide-react-native';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next'; // ✅ ADD THIS
import i18n from '../../i18n'; // ✅ ADD THIS

export default function TabLayout() {
  const { t } = useTranslation(); // ✅ ADD THIS

  useEffect(() => {
    (async () => {
      try {
        // ✅ Pull real preference from backend profile
        const p = await apiGet('/v1/profile');
        const lang = String(p?.preferred_language || 'en')
          .toLowerCase()
          .split('-')[0];

        await SecureStore.setItemAsync('preferred_language', lang);
        
        // ✅ Change app language
        await i18n.changeLanguage(lang);

        // ✅ Optional: clear temporary auth language
        await SecureStore.deleteItemAsync('auth_language');
      } catch (e: any) {
        console.log('[profile hydrate failed]', e?.response?.status, e?.response?.data || e?.message || e);
      }
    })();
  }, []);

  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#111827' }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'), // ✅ Translated
          tabBarIcon: ({ color }) => <Home color={color} />,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="wishlist"
        options={{
          title: t('tabs.wishlist'), // ✅ Translated
          tabBarLabel: t('tabs.wishlist'),
          tabBarIcon: ({ color }) => <Heart color={color} />,
        }}
      />
      <Tabs.Screen
        name="mytrips"
        options={{
          title: t('tabs.bookings'), // ✅ Translated
          tabBarLabel: t('tabs.bookings'), // ✅ Translated
          tabBarIcon: ({ color }) => <Briefcase color={color} />,
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: t('tabs.inbox'), // ✅ Translated
          tabBarIcon: ({ color }) => <MessageCircle color={color} />,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'), // ✅ Translated
          tabBarLabel: t('tabs.profile'),
          tabBarIcon: ({ color }) => <User color={color} />,
          headerShown: false,
        }}
      />
    </Tabs>
  );
}