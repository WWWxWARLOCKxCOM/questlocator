import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  View, StyleSheet, Text, TouchableOpacity, Image, ScrollView,
  Linking, Alert,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Region, Circle } from 'react-native-maps';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { Portal } from '@gorhom/portal';
import {
  useNavigation, DrawerActions, useRoute, RouteProp,
} from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { ClientStackParamList } from '@/navigation/ClientNavigator';
import { subscribeToActivePlaces } from '@/services/placesService';
import { subscribeToActiveQuestForPlace } from '@/services/questService';
import { getCurrentPosition } from '@/services/locationService';
import {
  subscribeToAllActiveSessions,
  subscribeToUserSessions,
} from '@/services/sessionService';
import { subscribeToFriendUids } from '@/services/friendsService';
import { subscribeToUserLevels } from '@/services/levelService';
import { useSession } from '@/context/SessionContext';
import { useAuth } from '@/context/AuthContext';
import {
  Place, Quest, PinStatus, GeoPoint, QuestSession, PlaceCategory,
  UserLevel, CATEGORY_LABELS,
} from '@/types';

type Nav = NativeStackNavigationProp<ClientStackParamList>;
type Rt = RouteProp<ClientStackParamList, 'Map'>;

const COOLDOWN_HOURS = 20;

const PIN_COLORS: Record<PinStatus, string> = {
  available: '#2ecc71',
  active_session: '#f1c40f',
  cooldown: '#e74c3c',
};

const CATEGORY_ICONS: Record<PlaceCategory, keyof typeof MaterialCommunityIcons.glyphMap> = {
  restaurant: 'silverware-fork-knife',
  cafe: 'coffee',
  museum: 'bank',
  shop: 'shopping',
  exhibition: 'image-frame',
};

function formatShort(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

async function openUrl(url: string) {
  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported) return Alert.alert('Ошибка', 'Не удалось открыть ссылку');
    await Linking.openURL(url);
  } catch {
    Alert.alert('Ошибка', 'Не удалось открыть ссылку');
  }
}

async function callPhone(phone: string) {
  try {
    await Linking.openURL(`tel:${phone.replace(/\s+/g, '')}`);
  } catch {
    Alert.alert('Ошибка', 'Не удалось совершить звонок');
  }
}

