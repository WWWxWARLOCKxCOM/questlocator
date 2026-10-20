import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Image, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { QuestTask, QuestTaskType, TASK_TYPE_LABELS } from '@/types';

interface Props {
  tasks: QuestTask[];
  onChange: (tasks: QuestTask[]) => void;
}

const TYPE_ICONS: Record<QuestTaskType, keyof typeof MaterialCommunityIcons.glyphMap> = {
  photo: 'camera',
  recommendation: 'message-text',
  questionnaire: 'help-circle',
};

function genId() {
  return `t_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

/**
 * Числовое поле с локальным стейтом: можно свободно стирать и набирать
 * заново, не сбрасываясь на 0/1.
 */
function NumInput({
  initial,
  onCommit,
  style,
  keyboardType = 'numeric',
}: {
  initial: number;
  onCommit: (n: number) => void;
  style?: any;
  keyboardType?: 'numeric' | 'number-pad';
}) {
  const [text, setText] = useState(String(initial));

  useEffect(() => {
    setText(String(initial));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  const handleChange = (v: string) => {
    const cleaned = v.replace(/[^\d]/g, '');
    setText(cleaned);
    if (cleaned === '') return;
    const n = Number(cleaned);
    if (Number.isFinite(n)) onCommit(n);
  };

  const handleBlur = () => {
    if (text === '') setText(String(initial));
  };

  return (
    <TextInput
      style={style}
      keyboardType={keyboardType}
      value={text}
      onChangeText={handleChange}
      onBlur={handleBlur}
      selectTextOnFocus
    />
  );
}

export default function TaskConstructor({ tasks, onChange }: Props) {
  const addTask = (type: QuestTaskType) => {
    const t: QuestTask = {
      id: genId(),
      type,
      title: TASK_TYPE_LABELS[type],
      description: '',
      repeatCount: 1,
      bonusPoints: 20,
      minLength: type === 'recommendation' ? 50 : undefined,
      questions: type === 'questionnaire' ? [{ id: genId(), text: '', options: [] }] : undefined,
    };
    onChange([...tasks, t]);
  };

  const updateTask = (id: string, patch: Partial<QuestTask>) => {
    onChange(tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  const removeTask = (id: string) => {
    Alert.alert('Удалить задание?', 'Пользователь больше его не увидит.', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: () => onChange(tasks.filter((t) => t.id !== id)) },
    ]);
  };

  const pickRefPhoto = async (taskId: string) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Нет доступа к галерее');
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (r.canceled) return;
    updateTask(taskId, { referencePhotoUrl: r.assets[0].uri });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Задания квеста (необязательно)</Text>
      <Text style={styles.hint}>
        Помимо времени, за пребывание в заведении, можно добавить задания.
        Пользователь увидит их во время сессии и сможет выполнить.
      </Text>

      {tasks.map((t, idx) => (
        <View key={t.id} style={styles.taskCard}>
          <View style={styles.taskHeader}>
            <View style={styles.iconBubble}>
              <MaterialCommunityIcons name={TYPE_ICONS[t.type]} size={18} color="#fff" />
            </View>
            <Text style={styles.taskType}>
              {idx + 1}. {TASK_TYPE_LABELS[t.type]}
            </Text>
            <TouchableOpacity onPress={() => removeTask(t.id)} style={styles.deleteBtn}>
              <MaterialCommunityIcons name="trash-can-outline" size={18} color="#e74c3c" />
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Заголовок</Text>
          <TextInput
            style={styles.input}
            value={t.title}
            onChangeText={(v) => updateTask(t.id, { title: v })}
          />

          <Text style={styles.label}>Описание задания</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={t.description}
            onChangeText={(v) => updateTask(t.id, { description: v })}
            multiline
            placeholder={
              t.type === 'photo'
                ? 'Например: сфотографируй свой напиток крупным планом'
                : t.type === 'recommendation'
                ? 'Например: напиши, что тебе понравилось больше всего'
                : 'Например: ответь на 3 вопроса о своих предпочтениях'
            }
          />

          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Баллы за задание</Text>
              <NumInput
                style={styles.input}
                initial={t.bonusPoints}
                onCommit={(n) => updateTask(t.id, { bonusPoints: n })}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Повторов</Text>
              <NumInput
                style={styles.input}
                initial={t.repeatCount}
                onCommit={(n) => updateTask(t.id, { repeatCount: Math.max(1, n) })}
              />
              <Text style={styles.tinyHint}>
                Сколько раз можно выполнить
              </Text>
            </View>
          </View>

          {t.type === 'photo' && (
            <>
              <Text style={styles.label}>Референс (пример фото)</Text>
              <TouchableOpacity style={styles.photoBox} onPress={() => pickRefPhoto(t.id)}>
                {t.referencePhotoUrl ? (
                  <Image source={{ uri: t.referencePhotoUrl }} style={styles.photoPreview} />
                ) : (
                  <Text style={styles.photoHint}>Нажмите, чтобы выбрать фото</Text>
                )}
              </TouchableOpacity>
            </>
          )}

          {t.type === 'recommendation' && (
            <>
              <Text style={styles.label}>Минимум символов</Text>
              <NumInput
                style={styles.input}
                initial={t.minLength ?? 50}
                onCommit={(n) => updateTask(t.id, { minLength: n })}
              />
            </>
          )}

          {t.type === 'questionnaire' && (
            <>
              <Text style={styles.label}>Вопросы</Text>
              {(t.questions ?? []).map((q, qi) => (
                <View key={q.id} style={styles.questionBox}>
                  <View style={styles.row}>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      placeholder={`Вопрос ${qi + 1}`}
                      value={q.text}
                      onChangeText={(v) => {
                        const newQs = [...(t.questions ?? [])];
                        newQs[qi] = { ...q, text: v };
                        updateTask(t.id, { questions: newQs });
                      }}
                    />
                    <TouchableOpacity
                      onPress={() => {
                        const newQs = (t.questions ?? []).filter((x) => x.id !== q.id);
                        updateTask(t.id, { questions: newQs });
                      }}
                      style={styles.smallDelete}
                    >
                      <MaterialCommunityIcons name="close" size={18} color="#e74c3c" />
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={[styles.input, styles.multiline, { marginTop: 4 }]}
                    placeholder="Варианты ответа через запятую (оставьте пустым для свободного ответа)"
                    value={(q.options ?? []).join(', ')}
                    onChangeText={(v) => {
                      const newQs = [...(t.questions ?? [])];
                      const opts = v.split(',').map((s) => s.trim()).filter(Boolean);
                      newQs[qi] = { ...q, options: opts };
                      updateTask(t.id, { questions: newQs });
                    }}
                  />
                </View>
              ))}
              <TouchableOpacity
                style={styles.addQuestionBtn}
                onPress={() => {
                  const newQs = [...(t.questions ?? []), { id: genId(), text: '', options: [] }];
                  updateTask(t.id, { questions: newQs });
                }}
              >
                <MaterialCommunityIcons name="plus" size={16} color="#2ecc71" />
                <Text style={styles.addQuestionText}>Добавить вопрос</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      ))}

      <Text style={styles.addLabel}>Добавить задание:</Text>
      <View style={styles.addRow}>
        {(['photo', 'recommendation', 'questionnaire'] as QuestTaskType[]).map((type) => (
          <TouchableOpacity key={type} style={styles.addTypeBtn} onPress={() => addTask(type)}>
            <MaterialCommunityIcons name={TYPE_ICONS[type]} size={18} color="#2ecc71" />
            <Text style={styles.addTypeText}>{TASK_TYPE_LABELS[type]}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  hint: { color: '#666', fontSize: 12, marginBottom: 12, lineHeight: 16 },

  taskCard: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 12,
    padding: 12, marginBottom: 12, backgroundColor: '#fafafa',
  },
  taskHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  iconBubble: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#2ecc71', alignItems: 'center', justifyContent: 'center',
  },
  taskType: { flex: 1, fontWeight: '700' },
  deleteBtn: { padding: 4 },

  label: { fontSize: 12, color: '#555', marginTop: 8 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, fontSize: 14 },
  multiline: { minHeight: 60, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  row2: { flexDirection: 'row', gap: 8 },
  smallDelete: { padding: 6 },
  tinyHint: { fontSize: 10, color: '#999', marginTop: 2 },

  photoBox: {
    width: '100%', height: 140, borderRadius: 10, backgroundColor: '#f0f0f0',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginTop: 4,
  },
  photoPreview: { width: '100%', height: '100%' },
  photoHint: { color: '#888', fontSize: 13 },

  questionBox: { marginTop: 6 },

  addLabel: { fontSize: 13, color: '#555', marginTop: 8, marginBottom: 4 },
  addRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  addTypeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1.5, borderColor: '#2ecc71', borderRadius: 8,
    paddingVertical: 8, paddingHorizontal: 12,
  },
  addTypeText: { color: '#2ecc71', fontWeight: '700', fontSize: 13 },
  addQuestionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 6, marginTop: 4,
  },
  addQuestionText: { color: '#2ecc71', fontWeight: '600', fontSize: 13 },
});