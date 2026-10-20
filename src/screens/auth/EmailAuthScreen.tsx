import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { signInWithEmail, signUpWithEmail, sendPasswordReset } from '@/services/authService';
import { useTheme } from '@/context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

export default function EmailAuthScreen() {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  // 5 тапов по логотипу — скрытый вход в админку
  const tapsRef = React.useRef<number[]>([]);
  const handleLogoTap = () => {
    const now = Date.now();
    tapsRef.current = [...tapsRef.current.filter((t) => now - t < 3000), now];
    if (tapsRef.current.length >= 5) {
      tapsRef.current = [];
      navigation.navigate('AdminGate');
    }
  };

  const handleSubmit = async () => {
    if (!email || !password) {
      Alert.alert('Заполните email и пароль');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'register') {
        await signUpWithEmail(email, password, name);
      } else {
        await signInWithEmail(email, password);
      }
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось войти');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!email) return Alert.alert('Введите email');
    try {
      await sendPasswordReset(email);
      Alert.alert('Готово', 'Письмо для сброса пароля отправлено');
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TouchableOpacity onPress={handleLogoTap}>
        <Ionicons name="location-sharp" size={72} color={colors.primary} />
      </TouchableOpacity>
      <Text style={[styles.title, { color: colors.text }]}>QuestLocator</Text>

      {mode === 'register' && (
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          placeholder="Имя"
          placeholderTextColor={colors.textMuted}
          value={name}
          onChangeText={setName}
        />
      )}

      <TextInput
        style={[styles.input, { color: colors.text, borderColor: colors.border }]}
        placeholder="Email"
        placeholderTextColor={colors.textMuted}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={[styles.input, { color: colors.text, borderColor: colors.border }]}
        placeholder="Пароль"
        placeholderTextColor={colors.textMuted}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <TouchableOpacity
        style={[styles.button, { backgroundColor: colors.primary }, loading && { opacity: 0.6 }]}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>
            {mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => setMode(mode === 'login' ? 'register' : 'login')}
      >
        <Text style={[styles.link, { color: colors.primary }]}>
          {mode === 'login' ? 'Создать аккаунт' : 'У меня уже есть аккаунт'}
        </Text>
      </TouchableOpacity>

      {mode === 'login' && (
        <TouchableOpacity onPress={handleReset}>
          <Text style={[styles.link, { color: colors.primary }]}>Забыли пароль?</Text>
        </TouchableOpacity>
      )}

      <View style={styles.divider}>
        <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        <Text style={[styles.dividerText, { color: colors.textMuted }]}>или</Text>
        <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
      </View>

      <TouchableOpacity
        style={[styles.venueButton, { borderColor: colors.text }]}
        onPress={() => navigation.navigate('VenueAuth')}
      >
        <Text style={[styles.venueButtonText, { color: colors.text }]}>
          Войти как заведение
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', gap: 12, alignItems: 'center' },
  title: { fontSize: 26, fontWeight: '800', marginBottom: 24 },
  input: {
    width: '100%', borderWidth: 1, borderRadius: 8,
    padding: 12, fontSize: 15,
  },
  button: {
    width: '100%', borderRadius: 8, paddingVertical: 14,
    alignItems: 'center', marginTop: 8,
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  link: { textAlign: 'center', marginTop: 8, fontWeight: '600' },
  divider: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginVertical: 24, width: '100%',
  },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth },
  dividerText: { fontSize: 13 },
  venueButton: {
    width: '100%', borderWidth: 2, borderRadius: 8,
    paddingVertical: 14, alignItems: 'center',
  },
  venueButtonText: { fontWeight: '700', fontSize: 16 },
});