import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, ScrollView, TextInput,
  TouchableOpacity, Alert
} from 'react-native';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { subscribeToVenue } from '@/services/venueService';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { VenueAccount } from '@/types';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function VenueProfileScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [venue, setVenue] = useState<VenueAccount | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Редактируемые поля
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editWebsite, setEditWebsite] = useState('');

  useEffect(() => {
    if (!user) return;
    return subscribeToVenue(user.uid, (v) => {
      setVenue(v);
      if (v && !isEditing) {
        setEditEmail(v.contactEmail || '');
        setEditPhone(v.contactPhone || '');
        setEditWebsite(v.website || '');
      }
    });
  }, [user, isEditing]);

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'venues', user.uid), {
        contactEmail: editEmail.trim(),
        contactPhone: editPhone.trim(),
        website: editWebsite.trim(),
      });
      setIsEditing(false);
      Alert.alert('Успех', 'Контактные данные обновлены');
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message || 'Не удалось сохранить');
    } finally {
      setIsSaving(false);
    }
  };

  if (!venue) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator />
      </View>
    );
  }

  const ReadOnlyField = ({ label, value }: { label: string; value?: string }) => (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.readOnlyText, { color: colors.text }]}>{value || '—'}</Text>
    </View>
  );

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}>
      {/* Блок баланса и лимитов */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.stat, { color: colors.primary }]}>{venue.balance || 0}</Text>
        <Text style={[styles.statLabel, { color: colors.textMuted }]}>Баллов на счету</Text>
        <View style={styles.rowStats}>
           <View style={styles.statBox}>
              <Text style={[styles.statBoxValue, { color: colors.text }]}>{venue.pointsUsed || 0} / {venue.pointsLimit || 0}</Text>
              <Text style={[styles.statBoxLabel, { color: colors.textMuted }]}>Точек</Text>
           </View>
           <View style={styles.statBox}>
              <Text style={[styles.statBoxValue, { color: colors.text }]}>{venue.couponsUsed || 0} / {venue.couponsLimit || 0}</Text>
              <Text style={[styles.statBoxLabel, { color: colors.textMuted }]}>Купонов</Text>
           </View>
        </View>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Данные компании</Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <ReadOnlyField label="Название" value={venue.companyName} />
        <ReadOnlyField label="Регистрационный номер" value={venue.regNumber} />
        <ReadOnlyField label="Страна" value={venue.country} />
        <ReadOnlyField label="Юридический адрес" value={venue.legalAddress} />
        <ReadOnlyField label="ИНН / Налоговый номер" value={venue.taxId} />
        <ReadOnlyField label="Сотрудник" value={`${venue.employeeName} ${venue.employeePosition ? `(${venue.employeePosition})` : ''}`} />
        <ReadOnlyField label="Почта для логина" value={venue.loginEmail} />
      </View>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Контактные данные (можно изменить)</Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {isEditing ? (
          <>
            <Text style={[styles.label, { color: colors.textMuted }]}>Корпоративная почта</Text>
            <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]} value={editEmail} onChangeText={setEditEmail} keyboardType="email-address" autoCapitalize="none" />
            
            <Text style={[styles.label, { color: colors.textMuted }]}>Телефон</Text>
            <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]} value={editPhone} onChangeText={setEditPhone} keyboardType="phone-pad" />
            
            <Text style={[styles.label, { color: colors.textMuted }]}>Сайт</Text>
            <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]} value={editWebsite} onChangeText={setEditWebsite} keyboardType="url" autoCapitalize="none" />

            <View style={styles.editActions}>
              <TouchableOpacity style={[styles.btn, { backgroundColor: colors.surfaceAlt }]} onPress={() => setIsEditing(false)}>
                <Text style={{ color: colors.text }}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, { backgroundColor: colors.primary }]} onPress={handleSave} disabled={isSaving}>
                {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Сохранить</Text>}
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <ReadOnlyField label="Корпоративная почта" value={venue.contactEmail} />
            <ReadOnlyField label="Телефон" value={venue.contactPhone} />
            <ReadOnlyField label="Сайт" value={venue.website} />
            <TouchableOpacity style={[styles.editBtn, { backgroundColor: colors.primary }]} onPress={() => setIsEditing(true)}>
              <MaterialCommunityIcons name="pencil" size={16} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '700', marginLeft: 8 }}>Изменить контакты</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: 16, paddingBottom: 40, gap: 12 },
  card: { borderRadius: 12, borderWidth: 1, padding: 16 },
  stat: { fontSize: 32, fontWeight: '800', textAlign: 'center' },
  statLabel: { textAlign: 'center', marginTop: 4, marginBottom: 16 },
  rowStats: { flexDirection: 'row', gap: 12 },
  statBox: { flex: 1, alignItems: 'center', padding: 12, borderRadius: 8 },
  statBoxValue: { fontSize: 18, fontWeight: '700' },
  statBoxLabel: { fontSize: 12, marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginTop: 12 },
  field: { marginBottom: 12 },
  label: { fontSize: 12, marginBottom: 4 },
  readOnlyText: { fontSize: 15, fontWeight: '500' },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 15, marginBottom: 12 },
  editActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  btn: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center' },
  editBtn: { marginTop: 12, flexDirection: 'row', padding: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
});