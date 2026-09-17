import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Camera, useCameraDevice, useCodeScanner } from 'react-native-vision-camera';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
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
};

/**
 * Безопасность (см. ТЗ п.3.2): QR-код нельзя использовать удалённо —
 * координаты пользователя проверяются на сервере при каждом запуске сессии,
 * а не доверяются клиентскому "я рядом".
 */
export default function QRScannerScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const device = useCameraDevice('back');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleScannedCode = useCallback(
    async (payload: string) => {
      if (isProcessing) return;
      setIsProcessing(true);
      setError(null);
      try {
        const userLocation = await getCurrentPosition();
        const result = await startSessionFromQr({ qrPayload: payload, userLocation });
        if (result.ok && result.sessionId) {
          navigation.replace('ActiveSession', {
            sessionId: result.sessionId,
            placeLatitude: route.params.placeLatitude,
            placeLongitude: route.params.placeLongitude,
          });
        } else {
          setError(
            (result.errorCode && ERROR_MESSAGES[result.errorCode]) ||
              result.message ||
              'Не удалось начать сессию.',
          );
          setIsProcessing(false);
        }
      } catch (e) {
        setError('Ошибка сети. Попробуйте ещё раз.');
        setIsProcessing(false);
      }
    },
    [isProcessing, navigation, route.params],
  );

  // Встроенный сканер кодов из react-native-vision-camera v4
  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: (codes) => {
      const value = codes[0]?.value;
      if (value) handleScannedCode(value);
    },
  });

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
      />

      <View style={styles.overlay}>
        <View style={styles.frame} />
        <Text style={styles.hint}>Наведите камеру на QR-код заведения</Text>
        {isProcessing && <ActivityIndicator color="#fff" style={{ marginTop: 16 }} />}
        {error && <Text style={styles.error}>{error}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    width: 240,
    height: 240,
    borderWidth: 2,
    borderColor: '#fff',
    borderRadius: 16,
  },
  hint: { color: '#fff', marginTop: 16, fontSize: 16 },
  error: { color: '#ff6b6b', marginTop: 16, textAlign: 'center', paddingHorizontal: 24 },
});