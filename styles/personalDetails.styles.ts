// styles/personalDetails.styles.ts
import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 4, // inputs already have 16 bottom; keep tight rows
  },
  halfWidth: { flex: 1, minWidth: '48%' },
  thirdWidth: { flex: 1, minWidth: '31%' },
  fullWidth: { width: '100%', marginBottom: 0 },
});
