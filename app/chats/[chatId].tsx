// app/chats/[chatId].tsx
import { format, isToday, isYesterday } from 'date-fns';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
    ArrowLeft,
    Clock,
    MapPin,
    MoreVertical,
    Phone,
    Send,
} from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
    Alert,
    Image,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

// --- Interfaces and Mock Data (from example) ---
interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: Date;
  type?: 'text' | 'system' | 'quick-reply';
}

interface QuickReply {
  id: string;
  text: string;
  icon: React.ReactNode;
  response: string;
}

const mockMessages: ChatMessage[] = [
  {
    id: '1',
    senderId: 'system',
    senderName: 'System',
    text: 'Booking confirmed for Modern Studio in Koramangala',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
    type: 'system',
  },
  {
    id: '2',
    senderId: 'host1',
    senderName: 'Rajesh Kumar',
    text: 'Hi! Welcome to my property. Looking forward to hosting you!',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
    type: 'text',
  },
  {
    id: '3',
    senderId: 'user',
    senderName: 'You',
    text: 'Thank you! I have a few questions.',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2 + 1000 * 60 * 15),
    type: 'text',
  },
  {
    id: '4',
    senderId: 'user',
    senderName: 'You',
    text: 'What time is check-in?',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2 + 1000 * 60 * 16),
    type: 'text',
  },
  {
    id: '5',
    senderId: 'host1',
    senderName: 'Rajesh Kumar',
    text: "Check-in is at 2 PM. I'll send you the door code shortly.",
    timestamp: new Date(Date.now() - 1000 * 60 * 30),
    type: 'text',
  },
];

const quickReplies: QuickReply[] = [
  {
    id: 'checkin',
    text: 'Check-in time?',
    icon: <Clock size={16} color="#374151" />,
    response: 'What is the check-in time?',
  },
  {
    id: 'directions',
    text: 'Directions',
    icon: <MapPin size={16} color="#374151" />,
    response: 'Can you share directions to the property?',
  },
  {
    id: 'contact',
    text: 'Contact number',
    icon: <Phone size={16} color="#374151" />,
    response: 'Can you share your contact number?',
  },
];

// Mock participant data (in a real app, you'd fetch this using the chatId)
const participant = {
  id: 'host1',
  name: 'Rajesh Kumar',
  avatar: 'https://i.pravatar.cc/150?img=12',
  role: 'host',
  listingName: 'Modern Studio in Koramangala',
  bookingStatus: 'upcoming',
};
// --- End of Mock Data ---

// Message Bubble Component
interface MessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
}

function MessageBubble({ message, isOwn }: MessageBubbleProps) {
  if (message.type === 'system') {
    return (
      <View style={styles.systemMessageContainer}>
        <Text style={styles.systemMessageText}>{message.text}</Text>
      </View>
    );
  }

  return (
    <View style={[isOwn ? styles.ownBubbleContainer : styles.otherBubbleContainer]}>
      <View
        style={[
          styles.bubble,
          isOwn ? styles.ownBubble : styles.otherBubble,
        ]}>
        <Text style={isOwn ? styles.ownBubbleText : styles.otherBubbleText}>
          {message.text}
        </Text>
      </View>
      <Text style={styles.messageTime}>
        {format(message.timestamp, 'h:mm a')}
      </Text>
    </View>
  );
}

