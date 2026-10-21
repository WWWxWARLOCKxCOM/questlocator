import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function VenueCouponScannerScreen() {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <MaterialCommunityIcons name="camera-off" size={64} color={colors.textMuted} />
      <Text style={[styles.title, { color: colors.text }]}>Сканер недоступен</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>
        Сканирование QR-кодов доступно только в мобильном приложении (iOS/Android).
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 20, fontWeight: '800', marginTop: 16 },
  subtitle: { fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
});