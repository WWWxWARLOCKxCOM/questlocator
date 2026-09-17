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
 * Скрытая проверка админ-доступа. Пользователь уже должен быть залогинен
 * по email/паролю (обычная регистрация). Серверная функция сверяет email
 * с секретом ADMIN_EMAIL и выставляет custom claim admin=true.
 */
export async function attemptAdminLogin(_email: string, _password: string) {
  const fn = httpsCallable<unknown, { ok: boolean; message?: string }>(
    functions, 'verifyAdminCredentials',
  );
  const res = await fn({});
  if (!res.data.ok) return { ok: false, message: res.data.message };
  // Обновляем токен, чтобы custom claim применился
  await auth.currentUser?.getIdToken(true);
  return { ok: true };
}