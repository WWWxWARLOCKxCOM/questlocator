/**
 * Анти-фрод без использования ИИ (см. ТЗ п.3.3):
 *  - каждые STATIONARY_CHECK_INTERVAL_MIN минут проверяем показания акселерометра;
 *  - если суммарное движение за интервал ниже порога — считаем телефон неподвижным;
 *  - после STATIONARY_TIMEOUT_MIN минут непрерывной неподвижности отправляем
 *    push "Я здесь" и даём STATIONARY_GRACE_PERIOD_MIN минут на подтверждение;
 *  - если пользователь не подтвердил — сессия завершается принудительно
 *    (см. sessionService.forceEndSessionForInactivity).
 */
import { Accelerometer } from 'expo-sensors';
import * as Notifications from 'expo-notifications';

const CHECK_INTERVAL_MS = 10 * 60 * 1000; // 10 минут
const STATIONARY_TIMEOUT_MS = 45 * 60 * 1000; // 45 минут
const GRACE_PERIOD_MS = 5 * 60 * 1000; // 5 минут
const MOVEMENT_THRESHOLD = 0.15; // эмпирический порог изменения ускорения (в g)

type Sample = { x: number; y: number; z: number };

export class AntiFraudMonitor {
  private lastSample: Sample | null = null;
  private lastMovementAt: number = Date.now();
  private checkTimer: ReturnType<typeof setInterval> | null = null;
  private graceTimer: ReturnType<typeof setTimeout> | null = null;
  private accelSubscription: { remove: () => void } | null = null;

  constructor(
    private readonly onStationaryTimeout: () => void,
    private readonly onGracePeriodExpired: () => void,
  ) {}

  start() {
    Accelerometer.setUpdateInterval(1000);
    this.accelSubscription = Accelerometer.addListener((sample) => {
      if (this.lastSample) {
        const delta =
          Math.abs(sample.x - this.lastSample.x) +
          Math.abs(sample.y - this.lastSample.y) +
          Math.abs(sample.z - this.lastSample.z);
        if (delta > MOVEMENT_THRESHOLD) {
          this.lastMovementAt = Date.now();
        }
      }
      this.lastSample = sample;
    });

    this.checkTimer = setInterval(() => this.evaluate(), CHECK_INTERVAL_MS);
  }

  private async evaluate() {
    const stationaryDuration = Date.now() - this.lastMovementAt;
    if (stationaryDuration >= STATIONARY_TIMEOUT_MS && !this.graceTimer) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Вы всё ещё здесь?',
          body: 'Нажмите «Я здесь», чтобы не потерять прогресс сессии.',
          data: { type: 'PRESENCE_CHECK' },
        },
        trigger: null,
      });
      this.onStationaryTimeout();

      this.graceTimer = setTimeout(() => {
        this.onGracePeriodExpired();
      }, GRACE_PERIOD_MS);
    }
  }

  /** Вызывается при нажатии пользователем кнопки "Я здесь". */
  confirmPresence() {
    this.lastMovementAt = Date.now();
    if (this.graceTimer) {
      clearTimeout(this.graceTimer);
      this.graceTimer = null;
    }
  }

  stop() {
    this.accelSubscription?.remove();
    if (this.checkTimer) clearInterval(this.checkTimer);
    if (this.graceTimer) clearTimeout(this.graceTimer);
  }
}
