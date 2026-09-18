/**
 * Работа с квестовыми сессиями через Firebase Cloud Functions и Firestore.
 *
 * Начисление баллов — серверная операция (finalizeSession в functions/src/index.ts),
 * а не клиентская: клиент лишь отображает прогресс локально для UX,
 * реальные points_earned пересчитываются и фиксируются на сервере из временных
 * меток startedAt / accumulatedPausedMs, что исключает накрутку через изменение
 * времени на устройстве.
 */
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/config/firebase';
import { GeoPoint, QuestSession } from '@/types';

interface StartSessionInput {
  qrPayload: string;
  userLocation: GeoPoint;
}

interface StartSessionResult {
  ok: boolean;
  sessionId?: string;
  errorCode?:
    | 'TOO_FAR'
    | 'QUEST_INACTIVE'
    | 'PLACE_NOT_FOUND'
    | 'ALREADY_ACTIVE'
    | 'UNAUTHENTICATED';
  message?: string;
}

export async function startSessionFromQr(
  input: StartSessionInput,
): Promise<StartSessionResult> {
  const fn = httpsCallable<
    { qrPayload: string; userLat: number; userLng: number },
    StartSessionResult
  >(functions, 'startSession');

  try {
    const res = await fn({
      qrPayload: input.qrPayload,
      userLat: input.userLocation.latitude,
      userLng: input.userLocation.longitude,
    });
    return res.data;
  } catch (e: any) {
    return { ok: false, message: e?.message ?? 'Не удалось начать сессию' };
  }
}

interface EndSessionResult {
  ok: boolean;
  pointsEarned: number;
  promocode?: string;
}

export async function endSession(sessionId: string): Promise<EndSessionResult> {
  const fn = httpsCallable<{ sessionId: string }, EndSessionResult>(
    functions,
    'endSession',
  );
  try {
    const res = await fn({ sessionId });
    return res.data;
  } catch {
    return { ok: false, pointsEarned: 0 };
  }
}

/** Пауза таймера при выходе из геозоны. */
export async function pauseSession(sessionId: string): Promise<void> {
  const fn = httpsCallable<{ sessionId: string }, { ok: boolean }>(
    functions,
    'pauseSession',
  );
  await fn({ sessionId });
}

/** Возобновление при возврате в геозону. */
export async function resumeSession(sessionId: string): Promise<void> {
  const fn = httpsCallable<{ sessionId: string }, { ok: boolean }>(
    functions,
    'resumeSession',
  );
  await fn({ sessionId });
}

/**
 * Принудительное завершение анти-фрод системой: пользователь не подтвердил
 * присутствие ("Я здесь") в течение 5 минут после 45 минут неподвижности.
 */
export async function forceEndSessionForInactivity(
  sessionId: string,
): Promise<EndSessionResult> {
  const fn = httpsCallable<{ sessionId: string }, EndSessionResult>(
    functions,
    'forceEndSession',
  );
  try {
    const res = await fn({ sessionId });
    return res.data;
  } catch {
    return { ok: false, pointsEarned: 0 };
  }
}

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
    pausedAt: d.pausedAt?.toMillis?.() ?? undefined,
    accumulatedPausedMs: d.accumulatedPausedMs ?? 0,
  };
}

/** Реалтайм-подписка на конкретную сессию — используется экраном таймера. */
export function subscribeToSession(
  sessionId: string,
  callback: (session: QuestSession | null) => void,
) {
  return onSnapshot(doc(db, 'sessions', sessionId), (snap) => {
    callback(snap.exists() ? fromDoc(snap.id, snap.data()) : null);
  });
}

/** Реалтайм-подписка на все сессии пользователя — история, промокоды. */
export function subscribeToUserSessions(
  userId: string,
  callback: (sessions: QuestSession[]) => void,
) {
  const q = query(
    collection(db, 'sessions'),
    where('userId', '==', userId),
    orderBy('startedAt', 'desc'),
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => fromDoc(d.id, d.data())));
  });
}