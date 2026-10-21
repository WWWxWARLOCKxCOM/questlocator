import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, Image,
  Alert, ActivityIndicator, Modal,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { doc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { db } from '@/config/firebase';
import { subscribeToActiveCoupons, subscribeToUserCoupons, buyCoupon } from '@/services/couponService';
import { Coupon, UserCoupon } from '@/types';

function formatDate(ms: number) {
  if (!ms) return '';
  return new Date(ms).toLocaleDateString('ru-RU');
}

export default function ShopScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [myCoupons, setMyCoupons] = useState<UserCoupon[]>([]);
  const [tab, setTab] = useState<'shop' | 'mine'>('shop');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const [qrVisible, setQrVisible] = useState<UserCoupon | null>(null);

  useEffect(() => {
    const u1 = subscribeToActiveCoupons(setCoupons);
    return () => u1();
  }, []);

  useEffect(() => {
    if (!user) return;
    const u1 = subscribeToUserCoupons(user.uid, setMyCoupons);
    const u2 = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      setBalance(snap.data()?.balance ?? 0);
    });
    return () => { u1(); u2(); };
  }, [user]);

  const handleBuy = (c: Coupon) => {
    if (balance < c.pricePoints) {
      return Alert.alert('Недостаточно баллов', `Нужно ${c.pricePoints}, у вас ${balance}.`);
    }
    Alert.alert('Купить купон?', `«${c.title}» за ${c.pricePoints} баллов`, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Купить',
        onPress: async () => {
          setBusyId(c.id);
          try {
            const res = await buyCoupon(c.id);
            Alert.alert('Готово', `Код куплен: ${res.code}\nПосмотреть QR можно во вкладке «Промокоды и купоны».`);
            setTab('mine');
          } catch (e: any) {
            Alert.alert('Ошибка', e?.message ?? 'Не удалось купить');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  const renderCoupon = ({ item }: { item: Coupon }) => {
    const soldOut = item.maxPurchases && item.maxPurchases > 0 ? item.purchasedCount >= item.maxPurchases : false;
    return (
      <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
        {item.photoUrl ? (
          <Image source={{ uri: item.photoUrl }} style={styles.img} />
        ) : (
          <View style={[styles.img, { backgroundColor: colors.surfaceAlt }]}>
            <MaterialCommunityIcons name="ticket-percent" size={42} color={colors.textMuted} />
          </View>
        )}
        <View style={styles.body}>
          <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
          {item.description ? (
            <Text style={[styles.desc, { color: colors.textSecondary }]} numberOfLines={3}>{item.description}</Text>
          ) : null}
          {item.validUntil ? <Text style={[styles.meta, { color: colors.textMuted }]}>Действует до {formatDate(item.validUntil)}</Text> : null}
          {item.maxPurchases ? <Text style={[styles.meta, { color: colors.textMuted }]}>Осталось: {Math.max(0, item.maxPurchases - item.purchasedCount)} из {item.maxPurchases}</Text> : null}
          <View style={styles.footerRow}>
            <Text style={[styles.price, { color: colors.primary }]}>{item.pricePoints} баллов</Text>
            <TouchableOpacity
              style={[styles.buyBtn, { backgroundColor: soldOut ? colors.surfaceAlt : colors.primary }]}
              onPress={() => handleBuy(item)} disabled={soldOut || busyId === item.id}
            >
              {busyId === item.id ? <ActivityIndicator color="#fff" /> : (
                <Text style={[styles.buyText, { color: soldOut ? colors.textMuted : '#fff' }]}>
                  {soldOut ? 'Раскуплен' : 'Купить'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const renderMyCoupon = ({ item }: { item: UserCoupon }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border, padding: 12, flexDirection: 'row', alignItems: 'center' }]}
      onPress={() => !item.usedAt && setQrVisible(item)}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
        <Text style={[styles.code, { color: colors.primary }]}>{item.code}</Text>
        {item.validUntil ? <Text style={[styles.meta, { color: colors.textMuted }]}>Действует до {formatDate(item.validUntil)}</Text> : null}
        {item.usedAt ? <Text style={[styles.meta, { color: colors.danger }]}>Погашен {formatDate(item.usedAt)}</Text> : null}
      </View>
      {item.usedAt ? (
        <Ionicons name="checkmark-done-circle" size={32} color={colors.success} />
      ) : (
        <Ionicons name="qr-code-outline" size={32} color={colors.textMuted} />
      )}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, { backgroundColor: tab === 'shop' ? colors.primary : 'transparent' }]} onPress={() => setTab('shop')}>
          <Text style={[styles.tabText, { color: tab === 'shop' ? '#fff' : colors.text }]}>Магазин</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, { backgroundColor: tab === 'mine' ? colors.primary : 'transparent' }]} onPress={() => setTab('mine')}>
          <Text style={[styles.tabText, { color: tab === 'mine' ? '#fff' : colors.text }]}>Промокоды и купоны ({myCoupons.length})</Text>
        </TouchableOpacity>
      </View>

      {tab === 'shop' ? (
        <FlatList
          data={coupons} keyExtractor={(c) => c.id} renderItem={renderCoupon}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={[styles.empty, { color: colors.textMuted }]}>Купонов пока нет</Text>}
        />
      ) : (
        <FlatList
          data={myCoupons} keyExtractor={(c) => c.id} renderItem={renderMyCoupon}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={[styles.empty, { color: colors.textMuted }]}>Вы ещё ничего не купили</Text>}
        />
      )}

      <Modal visible={!!qrVisible} transparent animationType="fade" onRequestClose={() => setQrVisible(null)}>
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <TouchableOpacity style={styles.modalClose} onPress={() => setQrVisible(null)}>
              <Ionicons name="close" size={22} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{qrVisible?.title}</Text>
            <View style={styles.qrWrap}>
              <QRCode value={`coupon://${qrVisible?.id}`} size={240} />
            </View>
            <Text style={[styles.modalCode, { color: colors.primary }]}>{qrVisible?.code}</Text>
            <Text style={[styles.modalHint, { color: colors.textMuted }]}>Покажите этот QR-код сотруднику заведения</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  tab: { flex: 1, borderRadius: 20, paddingVertical: 8, alignItems: 'center' },
  tabText: { fontWeight: '700', fontSize: 12 },
  list: { padding: 16, paddingBottom: 40 },
  card: { borderRadius: 14, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, marginBottom: 12 },
  img: { width: '100%', height: 140, alignItems: 'center', justifyContent: 'center' },
  body: { padding: 12 },
  title: { fontWeight: '800', fontSize: 16 },
  desc: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  meta: { fontSize: 11, marginTop: 4 },
  code: { fontFamily: 'monospace', fontWeight: '800', fontSize: 15, marginTop: 4 },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  price: { fontWeight: '800', fontSize: 15 },
  buyBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
  buyText: { fontWeight: '700', fontSize: 13 },
  empty: { textAlign: 'center', marginTop: 40 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalCard: { borderRadius: 16, padding: 24, alignItems: 'center', width: '100%' },
  modalClose: { position: 'absolute', top: 12, right: 12, zIndex: 10 },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 16, textAlign: 'center' },
  qrWrap: { backgroundColor: '#fff', padding: 16, borderRadius: 12 },
  modalCode: { fontSize: 20, fontWeight: '800', marginTop: 16, fontFamily: 'monospace' },
  modalHint: { textAlign: 'center', marginTop: 8, fontSize: 12 },
});