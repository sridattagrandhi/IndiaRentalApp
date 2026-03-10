import { useTranslation } from 'react-i18next';
// app/(auth)/LoginPage.tsx
import AuthContainer from '@/components/ui/authContainer';
import AuthHeader from '@/components/ui/authHeader';
import LabeledInput from '@/components/ui/labeledInput';
import PrimaryButton from '@/components/ui/primaryButton';
import SecondaryButton from '@/components/ui/secondaryButton';
import { apiGet } from '@/services/api';
import { styles } from '@/styles/login.styles';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

// Social icons
import { AntDesign, FontAwesome, Ionicons } from '@expo/vector-icons'; // google, apple

// 🔑 Cognito sign-in
import { signIn } from '@/services/auth';
import * as SecureStore from 'expo-secure-store';

import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';


export default function LoginPage() {
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

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // 🔄 UPDATED: call Cognito, store tokens + username, then route
  const handleLogin = async () => {
    try {
      if (!username || !password) {
        Alert.alert(t('auth.signup.alerts.missing_fields_title'), 'Please enter your username/email and password.');
        return;
      }
      const { idToken} = await signIn({ username, password });
      // const { idToken, accessToken } = await signIn({ username, password });
      console.log('[Cognito ID Token]', idToken); 
      await SecureStore.setItemAsync('idToken', idToken);
      // await SecureStore.setItemAsync('accessToken', accessToken); 
      await SecureStore.setItemAsync('username', username); // <-- store for phone OTP flow
      await syncLanguageFromProfile();
      router.replace('/(tabs)');
    } catch (err: any) {
      Alert.alert('Login failed', err?.message ?? 'Please try again.');
    }
  };

  const handleCreateAccount = () => {
    router.push('/(auth)/SignupPage');
  };

  // Reusable social button (outline style, centered label)
  const SocialButton = ({
    onPress,
    icon,
    label,
  }: {
    onPress: () => void;
    icon: React.ReactNode;
    label: string;
  }) => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        local.socialBtn,
        pressed && local.socialBtnPressed,
      ]}
    >
      {/* Left icon (fixed width) */}
      <View style={local.iconBox}>{icon}</View>
      {/* Centered label */}
      <Text style={local.socialLabel}>{label}</Text>
      {/* Right spacer to keep label perfectly centered */}
      <View style={local.iconBox} />
    </Pressable>
  );

  return (
    <AuthContainer>
      <ScrollView showsVerticalScrollIndicator={false}>
        <AuthHeader
          icon={<MaterialIcons name="login" size={32} color="white" />}
          title={t('auth.login.welcome_back')}
          subtitle={t('auth.login.subtitle')}
        />

        <LabeledInput
          label={t('auth.login.username_or_email_label')}
          placeholder={t('auth.login.username_or_email_placeholder')}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />
        <LabeledInput
          label={t('settings.login_security.password')}
          placeholder={t('auth.login.password_placeholder')}
          value={password}
          onChangeText={setPassword}
          isPassword
        />

        <TouchableOpacity onPress={() => Alert.alert(t('auth.login.forgot_password'))}>
          <Text style={styles.forgotPassword}>{t('auth.login.forgot_password')}</Text>
        </TouchableOpacity>

        <PrimaryButton title={t('auth.login.login')} onPress={handleLogin} />

        {/* Divider */}
        <View style={styles.dividerContainer}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Social logins */}
        <View style={local.socialWrap}>
          <SocialButton
            onPress={() => Alert.alert(t('auth.login.google_sign_in'), t('auth.login.oauth_later'))}
            icon={<AntDesign name="google" size={20} color="#111827" />}
            label={t('auth.login.continue_with_google')}
          />
          <SocialButton
            onPress={() => Alert.alert(t('auth.login.apple_sign_in'), t('auth.login.hook_up_apple_later'))}
            icon={<Ionicons name="logo-apple" size={22} color="#111827" />}
            label={t('auth.login.continue_with_apple')}
          />
          <SocialButton
            onPress={() => Alert.alert(t('auth.login.facebook_login'), t('auth.login.hook_up_facebook_later'))}
            icon={<FontAwesome name="facebook" size={22} color="#111827" />}
            label={t('auth.login.continue_with_facebook')}
          />
          <SocialButton
            onPress={() => Alert.alert(t('auth.login.instagram_login'), 'Hook up Instagram OAuth later')}
            icon={<FontAwesome name="instagram" size={22} color="#111827" />}
            label={t('auth.login.continue_with_instagram')}
          />
          <SocialButton
            onPress={() => Alert.alert(t('auth.login.whatsapp_login'), 'Hook up WhatsApp flow later')}
            icon={<FontAwesome name="whatsapp" size={22} color="#111827" />}
            label={t('auth.login.continue_with_whatsapp')}
          />
        </View>
        <View style={local.footerCtaWrap}>
          <Text style={local.mutedCtaText}>{t('auth.login.no_account')}</Text>
        </View>
        <SecondaryButton title="Create Account" onPress={handleCreateAccount} />
      </ScrollView>
    </AuthContainer>
  );
}

const local = StyleSheet.create({
  socialWrap: {
    gap: 12,
    marginBottom: 16,
  },
  socialBtn: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  socialBtnPressed: {
    backgroundColor: '#F6F7F9',
  },
  iconBox: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    color: '#111827',
    fontWeight: '600',
  },
  footerCtaWrap: {
    gap: 20,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  mutedCtaText: {
    fontSize: 17,
    color: '#6B7280',
  },
});
