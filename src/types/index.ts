/**
 * Общие типы данных приложения QuestLocator.
 * Соответствуют структуре коллекций Firestore из ТЗ (раздел 5).
 */

export type PlaceCategory = 'restaurant' | 'museum' | 'cafe' | 'shop';

export type SessionStatus = 'in_progress' | 'paused' | 'completed';

export type PhotoStatus = 'pending' | 'approved' | 'rejected';

export interface AppUser {
  uid: string;
  name: string;
  email: string;
  balance: number;
  createdAt: number; // ms since epoch
}

export interface Place {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  category: PlaceCategory;
  qrCode: string; // например, quest://place/abc123
  isActive: boolean;
  createdAt: number;
}

export interface Quest {
  id: string;
  placeId: string;
  minTimeMinutes: number;
  maxTimeMinutes: number;
  rewardPoints: number;
  promocode?: string;
  photoBonusMultiplier: number; // например, 1.3
  photoRequired: boolean;
  referenceImages: string[];
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
  status: SessionStatus;
  pausedAt?: number;
  accumulatedPausedMs?: number;
}

export interface QuestPhoto {
  id: string;
  sessionId: string;
  userId: string;
  imageUrl: string;
  exifLatitude?: number;
  exifLongitude?: number;
  status: PhotoStatus;
  similarityScore?: number;
  createdAt: number;
}

/** Цвет пина на карте — производится на клиенте из состояния места/сессии. */
export type PinStatus = 'available' | 'unavailable' | 'active_session';

export interface GeoPoint {
  latitude: number;
  longitude: number;
}