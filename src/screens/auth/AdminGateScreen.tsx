import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet } from 'react-native';
import { attemptAdminLogin } from '@/services/authService';

export default function AdminGateScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async () => {
    setBusy(true); setError(null);
    try {
      const res = await attemptAdminLogin(email, password);
      if (!res.ok) setError(res.message ?? 'Неверные учётные данные.');
    } catch { setError('Неверные учётные данные.'); }
    finally { setBusy(false); }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Служебный вход</Text>
      <TextInput style={styles.input} placeholder="Email" autoCapitalize="none" value={email} onChangeText={setEmail} />
      <TextInput style={styles.input} placeholder="Пароль" secureTextEntry value={password} onChangeText={setPassword} />
      <Button title={busy ? '...' : 'Войти'} onPress={handleSubmit} disabled={busy} />
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  title: { fontSize: 20, fontWeight: '600' },
  input: { width: '100%', borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  error: { color: 'red' },
});