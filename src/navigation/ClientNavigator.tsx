import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MapScreen from '@/screens/client/MapScreen';
import QRScannerScreen from '@/screens/client/QRScannerScreen';
import ActiveSessionScreen from '@/screens/client/ActiveSessionScreen';
import ProfileScreen from '@/screens/client/ProfileScreen';
import HistoryScreen from '@/screens/client/HistoryScreen';
import PromoCodesScreen from '@/screens/client/PromoCodesScreen';
import SettingsScreen from '@/screens/client/SettingsScreen';

export type ClientStackParamList = {
  Map: undefined;
  QRScanner: { placeId: string; questId: string; placeLatitude: number; placeLongitude: number };
  ActiveSession: { sessionId: string; placeLatitude: number; placeLongitude: number };
};

export type ClientDrawerParamList = {
  MainStack: undefined;
  Profile: undefined;
  History: undefined;
  PromoCodes: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<ClientStackParamList>();
const Drawer = createDrawerNavigator<ClientDrawerParamList>();

/** Стек "Карта -> QR-сканер -> Активная сессия" — основной пользовательский путь. */
function MainStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Map" component={MapScreen} />
      <Stack.Screen name="QRScanner" component={QRScannerScreen} options={{ presentation: 'fullScreenModal' }} />
      <Stack.Screen name="ActiveSession" component={ActiveSessionScreen} />
    </Stack.Navigator>
  );
}

/** Боковое меню (Drawer), см. ТЗ п.3.4: аватар/баланс/история/промокоды/настройки. */
export default function ClientNavigator() {
  return (
    <Drawer.Navigator screenOptions={{ headerShown: true }}>
      <Drawer.Screen name="MainStack" component={MainStack} options={{ title: 'Карта', headerShown: false }} />
      <Drawer.Screen name="Profile" component={ProfileScreen} options={{ title: 'Профиль' }} />
      <Drawer.Screen name="History" component={HistoryScreen} options={{ title: 'История' }} />
      <Drawer.Screen name="PromoCodes" component={PromoCodesScreen} options={{ title: 'Мои промокоды' }} />
      <Drawer.Screen name="Settings" component={SettingsScreen} options={{ title: 'Настройки' }} />
    </Drawer.Navigator>
  );
}
