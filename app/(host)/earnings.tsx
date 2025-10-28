// app/(host)/earnings.tsx
import { useRouter } from 'expo-router';
import { DollarSign, Download, Landmark, TrendingUp } from 'lucide-react-native';
import React from 'react';
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Transaction {
  id: string; date: Date; listingName: string; amount: number;
  status: 'paid' | 'pending'; bookingCode: string;
}

const mockTransactions: Transaction[] = [
  { id: '1', date: new Date('2025-10-20'), listingName: 'Modern Studio', amount: 6600, status: 'paid', bookingCode: 'BK7X9K2L4M' },
  { id: '2', date: new Date('2025-10-18'), listingName: 'Beachfront Villa', amount: 27500, status: 'paid', bookingCode: 'BK3H8P1N6Q' },
  { id: '4', date: new Date('2025-10-28'), listingName: 'Modern Studio', amount: 8800, status: 'pending', bookingCode: 'BK2K5L7N9P' },
];
const monthlyEarnings = [
  { month: 'Jun', amount: 45000 }, { month: 'Jul', amount: 58000 }, { month: 'Aug', amount: 72000 },
  { month: 'Sep', amount: 65000 }, { month: 'Oct', amount: 85000 }, { month: 'Nov', amount: 45600 }
];

export default function HostEarningsScreen() {
  const router = useRouter();
  const nextPayout = 45600;
  const nextPayoutDate = new Date('2025-11-05');
  const lifetimeEarnings = 425000;
  const pendingAmount = mockTransactions.filter(t => t.status === 'pending').reduce((sum, t) => sum + t.amount, 0);
  const maxEarning = Math.max(...monthlyEarnings.map(e => e.amount), 1); // Avoid division by zero

  const handleDownloadStatement = () => Alert.alert('Download', 'Downloading statement...');
  const handleChangeBankAccount = () => router.push('/settings/payments'); // Navigate to payment settings

  return (
    <SafeAreaView style={styles.container}>
      {/* Custom Header */}
      <View style={styles.customHeader}>
         <View style={styles.headerPlaceholder} />{/* Left Placeholder */}
         <View style={styles.headerTitleContainer}>
             <Text style={styles.headerTitle}>Earnings</Text>
             <Text style={styles.headerSubtitle}>Track payouts and earnings</Text>
         </View>
         <View style={styles.headerPlaceholder} />{/* Right Placeholder */}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Summary Cards */}
        <View style={styles.summaryGrid}>
          <View style={[styles.summaryCard, styles.nextPayoutCard]}>
             <View style={styles.summaryHeader}>
                <View style={styles.summaryIconBgAlt}><DollarSign size={20} color="white" /></View>
                <View style={styles.summaryBadgeAlt}><Text style={styles.summaryBadgeTextAlt}>{nextPayoutDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}</Text></View>
             </View>
             <Text style={styles.summaryValueAlt}>₹{nextPayout.toLocaleString('en-IN')}</Text>
             <Text style={styles.summaryTitleAlt}>Next payout</Text>
          </View>
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
                <View style={styles.summaryIconBg}><TrendingUp size={20} color="#16A34A" /></View>
            </View>
            <Text style={styles.summaryValue}>₹{lifetimeEarnings.toLocaleString('en-IN')}</Text>
            <Text style={styles.summaryTitle}>Lifetime earnings</Text>
          </View>
        </View>

        {/* Pending Amount */}
        {pendingAmount > 0 && (
          <View style={styles.pendingCard}>
            <View>
              <Text style={styles.pendingTitle}>Pending</Text>
              <Text style={styles.pendingValue}>₹{pendingAmount.toLocaleString('en-IN')}</Text>
            </View>
             <View style={styles.summaryBadge}>
                <Text style={styles.summaryBadgeText}>{mockTransactions.filter(t => t.status === 'pending').length} transaction(s)</Text>
             </View>
          </View>
        )}

        {/* Monthly Earnings Chart */}
        <View style={styles.card}>
           <Text style={styles.sectionTitle}>Monthly Earnings</Text>
           <View style={styles.chartContainer}>
              {monthlyEarnings.map((data) => (
                <View key={data.month} style={styles.barItem}>
                    <View style={styles.barLabels}>
                        <Text style={styles.barMonth}>{data.month}</Text>
                        <Text style={styles.barAmount}>₹{(data.amount/1000).toFixed(0)}k</Text>
                    </View>
                    <View style={styles.barTrack}>
                        <View style={[styles.barFill, { width: `${(data.amount / maxEarning) * 100}%` }]} />
                    </View>
                </View>
              ))}
           </View>
        </View>

        {/* Recent Transactions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          {mockTransactions.map((t) => (
            <View key={t.id} style={styles.card}>
              <View style={styles.txHeader}>
                <View style={styles.txInfo}>
                    <Text style={styles.txListing} numberOfLines={1}>{t.listingName}</Text>
                    <Text style={styles.txDate}>{t.date.toLocaleDateString('en-IN', { day:'numeric', month: 'short', year: 'numeric' })}</Text>
                    <Text style={styles.txCode}>{t.bookingCode}</Text>
                </View>
                <View style={styles.txAmountContainer}>
                    <Text style={styles.txAmount}>₹{t.amount.toLocaleString('en-IN')}</Text>
                     <View style={[styles.summaryBadge, t.status === 'paid' ? styles.paidBadge : styles.pendingBadge]}>
                        <Text style={styles.summaryBadgeText}>{t.status}</Text>
                     </View>
                </View>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.divider} />

        {/* Bank Account Info */}
        <View style={styles.card}>
           <View style={styles.bankHeader}>
                <View style={styles.summaryIconBg}><Landmark size={20} color="#111827"/></View>
                <View style={styles.bankInfo}>
                    <Text style={styles.bankTitle}>Bank Account</Text>
                    <Text style={styles.bankDetails}>HDFC Bank **** 6789</Text>
                </View>
                <View style={styles.verifiedBadge}><Text style={styles.verifiedText}>Verified</Text></View>
           </View>
           <TouchableOpacity style={styles.changeBankButton} onPress={handleChangeBankAccount}>
             <Text style={styles.changeBankText}>Change bank account</Text>
           </TouchableOpacity>
        </View>

        {/* Download Statement */}
        <TouchableOpacity style={styles.downloadButton} onPress={handleDownloadStatement}>
            <Download size={16} color="#111827" />
            <Text style={styles.downloadText}>Download statement</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  customHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB', backgroundColor: '#FFFFFF',
  },
  headerPlaceholder: { width: 40 },
  headerTitleContainer: { alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#111827' },
  headerSubtitle: { fontSize: 14, color: '#6B7280', marginTop: 2 },
  scrollContent: { padding: 16, gap: 16, paddingBottom: 40 },
  summaryGrid: { flexDirection: 'row', gap: 12 },
  summaryCard: {
    flex: 1, backgroundColor: 'white', borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: '#E5E7EB', justifyContent: 'space-between', aspectRatio: 1.1,
  },
  nextPayoutCard: { backgroundColor: '#111827'},
  summaryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  summaryIconBg: { width: 40, height: 40, backgroundColor: '#F3F4F6', borderRadius: 20, justifyContent: 'center', alignItems: 'center'},
  summaryIconBgAlt: { width: 40, height: 40, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, justifyContent: 'center', alignItems: 'center'},
  summaryBadge: { backgroundColor: '#F3F4F6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  summaryBadgeText: { fontSize: 10, fontWeight: '500', color: '#4B5563'},
  summaryBadgeAlt: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  summaryBadgeTextAlt: { fontSize: 10, fontWeight: '500', color: 'white'},
  summaryValue: { fontSize: 22, fontWeight: 'bold' },
  summaryTitle: { fontSize: 14, color: '#6B7280' },
  summaryValueAlt: { fontSize: 22, fontWeight: 'bold', color: 'white' },
  summaryTitleAlt: { fontSize: 14, color: 'rgba(255,255,255,0.9)' },
  pendingCard: {
    backgroundColor: '#FFFBEB', borderColor: '#FDE68A', borderWidth: 1, borderRadius: 12, padding: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  pendingTitle: { fontSize: 14, color: '#92400E', marginBottom: 2 },
  pendingValue: { fontSize: 18, fontWeight: '600', color: '#92400E' },
  card: { backgroundColor: 'white', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  chartContainer: { gap: 12 },
  barItem: { gap: 4 },
  barLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  barMonth: { fontSize: 13, color: '#6B7280' },
  barAmount: { fontSize: 13, fontWeight: '500' },
  barTrack: { height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: '#111827', borderRadius: 4 },
  section: { marginTop: 12 }, // Reduced top margin
  txHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  txInfo: { flex: 1, marginRight: 8 },
  txListing: { fontSize: 14, fontWeight: '500', marginBottom: 2 },
  txDate: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  txCode: { fontSize: 12, backgroundColor: '#F3F4F6', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4, alignSelf: 'flex-start' },
  txAmountContainer: { alignItems: 'flex-end' },
  txAmount: { fontSize: 16, fontWeight: '600' },
  paidBadge: { backgroundColor: '#D1FAE5' }, // Green background
  pendingBadge: { backgroundColor: '#FEF3C7' }, // Yellow background
  divider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 16 },
  bankHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  bankInfo: { flex: 1 },
  bankTitle: { fontSize: 16, fontWeight: '600' },
  bankDetails: { fontSize: 14, color: '#6B7280' },
  verifiedBadge: { backgroundColor: '#D1FAE5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  verifiedText: { fontSize: 12, fontWeight: '500', color: '#065F46' },
  changeBankButton: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  changeBankText: { fontSize: 14, fontWeight: '500', color: '#111827' },
  downloadButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, gap: 8 },
  downloadText: { fontSize: 14, fontWeight: '500', color: '#111827' },
});