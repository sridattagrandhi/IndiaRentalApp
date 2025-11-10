// app/(host)/calendar.tsx
import { Stack } from 'expo-router';
import { Check, ChevronDown, ChevronLeft, ChevronRight, Settings } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CalendarCell, Listing, useListings } from '../context/ListingsContext';

type DayStatus = 'available' | 'booked' | 'blocked';

interface CalendarDay {
  iso: string;
  date: Date;
  status: DayStatus;
  price?: number;
  guestName?: string;
  bookingId?: string;
  isCurrentMonth: boolean;
  isToday: boolean;
}

const toISO = (d: Date) => {
  const x = new Date(d); x.setHours(0,0,0,0);
  return x.toISOString().slice(0,10);
};
const fromYMD = (y: number, m: number, d: number) => new Date(y, m, d, 0, 0, 0, 0);

export default function HostCalendarScreen() {
  const { listings, blockDates, unblockDates, upsertBooking } = useListings();

  // pick first listing with calendar by default
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedListingId && listings.length) {
      setSelectedListingId(listings[0].id);
    }
  }, [listings, selectedListingId]);

  // dropdown open/close
  const [pickerOpen, setPickerOpen] = useState(false);

  // UI state
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showAllListings, setShowAllListings] = useState(false);
  const [selectedDates, setSelectedDates] = useState<string[]>([]); // ISO strings

  const selectedListing: Listing | undefined = useMemo(
    () => listings.find(l => l.id === selectedListingId || ''),
    [listings, selectedListingId]
  );

  // Seed a couple of mock bookings the first time we open a listing with empty bookings
  useEffect(() => {
    if (!selectedListing) return;
    if ((selectedListing.bookings?.length ?? 0) > 0) return;

    const y = currentMonth.getFullYear();
    const m = currentMonth.getMonth();
    const b1s = toISO(fromYMD(y, m, 5));
    const b1e = toISO(fromYMD(y, m, 7));
    const b2s = toISO(fromYMD(y, m, 15));
    const b2e = toISO(fromYMD(y, m, 16));
    upsertBooking(selectedListing.id, { start: b1s, end: b1e, guestName: 'Amit P.' });
    upsertBooking(selectedListing.id, { start: b2s, end: b2e, guestName: 'Neha S.' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedListingId]);

  const monthDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const daysInMonth = lastDayOfMonth.getDate();
    const startDayOfWeek = firstDayOfMonth.getDay();

    const cells: CalendarDay[] = [];
    const todayISO = toISO(new Date());

    const prevMonthLast = new Date(year, month, 0).getDate();
    // leading
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonthLast - i);
      const iso = toISO(date);
      cells.push({
        iso, date, status: 'available', isCurrentMonth: false, isToday: iso === todayISO,
      });
    }

    // current month, merge from listing calendar
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const iso = toISO(date);
      const cell: CalendarCell | undefined = selectedListing?.calendar?.[iso];
      const status: DayStatus = cell?.status ?? 'available';
      const price = selectedListing?.pricePerNight ?? 0;
      cells.push({
        iso, date, status,
        price,
        guestName: cell?.guestName,
        bookingId: cell?.bookingId,
        isCurrentMonth: true,
        isToday: iso === todayISO,
      });
    }

    // trailing to fill 5 or 6 rows
    const gridCells = cells.length > 35 ? 42 : 35;
    const remaining = gridCells - cells.length;
    for (let i = 1; i <= remaining; i++) {
      const date = new Date(year, month + 1, i);
      const iso = toISO(date);
      cells.push({
        iso, date, status: 'available', isCurrentMonth: false, isToday: iso === todayISO,
      });
    }

    return cells;
  }, [currentMonth, selectedListing]);

  const handlePrevMonth = () =>
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  const handleNextMonth = () =>
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));

  const toggleDay = (d: CalendarDay) => {
    if (!d.isCurrentMonth) return;
    setSelectedDates(prev =>
      prev.includes(d.iso) ? prev.filter(x => x !== d.iso) : [...prev, d.iso]
    );
  };

  const doBlock = () => {
    if (!selectedListing) return;
    if (selectedDates.length === 0) {
      Alert.alert('No dates selected', 'Tap days to select them first.');
      return;
    }
    blockDates(selectedListing.id, selectedDates);
    setSelectedDates([]);
  };

  const doUnblock = () => {
    if (!selectedListing) return;
    if (selectedDates.length === 0) {
      Alert.alert('No dates selected', 'Tap days to select them first.');
      return;
    }
    unblockDates(selectedListing.id, selectedDates);
    setSelectedDates([]);
  };

  const handlePricingSettings = () => Alert.alert('Pricing Settings', 'Navigate to pricing…');

  const visibleListings = showAllListings ? listings : (selectedListing ? [selectedListing] : []);

  const currentLabel =
    selectedListing
      ? (selectedListing.unitName ? `${selectedListing.unitName} • ` : '') + selectedListing.title
      : 'Select Listing';

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.customHeader}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Calendar</Text>
          <Text style={styles.headerSub}>
            {selectedListing ? `${selectedListing.title}${selectedListing.unitName ? ` • ${selectedListing.unitName}` : ''}` : '—'}
          </Text>
        </View>
        <TouchableOpacity style={styles.headerButton} onPress={handlePricingSettings}>
          <Settings size={20} color="#111827" />
          <Text style={styles.headerButtonText}>Pricing</Text>
        </TouchableOpacity>
      </View>

      {/* Controls */}
      <View style={styles.controlsContainer}>
        {/* TRUE DROPDOWN */}
        <TouchableOpacity style={styles.dropdown} onPress={() => setPickerOpen(true)}>
          <Text numberOfLines={1} style={styles.dropdownText}>{currentLabel}</Text>
          <ChevronDown size={16} color="#6B7280" />
        </TouchableOpacity>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Show all listings</Text>
          <Switch value={showAllListings} onValueChange={setShowAllListings} trackColor={{ false: '#E5E7EB', true: '#10B981' }} thumbColor="#ffffff" ios_backgroundColor="#E5E7EB" />
        </View>

        <View style={styles.legend}>
          <View style={styles.legendItem}><View style={[styles.legendDot, styles.dotBooked]} /><Text style={styles.legendText}>Booked</Text></View>
          <View style={styles.legendItem}><View style={[styles.legendDot, styles.dotBlocked]} /><Text style={styles.legendText}>Blocked</Text></View>
          <View style={styles.legendItem}><View style={[styles.legendDot, styles.dotAvailable]} /><Text style={styles.legendText}>Available</Text></View>
        </View>

        {selectedDates.length > 0 && (
          <View style={styles.selectionBanner}>
            <Text style={styles.selectionText}>{selectedDates.length} date(s) selected</Text>
            <View style={styles.selectionActions}>
              <TouchableOpacity style={styles.blockButton} onPress={doBlock}><Text style={styles.blockButtonText}>Block</Text></TouchableOpacity>
              <TouchableOpacity style={styles.unblockButton} onPress={doUnblock}><Text style={styles.unblockButtonText}>Unblock</Text></TouchableOpacity>
              <TouchableOpacity style={styles.clearButton} onPress={() => setSelectedDates([])}><Text style={styles.clearButtonText}>Clear</Text></TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Month nav */}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={handlePrevMonth}><ChevronLeft size={24} color="#111827" /></TouchableOpacity>
          <Text style={styles.monthTitle}>{currentMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</Text>
          <TouchableOpacity onPress={handleNextMonth}><ChevronRight size={24} color="#111827" /></TouchableOpacity>
        </View>

        {/* One grid per visible listing */}
        {visibleListings.map((l) => (
          <View key={l.id} style={styles.gridWrap}>
            {visibleListings.length > 1 && (
              <Text style={styles.gridHeader} numberOfLines={1}>
                {(l.unitName ? `${l.unitName} • ` : '') + l.title}
              </Text>
            )}

            <View style={styles.calendarGrid}>
              {['S','M','T','W','T','F','S'].map((d, i) => (
                <Text key={`h-${l.id}-${i}`} style={styles.dayHeader}>{d}</Text>
              ))}
              {monthDays.map((day, idx) => {
                const cell = l.calendar?.[day.iso];
                const status = cell?.status ?? (day.isCurrentMonth ? day.status : 'available');
                const isSelected = selectedDates.includes(day.iso);
                let box = styles.dayCell;
                let text = styles.dayText;
                let bottomTextStyle = styles.dayPrice;
                let bottomText: string | null = null;

                if (!day.isCurrentMonth) {
                  box = styles.dayCellOutside;
                  text = styles.dayTextOutside;
                } else if (status === 'booked') {
                  box = styles.dayCellBooked;
                  bottomTextStyle = styles.dayGuestBooked;
                  bottomText = cell?.guestName ?? 'Booked';
                } else if (status === 'blocked') {
                  box = styles.dayCellBlocked;
                  bottomTextStyle = styles.dayTextBlocked;
                  bottomText = 'Blocked';
                } else {
                  bottomText = l.pricePerNight ? `₹${Math.round(l.pricePerNight/1000)}k` : undefined as any;
                }

                if (isSelected && day.isCurrentMonth) box = styles.dayCellSelected;
                if (day.isToday && day.isCurrentMonth) box = { ...(box || {}), ...styles.dayCellToday };

                return (
                  <TouchableOpacity
                    key={`${l.id}-${idx}`}
                    style={[styles.dayCellBase, box]}
                    onPress={() => toggleDay(day)}
                    disabled={!day.isCurrentMonth}
                  >
                    <Text style={text}>{day.date.getDate()}</Text>
                    {bottomText ? <Text style={bottomTextStyle} numberOfLines={1}>{bottomText}</Text> : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Dropdown modal */}
      <Modal visible={pickerOpen} animationType="fade" transparent onRequestClose={() => setPickerOpen(false)}>
        <TouchableOpacity activeOpacity={1} style={styles.modalBackdrop} onPress={() => setPickerOpen(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Select a listing</Text>
          <FlatList
            data={listings}
            keyExtractor={(it) => it.id}
            contentContainerStyle={styles.sheetList}
            renderItem={({ item }) => {
              const label = (item.unitName ? `${item.unitName} • ` : '') + item.title;
              const selected = item.id === selectedListingId;
              return (
                <TouchableOpacity
                  style={[styles.optionRow, selected && styles.optionRowSelected]}
                  onPress={() => {
                    setSelectedListingId(item.id);
                    setPickerOpen(false);
                  }}
                >
                  <Text style={[styles.optionText, selected && styles.optionTextSelected]} numberOfLines={1}>
                    {label}
                  </Text>
                  {selected && <Check size={16} color="#111827" />}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={<Text style={styles.muted}>No listings yet.</Text>}
          />
          <View style={styles.sheetFooter}>
            <TouchableOpacity style={styles.sheetCancel} onPress={() => setPickerOpen(false)}>
              <Text style={styles.sheetCancelText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },

  customHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB', backgroundColor: '#FFFFFF',
  },
  headerLeft: { gap: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  headerSub: { fontSize: 12, color: '#6B7280' },
  headerButton: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 4 },
  headerButtonText: { fontSize: 14, fontWeight: '500' },

  controlsContainer: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', gap: 12 },
  dropdown: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 12, height: 44 },
  dropdownText: { maxWidth: '90%' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  switchLabel: { fontSize: 16 },
  legend: { flexDirection: 'row', gap: 16, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 14, height: 14, borderRadius: 3, borderWidth: 1 },
  dotBooked: { backgroundColor: '#DCFCE7', borderColor: '#BBF7D0' },
  dotBlocked: { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' },
  dotAvailable: { backgroundColor: 'white', borderColor: '#E5E7EB' },
  legendText: { fontSize: 13, color: '#4B5563' },

  selectionBanner: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE', borderWidth: 1, borderRadius: 8, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  selectionText: { fontSize: 14, color: '#1E40AF', fontWeight: '500' },
  selectionActions: { flexDirection: 'row', gap: 8 },
  blockButton: { backgroundColor: '#111827', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  blockButtonText: { color: 'white', fontSize: 13, fontWeight: '500' },
  unblockButton: { backgroundColor: '#16A34A', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  unblockButtonText: { color: 'white', fontSize: 13, fontWeight: '600' },
  clearButton: { backgroundColor: 'white', borderWidth: 1, borderColor: '#D1D5DB', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  clearButtonText: { color: '#374151', fontSize: 13, fontWeight: '500' },

  scrollContent: { padding: 16, paddingBottom: 40 },
  monthNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  monthTitle: { fontSize: 18, fontWeight: '600' },

  gridWrap: { marginBottom: 18 },
  gridHeader: { marginBottom: 8, fontSize: 14, fontWeight: '700', color: '#111827' },

  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayHeader: { width: `${100/7}%`, textAlign: 'center', paddingVertical: 8, fontSize: 12, color: '#6B7280', fontWeight: '500' },

  dayCellBase: { width: `${100/7}%`, aspectRatio: 0.8, borderWidth: 0.5, borderColor: '#F3F4F6', padding: 4, justifyContent: 'space-between', alignItems: 'center' },
  dayCell: { backgroundColor: 'white' },
  dayCellOutside: { backgroundColor: '#F9FAFB' },
  dayCellBooked: { backgroundColor: '#F0FDF4' },
  dayCellBlocked: { backgroundColor: '#FFFBEB' },
  dayCellSelected: { borderWidth: 1.5, borderColor: '#3B82F6', backgroundColor: '#EFF6FF' },
  dayCellToday: { borderWidth: 1.5, borderColor: '#111827' },

  dayText: { fontSize: 13, textAlign: 'center' },
  dayTextOutside: { fontSize: 13, color: '#D1D5DB', textAlign: 'center' },
  dayPrice: { fontSize: 11, color: '#6B7280', textAlign: 'center', marginTop: 'auto' },
  dayTextBlocked: { fontSize: 11, color: '#92400E', textAlign: 'center', marginTop: 'auto', fontWeight: '500' },
  dayGuestBooked: { fontSize: 10, color: '#166534', textAlign: 'center', marginTop: 'auto', backgroundColor: '#BBF7D0', borderRadius: 4, paddingVertical: 1, paddingHorizontal: 4, fontWeight: '500', overflow: 'hidden' },

  // dropdown modal styles
  modalBackdrop: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.25)' },
  sheet: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
  sheetHandle: { alignSelf: 'center', width: 42, height: 5, borderRadius: 999, backgroundColor: '#E5E7EB', marginBottom: 8 },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: '#111827', textAlign: 'center', marginBottom: 8 },
  sheetList: { paddingBottom: 8 },
  optionRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB',
    paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, marginBottom: 8,
  },
  optionRowSelected: { borderColor: '#111827', backgroundColor: '#F9FAFB' },
  optionText: { fontSize: 15, color: '#111827' },
  optionTextSelected: { fontWeight: '700' },
  muted: { color: '#9CA3AF', textAlign: 'center', paddingVertical: 8 },
  sheetFooter: { paddingTop: 8, borderTopWidth: 1, borderTopColor: '#EEEFF3' },
  sheetCancel: { alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  sheetCancelText: { color: '#111827', fontWeight: '700' },
});
