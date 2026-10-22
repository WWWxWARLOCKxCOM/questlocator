import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { subscribeToVenueEvents, deleteEvent } from '@/services/eventService';
import { Event } from '@/types';

export default function VenueEventsScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { colors } = useTheme();
  const [events, setEvents] = useState<Event[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    return subscribeToVenueEvents(user.uid, setEvents);
  }, [user]);

  const handleDelete = (id: string) => {
    Alert.alert('Удалить мероприятие?', 'Действие необратимо.', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: async () => {
          setBusyId(id);
          try { await deleteEvent(id); } catch (e: any) { Alert.alert('Ошибка', e?.message); } finally { setBusyId(null); }
      }}
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={() => navigation.navigate('VenueCreateEvent')}>
        <MaterialCommunityIcons name="plus" size={20} color="#fff" />
        <Text style={styles.addBtnText}>Создать мероприятие</Text>
      </TouchableOpacity>

      <FlatList
        data={events}
        keyExtractor={(e) => e.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const isArchived = item.status === 'archived';
          return (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, opacity: isArchived ? 0.6 : 1 }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
                <Text style={[styles.meta, { color: colors.textMuted }]}>
                  {new Date(item.startTime).toLocaleString('ru-RU')} — {new Date(item.endTime).toLocaleString('ru-RU')}
                </Text>
                <Text style={[styles.status, { color: item.status === 'active' ? colors.success : (item.status === 'upcoming' ? colors.warning : colors.textMuted) }]}>
                  {item.status === 'active' ? '🔴 Идёт сейчас' : (item.status === 'upcoming' ? '🟡 Скоро' : 'Архив')}
                </Text>
              </View>
              {!isArchived && (
                <TouchableOpacity onPress={() => handleDelete(item.id)} disabled={busyId === item.id}>
                  {busyId === item.id ? <ActivityIndicator color={colors.danger} /> : <MaterialCommunityIcons name="trash-can-outline" size={24} color={colors.danger} />}
                </TouchableOpacity>
              )}
            </View>
          );
        }}
        ListEmptyComponent={<Text style={[styles.empty, { color: colors.textMuted }]}>Мероприятий пока нет</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12 },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 8, marginBottom: 12, gap: 8 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  list: { paddingBottom: 40 },
  card: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 12, gap: 10 },
  title: { fontSize: 16, fontWeight: '700' },
  meta: { fontSize: 12, marginTop: 4 },
  status: { fontSize: 12, fontWeight: '700', marginTop: 6 },
  empty: { textAlign: 'center', marginTop: 40 },
});