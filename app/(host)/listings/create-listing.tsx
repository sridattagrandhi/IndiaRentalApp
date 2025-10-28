// app/(host)/create-listing.tsx
import { Stack, useRouter } from 'expo-router';
import {
  ArrowLeft, ArrowRight,
  Bed, Check, ChevronDown, DollarSign, FileText, Home,
  Image as ImageIcon, MapPin, Minus, Plus, Shield, Upload, X
} from 'lucide-react-native';
import React, { useState } from 'react';
import {
  Alert, Image, SafeAreaView, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View
} from 'react-native';

// --- Types and Constants ---
type StepId =
  | 'property-type' | 'location' | 'details' | 'amenities' | 'photos'
  | 'title-description' | 'pricing' | 'rules' | 'review';

interface StepConfig { id: StepId; title: string; icon: React.ReactNode; }

const steps: StepConfig[] = [
  { id: 'property-type', title: 'Type', icon: <Home size={18} color="#4B5563" /> },
  { id: 'location', title: 'Location', icon: <MapPin size={18} color="#4B5563" /> },
  { id: 'details', title: 'Details', icon: <Bed size={18} color="#4B5563" /> },
  { id: 'amenities', title: 'Amenities', icon: <Check size={18} color="#4B5563" /> },
  { id: 'photos', title: 'Photos', icon: <ImageIcon size={18} color="#4B5563" /> },
  { id: 'title-description', title: 'Description', icon: <FileText size={18} color="#4B5563" /> },
  { id: 'pricing', title: 'Pricing', icon: <DollarSign size={18} color="#4B5563" /> },
  { id: 'rules', title: 'Rules', icon: <Shield size={18} color="#4B5563" /> },
  { id: 'review', title: 'Review', icon: <Check size={18} color="#4B5563" /> },
];

const ProgressBar = ({ value }: { value: number }) => (
  <View style={styles.progressWrap}>
    <View style={[styles.progressTrack]}>
      <View style={[styles.progressBar, { width: `${value}%` }]} />
    </View>
  </View>
);

// --- Main ---
export default function CreateListingPage() {
  const router = useRouter();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const currentStep = steps[currentStepIndex].id;
  const progressPercent = ((currentStepIndex + 1) / steps.length) * 100;

  const [listingData, setListingData] = useState({
    propertyType: '',
    address: '', city: '', state: '', pincode: '',
    bedrooms: 1, bathrooms: 1, guests: 2, beds: 1,
    amenities: [] as string[],
    photos: [] as string[],
    title: '', description: '',
    basePrice: '', weekendPrice: '',
    cleaningFee: '', securityDeposit: '',
    checkInTime: '14:00', checkOutTime: '11:00',
    rules: [] as string[],
  });

  const updateData = (updates: Partial<typeof listingData>) =>
    setListingData(prev => ({ ...prev, ...updates }));

  const goBackFromHeader = () => {
    if (currentStepIndex === 0) {
      router.replace('/(host)/listings');
    } else {
      setCurrentStepIndex(i => Math.max(0, i - 1));
    }
  };

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) setCurrentStepIndex(i => i + 1);
  };

  const handlePrevious = () => {
    if (currentStepIndex === 0) router.replace('/(host)/listings');
    else setCurrentStepIndex(i => Math.max(0, i - 1));
  };

  const handleComplete = () => {
    Alert.alert('Listing Submitted', 'Your listing is under review.');
    router.replace('/(host)/listings');
  };

  const handleSaveDraft = () => {
    Alert.alert('Draft Saved', 'Your progress has been saved.');
    router.replace('/(host)/listings');
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'property-type':
        return <PropertyTypeStep value={listingData.propertyType} onChange={(v) => updateData({ propertyType: v })} />;
      case 'location':
        return <LocationStep data={listingData} onChange={updateData} />;
      case 'details':
        return <DetailsStep data={listingData} onChange={updateData} />;
      case 'amenities':
        return <AmenitiesStep selected={listingData.amenities} onChange={(a) => updateData({ amenities: a })} />;
      case 'photos':
        return <PhotosStep photos={listingData.photos} onChange={(p) => updateData({ photos: p })} />;
      case 'title-description':
        return <TitleDescriptionStep data={listingData} onChange={updateData} />;
      case 'pricing':
        return <PricingStep data={listingData} onChange={updateData} />;
      case 'rules':
        return <RulesStep data={listingData} onChange={updateData} />;
      case 'review':
        return <ReviewStep data={listingData} />;
      default:
        return <Text>Unknown Step</Text>;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity onPress={goBackFromHeader} style={styles.headerIconBtn}>
            <ArrowLeft size={22} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Listing</Text>
          <TouchableOpacity onPress={handleSaveDraft} style={styles.saveDraftBtn}>
            <Text style={styles.saveDraftText}>Save Draft</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.headerSubLine}>Step {currentStepIndex + 1} of {steps.length}</Text>
        <ProgressBar value={progressPercent} />
      </View>

      {/* Content */}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {renderStepContent()}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.footerRow}>
          <TouchableOpacity
            style={[styles.navBtn, styles.backBtn, currentStepIndex === 0 && styles.backBtnEnabled]}
            onPress={handlePrevious}
          >
            <ArrowLeft size={16} color="#111827" />
            <Text style={styles.backBtnText}>Back</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navBtn, styles.nextBtn]}
            onPress={currentStep === 'review' ? handleComplete : handleNext}
          >
            <Text style={styles.nextBtnText}>{currentStep === 'review' ? 'Publish Listing' : 'Next'}</Text>
            {currentStep !== 'review' && <ArrowRight size={16} color="#FFFFFF" />}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

