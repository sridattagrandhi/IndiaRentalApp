// components/ui/AuthHeader.tsx
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type AuthHeaderProps = {
  icon: React.ReactNode; // Pass in the icon component
  title: string;
  subtitle: string;
};

export default function AuthHeader({ icon, title, subtitle }: AuthHeaderProps) {
  return (
    <>
      <View style={styles.iconContainer}>{icon}</View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    alignSelf: 'center',
    backgroundColor: 'black',
    borderRadius: 50,
    padding: 20,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
});