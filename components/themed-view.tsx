// components/ThemedView.tsx
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { View, type ViewProps } from 'react-native';

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
};

export function ThemedView({
  style,
  lightColor,
  darkColor,
  ...otherProps
}: ThemedViewProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const backgroundColor = colorScheme === 'light' ? lightColor : darkColor;

  return (
    <View
      style={[
        { backgroundColor: backgroundColor ?? Colors[colorScheme].background },
        style,
      ]}
      {...otherProps}
    />
  );
}