// Main Chat Page Screen
export default function ChatPageScreen() {
  const router = useRouter();
  const { chatId } = useLocalSearchParams(); // Get the chat ID from the URL
  const [messages, setMessages] = useState<ChatMessage[]>(mockMessages);
  const [newMessage, setNewMessage] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);

  // In a real app, you would use `chatId` to fetch this conversation's data
  useEffect(() => {
    // console.log("Fetching data for chat ID:", chatId);
    //
    // Auto-scroll to bottom on load
    scrollViewRef.current?.scrollToEnd({ animated: false });
  }, [chatId]);

  const handleSendMessage = (text: string) => {
    if (!text.trim()) return;

    const message: ChatMessage = {
      id: Date.now().toString(),
      senderId: 'user',
      senderName: 'You',
      text: text,
      timestamp: new Date(),
      type: 'text',
    };

    setMessages([...messages, message]);
    setNewMessage(''); // Clear input only if it's from the text input
  };

  const handleQuickReply = (reply: QuickReply) => {
    handleSendMessage(reply.response);
  };

  // Group messages by date
  const formatMessageDate = (date: Date) => {
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'MMM dd, yyyy');
  };

  const messageGroups = messages.reduce(
    (groups: { [key: string]: ChatMessage[] }, message) => {
      const dateKey = formatMessageDate(message.timestamp);
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(message);
      return groups;
    },
    {},
  );

  // Use Alert.alert for options (more native than web dropdown)
  const handleShowOptions = () => {
    Alert.alert(
      'Options',
      'What would you like to do?',
      [
        { text: 'View booking', onPress: () => Alert.alert('Viewing booking...') },
        { text: 'Report user', onPress: handleReport, style: 'destructive' },
        { text: 'Block user', onPress: handleBlock, style: 'destructive' },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true },
    );
  };

  const handleReport = () => {
    Alert.alert(
      'Report User?',
      'This user will be reported for review.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report',
          style: 'destructive',
          onPress: () => Alert.alert('User Reported', 'Our team will review this.'),
        },
      ],
    );
  };

  const handleBlock = () => {
    Alert.alert(
      'Block User?',
      `Are you sure you want to block ${participant.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: () => {
            Alert.alert('User Blocked');
            router.back();
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Hide the default header, we're using a custom one */}
      <Stack.Screen options={{ headerShown: false }} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0} // Adjust as needed
      >
        {/* Custom Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color="#000000" />
          </TouchableOpacity>
          <Image source={{ uri: participant.avatar }} style={styles.avatar} />
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {participant.name}
            </Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {participant.listingName}
            </Text>
          </View>
          <TouchableOpacity onPress={handleShowOptions} style={styles.optionsButton}>
            <MoreVertical size={24} color="#000000" />
          </TouchableOpacity>
        </View>

        {/* Messages */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.messageList}
          contentContainerStyle={{ paddingVertical: 16 }}
          onContentSizeChange={() =>
            scrollViewRef.current?.scrollToEnd({ animated: true })
          }>
          {Object.entries(messageGroups).map(([date, msgs]) => (
            <View key={date}>
              <View style={styles.dateSeparatorContainer}>
                <View style={styles.dateSeparatorLine} />
                <Text style={styles.dateSeparatorText}>{date}</Text>
                <View style={styles.dateSeparatorLine} />
              </View>
              {msgs.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isOwn={message.senderId === 'user'}
                />
              ))}
            </View>
          ))}
        </ScrollView>

        {/* Quick Replies */}
        <View style={styles.quickReplyContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {quickReplies.map((reply) => (
              <TouchableOpacity
                key={reply.id}
                style={styles.quickReplyButton}
                onPress={() => handleQuickReply(reply)}>
                {reply.icon}
                <Text style={styles.quickReplyText}>{reply.text}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Message Input */}
        <View style={styles.inputContainer}>
          <TextInput
            placeholder="Type a message..."
            value={newMessage}
            onChangeText={setNewMessage}
            style={styles.textInput}
            multiline
          />
          <TouchableOpacity
            style={styles.sendButton}
            onPress={() => handleSendMessage(newMessage)}
            disabled={!newMessage.trim()}>
            <Send size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 4,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginHorizontal: 12,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#6B7280',
  },
  optionsButton: {
    padding: 4,
  },
  // Message List
  messageList: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 12,
  },
  dateSeparatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dateSeparatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dateSeparatorText: {
    fontSize: 12,
    color: '#6B7280',
    marginHorizontal: 12,
  },
  // Message Bubbles
  systemMessageContainer: {
    alignSelf: 'center',
    backgroundColor: '#E5E7EB',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginVertical: 8,
  },
  systemMessageText: {
    fontSize: 13,
    color: '#4B5563',
    textAlign: 'center',
  },
  ownBubbleContainer: {
    alignItems: 'flex-end',
    marginVertical: 4,
  },
  otherBubbleContainer: {
    alignItems: 'flex-start',
    marginVertical: 4,
  },
  bubble: {
    maxWidth: '75%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
  },
  ownBubble: {
    backgroundColor: '#007AFF', // Primary color
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: '#E5E7EB', // Muted color
    borderBottomLeftRadius: 4,
  },
  ownBubbleText: {
    fontSize: 15,
    color: '#FFFFFF',
  },
  otherBubbleText: {
    fontSize: 15,
    color: '#000000',
  },
  messageTime: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 4,
    marginHorizontal: 6,
  },
  // Quick Replies
  quickReplyContainer: {
    paddingVertical: 8,
    paddingLeft: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  quickReplyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
  },
  quickReplyText: {
    fontSize: 13,
    color: '#374151',
    marginLeft: 6,
  },
  // Input
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100, // For multiline
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
});