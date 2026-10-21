import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PortalProvider } from '@gorhom/portal';
import { Platform } from 'react-native'; // <-- ДОБАВЛЕНО
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

function AppGate() {
  const [checking, setChecking] = useState(true);
  const [permissionsDone, setPermissionsDone] = useState(false);
  const [themeDone, setThemeDone] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const t = await hasChosenTheme();
        setThemeDone(t);

        // Если это веб-версия, мы пропускаем экран разрешений
        if (Platform.OS === 'web') {
          setPermissionsDone(true);
        } else {
          const p = await hasAskedPermissions();
          setPermissionsDone(p);
        }
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
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PortalProvider>
        <ThemeProvider>
          <AuthProvider>
            <AppGate />
          </AuthProvider>
        </ThemeProvider>
      </PortalProvider>
    </GestureHandlerRootView>
  );
}