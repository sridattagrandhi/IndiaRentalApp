// app/settings/_layout.tsx
import { Stack } from 'expo-router';
import React from 'react';

export default function SettingsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false, // Hide all headers in settings stack
      }}
    >
      <Stack.Screen 
        name="edit-profile" 
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="login-security" 
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="language-region" 
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="payments" 
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="notifications" 
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="privacy-safety" 
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="help-center" 
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="host-onboarding" 
        options={{ headerShown: false }}
      />
    </Stack>
  );
}