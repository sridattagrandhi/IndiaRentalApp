// app/index.tsx
import { Redirect } from 'expo-router';

export default function RootIndex() {
  // This immediately redirects the user from the
  // root of the app to your LanguageSelection screen.
  return <Redirect href="/(auth)/LanguageSelection" />;
}