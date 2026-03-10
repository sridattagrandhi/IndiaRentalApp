// app/(tabs)/inbox.tsx
import { apiDelete, apiGet } from "@/services/api";
import { useFocusEffect } from "@react-navigation/native";
import { format, isToday, isYesterday } from "date-fns";
import { Link, Stack } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { MessageCircle, Search, Trash2 } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  FlatList,
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";

interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: Date;
  read: boolean;
}

interface Conversation {
  id: string;
  participantName: string;
  participantAvatar?: string;
  participantRole: "host" | "guest";
  listingName: string;
  lastMessage: Message;
  unreadCount: number;
  bookingStatus?: "upcoming" | "completed" | "enquiry";
}

type InboxChatDTO = {
  chat_id: string;
  participant_name: string;
  participant_avatar?: string | null;
  participant_role: "host" | "guest";
  listing_name: string;
  unread_count: number;
  booking_status?: "upcoming" | "completed" | "enquiry";
  last_message: {
    id: string;
    sender_id: string;
    text: string;
    created_at: string;
    read?: boolean;
  } | null;
};

const formatMessageTime = (date: Date) => {
  if (isToday(date)) return format(date, "h:mm a");
  if (isYesterday(date)) return "Yesterday";
  return format(date, "MMM dd");
};

function mapDtoToConversation(dto: InboxChatDTO): Conversation {
  const lmAny: any = (dto as any).last_message;
  const lm = lmAny
    ? {
        id: lmAny.id ?? lmAny.message_id ?? "last",
        sender_id: lmAny.sender_id ?? lmAny.senderId,
        text: lmAny.text ?? "",
        created_at: lmAny.created_at ?? lmAny.createdAt,
        read: lmAny.read,
      }
    : null;

  const fallbackDate = new Date();

  return {
    id: dto.chat_id,
    participantName: dto.participant_name,
    participantAvatar: dto.participant_avatar ?? undefined,
    participantRole: dto.participant_role,
    listingName: dto.listing_name,
    unreadCount: dto.unread_count ?? 0,
    bookingStatus: dto.booking_status,
    lastMessage: {
      id: lm?.id ?? "last",
      senderId: lm?.sender_id ?? "system",
      text: lm?.text ?? "No messages yet",
      timestamp: lm?.created_at ? new Date(lm.created_at) : fallbackDate,
      read: lm?.read ?? dto.unread_count === 0,
    },
  };
}

