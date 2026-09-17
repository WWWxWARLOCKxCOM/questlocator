import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ClientStackParamList } from '@/navigation/ClientNavigator';
import { subscribeToActivePlaces } from '@/services/placesService';
import { subscribeToActiveQuestForPlace } from '@/services/questService';
import { getCurrentPosition } from '@/services/locationService';
import { Place, Quest, PinStatus, GeoPoint } from '@/types';

type Nav = NativeStackNavigationProp<ClientStackParamList>;

const PIN_COLORS: Record<PinStatus, string> = {
  available: '#2ecc71', // 🟢
  unavailable: '#e74c3c', // 🔴
  active_session: '#f1c40f', // 🟡
};

export default function MapScreen() {
  const navigation = useNavigation<Nav>();
  const [places, setPlaces] = useState<Place[]>([]);
  const [userLocation, setUserLocation] = useState<GeoPoint | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [selectedQuest, setSelectedQuest] = useState<Quest | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToActivePlaces(setPlaces);
    getCurrentPosition().then(setUserLocation).catch(() => {});
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!selectedPlace) {
      setSelectedQuest(null);
      return;
    }
    return subscribeToActiveQuestForPlace(selectedPlace.id, setSelectedQuest);
  }, [selectedPlace]);

  const initialRegion: Region | undefined = useMemo(() => {
    if (!userLocation) return undefined;
    return {
      latitude: userLocation.latitude,
      longitude: userLocation.longitude,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    };
  }, [userLocation]);

  const pinStatusFor = useCallback((place: Place): PinStatus => {
    // TODO: заменить на реальную проверку "пользователь внутри активной сессии этого места",
    // подписавшись на текущую сессию пользователя (см. sessionService.subscribeToSession).
    if (!place.isActive) return 'unavailable';
    return 'available';
  }, []);

  const handleStartScan = () => {
    if (!selectedPlace || !selectedQuest) return;
    navigation.navigate('QRScanner', {
      placeId: selectedPlace.id,
      questId: selectedQuest.id,
      placeLatitude: selectedPlace.latitude,
      placeLongitude: selectedPlace.longitude,
    });
  };

  return (
    <View style={styles.container}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFillObject}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton
      >
        {places.map((place) => (
          <Marker
            key={place.id}
            coordinate={{ latitude: place.latitude, longitude: place.longitude }}
            pinColor={PIN_COLORS[pinStatusFor(place)]}
            onPress={() => setSelectedPlace(place)}
          />
        ))}
      </MapView>

      {selectedPlace && (
        <BottomSheet index={0} snapPoints={['35%']} onClose={() => setSelectedPlace(null)}>
          <BottomSheetView style={styles.sheetContent}>
            <Text style={styles.placeName}>{selectedPlace.name}</Text>
            <Text style={styles.placeAddress}>{selectedPlace.address}</Text>

            {selectedQuest ? (
              <>
                <Text>
                  Требуемое время: от {selectedQuest.minTimeMinutes} до {selectedQuest.maxTimeMinutes} минут
                </Text>
                <Text>Награда: {selectedQuest.rewardPoints} баллов</Text>
                {selectedQuest.photoRequired || selectedQuest.photoBonusMultiplier > 1 ? (
                  <Text>
                    Бонус за фото: множитель ×{selectedQuest.photoBonusMultiplier}
                  </Text>
                ) : null}
                <ScanButton onPress={handleStartScan} />
              </>
            ) : (
              <Text>Активных квестов здесь сейчас нет.</Text>
            )}
          </BottomSheetView>
        </BottomSheet>
      )}
    </View>
  );
}

function ScanButton({ onPress }: { onPress: () => void }) {
  return (
    <View style={styles.scanButton}>
      <Text style={styles.scanButtonText} onPress={onPress}>
        Сканировать QR и начать
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  sheetContent: { padding: 16, gap: 8 },
  placeName: { fontSize: 18, fontWeight: '700' },
  placeAddress: { color: '#666' },
  scanButton: {
    marginTop: 12,
    backgroundColor: '#2ecc71',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  scanButtonText: { color: 'white', fontWeight: '600' },
});
