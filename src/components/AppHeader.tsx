import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { subscribeToNotifications } from '@/services/notificationService';

interface Props {
  onBell?: () => void;
  onProfile?: () => void;
}

export default function AppHeader({ onBell, onProfile }: Props) {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const { user } = useAuth();

  const [balance, setBalance] = useState(0);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);

  // Баланс и аватар из users/{uid}
  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, 'users', user.uid), (snap) => {
      const d = snap.data() ?? {};
      setBalance(d.balance ?? 0);
      setAvatarUrl(d.avatarUrl ?? null);
    });
  }, [user]);

  // Непрочитанные уведомления
  useEffect(() => {
    if (!user) return;
    return subscribeToNotifications(user.uid, (notifs) => {
      setUnread(notifs.filter((n) => !n.isRead).length);
    });
  }, [user]);

  return (
    <View
      style={[
        styles.row,
        { backgroundColor: colors.surface, borderBottomColor: colors.border },
      ]}
    >
      <TouchableOpacity
        style={styles.iconBtn}
        onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
      >
        <Ionicons name="menu" size={26} color={colors.text} />
      </TouchableOpacity>

      <View style={{ flex: 1 }} />

      <TouchableOpacity style={styles.iconBtn} onPress={onBell}>
        <Ionicons name="notifications-outline" size={24} color={colors.text} />
        {unread > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
          </View>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={onProfile} style={styles.avatarWrap}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: colors.text }]}>
            <Ionicons name="person" size={18} color={colors.background} />
          </View>
        )}
      </TouchableOpacity>

      <View style={styles.balanceCenter} pointerEvents="none">
        <View style={[styles.balancePill, { backgroundColor: colors.surfaceAlt }]}>
          <Text style={[styles.balanceText, { color: colors.text }]}>
            Баллы {balance.toLocaleString('ru-RU')}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    position: 'relative',
  },
  iconBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  balanceCenter: {
    position: 'absolute',
    left: 0, right: 0, top: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  balancePill: {
    borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  balanceText: { fontWeight: '800', fontSize: 13 },
  badge: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: '#e74c3c', borderRadius: 8,
    minWidth: 16, height: 16,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  avatarWrap: { padding: 4 },
  avatar: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
  },
});