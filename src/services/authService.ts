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

/**
 * РЕГИСТРАЦИЯ. Создаёт только обычного клиента.
 * Сразу пишет searchKey, чтобы пользователь находился в поиске друзей
 * без необходимости заходить в Профиль.
 */
export async function signUpWithEmail(email: string, password: string, name: string) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: name });

  const searchKey = [name, email]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  await setDoc(doc(db, 'users', cred.user.uid), {
    uid: cred.user.uid,
    name,
    surname: '',
    email,
    phone: '',
    balance: 0,
    avatarUrl: null,
    hideOnMap: false,
    questsCompleted: 0,
    isAdmin: false,
    isVenue: false,
    searchKey,
    createdAt: serverTimestamp(),
  });

  return cred.user;
}

/**
 * ОБЫЧНЫЙ ВХОД (только для клиентов).
 * Если попытается зайти админ или заведение — разлогиниваем и
 * бросаем понятную ошибку. Каждая роль должна использовать свой вход.
 */
export async function signInWithEmail(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(auth, email, password);

  try {
    const token = await cred.user.getIdTokenResult(true);

    if (token.claims.admin === true) {
      await firebaseSignOut(auth);
      throw new Error(
        'Это администраторский аккаунт. Для входа нажмите 5 раз на логотип.',
      );
    }

    if (token.claims.venue === true) {
      await firebaseSignOut(auth);
      throw new Error(
        'Это аккаунт заведения. Используйте кнопку «Войти как заведение» ниже.',
      );
    }
  } catch (e) {
    // Если getIdTokenResult упал или мы бросили ошибку выше —
    // убеждаемся, что пользователь разлогинен.
    if (auth.currentUser) {
      try {
        await firebaseSignOut(auth);
      } catch {
        // ignore
      }
    }
    throw e;
  }

  return cred.user;
}

export async function sendPasswordReset(email: string) {
  await sendPasswordResetEmail(auth, email);
}

export async function signOut() {
  await firebaseSignOut(auth);
}

/**
 * ВХОД В АДМИНКУ. Полный флоу: signin → verifyAdminCredentials → проверка claim.
 * Вызывается из AdminGateScreen.
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
      return {
        ok: false,
        message: res.data.message ?? 'Этот аккаунт не является администратором.',
      };
    }
  } catch (e: any) {
    await firebaseSignOut(auth);
    if (e?.code === 'functions/unavailable' || e?.message?.includes('network')) {
      return { ok: false, message: 'Нет связи с сервером. Проверьте интернет.' };
    }
    return { ok: false, message: 'Не удалось проверить права. Попробуйте позже.' };
  }

  for (let i = 0; i < 5; i++) {
    try {
      await cred.user.getIdToken(true);
      const result = await cred.user.getIdTokenResult();
      if (result.claims.admin === true) {
        return { ok: true };
      }
    } catch (e: any) {
      if (e?.code === 'auth/network-request-failed') {
        return { ok: false, message: 'Плохое соединение. Попробуйте снова.' };
      }
    }
    await new Promise((r) => setTimeout(r, 800));
  }

  return { ok: false, message: 'Права администратора не применились. Попробуйте войти заново.' };
}