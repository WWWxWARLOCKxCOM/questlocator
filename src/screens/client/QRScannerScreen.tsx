import React, { useCallback, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, Pressable, TextInput,
  Modal, Linking,
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useCodeScanner,
} from 'react-native-vision-camera';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { ClientStackParamList } from '@/navigation/ClientNavigator';
import { getCurrentPosition } from '@/services/locationService';
import { startSessionFromQr } from '@/services/sessionService';

type Nav = NativeStackNavigationProp<ClientStackParamList>;
type Rt = RouteProp<ClientStackParamList, 'QRScanner'>;

const ERROR_MESSAGES: Record<string, string> = {
  TOO_FAR: 'Вы находитесь слишком далеко от заведения. Подойдите ближе.',
  QUEST_INACTIVE: 'Квест временно недоступен.',
  PLACE_NOT_FOUND: 'Заведение не найдено.',
  ALREADY_ACTIVE: 'У вас уже есть активная сессия.',
  ALREADY_COMPLETED_TODAY: 'Вы уже проходили этот квест сегодня. Возвращайтесь позже.',
};

export default function QRScannerScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [lastDetected, setLastDetected] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualValue, setManualValue] = useState('');

  const lastHandledRef = useRef<string | null>(null);
  const isProcessingRef = useRef(false);

  const handleScannedCode = useCallback(
    async (payload: string) => {
      if (isProcessingRef.current) return;
      if (lastHandledRef.current === payload) return;

      lastHandledRef.current = payload;
      isProcessingRef.current = true;
      setIsProcessing(true);
      setError(null);

      setTimeout(() => {
        if (lastHandledRef.current === payload) {
          lastHandledRef.current = null;
        }
      }, 10_000);

      try {
        const userLocation = await getCurrentPosition();
        const result = await startSessionFromQr({ qrPayload: payload, userLocation });

        if (result.ok && result.sessionId) {
          navigation.replace('ActiveSession', {
            sessionId: result.sessionId,
            placeLatitude: route.params.placeLatitude,
            placeLongitude: route.params.placeLongitude,
          });
          return;
        }

        setError(
          (result.errorCode && ERROR_MESSAGES[result.errorCode]) ||
            result.message ||
            'Не удалось начать сессию.',
        );
      } catch (e: any) {
        const code = e?.code ?? '';
        const msg = e?.message ?? '';
        // eslint-disable-next-line no-console
        console.log(
          '[QRScanner] ERROR:',
          JSON.stringify({ code, msg, full: String(e) }),
        );

        if (msg.includes('эмуляция') || msg.includes('GPS')) {
          setError(msg);
        } else if (msg.includes('геолокац')) {
          setError('Разрешите доступ к геолокации в настройках телефона.');
        } else if (code === 'functions/unauthenticated') {
          setError('Вы не авторизованы. Войдите заново.');
        } else if (code === 'functions/not-found') {
          setError('Функция на сервере не найдена. Переустановите приложение.');
        } else if (code === 'functions/unavailable') {
          setError('Нет связи с сервером Firebase. Возможно, нужен VPN.');
        } else if (code === 'functions/internal') {
          setError(`Ошибка сервера: ${msg}`);
        } else if (code === 'functions/permission-denied') {
          setError(`Доступ запрещён: ${msg}`);
        } else if (code === 'functions/failed-precondition') {
          setError(`Условие не выполнено: ${msg}`);
        } else if (code === 'functions/deadline-exceeded') {
          setError('Сервер долго не отвечает. Попробуйте ещё раз.');
        } else if (code === 'functions/cancelled') {
          setError('Запрос отменён. Попробуйте ещё раз.');
        } else if (code) {
          setError(`Ошибка [${code}]: ${msg || 'без деталей'}`);
        } else {
          setError(`Ошибка: ${msg || 'без деталей'}`);
        }
      } finally {
        isProcessingRef.current = false;
        setIsProcessing(false);
      }
    },
    [navigation, route.params],
  );

  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: (codes) => {
      if (codes.length === 0) return;
      const value = codes[0]?.value;
      if (!value) return;
      setLastDetected(value);
      handleScannedCode(value);
    },
  });

  const handleManualSubmit = () => {
    const v = manualValue.trim();
    if (!v) return;
    setManualOpen(false);
    setManualValue('');
    handleScannedCode(v);
  };

  const handleOpenSettings = () => {
    Linking.openSettings().catch(() => {});
  };

  if (!hasPermission) {
    return (
      <View style={styles.center}>
        <Text style={styles.permText}>
          Для сканирования QR-кода нужно разрешение на камеру
        </Text>
        <Pressable style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Разрешить доступ</Text>
        </Pressable>
        <Pressable onPress={handleOpenSettings} style={{ marginTop: 16 }}>
          <Text style={styles.settingsLink}>Открыть настройки приложения</Text>
        </Pressable>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.center}>
        <Text>Камера недоступна.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        codeScanner={codeScanner}
        torch={torchOn ? 'on' : 'off'}
      />

      <View style={styles.overlay} pointerEvents="box-none">
        <View style={styles.frame} />
        <Text style={styles.hint}>Наведите камеру на QR-код заведения</Text>
        <Text style={styles.subHint}>
          Держите на расстоянии 15–25 см, QR полностью в рамке
        </Text>

        {isProcessing && (
          <ActivityIndicator color="#fff" style={{ marginTop: 16 }} />
        )}

        {lastDetected && !isProcessing && (
          <View style={styles.detectedBox}>
            <Text style={styles.detectedLabel}>Распознано:</Text>
            <Text style={styles.detectedText} numberOfLines={1}>
              {lastDetected}
            </Text>
          </View>
        )}

        {error && <Text style={styles.error}>{error}</Text>}
      </View>

      <View style={styles.bottomBar}>
        <Pressable
          style={[styles.iconBtn, torchOn && styles.iconBtnActive]}
          onPress={() => setTorchOn((v) => !v)}
        >
          <Ionicons
            name={torchOn ? 'flashlight' : 'flashlight-outline'}
            size={22}
            color={torchOn ? '#000' : '#fff'}
          />
          <Text style={[styles.iconBtnText, torchOn && { color: '#000' }]}>
            {torchOn ? 'Свет вкл' : 'Свет'}
          </Text>
        </Pressable>

        <Pressable style={styles.iconBtn} onPress={() => setManualOpen(true)}>
          <Ionicons name="keypad-outline" size={22} color="#fff" />
          <Text style={styles.iconBtnText}>Ввести код</Text>
        </Pressable>
      </View>

      <Modal
        visible={manualOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setManualOpen(false)}
      >
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Введите код вручную</Text>
            <Text style={styles.modalHint}>
              Скопируйте строку вида quest://place/xxxxx из кабинета заведения
              и вставьте сюда
            </Text>
            <TextInput
              style={styles.modalInput}
              value={manualValue}
              onChangeText={setManualValue}
              placeholder="quest://place/..."
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, styles.modalCancel]}
                onPress={() => setManualOpen(false)}
              >
                <Text>Отмена</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, styles.modalOk]}
                onPress={handleManualSubmit}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>Продолжить</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
  },
  frame: {
    width: 260, height: 260, borderWidth: 3,
    borderColor: '#fff', borderRadius: 20, backgroundColor: 'transparent',
  },
  hint: { color: '#fff', marginTop: 20, fontSize: 16, fontWeight: '600' },
  subHint: {
    color: '#ddd', marginTop: 8, fontSize: 13,
    textAlign: 'center', paddingHorizontal: 32,
  },
  error: {
    color: '#ff6b6b', marginTop: 16, textAlign: 'center',
    paddingHorizontal: 24, fontWeight: '600',
  },
  detectedBox: {
    marginTop: 12, backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 8, padding: 10, maxWidth: '80%',
  },
  detectedLabel: { color: '#9be29b', fontSize: 11, fontWeight: '700' },
  detectedText: { color: '#fff', fontSize: 12, marginTop: 2 },

  bottomBar: {
    position: 'absolute', bottom: 32, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', gap: 16,
  },
  iconBtn: {
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 12,
    paddingVertical: 10, paddingHorizontal: 16,
    alignItems: 'center', flexDirection: 'row', gap: 8,
  },
  iconBtnActive: { backgroundColor: '#f1c40f' },
  iconBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },

  permText: { fontSize: 16, textAlign: 'center', marginBottom: 16 },
  permBtn: {
    backgroundColor: '#2ecc71', borderRadius: 8,
    paddingVertical: 12, paddingHorizontal: 24,
  },
  permBtnText: { color: '#fff', fontWeight: '700' },
  settingsLink: { color: '#2f6fed', fontWeight: '600' },

  modalBg: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16,
    padding: 20, width: '100%',
  },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalHint: { color: '#666', fontSize: 12, marginTop: 6, marginBottom: 12 },
  modalInput: {
    borderWidth: 1, borderColor: '#ccc', borderRadius: 8,
    padding: 12, fontSize: 14,
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  modalBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center',
  },
  modalCancel: { backgroundColor: '#eee' },
  modalOk: { backgroundColor: '#2ecc71' },
});