export default function MapScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { user } = useAuth();
  const { session, elapsedMs } = useSession();
  const sheetRef = useRef<BottomSheet>(null);
  const mapRef = useRef<MapView>(null);

  const [places, setPlaces] = useState<Place[]>([]);
  const [userLocation, setUserLocation] = useState<GeoPoint | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [selectedQuest, setSelectedQuest] = useState<Quest | null>(null);
  const [activeSessions, setActiveSessions] = useState<QuestSession[]>([]);
  const [mySessions, setMySessions] = useState<QuestSession[]>([]);
  const [friendUids, setFriendUids] = useState<Set<string>>(new Set());
  const [myLevels, setMyLevels] = useState<Record<string, UserLevel>>({});

  useEffect(() => {
    const unsub1 = subscribeToActivePlaces(setPlaces);
    const unsub2 = subscribeToAllActiveSessions(setActiveSessions);
    getCurrentPosition().then(setUserLocation).catch(() => {});
    return () => { unsub1(); unsub2(); };
  }, []);

  useEffect(() => {
    if (!user) { setMySessions([]); setMyLevels({}); return; }
    const u1 = subscribeToUserSessions(user.uid, setMySessions);
    const u2 = subscribeToUserLevels(user.uid, setMyLevels);
    return () => { u1(); u2(); };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return subscribeToFriendUids(user.uid, setFriendUids);
  }, [user]);

  useEffect(() => {
    if (!selectedPlace) { setSelectedQuest(null); return; }
    return subscribeToActiveQuestForPlace(selectedPlace.id, setSelectedQuest);
  }, [selectedPlace]);

  useEffect(() => {
    const focusId = route.params?.focusPlaceId;
    if (!focusId || places.length === 0) return;
    const p = places.find((x) => x.id === focusId);
    if (!p) return;

    setSelectedPlace(p);
    mapRef.current?.animateToRegion(
      {
        latitude: p.latitude,
        longitude: p.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      },
      600,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params?.focusPlaceId, places.length]);

  const initialRegion: Region | undefined = useMemo(() => {
    if (!userLocation) return undefined;
    return {
      latitude: userLocation.latitude,
      longitude: userLocation.longitude,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    };
  }, [userLocation]);

  const pinStatusFor = useCallback((place: Place): PinStatus => {
    const myActive = mySessions.find(
      (s) => s.placeId === place.id && (s.status === 'in_progress' || s.status === 'paused'),
    );
    if (myActive) return 'active_session';

    const cooldownMs = COOLDOWN_HOURS * 60 * 60 * 1000;
    const now = Date.now();
    const recentCompleted = mySessions.find(
      (s) =>
        s.placeId === place.id &&
        s.status === 'completed' &&
        s.endedAt &&
        now - s.endedAt < cooldownMs,
    );
    if (recentCompleted) return 'cooldown';

    return 'available';
  }, [mySessions]);

  const sessionsByPlace = useMemo(() => {
    const map: Record<string, QuestSession[]> = {};
    activeSessions.forEach((s) => {
      if (!map[s.placeId]) map[s.placeId] = [];
      map[s.placeId].push(s);
    });
    Object.values(map).forEach((arr) => {
      arr.sort((a, b) => {
        const aFriend = friendUids.has(a.userId) ? 0 : 1;
        const bFriend = friendUids.has(b.userId) ? 0 : 1;
        return aFriend - bFriend;
      });
    });
    return map;
  }, [activeSessions, friendUids]);

  const handleStartScan = () => {
    if (!selectedPlace || !selectedQuest) return;
    navigation.navigate('QRScanner', {
      placeId: selectedPlace.id,
      questId: selectedQuest.id,
      placeLatitude: selectedPlace.latitude,
      placeLongitude: selectedPlace.longitude,
    });
  };

  const openDrawer = () => navigation.dispatch(DrawerActions.openDrawer());
  const closeSheet = () => {
    sheetRef.current?.close();
    setTimeout(() => setSelectedPlace(null), 250);
  };

  const selectedLevelBlock = useMemo(() => {
    if (!selectedPlace?.levels?.enabled) return null;
    const cfg = selectedPlace.levels;
    const lvl = myLevels[selectedPlace.id];
    const curLevel = lvl?.level ?? 0;
    const curDiscount = curLevel === 0 ? 0 : (cfg.discounts?.[curLevel - 1] ?? 0);
    const perLevel = Math.max(1, cfg.completionsPerLevel ?? 1);
    const isMax = curLevel >= (cfg.maxLevel ?? 1);
    const completions = lvl?.completionsAtThisLevel ?? 0;
    const prog = isMax ? 1 : completions / perLevel;
    const nextDiscount =
      !isMax && curLevel > 0
        ? cfg.discounts?.[curLevel] ?? curDiscount
        : !isMax && curLevel === 0
        ? cfg.discounts?.[0] ?? 0
        : null;
    return { cfg, curLevel, curDiscount, nextDiscount, perLevel, isMax, completions, prog };
  }, [selectedPlace, myLevels]);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFillObject}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton
      >
        {places.map((place) => {
          const sessions = sessionsByPlace[place.id] ?? [];
          const visible = sessions.slice(0, 3);
          const extra = sessions.length - visible.length;
          const status = pinStatusFor(place);
          const color = PIN_COLORS[status];

          const showLevel = !!place.levels && place.levels.enabled === true;
          const userLvl = myLevels[place.id];
          const displayLevel = userLvl?.level ?? 0;

          return (
            <React.Fragment key={place.id}>
              <Marker
                coordinate={{ latitude: place.latitude, longitude: place.longitude }}
                onPress={() => setSelectedPlace(place)}
              >
                <View style={styles.markerWrap}>
                  {showLevel ? (
                    <View
                      style={[
                        styles.levelChip,
                        displayLevel === 0 && styles.levelChipZero,
                      ]}
                    >
                      <Text style={styles.levelChipText}>Ур. {displayLevel}</Text>
                    </View>
                  ) : null}
                  <View style={[styles.markerBubble, { backgroundColor: color }]}>
                    <MaterialCommunityIcons
                      name={CATEGORY_ICONS[place.category]}
                      size={18}
                      color="#fff"
                    />
                  </View>
                  <View style={styles.markerLabel}>
                    <Text style={styles.markerLabelText} numberOfLines={1}>
                      {place.name}
                    </Text>
                    {typeof place.averageCheck === 'number' && place.averageCheck > 0 ? (
                      <Text style={styles.markerCheckText}>от {place.averageCheck} ₽</Text>
                    ) : null}
                  </View>
                </View>
              </Marker>

              {selectedPlace?.id === place.id && (
                <Circle
                  center={{ latitude: place.latitude, longitude: place.longitude }}
                  radius={place.radiusMeters ?? 50}
                  strokeColor={`${color}CC`}
                  fillColor={`${color}26`}
                />
              )}

              {sessions.length > 0 && (
                <Marker
                  coordinate={{
                    latitude: place.latitude - 0.0005,
                    longitude: place.longitude,
                  }}
                  anchor={{ x: 0.5, y: 1 }}
                >
                  <View style={styles.avatarsRow}>
                    {visible.map((s) => (
                      <View
                        key={s.id}
                        style={[
                          styles.avatarWrap,
                          friendUids.has(s.userId) && styles.avatarWrapFriend,
                        ]}
                      >
                        {s.userAvatarUrl ? (
                          <Image source={{ uri: s.userAvatarUrl }} style={styles.avatar} />
                        ) : (
                          <View style={[styles.avatar, styles.avatarPlaceholder]}>
                            <Text style={styles.avatarText}>
                              {(s.userName?.[0] ?? '?').toUpperCase()}
                            </Text>
                          </View>
                        )}
                      </View>
                    ))}
                    {extra > 0 && (
                      <View style={[styles.avatarWrap, styles.extraWrap]}>
                        <Text style={styles.extraText}>+{extra}</Text>
                      </View>
                    )}
                  </View>
                </Marker>
              )}
            </React.Fragment>
          );
        })}
      </MapView>

      {/* Кнопка-гамбургер — открывает меню. Поиск и фильтры теперь
          только на главном экране в bottom sheet. */}
      <TouchableOpacity style={styles.hamburger} onPress={openDrawer}>
        <Ionicons name="menu" size={24} color="#000" />
      </TouchableOpacity>

      {session && (
        <Portal>
          <TouchableOpacity
            style={styles.sessionBadge}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('ActiveSession')}
          >
            <Ionicons name="timer-outline" size={18} color="#fff" />
            <Text style={styles.sessionBadgeText}>{formatShort(elapsedMs)}</Text>
          </TouchableOpacity>
        </Portal>
      )}

      {selectedPlace && (
        <BottomSheet
          ref={sheetRef}
          index={0}
          snapPoints={['45%', '80%']}
          enablePanDownToClose
          onClose={() => setSelectedPlace(null)}
          backgroundStyle={{ borderRadius: 16 }}
        >
          <BottomSheetView style={styles.sheetContent}>
            <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
              <TouchableOpacity style={styles.closeBtn} onPress={closeSheet}>
                <Ionicons name="close" size={22} color="#333" />
              </TouchableOpacity>

              {selectedPlace.photoUrl ? (
                <Image source={{ uri: selectedPlace.photoUrl }} style={styles.placePhoto} />
              ) : (
                <View style={[styles.placePhoto, styles.placePhotoPlaceholder]}>
                  <MaterialCommunityIcons
                    name={CATEGORY_ICONS[selectedPlace.category]}
                    size={48}
                    color="#bbb"
                  />
                </View>
              )}

              <View style={{ paddingHorizontal: 16 }}>
                <Text style={styles.placeCategory}>
                  {CATEGORY_LABELS[selectedPlace.category]}
                </Text>
                <Text style={styles.placeName}>{selectedPlace.name}</Text>
                <Text style={styles.placeAddress}>{selectedPlace.address}</Text>

                {selectedLevelBlock ? (
                  <View style={styles.levelBlock}>
                    <View style={styles.levelHeaderRow}>
                      <MaterialCommunityIcons name="star-circle" size={20} color="#f1c40f" />
                      <Text style={styles.levelHeaderText}>
                        Ваш уровень: {selectedLevelBlock.curLevel}
                        {selectedLevelBlock.curLevel === 0 ? ' (новичок)' : ''}
                        {selectedLevelBlock.isMax ? ' (макс.)' : ''}
                      </Text>
                      <Text style={styles.levelDiscount}>
                        −{selectedLevelBlock.curDiscount}%
                      </Text>
                    </View>

                    {!selectedLevelBlock.isMax && (
                      <>
                        <View style={styles.progressBarBg}>
                          <View
                            style={[
                              styles.progressBarFill,
                              { width: `${selectedLevelBlock.prog * 100}%` },
                            ]}
                          />
                        </View>
                        <Text style={styles.levelProgress}>
                          До уровня {selectedLevelBlock.curLevel + 1}:{' '}
                          {selectedLevelBlock.completions} / {selectedLevelBlock.perLevel}
                        </Text>
                        {selectedLevelBlock.nextDiscount !== null &&
                          selectedLevelBlock.nextDiscount >
                            selectedLevelBlock.curDiscount && (
                            <Text style={styles.levelNext}>
                              На следующем уровне скидка{' '}
                              {selectedLevelBlock.nextDiscount}%
                            </Text>
                          )}
                      </>
                    )}
                  </View>
                ) : null}

                {typeof selectedPlace.averageCheck === 'number' &&
                  selectedPlace.averageCheck > 0 ? (
                  <Text style={styles.averageCheckLine}>
                    💰 Средний чек: от {selectedPlace.averageCheck} ₽
                  </Text>
                ) : null}

                {(selectedPlace.website ||
                  selectedPlace.phone ||
                  selectedPlace.menuPdfUrl) && (
                  <View style={styles.actionButtonsRow}>
                    {selectedPlace.website ? (
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => openUrl(selectedPlace.website!)}
                      >
                        <Ionicons name="globe-outline" size={18} color="#2c3e50" />
                        <Text style={styles.actionButtonText}>Сайт</Text>
                      </TouchableOpacity>
                    ) : null}

                    {selectedPlace.phone ? (
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => callPhone(selectedPlace.phone!)}
                      >
                        <Ionicons name="call-outline" size={18} color="#2c3e50" />
                        <Text style={styles.actionButtonText}>Позвонить</Text>
                      </TouchableOpacity>
                    ) : null}

                    {selectedPlace.menuPdfUrl ? (
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => openUrl(selectedPlace.menuPdfUrl!)}
                      >
                        <Ionicons name="document-text-outline" size={18} color="#2c3e50" />
                        <Text style={styles.actionButtonText}>Меню</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                )}

                {selectedPlace.description ? (
                  <Text style={styles.placeDescription}>{selectedPlace.description}</Text>
                ) : null}

                <View style={styles.divider} />

                {selectedQuest ? (
                  <>
                    <Text style={styles.questLine}>
                      ⏱ Время: от {selectedQuest.minTimeMinutes} до {selectedQuest.maxTimeMinutes} мин
                    </Text>
                    <Text style={styles.questLine}>
                      🏆 Награда: до {selectedQuest.rewardPoints} баллов
                    </Text>
                    {selectedQuest.promocode ? (
                      <Text style={styles.questLine}>🎁 Промокод: {selectedQuest.promocode}</Text>
                    ) : null}

                    {pinStatusFor(selectedPlace) === 'active_session' ? (
                      <Text style={styles.activeWarn}>
                        Вы уже проходите квест здесь — вернитесь в активную сессию.
                      </Text>
                    ) : pinStatusFor(selectedPlace) === 'cooldown' ? (
                      <Text style={styles.cooldownWarn}>
                        Вы недавно проходили этот квест. Следующая попытка — через{' '}
                        {COOLDOWN_HOURS} часов.
                      </Text>
                    ) : session ? (
                      <Text style={styles.activeWarn}>
                        У вас уже есть активная сессия в другом месте.
                      </Text>
                    ) : (
                      <TouchableOpacity style={styles.scanButton} onPress={handleStartScan}>
                        <Text style={styles.scanButtonText}>Сканировать QR и начать</Text>
                      </TouchableOpacity>
                    )}
                  </>
                ) : (
                  <Text style={{ color: '#888' }}>Активных квестов здесь сейчас нет.</Text>
                )}
              </View>
            </ScrollView>
          </BottomSheetView>
        </BottomSheet>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hamburger: {
    position: 'absolute', top: 48, left: 16,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    elevation: 4, shadowColor: '#000', shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 }, shadowRadius: 4,
  },
  markerWrap: { alignItems: 'center' },
  levelChip: {
    backgroundColor: '#f1c40f', borderRadius: 10,
    paddingHorizontal: 6, paddingVertical: 2, marginBottom: 2,
  },
  levelChipZero: { backgroundColor: '#d0d0d0' },
  levelChipText: { color: '#000', fontSize: 10, fontWeight: '800' },
  markerBubble: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
    elevation: 4, shadowColor: '#000', shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 2 }, shadowRadius: 3,
  },
  markerLabel: {
    marginTop: 2, backgroundColor: '#fff',
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 6, maxWidth: 130, alignItems: 'center',
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 1 }, shadowRadius: 2,
  },
  markerLabelText: { fontSize: 11, fontWeight: '600', color: '#222' },
  markerCheckText: { fontSize: 10, color: '#27ae60', fontWeight: '700', marginTop: 1 },
  sessionBadge: {
    position: 'absolute', top: 110, left: 16,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#2ecc71',
    paddingVertical: 10, paddingHorizontal: 14, borderRadius: 22,
    elevation: 20, shadowColor: '#000', shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 }, shadowRadius: 8,
    zIndex: 9999,
  },
  sessionBadgeText: { color: '#fff', fontWeight: '800', fontSize: 14, letterSpacing: 0.5 },
  sheetContent: { flex: 1 },
  closeBtn: {
    position: 'absolute', top: 8, right: 8, zIndex: 10,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center', justifyContent: 'center',
    elevation: 3,
  },
  placePhoto: { width: '100%', height: 180 },
  placePhotoPlaceholder: {
    backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center',
  },
  placeCategory: {
    color: '#2ecc71', fontWeight: '700', fontSize: 12,
    textTransform: 'uppercase', marginTop: 12,
  },
  placeName: { fontSize: 20, fontWeight: '800', marginTop: 4 },
  placeAddress: { color: '#666', marginTop: 2 },
  levelBlock: {
    marginTop: 12, padding: 12, borderRadius: 10,
    backgroundColor: '#fffbea', borderLeftWidth: 4, borderLeftColor: '#f1c40f',
  },
  levelHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  levelHeaderText: { flex: 1, fontWeight: '700', fontSize: 14 },
  levelDiscount: { color: '#27ae60', fontWeight: '800', fontSize: 16 },
  progressBarBg: {
    height: 6, backgroundColor: '#eee', borderRadius: 3, marginTop: 8, overflow: 'hidden',
  },
  progressBarFill: { height: '100%', backgroundColor: '#f1c40f' },
  levelProgress: { color: '#666', fontSize: 12, marginTop: 6 },
  levelNext: { color: '#27ae60', fontSize: 12, marginTop: 4, fontWeight: '600' },
  averageCheckLine: { color: '#27ae60', fontWeight: '700', marginTop: 8, fontSize: 14 },
  placeDescription: { marginTop: 10, color: '#333', lineHeight: 20 },
  divider: {
    height: StyleSheet.hairlineWidth, backgroundColor: '#ddd', marginVertical: 12,
  },
  questLine: { fontSize: 15, marginBottom: 4 },
  scanButton: {
    marginTop: 16, backgroundColor: '#2ecc71', borderRadius: 10,
    paddingVertical: 14, alignItems: 'center',
  },
  scanButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  activeWarn: { color: '#e67e22', marginTop: 12, fontWeight: '600' },
  cooldownWarn: { color: '#c0392b', marginTop: 12, fontWeight: '600' },
  actionButtonsRow: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  actionButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1.5, borderColor: '#2c3e50', borderRadius: 8,
    paddingVertical: 8, paddingHorizontal: 12,
  },
  actionButtonText: { color: '#2c3e50', fontWeight: '600', fontSize: 13 },
  avatarsRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 20, paddingHorizontal: 4, paddingVertical: 2,
  },
  avatarWrap: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 2, borderColor: '#fff',
    marginLeft: -6, backgroundColor: '#ddd', overflow: 'hidden',
  },
  avatarWrapFriend: { borderColor: '#2ecc71' },
  avatar: { width: '100%', height: '100%' },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 12, fontWeight: '700', color: '#555' },
  extraWrap: { backgroundColor: '#333', alignItems: 'center', justifyContent: 'center' },
  extraText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});