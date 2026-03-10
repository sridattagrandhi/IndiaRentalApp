import { useTranslation } from 'react-i18next';
// app/settings/edit-profile.tsx
import api from '@/services/api';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

/**
 * Upload helper that supports BOTH:
 * - Presigned PUT (single URL)
 * - Presigned POST (url + fields)
 */
async function uploadWithPresign(
  presignData: any,
  localUri: string,
  contentType: string
) {
  // ---- CASE A: Presigned POST ----
  // Typical shape:
  // { url: "https://bucket.s3.amazonaws.com", fields: { key, policy, x-amz-... }, public_url: "..." }
  const postUrl: string | undefined = presignData.url || presignData.upload_url;
  const fields: Record<string, string> | undefined = presignData.fields;

  if (postUrl && fields && typeof fields === 'object') {
    const form = new FormData();

    // Must include ALL fields exactly as provided
    Object.entries(fields).forEach(([k, v]) => {
      form.append(k, v);
    });

    // React Native / Expo fetch supports { uri, name, type } file objects
    form.append('file', {
      uri: localUri,
      name: `avatar.${contentType === 'image/png' ? 'png' : 'jpg'}`,
      type: contentType,
    } as any);

    const resp = await fetch(postUrl, {
      method: 'POST',
      body: form,
      // DO NOT set Content-Type manually; fetch will set multipart boundary
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`S3 POST failed: ${resp.status} ${text}`);
    }

    return;
  }

  // ---- CASE B: Presigned PUT ----
  // Typical shape:
  // { presigned_url: "https://bucket.s3....?X-Amz-...", public_url: "..." }
  const putUrl: string | undefined =
    presignData.presigned_url || presignData.presignedUrl || presignData.put_url || presignData.putUrl;

  if (!putUrl) {
    throw new Error('Presign response missing PUT url or POST {url, fields}');
  }

  const fileResp = await fetch(localUri);
  const blob = await fileResp.blob();

  const putResp = await fetch(putUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: blob,
  });

  if (!putResp.ok) {
    const text = await putResp.text().catch(() => '');
    throw new Error(`S3 PUT failed: ${putResp.status} ${text}`);
  }
}

type ProfileResponse = {
  name: string | null;
  birthdate: string | null; // "YYYY-MM-DD"
  gender: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  country: string | null;
  avatar_url: string | null;
  email: string;
};

