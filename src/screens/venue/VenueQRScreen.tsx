import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, Pressable, Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import { subscribeToPlacesByOwner } from '@/services/placesService';
import { useAuth } from '@/context/AuthContext';
import { Place } from '@/types';

export default function VenueQRScreen() {
  const { user } = useAuth();
  const [places, setPlaces] = useState<Place[]>([]);

  useEffect(() => {
    if (!user) return;
    return subscribeToPlacesByOwner(user.uid, setPlaces);
  }, [user]);

  const copyCode = async (value: string) => {
    await Clipboard.setStringAsync(value);
    Alert.alert('Скопировано', 'Код скопирован. Можно вставить в поле «Ввести код» на экране сканера.');
  };

  return (
    <FlatList
      data={places}
      keyExtractor={(p) => p.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text style={styles.name}>{item.name}</Text>
          {item.qrCode ? (
            <>
              <View style={styles.qrWrap}>
                <QRCode value={item.qrCode} size={300} backgroundColor="#fff" color="#000" />
              </View>
              <Pressable style={styles.copyBtn} onPress={() => copyCode(item.qrCode)}>
                <Text style={styles.copyText}>Скопировать код</Text>
              </Pressable>
              <Text style={styles.codeHint}>{item.qrCode}</Text>
            </>
          ) : (
            <Text style={styles.pending}>QR-код ещё генерируется...</Text>
          )}
        </View>
      )}
      ListEmptyComponent={<Text style={styles.empty}>У вас пока нет точек.</Text>}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 16 },
  card: {
    alignItems: 'center', backgroundColor: '#f5f5f5', borderRadius: 12,
    padding: 16, marginBottom: 16, gap: 12,
  },
  name: { fontSize: 16, fontWeight: '700' },
  qrWrap: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 12,
    elevation: 2,
  },
  copyBtn: {
    backgroundColor: '#2c3e50', borderRadius: 8,
    paddingVertical: 10, paddingHorizontal: 20,
  },
  copyText: { color: '#fff', fontWeight: '700' },
  codeHint: { color: '#999', fontSize: 11 },
  pending: { color: '#999' },
  empty: { textAlign: 'center', marginTop: 40, color: '#999' },
});