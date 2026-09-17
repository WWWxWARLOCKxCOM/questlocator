import { doc, onSnapshot, collection, query, where, orderBy } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/config/firebase';
import { QuestSession, GeoPoint } from '@/types';

function fromDoc(id: string, d: any): QuestSession {
  return {
    id,
    userId: d.userId,
    placeId: d.placeId,
    questId: d.questId,
    startedAt: d.startedAt?.toMillis?.() ?? 0,
    endedAt: d.endedAt?.toMillis?.() ?? undefined,
    totalTimeMinutes: d.totalTimeMinutes ?? 0,
    pointsEarned: d.pointsEarned ?? 0,
    photosSubmitted: d.photosSubmitted ?? [],
    photoBonusApplied: d.photoBonusApplied ?? false,
    status: d.status,
    pausedAt: d.pausedAt?.toMillis?.() ?? undefined,
    accumulatedPausedMs: d.accumulatedPausedMs ?? 0,
  };
}

export async function startSessionFromQr(input: { qrPayload: string; userLocation: GeoPoint }) {
  const fn = httpsCallable<
    { qrPayload: string; userLat: number; userLng: number },
    { ok: boolean; sessionId?: string; errorCode?: string; message?: string }
  >(functions, 'startSession');
  const res = await fn({
    qrPayload: input.qrPayload,
    userLat: input.userLocation.latitude,
    userLng: input.userLocation.longitude,
  });
  return res.data;
}

export async function endSession(sessionId: string) {
  const fn = httpsCallable<{ sessionId: string }, { ok: boolean; pointsEarned: number; promocode?: string }>(
    functions, 'endSession',
  );
  return (await fn({ sessionId })).data;
}

export async function pauseSession(sessionId: string) {
  const fn = httpsCallable(functions, 'pauseSession');
  await fn({ sessionId });
}

export async function resumeSession(sessionId: string) {
  const fn = httpsCallable(functions, 'resumeSession');
  await fn({ sessionId });
}

export async function forceEndSessionForInactivity(sessionId: string) {
  const fn = httpsCallable<{ sessionId: string }, { ok: boolean; pointsEarned: number }>(
    functions, 'forceEndSession',
  );
  return (await fn({ sessionId })).data;
}

export function subscribeToSession(sessionId: string, cb: (s: QuestSession | null) => void) {
  return onSnapshot(doc(db, 'sessions', sessionId), (snap) => {
    cb(snap.exists() ? fromDoc(snap.id, snap.data()) : null);
  });
}

export function subscribeToUserSessions(userId: string, cb: (s: QuestSession[]) => void) {
  const q = query(
    collection(db, 'sessions'),
    where('userId', '==', userId),
    orderBy('startedAt', 'desc'),
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => fromDoc(d.id, d.data())));
  });
}