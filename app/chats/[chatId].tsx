import { useTranslation } from "react-i18next";
// app/chats/[chatId].tsx
import { apiGet, apiPost } from "@/services/api";
import { wsService } from "@/services/ws";
import { format, isToday, isYesterday } from "date-fns";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { ArrowLeft, Send } from "lucide-react-native";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type Message = {
  id: string;
  sender_id: string;
  text: string;
  original_text?: string;
  created_at: string;
  type?: string;
  sender_name?: string;
  sender_avatar?: string | null;
};

type ChatHeader = {
  participant_name: string;
  participant_avatar?: string | null;
  listing_name: string;
  booking_status?: string | null;
};

function normalizeMessage(m: any): Message {
  return {
    id: String(m?.id ?? m?.message_id ?? ""),
    sender_id: String(m?.sender_id ?? m?.senderId ?? m?.sender ?? ""),
    text: String(m?.text ?? ""),
    original_text: m?.original_text ? String(m.original_text) : undefined,
    created_at: String(
      m?.created_at ?? m?.createdAt ?? new Date().toISOString(),
    ),
    type: m?.type,
    sender_name: m?.sender_name ?? m?.senderName,
    sender_avatar: m?.sender_avatar ?? m?.senderAvatar ?? null,
  };
}

function formatDayLabel(d: Date) {
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "MMM dd, yyyy");
}

function formatTime(d: Date) {
  return format(d, "h:mm a");
}

function groupMessagesByDay(messages: Message[]) {
  const map = new Map<string, Message[]>();

  for (const m of messages) {
    const dt = new Date(m.created_at);
    const label = formatDayLabel(dt);
    const arr = map.get(label) ?? [];
    arr.push(m);
    map.set(label, arr);
  }

  const sections = Array.from(map.entries())
    .map(([title, data]) => ({
      title,
      data: data.sort(
        (a, b) => +new Date(a.created_at) - +new Date(b.created_at),
      ),
    }))
    .sort((a, b) => {
      const a0 = a.data[0]?.created_at ?? 0;
      const b0 = b.data[0]?.created_at ?? 0;
      return +new Date(a0) - +new Date(b0);
    });

  return sections;
}

// Helper to check if messages should be grouped (within 2 minutes, same sender)
function shouldGroupMessages(
  current: Message,
  previous: Message | null,
  myIds: string[],
): boolean {
  if (!previous) return false;

  const currentIsMe = myIds.includes(current.sender_id);
  const previousIsMe = myIds.includes(previous.sender_id);

  if (currentIsMe !== previousIsMe) return false;

  const currentTime = new Date(current.created_at).getTime();
  const previousTime = new Date(previous.created_at).getTime();
  const timeDiff = (currentTime - previousTime) / 1000 / 60;

  return timeDiff < 2;
}

const buildQuickReplies = (t: any) => [
  {
    id: "checkin",
    label: t("host.chat.quick_replies.checkin_label"),
    text: t("host.chat.quick_replies.checkin_text"),
  },
  {
    id: "checkout",
    label: t("host.chat.quick_replies.checkout_label"),
    text: t("host.chat.quick_replies.checkout_text"),
  },
  {
    id: "directions",
    label: t("host.chat.quick_replies.directions_label"),
    text: t("host.chat.quick_replies.directions_text"),
  },
  {
    id: "parking",
    label: t("host.chat.quick_replies.parking_label"),
    text: t("host.chat.quick_replies.parking_text"),
  },
  {
    id: "wifi",
    label: t("host.chat.quick_replies.wifi_label"),
    text: t("host.chat.quick_replies.wifi_text"),
  },
];

