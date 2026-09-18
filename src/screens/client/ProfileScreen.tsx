import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Image, ActivityIndicator, TextInput,
  TouchableOpacity, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { updateProfile as updateFirebaseProfile } from 'firebase/auth';
import { db, storage, auth } from '@/config/firebase';
import { useAuth } from '@/context/AuthContext';
import { AppUser } from '@/types';

export default function ProfileScreen() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [name, setName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, 'users', user.uid), (snap) => {
      const d = snap.data();
      if (!d) return;
      const p: AppUser = {
        uid: user.uid,
        name: d.name ?? '',
        email: d.email ?? user.email ?? '',
        balance: d.balance ?? 0,
        avatarUrl: d.avatarUrl ?? undefined,
        createdAt: d.createdAt?.toMillis?.() ?? 0,
      };
      setProfile(p);
      setName(p.name);
    });
  }, [user]);

  const handlePickAvatar = async () => {
    if (!user) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Нет доступа к галерее');

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
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

  const handleSaveName = async () => {
    if (!user) return;
    if (!name.trim()) return Alert.alert('Введите имя');
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), { name: name.trim() });
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
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={handlePickAvatar}>
        {profile.avatarUrl ? (
          <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarPlaceholderText}>+</Text>
          </View>
        )}
        <Text style={styles.avatarHint}>Нажмите, чтобы сменить фото</Text>
      </TouchableOpacity>

      <Text style={styles.fieldLabel}>Имя</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Ваше имя"
      />

      <Text style={styles.fieldLabel}>Email</Text>
      <Text style={styles.emailText}>{profile.email}</Text>

      <TouchableOpacity
        style={[styles.saveButton, isSaving && { opacity: 0.6 }]}
        onPress={handleSaveName}
        disabled={isSaving}
      >
        <Text style={styles.saveButtonText}>{isSaving ? '...' : 'Сохранить'}</Text>
      </TouchableOpacity>

      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Баланс</Text>
        <Text style={styles.balanceValue}>
          {profile.balance.toLocaleString('ru-RU')} баллов
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', padding: 24, gap: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  avatarPlaceholder: {
    backgroundColor: '#eee',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholderText: { fontSize: 32, color: '#888' },
  avatarHint: { marginTop: 6, color: '#666', fontSize: 12, textAlign: 'center' },
  fieldLabel: { alignSelf: 'flex-start', color: '#666', fontSize: 13, marginTop: 12 },
  input: {
    width: '100%', borderWidth: 1, borderColor: '#ccc',
    borderRadius: 8, padding: 12, fontSize: 15,
  },
  emailText: {
    width: '100%', padding: 12, fontSize: 15,
    color: '#333', backgroundColor: '#f5f5f5', borderRadius: 8,
  },
  saveButton: {
    marginTop: 16, backgroundColor: '#2ecc71',
    borderRadius: 8, paddingVertical: 12, paddingHorizontal: 32,
  },
  saveButtonText: { color: '#fff', fontWeight: '700' },
  balanceCard: {
    marginTop: 24, backgroundColor: '#f5f5f5', borderRadius: 12,
    padding: 20, width: '100%', alignItems: 'center',
  },
  balanceLabel: { color: '#666' },
  balanceValue: { fontSize: 28, fontWeight: '800', marginTop: 4 },
});