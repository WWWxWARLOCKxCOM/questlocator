import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  limit,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/config/firebase';
import { FriendEntry } from '@/types';

export function subscribeToFriends(
  uid: string,
  cb: (friends: FriendEntry[]) => void,
) {
  let friendUids: string[] = [];
  const userData: Record<string, any> = {};
  const activeByUid: Record<string, { placeId: string; startedAt: number } | null> = {};
  const userUnsubs: Record<string, () => void> = {};
  const sessionUnsubs: Record<string, () => void> = {};

  const emit = () => {
    const list: FriendEntry[] = friendUids.map((fuid) => {
      const u = userData[fuid] ?? {};
      const active = activeByUid[fuid];
      return {
        uid: fuid,
        name: u.name ?? '',
        surname: u.surname ?? '',
        avatarUrl: u.avatarUrl ?? null,
        phone: u.phone ?? '',
        questsCompleted: u.questsCompleted ?? 0,
        activePlaceId: active?.placeId,
        activeSessionStartedAt: active?.startedAt,
      };
    });
    list.sort((a, b) => {
      const aActive = a.activePlaceId ? 0 : 1;
      const bActive = b.activePlaceId ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive;
      return (a.name ?? '').localeCompare(b.name ?? '');
    });
    cb(list);
  };

  const subscribeOne = (fuid: string) => {
    if (userUnsubs[fuid]) return;

    // Подписка на документ пользователя напрямую (быстрее и надёжнее, чем query)
    userUnsubs[fuid] = onSnapshot(
      doc(db, 'users', fuid),
      (snap) => {
        if (snap.exists()) {
          userData[fuid] = snap.data();
          emit();
        } else {
          userData[fuid] = {};
          emit();
        }
      },
      (err) => {
        // eslint-disable-next-line no-console
        console.warn(`[friendsService] user ${fuid} error:`, err.message);
      },
    );

    const q = query(
      collection(db, 'sessions'),
      where('userId', '==', fuid),
      where('status', 'in', ['in_progress', 'paused']),
      limit(1),
    );
    sessionUnsubs[fuid] = onSnapshot(
      q,
      (snap) => {
        if (snap.empty) {
          activeByUid[fuid] = null;
        } else {
          const d = snap.docs[0].data();
          if (d.hideOnMap === true) {
            activeByUid[fuid] = null;
          } else {
            activeByUid[fuid] = {
              placeId: d.placeId,
              startedAt: d.startedAt?.toMillis?.() ?? 0,
            };
          }
        }
        emit();
      },
      (err) => {
        // eslint-disable-next-line no-console
        console.warn(`[friendsService] sessions ${fuid} error:`, err.message);
      },
    );
  };

  const cleanupOne = (fuid: string) => {
    userUnsubs[fuid]?.();
    sessionUnsubs[fuid]?.();
    delete userUnsubs[fuid];
    delete sessionUnsubs[fuid];
  };

  const friendsUnsub = onSnapshot(
    collection(db, 'users', uid, 'friends'),
    (snap) => {
      const newUids = snap.docs.map((d) => d.id);
      Object.keys(userUnsubs).forEach((fuid) => {
        if (!newUids.includes(fuid)) cleanupOne(fuid);
      });
      newUids.forEach(subscribeOne);
      friendUids = newUids;
      emit();
    },
  );

  return () => {
    friendsUnsub();
    Object.keys(userUnsubs).forEach(cleanupOne);
  };
}

export function subscribeToFriendUids(
  uid: string,
  cb: (uids: Set<string>) => void,
) {
  return onSnapshot(collection(db, 'users', uid, 'friends'), (snap) => {
    cb(new Set(snap.docs.map((d) => d.id)));
  });
}

export async function searchUsers(q: string) {
  const fn = httpsCallable<{ q: string }, { ok: boolean; users: any[] }>(
    functions,
    'searchUsers',
  );
  const res = await fn({ q });
  return res.data;
}

export async function addFriend(targetUid: string) {
  const fn = httpsCallable(functions, 'addFriend');
  return (await fn({ targetUid })).data;
}

export async function removeFriend(targetUid: string) {
  const fn = httpsCallable(functions, 'removeFriend');
  return (await fn({ targetUid })).data;
}