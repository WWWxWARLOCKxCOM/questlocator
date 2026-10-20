/**
 * Запрос всех разрешений приложения при первом запуске + сохранение выбора темы.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'react-native-vision-camera';

const PERMISSIONS_KEY = '@questlocator/permissions_requested_v1';
const THEME_KEY = '@questlocator/theme_chosen_v1';

// ─── Разрешения ───
export async function hasAskedPermissions(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(PERMISSIONS_KEY);
    return v === 'true';
  } catch {
    return false;
  }
}

export async function markPermissionsAsked(): Promise<void> {
  try {
    await AsyncStorage.setItem(PERMISSIONS_KEY, 'true');
  } catch {
    // ignore
  }
}

// ─── Выбор темы ───
export async function hasChosenTheme(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(THEME_KEY);
    return v === 'true';
  } catch {
    return false;
  }
}

export async function markThemeChosen(): Promise<void> {
  try {
    await AsyncStorage.setItem(THEME_KEY, 'true');
  } catch {
    // ignore
  }
}

export interface PermissionResult {
  camera: boolean;
  location: boolean;
  gallery: boolean;
  notifications: boolean;
}

/**
 * Последовательно запрашивает все разрешения. Возвращает итоговые статусы.
 * Каждый запрос в try/catch — если один упадёт, остальные всё равно спросим.
 */
export async function requestAllPermissions(): Promise<PermissionResult> {
  const result: PermissionResult = {
    camera: false,
    location: false,
    gallery: false,
    notifications: false,
  };

  // 1. Камера (QR-сканер + фото)
  try {
    const status = await Camera.requestCameraPermission();
    result.camera = status === 'granted';
  } catch (e) {
    console.warn('[permissions] camera failed:', e);
  }

  // 2. Геолокация (передний план — для проверки в заведении)
  try {
    const loc = await Location.requestForegroundPermissionsAsync();
    result.location = loc.status === 'granted';
  } catch (e) {
    console.warn('[permissions] location failed:', e);
  }

  // 3. Галерея (для выбора фото профиля / заведения)
  try {
    const gal = await ImagePicker.requestMediaLibraryPermissionsAsync();
    result.gallery = gal.granted === true;
  } catch (e) {
    console.warn('[permissions] gallery failed:', e);
  }

  // 4. Уведомления (анти-фрод, напоминания)
  try {
    const notif = await Notifications.requestPermissionsAsync();
    result.notifications = notif.status === 'granted';
  } catch (e) {
    console.warn('[permissions] notifications failed:', e);
  }

  return result;
}