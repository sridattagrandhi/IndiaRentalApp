// app/(host)/listings/_layout.tsx
import { Stack } from 'expo-router';

export default function ListingsStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* index.tsx is the tab's landing screen */}
      <Stack.Screen name="index" />
      {/* nested screens under listings/ */}
      <Stack.Screen name="create-listing" />
    </Stack>
  );
}
