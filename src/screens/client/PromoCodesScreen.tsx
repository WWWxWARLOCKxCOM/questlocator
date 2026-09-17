import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { subscribeToUserSessions } from '@/services/sessionService';
import { QuestSession } from '@/types';

interface EarnedPromocode {
  sessionId: string;
  placeId: string;
  code: string;
  earnedAt: number;
}

/**
 * Промокоды пользователя — производятся из завершённых сессий с непустым promocode.
 * Источник — та же коллекция sessions, что и в HistoryScreen, но с фильтром на клиенте.
 */
export default function PromoCodesScreen() {
  const { user } = useAuth();
  const [promocodes, setPromocodes] = useState<EarnedPromocode[]>([]);

  useEffect(() => {
    if (!user) return;

    const unsub = subscribeToUserSessions(user.uid, (sessions: QuestSession[]) => {
      const earned = sessions
        .filter((s) => s.status === 'completed' && !!s.promocode)
        .map((s) => ({
          sessionId: s.id,
          placeId: s.placeId,
          code: s.promocode as string,
          earnedAt: s.endedAt ?? s.startedAt,
        }))
        .sort((a, b) => b.earnedAt - a.earnedAt);

      setPromocodes(earned);
    });

    return () => unsub();
  }, [user]);

  return (
    <FlatList
      data={promocodes}
      keyExtractor={(item) => item.sessionId}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text style={styles.code}>{item.code}</Text>
          <Text style={styles.date}>
            {new Date(item.earnedAt).toLocaleDateString('ru-RU')}
          </Text>
        </View>
      )}
      ListEmptyComponent={<Text style={styles.empty}>У вас пока нет промокодов.</Text>}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  code: { fontSize: 20, fontWeight: '800', letterSpacing: 1 },
  date: { color: '#666', marginTop: 4 },
  empty: { textAlign: 'center', marginTop: 40, color: '#999' },
});