import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { signInWithEmail, signUpWithEmail, sendPasswordReset } from '@/services/authService';
import { RootStackParamList } from '@/navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Основной экран входа/регистрации по email/паролю (Firebase Auth).
 * Скрытый вход в админку: 5 нажатий на логотип в течение 3 секунд
 * → переход на AdminGateScreen.
 */
export default function EmailAuthScreen() {
  const navigation = useNavigation<Nav>();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Скрытый жест для админ-входа
  const tapsRef = useRef<number[]>([]);
  const handleLogoTap = () => {
    const now = Date.now();
    tapsRef.current = [...tapsRef.current.filter((t) => now - t < 3000), now];
    if (tapsRef.current.length >= 5) {
      tapsRef.current = [];
      navigation.navigate('AdminGate');
    }
  };

  const switchMode = () => {
    setMode((m) => (m === 'login' ? 'register' : 'login'));
    setError(null);
  };

  const validate = (): string | null => {
    if (!email.trim()) return 'Введите email';
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return 'Некорректный email';
    if (password.length < 6) return 'Пароль должен содержать минимум 6 символов';
    if (mode === 'register' && !name.trim()) return 'Введите имя';
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setLoading(true);
    try {
      if (mode === 'register') {
        await signUpWithEmail(email.trim(), password, name.trim());
        Alert.alert('Готово', 'Аккаунт создан. Вы автоматически вошли.');
      } else {
        await signInWithEmail(email.trim(), password);
      }
      // RootNavigator сам переключит экран по onAuthStateChanged
    } catch (e: any) {
      const code = e?.code ?? '';
      let message = 'Не удалось выполнить вход. Попробуйте ещё раз.';
      if (code === 'auth/email-already-in-use') message = 'Этот email уже зарегистрирован.';
      else if (code === 'auth/invalid-email') message = 'Некорректный email.';
      else if (code === 'auth/weak-password') message = 'Слишком простой пароль (минимум 6 символов).';
      else if (code === 'auth/user-not-found') message = 'Пользователь с таким email не найден.';
      else if (code === 'auth/wrong-password' || code === 'auth/invalid-credential')
        message = 'Неверный email или пароль.';
      else if (code === 'auth/too-many-requests')
        message = 'Слишком много попыток. Попробуйте позже.';
      else if (code === 'auth/network-request-failed') message = 'Проверьте подключение к интернету.';
      else if (e?.message) message = e.message;
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!email.trim()) {
      setError('Введите email, чтобы сбросить пароль');
      return;
    }
    setError(null);
    try {
      await sendPasswordReset(email.trim());
      Alert.alert('Готово', 'Письмо для сброса пароля отправлено на указанный email.');
    } catch (e: any) {
      const code = e?.code ?? '';
      if (code === 'auth/user-not-found') setError('Пользователь с таким email не найден.');
      else if (code === 'auth/invalid-email') setError('Некорректный email.');
      else setError('Не удалось отправить письмо. Попробуйте позже.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity onPress={handleLogoTap} activeOpacity={0.8}>
          <Text style={styles.logo}>QuestLocator</Text>
        </TouchableOpacity>

        <Text style={styles.subtitle}>
          {mode === 'login' ? 'Вход в аккаунт' : 'Регистрация'}
        </Text>

        {mode === 'register' && (
          <TextInput
            style={styles.input}
            placeholder="Имя"
            placeholderTextColor="#999"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            textContentType="name"
          />
        )}

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#999"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
        />

        <TextInput
          style={styles.input}
          placeholder="Пароль"
          placeholderTextColor="#999"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          textContentType={mode === 'register' ? 'newPassword' : 'password'}
        />

        <TouchableOpacity
          style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>
              {mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={switchMode} disabled={loading}>
          <Text style={styles.link}>
            {mode === 'login' ? 'Создать аккаунт' : 'У меня уже есть аккаунт'}
          </Text>
        </TouchableOpacity>

        {mode === 'login' && (
          <TouchableOpacity onPress={handleReset} disabled={loading}>
            <Text style={styles.linkSecondary}>Забыли пароль?</Text>
          </TouchableOpacity>
        )}

        {error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  container: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
    gap: 12,
  },
  logo: {
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
    color: '#2ecc71',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#222',
  },
  primaryButton: {
    backgroundColor: '#2ecc71',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonDisabled: { opacity: 0.7 },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  link: {
    color: '#2ecc71',
    textAlign: 'center',
    marginTop: 12,
    fontSize: 15,
    fontWeight: '600',
  },
  linkSecondary: {
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    fontSize: 14,
  },
  error: {
    color: '#e74c3c',
    textAlign: 'center',
    marginTop: 12,
    fontSize: 14,
  },
});