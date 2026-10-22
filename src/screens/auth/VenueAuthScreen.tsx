import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { signInWithEmailAndPassword, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import { useTheme } from '@/context/ThemeContext';

export default function VenueAuthScreen() {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) return Alert.alert('Заполните email и пароль');
    setLoading(true);
    let cred;
    try {
      cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch {
      Alert.alert('Ошибка', 'Неверные email или пароль');
      setLoading(false);
      return;
    }

    try {
      const token = await cred.user.getIdTokenResult(true);
      if (token.claims.admin === true) {
        await firebaseSignOut(auth);
        Alert.alert('Отказано', 'Это администраторский аккаунт.');
        return;
      }
      if (token.claims.venue !== true) {
        await firebaseSignOut(auth);
        Alert.alert('Отказано', 'Этот аккаунт не является аккаунтом заведения.');
        return;
      }
      const venueSnap = await getDoc(doc(db, 'venues', cred.user.uid));
      if (!venueSnap.exists()) {
        await firebaseSignOut(auth);
        Alert.alert('Отказано', 'Аккаунт заведения не найден.');
        return;
      }
    } catch (e: any) {
      try { await firebaseSignOut(auth); } catch {}
      Alert.alert('Ошибка', e?.message ?? 'Не удалось войти');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Вход для заведения</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>
        Вход для зарегистрированных компаний. Если у вас еще нет аккаунта, подайте заявку на регистрацию.
      </Text>

      <TextInput
        style={[styles.input, { color: colors.text, borderColor: colors.border }]}
        placeholder="Email"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
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
        onPress={handleLogin}
        disabled={loading}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Войти</Text>}
      </TouchableOpacity>

      <TouchableOpacity 
        onPress={() => navigation.navigate('VenueRegister')} 
        style={{ marginTop: 16 }}
      >
        <Text style={[styles.link, { color: colors.primary, fontWeight: '700' }]}>
          Подать заявку на регистрацию компании
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 24 }}>
        <Text style={[styles.link, { color: colors.textMuted }]}>
          ← Назад ко входу для клиентов
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', gap: 12 },
  title: { fontSize: 24, fontWeight: '800', textAlign: 'center' },
  subtitle: { textAlign: 'center', marginBottom: 12, fontSize: 13, lineHeight: 18 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 15 },
  button: { borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  link: { textAlign: 'center', fontSize: 14 },
});