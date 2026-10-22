import React, { useEffect, useMemo, useState } from 'react';
import {
  View, StyleSheet, Text, TouchableOpacity, Alert, Platform,
} from 'react-native';
import MapView, {
  Marker, PROVIDER_GOOGLE, Circle, MapPressEvent,
} from 'react-native-maps';
import {
  useNavigation, useRoute, RouteProp,
} from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { VenueStackParamList } from '@/navigation/VenueNavigator';
import { subscribeToPlacesByOwner } from '@/services/placesService';
import { subscribeToVenue, deleteMyPlace } from '@/services/venueService';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Place, PlaceCategory, VenueAccount, GeoPoint } from '@/types';

type Nav = NativeStackNavigationProp<VenueStackParamList, 'VenueMap'>;
type Rt = RouteProp<VenueStackParamList, 'VenueMap'>;

const CATEGORY_ICONS: Record<PlaceCategory, keyof typeof MaterialCommunityIcons.glyphMap> = {
  restaurant: 'silverware-fork-knife',
  cafe: 'coffee',
  museum: 'bank',
  shop: 'shopping',
  exhibition: 'image-frame',
};

const isFoodCategory = (cat?: PlaceCategory) =>
  cat === 'cafe' || cat === 'restaurant';

export default function VenueMapScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { user } = useAuth();
  const { colors } = useTheme();

  const [places, setPlaces] = useState<Place[]>([]);
  const [venue, setVenue] = useState<VenueAccount | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [newPoint, setNewPoint] = useState<GeoPoint | null>(null);
  const [newPointAddress, setNewPointAddress] = useState('');
  const [isAddingMode, setIsAddingMode] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    const u1 = subscribeToPlacesByOwner(user.uid, setPlaces);
    const u2 = subscribeToVenue(user.uid, setVenue);
    return () => { u1(); u2(); };
  }, [user]);

  useEffect(() => {
    const focusId = route.params?.focusPlaceId;
    if (!focusId || places.length === 0) return;
    const p = places.find((x) => x.id === focusId);
    if (p) setSelectedPlace(p);
  }, [route.params?.focusPlaceId, places.length]);

  const initialRegion = useMemo(() => {
    if (places.length === 0) {
      return {
        latitude: 55.751244,
        longitude: 37.618423,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      };
    }
    return {
      latitude: places[0].latitude,
      longitude: places[0].longitude,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    };
  }, [places]);

  const pointsLimit = venue?.pointsLimit ?? 2;
  const couponsLimit = venue?.couponsLimit ?? 2;
  const canCreateMore = (venue?.pointsUsed ?? 0) < pointsLimit;
  const isPending = venue?.isActive === false;

  // Обработка нажатия на карту
  const handleMapPress = async (e: MapPressEvent) => {
    if (!isAddingMode) {
      setSelectedPlace(null);
      return;
    }

    const coord = e.nativeEvent.coordinate;
    setNewPoint(coord);
    setNewPointAddress('Определение адреса...');

    try {
      const res = await Location.reverseGeocodeAsync(coord);
      if (res[0]) {
        const p = res[0];
        const addr = [p.street, p.name, p.city, p.region, p.country].filter(Boolean).join(', ');
        setNewPointAddress(addr || 'Адрес не определен');
      } else {
        setNewPointAddress('Адрес не найден');
      }
    } catch {
      setNewPointAddress('Ошибка при определении адреса');
    }
  };

  const handleDragEnd = async (e: any) => {
    if (!isAddingMode) return;
    const coord = e.nativeEvent.coordinate;
    setNewPoint(coord);
    setNewPointAddress('Определение адреса...');
    
    try {
      const res = await Location.reverseGeocodeAsync(coord);
      if (res[0]) {
        const p = res[0];
        const addr = [p.street, p.name, p.city, p.region, p.country].filter(Boolean).join(', ');
        setNewPointAddress(addr || 'Адрес не определен');
      }
    } catch {
      setNewPointAddress('Ошибка при определении адреса');
    }
  };

  const handleCreate = () => {
    if (!newPoint) return;
    navigation.navigate('VenueAddPlace', {
      latitude: newPoint.latitude,
      longitude: newPoint.longitude,
      address: newPointAddress !== 'Определение адреса...' ? newPointAddress : undefined,
    });
    setNewPoint(null);
    setIsAddingMode(false);
  };

  const handleCancelNew = () => {
    setNewPoint(null);
    setIsAddingMode(false);
  };

  const handleEdit = () => {
    if (!selectedPlace) return;
    navigation.navigate('VenueEditPlace', { placeId: selectedPlace.id });
  };

  const handleDeletePlace = () => {
    if (!selectedPlace) return;
    Alert.alert(
      'Удалить точку?',
      `Точка «${selectedPlace.name}» и её квест будут удалены безвозвратно.`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await deleteMyPlace(selectedPlace.id);
              setSelectedPlace(null);
            } catch (e: any) {
              Alert.alert('Ошибка', e?.message ?? 'Не удалось удалить точку');
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  // Сбрасываем режим добавления, если нажали "Мои точки"
  const handleOpenList = () => {
    setIsAddingMode(false);
    setNewPoint(null);
    navigation.navigate('VenuePlaces');
  };

  return (
    <View style={styles.container}>
      <MapView
        provider={Platform.OS === 'web' ? undefined : PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFillObject}
        initialRegion={initialRegion}
        showsUserLocation={Platform.OS !== 'web'}
        onPress={handleMapPress}
      >
        {places.map((p) => (
          <React.Fragment key={p.id}>
            <Marker
              coordinate={{ latitude: p.latitude, longitude: p.longitude }}
              onPress={() => {
                if (!isAddingMode) setSelectedPlace(p);
              }}
              tracksViewChanges={Platform.OS !== 'web'}
              pinColor={Platform.OS === 'web' ? colors.primary : undefined}
            >
              {Platform.OS !== 'web' && (
                <View style={styles.markerWrap}>
                  <View style={[styles.markerBubble, { backgroundColor: colors.text }]}>
                    <MaterialCommunityIcons
                      name={CATEGORY_ICONS[p.category]}
                      size={18}
                      color={colors.background}
                    />
                  </View>
                  <View style={[styles.markerLabel, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.markerLabelText, { color: colors.text }]} numberOfLines={1}>
                      {p.name}
                    </Text>
                    {isFoodCategory(p.category) &&
                      typeof p.averageCheck === 'number' &&
                      p.averageCheck > 0 && (
                        <Text style={[styles.markerCheckText, { color: colors.success }]}>
                          от {p.averageCheck} ₽
                        </Text>
                      )}
                  </View>
                </View>
              )}
            </Marker>
            {selectedPlace?.id === p.id && Platform.OS !== 'web' && (
              <Circle
                center={{ latitude: p.latitude, longitude: p.longitude }}
                radius={p.radiusMeters ?? 50}
                strokeColor={`${colors.primary}CC`}
                fillColor={`${colors.primary}26`}
              />
            )}
          </React.Fragment>
        ))}

        {newPoint && (
          <>
            <Marker
              coordinate={newPoint}
              draggable={Platform.OS !== 'web'}
              onDragEnd={Platform.OS !== 'web' ? handleDragEnd : undefined}
              pinColor={colors.warning}
            />
            {Platform.OS !== 'web' && (
              <Circle
                center={newPoint}
                radius={50}
                strokeColor={`${colors.warning}CC`}
                fillColor={`${colors.warning}26`}
              />
            )}
          </>
        )}
      </MapView>

      {/* Плашка предупреждения, если аккаунт на модерации */}
      {isPending && (
        <View style={{ position: 'absolute', top: 76, left: 16, right: 16, backgroundColor: '#f39c12', padding: 12, borderRadius: 8, zIndex: 10 }}>
          <Text style={{ color: '#fff', fontWeight: '700', textAlign: 'center' }}>Аккаунт на модерации. Ожидайте одобрения администратора.</Text>
        </View>
      )}

      {/* Верхний бар: баланс и лимиты (в стиле темы) */}
      <View style={styles.topBar}>
        <View style={{ flex: 1 }} />
        
        <View style={[styles.balanceBadge, { backgroundColor: colors.surface }]}>
          <Text style={[styles.balanceLabel, { color: colors.textMuted }]}>Баллы:</Text>
          <Text style={[styles.balanceText, { color: colors.text }]}>{venue?.balance ?? 0}</Text>
        </View>

        <View style={[styles.limitsBadge, { backgroundColor: colors.surface }]}>
          <View style={styles.limitItem}>
            <MaterialCommunityIcons name="map-marker" size={14} color={colors.primary} />
            <Text style={[styles.limitText, { color: colors.text }]}>{venue?.pointsUsed ?? 0} / {pointsLimit}</Text>
          </View>
          <View style={styles.limitItem}>
            <MaterialCommunityIcons name="ticket-percent" size={14} color={colors.warning} />
            <Text style={[styles.limitText, { color: colors.text }]}>{venue?.couponsUsed ?? 0} / {couponsLimit}</Text>
          </View>
        </View>
      </View>

      {/* Подсказка в режиме добавления */}
      {isAddingMode && !newPoint && (
        <View style={[styles.hintBox, { backgroundColor: colors.surface }]} pointerEvents="none">
          <Text style={[styles.hintText, { color: colors.text }]}>
            Нажмите на карту, чтобы выбрать место
          </Text>
        </View>
      )}

      {/* Плашка лимита, если исчерпан */}
      {!canCreateMore && !selectedPlace && !isAddingMode && (
        <View style={[styles.limitBox, { backgroundColor: '#fdecea' }]} pointerEvents="none">
          <Text style={[styles.limitTextAlert, { color: colors.danger }]}>
            Лимит точек исчерпан. Обратитесь к админу.
          </Text>
        </View>
      )}

      {/* Нижние кнопки (только когда ничего не выбрано и не в режиме добавления) */}
      {!selectedPlace && !newPoint && !isAddingMode && (
        <View style={styles.bottomButtons}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: isPending ? '#95a5a6' : colors.primary }]}
            onPress={() => {
              if (isPending) {
                Alert.alert('Аккаунт на модерации', 'Вы не можете создавать точки, пока администратор не одобрит вашу заявку.');
                return;
              }
              if (!canCreateMore) {
                Alert.alert('Лимит исчерпан', 'Обратитесь к администратору для увеличения лимита точек.');
                return;
              }
              setIsAddingMode(true);
            }}
          >
            <MaterialCommunityIcons name="map-marker-plus" size={20} color="#fff" />
            <Text style={styles.actionBtnText}>{isAddingMode ? 'Отменить выбор' : 'Создать точку'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}
            onPress={handleOpenList}
          >
            <MaterialCommunityIcons name="format-list-bulleted" size={20} color={colors.text} />
            <Text style={[styles.actionBtnText, { color: colors.text }]}>Мои точки</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Плашка создания новой точки */}
      {newPoint && (
        <View style={[styles.newPointCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.newPointTitle, { color: colors.text }]}>Новая точка</Text>
          <Text style={[styles.newPointAddress, { color: colors.textMuted }]}>
            {newPointAddress}
          </Text>
          <Text style={[styles.newPointHint, { color: colors.textMuted }]}>
            Перетащите маркер для точной установки
          </Text>
          <View style={styles.newPointActions}>
            <TouchableOpacity
              style={[styles.cancelBtn, { backgroundColor: colors.surfaceAlt }]}
              onPress={handleCancelNew}
            >
              <Text style={{ color: colors.text, fontWeight: '600' }}>Отмена</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.createBtn, { backgroundColor: colors.primary }]}
              onPress={handleCreate}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>Создать</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Плашка выбранной существующей точки */}
      {selectedPlace && (
        <View style={[styles.placeCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.placeName, { color: colors.text }]}>{selectedPlace.name}</Text>
          <Text style={[styles.placeAddr, { color: colors.textMuted }]}>{selectedPlace.address}</Text>
          <Text style={[styles.placeMeta, { color: colors.textMuted }]}>
            Радиус: {selectedPlace.radiusMeters} м
          </Text>
          {isFoodCategory(selectedPlace.category) && selectedPlace.averageCheck ? (
            <Text style={[styles.placeMeta, { color: colors.success }]}>
              Средний чек: от {selectedPlace.averageCheck} ₽
            </Text>
          ) : null}

          <View style={styles.placeActions}>
            <TouchableOpacity
              style={[styles.closeBtn, { backgroundColor: colors.surfaceAlt }]}
              onPress={() => setSelectedPlace(null)}
            >
              <Text style={{ color: colors.text, fontWeight: '600', fontSize: 12 }}>Закрыть</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.editBtn, { backgroundColor: colors.primary }]}
              onPress={handleEdit}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>Изменить</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.deleteBtn, { backgroundColor: colors.danger }, busy && { opacity: 0.6 }]}
              onPress={handleDeletePlace}
              disabled={busy}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>Удалить</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    position: 'absolute', 
    top: 16, 
    left: 16, 
    right: 16,
    flexDirection: 'row', 
    alignItems: 'flex-start',
    gap: 8,
  },
  balanceBadge: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 20, paddingHorizontal: 16, height: 44, elevation: 4,
  },
  balanceLabel: { fontSize: 14, fontWeight: '600', marginRight: 4 },
  balanceText: { fontWeight: '800', fontSize: 16 },
  limitsBadge: {
    borderRadius: 12, padding: 8, elevation: 4, gap: 4,
  },
  limitItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  limitText: { fontWeight: '700', fontSize: 12 },

  hintBox: {
    position: 'absolute', top: 76, left: 16, right: 16,
    borderRadius: 10, padding: 10, alignItems: 'center', elevation: 2,
  },
  hintText: { fontSize: 13 },

  limitBox: {
    position: 'absolute', bottom: 90, left: 16, right: 16,
    borderRadius: 10, padding: 14,
    alignItems: 'center', borderLeftWidth: 4, borderLeftColor: '#e74c3c',
  },
  limitTextAlert: { fontWeight: '600' },

  bottomButtons: {
    position: 'absolute', bottom: 24, left: 16, right: 16,
    flexDirection: 'row', gap: 12,
  },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    padding: 16, borderRadius: 12, elevation: 4, gap: 8,
  },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  newPointCard: {
    position: 'absolute', bottom: 24, left: 16, right: 16,
    borderRadius: 12, padding: 16, elevation: 4,
  },
  newPointTitle: { fontWeight: '700', fontSize: 15 },
  newPointAddress: { fontSize: 13, marginTop: 4 },
  newPointHint: { fontSize: 12, marginTop: 6, fontStyle: 'italic' },
  newPointActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  cancelBtn: {
    flex: 1, borderRadius: 8, paddingVertical: 12, alignItems: 'center',
  },
  createBtn: {
    flex: 2, borderRadius: 8, paddingVertical: 12, alignItems: 'center',
  },

  placeCard: {
    position: 'absolute', bottom: 24, left: 16, right: 16,
    borderRadius: 12, padding: 16, elevation: 4,
  },
  placeName: { fontWeight: '700', fontSize: 16 },
  placeAddr: { fontSize: 13, marginTop: 2 },
  placeMeta: { fontSize: 12, marginTop: 4 },
  placeActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  closeBtn: {
    flex: 1, borderRadius: 8, paddingVertical: 12, alignItems: 'center',
  },
  editBtn: {
    flex: 1, borderRadius: 8, paddingVertical: 12, alignItems: 'center',
  },
  deleteBtn: {
    flex: 1, borderRadius: 8, paddingVertical: 12, alignItems: 'center',
  },

  markerWrap: { alignItems: 'center' },
  markerBubble: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  markerLabel: {
    marginTop: 2, paddingHorizontal: 6,
    paddingVertical: 2, borderRadius: 6, maxWidth: 130, alignItems: 'center',
  },
  markerLabelText: { fontSize: 11, fontWeight: '600' },
  markerCheckText: { fontSize: 10, fontWeight: '700', marginTop: 1 },
});