export type PlaceCategory = 'restaurant' | 'museum' | 'cafe' | 'shop';
export type SessionStatus = 'in_progress' | 'paused' | 'completed';
export type PhotoStatus = 'pending' | 'approved' | 'rejected';

export interface AppUser {
  uid: string;
  name: string;
  email: string;
  balance: number;
  avatarUrl?: string;
  createdAt: number;
}

export interface Place {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  category: PlaceCategory;
  qrCode: string;
  isActive: boolean;
  radiusMeters: number;
  createdAt: number;
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
  promocode?: string;
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

export type PinStatus = 'available' | 'unavailable' | 'active_session';

export interface GeoPoint {
  latitude: number;
  longitude: number;
}