import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  Alert, ActivityIndicator, Image,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { doc, onSnapshot } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/config/firebase';
import { VenueStackParamList } from '@/navigation/VenueNavigator';
import { updatePlace } from '@/services/placesService';
import { updateQuest } from '@/services/questService';
import TaskConstructor from '@/components/TaskConstructor';
import LevelConstructor, { DEFAULT_LEVEL_CONFIG } from '@/components/LevelConstructor';
import {
  PlaceCategory, QuestTask, LevelConfig,
  CATEGORY_LABELS, ALL_CATEGORIES,
} from '@/types';

type Rt = RouteProp<VenueStackParamList, 'VenueEditPlace'>;

const RADIUS_PRESETS = [25, 50, 100, 200];

export default function VenueEditPlaceScreen() {
  const navigation = useNavigation();
  const route = useRoute<Rt>();
  const { placeId } = route.params;

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ─── Данные точки ───
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null); // новый локальный uri
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(null);
  const [category, setCategory] = useState<PlaceCategory>('cafe');
  const [radius, setRadius] = useState(50);
  const [website, setWebsite] = useState('');
  const [phone, setPhone] = useState('');
  const [averageCheck, setAverageCheck] = useState('');
  const [menuPdfUrl, setMenuPdfUrl] = useState('');
  const [levels, setLevels] = useState<LevelConfig>(DEFAULT_LEVEL_CONFIG);

  // ─── Данные квеста ───
  const [questId, setQuestId] = useState<string | null>(null);
  const [minTime, setMinTime] = useState('30');
  const [maxTime, setMaxTime] = useState('180');
  const [rewardPoints, setRewardPoints] = useState('100');
  const [promocode, setPromocode] = useState('');
  const [photoBonusMultiplier, setPhotoBonusMultiplier] = useState('1.3');
  const [photoRequired, setPhotoRequired] = useState(false);
  const [tasks, setTasks] = useState<QuestTask[]>([]);

  useEffect(() => {
    // Подписка на документ точки
    const unsubPlace = onSnapshot(doc(db, 'places', placeId), (snap) => {
      if (!snap.exists()) {
        Alert.alert('Ошибка', 'Точка не найдена');
        navigation.goBack();
        return;
      }
      const d = snap.data()!;
      setName(d.name ?? '');
      setAddress(d.address ?? '');
      setDescription(d.description ?? '');
      setExistingPhotoUrl(d.photoUrl ?? null);
      setCategory(d.category ?? 'cafe');
      setRadius(typeof d.radiusMeters === 'number' ? d.radiusMeters : 50);
      setWebsite(d.website ?? '');
      setPhone(d.phone ?? '');
      setAverageCheck(typeof d.averageCheck === 'number' ? String(d.averageCheck) : '');
      setMenuPdfUrl(d.menuPdfUrl ?? '');
      setLevels(d.levels ?? DEFAULT_LEVEL_CONFIG);
      setIsLoading(false);
    });

    // Подписка на квест (любой с этим placeId)
    const unsubQuest = onSnapshot(
      doc(db, 'quests', '__probe__'), // заглушка, ниже подписка на нужный
      () => {},
    );
    // Отдельная подписка на список квестов (Firestore не позволяет where без индекса на клиенте без него)
    // Запросим документ через getDocs один раз
    return () => {
      unsubPlace();
      unsubQuest();
    };
  }, [placeId, navigation]);

  // Загрузка квеста отдельно, потому что onSnapshot(doc) не годится для поиска по полю
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { getDocs, collection, query, where, limit } = await import('firebase/firestore');
      const q = query(
        collection(db, 'quests'),
        where('placeId', '==', placeId),
        limit(1),
      );
      const snap = await getDocs(q);
      if (cancelled) return;
      if (!snap.empty) {
        const d = snap.docs[0];
        const data = d.data();
        setQuestId(d.id);
        setMinTime(String(data.minTimeMinutes ?? 30));
        setMaxTime(String(data.maxTimeMinutes ?? 180));
        setRewardPoints(String(data.rewardPoints ?? 100));
        setPromocode(data.promocode ?? '');
        setPhotoBonusMultiplier(String(data.photoBonusMultiplier ?? 1.3));
        setPhotoRequired(!!data.photoRequired);
        setTasks(Array.isArray(data.tasks) ? data.tasks : []);
      }
    })();
    return () => { cancelled = true; };
  }, [placeId]);

  const isFood = category === 'cafe' || category === 'restaurant';

  const handlePickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Нет доступа к галерее');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [16, 9], quality: 0.8,
    });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  };

  const handleSave = async () => {
    if (!name.trim()) return Alert.alert('Введите название');
    if (!address.trim()) return Alert.alert('Введите адрес');

    const minT = Number(minTime);
    const maxT = Number(maxTime);
    const pts = Number(rewardPoints);
    const mult = Number(photoBonusMultiplier);

    if (minT <= 0 || maxT < minT) return Alert.alert('Некорректное время');
    if (pts < 0) return Alert.alert('Некорректные баллы');
    if (mult < 1) return Alert.alert('Множитель ≥ 1');

    setIsSubmitting(true);
    try {
      // 1. Обновляем точку
      await updatePlace(placeId, {
        name: name.trim(),
        address: address.trim(),
        description: description.trim(),
        category,
        radiusMeters: radius,
        website: website.trim(),
        phone: phone.trim(),
        averageCheck: isFood && averageCheck ? Number(averageCheck) : undefined,
        menuPdfUrl: isFood && menuPdfUrl.trim() ? menuPdfUrl.trim() : undefined,
        levels,
      });

      // 2. Если выбрано новое фото — загружаем и обновляем
      if (photoUri) {
        try {
          const blob = await (await fetch(photoUri)).blob();
          const path = `places-photos/${placeId}/main_${Date.now()}.jpg`;
          const fileRef = storageRef(storage, path);
          await uploadBytes(fileRef, blob, { contentType: 'image/jpeg' });
          const url = await getDownloadURL(fileRef);
          const { httpsCallable } = await import('firebase/functions');
          const { functions } = await import('@/config/firebase');
          const fn = httpsCallable(functions, 'updatePlacePhoto');
          await fn({ placeId, photoUrl: url });
          setExistingPhotoUrl(url);
        } catch (e: any) {
          // eslint-disable-next-line no-console
          console.warn('[edit place] photo upload failed:', e?.message);
        }
      }

      // 3. Обновляем квест, если он есть
      if (questId) {
        await updateQuest(questId, {
          minTimeMinutes: minT,
          maxTimeMinutes: maxT,
          rewardPoints: pts,
          promocode: promocode.trim() || undefined,
          photoBonusMultiplier: mult,
          photoRequired,
          tasks,
        } as any);
      }

      Alert.alert('Готово', 'Изменения сохранены', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось сохранить');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.sectionTitle}>Заведение</Text>

      <Text style={styles.label}>Фото</Text>
      <TouchableOpacity style={styles.photoBox} onPress={handlePickPhoto}>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.photoPreview} />
        ) : existingPhotoUrl ? (
          <Image source={{ uri: existingPhotoUrl }} style={styles.photoPreview} />
        ) : (
          <Text style={styles.photoHint}>Нажмите, чтобы выбрать фото</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.label}>Название</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} />

      <Text style={styles.label}>Адрес</Text>
      <TextInput style={[styles.input, styles.multiline]} value={address} onChangeText={setAddress} multiline />

      <Text style={styles.label}>Описание</Text>
      <TextInput
        style={[styles.input, styles.multiline, { minHeight: 90 }]}
        value={description} onChangeText={setDescription} multiline
      />

      <Text style={styles.sectionTitle}>Контакты и меню</Text>

      <Text style={styles.label}>Сайт</Text>
      <TextInput style={styles.input} value={website} onChangeText={setWebsite} placeholder="https://example.com" keyboardType="url" autoCapitalize="none" />

      <Text style={styles.label}>Телефон</Text>
      <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="+7 900 000 00 00" keyboardType="phone-pad" />

      {isFood && (
        <>
          <Text style={styles.label}>Средний чек, ₽</Text>
          <TextInput style={styles.input} value={averageCheck} onChangeText={setAverageCheck} placeholder="500" keyboardType="numeric" />

          <Text style={styles.label}>Ссылка на меню (PDF)</Text>
          <TextInput style={styles.input} value={menuPdfUrl} onChangeText={setMenuPdfUrl} placeholder="https://example.com/menu.pdf" keyboardType="url" autoCapitalize="none" />
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
      <TextInput style={styles.input} keyboardType="numeric" value={minTime} onChangeText={setMinTime} />

      <Text style={styles.label}>Макс. время (мин)</Text>
      <TextInput style={styles.input} keyboardType="numeric" value={maxTime} onChangeText={setMaxTime} />

      <Text style={styles.label}>Баллы за время</Text>
      <TextInput style={styles.input} keyboardType="numeric" value={rewardPoints} onChangeText={setRewardPoints} />

      <Text style={styles.label}>Промокод</Text>
      <TextInput style={styles.input} value={promocode} onChangeText={setPromocode} autoCapitalize="characters" />

      <Text style={styles.label}>Множитель за фото</Text>
      <TextInput style={styles.input} keyboardType="numeric" value={photoBonusMultiplier} onChangeText={setPhotoBonusMultiplier} />

      <TouchableOpacity style={styles.checkboxRow} onPress={() => setPhotoRequired((v) => !v)}>
        <View style={[styles.checkbox, photoRequired && styles.checkboxActive]} />
        <Text>Фото обязательно</Text>
      </TouchableOpacity>

      <TaskConstructor tasks={tasks} onChange={setTasks} />

      <LevelConstructor value={levels} onChange={setLevels} />

      <TouchableOpacity
        style={[styles.submit, isSubmitting && { opacity: 0.6 }]}
        onPress={handleSave}
        disabled={isSubmitting}
      >
        {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Сохранить</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: 16, paddingBottom: 48, gap: 8 },
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