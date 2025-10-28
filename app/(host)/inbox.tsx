// app/(host)/inbox.tsx
import { format, isToday, isYesterday } from 'date-fns';
import { Link, useRouter } from 'expo-router';
import { MessageCircle, Search } from 'lucide-react-native';
import React, { useState } from 'react';
import { FlatList, Image, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

// FIX 2: Ensure the Message interface is correctly defined here
interface Message {
  id: string;
  senderId: string; // Make sure this exists
  text: string;     // Make sure this exists
  timestamp: Date;
  read: boolean;
}

interface Conversation {
  id: string; guestName: string; guestAvatar?: string; listingName: string;
  lastMessage: Message; unreadCount: number; bookingStatus?: 'request' | 'upcoming' | 'completed';
}

const mockConversations: Conversation[] = [ // Use host-centric mock data
  { id: '1', guestName: 'Amit Patel', guestAvatar: 'https://i.pravatar.cc/150?img=15', listingName: 'Modern Studio', lastMessage: { id: 'm1', senderId: 'guest1', text: 'What time is check-in?', timestamp: new Date(Date.now() - 1000 * 60 * 30), read: false }, unreadCount: 2, bookingStatus: 'upcoming' },
  { id: '2', guestName: 'Priya Singh', guestAvatar: 'https://i.pravatar.cc/150?img=9', listingName: 'Beach Villa', lastMessage: { id: 'm2', senderId: 'guest2', text: 'Is parking available?', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), read: false }, unreadCount: 1, bookingStatus: 'request' },
  { id: '3', guestName: 'Rahul Verma', guestAvatar: 'https://i.pravatar.cc/150?img=33', listingName: 'Cozy Cottage', lastMessage: { id: 'm3', senderId: 'host', text: 'Yes, covered parking available.', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5), read: true }, unreadCount: 0, bookingStatus: 'upcoming' },
];

// FIX 1: Add return statements to formatMessageTime
const formatMessageTime = (date: Date): string => { // Explicitly declare return type as string
  if (isToday(date)) {
    return format(date, 'h:mm a'); // Add return
  } else if (isYesterday(date)) {
    return 'Yesterday'; // Add return
  } else {
    return format(date, 'MMM dd'); // Add return
  }
};

