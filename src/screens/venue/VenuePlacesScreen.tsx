import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, Alert, ActivityIndicator,
  Modal
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { subscribeToPlacesByOwner, schedulePlaceDeletion } from '@/services/placesService';
import { deleteMyPlace } from '@/services/venueService';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Place, PlaceCategory, CATEGORY_LABELS } from '@/types';

const CATEGORY_ICONS: Record<PlaceCategory, keyof typeof MaterialCommunityIcons.glyphMap> = {
  restaurant: 'silverware-fork-knife',
  cafe: 'coffee',
  museum: 'bank',
  shop: 'shopping',
  exhibition: 'image-frame',
};

const DAY_MS = 24 * 60 * 60 * 1000;

function formatDate(ms?: number) {
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

export default function VenuePlacesScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { colors } = useTheme();
  const [places, setPlaces] = useState<Place[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Состояния для модалки
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [selectedPlaceForDelete, setSelectedPlaceForDelete] = useState<Place | null>(null);

  useEffect(() => {
    if (!user) return;
    return subscribeToPlacesByOwner(user.uid, setPlaces);
  }, [user]);

  const handleDeleteNow = (place: Place) => {
    Alert.alert(
      'Удалить точку сейчас?',
      `Точка «${place.name}» будет удалена немедленно. С баланса спишется часть баллов в зависимости от прошедшего времени.`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            setBusyId(place.id);
            try {
              await deleteMyPlace(place.id);
            } catch (e: any) {
              Alert.alert('Ошибка', e?.message ?? 'Не удалось удалить');
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  };

  const openScheduleModal = (place: Place) => {
    setSelectedPlaceForDelete(place);
    setScheduleModalOpen(true);
  };

  const handleSchedule = async (weeks: number) => {
    if (!selectedPlaceForDelete) return;
    setScheduleModalOpen(false);
    setBusyId(selectedPlaceForDelete.id);
    try {
      // Ровно +N недель от даты создания
      const deleteAt = selectedPlaceForDelete.createdAt + weeks * 7 * DAY_MS;
      await schedulePlaceDeletion(selectedPlaceForDelete.id, deleteAt, weeks);
      Alert.alert('Запланировано', `Точка будет удалена ровно ${formatDate(deleteAt)} (${weeks} нед.)`);
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось запланировать');
    } finally {
      setBusyId(null);
      setSelectedPlaceForDelete(null);
    }
  };

  const handleCancelSchedule = async (place: Place) => {
    setBusyId(place.id);
    try {
      await schedulePlaceDeletion(place.id, null, 0);
      Alert.alert('Отменено', 'Запланированное удаление отменено.');
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleShowOnMap = (place: Place) => {
    navigation.navigate('VenueMainStack', {
      screen: 'VenueMap',
      params: { focusPlaceId: place.id },
    });
  };

  const handleEdit = (place: Place) => {
    navigation.navigate('VenueMainStack', {
      screen: 'VenueEditPlace',
      params: { placeId: place.id },
    });
  };

  const getWeekLabel = (weeks: number) => {
    if (weeks === 1) return '1 неделя (1/4 стоимости)';
    if (weeks === 2) return '2 недели (2/4 стоимости)';
    if (weeks === 3) return '3 недели (3/4 стоимости)';
    return '4 недели (4/4 стоимости)';
  };

  return (
    <>
      <FlatList
        data={places}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.headerRow}>
              <View style={[styles.iconBubble, { backgroundColor: colors.primary }]}>
                <MaterialCommunityIcons name={CATEGORY_ICONS[item.category]} size={20} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: colors.text }]}>{item.name}</Text>
                <Text style={[styles.meta, { color: colors.textMuted }]}>
                  {CATEGORY_LABELS[item.category]}
                </Text>
                <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
                  {item.address}
                </Text>
              </View>
            </View>

            {/* БЛОК С ДАТАМИ */}
            <View style={[styles.datesBox, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
              <View style={styles.dateRow}>
                <MaterialCommunityIcons name="calendar-plus" size={14} color={colors.textMuted} />
                <Text style={[styles.dateLabel, { color: colors.textMuted }]}>Создана:</Text>
                <Text style={[styles.dateValue, { color: colors.text }]}>
                  {formatDate(item.createdAt)}
                </Text>
              </View>
              
              {item.scheduledDeletionAt ? (
                <View style={styles.dateRow}>
                  <MaterialCommunityIcons name="delete-clock" size={14} color="#e74c3c" />
                  <Text style={[styles.dateLabel, { color: '#e74c3c' }]}>Удаление:</Text>
                  <Text style={[styles.dateValue, { color: '#e74c3c', fontWeight: '700' }]}>
                    {formatDate(item.scheduledDeletionAt)}
                  </Text>
                </View>
              ) : (
                <View style={styles.dateRow}>
                  <MaterialCommunityIcons name="calendar-clock" size={14} color="#f39c12" />
                  <Text style={[styles.dateLabel, { color: colors.textMuted }]}>Оплата:</Text>
                  <Text style={[styles.dateValue, { color: '#f39c12', fontWeight: '700' }]}>
                    {formatDate(item.nextBillingDate)}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.showBtn]}
                onPress={() => handleShowOnMap(item)}
              >
                <MaterialCommunityIcons name="map-marker" size={16} color="#fff" />
                <Text style={styles.actionText}>На карте</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, styles.editBtn]}
                onPress={() => handleEdit(item)}
              >
                <MaterialCommunityIcons name="pencil" size={16} color="#fff" />
                <Text style={styles.actionText}>Изменить</Text>
              </TouchableOpacity>

              {item.scheduledDeletionAt ? (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#e67e22' }, busyId === item.id && { opacity: 0.6 }]}
                  onPress={() => handleCancelSchedule(item)}
                  disabled={busyId === item.id}
                >
                  {busyId === item.id ? <ActivityIndicator color="#fff" size="small" /> : (
                    <>
                      <MaterialCommunityIcons name="cancel" size={16} color="#fff" />
                      <Text style={styles.actionText}>Отменить</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.deleteBtn, busyId === item.id && { opacity: 0.6 }]}
                  onPress={() => openScheduleModal(item)}
                  disabled={busyId === item.id}
                >
                  {busyId === item.id ? <ActivityIndicator color="#fff" size="small" /> : (
                    <>
                      <MaterialCommunityIcons name="calendar-remove" size={16} color="#fff" />
                      <Text style={styles.actionText}>Удалить</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={[styles.empty, { color: colors.textMuted }]}>У вас пока нет точек</Text>}
      />

      {/* Модалка планирования удаления */}
      <Modal visible={scheduleModalOpen} transparent animationType="fade" onRequestClose={() => setScheduleModalOpen(false)}>
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Удаление точки</Text>
            <Text style={{ color: colors.textMuted, marginBottom: 12, fontSize: 13 }}>
              Вы можете выбрать, когда именно удалится точка. Штраф составит 1/4, 2/4, 3/4 или 4/4 от месячной стоимости.
            </Text>

            {[1, 2, 3, 4].map((weeks) => (
              <TouchableOpacity
                key={weeks}
                style={[styles.modalOption, { borderColor: colors.border }]}
                onPress={() => handleSchedule(weeks)}
              >
                <Text style={[styles.modalOptionText, { color: colors.text }]}>{getWeekLabel(weeks)}</Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={[styles.modalOption, { borderColor: '#e74c3c', marginTop: 8 }]}
              onPress={() => {
                setScheduleModalOpen(false);
                if (selectedPlaceForDelete) handleDeleteNow(selectedPlaceForDelete);
              }}
            >
              <Text style={[styles.modalOptionText, { color: '#e74c3c' }]}>Удалить прямо сейчас</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={{ marginTop: 16, alignItems: 'center', padding: 8 }} 
              onPress={() => setScheduleModalOpen(false)}
            >
              <Text style={{ color: colors.textMuted, fontWeight: '600' }}>Отмена</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  list: { padding: 12 },
  card: {
    borderRadius: 12,
    padding: 12, marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBubble: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  name: { fontWeight: '700', fontSize: 15 },
  meta: { fontSize: 12, marginTop: 2 },
  datesBox: {
    borderRadius: 8, padding: 10, marginTop: 10,
    borderWidth: StyleSheet.hairlineWidth, gap: 6,
  },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dateLabel: { fontSize: 12 },
  dateValue: { fontSize: 12, fontWeight: '600' },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  actionBtn: {
    flex: 1, borderRadius: 8, paddingVertical: 10,
    alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 4,
  },
  showBtn: { backgroundColor: '#27ae60' },
  editBtn: { backgroundColor: '#3498db' },
  deleteBtn: { backgroundColor: '#e74c3c' },
  actionText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  empty: { textAlign: 'center', marginTop: 40 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalCard: { width: '100%', padding: 20, borderRadius: 16, elevation: 5 },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 8 },
  modalOption: { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  modalOptionText: { fontSize: 15, fontWeight: '600' },
});