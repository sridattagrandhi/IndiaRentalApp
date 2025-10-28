// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import {
  Briefcase,
  Heart,
  Home,
  MessageCircle,
  User,
} from 'lucide-react-native';
import React from 'react';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#111827' }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Home color={color} />,
          headerShown: false,
        }}
      />
      {/* Explore tab removed */}
      <Tabs.Screen
        name="wishlist"
        options={{
          title: 'Wishlist',
          tabBarIcon: ({ color }) => <Heart color={color} />,
          // Keep default header (or set headerShown: false if needed on wishlist main page)
          // headerShown: false,
        }}
      />
      <Tabs.Screen
        name="mytrips"
        options={{
          title: 'My Trips',
          tabBarIcon: ({ color }) => <Briefcase color={color} />,
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: 'Inbox',
          tabBarIcon: ({ color }) => <MessageCircle color={color} />,
          headerShown: false, // Inbox has its own custom header
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <User color={color} />,
          // Add this line to hide the default tab header when navigating *away*
          headerShown: false,
        }}
      />
    </Tabs>
  );
}