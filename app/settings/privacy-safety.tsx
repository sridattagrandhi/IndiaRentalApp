// app/settings/privacy-safety.tsx
import { Stack, useRouter } from 'expo-router';
// Import ArrowLeft for custom header
import { AlertCircle, ArrowLeft, Ban, CheckCircle, Eye, FileText, Shield, Upload } from 'lucide-react-native';
import React, { useState } from 'react';
// Import necessary components for custom header
import { Alert, Modal, SafeAreaView, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';

interface BlockedUser { id: string; name: string; blockedDate: Date; }

export default function PrivacySafetyPage() {
  const router = useRouter(); // Use router for back navigation
  const [isVerified, setIsVerified] = useState(false); // Overall verification status
  const [panVerified, setPanVerified] = useState(false);
  const [aadhaarVerified, setAadhaarVerified] = useState(false);
  const [addressVerified, setAddressVerified] = useState(false);
  const [profileVisibility, setProfileVisibility] = useState(true);
  const [showDataDialog, setShowDataDialog] = useState(false);
  const [blockedUsers] = useState<BlockedUser[]>([
    { id: '1', name: 'John Doe', blockedDate: new Date('2025-09-15') }
  ]);

  const handleVerifyDocument = (type: string) => Alert.alert(`Verify ${type}`, `Start ${type} verification flow...`);
  const handleDownloadData = () => { Alert.alert('Download Started', 'Your data download link will be emailed.'); setShowDataDialog(false); };
  const handleDeleteData = () => {
    Alert.alert('Delete Account?', 'This action is permanent and cannot be undone.', [
        { text: 'Cancel', style: 'cancel'},
        { text: 'Delete', style: 'destructive', onPress: () => Alert.alert('Request Submitted', 'Account deletion request received.')}
    ]);
  };
  const handleUnblock = (name: string) => Alert.alert('Unblock User?', `Unblock ${name}?`, [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Unblock', onPress: () => Alert.alert('User Unblocked')} // Add actual logic
  ]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Hide default header */}
      <Stack.Screen options={{ headerShown: false }} />

      {/* Custom Header */}
      <View style={styles.customHeader}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy & Safety</Text>
        {/* Placeholder for balance */}
        <View style={styles.headerRightPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Identity Verification */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Shield size={20} color="#4B5563" /><Text style={styles.sectionTitle}>Identity Verification</Text>
          </View>
          {!isVerified && (
            <View style={styles.warningBanner}>
               <AlertCircle size={16} color="#B45309" />
               <Text style={styles.warningBannerText}>Complete verification to build trust and unlock features</Text>
            </View>
          )}
          <View style={styles.card}>
             <VerificationItem label="PAN Card" description="Permanent Account Number" verified={panVerified} onVerify={() => handleVerifyDocument('PAN')} />
             <View style={styles.divider} />
             <VerificationItem label="Aadhaar Card" description="Unique Identification" verified={aadhaarVerified} onVerify={() => handleVerifyDocument('Aadhaar')} />
             <View style={styles.divider} />
             <VerificationItem label="Address Proof" description="Utility bill or rental agreement" verified={addressVerified} onVerify={() => handleVerifyDocument('Address')} isUpload />
          </View>
        </View>

        <View style={styles.divider} />

        {/* Privacy Settings */}
        <View style={styles.section}>
           <View style={styles.sectionHeader}>
            <Eye size={20} color="#4B5563" /><Text style={styles.sectionTitle}>Privacy Settings</Text>
          </View>
           <View style={styles.card}>
              <SettingSwitchItem
                title="Profile visibility" description="Allow hosts to see your profile"
                value={profileVisibility} onValueChange={setProfileVisibility}
              />
           </View>
            <View style={styles.card}>
              <SettingSwitchItem
                title="Show verification badge" description="Display verified badge on profile"
                value={isVerified} onValueChange={() => {}} disabled // Cannot toggle this directly
              />
           </View>
        </View>

        <View style={styles.divider} />

        {/* Blocked Users */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ban size={20} color="#4B5563" /><Text style={styles.sectionTitle}>Blocked Users</Text>
          </View>
          {blockedUsers.length === 0 ? (
            <View style={[styles.card, styles.centerTextCard]}><Text style={styles.mutedText}>No blocked users</Text></View>
          ) : (
            blockedUsers.map((user) => (
              <View key={user.id} style={[styles.card, styles.blockedUserCard]}>
                <View>
                  <Text style={styles.blockedUserName}>{user.name}</Text>
                  <Text style={styles.blockedUserDate}>Blocked on {user.blockedDate.toLocaleDateString('en-IN')}</Text>
                </View>
                <TouchableOpacity style={styles.unblockButton} onPress={() => handleUnblock(user.name)}>
                  <Text style={styles.unblockButtonText}>Unblock</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        <View style={styles.divider} />

        {/* Data Controls */}
        <View style={styles.section}>
           <Text style={styles.sectionTitle}>Data Controls</Text>
           <TouchableOpacity style={styles.card} onPress={() => setShowDataDialog(true)}>
              <View style={styles.dataControlRow}>
                <View>
                    <Text style={styles.dataControlTitle}>Download your data</Text>
                    <Text style={styles.dataControlDesc}>Get a copy of your personal info</Text>
                </View>
                <TouchableOpacity style={styles.requestButton} onPress={() => setShowDataDialog(true)}>
                    <Text style={styles.requestButtonText}>Request</Text>
                </TouchableOpacity>
              </View>
           </TouchableOpacity>
           <View style={[styles.card, styles.deleteCard]}>
               <View style={styles.dataControlRow}>
                <View>
                    <Text style={[styles.dataControlTitle, styles.deleteTitle]}>Delete account</Text>
                    <Text style={styles.dataControlDesc}>Permanently delete account and data</Text>
                </View>
                <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteData}>
                    <Text style={styles.deleteButtonText}>Delete</Text>
                </TouchableOpacity>
              </View>
           </View>
        </View>

        {/* Info Box */}
         <View style={styles.infoBanner}>
            <Shield size={16} color="#2563EB" />
            <View style={styles.infoBannerContent}>
                <Text style={styles.infoBannerTitle}>We take your privacy seriously</Text>
                <Text style={styles.infoListItem}>• Your data is encrypted and securely stored</Text>
                <Text style={styles.infoListItem}>• We never share info without consent</Text>
                <Text style={styles.infoListItem}>• You have full control over your data</Text>
            </View>
         </View>
      </ScrollView>

      {/* Download Data Modal */}
       <Modal visible={showDataDialog} transparent animationType="fade" onRequestClose={() => setShowDataDialog(false)}>
         <View style={styles.modalOverlay}>
           <View style={styles.modalContent}>
             <Text style={styles.modalTitle}>Download Your Data</Text>
             <Text style={styles.modalDescription}>We'll email a copy to your registered email address.</Text>
              <Text style={styles.modalListHeader}>Download includes:</Text>
              <Text style={styles.modalListItem}>• Profile information</Text>
              <Text style={styles.modalListItem}>• Booking history</Text>
              <Text style={styles.modalListItem}>• Messages and reviews</Text>
              <Text style={styles.modalNote}>This may take up to 48 hours.</Text>
             <View style={styles.modalActions}>
               <TouchableOpacity style={styles.modalButtonSecondary} onPress={() => setShowDataDialog(false)}>
                 <Text style={styles.modalButtonTextSecondary}>Cancel</Text>
               </TouchableOpacity>
               <TouchableOpacity style={styles.modalButtonPrimary} onPress={handleDownloadData}>
                 <Text style={styles.modalButtonTextPrimary}>Request</Text>
               </TouchableOpacity>
             </View>
           </View>
         </View>
       </Modal>
    </SafeAreaView>
  );
}

// --- Helper Components ---
interface VerificationItemProps { label: string; description: string; verified: boolean; onVerify: () => void; isUpload?: boolean;}
function VerificationItem({ label, description, verified, onVerify, isUpload = false }: VerificationItemProps) {
  return (
    <View style={styles.verificationItem}>
      <View style={styles.verificationText}>
         <FileText size={20} color="#6B7280" />
         <View style={styles.verificationLabels}>
            <Text style={styles.verificationLabel}>{label}</Text>
            <Text style={styles.verificationDescription}>{description}</Text>
         </View>
      </View>
      {verified ? (
        <View style={styles.verifiedBadge}>
            <CheckCircle size={12} color="#065F46" />
            <Text style={styles.verifiedBadgeText}>Verified</Text>
        </View>
      ) : (
        <TouchableOpacity style={styles.verifyButton} onPress={onVerify}>
            {isUpload && <Upload size={14} color="#111827" />}
            <Text style={styles.verifyButtonText}>{isUpload ? 'Upload' : 'Verify'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

interface SettingSwitchItemProps { title: string; description: string; value: boolean; onValueChange: (v: boolean) => void; disabled?: boolean;}
function SettingSwitchItem({title, description, value, onValueChange, disabled = false}: SettingSwitchItemProps) {
    return (
        <View style={styles.switchItemContainer}>
            <View style={styles.switchTextContainer}>
                <Text style={styles.switchTitle}>{title}</Text>
                <Text style={styles.switchDescription}>{description}</Text>
            </View>
             <Switch
                value={value} onValueChange={onValueChange} disabled={disabled}
                trackColor={{ false: '#E5E7EB', true: '#10B981' }} thumbColor="#ffffff"
                ios_backgroundColor="#E5E7EB"
            />
        </View>
    );
}

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
  section: { gap: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#111827' },
  card: { backgroundColor: 'white', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  warningBanner: {
    backgroundColor: '#FEF3C7', borderColor: '#FDE68A', borderWidth: 1, borderRadius: 8,
    padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  warningBannerText: { fontSize: 14, color: '#92400E', flex: 1 },
  verificationItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  verificationText: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  verificationLabels: { flex: 1 },
  verificationLabel: { fontSize: 16, fontWeight: '500' },
  verificationDescription: { fontSize: 12, color: '#6B7280' },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#D1FAE5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  verifiedBadgeText: { fontSize: 12, fontWeight: '500', color: '#065F46' },
  verifyButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: '#D1D5DB' },
  verifyButtonText: { fontSize: 14, fontWeight: '500', color: '#111827' },
  divider: { height: 1, backgroundColor: '#E5E7EB' },
  switchItemContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  switchTextContainer: { flex: 1, marginRight: 16},
  switchTitle: { fontSize: 16, fontWeight: '500', marginBottom: 2 },
  switchDescription: { fontSize: 14, color: '#6B7280' },
  centerTextCard: { alignItems: 'center' },
  mutedText: { fontSize: 14, color: '#6B7280' },
  blockedUserCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  blockedUserName: { fontSize: 16, fontWeight: '500' },
  blockedUserDate: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  unblockButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: '#D1D5DB' },
  unblockButtonText: { fontSize: 14, fontWeight: '500', color: '#111827' },
  dataControlRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dataControlTitle: { fontSize: 16, fontWeight: '500', marginBottom: 2 },
  dataControlDesc: { fontSize: 14, color: '#6B7280' },
  requestButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: '#D1D5DB' },
  requestButtonText: { fontSize: 14, fontWeight: '500', color: '#111827' },
  deleteCard: { borderColor: '#FECACA' },
  deleteTitle: { color: '#DC2626' },
  deleteButton: { backgroundColor: '#DC2626', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  deleteButtonText: { fontSize: 14, fontWeight: '500', color: 'white' },
   infoBanner: {
    backgroundColor: '#EFF6FF', borderColor: '#BFDBFE', borderWidth: 1, borderRadius: 8,
    padding: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 12,
  },
  infoBannerContent: { flex: 1, gap: 6 },
  infoBannerTitle: { fontSize: 14, fontWeight: '600', color: '#1E40AF' },
  infoListItem: { fontSize: 13, color: '#1D4ED8' },
   // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { backgroundColor: 'white', borderRadius: 12, padding: 20, width: '100%', gap: 16 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', textAlign: 'center' },
  modalDescription: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 8 },
  modalListHeader: { fontSize: 14, fontWeight: '500', marginBottom: 4},
  modalListItem: { fontSize: 14, color: '#6B7280', marginLeft: 16 },
  modalNote: { fontSize: 12, color: '#9CA3AF', marginTop: 8 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 8 },
  modalButtonPrimary: { backgroundColor: '#111827', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  modalButtonSecondary: { backgroundColor: '#F3F4F6', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  modalButtonTextPrimary: { color: 'white', fontWeight: 'bold' },
  modalButtonTextSecondary: { color: '#111827', fontWeight: 'bold' },
});