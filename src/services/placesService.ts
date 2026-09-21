/**
 * Работа с заведениями (коллекция places в Firestore).
 *
 * Подписки — через onSnapshot с real-time обновлениями. Создание заведения —
 * через addDoc, после чего вызывается Cloud Function generatePlaceQr,
 * которая генерирует QR-код в формате quest://place/{placeId} и сохраняет
 * его в поле qrCode этого же документа.
 *
 * ВАЖНО: перед любой записью вызывается ensureAdminToken() — она
 * принудительно пересоздаёт ID-токен Firebase. Без этого Firestore SDK
 * может использовать закэшированный токен без custom claim admin=true,
 * и запись падает с "Missing or insufficient permissions".
 */
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  orderBy,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions, auth } from '@/config/firebase';
import { Place } from '@/types';

const COL = 'places';

/** Гарантирует свежий ID-токен с custom claim admin=true у Firestore SDK. */
async function ensureAdminToken(): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Не авторизован');
  await user.getIdToken(true);
}

function fromDoc(id: string, d: any): Place {
  return {
    id,
    name: d.name ?? '',
    address: d.address ?? '',
    latitude: d.latitude ?? 0,
    longitude: d.longitude ?? 0,
    category: d.category ?? 'cafe',
    qrCode: d.qrCode ?? '',
    isActive: d.isActive ?? false,
    radiusMeters: typeof d.radiusMeters === 'number' ? d.radiusMeters : 50,
    createdAt: d.createdAt?.toMillis?.() ?? 0,
  };
}

function subscribeToPlaces(
  filterActiveOnly: boolean,
  callback: (places: Place[]) => void,
) {
  const q = filterActiveOnly
    ? query(
        collection(db, COL),
        where('isActive', '==', true),
        orderBy('name'),
      )
    : query(collection(db, COL), orderBy('name'));

  return onSnapshot(
    q,
    (snap) => {
      callback(snap.docs.map((d) => fromDoc(d.id, d.data())));
    },
    (error) => {
      // eslint-disable-next-line no-console
      console.warn('[placesService] onSnapshot error:', error.message);
      callback([]);
    },
  );
}

export function subscribeToActivePlaces(callback: (places: Place[]) => void) {
  return subscribeToPlaces(true, callback);
}

export function subscribeToAllPlaces(callback: (places: Place[]) => void) {
  return subscribeToPlaces(false, callback);
}

export async function createPlace(
  input: Omit<Place, 'id' | 'qrCode' | 'createdAt'>,
): Promise<string> {
  await ensureAdminToken(); // ← фикс прав доступа

  const ref = await addDoc(collection(db, COL), {
    name: input.name,
    address: input.address,
    latitude: input.latitude,
    longitude: input.longitude,
    category: input.category,
    isActive: input.isActive,
    radiusMeters: input.radiusMeters,
    qrCode: '',
    createdAt: serverTimestamp(),
  });

  // Генерируем QR на сервере. Если упадёт — заведение уже создано,
  // QR можно перегенерировать через админку.
  try {
    const fn = httpsCallable<{ placeId: string }, { ok: boolean; value: string }>(
      functions,
      'generatePlaceQr',
    );
    await fn({ placeId: ref.id });
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.warn('[placesService] generatePlaceQr failed:', e?.message);
  }

  return ref.id;
}

export async function updatePlace(id: string, patch: Partial<Place>): Promise<void> {
  await ensureAdminToken(); // ← фикс прав доступа

  const payload: Record<string, unknown> = {};
  if (patch.name !== undefined) payload.name = patch.name;
  if (patch.address !== undefined) payload.address = patch.address;
  if (patch.latitude !== undefined) payload.latitude = patch.latitude;
  if (patch.longitude !== undefined) payload.longitude = patch.longitude;
  if (patch.category !== undefined) payload.category = patch.category;
  if (patch.isActive !== undefined) payload.isActive = patch.isActive;
  if (patch.radiusMeters !== undefined) payload.radiusMeters = patch.radiusMeters;

  await updateDoc(doc(db, COL, id), payload);
}

export async function deletePlace(id: string): Promise<void> {
  await ensureAdminToken(); // ← фикс прав доступа
  await deleteDoc(doc(db, COL, id));
}