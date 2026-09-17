import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import * as QRCode from 'qrcode';

admin.initializeApp();
const db = admin.firestore();

const ADMIN_EMAIL = defineSecret('ADMIN_EMAIL');

// ─────────── Вспомогательное: расстояние (гаверсинус) ───────────
function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// ─────────── verifyAdminCredentials ───────────
// Вызывается из AdminGateScreen. Пользователь уже должен быть залогинен по email/паролю
// через обычный EmailAuthScreen. Функция сверяет его email с секретом ADMIN_EMAIL
// и выставляет custom claim admin=true.
export const verifyAdminCredentials = onCall(
  { secrets: [ADMIN_EMAIL] },
  async (req) => {
    if (!req.auth) {
      throw new HttpsError('unauthenticated', 'Не авторизован');
    }
    const user = await admin.auth().getUser(req.auth.uid);
    if (user.email !== ADMIN_EMAIL.value()) {
      return { ok: false, message: 'Неверные учётные данные.' };
    }
    await admin.auth().setCustomUserClaims(req.auth.uid, { admin: true });
    await db.collection('users').doc(req.auth.uid).set(
      { isAdmin: true },
      { merge: true },
    );
    return { ok: true };
  },
);

// ─────────── startSession ───────────
export const startSession = onCall(async (req) => {
  if (!req.auth) {
    throw new HttpsError('unauthenticated', 'Не авторизован');
  }
  const { qrPayload, userLat, userLng } = req.data as {
    qrPayload?: string;
    userLat?: number;
    userLng?: number;
  };

  if (!qrPayload || typeof userLat !== 'number' || typeof userLng !== 'number') {
    return { ok: false, errorCode: 'PLACE_NOT_FOUND' };
  }

  const m = /^quest:\/\/place\/(.+)$/.exec(qrPayload);
  if (!m) return { ok: false, errorCode: 'PLACE_NOT_FOUND' };
  const placeId = m[1];

  const placeSnap = await db.collection('places').doc(placeId).get();
  if (!placeSnap.exists) return { ok: false, errorCode: 'PLACE_NOT_FOUND' };
  const place = placeSnap.data()!;
  if (!place.isActive) return { ok: false, errorCode: 'PLACE_NOT_FOUND' };

  const dist = distanceM(
    { lat: userLat, lng: userLng },
    { lat: place.latitude, lng: place.longitude },
  );
  if (dist > 50) return { ok: false, errorCode: 'TOO_FAR' };

  const quests = await db
    .collection('quests')
    .where('placeId', '==', placeId)
    .where('isActive', '==', true)
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();
  if (quests.empty) return { ok: false, errorCode: 'QUEST_INACTIVE' };
  const quest = quests.docs[0];

  const active = await db
    .collection('sessions')
    .where('userId', '==', req.auth.uid)
    .where('status', 'in', ['in_progress', 'paused'])
    .limit(1)
    .get();
  if (!active.empty) return { ok: false, errorCode: 'ALREADY_ACTIVE' };

  const ref = await db.collection('sessions').add({
    userId: req.auth.uid,
    placeId,
    questId: quest.id,
    startedAt: admin.firestore.FieldValue.serverTimestamp(),
    status: 'in_progress',
    totalTimeMinutes: 0,
    pointsEarned: 0,
    photosSubmitted: [],
    photoBonusApplied: false,
    accumulatedPausedMs: 0,
  });

  return { ok: true, sessionId: ref.id };
});

// ─────────── endSession / forceEndSession ───────────
export const endSession = onCall(async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Не авторизован');
  const { sessionId } = req.data as { sessionId: string };
  return await finalizeSession(sessionId, req.auth.uid, false);
});

export const forceEndSession = onCall(async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Не авторизован');
  const { sessionId } = req.data as { sessionId: string };
  return await finalizeSession(sessionId, req.auth.uid, true);
});

