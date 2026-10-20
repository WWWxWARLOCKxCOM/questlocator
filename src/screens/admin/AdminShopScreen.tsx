import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, Image,
  Alert, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AdminStackParamList } from '@/navigation/AdminNavigator';
import { useTheme } from '@/context/ThemeContext';
import { subscribeToAllCoupons, deleteCoupon } from '@/services/couponService';
import { Coupon } from '@/types';

type Nav = NativeStackNavigationProp<AdminStackParamList>;

export default function AdminShopScreen() {
  const navigation = useNavigation<Nav>();
  const { colors } = useTheme();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => subscribeToAllCoupons(setCoupons), []);

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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TouchableOpacity
        style={[styles.addBtn, { backgroundColor: colors.primary }]}
        onPress={() => navigation.navigate('AdminCreateCoupon')}
      >
        <MaterialCommunityIcons name="plus" size={20} color="#fff" />
        <Text style={styles.addBtnText}>Создать купон</Text>
      </TouchableOpacity>

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
              <Text style={[styles.title, { color: colors.text }]}>
                {item.title}
              </Text>
              <Text style={[styles.meta, { color: colors.textMuted }]}>
                Цена: {item.pricePoints} баллов · Куплено: {item.purchasedCount}
                {item.maxPurchases ? ` / ${item.maxPurchases}` : ''}
              </Text>
              <Text
                style={[
                  styles.status,
                  { color: item.isActive ? colors.success : colors.danger },
                ]}
              >
                {item.isActive ? 'Активен' : 'Неактивен'}
              </Text>

              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#3498db' }]}
                  onPress={() =>
                    navigation.navigate('AdminCreateCoupon', {
                      couponId: item.id,
                    })
                  }
                >
                  <MaterialCommunityIcons name="pencil" size={16} color="#fff" />
                  <Text style={styles.actionText}>Изменить</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    { backgroundColor: colors.danger },
                  ]}
                  onPress={() => handleDelete(item)}
                  disabled={busyId === item.id}
                >
                  {busyId === item.id ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <MaterialCommunityIcons
                        name="trash-can"
                        size={16}
                        color="#fff"
                      />
                      <Text style={styles.actionText}>Удалить</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: colors.textMuted }]}>
            Купонов пока нет
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, borderRadius: 10, paddingVertical: 12, marginBottom: 12,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  list: { paddingBottom: 40 },
  card: {
    borderRadius: 14, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, marginBottom: 12,
  },
  img: {
    width: '100%', height: 120,
    alignItems: 'center', justifyContent: 'center',
  },
  body: { padding: 12 },
  title: { fontWeight: '800', fontSize: 16 },
  meta: { fontSize: 12, marginTop: 4 },
  status: { fontSize: 12, marginTop: 4, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  actionBtn: {
    flex: 1, borderRadius: 8, paddingVertical: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  actionText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  empty: { textAlign: 'center', marginTop: 40 },
});