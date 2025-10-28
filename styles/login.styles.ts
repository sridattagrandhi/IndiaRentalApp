// styles/login.styles.ts
import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  forgotPassword: {
    textAlign: 'right',
    color: '#007AFF',
    marginBottom: 20,
  },
  orText: {
    textAlign: 'center',
    color: '#999',
    marginVertical: 20,
    fontSize: 16,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB', // A light grey line, like in the example
  },
  dividerText: {
    marginHorizontal: 10,
    color: '#6B7280', // Muted text color
    fontSize: 14,
    fontWeight: '500',
  },
});