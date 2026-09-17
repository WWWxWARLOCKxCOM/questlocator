import 'dotenv/config';
import { ExpoConfig, ConfigContext } from 'expo/config';

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
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
    },
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        'Приложению нужен доступ к геолокации, чтобы подтвердить ваше присутствие в заведении.',
      NSLocationAlwaysAndWhenInUseUsageDescription:
        'Фоновая геолокация нужна, чтобы таймер квеста продолжал работать, пока приложение свёрнуто.',
      NSCameraUsageDescription:
        'Камера нужна для сканирования QR-кода заведения и фото-бонусов.',
      UIBackgroundModes: ['location', 'fetch', 'remote-notification'],
    },
  },
  android: {
    package: 'com.questlocator.app',
    googleServicesFile: './google-services.json',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
    config: {
      googleMaps: {
        apiKey: process.env.GOOGLE_MAPS_API_KEY,
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
    FIREBASE_API_KEY: process.env.FIREBASE_API_KEY,
    FIREBASE_AUTH_DOMAIN: process.env.FIREBASE_AUTH_DOMAIN,
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
    FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET,
    FIREBASE_MESSAGING_SENDER_ID: process.env.FIREBASE_MESSAGING_SENDER_ID,
    FIREBASE_APP_ID: process.env.FIREBASE_APP_ID,
    GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY,
  },
});