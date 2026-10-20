import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Image, ActivityIndicator, TextInput,
  TouchableOpacity, Alert, ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { updateProfile as updateFirebaseProfile } from 'firebase/auth';
import { db, storage } from '@/config/firebase';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { AppUser } from '@/types';

export default function ProfileScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [phone, setPhone] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, 'users', user.uid), (snap) => {
      const d = snap.data();
      if (!d) return;
      const p: AppUser = {
        uid: user.uid,
        name: d.name ?? '',
        surname: d.surname ?? '',
        email: d.email ?? user.email ?? '',
        phone: d.phone ?? '',
        balance: d.balance ?? 0,
        avatarUrl: d.avatarUrl ?? undefined,
        hideOnMap: d.hideOnMap === true,
        questsCompleted: d.questsCompleted ?? 0,
        createdAt: d.createdAt?.toMillis?.() ?? 0,
      };
      setProfile(p);
      setName(p.name);
      setSurname(p.surname ?? '');
      setPhone(p.phone ?? '');
    });
  }, [user]);

  const handlePickAvatar = async () => {
    if (!user) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Нет доступа к галерее');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.7,
    });
    if (result.canceled) return;
    try {
      const uri = result.assets[0].uri;
      const blob = await (await fetch(uri)).blob();
      const path = `avatars/${user.uid}`;
      const fileRef = storageRef(storage, path);
      await uploadBytes(fileRef, blob, { contentType: 'image/jpeg' });
      const url = await getDownloadURL(fileRef);
      await updateDoc(doc(db, 'users', user.uid), { avatarUrl: url });
      await updateFirebaseProfile(user, { photoURL: url });
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось загрузить аватар');
    }
  };

  const handleSave = async () => {
    if (!user) return;
    if (!name.trim()) return Alert.alert('Введите имя');
    setIsSaving(true);
    try {
      const searchKey = [name.trim(), surname.trim(), phone.trim(), user.email ?? '']
        .filter(Boolean).join(' ').toLowerCase();
      await updateDoc(doc(db, 'users', user.uid), {
        name: name.trim(),
        surname: surname.trim(),
        phone: phone.trim(),
        searchKey,
      });
      await updateFirebaseProfile(user, { displayName: name.trim() });
      Alert.alert('Сохранено');
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!profile) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}>
      <TouchableOpacity onPress={handlePickAvatar}>
        {profile.avatarUrl ? (
          <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: colors.surfaceAlt }]}>
            <Text style={{ fontSize: 32, color: colors.textMuted }}>+</Text>
          </View>
        )}
        <Text style={[styles.avatarHint, { color: colors.textMuted }]}>
          Нажмите, чтобы сменить фото
        </Text>
      </TouchableOpacity>

      <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Имя</Text>
      <TextInput
        style={[styles.input, { color: colors.text, borderColor: colors.border }]}
        value={name} onChangeText={setName}
      />

      <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Фамилия</Text>
      <TextInput
        style={[styles.input, { color: colors.text, borderColor: colors.border }]}
        value={surname} onChangeText={setSurname}
      />

      <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Телефон</Text>
      <TextInput
        style={[styles.input, { color: colors.text, borderColor: colors.border }]}
        value={phone} onChangeText={setPhone} keyboardType="phone-pad"
      />

      <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Email</Text>
      <View style={[styles.emailBox, { backgroundColor: colors.surfaceAlt }]}>
        <Text style={{ color: colors.text }}>{profile.email}</Text>
      </View>

      <TouchableOpacity
        style={[styles.saveButton, { backgroundColor: colors.primary }, isSaving && { opacity: 0.6 }]}
        onPress={handleSave} disabled={isSaving}
      >
        <Text style={styles.saveButtonText}>{isSaving ? '...' : 'Сохранить'}</Text>
      </TouchableOpacity>

      <View style={[styles.balanceCard, { backgroundColor: colors.surface }]}>
        <Text style={[styles.balanceLabel, { color: colors.textMuted }]}>Баланс</Text>
        <Text style={[styles.balanceValue, { color: colors.text }]}>
          {profile.balance.toLocaleString('ru-RU')} баллов
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', padding: 24, gap: 12, paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
  avatarHint: { marginTop: 6, fontSize: 12, textAlign: 'center' },
  fieldLabel: { alignSelf: 'flex-start', fontSize: 13, marginTop: 12 },
  input: { width: '100%', borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 15 },
  emailBox: { width: '100%', padding: 12, borderRadius: 8 },
  saveButton: { marginTop: 16, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 32 },
  saveButtonText: { color: '#fff', fontWeight: '700' },
  balanceCard: { marginTop: 24, borderRadius: 12, padding: 20, width: '100%', alignItems: 'center' },
  balanceLabel: {},
  balanceValue: { fontSize: 28, fontWeight: '800', marginTop: 4 },
});