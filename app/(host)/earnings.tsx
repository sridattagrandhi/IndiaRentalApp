// app/(host)/earnings.tsx
import * as Print from 'expo-print';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
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

// ---- helper: collect all the stats we want to show in the PDF ----
const computeEarningsStats = () => {
  const paid = mockTransactions.filter(t => t.status === 'paid');
  const pending = mockTransactions.filter(t => t.status === 'pending');

  const totalsByListing = mockTransactions.reduce<Record<string, { paid: number; pending: number; count: number }>>(
    (acc, t) => {
      if (!acc[t.listingName]) acc[t.listingName] = { paid: 0, pending: 0, count: 0 };
      if (t.status === 'paid') acc[t.listingName].paid += t.amount;
      else acc[t.listingName].pending += t.amount;
      acc[t.listingName].count += 1;
      return acc;
    },
    {}
  );

  const totalPaid = paid.reduce((s, t) => s + t.amount, 0);
  const totalPending = pending.reduce((s, t) => s + t.amount, 0);
  const totalBookings = mockTransactions.length;
  const avgBooking = totalBookings ? Math.round(mockTransactions.reduce((s, t) => s + t.amount, 0) / totalBookings) : 0;

  // Monthly best/worst
  const bestMonth = monthlyEarnings.reduce((best, m) => (m.amount > best.amount ? m : best), monthlyEarnings[0]);
  const worstMonth = monthlyEarnings.reduce((worst, m) => (m.amount < worst.amount ? m : worst), monthlyEarnings[0]);
  const ytd = monthlyEarnings.reduce((s, m) => s + m.amount, 0);

  return {
    totalsByListing,
    totalPaid,
    totalPending,
    totalBookings,
    avgBooking,
    bestMonth,
    worstMonth,
    ytd,
    monthlyMax: Math.max(...monthlyEarnings.map(m => m.amount), 1),
  };
};


