import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';
import * as QRCode from 'qrcode';

admin.initializeApp();
const db = admin.firestore();

const ADMIN_EMAIL = defineSecret('ADMIN_EMAIL');
const QUEST_COOLDOWN_HOURS = 20;

function distanceM(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// ═══════════════════════════════════════════
//  УРОВНИ: ХЕЛПЕРЫ
// ═══════════════════════════════════════════
type LevelResetPeriod = 'month' | '3months' | '6months' | 'year' | 'never';

function periodToMs(p: LevelResetPeriod | undefined): number | null {
  switch (p) {
    case 'month': return 30 * 24 * 60 * 60 * 1000;
    case '3months': return 90 * 24 * 60 * 60 * 1000;
    case '6months': return 180 * 24 * 60 * 60 * 1000;
    case 'year': return 365 * 24 * 60 * 60 * 1000;
    case 'never':
    default:
      return null;
  }
}

// ═══════════════════════════════════════════
//  АДМИН
// ═══════════════════════════════════════════
export const verifyAdminCredentials = onCall(
  { secrets: [ADMIN_EMAIL] },
  async (req) => {
    if (!req.auth) throw new HttpsError('unauthenticated', 'Не авторизован');
    const user = await admin.auth().getUser(req.auth.uid);
    if (user.email !== ADMIN_EMAIL.value()) {
      return { ok: false, message: 'Неверные учётные данные.' };
    }
    await admin.auth().setCustomUserClaims(req.auth.uid, { admin: true });
    await db.collection('users').doc(req.auth.uid).set({ isAdmin: true }, { merge: true });
    return { ok: true };
  },
);

// ═══════════════════════════════════════════
//  СОЗДАНИЕ ТОЧКИ
// ═══════════════════════════════════════════
export const createPlace = onCall(async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Не авторизован');

  const isAdmin = req.auth.token.admin === true;
  const isVenue = req.auth.token.venue === true;
  if (!isAdmin && !isVenue) {
    throw new HttpsError('permission-denied', 'Нет прав на создание точки');
  }

  const {
    name, address, description, photoUrl,
    website, phone, averageCheck, menuPdfUrl,
    latitude, longitude, category, radiusMeters, isActive,
    ownerUid: ownerUidFromAdmin,
    levels,
  } = req.data as any;

  if (!name || !address || typeof latitude !== 'number' || typeof longitude !== 'number') {
    throw new HttpsError('invalid-argument', 'Не все поля заполнены');
  }

  const finalOwnerUid: string | null = isAdmin
    ? (ownerUidFromAdmin ?? null)
    : req.auth.uid;

  if (!isAdmin) {
    const venueSnap = await db.collection('venues').doc(req.auth.uid).get();
    if (!venueSnap.exists) {
      throw new HttpsError('permission-denied', 'Аккаунт заведения не найден');
    }
    const venue = venueSnap.data()!;
    if (venue.isActive === false) {
      throw new HttpsError('permission-denied', 'Аккаунт заведения заблокирован');
    }
    const used = venue.pointsUsed ?? 0;
    const limit = venue.pointsLimit ?? 1;
    if (used >= limit) {
      throw new HttpsError('failed-precondition', 'Лимит точек исчерпан');
    }
  }

  if (finalOwnerUid) {
    const ownerSnap = await db.collection('venues').doc(finalOwnerUid).get();
    if (!ownerSnap.exists) {
      throw new HttpsError('not-found', 'Заведение-владелец не найдено');
    }
  }

  const ref = db.collection('places').doc();
  const placeId = ref.id;

  await ref.set({
    ownerUid: finalOwnerUid,
    name,
    address,
    description: description ?? '',
    photoUrl: photoUrl ?? null,
    website: website ?? '',
    phone: phone ?? '',
    averageCheck: typeof averageCheck === 'number' ? averageCheck : null,
    menuPdfUrl: menuPdfUrl ?? '',
    latitude,
    longitude,
    category: category ?? 'cafe',
    radiusMeters: typeof radiusMeters === 'number' ? radiusMeters : 50,
    isActive: isActive !== false,
    qrCode: '',
    levels: levels ?? null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  if (finalOwnerUid) {
    const venueRef = db.collection('venues').doc(finalOwnerUid);
    const venueSnap = await venueRef.get();
    if (venueSnap.exists) {
      const used = venueSnap.data()!.pointsUsed ?? 0;
      const limit = venueSnap.data()!.pointsLimit ?? 1;
      if (isAdmin || used < limit) {
        await venueRef.update({
          pointsUsed: admin.firestore.FieldValue.increment(1),
        });
      }
    }
  }

  const value = `quest://place/${placeId}`;
  const png = await QRCode.toDataURL(value);
  await ref.update({ qrCode: value, qrPng: png });

  return { ok: true, placeId, qrCode: value };
});

// ═══════════════════════════════════════════
//  QR
// ═══════════════════════════════════════════
export const generatePlaceQr = onCall(async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Не авторизован');
  const isAdmin = req.auth.token.admin === true;
  const isVenue = req.auth.token.venue === true;
  if (!isAdmin && !isVenue) {
    throw new HttpsError('permission-denied', 'Нет прав');
  }

  const { placeId } = req.data as { placeId?: string };
  if (!placeId) throw new HttpsError('invalid-argument', 'placeId обязателен');

  const placeSnap = await db.collection('places').doc(placeId).get();
  if (!placeSnap.exists) throw new HttpsError('not-found', 'Точка не найдена');
  const place = placeSnap.data()!;
  if (!isAdmin && place.ownerUid !== req.auth.uid) {
    throw new HttpsError('permission-denied', 'Это не ваша точка');
  }

  const value = `quest://place/${placeId}`;
  const png = await QRCode.toDataURL(value);
  await db.collection('places').doc(placeId).update({ qrCode: value, qrPng: png });
  return { ok: true, value };
});

// ═══════════════════════════════════════════
//  УПРАВЛЕНИЕ ЗАВЕДЕНИЯМИ (только админ)
// ═══════════════════════════════════════════
export const createVenueAccount = onCall(async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Не авторизован');
  if (!req.auth.token.admin) throw new HttpsError('permission-denied', 'Только админ');

  const { email, password, companyName, contactPhone, pointsLimit } = req.data as any;

  if (!email || !password || !companyName) {
    throw new HttpsError('invalid-argument', 'email, password, companyName обязательны');
  }
  if (password.length < 6) {
    throw new HttpsError('invalid-argument', 'Пароль минимум 6 символов');
  }

  let userRecord;
  try {
    userRecord = await admin.auth().createUser({ email, password });
  } catch (e: any) {
    if (e?.code === 'auth/email-already-exists') {
      throw new HttpsError('already-exists', 'Пользователь с таким email уже существует');
    }
    throw new HttpsError('internal', e?.message ?? 'Не удалось создать аккаунт');
  }

  await admin.auth().setCustomUserClaims(userRecord.uid, { venue: true });

  await db.collection('venues').doc(userRecord.uid).set({
    uid: userRecord.uid,
    companyName,
    contactEmail: email,
    contactPhone: contactPhone ?? '',
    pointsLimit: typeof pointsLimit === 'number' ? pointsLimit : 1,
    pointsUsed: 0,
    couponsLimit: 1,
    couponsUsed: 0,
    isActive: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { ok: true, uid: userRecord.uid };
});

export const updateVenuePointsLimit = onCall(async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Не авторизован');
  if (!req.auth.token.admin) throw new HttpsError('permission-denied', 'Только админ');

  const { venueUid, pointsLimit } = req.data as any;
  if (!venueUid || typeof pointsLimit !== 'number' || pointsLimit < 0) {
    throw new HttpsError('invalid-argument', 'venueUid и pointsLimit обязательны');
  }

  await db.collection('venues').doc(venueUid).update({ pointsLimit });
  return { ok: true };
});

export const updateVenueCouponsLimit = onCall(async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Не авторизован');
  if (!req.auth.token.admin) throw new HttpsError('permission-denied', 'Только админ');

  const { venueUid, couponsLimit } = req.data as any;
  if (!venueUid || typeof couponsLimit !== 'number' || couponsLimit < 0) {
    throw new HttpsError('invalid-argument', 'venueUid и couponsLimit обязательны');
  }

  await db.collection('venues').doc(venueUid).update({ couponsLimit });
  return { ok: true };
});

