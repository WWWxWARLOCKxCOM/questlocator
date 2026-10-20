import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Camera, useCameraDevice, useCodeScanner } from 'react-native-vision-camera';
import { useNavigation } from '@react-navigation/native';
import { redeemCoupon } from '@/services/couponService';
import { useTheme } from '@/context/ThemeContext';
import { Alert } from 'react-native';

export default function VenueCouponScannerScreen() {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const device = useCameraDevice('back');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleScan = useCallback(async (payload: string) => {
    if (isProcessing) return;
    if (!payload.startsWith('coupon://')) {
      setError('Это не QR-код купона');
      return;
    }
    const userCouponId = payload.replace('coupon://', '');
    setIsProcessing(true);
    setError(null);
    try {
      await redeemCoupon(userCouponId);
      Alert.alert('Успех', 'Купон погашен!', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (e: any) {
      setError(e?.message ?? 'Не удалось погасить купон');
      setIsProcessing(false);
    }
  }, [isProcessing, navigation]);

  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: (codes) => {
      if (codes.length > 0 && codes[0]?.value) {
        handleScan(codes[0].value);
      }
    },
  });

  if (!device) {
    return <View style={styles.center}><Text style={{ color: colors.text }}>Камера недоступна</Text></View>;
  }

  return (
    <View style={styles.container}>
      <Camera style={StyleSheet.absoluteFill} device={device} isActive codeScanner={codeScanner} />
      <View style={styles.overlay} pointerEvents="box-none">
        <View style={styles.frame} />
        <Text style={styles.hint}>Наведите на QR-код клиента</Text>
        {isProcessing && <ActivityIndicator color="#fff" size="large" style={{ marginTop: 16 }} />}
        {error && <Text style={styles.error}>{error}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  frame: { width: 260, height: 260, borderWidth: 3, borderColor: '#2ecc71', borderRadius: 20 },
  hint: { color: '#fff', marginTop: 20, fontSize: 16, fontWeight: '600' },
  error: { color: '#ff6b6b', marginTop: 16, fontWeight: '700', paddingHorizontal: 24, textAlign: 'center' },
});