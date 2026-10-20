import React, { createContext, useContext, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/config/firebase';
import {
  subscribeToUserActiveSession,
  endSession,
  pauseSession,
  resumeSession,
} from '@/services/sessionService';
import { startSessionTracking } from '@/services/locationService';
import { QuestSession, Quest, Place } from '@/types';
import { useAuth } from './AuthContext';

interface SessionContextValue {
  session: QuestSession | null;
  quest: Quest | null;
  place: Place | null;
  isLoading: boolean;
  isPaused: boolean;
  isOutsideZone: boolean;
  isFinishing: boolean;
  elapsedMs: number;
  progress: number;
  estimatedPoints: number;
  timeDone: boolean;
  resumeByUser: () => Promise<void>;
  finish: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue>({
  session: null,
  quest: null,
  place: null,
  isLoading: true,
  isPaused: false,
  isOutsideZone: false,
  isFinishing: false,
  elapsedMs: 0,
  progress: 0,
  estimatedPoints: 0,
  timeDone: false,
  resumeByUser: async () => {},
  finish: async () => {},
});

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [session, setSession] = useState<QuestSession | null>(null);
  const [quest, setQuest] = useState<Quest | null>(null);
  const [place, setPlace] = useState<Place | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [isOutsideZone, setIsOutsideZone] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [nowTick, setNowTick] = useState(Date.now());

  // Подписка на активную сессию пользователя
  useEffect(() => {
    if (!user) {
      setSession(null);
      setIsLoading(false);
      return;
    }
    return subscribeToUserActiveSession(user.uid, (s) => {
      // Пока finish() в процессе — игнорируем обновления подписки,
      // чтобы не вернуть уже завершённую сессию обратно в UI.
      if (isFinishing) return;
      setSession(s);
      setIsLoading(false);
    });
  }, [user, isFinishing]);

  // Квест
  useEffect(() => {
    if (!session?.questId) { setQuest(null); return; }
    return onSnapshot(doc(db, 'quests', session.questId), (snap) => {
      if (snap.exists()) setQuest({ id: snap.id, ...(snap.data() as any) });
    });
  }, [session?.questId]);

  // Заведение
  useEffect(() => {
    if (!session?.placeId) { setPlace(null); return; }
    return onSnapshot(doc(db, 'places', session.placeId), (snap) => {
      if (snap.exists()) setPlace({ id: snap.id, ...(snap.data() as any) });
    });
  }, [session?.placeId]);

  // Тик раз в секунду для таймера
  useEffect(() => {
    if (!session) return;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [session?.id]);

  // Синхронизация isPaused с состоянием сессии на сервере
  useEffect(() => {
    setIsPaused(session?.status === 'paused');
  }, [session?.status]);

  // Геозона: выход — авто-пауза; вход — только флаг, без авто-возобновления
  useEffect(() => {
    if (!session || !place || session.status === 'completed') return;
    let cleanup: (() => void) | undefined;
    (async () => {
      cleanup = await startSessionTracking({
        sessionId: session.id,
        center: { latitude: place.latitude, longitude: place.longitude },
        radiusMeters: place.radiusMeters,
        onEnter: () => {
          setIsOutsideZone(false);
        },
        onExit: async () => {
          setIsOutsideZone(true);
          if (session.status !== 'paused') {
            try {
              await pauseSession(session.id);
            } catch {
              // игнорируем сетевые сбои
            }
          }
        },
      });
    })();
    return () => { cleanup?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, place?.id]);

  const resumeByUser = async () => {
    if (!session) return;
    try {
      await resumeSession(session.id);
      setIsOutsideZone(false);
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось возобновить сессию');
    }
  };

  const finish = async () => {
    if (!session) return;
    if (isFinishing) return;

    const sid = session.id;
    const oldSession = session;

    // 1. Мгновенный отклик — очищаем локальный стейт, пользователь
    //    сразу видит карту и не ждёт ответа сервера.
    setIsFinishing(true);
    setSession(null);
    setQuest(null);
    setPlace(null);
    setIsOutsideZone(false);

    // 2. Запрос к Cloud Function уходит в фон
    try {
      const result = await endSession(sid);
      Alert.alert(
        'Сессия завершена',
        `Заработано: ${result.pointsEarned} баллов.${
          result.promocode ? `\nПромокод: ${result.promocode}` : ''
        }`,
      );
    } catch (e: any) {
      Alert.alert(
        'Не удалось завершить',
        `${e?.message ?? 'Ошибка сети'}\n\nСессия восстановлена. Попробуйте ещё раз.`,
      );
      // Возвращаем сессию, если функция упала
      setSession(oldSession);
    } finally {
      setIsFinishing(false);
    }
  };

  // Расчёты для UI
  const elapsedMs = session
    ? nowTick - session.startedAt - (session.accumulatedPausedMs ?? 0)
    : 0;
  const elapsedMin = Math.max(0, Math.floor(elapsedMs / 60000));

  const minT = quest?.minTimeMinutes ?? 0;
  const maxT = quest?.maxTimeMinutes ?? 60;
  const reward = quest?.rewardPoints ?? 0;

  let progress = 0;
  if (maxT > minT) {
    progress = Math.max(0, Math.min(1, (elapsedMin - minT) / (maxT - minT)));
  }
  const estimatedPoints = Math.round(reward * progress);
  const timeDone = elapsedMin >= maxT;

  return (
    <SessionContext.Provider
      value={{
        session, quest, place, isLoading, isPaused, isOutsideZone, isFinishing,
        elapsedMs, progress, estimatedPoints, timeDone,
        resumeByUser, finish,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}