// ═══════════════════════════════════════════
//  УДАЛЕНИЕ АККАУНТА ЗАВЕДЕНИЯ
// ═══════════════════════════════════════════
export const deleteVenueAccount = onCall(async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Не авторизован');
  if (!req.auth.token.admin) throw new HttpsError('permission-denied', 'Только админ');

  const { venueUid } = req.data as { venueUid?: string };
  if (!venueUid) throw new HttpsError('invalid-argument', 'venueUid обязателен');

  const placesSnap = await db.collection('places').where('ownerUid', '==', venueUid).get();
  const placeIds = placesSnap.docs.map((d) => d.id);

  const questDocs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
  const photoDocs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
  const levelDocs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
  const couponDocs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
  const CHUNK = 10;
  
  for (let i = 0; i < placeIds.length; i += CHUNK) {
    const chunk = placeIds.slice(i, i + CHUNK);
    const [qSnap, phSnap, lvSnap] = await Promise.all([
      db.collection('quests').where('placeId', 'in', chunk).get(),
      db.collection('photos').where('placeId', 'in', chunk).get(),
      db.collection('user_levels').where('placeId', 'in', chunk).get(),
    ]);
    questDocs.push(...qSnap.docs);
    photoDocs.push(...phSnap.docs);
    levelDocs.push(...lvSnap.docs);
  }

  const cSnap = await db.collection('coupons').where('ownerUid', '==', venueUid).get();
  couponDocs.push(...cSnap.docs);

  const allRefs: FirebaseFirestore.DocumentReference[] = [
    ...placesSnap.docs.map((d) => d.ref),
    ...questDocs.map((d) => d.ref),
    ...photoDocs.map((d) => d.ref),
    ...levelDocs.map((d) => d.ref),
    ...couponDocs.map((d) => d.ref),
    db.collection('venues').doc(venueUid),
  ];

  const BATCH = 400;
  for (let i = 0; i < allRefs.length; i += BATCH) {
    const chunk = allRefs.slice(i, i + BATCH);
    const batch = db.batch();
    chunk.forEach((ref) => batch.delete(ref));
    await batch.commit();
  }

  try {
    for (const placeId of placeIds) {
      await admin.storage().bucket().deleteFiles({
        prefix: `places-photos/${placeId}/`,
      });
    }
  } catch (e: any) {
    console.warn('[deleteVenueAccount] storage places cleanup:', e?.message);
  }

  try {
    for (const photoDoc of photoDocs) {
      const p = photoDoc.data();
      if (p.imagePath) {
        try {
          await admin.storage().bucket().file(p.imagePath).delete();
        } catch {}
      }
    }
  } catch (e: any) {
    console.warn('[deleteVenueAccount] storage photos cleanup:', e?.message);
  }

  try {
    await admin.auth().deleteUser(venueUid);
  } catch (e: any) {
    console.warn('[deleteVenueAccount] auth delete:', e?.message);
  }

  return {
    ok: true,
    deletedPlaces: placesSnap.size,
    deletedQuests: questDocs.length,
    deletedPhotos: photoDocs.length,
  };
});

// ═══════════════════════════════════════════
//  СЕССИИ
// ═══════════════════════════════════════════
export const startSession = onCall(async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Не авторизован');

  const { qrPayload, userLat, userLng } = req.data as any;
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

  const radius = typeof place.radiusMeters === 'number' ? place.radiusMeters : 50;
  const dist = distanceM(
    { lat: userLat, lng: userLng },
    { lat: place.latitude, lng: place.longitude },
  );
  if (dist > radius) return { ok: false, errorCode: 'TOO_FAR' };

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

  const cooldownMs = QUEST_COOLDOWN_HOURS * 60 * 60 * 1000;
  const cooldownAgoMs = Date.now() - cooldownMs;

  const recentSnap = await db
    .collection('sessions')
    .where('userId', '==', req.auth.uid)
    .where('placeId', '==', placeId)
    .where('status', '==', 'completed')
    .get();

  const hasRecent = recentSnap.docs.some((d) => {
    const ended = d.data().endedAt;
    const ms = ended?.toMillis?.() ?? 0;
    return ms >= cooldownAgoMs;
  });
  if (hasRecent) return { ok: false, errorCode: 'ALREADY_COMPLETED_TODAY' };

  const userSnap = await db.collection('users').doc(req.auth.uid).get();
  const user = userSnap.data() ?? {};

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
    taskBonusPoints: 0,
    accumulatedPausedMs: 0,
    userName: user.name ?? '',
    userSurname: user.surname ?? '',
    userAvatarUrl: user.avatarUrl ?? null,
    hideOnMap: user.hideOnMap === true,
  });

  return { ok: true, sessionId: ref.id };
});

