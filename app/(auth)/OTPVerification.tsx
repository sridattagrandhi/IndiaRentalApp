// app/(auth)/OTPVerification.tsx
import AuthContainer from '@/components/ui/authContainer';
// Removed AuthHeader, we are building it inline
import PrimaryButton from '@/components/ui/primaryButton';
import { styles } from '@/styles/otp.styles';
import { MaterialIcons } from '@expo/vector-icons'; // Added Ionicons
import { router, useLocalSearchParams } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';

const OTP_LENGTH = 6; // Updated to 6 digits

const maskPhone = (raw?: string) => {
  if (!raw) return '';
  const hasPlus = raw.trim().startsWith('+');
  const digits = raw.replace(/\D/g, '');           // keep only digits
  if (digits.length <= 4) return (hasPlus ? '+' : '') + digits;
  const last4 = digits.slice(-4);
  const maskedCore = 'X'.repeat(digits.length - 4) + last4; // e.g., 13 → 9 Xs + last4
  return (hasPlus ? '+' : '') + maskedCore;
};


export default function OTPVerification() {
  const [otp, setOtp] = useState<string[]>(new Array(OTP_LENGTH).fill(''));
  const inputs = useRef<(TextInput | null)[]>([]);
  
  const { type, value } = useLocalSearchParams<{ type: string; value: string }>();

  // Smart text logic
  const title = type === 'email' ? 'Verify Email Address' : 'Verify Phone Number';
  const subtitle = `We've sent a ${OTP_LENGTH}-digit OTP to`;
  
  // Mask the email or phone number
  const maskedValue = type === 'email'
  ? value?.replace(/^(..)(.*?)(@.*)$/, '$1***$3')   // ex***@gmail.com
  : maskPhone(value);


  const handleOtpChange = (text: string, index: number) => {
    if (text.length > 1) text = text.charAt(text.length - 1);
    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);
    
    if (text && index < OTP_LENGTH - 1) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleBackspace = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handleVerify = () => {
    const fullOtp = otp.join('');
    if (fullOtp.length !== OTP_LENGTH) {
      Alert.alert('Error', `Please enter the complete ${OTP_LENGTH}-digit code`);
      return;
    }
    
    console.log(`Verifying OTP for ${type}:`, fullOtp);
    
    if (type === 'email') {
      router.push('/(auth)/PersonalDetails');
    } else {
      router.push('/(auth)/SuccessPage');
    }
  };
  
  const handleResend = () => {
    Alert.alert('Code Resent', `A new code has been sent to ${value}`);
  };

  return (
    <AuthContainer>
      {/* In-page Back Button */}
      
      {/* Icon */}
      <View style={styles.iconContainer}>
        <MaterialIcons name="security" size={32} color="white" />
      </View>
      
      {/* Header Text */}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      <Text style={styles.valueText}>{maskedValue}</Text>

      {/* OTP Inputs */}
      <View style={styles.otpContainer}>
        {otp.map((_, index) => (
          <TextInput
            key={index}
            ref={(el) => { inputs.current[index] = el }}
            style={styles.otpInput}
            keyboardType="number-pad"
            maxLength={1}
            onChangeText={(text) => handleOtpChange(text, index)}
            onKeyPress={(e) => handleBackspace(e, index)}
            value={otp[index]}
          />
        ))}
      </View>

      <Text style={styles.helperText}>
        Enter the {OTP_LENGTH}-digit code sent to your {type}
      </Text>

      {/* Button */}
      <PrimaryButton title="Verify & Continue" onPress={handleVerify} />

      {/* Resend Links */}
      <Text style={styles.resendPrompt}>Didn't receive the code?</Text>
      <TouchableOpacity onPress={handleResend}>
        <Text style={styles.resendLink}>Resend OTP</Text>
      </TouchableOpacity>

      {/* Footer Info Box */}
      <View style={styles.footerInfoBox}>
        <Text style={styles.footerText}>
          This OTP is valid for 10 minutes. Please do not share this code with anyone.
        </Text>
      </View>
    </AuthContainer>
  );
}