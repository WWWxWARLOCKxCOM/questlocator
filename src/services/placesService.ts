import {
  collection, doc, onSnapshot, query, where, orderBy,
  addDoc, updateDoc, deleteDoc, serverTimestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/config/firebase';
import { Place } from '@/types';

const COL = 'places';

function fromDoc(id: string, d: any): Place {
  return {
    id,
    name: d.name,
    address: d.address,
    latitude: d.latitude,
    longitude: d.longitude,
    category: d.category,
    qrCode: d.qrCode ?? '',
    isActive: d.isActive,
    createdAt: d.createdAt?.toMillis?.() ?? 0,
  };
}

function subscribe(filterActiveOnly: boolean, cb: (places: Place[]) => void) {
  const q = filterActiveOnly
    ? query(collection(db, COL), where('isActive', '==', true), orderBy('name'))
    : query(collection(db, COL), orderBy('name'));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => fromDoc(d.id, d.data())));
  });
}

export function subscribeToActivePlaces(cb: (p: Place[]) => void) { return subscribe(true, cb); }
export function subscribeToAllPlaces(cb: (p: Place[]) => void) { return subscribe(false, cb); }

export async function createPlace(input: Omit<Place, 'id' | 'qrCode' | 'createdAt'>) {
  const ref = await addDoc(collection(db, COL), {
    name: input.name,
    address: input.address,
    latitude: input.latitude,
    longitude: input.longitude,
    category: input.category,
    isActive: input.isActive,
    qrCode: '',
    createdAt: serverTimestamp(),
  });
  // Триггер onPlaceCreated в Cloud Functions сам сгенерирует qrCode
  const fn = httpsCallable(functions, 'generatePlaceQr');
  await fn({ placeId: ref.id });
  return ref.id;
}

export async function updatePlace(id: string, patch: Partial<Place>) {
  const payload: Record<string, unknown> = {};
  if (patch.name !== undefined) payload.name = patch.name;
  if (patch.address !== undefined) payload.address = patch.address;
  if (patch.latitude !== undefined) payload.latitude = patch.latitude;
  if (patch.longitude !== undefined) payload.longitude = patch.longitude;
  if (patch.category !== undefined) payload.category = patch.category;
  if (patch.isActive !== undefined) payload.isActive = patch.isActive;
  await updateDoc(doc(db, COL, id), payload);
}

export async function deletePlace(id: string) {
  await deleteDoc(doc(db, COL, id));
}