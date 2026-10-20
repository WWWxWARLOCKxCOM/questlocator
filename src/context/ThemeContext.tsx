import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';

const KEY = '@questlocator/theme_v1';

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  primary: string;
  primaryText: string;
  danger: string;
  warning: string;
  success: string;
  cardBg: string;
}

const light: ThemeColors = {
  background: '#fff',
  surface: '#fff',
  surfaceAlt: '#f5f5f5',
  text: '#111',
  textSecondary: '#333',
  textMuted: '#888',
  border: '#e5e5e5',
  primary: '#2ecc71',
  primaryText: '#fff',
  danger: '#e74c3c',
  warning: '#e67e22',
  success: '#27ae60',
  cardBg: '#fff',
};

const dark: ThemeColors = {
  background: '#0f1419',
  surface: '#1a2029',
  surfaceAlt: '#232b36',
  text: '#e8e8e8',
  textSecondary: '#b8b8b8',
  textMuted: '#7a8391',
  border: '#2a323c',
  primary: '#2ecc71',
  primaryText: '#fff',
  danger: '#e74c3c',
  warning: '#e67e22',
  success: '#27ae60',
  cardBg: '#1a2029',
};

interface ThemeContextValue {
  isDark: boolean;
  colors: ThemeColors;
  toggle: () => void;
  setDark: (v: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  isDark: false,
  colors: light,
  toggle: () => {},
  setDark: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw === 'dark') setIsDark(true);
        else if (raw === 'light') setIsDark(false);
        else setIsDark(system === 'dark');
      } catch {
        // ignore
      }
    })();
  }, []);

  const setDark = (v: boolean) => {
    setIsDark(v);
    AsyncStorage.setItem(KEY, v ? 'dark' : 'light').catch(() => {});
  };

  const toggle = () => setDark(!isDark);

  return (
    <ThemeContext.Provider
      value={{ isDark, colors: isDark ? dark : light, toggle, setDark }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}