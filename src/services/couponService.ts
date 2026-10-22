import {
  collection, onSnapshot, query, where, orderBy,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/config/firebase';
import { Coupon, UserCoupon } from '@/types';

function fromDoc(id: string, d: any): Coupon {
  return {
    id,
    ownerUid: d.ownerUid ?? null,
    title: d.title ?? '',
    description: d.description ?? '',
    photoUrl: d.photoUrl ?? undefined,
    pricePoints: d.pricePoints ?? 0,
    validUntil: d.validUntil ?? undefined,
    expiresAt: d.expiresAt ?? undefined,
    maxPurchases: d.maxPurchases ?? 0,
    maxPerUser: d.maxPerUser ?? 0,
    cooldownHours: d.cooldownHours ?? 0,
    purchasedCount: d.purchasedCount ?? 0,
    isActive: d.isActive !== false,
    createdAt: d.createdAt?.toMillis?.() ?? 0,
  };
}

function userCouponFromDoc(id: string, d: any): UserCoupon {
  return {
    id,
    userId: d.userId,
    couponId: d.couponId,
    title: d.title ?? '',
    description: d.description ?? '',
    photoUrl: d.photoUrl ?? undefined,
    code: d.code ?? '',
    validUntil: d.validUntil ?? 0,
    usedAt: d.usedAt?.toMillis?.() ?? undefined,
    usedByUid: d.usedByUid ?? undefined,
    usedByName: d.usedByName ?? undefined,
    createdAt: d.createdAt?.toMillis?.() ?? 0,
  };
}

export function subscribeToActiveCoupons(cb: (coupons: Coupon[]) => void) {
  const q = query(
    collection(db, 'coupons'),
    where('isActive', '==', true),
    orderBy('createdAt', 'desc'),
  );
  return onSnapshot(q, (snap) => {
    const now = Date.now();
    const coupons = snap.docs
      .map((d) => fromDoc(d.id, d.data()))
      // Оставляем только те, у которых нет срока действия или он еще не истек
      .filter((c) => !c.expiresAt || c.expiresAt === 0 || c.expiresAt > now);
    cb(coupons);
  }, (err) => {
    console.warn('[couponService] active coupons error:', err.message);
    cb([]);
  });
}

export function subscribeToAllCoupons(cb: (coupons: Coupon[]) => void) {
  const q = query(collection(db, 'coupons'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => fromDoc(d.id, d.data()))), (err) => {
    console.warn('[couponService] all coupons error:', err.message);
    cb([]);
  });
}

export function subscribeToVenueCoupons(venueUid: string, cb: (coupons: Coupon[]) => void) {
  const q = query(
    collection(db, 'coupons'),
    where('ownerUid', '==', venueUid),
    orderBy('createdAt', 'desc'),
  );
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => fromDoc(d.id, d.data()))), (err) => {
    console.warn('[couponService] venue coupons error:', err.message);
    cb([]);
  });
}

export function subscribeToUserCoupons(userId: string, cb: (coupons: UserCoupon[]) => void) {
  const q = query(
    collection(db, 'user_coupons'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
  );
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => userCouponFromDoc(d.id, d.data()))), (err) => {
    console.warn('[couponService] user coupons error:', err.message);
    cb([]);
  });
}

export async function buyCoupon(couponId: string) {
  const fn = httpsCallable<any, { ok: boolean; userCouponId: string; code: string; newBalance: number }>(functions, 'buyCoupon');
  return (await fn({ couponId })).data;
}

export async function redeemCoupon(userCouponId: string) {
  const fn = httpsCallable<{ userCouponId: string }, { ok: boolean }>(functions, 'redeemCoupon');
  return (await fn({ userCouponId })).data;
}

export async function getVenueRedeemedCoupons() {
  const fn = httpsCallable<unknown, { ok: boolean; coupons: any[] }>(functions, 'getVenueRedeemedCoupons');
  return (await fn({})).data;
}

export async function createCoupon(input: any) {
  const fn = httpsCallable<any, { ok: boolean; couponId: string }>(functions, 'createCoupon');
  return (await fn(input)).data;
}

export async function updateCoupon(couponId: string, patch: any) {
  const fn = httpsCallable<any, { ok: boolean }>(functions, 'updateCoupon');
  return (await fn({ couponId, patch })).data;
}

export async function deleteCoupon(couponId: string) {
  const fn = httpsCallable<any, { ok: boolean }>(functions, 'deleteCoupon');
  return (await fn({ couponId })).data;
}

export async function updateVenueCouponsLimit(venueUid: string, couponsLimit: number) {
  const fn = httpsCallable<any, { ok: boolean }>(functions, 'updateVenueCouponsLimit');
  return (await fn({ venueUid, couponsLimit })).data;
}