// app/(auth)/_layout.tsx
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: 'white',
        },
        headerTintColor: 'black', 
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        headerShadowVisible: false,
        
        // --- ADD THIS LINE ---
        // This sets the text next to the back arrow to "Back"
        headerBackTitle: 'Back', 
        // ---------------------
      }}
    >
      <Stack.Screen name="LanguageSelection" options={{ headerShown: false }} />
      <Stack.Screen name="LoginPage" options={{ headerShown: false }} />
      <Stack.Screen name="SignupPage" options={{ headerShown: false }} />
      <Stack.Screen name="OTPVerification" options={{ title: 'Verification' }} />
      <Stack.Screen name="PersonalDetails" options={{ title: 'Personal Details' }} />
      <Stack.Screen name="SuccessPage" options={{ headerShown: false }} />
    </Stack>
  );
}