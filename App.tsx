import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PortalProvider } from '@gorhom/portal';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { ThemeProvider } from './src/context/ThemeContext';
import { AuthProvider } from './src/context/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';
import PermissionsScreen from './src/screens/PermissionsScreen';
import ThemeSelectionScreen from './src/screens/ThemeSelectionScreen';
import LoadingScreen from './src/screens/LoadingScreen';
import {
  hasAskedPermissions,
  markPermissionsAsked,
  hasChosenTheme,
  markThemeChosen,
} from './src/services/permissionsService';

// Безопасная обертка для карт (только для веба)
let MapProvider = ({ children }: any) => children;
if (Platform.OS === 'web') {
  const WebMaps = require('@teovilla/react-native-web-maps');
  MapProvider = WebMaps.MapProvider;
}

function AppGate() {
  const [checking, setChecking] = useState(true);
  const [permissionsDone, setPermissionsDone] = useState(false);
  const [themeDone, setThemeDone] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [p, t] = await Promise.all([hasAskedPermissions(), hasChosenTheme()]);
        setPermissionsDone(p);
        setThemeDone(t);
      } finally {
        setChecking(false);
      }
    })();
  }, []);

  if (checking) return <LoadingScreen />;

  if (!permissionsDone) {
    return (
      <PermissionsScreen
        onDone={async () => {
          await markPermissionsAsked();
          setPermissionsDone(true);
        }}
      />
    );
  }

  if (!themeDone) {
    return (
      <ThemeSelectionScreen
        onDone={async () => {
          await markThemeChosen();
          setThemeDone(true);
        }}
      />
    );
  }

  return <RootNavigator />;
}

export default function App() {
  const apiKey = Constants.expoConfig?.extra?.GOOGLE_MAPS_WEB_API_KEY || '';

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PortalProvider>
        <ThemeProvider>
          <AuthProvider>
            <MapProvider apiKey={apiKey}>
              <AppGate />
            </MapProvider>
          </AuthProvider>
        </ThemeProvider>
      </PortalProvider>
    </GestureHandlerRootView>
  );
}