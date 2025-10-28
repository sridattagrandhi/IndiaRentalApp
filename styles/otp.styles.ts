// styles/otp.styles.ts
import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  // New "Back" button styles
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 16,
    color: '#000',
    marginLeft: 8,
    fontWeight: '500',
  },
  
  // Icon, Title, Subtitle
  iconContainer: {
    alignSelf: 'center',
    backgroundColor: 'black',
    borderRadius: 50,
    padding: 20,
    marginBottom: 24,
    marginTop: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#000',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 4,
  },
  valueText: {
    fontSize: 16,
    color: 'black',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 32,
  },

  // OTP Input boxes
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 16,
  },
  otpInput: {
    width: 48,
    height: 56,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: 'bold',
    backgroundColor: '#f9f9f9',
  },
  
  // Helper & Resend
  helperText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
  },
  resendPrompt: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 24,
  },
  resendLink: {
    fontSize: 16,
    color: '#007AFF', // Standard link color
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 8,
  },

  // Footer Info Box
  footerInfoBox: {
    backgroundColor: '#f4f4f4',
    borderRadius: 10,
    padding: 16,
    marginTop: 'auto', // Pushes this to the bottom
  },
  footerText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});