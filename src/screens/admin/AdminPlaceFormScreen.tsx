import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  Alert, ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import { AdminStackParamList } from '@/navigation/AdminNavigator';
import { createPlace } from '@/services/placesService';
import { createQuest } from '@/services/questService';
import { PlaceCategory } from '@/types';

type Nav = NativeStackNavigationProp<AdminStackParamList, 'AdminPlaceForm'>;
type Rt = RouteProp<AdminStackParamList, 'AdminPlaceForm'>;

const CATEGORIES: PlaceCategory[] = ['cafe', 'restaurant', 'museum', 'shop'];
const RADIUS_PRESETS = [25, 50, 100, 200];

export default function AdminPlaceFormScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { latitude, longitude } = route.params;

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [category, setCategory] = useState<PlaceCategory>('cafe');
  const [radius, setRadius] = useState(50);

  const [minTime, setMinTime] = useState('30');
  const [maxTime, setMaxTime] = useState('180');
  const [rewardPoints, setRewardPoints] = useState('100');
  const [promocode, setPromocode] = useState('');
  const [photoRequired, setPhotoRequired] = useState(false);
  const [photoBonusMultiplier, setPhotoBonusMultiplier] = useState('1.3');

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const results = await Location.reverseGeocodeAsync({ latitude, longitude });
        const r = results[0];
        if (r) {
          const parts = [r.street, r.name, r.city, r.region, r.country].filter(Boolean);
          setAddress(parts.join(', '));
        }
      } catch {
        // сеть/геокодер недоступны — оставляем поле пустым, админ введёт вручную
      }
    })();
  }, [latitude, longitude]);

  const handleSubmit = async () => {
    if (!name.trim()) return Alert.alert('Ошибка', 'Введите название заведения');
    if (!address.trim()) return Alert.alert('Ошибка', 'Введите адрес');

    const minT = Number(minTime);
    const maxT = Number(maxTime);
    const points = Number(rewardPoints);
    const mult = Number(photoBonusMultiplier);

    if (!Number.isFinite(minT) || !Number.isFinite(maxT) || minT <= 0 || maxT < minT) {
      return Alert.alert('Ошибка', 'Некорректное время квеста');
    }
    if (!Number.isFinite(points) || points < 0) {
      return Alert.alert('Ошибка', 'Некорректное число баллов');
    }
    if (!Number.isFinite(mult) || mult < 1) {
      return Alert.alert('Ошибка', 'Множитель должен быть ≥ 1');
    }

    setIsSubmitting(true);
    try {
      const placeId = await createPlace({
        name: name.trim(),
        address: address.trim(),
        category,
        latitude,
        longitude,
        radiusMeters: radius,
        isActive: true,
      });

      await createQuest({
        placeId,
        minTimeMinutes: minT,
        maxTimeMinutes: maxT,
        rewardPoints: points,
        promocode: promocode.trim() || undefined,
        photoBonusMultiplier: mult,
        photoRequired,
        referenceImages: [],
        isActive: true,
      });

      Alert.alert(
        'Готово',
        'Заведение и квест созданы.\nQR-код появится в разделе «QR-коды».',
        [{ text: 'ОК', onPress: () => navigation.goBack() }],
      );
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось создать заведение');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.sectionTitle}>Заведение</Text>

      <Text style={styles.label}>Название</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Например, Кофейня у дома"
      />

      <Text style={styles.label}>Адрес (можно поправить)</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={address}
        onChangeText={setAddress}
        multiline
      />

      <Text style={styles.label}>Категория</Text>
      <View style={styles.chipsRow}>
        {CATEGORIES.map((c) => (
          <TouchableOpacity
            key={c}
            style={[styles.chip, category === c && styles.chipActive]}
            onPress={() => setCategory(c)}
          >
            <Text style={category === c ? styles.chipTextActive : styles.chipText}>{c}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Радиус геозоны (метры)</Text>
      <View style={styles.chipsRow}>
        {RADIUS_PRESETS.map((r) => (
          <TouchableOpacity
            key={r}
            style={[styles.chip, radius === r && styles.chipActive]}
            onPress={() => setRadius(r)}
          >
            <Text style={radius === r ? styles.chipTextActive : styles.chipText}>{r} м</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        value={String(radius)}
        onChangeText={(t) => setRadius(Math.max(1, Number(t) || 0))}
      />

      <Text style={styles.sectionTitle}>Квест</Text>

      <Text style={styles.label}>Минимальное время (мин)</Text>
      <TextInput style={styles.input} keyboardType="numeric" value={minTime} onChangeText={setMinTime} />

      <Text style={styles.label}>Максимальное время (мин)</Text>
      <TextInput style={styles.input} keyboardType="numeric" value={maxTime} onChangeText={setMaxTime} />

      <Text style={styles.label}>Баллы за квест</Text>
      <TextInput style={styles.input} keyboardType="numeric" value={rewardPoints} onChangeText={setRewardPoints} />

      <Text style={styles.label}>Промокод (необязательно)</Text>
      <TextInput
        style={styles.input}
        value={promocode}
        onChangeText={setPromocode}
        placeholder="SUMMER2025"
        autoCapitalize="characters"
      />

      <Text style={styles.label}>Множитель за фото</Text>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        value={photoBonusMultiplier}
        onChangeText={setPhotoBonusMultiplier}
      />

      <TouchableOpacity
        style={styles.checkboxRow}
        onPress={() => setPhotoRequired((v) => !v)}
      >
        <View style={[styles.checkbox, photoRequired && styles.checkboxActive]} />
        <Text style={styles.checkboxLabel}>Фото обязательно для зачёта квеста</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitButtonText}>Создать</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48, gap: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginTop: 16, marginBottom: 4 },
  label: { fontSize: 13, color: '#555', marginTop: 8 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 15 },
  multiline: { minHeight: 60, textAlignVertical: 'top' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, backgroundColor: '#eee' },
  chipActive: { backgroundColor: '#2ecc71' },
  chipText: { color: '#333' },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 10 },
  checkbox: {
    width: 20, height: 20, borderRadius: 4,
    borderWidth: 2, borderColor: '#888',
  },
  checkboxActive: { backgroundColor: '#2ecc71', borderColor: '#2ecc71' },
  checkboxLabel: { fontSize: 14 },
  submitButton: {
    marginTop: 24, backgroundColor: '#2ecc71', borderRadius: 10,
    paddingVertical: 16, alignItems: 'center',
  },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});