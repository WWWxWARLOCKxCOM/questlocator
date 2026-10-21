import React, { useEffect, useState } from 'react';
import { View, Text, Switch, Pressable, StyleSheet, Alert } from 'react-native';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { signOut } from '@/services/authService';
import { updateHideOnMap } from '@/services/userService';

export default function SettingsScreen() {
  const { user } = useAuth();
  const { isDark, colors, setDark } = useTheme();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [hideOnMap, setHideOnMap] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, 'users', user.uid), (snap) => {
      const d = snap.data() ?? {};
      setHideOnMap(d.hideOnMap === true);
      setNotificationsEnabled(d.notificationsEnabled !== false);
    });
  }, [user]);

  const handleToggleHide = async (value: boolean) => {
    setBusy(true);
    try {
      await updateHideOnMap(value);
      setHideOnMap(value);
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось изменить настройку');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleNotifications = async (value: boolean) => {
    if (!user) return;
    setBusy(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), { notificationsEnabled: value });
      setNotificationsEnabled(value);
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось сохранить настройку');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.row, { borderBottomColor: colors.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, { color: colors.text }]}>Тёмная тема</Text>
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            Переключить оформление приложения
          </Text>
        </View>
        <Switch value={isDark} onValueChange={setDark} />
      </View>

      <View style={[styles.row, { borderBottomColor: colors.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, { color: colors.text }]}>Уведомления</Text>
        </View>
        <Switch
          value={notificationsEnabled}
          onValueChange={handleToggleNotifications}
          disabled={busy}
        />
      </View>

      <View style={[styles.row, { borderBottomColor: colors.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, { color: colors.text }]}>
            Скрывать меня на карте
          </Text>
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            Если включено, другие пользователи не увидят, где вы проходите квест.
          </Text>
        </View>
        <Switch value={hideOnMap} onValueChange={handleToggleHide} disabled={busy} />
      </View>

      <View style={[styles.row, { borderBottomColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.text }]}>Язык</Text>
        <Text style={[styles.value, { color: colors.textMuted }]}>Русский</Text>
      </View>

      <Pressable style={styles.logoutButton} onPress={() => signOut()}>
        <Text style={[styles.logoutText, { color: colors.danger }]}>
          Выйти из аккаунта
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 8 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  label: { fontSize: 16 },
  hint: { fontSize: 12, marginTop: 4 },
  value: {},
  logoutButton: { marginTop: 32, alignItems: 'center', padding: 12 },
  logoutText: { fontWeight: '600' },
});