/**
 * Работа с сессиями.
 */
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
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
    promocode: d.promocode ?? undefined,
    timeDone: d.timeDone ?? false,
    pausedAt: d.pausedAt?.toMillis?.() ?? undefined,
    accumulatedPausedMs: d.accumulatedPausedMs ?? 0,
    userName: d.userName ?? '',
    userSurname: d.userSurname ?? '',
    userAvatarUrl: d.userAvatarUrl ?? null,
    hideOnMap: d.hideOnMap === true,
  };
}

export async function startSessionFromQr(input: {
  qrPayload: string;
  userLocation: GeoPoint;
}) {
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

/**
 * Алиас с удобной сигнатурой (qrPayload, lat, lng).
 * Используется в HomeScreen и MapScreen для ручного ввода кода.
 */
export async function startSession(
  qrPayload: string,
  latitude: number,
  longitude: number,
) {
  return startSessionFromQr({
    qrPayload,
    userLocation: { latitude, longitude },
  });
}

export async function endSession(sessionId: string) {
  const fn = httpsCallable<
    { sessionId: string },
    { ok: boolean; pointsEarned: number; promocode?: string }
  >(functions, 'endSession');
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
  const fn = httpsCallable<
    { sessionId: string },
    { ok: boolean; pointsEarned: number }
  >(functions, 'forceEndSession');
  return (await fn({ sessionId })).data;
}

/** Активная сессия пользователя (для SessionContext). */
export function subscribeToUserActiveSession(
  userId: string,
  cb: (session: QuestSession | null) => void,
) {
  const q = query(
    collection(db, 'sessions'),
    where('userId', '==', userId),
    where('status', 'in', ['in_progress', 'paused']),
    limit(1),
  );
  return onSnapshot(
    q,
    (snap) => cb(snap.empty ? null : fromDoc(snap.docs[0].id, snap.docs[0].data())),
    (err) => {
      // eslint-disable-next-line no-console
      console.warn('[sessionService] active session error:', err.message);
      cb(null);
    },
  );
}

/** Все сессии пользователя (для HistoryScreen). */
export function subscribeToUserSessions(
  userId: string,
  cb: (sessions: QuestSession[]) => void,
) {
  const q = query(
    collection(db, 'sessions'),
    where('userId', '==', userId),
    orderBy('startedAt', 'desc'),
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => fromDoc(d.id, d.data())));
  });
}

/** Все активные сессии (для отображения аватаров на карте). */
export function subscribeToAllActiveSessions(
  cb: (sessions: QuestSession[]) => void,
) {
  const q = query(
    collection(db, 'sessions'),
    where('status', 'in', ['in_progress', 'paused']),
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => fromDoc(d.id, d.data()))
        .filter((s) => s.hideOnMap !== true);
      cb(list);
    },
    (err) => {
      // eslint-disable-next-line no-console
      console.warn('[sessionService] all active error:', err.message);
      cb([]);
    },
  );
}

/** Сессии пользователя в конкретном заведении за последние 24 часа. */
export function subscribeToUserRecentSessions(
  userId: string,
  placeId: string,
  cb: (sessions: QuestSession[]) => void,
) {
  const q = query(
    collection(db, 'sessions'),
    where('userId', '==', userId),
    where('placeId', '==', placeId),
    where('status', '==', 'completed'),
  );
  return onSnapshot(
    q,
    (snap) => {
      const dayAgoMs = Date.now() - 24 * 60 * 60 * 1000;
      const list = snap.docs
        .map((d) => fromDoc(d.id, d.data()))
        .filter((s) => (s.endedAt ?? 0) >= dayAgoMs)
        .sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0));
      cb(list);
    },
    (err) => {
      // eslint-disable-next-line no-console
      console.warn('[sessionService] recent error:', err.message);
      cb([]);
    },
  );
}

/**
 * Все завершённые сессии пользователя за последние 24 часа (для админки).
 * Одна подписка вместо N (по одной на каждое заведение).
 */
export function subscribeToUserRecentSessionsAllPlaces(
  userId: string,
  cb: (sessions: QuestSession[]) => void,
) {
  const q = query(
    collection(db, 'sessions'),
    where('userId', '==', userId),
    where('status', '==', 'completed'),
  );
  return onSnapshot(
    q,
    (snap) => {
      const dayAgoMs = Date.now() - 24 * 60 * 60 * 1000;
      const list = snap.docs
        .map((d) => fromDoc(d.id, d.data()))
        .filter((s) => (s.endedAt ?? 0) >= dayAgoMs)
        .sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0));
      cb(list);
    },
    (err) => {
      // eslint-disable-next-line no-console
      console.warn('[sessionService] user recent error:', err.message);
      cb([]);
    },
  );
}

/** Админ: сбросить квесты пользователю в заведении. */
export async function resetUserQuest(userId: string, placeId: string) {
  const fn = httpsCallable<
    { userId: string; placeId: string },
    { ok: boolean; count?: number; message?: string }
  >(functions, 'resetUserQuest');
  return (await fn({ userId, placeId })).data;
}