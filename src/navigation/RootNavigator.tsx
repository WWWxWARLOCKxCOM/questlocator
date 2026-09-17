import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '@/context/AuthContext';
import EmailAuthScreen from '@/screens/auth/EmailAuthScreen';
import AdminGateScreen from '@/screens/auth/AdminGateScreen';
import ClientNavigator from '@/navigation/ClientNavigator';
import AdminNavigator from '@/navigation/AdminNavigator';
import LoadingScreen from '@/screens/LoadingScreen';

export type RootStackParamList = {
  EmailAuth: undefined;
  AdminGate: undefined;
  Client: undefined;
  Admin: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { user, isAdmin, isLoading } = useAuth();
  if (isLoading) return <LoadingScreen />;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <>
            <Stack.Screen name="EmailAuth" component={EmailAuthScreen} />
            <Stack.Screen name="AdminGate" component={AdminGateScreen} />
          </>
        ) : isAdmin ? (
          <Stack.Screen name="Admin" component={AdminNavigator} />
        ) : (
          <Stack.Screen name="Client" component={ClientNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}