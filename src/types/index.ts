export type PlaceCategory = 'restaurant' | 'museum' | 'cafe' | 'shop' | 'exhibition';
export type SessionStatus = 'in_progress' | 'paused' | 'completed' | 'reset';
export type PhotoStatus = 'pending' | 'approved' | 'rejected';
export type QuestTaskType = 'photo' | 'recommendation' | 'questionnaire';

export type LevelResetPeriod = 'month' | '3months' | '6months' | 'year' | 'never';

export interface LevelConfig {
  enabled: boolean;
  completionsPerLevel: number;   
  maxLevel: number;              
  discounts: number[];           
  resetPeriod: LevelResetPeriod; 
}

export interface UserLevel {
  id: string;                    
  userId: string;
  placeId: string;
  level: number;                 
  completionsAtThisLevel: number;
  totalCompletions: number;      
  lastCompletedAt: number;       
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
  website?: string;             
  regNumber: string;            
  country: string;              
  legalAddress: string;         
  taxId: string;                
  employeeName: string;         
  employeePosition?: string;    
  loginEmail: string;           
  pointsLimit: number;
  pointsUsed: number;
  couponsLimit: number;
  couponsUsed: number;
  balance: number;               
  isActive: boolean;
  createdAt: number;
}

export interface VenueApplication {
  uid: string;
  companyName: string;
  regNumber: string;
  country: string;
  legalAddress: string;
  taxId: string;
  corporateEmail: string;
  companyPhone: string;
  employeeName: string;
  employeePosition?: string;
  website?: string;
  loginEmail: string;
  status: 'pending' | 'approved' | 'rejected';
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
  nextBillingDate?: number;      
  scheduledDeletionAt?: number;  
  scheduledDeletionWeeks?: number; 
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

export interface Coupon {
  id: string;
  ownerUid?: string | null;   
  title: string;
  description: string;
  photoUrl?: string;
  pricePoints: number;        
  validUntil?: number;        
  expiresAt?: number;         
  maxPurchases?: number;      
  maxPerUser?: number;        
  cooldownHours?: number;     
  purchasedCount: number;     
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
  code: string;               
  validUntil: number;         
  usedAt?: number;            
  usedByUid?: string;         
  usedByName?: string;        
  createdAt: number;
}

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

export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: 'quest_reward' | 'coupon_buy' | 'coupon_redeem' | 'account_approved';
  isRead: boolean;
  createdAt: number;
}

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