export default function HostEarningsScreen() {
  const router = useRouter();
  const nextPayout = 45600;
  const nextPayoutDate = new Date('2025-11-05');
  const lifetimeEarnings = 425000;
  const pendingAmount = mockTransactions.filter(t => t.status === 'pending').reduce((sum, t) => sum + t.amount, 0);
  const maxEarning = Math.max(...monthlyEarnings.map(e => e.amount), 1); // Avoid division by zero

  /** Fake statement generator (frontend-only) */
  const handleDownloadStatement = async () => {
  try {
    const {
      totalsByListing,
      totalPaid,
      totalPending,
      totalBookings,
      avgBooking,
      bestMonth,
      worstMonth,
      ytd,
      monthlyMax,
    } = computeEarningsStats();

    const today = new Date().toISOString().slice(0, 10);
    const currency = (n: number) => `₹${n.toLocaleString('en-IN')}`;

    // rows for the Recent Transactions table
    const rows = mockTransactions
      .map(t => {
        const d = t.date.toISOString().slice(0, 10);
        return `
          <tr>
            <td class="td">${d}</td>
            <td class="td">${t.listingName}</td>
            <td class="td code">${t.bookingCode}</td>
            <td class="td num">${currency(t.amount)}</td>
            <td class="td status ${t.status}">${t.status.toUpperCase()}</td>
          </tr>
        `;
      })
      .join('');

    // per-listing breakdown
    const listingRows = Object.entries(totalsByListing)
      .map(([name, v]) => {
        return `
          <tr>
            <td class="td">${name}</td>
            <td class="td num">${currency(v.paid)}</td>
            <td class="td num">${currency(v.pending)}</td>
            <td class="td num">${v.count}</td>
          </tr>
        `;
      })
      .join('');

    // monthly earnings bars (simple CSS bars inside the PDF)
    const monthlyBars = monthlyEarnings
      .map(m => {
        const pct = Math.round((m.amount / monthlyMax) * 100);
        return `
          <div class="bar-row">
            <div class="bar-meta">
              <div class="bar-month">${m.month}</div>
              <div class="bar-amt">${currency(m.amount)}</div>
            </div>
            <div class="bar-track">
              <div class="bar-fill" style="width:${pct}%;"></div>
            </div>
          </div>
        `;
      })
      .join('');

    const html = `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8"/>
    <title>Earnings Statement</title>
    <style>
      :root {
        --ink:#111827; --muted:#6B7280; --line:#E5E7EB;
        --bg:#ffffff; --chip:#F3F4F6; --ok:#16A34A; --warn:#F59E0B;
        --brand:#111827;
      }
      * { box-sizing:border-box; }
      body { font-family: -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif; color:var(--ink); background:var(--bg); margin:0; padding:24px; }
      h1 { margin:0 0 4px 0; font-size:20px; }
      .muted { color:var(--muted); font-size:12px; }
      .section { margin-top:18px; }
      .card { border:1px solid var(--line); border-radius:12px; padding:16px; background:#fff; }
      .grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
      .kpi { border:1px solid var(--line); border-radius:12px; padding:14px; background:#fff; }
      .kpi .label { font-size:12px; color:var(--muted); margin-bottom:6px; }
      .kpi .value { font-size:18px; font-weight:700; }
      .kpi .sub { margin-top:4px; font-size:12px; color:var(--muted); }

      table { width:100%; border-collapse:collapse; font-size:12px; }
      th { text-align:left; padding:8px; border-bottom:1px solid #ddd; background: #fafafa; }
      .td { padding:8px; border-bottom:1px solid #eee; }
      .num { text-align:right; }
      .code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace; background:var(--chip); padding:2px 6px; border-radius:4px; display:inline-block; }
      .status { font-size:11px; font-weight:700; padding:2px 6px; border-radius:999px; display:inline-block; }
      .status.paid { background:#D1FAE5; color:#065F46; }
      .status.pending { background:#FEF3C7; color:#92400E; }

      .summary { display:flex; justify-content:space-between; border-top:1px solid var(--line); margin-top:10px; padding-top:10px; }
      .summary div { display:flex; gap:10px; }

      .bar-row { margin-bottom:10px; }
      .bar-meta { display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px; }
      .bar-track { height:8px; background:#F3F4F6; border-radius:4px; overflow:hidden; }
      .bar-fill { height:100%; background:var(--brand); }

      .pill { background:var(--brand); color:#fff; padding:10px 12px; border-radius:12px; font-size:14px; font-weight:700; display:inline-block; }
      .row { display:flex; gap:12px; align-items:center; }
      .spacer { height:6px; }
    </style>
  </head>
  <body>
    <h1>Earnings Statement</h1>
    <div class="muted">Generated on ${today}</div>

    <!-- KPIs Row -->
    <div class="section grid">
      <div class="kpi">
        <div class="label">Next payout</div>
        <div class="value">${currency(nextPayout)}</div>
        <div class="sub">${nextPayoutDate.toLocaleDateString('en-IN', { month:'short', day:'numeric', year:'numeric' })}</div>
      </div>
      <div class="kpi">
        <div class="label">Lifetime earnings</div>
        <div class="value">${currency(lifetimeEarnings)}</div>
        <div class="sub">Across ${totalBookings} booking${totalBookings === 1 ? '' : 's'}</div>
      </div>
      <div class="kpi">
        <div class="label">Paid total</div>
        <div class="value">${currency(totalPaid)}</div>
        <div class="sub">Avg per booking: ${currency(avgBooking)}</div>
      </div>
      <div class="kpi">
        <div class="label">Pending total</div>
        <div class="value">${currency(totalPending)}</div>
        <div class="sub">${mockTransactions.filter(t=>t.status==='pending').length} pending</div>
      </div>
    </div>

    <!-- Monthly Earnings -->
    <div class="section card">
      <div class="row">
        <div class="pill">Monthly earnings</div>
        <div class="muted">YTD: ${currency(ytd)}</div>
      </div>
      <div class="spacer"></div>
      ${monthlyBars}
      <div class="summary">
        <div><strong>Best month:</strong> ${bestMonth.month} (${currency(bestMonth.amount)})</div>
        <div><strong>Lowest month:</strong> ${worstMonth.month} (${currency(worstMonth.amount)})</div>
      </div>
    </div>

    <!-- Per-listing Breakdown -->
    <div class="section card">
      <div class="pill">Per-listing breakdown</div>
      <table style="margin-top:10px;">
        <thead>
          <tr>
            <th>Listing</th>
            <th class="num">Paid</th>
            <th class="num">Pending</th>
            <th class="num">Bookings</th>
          </tr>
        </thead>
        <tbody>
          ${listingRows || `<tr><td class="td" colspan="4">No listings yet.</td></tr>`}
        </tbody>
      </table>
    </div>

    <!-- Recent Transactions -->
    <div class="section card">
      <div class="pill">Recent transactions</div>
      <table style="margin-top:10px;">
        <thead>
          <tr>
            <th>Date</th>
            <th>Listing</th>
            <th>Booking</th>
            <th class="num">Amount (INR)</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${rows || `<tr><td class="td" colspan="5">No transactions found.</td></tr>`}
        </tbody>
      </table>
      <div class="summary">
        <div><strong>Paid total:</strong> ${currency(totalPaid)}</div>
        <div><strong>Pending total:</strong> ${currency(totalPending)}</div>
      </div>
    </div>

    <!-- Bank -->
    <div class="section card">
      <div class="pill">Payout account</div>
      <div class="spacer"></div>
      <div class="row" style="justify-content:space-between;">
        <div>
          <div><strong>Bank:</strong> HDFC Bank</div>
          <div class="muted">Account: **** 6789 · Verified</div>
        </div>
      </div>
    </div>
  </body>
</html>
    `;

    const { uri } = await Print.printToFileAsync({ html });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        UTI: 'com.adobe.pdf',
        dialogTitle: 'Share earnings statement',
      });
    } else {
      Alert.alert('Saved', `PDF saved to:\n${uri}`);
    }
  } catch (err: any) {
    Alert.alert('Error', err?.message ?? 'Failed to generate statement');
  }
};




  const handleChangeBankAccount = () => router.push('/settings/payments');

  return (
    <SafeAreaView style={styles.container}>
      {/* Custom Header */}
      <View style={styles.customHeader}>
         <View style={styles.headerPlaceholder} />
         <View style={styles.headerTitleContainer}>
             <Text style={styles.headerTitle}>Earnings</Text>
             <Text style={styles.headerSubtitle}>Track payouts and earnings</Text>
         </View>
         <View style={styles.headerPlaceholder} />
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
        <View className="section">
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

// --- Styles (unchanged from your base except for this file’s logic) ---
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
  section: { marginTop: 12 },
  txHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  txInfo: { flex: 1, marginRight: 8 },
  txListing: { fontSize: 14, fontWeight: '500', marginBottom: 2 },
  txDate: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  txCode: { fontSize: 12, backgroundColor: '#F3F4F6', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4, alignSelf: 'flex-start' },
  txAmountContainer: { alignItems: 'flex-end' },
  txAmount: { fontSize: 16, fontWeight: '600' },
  paidBadge: { backgroundColor: '#D1FAE5' },
  pendingBadge: { backgroundColor: '#FEF3C7' },
  divider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 16 },
  bankHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bankInfo: { flex: 1 },
  bankTitle: { fontSize: 16, fontWeight: '600' },
  bankDetails: { color: '#6B7280', marginTop: 2 },
  verifiedBadge: { backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  verifiedText: { color: '#065F46', fontWeight: '600', fontSize: 12 },
  changeBankButton: { marginTop: 12, borderWidth: 1, borderColor: '#E5E7EB', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  changeBankText: { color: '#111827', fontWeight: '600' },
  downloadButton: {
    marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderWidth: 1, borderColor: '#E5E7EB', paddingVertical: 12, borderRadius: 10, backgroundColor: '#FFFFFF'
  },
  downloadText: { color: '#111827', fontWeight: '700' },
});