export default function EditProfile() {
  const { t } = useTranslation();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [localAvatarUri, setLocalAvatarUri] = useState<string | null>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [gender, setGender] = useState('');
  const [email, setEmail] = useState('');

  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [stateVal, setStateVal] = useState('');
  const [pincode, setPincode] = useState('');
  const [country, setCountry] = useState('India');

  const fullName = useMemo(() => {
    const n = `${firstName} ${lastName}`.trim();
    return n.length ? n : '';
  }, [firstName, lastName]);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<ProfileResponse>('/v1/profile');
      const p = res.data;

      setAvatarUrl(p.avatar_url);
      setLocalAvatarUri(null);
      setEmail(p.email || '');

      const name = (p.name || '').trim();
      if (name) {
        const parts = name.split(' ');
        setFirstName(parts[0] ?? '');
        setLastName(parts.slice(1).join(' ') ?? '');
      } else {
        setFirstName('');
        setLastName('');
      }

      setBirthdate(p.birthdate ?? '');
      setGender(p.gender ?? '');
      setPhone(p.phone ?? '');
      setAddress(p.address ?? '');
      setCity(p.city ?? '');
      setStateVal(p.state ?? '');
      setPincode(p.pincode ?? '');
      setCountry(p.country ?? 'India');
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message ?? 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const pickAvatar = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(t('settings.edit_profile.permission_needed_title'), t('settings.edit_profile.permission_needed_msg'));
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.9,
      });

      if (result.canceled) return;

      const uri = result.assets?.[0]?.uri;
      if (!uri) return;

      setLocalAvatarUri(uri);
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message ?? 'Failed to pick image');
    }
  }, []);

  const saveProfile = useCallback(async () => {
    setSaving(true);

    // We'll try upload, but DON'T block saving other fields if upload fails.
    let finalAvatarUrl = avatarUrl;

    try {
      if (localAvatarUri) {
        const lower = localAvatarUri.toLowerCase();
        const contentType =
          lower.endsWith('.png') ? 'image/png' :
          lower.endsWith('.jpg') || lower.endsWith('.jpeg') ? 'image/jpeg' :
          'image/jpeg';

        const presignResp = await api.post('/v1/uploads/presign', {
          content_type: contentType,
          prefix: 'avatars/',
        });

        const data = presignResp.data || {};

        // Your API might use one of these keys
        const publicUrl: string | undefined =
          data.public_url || data.publicUrl || data.file_url || data.fileUrl;

        await uploadWithPresign(data, localAvatarUri, contentType);

        if (!publicUrl) {
          // Upload succeeded but we don't know the public URL -> can't save avatar_url
          // You can adjust backend to always return public_url.
          throw new Error('Upload succeeded but presign response missing public_url');
        }

        finalAvatarUrl = publicUrl;
      }
    } catch (uploadErr: any) {
      // ✅ Allow saving other profile fields even if avatar upload failed
      Alert.alert(t('settings.edit_profile.avatar_upload_failed'), uploadErr?.message ?? 'Failed to upload avatar');
    }

    try {
      await api.put('/v1/profile', {
        name: fullName || null,
        birthdate: birthdate || null, // must be YYYY-MM-DD for date.fromisoformat
        gender: gender || null,
        phone: phone || null,
        address: address || null,
        city: city || null,
        state: stateVal || null,
        pincode: pincode || null,
        country: country || null,
        avatar_url: finalAvatarUrl || null,
      });

      setAvatarUrl(finalAvatarUrl ?? null);
      setLocalAvatarUri(null);

      Alert.alert(t('settings.edit_profile.saved_title'), t('settings.edit_profile.saved_msg'));
      router.back();
    } catch (e: any) {
      Alert.alert(t('settings.edit_profile.save_failed_title'), e?.message ?? 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  }, [
    avatarUrl,
    localAvatarUri,
    fullName,
    birthdate,
    gender,
    phone,
    address,
    city,
    stateVal,
    pincode,
    country,
    router,
  ]);

  const shownAvatar = localAvatarUri || avatarUrl;

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Edit Profile',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
              <Text style={styles.headerBtnText}>{'‹'}</Text>
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity onPress={saveProfile} disabled={saving} style={styles.headerRightBtn}>
              <Text style={[styles.headerRightText, saving && { opacity: 0.5 }]}>
                {saving ? 'Saving…' : 'Save'}
              </Text>
            </TouchableOpacity>
          ),
        }}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.avatarWrap}>
            <View style={styles.avatarCircle}>
              {shownAvatar ? (
                <Image source={{ uri: shownAvatar }} style={styles.avatarImg} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarPlaceholderText}>
                    {(firstName?.[0] || 'U').toUpperCase()}
                  </Text>
                </View>
              )}
            </View>

            <TouchableOpacity onPress={pickAvatar} style={styles.changePhotoBtn}>
              <Text style={styles.changePhotoText}>{t('settings.edit_profile.change_photo')}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionTitle}>{t('settings.edit_profile.personal_details')}</Text>

          <View style={styles.row}>
            <View style={styles.half}>
              <Text style={styles.label}>{t('settings.edit_profile.first_name')}</Text>
              <TextInput value={firstName} onChangeText={setFirstName} style={styles.input} />
            </View>
            <View style={styles.half}>
              <Text style={styles.label}>{t('settings.edit_profile.last_name')}</Text>
              <TextInput value={lastName} onChangeText={setLastName} style={styles.input} />
            </View>
          </View>

          <Text style={styles.label}>{t('settings.edit_profile.dob')}</Text>
          <TextInput
            value={birthdate}
            onChangeText={setBirthdate}
            placeholder={t('settings.date_formats.ymd_label')}
            style={styles.input}
          />

          <Text style={styles.label}>{t('settings.edit_profile.gender')}</Text>
          <TextInput
            value={gender}
            onChangeText={setGender}
            placeholder={t('settings.edit_profile.gender_hint')}
            style={styles.input}
          />

          <Text style={styles.sectionTitle}>{t('settings.edit_profile.contact_info')}</Text>

          <Text style={styles.label}>{t('settings.edit_profile.email_address')}</Text>
          <View style={styles.readonlyInput}>
            <Text style={styles.readonlyText}>{email}</Text>
          </View>
          <Text style={styles.helperText}>{t('settings.edit_profile.email_readonly_note')}</Text>

          <Text style={styles.label}>{t('settings.edit_profile.phone_number')}</Text>
          <TextInput value={phone} onChangeText={setPhone} style={styles.input} placeholder={t('settings.edit_profile.phone_hint')} />

          <Text style={styles.sectionTitle}>{t('settings.edit_profile.address')}</Text>

          <Text style={styles.label}>{t('settings.edit_profile.street_address')}</Text>
          <TextInput value={address} onChangeText={setAddress} style={styles.input} />

          <Text style={styles.label}>{t('settings.edit_profile.city')}</Text>
          <TextInput value={city} onChangeText={setCity} style={styles.input} />

          <Text style={styles.label}>{t('settings.edit_profile.state')}</Text>
          <TextInput value={stateVal} onChangeText={setStateVal} style={styles.input} />

          <Text style={styles.label}>{t('settings.edit_profile.pincode')}</Text>
          <TextInput value={pincode} onChangeText={setPincode} style={styles.input} keyboardType="number-pad" />

          <Text style={styles.label}>{t('settings.edit_profile.country')}</Text>
          <TextInput value={country} onChangeText={setCountry} style={styles.input} />

          <View style={{ height: 24 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  headerBtn: { paddingHorizontal: 10, paddingVertical: 6 },
  headerBtnText: { fontSize: 24, color: '#111827' },
  headerRightBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  headerRightText: { fontSize: 16, fontWeight: '600', color: '#2563EB' },

  avatarWrap: { alignItems: 'center', paddingVertical: 16 },
  avatarCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    overflow: 'hidden',
    backgroundColor: '#E5E7EB',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  avatarPlaceholderText: { fontSize: 28, fontWeight: '700', color: '#374151' },

  changePhotoBtn: {
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
  },
  changePhotoText: { fontSize: 14, fontWeight: '600', color: '#111827' },

  sectionTitle: { marginTop: 18, marginBottom: 10, fontSize: 20, fontWeight: '800', color: '#111827' },
  label: { marginTop: 12, marginBottom: 6, fontSize: 14, fontWeight: '600', color: '#374151' },

  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },

  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
  },

  readonlyInput: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  readonlyText: { fontSize: 16, color: '#6B7280' },
  helperText: { marginTop: 6, fontSize: 12, color: '#6B7280' },
});
