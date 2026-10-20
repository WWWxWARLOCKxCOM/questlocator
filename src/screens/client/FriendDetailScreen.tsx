import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Image, ActivityIndicator, TouchableOpacity, Alert,
} from 'react-native';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import {
  doc,
  onSnapshot,
  collection,
  query,
  where,
  limit,
  getDoc,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { removeFriend } from '@/services/friendsService';
import { FriendsStackParamList } from '@/navigation/ClientNavigator';

type Rt = RouteProp<FriendsStackParamList, 'FriendDetail'>;

interface FriendData {
  uid: string;
  name: string;
  surname: string;
  avatarUrl: string | null;
  phone: string;
  questsCompleted: number;
}

interface ActiveInfo {
  placeId: string;
  placeName: string;
  placeAddress: string;
  startedAt: number;
}

export default function FriendDetailScreen() {
  const route = useRoute<Rt>();
  const navigation = useNavigation<any>();
  const { friendUid } = route.params;

  const [friend, setFriend] = useState<FriendData | null>(null);
  const [active, setActive] = useState<ActiveInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onSnapshot(doc(db, 'users', friendUid), (snap) => {
      const d = snap.data() ?? {};
      setFriend({
        uid: friendUid,
        name: d.name ?? '',
        surname: d.surname ?? '',
        avatarUrl: d.avatarUrl ?? null,
        phone: d.phone ?? '',
        questsCompleted: d.questsCompleted ?? 0,
      });
      setLoading(false);
    });
  }, [friendUid]);

  useEffect(() => {
    const q = query(
      collection(db, 'sessions'),
      where('userId', '==', friendUid),
      where('status', 'in', ['in_progress', 'paused']),
      limit(1),
    );
    return onSnapshot(q, async (snap) => {
      if (snap.empty) {
        setActive(null);
        return;
      }
      const s = snap.docs[0].data();
      if (s.hideOnMap === true) {
        setActive(null);
        return;
      }
      const placeSnap = await getDoc(doc(db, 'places', s.placeId));
      const place = placeSnap.data() ?? {};
      setActive({
        placeId: s.placeId,
        placeName: place.name ?? 'Заведение',
        placeAddress: place.address ?? '',
        startedAt: s.startedAt?.toMillis?.() ?? 0,
      });
    });
  }, [friendUid]);

  const handleRemove = () => {
    Alert.alert('Удалить из друзей?', friend?.name ?? '', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeFriend(friendUid);
            navigation.goBack();
          } catch (e: any) {
            Alert.alert('Ошибка', e?.message ?? 'Не удалось удалить');
          }
        },
      },
    ]);
  };

  // ─── Переход на карту с фокусом на заведении друга ───
  const handleShowOnMap = () => {
    if (!active) return;
    // FriendDetail лежит в FriendsStack, который sibling к MainStack в Drawer.
    // Поднимаемся до Drawer через getParent и навигируем в MainStack > Map.
    const drawerNav = navigation.getParent();
    drawerNav?.navigate('MainStack', {
      screen: 'Map',
      params: { focusPlaceId: active.placeId },
    });
  };

  if (loading || !friend) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {friend.avatarUrl ? (
        <Image source={{ uri: friend.avatarUrl }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarPlaceholder]}>
          <Text style={styles.avatarText}>{(friend.name?.[0] ?? '?').toUpperCase()}</Text>
        </View>
      )}

      <Text style={styles.name}>{friend.name} {friend.surname}</Text>
      {friend.phone ? <Text style={styles.phone}>{friend.phone}</Text> : null}

      <View style={styles.statCard}>
        <Text style={styles.statValue}>{friend.questsCompleted}</Text>
        <Text style={styles.statLabel}>квестов выполнено</Text>
      </View>

      {active ? (
        <View style={styles.activeCard}>
          <Text style={styles.activeTitle}>🟢 Сейчас проходит квест</Text>
          <Text style={styles.activePlace}>{active.placeName}</Text>
          <Text style={styles.activeAddress}>{active.placeAddress}</Text>
          <Text style={styles.activeHint}>
            Начал в{' '}
            {new Date(active.startedAt).toLocaleTimeString('ru-RU', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>

          <TouchableOpacity
            style={styles.showOnMapBtn}
            onPress={handleShowOnMap}
            activeOpacity={0.85}
          >
            <Text style={styles.showOnMapText}>Показать на карте</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[styles.activeCard, styles.activeCardInactive]}>
          <Text style={styles.inactiveText}>Сейчас не проходит квест</Text>
        </View>
      )}

      <TouchableOpacity style={styles.removeButton} onPress={handleRemove}>
        <Text style={styles.removeButtonText}>Удалить из друзей</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', padding: 24, gap: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  avatarPlaceholder: {
    backgroundColor: '#ddd', alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 32, fontWeight: '700', color: '#555' },
  name: { fontSize: 20, fontWeight: '700', marginTop: 8 },
  phone: { color: '#666' },
  statCard: {
    marginTop: 8, backgroundColor: '#f5f5f5', borderRadius: 12,
    padding: 16, alignItems: 'center', width: '100%',
  },
  statValue: { fontSize: 28, fontWeight: '800', color: '#27ae60' },
  statLabel: { color: '#666', marginTop: 4 },

  activeCard: {
    marginTop: 12, backgroundColor: '#e8f5e9', borderRadius: 12,
    padding: 16, width: '100%',
  },
  activeCardInactive: {
    backgroundColor: '#f0f0f0', alignItems: 'center', paddingVertical: 20,
  },
  inactiveText: { color: '#888', fontWeight: '600' },
  activeTitle: { fontWeight: '700', color: '#27ae60' },
  activePlace: { fontSize: 16, fontWeight: '600', marginTop: 6 },
  activeAddress: { color: '#666', fontSize: 13, marginTop: 2 },
  activeHint: { color: '#888', fontSize: 12, marginTop: 6 },

  showOnMapBtn: {
    marginTop: 12, backgroundColor: '#2ecc71', borderRadius: 8,
    paddingVertical: 12, alignItems: 'center',
  },
  showOnMapText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  removeButton: { marginTop: 24, paddingVertical: 12, paddingHorizontal: 24 },
  removeButtonText: { color: '#e74c3c', fontWeight: '600' },
});