import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '@/screens/client/HomeScreen';
import MapScreen from '@/screens/client/MapScreen';
import QRScannerScreen from '@/screens/client/QRScannerScreen';
import ActiveSessionScreen from '@/screens/client/ActiveSessionScreen';
import ProfileScreen from '@/screens/client/ProfileScreen';
import HistoryScreen from '@/screens/client/HistoryScreen';
import PromoCodesScreen from '@/screens/client/PromoCodesScreen';
import SettingsScreen from '@/screens/client/SettingsScreen';
import FriendsScreen from '@/screens/client/FriendsScreen';
import FriendDetailScreen from '@/screens/client/FriendDetailScreen';
import LevelsScreen from '@/screens/client/LevelsScreen';
import TaskExecuteScreen from '@/screens/client/TaskExecuteScreen';
import ShopScreen from '@/screens/client/ShopScreen';
import NotificationsScreen from '@/screens/client/NotificationsScreen';
import CustomClientDrawer from '@/navigation/CustomClientDrawer';
import { SessionProvider } from '@/context/SessionContext';
import { QuestTask } from '@/types';
import AppHeader from '@/components/AppHeader';

export type ClientStackParamList = {
  Home: undefined;
  Map: { focusPlaceId?: string } | undefined;
  QRScanner: { placeId: string; questId: string; placeLatitude: number; placeLongitude: number };
  ActiveSession: undefined;
  TaskExecute: { sessionId: string; task: QuestTask };
};

export type FriendsStackParamList = {
  FriendsList: undefined;
  FriendDetail: { friendUid: string };
};

export type ClientDrawerParamList = {
  MainStack: undefined;
  FriendsStack: undefined;
  Levels: undefined;
  Shop: undefined;
  Notifications: undefined;
  Profile: undefined;
  History: undefined;
  PromoCodes: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<ClientStackParamList>();
const FriendsStack = createNativeStackNavigator<FriendsStackParamList>();
const Drawer = createDrawerNavigator<ClientDrawerParamList>();

function MainStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Map" component={MapScreen} />
      <Stack.Screen
        name="QRScanner"
        component={QRScannerScreen}
        options={{ presentation: 'fullScreenModal' }}
      />
      <Stack.Screen name="ActiveSession" component={ActiveSessionScreen} />
      <Stack.Screen
        name="TaskExecute"
        component={TaskExecuteScreen}
        options={{ title: 'Задание', headerShown: true }}
      />
    </Stack.Navigator>
  );
}

function FriendsStackNavigator() {
  return (
    // Скрываем внутреннюю шапку, чтобы использовалась шапка Drawer (AppHeader)
    <FriendsStack.Navigator screenOptions={{ headerShown: false }}>
      <FriendsStack.Screen name="FriendsList" component={FriendsScreen} />
      <FriendsStack.Screen name="FriendDetail" component={FriendDetailScreen} />
    </FriendsStack.Navigator>
  );
}

export default function ClientNavigator() {
  return (
    <SessionProvider>
      <Drawer.Navigator
        drawerContent={(props) => <CustomClientDrawer {...props} />}
        screenOptions={({ navigation }) => ({
          headerShown: true,
          swipeEnabled: false,
          header: () => (
            <AppHeader
              onBell={() => navigation.navigate('Notifications')}
              onProfile={() => navigation.navigate('Profile')}
            />
          ),
        })}
      >
        <Drawer.Screen
          name="MainStack"
          component={MainStackNavigator}
          options={{ title: 'Главная', headerShown: false }}
        />
        <Drawer.Screen
          name="FriendsStack"
          component={FriendsStackNavigator}
          // Включаем шапку (три полоски), т.к. inner Stack её скрывает
          options={{ title: 'Друзья', headerShown: true }}
        />
        <Drawer.Screen name="Levels" component={LevelsScreen} options={{ title: 'Уровни' }} />
        <Drawer.Screen name="Shop" component={ShopScreen} options={{ title: 'Магазин' }} />
        <Drawer.Screen name="PromoCodes" component={PromoCodesScreen} options={{ title: 'Купоны и промокоды' }} />
        <Drawer.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Уведомления' }} />
        <Drawer.Screen name="Profile" component={ProfileScreen} options={{ title: 'Профиль' }} />
        <Drawer.Screen name="History" component={HistoryScreen} options={{ title: 'История' }} />
        <Drawer.Screen name="Settings" component={SettingsScreen} options={{ title: 'Настройки' }} />
      </Drawer.Navigator>
    </SessionProvider>
  );
}