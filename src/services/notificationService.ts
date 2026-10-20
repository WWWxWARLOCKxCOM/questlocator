import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { Notification } from '@/types'; // Убедись, что добавил тип Notification в types/index.ts

export function subscribeToNotifications(userId: string, cb: (notifs: Notification[]) => void) {
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snap) => {
    const list = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        createdAt: data.createdAt?.toMillis?.() ?? 0
      } as Notification;
    });
    cb(list);
  });
}

export async function markNotificationRead(id: string) {
  await updateDoc(doc(db, 'notifications', id), { isRead: true });
}

export async function markAllNotificationsRead(ids: string[]) {
  const batch = writeBatch(db);
  ids.forEach(id => {
    batch.update(doc(db, 'notifications', id), { isRead: true });
  });
  await batch.commit();
}