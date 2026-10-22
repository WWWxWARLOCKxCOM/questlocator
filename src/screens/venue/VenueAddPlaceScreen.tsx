import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  Alert, ActivityIndicator, Image,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { VenueStackParamList } from '@/navigation/VenueNavigator';
import { createPlace } from '@/services/placesService';
import { createQuest } from '@/services/questService';
import TaskConstructor from '@/components/TaskConstructor';
import LevelConstructor, { DEFAULT_LEVEL_CONFIG } from '@/components/LevelConstructor';
import {
  PlaceCategory, CATEGORY_LABELS, ALL_CATEGORIES, QuestTask, LevelConfig,
} from '@/types';

type Rt = RouteProp<VenueStackParamList, 'VenueAddPlace'>;

const RADIUS_PRESETS = [25, 50, 100, 200];

export default function VenueAddPlaceScreen() {
  const navigation = useNavigation();
  const route = useRoute<Rt>();
  
  // Извлекаем address из параметров (передается с карты)
  const { latitude, longitude, address: initialAddress } = route.params;

  // Заведение
  const [name, setName] = useState('');
  // Инициализируем сразу переданным адресом
  const [address, setAddress] = useState(initialAddress || '');
  const [description, setDescription] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [category, setCategory] = useState<PlaceCategory>('cafe');
  const [radius, setRadius] = useState(50);

  // Контакты и меню
  const [website, setWebsite] = useState('');
  const [phone, setPhone] = useState('');
  const [averageCheck, setAverageCheck] = useState('');
  const [menuPdfUrl, setMenuPdfUrl] = useState('');

  // Квест
  const [minTime, setMinTime] = useState('30');
  const [maxTime, setMaxTime] = useState('180');
  const [rewardPoints, setRewardPoints] = useState('100');
  const [promocode, setPromocode] = useState('');
  const [photoBonusMultiplier, setPhotoBonusMultiplier] = useState('1.3');
  const [photoRequired, setPhotoRequired] = useState(false);

  // Задания и уровни
  const [tasks, setTasks] = useState<QuestTask[]>([]);
  const [levels, setLevels] = useState<LevelConfig>(DEFAULT_LEVEL_CONFIG);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const isFood = category === 'cafe' || category === 'restaurant';

  useEffect(() => {
    // Если адрес уже передан с карты — не делаем лишний запрос
    if (initialAddress) return;

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
        // адрес можно ввести вручную
      }
    })();
  }, [latitude, longitude, initialAddress]);

  const handlePickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Нет доступа к галерее');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [16, 9], quality: 0.8,
    });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  };

  const handleSubmit = async () => {
    if (!name.trim()) return Alert.alert('Введите название');
    if (!address.trim()) return Alert.alert('Введите адрес');

    const minT = Number(minTime);
    const maxT = Number(maxTime);
    const pts = Number(rewardPoints);
    const mult = Number(photoBonusMultiplier);

    if (minT <= 0 || maxT < minT) return Alert.alert('Некорректное время квеста');
    if (pts < 0) return Alert.alert('Некорректные баллы');
    if (mult < 1) return Alert.alert('Множитель ≥ 1');

    for (const t of tasks) {
      if (!t.title.trim()) {
        return Alert.alert('Задание без заголовка', 'Заполните заголовок у всех заданий');
      }
      if (t.type === 'questionnaire') {
        const qs = t.questions ?? [];
        if (qs.length === 0 || qs.some((q) => !q.text.trim())) {
          return Alert.alert('Пустые вопросы', 'Заполните все вопросы или удалите задание');
        }
      }
    }

    if (levels.enabled) {
      if (levels.completionsPerLevel < 1) {
        return Alert.alert('Ошибка', 'Прохождений на уровень должно быть ≥ 1');
      }
      if (levels.maxLevel < 2) {
        return Alert.alert('Ошибка', 'Максимум уровней должен быть ≥ 2');
      }
      if ((levels.discounts?.length ?? 0) !== levels.maxLevel) {
        return Alert.alert('Ошибка', 'Число скидок должно совпадать с максимумом уровней');
      }
    }

    setIsSubmitting(true);
    try {
      const placeId = await createPlace({
        name: name.trim(),
        address: address.trim(),
        description: description.trim(),
        photoUri: photoUri ?? undefined,
        website: website.trim() || undefined,
        phone: phone.trim() || undefined,
        averageCheck: isFood && averageCheck ? Number(averageCheck) : undefined,
        menuPdfUrl: isFood && menuPdfUrl.trim() ? menuPdfUrl.trim() : undefined,
        latitude,
        longitude,
        category,
        radiusMeters: radius,
        isActive: true,
        levels,
      });

      await createQuest({
        placeId,
        minTimeMinutes: minT,
        maxTimeMinutes: maxT,
        rewardPoints: pts,
        promocode: promocode.trim() || undefined,
        photoBonusMultiplier: mult,
        photoRequired,
        referenceImages: [],
        tasks,
        isActive: true,
      });

      Alert.alert('Готово', 'Точка и квест созданы.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось создать точку');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.coordHint}>
        Координаты: {latitude.toFixed(6)}, {longitude.toFixed(6)}
      </Text>

      <Text style={styles.sectionTitle}>Заведение</Text>

      <Text style={styles.label}>Фото</Text>
      <TouchableOpacity style={styles.photoBox} onPress={handlePickPhoto}>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.photoPreview} />
        ) : (
          <Text style={styles.photoHint}>Нажмите, чтобы выбрать фото</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.label}>Название</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Название" />

      <Text style={styles.label}>Адрес</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={address}
        onChangeText={setAddress}
        multiline
      />

      <Text style={styles.label}>Описание</Text>
      <TextInput
        style={[styles.input, styles.multiline, { minHeight: 90 }]}
        value={description}
        onChangeText={setDescription}
        multiline
        placeholder="О заведении"
      />

      <Text style={styles.sectionTitle}>Контакты и меню</Text>

      <Text style={styles.label}>Сайт</Text>
      <TextInput
        style={styles.input}
        value={website}
        onChangeText={setWebsite}
        placeholder="https://example.com"
        keyboardType="url"
        autoCapitalize="none"
        autoCorrect={false}
      />

      <Text style={styles.label}>Телефон</Text>
      <TextInput
        style={styles.input}
        value={phone}
        onChangeText={setPhone}
        placeholder="+7 900 000 00 00"
        keyboardType="phone-pad"
      />

      {isFood && (
        <>
          <Text style={styles.label}>Средний чек, ₽</Text>
          <TextInput
            style={styles.input}
            value={averageCheck}
            onChangeText={setAverageCheck}
            placeholder="500"
            keyboardType="numeric"
          />

          <Text style={styles.label}>Ссылка на меню (PDF)</Text>
          <TextInput
            style={styles.input}
            value={menuPdfUrl}
            onChangeText={setMenuPdfUrl}
            placeholder="https://example.com/menu.pdf"
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </>
      )}

      <Text style={styles.label}>Категория</Text>
      <View style={styles.chipsRow}>
        {ALL_CATEGORIES.map((c) => (
          <TouchableOpacity
            key={c}
            style={[styles.chip, category === c && styles.chipActive]}
            onPress={() => setCategory(c)}
          >
            <Text style={category === c ? styles.chipTextActive : styles.chipText}>
              {CATEGORY_LABELS[c]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Радиус (м)</Text>
      <View style={styles.chipsRow}>
        {RADIUS_PRESETS.map((r) => (
          <TouchableOpacity
            key={r}
            style={[styles.chip, radius === r && styles.chipActive]}
            onPress={() => setRadius(r)}
          >
            <Text style={radius === r ? styles.chipTextActive : styles.chipText}>{r}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Квест</Text>

      <Text style={styles.label}>Мин. время (мин)</Text>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        value={minTime}
        onChangeText={setMinTime}
      />

      <Text style={styles.label}>Макс. время (мин)</Text>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        value={maxTime}
        onChangeText={setMaxTime}
      />

      <Text style={styles.label}>Баллы за время</Text>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        value={rewardPoints}
        onChangeText={setRewardPoints}
      />

      <Text style={styles.label}>Промокод (необязательно)</Text>
      <TextInput
        style={styles.input}
        value={promocode}
        onChangeText={setPromocode}
        autoCapitalize="characters"
      />

      <Text style={styles.label}>Множитель за фото</Text>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        value={photoBonusMultiplier}
        onChangeText={setPhotoBonusMultiplier}
      />

      <TouchableOpacity style={styles.checkboxRow} onPress={() => setPhotoRequired((v) => !v)}>
        <View style={[styles.checkbox, photoRequired && styles.checkboxActive]} />
        <Text>Фото обязательно для зачёта квеста</Text>
      </TouchableOpacity>

      <TaskConstructor tasks={tasks} onChange={setTasks} />
      <LevelConstructor value={levels} onChange={setLevels} />

      <TouchableOpacity
        style={[styles.submit, isSubmitting && { opacity: 0.6 }]}
        onPress={handleSubmit}
        disabled={isSubmitting}
      >
        {isSubmitting
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.submitText}>Создать</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48, gap: 8 },
  coordHint: { color: '#888', fontSize: 12, textAlign: 'center', marginBottom: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginTop: 16, marginBottom: 4 },
  label: { fontSize: 13, color: '#555', marginTop: 8 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 15 },
  multiline: { minHeight: 60, textAlignVertical: 'top' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, backgroundColor: '#eee' },
  chipActive: { backgroundColor: '#2c3e50' },
  chipText: { color: '#333' },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: '#888' },
  checkboxActive: { backgroundColor: '#2c3e50', borderColor: '#2c3e50' },
  submit: {
    marginTop: 24, backgroundColor: '#2c3e50', borderRadius: 10,
    paddingVertical: 16, alignItems: 'center',
  },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  photoBox: {
    width: '100%', height: 180, borderRadius: 10, backgroundColor: '#f0f0f0',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  photoPreview: { width: '100%', height: '100%' },
  photoHint: { color: '#888' },
});