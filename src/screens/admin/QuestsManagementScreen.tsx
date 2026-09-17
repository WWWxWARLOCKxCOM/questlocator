import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, TextInput, Modal, Switch } from 'react-native';
import { subscribeToAllQuests, createQuest, updateQuest, deleteQuest } from '@/services/questService';
import { subscribeToAllPlaces } from '@/services/placesService';
import { Quest, Place } from '@/types';

export default function QuestsManagementScreen() {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Quest | null>(null);

  const [placeId, setPlaceId] = useState('');
  const [minTime, setMinTime] = useState('30');
  const [maxTime, setMaxTime] = useState('180');
  const [rewardPoints, setRewardPoints] = useState('100');
  const [promocode, setPromocode] = useState('');
  const [photoBonusMultiplier, setPhotoBonusMultiplier] = useState('1.3');
  const [photoRequired, setPhotoRequired] = useState(false);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => subscribeToAllQuests(setQuests), []);
  useEffect(() => subscribeToAllPlaces(setPlaces), []);

  const placeName = (id: string) => places.find((p) => p.id === id)?.name ?? id;

  const openCreate = () => {
    setEditing(null);
    setPlaceId(places[0]?.id ?? '');
    setMinTime('30');
    setMaxTime('180');
    setRewardPoints('100');
    setPromocode('');
    setPhotoBonusMultiplier('1.3');
    setPhotoRequired(false);
    setIsActive(true);
    setIsModalOpen(true);
  };

  const openEdit = (quest: Quest) => {
    setEditing(quest);
    setPlaceId(quest.placeId);
    setMinTime(String(quest.minTimeMinutes));
    setMaxTime(String(quest.maxTimeMinutes));
    setRewardPoints(String(quest.rewardPoints));
    setPromocode(quest.promocode ?? '');
    setPhotoBonusMultiplier(String(quest.photoBonusMultiplier));
    setPhotoRequired(quest.photoRequired);
    setIsActive(quest.isActive);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    const payload = {
      placeId,
      minTimeMinutes: Number(minTime),
      maxTimeMinutes: Number(maxTime),
      rewardPoints: Number(rewardPoints),
      promocode: promocode || undefined,
      photoBonusMultiplier: Number(photoBonusMultiplier),
      photoRequired,
      referenceImages: editing?.referenceImages ?? [],
      isActive,
    };
    if (editing) {
      await updateQuest(editing.id, payload);
    } else {
      await createQuest(payload);
    }
    setIsModalOpen(false);
  };

  return (
    <View style={styles.container}>
      <Pressable style={styles.addButton} onPress={openCreate}>
        <Text style={styles.addButtonText}>+ Новый квест</Text>
      </Pressable>

      <FlatList
        data={quests}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => openEdit(item)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{placeName(item.placeId)}</Text>
              <Text style={styles.details}>
                {item.minTimeMinutes}–{item.maxTimeMinutes} мин · {item.rewardPoints} баллов
              </Text>
            </View>
            <Pressable onPress={() => deleteQuest(item.id)}>
              <Text style={styles.delete}>Удалить</Text>
            </Pressable>
          </Pressable>
        )}
      />

      <Modal visible={isModalOpen} animationType="slide" onRequestClose={() => setIsModalOpen(false)}>
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>{editing ? 'Редактировать квест' : 'Новый квест'}</Text>

          <Text style={styles.label}>Заведение</Text>
          <View style={styles.chipRow}>
            {places.map((p) => (
              <Pressable
                key={p.id}
                style={[styles.chip, placeId === p.id && styles.chipActive]}
                onPress={() => setPlaceId(p.id)}
              >
                <Text style={placeId === p.id ? styles.chipTextActive : styles.chipText}>{p.name}</Text>
              </Pressable>
            ))}
          </View>

          <TextInput style={styles.input} placeholder="Мин. время (мин)" keyboardType="numeric" value={minTime} onChangeText={setMinTime} />
          <TextInput style={styles.input} placeholder="Макс. время (мин)" keyboardType="numeric" value={maxTime} onChangeText={setMaxTime} />
          <TextInput style={styles.input} placeholder="Награда (баллы)" keyboardType="numeric" value={rewardPoints} onChangeText={setRewardPoints} />
          <TextInput style={styles.input} placeholder="Промокод (опционально)" value={promocode} onChangeText={setPromocode} />
          <TextInput style={styles.input} placeholder="Множитель за фото" keyboardType="numeric" value={photoBonusMultiplier} onChangeText={setPhotoBonusMultiplier} />

          <View style={styles.switchRow}>
            <Text>Фото обязательно</Text>
            <Switch value={photoRequired} onValueChange={setPhotoRequired} />
          </View>
          <View style={styles.switchRow}>
            <Text>Активен</Text>
            <Switch value={isActive} onValueChange={setIsActive} />
          </View>

          <Pressable style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>Сохранить</Text>
          </Pressable>
          <Pressable style={styles.cancelButton} onPress={() => setIsModalOpen(false)}>
            <Text>Отмена</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  addButton: { backgroundColor: '#2ecc71', borderRadius: 8, padding: 12, alignItems: 'center', marginBottom: 12 },
  addButtonText: { color: '#fff', fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  name: { fontWeight: '600' },
  details: { color: '#666', fontSize: 12 },
  delete: { color: '#c0392b' },
  modal: { flex: 1, padding: 24, gap: 10, marginTop: 40 },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  label: { color: '#666', fontSize: 12 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, backgroundColor: '#eee' },
  chipActive: { backgroundColor: '#2ecc71' },
  chipText: { color: '#333' },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  saveButton: { backgroundColor: '#2ecc71', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 12 },
  saveButtonText: { color: '#fff', fontWeight: '700' },
  cancelButton: { alignItems: 'center', padding: 10 },
});
