export type PlaceCategory = 'restaurant' | 'museum' | 'cafe' | 'shop' | 'exhibition';
export type SessionStatus = 'in_progress' | 'paused' | 'completed' | 'reset';
export type PhotoStatus = 'pending' | 'approved' | 'rejected';
export type QuestTaskType = 'photo' | 'recommendation' | 'questionnaire';

export type LevelResetPeriod = 'month' | '3months' | '6months' | 'year' | 'never';

export interface LevelConfig {
  enabled: boolean;
  completionsPerLevel: number;   // сколько прохождений на 1 уровень
  maxLevel: number;              // максимум уровней (например, 4)
  discounts: number[];           // скидка в % на каждом уровне. discounts[0] = скидка на 1 уровне
  resetPeriod: LevelResetPeriod; // через сколько сбрасывается прогресс
}

/** Личный уровень пользователя в конкретном заведении. */
export interface UserLevel {
  id: string;                    // `${userId}__${placeId}`
  userId: string;
  placeId: string;
  level: number;                 // текущий уровень (1..maxLevel)
  completionsAtThisLevel: number;// сколько пройдено на текущем уровне
  totalCompletions: number;      // всего пройдено в этом заведении
  lastCompletedAt: number;       // ms последнего завершения
  updatedAt: number;
}

export interface QuestTaskQuestion {
  id: string;
  text: string;
  options?: string[];
}

export interface QuestTask {
  id: string;
  type: QuestTaskType;
  title: string;
  description: string;
  repeatCount: number;
  bonusPoints: number;
  referencePhotoUrl?: string;
  minLength?: number;
  questions?: QuestTaskQuestion[];
}

export interface AppUser {
  uid: string;
  name: string;
  surname?: string;
  email: string;
  phone?: string;
  balance: number;
  avatarUrl?: string;
  hideOnMap?: boolean;
  questsCompleted?: number;
  searchKey?: string;
  isAdmin?: boolean;
  isVenue?: boolean;
  createdAt: number;
}

export interface VenueAccount {
  uid: string;
  companyName: string;
  contactEmail: string;
  contactPhone?: string;
  pointsLimit: number;
  pointsUsed: number;
  couponsLimit: number;
  couponsUsed: number;
  balance: number;               // ← НОВОЕ: баллы заведения
  isActive: boolean;
  createdAt: number;
}

export interface Place {
  id: string;
  ownerUid?: string;
  name: string;
  address: string;
  description?: string;
  photoUrl?: string;
  website?: string;
  phone?: string;
  averageCheck?: number;
  menuPdfUrl?: string;
  latitude: number;
  longitude: number;
  category: PlaceCategory;
  qrCode: string;
  isActive: boolean;
  radiusMeters: number;
  levels?: LevelConfig;
  createdAt: number;
  nextBillingDate?: number;      // ← НОВОЕ: дата следующего списания
}

export interface Quest {
  id: string;
  placeId: string;
  minTimeMinutes: number;
  maxTimeMinutes: number;
  rewardPoints: number;
  promocode?: string;
  photoBonusMultiplier: number;
  photoRequired: boolean;
  referenceImages: string[];
  tasks: QuestTask[];
  isActive: boolean;
  createdAt: number;
}

export interface QuestSession {
  id: string;
  userId: string;
  placeId: string;
  questId: string;
  startedAt: number;
  endedAt?: number;
  totalTimeMinutes: number;
  pointsEarned: number;
  photosSubmitted: string[];
  photoBonusApplied: boolean;
  taskBonusPoints: number;
  status: SessionStatus;
  promocode?: string;
  timeDone?: boolean;
  pausedAt?: number;
  accumulatedPausedMs?: number;
  userName?: string;
  userSurname?: string;
  userAvatarUrl?: string | null;
  hideOnMap?: boolean;
}

