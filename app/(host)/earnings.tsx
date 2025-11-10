// app/(host)/earnings.tsx
import * as Print from 'expo-print';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { DollarSign, Download, Landmark, TrendingUp } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

// ---------- Types ----------
type TxStatus = 'paid' | 'pending';
interface Transaction {
  id: string;
  date: Date;
  listingName: string;
  amount: number;
  status: TxStatus;
  bookingCode: string;
}
interface PeriodValue { period: string; amount: number; }

// ---------- Mock data (mirrors your example layout) ----------
const mockTransactions: Transaction[] = [
  { id: '1',  date: new Date('2025-11-08'), listingName: 'Beachfront Villa in Goa',       amount: 33000, status: 'pending', bookingCode: 'BK4M6N8P1Q' },
  { id: '2',  date: new Date('2025-11-05'), listingName: 'Modern Studio in Koramangala',  amount:  8800, status: 'paid',    bookingCode: 'BK2K5L7N9P' },
  { id: '3',  date: new Date('2025-10-28'), listingName: 'Cozy Cottage in Manali',        amount:  9600, status: 'paid',    bookingCode: 'BK9M2N4P8R' },
  { id: '4',  date: new Date('2025-10-20'), listingName: 'Modern Studio in Koramangala',  amount:  6600, status: 'paid',    bookingCode: 'BK7X9K2L4M' },
  { id: '5',  date: new Date('2025-10-18'), listingName: 'Beachfront Villa in Goa',       amount: 27500, status: 'paid',    bookingCode: 'BK3H8P1N6Q' },
  { id: '6',  date: new Date('2025-09-25'), listingName: 'Luxury Apartment in Mumbai',    amount: 15000, status: 'paid',    bookingCode: 'BK5N7P9Q2R' },
  { id: '7',  date: new Date('2025-09-18'), listingName: 'Modern Studio in Koramangala',  amount:  7200, status: 'paid',    bookingCode: 'BK6P8Q1R3S' },
  { id: '8',  date: new Date('2025-09-10'), listingName: 'Beachfront Villa in Goa',       amount: 29000, status: 'paid',    bookingCode: 'BK7Q9R2S4T' },
  { id: '9',  date: new Date('2025-08-28'), listingName: 'Cozy Cottage in Manali',        amount: 11000, status: 'paid',    bookingCode: 'BK8R1S3T5U' },
  { id: '10', date: new Date('2025-08-15'), listingName: 'Modern Studio in Koramangala',  amount:  6800, status: 'paid',    bookingCode: 'BK9S2T4U6V' },
  { id: '11', date: new Date('2025-08-05'), listingName: 'Luxury Apartment in Mumbai',    amount: 18000, status: 'paid',    bookingCode: 'BK1T3U5V7W' },
  { id: '12', date: new Date('2025-07-22'), listingName: 'Beachfront Villa in Goa',       amount: 31000, status: 'paid',    bookingCode: 'BK2U4V6W8X' },
];

const monthlyEarnings: PeriodValue[] = [
  { period: 'Nov 2025', amount: 41800 },
  { period: 'Oct 2025', amount: 43700 },
  { period: 'Sep 2025', amount: 51200 },
  { period: 'Aug 2025', amount: 35800 },
  { period: 'Jul 2025', amount: 31000 },
  { period: 'Jun 2025', amount: 45000 },
  { period: 'May 2025', amount: 38500 },
  { period: 'Apr 2025', amount: 42300 },
  { period: 'Mar 2025', amount: 39800 },
  { period: 'Feb 2025', amount: 36200 },
  { period: 'Jan 2025', amount: 41500 },
  { period: 'Dec 2024', amount: 52000 },
];

const yearlyEarnings: PeriodValue[] = [
  { period: '2025', amount: 248500 },
  { period: '2024', amount: 525000 },
  { period: '2023', amount: 410000 },
  { period: '2022', amount: 320000 },
  { period: '2021', amount: 245000 },
  { period: '2020', amount: 185000 },
  { period: '2019', amount: 142000 },
  { period: '2018', amount:  98000 },
];

// ---------- Helpers ----------
const INR = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const startOfYear = (d: Date) => new Date(d.getFullYear(), 0, 1);

function useSortedTx() {
  return useMemo(
    () => [...mockTransactions].sort((a, b) => b.date.getTime() - a.date.getTime()),
    []
  );
}

