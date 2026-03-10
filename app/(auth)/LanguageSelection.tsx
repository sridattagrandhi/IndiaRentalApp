// app/(auth)/LanguageSelection.tsx
import AuthContainer from '@/components/ui/authContainer';
import AuthHeader from '@/components/ui/authHeader';
import { styles } from '@/styles/language.styles';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, { useState } from 'react';
import { FlatList, Pressable, Text, TextStyle, ViewStyle } from 'react-native';

// Added all 22 scheduled Indian languages + English
const languages = [
  { code: 'bn', name: 'বাংলা', englishName: 'Bengali' },
  { code: 'en', name: 'English', englishName: 'English' },
  { code: 'gu', name: 'ગુજરાતી', englishName: 'Gujarati' },
  { code: 'hi', name: 'हिन्दी', englishName: 'Hindi' },
  { code: 'kn', name: 'ಕನ್ನಡ', englishName: 'Kannada' },
  { code: 'ml', name: 'മലയാളം', englishName: 'Malayalam' },
  { code: 'mr', name: 'मराठी', englishName: 'Marathi' },
  { code: 'or', name: 'ଓଡ଼ିଆ', englishName: 'Odia' },
  { code: 'pa', name: 'ਪੰਜਾਬੀ', englishName: 'Punjabi' },
  { code: 'ta', name: 'தமிழ்', englishName: 'Tamil' },
  { code: 'te', name: 'తెలుగు', englishName: 'Telugu' },
  { code: 'ur', name: 'اردو', englishName: 'Urdu' },
];


export default function LanguageSelection() {
  const [selected, setSelected] = useState<string | null>(null);

  const selectLanguage = async (langCode: string) => {
    setSelected(langCode);
    await SecureStore.setItemAsync("auth_language", langCode);
    router.push("/(auth)/LoginPage");
  };


  // Active styles (reused for hover/press/selected)
  const activeTile: ViewStyle = { backgroundColor: '#000000', borderColor: '#000000' };
  const activeText: TextStyle = { color: '#FFFFFF' };

  return (
    <AuthContainer>
      <AuthHeader
        icon={<MaterialCommunityIcons name="translate" size={50} color="white" />}
        title="Select Language"
        subtitle="भाषा चुनें | Choose your preferred language"
      />

      <FlatList
        data={languages}
        numColumns={2}
        keyExtractor={(item) => item.code}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => selectLanguage(item.code)}
            // Pressable style callback gives us `pressed`, and on web also `hovered`
            style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
              styles.langButton,
              (pressed || hovered || selected === item.code) && activeTile,
            ]}
          >
            {({ pressed, hovered }) => {
              const isActive = pressed || hovered || selected === item.code;
              return (
                <>
                  <Text style={[styles.langName, isActive && activeText]}>{item.name}</Text>
                  <Text style={[styles.langEnglishName, isActive && activeText]}>{item.englishName}</Text>
                </>
              );
            }}
          </Pressable>
        )}
        contentContainerStyle={styles.grid}
      />
    </AuthContainer>
  );
}
