import { useTranslation } from 'react-i18next';
// app/(host)/calendar.tsx
import { apiGet, apiPut } from '@/services/api';
import { useFocusEffect } from '@react-navigation/native';
import { format } from 'date-fns';
import { Stack, useRouter } from 'expo-router';
import { ChevronDown, ChevronLeft, ChevronRight, Settings } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Modal, SafeAreaView, ScrollView, StyleSheet, Switch, Text, TextInput, TextStyle, TouchableOpacity, View } from 'react-native';

interface CalendarDay {
  date: Date; 
  status: 'available' | 'booked' | 'blocked'; 
  price?: number; 
  guestName?: string;
  isCurrentMonth: boolean; 
  isToday: boolean;
}

interface Listing {
  id: string;
  name: string;
}

export default function HostCalendarScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedListing, setSelectedListing] = useState<string>('');
  const [showAllListings, setShowAllListings] = useState(false);
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  
  // Dropdown state
  const [showDropdown, setShowDropdown] = useState(false);
  
  // Price change modal state
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [newPrice, setNewPrice] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const data = await apiGet<any>('/v1/my/listings');

        const arr =
          Array.isArray(data) ? data :
          Array.isArray(data?.results) ? data.results :
          Array.isArray(data?.items) ? data.items :
          Array.isArray(data?.data) ? data.data :
          [];

        const options = arr.map((l: any) => ({
          id: String(l.id ?? l.listing_id ?? l.uuid),
          name: l.title ?? l.name ?? 'Listing',
        }));

        setListings(options);

        if (!selectedListing && options.length > 0) {
          setSelectedListing(options[0].id);
        }
      } catch (err) {
        console.log('Failed to load listings for calendar', err);
      }
    })();
  }, [selectedListing]);

  const generateCalendarTemplate = useCallback((): CalendarDay[] => {
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
      const isToday = date.getTime() === today.getTime();
      days.push({ date, status: 'available', price: 2200, isCurrentMonth: true, isToday });
    }

    const gridCells = days.length > 35 ? 42 : 35;
    const remainingCells = gridCells - days.length;
    for (let i = 1; i <= remainingCells; i++) {
      const date = new Date(year, month + 1, i);
      days.push({ date, status: 'available', isCurrentMonth: false, isToday: false });
    }
    return days;
  }, [currentMonth]);

  const fetchAvailability = useCallback(async () => {
  const template = generateCalendarTemplate();

  if (!selectedListing) {
    setCalendarDays(template);
    return;
  }

  try {
    const start = format(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1),
      'yyyy-MM-dd'
    );

    // last day of month
    const end = format(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0),
      'yyyy-MM-dd'
    );

    const data = await apiGet<{
      results: {
        date: string;
        status: 'available' | 'blocked' | 'booked';
        price?: number;
        guest_name?: string;
      }[];
    }>(`/v1/listings/${selectedListing}/availability`, {
      params: { start_date: start, end_date: end },
    });

    const byDate = new Map<string, { status: CalendarDay['status']; price?: number; guestName?: string }>();
    for (const r of data.results || []) {
      byDate.set(r.date, { status: r.status, price: r.price, guestName: r.guest_name });
    }

    const days = template.map((d) => {
      const key = format(d.date, 'yyyy-MM-dd'); // ✅ local-safe
      const rec = byDate.get(key);
      return rec ? { ...d, status: rec.status, price: rec.price, guestName: rec.guestName } : d;
    });

    setCalendarDays(days);
  } catch (e) {
    console.log('availability error', e);
    setCalendarDays(template);
  }
}, [currentMonth, selectedListing, generateCalendarTemplate]);

  useEffect(() => { fetchAvailability(); }, [fetchAvailability]);

  useFocusEffect(
    useCallback(() => {
      fetchAvailability();
    }, [fetchAvailability])
  );


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
    if (!selectedListing) {
      Alert.alert(t('host.calendar.no_listing'), t('host.calendar.please_select_a_listing_first'));
      return;
    }
    if (selectedDates.length === 0) { 
      Alert.alert(t('host.calendar.no_dates'), t('host.calendar.select_dates_to_block')); 
      return; 
    }
    
    Alert.alert(t('host.calendar.block_dates'), `Block ${selectedDates.length} selected date(s)?`, [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Block',
        onPress: async () => {
          try {
            await apiPut(`/v1/listings/${selectedListing}/availability`, {
              dates: selectedDates.map(d => ({ 
                date: format(d, 'yyyy-MM-dd'), 
                status: 'blocked' 
              })),
            });
            setSelectedDates([]);
            fetchAvailability();
            Alert.alert(t('common.success'), t('host.calendar.dates_blocked_successfully'));
          } catch (err: any) {
            console.log('block error', err?.response?.data || err);
            Alert.alert(t('common.error'),
              err?.response?.data?.detail ?? err?.message ?? 'Failed to update availability'
            );
          }
        }
      }
    ]);
  };

  const handleUnblockDates = () => {
    if (!selectedListing) {
      Alert.alert(t('host.calendar.no_listing'), t('host.calendar.please_select_a_listing_first'));
      return;
    }
    if (selectedDates.length === 0) { 
      Alert.alert(t('host.calendar.no_dates'), t('host.calendar.select_dates_to_unblock')); 
      return; 
    }
    
    Alert.alert(t('host.calendar.unblock_dates'), `Unblock ${selectedDates.length} selected date(s)?`, [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Unblock',
        onPress: async () => {
          try {
            await apiPut(`/v1/listings/${selectedListing}/availability`, {
              dates: selectedDates.map(d => ({ 
                date: d.toISOString().split('T')[0], 
                status: 'available' 
              })),
            });
            setSelectedDates([]);
            fetchAvailability();
            Alert.alert(t('common.success'), t('host.calendar.dates_unblocked_successfully'));
          } catch (err: any) {
            console.log('unblock error', err?.response?.data || err);
            Alert.alert(t('common.error'),
              err?.response?.data?.detail ?? err?.message ?? 'Failed to update availability'
            );
          }
        }
      }
    ]);
  };

  const handleChangePrices = () => {
    if (!selectedListing) {
      Alert.alert(t('host.calendar.no_listing'), t('host.calendar.please_select_a_listing_first'));
      return;
    }
    if (selectedDates.length === 0) { 
      Alert.alert(t('host.calendar.no_dates'), t('host.calendar.select_dates_to_change_prices')); 
      return; 
    }
    setNewPrice('');
    setShowPriceModal(true);
  };

  const submitPriceChange = async () => {
    const priceNum = parseFloat(newPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      Alert.alert('Invalid Price', 'Please enter a valid price.');
      return;
    }

    try {
      await apiPut(`/v1/listings/${selectedListing}/availability`, {
        dates: selectedDates.map(d => ({ 
          date: d.toISOString().split('T')[0], 
          price: priceNum 
        })),
      });
      setSelectedDates([]);
      setShowPriceModal(false);
      fetchAvailability();
      Alert.alert(t('common.success'), `Price updated to ₹${priceNum} for ${selectedDates.length} date(s)`);
    } catch (err: any) {
      console.log('price change error', err?.response?.data || err);
      Alert.alert(t('common.error'),
        err?.response?.data?.detail ?? err?.message ?? 'Failed to update prices'
      );
    }
  };

  const handlePricingSettings = () => Alert.alert(t('host.calendar.pricing_settings'), t('host.calendar.navigate_to_pricing_settings'));

  const selectedListingName = listings.find(l => l.id === selectedListing)?.name || 'Select Listing';

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.customHeader}>
         <View style={styles.headerPlaceholder} />
         <Text style={styles.headerTitle}>{t('host.calendar.calendar')}</Text>
         <TouchableOpacity style={styles.headerButton} onPress={handlePricingSettings}>
            <Settings size={20} color="#111827"/>
            <Text style={styles.headerButtonText}>Pricing</Text>
         </TouchableOpacity>
      </View>

      <View style={styles.controlsContainer}>
        <TouchableOpacity 
          style={styles.dropdownPlaceholder}
          onPress={() => setShowDropdown(!showDropdown)}
        >
          <Text>{selectedListingName}</Text>
          <ChevronDown size={16} color="#6B7280"/>
        </TouchableOpacity>

        {showDropdown && (
          <View style={styles.dropdownMenu}>
            {listings.map(listing => (
              <TouchableOpacity
                key={listing.id}
                style={styles.dropdownItem}
                onPress={() => {
                  setSelectedListing(listing.id);
                  setShowDropdown(false);
                  setSelectedDates([]);
                }}
              >
                <Text style={[
                  styles.dropdownItemText,
                  listing.id === selectedListing && styles.dropdownItemTextSelected
                ]}>
                  {listing.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>{t('host.calendar.show_all_listings')}</Text>
          <Switch 
            value={showAllListings} 
            onValueChange={setShowAllListings} 
            trackColor={{ false: '#E5E7EB', true: '#10B981' }} 
            thumbColor="#ffffff" 
            ios_backgroundColor="#E5E7EB"
          />
        </View>

        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, styles.dotBooked]}/>
            <Text style={styles.legendText}>{t('host.calendar.booked')}</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, styles.dotBlocked]}/>
            <Text style={styles.legendText}>{t('host.calendar.blocked')}</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, styles.dotAvailable]}/>
            <Text style={styles.legendText}>{t('host.calendar.available')}</Text>
          </View>
        </View>

        {selectedDates.length > 0 && (
          <View style={styles.selectionBanner}>
            <Text style={styles.selectionText}>{selectedDates.length} date(s) selected</Text>
            <View style={styles.selectionActions}>
              <TouchableOpacity style={styles.actionButton} onPress={handleBlockDates}>
                <Text style={styles.actionButtonText}>{t('host.calendar.block')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton} onPress={handleUnblockDates}>
                <Text style={styles.actionButtonText}>{t('settings.privacy_safety.unblock')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton} onPress={handleChangePrices}>
                <Text style={styles.actionButtonText}>Price</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.clearButton} onPress={() => setSelectedDates([])}>
                <Text style={styles.clearButtonText}>{t('common.clear')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={handlePrevMonth}>
            <ChevronLeft size={24} color="#111827"/>
          </TouchableOpacity>
          <Text style={styles.monthTitle}>
            {currentMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
          </Text>
          <TouchableOpacity onPress={handleNextMonth}>
            <ChevronRight size={24} color="#111827"/>
          </TouchableOpacity>
        </View>

        <View style={styles.calendarGrid}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, idx) => 
            <Text key={`day-header-${idx}`} style={styles.dayHeader}>{d}</Text>
          )}
          {calendarDays.map((day, index) => {
            const isSelected = selectedDates.some(d => d.toDateString() === day.date.toDateString());
            let dayStyle = styles.dayCell;
            let textStyle = styles.dayText;
            let priceStyle: TextStyle = styles.dayPrice;

            if (!day.isCurrentMonth) {
              dayStyle = styles.dayCellOutside;
              textStyle = styles.dayTextOutside;
              priceStyle = styles.dayTextOutside;
            } else if (day.status === 'booked') {
              dayStyle = styles.dayCellBooked;
            } else if (day.status === 'blocked') {
              dayStyle = styles.dayCellBlocked;
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
                
                {day.isCurrentMonth && day.status === 'available' && day.price && (
                  <Text style={priceStyle}>₹{day.price >= 1000 ? `${(day.price/1000).toFixed(1)}k` : day.price}</Text>
                )}
                
                {day.isCurrentMonth && day.status === 'booked' && day.guestName && (
                  <Text style={styles.guestBadge} numberOfLines={1}>{day.guestName}</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Price Change Modal */}
      <Modal
        visible={showPriceModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPriceModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('host.calendar.change_price')}</Text>
            <Text style={styles.modalSubtitle}>
              Set new price for {selectedDates.length} selected date(s)
            </Text>
            
            <TextInput
              style={styles.priceInput}
              placeholder={t('host.calendar.enter_new_price')}
              keyboardType="numeric"
              value={newPrice}
              onChangeText={setNewPrice}
              autoFocus
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setShowPriceModal(false)}
              >
                <Text style={styles.modalButtonTextCancel}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={submitPriceChange}
              >
                <Text style={styles.modalButtonTextConfirm}>Update</Text>
              </TouchableOpacity>
            </View>
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
  headerPlaceholder: { width: 80 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#111827', textAlign: 'center' },
  headerButton: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 4 },
  headerButtonText: { fontSize: 14, fontWeight: '500' },
  controlsContainer: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', gap: 12 },
  dropdownPlaceholder: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
    borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 12, height: 44 
  },
  dropdownMenu: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    marginTop: -8,
    maxHeight: 200,
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dropdownItemText: {
    fontSize: 15,
    color: '#374151',
  },
  dropdownItemTextSelected: {
    fontWeight: '600',
    color: '#111827',
  },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  switchLabel: { fontSize: 16 },
  legend: { flexDirection: 'row', gap: 16, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 14, height: 14, borderRadius: 3, borderWidth: 1 },
  dotBooked: { backgroundColor: '#DCFCE7', borderColor: '#BBF7D0' },
  dotBlocked: { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' },
  dotAvailable: { backgroundColor: 'white', borderColor: '#E5E7EB' },
  legendText: { fontSize: 13, color: '#4B5563'},
  selectionBanner: { 
    backgroundColor: '#EFF6FF', borderColor: '#BFDBFE', borderWidth: 1, 
    borderRadius: 8, padding: 12, gap: 8 
  },
  selectionText: { fontSize: 14, color: '#1E40AF', fontWeight: '500' },
  selectionActions: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  actionButton: { 
    backgroundColor: '#111827', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 
  },
  actionButtonText: { color: 'white', fontSize: 13, fontWeight: '500' },
  clearButton: { 
    backgroundColor: 'white', borderWidth: 1, borderColor: '#D1D5DB', 
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 
  },
  clearButtonText: { color: '#374151', fontSize: 13, fontWeight: '500' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  monthNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  monthTitle: { fontSize: 18, fontWeight: '600' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayHeader: { 
    width: `${100/7}%`, textAlign: 'center', paddingVertical: 8, 
    fontSize: 12, color: '#6B7280', fontWeight: '500' 
  },
  dayCellBase: {
    width: `${100/7}%`, aspectRatio: 0.8, borderWidth: 0.5, borderColor: '#F3F4F6',
    padding: 4, justifyContent: 'space-between', alignItems: 'center'
  },
  dayCell: { backgroundColor: 'white' },
  dayCellOutside: { backgroundColor: '#F9FAFB' },
  dayCellBooked: { backgroundColor: '#DCFCE7' },
  dayCellBlocked: { backgroundColor: '#FEF3C7' },
  dayCellSelected: {
     borderWidth: 1.5, borderColor: '#3B82F6',
     backgroundColor: '#EFF6FF'
  },
  dayCellToday: { borderWidth: 1.5, borderColor: '#111827'},
  dayText: { fontSize: 13, textAlign: 'center'},
  dayTextOutside: { fontSize: 13, color: '#D1D5DB', textAlign: 'center'},
  dayPrice: { fontSize: 10, color: '#6B7280', textAlign: 'center', marginTop: 'auto' },
  guestBadge: { 
    fontSize: 9, color: '#166534', textAlign: 'center', marginTop: 'auto', 
    backgroundColor: '#BBF7D0', borderRadius: 4, paddingVertical: 2, 
    paddingHorizontal: 4, fontWeight: '600', overflow: 'hidden'
  },
  
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
  },
  priceInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#F3F4F6',
  },
  modalButtonConfirm: {
    backgroundColor: '#111827',
  },
  modalButtonTextCancel: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonTextConfirm: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});