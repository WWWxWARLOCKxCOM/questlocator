import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { getVenueRedeemedCoupons } from '@/services/couponService';

export default function VenueCouponHistoryScreen() {
  const { colors } = useTheme();
  const [coupons, setCoupons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getVenueRedeemedCoupons()
      .then((r) => setCoupons(r.coupons ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator /></View>;
  }

  return (
    <FlatList
      data={coupons}
      keyExtractor={(c) => c.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
          <Text style={[styles.code, { color: colors.primary }]}>{item.code}</Text>
          <Text style={[styles.meta, { color: colors.textMuted }]}>
            Погашен: {new Date(item.usedAt).toLocaleString('ru-RU')}
          </Text>
          <Text style={[styles.meta, { color: colors.textMuted }]}>
            Клиент UID: {item.userId.slice(0, 8)}...
          </Text>
        </View>
      )}
      ListEmptyComponent={<Text style={[styles.empty, { color: colors.textMuted }]}>Вы ещё не погашали купоны</Text>}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16 },
  card: { borderRadius: 12, padding: 14, borderWidth: 1, marginBottom: 12 },
  title: { fontWeight: '800', fontSize: 16 },
  code: { fontFamily: 'monospace', fontWeight: '700', fontSize: 14, marginTop: 4 },
  meta: { fontSize: 12, marginTop: 4 },
  empty: { textAlign: 'center', marginTop: 40 },
});