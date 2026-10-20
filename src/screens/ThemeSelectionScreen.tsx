import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';

interface Props {
  onDone: () => void;
}

export default function ThemeSelectionScreen({ onDone }: Props) {
  const { setDark } = useTheme();
  const [selected, setSelected] = useState<'light' | 'dark' | null>(null);

  const handleSelect = (mode: 'light' | 'dark') => {
    setSelected(mode);
    setDark(mode === 'dark'); // Предпросмотр темы сразу
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Выберите тему</Text>
      <Text style={styles.subtitle}>Нажмите на карточку, чтобы посмотреть, как будет выглядеть приложение</Text>

      <TouchableOpacity
        style={[styles.card, selected === 'light' && styles.cardActive]}
        onPress={() => handleSelect('light')}
      >
        <View style={[styles.preview, { backgroundColor: '#fff' }]}>
          <View style={[styles.bar, { backgroundColor: '#ddd' }]} />
          <View style={[styles.bar, { backgroundColor: '#ddd', width: '70%' }]} />
          <View style={[styles.bar, { backgroundColor: '#ddd', width: '50%' }]} />
        </View>
        <View style={styles.labelRow}>
          <Ionicons name="sunny-outline" size={22} color="#111" />
          <Text style={[styles.label, { color: '#111' }]}>Светлая</Text>
          {selected === 'light' && <Ionicons name="checkmark-circle" size={24} color="#2ecc71" />}
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.card, { backgroundColor: '#1a2029' }, selected === 'dark' && styles.cardActive]}
        onPress={() => handleSelect('dark')}
      >
        <View style={[styles.preview, { backgroundColor: '#0f1419' }]}>
          <View style={[styles.bar, { backgroundColor: '#2a323c' }]} />
          <View style={[styles.bar, { backgroundColor: '#2a323c', width: '70%' }]} />
          <View style={[styles.bar, { backgroundColor: '#2a323c', width: '50%' }]} />
        </View>
        <View style={styles.labelRow}>
          <Ionicons name="moon-outline" size={22} color="#e8e8e8" />
          <Text style={[styles.label, { color: '#e8e8e8' }]}>Тёмная</Text>
          {selected === 'dark' && <Ionicons name="checkmark-circle" size={24} color="#2ecc71" />}
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.confirmBtn, !selected && styles.confirmBtnDisabled]}
        disabled={!selected}
        onPress={onDone}
      >
        <Text style={styles.confirmText}>Подтвердить выбор</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingBottom: 48, justifyContent: 'center', flexGrow: 1, gap: 16 },
  title: { fontSize: 26, fontWeight: '800', textAlign: 'center', marginTop: 24 },
  subtitle: { color: '#666', textAlign: 'center', marginBottom: 16 },
  card: {
    borderRadius: 16, overflow: 'hidden', borderWidth: 3, borderColor: 'transparent',
    elevation: 4, shadowColor: '#000', shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 }, shadowRadius: 8,
  },
  cardActive: { borderColor: '#2ecc71' },
  preview: { padding: 20, gap: 8 },
  bar: { height: 10, borderRadius: 5, width: '90%' },
  labelRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, padding: 16,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  label: { flex: 1, fontSize: 18, fontWeight: '700' },
  confirmBtn: {
    marginTop: 24, backgroundColor: '#2ecc71', borderRadius: 12,
    paddingVertical: 16, alignItems: 'center',
  },
  confirmBtnDisabled: { opacity: 0.5 },
  confirmText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});