import { useTranslation } from 'react-i18next';
// app/(auth)/SignupPage.tsx
import AuthContainer from '@/components/ui/authContainer';
import AuthHeader from '@/components/ui/authHeader';
import LabeledInput from '@/components/ui/labeledInput';
import PrimaryButton from '@/components/ui/primaryButton';
import SocialButton from '@/components/ui/socialButton';
import { styles } from '@/styles/signup.styles';
import { FontAwesome } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';

// 🆕 call Cognito signUp
import { signUpEmail } from '@/services/auth';

export default function SignupPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSignup = async () => {
    // 1. Check if any fields are empty
    if (!email || !username || !password || !confirmPassword) {
      Alert.alert(t('auth.signup.alerts.missing_fields_title'), t('auth.signup.alerts.missing_fields_message'));
      return;
    }

    // 2. Check if passwords match
    if (password !== confirmPassword) {
      Alert.alert(t('auth.signup.alerts.password_mismatch_title'), t('auth.signup.alerts.password_mismatch_message'));
      return;
    }
    
    // 3. Password Criteria Validation
    const errors: string[] = [];
    if (password.length < 8) errors.push('be at least 8 characters long');
    if (!/[a-z]/.test(password)) errors.push('contain at least one lowercase letter');
    if (!/[A-Z]/.test(password)) errors.push('contain at least one uppercase letter');
    if (!/\d/.test(password)) errors.push('contain at least one number');
    if (!/[!@#$%^&*(),.?":{}|<>_]/.test(password)) errors.push('contain at least one special character');

    if (errors.length > 0) {
      const errorMessage = "Password must:\n\n" + errors.map(err => `• ${err}`).join('\n');
      Alert.alert(t('auth.signup.alerts.password_not_strong_title'), errorMessage);
      return;
    }

    await SecureStore.setItemAsync('pendingEmail', email);
    await SecureStore.setItemAsync('pendingPassword', password);
    await SecureStore.setItemAsync('pendingUsername', username);

    try {
      // 🆕 Create user in Cognito
      await signUpEmail({ username, password, email });

      // ➡️ Navigate to email OTP screen, pass username so we can confirm it there
      router.push({
        pathname: '/(auth)/OTPVerification',
        params: { type: 'email', value: email, username },
      });
    } catch (err: any) {
      Alert.alert(t('auth.signup.alerts.signup_failed_title'), err?.message ?? 'Please try again.');
    }
  };

  const handleSocialSignup = (provider: string) => {
    Alert.alert(t('auth.signup.social_signup'), `Continue with ${provider}`);
    // Hosted UI will be wired later
  };

  return (
    <AuthContainer>
      <ScrollView showsVerticalScrollIndicator={false}>
        <AuthHeader
          icon={<FontAwesome name="user-plus" size={30} color="white" />}
          title="Create Account"
          subtitle={t('auth.signup.subtitle')}
        />

        <SocialButton title={t('auth.login.continue_with_google')}   icon="logo-google"   onPress={() => handleSocialSignup('Google')} />
        <SocialButton title={t('auth.login.continue_with_apple')}    icon="logo-apple"    onPress={() => handleSocialSignup('Apple')} />
        <SocialButton title={t('auth.login.continue_with_facebook')} icon="logo-facebook" onPress={() => handleSocialSignup('Facebook')} />
        <SocialButton title={t('auth.login.continue_with_instagram')} icon="logo-instagram" onPress={() => handleSocialSignup('Instagram')} />
        <SocialButton title={t('auth.login.continue_with_whatsapp')} icon="logo-whatsapp" onPress={() => handleSocialSignup('WhatsApp')} />

        <View style={styles.dividerContainer}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.dividerLine} />
        </View>

        <LabeledInput
          label={t('auth.signup.email_label')}
          placeholder={t('auth.signup.email_placeholder')}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <LabeledInput
          label={t('auth.signup.username_label')}
          placeholder={t('auth.signup.username_placeholder')}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />
        
        <LabeledInput
          label={t('settings.login_security.password')}
          placeholder={t('auth.signup.password_requirements')}
          value={password}
          onChangeText={setPassword}
          isPassword
        />
        <LabeledInput
          label={t('auth.signup.confirm_password_label')}
          placeholder={t('auth.signup.confirm_password_placeholder')}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          isPassword
        />

        <PrimaryButton title={t('auth.signup.sign_up')} onPress={handleSignup} />
        
        <View style={styles.loginLinkContainer}>
          <Text style={styles.loginText}>{t('auth.signup.already_have_account')}</Text>
          <Link href="/(auth)/LoginPage">
            <Text style={styles.loginLink}>{t('auth.signup.login_here')}</Text>
          </Link>
        </View>
      </ScrollView>
    </AuthContainer>
  );
}
