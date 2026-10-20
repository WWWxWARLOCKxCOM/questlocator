import {
  collection,
  doc,
  onSnapshot,
  query,
  orderBy,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/config/firebase';
import { VenueAccount, QuestPhoto } from '@/types';

const VENUES_COL = 'venues';
const PHOTOS_COL = 'photos';

function fromDoc(id: string, d: any): VenueAccount {
  return {
    uid: id,
    companyName: d.companyName ?? '',
    contactEmail: d.contactEmail ?? '',
    contactPhone: d.contactPhone ?? '',
    pointsLimit: d.pointsLimit ?? 1,
    pointsUsed: d.pointsUsed ?? 0,
    isActive: d.isActive !== false,
    createdAt: d.createdAt?.toMillis?.() ?? 0,
  };
}

/** Подписка на аккаунт заведения (для кабинета и для админа). */
export function subscribeToVenue(uid: string, cb: (venue: VenueAccount | null) => void) {
  return onSnapshot(doc(db, VENUES_COL, uid), (snap) => {
    cb(snap.exists() ? fromDoc(snap.id, snap.data()) : null);
  });
}

/** Список всех заведений (для админ-панели). */
export function subscribeToAllVenues(cb: (venues: VenueAccount[]) => void) {
  const q = query(collection(db, VENUES_COL), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => fromDoc(d.id, d.data()))),
    (err) => {
      // eslint-disable-next-line no-console
      console.warn('[venueService] all venues error:', err.message);
      cb([]);
    },
  );
}

/** Фото на модерацию для конкретного заведения. */
export function subscribeToVenuePhotos(
  venueUid: string,
  cb: (photos: QuestPhoto[]) => void,
) {
  // Firestore требует составной индекс для двойного where, поэтому
  // слушаем всю коллекцию и фильтруем на клиенте.
  const q = query(collection(db, PHOTOS_COL));
  return onSnapshot(q, (snap) => {
    const list = snap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          sessionId: data.sessionId,
          placeId: data.placeId,
          placeOwnerUid: data.placeOwnerUid ?? null,
          userId: data.userId,
          imagePath: data.imagePath,
          imageUrl: data.imagePath ?? '',
          status: data.status,
          createdAt: data.createdAt?.toMillis?.() ?? 0,
        } as QuestPhoto;
      })
      .filter((p) => p.status === 'pending' && p.placeOwnerUid === venueUid);
    cb(list);
  });
}

export async function createVenueAccount(input: {
  email: string;
  password: string;
  companyName: string;
  contactPhone?: string;
  pointsLimit?: number;
}) {
  const fn = httpsCallable<
    typeof input,
    { ok: boolean; uid: string }
  >(functions, 'createVenueAccount');
  return (await fn(input)).data;
}

export async function updateVenuePointsLimit(venueUid: string, pointsLimit: number) {
  const fn = httpsCallable<
    { venueUid: string; pointsLimit: number },
    { ok: boolean }
  >(functions, 'updateVenuePointsLimit');
  return (await fn({ venueUid, pointsLimit })).data;
}

export async function deleteVenueAccount(venueUid: string) {
  const fn = httpsCallable<{ venueUid: string }, { ok: boolean; deletedPlaces: number }>(
    functions,
    'deleteVenueAccount',
  );
  return (await fn({ venueUid })).data;
}

/** Модерация фото (вызывается из PhotoModerationScreen или VenueModerationScreen). */
export async function moderatePhoto(photoId: string, approve: boolean) {
  const fn = httpsCallable<
    { photoId: string; approve: boolean },
    { ok: boolean }
  >(functions, 'moderatePhoto');
  return (await fn({ photoId, approve })).data;
}

/** Владелец заведения: удалить свою точку. Счётчик pointsUsed уменьшится. */
export async function deleteMyPlace(placeId: string) {
  const fn = httpsCallable<{ placeId: string }, { ok: boolean }>(
    functions,
    'deleteMyPlace',
  );
  return (await fn({ placeId })).data;
}