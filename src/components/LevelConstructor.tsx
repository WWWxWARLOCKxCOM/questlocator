import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Switch, StyleSheet,
} from 'react-native';
import { LevelConfig, LevelResetPeriod, LEVEL_RESET_LABELS } from '@/types';

interface Props {
  value: LevelConfig;
  onChange: (v: LevelConfig) => void;
}

const RESET_OPTIONS: LevelResetPeriod[] = ['month', '3months', '6months', 'year', 'never'];

export const DEFAULT_LEVEL_CONFIG: LevelConfig = {
  enabled: false,
  completionsPerLevel: 5,
  maxLevel: 4,
  discounts: [0, 5, 9, 12],
  resetPeriod: 'year',
};

/**
 * Внутренний компонент с локальной строкой, чтобы можно было спокойно
 * удалять/набирать числа без мгновенного сброса в 1.
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

  // Если снаружи пришло новое значение и поле не в фокусе — синхронизуем
  useEffect(() => {
    setText(String(initial));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  const handleChange = (v: string) => {
    // Оставляем только цифры и точку
    const cleaned = v.replace(/[^\d]/g, '');
    setText(cleaned);
    if (cleaned === '') return; // не трогаем родителя, пока пусто
    const n = Number(cleaned);
    if (Number.isFinite(n)) onCommit(n);
  };

  const handleBlur = () => {
    if (text === '') {
      // Если вышли с пустым — вернём предыдущее значение
      setText(String(initial));
    }
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

export default function LevelConstructor({ value, onChange }: Props) {
  const update = (patch: Partial<LevelConfig>) => onChange({ ...value, ...patch });

  const setMaxLevel = (n: number) => {
    const maxLevel = Math.max(1, Math.min(20, n || 1));
    const discounts = [...(value.discounts ?? [])];
    while (discounts.length < maxLevel) discounts.push(discounts[discounts.length - 1] ?? 0);
    if (discounts.length > maxLevel) discounts.length = maxLevel;
    onChange({ ...value, maxLevel, discounts });
  };

  const setDiscount = (idx: number, val: number) => {
    const discounts = [...(value.discounts ?? [])];
    discounts[idx] = Math.max(0, Math.min(100, val || 0));
    onChange({ ...value, discounts });
  };

  return (
    <View style={styles.container}>
      <View style={styles.switchRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>Система уровней</Text>
          <Text style={styles.hint}>
            Пользователь повышает уровень за повторные прохождения. Каждый уровень
            даёт скидку.
          </Text>
        </View>
        <Switch
          value={value.enabled}
          onValueChange={(v) => update({ enabled: v })}
        />
      </View>

      {value.enabled && (
        <>
          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Прохождений на уровень</Text>
              <NumInput
                style={styles.input}
                initial={value.completionsPerLevel}
                onCommit={(n) => update({ completionsPerLevel: Math.max(1, n) })}
              />
              <Text style={styles.tinyHint}>Сколько квестов до повышения</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Максимум уровней</Text>
              <NumInput
                style={styles.input}
                initial={value.maxLevel}
                onCommit={setMaxLevel}
              />
              <Text style={styles.tinyHint}>Например, 4</Text>
            </View>
          </View>

          <Text style={styles.label}>Скидка на каждом уровне (%)</Text>
          {(value.discounts ?? []).map((d, i) => (
            <View key={i} style={styles.discountRow}>
              <Text style={styles.levelNum}>Ур. {i + 1}</Text>
              <NumInput
                style={[styles.input, styles.discountInput]}
                initial={d ?? 0}
                onCommit={(n) => setDiscount(i, n)}
              />
              <Text style={styles.percent}>%</Text>
            </View>
          ))}

          <Text style={styles.label}>Сброс прогресса</Text>
          <View style={styles.chipsRow}>
            {RESET_OPTIONS.map((p) => (
              <TouchableOpacity
                key={p}
                style={[styles.chip, value.resetPeriod === p && styles.chipActive]}
                onPress={() => update({ resetPeriod: p })}
              >
                <Text style={value.resetPeriod === p ? styles.chipTextActive : styles.chipText}>
                  {LEVEL_RESET_LABELS[p]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 16 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  hint: { color: '#666', fontSize: 12, marginTop: 2, lineHeight: 16 },

  label: { fontSize: 13, color: '#555', marginTop: 12 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, fontSize: 14 },
  row2: { flexDirection: 'row', gap: 10 },
  tinyHint: { fontSize: 10, color: '#999', marginTop: 2 },

  discountRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  levelNum: { fontWeight: '700', width: 60 },
  discountInput: { flex: 1 },
  percent: { fontWeight: '600', color: '#666' },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, backgroundColor: '#eee' },
  chipActive: { backgroundColor: '#2ecc71' },
  chipText: { color: '#333' },
  chipTextActive: { color: '#fff', fontWeight: '700' },
});