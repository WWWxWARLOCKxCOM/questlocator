import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TouchableOpacity, View } from 'react-native';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';

import VenueMapScreen from '@/screens/venue/VenueMapScreen';
import VenueAddPlaceScreen from '@/screens/venue/VenueAddPlaceScreen';
import VenueEditPlaceScreen from '@/screens/venue/VenueEditPlaceScreen';
import VenueQRScreen from '@/screens/venue/VenueQRScreen';
import VenueModerationScreen from '@/screens/venue/VenueModerationScreen';
import VenueProfileScreen from '@/screens/venue/VenueProfileScreen';
import VenuePlacesScreen from '@/screens/venue/VenuePlacesScreen';
import VenueShopScreen from '@/screens/venue/VenueShopScreen';
import VenueCreateCouponScreen from '@/screens/venue/VenueCreateCouponScreen';
import VenueCouponScannerScreen from '@/screens/venue/VenueCouponScannerScreen';
import VenueCouponHistoryScreen from '@/screens/venue/VenueCouponHistoryScreen';
import VenueFinanceScreen from '@/screens/venue/VenueFinanceScreen';
import VenueEventsScreen from '@/screens/venue/VenueEventsScreen'; 
import VenueCreateEventScreen from '@/screens/venue/VenueCreateEventScreen'; 
import CustomVenueDrawer from './CustomVenueDrawer';

export type VenueStackParamList = {
  VenueMap: { focusPlaceId?: string } | undefined;
  VenueAddPlace: { latitude: number; longitude: number; address?: string };
  VenueEditPlace: { placeId: string };
  VenueCreateCoupon: undefined;
  VenueCouponScanner: undefined;
  VenueCouponHistory: undefined;
  VenueCreateEvent: undefined; 
};

export type VenueDrawerParamList = {
  VenueMainStack: undefined;
  VenuePlaces: undefined;
  VenueShop: undefined;
  VenueEvents: undefined; 
  VenueFinance: undefined;
  VenueScanner: undefined;
  VenueHistory: undefined;
  VenueQR: undefined;
  VenueModeration: undefined;
  VenueProfile: undefined;
};

const Stack = createNativeStackNavigator<VenueStackParamList>();
const Drawer = createDrawerNavigator<VenueDrawerParamList>();

function VenueMainStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="VenueMap" component={VenueMapScreen} />
      <Stack.Screen name="VenueAddPlace" component={VenueAddPlaceScreen} options={{ title: 'Новая точка', headerShown: true }} />
      <Stack.Screen name="VenueEditPlace" component={VenueEditPlaceScreen} options={{ title: 'Редактировать точку', headerShown: true }} />
      <Stack.Screen name="VenueCreateCoupon" component={VenueCreateCouponScreen} options={{ title: 'Новый купон', headerShown: true }} />
      <Stack.Screen name="VenueCouponScanner" component={VenueCouponScannerScreen} options={{ title: 'Сканер купонов', headerShown: true }} />
      <Stack.Screen name="VenueCreateEvent" component={VenueCreateEventScreen} options={{ title: 'Новое мероприятие', headerShown: true }} /> 
    </Stack.Navigator>
  );
}

function VenueHeader() {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <TouchableOpacity onPress={() => navigation.dispatch(DrawerActions.openDrawer())} style={{ padding: 8 }}>
        <Ionicons name="menu" size={26} color={colors.text} />
      </TouchableOpacity>
    </View>
  );
}

export default function VenueNavigator() {
  const { colors } = useTheme();

  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomVenueDrawer {...props} />}
      screenOptions={{
        headerShown: true,
        swipeEnabled: false,
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
      }}
    >
      <Drawer.Screen name="VenueMainStack" component={VenueMainStack} options={{ title: 'Карта', header: () => <VenueHeader /> }} />
      <Drawer.Screen name="VenuePlaces" component={VenuePlacesScreen} options={{ title: 'Управление точками' }} />
      <Drawer.Screen name="VenueShop" component={VenueShopScreen} options={{ title: 'Купоны и промокоды' }} />
      <Drawer.Screen name="VenueEvents" component={VenueEventsScreen} options={{ title: 'Мероприятия' }} /> 
      <Drawer.Screen name="VenueFinance" component={VenueFinanceScreen} options={{ title: 'Финансы' }} />
      <Drawer.Screen name="VenueScanner" component={VenueCouponScannerScreen} options={{ title: 'Сканировать купон' }} />
      <Drawer.Screen name="VenueHistory" component={VenueCouponHistoryScreen} options={{ title: 'Погашенные купоны' }} />
      <Drawer.Screen name="VenueQR" component={VenueQRScreen} options={{ title: 'QR-коды' }} />
      <Drawer.Screen name="VenueModeration" component={VenueModerationScreen} options={{ title: 'Модерация фото' }} />
      <Drawer.Screen name="VenueProfile" component={VenueProfileScreen} options={{ title: 'Профиль компании' }} />
    </Drawer.Navigator>
  );
}