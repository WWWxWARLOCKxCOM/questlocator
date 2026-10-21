import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, TextInput, FlatList, StyleSheet, TouchableOpacity,
  Modal, Alert, ActivityIndicator, Image, ScrollView,
} from 'react-native';
import { subscribeToAllUsers, adjustUserBalance } from '@/services/userService';
import {
  subscribeToUserRecentSessionsAllPlaces,
  resetUserQuest,
} from '@/services/sessionService';
import { subscribeToAllPlaces } from '@/services/placesService';
import { AppUser, Place, QuestSession } from '@/types';

export default function AdminUsersScreen() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<AppUser | null>(null);

  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const [recentSessions, setRecentSessions] = useState<QuestSession[]>([]);
  const [sessionBusyId, setSessionBusyId] = useState<string | null>(null);

  useEffect(() => subscribeToAllUsers(setUsers), []);
  useEffect(() => subscribeToAllPlaces(setPlaces), []);

  // Одна подписка вместо N (по одной на каждое заведение)
  useEffect(() => {
    if (!selected) {
      setRecentSessions([]);
      return;
    }
    const unsub = subscribeToUserRecentSessionsAllPlaces(
      selected.uid,
      setRecentSessions,
    );
    return () => unsub();
  }, [selected]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const haystack = [
        u.name,
        u.surname ?? '',
        u.email,
        u.phone ?? '',
        u.uid,
      ].join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [query, users]);

  const closeModal = () => {
    setSelected(null);
    setDelta('');
    setReason('');
    setRecentSessions([]);
  };

  const handleApply = async () => {
    if (!selected) return;
    const n = Number(delta);
    if (!Number.isFinite(n) || n === 0) {
      Alert.alert('Ошибка', 'Введите ненулевое число (например, 100 или -50)');
      return;
    }
    setBusy(true);
    try {
      const newBalance = await adjustUserBalance(selected.uid, n, reason.trim());
      Alert.alert(
        'Готово',
        `${n > 0 ? 'Начислено' : 'Списано'} ${Math.abs(n)} баллов.\nНовый баланс: ${newBalance}`,
      );
      setDelta('');
      setReason('');
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось изменить баланс');
    } finally {
      setBusy(false);
    }
  };

  const handleResetSession = async (s: QuestSession) => {
    if (!selected) return;
    setSessionBusyId(s.id);
    try {
      const res = await resetUserQuest(selected.uid, s.placeId);
      if (!res.ok) {
        Alert.alert('Не удалось', res.message ?? 'Ошибка');
      } else {
        Alert.alert('Готово', `Сброшено сессий: ${res.count ?? 0}`);
      }
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось сбросить');
    } finally {
      setSessionBusyId(null);
    }
  };

  const placeName = (placeId: string) =>
    places.find((p) => p.id === placeId)?.name ?? 'Заведение';

  const renderItem = ({ item }: { item: AppUser }) => (
    <TouchableOpacity style={styles.row} onPress={() => setSelected(item)}>
      {item.avatarUrl ? (
        <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarPlaceholder]}>
          <Text style={styles.avatarText}>
            {(item.name?.[0] ?? '?').toUpperCase()}
          </Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>
          {item.name} {item.surname ?? ''}
        </Text>
        <Text style={styles.meta}>{item.email}</Text>
        {item.phone ? <Text style={styles.meta}>{item.phone}</Text> : null}
      </View>
      <Text style={styles.balance}>{item.balance}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.search}
        placeholder="Поиск: имя, фамилия, email, телефон"
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <FlatList
        data={filtered}
        keyExtractor={(u) => u.uid}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {query ? 'Ничего не найдено' : 'Пользователей пока нет'}
          </Text>
        }
      />

      <Modal
        visible={!!selected}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <ScrollView>
              <Text style={styles.modalTitle}>
                {selected?.name} {selected?.surname ?? ''}
              </Text>
              <Text style={styles.modalSub}>{selected?.email}</Text>
              <Text style={styles.modalBalance}>
                Баланс: {selected?.balance ?? 0}
              </Text>

              <Text style={styles.sectionTitle}>Начислить / списать баллы</Text>
              <Text style={styles.label}>Изменение (например, 100 или -50)</Text>
              <TextInput
                style={styles.input}
                value={delta}
                onChangeText={setDelta}
                keyboardType="numbers-and-punctuation"
                placeholder="100"
              />

              <Text style={styles.label}>Причина (необязательно)</Text>
              <TextInput
                style={styles.input}
                value={reason}
                onChangeText={setReason}
                placeholder="Промо-акция, штраф и т.д."
              />

              <TouchableOpacity
                style={[styles.button, styles.apply, busy && { opacity: 0.6 }]}
                onPress={handleApply}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.applyText}>Применить</Text>
                )}
              </TouchableOpacity>

              <Text style={[styles.sectionTitle, { marginTop: 20 }]}>
                Пройденные квесты за 24 часа
              </Text>
              {recentSessions.length === 0 ? (
                <Text style={styles.emptySmall}>Нет завершённых квестов за сутки</Text>
              ) : (
                recentSessions.map((s) => (
                  <View key={s.id} style={styles.sessionRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sessionPlace}>{placeName(s.placeId)}</Text>
                      <Text style={styles.sessionMeta}>
                        {s.totalTimeMinutes} мин · +{s.pointsEarned} баллов
                        {s.endedAt
                          ? ` · ${new Date(s.endedAt).toLocaleString('ru-RU')}`
                          : ''}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.resetButton,
                        sessionBusyId === s.id && { opacity: 0.6 },
                      ]}
                      onPress={() => handleResetSession(s)}
                      disabled={sessionBusyId === s.id}
                    >
                      {sessionBusyId === s.id ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text style={styles.resetText}>Сбросить</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                ))
              )}

              <TouchableOpacity
                style={[styles.button, styles.cancel, { marginTop: 20 }]}
                onPress={closeModal}
              >
                <Text style={styles.cancelText}>Закрыть</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12 },
  search: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    fontSize: 15,
  },
  list: { paddingVertical: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
    gap: 10,
  },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarPlaceholder: {
    backgroundColor: '#ddd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontWeight: '700', color: '#555' },
  name: { fontWeight: '600' },
  meta: { color: '#666', fontSize: 12 },
  balance: { fontWeight: '800', fontSize: 16, color: '#27ae60' },
  empty: { textAlign: 'center', marginTop: 40, color: '#999' },
  emptySmall: { color: '#999', fontStyle: 'italic', marginTop: 4 },

  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    maxHeight: '90%',
  },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalSub: { color: '#666', marginBottom: 4 },
  modalBalance: { fontWeight: '600', marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginTop: 8, marginBottom: 4 },
  label: { fontSize: 13, color: '#666', marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    marginBottom: 6,
  },
  button: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancel: { backgroundColor: '#eee' },
  apply: { backgroundColor: '#2ecc71' },
  cancelText: { color: '#333', fontWeight: '600' },
  applyText: { color: '#fff', fontWeight: '700' },

  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
    gap: 8,
  },
  sessionPlace: { fontWeight: '600' },
  sessionMeta: { color: '#666', fontSize: 12 },
  resetButton: {
    backgroundColor: '#e74c3c',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: 90,
    alignItems: 'center',
  },
  resetText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});