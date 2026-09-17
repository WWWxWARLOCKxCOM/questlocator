import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { subscribeToUserSessions } from '@/services/sessionService';
import { QuestSession } from '@/types';

/**
 * Список всех сессий пользователя: заведение, дата, время, заработанные баллы.
 * Данные приходят из Firestore в реальном времени через subscribeToUserSessions.
 */
export default function HistoryScreen() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<QuestSession[]>([]);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToUserSessions(user.uid, setSessions);
    return () => unsub();
  }, [user]);

  return (
    <FlatList
      data={sessions}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <Text style={styles.date}>
            {new Date(item.startedAt).toLocaleDateString('ru-RU')}
          </Text>
          <Text style={styles.time}>{item.totalTimeMinutes} мин</Text>
          <Text style={styles.points}>+{item.pointsEarned}</Text>
        </View>
      )}
      ListEmptyComponent={<Text style={styles.empty}>Пока нет завершённых сессий.</Text>}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  date: { color: '#666' },
  time: { color: '#333' },
  points: { fontWeight: '700', color: '#27ae60' },
  empty: { textAlign: 'center', marginTop: 40, color: '#999' },
});