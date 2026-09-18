import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, MapPressEvent, Circle } from 'react-native-maps';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { AdminStackParamList } from '@/navigation/AdminNavigator';
import { subscribeToAllPlaces } from '@/services/placesService';
import { Place, GeoPoint } from '@/types';

type Nav = NativeStackNavigationProp<AdminStackParamList, 'AdminMap'>;

export default function AdminMapScreen() {
  const navigation = useNavigation<Nav>();
  const [places, setPlaces] = useState<Place[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<GeoPoint | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);

  useEffect(() => subscribeToAllPlaces(setPlaces), []);

  const handleLongPress = (e: MapPressEvent) => {
    setSelectedPlace(null);
    setSelectedPoint(e.nativeEvent.coordinate);
  };

  const handleMarkerDrag = (e: any) => {
    setSelectedPoint(e.nativeEvent.coordinate);
  };

  const handleCreate = () => {
    if (!selectedPoint) return;
    navigation.navigate('AdminPlaceForm', {
      latitude: selectedPoint.latitude,
      longitude: selectedPoint.longitude,
    });
    setSelectedPoint(null);
  };

  return (
    <View style={styles.container}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFillObject}
        initialRegion={{
          latitude: 55.751244,
          longitude: 37.618423,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        }}
        onLongPress={handleLongPress}
        onPress={() => setSelectedPlace(null)}
        showsUserLocation
        showsMyLocationButton
      >
        {places.map((place) => (
          <React.Fragment key={place.id}>
            <Marker
              coordinate={{ latitude: place.latitude, longitude: place.longitude }}
              title={place.name}
              description={place.address}
              pinColor="#2ecc71"
              onPress={() => {
                setSelectedPlace(place);
                setSelectedPoint(null);
              }}
            />
            {selectedPlace?.id === place.id && (
              <Circle
                center={{ latitude: place.latitude, longitude: place.longitude }}
                radius={place.radiusMeters ?? 50}
                strokeColor="rgba(46,204,113,0.9)"
                fillColor="rgba(46,204,113,0.15)"
              />
            )}
          </React.Fragment>
        ))}

        {selectedPoint && (
          <>
            <Marker
              coordinate={selectedPoint}
              pinColor="#e67e22"
              draggable
              onDragEnd={handleMarkerDrag}
            />
            <Circle
              center={selectedPoint}
              radius={50}
              strokeColor="rgba(230,126,34,0.9)"
              fillColor="rgba(230,126,34,0.15)"
            />
          </>
        )}
      </MapView>

      <TouchableOpacity
        style={styles.hamburger}
        onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
      >
        <Ionicons name="menu" size={28} color="#000" />
      </TouchableOpacity>

      <View style={styles.hint} pointerEvents="none">
        <Text style={styles.hintText}>
          {selectedPoint
            ? 'Точка выбрана. Нажмите кнопку ниже — откроется форма.'
            : 'Долгое нажатие по карте — поставить точку нового заведения.'}
        </Text>
      </View>

      {selectedPoint && (
        <TouchableOpacity style={styles.createButton} onPress={handleCreate}>
          <Text style={styles.createButtonText}>Создать заведение</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hamburger: {
    position: 'absolute',
    top: 48,
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  hint: {
    position: 'absolute',
    top: 48,
    left: 72,
    right: 16,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 8,
    padding: 10,
  },
  hintText: { fontSize: 13, color: '#333' },
  createButton: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    right: 24,
    backgroundColor: '#2ecc71',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    elevation: 4,
  },
  createButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});