import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, Image,
  Alert, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { subscribeToVenueCoupons, deleteCoupon } from '@/services/couponService';
import { subscribeToVenue } from '@/services/venueService';
import { Coupon, VenueAccount } from '@/types';

export default function VenueShopScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { colors } = useTheme();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [venue, setVenue] = useState<VenueAccount | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const u1 = subscribeToVenueCoupons(user.uid, setCoupons);
    const u2 = subscribeToVenue(user.uid, setVenue);
    return () => { u1(); u2(); };
  }, [user]);

  const handleDelete = (c: Coupon) => {
    Alert.alert(
      'Удалить купон?',
      `«${c.title}» будет удалён из магазина.`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            setBusyId(c.id);
            try {
              await deleteCoupon(c.id);
            } catch (e: any) {
              Alert.alert('Ошибка', e?.message ?? 'Не удалось удалить');
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  };

  const canCreate = (venue?.couponsUsed ?? 0) < (venue?.couponsLimit ?? 1);
  const isPending = venue?.isActive === false;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>
          Купоны ({venue?.couponsUsed ?? 0} / {venue?.couponsLimit ?? 0})
        </Text>
        <TouchableOpacity
          style={[
            styles.addBtn,
            { backgroundColor: (canCreate && !isPending) ? colors.primary : colors.surfaceAlt },
          ]}
          onPress={() => {
            if (isPending) {
              Alert.alert('Аккаунт на модерации', 'Вы не можете создавать купоны до одобрения заявки.');
              return;
            }
            if (!canCreate) {
              Alert.alert('Лимит исчерпан', 'Обратитесь к администратору.');
              return;
            }
            navigation.navigate('VenueCreateCoupon');
          }}
        >
          <MaterialCommunityIcons
            name="plus"
            size={18}
            color={(canCreate && !isPending) ? '#fff' : colors.textMuted}
          />
          <Text
            style={[
              styles.addBtnText,
              { color: (canCreate && !isPending) ? '#fff' : colors.textMuted },
            ]}
          >
            Создать
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={coupons}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View
            style={[
              styles.card,
              { backgroundColor: colors.cardBg, borderColor: colors.border },
            ]}
          >
            {item.photoUrl ? (
              <Image source={{ uri: item.photoUrl }} style={styles.img} />
            ) : (
              <View style={[styles.img, { backgroundColor: colors.surfaceAlt }]}>
                <MaterialCommunityIcons
                  name="ticket-percent"
                  size={32}
                  color={colors.textMuted}
                />
              </View>
            )}
            <View style={styles.body}>
              <Text style={[styles.name, { color: colors.text }]}>{item.title}</Text>
              <Text style={[styles.meta, { color: colors.textMuted }]}>
                {item.pricePoints} баллов · Куплено: {item.purchasedCount}
                {item.maxPurchases ? ` / ${item.maxPurchases}` : ''}
              </Text>
              <TouchableOpacity
                style={[styles.deleteBtn, { backgroundColor: colors.danger }]}
                onPress={() => handleDelete(item)}
                disabled={busyId === item.id}
              >
                {busyId === item.id ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.deleteText}>Удалить</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: colors.textMuted }]}>
            У вас пока нет купонов
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 12,
  },
  title: { fontSize: 16, fontWeight: '800' },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8,
  },
  addBtnText: { fontWeight: '700', fontSize: 13 },
  list: { paddingBottom: 40 },
  card: {
    borderRadius: 14, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, marginBottom: 12,
  },
  img: {
    width: '100%', height: 100,
    alignItems: 'center', justifyContent: 'center',
  },
  body: { padding: 12 },
  name: { fontWeight: '800', fontSize: 15 },
  meta: { fontSize: 12, marginTop: 4 },
  deleteBtn: {
    marginTop: 10, borderRadius: 8,
    paddingVertical: 10, alignItems: 'center',
  },
  deleteText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  empty: { textAlign: 'center', marginTop: 40 },
});