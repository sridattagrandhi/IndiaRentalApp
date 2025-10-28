// styles/language.styles.ts
import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  grid: {
    width: '100%',
  },
  langButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#f4f4f4',
    borderRadius: 10,
    margin: 8,
    minHeight: 100,
  },
  langName: {
    fontSize: 18,
    fontWeight: '600',
  },
  langEnglishName: {
    fontSize: 14,
    color: '#555',
    marginTop: 4,
  },
});