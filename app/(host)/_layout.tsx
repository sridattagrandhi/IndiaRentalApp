// app/(host)/_layout.tsx
import { apiGet } from "@/services/api"; // ✅ ADD
import { Tabs } from "expo-router";
import * as SecureStore from "expo-secure-store"; // ✅ ADD
import {
  Calendar,
  DollarSign,
  FileText,
  Home,
  List,
  MessageCircle,
  User,
} from "lucide-react-native";
import React, { useEffect } from "react"; // ✅ useEffect
import { useTranslation } from "react-i18next"; // ✅ ADD
import { Platform, Text, View } from "react-native";
import i18n from "../../i18n";

const TabBadge = ({ count }: { count?: number }) => {
  if (!count) return null;
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: Platform.OS === "ios" ? -2 : 2,
        right: Platform.OS === "ios" ? -5 : 5,
        backgroundColor: "red",
        borderRadius: 8,
        width: 16,
        height: 16,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Text style={{ color: "white", fontSize: 10, fontWeight: "bold" }}>
        {count > 9 ? "9+" : String(count)}
      </Text>
    </View>
  );
};

export default function HostTabLayout() {
  const { t } = useTranslation(); // ✅ ADD

  // TODO: replace with real counts from API
  const unreadMessages = 5;
  const pendingRequests = 3;

  // ✅ Same “hydrate language from profile” flow as (tabs)/_layout.tsx
  useEffect(() => {
    (async () => {
      try {
        const p = await apiGet("/v1/profile");
        const lang = String(p?.preferred_language || "en")
          .toLowerCase()
          .split("-")[0];

        await SecureStore.setItemAsync("preferred_language", lang);
        await i18n.changeLanguage(lang);

        // Optional: clear temp auth language
        await SecureStore.deleteItemAsync("auth_language");
      } catch (e: any) {
        console.log(
          "[host profile hydrate failed]",
          e?.response?.status,
          e?.response?.data || e?.message || e,
        );
      }
    })();
  }, []);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#111827",
        tabBarInactiveTintColor: "#6B7280",
        tabBarLabelStyle: { fontSize: 10, fontWeight: "500", marginTop: -5 },
        tabBarItemStyle: { paddingVertical: 6 },
        // 👇 keep the bar visually on top of any absolute footer
        tabBarStyle: {
          height: Platform.OS === "ios" ? 85 : 60,
          zIndex: 100,
          elevation: 24, // Android
          position: "relative",
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: t("host.layout.dashboard"),
          tabBarLabel: t("host.layout.dashboard"),
          tabBarIcon: ({ color, focused }) => (
            <Home size={focused ? 24 : 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="listings"
        options={{
          title: t("host.layout.listings"),
          tabBarLabel: t("host.layout.listings"),
          tabBarIcon: ({ color, focused }) => (
            <List size={focused ? 24 : 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: t("host.layout.calendar"),
          tabBarLabel: t("host.layout.calendar"),
          tabBarIcon: ({ color, focused }) => (
            <Calendar size={focused ? 24 : 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: t("host.layout.bookings"),
          tabBarLabel: t("host.layout.bookings"),
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
          title: t("host.layout.earnings"),
          tabBarLabel: t("host.layout.earnings"),
          tabBarIcon: ({ color, focused }) => (
            <DollarSign size={focused ? 24 : 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: t("host.inbox.inbox"),
          tabBarLabel: t("host.inbox.inbox"),
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
          title: t("host.layout.profile"),
          tabBarLabel: t("host.layout.profile"),
          tabBarIcon: ({ color, focused }) => (
            <User size={focused ? 24 : 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="all-reviews"
        options={{
          href: null, // ✅ removes it from the tab bar
        }}
      />
    </Tabs>
  );
}