async function finalizeSession(sessionId: string, userId: string, forced: boolean) {
  return await db.runTransaction(async (tx) => {
    const sRef = db.collection('sessions').doc(sessionId);
    const sSnap = await tx.get(sRef);
    if (!sSnap.exists) return { ok: false, pointsEarned: 0 };
    const s = sSnap.data()!;
    if (s.userId !== userId) {
      throw new HttpsError('permission-denied', 'Не ваша сессия');
    }
    if (s.status === 'completed') return { ok: false, pointsEarned: 0 };

    const questSnap = await tx.get(db.collection('quests').doc(s.questId));
    const quest = questSnap.data() ?? {};

    const startedMs = s.startedAt.toMillis();
    const pausedMs = s.accumulatedPausedMs ?? 0;
    const pausedNowMs =
      s.status === 'paused' && s.pausedAt ? Date.now() - s.pausedAt.toMillis() : 0;
    const elapsedMin = Math.max(
      0,
      Math.floor((Date.now() - startedMs - pausedMs - pausedNowMs) / 60000),
    );

    const min = quest.minTimeMinutes ?? 0;
    const max = quest.maxTimeMinutes ?? 9999;
    const effective = Math.min(elapsedMin, max);
    const points = effective >= min ? quest.rewardPoints ?? 0 : 0;

    const userRef = db.collection('users').doc(userId);
    tx.update(userRef, { balance: admin.firestore.FieldValue.increment(points) });

    tx.update(sRef, {
      status: 'completed',
      endedAt: admin.firestore.FieldValue.serverTimestamp(),
      totalTimeMinutes: elapsedMin,
      pointsEarned: points,
      promocode: quest.promocode ?? null,
      forced,
    });

    return { ok: true, pointsEarned: points, promocode: quest.promocode };
  });
}

// ─────────── pauseSession / resumeSession ───────────
export const pauseSession = onCall(async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Не авторизован');
  const { sessionId } = req.data as { sessionId: string };
  await db.collection('sessions').doc(sessionId).update({
    status: 'paused',
    pausedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { ok: true };
});

export const resumeSession = onCall(async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Не авторизован');
  const { sessionId } = req.data as { sessionId: string };
  const ref = db.collection('sessions').doc(sessionId);
  const snap = await ref.get();
  if (!snap.exists || snap.data()!.status !== 'paused') return { ok: false };
  const pausedAtMs = snap.data()!.pausedAt?.toMillis?.() ?? Date.now();
  await ref.update({
    status: 'in_progress',
    pausedAt: admin.firestore.FieldValue.delete(),
    accumulatedPausedMs: admin.firestore.FieldValue.increment(Date.now() - pausedAtMs),
  });
  return { ok: true };
});

// ─────────── generatePlaceQr (только админ) ───────────
export const generatePlaceQr = onCall(async (req) => {
  if (!req.auth?.token.admin) {
    throw new HttpsError('permission-denied', 'Только админ');
  }
  const { placeId } = req.data as { placeId: string };
  const value = `quest://place/${placeId}`;
  const png = await QRCode.toDataURL(value);
  await db.collection('places').doc(placeId).update({ qrCode: value, qrPng: png });
  return { ok: true, value };
});

// ─────────── submitSessionPhoto ───────────
export const submitSessionPhoto = onCall(async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Не авторизован');
  const { sessionId, storagePath } = req.data as {
    sessionId: string;
    storagePath: string;
  };
  await db.collection('photos').add({
    sessionId,
    userId: req.auth.uid,
    imagePath: storagePath,
    status: 'pending',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { ok: true };
});

// ─────────── onPhotoStatusChange (начисление бонуса) ───────────
export const onPhotoStatusChange = onDocumentUpdated(
  'photos/{photoId}',
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after || before.status === after.status) return;
    if (after.status !== 'approved' || after.bonusApplied) return;

    const sRef = db.collection('sessions').doc(after.sessionId);
    const sSnap = await sRef.get();
    if (!sSnap.exists || sSnap.data()!.photoBonusApplied) return;

    const questSnap = await db
      .collection('quests')
      .doc(sSnap.data()!.questId)
      .get();
    const mult = questSnap.data()?.photoBonusMultiplier ?? 1;
    const base = sSnap.data()!.pointsEarned ?? 0;
    const bonus = Math.round(base * (mult - 1));

    await db.runTransaction(async (tx) => {
      tx.update(sRef, {
        photoBonusApplied: true,
        pointsEarned: base + bonus,
      });
      tx.update(db.collection('users').doc(after.userId), {
        balance: admin.firestore.FieldValue.increment(bonus),
      });
      tx.update(event.data!.after.ref, { bonusApplied: true });
    });
  },
);

// ─────────── getAdminStats (только админ) ───────────
export const getAdminStats = onCall(async (req) => {
  if (!req.auth?.token.admin) {
    throw new HttpsError('permission-denied', 'Только админ');
  }
  const [activeSnap, completedSnap] = await Promise.all([
    db
      .collection('sessions')
      .where('status', 'in', ['in_progress', 'paused'])
      .count()
      .get(),
    db.collection('sessions').where('status', '==', 'completed').get(),
  ]);

  let totalPaid = 0;
  completedSnap.forEach((d) => {
    totalPaid += d.data().pointsEarned ?? 0;
  });

  return {
    activeSessions: activeSnap.data().count,
    completedQuests: completedSnap.size,
    totalPointsPaid: totalPaid,
  };
});