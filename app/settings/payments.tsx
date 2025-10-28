// app/settings/payments.tsx
import { Stack, useRouter } from 'expo-router'; // Removed useLocalSearchParams as userRole is hardcoded for now
import { ArrowLeft, CheckCircle, CreditCard, Download, FileText, Landmark, Plus, Smartphone, Trash2, Wallet } from 'lucide-react-native';
import React, { useState } from 'react';
import { Alert, Modal, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

// --- Type Definitions ---
interface PaymentMethod {
  id: string; type: 'card' | 'upi' | 'wallet'; name: string;
  details: string; isDefault: boolean;
}
interface Receipt {
  id: string; bookingCode: string; propertyName: string;
  amount: number; date: Date; status: 'paid' | 'refunded';
}

// --- Mock Data ---
const mockPaymentMethods: PaymentMethod[] = [
  { id: '1', type: 'upi', name: 'Google Pay', details: 'priya@oksbi', isDefault: true },
  { id: '2', type: 'card', name: 'HDFC Credit Card', details: '**** **** **** 4532', isDefault: false },
];
const mockReceipts: Receipt[] = [
  { id: '1', bookingCode: 'BK7X9K2L', propertyName: 'Modern Studio', amount: 8500, date: new Date('2025-10-15'), status: 'paid' },
];

// --- Guest Payment Settings Component ---
function GuestPaymentSettings({ showAddPaymentModal }: { showAddPaymentModal: () => void }) {
  const [paymentMethods, setPaymentMethods] = useState(mockPaymentMethods);

  const handleRemovePayment = (id: string) => {
    Alert.alert('Remove Method?', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel'},
      { text: 'Remove', style: 'destructive', onPress: () => {
          setPaymentMethods(prev => prev.filter(pm => pm.id !== id));
          Alert.alert('Removed');
        }}
    ]);
  };

  const handleSetDefault = (id: string) => {
    setPaymentMethods(prev => prev.map(pm => ({ ...pm, isDefault: pm.id === id })));
    Alert.alert('Default Updated');
  };

  const getPaymentIcon = (type: string) => {
    switch (type) {
      case 'card': return <CreditCard size={20} color="#374151" />;
      case 'upi': return <Smartphone size={20} color="#374151" />;
      case 'wallet': return <Wallet size={20} color="#374151" />;
      default: return <CreditCard size={20} color="#374151" />;
    }
  };

  return (
    <View style={styles.tabContent}>
      <TouchableOpacity style={styles.addButton} onPress={showAddPaymentModal}>
        <Plus size={16} color="#111827" />
        <Text style={styles.addButtonText}>Add payment method</Text>
      </TouchableOpacity>
      {paymentMethods.map((method) => (
        <View key={method.id} style={styles.card}>
          <View style={styles.paymentMethodHeader}>
            <View style={styles.cardIconBg}>{getPaymentIcon(method.type)}</View>
            <View style={styles.paymentMethodInfo}>
              <View style={styles.paymentMethodNameRow}>
                <Text style={styles.paymentMethodName}>{method.name}</Text>
                {method.isDefault && (
                  <View style={styles.defaultBadge}><Text style={styles.defaultBadgeText}>Default</Text></View>
                )}
              </View>
              <Text style={styles.paymentMethodDetails}>{method.details}</Text>
              <View style={styles.paymentActions}>
                {!method.isDefault && (
                  <TouchableOpacity style={styles.actionButton} onPress={() => handleSetDefault(method.id)}>
                    <Text style={styles.actionButtonText}>Set as default</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={[styles.actionButton, styles.removeButton]} onPress={() => handleRemovePayment(method.id)}>
                  <Trash2 size={16} color="#DC2626" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

// --- Guest Receipts Component ---
function GuestReceipts() {
  const handleDownloadReceipt = (code: string) => Alert.alert('Download Receipt', `Downloading receipt ${code}...`);

  return (
    <View style={styles.tabContent}>
      {mockReceipts.map((receipt) => (
        <View key={receipt.id} style={styles.card}>
          <View style={styles.receiptHeader}>
            <View style={styles.receiptInfo}>
              <Text style={styles.receiptProperty} numberOfLines={1}>{receipt.propertyName}</Text>
              <Text style={styles.receiptDate}>{receipt.date.toLocaleDateString('en-IN')}</Text>
            </View>
            <View style={[styles.statusBadge, receipt.status === 'paid' ? styles.paidBadge : styles.refundedBadge]}>
              <Text style={styles.statusBadgeText}>{receipt.status}</Text>
            </View>
          </View>
          <View style={styles.receiptDetails}>
            <View>
              <Text style={styles.receiptLabel}>Booking code</Text>
              <Text style={styles.receiptCode}>{receipt.bookingCode}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.receiptLabel}>Amount</Text>
              <Text style={styles.receiptAmount}>₹{receipt.amount.toLocaleString('en-IN')}</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.downloadButton} onPress={() => handleDownloadReceipt(receipt.bookingCode)}>
            <Download size={16} color="#111827" />
            <Text style={styles.downloadButtonText}>Download receipt</Text>
          </TouchableOpacity>
        </View>
      ))}
      {mockReceipts.length === 0 && (
        <View style={[styles.card, { alignItems: 'center', paddingVertical: 30 }]}>
          <Text style={{ color: '#6B7280' }}>No receipts found.</Text>
        </View>
      )}
    </View>
  );
}

// --- Host Payout Settings Component ---
function HostPayoutSettings({ showAddBankModal }: { showAddBankModal: () => void }) {
  const [bankVerified, setBankVerified] = useState(false); // Example state

  return (
    <View style={styles.tabContent}>
      {/* Bank Account */}
      <View style={styles.card}>
        <View style={styles.payoutHeader}>
          <View style={styles.cardIconBg}><Landmark size={20} color="#374151" /></View>
          <View style={styles.payoutInfo}>
            <Text style={styles.payoutTitle}>Bank Account</Text>
            <Text style={styles.payoutSubtitle}>{bankVerified ? 'HDFC Bank **** 6789' : 'No bank account added'}</Text>
          </View>
          {bankVerified && (
            <View style={[styles.statusBadge, styles.statusBadgeVerified]}>
              <CheckCircle size={12} color="#065F46" />
              <Text style={styles.statusBadgeText}>Verified</Text>
            </View>
          )}
        </View>
        {bankVerified ? (
          <View style={styles.bankDetailsContainer}>
            <View style={styles.detailRow}><Text style={styles.detailLabel}>Account holder</Text><Text>Priya Sharma</Text></View>
            <View style={styles.detailRow}><Text style={styles.detailLabel}>IFSC Code</Text><Text>HDFC0001234</Text></View>
          </View>
        ) : (
          <TouchableOpacity style={[styles.addButton, { marginTop: 16 }]} onPress={showAddBankModal}>
            <Plus size={16} color="#111827" /><Text style={styles.addButtonText}>Add bank account</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* GSTIN */}
      <View style={styles.card}>
        <View style={styles.payoutHeader}>
          <View style={styles.cardIconBg}><FileText size={20} color="#374151" /></View>
          <View style={styles.payoutInfo}>
            <Text style={styles.payoutTitle}>GSTIN (Optional)</Text>
            <Text style={styles.payoutSubtitle}>For GST invoices</Text>
          </View>
        </View>
        <TouchableOpacity style={[styles.addButton, { marginTop: 16 }]}>
          <Text style={styles.addButtonText}>Add GSTIN</Text>
        </TouchableOpacity>
      </View>

      {/* Statements */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Statements & Downloads</Text>
        <TouchableOpacity style={styles.downloadRow}><Text style={styles.downloadText}>TDS Certificate</Text><Download size={16} color="#6B7280" /></TouchableOpacity>
        <TouchableOpacity style={styles.downloadRow}><Text style={styles.downloadText}>GST Statement</Text><Download size={16} color="#6B7280" /></TouchableOpacity>
        <TouchableOpacity style={styles.downloadRow}><Text style={styles.downloadText}>Payout History</Text><Download size={16} color="#6B7280" /></TouchableOpacity>
      </View>
    </View>
  );
}

// --- Main Page Component ---
export default function PaymentSettingsPage() {
  const router = useRouter();
  const [userRole, setUserRole] = useState<'guest' | 'host'>('guest'); // Change to 'host' to test host view
  const [activeTab, setActiveTab] = useState(userRole === 'guest' ? 'methods' : 'payouts');
  const [showAddPaymentDialog, setShowAddPaymentDialog] = useState(false);
  const [showAddBankDialog, setShowAddBankDialog] = useState(false);

  // --- Add Bank State ---
  const [accountNumber, setAccountNumber] = useState('');
  const [confirmAccount, setConfirmAccount] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [holderName, setHolderName] = useState('');

  const handleAddBank = () => {
    if (!accountNumber || accountNumber !== confirmAccount || !ifsc || !holderName) {
      Alert.alert('Error', 'Please fill all fields correctly.');
      return;
    }
    Alert.alert('Bank Added', 'Bank account added successfully.');
    setShowAddBankDialog(false);
    setAccountNumber(''); setConfirmAccount(''); setIfsc(''); setHolderName('');
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Hide default header and render a custom one like privacy-safety */}
      <Stack.Screen options={{ headerShown: false }} />

      {/* Custom Header */}
      <View style={styles.customHeader}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{userRole === 'guest' ? 'Payments' : 'Payouts'}</Text>
        <View style={styles.headerRightPlaceholder} />
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        {userRole === 'guest' ? (
          <>
            <TouchableOpacity style={[styles.tab, activeTab === 'methods' && styles.tabActive]} onPress={() => setActiveTab('methods')}>
              <Text style={[styles.tabText, activeTab === 'methods' && styles.tabTextActive]}>Payment Methods</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tab, activeTab === 'receipts' && styles.tabActive]} onPress={() => setActiveTab('receipts')}>
              <Text style={[styles.tabText, activeTab === 'receipts' && styles.tabTextActive]}>Receipts</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity style={[styles.tab, styles.tabActive]} onPress={() => setActiveTab('payouts')}>
            <Text style={[styles.tabText, styles.tabTextActive]}>Payout Settings</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.scrollContainer}>
        {activeTab === 'methods' && userRole === 'guest' && <GuestPaymentSettings showAddPaymentModal={() => setShowAddPaymentDialog(true)} />}
        {activeTab === 'receipts' && userRole === 'guest' && <GuestReceipts />}
        {activeTab === 'payouts' && userRole === 'host' && <HostPayoutSettings showAddBankModal={() => setShowAddBankDialog(true)} />}
      </ScrollView>

      {/* Add Payment Method Modal */}
      <Modal visible={showAddPaymentDialog} transparent animationType="fade" onRequestClose={() => setShowAddPaymentDialog(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Payment Method</Text>
            <TouchableOpacity style={styles.modalOption} onPress={() => Alert.alert('Add UPI', 'Implement UPI addition flow')}>
              <Smartphone size={20} color="#374151" /><Text style={styles.modalOptionText}>Add UPI ID</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalOption} onPress={() => Alert.alert('Add Card', 'Implement Card addition flow')}>
              <CreditCard size={20} color="#374151" /><Text style={styles.modalOptionText}>Add Credit/Debit Card</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalOption} onPress={() => Alert.alert('Add Wallet', 'Implement Wallet addition flow')}>
              <Wallet size={20} color="#374151" /><Text style={styles.modalOptionText}>Add Wallet</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalButtonSecondary, { marginTop: 16 }]} onPress={() => setShowAddPaymentDialog(false)}>
              <Text style={styles.modalButtonTextSecondary}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add Bank Account Modal */}
      <Modal visible={showAddBankDialog} transparent animationType="fade" onRequestClose={() => setShowAddBankDialog(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Bank Account</Text>
            <Text style={styles.modalDescription}>Enter details for payouts</Text>
            <TextInput style={styles.input} placeholder="Account Number" keyboardType="number-pad" value={accountNumber} onChangeText={setAccountNumber} />
            <TextInput style={styles.input} placeholder="Confirm Account Number" keyboardType="number-pad" value={confirmAccount} onChangeText={setConfirmAccount} />
            <TextInput style={styles.input} placeholder="IFSC Code" autoCapitalize="characters" value={ifsc} onChangeText={setIfsc} />
            <TextInput style={styles.input} placeholder="Account Holder Name" value={holderName} onChangeText={setHolderName} />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalButtonSecondary} onPress={() => setShowAddBankDialog(false)}>
                <Text style={styles.modalButtonTextSecondary}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalButtonPrimary} onPress={handleAddBank}>
                <Text style={styles.modalButtonTextPrimary}>Add Account</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },

  // Custom Header (same pattern as privacy-safety)
  customHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB', backgroundColor: '#FFFFFF',
  },
  backButton: { padding: 4, width: 40 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#111827', flex: 1, textAlign: 'center' },
  headerRightPlaceholder: { width: 40 },

  tabsContainer: { flexDirection: 'row', backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#111827' },
  tabText: { fontSize: 14, fontWeight: '500', color: '#6B7280' },
  tabTextActive: { color: '#111827', fontWeight: '600' },

  scrollContainer: { flex: 1 },
  tabContent: { padding: 16, gap: 16 },
  card: { backgroundColor: 'white', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E5E7EB' },

  addButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12,
    borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, gap: 8,
  },
  addButtonText: { fontSize: 14, fontWeight: '500', color: '#111827' },

  paymentMethodHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardIconBg: { width: 40, height: 40, backgroundColor: '#F3F4F6', borderRadius: 20, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  paymentMethodInfo: { flex: 1 },
  paymentMethodNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  paymentMethodName: { fontSize: 16, fontWeight: '600' },
  defaultBadge: { backgroundColor: '#E5E7EB', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  defaultBadgeText: { fontSize: 10, fontWeight: '500', color: '#4B5563' },
  paymentMethodDetails: { fontSize: 14, color: '#6B7280' },
  paymentActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: '#D1D5DB' },
  actionButtonText: { fontSize: 12, fontWeight: '500', color: '#111827' },
  removeButton: { padding: 6, borderColor: 'transparent' },

  receiptHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, gap: 8 },
  receiptInfo: { flex: 1 },
  receiptProperty: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  receiptDate: { fontSize: 14, color: '#6B7280' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 4 },
  paidBadge: { backgroundColor: '#D1FAE5' },
  refundedBadge: { backgroundColor: '#FEE2E2' },
  statusBadgeText: { fontSize: 12, fontWeight: '500', textTransform: 'capitalize', color: '#1F2937' },

  receiptDetails: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  receiptLabel: { fontSize: 12, color: '#6B7280', marginBottom: 2 },
  receiptCode: { fontSize: 14, fontWeight: '500', backgroundColor: '#F3F4F6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  receiptAmount: { fontSize: 16, fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 12 },
  downloadButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, gap: 8 },
  downloadButtonText: { fontSize: 14, fontWeight: '500', color: '#111827' },

  // Host Payout Styles
  payoutHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  payoutInfo: { flex: 1 },
  payoutTitle: { fontSize: 16, fontWeight: '600' },
  payoutSubtitle: { fontSize: 14, color: '#6B7280' },
  bankDetailsContainer: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#E5E7EB', gap: 8 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between' },
  detailLabel: { color: '#6B7280' },
  section: { marginTop: 24, gap: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  downloadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', backgroundColor: 'white', paddingHorizontal: 16, borderRadius: 8 },
  downloadText: { fontSize: 14 },

  // Modal Styles (shared)
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { backgroundColor: 'white', borderRadius: 12, padding: 20, width: '100%', gap: 16 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', textAlign: 'center' },
  modalDescription: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 8 },
  modalOption: { flexDirection: 'row', alignItems: 'center', padding: 14, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, gap: 12 },
  modalOptionText: { fontSize: 16, fontWeight: '500' },
  input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 12, fontSize: 16 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 8 },
  modalButtonPrimary: { backgroundColor: '#111827', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  modalButtonSecondary: { backgroundColor: '#F3F4F6', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  modalButtonTextPrimary: { color: 'white', fontWeight: 'bold' },
  modalButtonTextSecondary: { color: '#111827', fontWeight: 'bold' },

  // Badge color used when verified
  statusBadgeVerified: { backgroundColor: '#D1FAE5' },
});
