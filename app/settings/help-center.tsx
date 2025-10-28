// app/settings/help-center.tsx
import { Stack, useRouter } from 'expo-router';
// Import ArrowLeft for custom header
import { ArrowLeft, ChevronDown, ChevronRight, Flag, HelpCircle, Mail, MessageCircle, Phone, Search } from 'lucide-react-native';
import React, { useState } from 'react';
// Import necessary components for custom header
import { Alert, LayoutAnimation, Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, UIManager, View } from 'react-native';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const faqs = [
  { category: 'Bookings', questions: [
      { q: 'How do I cancel or modify?', a: 'Go to "My Trips", select booking. Options depend on policy.' },
      { q: 'When is confirmation?', a: 'Immediately via email/SMS after payment.' },
      { q: 'Check-in/out times?', a: 'Usually 2 PM / 11 AM. Check confirmation or ask host.' }
    ]},
  { category: 'Payments', questions: [
      { q: 'Payment methods?', a: 'UPI, Cards, Net Banking, Wallets (Paytm, PhonePe, GPay).' },
      { q: 'Refund time?', a: '5-7 business days to original method.' },
      { q: 'Is payment secure?', a: 'Yes, encrypted. Full card details not stored.' }
    ]},
  { category: 'Safety', questions: [
      { q: 'Property verification?', a: 'Docs, photos, sometimes physical checks.' },
      { q: 'Feeling unsafe?', a: 'Contact 24/7 helpline or report in-app.' },
      { q: 'Details shared?', a: 'Hosts see name/phone only for stay.' }
    ]}
];

// --- Custom Accordion Item ---
interface AccordionItemProps { question: string; answer: string; }
const AccordionItem = ({ question, answer }: AccordionItemProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const toggleOpen = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setIsOpen(!isOpen);
    };
    return (
        <View style={styles.accordionItem}>
            <TouchableOpacity style={styles.accordionTrigger} onPress={toggleOpen}>
                <Text style={styles.accordionQuestion}>{question}</Text>
                <ChevronDown size={18} color="#6B7280" style={{ transform: [{ rotate: isOpen ? '180deg' : '0deg' }] }} />
            </TouchableOpacity>
            {isOpen && ( <Text style={styles.accordionAnswer}>{answer}</Text> )}
        </View>
    );
};

