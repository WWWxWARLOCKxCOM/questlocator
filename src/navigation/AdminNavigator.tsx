import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  DrawerItemList,
  DrawerContentComponentProps,
} from '@react-navigation/drawer';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AdminMapScreen from '@/screens/admin/AdminMapScreen';
import AdminPlaceFormScreen from '@/screens/admin/AdminPlaceFormScreen';
import AdminCreateVenueScreen from '@/screens/admin/AdminCreateVenueScreen';
import AdminVenueDetailScreen from '@/screens/admin/AdminVenueDetailScreen';
import AdminDashboardScreen from '@/screens/admin/AdminDashboardScreen';
import AdminUsersScreen from '@/screens/admin/AdminUsersScreen';
import AdminVenuesScreen from '@/screens/admin/AdminVenuesScreen';
import AdminVenueApplicationsScreen from '@/screens/admin/AdminVenueApplicationsScreen'; // <-- НОВЫЙ ИМПОРТ
import PhotoModerationScreen from '@/screens/admin/PhotoModerationScreen';
import AdminShopScreen from '@/screens/admin/AdminShopScreen';
import AdminCreateCouponScreen from '@/screens/admin/AdminCreateCouponScreen';
import { signOut } from '@/services/authService';

export type AdminStackParamList = {
  AdminMap: undefined;
  AdminPlaceForm: { latitude: number; longitude: number };
  AdminCreateVenue: undefined;
  AdminVenueDetail: { venueUid: string | null; venueName: string };
  AdminCreateCoupon: { couponId?: string } | undefined;
};

export type AdminDrawerParamList = {
  MainStack: undefined;
  Stats: undefined;
  Applications: undefined; // <-- НОВЫЙ РОУТ
  Venues: undefined;
  Users: undefined;
  Moderation: undefined;
  Shop: undefined;
};

const Stack = createNativeStackNavigator<AdminStackParamList>();
const Drawer = createDrawerNavigator<AdminDrawerParamList>();

function AdminMainStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AdminMap" component={AdminMapScreen} />
      <Stack.Screen name="AdminPlaceForm" component={AdminPlaceFormScreen} options={{ title: 'Заведение', headerShown: true }} />
      <Stack.Screen name="AdminCreateVenue" component={AdminCreateVenueScreen} options={{ title: 'Новое заведение', headerShown: true }} />
      <Stack.Screen name="AdminVenueDetail" component={AdminVenueDetailScreen} options={({ route }) => ({ title: route.params.venueName || 'Заведение' })} />
      <Stack.Screen name="AdminCreateCoupon" component={AdminCreateCouponScreen} options={({ route }) => ({ title: route.params?.couponId ? 'Редактировать купон' : 'Новый купон', headerShown: true })} />
    </Stack.Navigator>
  );
}

function CustomDrawerContent(props: DrawerContentComponentProps) {
  return (
    <DrawerContentScrollView {...props}>
      <DrawerItemList {...props} />
      <View style={styles.logoutBlock}>
        <TouchableOpacity style={styles.logoutButton} onPress={async () => { props.navigation.closeDrawer(); await signOut(); }}>
          <Text style={styles.logoutText}>Выйти из аккаунта</Text>
        </TouchableOpacity>
      </View>
    </DrawerContentScrollView>
  );
}

export default function AdminNavigator() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{ headerShown: true, swipeEnabled: false }}
    >
      <Drawer.Screen name="MainStack" component={AdminMainStack} options={{ title: 'Карта', headerShown: false }} />
      <Drawer.Screen name="Stats" component={AdminDashboardScreen} options={{ title: 'Статистика' }} />
      <Drawer.Screen name="Applications" component={AdminVenueApplicationsScreen} options={{ title: 'Заявки компаний' }} /> {/* <-- НОВЫЙ ЭКРАН */}
      <Drawer.Screen name="Venues" component={AdminVenuesScreen} options={{ title: 'Заведения' }} />
      <Drawer.Screen name="Users" component={AdminUsersScreen} options={{ title: 'Пользователи' }} />
      <Drawer.Screen name="Moderation" component={PhotoModerationScreen} options={{ title: 'Модерация' }} />
      <Drawer.Screen name="Shop" component={AdminShopScreen} options={{ title: 'Магазин' }} />
    </Drawer.Navigator>
  );
}

const styles = StyleSheet.create({
  logoutBlock: { marginTop: 24, paddingTop: 16, paddingHorizontal: 20, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#ddd' },
  logoutButton: { paddingVertical: 12 },
  logoutText: { color: '#e74c3c', fontWeight: '600', fontSize: 16 },
});