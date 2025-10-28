// app/(host)/_layout.tsx
import { Tabs } from 'expo-router';
import { Calendar, DollarSign, FileText, Home, List, MessageCircle, User } from 'lucide-react-native';
import React from 'react';
import { Platform, Text, View } from 'react-native';

// ✅ No stray text nodes, everything inside <Text> where needed
const TabBadge = ({ count }: { count?: number }) => {
  if (!count) return null;
  return (
    <View
      style={{
        position: 'absolute',
        top: Platform.OS === 'ios' ? -2 : 2,
        right: Platform.OS === 'ios' ? -5 : 5,
        backgroundColor: 'red',
        borderRadius: 8,
        width: 16,
        height: 16,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}>
        {count > 9 ? '9+' : String(count)}
      </Text>
    </View>
  );
};

export default function HostTabLayout() {
  const unreadMessages = 5;
  const pendingRequests = 3;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#111827',
        tabBarInactiveTintColor: '#6B7280',
        tabBarLabelStyle: { fontSize: 10, fontWeight: '500', marginTop: -5 },
        tabBarStyle: { height: Platform.OS === 'ios' ? 85 : 60 },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, focused }) => <Home size={focused ? 24 : 22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="listings"
        options={{
          title: 'Listings',
          tabBarIcon: ({ color, focused }) => <List size={focused ? 24 : 22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          tabBarIcon: ({ color, focused }) => <Calendar size={focused ? 24 : 22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: 'Bookings',
          tabBarIcon: ({ color, focused }) => (
            <View>
              <FileText size={focused ? 24 : 22} color={color} />
              <TabBadge count={pendingRequests} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          title: 'Earnings',
          tabBarIcon: ({ color, focused }) => <DollarSign size={focused ? 24 : 22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: 'Inbox',
          tabBarIcon: ({ color, focused }) => (
            <View>
              <MessageCircle size={focused ? 24 : 22} color={color} />
              <TabBadge count={unreadMessages} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => <User size={focused ? 24 : 22} color={color} />,
        }}
      />
    </Tabs>
  );
}
