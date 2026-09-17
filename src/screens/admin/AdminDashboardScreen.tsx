import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/config/firebase';

interface StatsResult {
  activeSessions: number;
  completedQuests: number;
  totalPointsPaid: number;
}

/**
 * Статистика агрегируется на сервере (Cloud Function getAdminStats),
 * а не через тяжёлые чтения всей коллекции sessions на клиенте.
 * Доступна только администраторам (проверка custom claim 'admin' на сервере).
 */
export default function AdminDashboardScreen() {
  const [stats, setStats] = useState<StatsResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fn = httpsCallable<unknown, StatsResult>(functions, 'getAdminStats');
    fn({})
      .then((r) => setStats(r.data))
      .catch((e) => setError(e?.message ?? 'Не удалось загрузить статистику'))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatCard label="Активные сессии" value={stats?.activeSessions ?? 0} />
      <StatCard label="Выполненные квесты" value={stats?.completedQuests ?? 0} />
      <StatCard label="Выплачено баллов" value={stats?.totalPointsPaid ?? 0} />
    </View>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.card}>
      <Text style={styles.value}>{value.toLocaleString('ru-RU')}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: '#f5f5f5', borderRadius: 12, padding: 20 },
  value: { fontSize: 28, fontWeight: '800' },
  label: { color: '#666', marginTop: 4 },
  error: { color: 'red', textAlign: 'center', paddingHorizontal: 24 },
});