async function finalizeSession(sessionId: string, userId: string, forced: boolean) {
  return await db.runTransaction(async (tx) => {
    const sRef = db.collection('sessions').doc(sessionId);
    const sSnap = await tx.get(sRef);
    if (!sSnap.exists) return { ok: false, pointsEarned: 0 };
    const s = sSnap.data()!;
    if (s.userId !== userId) throw new HttpsError('permission-denied', 'Не ваша сессия');
    if (s.status === 'completed') return { ok: false, pointsEarned: 0 };

    const questSnap = await tx.get(db.collection('quests').doc(s.questId));
    const quest = questSnap.data() ?? {};

    const placeRef = db.collection('places').doc(s.placeId);
    const placeSnap = await tx.get(placeRef);
    const place = placeSnap.exists ? placeSnap.data()! : null;
    const cfg = place?.levels;
    const levelsEnabled = !!(cfg && cfg.enabled === true);

    const levelRef = db.collection('user_levels').doc(`${userId}__${s.placeId}`);
    let levelData: any = null;
    if (levelsEnabled) {
      const levelSnap = await tx.get(levelRef);
      if (levelSnap.exists) levelData = levelSnap.data();
    }

    const startedMs = s.startedAt.toMillis();
    const pausedMs = s.accumulatedPausedMs ?? 0;
    const pausedNowMs =
      s.status === 'paused' && s.pausedAt ? Date.now() - s.pausedAt.toMillis() : 0;
    const elapsedMin = Math.max(
      0,
      Math.floor((Date.now() - startedMs - pausedMs - pausedNowMs) / 60000),
    );

    const minT = quest.minTimeMinutes ?? 0;
    const maxT = quest.maxTimeMinutes ?? 60;
    const reward = quest.rewardPoints ?? 0;

    let points = 0;
    let timeDone = false;
    if (elapsedMin >= maxT) {
      points = reward;
      timeDone = true;
    } else if (elapsedMin > minT && maxT > minT) {
      const progress = (elapsedMin - minT) / (maxT - minT);
      points = Math.round(reward * Math.max(0, Math.min(1, progress)));
    }

    const taskBonus = s.taskBonusPoints ?? 0;
    points += taskBonus;

    let newLevelData: any = null;
    if (levelsEnabled && timeDone && cfg) {
      const completionsPerLevel = Math.max(1, Number(cfg.completionsPerLevel) || 1);
      const maxLevel = Math.max(1, Number(cfg.maxLevel) || 1);
      const resetMs = periodToMs(cfg.resetPeriod as LevelResetPeriod);
      const now = Date.now();

      let prevLevel = 1;
      let prevCompletions = 0;
      let prevTotal = 0;

      if (levelData) {
        const lastMs = levelData.lastCompletedAt?.toMillis?.() ?? 0;
        const expired = resetMs !== null && lastMs > 0 && now - lastMs >= resetMs;
        if (!expired) {
          prevLevel = Number(levelData.level) || 1;
          prevCompletions = Number(levelData.completionsAtThisLevel) || 0;
          prevTotal = Number(levelData.totalCompletions) || 0;
        }
      }

      let newLevel = prevLevel;
      let newCompletions = prevCompletions + 1;

      if (newCompletions >= completionsPerLevel && newLevel < maxLevel) {
        newLevel = newLevel + 1;
        newCompletions = 0;
      }

      newLevelData = {
        userId,
        placeId: s.placeId,
        level: newLevel,
        completionsAtThisLevel: newCompletions,
        totalCompletions: prevTotal + 1,
        lastCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
    }

    const userRef = db.collection('users').doc(userId);
    const userUpdate: Record<string, any> = {
      balance: admin.firestore.FieldValue.increment(points),
    };
    if (timeDone) {
      userUpdate.questsCompleted = admin.firestore.FieldValue.increment(1);
    }
    tx.update(userRef, userUpdate);

    tx.update(sRef, {
      status: 'completed',
      endedAt: admin.firestore.FieldValue.serverTimestamp(),
      totalTimeMinutes: elapsedMin,
      pointsEarned: points,
      timeDone,
      promocode: quest.promocode ?? null,
      forced,
    });

    if (newLevelData) {
      tx.set(levelRef, newLevelData, { merge: true });
    }

    return { ok: true, pointsEarned: points, promocode: quest.promocode };
  });
}

export const endSession = onCall(async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Не авторизован');
  const { sessionId } = req.data as { sessionId: string };
  try {
    return await finalizeSession(sessionId, req.auth.uid, false);
  } catch (e: any) {
    console.error('[endSession] failed:', e?.message, e?.stack);
    throw new HttpsError('internal', e?.message ?? 'Не удалось завершить сессию');
  }
});

export const forceEndSession = onCall(async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Не авторизован');
  const { sessionId } = req.data as { sessionId: string };
  try {
    return await finalizeSession(sessionId, req.auth.uid, true);
  } catch (e: any) {
    console.error('[forceEndSession] failed:', e?.message, e?.stack);
    throw new HttpsError('internal', e?.message ?? 'Не удалось завершить сессию');
  }
});

export const pauseSession = onCall(async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Не авторизован');
  const { sessionId } = req.data as { sessionId: string };

  const ref = db.collection('sessions').doc(sessionId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Сессия не найдена');
  if (snap.data()!.userId !== req.auth.uid) {
    throw new HttpsError('permission-denied', 'Не ваша сессия');
  }
  if (snap.data()!.status === 'paused') return { ok: true };

  await ref.update({
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
  if (!snap.exists) throw new HttpsError('not-found', 'Сессия не найдена');
  if (snap.data()!.userId !== req.auth.uid) {
    throw new HttpsError('permission-denied', 'Не ваша сессия');
  }
  if (snap.data()!.status !== 'paused') return { ok: true };

  const pausedAtMs = snap.data()!.pausedAt?.toMillis?.() ?? Date.now();
  await ref.update({
    status: 'in_progress',
    pausedAt: admin.firestore.FieldValue.delete(),
    accumulatedPausedMs: admin.firestore.FieldValue.increment(Date.now() - pausedAtMs),
  });
  return { ok: true };
});

// ═══════════════════════════════════════════
//  ЗАДАНИЯ
// ═══════════════════════════════════════════
export const submitQuestTask = onCall(async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Не авторизован');

  const {
    sessionId, taskId,
    answerText, answerPhotoPath, answerAnswers,
  } = req.data as any;

  if (!sessionId || !taskId) {
    throw new HttpsError('invalid-argument', 'sessionId и taskId обязательны');
  }

  const sessionSnap = await db.collection('sessions').doc(sessionId).get();
  if (!sessionSnap.exists) throw new HttpsError('not-found', 'Сессия не найдена');
  const session = sessionSnap.data()!;

  if (session.userId !== req.auth.uid) {
    throw new HttpsError('permission-denied', 'Не ваша сессия');
  }
  if (session.status === 'completed') {
    throw new HttpsError('failed-precondition', 'Сессия завершена');
  }

  const questSnap = await db.collection('quests').doc(session.questId).get();
  if (!questSnap.exists) throw new HttpsError('not-found', 'Квест не найден');
  const quest = questSnap.data()!;
  const tasks: any[] = Array.isArray(quest.tasks) ? quest.tasks : [];

  const task = tasks.find((t) => t.id === taskId);
  if (!task) throw new HttpsError('not-found', 'Задание не найдено');

  const completionId = `${req.auth.uid}__${taskId}`;
  const compRef = db.collection('task_completions').doc(completionId);
  const compSnap = await compRef.get();
  const currentCount = compSnap.exists ? (compSnap.data()!.count ?? 0) : 0;

  const repeat = task.repeatCount ?? 1;
  if (currentCount >= repeat) {
    throw new HttpsError(
      'failed-precondition',
      'Вы уже выполнили это задание максимальное число раз',
    );
  }

  await db.collection('task_submissions').add({
    userId: req.auth.uid,
    sessionId,
    placeId: session.placeId,
    questId: session.questId,
    taskId,
    taskType: task.type,
    answerText: answerText ?? null,
    answerPhotoPath: answerPhotoPath ?? null,
    answerAnswers: answerAnswers ?? [],
    bonusPoints: task.bonusPoints ?? 0,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await compRef.set({
    userId: req.auth.uid,
    taskId,
    placeId: session.placeId,
    count: admin.firestore.FieldValue.increment(1),
    lastAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  const bonus = task.bonusPoints ?? 0;
  if (bonus > 0) {
    await db.collection('sessions').doc(sessionId).update({
      taskBonusPoints: admin.firestore.FieldValue.increment(bonus),
    });
  }

  return { ok: true, count: currentCount + 1, repeat };
});

export const getTaskCompletions = onCall(async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Не авторизован');
  const { placeId } = req.data as { placeId?: string };
  if (!placeId) throw new HttpsError('invalid-argument', 'placeId обязателен');

  const snap = await db
    .collection('task_completions')
    .where('userId', '==', req.auth.uid)
    .where('placeId', '==', placeId)
    .get();

  const result: Record<string, number> = {};
  snap.forEach((d) => {
    const data = d.data();
    result[data.taskId] = data.count ?? 0;
  });

  return { ok: true, completions: result };
});

// ═══════════════════════════════════════════
//  УРОВНИ
// ═══════════════════════════════════════════
export const getUserLevels = onCall(async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Не авторизован');

  const snap = await db
    .collection('user_levels')
    .where('userId', '==', req.auth.uid)
    .get();

  const levels = snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      userId: data.userId,
      placeId: data.placeId,
      level: data.level ?? 1,
      completionsAtThisLevel: data.completionsAtThisLevel ?? 0,
      totalCompletions: data.totalCompletions ?? 0,
      lastCompletedAt: data.lastCompletedAt?.toMillis?.() ?? 0,
      updatedAt: data.updatedAt?.toMillis?.() ?? 0,
    };
  });

  return { ok: true, levels };
});