function computeKPIs(sortedTx: Transaction[]) {
  const today = new Date();
  const monthStart = startOfMonth(today);
  const yearStart = startOfYear(today);

  const paid = sortedTx.filter(t => t.status === 'paid');
  const pending = sortedTx.filter(t => t.status === 'pending');

  const totalPaid = paid.reduce((s, t) => s + t.amount, 0);
  const totalPending = pending.reduce((s, t) => s + t.amount, 0);
  const mtdPaid = paid.filter(t => t.date >= monthStart).reduce((s, t) => s + t.amount, 0);
  const ytdPaid = paid.filter(t => t.date >= yearStart).reduce((s, t) => s + t.amount, 0);
  const lifetimeEarnings = 1933500; // matches your example card
  const nextPayout = 41800;         // example
  const nextPayoutDate = new Date('2025-11-15');

  return {
    nextPayout,
    nextPayoutDate,
    lifetimeEarnings,
    totalPaid,
    totalPending,
    pendingCount: pending.length,
    mtdPaid,
    ytdPaid,
  };
}

// ---------- Screen ----------
export default function HostEarningsScreen() {
  const router = useRouter();
  const [viewType, setViewType] = useState<'monthly' | 'yearly'>('monthly');
  const [visibleTransactions, setVisibleTransactions] = useState(3);
  const [visiblePeriods, setVisiblePeriods] = useState(6);

  const sortedTx = useSortedTx();
  const {
    nextPayout,
    nextPayoutDate,
    lifetimeEarnings,
    totalPending,
    pendingCount,
    mtdPaid,
    ytdPaid,
  } = computeKPIs(sortedTx);

  const earningsData = viewType === 'monthly' ? monthlyEarnings : yearlyEarnings;
  const displayedEarnings = earningsData.slice(0, visiblePeriods);
  const hasMoreEarnings = visiblePeriods < earningsData.length;
  const maxEarning = Math.max(...earningsData.map(e => e.amount), 1);

  const displayedTx = sortedTx.slice(0, visibleTransactions);
  const hasMoreTx = visibleTransactions < sortedTx.length;

  const handleChangeBankAccount = () => router.push('/settings/payments');

  // ----- Download Statement (PDF) -----
  const handleDownloadStatement = async () => {
    try {
      const todayStr = new Date().toISOString().slice(0, 10);

      // Build rows (newest first)
      const txRows = sortedTx
        .map(t => {
          const d = t.date.toISOString().slice(0, 10);
          return `
            <tr>
              <td class="td">${d}</td>
              <td class="td">${t.listingName}</td>
              <td class="td code">${t.bookingCode}</td>
              <td class="td num">${INR(t.amount)}</td>
              <td class="td status ${t.status}">${t.status.toUpperCase()}</td>
            </tr>
          `;
        })
        .join('');

      // Period bars for current tab
      const periodBars = earningsData
        .map(m => {
          const pct = Math.round((m.amount / maxEarning) * 100);
          return `
            <div class="bar-row">
              <div class="bar-meta">
                <div class="bar-month">${m.period}</div>
                <div class="bar-amt">${INR(m.amount)}</div>
              </div>
              <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
            </div>
          `;
        })
        .join('');

        const maxYear = Math.max(...yearlyEarnings.map(e => e.amount), 1);
        const yearlyBars = yearlyEarnings
          .map(y => {
            const pct = Math.round((y.amount / maxYear) * 100);
            return `
              <div class="bar-row">
                <div class="bar-meta">
                  <div class="bar-month">${y.period}</div>
                  <div class="bar-amt">${INR(y.amount)}</div>
                </div>
                <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
              </div>
            `;
          })
          .join('');

      // Totals for mini-summary
      const paidTotal = sortedTx.filter(t => t.status === 'paid').reduce((s, t) => s + t.amount, 0);

      const html = `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8"/>
    <title>Earnings Statement</title>
    <style>
      :root { --ink:#111827; --muted:#6B7280; --line:#E5E7EB; --bg:#ffffff; --chip:#F3F4F6; --brand:#111827; }
      * { box-sizing:border-box; }
      body { font-family: -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif; color:var(--ink); background:var(--bg); margin:0; padding:24px; }
      h1 { margin:0 0 4px 0; font-size:20px; }
      .muted { color:var(--muted); font-size:12px; }
      .grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
      .kpi { border:1px solid var(--line); border-radius:12px; padding:14px; background:#fff; }
      .kpi .label { font-size:12px; color:var(--muted); margin-bottom:6px; }
      .kpi .value { font-size:18px; font-weight:700; }
      .kpi .sub { margin-top:4px; font-size:12px; color:var(--muted); }
      .pill { display:inline-block; background:var(--brand); color:#fff; padding:8px 10px; border-radius:10px; font-weight:700; font-size:14px; }
      .chip { display:inline-block; background:#EEF2FF; border:1px solid #DBEAFE; color:#1F2937; padding:6px 10px; border-radius:999px; font-size:12px; font-weight:700; margin-right:6px; }
      .section { margin-top:18px; }
      .card { border:1px solid var(--line); border-radius:12px; padding:16px; background:#fff; }
      .row { display:flex; justify-content:space-between; align-items:center; gap:10px; }
      .bar-row { margin-bottom:10px; }
      .bar-meta { display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px; }
      .bar-track { height:8px; background:#F3F4F6; border-radius:4px; overflow:hidden; }
      .bar-fill { height:100%; background:var(--brand); }
      table { width:100%; border-collapse:collapse; font-size:12px; }
      th { text-align:left; padding:8px; border-bottom:1px solid #ddd; background:#fafafa; }
      .td { padding:8px; border-bottom:1px solid #eee; }
      .num { text-align:right; }
      .code { font-family: ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; background:var(--chip); padding:2px 6px; border-radius:4px; display:inline-block; }
      .status { font-size:11px; font-weight:700; padding:2px 6px; border-radius:999px; display:inline-block; }
      .status.paid { background:#D1FAE5; color:#065F46; }
      .status.pending { background:#FEF3C7; color:#92400E; }
    </style>
  </head>
  <body>
    <h1>Earnings Statement</h1>
    <div class="muted">Generated on ${todayStr}</div>

    <!-- KPIs Row -->
    <div class="section grid">
      <div class="kpi"><div class="label">Next payout</div><div class="value">${INR(nextPayout)}</div><div class="sub">${nextPayoutDate.toLocaleDateString('en-IN', { month:'short', day:'numeric', year:'numeric' })}</div></div>
      <div class="kpi"><div class="label">Lifetime earnings</div><div class="value">${INR(lifetimeEarnings)}</div><div class="sub">Across ${sortedTx.length} transaction(s)</div></div>
      <div class="kpi"><div class="label">Paid total</div><div class="value">${INR(paidTotal)}</div><div class="sub">YTD (paid): ${INR(ytdPaid)}</div></div>
      <div class="kpi"><div class="label">Pending total</div><div class="value">${INR(totalPending)}</div><div class="sub">${pendingCount} pending</div></div>
    </div>

    <!-- Current Tab Overview -->
    <div class="section card">
      <div class="row">
        <div class="pill">Earnings Overview · ${viewType === 'monthly' ? 'Monthly' : 'Yearly'}</div>
        <div>
          <span class="chip">YTD (paid): ${INR(ytdPaid)}</span>
          <span class="chip">MTD (paid): ${INR(mtdPaid)}</span>
        </div>
      </div>
      <div style="height:8px"></div>
      ${periodBars}
    </div>

    <div class="section card">
      <div class="row">
        <div class="pill">Yearly earnings breakdown</div>
      </div>
      <div style="height:8px"></div>
      ${yearlyBars}
    </div>

    <!-- Recent Transactions (newest first) -->
    <div class="section card">
      <div class="pill">Recent transactions</div>
      <table style="margin-top:10px;">
        <thead>
          <tr>
            <th>Date</th><th>Listing</th><th>Booking</th><th class="num">Amount (INR)</th><th>Status</th>
          </tr>
        </thead>
        <tbody>${txRows || `<tr><td class="td" colspan="5">No transactions found.</td></tr>`}</tbody>
      </table>
      <div class="row" style="margin-top:10px;"><div><strong>Paid total:</strong> ${INR(paidTotal)}</div><div><strong>Pending total:</strong> ${INR(totalPending)}</div></div>
    </div>

    <!-- Bank -->
    <div class="section card">
      <div class="pill">Payout account</div>
      <div style="height:8px"></div>
      <div><strong>Bank:</strong> HDFC Bank · <span class="muted">Account: **** 6789 · Verified</span></div>
    </div>
  </body>
</html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Share earnings statement' });
      } else {
        Alert.alert('Saved', `PDF saved to:\n${uri}`);
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to generate statement');
    }
  };

  // ----- UI -----
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Earnings</Text>
        <Text style={styles.headerSub}>Track your payouts and earnings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <View style={[styles.card, styles.summaryCardBase, styles.gradientCard]}>
            <View style={styles.cardTopRow}>
              <View style={styles.iconCircleLight}><DollarSign size={20} color="#ffffff" /></View>
              <View style={styles.badgeLight}><Text style={styles.badgeLightText}>
                {new Date('2025-11-15').toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
              </Text></View>
            </View>
            <Text style={[styles.valueLight, { marginBottom: 6 }]}>{INR(nextPayout)}</Text>
            <Text style={styles.labelLight}>Next payout</Text>
          </View>

          <View style={[styles.card, styles.summaryCardBase]}>
            <View style={styles.cardTopRow}>
              <View style={styles.iconCircleGreen}><TrendingUp size={20} color="#16A34A" /></View>
            </View>
            <Text style={[styles.value, { marginBottom: 6 }]}>{INR(lifetimeEarnings)}</Text>
            <Text style={styles.label}>Lifetime earnings</Text>
          </View>
        </View>

        {/* Pending */}
        {totalPending > 0 && (
          <View style={[styles.card, styles.pending]}>
            <View>
              <Text style={styles.pendingTitle}>Pending</Text>
              <Text style={styles.pendingValue}>{INR(totalPending)}</Text>
            </View>
            <View style={styles.badge}><Text style={styles.badgeText}>{pendingCount} transaction(s)</Text></View>
          </View>
        )}

        {/* Tabs + Earnings Overview */}
        <View style={styles.card}>
          <View style={styles.tabsRow}>
            <Text style={styles.sectionTitle}>Earnings Overview</Text>
            <View style={styles.tabs}>
              <TouchableOpacity
                onPress={() => { setViewType('monthly'); setVisiblePeriods(6); }}
                style={[styles.tabBtn, viewType === 'monthly' && styles.tabBtnActive]}
              >
                <Text style={[styles.tabText, viewType === 'monthly' && styles.tabTextActive]}>Monthly</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { setViewType('yearly'); setVisiblePeriods(6); }}
                style={[styles.tabBtn, viewType === 'yearly' && styles.tabBtnActive]}
              >
                <Text style={[styles.tabText, viewType === 'yearly' && styles.tabTextActive]}>Yearly</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* MTD / YTD chips */}
          <View style={styles.kpiChips}>
            <View style={styles.kpiChip}><Text style={styles.kpiChipText}>YTD (paid) {INR(ytdPaid)}</Text></View>
            <View style={styles.kpiChip}><Text style={styles.kpiChipText}>MTD (paid) {INR(mtdPaid)}</Text></View>
          </View>

          {/* Bars */}
          <View style={{ gap: 12 }}>
            {displayedEarnings.map(item => (
              <View key={item.period} style={{ gap: 4 }}>
                <View style={styles.barLabels}>
                  <Text style={styles.barPeriod}>{item.period}</Text>
                  <Text style={styles.barAmount}>{INR(item.amount)}</Text>
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${(item.amount / maxEarning) * 100}%` }]} />
                </View>
              </View>
            ))}

            {hasMoreEarnings && (
              <TouchableOpacity
                onPress={() => setVisiblePeriods(v => Math.min(v + 6, earningsData.length))}
                style={styles.ghostBtn}
              >
                <Text style={styles.ghostBtnText}>
                  View more {viewType === 'monthly' ? 'months' : 'years'} ({earningsData.length - visiblePeriods} remaining)
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Recent Transactions (newest first) */}
        <View style={{ gap: 12 }}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          {displayedTx.map(t => (
            <View key={t.id} style={styles.card}>
              <View style={styles.txRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Text style={{ fontWeight: '600' }} numberOfLines={1}>{t.listingName}</Text>
                    <View style={[styles.badge, t.status === 'paid' ? styles.badgePaid : styles.badgePending]}>
                      <Text style={[styles.badgeText, t.status === 'paid' ? styles.badgePaidText : styles.badgePendingText]}>
                        {t.status}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.mutedSmall}>
                    {t.date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </Text>
                  <Text style={styles.code}>{t.bookingCode}</Text>
                </View>
                <Text style={styles.txAmount}>{INR(t.amount)}</Text>
              </View>
            </View>
          ))}

          {hasMoreTx && (
            <TouchableOpacity
              onPress={() => setVisibleTransactions(v => Math.min(v + 5, sortedTx.length))}
              style={[styles.btnOutline]}
            >
              <Text style={styles.btnOutlineText}>View more ({sortedTx.length - visibleTransactions} remaining)</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Bank card */}
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 10 }}>
            <View style={styles.iconCircle}><Landmark size={20} color="#111827" /></View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '600' }}>Bank Account</Text>
              <Text style={styles.mutedSmall}>HDFC Bank **** 6789</Text>
              <Text style={styles.mutedSmall}>Priya Sharma</Text>
            </View>
            <View style={[styles.badge, styles.badgeVerified]}><Text style={[styles.badgeText, styles.badgeVerifiedText]}>Verified</Text></View>
          </View>

          <TouchableOpacity onPress={handleChangeBankAccount} style={[styles.btnOutline]}>
            <Text style={styles.btnOutlineText}>Change bank account</Text>
          </TouchableOpacity>
        </View>

        {/* Download */}
        <TouchableOpacity onPress={handleDownloadStatement} style={[styles.btnOutline, styles.downloadBtn]}>
          <Download size={16} color="#111827" />
          <Text style={[styles.btnOutlineText, { fontWeight: '700' }]}>Download statement</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------- Styles ----------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },

  header: { backgroundColor: '#FFFFFF', borderBottomColor: '#E5E7EB', borderBottomWidth: 1, padding: 16 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#111827' },
  headerSub: { fontSize: 12, color: '#6B7280' },

  content: { padding: 16, gap: 16 },

  // Cards
  card: { backgroundColor: '#FFFFFF', borderColor: '#E5E7EB', borderWidth: 1, borderRadius: 12, padding: 16 },

  summaryCardBase: {
    flex: 1,                 // 🔑 equal width
    minHeight: 160,          // 🔑 equal height (bump if you want them taller)
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderRadius: 20,
    // subtle shadow
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
    overflow: 'hidden',      // keeps corners perfectly rounded on iOS
  },


  // (Optionally darken the gradient card a bit for contrast)
  gradientCard: {
    backgroundColor: '#0F172A',   // slightly darker than before
    borderColor: '#0F172A',
  },

  // Summary row
  summaryRow: { flexDirection: 'row', columnGap: 12, alignItems: 'stretch' },
  iconCircleLight: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  badgeLight: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeLightText: { color: '#FFFFFF', fontSize: 11, fontWeight: '600' },
  valueLight: { color: '#FFFFFF', fontSize: 26, fontWeight: '800' }, // was 22
  labelLight: { color: 'rgba(255,255,255,0.9)', fontSize: 13 },

  iconCircleGreen: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center' },
  iconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },

  value: { fontSize: 26, fontWeight: '800', color: '#111827' },       // was 22
  label: { color: '#6B7280', fontSize: 13 },

  // Pending
  pending: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pendingTitle: { color: '#92400E', fontWeight: '600', marginBottom: 2 },
  pendingValue: { color: '#92400E', fontSize: 18, fontWeight: '700' },

  // Tabs bar
  tabsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  tabs: { flexDirection: 'row', backgroundColor: '#F3F4F6', padding: 4, borderRadius: 999, gap: 6 },
  tabBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999 },
  tabBtnActive: { backgroundColor: '#FFFFFF' },
  tabText: { color: '#374151', fontWeight: '600', fontSize: 12 },
  tabTextActive: { color: '#111827' },

  // KPI chips
  kpiChips: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  kpiChip: { backgroundColor: '#EEF2FF', borderColor: '#DBEAFE', borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  kpiChipText: { color: '#1F2937', fontWeight: '700', fontSize: 12 },

  // Bars
  barLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  barPeriod: { fontSize: 12, color: '#6B7280' },
  barAmount: { fontSize: 12, fontWeight: '600', color: '#111827' },
  barTrack: { height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: '#111827' },

  // Transaction cards
  txRow: { flexDirection: 'row', justifyContent: 'space-between' },
  mutedSmall: { color: '#6B7280', fontSize: 12, marginBottom: 4 },
  code: { fontSize: 12, backgroundColor: '#F3F4F6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start' },
  txAmount: { fontSize: 16, fontWeight: '700', color: '#111827' },

  // Badges
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: '#F3F4F6' },
  badgeText: { fontSize: 10, fontWeight: '700', color: '#4B5563' },
  badgePaid: { backgroundColor: '#D1FAE5' },
  badgePaidText: { color: '#065F46' },
  badgePending: { backgroundColor: '#FEF3C7' },
  badgePendingText: { color: '#92400E' },
  badgeVerified: { backgroundColor: '#DCFCE7' },
  badgeVerifiedText: { color: '#065F46', fontWeight: '700' },

  // Buttons
  btnOutline: { borderColor: '#E5E7EB', borderWidth: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  btnOutlineText: { color: '#111827', fontWeight: '600' },
  ghostBtn: { alignItems: 'center', paddingVertical: 8 },
  ghostBtnText: { color: '#111827', opacity: 0.8, fontWeight: '600' },
  downloadBtn: { flexDirection: 'row', gap: 8, marginTop: 4 },

  // Top rows
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },

  sectionTitle: {
    fontSize: 16,      // or 18 to match earlier mock
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,   // add/remove as you like
  },
});
