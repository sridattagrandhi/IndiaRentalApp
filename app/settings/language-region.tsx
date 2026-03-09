import { apiPut } from "@/services/api";
import { Stack, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { ArrowLeft, Check, Globe } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import i18n from "../../i18n";

// ✅ Only AWS Translate supported (India-relevant)
const languages = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी" },
  { code: "te", name: "Telugu", nativeName: "తెలుగు" },
  { code: "ta", name: "Tamil", nativeName: "தமிழ்" },
  { code: "kn", name: "Kannada", nativeName: "ಕನ್ನಡ" },
  { code: "ml", name: "Malayalam", nativeName: "മലയാളം" },
  { code: "mr", name: "Marathi", nativeName: "मराठी" },
  { code: "gu", name: "Gujarati", nativeName: "ગુજરાતી" },
  { code: "bn", name: "Bengali", nativeName: "বাংলা" },
  { code: "pa", name: "Punjabi", nativeName: "ਪੰਜਾਬੀ" },
  { code: "ur", name: "Urdu", nativeName: "اردو" },
];

const dateFormats = [
  { id: "dmy", label: "DD/MM/YYYY", example: "25/10/2025" },
  { id: "mdy", label: "MM/DD/YYYY", example: "10/25/2025" },
  { id: "ymd", label: "YYYY-MM-DD", example: "2025-10-25" },
];

const numberFormats = [
  { id: "in", label: "Indian (1,00,000)", example: "₹1,00,000.00" },
  { id: "intl", label: "International (100,000)", example: "₹100,000.00" },
];

export default function LanguageRegionPage() {
  const router = useRouter();
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [selectedDateFormat, setSelectedDateFormat] = useState("dmy");
  const [selectedNumberFormat, setSelectedNumberFormat] = useState("in");
  const [saving, setSaving] = useState(false);
  const { t } = useTranslation();

  // ✅ Load persisted settings on open
  useEffect(() => {
    (async () => {
      const [lang, df, nf] = await Promise.all([
        SecureStore.getItemAsync("preferred_language"),
        SecureStore.getItemAsync("date_format"),
        SecureStore.getItemAsync("number_format"),
      ]);

      if (lang) setSelectedLanguage(lang);
      if (df) setSelectedDateFormat(df);
      if (nf) setSelectedNumberFormat(nf);
    })();
  }, []);

  const handleSave = async () => {
    try {
      // Save locally
      await SecureStore.setItemAsync("preferred_language", selectedLanguage);

      // Save to backend (language already changed on tap)
      await apiPut("/v1/profile", { preferred_language: selectedLanguage });

      Alert.alert(t("common.success"), "Language updated successfully");
      router.back();
    } catch (e) {
      // ✅ Revert language if save fails
      const previousLang = await SecureStore.getItemAsync("preferred_language");
      if (previousLang) {
        setSelectedLanguage(previousLang);
        i18n.changeLanguage(previousLang);
      }
      Alert.alert(t("common.error"), t("settings.language_region.save_error"));
    }
  };

  const renderRadioItem = (
    item:
      | { code: string; name: string; nativeName: string }
      | { id: string; label: string; example: string },
    type: "language" | "date" | "number",
  ) => {
    const id = type === "language" ? (item as any).code : (item as any).id;

    const isSelected =
      (type === "language" && selectedLanguage === id) ||
      (type === "date" && selectedDateFormat === id) ||
      (type === "number" && selectedNumberFormat === id);

    const label =
      type === "language" ? (item as any).name : (item as any).label;
    const description =
      type === "language" ? (item as any).nativeName : (item as any).example;

    const handlePress = () => {
      if (type === "language") {
        setSelectedLanguage(id);
        i18n.changeLanguage(id); // ✅ Instantly refresh UI translations on tap
      } else if (type === "date") setSelectedDateFormat(id);
      else if (type === "number") setSelectedNumberFormat(id);
    };

    return (
      <TouchableOpacity key={id} style={styles.radioCard} onPress={handlePress}>
        <View
          style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}
        >
          {isSelected && <View style={styles.radioInner} />}
        </View>
        <View style={styles.radioTextContainer}>
          <Text style={styles.radioLabel}>{label}</Text>
          <Text style={styles.radioDescription}>{description}</Text>
        </View>
        {isSelected && (
          <Check size={20} color="#111827" style={styles.checkIcon} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Hide default header */}
      <Stack.Screen options={{ headerShown: false }} />

      {/* Custom Header */}
      <View style={styles.customHeader}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("profile.language_region")}</Text>
        <TouchableOpacity
          onPress={handleSave}
          style={styles.saveButtonContainer}
        >
          <Text style={styles.saveButton}>{t("common.save")}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Language Selection */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Globe size={20} color="#4B5563" />
            <Text style={styles.sectionTitle}>
              {t("settings.language_region.language")}
            </Text>
          </View>
          <Text style={styles.sectionDescription}>
            {t("settings.language_region.language_desc")}
          </Text>
          <View style={styles.radioGroup}>
            {languages.map((lang) => renderRadioItem(lang, "language"))}
          </View>
        </View>

        <View style={styles.divider} />

        {/* Currency */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t("settings.language_region.currency")}
          </Text>
          <View style={styles.currencyCard}>
            <View>
              <Text style={styles.radioLabel}>
                {t("settings.language_region.currency_inr")}
              </Text>
              <Text style={styles.radioDescription}>
                {t("settings.language_region.currency_inr_code")}
              </Text>
            </View>
            <Check size={20} color="#111827" />
          </View>
          <Text style={styles.currencyNote}>
            {t("settings.language_region.currency_desc")}
          </Text>
        </View>

        <View style={styles.divider} />

        {/* Date Format */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t("settings.language_region.date_format")}
          </Text>
          <Text style={styles.sectionDescription}>
            {t("settings.language_region.date_format_desc")}
          </Text>
          <View style={styles.radioGroup}>
            {dateFormats.map((format) => renderRadioItem(format, "date"))}
          </View>
        </View>

        <View style={styles.divider} />

        {/* Number Format */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t("settings.language_region.number_format")}
          </Text>
          <Text style={styles.sectionDescription}>
            {t("settings.language_region.number_format_desc")}
          </Text>
          <View style={styles.radioGroup}>
            {numberFormats.map((format) => renderRadioItem(format, "number"))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  // Custom Header Styles
  customHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },
  backButton: { padding: 4, width: 60 }, // Fixed width
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    flex: 1,
    textAlign: "center",
  },
  saveButtonContainer: { width: 60, alignItems: "flex-end" }, // Fixed width for balance
  saveButton: { color: "#007AFF", fontSize: 16, fontWeight: "600" },
  // End Custom Header Styles
  scrollContent: { padding: 16, paddingBottom: 40, gap: 24 },
  section: { gap: 12 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { fontSize: 18, fontWeight: "600", color: "#111827" },
  sectionDescription: { fontSize: 14, color: "#6B7280" },
  radioGroup: { gap: 8 },
  radioCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "white",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#B0B0B0",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  radioOuterSelected: { borderColor: "#111827" },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#111827",
  },
  radioTextContainer: { flex: 1 },
  radioLabel: { fontSize: 16, fontWeight: "500", color: "#111827" },
  radioDescription: { fontSize: 14, color: "#6B7280", marginTop: 2 },
  checkIcon: { marginLeft: "auto" }, // Push check to the right
  divider: { height: 1, backgroundColor: "#E5E7EB" },
  currencyCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  currencyNote: { fontSize: 12, color: "#6B7280", marginTop: 8 },
});
