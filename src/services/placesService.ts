import {
  collection, doc, onSnapshot, query, where, orderBy,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { db, functions, storage } from '@/config/firebase';
import { Place, PlaceCategory } from '@/types';

const COL = 'places';

function fromDoc(id: string, d: any): Place {
  return {
    id,
    ownerUid: d.ownerUid ?? undefined,
    name: d.name ?? '',
    address: d.address ?? '',
    description: d.description ?? '',
    photoUrl: d.photoUrl ?? undefined,
    website: d.website ?? undefined,
    phone: d.phone ?? undefined,
    averageCheck: typeof d.averageCheck === 'number' ? d.averageCheck : undefined,
    menuPdfUrl: d.menuPdfUrl ?? undefined,
    latitude: d.latitude ?? 0,
    longitude: d.longitude ?? 0,
    category: d.category ?? 'cafe',
    qrCode: d.qrCode ?? '',
    isActive: d.isActive ?? false,
    radiusMeters: typeof d.radiusMeters === 'number' ? d.radiusMeters : 50,
    createdAt: d.createdAt?.toMillis?.() ?? 0,
    nextBillingDate: d.nextBillingDate?.toMillis?.() ?? 0, // <-- ДОБАВЛЕНО
  };
}

function subscribeToPlaces(filterActiveOnly: boolean, cb: (places: Place[]) => void) {
  const q = filterActiveOnly
    ? query(collection(db, COL), where('isActive', '==', true), orderBy('name'))
    : query(collection(db, COL), orderBy('name'));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => fromDoc(d.id, d.data()))),
    (error) => {
      // eslint-disable-next-line no-console
      console.warn('[placesService] onSnapshot error:', error.message);
      cb([]);
    },
  );
}

export function subscribeToActivePlaces(cb: (places: Place[]) => void) {
  return subscribeToPlaces(true, cb);
}

export function subscribeToAllPlaces(cb: (places: Place[]) => void) {
  return subscribeToPlaces(false, cb);
}

/** Подписка на точки конкретного заведения. */
export function subscribeToPlacesByOwner(
  ownerUid: string,
  cb: (places: Place[]) => void,
) {
  const q = query(
    collection(db, COL),
    where('ownerUid', '==', ownerUid),
    orderBy('createdAt', 'desc'),
  );
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => fromDoc(d.id, d.data()))),
    (error) => {
      // eslint-disable-next-line no-console
      console.warn('[placesService] byOwner error:', error.message);
      cb([]);
    },
  );
}

async function uploadPlacePhoto(placeId: string, uri: string): Promise<string> {
  const blob = await (await fetch(uri)).blob();
  const path = `places-photos/${placeId}/main.jpg`;
  const fileRef = storageRef(storage, path);
  await uploadBytes(fileRef, blob, { contentType: 'image/jpeg' });
  return await getDownloadURL(fileRef);
}

interface CreatePlaceInput {
  name: string;
  address: string;
  description?: string;
  photoUri?: string;
  website?: string;
  phone?: string;
  averageCheck?: number;
  menuPdfUrl?: string;
  latitude: number;
  longitude: number;
  category: PlaceCategory;
  isActive: boolean;
  radiusMeters: number;
  ownerUid?: string | null; // только для админа
}

export async function createPlace(input: CreatePlaceInput): Promise<string> {
  const fn = httpsCallable<
    {
      name: string; address: string; description?: string;
      website?: string; phone?: string; averageCheck?: number; menuPdfUrl?: string;
      latitude: number; longitude: number; category: string;
      radiusMeters: number; isActive: boolean;
      ownerUid?: string | null;
    },
    { ok: boolean; placeId: string; qrCode: string }
  >(functions, 'createPlace');

  const res = await fn({
    name: input.name,
    address: input.address,
    description: input.description,
    website: input.website ?? '',
    phone: input.phone ?? '',
    averageCheck: typeof input.averageCheck === 'number' ? input.averageCheck : undefined,
    menuPdfUrl: input.menuPdfUrl ?? '',
    latitude: input.latitude,
    longitude: input.longitude,
    category: input.category,
    radiusMeters: input.radiusMeters,
    isActive: input.isActive,
    ownerUid: input.ownerUid ?? null,
  });

  const placeId = res.data.placeId;

  // Загружаем фото и обновляем документ
  if (input.photoUri) {
    try {
      const url = await uploadPlacePhoto(placeId, input.photoUri);
      const fn2 = httpsCallable(functions, 'updatePlacePhoto');
      await fn2({ placeId, photoUrl: url });
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.warn('[placesService] photo upload failed:', e?.message);
    }
  }

  return placeId;
}

/** Владелец / админ: обновить простое поле точки. */
export async function updatePlace(id: string, patch: Partial<Place>): Promise<void> {
  const fn = httpsCallable<{ placeId: string; patch: Record<string, unknown> }, { ok: boolean }>(
    functions,
    'updatePlace',
  );
  await fn({ placeId: id, patch });
}

/** Удалить точку — только админ. */
export async function deletePlace(id: string): Promise<void> {
  const fn = httpsCallable<{ placeId: string }, { ok: boolean }>(functions, 'deletePlace');
  await fn({ placeId: id });
}

/** Админ: подвязать существующую точку к аккаунту заведения. */
export async function assignPlaceOwner(placeId: string, ownerUid: string | null) {
  const fn = httpsCallable<
    { placeId: string; ownerUid: string | null },
    { ok: boolean }
  >(functions, 'assignPlaceOwner');
  return (await fn({ placeId, ownerUid })).data;
}