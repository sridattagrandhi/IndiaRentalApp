// app/(tabs)/inbox.tsx
import { format, isToday, isYesterday } from 'date-fns';
import { Link, Stack } from 'expo-router';
import { MessageCircle, Search, Star } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  FlatList,
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

// --- Interfaces and Mock Data ---
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
  participantRole: 'host' | 'guest';
  listingName: string;
  lastMessage: Message;
  unreadCount: number;
  bookingStatus?: 'upcoming' | 'completed' | 'enquiry';
}

const mockConversations: Conversation[] = [
  {
    id: '1',
    participantName: 'Rajesh Kumar',
    participantAvatar: 'https://i.pravatar.cc/150?img=12',
    participantRole: 'host',
    listingName: 'Modern Studio in Koramangala',
    lastMessage: {
      id: 'm1',
      senderId: 'host1',
      text: "Check-in is at 2 PM. I'll send you the door code shortly.",
      timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 mins ago
      read: false,
    },
    unreadCount: 2,
    bookingStatus: 'upcoming',
  },
  {
    id: '2',
    participantName: "Maria D'Souza",
    participantAvatar: 'https://i.pravatar.cc/150?img=5',
    participantRole: 'host',
    listingName: 'Beachfront Villa in Goa',
    lastMessage: {
      id: 'm2',
      senderId: 'user',
      text: 'Thank you! Looking forward to the stay.',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
      read: true,
    },
    unreadCount: 0,
    bookingStatus: 'upcoming',
  },
  {
    id: '3',
    participantName: 'Priya Sharma',
    participantAvatar: 'https://i.pravatar.cc/150?img=9',
    participantRole: 'guest',
    listingName: 'Your listing: Luxury Apartment',
    lastMessage: {
      id: 'm3',
      senderId: 'guest1',
      text: 'Is parking available?',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5), // 5 hours ago
      read: false,
    },
    unreadCount: 1,
    bookingStatus: 'enquiry',
  },
];
// --- End of Mock Data ---

// Helper function to format time
const formatMessageTime = (date: Date) => {
  if (isToday(date)) return format(date, 'h:mm a');
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMM dd');
};

// Conversation Item
interface ConversationItemProps {
  conversation: Conversation;
}

function ConversationItem({ conversation }: ConversationItemProps) {
  const isUnread = conversation.unreadCount > 0;

  return (
    <Link href={`/chats/${conversation.id}`} asChild>
      <TouchableOpacity style={styles.itemContainer}>
        {/* Avatar */}
        <View style={styles.avatarContainer}>
          <Image source={{ uri: conversation.participantAvatar }} style={styles.avatar} />
          {conversation.participantRole === 'host' && (
            <View style={styles.hostBadge}>
              <Star size={10} color="#FFFFFF" fill="#FFFFFF" />
            </View>
          )}
        </View>

        {/* Text */}
        <View style={styles.textContainer}>
          <View style={styles.itemHeader}>
            <Text style={[styles.participantName, isUnread ? styles.fontBold : styles.fontNormal]}>
              {conversation.participantName}
            </Text>
            <Text style={styles.messageTime}>{formatMessageTime(conversation.lastMessage.timestamp)}</Text>
          </View>
          <Text style={styles.listingName} numberOfLines={1}>
            {conversation.listingName}
          </Text>
          <View style={styles.messageRow}>
            <Text
              style={[styles.lastMessage, isUnread ? styles.fontBold : styles.fontNormal]}
              numberOfLines={1}
            >
              {conversation.lastMessage.senderId === 'user' && 'You: '}
              {conversation.lastMessage.text}
            </Text>
            {conversation.unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{conversation.unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Link>
  );
}

// Main Inbox Screen
export default function InboxScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'hosts'>('all'); // guests removed

  const filteredConversations = mockConversations.filter((conv) => {
    const matchesSearch =
      conv.participantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.listingName.toLowerCase().includes(searchQuery.toLowerCase());

    if (activeTab === 'all') return matchesSearch;
    if (activeTab === 'unread') return matchesSearch && conv.unreadCount > 0;
    if (activeTab === 'hosts') return matchesSearch && conv.participantRole === 'host';
    return matchesSearch;
  });

  const totalUnread = mockConversations.reduce((sum, conv) => sum + conv.unreadCount, 0);

  const renderTab = (tabName: 'all' | 'unread' | 'hosts', label: string) => (
    <TouchableOpacity
      style={[styles.tab, activeTab === tabName ? styles.activeTab : null]}
      onPress={() => setActiveTab(tabName)}
    >
      <Text style={[styles.tabText, activeTab === tabName ? styles.activeTabText : null]}>{label}</Text>
      {tabName === 'unread' && totalUnread > 0 && (
        <View style={styles.tabBadge}>
          <Text style={styles.tabBadgeText}>{totalUnread}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ title: 'Inbox' }} />

      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Messages</Text>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Search size={18} color="#6B7280" style={styles.searchIcon} />
          <TextInput
            placeholder="Search conversations..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
          />
        </View>

        {/* Tabs (Guests removed) */}
        <View style={styles.tabsContainer}>
          {renderTab('all', 'All')}
          {renderTab('unread', 'Unread')}
          {renderTab('hosts', 'Hosts')}
        </View>

        {/* List */}
        <FlatList
          data={filteredConversations}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ConversationItem conversation={item} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MessageCircle size={64} color="#9CA3AF" />
              <Text style={styles.emptyTitle}>No conversations</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery ? 'No results found' : 'Your messages will appear here'}
              </Text>
            </View>
          }
        />
      </View>
    </SafeAreaView>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, alignItems: 'center' },
  headerTitle: { fontSize: 24, fontWeight: 'bold' },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    marginHorizontal: 16,
    paddingHorizontal: 12,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, height: 44, fontSize: 16 },

  tabsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    marginTop: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: { borderBottomColor: '#000000' },
  tabText: { fontSize: 14, fontWeight: '500', color: '#6B7280' },
  activeTabText: { color: '#000000' },
  tabBadge: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  tabBadgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: 'bold' },

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, marginTop: 60 },
  emptyTitle: { fontSize: 20, fontWeight: '600', marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: '#6B7280', marginTop: 8, textAlign: 'center' },

  // Conversation item
  itemContainer: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, alignItems: 'center' },
  avatarContainer: { width: 48, height: 48, marginRight: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#E5E7EB' },
  hostBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  textContainer: { flex: 1 },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  participantName: { fontSize: 16 },
  fontBold: { fontWeight: 'bold' },
  fontNormal: { fontWeight: 'normal', color: '#6B7280' },
  messageTime: { fontSize: 12, color: '#6B7280', flexShrink: 0, marginLeft: 8 },
  listingName: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  messageRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lastMessage: { fontSize: 14, flex: 1 },
  unreadBadge: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  unreadText: { color: '#FFFFFF', fontSize: 12, fontWeight: 'bold' },
});
