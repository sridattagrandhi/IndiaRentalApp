// app/(auth)/OTPVerification.tsx
import AuthContainer from '@/components/ui/authContainer';
import PrimaryButton from '@/components/ui/primaryButton';
import { styles } from '@/styles/otp.styles';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';

// ✅ Email + phone verification + resend
import {
  confirmSignUp,
  resendPhoneVerifyCode,
  resendSignUpCode,
  // ⬇️ use signInEmail after email confirm (not signUp)
  signInEmail,
  submitPhoneVerifyCode,
} from '@/services/auth';

const OTP_LENGTH = 6;
const RESEND_SECONDS = 60;

const maskPhone = (raw?: string) => {
  if (!raw) return '';
  const hasPlus = raw.trim().startsWith('+');
  const digits = raw.replace(/\D/g, '');
  if (digits.length <= 4) return (hasPlus ? '+' : '') + digits;
  const last4 = digits.slice(-4);
  const maskedCore = 'X'.repeat(digits.length - 4) + last4;
  return (hasPlus ? '+' : '') + maskedCore;
};

export default function OTPVerification() {
  const [otp, setOtp] = useState<string[]>(new Array(OTP_LENGTH).fill(''));
  const inputs = useRef<(TextInput | null)[]>([]);
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);
  const [isResending, setIsResending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const { type, value, username } =
    useLocalSearchParams<{ type: 'email' | 'phone'; value: string; username?: string }>();

  const title = type === 'phone' ? 'Verify Phone Number' : 'Verify Email Address';
  const destPretty =
    type === 'phone'
      ? maskPhone(value)
      : value?.replace(/^(..)(.*?)(@.*)$/, '$1***$3') ?? '';

  // countdown for resend
  useEffect(() => {
    setCooldown(RESEND_SECONDS); // reset on mount
    const id = setInterval(() => {
      setCooldown((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [type, value]);

  const handleOtpChange = (text: string, index: number) => {
    if (text.length > 1) text = text.charAt(text.length - 1);
    const next = [...otp];
    next[index] = text;
    setOtp(next);
    if (text && index < OTP_LENGTH - 1) inputs.current[index + 1]?.focus();
  };

  const handleBackspace = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length !== OTP_LENGTH) {
      Alert.alert('Incomplete code', `Enter the full ${OTP_LENGTH}-digit code.`);
      return;
    }

    try {
      setIsVerifying(true);

      if (type === 'phone') {
        // (You said phone OTP is disabled for now; leaving logic intact but it won’t be used.)
        const storedUser = username || (await SecureStore.getItemAsync('username'));
        if (!storedUser) {
          Alert.alert('Session expired', 'Please log in again.');
          router.replace('/(auth)/LoginPage');
          return;
        }
        await submitPhoneVerifyCode(storedUser, code);
        Alert.alert('Success', 'Phone number verified!');
        router.replace('/(tabs)');
      } else {
        // EMAIL FLOW: confirm sign-up code, then SIGN IN and persist the session.
        let pendingUsername: string | null =
          (typeof username === 'string' ? username : null) ??
          (await SecureStore.getItemAsync('pendingUsername')) ??
          (await SecureStore.getItemAsync('pendingEmail')); // if pool uses email-as-username

        if (!pendingUsername) {
          Alert.alert('Missing username', 'Unable to confirm sign up.');
          return;
        }

        // Confirm the email OTP for that username
        await confirmSignUp({ username: pendingUsername, code });

        // Now sign in to obtain tokens
        const pendingPassword = await SecureStore.getItemAsync('pendingPassword');
        if (!pendingPassword) {
          Alert.alert('Session error', 'Missing password. Please sign in.');
          router.replace('/(auth)/LoginPage');
          return;
        }

        const { idToken } = await signInEmail({
          usernameOrEmail: pendingUsername,
          password: pendingPassword,
        });

        // Persist for subsequent API calls (e.g., PersonalDetails → /v1/profile PUT)
        await SecureStore.setItemAsync('username', pendingUsername);
        await SecureStore.setItemAsync('idToken', idToken);

        // Clean up temp creds
        await SecureStore.deleteItemAsync('pendingEmail');
        await SecureStore.deleteItemAsync('pendingUsername');
        await SecureStore.deleteItemAsync('pendingPassword');

        router.replace('/(auth)/PersonalDetails');
      }
    } catch (err: any) {
      Alert.alert('Verification failed', err?.message ?? 'Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || isResending) return;
    try {
      setIsResending(true);

      // Prefer in-order: param username → pendingUsername → stored username → pendingEmail
      const who =
        (typeof username === 'string' ? username : null) ??
        (await SecureStore.getItemAsync('pendingUsername')) ??
        (await SecureStore.getItemAsync('username')) ??
        (await SecureStore.getItemAsync('pendingEmail'));

      if (!who) {
        Alert.alert('Session expired', 'Please log in again.');
        router.replace('/(auth)/LoginPage');
        return;
      }

      if (type === 'phone') {
        await resendPhoneVerifyCode(who);
      } else {
        await resendSignUpCode(who);
      }

      setCooldown(RESEND_SECONDS);
      Alert.alert('Code resent', `A new code was sent to ${destPretty}.`);
    } catch (err: any) {
      Alert.alert('Resend failed', err?.message ?? 'Please try again later.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <AuthContainer>
      {/* Icon */}
      <View style={styles.iconContainer}>
        <MaterialIcons name="security" size={32} color="white" />
      </View>

      {/* Header */}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>We’ve sent a {OTP_LENGTH}-digit code to</Text>
      <Text style={styles.valueText}>{destPretty}</Text>

      {/* Inputs */}
      <View style={styles.otpContainer}>
        {otp.map((_, i) => (
          <TextInput
            key={i}
            ref={(el) => { inputs.current[i] = el; }}
            style={styles.otpInput}
            keyboardType="number-pad"
            maxLength={1}
            value={otp[i]}
            onChangeText={(t) => handleOtpChange(t, i)}
            onKeyPress={(e) => handleBackspace(e, i)}
          />
        ))}
      </View>

      <Text style={styles.helperText}>
        Enter the {OTP_LENGTH}-digit code sent to your {type}.
      </Text>

      <PrimaryButton title={isVerifying ? 'Verifying…' : 'Verify & Continue'} onPress={handleVerify} />

      {/* Resend */}
      <Text style={styles.resendPrompt}>Didn’t get a code?</Text>

      <TouchableOpacity
        onPress={handleResend}
        disabled={cooldown > 0 || isResending}
      >
        <Text
          style={[
            styles.resendLink,
            (cooldown > 0 || isResending) && { opacity: 0.5 },
          ]}
        >
          {isResending
            ? 'Resending…'
            : cooldown > 0
            ? `Resend in ${String(Math.floor(cooldown / 60)).padStart(2, '0')}:${String(
                cooldown % 60
              ).padStart(2, '0')}`
            : 'Resend OTP'}
        </Text>
      </TouchableOpacity>

      <View style={styles.footerInfoBox}>
        <Text style={styles.footerText}>
          This OTP is valid for 10 minutes. Never share your code with anyone.
        </Text>
      </View>
    </AuthContainer>
  );
}
