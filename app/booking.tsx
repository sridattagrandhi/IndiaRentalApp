// app/booking.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { differenceInDays, format, parseISO } from 'date-fns';
import * as Clipboard from 'expo-clipboard';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
    ArrowLeft, Calendar as CalendarIcon, Check, CheckCircle2, Clock, Copy, CreditCard,
    Download, MapPin, MessageSquare, Minus, Navigation, Phone, Plus, Shield,
    Smartphone, Users, Wallet, X
} from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
    Alert, FlatList, Modal, ScrollView, StyleSheet, Text, TextInput,
    TouchableOpacity, View
} from 'react-native';
import { CalendarList, DateData } from 'react-native-calendars';
import MapView, { Marker, PROVIDER_DEFAULT, Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** ──────────────────────────────────────────────────────────────────────────
 *  STORAGE KEYS (re-using MyTrips list storage)
 *  - @triplists            : array<TripList>
 *  - @trip_saved_trips     : array<TripSavedItem>  (items under a TripList)
 *  - @confirmed_trips      : array<Trip>          (bookings -> Upcoming)
 *  ────────────────────────────────────────────────────────────────────────── */
const TRIP_LISTS_KEY = '@triplists';
const TRIP_SAVED_KEY = '@trip_saved_trips';
const CONFIRMED_TRIPS_KEY = '@confirmed_trips';

/** minimal shapes copied to match MyTrips */
type Trip = {
  id: string;
  bookingCode: string;
  listingName: string;
  listingImage: string;
  location: string;
  checkIn: string;    // store as ISO for simplicity here
  checkOut: string;
  guests: number;
  totalPaid: number;
  status: 'upcoming' | 'completed' | 'cancelled';
  canModify: boolean;
  hostName?: string;
  hostPhone?: string;
};
type TripList = { id: string; name: string };
type TripSavedItem = {
  id: string;
  name: string;
  location: string;
  price: number;
  rating: number;
  image: string;
  listId: string;
  coordinates?: { latitude: number; longitude: number };
};

// helpers
const getData = async <T,>(key: string, fallback: T): Promise<T> => {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
};
const setData = async (key: string, value: any) => {
  try { await AsyncStorage.setItem(key, JSON.stringify(value)); } catch {}
};

// --- Type Definitions ---
type BookingStep = 'dates' | 'pricing' | 'addons' | 'payment' | 'confirmation';
const MIN_STAY_NIGHTS = 1;
const MAX_STAY_NIGHTS = 30;

/** Date Picker Modal (unchanged logic) */
interface DatePickerModalProps {
  isVisible: boolean; onClose: () => void;
  checkIn: string | null; checkOut: string | null;
  setCheckIn: (d: string | null) => void; setCheckOut: (d: string | null) => void;
}
function DatePickerModal({
  isVisible, onClose, checkIn, checkOut, setCheckIn, setCheckOut,
}: DatePickerModalProps) {
  const [selectedStartDate, setSelectedStartDate] = useState<string | null>(checkIn);
  const [selectedEndDate, setSelectedEndDate] = useState<string | null>(checkOut);
  const [phase, setPhase] = useState<'start' | 'end'>(checkIn ? 'end' : 'start');
  const insets = useSafeAreaInsets();

  useEffect(() => {
    setSelectedStartDate(checkIn);
    setSelectedEndDate(checkOut);
    setPhase(checkIn ? 'end' : 'start');
  }, [isVisible, checkIn, checkOut]);

  const handleDayPress = (day: DateData) => {
    if (phase === 'start' || (selectedStartDate && selectedEndDate && day.dateString < selectedStartDate)) {
      setSelectedStartDate(day.dateString); setSelectedEndDate(null); setPhase('end');
    } else if (selectedStartDate && day.dateString >= selectedStartDate) {
      setSelectedEndDate(day.dateString); setPhase('start');
    } else if (!selectedStartDate) {
      setSelectedStartDate(day.dateString); setSelectedEndDate(null); setPhase('end');
    }
  };

  const handleConfirm = () => { setCheckIn(selectedStartDate); setCheckOut(selectedEndDate); onClose(); };

  const marked: Record<string, any> = {};
  if (selectedStartDate) marked[selectedStartDate] = { startingDay: true, color: '#111827', textColor: 'white' };
  if (selectedEndDate) {
    marked[selectedEndDate] = { endingDay: true, color: '#111827', textColor: 'white' };
    if (selectedStartDate && selectedStartDate !== selectedEndDate) {
      let cur = new Date(parseISO(selectedStartDate)); const end = new Date(parseISO(selectedEndDate));
      cur.setDate(cur.getDate() + 1);
      while (cur < end) {
        const s = cur.toISOString().split('T')[0];
        marked[s] = { color: '#F3F4F6', textColor: '#111827' };
        cur.setDate(cur.getDate() + 1);
      }
      marked[selectedStartDate] = { ...marked[selectedStartDate], color: '#111827', textColor: 'white' };
      marked[selectedEndDate] = { ...marked[selectedEndDate], color: '#111827', textColor: 'white' };
    } else if (selectedStartDate === selectedEndDate) {
      marked[selectedStartDate] = { startingDay: true, endingDay: true, color: '#111827', textColor: 'white' };
    }
  }

  return (
    <Modal visible={isVisible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.modalContainer, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Select Dates</Text>
          <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}><X size={24} color="#111827" /></TouchableOpacity>
        </View>
        <View style={{ flex: 1 }}>
          <CalendarList
            current={selectedStartDate || new Date().toISOString().split('T')[0]}
            minDate={new Date().toISOString().split('T')[0]}
            onDayPress={handleDayPress}
            markingType="period"
            markedDates={marked}
            pastScrollRange={0}
            futureScrollRange={12}
            scrollEnabled
            showScrollIndicator
            theme={{
              backgroundColor: '#FFF',
              calendarBackground: '#FFF',
              textSectionTitleColor: '#111827',
              selectedDayBackgroundColor: '#111827',
              selectedDayTextColor: '#FFF',
              todayTextColor: '#DC2626',
              dayTextColor: '#111827',
              textDisabledColor: '#D1D5DB',
            }}
          />
        </View>
        <View style={styles.modalFooter}>
          <TouchableOpacity style={styles.clearButton} onPress={() => { setSelectedStartDate(null); setSelectedEndDate(null); setPhase('start'); }}>
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.showButton, (!selectedStartDate || !selectedEndDate) && styles.disabledButton]}
            onPress={handleConfirm}
            disabled={!selectedStartDate || !selectedEndDate}
          >
            <Text style={styles.showButtonText}>Confirm Dates</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function BookingPage() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();

  // Nav params
  const { listingId, listingName, listingLocation, basePrice, lat, lon } = params;
  const listingBasePrice = parseFloat(basePrice as string);
  const listingCoords = { latitude: parseFloat(lat as string), longitude: parseFloat(lon as string) };
  const mapRegion: Region = { ...listingCoords, latitudeDelta: 0.01, longitudeDelta: 0.01 };

  // Steps
  const [currentStep, setCurrentStep] = useState<BookingStep>('dates');
  const [checkInDate, setCheckInDate] = useState<string | null>(params.checkIn as string || null);
  const [checkOutDate, setCheckOutDate] = useState<string | null>(params.checkOut as string || null);
  const [guests, setGuests] = useState(params.guests ? parseInt(params.guests as string, 10) : 2);
  const [isDatePickerVisible, setDatePickerVisible] = useState(false);

  // Add-ons / payment
  const [lateCheckout, setLateCheckout] = useState(false);
  const [insurance, setInsurance] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'wallet' | 'card'>('upi');
  const [savePayment, setSavePayment] = useState(false);
  const [upiId, setUpiId] = useState('');
  const [cardNumber, setCardNumber] = useState('');

  // Confirmation
  const [bookingCode] = useState(`BK${Math.random().toString(36).substring(2, 9).toUpperCase()}`);

  // “Add to My Trips” modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [lists, setLists] = useState<TripList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const placeholderImage =
    'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=400&h=300&fit=crop';

  // Pricing
  const getNights = () => {
    if (!checkInDate || !checkOutDate) return 0;
    try { return differenceInDays(parseISO(checkOutDate), parseISO(checkInDate)); }
    catch { return 0; }
  };
  const nights = getNights();
  const subtotal = nights > 0 ? listingBasePrice * nights : 0;
  const cleaningFee = 500;
  const serviceFee = nights > 0 ? Math.round(subtotal * 0.12) : 0;
  const gst = nights > 0 ? Math.round((subtotal + cleaningFee + serviceFee) * 0.12) : 0;
  const baseTotal = nights > 0 ? subtotal + cleaningFee + serviceFee + gst : 0;
  const lateCheckoutFeeValue = 800;
  const insuranceFeeValue = nights > 0 ? Math.round(subtotal * 0.05) : 0;
  const total = baseTotal + (lateCheckout ? lateCheckoutFeeValue : 0) + (insurance ? insuranceFeeValue : 0);

  // Validate dates
  const validateDates = () => {
    const n = getNights();
    if (n <= 0 && checkInDate && checkOutDate) { Alert.alert('Invalid Dates', 'Check-out must be after check-in.'); return false; }
    if (n < MIN_STAY_NIGHTS) { Alert.alert('Invalid Dates', `Minimum stay is ${MIN_STAY_NIGHTS} night${MIN_STAY_NIGHTS>1?'s':''}`); return false; }
    if (n > MAX_STAY_NIGHTS) { Alert.alert('Invalid Dates', `Maximum stay is ${MAX_STAY_NIGHTS} nights`); return false; }
    return true;
  };

  // Step handlers
  const handleNext = () => {
    if (currentStep === 'dates') {
      if (!checkInDate || !checkOutDate) return Alert.alert('Missing Dates', 'Please select check-in and check-out dates');
      if (!validateDates()) return;
      setCurrentStep('pricing');
    } else if (currentStep === 'pricing') {
      setCurrentStep('addons');
    } else if (currentStep === 'addons') {
      setCurrentStep('payment');
    } else if (currentStep === 'payment') {
      if (paymentMethod === 'upi' && !upiId) return Alert.alert('Payment Error', 'Please enter your UPI ID');
      if (paymentMethod === 'card' && !cardNumber) return Alert.alert('Payment Error', 'Please enter your card details');
      Alert.alert('Payment Successful!', 'Your booking is being confirmed.');
      setCurrentStep('confirmation');
    }
  };
  const handleBack = () => {
    if (currentStep === 'dates') router.back();
    else if (currentStep === 'pricing') setCurrentStep('dates');
    else if (currentStep === 'addons') setCurrentStep('pricing');
    else if (currentStep === 'payment') setCurrentStep('addons');
    else if (currentStep === 'confirmation') router.replace('/(tabs)');
  };
  const copyBookingCode = async () => { await Clipboard.setStringAsync(bookingCode); Alert.alert('Copied!', 'Booking code copied.'); };

  const getStepTitle = () =>
    currentStep === 'dates' ? 'Select dates'
    : currentStep === 'pricing' ? 'Review booking'
    : currentStep === 'addons' ? 'Add-ons'
    : currentStep === 'payment' ? 'Payment'
    : 'Booking confirmed!';

  /** Load lists for the Add-modal (only needed once we arrive at confirmation) */
  useEffect(() => {
    if (currentStep !== 'confirmation') return;
    (async () => {
      const existing = await getData<{ id: string; name: string }[]>(TRIP_LISTS_KEY, []);
      setLists(existing);
      setSelectedListId(existing[0]?.id ?? null);
    })();
  }, [currentStep]);

  /** Persist booking to:
   *  - @confirmed_trips (always)
   *  - @trip_saved_trips (if a list was picked)
   */
  const addConfirmedToStorage = async (chosenListId: string | null) => {
    // 1) add to confirmed (Upcoming)
    const confirmed = await getData<Trip[]>(CONFIRMED_TRIPS_KEY, []);
    const newTrip: Trip = {
      id: Date.now().toString(),
      bookingCode,
      listingName: String(listingName || 'Stay'),
      listingImage: placeholderImage, // if you pass image via params, use it here
      location: String(listingLocation || ''),
      checkIn: String(checkInDate),
      checkOut: String(checkOutDate),
      guests,
      totalPaid: total,
      status: 'upcoming',
      canModify: true,
    };
    await setData(CONFIRMED_TRIPS_KEY, [newTrip, ...confirmed]);

    // 2) optionally also add a tile under a Trip List (MyTrips > list)
    if (chosenListId) {
      const saved = await getData<TripSavedItem[]>(TRIP_SAVED_KEY, []);
      const newSaved: TripSavedItem = {
        id: `ts_${Date.now()}`,
        name: String(listingName || 'Stay'),
        location: String(listingLocation || ''),
        price: listingBasePrice,
        rating: 4.8,
        image: placeholderImage,
        listId: chosenListId,
        coordinates: listingCoords,
      };
      await setData(TRIP_SAVED_KEY, [newSaved, ...saved]);
    }
  };

  /** UI for the Add-to-MyTrips modal (radio list of lists + buttons) */
  const AddToMyTripsModal = () => (
    <Modal visible={showAddModal} animationType="slide" transparent onRequestClose={() => setShowAddModal(false)}>
      <View style={styles.sheetOverlay}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Add to My Trips</Text>
            <TouchableOpacity onPress={() => setShowAddModal(false)}><X size={22} color="#111827" /></TouchableOpacity>
          </View>

          {lists.length === 0 ? (
            <View style={{ paddingVertical: 8 }}>
              <Text style={styles.infoText}>You don’t have any trip lists yet.</Text>
              <Text style={[styles.infoText, { marginTop: 4 }]}>Create one in the My Trips tab.</Text>
            </View>
          ) : (
            <FlatList
              data={lists}
              keyExtractor={(l) => l.id}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.radioRow} onPress={() => setSelectedListId(item.id)}>
                  <View style={[styles.radio, selectedListId === item.id && styles.radioChecked]}>
                    {selectedListId === item.id && <View style={styles.radioInner} />}
                  </View>
                  <Text style={styles.addonTitle}>{item.name}</Text>
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
              style={{ maxHeight: 240, marginVertical: 8 }}
            />
          )}

          <View style={{ height: 12 }} />
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={async () => {
              await addConfirmedToStorage(selectedListId);
              setShowAddModal(false);
              Alert.alert('Added', 'Trip added to Upcoming and your selected list.');
            }}
          >
            <Text style={styles.primaryButtonText}>Save</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.outlineButton, { marginTop: 8 }]} onPress={() => setShowAddModal(false)}>
            <Download size={16} color="#111827" />
            <Text style={styles.outlineButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  /** Step renderers (your original content, unchanged except confirmation card additions) */
  const renderStepContent = () => {
    switch (currentStep) {
      case 'dates':
        return (
          <View style={styles.card}>
            <Text style={styles.label}>Check-in & Check-out</Text>
            <TouchableOpacity style={styles.dateButton} onPress={() => setDatePickerVisible(true)}>
              <CalendarIcon size={20} color="#374151" />
              <Text style={[styles.dateButtonText, !checkInDate && { color: '#6B7280' }]}>
                {checkInDate && checkOutDate ? `${format(parseISO(checkInDate), 'MMM dd')} - ${format(parseISO(checkOutDate), 'MMM dd')}` : 'Select dates'}
              </Text>
            </TouchableOpacity>
            {nights > 0 && <Text style={styles.nightCounter}>{nights} {nights === 1 ? 'night' : 'nights'}</Text>}
            <View style={styles.divider} />
            <Text style={styles.label}>Guests</Text>
            <View style={styles.guestRow}>
              <Text style={styles.guestLabel}>Number of guests</Text>
              <View style={styles.guestControl}>
                <TouchableOpacity style={[styles.guestButton, guests <= 1 && styles.guestButtonDisabled]} onPress={() => setGuests(g => Math.max(1, g - 1))} disabled={guests <= 1}><Minus size={20} color={guests <= 1 ? '#9CA3AF' : '#111827'} /></TouchableOpacity>
                <Text style={styles.guestCount}>{guests}</Text>
                <TouchableOpacity style={[styles.guestButton, guests >= 20 && styles.guestButtonDisabled]} onPress={() => setGuests(g => Math.min(20, g + 1))} disabled={guests >= 20}><Plus size={20} color={guests >= 20 ? '#9CA3AF' : '#111827'} /></TouchableOpacity>
              </View>
            </View>
          </View>
        );
      case 'pricing':
        return (
          <>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Booking details</Text>
              <View style={styles.infoRow}><CalendarIcon size={16} color="#4B5563" /><Text style={styles.infoText}>{format(parseISO(checkInDate!), 'MMM dd')} - {format(parseISO(checkOutDate!), 'MMM dd, yyyy')}</Text></View>
              <View style={styles.infoRow}><Users size={16} color="#4B5563" /><Text style={styles.infoText}>{guests} {guests === 1 ? 'guest' : 'guests'}</Text></View>
            </View>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Price breakdown</Text>
              <View style={styles.priceItem}><Text style={styles.infoText}>₹{listingBasePrice.toLocaleString('en-IN')} × {nights} {nights === 1 ? 'night' : 'nights'}</Text><Text style={styles.infoText}>₹{subtotal.toLocaleString('en-IN')}</Text></View>
              <View style={styles.priceItem}><Text style={styles.infoText}>Cleaning fee</Text><Text style={styles.infoText}>₹{cleaningFee.toLocaleString('en-IN')}</Text></View>
              <View style={styles.priceItem}><Text style={styles.infoText}>Service fee</Text><Text style={styles.infoText}>₹{serviceFee.toLocaleString('en-IN')}</Text></View>
              <View style={styles.priceItem}><Text style={styles.infoText}>GST (12%)</Text><Text style={styles.infoText}>₹{gst.toLocaleString('en-IN')}</Text></View>
              <View style={styles.divider} />
              <View style={styles.priceItem}><Text style={styles.totalLabel}>Total</Text><Text style={styles.totalLabel}>₹{baseTotal.toLocaleString('en-IN')}</Text></View>
            </View>
          </>
        );
      case 'addons':
        return (
          <>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Enhance your stay</Text>
              <TouchableOpacity style={styles.addonCard} onPress={() => setLateCheckout(!lateCheckout)}>
                <View style={[styles.checkbox, lateCheckout && styles.checkboxChecked]}>{lateCheckout && <Check size={16} color="white" />}</View>
                <View style={styles.addonContent}>
                  <View style={styles.addonHeader}><Clock size={16} color="#111827" /><Text style={styles.addonTitle}>Late checkout</Text><Text style={styles.addonPrice}>+₹{lateCheckoutFeeValue.toLocaleString('en-IN')}</Text></View>
                  <Text style={styles.infoText}>Check out at 3:00 PM instead of 11:00 AM</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={styles.addonCard} onPress={() => setInsurance(!insurance)}>
                <View style={[styles.checkbox, insurance && styles.checkboxChecked]}>{insurance && <Check size={16} color="white" />}</View>
                <View style={styles.addonContent}>
                  <View style={styles.addonHeader}><Shield size={16} color="#111827" /><Text style={styles.addonTitle}>Damage protection</Text><Text style={styles.addonPrice}>+₹{insuranceFeeValue.toLocaleString('en-IN')}</Text></View>
                  <Text style={styles.infoText}>Cover accidental damage up to ₹50,000</Text>
                </View>
              </TouchableOpacity>
            </View>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Updated total</Text>
              {lateCheckout && <View style={styles.priceItem}><Text style={styles.infoText}>Late checkout</Text><Text style={styles.infoText}>₹{lateCheckoutFeeValue.toLocaleString('en-IN')}</Text></View>}
              {insurance && <View style={styles.priceItem}><Text style={styles.infoText}>Damage protection</Text><Text style={styles.infoText}>₹{insuranceFeeValue.toLocaleString('en-IN')}</Text></View>}
              <View style={styles.divider} />
              <View style={styles.priceItem}><Text style={styles.totalLabel}>Total amount</Text><Text style={styles.totalLabel}>₹{total.toLocaleString('en-IN')}</Text></View>
            </View>
          </>
        );
      case 'payment':
        return (
          <>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Select payment method</Text>
              <TouchableOpacity style={[styles.paymentOption, paymentMethod === 'upi' && styles.paymentOptionActive]} onPress={() => setPaymentMethod('upi')}>
                <Smartphone size={20} color="#111827" /><View style={styles.paymentContent}><Text style={styles.addonTitle}>UPI</Text><Text style={styles.infoText}>GPay, PhonePe, Paytm</Text></View>
                <View style={[styles.radio, paymentMethod === 'upi' && styles.radioChecked]}>{paymentMethod === 'upi' && <View style={styles.radioInner} />}</View>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.paymentOption, paymentMethod === 'wallet' && styles.paymentOptionActive]} onPress={() => setPaymentMethod('wallet')}>
                <Wallet size={20} color="#111827" /><View style={styles.paymentContent}><Text style={styles.addonTitle}>Wallets</Text><Text style={styles.infoText}>Paytm, PhonePe, Mobikwik</Text></View>
                <View style={[styles.radio, paymentMethod === 'wallet' && styles.radioChecked]}>{paymentMethod === 'wallet' && <View style={styles.radioInner} />}</View>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.paymentOption, paymentMethod === 'card' && styles.paymentOptionActive]} onPress={() => setPaymentMethod('card')}>
                <CreditCard size={20} color="#111827" /><View style={styles.paymentContent}><Text style={styles.addonTitle}>Credit/Debit Card</Text><Text style={styles.infoText}>Visa, Mastercard, Rupay</Text></View>
                <View style={[styles.radio, paymentMethod === 'card' && styles.radioChecked]}>{paymentMethod === 'card' && <View style={styles.radioInner} />}</View>
              </TouchableOpacity>

              {paymentMethod === 'upi' && (
                <View style={styles.paymentDetails}>
                  <Text style={styles.label}>Enter UPI ID</Text>
                  <TextInput style={styles.input} placeholder="yourname@upi" value={upiId} onChangeText={setUpiId} autoCapitalize="none" />
                </View>
              )}
              {paymentMethod === 'card' && (
                <View style={styles.paymentDetails}>
                  <Text style={styles.label}>Card number</Text>
                  <TextInput style={styles.input} placeholder="1234 5678 9012 3456" value={cardNumber} onChangeText={setCardNumber} keyboardType="numeric" maxLength={19} />
                  <View style={styles.inputRow}>
                    <View style={styles.inputHalf}>
                      <Text style={styles.label}>Expiry</Text>
                      <TextInput style={styles.input} placeholder="MM/YY" maxLength={5} keyboardType="numeric" />
                    </View>
                    <View style={styles.inputHalf}>
                      <Text style={styles.label}>CVV</Text>
                      <TextInput style={styles.input} placeholder="123" maxLength={3} keyboardType="numeric" secureTextEntry />
                    </View>
                  </View>
                </View>
              )}
              <View style={styles.divider} />
              <TouchableOpacity style={styles.checkRow} onPress={() => setSavePayment(!savePayment)}>
                <View style={[styles.checkbox, savePayment && styles.checkboxChecked]}>{savePayment && <Check size={16} color="white" />}</View>
                <Text style={styles.checkLabel}>Save payment method for 1-tap checkout</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.card}><View style={styles.priceItem}><Text style={styles.totalLabel}>Total amount</Text><Text style={styles.totalLabel}>₹{total.toLocaleString('en-IN')}</Text></View></View>
          </>
        );
      case 'confirmation':
        return (
          <>
            <View style={styles.card}>
              <View style={styles.confirmationHeader}>
                <View style={styles.confirmationIcon}><CheckCircle2 size={32} color="#16A34A" /></View>
                <Text style={styles.confirmationTitle}>Booking confirmed!</Text>
                <Text style={[styles.infoText, { textAlign: 'center' }]}>Your reservation has been successfully confirmed.</Text>
              </View>
              <View style={styles.bookingCodeBox}>
                <Text style={styles.infoText}>Booking code</Text>
                <View style={styles.bookingCodeRow}>
                  <Text style={styles.bookingCodeText}>{bookingCode}</Text>
                  <TouchableOpacity onPress={copyBookingCode}><Copy size={18} color="#4B5563" /></TouchableOpacity>
                </View>
              </View>

              {/* NEW: Prompt to add to My Trips */}
              <View style={[styles.noticeBox, { marginTop: 8 }]}>
                <Text style={styles.noticeText}>Add this booking to <Text style={{ fontWeight: '700' }}>My Trips</Text>?</Text>
                <TouchableOpacity style={[styles.primaryButton, { marginTop: 10 }]} onPress={() => setShowAddModal(true)}>
                  <Text style={styles.primaryButtonText}>Add to My Trips</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Booking details</Text>
              <View style={styles.priceItem}><Text style={styles.infoText}>Check-in</Text><Text style={styles.totalLabel}>{format(parseISO(checkInDate!), 'MMM dd, yyyy')}</Text></View>
              <View style={styles.priceItem}><Text style={styles.infoText}>Check-out</Text><Text style={styles.totalLabel}>{format(parseISO(checkOutDate!), 'MMM dd, yyyy')}</Text></View>
              <View style={styles.priceItem}><Text style={styles.infoText}>Guests</Text><Text style={styles.totalLabel}>{guests}</Text></View>
              <View style={styles.divider} />
              <View style={styles.priceItem}><Text style={styles.infoText}>Total paid</Text><Text style={styles.totalLabel}>₹{total.toLocaleString('en-IN')}</Text></View>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Location</Text>
              <MapView style={styles.map} provider={PROVIDER_DEFAULT} initialRegion={mapRegion} scrollEnabled={false}>
                <Marker coordinate={listingCoords} />
              </MapView>
              <Text style={styles.locationText}>{listingLocation as string}</Text>
              <TouchableOpacity style={styles.outlineButton}>
                <Navigation size={16} color="#111827" />
                <Text style={styles.outlineButtonText}>Get directions</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Contact host</Text>
              <TouchableOpacity style={styles.outlineButton}>
                <MessageSquare size={16} color="#111827" />
                <Text style={styles.outlineButtonText}>Message host</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.outlineButton, { marginTop: 12 }]}>
                <Phone size={16} color="#111827" />
                <Text style={styles.outlineButtonText}>Call host</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.outlineButton}>
              <Download size={16} color="#111827" />
              <Text style={styles.outlineButtonText}>Download booking details</Text>
            </TouchableOpacity>

            {/* Modal */}
            <AddToMyTripsModal />
          </>
        );
      default:
        return null;
    }
  };

  const actionText = currentStep === 'dates' ? 'Continue'
    : currentStep === 'pricing' ? 'Continue'
    : currentStep === 'addons' ? 'Continue to payment'
    : currentStep === 'payment' ? `Pay ₹${total.toLocaleString('en-IN')}`
    : 'Done';

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style="dark" />
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={handleBack}><ArrowLeft size={24} color="#111827" /></TouchableOpacity>
        <Text style={styles.headerTitle}>{getStepTitle()}</Text>
        {currentStep !== 'confirmation' && (
          <View style={styles.progressBarContainer}>
            {['dates', 'pricing', 'addons', 'payment'].map((s, idx) => {
              const activeIdx = ['dates', 'pricing', 'addons', 'payment'].indexOf(currentStep);
              return <View key={s} style={[styles.progressStep, idx <= activeIdx && styles.progressStepActive]} />;
            })}
          </View>
        )}
      </View>

      {/* Top listing header on non-confirmation steps */}
      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
        {currentStep !== 'confirmation' && (
          <View style={styles.listingCard}>
            <Text style={styles.listingName} numberOfLines={1}>{listingName as string}</Text>
            <View style={styles.infoRow}><MapPin size={16} color="#4B5563" /><Text style={styles.infoText} numberOfLines={1}>{listingLocation as string}</Text></View>
          </View>
        )}
        {renderStepContent()}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        {currentStep !== 'dates' && currentStep !== 'confirmation' && (
          <View style={styles.footerPriceRow}><Text style={styles.infoText}>Total</Text><Text style={styles.totalLabel}>₹{total.toLocaleString('en-IN')}</Text></View>
        )}
        <TouchableOpacity style={styles.footerButton} onPress={currentStep === 'confirmation' ? () => router.replace('/(tabs)') : handleNext}>
          <Text style={styles.footerButtonText}>{actionText}</Text>
        </TouchableOpacity>
      </View>

      {/* Date modal */}
      <DatePickerModal
        isVisible={isDatePickerVisible}
        onClose={() => setDatePickerVisible(false)}
        checkIn={checkInDate}
        checkOut={checkOutDate}
        setCheckIn={setCheckInDate}
        setCheckOut={setCheckOutDate}
      />
    </View>
  );
}

