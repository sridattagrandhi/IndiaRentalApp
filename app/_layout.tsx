// app/_layout.tsx
import { useColorScheme } from '@/hooks/use-color-scheme';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context'; // ← NEW
import { ListingsProvider, useListings } from './context/ListingsContext';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

function LiveDemoMigration() {
  const { listings, replaceAll } = useListings();

  React.useEffect(() => {
    if (!listings.length) return;
    const patched = listings.map(l =>
      (l.status === 'draft' || l.status === 'review') ? { ...l, status: 'live' as const } : l
    );
    // only write if something changed
    const changed = patched.some((l, i) => l.status !== listings[i].status);
    if (changed) replaceAll(patched);
  }, [listings]);

  return null; // renders nothing
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <ListingsProvider>
            <LiveDemoMigration />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="(host)" options={{ headerShown: false }} />
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              {/* Individual Screens (like Modals) */}
              <Stack.Screen
                name="modal"
                options={{
                  presentation: 'modal',
                  title: 'Modal',
                  headerShown: true,
                }}
              />
            </Stack>

            {/* Keep status bar styling consistent with theme */}
            <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
          </ListingsProvider>
        </ThemeProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