// =========================
// Steps
// =========================

function PropertyTypeStep({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const items = [
    { id: 'apartment', label: 'Apartment', description: 'A place within a multi-unit building' },
    { id: 'house', label: 'House', description: 'A standalone home' },
    { id: 'villa', label: 'Villa', description: 'Luxury standalone home' },
    { id: 'studio', label: 'Studio', description: 'Small one-room apartment' },
    { id: 'cottage', label: 'Cottage', description: 'Cozy small house' },
    { id: 'room', label: 'Private Room', description: 'A room in a shared space' },
  ];

  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>What type of property is this?</Text>
      <Text style={styles.stepSubtitle}>Choose the option that best describes your place</Text>

      <View style={{ gap: 12 }}>
        {items.map(it => (
          <TouchableOpacity key={it.id} style={[styles.radioCard]} onPress={() => onChange(it.id)}>
            <View style={[styles.radioOuter, value === it.id && styles.radioOuterSelected]}>
              {value === it.id && <View style={styles.radioInner} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.radioLabel}>{it.label}</Text>
              <Text style={styles.radioDescription}>{it.description}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function LocationStep({ data, onChange }: { data: any; onChange: (u: any) => void }) {
  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Where’s your property?</Text>
      <Text style={styles.stepSubtitle}>Guests get the exact address after booking</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Street Address</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter street address"
          value={data.address}
          onChangeText={(t) => onChange({ address: t })}
        />
      </View>

      <View style={styles.row}>
        <View style={[styles.inputGroup, { flex: 1 }]}>
          <Text style={styles.label}>City</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Bangalore"
            value={data.city}
            onChangeText={(t) => onChange({ city: t })}
          />
        </View>
        <View style={[styles.inputGroup, { flex: 1 }]}>
          <Text style={styles.label}>State</Text>
          <TouchableOpacity style={styles.input} onPress={() => Alert.alert('Select State', 'Implement Picker')}>
            <Text style={data.state ? styles.inputText : styles.inputPlaceholder}>
              {data.state || 'Select State'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>PIN Code</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., 560001"
          keyboardType="number-pad"
          maxLength={6}
          value={data.pincode}
          onChangeText={(t) => onChange({ pincode: t.replace(/[^0-9]/g, '') })}
        />
      </View>
    </View>
  );
}

function DetailsStep({ data, onChange }: { data: any; onChange: (u: any) => void }) {
  const Counter = ({ label, value, onDec, onInc, min = 0 }: any) => (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <View style={styles.counterControls}>
        <TouchableOpacity
          onPress={onDec}
          style={[styles.counterBtn, value <= min && styles.counterBtnDisabled]}
          disabled={value <= min}
        >
          <Minus size={18} color={value <= min ? '#9CA3AF' : '#111827'} />
        </TouchableOpacity>
        <Text style={styles.counterValue}>{value}</Text>
        <TouchableOpacity onPress={onInc} style={styles.counterBtn}>
          <Plus size={18} color="#111827" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Tell us about your space</Text>
      <Text style={styles.stepSubtitle}>Basic property details</Text>

      <Counter label="Guests" value={data.guests} min={1}
               onDec={() => onChange({ guests: Math.max(1, data.guests - 1) })}
               onInc={() => onChange({ guests: data.guests + 1 })} />
      <Counter label="Bedrooms" value={data.bedrooms}
               onDec={() => onChange({ bedrooms: Math.max(0, data.bedrooms - 1) })}
               onInc={() => onChange({ bedrooms: data.bedrooms + 1 })} />
      <Counter label="Beds" value={data.beds} min={1}
               onDec={() => onChange({ beds: Math.max(1, data.beds - 1) })}
               onInc={() => onChange({ beds: data.beds + 1 })} />
      <Counter label="Bathrooms" value={data.bathrooms} min={1}
               onDec={() => onChange({ bathrooms: Math.max(1, data.bathrooms - 1) })}
               onInc={() => onChange({ bathrooms: data.bathrooms + 1 })} />
    </View>
  );
}

function AmenitiesStep({ selected, onChange }: { selected: string[]; onChange: (a: string[]) => void }) {
  const list = ['WiFi', 'AC', 'Kitchen', 'Washing machine', 'TV', 'Free parking', 'Pool', 'Gym', 'Hot water/Geyser', 'Workspace'];

  const toggle = (a: string) =>
    onChange(selected.includes(a) ? selected.filter(x => x !== a) : [...selected, a]);

  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>What amenities do you offer?</Text>
      <Text style={styles.stepSubtitle}>Select all available amenities</Text>

      <View style={styles.amenitiesGrid}>
        {list.map(a => {
          const on = selected.includes(a);
          return (
            <TouchableOpacity key={a} style={[styles.amenityCard, on && styles.amenityCardOn]} onPress={() => toggle(a)}>
              <Text style={[styles.amenityText, on && styles.amenityTextOn]}>{a}</Text>
              {on && <Check size={16} color="white" />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function PhotosStep({ photos, onChange }: { photos: string[]; onChange: (p: string[]) => void }) {
  const add = async () => {
    Alert.alert('Upload Photo', 'Implement image picker');
  };
  const remove = (i: number) => onChange(photos.filter((_, idx) => idx !== i));

  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Add property photos</Text>
      <Text style={styles.stepSubtitle}>Upload at least 5 high-quality photos</Text>

      <View style={styles.photosGrid}>
        {photos.map((uri, i) => (
          <View key={i} style={styles.photoBox}>
            <Image source={{ uri }} style={styles.photoImg} />
            <TouchableOpacity style={styles.photoRemove} onPress={() => remove(i)}>
              <X size={14} color="white" />
            </TouchableOpacity>
            {i === 0 && <View style={styles.coverBadge}><Text style={styles.coverBadgeText}>Cover</Text></View>}
          </View>
        ))}

        <TouchableOpacity style={styles.photoAdd} onPress={add}>
          <Upload size={30} color="#6B7280" />
          <Text style={styles.photoAddText}>Upload photo</Text>
        </TouchableOpacity>
      </View>

      {!!photos.length && (
        <Text style={styles.photoCount}>{photos.length} photo{photos.length !== 1 ? 's' : ''} uploaded</Text>
      )}
    </View>
  );
}

function TitleDescriptionStep({ data, onChange }: { data: any; onChange: (u: any) => void }) {
  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Title & Description</Text>
      <Text style={styles.stepSubtitle}>Make your listing appealing</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Listing Title</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., Cozy 2BHK Apartment"
          value={data.title}
          onChangeText={(t) => onChange({ title: t })}
          maxLength={60}
        />
        <Text style={styles.charCount}>{data.title.length}/60</Text>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Describe your space..."
          value={data.description}
          onChangeText={(t) => onChange({ description: t })}
          multiline
          maxLength={500}
        />
        <Text style={styles.charCount}>{data.description.length}/500</Text>
      </View>

      <View style={styles.tipsCard}>
        <Text style={styles.tipsTitle}>Tips for a great description:</Text>
        <Text style={styles.tipsItem}>• Highlight unique features</Text>
        <Text style={styles.tipsItem}>• Mention nearby attractions</Text>
        <Text style={styles.tipsItem}>• Describe the neighborhood</Text>
      </View>
    </View>
  );
}

function PricingStep({ data, onChange }: { data: any; onChange: (u: any) => void }) {
  const Price = ({ label, placeholder, value, onUpdate, hint }: any) => (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.priceRow}>
        <Text style={styles.currency}>₹</Text>
        <TextInput
          style={styles.priceInput}
          placeholder={placeholder}
          keyboardType="numeric"
          value={value}
          onChangeText={onUpdate}
        />
      </View>
      {!!hint && <Text style={styles.inputHint}>{hint}</Text>}
    </View>
  );

  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Set your pricing</Text>
      <Text style={styles.stepSubtitle}>You can change this later</Text>

      <Price label="Base price per night" placeholder="2000" value={data.basePrice}
             onUpdate={(t: string) => onChange({ basePrice: t.replace(/[^0-9]/g, '') })} />
      <Price label="Weekend price (optional)" placeholder="2500" value={data.weekendPrice}
             onUpdate={(t: string) => onChange({ weekendPrice: t.replace(/[^0-9]/g, '') })}
             hint="Charge more on Fri/Sat" />
      <View style={styles.divider} />
      <Price label="Cleaning fee (optional)" placeholder="500" value={data.cleaningFee}
             onUpdate={(t: string) => onChange({ cleaningFee: t.replace(/[^0-9]/g, '') })} />
      <Price label="Security deposit (optional)" placeholder="2000" value={data.securityDeposit}
             onUpdate={(t: string) => onChange({ securityDeposit: t.replace(/[^0-9]/g, '') })}
             hint="Refundable after checkout" />
    </View>
  );
}

function RulesStep({ data, onChange }: { data: any; onChange: (u: any) => void }) {
  const rules = ['No smoking', 'No pets', 'No parties or events', 'Suitable for children'];

  const toggle = (r: string) =>
    onChange({ rules: data.rules.includes(r) ? data.rules.filter((x: string) => x !== r) : [...data.rules, r] });

  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Set house rules</Text>
      <Text style={styles.stepSubtitle}>Help guests know what to expect</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Check-in time (approx)</Text>
        <TextInput
          style={styles.input}
          value={data.checkInTime}
          onChangeText={(t) => onChange({ checkInTime: t })}
          placeholder="e.g., 14:00 or 2 PM"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Check-out time (approx)</Text>
        <TextInput
          style={styles.input}
          value={data.checkOutTime}
          onChangeText={(t) => onChange({ checkOutTime: t })}
          placeholder="e.g., 11:00 or 11 AM"
        />
      </View>

      <View style={styles.divider} />

      <Text style={styles.label}>Common House Rules</Text>
      <View style={{ gap: 8 }}>
        {rules.map(r => {
          const on = data.rules.includes(r);
          return (
            <TouchableOpacity key={r} style={[styles.ruleCard, on && styles.ruleCardOn]} onPress={() => toggle(r)}>
              <Text style={[styles.ruleText, on && styles.ruleTextOn]}>{r}</Text>
              {on && <Check size={16} color="white" />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function ReviewStep({ data }: { data: any }) {
  const Row = ({ label, value }: { label: string; value: string | number }) => (
    <View style={styles.reviewRow}>
      <Text style={styles.reviewLabel}>{label}:</Text>
      <Text style={styles.reviewValue}>{value}</Text>
    </View>
  );

  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Review your listing</Text>
      <Text style={styles.stepSubtitle}>Ensure everything looks good</Text>

      <View style={styles.reviewCard}>
        <Text style={styles.reviewSection}>Property Details</Text>
        <Row label="Type" value={(data.propertyType || 'Not set') as string} />
        <Row label="Location" value={`${data.city || 'N/A'}, ${data.state || 'N/A'}`} />
        <Row label="Guests" value={data.guests} />
        <Row label="Bedrooms" value={data.bedrooms} />
        <Row label="Bathrooms" value={data.bathrooms} />
      </View>

      <View style={styles.reviewCard}>
        <Text style={styles.reviewSection}>Amenities</Text>
        <View style={styles.amenitiesReviewWrap}>
          {data.amenities.length
            ? data.amenities.map((a: string) => (
                <View key={a} style={styles.amenityBadge}><Text style={styles.amenityBadgeText}>{a}</Text></View>
              ))
            : <Text style={styles.muted}>No amenities selected</Text>}
        </View>
      </View>

      <View style={styles.reviewCard}>
        <Text style={styles.reviewSection}>Photos ({data.photos.length})</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginLeft: -4 }}>
          {data.photos.length
            ? data.photos.map((u: string, i: number) => <Image key={i} source={{ uri: u }} style={styles.photoThumb} />)
            : <Text style={styles.muted}>No photos uploaded</Text>}
        </ScrollView>
      </View>

      <View style={styles.reviewCard}>
        <Text style={styles.reviewSection}>Pricing</Text>
        <Row label="Base Price" value={`₹${data.basePrice || '0'} / night`} />
        {!!data.weekendPrice && <Row label="Weekend Price" value={`₹${data.weekendPrice} / night`} />}
        {!!data.cleaningFee && <Row label="Cleaning Fee" value={`₹${data.cleaningFee}`} />}
      </View>

      <View style={styles.publishCard}>
        <Check size={20} color="#15803D" />
        <Text style={styles.publishText}>Ready to publish! Your listing will be reviewed before going live.</Text>
      </View>
    </View>
  );
}

// =========================
// Styles
// =========================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },

  header: {
    backgroundColor: 'white',
    paddingTop: 8,
    paddingBottom: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerIconBtn: { padding: 6, borderRadius: 10 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#111827' },
  saveDraftBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
  },
  saveDraftText: { color: '#111827', fontWeight: '600' },
  headerSubLine: { marginTop: 8, fontSize: 13, color: '#6B7280' },

  progressWrap: { marginTop: 8 },
  progressTrack: { height: 3, backgroundColor: '#E5E7EB', borderRadius: 999 },
  progressBar: { height: 3, backgroundColor: '#111827', borderRadius: 999 },

  scroll: { flex: 1, backgroundColor: '#F9FAFB' },
  scrollContent: { padding: 16, paddingBottom: 100 },

  stepContainer: { gap: 14 },
  stepTitle: { fontSize: 22, fontWeight: '700', color: '#111827' },
  stepSubtitle: { fontSize: 15, color: '#6B7280', marginBottom: 6 },

  // Inputs
  inputGroup: { marginBottom: 14 },
  label: { fontSize: 15, fontWeight: '500', color: '#374151', marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF',
    borderRadius: 12, paddingHorizontal: 12, height: 46, fontSize: 16, color: '#111827',
  },
  inputText: { color: '#111827', fontSize: 16 },
  inputPlaceholder: { color: '#9CA3AF', fontSize: 16 },
  row: { flexDirection: 'row', gap: 12 },

  // Radio cards
  radioCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  radioOuter: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2,
    borderColor: '#B0B0B0', alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  radioOuterSelected: { borderColor: '#111827' },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#111827' },
  radioLabel: { fontSize: 16, fontWeight: '600', color: '#111827' },
  radioDescription: { fontSize: 14, color: '#6B7280', marginTop: 2 },

  // Counters
  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  detailLabel: { fontSize: 16, color: '#374151' },
  counterControls: { flexDirection: 'row', alignItems: 'center' },
  counterBtn: {
    width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: '#B0B0B0',
    alignItems: 'center', justifyContent: 'center',
  },
  counterBtnDisabled: { borderColor: '#E5E7EB' },
  counterValue: { minWidth: 28, textAlign: 'center', fontSize: 16, fontWeight: '700', marginHorizontal: 14 },

  // Amenities
  amenitiesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  amenityCard: {
    width: '48%', paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  amenityCardOn: { backgroundColor: '#111827', borderColor: '#111827' },
  amenityText: { color: '#374151', fontSize: 14 },
  amenityTextOn: { color: '#FFFFFF', fontWeight: '600' },

  // Photos
  photosGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoBox: { width: '48%', aspectRatio: 1, borderRadius: 12, overflow: 'hidden', backgroundColor: '#F3F4F6', position: 'relative' },
  photoImg: { width: '100%', height: '100%' },
  photoRemove: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(220,38,38,0.85)', width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  coverBadge: { position: 'absolute', bottom: 8, left: 8, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  coverBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  photoAdd: {
    width: '48%', aspectRatio: 1, borderRadius: 12, borderStyle: 'dashed', borderWidth: 2, borderColor: '#D1D5DB',
    alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#F9FAFB',
  },
  photoAddText: { color: '#6B7280', fontSize: 14 },
  photoCount: { marginTop: 6, color: '#6B7280' },

  textArea: { height: 120, textAlignVertical: 'top', paddingTop: 10 },
  charCount: { fontSize: 12, color: '#9CA3AF', textAlign: 'right', marginTop: 4 },

  tipsCard: { marginTop: 8, backgroundColor: '#EFF6FF', borderColor: '#BFDBFE', borderWidth: 1, padding: 16, borderRadius: 12 },
  tipsTitle: { fontWeight: '700', color: '#1E40AF', marginBottom: 8 },
  tipsItem: { color: '#1D4ED8', marginBottom: 4 },

  priceRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, backgroundColor: '#fff' },
  currency: { paddingLeft: 12, color: '#6B7280', fontSize: 16 },
  priceInput: { flex: 1, height: 46, fontSize: 16, paddingHorizontal: 12, color: '#111827' },
  inputHint: { fontSize: 12, color: '#9CA3AF', marginTop: 4 },
  divider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 16 },

  ruleCard: { padding: 12, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ruleCardOn: { backgroundColor: '#111827', borderColor: '#111827' },
  ruleText: { color: '#374151', fontSize: 14 },
  ruleTextOn: { color: '#fff', fontWeight: '600' },

  reviewCard: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', padding: 16, marginBottom: 12 },
  reviewSection: { fontSize: 16, fontWeight: '600', marginBottom: 10 },
  reviewRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  reviewLabel: { fontSize: 14, color: '#6B7280' },
  reviewValue: { fontSize: 14, fontWeight: '600', textTransform: 'capitalize' },
  amenitiesReviewWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  amenityBadge: { backgroundColor: '#F3F4F6', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  amenityBadgeText: { fontSize: 13 },
  photoThumb: { width: 80, height: 80, borderRadius: 8, marginRight: 8, backgroundColor: '#F3F4F6' },
  muted: { color: '#9CA3AF' },

  publishCard: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0', borderWidth: 1, borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  publishText: { color: '#065F46', flex: 1 },

  footer: { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingHorizontal: 16, paddingVertical: 12 },
  footerRow: { flexDirection: 'row', gap: 12 },
  navBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12 },
  backBtn: { backgroundColor: '#F3F4F6', paddingHorizontal: 18 },
  backBtnEnabled: { backgroundColor: '#F3F4F6' },
  backBtnText: { color: '#111827', fontWeight: '700' },
  nextBtn: { flex: 1, backgroundColor: '#111827' },
  nextBtnText: { color: '#fff', fontWeight: '800' },
});

// Minimal placeholders (keep as-is)
const Select = ({ children, ...props }: any) => <View {...props}>{children}</View>;
const SelectTrigger = ({ children, ...props }: any) => (
  <TouchableOpacity {...props}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      {children}
      <ChevronDown size={16} />
    </View>
  </TouchableOpacity>
);
const SelectValue = ({ placeholder }: any) => <Text style={styles.inputPlaceholder}>{placeholder}</Text>;
const SelectContent = ({ children, ...props }: any) => <View {...props}>{children}</View>;
const SelectItem = ({ children, value, ...props }: any) => (
  <TouchableOpacity {...props}><Text>{children}</Text></TouchableOpacity>
);
