import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { DrawerContentComponentProps } from '@react-navigation/drawer';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { signOut } from '@/services/authService';
import { loadVenueDrawerOrder, saveVenueDrawerOrder, VenueDrawerRoute } from '@/services/venueDrawerOrderService';

interface ItemDef { route: VenueDrawerRoute; title: string; icon: keyof typeof Ionicons.glyphMap; }

const ITEMS: ItemDef[] = [
  { route: 'VenueMainStack', title: 'Карта', icon: 'map-outline' },
  { route: 'VenuePlaces', title: 'Управление точками', icon: 'list-outline' },
  { route: 'VenueShop', title: 'Купоны и промокоды', icon: 'cart-outline' },
  { route: 'VenueFinance', title: 'Финансы', icon: 'wallet-outline' },
  { route: 'VenueScanner', title: 'Сканировать купон', icon: 'qr-code-outline' },
  { route: 'VenueHistory', title: 'Погашенные купоны', icon: 'time-outline' },
  { route: 'VenueQR', title: 'QR-коды', icon: 'barcode-outline' },
  { route: 'VenueModeration', title: 'Модерация фото', icon: 'images-outline' },
  { route: 'VenueProfile', title: 'Профиль компании', icon: 'person-outline' },
];

export default function CustomVenueDrawer(props: DrawerContentComponentProps) {
  const { colors } = useTheme();
  const [order, setOrder] = useState<VenueDrawerRoute[]>([]);

  useEffect(() => { loadVenueDrawerOrder().then(setOrder); }, []);

  const items = useMemo(() => {
    const map = new Map(ITEMS.map((i) => [i.route, i]));
    const result: ItemDef[] = [];
    order.forEach((r) => { const it = map.get(r); if (it) result.push(it); });
    ITEMS.forEach((it) => { if (!result.some(x => x.route === it.route)) result.push(it); });
    return result;
  }, [order]);

  const currentRoute = props.state.routeNames[props.state.index];

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Кабинет компании</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>Удерживайте для перетаскивания</Text>
      </View>

      <DraggableFlatList
        data={items}
        keyExtractor={(i) => i.route}
        onDragEnd={({ data }) => {
          const newOrder = data.map((i) => i.route);
          setOrder(newOrder);
          saveVenueDrawerOrder(newOrder);
        }}
        containerStyle={{ flex: 1 }}
        renderItem={({ item, drag, isActive }: RenderItemParams<ItemDef>) => {
          const active = currentRoute === item.route;
          return (
            <ScaleDecorator>
              <TouchableOpacity
                onLongPress={drag}
                delayLongPress={150}
                onPress={() => { props.navigation.navigate(item.route as never); props.navigation.closeDrawer(); }}
                style={[styles.item, isActive && { backgroundColor: colors.surfaceAlt }, active && { backgroundColor: colors.primary + '22' }]}
              >
                <Ionicons name={item.icon} size={22} color={active ? colors.primary : colors.text} />
                <Text style={[styles.label, { color: active ? colors.primary : colors.text }]}>{item.title}</Text>
                <MaterialCommunityIcons name="drag-vertical" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </ScaleDecorator>
          );
        }}
      />

      <TouchableOpacity style={[styles.logout, { borderTopColor: colors.border }]} onPress={async () => { await signOut(); }}>
        <Ionicons name="log-out-outline" size={22} color={colors.danger} />
        <Text style={[styles.logoutText, { color: colors.danger }]}>Выйти</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16 },
  title: { fontSize: 20, fontWeight: '800' },
  subtitle: { fontSize: 11, marginTop: 2 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 20 },
  label: { flex: 1, fontSize: 15, fontWeight: '600' },
  logout: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16, paddingHorizontal: 20, borderTopWidth: StyleSheet.hairlineWidth },
  logoutText: { fontSize: 15, fontWeight: '600' },
});