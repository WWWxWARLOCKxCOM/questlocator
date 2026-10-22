import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { subscribeToPlacesByOwner } from '@/services/placesService';
import { createEvent } from '@/services/eventService';
import { Place } from '@/types';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function VenueCreateEventScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { colors } = useTheme();
  
  const [places, setPlaces] = useState<Place[]>([]);
  const [selectedPlaceIds, setSelectedPlaceIds] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  
  // Формат: YYYY-MM-DD HH:MM
  const [startStr, setStartStr] = useState('');
  const [endStr, setEndStr] = useState('');
  
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    return subscribeToPlacesByOwner(user.uid, setPlaces);
  }, [user]);

  const togglePlace = (id: string) => {
    setSelectedPlaceIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSubmit = async () => {
    if (!title.trim() || selectedPlaceIds.length === 0 || !startStr || !endStr) {
      return Alert.alert('Ошибка', 'Заполните название, выберите точки и укажите время');
    }
    
    const startTime = new Date(startStr).getTime();
    const endTime = new Date(endStr).getTime();
    
    if (isNaN(startTime) || isNaN(endTime) || endTime <= startTime) {
      return Alert.alert('Ошибка', 'Некорректное время. Используйте формат 2024-12-31 18:00');
    }

    setLoading(true);
    try {
      await createEvent({
        placeIds: selectedPlaceIds,
        title: title.trim(),
        description: description.trim(),
        linkUrl: linkUrl.trim(),
        startTime,
        endTime
      });
      Alert.alert('Успех', 'Мероприятие создано!', [{ text: 'ОК', onPress: () => navigation.goBack() }]);
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message || 'Не удалось создать');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.label, { color: colors.textMuted }]}>Где проходит (выберите точки)</Text>
      {places.map(p => (
        <TouchableOpacity key={p.id} style={[styles.placeRow, { backgroundColor: colors.surface, borderColor: selectedPlaceIds.includes(p.id) ? colors.primary : colors.border }]} onPress={() => togglePlace(p.id)}>
          <MaterialCommunityIcons name={selectedPlaceIds.includes(p.id) ? "checkbox-marked" : "checkbox-blank-outline"} size={24} color={selectedPlaceIds.includes(p.id) ? colors.primary : colors.textMuted} />
          <Text style={[styles.placeName, { color: colors.text }]}>{p.name}</Text>
        </TouchableOpacity>
      ))}

      <Text style={[styles.label, { color: colors.textMuted }]}>Название мероприятия *</Text>
      <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border }]} value={title} onChangeText={setTitle} placeholder="Например: Ночь скидок" placeholderTextColor={colors.textMuted} />

      <Text style={[styles.label, { color: colors.textMuted }]}>Описание</Text>
      <TextInput style={[styles.input, styles.multiline, { color: colors.text, borderColor: colors.border }]} value={description} onChangeText={setDescription} multiline placeholder="Что будет на мероприятии" placeholderTextColor={colors.textMuted} />

      <Text style={[styles.label, { color: colors.textMuted }]}>Ссылка (билеты, подробности, PDF)</Text>
      <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border }]} value={linkUrl} onChangeText={setLinkUrl} placeholder="https://..." keyboardType="url" autoCapitalize="none" />

      <Text style={[styles.label, { color: colors.textMuted }]}>Начало (YYYY-MM-DD HH:MM) *</Text>
      <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border }]} value={startStr} onChangeText={setStartStr} placeholder="2024-12-31 18:00" />

      <Text style={[styles.label, { color: colors.textMuted }]}>Конец (YYYY-MM-DD HH:MM) *</Text>
      <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border }]} value={endStr} onChangeText={setEndStr} placeholder="2024-12-31 23:00" />

      <TouchableOpacity style={[styles.btn, { backgroundColor: colors.primary }, loading && { opacity: 0.6 }]} onPress={handleSubmit} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Создать</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 8 },
  label: { fontSize: 13, marginTop: 8, fontWeight: '600' },
  placeRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderWidth: 1, borderRadius: 8, marginBottom: 6, gap: 10 },
  placeName: { fontSize: 15, fontWeight: '500' },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 15 },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  btn: { marginTop: 24, padding: 16, borderRadius: 10, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});