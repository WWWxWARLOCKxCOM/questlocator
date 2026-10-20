import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import {
  requestAllPermissions,
  markPermissionsAsked,
  PermissionResult,
} from '@/services/permissionsService';

interface Props {
  onDone: () => void;
}

const ITEMS = [
  {
    key: 'camera' as const,
    icon: 'camera-outline' as const,
    title: 'Камера',
    desc: 'Для сканирования QR-кодов заведений и фото для бонусов.',
  },
  {
    key: 'location' as const,
    icon: 'location-outline' as const,
    title: 'Геолокация',
    desc: 'Чтобы подтвердить ваше присутствие в заведении.',
  },
  {
    key: 'gallery' as const,
    icon: 'images-outline' as const,
    title: 'Галерея',
    desc: 'Для загрузки фото профиля и фото заведений.',
  },
  {
    key: 'notifications' as const,
    icon: 'notifications-outline' as const,
    title: 'Уведомления',
    desc: 'Чтобы вовремя напоминать о ходе сессии.',
  },
];

export default function PermissionsScreen({ onDone }: Props) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PermissionResult | null>(null);

  const handleRequest = async () => {
    setBusy(true);
    try {
      const r = await requestAllPermissions();
      setResult(r);
    } finally {
      setBusy(false);
    }
  };

  const handleContinue = async () => {
    await markPermissionsAsked();
    onDone();
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Ionicons name="shield-checkmark" size={64} color="#2ecc71" />
      <Text style={styles.title}>Разрешения приложения</Text>
      <Text style={styles.subtitle}>
        Для работы QuestLocator нужны следующие разрешения. Нажмите «Разрешить все»,
        чтобы выдать их за один шаг.
      </Text>

      {ITEMS.map((item) => {
        const granted = result ? result[item.key] : null;
        return (
          <View key={item.key} style={styles.item}>
            <View style={styles.itemIcon}>
              <Ionicons name={item.icon} size={24} color="#2c3e50" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              <Text style={styles.itemDesc}>{item.desc}</Text>
            </View>
            {granted === true && (
              <MaterialCommunityIcons name="check-circle" size={24} color="#2ecc71" />
            )}
            {granted === false && (
              <MaterialCommunityIcons name="close-circle" size={24} color="#e74c3c" />
            )}
          </View>
        );
      })}

      {!result ? (
        <TouchableOpacity
          style={[styles.primaryBtn, busy && { opacity: 0.6 }]}
          onPress={handleRequest}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>Разрешить все</Text>
          )}
        </TouchableOpacity>
      ) : (
        <>
          <TouchableOpacity style={styles.primaryBtn} onPress={handleContinue}>
            <Text style={styles.primaryBtnText}>Продолжить</Text>
          </TouchableOpacity>
          {Object.values(result).some((v) => v === false) && (
            <Text style={styles.warn}>
              Некоторые разрешения не выданы. Вы сможете выдать их позже в
              настройках телефона.
            </Text>
          )}
        </>
      )}

      <Text style={styles.hint}>
        Вы всегда можете изменить разрешения в настройках телефона:
        Настройки → Приложения → QuestLocator.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1, alignItems: 'center', padding: 24,
    paddingTop: 48, paddingBottom: 48, backgroundColor: '#fff',
  },
  title: { fontSize: 24, fontWeight: '800', marginTop: 16, textAlign: 'center' },
  subtitle: {
    color: '#666', textAlign: 'center', marginTop: 8, marginBottom: 24,
    fontSize: 14, lineHeight: 20,
  },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#f7f7f7', borderRadius: 12,
    padding: 14, marginBottom: 10, width: '100%',
  },
  itemIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#e8f0f8',
    alignItems: 'center', justifyContent: 'center',
  },
  itemTitle: { fontSize: 15, fontWeight: '700' },
  itemDesc: { fontSize: 12, color: '#666', marginTop: 2, lineHeight: 16 },
  primaryBtn: {
    marginTop: 24, backgroundColor: '#2ecc71', borderRadius: 10,
    paddingVertical: 16, paddingHorizontal: 40,
    alignItems: 'center', alignSelf: 'stretch',
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  warn: {
    color: '#e67e22', textAlign: 'center',
    marginTop: 12, fontSize: 13, paddingHorizontal: 12,
  },
  hint: {
    color: '#999', textAlign: 'center',
    marginTop: 24, fontSize: 12, paddingHorizontal: 12,
  },
});