function ConversationItem({
  conversation,
  myUserId,
}: {
  conversation: Conversation;
  myUserId: string;
}) {
  const isUnread = conversation.unreadCount > 0;

  return (
    <Link href={`/chats/${conversation.id}`} asChild>
      <TouchableOpacity style={styles.itemContainer}>
        <View style={styles.avatarContainer}>
          <Image
            source={{
              uri:
                conversation.participantAvatar ||
                "https://i.pravatar.cc/150?img=12",
            }}
            style={styles.avatar}
          />
        </View>

        <View style={styles.textContainer}>
          <View style={styles.itemHeader}>
            <Text
              style={[
                styles.participantName,
                isUnread ? styles.fontBold : styles.fontNormal,
              ]}
            >
              {conversation.participantName}
            </Text>
            <Text style={styles.messageTime}>
              {formatMessageTime(conversation.lastMessage.timestamp)}
            </Text>
          </View>

          <Text style={styles.listingName} numberOfLines={1}>
            {conversation.listingName}
          </Text>

          <View style={styles.messageRow}>
            <Text
              style={[
                styles.lastMessage,
                isUnread ? styles.fontBold : styles.fontNormal,
              ]}
              numberOfLines={1}
            >
              {myUserId &&
                conversation.lastMessage.senderId === myUserId &&
                "You: "}
              {conversation.lastMessage.text}
            </Text>

            {conversation.unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>
                  {conversation.unreadCount}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Link>
  );
}

export default function InboxScreen() {
  const { t, i18n } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "unread">("all");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [myUserId, setMyUserId] = useState<string>("");

  React.useEffect(() => {
    (async () => {
      try {
        const uid = await SecureStore.getItemAsync("backend_user_id");
        if (uid) setMyUserId(uid);
      } catch (e) {
        console.warn("Failed to load user_id for inbox:", e);
      }
    })();
  }, []);

  const loadChats = useCallback(async () => {
    try {
      setLoading(true);

      const res = await apiGet<any>("/v1/chats");

      const rows: InboxChatDTO[] = Array.isArray(res)
        ? res
        : (res?.results ?? res?.chats ?? res?.items ?? []);

      // NOTE: keep your filtering logic as you need (guest vs host inbox view)
      const guestChats = rows.filter(
        (chat) => chat.participant_role === "guest",
      );

      const mapped = guestChats.map(mapDtoToConversation);
      setConversations(mapped);
    } catch (e: any) {
      console.error("Failed to load chats:", e?.response?.data || e);
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteChat = useCallback(
    async (chatId: string) => {
      // Optimistic remove (snappy UX)
      setConversations((prev) => prev.filter((c) => c.id !== chatId));

      try {
        // Backend should implement: DELETE /v1/chats/{chatId}
        await apiDelete(`/v1/chats/${chatId}`);
      } catch (e: any) {
        console.error("Failed to delete chat:", e?.response?.data || e);
        Alert.alert(
          "Delete failed",
          e?.response?.data?.detail || e?.message || "Could not delete chat",
        );
        // Restore a consistent state
        loadChats();
      }
    },
    [loadChats],
  );

  useFocusEffect(
    useCallback(() => {
      loadChats();
    }, [loadChats]),
  );

  useEffect(() => {
    const handleLanguageChange = () => {
      console.log("🌐 Language changed, reloading inbox...");
      loadChats();
    };

    i18n.on("languageChanged", handleLanguageChange);

    return () => {
      i18n.off("languageChanged", handleLanguageChange);
    };
  }, [loadChats, i18n]);

  const filteredConversations = useMemo(() => {
    return conversations.filter((conv) => {
      const matchesSearch =
        conv.participantName
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        conv.listingName.toLowerCase().includes(searchQuery.toLowerCase());

      if (activeTab === "all") return matchesSearch;
      if (activeTab === "unread") return matchesSearch && conv.unreadCount > 0;
      return matchesSearch;
    });
  }, [conversations, searchQuery, activeTab]);

  const totalUnread = useMemo(
    () => conversations.reduce((sum, conv) => sum + conv.unreadCount, 0),
    [conversations],
  );

  const renderTab = (tabName: "all" | "unread", label: string) => (
    <TouchableOpacity
      style={[styles.tab, activeTab === tabName ? styles.activeTab : null]}
      onPress={() => setActiveTab(tabName)}
    >
      <Text
        style={[
          styles.tabText,
          activeTab === tabName ? styles.activeTabText : null,
        ]}
      >
        {label}
      </Text>
      {tabName === "unread" && totalUnread > 0 && (
        <View style={styles.tabBadge}>
          <Text style={styles.tabBadgeText}>{totalUnread}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t("tabs.inbox")}</Text>
        </View>

        <View style={styles.searchContainer}>
          <Search size={18} color="#6B7280" style={styles.searchIcon} />
          <TextInput
            placeholder={t("host.inbox.search_messages")}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
          />
        </View>

        <View style={styles.tabsContainer}>
          {renderTab("all", t("host.inbox.all"))}
          {renderTab("unread", t("host.inbox.unread"))}
        </View>

        <FlatList
          data={filteredConversations}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const onPressDelete = () => {
              Alert.alert(
                "Delete chat?",
                "This will remove the conversation from your inbox.",
                [
                  { text: t("common.cancel"), style: "cancel" },
                  {
                    text: t("common.delete"),
                    style: "destructive",
                    onPress: () => deleteChat(item.id),
                  },
                ],
              );
            };

            const renderRightActions = () => (
              <TouchableOpacity
                style={styles.deleteAction}
                onPress={onPressDelete}
              >
                <Trash2 size={20} color="#FFFFFF" />
              </TouchableOpacity>
            );

            return (
              <Swipeable
                renderRightActions={renderRightActions}
                overshootRight={false}
              >
                <ConversationItem conversation={item} myUserId={myUserId} />
              </Swipeable>
            );
          }}
          refreshing={loading}
          onRefresh={loadChats}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MessageCircle size={64} color="#9CA3AF" />
              <Text style={styles.emptyTitle}>
                {t("host.inbox.no_messages_yet")}
              </Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery
                  ? t("host.inbox.no_results_found")
                  : t("host.inbox.your_messages_will_appear_here")}
              </Text>
            </View>
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#FFFFFF" },
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    alignItems: "center",
  },
  headerTitle: { fontSize: 24, fontWeight: "bold" },

  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    marginHorizontal: 16,
    paddingHorizontal: 12,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, height: 44, fontSize: 16 },

  tabsContainer: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 12,
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 10,
  },
  activeTab: { backgroundColor: "#FFFFFF" },
  tabText: { fontSize: 14, color: "#6B7280" },
  activeTabText: { color: "#111827", fontWeight: "600" },

  tabBadge: {
    marginLeft: 6,
    backgroundColor: "#EF4444",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  tabBadgeText: { color: "#FFFFFF", fontSize: 12, fontWeight: "600" },

  deleteAction: {
    width: 78,
    backgroundColor: "#EF4444",
    justifyContent: "center",
    alignItems: "center",
  },

  itemContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  avatarContainer: { marginRight: 12 },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#E5E7EB",
  },

  textContainer: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    paddingBottom: 10,
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  participantName: { fontSize: 16, color: "#111827", flex: 1, marginRight: 8 },
  messageTime: { fontSize: 12, color: "#6B7280" },

  listingName: { marginTop: 2, fontSize: 13, color: "#6B7280" },

  messageRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  lastMessage: { flex: 1, marginRight: 10, color: "#111827" },

  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  unreadText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },

  fontBold: { fontWeight: "700" },
  fontNormal: { fontWeight: "400" },

  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  emptySubtitle: { marginTop: 6, fontSize: 14, color: "#6B7280" },
});
