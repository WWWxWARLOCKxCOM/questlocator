import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  Alert, ActivityIndicator, Image,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { AdminStackParamList } from '@/navigation/AdminNavigator';
import { createPlace } from '@/services/placesService';
import { createQuest } from '@/services/questService';
import { subscribeToAllVenues } from '@/services/venueService';
import TaskConstructor from '@/components/TaskConstructor';
import LevelConstructor, { DEFAULT_LEVEL_CONFIG } from '@/components/LevelConstructor';
import {
  PlaceCategory,
  VenueAccount,
  QuestTask,
  LevelConfig,
  CATEGORY_LABELS,
  ALL_CATEGORIES,
} from '@/types';

type Nav = NativeStackNavigationProp<AdminStackParamList, 'AdminPlaceForm'>;
type Rt = RouteProp<AdminStackParamList, 'AdminPlaceForm'>;

const RADIUS_PRESETS = [25, 50, 100, 200];

export default function AdminPlaceFormScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { latitude, longitude } = route.params;

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [category, setCategory] = useState<PlaceCategory>('cafe');
  const [radius, setRadius] = useState(50);

  const [website, setWebsite] = useState('');
  const [phone, setPhone] = useState('');
  const [averageCheck, setAverageCheck] = useState('');
  const [menuPdfUrl, setMenuPdfUrl] = useState('');

  const [venues, setVenues] = useState<VenueAccount[]>([]);
  const [ownerUid, setOwnerUid] = useState<string | null>(null);

  const [minTime, setMinTime] = useState('30');
  const [maxTime, setMaxTime] = useState('180');
  const [rewardPoints, setRewardPoints] = useState('100');
  const [promocode, setPromocode] = useState('');
  const [photoRequired, setPhotoRequired] = useState(false);
  const [photoBonusMultiplier, setPhotoBonusMultiplier] = useState('1.3');

  const [tasks, setTasks] = useState<QuestTask[]>([]);
  const [levels, setLevels] = useState<LevelConfig>(DEFAULT_LEVEL_CONFIG);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const isFood = category === 'cafe' || category === 'restaurant';

  useEffect(() => {
    return subscribeToAllVenues(setVenues);
  }, []);

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
        // сеть/геокодер недоступны — оставляем поле пустым
      }
    })();
  }, [latitude, longitude]);

  const handlePickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Нет доступа к галерее');

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (result.canceled) return;
    setPhotoUri(result.assets[0].uri);
  };

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

    for (const t of tasks) {
      if (!t.title.trim()) {
        return Alert.alert('Ошибка', 'У каждого задания должен быть заголовок');
      }
      if (t.type === 'questionnaire') {
        const qs = t.questions ?? [];
        if (qs.length === 0 || qs.some((q) => !q.text.trim())) {
          return Alert.alert('Ошибка', 'Заполните все вопросы или удалите задание');
        }
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
        category,
        latitude,
        longitude,
        radiusMeters: radius,
        isActive: true,
        ownerUid,
        levels,
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
        tasks,
        isActive: true,
      });

      Alert.alert(
        'Готово',
        'Точка, квест, задания и уровни созданы.',
        [{ text: 'ОК', onPress: () => navigation.goBack() }],
      );
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось создать точку');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.sectionTitle}>Заведение</Text>

      <Text style={styles.label}>Фото заведения</Text>
      <TouchableOpacity style={styles.photoBox} onPress={handlePickPhoto}>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.photoPreview} />
        ) : (
          <Text style={styles.photoHint}>Нажмите, чтобы выбрать фото</Text>
        )}
      </TouchableOpacity>
      {photoUri && (
        <TouchableOpacity onPress={() => setPhotoUri(null)}>
          <Text style={styles.removePhoto}>Удалить фото</Text>
        </TouchableOpacity>
      )}

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

      <Text style={styles.label}>Описание</Text>
      <TextInput
        style={[styles.input, styles.multiline, { minHeight: 90 }]}
        value={description}
        onChangeText={setDescription}
        multiline
        placeholder="Пара слов о заведении, что здесь можно найти и т.д."
      />

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

      <Text style={styles.sectionTitle}>Владелец точки</Text>
      <Text style={styles.help}>
        Только админ может подвязать точку к аккаунту заведения. Если оставить
        «Без владельца», точка будет числиться за админом.
      </Text>
      <View style={styles.chipsRow}>
        <TouchableOpacity
          style={[styles.chip, ownerUid === null && styles.chipActive]}
          onPress={() => setOwnerUid(null)}
        >
          <Text style={ownerUid === null ? styles.chipTextActive : styles.chipText}>
            Без владельца (админ)
          </Text>
        </TouchableOpacity>
        {venues.map((v) => (
          <TouchableOpacity
            key={v.uid}
            style={[styles.chip, ownerUid === v.uid && styles.chipActive]}
            onPress={() => setOwnerUid(v.uid)}
          >
            <Text style={ownerUid === v.uid ? styles.chipTextActive : styles.chipText}>
              {v.companyName} ({v.pointsUsed}/{v.pointsLimit})
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {venues.length === 0 && (
        <Text style={styles.help}>
          Пока нет аккаунтов заведений. Создайте их в разделе «Заведения» админ-панели.
        </Text>
      )}

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

      {/* ─── Конструктор заданий ─── */}
      <TaskConstructor tasks={tasks} onChange={setTasks} />

      {/* ─── Конструктор уровней ─── */}
      <LevelConstructor value={levels} onChange={setLevels} />

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
  help: { fontSize: 12, color: '#888', marginTop: 4, lineHeight: 16 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 15 },
  multiline: { minHeight: 60, textAlignVertical: 'top' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
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

  photoBox: {
    width: '100%', height: 180, borderRadius: 10,
    backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  photoPreview: { width: '100%', height: '100%' },
  photoHint: { color: '#888' },
  removePhoto: { color: '#e74c3c', marginTop: 6, textAlign: 'center' },
});