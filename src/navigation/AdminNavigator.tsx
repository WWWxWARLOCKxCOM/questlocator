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
import AdminDashboardScreen from '@/screens/admin/AdminDashboardScreen';
import PlacesManagementScreen from '@/screens/admin/PlacesManagementScreen';
import QuestsManagementScreen from '@/screens/admin/QuestsManagementScreen';
import QRGeneratorScreen from '@/screens/admin/QRGeneratorScreen';
import PhotoModerationScreen from '@/screens/admin/PhotoModerationScreen';
import { signOut } from '@/services/authService';

export type AdminStackParamList = {
  AdminMap: undefined;
  AdminPlaceForm: { latitude: number; longitude: number };
};

export type AdminDrawerParamList = {
  MainStack: undefined;
  Stats: undefined;
  Places: undefined;
  Quests: undefined;
  QRCodes: undefined;
  Moderation: undefined;
};

const Stack = createNativeStackNavigator<AdminStackParamList>();
const Drawer = createDrawerNavigator<AdminDrawerParamList>();

function AdminMainStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AdminMap" component={AdminMapScreen} />
      <Stack.Screen name="AdminPlaceForm" component={AdminPlaceFormScreen} />
    </Stack.Navigator>
  );
}

function CustomDrawerContent(props: DrawerContentComponentProps) {
  return (
    <DrawerContentScrollView {...props}>
      <DrawerItemList {...props} />
      <View style={styles.logoutBlock}>
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={async () => {
            props.navigation.closeDrawer();
            await signOut();
          }}
        >
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
      screenOptions={{
        headerShown: true,
        swipeEnabled: false,
      }}
    >
      <Drawer.Screen
        name="MainStack"
        component={AdminMainStack}
        options={{ title: 'Карта', headerShown: false }}
      />
      <Drawer.Screen name="Stats" component={AdminDashboardScreen} options={{ title: 'Статистика' }} />
      <Drawer.Screen name="Places" component={PlacesManagementScreen} options={{ title: 'Заведения' }} />
      <Drawer.Screen name="Quests" component={QuestsManagementScreen} options={{ title: 'Квесты' }} />
      <Drawer.Screen name="QRCodes" component={QRGeneratorScreen} options={{ title: 'QR-коды' }} />
      <Drawer.Screen name="Moderation" component={PhotoModerationScreen} options={{ title: 'Модерация' }} />
    </Drawer.Navigator>
  );
}

const styles = StyleSheet.create({
  logoutBlock: {
    marginTop: 24,
    paddingTop: 16,
    paddingHorizontal: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ddd',
  },
  logoutButton: { paddingVertical: 12 },
  logoutText: { color: '#e74c3c', fontWeight: '600', fontSize: 16 },
});