// --- Conversation Item Component (No changes needed inside this component itself) ---
function ConversationItem({ conversation }: { conversation: Conversation }) {
  const router = useRouter();
  const isUnread = conversation.unreadCount > 0;
  const status = conversation.bookingStatus;

  return (
    // Navigate to the shared chat screen
    <Link href={`/chats/${conversation.id}`} asChild>
      <TouchableOpacity style={styles.itemContainer}>
        <Image source={{ uri: conversation.guestAvatar }} style={styles.avatar} />
        <View style={styles.textContainer}>
          <View style={styles.itemHeader}>
             <View style={{flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1}}>
                <Text style={[styles.participantName, isUnread && styles.fontBold]} numberOfLines={1}>{conversation.guestName}</Text>
                {status && (
                    <View style={[styles.statusBadge,
                        status === 'request' ? styles.badgeRequest :
                        status === 'upcoming' ? styles.badgeUpcoming : styles.badgeCompleted]}>
                        <Text style={styles.statusBadgeText}>{status}</Text>
                    </View>
                )}
             </View>
             {/* No error should appear here now */}
            <Text style={styles.messageTime}>{formatMessageTime(conversation.lastMessage.timestamp)}</Text>
          </View>
          <Text style={styles.listingName} numberOfLines={1}>{conversation.listingName}</Text>
          <View style={styles.messageRow}>
             {/* No error should appear here now */}
            <Text style={[styles.lastMessage, isUnread && styles.fontBold]} numberOfLines={1}>
              {conversation.lastMessage.senderId === 'host' && 'You: '}{conversation.lastMessage.text}
            </Text>
            {conversation.unreadCount > 0 && (
              <View style={styles.unreadBadge}><Text style={styles.unreadText}>{conversation.unreadCount}</Text></View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Link>
  );
}

// --- Main Host Inbox Screen (No changes needed inside this component itself) ---
export default function HostInboxScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');

   const filteredConversations = mockConversations.filter(conv => {
    const matchesSearch = conv.guestName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          conv.listingName.toLowerCase().includes(searchQuery.toLowerCase());
    if (activeTab === 'all') return matchesSearch;
    if (activeTab === 'unread') return matchesSearch && conv.unreadCount > 0;
    if (activeTab === 'requests') return matchesSearch && conv.bookingStatus === 'request';
    return false; // Should not happen with current tabs
  });

  const totalUnread = mockConversations.reduce((sum, conv) => sum + conv.unreadCount, 0);

  const renderTab = (tabName: string, label: string) => (
    <TouchableOpacity
      style={[styles.tab, activeTab === tabName && styles.activeTab]}
      onPress={() => setActiveTab(tabName)}>
      <Text style={[styles.tabText, activeTab === tabName && styles.activeTabText]}>{label}</Text>
       {tabName === 'unread' && totalUnread > 0 && (
         <View style={styles.tabBadge}><Text style={styles.tabBadgeText}>{totalUnread}</Text></View>
       )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
       {/* Custom Header */}
       <View style={styles.customHeader}>
         <View style={styles.headerPlaceholder} />{/* Left Placeholder */}
         <View style={styles.headerTitleContainer}>
             <Text style={styles.headerTitle}>Messages</Text>
             {totalUnread > 0 && <Text style={styles.headerSubtitle}>{totalUnread} unread</Text>}
         </View>
         <View style={styles.headerPlaceholder} />{/* Right Placeholder */}
      </View>

      <View style={styles.container}>
        {/* Search */}
        <View style={styles.searchOuterContainer}>
            <View style={styles.searchContainer}>
            <Search size={18} color="#6B7280" style={styles.searchIcon} />
            <TextInput
                placeholder="Search conversations..." value={searchQuery} onChangeText={setSearchQuery}
                placeholderTextColor="#6B7280" style={styles.searchInput}
            />
            </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          {renderTab('all', 'All')}
          {renderTab('unread', 'Unread')}
          {renderTab('requests', 'Requests')}
        </View>

        {/* Conversation List */}
        <FlatList
          data={filteredConversations}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ConversationItem conversation={item} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MessageCircle size={64} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>No conversations</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery ? 'No results found' : 'Guest messages will appear here'}
              </Text>
            </View>
          }
           contentContainerStyle={{ flexGrow: 1 }} // Make sure empty state can center
        />
      </View>
    </SafeAreaView>
  );
}


// --- Styles --- (Keep existing styles)
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { flex: 1 },
   customHeader: { // Same header style as other host screens
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB', backgroundColor: '#FFFFFF',
  },
  headerPlaceholder: { width: 40 },
  headerTitleContainer: { alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#111827' },
  headerSubtitle: { fontSize: 14, color: '#6B7280', marginTop: 2 },
  searchOuterContainer: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: 'white'}, // Added padding
  searchContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6',
    borderRadius: 12, paddingHorizontal: 12,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, height: 44, fontSize: 16 },
  tabsContainer: {
    flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB', backgroundColor: 'white'
  },
  tab: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: '#111827' },
  tabText: { fontSize: 14, fontWeight: '500', color: '#6B7280' },
  activeTabText: { color: '#111827' },
  tabBadge: { backgroundColor: '#DC2626', borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', marginLeft: 6, paddingHorizontal: 5 },
  tabBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: 'bold' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: '#6B7280', marginTop: 8, textAlign: 'center' },
  itemContainer: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, alignItems: 'center' },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#E5E7EB', marginRight: 12 },
  textContainer: { flex: 1 },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  participantName: { fontSize: 16, color: '#6B7280', marginRight: 4, flexShrink: 1 }, // Allow shrinking
  fontBold: { fontWeight: 'bold', color: '#111827' },
  messageTime: { fontSize: 12, color: '#9CA3AF', flexShrink: 0 },
  listingName: { fontSize: 13, color: '#6B7280', marginBottom: 4 },
  messageRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lastMessage: { fontSize: 14, color: '#6B7280', flex: 1, marginRight: 8 },
  unreadBadge: { backgroundColor: '#111827', borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5 },
  unreadText: { color: '#FFFFFF', fontSize: 10, fontWeight: 'bold' },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start' },
  statusBadgeText: { fontSize: 10, fontWeight: '500', textTransform: 'capitalize' },
  badgeRequest: { backgroundColor: '#FEF3C7' }, // Yellowish
  badgeUpcoming: { backgroundColor: '#DBEAFE' }, // Bluish
  badgeCompleted: { backgroundColor: '#F3F4F6' }, // Grayish
});