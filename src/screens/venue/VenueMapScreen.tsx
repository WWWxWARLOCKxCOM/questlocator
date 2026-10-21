import React, { useEffect, useMemo, useState } from 'react';
import {
  View, StyleSheet, Text, TouchableOpacity, Alert, Platform,
} from 'react-native';
import Constants from 'expo-constants';
import MapView, {
  Marker, PROVIDER_GOOGLE, Circle, MapPressEvent,
} from 'react-native-maps';
import {
  DrawerActions, useNavigation, useRoute, RouteProp,
} from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { VenueStackParamList } from '@/navigation/VenueNavigator';
import { subscribeToPlacesByOwner } from '@/services/placesService';
import { subscribeToVenue, deleteMyPlace } from '@/services/venueService';
import { useAuth } from '@/context/AuthContext';
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

  const [places, setPlaces] = useState<Place[]>([]);
  const [venue, setVenue] = useState<VenueAccount | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [newPoint, setNewPoint] = useState<GeoPoint | null>(null);
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

  const handleLongPress = (e: MapPressEvent) => {
    if (!canCreateMore) return;
    setSelectedPlace(null);
    setNewPoint(e.nativeEvent.coordinate);
  };

  const handleDragEnd = (e: any) => {
    setNewPoint(e.nativeEvent.coordinate);
  };

  const handleCreate = () => {
    if (!newPoint) return;
    navigation.navigate('VenueAddPlace', {
      latitude: newPoint.latitude,
      longitude: newPoint.longitude,
    });
    setNewPoint(null);
  };

  const handleCancelNew = () => setNewPoint(null);

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

  return (
    <View style={styles.container}>
      <MapView
        provider={Platform.OS === 'web' ? undefined : PROVIDER_GOOGLE}
        googleMapsApiKey={Platform.OS === 'web' ? Constants.expoConfig?.extra?.GOOGLE_MAPS_WEB_API_KEY : undefined}
        style={StyleSheet.absoluteFillObject}
        initialRegion={initialRegion}
        showsUserLocation
        onLongPress={handleLongPress}
        onPress={() => setSelectedPlace(null)}
      >
        {places.map((p) => (
          <React.Fragment key={p.id}>
            <Marker
              coordinate={{ latitude: p.latitude, longitude: p.longitude }}
              onPress={() => setSelectedPlace(p)}
              tracksViewChanges={false}
              pinColor={Platform.OS === 'web' ? '#2c3e50' : undefined}
            >
              {Platform.OS !== 'web' && (
                <View style={styles.markerWrap}>
                  <View style={styles.markerBubble}>
                    <MaterialCommunityIcons
                      name={CATEGORY_ICONS[p.category]}
                      size={18}
                      color="#fff"
                    />
                  </View>
                  <View style={styles.markerLabel}>
                    <Text style={styles.markerLabelText} numberOfLines={1}>{p.name}</Text>
                    {isFoodCategory(p.category) &&
                      typeof p.averageCheck === 'number' &&
                      p.averageCheck > 0 && (
                        <Text style={styles.markerCheckText}>от {p.averageCheck} ₽</Text>
                      )}
                  </View>
                </View>
              )}
            </Marker>
            {selectedPlace?.id === p.id && Platform.OS !== 'web' && (
              <Circle
                center={{ latitude: p.latitude, longitude: p.longitude }}
                radius={p.radiusMeters ?? 50}
                strokeColor="rgba(44,62,80,0.8)"
                fillColor="rgba(44,62,80,0.15)"
              />
            )}
          </React.Fragment>
        ))}

        {newPoint && (
          <>
            <Marker
              coordinate={newPoint}
              draggable
              onDragEnd={handleDragEnd}
              pinColor="#e67e22"
            />
            {Platform.OS !== 'web' && (
              <Circle
                center={newPoint}
                radius={50}
                strokeColor="rgba(230,126,34,0.9)"
                fillColor="rgba(230,126,34,0.15)"
              />
            )}
          </>
        )}
      </MapView>

      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.hamburger}
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
        >
          <Ionicons name="menu" size={24} color="#000" />
        </TouchableOpacity>

        <View style={styles.balanceBadge}>
          <Text style={styles.balanceLabel}>Баллы:</Text>
          <Text style={styles.balanceText}>{venue?.balance ?? 0}</Text>
        </View>

        <View style={styles.limitsBadge}>
          <View style={styles.limitItem}>
            <MaterialCommunityIcons name="map-marker" size={14} color="#2c3e50" />
            <Text style={styles.limitText}>{venue?.pointsUsed ?? 0} / {pointsLimit}</Text>
          </View>
          <View style={styles.limitItem}>
            <MaterialCommunityIcons name="ticket-percent" size={14} color="#e67e22" />
            <Text style={styles.limitText}>{venue?.couponsUsed ?? 0} / {couponsLimit}</Text>
          </View>
        </View>
      </View>

      {canCreateMore && !newPoint && !selectedPlace && (
        <View style={styles.hintBox} pointerEvents="none">
          <Text style={styles.hintText}>
            Долгое нажатие по карте — поставить точку
          </Text>
        </View>
      )}

      {!canCreateMore && !selectedPlace && (
        <View style={styles.limitBox} pointerEvents="none">
          <Text style={styles.limitTextAlert}>Лимит исчерпан. Обратитесь к админу.</Text>
        </View>
      )}

      {newPoint && (
        <View style={styles.newPointCard}>
          <Text style={styles.newPointTitle}>Новая точка</Text>
          <Text style={styles.newPointCoords}>
            {newPoint.latitude.toFixed(6)}, {newPoint.longitude.toFixed(6)}
          </Text>
          <Text style={styles.newPointHint}>
            Перетащите маркер для точной установки
          </Text>
          <View style={styles.newPointActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleCancelNew}>
              <Text style={styles.cancelText}>Отмена</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.createBtn} onPress={handleCreate}>
              <Text style={styles.createText}>Создать точку</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {selectedPlace && (
        <View style={styles.placeCard}>
          <Text style={styles.placeName}>{selectedPlace.name}</Text>
          <Text style={styles.placeAddr}>{selectedPlace.address}</Text>
          <Text style={styles.placeMeta}>Радиус: {selectedPlace.radiusMeters} м</Text>
          {isFoodCategory(selectedPlace.category) && selectedPlace.averageCheck ? (
            <Text style={styles.placeMeta}>
              Средний чек: от {selectedPlace.averageCheck} ₽
            </Text>
          ) : null}

          <View style={styles.placeActions}>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => setSelectedPlace(null)}
            >
              <Text style={styles.closeText}>Закрыть</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.editBtn} onPress={handleEdit}>
              <Text style={styles.editText}>Изменить</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.deleteBtn, busy && { opacity: 0.6 }]}
              onPress={handleDeletePlace}
              disabled={busy}
            >
              <Text style={styles.deleteText}>Удалить</Text>
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
    top: 40, 
    left: 16, 
    right: 16,
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-start',
  },
  hamburger: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center', elevation: 4,
  },
  balanceBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 16, height: 44, elevation: 4,
  },
  balanceLabel: { fontSize: 14, fontWeight: '600', color: '#666', marginRight: 4 },
  balanceText: { fontWeight: '800', fontSize: 16, color: '#2c3e50' },
  limitsBadge: {
    backgroundColor: '#fff', borderRadius: 12, padding: 8, elevation: 4, gap: 4,
  },
  limitItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  limitText: { fontWeight: '700', fontSize: 12, color: '#333' },

  hintBox: {
    position: 'absolute', top: 96, left: 16, right: 16,
    backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 10,
    padding: 10, alignItems: 'center', elevation: 2,
  },
  hintText: { fontSize: 13, color: '#333' },

  limitBox: {
    position: 'absolute', bottom: 24, left: 16, right: 16,
    backgroundColor: '#fdecea', borderRadius: 10, padding: 14,
    alignItems: 'center', borderLeftWidth: 4, borderLeftColor: '#e74c3c',
  },
  limitTextAlert: { color: '#c0392b', fontWeight: '600' },

  newPointCard: {
    position: 'absolute', bottom: 24, left: 16, right: 16,
    backgroundColor: '#fff', borderRadius: 12, padding: 16, elevation: 4,
  },
  newPointTitle: { fontWeight: '700', fontSize: 15 },
  newPointCoords: { color: '#666', fontSize: 12, marginTop: 2 },
  newPointHint: { color: '#999', fontSize: 12, marginTop: 4, fontStyle: 'italic' },
  newPointActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  cancelBtn: {
    flex: 1, backgroundColor: '#ecf0f1', borderRadius: 8,
    paddingVertical: 12, alignItems: 'center',
  },
  cancelText: { color: '#2c3e50', fontWeight: '600' },
  createBtn: {
    flex: 2, backgroundColor: '#2c3e50', borderRadius: 8,
    paddingVertical: 12, alignItems: 'center',
  },
  createText: { color: '#fff', fontWeight: '700' },

  placeCard: {
    position: 'absolute', bottom: 24, left: 16, right: 16,
    backgroundColor: '#fff', borderRadius: 12, padding: 16, elevation: 4,
  },
  placeName: { fontWeight: '700', fontSize: 16 },
  placeAddr: { color: '#666', fontSize: 13, marginTop: 2 },
  placeMeta: { color: '#888', fontSize: 12, marginTop: 4 },
  placeActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  closeBtn: {
    flex: 1, backgroundColor: '#ecf0f1', borderRadius: 8,
    paddingVertical: 12, alignItems: 'center',
  },
  closeText: { color: '#2c3e50', fontWeight: '600', fontSize: 12 },
  editBtn: {
    flex: 1, backgroundColor: '#3498db', borderRadius: 8,
    paddingVertical: 12, alignItems: 'center',
  },
  editText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  deleteBtn: {
    flex: 1, backgroundColor: '#e74c3c', borderRadius: 8,
    paddingVertical: 12, alignItems: 'center',
  },
  deleteText: { color: '#fff', fontWeight: '700', fontSize: 12 },

  markerWrap: { alignItems: 'center' },
  markerBubble: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#2c3e50', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  markerLabel: {
    marginTop: 2, backgroundColor: '#fff', paddingHorizontal: 6,
    paddingVertical: 2, borderRadius: 6, maxWidth: 130, alignItems: 'center',
  },
  markerLabelText: { fontSize: 11, fontWeight: '600', color: '#222' },
  markerCheckText: { fontSize: 10, color: '#27ae60', fontWeight: '700', marginTop: 1 },
});