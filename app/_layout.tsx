// app/_layout.tsx
import { useColorScheme } from '@/hooks/use-color-scheme';
import { wsService } from '@/services/ws';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useSegments } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-get-random-values';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import '../i18n';
import i18n from '../i18n';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const segments = useSegments(); // ✅ tells us if we are in (auth) or not

  // ✅ Language: auth uses auth_language, app uses preferred_language
  useEffect(() => {
    let mounted = true;

    const applyLanguageForScope = async () => {
      try {
        const inAuth = segments?.[0] === '(auth)';

        // Scope key (auth vs app)
        const primaryKey = inAuth ? 'auth_language' : 'preferred_language';
        const fallbackKey = inAuth ? 'preferred_language' : 'auth_language';

        let lang =
          (await SecureStore.getItemAsync(primaryKey)) ||
          (await SecureStore.getItemAsync(fallbackKey)) ||
          'en';

        lang = String(lang).toLowerCase();

        if (mounted) {
          console.log(`🌐 Applying ${inAuth ? 'AUTH' : 'APP'} language:`, lang);
          await i18n.changeLanguage(lang);
        }
      } catch (error) {
        console.error('❌ Failed to apply language for scope:', error);
      }
    };

    applyLanguageForScope();

    return () => {
      mounted = false;
    };
  }, [segments]);

  // WebSocket init stays global (it already guards on missing user_id)
  useEffect(() => {
    let mounted = true;

    const initializeWebSocket = async () => {
      try {
        const wsUrl = process.env.EXPO_PUBLIC_WS_URL;

        if (!wsUrl) {
          console.warn('⚠️ EXPO_PUBLIC_WS_URL not configured, WebSocket disabled');
          return;
        }

        const userId = await SecureStore.getItemAsync('user_id');

        if (!userId) {
          console.log('⚠️ No user_id found, skipping WebSocket connection');
          return;
        }

        if (mounted) {
          console.log('🔌 Connecting to WebSocket for user:', userId);
          wsService.connect(wsUrl, userId);
        }
      } catch (error) {
        console.error('❌ Failed to initialize WebSocket:', error);
      }
    };

    const timer = setTimeout(initializeWebSocket, 1000);

    return () => {
      mounted = false;
      clearTimeout(timer);
      wsService.disconnect();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="(host)" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />

            <Stack.Screen
              name="chats/[chatId]"
              options={{
                headerShown: false,
                presentation: 'card',
              }}
            />

            <Stack.Screen
              name="modal"
              options={{
                presentation: 'modal',
                title: 'Modal',
                headerShown: true,
              }}
            />
          </Stack>

          <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        </ThemeProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
