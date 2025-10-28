// components/ui/LabeledInput.tsx
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, TouchableOpacity, View } from 'react-native';

interface LabeledInputProps extends TextInputProps {
  label: string;
  isPassword?: boolean;
}

export default function LabeledInput({ label, isPassword = false, ...props }: LabeledInputProps) {
  const [isSecure, setIsSecure] = useState(isPassword);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholderTextColor="#999"
          secureTextEntry={isSecure}
          textContentType={isPassword ? 'oneTimeCode' : 'none'}
          
          // --- FIXED: Changed 'on' to 'undefined' ---
          autoComplete={isPassword ? 'off' : undefined}
          // ------------------------------------------

          {...props}
        />
        {isPassword && (
          <TouchableOpacity onPress={() => setIsSecure(!isSecure)} style={styles.icon}>
            <Ionicons name={isSecure ? 'eye-off-outline' : 'eye-outline'} size={24} color="#666" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// Styles remain the same
const styles = StyleSheet.create({
  wrapper: { marginBottom: 16 },
  label: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 8 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f4f4f4', borderRadius: 10 },
  input: { flex: 1, padding: 16, fontSize: 16 },
  icon: { padding: 12 },
});