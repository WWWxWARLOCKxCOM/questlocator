import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, ActivityIndicator } from 'react-native';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useAuth } from '@/context/AuthContext';
import { AppUser } from '@/types';

export default function ProfileScreen() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<AppUser | null>(null);

  useEffect(() => {
    if (!user) return;

    // Реалтайм-подписка на документ users/{uid}.
    // Раньше здесь был supabase.from('profiles').select(...).single() +
    // отдельный канал для UPDATE — в Firestore всё это заменяется одним
    // onSnapshot на документ.
    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (!snap.exists()) return;
      const d = snap.data();
      setProfile({
        uid: user.uid,
        name: d.name ?? '',
        email: d.email ?? user.email ?? '',
        balance: d.balance ?? 0,
        createdAt: d.createdAt?.toMillis?.() ?? 0,
      });
    });

    return unsubscribe;
  }, [user]);

  if (!profile) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Image source={require('@/../assets/avatar-placeholder.png')} style={styles.avatar} />
      <Text style={styles.name}>{profile.name || 'Без имени'}</Text>
      <Text style={styles.email}>{profile.email}</Text>
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
  container: { flex: 1, alignItems: 'center', padding: 24, gap: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 96, height: 96, borderRadius: 48, marginBottom: 8 },
  name: { fontSize: 20, fontWeight: '700' },
  email: { color: '#666' },
  balanceCard: {
    marginTop: 24,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    alignItems: 'center',
  },
  balanceLabel: { color: '#666' },
  balanceValue: { fontSize: 28, fontWeight: '800', marginTop: 4 },
});