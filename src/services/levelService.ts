import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/config/firebase';
import { UserLevel } from '@/types';

function fromDoc(id: string, d: any): UserLevel {
  return {
    id,
    userId: d.userId,
    placeId: d.placeId,
    level: d.level ?? 1,
    completionsAtThisLevel: d.completionsAtThisLevel ?? 0,
    totalCompletions: d.totalCompletions ?? 0,
    lastCompletedAt: d.lastCompletedAt?.toMillis?.() ?? 0,
    updatedAt: d.updatedAt?.toMillis?.() ?? 0,
  };
}

/** Подписка на все уровни текущего пользователя (для экрана «Уровни» и карты). */
export function subscribeToUserLevels(
  userId: string,
  cb: (levels: Record<string, UserLevel>) => void,
) {
  const q = query(
    collection(db, 'user_levels'),
    where('userId', '==', userId),
  );
  return onSnapshot(
    q,
    (snap) => {
      const map: Record<string, UserLevel> = {};
      snap.forEach((d) => {
        const lvl = fromDoc(d.id, d.data());
        map[lvl.placeId] = lvl;
      });
      cb(map);
    },
    (err) => {
      // eslint-disable-next-line no-console
      console.warn('[levelService] snapshot error:', err.message);
      cb({});
    },
  );
}

/** Один заход в облачную функцию — получить все уровни. */
export async function fetchUserLevels(): Promise<UserLevel[]> {
  const fn = httpsCallable<unknown, { ok: boolean; levels: UserLevel[] }>(
    functions,
    'getUserLevels',
  );
  const res = await fn({});
  return res.data.levels ?? [];
}