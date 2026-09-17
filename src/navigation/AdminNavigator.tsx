import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import AdminDashboardScreen from '@/screens/admin/AdminDashboardScreen';
import PlacesManagementScreen from '@/screens/admin/PlacesManagementScreen';
import QuestsManagementScreen from '@/screens/admin/QuestsManagementScreen';
import QRGeneratorScreen from '@/screens/admin/QRGeneratorScreen';
import PhotoModerationScreen from '@/screens/admin/PhotoModerationScreen';

export type AdminTabParamList = {
  Dashboard: undefined;
  Places: undefined;
  Quests: undefined;
  QRCodes: undefined;
  Moderation: undefined;
};

const Tab = createBottomTabNavigator<AdminTabParamList>();

/**
 * Отдельная навигация для админ-режима, полностью изолированная от клиентской
 * (см. ТЗ п.2.1: "строгое разделение на клиентский режим и админ-панель").
 */
export default function AdminNavigator() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: true }}>
      <Tab.Screen name="Dashboard" component={AdminDashboardScreen} options={{ title: 'Статистика' }} />
      <Tab.Screen name="Places" component={PlacesManagementScreen} options={{ title: 'Заведения' }} />
      <Tab.Screen name="Quests" component={QuestsManagementScreen} options={{ title: 'Квесты' }} />
      <Tab.Screen name="QRCodes" component={QRGeneratorScreen} options={{ title: 'QR-коды' }} />
      <Tab.Screen name="Moderation" component={PhotoModerationScreen} options={{ title: 'Модерация' }} />
    </Tab.Navigator>
  );
}
