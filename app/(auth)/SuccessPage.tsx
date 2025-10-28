// app/(auth)/SuccessPage.tsx
import AuthContainer from '@/components/ui/authContainer';
import PrimaryButton from '@/components/ui/primaryButton';
import { styles } from '@/styles/success.styles';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

export default function SuccessPage() {

  const goToApp = () => {
    // Use 'replace' to clear the auth flow from the navigation stack
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
          
          <Text style={styles.title}>Verification Successful!</Text>
          <Text style={styles.subtitle}>
            Your account has been created and verified successfully.
          </Text>

          <View style={styles.buttonWrapper}>
            <PrimaryButton title="Get Started" onPress={goToApp} />
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