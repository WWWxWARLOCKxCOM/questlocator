import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PortalProvider } from '@gorhom/portal';
import { Platform, View, Text, ScrollView, StyleSheet } from 'react-native';
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

// ═══ ЛОВЕЦ ОШИБОК ═══
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Crash caught by ErrorBoundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>ОШИБКА ПРИЛОЖЕНИЯ</Text>
          <ScrollView style={styles.errorScroll}>
            <Text style={styles.errorText}>
              {this.state.error?.toString()}
            </Text>
            <Text style={styles.errorStack}>
              {this.state.error?.stack}
            </Text>
          </ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
}
// ════════════════════

function AppGate() {
  const [checking, setChecking] = useState(true);
  const [permissionsDone, setPermissionsDone] = useState(false);
  const [themeDone, setThemeDone] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const t = await hasChosenTheme();
        setThemeDone(t);

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
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <PortalProvider>
          <ThemeProvider>
            <AuthProvider>
              <AppGate />
            </AuthProvider>
          </ThemeProvider>
        </PortalProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  errorContainer: { flex: 1, backgroundColor: '#fff', padding: 20, paddingTop: 60 },
  errorTitle: { fontSize: 24, fontWeight: '800', color: '#e74c3c', marginBottom: 16 },
  errorScroll: { flex: 1 },
  errorText: { fontSize: 16, fontWeight: '700', color: '#333', marginBottom: 16 },
  errorStack: { fontSize: 12, color: '#666', fontFamily: 'monospace' },
});