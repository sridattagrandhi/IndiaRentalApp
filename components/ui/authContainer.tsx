// components/ui/AuthContainer.tsx
import React from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
// --- FIXED: Import from the correct library ---
import { SafeAreaView } from 'react-native-safe-area-context';

type AuthContainerProps = {
  children: React.ReactNode;
};

// The rest of the component remains the same
export default function AuthContainer({ children }: AuthContainerProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
        <View style={styles.content}>{children}</View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'white',
  },
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 24,
  },
});