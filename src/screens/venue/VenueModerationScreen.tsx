import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Image, StyleSheet, Pressable, Alert } from 'react-native';
import { ref as storageRef, getDownloadURL } from 'firebase/storage';
import { storage } from '@/config/firebase';
import { subscribeToVenuePhotos, moderatePhoto } from '@/services/venueService';
import { useAuth } from '@/context/AuthContext';
import { QuestPhoto } from '@/types';

interface PhotoWithUrl extends QuestPhoto {
  signedUrl: string;
}

export default function VenueModerationScreen() {
  const { user } = useAuth();
  const [photos, setPhotos] = useState<PhotoWithUrl[]>([]);

  useEffect(() => {
    if (!user) return;
    return subscribeToVenuePhotos(user.uid, async (list) => {
      const withUrls = await Promise.all(
        list.map(async (p) => {
          let url = '';
          if (p.imagePath) {
            try { url = await getDownloadURL(storageRef(storage, p.imagePath)); } catch {}
          }
          return { ...p, signedUrl: url } as PhotoWithUrl;
        }),
      );
      setPhotos(withUrls);
    });
  }, [user]);

  const decide = async (p: PhotoWithUrl, approve: boolean) => {
    try {
      await moderatePhoto(p.id, approve);
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось обработать');
    }
  };

  return (
    <FlatList
      data={photos}
      keyExtractor={(p) => p.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <View style={styles.card}>
          {item.signedUrl ? <Image source={{ uri: item.signedUrl }} style={styles.image} /> : null}
          <View style={styles.actions}>
            <Pressable style={[styles.btn, styles.approve]} onPress={() => decide(item, true)}>
              <Text style={styles.btnText}>Одобрить</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.reject]} onPress={() => decide(item, false)}>
              <Text style={styles.btnText}>Отклонить</Text>
            </Pressable>
          </View>
        </View>
      )}
      ListEmptyComponent={<Text style={styles.empty}>Нет фото на модерацию.</Text>}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 16 },
  card: { backgroundColor: '#f5f5f5', borderRadius: 12, padding: 12, marginBottom: 16, gap: 8 },
  image: { width: '100%', height: 220, borderRadius: 8 },
  actions: { flexDirection: 'row', gap: 12 },
  btn: { flex: 1, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  approve: { backgroundColor: '#27ae60' },
  reject: { backgroundColor: '#c0392b' },
  btnText: { color: '#fff', fontWeight: '700' },
  empty: { textAlign: 'center', marginTop: 40, color: '#999' },
});