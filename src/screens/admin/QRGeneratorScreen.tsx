import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, Alert } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { subscribeToAllPlaces } from '@/services/placesService';
import { Place } from '@/types';

/**
 * QR-код для каждого заведения генерируется на сервере при создании места
 * (Cloud Function onPlaceCreated, см. functions/src/index.ts), которая записывает
 * поле qr_code в формате quest://place/{placeId} — здесь код лишь отрисовывается
 * как SVG/PNG для печати.
 */
export default function QRGeneratorScreen() {
  const [places, setPlaces] = useState<Place[]>([]);

  useEffect(() => subscribeToAllPlaces(setPlaces), []);

  const handleDownload = (place: Place) => {
    // В реальном билде здесь используется react-native-view-shot + expo-media-library
    // для сохранения QR как PNG в галерею/файлы устройства.
    Alert.alert('Сохранение', `QR-код для «${place.name}» готов к печати.`);
  };

  return (
    <FlatList
      data={places}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text style={styles.name}>{item.name}</Text>
          {item.qrCode ? (
            <QRCode value={item.qrCode} size={160} />
          ) : (
            <Text style={styles.pending}>QR-код ещё генерируется...</Text>
          )}
          <Pressable style={styles.downloadButton} onPress={() => handleDownload(item)}>
            <Text style={styles.downloadButtonText}>Скачать PNG</Text>
          </Pressable>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 16 },
  card: {
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    gap: 12,
  },
  name: { fontSize: 16, fontWeight: '700' },
  pending: { color: '#999' },
  downloadButton: { backgroundColor: '#2ecc71', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16 },
  downloadButtonText: { color: '#fff', fontWeight: '600' },
});
