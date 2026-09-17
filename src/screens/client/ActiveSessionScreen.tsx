import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ref as storageRef, uploadBytes } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { ClientStackParamList } from '@/navigation/ClientNavigator';
import {
  subscribeToSession,
  endSession,
  pauseSession,
  resumeSession,
  forceEndSessionForInactivity,
} from '@/services/sessionService';
import { startSessionTracking } from '@/services/locationService';
import { AntiFraudMonitor } from '@/services/antiFraudService';
import { QuestSession } from '@/types';
import { storage, functions } from '@/config/firebase';
import { useAuth } from '@/context/AuthContext';

type Nav = NativeStackNavigationProp<ClientStackParamList>;
type Rt = RouteProp<ClientStackParamList, 'ActiveSession'>;

function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours} ч ${minutes} мин` : `${minutes} мин`;
}

export default function ActiveSessionScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { sessionId, placeLatitude, placeLongitude } = route.params;

  const { user } = useAuth();
  const [session, setSession] = useState<QuestSession | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [nowTick, setNowTick] = useState(Date.now());
  const antiFraudRef = useRef<AntiFraudMonitor | null>(null);

  // Подписка на состояние сессии через Firestore onSnapshot
  useEffect(() => {
    const unsub = subscribeToSession(sessionId, setSession);
    return () => unsub();
  }, [sessionId]);

  // Тик раз в секунду для локального обновления прогресс-бара
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Геозона: пауза/резюм при выходе/входе, + фоновый трекинг
  useEffect(() => {
    let cleanup: (() => void) | undefined;

    (async () => {
      const placeCenter = { latitude: placeLatitude, longitude: placeLongitude };
      cleanup = await startSessionTracking({
        sessionId,
        center: placeCenter,
        onEnter: async () => {
          setIsPaused(false);
          await resumeSession(sessionId);
        },
        onExit: async () => {
          setIsPaused(true);
          await pauseSession(sessionId);
        },
      });
    })();

    return () => {
      cleanup?.();
    };
  }, [placeLatitude, placeLongitude, sessionId]);

  // Анти-фрод монитор (акселерометр)
  useEffect(() => {
    const monitor = new AntiFraudMonitor(
      () => {
        Alert.alert(
          'Вы всё ещё здесь?',
          'Нажмите «Я здесь», иначе сессия завершится через 5 минут.',
        );
      },
      async () => {
        const result = await forceEndSessionForInactivity(sessionId);
        Alert.alert('Сессия завершена', `Начислено ${result.pointsEarned} баллов.`);
        navigation.popToTop();
      },
    );
    antiFraudRef.current = monitor;
    monitor.start();
    return () => monitor.stop();
  }, [sessionId, navigation]);

  const handleConfirmPresence = () => antiFraudRef.current?.confirmPresence();

  const elapsedMs = session
    ? nowTick - session.startedAt - (session.accumulatedPausedMs ?? 0)
    : 0;

  const handleTakePhoto = async () => {
    if (!user) return;
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchCameraAsync({ quality: 0.5 });
    if (result.canceled) return;

    try {
      const localUri = result.assets[0].uri;
      const response = await fetch(localUri);
      const blob = await response.blob();

      // Путь: session-photos/{userId}/{sessionId}/{timestamp}.jpg
      // Совпадает со storage.rules (см. storage.rules)
      const path = `session-photos/${user.uid}/${sessionId}/${Date.now()}.jpg`;
      const fileRef = storageRef(storage, path);

      await uploadBytes(fileRef, blob, { contentType: 'image/jpeg' });

      // Регистрируем фото на сервере — создаётся документ photos/{id}
      // со статусом 'pending' и, при одобрении, триггер начислит бонус.
      const fn = httpsCallable(functions, 'submitSessionPhoto');
      await fn({ sessionId, storagePath: path });

      Alert.alert('Готово', 'Фото отправлено на модерацию.');
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось загрузить фото.');
    }
  };

  const handleFinish = async () => {
    const result = await endSession(sessionId);
    Alert.alert(
      'Сессия завершена',
      `Заработано: ${result.pointsEarned} баллов.${
        result.promocode ? `\nПромокод: ${result.promocode}` : ''
      }`,
    );
    navigation.popToTop();
  };

  if (!session) {
    return (
      <View style={styles.center}>
        <Text>Загрузка сессии...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Активная сессия</Text>

      <View style={styles.progressCircle}>
        <Text style={styles.progressText}>{formatDuration(elapsedMs)}</Text>
        {isPaused && (
          <Text style={styles.pausedLabel}>
            На паузе — вернитесь в зону заведения
          </Text>
        )}
      </View>

      <Text style={styles.earnings}>
        Заработано: {session.pointsEarned} баллов
      </Text>

      <Pressable style={styles.secondaryButton} onPress={handleConfirmPresence}>
        <Text style={styles.secondaryButtonText}>Я здесь</Text>
      </Pressable>

      <Pressable style={styles.secondaryButton} onPress={handleTakePhoto}>
        <Text style={styles.secondaryButtonText}>Сделать фото для бонуса</Text>
      </Pressable>

      <Pressable style={styles.primaryButton} onPress={handleFinish}>
        <Text style={styles.primaryButtonText}>Завершить сессию</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    gap: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '700' },
  progressCircle: {
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 8,
    borderColor: '#2ecc71',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressText: { fontSize: 28, fontWeight: '700' },
  pausedLabel: {
    color: '#e67e22',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 16,
  },
  earnings: { fontSize: 18 },
  primaryButton: {
    backgroundColor: '#e74c3c',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  primaryButtonText: { color: '#fff', fontWeight: '700' },
  secondaryButton: {
    backgroundColor: '#ecf0f1',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  secondaryButtonText: { color: '#2c3e50', fontWeight: '600' },
});