export interface QuestTaskSubmission {
  id: string;
  userId: string;
  sessionId: string;
  placeId: string;
  questId: string;
  taskId: string;
  taskType: QuestTaskType;
  answerText?: string;
  answerPhotoPath?: string;
  answerAnswers?: { questionId: string; answer: string }[];
  bonusPoints: number;
  createdAt: number;
}

export interface QuestPhoto {
  id: string;
  sessionId: string;
  placeId?: string;
  placeOwnerUid?: string | null;
  userId: string;
  imagePath?: string;
  imageUrl: string;
  exifLatitude?: number;
  exifLongitude?: number;
  status: PhotoStatus;
  similarityScore?: number;
  createdAt: number;
}

export interface FriendEntry {
  uid: string;
  name: string;
  surname?: string;
  avatarUrl?: string | null;
  phone?: string;
  questsCompleted?: number;
  activePlaceId?: string;
  activeSessionStartedAt?: number;
}

export type PinStatus = 'available' | 'active_session' | 'cooldown';

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

// ═══════════════════════════════════════════
//  МАГАЗИН КУПОНОВ
// ═══════════════════════════════════════════
export interface Coupon {
  id: string;
  ownerUid?: string | null;   // null = админский купон, иначе uid заведения
  title: string;
  description: string;
  photoUrl?: string;
  pricePoints: number;        // цена в баллах
  validUntil?: number;        // ms — срок действия самого купона (для покупателя)
  expiresAt?: number;         // ms — после этой даты купон убирается из магазина (0 = бесконечно)
  maxPurchases?: number;      // максимум покупок (0 = неограниченно)
  maxPerUser?: number;        // максимум покупок одним человеком (0 = неограниченно)
  cooldownHours?: number;     // часов до следующей покупки (0 = сразу)
  purchasedCount: number;     // сколько уже куплено
  isActive: boolean;
  createdAt: number;
}

export interface UserCoupon {
  id: string;
  userId: string;
  couponId: string;
  title: string;
  description: string;
  photoUrl?: string;
  code: string;               // уникальный код
  validUntil: number;         // ms — до какой даты купон действует
  usedAt?: number;            // когда использован (undefined = не использован)
  usedByUid?: string;         // uid заведения, которое погасило
  usedByName?: string;        // название заведения, которое погасило
  createdAt: number;
}

// ═══════════════════════════════════════════
//  ФИНАНСЫ ЗАВЕДЕНИЙ
// ═══════════════════════════════════════════
export interface VenueTransaction {
  id: string;
  venueUid: string;
  type: 'quest_reward' | 'monthly_fee' | 'admin_adjustment';
  amount: number;
  description: string;
  createdAt: number;
}

export interface GlobalSettings {
  pointsPerQuest: number;
  monthlyCostPerPlace: number;
}

// ═══════════════════════════════════════════
//  УВЕДОМЛЕНИЯ (НОВОЕ)
// ═══════════════════════════════════════════
export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: 'quest_reward' | 'coupon_buy' | 'coupon_redeem';
  isRead: boolean;
  createdAt: number;
}

// ═══════════════════════════════════════════
//  КОНСТАНТЫ
// ═══════════════════════════════════════════
export const CATEGORY_LABELS: Record<PlaceCategory, string> = {
  restaurant: 'Ресторан',
  cafe: 'Кафе',
  museum: 'Музей',
  shop: 'Магазин',
  exhibition: 'Выставка',
};

export const ALL_CATEGORIES: PlaceCategory[] = [
  'restaurant', 'cafe', 'museum', 'shop', 'exhibition',
];

export const TASK_TYPE_LABELS: Record<QuestTaskType, string> = {
  photo: 'Фото-задание',
  recommendation: 'Рекомендация / отзыв',
  questionnaire: 'Ответы на вопросы',
};

export const LEVEL_RESET_LABELS: Record<LevelResetPeriod, string> = {
  month: 'Раз в месяц',
  '3months': 'Раз в 3 месяца',
  '6months': 'Раз в полгода',
  year: 'Раз в год',
  never: 'Никогда не сбрасывать',
};