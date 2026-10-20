import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ClientStackParamList } from '@/navigation/ClientNavigator';
import { useSession } from '@/context/SessionContext';
import { getTaskCompletions } from '@/services/taskService';
import { QuestTask, TASK_TYPE_LABELS } from '@/types';

type Nav = NativeStackNavigationProp<ClientStackParamList, 'ActiveSession'>;

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export default function ActiveSessionScreen() {
  const navigation = useNavigation<Nav>();
  const {
    session, quest, place, isLoading, isPaused, isOutsideZone, isFinishing,
    elapsedMs, estimatedPoints, timeDone, resumeByUser, finish,
  } = useSession();

  const [completions, setCompletions] = useState<Record<string, number>>({});

  // Загружаем, сколько раз пользователь уже выполнял задания в этом заведении
  useEffect(() => {
    if (!place?.id) { setCompletions({}); return; }
    let cancelled = false;
    getTaskCompletions(place.id)
      .then((res) => { if (!cancelled) setCompletions(res.completions ?? {}); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [place?.id, session?.taskBonusPoints]);

  const tasks: QuestTask[] = useMemo(() => {
    return Array.isArray(quest?.tasks) ? (quest!.tasks as QuestTask[]) : [];
  }, [quest?.tasks]);

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator /></View>;
  }

  if (!session) {
    return (
      <View style={styles.center}>
        <Text>Активной сессии нет.</Text>
        <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate('Map')}>
          <Text style={styles.secondaryButtonText}>К карте</Text>
        </Pressable>
      </View>
    );
  }

  const handleFinish = () => {
    finish();
    navigation.navigate('Map');
  };

  const totalTaskBonus = session.taskBonusPoints ?? 0;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable style={styles.minimizeButton} onPress={() => navigation.navigate('Map')}>
        <Text style={styles.minimizeText}>▾ Свернуть</Text>
      </Pressable>

      <Text style={styles.title}>{place?.name ?? 'Активная сессия'}</Text>

      <View style={[styles.progressCircle, isPaused && styles.progressCirclePaused]}>
        <Text style={styles.progressText}>{formatDuration(elapsedMs)}</Text>
        {timeDone && <Text style={styles.timeDone}>Время выполнено ✓</Text>}
        {isPaused && !timeDone && <Text style={styles.pausedLabel}>На паузе</Text>}
      </View>

      {isOutsideZone && (
        <View style={styles.alertBox}>
          <Text style={styles.alertText}>
            Вы вышли из зоны заведения. Вернитесь и нажмите «Я тут».
          </Text>
        </View>
      )}

      {quest && (
        <>
          <Text style={styles.questInfo}>
            Время: {quest.minTimeMinutes}–{quest.maxTimeMinutes} мин
          </Text>
          <Text style={styles.earnings}>
            За время: ≈{estimatedPoints} / {quest.rewardPoints}
          </Text>
          {totalTaskBonus > 0 && (
            <Text style={styles.earnings}>
              За задания: +{totalTaskBonus} баллов
            </Text>
          )}
        </>
      )}

      {tasks.length > 0 && (
        <View style={styles.tasksBlock}>
          <Text style={styles.tasksTitle}>Задания</Text>
          {tasks.map((t) => {
            const done = completions[t.id] ?? 0;
            const reached = done >= t.repeatCount;
            return (
              <TouchableOpacity
                key={t.id}
                disabled={reached}
                style={[styles.taskRow, reached && styles.taskRowDone]}
                onPress={() =>
                  navigation.navigate('TaskExecute', {
                    sessionId: session.id,
                    task: t,
                  })
                }
              >
                <MaterialCommunityIcons
                  name={reached ? 'check-circle' : 'circle-outline'}
                  size={22}
                  color={reached ? '#27ae60' : '#888'}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.taskName, reached && styles.taskNameDone]}>
                    {t.title}
                  </Text>
                  <Text style={styles.taskMeta}>
                    {TASK_TYPE_LABELS[t.type]} · +{t.bonusPoints} баллов · {done}/{t.repeatCount}
                  </Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={22} color="#999" />
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {isPaused && (
        <Pressable style={styles.primaryButton} onPress={resumeByUser}>
          <Text style={styles.primaryButtonText}>Я тут — продолжить</Text>
        </Pressable>
      )}

      <Pressable
        style={[styles.finishButton, isFinishing && { opacity: 0.6 }]}
        onPress={handleFinish}
        disabled={isFinishing}
      >
        {isFinishing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.finishButtonText}>Завершить сессию</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingBottom: 60, gap: 16, alignItems: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  minimizeButton: { position: 'absolute', top: 8, left: 16, paddingVertical: 8, paddingHorizontal: 12, zIndex: 10 },
  minimizeText: { color: '#2f6fed', fontSize: 16, fontWeight: '600' },
  title: { fontSize: 20, fontWeight: '700', textAlign: 'center', marginTop: 24 },
  progressCircle: {
    width: 200, height: 200, borderRadius: 100, borderWidth: 8,
    borderColor: '#2ecc71', alignItems: 'center', justifyContent: 'center',
  },
  progressCirclePaused: { borderColor: '#e67e22' },
  progressText: { fontSize: 32, fontWeight: '800' },
  timeDone: { color: '#27ae60', marginTop: 8, fontWeight: '700' },
  pausedLabel: { color: '#e67e22', marginTop: 8, fontWeight: '700' },
  alertBox: {
    backgroundColor: '#fef5e7', borderRadius: 8, padding: 12,
    borderLeftWidth: 4, borderLeftColor: '#e67e22', alignSelf: 'stretch',
  },
  alertText: { color: '#7a4f10', fontSize: 13 },
  questInfo: { color: '#666' },
  earnings: { fontSize: 16, fontWeight: '600' },

  tasksBlock: { alignSelf: 'stretch', marginTop: 8 },
  tasksTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  taskRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#f7f7f7', borderRadius: 10,
    padding: 12, marginBottom: 8,
  },
  taskRowDone: { backgroundColor: '#e8f5e9' },
  taskName: { fontWeight: '600', fontSize: 14 },
  taskNameDone: { color: '#555', textDecorationLine: 'line-through' },
  taskMeta: { color: '#888', fontSize: 12, marginTop: 2 },

  primaryButton: {
    backgroundColor: '#2ecc71', borderRadius: 8,
    paddingVertical: 14, paddingHorizontal: 32,
  },
  primaryButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  secondaryButton: {
    backgroundColor: '#ecf0f1', borderRadius: 8,
    paddingVertical: 12, paddingHorizontal: 24,
  },
  secondaryButtonText: { color: '#2c3e50', fontWeight: '600' },
  finishButton: {
    backgroundColor: '#e74c3c', borderRadius: 8,
    paddingVertical: 14, paddingHorizontal: 32,
    minWidth: 200, alignItems: 'center',
  },
  finishButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});