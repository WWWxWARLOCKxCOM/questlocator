import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  Alert, ActivityIndicator, Image, Switch,
} from 'react-native';
import {
  useNavigation, useRoute, RouteProp,
} from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, getDoc } from 'firebase/firestore';
import { db, storage } from '@/config/firebase';
import { AdminStackParamList } from '@/navigation/AdminNavigator';
import { useTheme } from '@/context/ThemeContext';
import { createCoupon, updateCoupon } from '@/services/couponService';

type Rt = RouteProp<AdminStackParamList, 'AdminCreateCoupon'>;

export default function AdminCreateCouponScreen() {
  const navigation = useNavigation();
  const route = useRoute<Rt>();
  const { colors } = useTheme();
  const editingId = route.params?.couponId;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(null);
  const [pricePoints, setPricePoints] = useState('100');
  const [maxPurchases, setMaxPurchases] = useState('0');
  const [maxPerUser, setMaxPerUser] = useState('0');
  const [cooldownHours, setCooldownHours] = useState('0');
  const [expiresInDays, setExpiresInDays] = useState('0');
  const [validForDays, setValidForDays] = useState('30');
  const [isActive, setIsActive] = useState(true);
  const [isLoading, setIsLoading] = useState(!!editingId);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!editingId) return;
    (async () => {
      const snap = await getDoc(doc(db, 'coupons', editingId));
      if (!snap.exists()) {
        Alert.alert('Ошибка', 'Купон не найден');
        navigation.goBack();
        return;
      }
      const d = snap.data();
      setTitle(d.title ?? '');
      setDescription(d.description ?? '');
      setExistingPhotoUrl(d.photoUrl ?? null);
      setPricePoints(String(d.pricePoints ?? 100));
      setMaxPurchases(String(d.maxPurchases ?? 0));
      setMaxPerUser(String(d.maxPerUser ?? 0));
      setCooldownHours(String(d.cooldownHours ?? 0));
      setIsActive(d.isActive !== false);
      setIsLoading(false);
    })();
  }, [editingId, navigation]);

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
    if (!title.trim()) return Alert.alert('Введите название');
    const pts = Number(pricePoints);
    if (!Number.isFinite(pts) || pts < 0) return Alert.alert('Некорректная цена');

    setIsSubmitting(true);
    try {
      let photoUrl: string | undefined = existingPhotoUrl ?? undefined;
      if (photoUri) {
        const blob = await (await fetch(photoUri)).blob();
        const path = `coupon-photos/${Date.now()}.jpg`;
        const fileRef = storageRef(storage, path);
        await uploadBytes(fileRef, blob, { contentType: 'image/jpeg' });
        photoUrl = await getDownloadURL(fileRef);
      }

      const now = Date.now();
      const expiresAt = Number(expiresInDays) > 0
        ? now + Number(expiresInDays) * 24 * 60 * 60 * 1000
        : undefined;
      const validUntil = Number(validForDays) > 0
        ? now + Number(validForDays) * 24 * 60 * 60 * 1000
        : undefined;

      const input = {
        title: title.trim(),
        description: description.trim(),
        photoUrl,
        pricePoints: pts,
        maxPurchases: Number(maxPurchases) || 0,
        maxPerUser: Number(maxPerUser) || 0,
        cooldownHours: Number(cooldownHours) || 0,
        expiresAt,
        validUntil,
      };

      if (editingId) {
        await updateCoupon(editingId, input as any);
        await updateCoupon(editingId, { isActive } as any);
      } else {
        await createCoupon(input);
      }

      Alert.alert('Готово', editingId ? 'Купон обновлён' : 'Купон создан', [
        { text: 'ОК', onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось сохранить');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { backgroundColor: colors.background },
      ]}
    >
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Купон</Text>

      <Text style={[styles.label, { color: colors.textMuted }]}>Фото</Text>
      <TouchableOpacity style={styles.photoBox} onPress={handlePickPhoto}>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.photoPreview} />
        ) : existingPhotoUrl ? (
          <Image source={{ uri: existingPhotoUrl }} style={styles.photoPreview} />
        ) : (
          <Text style={[styles.photoHint, { color: colors.textMuted }]}>
            Нажмите, чтобы выбрать фото
          </Text>
        )}
      </TouchableOpacity>

      <Text style={[styles.label, { color: colors.textMuted }]}>Название</Text>
      <TextInput
        style={[
          styles.input,
          { color: colors.text, borderColor: colors.border },
        ]}
        value={title}
        onChangeText={setTitle}
        placeholder="Например, Кофе в подарок"
        placeholderTextColor={colors.textMuted}
      />

      <Text style={[styles.label, { color: colors.textMuted }]}>Описание</Text>
      <TextInput
        style={[
          styles.input,
          styles.multiline,
          { color: colors.text, borderColor: colors.border },
        ]}
        value={description}
        onChangeText={setDescription}
        multiline
        placeholder="Что даёт купон"
        placeholderTextColor={colors.textMuted}
      />

      <Text style={[styles.label, { color: colors.textMuted }]}>Цена в баллах</Text>
      <TextInput
        style={[
          styles.input,
          { color: colors.text, borderColor: colors.border },
        ]}
        keyboardType="numeric"
        value={pricePoints}
        onChangeText={setPricePoints}
      />

      <Text style={[styles.label, { color: colors.textMuted }]}>
        Максимум покупок (0 = без ограничений)
      </Text>
      <TextInput
        style={[
          styles.input,
          { color: colors.text, borderColor: colors.border },
        ]}
        keyboardType="numeric"
        value={maxPurchases}
        onChangeText={setMaxPurchases}
      />

      <Text style={[styles.label, { color: colors.textMuted }]}>
        Максимум покупок на 1 человека (0 = без ограничений)
      </Text>
      <TextInput
        style={[
          styles.input,
          { color: colors.text, borderColor: colors.border },
        ]}
        keyboardType="numeric"
        value={maxPerUser}
        onChangeText={setMaxPerUser}
      />

      <Text style={[styles.label, { color: colors.textMuted }]}>
        Кулдаун между покупками, часов (0 = сразу)
      </Text>
      <TextInput
        style={[
          styles.input,
          { color: colors.text, borderColor: colors.border },
        ]}
        keyboardType="numeric"
        value={cooldownHours}
        onChangeText={setCooldownHours}
      />

      <Text style={[styles.label, { color: colors.textMuted }]}>
        В магазине, дней (0 = бессрочно)
      </Text>
      <TextInput
        style={[
          styles.input,
          { color: colors.text, borderColor: colors.border },
        ]}
        keyboardType="numeric"
        value={expiresInDays}
        onChangeText={setExpiresInDays}
      />

      <Text style={[styles.label, { color: colors.textMuted }]}>
        Срок действия купона после покупки, дней
      </Text>
      <TextInput
        style={[
          styles.input,
          { color: colors.text, borderColor: colors.border },
        ]}
        keyboardType="numeric"
        value={validForDays}
        onChangeText={setValidForDays}
      />

      {editingId && (
        <View style={styles.switchRow}>
          <Text style={[styles.label, { color: colors.textMuted }]}>
            Активен
          </Text>
          <Switch value={isActive} onValueChange={setIsActive} />
        </View>
      )}

      <TouchableOpacity
        style={[
          styles.submit,
          { backgroundColor: colors.primary },
          isSubmitting && { opacity: 0.6 },
        ]}
        onPress={handleSubmit}
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitText}>
            {editingId ? 'Сохранить' : 'Создать'}
          </Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: 16, paddingBottom: 48, gap: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  label: { fontSize: 13, marginTop: 8 },
  input: {
    borderWidth: 1, borderRadius: 8,
    padding: 12, fontSize: 15,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  photoBox: {
    width: '100%', height: 180, borderRadius: 10,
    backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  photoPreview: { width: '100%', height: '100%' },
  photoHint: {},
  switchRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginTop: 16,
  },
  submit: {
    marginTop: 24, borderRadius: 10,
    paddingVertical: 16, alignItems: 'center',
  },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});