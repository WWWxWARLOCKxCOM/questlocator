import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { subscribeToPlacesByOwner } from '@/services/placesService';
import { deleteMyPlace } from '@/services/venueService';
import { useAuth } from '@/context/AuthContext';
import { Place, PlaceCategory, CATEGORY_LABELS } from '@/types';

const CATEGORY_ICONS: Record<PlaceCategory, keyof typeof MaterialCommunityIcons.glyphMap> = {
  restaurant: 'silverware-fork-knife',
  cafe: 'coffee',
  museum: 'bank',
  shop: 'shopping',
  exhibition: 'image-frame',
};

export default function VenuePlacesScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
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
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <View style={styles.iconBubble}>
              <MaterialCommunityIcons
                name={CATEGORY_ICONS[item.category]}
                size={20}
                color="#fff"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.meta}>{CATEGORY_LABELS[item.category]}</Text>
              <Text style={styles.meta} numberOfLines={1}>{item.address}</Text>
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
      ListEmptyComponent={<Text style={styles.empty}>У вас пока нет точек</Text>}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 12 },
  card: {
    backgroundColor: '#f7f7f7', borderRadius: 12,
    padding: 12, marginBottom: 10,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBubble: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#2c3e50',
    alignItems: 'center', justifyContent: 'center',
  },
  name: { fontWeight: '700', fontSize: 15 },
  meta: { color: '#666', fontSize: 12, marginTop: 2 },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: {
    flex: 1, borderRadius: 8, paddingVertical: 10,
    alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 4,
  },
  showBtn: { backgroundColor: '#27ae60' },
  editBtn: { backgroundColor: '#3498db' },
  deleteBtn: { backgroundColor: '#e74c3c' },
  actionText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  empty: { textAlign: 'center', marginTop: 40, color: '#999' },
});