export const cleanupExpiredLevels = onSchedule(
  { schedule: 'every 24 hours', timeZone: 'Europe/Moscow' },
  async () => {
    const levelsSnap = await db.collection('user_levels').get();
    if (levelsSnap.empty) return;

    const placeCache: Record<string, any> = {};
    const batch = db.batch();
    let opsCount = 0;
    const now = Date.now();

    for (const docSnap of levelsSnap.docs) {
      const data = docSnap.data();
      const placeId = data.placeId;
      if (!placeId) continue;

      if (!(placeId in placeCache)) {
        const pSnap = await db.collection('places').doc(placeId).get();
        placeCache[placeId] = pSnap.exists ? pSnap.data() : null;
      }
      const place = placeCache[placeId];
      if (!place) continue;
      const cfg = place.levels;
      if (!cfg || !cfg.enabled) continue;

      const resetMs = periodToMs(cfg.resetPeriod);
      if (resetMs === null) continue;

      const lastMs = data.lastCompletedAt?.toMillis?.() ?? 0;
      if (lastMs === 0) continue;
      if (now - lastMs < resetMs) continue;

      batch.set(docSnap.ref, {
        level: 1,
        completionsAtThisLevel: 0,
        totalCompletions: 0,
        lastCompletedAt: null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      opsCount++;

      if (opsCount >= 400) {
        await batch.commit();
        opsCount = 0;
      }
    }

    if (opsCount > 0) await batch.commit();
  },
);

// ═══════════════════════════════════════════
//  ФОТО
// ═══════════════════════════════════════════
export const submitSessionPhoto = onCall(async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Не авторизован');
  const { sessionId, storagePath } = req.data as any;
  if (!sessionId || !storagePath) {
    throw new HttpsError('invalid-argument', 'sessionId и storagePath обязательны');
  }

  const sessionSnap = await db.collection('sessions').doc(sessionId).get();
  if (!sessionSnap.exists) throw new HttpsError('not-found', 'Сессия не найдена');
  const session = sessionSnap.data()!;
  if (session.userId !== req.auth.uid) {
    throw new HttpsError('permission-denied', 'Не ваша сессия');
  }

  let placeOwnerUid: string | null = null;
  const placeSnap = await db.collection('places').doc(session.placeId).get();
  if (placeSnap.exists) {
    placeOwnerUid = placeSnap.data()!.ownerUid ?? null;
  }

  await db.collection('photos').add({
    sessionId,
    placeId: session.placeId,
    placeOwnerUid,
    userId: req.auth.uid,
    imagePath: storagePath,
    status: 'pending',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { ok: true };
});

export const onPhotoStatusChange = onDocumentUpdated(
  'photos/{photoId}',
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;
    if (before.status === after.status) return;
    if (after.status !== 'approved' && after.status !== 'rejected') return;

    if (after.status === 'approved') {
      const sRef = db.collection('sessions').doc(after.sessionId);
      const sSnap = await sRef.get();
      if (sSnap.exists) {
        const session = sSnap.data()!;
        if (!session.photoBonusApplied) {
          const questSnap = await db.collection('quests').doc(session.questId).get();
          const mult = questSnap.data()?.photoBonusMultiplier ?? 1;
          const base = session.pointsEarned ?? 0;
          const bonus = Math.round(base * (mult - 1));
          if (bonus > 0) {
            await db.runTransaction(async (tx) => {
              tx.update(sRef, { photoBonusApplied: true, pointsEarned: base + bonus });
              tx.update(db.collection('users').doc(after.userId), {
                balance: admin.firestore.FieldValue.increment(bonus),
              });
            });
          }
        }
      }
    }

    if (after.imagePath) {
      try {
        await admin.storage().bucket().file(after.imagePath).delete();
      } catch (e: any) {
        console.warn('[onPhotoStatusChange] storage delete:', e?.message);
      }
    }

    try {
      await event.data!.after.ref.delete();
    } catch (e: any) {
      console.warn('[onPhotoStatusChange] firestore delete:', e?.message);
    }
  },
);

export const moderatePhoto = onCall(async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Не авторизован');
  const isAdmin = req.auth.token.admin === true;
  const isVenue = req.auth.token.venue === true;
  if (!isAdmin && !isVenue) throw new HttpsError('permission-denied', 'Нет прав');

  const { photoId, approve } = req.data as any;
  if (!photoId || typeof approve !== 'boolean') {
    throw new HttpsError('invalid-argument', 'photoId и approve обязательны');
  }

  const ref = db.collection('photos').doc(photoId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Фото не найдено');
  const photo = snap.data()!;
  if (photo.status !== 'pending') {
    throw new HttpsError('failed-precondition', 'Фото уже обработано');
  }
  if (!isAdmin && photo.placeOwnerUid !== req.auth.uid) {
    throw new HttpsError('permission-denied', 'Это фото не вашего заведения');
  }

  await ref.update({ status: approve ? 'approved' : 'rejected' });
  return { ok: true };
});

// ═══════════════════════════════════════════
//  СТАТИСТИКА
// ═══════════════════════════════════════════
export const getAdminStats = onCall(async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Не авторизован');
  if (!req.auth.token.admin) throw new HttpsError('permission-denied', 'Только админ');

  const [activeSnap, completedSnap] = await Promise.all([
    db.collection('sessions').where('status', 'in', ['in_progress', 'paused']).count().get(),
    db.collection('sessions').where('status', '==', 'completed').get(),
  ]);

  let totalPaid = 0;
  completedSnap.forEach((d) => { totalPaid += d.data().pointsEarned ?? 0; });

  return {
    activeSessions: activeSnap.data().count,
    completedQuests: completedSnap.size,
    totalPointsPaid: totalPaid,
  };
});

export const resetUserQuest = onCall(async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Не авторизован');
  if (!req.auth.token.admin) throw new HttpsError('permission-denied', 'Только админ');

  const { userId, placeId } = req.data as any;
  if (!userId || !placeId) {
    throw new HttpsError('invalid-argument', 'userId и placeId обязательны');
  }

  const cooldownMs = QUEST_COOLDOWN_HOURS * 60 * 60 * 1000;
  const cooldownAgoMs = Date.now() - cooldownMs;

  const snap = await db
    .collection('sessions')
    .where('userId', '==', userId)
    .where('placeId', '==', placeId)
    .where('status', '==', 'completed')
    .get();

  const toReset = snap.docs.filter((d) => {
    const ended = d.data().endedAt;
    const ms = ended?.toMillis?.() ?? 0;
    return ms >= cooldownAgoMs;
  });

  if (toReset.length === 0) {
    return { ok: false, message: 'Нет завершённых сессий за последние 20 часов' };
  }

  const batch = db.batch();
  toReset.forEach((d) => {
    batch.update(d.ref, {
      status: 'reset',
      resetAt: admin.firestore.FieldValue.serverTimestamp(),
      resetBy: req.auth!.uid,
    });
  });
  await batch.commit();
  return { ok: true, count: toReset.length };
});

