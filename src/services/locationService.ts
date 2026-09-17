/**
 * Обёртка над expo-location.
 * Для MVP фоновая геозона упрощена до периодического опроса позиции
 * (работает, пока приложение открыто).
 */
import * as Location from 'expo-location';
import { GeoPoint } from '@/types';
import { distanceInMeters } from '@/utils/distance';

const RADIUS_M = 50;

export async function getCurrentPosition(): Promise<GeoPoint> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Доступ к геолокации отклонён');
  }
  const loc = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });
  return { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
}

export async function startSessionTracking(params: {
  sessionId: string;
  center: GeoPoint;
  radiusMeters?: number;
  onEnter: () => void;
  onExit: () => void;
}): Promise<() => void> {
  const radius = params.radiusMeters ?? RADIUS_M;
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
      // игнорируем временные сбои GPS
    }
  }, 30_000);

  return () => clearInterval(id);
}