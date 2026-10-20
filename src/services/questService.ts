import {
  collection, doc, onSnapshot, query, where, orderBy, limit,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/config/firebase';
import { Quest } from '@/types';

const COL = 'quests';

function fromDoc(id: string, d: any): Quest {
  return {
    id,
    placeId: d.placeId,
    minTimeMinutes: d.minTimeMinutes,
    maxTimeMinutes: d.maxTimeMinutes,
    rewardPoints: d.rewardPoints,
    promocode: d.promocode ?? undefined,
    photoBonusMultiplier: d.photoBonusMultiplier ?? 1,
    photoRequired: d.photoRequired ?? false,
    referenceImages: d.referenceImages ?? [],
    tasks: Array.isArray(d.tasks) ? d.tasks : [],
    isActive: d.isActive,
    createdAt: d.createdAt?.toMillis?.() ?? 0,
  };
}

export function subscribeToActiveQuestForPlace(placeId: string, cb: (q: Quest | null) => void) {
  const q = query(
    collection(db, COL),
    where('placeId', '==', placeId),
    where('isActive', '==', true),
    orderBy('createdAt', 'desc'),
    limit(1),
  );
  return onSnapshot(q, (snap) => {
    cb(snap.empty ? null : fromDoc(snap.docs[0].id, snap.docs[0].data()));
  });
}

export function subscribeToAllQuests(cb: (quests: Quest[]) => void) {
  return onSnapshot(collection(db, COL), (snap) => {
    cb(snap.docs.map((d) => fromDoc(d.id, d.data())));
  });
}

/** Подписка на квесты конкретной точки (для владельца заведения). */
export function subscribeToQuestsByPlace(
  placeId: string,
  cb: (quests: Quest[]) => void,
) {
  const q = query(
    collection(db, COL),
    where('placeId', '==', placeId),
    orderBy('createdAt', 'desc'),
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => fromDoc(d.id, d.data())));
  });
}

/** Создать квест (админ или владелец точки) — через Cloud Function. */
export async function createQuest(input: Omit<Quest, 'id' | 'createdAt'>) {
  const fn = httpsCallable<
    typeof input,
    { ok: boolean; questId: string }
  >(functions, 'createQuest');
  const res = await fn(input);
  return res.data.questId;
}

/** Обновить квест (админ или владелец точки). */
export async function updateQuest(id: string, patch: Partial<Quest>) {
  const fn = httpsCallable<
    { questId: string; patch: Record<string, unknown> },
    { ok: boolean }
  >(functions, 'updateQuest');
  await fn({ questId: id, patch });
}

/** Удалить квест (админ или владелец точки). */
export async function deleteQuest(id: string) {
  const fn = httpsCallable<{ questId: string }, { ok: boolean }>(
    functions, 'deleteQuest',
  );
  await fn({ questId: id });
}