// ═══════════════════════════════════════════
//  ДРУЗЬЯ
// ═══════════════════════════════════════════
export const searchUsers = onCall(async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Не авторизован');
  const q = String(req.data?.q ?? '').trim().toLowerCase();
  if (q.length < 2) return { ok: true, users: [] };

  const selfUid = req.auth.uid;

  let users: any[] = [];

  try {
    const snap = await db
      .collection('users')
      .where('searchKey', '>=', q)
      .where('searchKey', '<=', q + '\uf8ff')
      .limit(20)
      .get();

    users = snap.docs
      .filter((d) => d.id !== selfUid)
      .map((d) => {
        const data = d.data();
        return {
          uid: d.id,
          name: data.name ?? '',
          surname: data.surname ?? '',
          avatarUrl: data.avatarUrl ?? null,
          questsCompleted: data.questsCompleted ?? 0,
        };
      });
  } catch (e: any) {
    console.warn('[searchUsers] index query failed:', e?.message);
  }

  if (users.length === 0) {
    const all = await db.collection('users').limit(500).get();
    users = all.docs
      .filter((d) => d.id !== selfUid)
      .map((d) => {
        const data = d.data();
        return {
          uid: d.id,
          name: data.name ?? '',
          surname: data.surname ?? '',
          email: data.email ?? '',
          phone: data.phone ?? '',
          searchKey: data.searchKey ?? '',
          avatarUrl: data.avatarUrl ?? null,
          questsCompleted: data.questsCompleted ?? 0,
        };
      })
      .filter((u) => {
        const hay = `${u.name} ${u.surname} ${u.email} ${u.phone} ${u.searchKey}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 20)
      .map((u) => ({
        uid: u.uid,
        name: u.name,
        surname: u.surname,
        avatarUrl: u.avatarUrl,
        questsCompleted: u.questsCompleted,
      }));
  }

  return { ok: true, users };
});

export const addFriend = onCall(async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Не авторизован');
  const { targetUid } = req.data as any;
  if (!targetUid || targetUid === req.auth.uid) {
    throw new HttpsError('invalid-argument', 'Некорректный targetUid');
  }
  const target = await db.collection('users').doc(targetUid).get();
  if (!target.exists) return { ok: false, message: 'Пользователь не найден' };

  const batch = db.batch();
  const now = admin.firestore.FieldValue.serverTimestamp();
  batch.set(db.collection('users').doc(req.auth.uid).collection('friends').doc(targetUid),
    { friendUid: targetUid, createdAt: now }, { merge: true });
  batch.set(db.collection('users').doc(targetUid).collection('friends').doc(req.auth.uid),
    { friendUid: req.auth.uid, createdAt: now }, { merge: true });
  await batch.commit();
  return { ok: true };
});

export const removeFriend = onCall(async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Не авторизован');
  const { targetUid } = req.data as any;
  if (!targetUid || targetUid === req.auth.uid) {
    throw new HttpsError('invalid-argument', 'Некорректный targetUid');
  }
  const batch = db.batch();
  batch.delete(db.collection('users').doc(req.auth.uid).collection('friends').doc(targetUid));
  batch.delete(db.collection('users').doc(targetUid).collection('friends').doc(req.auth.uid));
  await batch.commit();
  return { ok: true };
});

export const updateHideOnMap = onCall(async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Не авторизован');
  const hide = !!req.data?.hide;
  await db.collection('users').doc(req.auth.uid).update({ hideOnMap: hide });

  const active = await db
    .collection('sessions')
    .where('userId', '==', req.auth.uid)
    .where('status', 'in', ['in_progress', 'paused'])
    .get();
  if (!active.empty) {
    const batch = db.batch();
    active.forEach((d) => batch.update(d.ref, { hideOnMap: hide }));
    await batch.commit();
  }
  return { ok: true };
});

// ═══════════════════════════════════════════
//  ТОЧКИ
// ═══════════════════════════════════════════
export const updatePlacePhoto = onCall(async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Не авторизован');
  const isAdmin = req.auth.token.admin === true;
  const isVenue = req.auth.token.venue === true;
  if (!isAdmin && !isVenue) throw new HttpsError('permission-denied', 'Нет прав');

  const { placeId, photoUrl } = req.data as any;
  if (!placeId || !photoUrl) throw new HttpsError('invalid-argument', 'placeId и photoUrl обязательны');

  const ref = db.collection('places').doc(placeId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Точка не найдена');
  const place = snap.data()!;
  if (!isAdmin && place.ownerUid !== req.auth.uid) {
    throw new HttpsError('permission-denied', 'Это не ваша точка');
  }
  await ref.update({ photoUrl });
  return { ok: true };
});

export const updatePlace = onCall(async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Не авторизован');
  const isAdmin = req.auth.token.admin === true;
  const isVenue = req.auth.token.venue === true;
  if (!isAdmin && !isVenue) throw new HttpsError('permission-denied', 'Нет прав');

  const { placeId, patch } = req.data as any;
  if (!placeId || !patch) throw new HttpsError('invalid-argument', 'placeId и patch обязательны');

  const ref = db.collection('places').doc(placeId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Точка не найдена');
  const place = snap.data()!;
  if (!isAdmin && place.ownerUid !== req.auth.uid) {
    throw new HttpsError('permission-denied', 'Это не ваша точка');
  }

  const allowed = [
    'name', 'address', 'description', 'category', 'radiusMeters', 'isActive',
    'website', 'phone', 'averageCheck', 'menuPdfUrl', 'levels',
  ];
  const safe: Record<string, unknown> = {};
  for (const k of allowed) {
    if (patch[k] !== undefined) safe[k] = patch[k];
  }
  if (Object.keys(safe).length === 0) return { ok: true };
  await ref.update(safe);
  return { ok: true };
});

export const deletePlace = onCall(async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Не авторизован');
  if (!req.auth.token.admin) throw new HttpsError('permission-denied', 'Только админ');

  const { placeId } = req.data as any;
  if (!placeId) throw new HttpsError('invalid-argument', 'placeId обязателен');

  const placeRef = db.collection('places').doc(placeId);
  const placeSnap = await placeRef.get();
  if (!placeSnap.exists) throw new HttpsError('not-found', 'Точка не найдена');
  const place = placeSnap.data()!;

  const [questsSnap, photosSnap, levelsSnap] = await Promise.all([
    db.collection('quests').where('placeId', '==', placeId).get(),
    db.collection('photos').where('placeId', '==', placeId).get(),
    db.collection('user_levels').where('placeId', '==', placeId).get(),
  ]);

  const allRefs: FirebaseFirestore.DocumentReference[] = [
    placeRef,
    ...questsSnap.docs.map((d) => d.ref),
    ...photosSnap.docs.map((d) => d.ref),
    ...levelsSnap.docs.map((d) => d.ref),
  ];

  const BATCH = 400;
  for (let i = 0; i < allRefs.length; i += BATCH) {
    const chunk = allRefs.slice(i, i + BATCH);
    const batch = db.batch();
    chunk.forEach((ref) => batch.delete(ref));
    await batch.commit();
  }

  if (place.ownerUid) {
    const venueRef = db.collection('venues').doc(place.ownerUid);
    const venueSnap = await venueRef.get();
    if (venueSnap.exists) {
      const used = venueSnap.data()!.pointsUsed ?? 0;
      if (used > 0) {
        await venueRef.update({
          pointsUsed: admin.firestore.FieldValue.increment(-1),
        });
      }
    }
  }

  try {
    await admin.storage().bucket().deleteFiles({
      prefix: `places-photos/${placeId}/`,
    });
  } catch (e: any) {
    console.warn('[deletePlace] storage places-photos cleanup:', e?.message);
  }

  try {
    for (const photoDoc of photosSnap.docs) {
      const p = photoDoc.data();
      if (p.imagePath) {
        try {
          await admin.storage().bucket().file(p.imagePath).delete();
        } catch {}
      }
    }
  } catch (e: any) {
    console.warn('[deletePlace] storage session-photos cleanup:', e?.message);
  }

  return {
    ok: true,
    deletedQuests: questsSnap.size,
    deletedPhotos: photosSnap.size,
  };
});

export const assignPlaceOwner = onCall(async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Не авторизован');
  if (!req.auth.token.admin) throw new HttpsError('permission-denied', 'Только админ');

  const { placeId, ownerUid } = req.data as any;
  if (!placeId) throw new HttpsError('invalid-argument', 'placeId обязателен');

  const ref = db.collection('places').doc(placeId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Точка не найдена');
  const prevOwner = snap.data()!.ownerUid ?? null;

  if (ownerUid) {
    const venueSnap = await db.collection('venues').doc(ownerUid).get();
    if (!venueSnap.exists) throw new HttpsError('not-found', 'Заведение не найдено');
  }

  if (prevOwner && prevOwner !== ownerUid) {
    const prevVenueRef = db.collection('venues').doc(prevOwner);
    const prevVenueSnap = await prevVenueRef.get();
    if (prevVenueSnap.exists) {
      const used = prevVenueSnap.data()!.pointsUsed ?? 0;
      if (used > 0) {
        await prevVenueRef.update({
          pointsUsed: admin.firestore.FieldValue.increment(-1),
        });
      }
    }
  }

  if (ownerUid && ownerUid !== prevOwner) {
    await db.collection('venues').doc(ownerUid).update({
      pointsUsed: admin.firestore.FieldValue.increment(1),
    });
  }

  await ref.update({ ownerUid: ownerUid ?? null });
  return { ok: true };
});

// ═══════════════════════════════════════════
//  КВЕСТЫ
// ═══════════════════════════════════════════
export const createQuest = onCall(async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Не авторизован');
  const isAdmin = req.auth.token.admin === true;
  const isVenue = req.auth.token.venue === true;
  if (!isAdmin && !isVenue) throw new HttpsError('permission-denied', 'Нет прав');

  const {
    placeId, minTimeMinutes, maxTimeMinutes, rewardPoints,
    promocode, photoBonusMultiplier, photoRequired,
    referenceImages, tasks, isActive,
  } = req.data as any;

  if (!placeId || typeof minTimeMinutes !== 'number' || typeof maxTimeMinutes !== 'number') {
    throw new HttpsError('invalid-argument', 'placeId и время обязательны');
  }

  const placeSnap = await db.collection('places').doc(placeId).get();
  if (!placeSnap.exists) throw new HttpsError('not-found', 'Точка не найдена');
  const place = placeSnap.data()!;
  if (!isAdmin && place.ownerUid !== req.auth.uid) {
    throw new HttpsError('permission-denied', 'Это не ваша точка');
  }

  const ref = await db.collection('quests').add({
    placeId,
    minTimeMinutes,
    maxTimeMinutes,
    rewardPoints: rewardPoints ?? 0,
    promocode: promocode ?? null,
    photoBonusMultiplier: photoBonusMultiplier ?? 1,
    photoRequired: !!photoRequired,
    referenceImages: referenceImages ?? [],
    tasks: Array.isArray(tasks) ? tasks : [],
    isActive: isActive !== false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { ok: true, questId: ref.id };
});

export const updateQuest = onCall(async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Не авторизован');
  const isAdmin = req.auth.token.admin === true;
  const isVenue = req.auth.token.venue === true;
  if (!isAdmin && !isVenue) throw new HttpsError('permission-denied', 'Нет прав');

  const { questId, patch } = req.data as any;
  if (!questId || !patch) throw new HttpsError('invalid-argument', 'questId и patch обязательны');

  const questSnap = await db.collection('quests').doc(questId).get();
  if (!questSnap.exists) throw new HttpsError('not-found', 'Квест не найден');
  const quest = questSnap.data()!;

  const placeSnap = await db.collection('places').doc(quest.placeId).get();
  if (!placeSnap.exists) throw new HttpsError('not-found', 'Точка не найдена');
  const place = placeSnap.data()!;
  if (!isAdmin && place.ownerUid !== req.auth.uid) {
    throw new HttpsError('permission-denied', 'Это не ваш квест');
  }

  const allowed = [
    'minTimeMinutes', 'maxTimeMinutes', 'rewardPoints',
    'promocode', 'photoBonusMultiplier', 'photoRequired',
    'referenceImages', 'tasks', 'isActive',
  ];
  const safe: Record<string, unknown> = {};
  for (const k of allowed) {
    if (patch[k] !== undefined) safe[k] = patch[k];
  }
  if (Object.keys(safe).length === 0) return { ok: true };

  await db.collection('quests').doc(questId).update(safe);
  return { ok: true };
});

export const deleteQuest = onCall(async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Не авторизован');
  const isAdmin = req.auth.token.admin === true;
  const isVenue = req.auth.token.venue === true;
  if (!isAdmin && !isVenue) throw new HttpsError('permission-denied', 'Нет прав');

  const { questId } = req.data as any;
  if (!questId) throw new HttpsError('invalid-argument', 'questId обязателен');

  const questSnap = await db.collection('quests').doc(questId).get();
  if (!questSnap.exists) throw new HttpsError('not-found', 'Квест не найден');
  const quest = questSnap.data()!;

  const placeSnap = await db.collection('places').doc(quest.placeId).get();
  if (!placeSnap.exists) throw new HttpsError('not-found', 'Точка не найдена');
  const place = placeSnap.data()!;
  if (!isAdmin && place.ownerUid !== req.auth.uid) {
    throw new HttpsError('permission-denied', 'Это не ваш квест');
  }

  await db.collection('quests').doc(questId).delete();
  return { ok: true };
});

// ═══════════════════════════════════════════
//  УДАЛЕНИЕ СВОЕЙ ТОЧКИ
// ═══════════════════════════════════════════
export const deleteMyPlace = onCall(async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Не авторизован');
  const isVenue = req.auth.token.venue === true;
  if (!isVenue) throw new HttpsError('permission-denied', 'Только владелец заведения');

  const { placeId } = req.data as any;
  if (!placeId) throw new HttpsError('invalid-argument', 'placeId обязателен');

  const placeRef = db.collection('places').doc(placeId);
  const placeSnap = await placeRef.get();
  if (!placeSnap.exists) throw new HttpsError('not-found', 'Точка не найдена');
  const place = placeSnap.data()!;
  if (place.ownerUid !== req.auth.uid) {
    throw new HttpsError('permission-denied', 'Это не ваша точка');
  }

  const [questsSnap, photosSnap, levelsSnap] = await Promise.all([
    db.collection('quests').where('placeId', '==', placeId).get(),
    db.collection('photos').where('placeId', '==', placeId).get(),
    db.collection('user_levels').where('placeId', '==', placeId).get(),
  ]);

  const allRefs: FirebaseFirestore.DocumentReference[] = [
    placeRef,
    ...questsSnap.docs.map((d) => d.ref),
    ...photosSnap.docs.map((d) => d.ref),
    ...levelsSnap.docs.map((d) => d.ref),
  ];

  const BATCH = 400;
  for (let i = 0; i < allRefs.length; i += BATCH) {
    const chunk = allRefs.slice(i, i + BATCH);
    const batch = db.batch();
    chunk.forEach((ref) => batch.delete(ref));
    await batch.commit();
  }

  const venueRef = db.collection('venues').doc(req.auth.uid);
  const venueSnap = await venueRef.get();
  if (venueSnap.exists) {
    const used = venueSnap.data()!.pointsUsed ?? 0;
    if (used > 0) {
      await venueRef.update({
        pointsUsed: admin.firestore.FieldValue.increment(-1),
      });
    }
  }

  try {
    await admin.storage().bucket().deleteFiles({
      prefix: `places-photos/${placeId}/`,
    });
  } catch (e: any) {
    console.warn('[deleteMyPlace] storage places cleanup:', e?.message);
  }

  try {
    for (const photoDoc of photosSnap.docs) {
      const p = photoDoc.data();
      if (p.imagePath) {
        try {
          await admin.storage().bucket().file(p.imagePath).delete();
        } catch {}
      }
    }
  } catch (e: any) {
    console.warn('[deleteMyPlace] storage photos cleanup:', e?.message);
  }

  return {
    ok: true,
    deletedQuests: questsSnap.size,
    deletedPhotos: photosSnap.size,
  };
});

// ═══════════════════════════════════════════
//  МАГАЗИН КУПОНОВ
// ═══════════════════════════════════════════

function generateCouponCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 8; i++) {
    if (i === 4) out += '-';
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `QL-${out}`;
}

export const createCoupon = onCall(async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Не авторизован');
  const isAdmin = req.auth.token.admin === true;
  const isVenue = req.auth.token.venue === true;
  if (!isAdmin && !isVenue) throw new HttpsError('permission-denied', 'Нет прав');

  const {
    title, description, photoUrl,
    pricePoints, validUntil, expiresAt, maxPurchases,
    maxPerUser, cooldownHours,
  } = req.data as any;

  if (!title || typeof pricePoints !== 'number' || pricePoints < 0) {
    throw new HttpsError('invalid-argument', 'title и pricePoints обязательны');
  }

  const ownerUid = isAdmin ? null : req.auth.uid;

  if (isVenue) {
    const venueRef = db.collection('venues').doc(req.auth.uid);
    const venueSnap = await venueRef.get();
    if (!venueSnap.exists) throw new HttpsError('permission-denied', 'Заведение не найдено');
    const venue = venueSnap.data()!;
    const used = venue.couponsUsed ?? 0;
    const limit = venue.couponsLimit ?? 1;

    if (used >= limit) {
      throw new HttpsError('failed-precondition', 'Лимит купонов исчерпан');
    }

    await venueRef.update({
      couponsUsed: admin.firestore.FieldValue.increment(1),
    });
  }

  const ref = await db.collection('coupons').add({
    ownerUid,
    title,
    description: description ?? '',
    photoUrl: photoUrl ?? null,
    pricePoints,
    validUntil: typeof validUntil === 'number' ? validUntil : null,
    expiresAt: typeof expiresAt === 'number' ? expiresAt : null,
    maxPurchases: typeof maxPurchases === 'number' ? maxPurchases : 0,
    maxPerUser: typeof maxPerUser === 'number' ? maxPerUser : 0,
    cooldownHours: typeof cooldownHours === 'number' ? cooldownHours : 0,
    purchasedCount: 0,
    isActive: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { ok: true, couponId: ref.id };
});

export const updateCoupon = onCall(async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Не авторизован');
  const isAdmin = req.auth.token.admin === true;
  const isVenue = req.auth.token.venue === true;
  if (!isAdmin && !isVenue) throw new HttpsError('permission-denied', 'Нет прав');

  const { couponId, patch } = req.data as any;
  if (!couponId || !patch) {
    throw new HttpsError('invalid-argument', 'couponId и patch обязательны');
  }

  const ref = db.collection('coupons').doc(couponId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Купон не найден');
  const coupon = snap.data()!;

  if (!isAdmin && coupon.ownerUid !== req.auth.uid) {
    throw new HttpsError('permission-denied', 'Это не ваш купон');
  }

  const allowed = [
    'title', 'description', 'photoUrl', 'pricePoints',
    'validUntil', 'expiresAt', 'maxPurchases', 'isActive',
    'maxPerUser', 'cooldownHours',
  ];
  const safe: Record<string, unknown> = {};
  for (const k of allowed) {
    if (patch[k] !== undefined) safe[k] = patch[k];
  }
  if (Object.keys(safe).length === 0) return { ok: true };
  await ref.update(safe);
  return { ok: true };
});

export const deleteCoupon = onCall(async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Не авторизован');
  const isAdmin = req.auth.token.admin === true;
  const isVenue = req.auth.token.venue === true;
  if (!isAdmin && !isVenue) throw new HttpsError('permission-denied', 'Нет прав');

  const { couponId } = req.data as any;
  if (!couponId) throw new HttpsError('invalid-argument', 'couponId обязателен');

  const ref = db.collection('coupons').doc(couponId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Купон не найден');
  const coupon = snap.data()!;

  if (!isAdmin && coupon.ownerUid !== req.auth.uid) {
    throw new HttpsError('permission-denied', 'Это не ваш купон');
  }

  await ref.delete();

  if (coupon.ownerUid) {
    const venueRef = db.collection('venues').doc(coupon.ownerUid);
    const venueSnap = await venueRef.get();
    if (venueSnap.exists) {
      const used = venueSnap.data()!.couponsUsed ?? 0;
      if (used > 0) {
        await venueRef.update({
          couponsUsed: admin.firestore.FieldValue.increment(-1),
        });
      }
    }
  }

  return { ok: true };
});

export const buyCoupon = onCall(async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Не авторизован');
  const { couponId } = req.data as any;
  if (!couponId) throw new HttpsError('invalid-argument', 'couponId обязателен');

  const now = Date.now();

  return await db.runTransaction(async (tx) => {
    const couponRef = db.collection('coupons').doc(couponId);
    const couponSnap = await tx.get(couponRef);
    if (!couponSnap.exists) throw new HttpsError('not-found', 'Купон не найден');

    const coupon = couponSnap.data()!;
    if (!coupon.isActive) {
      throw new HttpsError('failed-precondition', 'Купон неактивен');
    }
    if (coupon.expiresAt && coupon.expiresAt > 0 && coupon.expiresAt <= now) {
      throw new HttpsError('failed-precondition', 'Срок действия купона истёк');
    }
    if (coupon.maxPurchases && coupon.maxPurchases > 0
      && (coupon.purchasedCount ?? 0) >= coupon.maxPurchases) {
      throw new HttpsError('failed-precondition', 'Все купоны раскуплены');
    }

    const userRef = db.collection('users').doc(req.auth!.uid);
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) throw new HttpsError('not-found', 'Пользователь не найден');
    const balance = userSnap.data()!.balance ?? 0;

    if (balance < coupon.pricePoints) {
      throw new HttpsError('failed-precondition', 'Недостаточно баллов');
    }

    if (coupon.maxPerUser && coupon.maxPerUser > 0) {
      const prevSnap = await tx.get(
        db.collection('user_coupons')
          .where('userId', '==', req.auth!.uid)
          .where('couponId', '==', couponId)
          .limit(coupon.maxPerUser)
      );
      if (prevSnap.size >= coupon.maxPerUser) {
        throw new HttpsError('failed-precondition', 'Вы достигли лимита покупок этого купона');
      }

      if (coupon.cooldownHours && coupon.cooldownHours > 0) {
        const latest = await tx.get(
          db.collection('user_coupons')
            .where('userId', '==', req.auth!.uid)
            .where('couponId', '==', couponId)
            .orderBy('createdAt', 'desc')
            .limit(1)
        );
        if (!latest.empty) {
          const lastMs = latest.docs[0].data().createdAt?.toMillis?.() ?? 0;
          const cooldownMs = coupon.cooldownHours * 60 * 60 * 1000;
          if (now - lastMs < cooldownMs) {
            throw new HttpsError('failed-precondition', 'Подождите перед повторной покупкой');
          }
        }
      }
    }

    tx.update(userRef, {
      balance: admin.firestore.FieldValue.increment(-coupon.pricePoints),
    });

    tx.update(couponRef, {
      purchasedCount: admin.firestore.FieldValue.increment(1),
    });

    const userCouponRef = db.collection('user_coupons').doc();
    const code = generateCouponCode();
    tx.set(userCouponRef, {
      userId: req.auth!.uid,
      couponId,
      title: coupon.title,
      description: coupon.description ?? '',
      photoUrl: coupon.photoUrl ?? null,
      code,
      validUntil: coupon.validUntil ?? 0,
      usedAt: null,
      usedByUid: null,
      usedByName: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      ok: true,
      userCouponId: userCouponRef.id,
      code,
      newBalance: balance - coupon.pricePoints,
    };
  });
});

export const redeemCoupon = onCall(async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Не авторизован');
  const isVenue = req.auth.token.venue === true;
  const isAdmin = req.auth.token.admin === true;
  if (!isVenue && !isAdmin) throw new HttpsError('permission-denied', 'Только заведение');

  const { userCouponId } = req.data as { userCouponId?: string };
  if (!userCouponId) throw new HttpsError('invalid-argument', 'userCouponId обязателен');

  const venueRef = db.collection('venues').doc(req.auth.uid);
  const venueSnap = await venueRef.get();
  const venueName = venueSnap.exists ? (venueSnap.data()!.companyName ?? 'Заведение') : 'Заведение';

  const ucRef = db.collection('user_coupons').doc(userCouponId);
  const ucSnap = await ucRef.get();
  if (!ucSnap.exists) throw new HttpsError('not-found', 'Купон не найден');
  const uc = ucSnap.data()!;

  if (uc.usedAt) {
    throw new HttpsError('failed-precondition', 'Купон уже погашен');
  }

  await ucRef.update({
    usedAt: admin.firestore.FieldValue.serverTimestamp(),
    usedByUid: req.auth.uid,
    usedByName: venueName,
  });

  return { ok: true };
});

export const getVenueRedeemedCoupons = onCall(async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Не авторизован');
  const isVenue = req.auth.token.venue === true;
  const isAdmin = req.auth.token.admin === true;
  if (!isVenue && !isAdmin) throw new HttpsError('permission-denied', 'Только заведение');

  const snap = await db
    .collection('user_coupons')
    .where('usedByUid', '==', req.auth.uid)
    .get();

  const list = snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      userId: data.userId,
      title: data.title,
      code: data.code,
      usedAt: data.usedAt?.toMillis?.() ?? 0,
    };
  });

  return { ok: true, coupons: list };
});

export const getUserCoupons = onCall(async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Не авторизован');

  const snap = await db
    .collection('user_coupons')
    .where('userId', '==', req.auth.uid)
    .get();

  const list = snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      userId: data.userId,
      couponId: data.couponId,
      title: data.title,
      description: data.description,
      photoUrl: data.photoUrl ?? null,
      code: data.code,
      validUntil: data.validUntil ?? 0,
      usedAt: data.usedAt?.toMillis?.() ?? null,
      createdAt: data.createdAt?.toMillis?.() ?? 0,
    };
  });

  return { ok: true, coupons: list };
});

export const cleanupExpiredCoupons = onSchedule(
  { schedule: 'every 24 hours', timeZone: 'Europe/Moscow' },
  async () => {
    const now = Date.now();
    const snap = await db.collection('coupons').get();

    const batch = db.batch();
    let count = 0;
    snap.forEach((d) => {
      const data = d.data();
      const expired = data.expiresAt && data.expiresAt > 0 && data.expiresAt <= now;
      const soldOut = data.maxPurchases && data.maxPurchases > 0
        && (data.purchasedCount ?? 0) >= data.maxPurchases;

      if ((expired || soldOut) && data.isActive) {
        batch.update(d.ref, { isActive: false });
        count++;
      }
    });

    if (count > 0) await batch.commit();
  },
);