// app/(auth)/LoginPage.tsx
import AuthContainer from '@/components/ui/authContainer';
import AuthHeader from '@/components/ui/authHeader';
import LabeledInput from '@/components/ui/labeledInput';
import PrimaryButton from '@/components/ui/primaryButton';
import SecondaryButton from '@/components/ui/secondaryButton';
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

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = () => {
    console.log('Logging in with:', username, password);
    router.replace('/(tabs)');
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
          title="Welcome Back"
          subtitle="Login to your account"
        />

        <LabeledInput
          label="Username or Email"
          placeholder="Enter your username or email"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />
        <LabeledInput
          label="Password"
          placeholder="Enter your password"
          value={password}
          onChangeText={setPassword}
          isPassword
        />

        <TouchableOpacity onPress={() => Alert.alert('Forgot Password?')}>
          <Text style={styles.forgotPassword}>Forgot Password?</Text>
        </TouchableOpacity>

        <PrimaryButton title="Login" onPress={handleLogin} />

        {/* Divider */}
        <View style={styles.dividerContainer}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Social logins */}
        <View style={local.socialWrap}>
          <SocialButton
            onPress={() => Alert.alert('Google Sign-In', 'Hook up OAuth or Cognito later')}
            icon={<AntDesign name="google" size={20} color="#111827" />}
            label="Continue with Google"
          />
          <SocialButton
            onPress={() => Alert.alert('Apple Sign-In', 'Hook up Apple auth later')}
            icon={<Ionicons name="logo-apple" size={22} color="#111827" />}
            label="Continue with Apple"
          />
          <SocialButton
            onPress={() => Alert.alert('Facebook Login', 'Hook up Facebook auth later')}
            icon={<FontAwesome name="facebook" size={22} color="#111827" />}
            label="Continue with Facebook"
          />
          <SocialButton
            onPress={() => Alert.alert('Instagram Login', 'Hook up Instagram OAuth later')}
            icon={<FontAwesome name="instagram" size={22} color="#111827" />}
            label="Continue with Instagram"
          />
          <SocialButton
            onPress={() => Alert.alert('WhatsApp Login', 'Hook up WhatsApp flow later')}
            icon={<FontAwesome name="whatsapp" size={22} color="#111827" />}
            label="Continue with WhatsApp"
          />
        </View>
        <View style={local.footerCtaWrap}>
          <Text style={local.mutedCtaText}>Don't have an account?</Text>
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
