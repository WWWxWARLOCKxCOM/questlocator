import {
  collection, doc, onSnapshot, query, where, orderBy, limit,
  addDoc, updateDoc, deleteDoc, serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from '@/config/firebase';
import { Quest } from '@/types';

const COL = 'quests';

/** Гарантирует свежий ID-токен с custom claim admin=true у Firestore SDK. */
async function ensureAdminToken(): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Не авторизован');
  await user.getIdToken(true);
}

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

export async function createQuest(input: Omit<Quest, 'id' | 'createdAt'>) {
  await ensureAdminToken(); // ← фикс прав доступа

  const ref = await addDoc(collection(db, COL), {
    ...input,
    promocode: input.promocode ?? null,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateQuest(id: string, patch: Partial<Quest>) {
  await ensureAdminToken(); // ← фикс прав доступа
  await updateDoc(doc(db, COL, id), patch as any);
}

export async function deleteQuest(id: string) {
  await ensureAdminToken(); // ← фикс прав доступа
  await deleteDoc(doc(db, COL, id));
}