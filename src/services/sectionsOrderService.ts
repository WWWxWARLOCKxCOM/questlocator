import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@questlocator/home_sections_v1';

export type SectionId =
  | 'nearby'
  | 'levels'
  | 'friends'
  | 'promo'
  | 'history';

export const DEFAULT_ORDER: SectionId[] = [
  'nearby',
  'levels',
  'friends',
  'promo',
  'history',
];

export async function loadSectionsOrder(): Promise<SectionId[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return DEFAULT_ORDER;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_ORDER;

    // Дополняем недостающие + отсеиваем неизвестные
    const known = new Set<SectionId>(DEFAULT_ORDER);
    const valid = parsed.filter((x): x is SectionId => typeof x === 'string' && known.has(x as SectionId));
    const missing = DEFAULT_ORDER.filter((x) => !valid.includes(x));

    return [...valid, ...missing];
  } catch {
    return DEFAULT_ORDER;
  }
}

export async function saveSectionsOrder(order: SectionId[]) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(order));
  } catch {
    // ignore
  }
}