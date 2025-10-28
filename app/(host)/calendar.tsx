// app/(host)/calendar.tsx
import { Stack, useRouter } from 'expo-router';
import { ChevronDown, ChevronLeft, ChevronRight, Settings } from 'lucide-react-native';
import React, { useState } from 'react';
import { Alert, SafeAreaView, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';

interface CalendarDay {
  date: Date; status: 'available' | 'booked' | 'blocked'; price?: number; guestName?: string;
  isCurrentMonth: boolean; isToday: boolean;
}

export default function HostCalendarScreen() {
  const router = useRouter();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedListing, setSelectedListing] = useState('1');
  const [showAllListings, setShowAllListings] = useState(false);
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);

  const listings = [
    { id: '1', name: 'Modern Studio in Koramangala' },
    { id: '2', name: 'Beachfront Villa in Goa' },
  ];

  const generateCalendarDays = (): CalendarDay[] => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const daysInMonth = lastDayOfMonth.getDate();
    const startDayOfWeek = firstDayOfMonth.getDay();

    const days: CalendarDay[] = [];
    const today = new Date(); today.setHours(0,0,0,0);

    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
        const date = new Date(year, month - 1, prevMonthLastDay - i);
        days.push({ date, status: 'available', isCurrentMonth: false, isToday: false });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dayOfMonth = date.getDate();
      let status: 'available' | 'booked' | 'blocked' = 'available';
      let price = 2200; let guestName;

      if ([5, 6, 7, 15, 16].includes(dayOfMonth)) { status = 'booked'; guestName = 'Amit P.'; }
      else if ([10, 11, 25].includes(dayOfMonth)) { status = 'blocked'; }
      const isToday = date.getTime() === today.getTime();

      days.push({ date, status, price, guestName, isCurrentMonth: true, isToday });
    }

     const gridCells = days.length > 35 ? 42 : 35;
     const remainingCells = gridCells - days.length;
     for (let i = 1; i <= remainingCells; i++) {
        const date = new Date(year, month + 1, i);
        days.push({ date, status: 'available', isCurrentMonth: false, isToday: false });
     }

    return days;
  };

  const calendarDays = generateCalendarDays();

  const handlePrevMonth = () => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  const handleNextMonth = () => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));

  const handleDayClick = (day: CalendarDay) => {
    if (!day.isCurrentMonth) return;
    const dateStr = day.date.toDateString();
    setSelectedDates(prev => prev.some(d => d.toDateString() === dateStr)
        ? prev.filter(d => d.toDateString() !== dateStr)
        : [...prev, day.date]
    );
  };

  const handleBlockDates = () => {
    if (selectedDates.length === 0) { Alert.alert('No Dates', 'Select dates to block.'); return; }
    Alert.alert('Block Dates?', `Block ${selectedDates.length} selected date(s)?`, [
        {text: 'Cancel', style: 'cancel'},
        {text: 'Block', onPress: () => { Alert.alert('Blocked'); setSelectedDates([]); }}
    ]);
  };

   const handlePricingSettings = () => Alert.alert('Pricing Settings', 'Navigate to pricing settings...');

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.customHeader}>
         <View style={styles.headerPlaceholder} />
         <Text style={styles.headerTitle}>Calendar</Text>
         <TouchableOpacity style={styles.headerButton} onPress={handlePricingSettings}>
            <Settings size={20} color="#111827"/>
            <Text style={styles.headerButtonText}>Pricing</Text>
         </TouchableOpacity>
      </View>

       <View style={styles.controlsContainer}>
            <TouchableOpacity style={styles.dropdownPlaceholder}>
                <Text>{listings.find(l=>l.id===selectedListing)?.name || 'Select Listing'}</Text>
                <ChevronDown size={16} color="#6B7280"/>
            </TouchableOpacity>
            <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Show all listings</Text>
                <Switch value={showAllListings} onValueChange={setShowAllListings} trackColor={{ false: '#E5E7EB', true: '#10B981' }} thumbColor="#ffffff" ios_backgroundColor="#E5E7EB"/>
            </View>
            <View style={styles.legend}>
                <View style={styles.legendItem}><View style={[styles.legendDot, styles.dotBooked]}/><Text style={styles.legendText}>Booked</Text></View>
                <View style={styles.legendItem}><View style={[styles.legendDot, styles.dotBlocked]}/><Text style={styles.legendText}>Blocked</Text></View>
                <View style={styles.legendItem}><View style={[styles.legendDot, styles.dotAvailable]}/><Text style={styles.legendText}>Available</Text></View>
            </View>
            {selectedDates.length > 0 && (
                 <View style={styles.selectionBanner}>
                    <Text style={styles.selectionText}>{selectedDates.length} date(s) selected</Text>
                    <View style={styles.selectionActions}>
                        <TouchableOpacity style={styles.blockButton} onPress={handleBlockDates}><Text style={styles.blockButtonText}>Block</Text></TouchableOpacity>
                        <TouchableOpacity style={styles.clearButton} onPress={() => setSelectedDates([])}><Text style={styles.clearButtonText}>Clear</Text></TouchableOpacity>
                    </View>
                 </View>
            )}
       </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.monthNav}>
            <TouchableOpacity onPress={handlePrevMonth}><ChevronLeft size={24} color="#111827"/></TouchableOpacity>
            <Text style={styles.monthTitle}>{currentMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</Text>
            <TouchableOpacity onPress={handleNextMonth}><ChevronRight size={24} color="#111827"/></TouchableOpacity>
        </View>
        <View style={styles.calendarGrid}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, idx) => <Text key={`day-header-${idx}`} style={styles.dayHeader}>{d}</Text>)}
            {calendarDays.map((day, index) => {
                const isSelected = selectedDates.some(d => d.toDateString() === day.date.toDateString());
                let dayStyle = styles.dayCell;
                let textStyle = styles.dayText;
                let priceStyle;
                let guestStyle = styles.dayGuest;

                if (!day.isCurrentMonth) {
                    dayStyle = styles.dayCellOutside;
                    textStyle = styles.dayTextOutside;
                    priceStyle = styles.dayTextOutside;
                }
                else if (day.status === 'booked') {
                    dayStyle = styles.dayCellBooked;
                    guestStyle = styles.dayGuestBooked;
                    priceStyle = styles.dayPrice;
                }
                else if (day.status === 'blocked') {
                    dayStyle = styles.dayCellBlocked;
                    priceStyle = styles.dayTextBlocked;
                } else {
                     priceStyle = styles.dayPrice;
                }

                if (isSelected) dayStyle = styles.dayCellSelected;
                if (day.isToday) dayStyle = {...(dayStyle || {}), ...styles.dayCellToday};

                return (
                    <TouchableOpacity
                        key={index}
                        style={[styles.dayCellBase, dayStyle]}
                        onPress={() => handleDayClick(day)}
                        disabled={!day.isCurrentMonth}
                    >
                        <Text style={textStyle}>{day.date.getDate()}</Text>
                        {day.isCurrentMonth && day.status === 'available' && day.price && (<Text style={priceStyle}>₹{day.price/1000}k</Text>)}
                        {day.isCurrentMonth && day.status === 'booked' && day.guestName && (<Text style={guestStyle} numberOfLines={1}>{day.guestName}</Text>)}
                         {day.isCurrentMonth && day.status === 'blocked' && (<Text style={priceStyle}>Blocked</Text>)}
                    </TouchableOpacity>
                );
            })}
        </View>
      </ScrollView>
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
  headerPlaceholder: { width: 80 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#111827', textAlign: 'center' },
  headerButton: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 4 },
  headerButtonText: { fontSize: 14, fontWeight: '500' },
  controlsContainer: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', gap: 12 },
  dropdownPlaceholder: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 12, height: 44 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  switchLabel: { fontSize: 16 },
  legend: { flexDirection: 'row', gap: 16, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 14, height: 14, borderRadius: 3, borderWidth: 1 },
  dotBooked: { backgroundColor: '#DCFCE7', borderColor: '#BBF7D0' },
  dotBlocked: { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' },
  dotAvailable: { backgroundColor: 'white', borderColor: '#E5E7EB' },
  legendText: { fontSize: 13, color: '#4B5563'},
  selectionBanner: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE', borderWidth: 1, borderRadius: 8, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  selectionText: { fontSize: 14, color: '#1E40AF', fontWeight: '500' },
  selectionActions: { flexDirection: 'row', gap: 8 },
  blockButton: { backgroundColor: '#111827', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  blockButtonText: { color: 'white', fontSize: 13, fontWeight: '500' },
  clearButton: { backgroundColor: 'white', borderWidth: 1, borderColor: '#D1D5DB', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  clearButtonText: { color: '#374151', fontSize: 13, fontWeight: '500' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  monthNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  monthTitle: { fontSize: 18, fontWeight: '600' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayHeader: { width: `${100/7}%`, textAlign: 'center', paddingVertical: 8, fontSize: 12, color: '#6B7280', fontWeight: '500' },
  dayCellBase: {
    width: `${100/7}%`, aspectRatio: 0.8, borderWidth: 0.5, borderColor: '#F3F4F6',
    padding: 4, justifyContent: 'space-between', alignItems: 'center'
  },
  dayCell: { backgroundColor: 'white' },
  dayCellOutside: { backgroundColor: '#F9FAFB' },
  dayCellBooked: { backgroundColor: '#F0FDF4' },
  dayCellBlocked: { backgroundColor: '#FFFBEB' },
  dayCellSelected: {
     borderWidth: 1.5, borderColor: '#3B82F6',
     backgroundColor: '#EFF6FF'
  },
  dayCellToday: { borderWidth: 1.5, borderColor: '#111827'},
  dayText: { fontSize: 13, textAlign: 'center'},
  dayTextOutside: { fontSize: 13, color: '#D1D5DB', textAlign: 'center'},
  dayPrice: { fontSize: 11, color: '#6B7280', textAlign: 'center', marginTop: 'auto' },
  dayGuest: { fontSize: 10, color: '#1F2937', textAlign: 'center', marginTop: 'auto', backgroundColor: '#BBF7D0', borderRadius: 4, paddingVertical: 1, paddingHorizontal: 4, overflow: 'hidden' },
  dayGuestBooked: { fontSize: 10, color: '#166534', textAlign: 'center', marginTop: 'auto', backgroundColor: '#BBF7D0', borderRadius: 4, paddingVertical: 1, paddingHorizontal: 4, fontWeight: '500', overflow: 'hidden'},
  dayTextBlocked: { fontSize: 11, color: '#92400E', textAlign: 'center', marginTop: 'auto', fontWeight: '500'},
});