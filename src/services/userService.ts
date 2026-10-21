/**
 * Работа с пользователями для админ-панели + настройка приватности
 * (скрыть меня на карте).
 */
import {
  collection,
  doc,
  onSnapshot,
  query,
  orderBy,
  updateDoc,
  addDoc,
  getDoc,
  increment,
  serverTimestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, auth, functions } from '@/config/firebase';
import { AppUser } from '@/types';

const COL = 'users';
const AUDIT_COL = 'balance_adjustments';

async function ensureAdminToken(): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Не авторизован');
  try {
    const r = await user.getIdTokenResult(false);
    if (r.claims.admin === true) return;
  } catch {
    // ignore
  }
  await user.getIdToken(true);
  await new Promise((r) => setTimeout(r, 400));
}

function fromDoc(id: string, d: any): AppUser {
  return {
    uid: id,
    name: d.name ?? '',
    surname: d.surname ?? '',
    email: d.email ?? '',
    phone: d.phone ?? '',
    balance: d.balance ?? 0,
    avatarUrl: d.avatarUrl ?? undefined,
    hideOnMap: d.hideOnMap === true,
    questsCompleted: d.questsCompleted ?? 0,
    createdAt: d.createdAt?.toMillis?.() ?? 0,
  };
}

export function subscribeToAllUsers(cb: (users: AppUser[]) => void) {
  const q = query(collection(db, COL), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => fromDoc(d.id, d.data()))),
    (err) => {
      // eslint-disable-next-line no-console
      console.warn('[userService] onSnapshot error:', err.message);
      cb([]);
    },
  );
}

export async function adjustUserBalance(
  userId: string,
  delta: number,
  reason?: string,
): Promise<number> {
  await ensureAdminToken();

  const ref = doc(db, COL, userId);

  // Read current balance first (for negative check + audit log)
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Пользователь не найден');

  const current = snap.data().balance ?? 0;
  if (current + delta < 0) {
    throw new Error(
      `Нельзя списать ${Math.abs(delta)} баллов: у пользователя только ${current}`,
    );
  }

  // Атомарное изменение (защита от гонки между двумя админами)
  await updateDoc(ref, { balance: increment(delta) });

  const next = current + delta;

  // Аудит (не критично, если упадёт)
  try {
    await addDoc(collection(db, AUDIT_COL), {
      userId,
      adminId: auth.currentUser?.uid ?? '',
      adminEmail: auth.currentUser?.email ?? '',
      delta,
      before: current,
      after: next,
      reason: reason ?? '',
      createdAt: serverTimestamp(),
    });
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.warn('[userService] audit write failed:', e?.message);
  }

  return next;
}

/** Включить/выключить отображение на карте для текущего пользователя. */
export async function updateHideOnMap(hide: boolean): Promise<void> {
  const fn = httpsCallable<{ hide: boolean }, { ok: boolean }>(
    functions,
    'updateHideOnMap',
  );
  await fn({ hide });
}