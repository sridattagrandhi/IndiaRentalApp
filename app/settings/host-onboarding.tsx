// app/settings/host-onboarding.tsx
import { Stack, useRouter } from 'expo-router';
// Import ArrowLeft for custom header
import { AlertCircle, ArrowLeft, Camera, CheckCircle, Circle, FileText, Home, Landmark } from 'lucide-react-native';
import React, { useState } from 'react';
// Import necessary components for custom header
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Simple Progress Bar component
const ProgressBar = ({ value }: { value: number }) => (
    <View style={styles.progressTrack}>
        <View style={[styles.progressBar, { width: `${Math.max(0, Math.min(100, value))}%` }]} />
    </View>
);

interface OnboardingStep {
  id: string; title: string; description: string;
  status: 'completed' | 'in-progress' | 'pending';
  icon: React.ReactNode;
}

const initialSteps: OnboardingStep[] = [
  { id: 'kyc', title: 'KYC Verification', description: 'Verify identity (PAN, Aadhaar)', status: 'pending', icon: <FileText size={20} color="#4B5563" /> },
  { id: 'bank', title: 'Bank Account', description: 'Add bank details for payouts', status: 'pending', icon: <Landmark size={20} color="#4B5563" /> },
  { id: 'property', title: 'List Property', description: 'Add your first property', status: 'pending', icon: <Home size={20} color="#4B5563" /> },
  { id: 'photos', title: 'Property Photos', description: 'Upload high-quality photos', status: 'pending', icon: <Camera size={20} color="#4B5563" /> }
];

