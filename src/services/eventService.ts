import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/config/firebase';
import { Event } from '@/types';

function fromDoc(id: string, d: any): Event {
  return {
    id,
    venueUid: d.venueUid,
    placeIds: d.placeIds ?? [],
    title: d.title ?? '',
    description: d.description ?? '',
    linkUrl: d.linkUrl ?? undefined,
    startTime: d.startTime ?? 0,
    endTime: d.endTime ?? 0,
    status: d.status ?? 'archived',
    createdAt: d.createdAt?.toMillis?.() ?? 0,
  };
}

export function subscribeToVenueEvents(venueUid: string, cb: (events: Event[]) => void) {
  const q = query(
    collection(db, 'events'),
    where('venueUid', '==', venueUid),
    orderBy('startTime', 'desc')
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => fromDoc(d.id, d.data())));
  }, (err) => {
    console.warn('[eventService] venue events error:', err.message);
    cb([]);
  });
}

export function subscribeToRelevantEvents(cb: (events: Event[]) => void) {
  const q = query(
    collection(db, 'events'),
    where('status', 'in', ['upcoming', 'active']),
    orderBy('startTime', 'asc')
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => fromDoc(d.id, d.data())));
  }, (err) => {
    console.warn('[eventService] relevant events error:', err.message);
    cb([]);
  });
}

export function subscribeToEventsForPlace(placeId: string, cb: (events: Event[]) => void) {
  const q = query(
    collection(db, 'events'),
    where('placeIds', 'array-contains', placeId),
    where('status', 'in', ['upcoming', 'active']),
    orderBy('startTime', 'desc')
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => fromDoc(d.id, d.data())));
  }, (err) => {
    console.warn('[eventService] place events error:', err.message);
    cb([]);
  });
}

export async function createEvent(data: any) {
  const fn = httpsCallable(functions, 'createEvent');
  return (await fn(data)).data;
}

export async function deleteEvent(eventId: string) {
  const fn = httpsCallable(functions, 'deleteEvent');
  return (await fn({ eventId })).data;
}