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
// --- Make sure 'View' is imported ---
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';

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

        {/* --- REPLACED 'orText' WITH THE NEW DIVIDER --- */}
        <View style={styles.dividerContainer}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.dividerLine} />
        </View>
        {/* ----------------------------------------------- */}

        <SecondaryButton title="Create Account" onPress={handleCreateAccount} />
      </ScrollView>
    </AuthContainer>
  );
}