/** Styles (only the ones this file needs) */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  headerButton: { marginBottom: 8, alignSelf: 'flex-start' },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#111827', marginBottom: 12 },
  progressBarContainer: { flexDirection: 'row', gap: 4 },
  progressStep: { flex: 1, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2 },
  progressStepActive: { backgroundColor: '#111827' },

  scrollContainer: { flex: 1, backgroundColor: '#F9FAFB' },
  scrollContent: { padding: 16, paddingBottom: 120 },

  listingCard: { backgroundColor: 'white', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  listingName: { fontSize: 18, fontWeight: 'bold', color: '#111827', marginBottom: 4 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  infoText: { fontSize: 14, color: '#4B5563', lineHeight: 20 },

  card: { backgroundColor: 'white', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  label: { fontSize: 16, fontWeight: 'bold', color: '#111827', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827', marginBottom: 12 },
  divider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 16 },

  dateButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 14 },
  dateButtonText: { fontSize: 16, color: '#111827', marginLeft: 12 },
  nightCounter: { fontSize: 14, color: '#4B5563', marginTop: 8 },

  guestRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  guestLabel: { fontSize: 16, color: '#111827' },
  guestControl: { flexDirection: 'row', alignItems: 'center' },
  guestButton: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: '#B0B0B0', justifyContent: 'center', alignItems: 'center' },
  guestButtonDisabled: { borderColor: '#E5E7EB' },
  guestCount: { fontSize: 16, fontWeight: 'bold', color: '#111827', marginHorizontal: 16, minWidth: 20, textAlign: 'center' },

  priceItem: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  totalLabel: { fontSize: 16, fontWeight: 'bold', color: '#111827' },

  addonCard: { flexDirection: 'row', alignItems: 'flex-start', padding: 12, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, marginBottom: 12 },
  addonContent: { flex: 1, marginLeft: 12 },
  addonHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  addonTitle: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
  addonPrice: { fontSize: 14, fontWeight: '500', color: '#111827', marginLeft: 'auto' },

  checkRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#B0B0B0', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  checkboxChecked: { backgroundColor: '#111827', borderColor: '#111827' },
  checkLabel: { fontSize: 14, color: '#111827', flex: 1 },

  paymentOption: { flexDirection: 'row', alignItems: 'center', padding: 12, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, marginBottom: 12 },
  paymentOptionActive: { borderColor: '#111827', backgroundColor: '#F9FAFB' },
  paymentContent: { flex: 1, marginHorizontal: 12 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#B0B0B0', justifyContent: 'center', alignItems: 'center' },
  radioChecked: { borderColor: '#111827' },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#111827' },

  input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 12, marginTop: 8 },
  inputRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  inputHalf: { flex: 1 },
  paymentDetails: { marginTop: 12 },

  // confirmation
  confirmationHeader: { alignItems: 'center', gap: 8 },
  confirmationIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#DCFCE7', justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 4 },
  confirmationTitle: { fontSize: 20, fontWeight: '700', color: '#111827' },
  bookingCodeBox: { marginTop: 12, padding: 12, backgroundColor: '#F9FAFB', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  bookingCodeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  bookingCodeText: { fontSize: 16, fontWeight: '700', letterSpacing: 1 },

  noticeBox: { backgroundColor: '#F3F4F6', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  noticeText: { color: '#111827', fontSize: 14 },

  map: { height: 180, width: '100%', borderRadius: 8, overflow: 'hidden' },
  locationText: { fontSize: 14, color: '#374151', marginTop: 8 },

  outlineButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: '#D1D5DB', paddingVertical: 12, borderRadius: 8, marginTop: 12 },
  outlineButtonText: { color: '#111827', fontWeight: '600' },

  // sheet modal
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: 'white', padding: 16, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },

  primaryButton: { backgroundColor: '#111827', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  primaryButtonText: { color: 'white', fontWeight: '700' },

  // footer
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'white', borderTopWidth: 1, borderTopColor: '#E5E7EB', padding: 16 },
  footerPriceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  footerButton: { backgroundColor: '#111827', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  footerButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },

  // modal styles (from date picker)
  modalContainer: { flex: 1, backgroundColor: 'white' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  modalTitle: { fontSize: 18, fontWeight: '600' },
  modalCloseButton: { position: 'absolute', right: 16, top: 16, padding: 4 },
  modalFooter: { flexDirection: 'row', padding: 16, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  clearButton: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6', marginRight: 8 },
  clearButtonText: { fontSize: 16, fontWeight: '600', color: '#111827' },
  showButton: { flex: 2, padding: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111827', marginLeft: 8 },
  showButtonText: { fontSize: 16, fontWeight: '600', color: 'white' },
  disabledButton: { backgroundColor: '#D1D5DB' },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
},
});