export default function HostOnboardingPage() {
  const router = useRouter(); // Use router for back navigation
  const [steps, setSteps] = useState(initialSteps);

  const completedSteps = steps.filter(s => s.status === 'completed').length;
  const progressPercent = (completedSteps / steps.length) * 100;

  const handleStepClick = (stepId: string) => {
    Alert.alert(`Maps to ${stepId}`, `Open ${stepId} section...`);
    // Add navigation logic here, e.g., router.push(`/settings/verify/${stepId}`)
  };

  const getStepIcon = (step: OnboardingStep) => {
     if (step.status === 'completed') return <CheckCircle size={20} color="#15803D" />;
     if (step.status === 'in-progress') return <Circle size={20} color="#2563EB" />; // Or a different icon like Edit2
     return step.icon;
  };

  const getIconBgColor = (status: string) => {
     if (status === 'completed') return styles.iconBgCompleted;
     if (status === 'in-progress') return styles.iconBgInProgress;
     return styles.iconBgPending;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Hide default header */}
      <Stack.Screen options={{ headerShown: false }} />

      {/* Custom Header */}
      <View style={styles.customHeader}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Host Setup</Text>
        {/* Placeholder for balance */}
        <View style={styles.headerRightPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Progress Overview */}
        <View style={styles.card}>
           <View style={styles.progressHeader}>
             <View>
                <Text style={styles.progressTitle}>Complete your setup</Text>
                <Text style={styles.progressSubtitle}>{completedSteps} of {steps.length} steps completed</Text>
             </View>
              <View style={styles.progressBadge}><Text style={styles.progressBadgeText}>{Math.round(progressPercent)}%</Text></View>
           </View>
           <ProgressBar value={progressPercent} />
           {completedSteps === steps.length ? (
               <View style={styles.successBanner}>
                 <CheckCircle size={16} color="#059669" />
                 <View style={styles.bannerTextContainer}>
                    <Text style={styles.successBannerText}>Setup complete!</Text>
                    <Text style={styles.successBannerSubtext}>You're all set to start hosting.</Text>
                 </View>
              </View>
           ) : (
                <View style={styles.infoBanner}>
                    <AlertCircle size={16} color="#2563EB" />
                    <View style={styles.bannerTextContainer}>
                        <Text style={styles.infoBannerText}>Complete all steps to start hosting.</Text>
                        <Text style={styles.infoBannerSubtext}>Ensures a safe platform for everyone.</Text>
                    </View>
                </View>
           )}
        </View>

        {/* Onboarding Steps */}
        <View style={styles.stepsContainer}>
          {steps.map((step) => (
            <TouchableOpacity key={step.id} style={styles.stepCard} onPress={() => handleStepClick(step.id)}>
              <View style={[styles.stepIconBg, getIconBgColor(step.status)]}>
                 {getStepIcon(step)}
              </View>
              <View style={styles.stepTextContainer}>
                 <View style={styles.stepTitleRow}>
                    <Text style={styles.stepTitle}>{step.title}</Text>
                     {step.status === 'completed' && <View style={styles.doneBadge}><Text style={styles.doneBadgeText}>Done</Text></View>}
                     {step.status === 'in-progress' && <View style={styles.inProgressBadge}><Text style={styles.inProgressBadgeText}>In progress</Text></View>}
                 </View>
                 <Text style={styles.stepDescription}>{step.description}</Text>
              </View>
               {step.status !== 'completed' && (
                // Wrap button in View to prevent TouchableOpacity ripple effect expanding
                <View>
                    <TouchableOpacity style={styles.stepButton} onPress={() => handleStepClick(step.id)}>
                        <Text style={styles.stepButtonText}>{step.status === 'in-progress' ? 'Continue' : 'Start'}</Text>
                    </TouchableOpacity>
                </View>
               )}
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.divider} />

        {/* Host Status Badges */}
        <View style={styles.card}>
            <Text style={styles.statusSectionTitle}>Your Host Status</Text>
             <View style={styles.statusRow}>
                <View style={styles.statusLabelContainer}><FileText size={16} color="#6B7280"/><Text style={styles.statusLabel}>KYC Verified</Text></View>
                {/* Example: Replace with actual state later */}
                <View style={styles.statusBadgePending}><Text style={styles.statusBadgeText}>Not verified</Text></View>
             </View>
             <View style={styles.statusRow}>
                <View style={styles.statusLabelContainer}><Landmark size={16} color="#6B7280"/><Text style={styles.statusLabel}>Bank Verified</Text></View>
                {/* Example: Replace with actual state later */}
                <View style={styles.statusBadgePending}><Text style={styles.statusBadgeText}>Not verified</Text></View>
             </View>
              <View style={styles.statusRow}>
                <View style={styles.statusLabelContainer}><Home size={16} color="#6B7280"/><Text style={styles.statusLabel}>Property Verified</Text></View>
                {/* Example: Replace with actual state later */}
                <View style={styles.statusBadgePending}><Text style={styles.statusBadgeText}>Not verified</Text></View>
             </View>
             <View style={styles.warningBanner}>
                 <Text style={styles.warningBannerText}>Verified badges help guests trust your listings.</Text>
             </View>
        </View>

        {/* Why Verify? */}
        <View style={styles.card}>
            <Text style={styles.statusSectionTitle}>Why verify?</Text>
            <View style={styles.benefitItem}><CheckCircle size={16} color="#10B981" /><Text style={styles.benefitText}>Build trust with potential guests</Text></View>
            <View style={styles.benefitItem}><CheckCircle size={16} color="#10B981" /><Text style={styles.benefitText}>Rank higher in search results</Text></View>
            <View style={styles.benefitItem}><CheckCircle size={16} color="#10B981" /><Text style={styles.benefitText}>Access host protection programs</Text></View>
            <View style={styles.benefitItem}><CheckCircle size={16} color="#10B981" /><Text style={styles.benefitText}>Faster payouts and better support</Text></View>
        </View>
      </ScrollView>
    </SafeAreaView>
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
  scrollContent: { padding: 16, gap: 16, paddingBottom: 40 },
  card: { backgroundColor: 'white', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  progressTitle: { fontSize: 18, fontWeight: '600', marginBottom: 2 },
  progressSubtitle: { fontSize: 14, color: '#6B7280' },
  progressBadge: { backgroundColor: '#E5E7EB', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  progressBadgeText: { fontSize: 12, fontWeight: '500' },
  progressTrack: { height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, overflow: 'hidden' },
  progressBar: { height: '100%', backgroundColor: '#111827', borderRadius: 4 },
   successBanner: {
    marginTop: 16, backgroundColor: '#ECFDF5', borderColor: '#A7F3D0', borderWidth: 1, borderRadius: 8,
    padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 8,
  },
  bannerTextContainer: { flex: 1 },
  successBannerText: { fontSize: 14, fontWeight: '500', color: '#065F46' },
  successBannerSubtext: { fontSize: 12, color: '#047857', marginTop: 2 },
   infoBanner: {
    marginTop: 16, backgroundColor: '#EFF6FF', borderColor: '#BFDBFE', borderWidth: 1, borderRadius: 8,
    padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 8,
  },
  infoBannerText: { fontSize: 14, fontWeight: '500', color: '#1E40AF' },
  infoBannerSubtext: { fontSize: 12, color: '#1D4ED8', marginTop: 2 },
  stepsContainer: { gap: 12 },
  stepCard: {
    backgroundColor: 'white', borderRadius: 12, padding: 16, borderWidth: 1,
    borderColor: '#E5E7EB', flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  stepIconBg: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  iconBgCompleted: { backgroundColor: '#D1FAE5' },
  iconBgInProgress: { backgroundColor: '#DBEAFE' },
  iconBgPending: { backgroundColor: '#F3F4F6' },
  stepTextContainer: { flex: 1 },
  stepTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  stepTitle: { fontSize: 16, fontWeight: '600' },
  doneBadge: { backgroundColor: '#D1FAE5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  doneBadgeText: { fontSize: 10, fontWeight: '500', color: '#065F46' },
   inProgressBadge: { backgroundColor: '#DBEAFE', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
   inProgressBadgeText: { fontSize: 10, fontWeight: '500', color: '#1E40AF' },
  stepDescription: { fontSize: 14, color: '#6B7280' },
  stepButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: '#D1D5DB', marginLeft: 'auto' },
  stepButtonText: { fontSize: 14, fontWeight: '500', color: '#111827' },
  divider: { height: 1, backgroundColor: '#E5E7EB' },
  statusSectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  statusLabelContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusLabel: { fontSize: 14 },
  statusBadgePending: { backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusBadgeText: { fontSize: 12, fontWeight: '500', color: '#1F2937' },
  warningBanner: {
    marginTop: 16, backgroundColor: '#FEF3C7', borderColor: '#FDE68A', borderWidth: 1, borderRadius: 8, padding: 12,
  },
  warningBannerText: { fontSize: 14, color: '#92400E' },
  benefitItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  benefitText: { fontSize: 14, color: '#4B5563', flex: 1 },
});