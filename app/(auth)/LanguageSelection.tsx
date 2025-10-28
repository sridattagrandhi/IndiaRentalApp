// app/(auth)/LanguageSelection.tsx
import AuthContainer from '@/components/ui/authContainer';
import AuthHeader from '@/components/ui/authHeader';
import { styles } from '@/styles/language.styles';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { FlatList, Text, TouchableOpacity } from 'react-native';

// Added all 22 scheduled Indian languages + English
const languages = [
  { code: 'as', name: 'অসমীয়া', englishName: 'Assamese' },
  { code: 'bn', name: 'বাংলা', englishName: 'Bengali' },
  { code: 'brx', name: 'बोड़ो', englishName: 'Bodo' },
  { code: 'doi', name: 'डोगरी', englishName: 'Dogri' },
  { code: 'en', name: 'English', englishName: 'English' },
  { code: 'gu', name: 'ગુજરાતી', englishName: 'Gujarati' },
  { code: 'hi', name: 'हिन्दी', englishName: 'Hindi' },
  { code: 'kn', name: 'ಕನ್ನಡ', englishName: 'Kannada' },
  { code: 'ks', name: 'کٲشُر', englishName: 'Kashmiri' },
  { code: 'kok', name: 'कोंकणी', englishName: 'Konkani' },
  { code: 'mai', name: 'मैथिली', englishName: 'Maithili' },
  { code: 'ml', name: 'മലയാളം', englishName: 'Malayalam' },
  { code: 'mni', name: 'মৈতৈলোন্', englishName: 'Manipuri' },
  { code: 'mr', name: 'मराठी', englishName: 'Marathi' },
  { code: 'ne', name: 'नेपाली', englishName: 'Nepali' },
  { code: 'or', name: 'ଓଡ଼ିଆ', englishName: 'Odia' },
  { code: 'pa', name: 'ਪੰਜਾਬੀ', englishName: 'Punjabi' },
  { code: 'sa', name: 'संस्कृतम्', englishName: 'Sanskrit' },
  { code: 'sat', name: 'ᱥᱟᱱᱛᱟᱲᱤ', englishName: 'Santali' },
  { code: 'sd', name: 'सिंधी', englishName: 'Sindhi' },
  { code: 'ta', name: 'தமிழ்', englishName: 'Tamil' },
  { code: 'te', name: 'తెలుగు', englishName: 'Telugu' },
  { code: 'ur', name: 'اردو', englishName: 'Urdu' },
];

export default function LanguageSelection() {
  const selectLanguage = (langCode: string) => {
    console.log('Selected language:', langCode);
    
    // --- THIS IS THE FIX ---
    // Ensure the path correctly points to 'LoginPage'
    router.push('/(auth)/LoginPage');
    // -----------------------
  };

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
          <TouchableOpacity 
            style={styles.langButton} 
            onPress={() => selectLanguage(item.code)}
          >
            <Text style={styles.langName}>{item.name}</Text>
            <Text style={styles.langEnglishName}>{item.englishName}</Text>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.grid}
      />
    </AuthContainer>
  );
}