export default function HelpCenterPage() {
  const router = useRouter(); // Use router for back navigation
  const [searchQuery, setSearchQuery] = useState('');
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [reportSubject, setReportSubject] = useState('');
  const [reportDetails, setReportDetails] = useState('');

  const handleContactSupport = (method: string) => Alert.alert(`Contact ${method}`, `Opening ${method} support...`);
  const handleSubmitReport = () => {
    if (!reportSubject.trim() || !reportDetails.trim()) { Alert.alert('Error', 'Please fill all fields'); return; }
    Alert.alert('Report Submitted', 'Our team will contact you shortly.');
    setShowReportDialog(false); setReportSubject(''); setReportDetails('');
  };

   const filteredFaqs = searchQuery
    ? faqs.map(cat => ({
        ...cat,
        questions: cat.questions.filter(q =>
          q.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
          q.a.toLowerCase().includes(searchQuery.toLowerCase())
        )
      })).filter(cat => cat.questions.length > 0)
    : faqs;


  return (
    <SafeAreaView style={styles.container}>
      {/* Hide default header */}
      <Stack.Screen options={{ headerShown: false }} />

      {/* Custom Header */}
      <View style={styles.customHeader}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help Center</Text>
        {/* Placeholder for balance */}
        <View style={styles.headerRightPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Search */}
        <View style={styles.searchContainer}>
          <Search size={18} color="#6B7280" style={styles.searchIcon} />
          <TextInput
            placeholder="Search for help..." value={searchQuery} onChangeText={setSearchQuery}
            placeholderTextColor="#6B7280" style={styles.searchInput}
          />
        </View>

        {/* Contact Support */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Support</Text>
          <ContactOption icon={<MessageCircle size={20} color="#111827" />} title="Live Chat" subtitle="Available 24/7" onPress={() => handleContactSupport('Chat')} />
          <ContactOption icon={<Phone size={20} color="#111827" />} title="Call Support" subtitle="1800-123-4567" onPress={() => handleContactSupport('Call')} />
          <ContactOption icon={<Mail size={20} color="#111827" />} title="Email Support" subtitle="support@yourapp.com" onPress={() => handleContactSupport('Email')} />
        </View>

        <View style={styles.divider} />

        {/* Report an Issue */}
        <TouchableOpacity style={styles.reportButton} onPress={() => setShowReportDialog(true)}>
           <Flag size={16} color="#111827" />
           <Text style={styles.reportButtonText}>Report an issue</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* FAQs */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
          {filteredFaqs.length === 0 ? (
             <View style={styles.emptyCard}><HelpCircle size={48} color="#D1D5DB" /><Text style={styles.emptyText}>No results found</Text></View>
          ) : (
            filteredFaqs.map((category) => (
              <View key={category.category} style={styles.faqCategory}>
                <Text style={styles.faqCategoryTitle}>{category.category}</Text>
                {category.questions.map((faq, idx) => ( <AccordionItem key={idx} question={faq.q} answer={faq.a} /> ))}
              </View>
            ))
          )}
        </View>

        {/* Additional Resources */}
        <View style={styles.divider} />
         <View style={styles.section}>
             <Text style={styles.sectionTitle}>Additional Resources</Text>
             <ResourceLink title="Terms of Service" onPress={() => Alert.alert('Navigate', 'Open Terms')} />
             <ResourceLink title="Privacy Policy" onPress={() => Alert.alert('Navigate', 'Open Privacy Policy')} />
             <ResourceLink title="Refund Policy" onPress={() => Alert.alert('Navigate', 'Open Refund Policy')} />
         </View>
      </ScrollView>

      {/* Report Issue Modal */}
       <Modal visible={showReportDialog} transparent animationType="fade" onRequestClose={() => setShowReportDialog(false)}>
         <View style={styles.modalOverlay}>
           <View style={styles.modalContent}>
             <Text style={styles.modalTitle}>Report an Issue</Text>
             <Text style={styles.modalDescription}>Describe the problem you're facing.</Text>
             <TextInput style={styles.input} placeholder="Subject" value={reportSubject} onChangeText={setReportSubject} />
             <TextInput style={[styles.input, styles.textarea]} placeholder="Details..." value={reportDetails} onChangeText={setReportDetails} multiline numberOfLines={4}/>
             <Text style={styles.modalNote}>Our team will review and contact you.</Text>
             <View style={styles.modalActions}>
               <TouchableOpacity style={styles.modalButtonSecondary} onPress={() => setShowReportDialog(false)}>
                 <Text style={styles.modalButtonTextSecondary}>Cancel</Text>
               </TouchableOpacity>
               <TouchableOpacity style={styles.modalButtonPrimary} onPress={handleSubmitReport}>
                 <Text style={styles.modalButtonTextPrimary}>Submit</Text>
               </TouchableOpacity>
             </View>
           </View>
         </View>
       </Modal>
    </SafeAreaView>
  );
}

// --- Helper Components ---
interface ContactOptionProps { icon: React.ReactNode; title: string; subtitle: string; onPress: () => void;}
const ContactOption = ({ icon, title, subtitle, onPress }: ContactOptionProps) => (
  <TouchableOpacity style={styles.contactCard} onPress={onPress}>
    <View style={styles.contactIconBg}>{icon}</View>
    <View style={styles.contactTextContainer}>
        <Text style={styles.contactTitle}>{title}</Text>
        <Text style={styles.contactSubtitle}>{subtitle}</Text>
    </View>
    <ChevronRight size={20} color="#9CA3AF" />
  </TouchableOpacity>
);

interface ResourceLinkProps { title: string; onPress: () => void; }
const ResourceLink = ({ title, onPress }: ResourceLinkProps) => (
    <TouchableOpacity style={styles.resourceButton} onPress={onPress}>
        <Text style={styles.resourceText}>{title}</Text>
        <ChevronRight size={16} color="#6B7280" />
    </TouchableOpacity>
);

// --- Styles ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  // Custom Header Styles
  customHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB', backgroundColor: '#FFFFFF',
  },
  backButton: { padding: 4, width: 40 }, // Fixed width for balance
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#111827', flex: 1, textAlign: 'center' },
  headerRightPlaceholder: { width: 40 }, // Placeholder to balance title
  // End Custom Header Styles
  scrollContent: { padding: 16, gap: 24, paddingBottom: 40 },
  searchContainer: { position: 'relative', justifyContent: 'center' },
  searchIcon: { position: 'absolute', left: 12, zIndex: 1 },
  searchInput: {
    height: 44, paddingLeft: 40, paddingRight: 12, backgroundColor: 'white',
    borderRadius: 8, borderWidth: 1, borderColor: '#D1D5DB', fontSize: 16,
  },
  section: { gap: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#111827' },
  contactCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'white',
    borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E5E7EB', gap: 12,
  },
  contactIconBg: { width: 40, height: 40, backgroundColor: '#F3F4F6', borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  contactTextContainer: { flex: 1 },
  contactTitle: { fontSize: 16, fontWeight: '500' },
  contactSubtitle: { fontSize: 14, color: '#6B7280' },
  divider: { height: 1, backgroundColor: '#E5E7EB' },
  reportButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12,
    borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, gap: 8, backgroundColor: 'white',
  },
  reportButtonText: { fontSize: 14, fontWeight: '500', color: '#111827' },
  emptyCard: { backgroundColor: 'white', borderRadius: 12, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB', gap: 8 },
  emptyText: { fontSize: 14, color: '#6B7280' },
  faqCategory: { marginBottom: 16 },
  faqCategoryTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8, paddingHorizontal: 4 },
  accordionItem: { backgroundColor: 'white', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 8, overflow: 'hidden' },
  accordionTrigger: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  accordionQuestion: { fontSize: 15, fontWeight: '500', flex: 1, marginRight: 8 },
  accordionAnswer: { fontSize: 14, color: '#4B5563', padding: 16, paddingTop: 0, lineHeight: 20 },
  resourceButton: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', backgroundColor: 'white', paddingHorizontal: 16, borderRadius: 8, marginBottom: 8 },
  resourceText: { fontSize: 15 },
   // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { backgroundColor: 'white', borderRadius: 12, padding: 20, width: '100%', gap: 16 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', textAlign: 'center' },
  modalDescription: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 12, fontSize: 16 },
  textarea: { height: 100, textAlignVertical: 'top' },
  modalNote: { fontSize: 12, color: '#9CA3AF' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 8 },
  modalButtonPrimary: { backgroundColor: '#111827', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  modalButtonSecondary: { backgroundColor: '#F3F4F6', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  modalButtonTextPrimary: { color: 'white', fontWeight: 'bold' },
  modalButtonTextSecondary: { color: '#111827', fontWeight: 'bold' },
});