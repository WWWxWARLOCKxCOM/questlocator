import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ClientStackParamList } from '@/navigation/ClientNavigator';
import { useAuth } from '@/context/AuthContext';
import { subscribeToUserLevels } from '@/services/levelService';
import { subscribeToActivePlaces } from '@/services/placesService';
import { Place, PlaceCategory, UserLevel, CATEGORY_LABELS } from '@/types';

type Nav = NativeStackNavigationProp<ClientStackParamList>;

const CATEGORY_ICONS: Record<PlaceCategory, keyof typeof MaterialCommunityIcons.glyphMap> = {
  restaurant: 'silverware-fork-knife',
  cafe: 'coffee',
  museum: 'bank',
  shop: 'shopping',
  exhibition: 'image-frame',
};

interface Row {
  place: Place;
  level: UserLevel;
}

export default function LevelsScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const [levels, setLevels] = useState<Record<string, UserLevel>>({});
  const [places, setPlaces] = useState<Place[]>([]);

  useEffect(() => {
    if (!user) return;
    return subscribeToUserLevels(user.uid, setLevels);
  }, [user]);

  useEffect(() => subscribeToActivePlaces(setPlaces), []);

  const rows: Row[] = useMemo(() => {
    const list: Row[] = [];
    places.forEach((p) => {
      const lvl = levels[p.id];
      if (!lvl) return;
      if (!p.levels || !p.levels.enabled) return;
      list.push({ place: p, level: lvl });
    });
    list.sort((a, b) => (b.level.lastCompletedAt ?? 0) - (a.level.lastCompletedAt ?? 0));
    return list;
  }, [places, levels]);

  const renderItem = ({ item }: { item: Row }) => {
    const cfg = item.place.levels!;
    const maxLevel = cfg.maxLevel ?? 1;
    const perLevel = Math.max(1, cfg.completionsPerLevel ?? 1);
    const currentDiscount = cfg.discounts?.[item.level.level - 1] ?? 0;
    const nextDiscount =
      item.level.level < maxLevel ? cfg.discounts?.[item.level.level] ?? currentDiscount : null;
    const isMax = item.level.level >= maxLevel;
    const progress = isMax ? 1 : item.level.completionsAtThisLevel / perLevel;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() =>
          navigation.navigate('Map')
        }
      >
        <View style={styles.headerRow}>
          <View style={styles.iconBubble}>
            <MaterialCommunityIcons
              name={CATEGORY_ICONS[item.place.category]}
              size={20}
              color="#fff"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.placeName}>{item.place.name}</Text>
            <Text style={styles.category}>{CATEGORY_LABELS[item.place.category]}</Text>
          </View>
          <View style={styles.levelBadge}>
            <Text style={styles.levelBadgeText}>Ур. {item.level.level}</Text>
          </View>
        </View>

        <View style={styles.discountRow}>
          <MaterialCommunityIcons name="sale" size={18} color="#27ae60" />
          <Text style={styles.discountText}>
            Скидка: <Text style={styles.discountBold}>{currentDiscount}%</Text>
            {nextDiscount !== null && nextDiscount > currentDiscount ? (
              <> · до <Text style={styles.discountBold}>{nextDiscount}%</Text> на след. уровне</>
            ) : null}
          </Text>
        </View>

        {!isMax ? (
          <>
            <View style={styles.progressRow}>
              <Text style={styles.progressLabel}>До следующего уровня:</Text>
              <Text style={styles.progressValue}>
                {item.level.completionsAtThisLevel} / {perLevel}
              </Text>
            </View>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
            </View>
          </>
        ) : (
          <Text style={styles.maxLevelText}>Максимальный уровень 🎉</Text>
        )}

        <Text style={styles.totalText}>Всего пройдено: {item.level.totalCompletions}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.place.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <MaterialCommunityIcons name="star-outline" size={48} color="#ccc" />
            <Text style={styles.emptyTitle}>Уровней пока нет</Text>
            <Text style={styles.emptySubtitle}>
              Проходите квесты в заведениях — и получайте уровни со скидками.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f7f7' },
  list: { padding: 12, paddingBottom: 40 },

  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14,
    marginBottom: 12, elevation: 2,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBubble: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#2ecc71', alignItems: 'center', justifyContent: 'center',
  },
  placeName: { fontSize: 16, fontWeight: '700' },
  category: { color: '#2ecc71', fontSize: 12, fontWeight: '600', marginTop: 2 },
  levelBadge: {
    backgroundColor: '#2c3e50', paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 20,
  },
  levelBadgeText: { color: '#fff', fontWeight: '800', fontSize: 13 },

  discountRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 12,
  },
  discountText: { color: '#555', fontSize: 13 },
  discountBold: { color: '#27ae60', fontWeight: '800' },

  progressRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 12,
  },
  progressLabel: { color: '#666', fontSize: 12 },
  progressValue: { color: '#2c3e50', fontSize: 12, fontWeight: '700' },
  progressBarBg: {
    height: 8, backgroundColor: '#eee', borderRadius: 4, marginTop: 6, overflow: 'hidden',
  },
  progressBarFill: { height: '100%', backgroundColor: '#2ecc71' },

  maxLevelText: {
    color: '#27ae60', fontWeight: '700', marginTop: 12, textAlign: 'center',
  },
  totalText: { color: '#999', fontSize: 11, marginTop: 10 },

  emptyBox: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginTop: 12 },
  emptySubtitle: { color: '#888', textAlign: 'center', marginTop: 6, lineHeight: 20 },
});