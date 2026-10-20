import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { subscribeToPlacesByOwner } from '@/services/placesService';
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

  useEffect(() => {
    if (!user) return;
    return subscribeToPlacesByOwner(user.uid, setPlaces);
  }, [user]);

  const handleDelete = (place: Place) => {
    Alert.alert(
      'Удалить точку?',
      `Точка «${place.name}» и её квест будут удалены безвозвратно.`,
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
              Alert.alert('Ошибка', e?.message ?? 'Не удалось удалить точку');
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
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

  return (
    <FlatList
      data={places}
      keyExtractor={(p) => p.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.headerRow}>
            <View style={[styles.iconBubble, { backgroundColor: colors.primary }]}>
              <MaterialCommunityIcons
                name={CATEGORY_ICONS[item.category]}
                size={20}
                color="#fff"
              />
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
            <View style={styles.dateRow}>
              <MaterialCommunityIcons name="calendar-clock" size={14} color="#f39c12" />
              <Text style={[styles.dateLabel, { color: colors.textMuted }]}>Оплата:</Text>
              <Text style={[styles.dateValue, { color: '#f39c12', fontWeight: '700' }]}>
                {formatDate(item.nextBillingDate)}
              </Text>
            </View>
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

            <TouchableOpacity
              style={[styles.actionBtn, styles.deleteBtn, busyId === item.id && { opacity: 0.6 }]}
              onPress={() => handleDelete(item)}
              disabled={busyId === item.id}
            >
              {busyId === item.id ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <MaterialCommunityIcons name="trash-can" size={16} color="#fff" />
                  <Text style={styles.actionText}>Удалить</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
      ListEmptyComponent={<Text style={[styles.empty, { color: colors.textMuted }]}>У вас пока нет точек</Text>}
    />
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
});