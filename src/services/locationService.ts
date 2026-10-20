/**
 * Обёртка над expo-location.
 * Отвечает за:
 *  - получение текущей позиции (для проверки при сканировании QR);
 *  - отслеживание нахождения внутри зоны заведения (геозона 30 сек);
 *  - защиту от mock location.
 */
import * as Location from 'expo-location';
import { GeoPoint } from '@/types';
import { distanceInMeters } from '@/utils/distance';

const DEFAULT_RADIUS_M = 50;

export async function getCurrentPosition(): Promise<GeoPoint> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') throw new Error('Доступ к геолокации отклонён');

  const loc = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });

  if ((loc as any).mocked === true) {
    throw new Error('Обнаружена эмуляция GPS. Отключите fake-GPS приложение.');
  }

  return { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
}

interface TrackingParams {
  sessionId: string;
  center: GeoPoint;
  radiusMeters?: number;
  onEnter: () => void;
  onExit: () => void;
}

/**
 * Периодически проверяет, находится ли пользователь внутри зоны заведения.
 * Работает, пока приложение открыто (для фонового трекинга нужна платная
 * лицензия Transistorsoft — не используется в MVP).
 */
export async function startSessionTracking(params: TrackingParams): Promise<() => void> {
  const radius = params.radiusMeters ?? DEFAULT_RADIUS_M;
  let inside = true;

  const id = setInterval(async () => {
    try {
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const dist = distanceInMeters(
        { latitude: pos.coords.latitude, longitude: pos.coords.longitude },
        params.center,
      );
      const nowInside = dist <= radius;
      if (nowInside && !inside) {
        inside = true;
        params.onEnter();
      } else if (!nowInside && inside) {
        inside = false;
        params.onExit();
      }
    } catch {
      // временные сбои GPS — игнорируем
    }
  }, 30_000);

  return () => clearInterval(id);
}