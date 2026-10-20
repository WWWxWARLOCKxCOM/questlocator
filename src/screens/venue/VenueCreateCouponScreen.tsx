import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  Alert, ActivityIndicator, Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/config/firebase';
import { useTheme } from '@/context/ThemeContext';
import { createCoupon } from '@/services/couponService';

export default function VenueCreateCouponScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [pricePoints, setPricePoints] = useState('100');
  const [maxPurchases, setMaxPurchases] = useState('0');
  const [expiresInDays, setExpiresInDays] = useState('0');
  const [validForDays, setValidForDays] = useState('30');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      let photoUrl: string | undefined;
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

      await createCoupon({
        title: title.trim(),
        description: description.trim(),
        photoUrl,
        pricePoints: pts,
        maxPurchases: Number(maxPurchases) || 0,
        expiresAt,
        validUntil,
      });

      Alert.alert('Готово', 'Купон создан', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось сохранить');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.label, { color: colors.textMuted }]}>Фото</Text>
      <TouchableOpacity style={styles.photoBox} onPress={handlePickPhoto}>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.photoPreview} />
        ) : (
          <Text style={[styles.photoHint, { color: colors.textMuted }]}>
            Нажмите, чтобы выбрать фото
          </Text>
        )}
      </TouchableOpacity>

      <Text style={[styles.label, { color: colors.textMuted }]}>Название</Text>
      <TextInput
        style={[styles.input, { color: colors.text, borderColor: colors.border }]}
        value={title} onChangeText={setTitle}
      />

      <Text style={[styles.label, { color: colors.textMuted }]}>Описание</Text>
      <TextInput
        style={[styles.input, styles.multiline, { color: colors.text, borderColor: colors.border }]}
        value={description} onChangeText={setDescription} multiline
      />

      <Text style={[styles.label, { color: colors.textMuted }]}>Цена в баллах</Text>
      <TextInput
        style={[styles.input, { color: colors.text, borderColor: colors.border }]}
        keyboardType="numeric" value={pricePoints} onChangeText={setPricePoints}
      />

      <Text style={[styles.label, { color: colors.textMuted }]}>
        Максимум покупок (0 = без ограничений)
      </Text>
      <TextInput
        style={[styles.input, { color: colors.text, borderColor: colors.border }]}
        keyboardType="numeric" value={maxPurchases} onChangeText={setMaxPurchases}
      />

      <Text style={[styles.label, { color: colors.textMuted }]}>
        В магазине, дней (0 = бессрочно)
      </Text>
      <TextInput
        style={[styles.input, { color: colors.text, borderColor: colors.border }]}
        keyboardType="numeric" value={expiresInDays} onChangeText={setExpiresInDays}
      />

      <Text style={[styles.label, { color: colors.textMuted }]}>
        Срок действия после покупки, дней
      </Text>
      <TextInput
        style={[styles.input, { color: colors.text, borderColor: colors.border }]}
        keyboardType="numeric" value={validForDays} onChangeText={setValidForDays}
      />

      <TouchableOpacity
        style={[styles.submit, { backgroundColor: colors.primary }, isSubmitting && { opacity: 0.6 }]}
        onPress={handleSubmit}
        disabled={isSubmitting}
      >
        {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Создать</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48, gap: 8 },
  label: { fontSize: 13, marginTop: 8 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 15 },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  photoBox: {
    width: '100%', height: 180, borderRadius: 10,
    backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  photoPreview: { width: '100%', height: '100%' },
  photoHint: {},
  submit: {
    marginTop: 24, borderRadius: 10,
    paddingVertical: 16, alignItems: 'center',
  },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});