export default function ChatScreen() {
  const { t } = useTranslation();
  const QUICK_REPLIES = useMemo(() => buildQuickReplies(t), [t]);
  const router = useRouter();
  const params = useLocalSearchParams();
  const chatId = Array.isArray(params.chatId)
    ? params.chatId[0]
    : params.chatId;

  const [header, setHeader] = useState<ChatHeader | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [myUserId, setMyUserId] = useState<string>("");
  const [myAvatar, setMyAvatar] = useState<string>("");
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  const listRef = useRef<SectionList<Message>>(null);
  const [myIds, setMyIds] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const cachedId = await SecureStore.getItemAsync("backend_user_id");
        const cachedAvatar = await SecureStore.getItemAsync("my_avatar_url");
        const idToken = (await SecureStore.getItemAsync("idToken")) || "";
        const userId = await SecureStore.getItemAsync("user_id");

        const ids: string[] = [];

        // Add all possible user IDs
        if (cachedId) {
          setMyUserId(cachedId);
          ids.push(cachedId);
        }

        if (userId) {
          ids.push(userId);
          if (!cachedId) setMyUserId(userId);
        }

        if (cachedAvatar) setMyAvatar(cachedAvatar);

        if (idToken) {
          try {
            const parts = idToken.split(".");
            if (parts.length === 3) {
              const payloadB64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
              const pad =
                payloadB64.length % 4
                  ? "=".repeat(4 - (payloadB64.length % 4))
                  : "";
              const payloadJson = atob(payloadB64 + pad);
              const payload = JSON.parse(payloadJson);

              const sub = String(payload.sub ?? "");
              const username = String(
                payload["cognito:username"] ?? payload.username ?? "",
              );
              const email = String(payload.email ?? "");

              [sub, username, email].forEach((v) => {
                if (v && !ids.includes(v)) ids.push(v);
              });
            }
          } catch {}
        }

        if (!cachedId && idToken) {
          const profile = await apiGet<{
            user_id: string;
            avatar_url?: string | null;
          }>("/v1/profile", {
            headers: { Authorization: `Bearer ${idToken}` },
          });

          if (profile?.user_id) {
            await SecureStore.setItemAsync("backend_user_id", profile.user_id);
            setMyUserId(profile.user_id);
            if (!ids.includes(profile.user_id)) ids.push(profile.user_id);
          }

          if (profile?.avatar_url) {
            await SecureStore.setItemAsync("my_avatar_url", profile.avatar_url);
            setMyAvatar(profile.avatar_url);
          }
        }

        console.log("My user IDs:", ids); // Debug log
        setMyIds(ids);
      } catch (e) {
        console.warn("Failed to resolve backend user id:", e);
      }
    })();
  }, []);

  const loadMessages = useCallback(async () => {
    if (!chatId) return;
    try {
      setLoading(true);
      const res = await apiGet<{ header: ChatHeader; results: Message[] }>(
        `/v1/chats/${chatId}/messages`,
      );
      setHeader(res.header);
      setMessages((res.results ?? []).map(normalizeMessage));
    } catch (e: any) {
      console.error("❌ Failed to load messages:", e?.response?.data || e);
      const msg =
        e?.response?.data?.detail || e?.message || "Failed to load chat";
      Alert.alert(t("common.error"), msg);
    } finally {
      setLoading(false);
    }
  }, [chatId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (!chatId) return;

    const unsubscribe = wsService.subscribe((data: any) => {
      if (
        data?.type === "chat_message" &&
        String(data?.booking_id) === String(chatId)
      ) {
        const raw = data?.message;
        const newMsg = normalizeMessage(raw);
        if (!newMsg.id) return;

        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });

        setTimeout(() => {
          scrollToBottom();
        }, 150);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [chatId]);

  const sections = useMemo(() => groupMessagesByDay(messages), [messages]);

  const scrollToBottom = () => {
    setTimeout(() => {
      if (sections.length > 0) {
        const lastSection = sections.length - 1;
        const lastItem = sections[lastSection].data.length - 1;
        listRef.current?.scrollToLocation({
          sectionIndex: lastSection,
          itemIndex: lastItem,
          animated: true,
        });
      }
    }, 150);
  };

  const sendMessage = async (textRaw: string) => {
    const text = textRaw.trim();
    if (!text || sending || !chatId) return;

    setSending(true);
    setMessageText("");

    try {
      await apiPost(`/v1/chats/${chatId}/messages`, { text });
      await loadMessages();
      scrollToBottom();
    } catch (e: any) {
      console.error("❌ Failed to send message:", e?.response?.data || e);
      const msg =
        e?.response?.data?.detail || e?.message || "Failed to send message";
      Alert.alert(t("common.error"), msg);
      setMessageText(text);
    } finally {
      setSending(false);
    }
  };

  const onPressQuickReply = (qrText: string) => {
    sendMessage(qrText);
  };

  const participantAvatar =
    header?.participant_avatar || "https://i.pravatar.cc/150?img=12";
  const bookingStatus = header?.booking_status?.trim();

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* WhatsApp Green Header */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={24} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.topBarMid}>
          <Image source={{ uri: participantAvatar }} style={styles.topAvatar} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={styles.nameRow}>
              <Text style={styles.topName} numberOfLines={1}>
                {header?.participant_name ?? "Chat"}
              </Text>
              {!!bookingStatus && (
                <View style={styles.statusPill}>
                  <Text style={styles.statusText} numberOfLines={1}>
                    {bookingStatus}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.topSub} numberOfLines={1}>
              {header?.listing_name ?? ""}
            </Text>
          </View>
        </View>

        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        {/* Chat Background - WhatsApp Beige */}
        <SectionList
          ref={listRef}
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <View style={styles.dayRow}>
              <View style={styles.dayPill}>
                <Text style={styles.dayLabel}>{section.title}</Text>
              </View>
            </View>
          )}
          renderItem={({ item, section, index }) => {
            // FLIPPED: Invert the isMe logic
            // Correct: "me" is whoever is logged into the app (always on the right)
            const isMe =
              myIds.length > 0
                ? myIds.includes(item.sender_id) // ✅ correct
                : !!myUserId && item.sender_id === myUserId;
            const previousMessage = index > 0 ? section.data[index - 1] : null;
            const isGrouped = shouldGroupMessages(item, previousMessage, myIds);
            const nextMessage =
              index < section.data.length - 1 ? section.data[index + 1] : null;
            const isLastInGroup =
              !nextMessage || !shouldGroupMessages(nextMessage, item, myIds);

            return (
              <MessageBubble
                message={item}
                isMe={isMe}
                isGrouped={isGrouped}
                isLastInGroup={isLastInGroup}
              />
            );
          }}
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyTitle}>
                  {t("host.inbox.no_messages_yet")}
                </Text>
                <Text style={styles.emptySub}>Start the conversation!</Text>
              </View>
            ) : null
          }
          onContentSizeChange={() => {
            if (messages.length > 0 && sections.length > 0) {
              const lastSection = sections.length - 1;
              const lastItem = sections[lastSection].data.length - 1;
              listRef.current?.scrollToLocation({
                sectionIndex: lastSection,
                itemIndex: lastItem,
                animated: false,
              });
            }
          }}
          onScrollToIndexFailed={(info) => {
            setTimeout(() => {
              try {
                listRef.current?.scrollToLocation({
                  sectionIndex: 0,
                  itemIndex: Math.max(0, info.highestMeasuredFrameIndex),
                  animated: true,
                });
              } catch {}
            }, 300);
          }}
        />

        {/* Quick Replies */}
        <View style={styles.quickWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickRow}
          >
            {QUICK_REPLIES.map((q) => (
              <TouchableOpacity
                key={q.id}
                style={styles.quickPill}
                onPress={() => onPressQuickReply(q.text)}
              >
                <Text style={styles.quickText}>{q.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Input Bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor="#8696A0"
            value={messageText}
            onChangeText={setMessageText}
            multiline
            maxLength={500}
            onFocus={() => scrollToBottom()}
          />
          <TouchableOpacity
            style={[
              styles.sendBtn,
              (!messageText.trim() || sending) && styles.sendBtnDisabled,
            ]}
            onPress={() => sendMessage(messageText)}
            disabled={!messageText.trim() || sending}
          >
            <Send
              size={20}
              color={messageText.trim() && !sending ? "#FFFFFF" : "#8696A0"}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MessageBubble({
  message,
  isMe,
  isGrouped,
  isLastInGroup,
}: {
  message: Message;
  isMe: boolean;
  isGrouped: boolean;
  isLastInGroup: boolean;
}) {
  const dt = new Date(message.created_at);

  if (message.type === "system") {
    return (
      <View style={styles.systemRow}>
        <View style={styles.systemPill}>
          <Text style={styles.systemText}>{message.text}</Text>
        </View>
      </View>
    );
  }

  // Determine border radius based on grouping (WhatsApp style)
  const bubbleStyle: any = {};
  if (isMe) {
    if (isGrouped && !isLastInGroup) {
      bubbleStyle.borderTopRightRadius = 4;
      bubbleStyle.borderBottomRightRadius = 4;
    } else if (isLastInGroup) {
      bubbleStyle.borderBottomRightRadius = 4;
    }
  } else {
    if (isGrouped && !isLastInGroup) {
      bubbleStyle.borderTopLeftRadius = 4;
      bubbleStyle.borderBottomLeftRadius = 4;
    } else if (isLastInGroup) {
      bubbleStyle.borderBottomLeftRadius = 4;
    }
  }

  return (
    <View
      style={[
        styles.messageRow,
        isMe ? styles.messageRowRight : styles.messageRowLeft,
        isGrouped && styles.messageRowGrouped,
      ]}
    >
      <View
        style={[
          styles.bubble,
          isMe ? styles.bubbleMe : styles.bubbleThem,
          bubbleStyle,
        ]}
      >
        {/* ✅ CRITICAL FIX: Always show translated text, never original_text */}
        <Text
          style={[styles.bubbleText, isMe ? styles.textMe : styles.textThem]}
        >
          {message.text}
        </Text>
        <Text style={[styles.timeInBubble, isMe && styles.timeInBubbleMe]}>
          {formatTime(dt)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#000000", // Black for status bar area
  },
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF", // White background
  },

  // Header - Black
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: "#000000", // Black header
  },
  backBtn: {
    padding: 8,
  },
  topBarMid: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  topAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E5E7EB",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  topName: {
    fontSize: 17,
    fontWeight: "600",
    color: "#FFFFFF", // White text
    maxWidth: "70%",
  },
  topSub: {
    marginTop: 2,
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.8)", // Semi-transparent white
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
  },
  statusText: {
    fontSize: 11,
    color: "#FFFFFF",
    fontWeight: "600",
  },

  // Message List
  listContent: {
    padding: 8,
    paddingBottom: 8,
  },

  // Day Separator
  dayRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 12,
  },
  dayPill: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  dayLabel: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
  },

  // Message Rows - NO AVATARS
  messageRow: {
    flexDirection: "row",
    marginBottom: 6,
    paddingHorizontal: 6,
  },
  messageRowGrouped: {
    marginBottom: 2, // Tighter spacing for grouped messages
  },
  messageRowLeft: {
    justifyContent: "flex-start", // Other person's messages on left
  },
  messageRowRight: {
    justifyContent: "flex-end", // Your messages on right
  },

  // Message Bubbles
  bubble: {
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 4,
    borderRadius: 8,
    maxWidth: "75%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 0.5 },
    shadowOpacity: 0.08,
    shadowRadius: 1.5,
    elevation: 1,
    minWidth: 50,
  },
  bubbleMe: {
    backgroundColor: "#000000", // Black for sent messages
  },
  bubbleThem: {
    backgroundColor: "#F3F4F6", // Light gray for received messages
  },

  bubbleText: {
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 2,
  },
  textMe: {
    color: "#FFFFFF", // White text for your messages
  },
  textThem: {
    color: "#000000", // Black text for their messages
  },

  // Time inside bubble (bottom right)
  timeInBubble: {
    fontSize: 10,
    color: "#9CA3AF",
    alignSelf: "flex-end",
    marginTop: 2,
  },
  timeInBubbleMe: {
    color: "#D1D5DB", // Lighter gray for time in black bubbles
  },

  // System Messages
  systemRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginVertical: 8,
    paddingHorizontal: 20,
  },
  systemPill: {
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: "85%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 0.5 },
    shadowOpacity: 0.08,
    shadowRadius: 1.5,
    elevation: 1,
  },
  systemText: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
  },

  // Empty State
  emptyWrap: {
    alignItems: "center",
    paddingTop: 70,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#667781",
  },
  emptySub: {
    marginTop: 6,
    fontSize: 13,
    color: "#8696A0",
  },

  // Quick Replies
  quickWrap: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  quickRow: {
    paddingHorizontal: 8,
    gap: 8,
  },
  quickPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D7DB",
  },
  quickText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#000000", // Black text
  },

  // Input Bar
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 8,
    backgroundColor: "#F9FAFB",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  input: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 110,
    marginRight: 8,
    color: "#000000",
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#000000", // Black send button
    justifyContent: "center",
    alignItems: "center",
  },
  sendBtnDisabled: {
    backgroundColor: "#E5E7EB",
  },
});
