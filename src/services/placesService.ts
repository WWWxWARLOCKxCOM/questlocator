/**
 * Работа с заведениями (коллекция places в Firestore).
 *
 * Подписки — через onSnapshot с real-time обновлениями. Создание заведения —
 * через addDoc, после чего вызывается Cloud Function generatePlaceQr,
 * которая генерирует QR-код в формате quest://place/{placeId} и сохраняет
 * его в поле qrCode этого же документа.
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
import { db, functions } from '@/config/firebase';
import { Place } from '@/types';

const COL = 'places';

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

/**
 * Общая функция подписки. Если filterActiveOnly = true, отдаём только
 * активные заведения (для карты клиента). Иначе — все (для админ-панели).
 */
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

/** Подписка на все активные заведения (для карты клиента). */
export function subscribeToActivePlaces(callback: (places: Place[]) => void) {
  return subscribeToPlaces(true, callback);
}

/** Подписка на все заведения (для админ-панели, включая неактивные). */
export function subscribeToAllPlaces(callback: (places: Place[]) => void) {
  return subscribeToPlaces(false, callback);
}

/**
 * Создаёт документ заведения. qrCode заполняется серверной функцией
 * generatePlaceQr сразу после создания — клиенту не нужно его передавать.
 */
export async function createPlace(
  input: Omit<Place, 'id' | 'qrCode' | 'createdAt'>,
): Promise<string> {
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

  // Генерируем QR на сервере (Cloud Function). Если что-то пойдёт не так —
  // заведение уже создано, QR можно перегенерировать через админку.
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
  await deleteDoc(doc(db, COL, id));
}