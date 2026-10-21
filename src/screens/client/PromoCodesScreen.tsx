import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { subscribeToUserSessions } from '@/services/sessionService';
import { subscribeToUserCoupons } from '@/services/couponService';
import { QuestSession, UserCoupon } from '@/types';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';

export default function PromoCodesScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [sessions, setSessions] = useState<QuestSession[]>([]);
  const [coupons, setCoupons] = useState<UserCoupon[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const unsub1 = subscribeToUserSessions(user.uid, (list) => {
      setSessions(list);
      setLoading(false);
    });
    
    const unsub2 = subscribeToUserCoupons(user.uid, setCoupons);

    return () => { unsub1(); unsub2(); };
  }, [user]);

  // Формируем объединенный список
  const combinedData = React.useMemo(() => {
    const promoItems = sessions
      .filter((s) => s.status === 'completed' && !!s.promocode)
      .map((s) => ({
        id: `promo-${s.id}`,
        type: 'promo' as const,
        title: 'Промокод за квест',
        code: s.promocode as string,
        date: s.endedAt ?? s.startedAt,
        isUsed: false, // Промокоды просто показываем
      }));

    const couponItems = coupons.map((c) => ({
      id: `coupon-${c.id}`,
      type: 'coupon' as const,
      title: c.title,
      code: c.code,
      date: c.createdAt,
      isUsed: !!c.usedAt,
    }));

    return [...promoItems, ...couponItems].sort((a, b) => b.date - a.date);
  }, [sessions, coupons]);

  if (loading) {
    return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator /></View>;
  }

  return (
    <FlatList
      data={combinedData}
      keyExtractor={(item) => item.id}
      contentContainerStyle={[styles.list, { backgroundColor: colors.background }]}
      renderItem={({ item }) => (
        <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <MaterialCommunityIcons 
              name={item.type === 'promo' ? 'gift' : 'ticket-percent'} 
              size={24} 
              color={item.type === 'promo' ? '#f1c40f' : colors.primary} 
            />
            <Text style={[styles.title, { color: colors.text, marginLeft: 8, flex: 1 }]} numberOfLines={1}>
              {item.title}
            </Text>
            {item.type === 'coupon' && (
              <Text style={{ fontSize: 12, color: item.isUsed ? colors.danger : colors.success }}>
                {item.isUsed ? 'Использован' : 'Активен'}
              </Text>
            )}
          </View>
          
          <Text style={[styles.code, { color: item.type === 'promo' ? '#f1c40f' : colors.primary }]}>
            {item.code}
          </Text>
          
          <Text style={[styles.date, { color: colors.textMuted }]}>
            {new Date(item.date).toLocaleDateString('ru-RU')}
          </Text>
        </View>
      )}
      ListEmptyComponent={
        <Text style={[styles.empty, { color: colors.textMuted }]}>
          У вас пока нет купонов или промокодов.
        </Text>
      }
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, gap: 12, flexGrow: 1 },
  card: {
    borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1,
  },
  title: { fontSize: 15, fontWeight: '700' },
  code: { fontSize: 20, fontWeight: '800', letterSpacing: 1 },
  date: { marginTop: 4, fontSize: 12 },
  empty: { textAlign: 'center', marginTop: 40 },
});