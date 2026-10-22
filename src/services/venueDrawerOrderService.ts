import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@questlocator/venue_drawer_order_v1';

export type VenueDrawerRoute =
  | 'VenueMainStack' | 'VenuePlaces' | 'VenueShop' | 'VenueFinance'
  | 'VenueScanner' | 'VenueHistory' | 'VenueQR' | 'VenueModeration' | 'VenueProfile';

export const DEFAULT_VENUE_ORDER: VenueDrawerRoute[] = [
  'VenueMainStack', 'VenuePlaces', 'VenueShop', 'VenueFinance',
  'VenueScanner', 'VenueHistory', 'VenueQR', 'VenueModeration', 'VenueProfile',
];

export async function loadVenueDrawerOrder(): Promise<VenueDrawerRoute[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return DEFAULT_VENUE_ORDER;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_VENUE_ORDER;
    const valid = parsed.filter((x): x is VenueDrawerRoute => DEFAULT_VENUE_ORDER.includes(x));
    const missing = DEFAULT_VENUE_ORDER.filter((x) => !valid.includes(x));
    return [...valid, ...missing];
  } catch { return DEFAULT_VENUE_ORDER; }
}

export async function saveVenueDrawerOrder(order: VenueDrawerRoute[]) {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(order)); } catch {}
}