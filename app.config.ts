import 'dotenv/config';
import { ExpoConfig, ConfigContext } from 'expo/config';
import * as fs from 'fs';
import * as path from 'path';

// ─────────── Проверки на этапе сборки ───────────
const mapsKey = process.env.GOOGLE_MAPS_API_KEY;
if (!mapsKey) {
  // eslint-disable-next-line no-console
  console.warn(
    '\n[QuestLocator] ⚠️  GOOGLE_MAPS_API_KEY не задан.\n' +
      'Карта на Android/iOS будет серой.\n' +
      'Проверьте .env в корне проекта и пересоберите:\n' +
      '  npx expo prebuild --clean\n',
  );
}

// google-services.json нужен для нативной интеграции с Firebase
// (карты, push, аналитика). Если файла нет — не валим сборку,
// а просто предупреждаем. Файл можно скачать из Firebase Console
// на вкладке вашего Android-приложения.
const googleServicesPath = path.resolve(__dirname, 'google-services.json');
const hasGoogleServices = fs.existsSync(googleServicesPath);
if (!hasGoogleServices) {
  // eslint-disable-next-line no-console
  console.warn(
    '\n[QuestLocator] ⚠️  google-services.json не найден в корне проекта.\n' +
      'Скачайте его из Firebase Console → Project settings → Your apps → Android.\n' +
      'Положите файл в: ' + googleServicesPath + '\n',
  );
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'QuestLocator',
  slug: 'questlocator',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff',
  },
  scheme: 'questlocator',

  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.questlocator.app',
    config: {
      googleMapsApiKey: mapsKey,
    },
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        'Приложению нужен доступ к геолокации, чтобы подтвердить ваше присутствие в заведении.',
      NSLocationAlwaysAndWhenInUseUsageDescription:
        'Фоновая геолокация нужна, чтобы таймер квеста продолжал работать, пока приложение свёрнуто.',
      NSCameraUsageDescription:
        'Камера нужна для сканирования QR-кода заведения и фото-бонусов.',
      NSPhotoLibraryUsageDescription:
        'Доступ к галерее нужен, чтобы выбрать фото профиля.',
      UIBackgroundModes: ['location', 'fetch', 'remote-notification'],
    },
  },

  android: {
    package: 'com.questlocator.app',
    // Поле добавляется только если файл реально существует,
    // иначе prebuild упадёт ещё до генерации APK.
    ...(hasGoogleServices ? { googleServicesFile: './google-services.json' } : {}),
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
    config: {
      googleMaps: {
        apiKey: mapsKey,
      },
    },
    permissions: [
      'ACCESS_FINE_LOCATION',
      'ACCESS_COARSE_LOCATION',
      'FOREGROUND_SERVICE',
      'CAMERA',
      'POST_NOTIFICATIONS',
    ],
  },

  plugins: [
    [
      'react-native-vision-camera',
      {
        cameraPermissionText:
          'Приложению нужен доступ к камере для сканирования QR-кодов.',
      },
    ],
    [
      'expo-location',
      {
        locationAlwaysAndWhenInUsePermission:
          'Приложению нужен доступ к геолокации, чтобы подтвердить ваше присутствие в заведении.',
      },
    ],
  ],

  extra: {
    // ─────────── Firebase (клиентские ключи, публичные) ───────────
    FIREBASE_API_KEY: process.env.FIREBASE_API_KEY,
    FIREBASE_AUTH_DOMAIN: process.env.FIREBASE_AUTH_DOMAIN,
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
    FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET,
    FIREBASE_MESSAGING_SENDER_ID: process.env.FIREBASE_MESSAGING_SENDER_ID,
    FIREBASE_APP_ID: process.env.FIREBASE_APP_ID,

    // ─────────── Google Maps ───────────
    GOOGLE_MAPS_API_KEY: mapsKey,
  },
});