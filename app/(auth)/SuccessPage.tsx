import { useTranslation } from 'react-i18next';
// app/(auth)/SuccessPage.tsx
import AuthContainer from '@/components/ui/authContainer';
import PrimaryButton from '@/components/ui/primaryButton';
import { apiGet } from '@/services/api';
import { styles } from '@/styles/success.styles';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React from 'react';
import { Text, View } from 'react-native';

export default function SuccessPage() {
  const { t } = useTranslation();

  const syncLanguageFromProfile = async () => {
    try {
      const prof = await apiGet('/v1/profile');
      const lang = String(prof?.preferred_language || '').toLowerCase();
      if (lang) {
        await SecureStore.setItemAsync('preferred_language', lang);
      } else {
        const authLang = await SecureStore.getItemAsync('auth_language');
        if (authLang) await SecureStore.setItemAsync('preferred_language', authLang);
      }
    } catch {
      const authLang = await SecureStore.getItemAsync('auth_language');
      if (authLang) await SecureStore.setItemAsync('preferred_language', authLang);
    }
  };

  const goToApp = async () => {
    await syncLanguageFromProfile();
    router.replace('/(tabs)');
  };

  return (
    <AuthContainer>
      <View style={styles.container}>
        {/* Main content */}
        <View style={styles.content}>
          <MaterialIcons 
            name="check-circle" 
            size={100} 
            color="#28a745" 
            style={styles.icon} 
          />
          
          <Text style={styles.title}>{t('auth.success.title')}</Text>
          <Text style={styles.subtitle}>
            Your account has been created and verified successfully.
          </Text>

          <View style={styles.buttonWrapper}>
            <PrimaryButton title={t('auth.success.get_started')} onPress={goToApp} />
          </View>
        </View>

        {/* Welcome box at the bottom */}
        <View style={styles.welcomeBox}>
          <Text style={styles.welcomeTitle}>Welcome to our platform! 🎉</Text>
          <Text style={styles.welcomeText}>
            You can now access all features and services. Enjoy your experience!
          </Text>
        </View>
      </View>
    </AuthContainer>
  );
}