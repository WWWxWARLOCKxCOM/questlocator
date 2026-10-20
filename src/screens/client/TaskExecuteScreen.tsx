import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView,
  Alert, ActivityIndicator, Image,
} from 'react-native';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { ref as storageRef, uploadBytes } from 'firebase/storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { storage } from '@/config/firebase';
import { useAuth } from '@/context/AuthContext';
import { submitQuestTask } from '@/services/taskService';
import { ClientStackParamList } from '@/navigation/ClientNavigator';
import { QuestTask, TASK_TYPE_LABELS } from '@/types';

type Rt = RouteProp<ClientStackParamList, 'TaskExecute'>;
type Nav = any;

export default function TaskExecuteScreen() {
  const route = useRoute<Rt>();
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const { sessionId, task } = route.params;

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const handlePickPhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return Alert.alert('Нет доступа к камере');
    const r = await ImagePicker.launchCameraAsync({ quality: 0.6 });
    if (r.canceled) return;
    setPhotoUri(r.assets[0].uri);
  };

  const handleSubmit = async () => {
    if (!user) return;

    if (task.type === 'photo') {
      if (!photoUri) return Alert.alert('Сначала сделайте фото');
    } else if (task.type === 'recommendation') {
      const minLen = task.minLength ?? 50;
      if (text.trim().length < minLen) {
        return Alert.alert('Слишком коротко', `Минимум ${minLen} символов`);
      }
    } else if (task.type === 'questionnaire') {
      const qs = task.questions ?? [];
      if (qs.some((q) => !answers[q.id]?.trim())) {
        return Alert.alert('Ответьте на все вопросы');
      }
    }

    setBusy(true);
    try {
      let answerPhotoPath: string | undefined;

      if (task.type === 'photo' && photoUri) {
        const blob = await (await fetch(photoUri)).blob();
        const path = `task-photos/${user.uid}/${sessionId}/${task.id}_${Date.now()}.jpg`;
        const r = storageRef(storage, path);
        await uploadBytes(r, blob, { contentType: 'image/jpeg' });
        answerPhotoPath = path;
      }

      const answerAnswers =
        task.type === 'questionnaire'
          ? (task.questions ?? []).map((q) => ({
              questionId: q.id,
              answer: answers[q.id] ?? '',
            }))
          : undefined;

      await submitQuestTask({
        sessionId,
        taskId: task.id,
        answerText: task.type === 'recommendation' ? text.trim() : undefined,
        answerPhotoPath,
        answerAnswers,
      });

      Alert.alert('Готово', `+${task.bonusPoints} баллов`, [
        { text: 'ОК', onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось отправить');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <MaterialCommunityIcons
          name={
            task.type === 'photo' ? 'camera' :
            task.type === 'recommendation' ? 'message-text' : 'help-circle'
          }
          size={24}
          color="#2ecc71"
        />
        <Text style={styles.type}>{TASK_TYPE_LABELS[task.type]}</Text>
      </View>

      <Text style={styles.title}>{task.title}</Text>
      {task.description ? (
        <Text style={styles.description}>{task.description}</Text>
      ) : null}

      {task.type === 'photo' && (
        <>
          {task.referencePhotoUrl ? (
            <View>
              <Text style={styles.label}>Пример:</Text>
              <Image source={{ uri: task.referencePhotoUrl }} style={styles.refPhoto} />
            </View>
          ) : null}

          <Text style={styles.label}>Ваше фото:</Text>
          <TouchableOpacity style={styles.photoBox} onPress={handlePickPhoto}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.photo} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <MaterialCommunityIcons name="camera-plus" size={40} color="#999" />
                <Text style={styles.photoHint}>Нажмите, чтобы сделать фото</Text>
              </View>
            )}
          </TouchableOpacity>
        </>
      )}

      {task.type === 'recommendation' && (
        <>
          <Text style={styles.label}>
            Ваш отзыв (мин. {task.minLength ?? 50} символов)
          </Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={text}
            onChangeText={setText}
            placeholder="Поделитесь впечатлениями"
            multiline
          />
          <Text style={styles.counter}>{text.trim().length} / {task.minLength ?? 50}</Text>
        </>
      )}

      {task.type === 'questionnaire' && (
        <>
          {(task.questions ?? []).map((q, i) => (
            <View key={q.id} style={styles.questionBlock}>
              <Text style={styles.questionText}>{i + 1}. {q.text}</Text>
              {q.options && q.options.length > 0 ? (
                <View style={styles.optionsRow}>
                  {q.options.map((opt) => {
                    const active = answers[q.id] === opt;
                    return (
                      <TouchableOpacity
                        key={opt}
                        style={[styles.optionBtn, active && styles.optionBtnActive]}
                        onPress={() => setAnswers((a) => ({ ...a, [q.id]: opt }))}
                      >
                        <Text style={active ? styles.optionTextActive : styles.optionText}>
                          {opt}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <TextInput
                  style={styles.input}
                  value={answers[q.id] ?? ''}
                  onChangeText={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))}
                  placeholder="Ваш ответ"
                />
              )}
            </View>
          ))}
        </>
      )}

      <TouchableOpacity
        style={[styles.submitBtn, busy && { opacity: 0.6 }]}
        onPress={handleSubmit}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitText}>
            Отправить · +{task.bonusPoints} баллов
          </Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 60, gap: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  type: { color: '#2ecc71', fontWeight: '700', textTransform: 'uppercase', fontSize: 12 },
  title: { fontSize: 20, fontWeight: '800', marginTop: 4 },
  description: { color: '#666', marginTop: 6, lineHeight: 20 },
  label: { fontSize: 13, color: '#555', marginTop: 12 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 15 },
  multiline: { minHeight: 100, textAlignVertical: 'top' },
  counter: { fontSize: 11, color: '#999', alignSelf: 'flex-end', marginTop: 4 },

  photoBox: {
    width: '100%', height: 220, borderRadius: 10, overflow: 'hidden',
    backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center',
    marginTop: 4,
  },
  photoPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  photoHint: { color: '#888', marginTop: 8 },
  photo: { width: '100%', height: '100%' },
  refPhoto: { width: '100%', height: 160, borderRadius: 10, marginTop: 4 },

  questionBlock: { marginTop: 12, backgroundColor: '#fafafa', padding: 12, borderRadius: 8 },
  questionText: { fontWeight: '600', marginBottom: 8 },
  optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionBtn: {
    borderWidth: 1, borderColor: '#ccc', borderRadius: 16,
    paddingVertical: 6, paddingHorizontal: 12,
  },
  optionBtnActive: { backgroundColor: '#2ecc71', borderColor: '#2ecc71' },
  optionText: { color: '#333' },
  optionTextActive: { color: '#fff', fontWeight: '700' },

  submitBtn: {
    marginTop: 24, backgroundColor: '#2ecc71', borderRadius: 10,
    paddingVertical: 16, alignItems: 'center',
  },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});