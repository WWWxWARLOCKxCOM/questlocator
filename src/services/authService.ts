import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from '@/config/firebase';

export async function signUpWithEmail(email: string, password: string, name: string) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: name });
  await setDoc(doc(db, 'users', cred.user.uid), {
    uid: cred.user.uid,
    email,
    name,
    balance: 0,
    avatarUrl: null,
    createdAt: serverTimestamp(),
  });
  return cred.user;
}

export async function signInWithEmail(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function sendPasswordReset(email: string) {
  await sendPasswordResetEmail(auth, email);
}

export async function signOut() {
  await firebaseSignOut(auth);
}

/**
 * Вход в админку.
 * 1. Логинимся по email/паролю (иначе Cloud Function вернёт unauthenticated).
 * 2. verifyAdminCredentials сверяет email с секретом ADMIN_EMAIL и выставляет
 *    custom claim admin=true.
 * 3. Принудительно обновляем токен — onIdTokenChanged в AuthContext поймает
 *    изменение и переключит навигацию на админскую.
 */
export async function attemptAdminLogin(email: string, password: string) {
  let cred;
  try {
    cred = await signInWithEmailAndPassword(auth, email, password);
  } catch {
    return { ok: false, message: 'Неверные email или пароль.' };
  }

  try {
    const fn = httpsCallable<unknown, { ok: boolean; message?: string }>(
      functions,
      'verifyAdminCredentials',
    );
    const res = await fn({});
    if (!res.data.ok) {
      await firebaseSignOut(auth);
      return { ok: false, message: res.data.message ?? 'Этот аккаунт не является администратором.' };
    }
  } catch {
    await firebaseSignOut(auth);
    return { ok: false, message: 'Не удалось проверить права. Попробуйте позже.' };
  }

  await cred.user.getIdToken(true);
  return { ok: true };
}