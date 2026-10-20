import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@questlocator/drawer_order_v1';

export type DrawerRoute =
  | 'MainStack'
  | 'FriendsStack'
  | 'Levels'
  | 'Shop'
  | 'Profile'
  | 'History'
  | 'PromoCodes'
  | 'Settings';

export const DEFAULT_DRAWER_ORDER: DrawerRoute[] = [
  'MainStack',
  'FriendsStack',
  'Levels',
  'Shop',
  'Profile',
  'History',
  'PromoCodes',
  'Settings',
];

export async function loadDrawerOrder(): Promise<DrawerRoute[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return DEFAULT_DRAWER_ORDER;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_DRAWER_ORDER;
    const valid = parsed.filter((x): x is DrawerRoute =>
      typeof x === 'string' && DEFAULT_DRAWER_ORDER.includes(x as DrawerRoute),
    );
    const missing = DEFAULT_DRAWER_ORDER.filter((x) => !valid.includes(x));
    return [...valid, ...missing];
  } catch {
    return DEFAULT_DRAWER_ORDER;
  }
}

export async function saveDrawerOrder(order: DrawerRoute[]) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(order));
  } catch {
    // ignore
  }
}