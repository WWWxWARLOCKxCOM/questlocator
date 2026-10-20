import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { subscribeToNotifications, markNotificationRead, markAllNotificationsRead } from '@/services/notificationService';
import { Notification } from '@/types';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function NotificationsScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    return subscribeToNotifications(user.uid, (list) => {
      setNotifications(list);
      setLoading(false);
    });
  }, [user]);

  const handleMarkAll = () => {
    const unreadIds = notifications.filter(n => !n.isRead).map(n => n.id);
    if (unreadIds.length > 0) markAllNotificationsRead(unreadIds);
  };

  if (loading) return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator /></View>;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: colors.text }]}>Уведомления</Text>
        <TouchableOpacity onPress={handleMarkAll}>
          <Text style={{ color: colors.primary, fontWeight: '600' }}>Прочитать все</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.card,
              { backgroundColor: item.isRead ? colors.surface : colors.surfaceAlt, borderColor: colors.border },
              !item.isRead && { borderLeftWidth: 4, borderLeftColor: colors.primary }
            ]}
            onPress={() => !item.isRead && markNotificationRead(item.id)}
          >
            <View style={styles.iconWrap}>
              <MaterialCommunityIcons
                name={
                  item.type === 'quest_reward' ? 'trophy' :
                  item.type === 'coupon_buy' ? 'ticket' : 'check-decagram'
                }
                size={24}
                color={item.type === 'quest_reward' ? '#f1c40f' : colors.primary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{item.title}</Text>
              <Text style={[styles.cardBody, { color: colors.textSecondary }]}>{item.body}</Text>
              <Text style={[styles.cardDate, { color: colors.textMuted }]}>
                {new Date(item.createdAt).toLocaleString('ru-RU')}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={[styles.empty, { color: colors.textMuted }]}>Уведомлений пока нет</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '800' },
  card: {
    flexDirection: 'row', padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 10, gap: 12,
  },
  iconWrap: { marginTop: 2 },
  cardTitle: { fontWeight: '700', fontSize: 15 },
  cardBody: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  cardDate: { fontSize: 11, marginTop: 6 },
  empty: { textAlign: 'center', marginTop: 40 },
});