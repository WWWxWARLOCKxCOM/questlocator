import { collection, doc, onSnapshot, query, orderBy, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/config/firebase';
import { VenueAccount, QuestPhoto, VenueApplication } from '@/types';

const VENUES_COL = 'venues';
const PHOTOS_COL = 'photos';

function fromDoc(id: string, d: any): VenueAccount {
  return {
    uid: id,
    companyName: d.companyName ?? '',
    contactEmail: d.contactEmail ?? '',
    contactPhone: d.contactPhone ?? '',
    website: d.website ?? '',
    regNumber: d.regNumber ?? '',
    country: d.country ?? '',
    legalAddress: d.legalAddress ?? '',
    taxId: d.taxId ?? '',
    employeeName: d.employeeName ?? '',
    employeePosition: d.employeePosition ?? '',
    loginEmail: d.loginEmail ?? '',
    pointsLimit: d.pointsLimit ?? 2,
    pointsUsed: d.pointsUsed ?? 0,
    couponsLimit: d.couponsLimit ?? 2,
    couponsUsed: d.couponsUsed ?? 0,
    balance: d.balance ?? 0,
    isActive: d.isActive !== false,
    createdAt: d.createdAt?.toMillis?.() ?? 0,
  };
}

export function subscribeToVenue(uid: string, cb: (venue: VenueAccount | null) => void) {
  return onSnapshot(doc(db, VENUES_COL, uid), (snap) => {
    cb(snap.exists() ? fromDoc(snap.id, snap.data()) : null);
  }, (err) => {
    console.warn('[venueService] venue error:', err.message);
    cb(null);
  });
}

export function subscribeToAllVenues(cb: (venues: VenueAccount[]) => void) {
  const q = query(collection(db, VENUES_COL), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => fromDoc(d.id, d.data()))),
    (err) => {
      console.warn('[venueService] all venues error:', err.message);
      cb([]);
    }
  );
}

export function subscribeToVenuePhotos(
  venueUid: string,
  cb: (photos: QuestPhoto[]) => void,
) {
  const q = query(
    collection(db, PHOTOS_COL),
    where('status', '==', 'pending'),
    where('placeOwnerUid', '==', venueUid),
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => {
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
      });
      cb(list);
    },
    (err) => {
      console.warn('[venueService] photos error:', err.message);
      cb([]);
    },
  );
}

export async function createVenueAccount(input: any) {
  const fn = httpsCallable<any, { ok: boolean; uid: string }>(functions, 'createVenueAccount');
  return (await fn(input)).data;
}

export async function updateVenuePointsLimit(venueUid: string, pointsLimit: number) {
  const fn = httpsCallable<any, { ok: boolean }>(functions, 'updateVenueLimits');
  return (await fn({ venueUid, pointsLimit })).data;
}

export async function deleteVenueAccount(venueUid: string) {
  const fn = httpsCallable<any, { ok: boolean }>(functions, 'deleteVenueAccount');
  return (await fn({ venueUid })).data;
}

export async function moderatePhoto(photoId: string, approve: boolean) {
  const fn = httpsCallable<any, { ok: boolean }>(functions, 'moderatePhoto');
  return (await fn({ photoId, approve })).data;
}

export async function deleteMyPlace(placeId: string) {
  const fn = httpsCallable<any, { ok: boolean }>(functions, 'deleteMyPlace');
  return (await fn({ placeId })).data;
}

export async function updateVenueLimits(
  venueUid: string,
  pointsLimit?: number,
  couponsLimit?: number,
) {
  const fn = httpsCallable<any, { ok: boolean }>(functions, 'updateVenueLimits');
  return (await fn({ venueUid, pointsLimit, couponsLimit })).data;
}

export async function adjustVenueBalance(
  venueUid: string,
  amount: number,
  description?: string,
) {
  const fn = httpsCallable<any, { ok: boolean }>(functions, 'adjustVenueBalance');
  return (await fn({ venueUid, amount, description })).data;
}

export async function updateGlobalSettings(
  pointsPerQuest: number,
  monthlyCostPerPlace: number,
) {
  const fn = httpsCallable<any, { ok: boolean }>(functions, 'updateGlobalSettings');
  return (await fn({ pointsPerQuest, monthlyCostPerPlace })).data;
}

export function subscribeToVenueTransactions(
  venueUid: string,
  cb: (txs: any[]) => void,
) {
  const q = query(
    collection(db, 'venue_transactions'),
    where('venueUid', '==', venueUid),
    orderBy('createdAt', 'desc'),
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => {
        const data = d.data();
        return { id: d.id, ...data, createdAt: data.createdAt?.toMillis?.() ?? 0 };
      });
      cb(list);
    },
    (err) => {
      console.warn('[venueService] transactions error:', err.message);
      cb([]);
    },
  );
}

// ═══════════════════════════════════════════
//  ЗАЯВКИ НА РЕГИСТРАЦИЮ
// ═══════════════════════════════════════════
export async function submitVenueApplication(data: any) {
  const fn = httpsCallable<any, { ok: boolean }>(functions, 'submitVenueApplication');
  return (await fn(data)).data;
}

export function subscribeToVenueApplications(cb: (apps: VenueApplication[]) => void) {
  const q = query(
    collection(db, 'venue_applications'), 
    where('status', '==', 'pending'), 
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(
    q, 
    (snap) => {
      cb(snap.docs.map(d => ({ 
        ...d.data(), 
        createdAt: d.data().createdAt?.toMillis?.() ?? 0 
      } as VenueApplication)));
    },
    (err) => {
      // ЗАЩИТА ОТ ПАДЕНИЯ
      console.warn('[venueService] applications error:', err.message);
      cb([]); 
    }
  );
}

export async function approveVenueApplication(applicationId: string) {
  const fn = httpsCallable<any, { ok: boolean }>(functions, 'approveVenueApplication');
  return (await fn({ applicationId })).data;
}

export async function rejectVenueApplication(applicationId: string) {
  const fn = httpsCallable<any, { ok: boolean }>(functions, 'rejectVenueApplication');
  return (await fn({ applicationId })).data;
}