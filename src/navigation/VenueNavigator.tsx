import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { createDrawerNavigator, DrawerContentScrollView, DrawerItemList, DrawerContentComponentProps } from '@react-navigation/drawer';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
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
import { signOut } from '@/services/authService';

export type VenueStackParamList = {
  VenueMap: { focusPlaceId?: string } | undefined;
  VenueAddPlace: { latitude: number; longitude: number };
  VenueEditPlace: { placeId: string };
  VenueCreateCoupon: undefined;
  VenueCouponScanner: undefined;
  VenueCouponHistory: undefined;
};

export type VenueDrawerParamList = {
  VenueMainStack: undefined;
  VenuePlaces: undefined;
  VenueShop: undefined;
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
    </Stack.Navigator>
  );
}

function CustomDrawerContent(props: DrawerContentComponentProps) {
  return (
    <DrawerContentScrollView {...props}>
      <DrawerItemList {...props} />
      <View style={styles.logoutBlock}>
        <TouchableOpacity style={styles.logoutButton} onPress={async () => { props.navigation.closeDrawer(); await signOut(); }}>
          <Text style={styles.logoutText}>Выйти</Text>
        </TouchableOpacity>
      </View>
    </DrawerContentScrollView>
  );
}

export default function VenueNavigator() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{ headerShown: true, swipeEnabled: false }}
    >
      <Drawer.Screen name="VenueMainStack" component={VenueMainStack} options={{ title: 'Карта', headerShown: false }} />
      <Drawer.Screen name="VenuePlaces" component={VenuePlacesScreen} options={{ title: 'Управление точками' }} />
      <Drawer.Screen name="VenueShop" component={VenueShopScreen} options={{ title: 'Магазин купонов' }} />
      <Drawer.Screen name="VenueScanner" component={VenueCouponScannerScreen} options={{ title: 'Сканировать купон' }} />
      <Drawer.Screen name="VenueHistory" component={VenueCouponHistoryScreen} options={{ title: 'Погашенные купоны' }} />
      <Drawer.Screen name="VenueQR" component={VenueQRScreen} options={{ title: 'QR-коды' }} />
      <Drawer.Screen name="VenueModeration" component={VenueModerationScreen} options={{ title: 'Модерация фото' }} />
      <Drawer.Screen name="VenueProfile" component={VenueProfileScreen} options={{ title: 'Профиль компании' }} />
    </Drawer.Navigator>
  );
}

const styles = StyleSheet.create({
  logoutBlock: { marginTop: 24, paddingTop: 16, paddingHorizontal: 20, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#ddd' },
  logoutButton: { paddingVertical: 12 },
  logoutText: { color: '#e74c3c', fontWeight: '600', fontSize: 16 },
});