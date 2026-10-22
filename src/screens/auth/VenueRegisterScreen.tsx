import React, { useState } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  ScrollView, Alert, ActivityIndicator 
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/context/ThemeContext';
import { submitVenueApplication } from '@/services/venueService';

export default function VenueRegisterScreen() {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);
  
  // Все обязательные и необязательные поля
  const [form, setForm] = useState({
    companyName: '', 
    regNumber: '', 
    country: '', 
    legalAddress: '', 
    taxId: '',
    corporateEmail: '', 
    companyPhone: '', 
    employeeName: '', 
    employeePosition: '',
    website: '', 
    loginEmail: '', 
    password: ''
  });

  const handleSubmit = async () => {
    // Проверка обязательных полей
    const required = [
      'companyName', 'regNumber', 'country', 'legalAddress', 
      'taxId', 'corporateEmail', 'companyPhone', 'employeeName', 
      'loginEmail', 'password'
    ];
    
    for (const key of required) {
      if (!form[key as keyof typeof form].trim()) {
        return Alert.alert('Ошибка', 'Заполните все поля, отмеченные звездочкой (*)');
      }
    }
    if (form.password.length < 6) {
      return Alert.alert('Ошибка', 'Пароль должен содержать минимум 6 символов');
    }

    setLoading(true);
    try {
      await submitVenueApplication(form);
      Alert.alert(
        'Успех', 
        'Заявка отправлена! Вы можете войти в аккаунт прямо сейчас. Ожидайте одобрения администратора для активации функций.', 
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message || 'Не удалось отправить заявку');
    } finally {
      setLoading(false);
    }
  };

  const updateField = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Регистрация компании</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>
        Заполните данные о компании. После проверки администратором вам будут доступны все функции.
      </Text>
      
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Данные компании</Text>
      
      <Text style={[styles.label, { color: colors.textMuted }]}>Название компании *</Text>
      <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border }]} value={form.companyName} onChangeText={(v) => updateField('companyName', v)} />

      <Text style={[styles.label, { color: colors.textMuted }]}>Регистрационный номер *</Text>
      <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border }]} value={form.regNumber} onChangeText={(v) => updateField('regNumber', v)} />

      <Text style={[styles.label, { color: colors.textMuted }]}>Страна регистрации *</Text>
      <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border }]} value={form.country} onChangeText={(v) => updateField('country', v)} />

      <Text style={[styles.label, { color: colors.textMuted }]}>Юридический адрес *</Text>
      <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border }]} value={form.legalAddress} onChangeText={(v) => updateField('legalAddress', v)} />

      <Text style={[styles.label, { color: colors.textMuted }]}>ИНН / Налоговый номер *</Text>
      <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border }]} value={form.taxId} onChangeText={(v) => updateField('taxId', v)} />

      <Text style={[styles.label, { color: colors.textMuted }]}>Сайт компании (необязательно)</Text>
      <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border }]} value={form.website} onChangeText={(v) => updateField('website', v)} keyboardType="url" autoCapitalize="none" />

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Контакты</Text>

      <Text style={[styles.label, { color: colors.textMuted }]}>Корпоративная почта *</Text>
      <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border }]} value={form.corporateEmail} onChangeText={(v) => updateField('corporateEmail', v)} keyboardType="email-address" autoCapitalize="none" />

      <Text style={[styles.label, { color: colors.textMuted }]}>Телефон компании *</Text>
      <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border }]} value={form.companyPhone} onChangeText={(v) => updateField('companyPhone', v)} keyboardType="phone-pad" />

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Представитель</Text>

      <Text style={[styles.label, { color: colors.textMuted }]}>Имя и фамилия сотрудника *</Text>
      <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border }]} value={form.employeeName} onChangeText={(v) => updateField('employeeName', v)} />

      <Text style={[styles.label, { color: colors.textMuted }]}>Должность представителя</Text>
      <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border }]} value={form.employeePosition} onChangeText={(v) => updateField('employeePosition', v)} />

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Доступ в систему</Text>

      <Text style={[styles.label, { color: colors.textMuted }]}>Почта для логина *</Text>
      <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border }]} value={form.loginEmail} onChangeText={(v) => updateField('loginEmail', v)} keyboardType="email-address" autoCapitalize="none" />

      <Text style={[styles.label, { color: colors.textMuted }]}>Пароль для логина *</Text>
      <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border }]} value={form.password} onChangeText={(v) => updateField('password', v)} secureTextEntry />

      <TouchableOpacity 
        style={[styles.btn, { backgroundColor: colors.primary }, loading && { opacity: 0.6 }]} 
        onPress={handleSubmit} 
        disabled={loading}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Отправить заявку</Text>}
      </TouchableOpacity>
      
      <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 16, alignItems: 'center' }}>
        <Text style={{ color: colors.primary }}>Назад ко входу</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingBottom: 60, gap: 8 },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 4, textAlign: 'center' },
  subtitle: { fontSize: 13, textAlign: 'center', marginBottom: 16, lineHeight: 18 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginTop: 16, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 4 },
  label: { fontSize: 13, marginTop: 8 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 15 },
  btn: { marginTop: 24, padding: 16, borderRadius: 10, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});