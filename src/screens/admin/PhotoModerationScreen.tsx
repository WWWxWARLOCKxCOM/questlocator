import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  StyleSheet,
  Pressable,
  Alert,
} from 'react-native';
import {
  collection,
  onSnapshot,
  query,
  where,
  doc,
  updateDoc,
} from 'firebase/firestore';
import { ref as storageRef, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/config/firebase';

interface ModerationPhoto {
  id: string;
  sessionId: string;
  userId: string;
  imagePath: string;
  exifLatitude?: number;
  exifLongitude?: number;
  status: 'pending' | 'approved' | 'rejected';
  similarityScore?: number;
  createdAt: number;
  signedUrl: string;
}

/**
 * Фото, не прошедшие автоматическую проверку, попадают сюда со статусом 'pending'.
 * Бакет Storage приватный (см. storage.rules), поэтому для показа используется
 * временная download-URL через getDownloadURL.
 *
 * Начисление бонуса за одобренное фото выполняет триггер onPhotoStatusChange
 * (Cloud Functions), который выставляет sessions.photoBonusApplied = true.
 */
export default function PhotoModerationScreen() {
  const [photos, setPhotos] = useState<ModerationPhoto[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'photos'), where('status', '==', 'pending'));

    const unsub = onSnapshot(q, async (snap) => {
      const items = await Promise.all(
        snap.docs.map(async (d) => {
          const data = d.data();
          let url = '';
          try {
            url = await getDownloadURL(storageRef(storage, data.imagePath));
          } catch {
            // Файл мог быть удалён — оставляем пустой URL, картинка не покажется
          }
          return {
            id: d.id,
            sessionId: data.sessionId,
            userId: data.userId,
            imagePath: data.imagePath,
            exifLatitude: data.exifLatitude,
            exifLongitude: data.exifLongitude,
            status: data.status,
            similarityScore: data.similarityScore,
            createdAt: data.createdAt?.toMillis?.() ?? 0,
            signedUrl: url,
          } as ModerationPhoto;
        }),
      );
      setPhotos(items);
    });

    return () => unsub();
  }, []);

  const decide = async (photo: ModerationPhoto, approve: boolean) => {
    try {
      await updateDoc(doc(db, 'photos', photo.id), {
        status: approve ? 'approved' : 'rejected',
      });
      // Серверный триггер onPhotoStatusChange при approve=true начислит бонус
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось обновить статус.');
    }
  };

  return (
    <FlatList
      data={photos}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <View style={styles.card}>
          {item.signedUrl ? (
            <Image source={{ uri: item.signedUrl }} style={styles.image} />
          ) : (
            <View style={[styles.image, styles.imagePlaceholder]}>
              <Text style={styles.imagePlaceholderText}>Файл недоступен</Text>
            </View>
          )}

          {item.similarityScore !== undefined && item.similarityScore !== null && (
            <Text style={styles.score}>
              Похожесть: {(item.similarityScore * 100).toFixed(0)}%
            </Text>
          )}

          <View style={styles.actions}>
            <Pressable
              style={[styles.actionButton, styles.approve]}
              onPress={() => decide(item, true)}
            >
              <Text style={styles.actionText}>Одобрить</Text>
            </Pressable>
            <Pressable
              style={[styles.actionButton, styles.reject]}
              onPress={() => decide(item, false)}
            >
              <Text style={styles.actionText}>Отклонить</Text>
            </Pressable>
          </View>
        </View>
      )}
      ListEmptyComponent={<Text style={styles.empty}>Нет фото на модерации.</Text>}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 16 },
  card: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  image: { width: '100%', height: 220, borderRadius: 8 },
  imagePlaceholder: {
    backgroundColor: '#ddd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholderText: { color: '#666' },
  score: { color: '#666' },
  actions: { flexDirection: 'row', gap: 12 },
  actionButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  approve: { backgroundColor: '#27ae60' },
  reject: { backgroundColor: '#c0392b' },
  actionText: { color: '#fff', fontWeight: '700' },
  empty: { textAlign: 'center', marginTop: 40, color: '#999' },
});