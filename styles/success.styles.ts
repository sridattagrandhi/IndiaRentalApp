// styles/success.styles.ts
import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  // Container to space out elements vertically
  container: {
    flex: 1,
    justifyContent: 'center', // Center content vertically
    alignItems: 'center', // Center content horizontally
  },
  
  // Main content area
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  icon: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  buttonWrapper: {
    width: '100%',
  },

  // Welcome box at the bottom
  welcomeBox: {
    width: '100%',
    backgroundColor: '#f4f4f4',
    borderRadius: 10,
    padding: 20,
    marginTop: 'auto', // Pushes this to the bottom
    marginBottom: 16,
  },
  welcomeTitle: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  welcomeText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});