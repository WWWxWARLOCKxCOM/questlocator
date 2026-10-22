import React from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import EmailAuthScreen from '@/screens/auth/EmailAuthScreen';
import AdminGateScreen from '@/screens/auth/AdminGateScreen';
import VenueAuthScreen from '@/screens/auth/VenueAuthScreen';
import VenueRegisterScreen from '@/screens/auth/VenueRegisterScreen';
import ClientNavigator from '@/navigation/ClientNavigator';
import AdminNavigator from '@/navigation/AdminNavigator';
import VenueNavigator from '@/navigation/VenueNavigator';
import LoadingScreen from '@/screens/LoadingScreen';

export type RootStackParamList = {
  EmailAuth: undefined;
  AdminGate: undefined;
  VenueAuth: undefined;
  VenueRegister: undefined;
  Client: undefined;
  Admin: undefined;
  Venue: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { user, isAdmin, isVenue, isLoading } = useAuth();
  const { isDark, colors } = useTheme();

  if (isLoading) return <LoadingScreen />;

  const navTheme = isDark
    ? {
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          background: colors.background,
          card: colors.surface,
          text: colors.text,
          border: colors.border,
          primary: colors.primary,
        },
      }
    : {
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          background: colors.background,
          card: colors.surface,
          text: colors.text,
          border: colors.border,
          primary: colors.primary,
        },
      };

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <>
            <Stack.Screen name="EmailAuth" component={EmailAuthScreen} />
            <Stack.Screen name="AdminGate" component={AdminGateScreen} />
            <Stack.Screen name="VenueAuth" component={VenueAuthScreen} />
            <Stack.Screen name="VenueRegister" component={VenueRegisterScreen} />
          </>
        ) : isAdmin ? (
          <Stack.Screen name="Admin" component={AdminNavigator} />
        ) : isVenue ? (
          <Stack.Screen name="Venue" component={VenueNavigator} />
        ) : (
          <Stack.Screen name="Client" component={ClientNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}