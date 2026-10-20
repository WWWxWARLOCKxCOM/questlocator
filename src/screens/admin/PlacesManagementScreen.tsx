import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, Pressable, TextInput,
  Modal, Switch, Alert,
} from 'react-native';
import {
  subscribeToAllPlaces, createPlace, updatePlace, deletePlace,
} from '@/services/placesService';
import { getCurrentPosition } from '@/services/locationService';
import {
  Place, PlaceCategory, CATEGORY_LABELS, ALL_CATEGORIES,
} from '@/types';

export default function PlacesManagementScreen() {
  const [places, setPlaces] = useState<Place[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Place | null>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [category, setCategory] = useState<PlaceCategory>('cafe');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => subscribeToAllPlaces(setPlaces), []);

  const openCreate = () => {
    setEditing(null);
    setName('');
    setAddress('');
    setCategory('cafe');
    setIsActive(true);
    setIsModalOpen(true);
  };

  const openEdit = (place: Place) => {
    setEditing(place);
    setName(place.name);
    setAddress(place.address);
    setCategory(place.category);
    setIsActive(place.isActive);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (editing) {
      await updatePlace(editing.id, { name, address, category, isActive });
    } else {
      const location = await getCurrentPosition();
      await createPlace({
        name,
        address,
        category,
        isActive,
        latitude: location.latitude,
        longitude: location.longitude,
        radiusMeters: 50,
      });
    }
    setIsModalOpen(false);
  };

  const handleDelete = (place: Place) => {
    Alert.alert(
      'Удалить точку?',
      `«${place.name}» и её квест будут удалены.`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePlace(place.id);
            } catch (e: any) {
              Alert.alert('Ошибка', e?.message ?? 'Не удалось удалить');
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <Pressable style={styles.addButton} onPress={openCreate}>
        <Text style={styles.addButtonText}>+ Добавить заведение</Text>
      </Pressable>

      <FlatList
        data={places}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => openEdit(item)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.address}>{item.address}</Text>
              <Text style={styles.category}>{CATEGORY_LABELS[item.category]}</Text>
            </View>
            <Text style={item.isActive ? styles.active : styles.inactive}>
              {item.isActive ? 'Активно' : 'Отключено'}
            </Text>
            <Pressable onPress={() => handleDelete(item)}>
              <Text style={styles.delete}>Удалить</Text>
            </Pressable>
          </Pressable>
        )}
      />

      <Modal visible={isModalOpen} animationType="slide" onRequestClose={() => setIsModalOpen(false)}>
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>{editing ? 'Редактировать заведение' : 'Новое заведение'}</Text>
          <TextInput style={styles.input} placeholder="Название" value={name} onChangeText={setName} />
          <TextInput style={styles.input} placeholder="Адрес" value={address} onChangeText={setAddress} />

          <Text style={styles.modalLabel}>Категория</Text>
          <View style={styles.categoryRow}>
            {ALL_CATEGORIES.map((c) => (
              <Pressable
                key={c}
                style={[styles.categoryChip, category === c && styles.categoryChipActive]}
                onPress={() => setCategory(c)}
              >
                <Text style={category === c ? styles.categoryTextActive : styles.categoryText}>
                  {CATEGORY_LABELS[c]}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.switchRow}>
            <Text>Активно</Text>
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
  addButton: {
    backgroundColor: '#2ecc71', borderRadius: 8, padding: 12,
    alignItems: 'center', marginBottom: 12,
  },
  addButtonText: { color: '#fff', fontWeight: '700' },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd', gap: 8,
  },
  name: { fontWeight: '600' },
  address: { color: '#666', fontSize: 12 },
  category: { color: '#2ecc71', fontSize: 12, fontWeight: '600', marginTop: 2 },
  active: { color: '#27ae60' },
  inactive: { color: '#c0392b' },
  delete: { color: '#c0392b' },
  modal: { flex: 1, padding: 24, gap: 12, marginTop: 40 },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  modalLabel: { color: '#666', fontSize: 12, marginTop: 4 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  categoryRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  categoryChip: {
    paddingVertical: 6, paddingHorizontal: 12,
    borderRadius: 16, backgroundColor: '#eee',
  },
  categoryChipActive: { backgroundColor: '#2ecc71' },
  categoryText: { color: '#333' },
  categoryTextActive: { color: '#fff', fontWeight: '700' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  saveButton: {
    backgroundColor: '#2ecc71', borderRadius: 8, padding: 14,
    alignItems: 'center', marginTop: 16,
  },
  saveButtonText: { color: '#fff', fontWeight: '700' },
  cancelButton: { alignItems: 'center', padding: 10 },
});