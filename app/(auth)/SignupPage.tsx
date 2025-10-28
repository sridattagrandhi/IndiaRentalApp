// app/(auth)/SignupPage.tsx
import AuthContainer from '@/components/ui/authContainer';
import AuthHeader from '@/components/ui/authHeader';
import LabeledInput from '@/components/ui/labeledInput';
import PrimaryButton from '@/components/ui/primaryButton';
import SocialButton from '@/components/ui/socialButton';
import { styles } from '@/styles/signup.styles';
import { FontAwesome } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import React, { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSignup = () => {
    // 1. Check if any fields are empty
    if (!email || !username || !password || !confirmPassword) {
      Alert.alert('Missing Fields', 'Please fill in all fields.');
      return;
    }

    // 2. Check if passwords match
    if (password !== confirmPassword) {
      Alert.alert('Password Mismatch', 'Passwords do not match. Please try again.');
      return;
    }
    
    // 3. Password Criteria Validation
    const errors = [];
    if (password.length < 8) {
      errors.push('be at least 8 characters long');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('contain at least one lowercase letter');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('contain at least one uppercase letter');
    }
    if (!/\d/.test(password)) {
      errors.push('contain at least one number');
    }
    if (!/[!@#$%^&*(),.?":{}|<>_]/.test(password)) {
      errors.push('contain at least one special character');
    }

    if (errors.length > 0) {
      const errorMessage = "Password must:\n\n" + errors.map(err => `• ${err}`).join('\n');
      Alert.alert('Password Not Strong Enough', errorMessage);
      return;
    }

    // If all checks pass, proceed to EMAIL verification
    console.log('Signup details validated. Proceeding to email OTP for:', email);
    
    // --- UPDATED NAVIGATION ---
    // Navigate to the OTP page, passing the 'type' and 'value'
    router.push({
      pathname: '/(auth)/OTPVerification',
      params: { type: 'email', value: email }
    });
  };

  const handleSocialSignup = (provider: string) => {
    Alert.alert('Social Signup', `Continue with ${provider}`);
    // TODO: Add logic for Google/Apple sign-in
    // On success, you would also navigate to the OTP email verification
    // router.push({
    //   pathname: '/(auth)/OTPVerification',
    //   params: { type: 'email', value: 'user_social_email@gmail.com' }
    // });
  };

  return (
    <AuthContainer>
      <ScrollView showsVerticalScrollIndicator={false}>
        <AuthHeader
          icon={<FontAwesome name="user-plus" size={30} color="white" />}
          title="Create Account"
          subtitle="Sign up to get started"
        />

        <SocialButton
          title="Continue with Google"
          icon="logo-google"
          onPress={() => handleSocialSignup('Google')}
        />
        <SocialButton
          title="Continue with Apple"
          icon="logo-apple"
          onPress={() => handleSocialSignup('Apple')}
        />
        <SocialButton
          title="Continue with Facebook"
          icon="logo-facebook" // Assumes Ionicons
          onPress={() => handleSocialSignup('Facebook')}
        />
        <SocialButton
          title="Continue with Instagram"
          icon="logo-instagram" // Assumes Ionicons
          onPress={() => handleSocialSignup('Instagram')}
        />
        <SocialButton
          title="Continue with WhatsApp"
          icon="logo-whatsapp" // Assumes Ionicons
          onPress={() => handleSocialSignup('WhatsApp')}
        />

        <View style={styles.dividerContainer}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.dividerLine} />
        </View>

        <LabeledInput
          label="Email Address"
          placeholder="Enter your email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <LabeledInput
          label="Username"
          placeholder="Choose a username"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />
        
        <LabeledInput
          label="Password"
          placeholder="8+ chars, 1 uppercase, 1 number, 1 special"
          value={password}
          onChangeText={setPassword}
          isPassword
        />
        <LabeledInput
          label="Confirm Password"
          placeholder="Confirm your password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          isPassword
        />

        <PrimaryButton title="Sign Up" onPress={handleSignup} />
        
        <View style={styles.loginLinkContainer}>
          <Text style={styles.loginText}>Already have an account? </Text>
          <Link href="/(auth)/LoginPage">
            <Text style={styles.loginLink}>Login here</Text>
          </Link>
        </View>
      </ScrollView>
    </AuthContainer>
  );
}