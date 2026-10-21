import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, ScrollView,
  TextInput, Keyboard, Pressable, Platform,
} from 'react-native';
import Constants from 'expo-constants';
import MapView, { Marker, PROVIDER_GOOGLE, Circle } from 'react-native-maps';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { Portal } from '@gorhom/portal';
import DraggableFlatList, {
  RenderItemParams,
  ScaleDecorator,
} from 'react-native-draggable-flatlist';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useSession } from '@/context/SessionContext';
import { useTheme } from '@/context/ThemeContext';
import { subscribeToActivePlaces } from '@/services/placesService';
import { subscribeToActiveQuestForPlace } from '@/services/questService';
import { subscribeToUserLevels } from '@/services/levelService';
import {
  subscribeToAllActiveSessions,
  subscribeToUserSessions,
} from '@/services/sessionService';
import { subscribeToFriendUids } from '@/services/friendsService';
import { getCurrentPosition } from '@/services/locationService';
import { distanceInMeters } from '@/utils/distance';
import {
  loadSectionsOrder,
  saveSectionsOrder,
  SectionId,
} from '@/services/sectionsOrderService';
import AppHeader from '@/components/AppHeader';
import {
  Place, Quest, PlaceCategory, UserLevel, QuestSession, GeoPoint,
  CATEGORY_LABELS, ALL_CATEGORIES,
} from '@/types';

const MAX_NEARBY_DISTANCE_M = 5000;
const BASE_MAP_DELTA = 0.008;

let hasCenteredThisSession = false;

const CATEGORY_ICONS: Record<PlaceCategory, keyof typeof MaterialCommunityIcons.glyphMap> = {
  restaurant: 'silverware-fork-knife',
  cafe: 'coffee',
  museum: 'bank',
  shop: 'shopping',
  exhibition: 'image-frame',
};

type Nav = any;

const SECTION_TITLES: Record<SectionId, string> = {
  nearby: 'Рядом с вами',
  levels: 'Ваши уровни',
  friends: 'Друзья сейчас на квесте',
  promo: 'Промокоды',
  history: 'Последние квесты',
};

interface NearbyItem {
  p: Place;
  d: number;
}

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const { session, elapsedMs } = useSession();
  const { colors } = useTheme();

  const [places, setPlaces] = useState<Place[]>([]);
  const [levels, setLevels] = useState<Record<string, UserLevel>>({});
  const [sessions, setSessions] = useState<QuestSession[]>([]);
  const [mySessions, setMySessions] = useState<QuestSession[]>([]);
  const [friendUids, setFriendUids] = useState<Set<string>>(new Set());
  const [loc, setLoc] = useState<GeoPoint | null>(null);
  const [profile, setProfile] = useState<{ balance: number; avatarUrl: string | null }>({
    balance: 0,
    avatarUrl: null,
  });

  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [selectedQuest, setSelectedQuest] = useState<Quest | null>(null);

  const [query, setQuery] = useState('');
  const [enabledCategories, setEnabledCategories] = useState<Set<PlaceCategory>>(
    new Set(ALL_CATEGORIES),
  );

  const [order, setOrder] = useState<SectionId[]>([]);
  const [dragging, setDragging] = useState(false);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [headerH, setHeaderH] = useState(140);

  const [mapDelta, setMapDelta] = useState(BASE_MAP_DELTA);
  const waveScale = Math.max(0.3, Math.min(6, mapDelta / BASE_MAP_DELTA));

  const [pulseRadius, setPulseRadius] = useState(20);

  const contentSheetRef = useRef<BottomSheet>(null);
  const placeSheetRef = useRef<BottomSheet>(null);
  const mapRef = useRef<MapView>(null);

  const contentSnapPoints = useMemo(
    () => [Math.max(140, Math.round(headerH) + 12), '50%'],
    [headerH],
  );
  const placeSnapPoints = useMemo(() => ['50%', '90%'], []);

  useEffect(() => {
    const u1 = subscribeToActivePlaces(setPlaces);
    const u2 = subscribeToAllActiveSessions(setSessions);
    getCurrentPosition().then(setLoc).catch(() => {});
    return () => {
      u1();
      u2();
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    const u1 = subscribeToUserLevels(user.uid, setLevels);
    const u2 = subscribeToFriendUids(user.uid, setFriendUids);
    const u3 = subscribeToUserSessions(user.uid, setMySessions);
    return () => {
      u1();
      u2();
      u3();
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { doc, onSnapshot } = require('firebase/firestore');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { db } = require('@/config/firebase');
    return onSnapshot(doc(db, 'users', user.uid), (snap: any) => {
      const d = snap.data() ?? {};
      setProfile({ balance: d.balance ?? 0, avatarUrl: d.avatarUrl ?? null });
    });
  }, [user]);

  useEffect(() => {
    if (!loc) return;
    if (hasCenteredThisSession) return;
    hasCenteredThisSession = true;
    const t = setTimeout(() => {
      mapRef.current?.animateToRegion(
        {
          latitude: loc.latitude,
          longitude: loc.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        },
        800,
      );
    }, 350);
    return () => clearTimeout(t);
  }, [loc]);

  useEffect(() => {
    if (!selectedPlace) {
      setSelectedQuest(null);
      return;
    }
    return subscribeToActiveQuestForPlace(selectedPlace.id, setSelectedQuest);
  }, [selectedPlace]);

  useEffect(() => {
    loadSectionsOrder().then(setOrder);
  }, []);

  useEffect(() => {
    if (!selectedPlace) {
      setPulseRadius(20);
      return;
    }
    setPulseRadius(20);
    const interval = setInterval(() => {
      setPulseRadius((r) => (r >= 150 ? 20 : r + 6));
    }, 90);
    return () => clearInterval(interval);
  }, [selectedPlace?.id]);

  const handleSelectPlace = (place: Place, collapseSheet = true) => {
    setSelectedPlace(place);
    if (collapseSheet) {
      contentSheetRef.current?.snapToIndex(0);
      setTimeout(() => placeSheetRef.current?.snapToIndex(0), 200);
    }
    mapRef.current?.animateToRegion(
      {
        latitude: place.latitude,
        longitude: place.longitude,
        latitudeDelta: BASE_MAP_DELTA,
        longitudeDelta: BASE_MAP_DELTA,
      },
      500,
    );
  };

  const closePlaceSheet = () => {
    placeSheetRef.current?.close();
    setTimeout(() => setSelectedPlace(null), 250);
  };

  const visiblePlaces = useMemo(() => {
    const q = query.trim().toLowerCase();
    return places.filter((p) => {
      if (!enabledCategories.has(p.category)) return false;
      if (!q) return true;
      const hay = `${p.name} ${p.address}`.toLowerCase();
      return hay.includes(q);
    });
  }, [places, query, enabledCategories]);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return places
      .filter((p) => `${p.name} ${p.address}`.toLowerCase().includes(q))
      .slice(0, 6);
  }, [places, query]);

  const showSuggestions = query.trim().length >= 2;

  useEffect(() => {
    if (showSuggestions) {
      contentSheetRef.current?.snapToIndex(1);
    }
  }, [showSuggestions]);

  const nearby = useMemo<NearbyItem[]>(() => {
    if (!loc) {
      return visiblePlaces.slice(0, 6).map((p) => ({ p, d: -1 }));
    }
    return visiblePlaces
      .map<NearbyItem>((p) => ({
        p,
        d: distanceInMeters(loc, {
          latitude: p.latitude,
          longitude: p.longitude,
        }),
      }))
      .filter((x) => x.d <= MAX_NEARBY_DISTANCE_M)
      .sort((a, b) => a.d - b.d)
      .slice(0, 6);
  }, [visiblePlaces, loc]);

  const activeLevels = useMemo(
    () =>
      Object.values(levels)
        .filter((l) => l.level >= 1 || l.completionsAtThisLevel > 0)
        .sort((a, b) => b.lastCompletedAt - a.lastCompletedAt)
        .slice(0, 4),
    [levels],
  );

  const friendsActive = useMemo(
    () => sessions.filter((s) => friendUids.has(s.userId)).slice(0, 5),
    [sessions, friendUids],
  );

  const promos = useMemo(
    () => mySessions.filter((s) => !!s.promocode).slice(0, 5),
    [mySessions],
  );

  const recentHistory = useMemo(() => mySessions.slice(0, 5), [mySessions]);

  const renderSection = ({ item, drag, isActive }: RenderItemParams<SectionId>) => (
    <ScaleDecorator>
      <Pressable
        onLongPress={drag}
        delayLongPress={150}
        style={[
          styles.sectionBlock,
          isActive && { backgroundColor: colors.surfaceAlt, borderRadius: 12 },
        ]}
      >
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {SECTION_TITLES[item]}
          </Text>
          <MaterialCommunityIcons
            name="drag-vertical"
            size={22}
            color={colors.textMuted}
          />
        </View>
        {renderSectionContent(item)}
      </Pressable>
    </ScaleDecorator>
  );

  const renderSectionContent = (id: SectionId) => {
    switch (id) {
      case 'nearby': {
        if (nearby.length === 0) {
          return (
            <Text style={[styles.sectionEmpty, { color: colors.textMuted }]}>
              Рядом пока нет заведений
            </Text>
          );
        }
        return (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {nearby.map(({ p, d }) => (
              <TouchableOpacity
                key={p.id}
                style={[
                  styles.placeCard,
                  { backgroundColor: colors.cardBg, borderColor: colors.border },
                ]}
                onPress={() => handleSelectPlace(p)}
              >
                {p.photoUrl ? (
                  <Image source={{ uri: p.photoUrl }} style={styles.placeCardImg} />
                ) : (
                  <View style={[styles.placeCardImg, { backgroundColor: colors.text }]}>
                    <MaterialCommunityIcons
                      name={CATEGORY_ICONS[p.category]}
                      size={28}
                      color={colors.background}
                    />
                  </View>
                )}
                <View style={styles.placeCardBody}>
                  <Text
                    style={[styles.placeCardName, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {p.name}
                  </Text>
                  <Text style={[styles.placeCardMeta, { color: colors.textMuted }]}>
                    {CATEGORY_LABELS[p.category]}
                    {d >= 0
                      ? ` · ${
                          d < 1000 ? `${Math.round(d)} м` : `${(d / 1000).toFixed(1)} км`
                        }`
                      : ''}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        );
      }

      case 'levels': {
        if (activeLevels.length === 0) {
          return (
            <Text style={[styles.sectionEmpty, { color: colors.textMuted }]}>
              Пока нет прогресса. Пройдите квест.
            </Text>
          );
        }
        return activeLevels.map((l) => {
          const place = places.find((x) => x.id === l.placeId);
          const cfg = place?.levels;
          if (!place || !cfg?.enabled) return null;
          const perLevel = Math.max(1, cfg.completionsPerLevel ?? 1);
          const prog = Math.min(1, l.completionsAtThisLevel / perLevel);
          return (
            <TouchableOpacity
              key={l.id}
              style={[
                styles.levelCard,
                { backgroundColor: colors.cardBg, borderColor: colors.border },
              ]}
              onPress={() => navigation.navigate('Levels')}
            >
              <View style={styles.levelBadge}>
                <Text style={styles.levelBadgeText}>Ур. {l.level}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.levelName, { color: colors.text }]}>
                  {place.name}
                </Text>
                <View style={[styles.progressBarBg, { backgroundColor: colors.surfaceAlt }]}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${prog * 100}%`, backgroundColor: colors.primary },
                    ]}
                  />
                </View>
                <Text style={[styles.levelProgress, { color: colors.textMuted }]}>
                  {l.completionsAtThisLevel} / {perLevel} до след. уровня
                </Text>
              </View>
            </TouchableOpacity>
          );
        });
      }

      case 'friends': {
        if (friendsActive.length === 0) {
          return (
            <Text style={[styles.sectionEmpty, { color: colors.textMuted }]}>
              Никто из друзей сейчас не на квесте
            </Text>
          );
        }
        return friendsActive.map((s) => {
          const place = places.find((x) => x.id === s.placeId);
          return (
            <TouchableOpacity
              key={s.id}
              style={[
                styles.friendRow,
                { backgroundColor: colors.cardBg, borderColor: colors.border },
              ]}
              onPress={() => place && handleSelectPlace(place)}
              disabled={!place}
            >
              {s.userAvatarUrl ? (
                <Image source={{ uri: s.userAvatarUrl }} style={styles.friendAvatar} />
              ) : (
                <View
                  style={[styles.friendAvatar, { backgroundColor: colors.surfaceAlt }]}
                >
                  <Text style={{ fontWeight: '700', color: colors.textMuted }}>
                    {(s.userName?.[0] ?? '?').toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={[styles.friendName, { color: colors.text }]}>
                  {s.userName} {s.userSurname}
                </Text>
                <Text style={[styles.friendMeta, { color: colors.primary }]}>
                  {place ? `Проходит в «${place.name}»` : 'Проходит квест'}
                </Text>
              </View>
              <Ionicons name="location-outline" size={20} color={colors.primary} />
            </TouchableOpacity>
          );
        });
      }

      case 'promo': {
        if (promos.length === 0) {
          return (
            <Text style={[styles.sectionEmpty, { color: colors.textMuted }]}>
              Промокодов пока нет
            </Text>
          );
        }
        return promos.map((s) => (
          <TouchableOpacity
            key={s.id}
            style={[
              styles.promoRow,
              { backgroundColor: colors.cardBg, borderColor: colors.border },
            ]}
            onPress={() => navigation.navigate('PromoCodes')}
          >
            <MaterialCommunityIcons name="ticket-percent" size={22} color={colors.primary} />
            <Text style={[styles.promoCode, { color: colors.text }]}>
              {s.promocode}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        ));
      }

      case 'history': {
        if (recentHistory.length === 0) {
          return (
            <Text style={[styles.sectionEmpty, { color: colors.textMuted }]}>
              История пуста
            </Text>
          );
        }
        return recentHistory.map((s) => (
          <View key={s.id} style={styles.historyRow}>
            <MaterialCommunityIcons name="history" size={20} color={colors.textMuted} />
            <Text style={[styles.historyText, { color: colors.textSecondary }]}>
              {s.totalTimeMinutes} мин · +{s.pointsEarned} баллов
            </Text>
            <Text style={[styles.historyDate, { color: colors.textMuted }]}>
              {new Date(s.startedAt).toLocaleDateString('ru-RU')}
            </Text>
          </View>
        ));
      }

      default:
        return null;
    }
  };

  const handleDragBegin = (index: number) => {
    setDragging(true);
    setHoverIndex(index);
  };

  const handlePlaceholderChange = (index: number) => setHoverIndex(index);

  const handleDragEnd = ({ data }: { data: SectionId[] }) => {
    setDragging(false);
    setHoverIndex(null);
    setOrder(data);
    saveSectionsOrder(data);
  };

  const handleSuggestionTap = (p: Place) => {
    Keyboard.dismiss();
    setQuery('');
    handleSelectPlace(p);
  };

  const initialRegion = loc
    ? {
        latitude: loc.latitude,
        longitude: loc.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }
    : undefined;

  const wave1 = pulseRadius * waveScale;
  const wave2 = (pulseRadius + 60) * waveScale;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        balance={profile.balance}
        avatarUrl={profile.avatarUrl}
        onBell={() => navigation.navigate('PromoCodes')}
        onProfile={() => navigation.navigate('Profile')}
      />

      <View style={styles.mapWrap}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          apiKey={Platform.OS === 'web' ? Constants.expoConfig?.extra?.GOOGLE_MAPS_WEB_API_KEY : undefined}
          style={StyleSheet.absoluteFillObject}
          initialRegion={initialRegion}
          showsUserLocation
          showsCompass
          showsMyLocationButton={false}
          onRegionChangeComplete={(r) => setMapDelta(r.latitudeDelta)}
        >
          {visiblePlaces.map((p) => (
            <Marker
              key={p.id}
              coordinate={{ latitude: p.latitude, longitude: p.longitude }}
              onPress={() => handleSelectPlace(p)}
            >
              <View
                style={[styles.markerBubble, { backgroundColor: colors.primary }]}
              >
                <MaterialCommunityIcons
                  name={CATEGORY_ICONS[p.category]}
                  size={16}
                  color="#fff"
                />
              </View>
            </Marker>
          ))}

          {selectedPlace && (
            <>
              <Circle
                center={{
                  latitude: selectedPlace.latitude,
                  longitude: selectedPlace.longitude,
                }}
                radius={wave1}
                strokeColor="rgba(46, 204, 113, 0.7)"
                fillColor="rgba(46, 204, 113, 0.08)"
                strokeWidth={2}
              />
              <Circle
                center={{
                  latitude: selectedPlace.latitude,
                  longitude: selectedPlace.longitude,
                }}
                radius={wave2}
                strokeColor="rgba(46, 204, 113, 0.35)"
                fillColor="rgba(46, 204, 113, 0)"
                strokeWidth={2}
              />
            </>
          )}
        </MapView>

        <TouchableOpacity
          style={[styles.locateBtn, { backgroundColor: colors.surface }]}
          onPress={() => {
            if (loc) {
              mapRef.current?.animateToRegion(
                {
                  latitude: loc.latitude,
                  longitude: loc.longitude,
                  latitudeDelta: BASE_MAP_DELTA,
                  longitudeDelta: BASE_MAP_DELTA,
                },
                600,
              );
            }
          }}
        >
          <Ionicons name="locate" size={22} color={colors.text} />
        </TouchableOpacity>

        <BottomSheet
          ref={contentSheetRef}
          index={1}
          snapPoints={contentSnapPoints}
          enablePanDownToClose={false}
          enableContentPanningGesture={false}
          enableOverDrag={false}
          backgroundStyle={{ backgroundColor: colors.surface, borderRadius: 20 }}
          handleIndicatorStyle={{ backgroundColor: colors.border, width: 50 }}
        >
          <BottomSheetView style={{ flex: 1 }}>
            <View
              onLayout={(e) => {
                if (showSuggestions) return;
                const h = e.nativeEvent.layout.height;
                if (Math.abs(h - headerH) > 2) setHeaderH(h);
              }}
            >
              <View
                style={[
                  styles.searchBlock,
                  { borderBottomColor: colors.border },
                ]}
              >
                <View style={[styles.searchBox, { backgroundColor: colors.surfaceAlt }]}>
                  <Ionicons name="search" size={18} color={colors.textMuted} />
                  <TextInput
                    style={[styles.searchInput, { color: colors.text }]}
                    placeholder="Поиск заведения"
                    placeholderTextColor={colors.textMuted}
                    value={query}
                    onChangeText={setQuery}
                    autoCorrect={false}
                  />
                  {query.length > 0 && (
                    <TouchableOpacity onPress={() => setQuery('')}>
                      <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>

                {showSuggestions ? (
                  <ScrollView
                    style={styles.suggestionsList}
                    keyboardShouldPersistTaps="handled"
                    nestedScrollEnabled
                  >
                    {suggestions.length === 0 ? (
                      <Text style={[styles.sectionEmpty, { color: colors.textMuted }]}>
                        Ничего не найдено
                      </Text>
                    ) : (
                      suggestions.map((p) => (
                        <TouchableOpacity
                          key={p.id}
                          style={[styles.suggestionRow, { borderBottomColor: colors.border }]}
                          onPress={() => handleSuggestionTap(p)}
                        >
                          <MaterialCommunityIcons
                            name={CATEGORY_ICONS[p.category]}
                            size={18}
                            color={colors.primary}
                          />
                          <View style={{ flex: 1 }}>
                            <Text
                              style={[styles.suggestionName, { color: colors.text }]}
                              numberOfLines={1}
                            >
                              {p.name}
                            </Text>
                            <Text
                              style={[styles.suggestionAddr, { color: colors.textMuted }]}
                              numberOfLines={1}
                            >
                              {p.address}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      ))
                    )}
                  </ScrollView>
                ) : (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.filtersRow}
                  >
                    {ALL_CATEGORIES.map((cat) => {
                      const on = enabledCategories.has(cat);
                      return (
                        <TouchableOpacity
                          key={cat}
                          style={[
                            styles.filterPill,
                            {
                              backgroundColor: on ? colors.primary : 'transparent',
                              borderColor: on ? colors.primary : colors.border,
                            },
                          ]}
                          onPress={() => {
                            setEnabledCategories((prev) => {
                              const next = new Set(prev);
                              if (next.has(cat)) next.delete(cat);
                              else next.add(cat);
                              return next;
                            });
                          }}
                        >
                          <MaterialCommunityIcons
                            name={CATEGORY_ICONS[cat]}
                            size={14}
                            color={on ? '#fff' : colors.text}
                          />
                          <Text
                            style={[
                              styles.filterPillText,
                              { color: on ? '#fff' : colors.text },
                            ]}
                          >
                            {CATEGORY_LABELS[cat]}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}
              </View>
            </View>

            {dragging && order.length > 0 && (
              <View style={styles.dragRail} pointerEvents="none">
                {order.map((_, i) => {
                  const active = hoverIndex === i;
                  return (
                    <View
                      key={i}
                      style={[
                        styles.dragRailDot,
                        {
                          backgroundColor: active ? colors.primary : colors.surface,
                          borderColor: active ? colors.primary : colors.border,
                        },
                        active && { transform: [{ scale: 1.15 }] },
                      ]}
                    >
                      <Text
                        style={[
                          styles.dragRailDotText,
                          { color: active ? '#fff' : colors.textMuted },
                        ]}
                      >
                        {i + 1}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}

            <DraggableFlatList
              data={order}
              keyExtractor={(item) => item}
              renderItem={renderSection}
              onDragBegin={handleDragBegin}
              onPlaceholderIndexChange={handlePlaceholderChange}
              onDragEnd={handleDragEnd}
              activationDistance={8}
              autoscrollThreshold={20}
              containerStyle={{ flex: 1 }}
              contentContainerStyle={styles.listContent}
            />
          </BottomSheetView>
        </BottomSheet>

        {session && (
          <Portal>
            <TouchableOpacity
              style={[styles.sessionBadge, { backgroundColor: colors.primary }]}
              onPress={() => navigation.navigate('ActiveSession')}
            >
              <Ionicons name="timer-outline" size={18} color="#fff" />
              <Text style={styles.sessionBadgeText}>
                {Math.floor(elapsedMs / 60000)} мин
              </Text>
            </TouchableOpacity>
          </Portal>
        )}

        {selectedPlace && (
          <BottomSheet
            ref={placeSheetRef}
            index={0}
            snapPoints={placeSnapPoints}
            enablePanDownToClose
            onClose={() => setSelectedPlace(null)}
            backgroundStyle={{ backgroundColor: colors.surface, borderRadius: 20 }}
          >
            <BottomSheetView style={{ flex: 1 }}>
              <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
                <TouchableOpacity
                  style={[styles.closeBtn, { backgroundColor: colors.surfaceAlt }]}
                  onPress={closePlaceSheet}
                >
                  <Ionicons name="close" size={22} color={colors.text} />
                </TouchableOpacity>

                {selectedPlace.photoUrl ? (
                  <Image
                    source={{ uri: selectedPlace.photoUrl }}
                    style={styles.placeImg}
                  />
                ) : (
                  <View
                    style={[styles.placeImg, { backgroundColor: colors.surfaceAlt }]}
                  >
                    <MaterialCommunityIcons
                      name={CATEGORY_ICONS[selectedPlace.category]}
                      size={48}
                      color={colors.textMuted}
                    />
                  </View>
                )}

                <View style={styles.placeBody}>
                  <Text style={[styles.placeCat, { color: colors.primary }]}>
                    {CATEGORY_LABELS[selectedPlace.category]}
                  </Text>
                  <Text style={[styles.placeName, { color: colors.text }]}>
                    {selectedPlace.name}
                  </Text>
                  <Text style={[styles.placeAddr, { color: colors.textMuted }]}>
                    {selectedPlace.address}
                  </Text>

                  {typeof selectedPlace.averageCheck === 'number' &&
                    selectedPlace.averageCheck > 0 && (
                      <Text style={[styles.placeCheck, { color: colors.success }]}>
                        💰 Средний чек: от {selectedPlace.averageCheck} ₽
                      </Text>
                    )}

                  {selectedPlace.description ? (
                    <Text style={[styles.placeDesc, { color: colors.textSecondary }]}>
                      {selectedPlace.description}
                    </Text>
                  ) : null}

                  <View style={[styles.divider, { backgroundColor: colors.border }]} />

                  {selectedQuest ? (
                    <>
                      <Text style={[styles.questLine, { color: colors.text }]}>
                        ⏱ {selectedQuest.minTimeMinutes}–
                        {selectedQuest.maxTimeMinutes} мин
                      </Text>
                      <Text style={[styles.questLine, { color: colors.text }]}>
                        🏆 До {selectedQuest.rewardPoints} баллов
                      </Text>
                      <TouchableOpacity
                        style={[
                          styles.startBtn,
                          { backgroundColor: colors.primary },
                        ]}
                        onPress={() => {
                          closePlaceSheet();
                          navigation.navigate('QRScanner', {
                            placeId: selectedPlace.id,
                            questId: selectedQuest.id,
                            placeLatitude: selectedPlace.latitude,
                            placeLongitude: selectedPlace.longitude,
                          });
                        }}
                      >
                        <Text style={styles.startBtnText}>
                          Сканировать QR и начать
                        </Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <Text style={[styles.sectionEmpty, { color: colors.textMuted }]}>
                      Активных квестов нет
                    </Text>
                  )}
                </View>
              </ScrollView>
            </BottomSheetView>
          </BottomSheet>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  mapWrap: { flex: 1, position: 'relative' },

  markerBubble: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
    elevation: 3,
  },

  locateBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 44, height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000', shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 }, shadowRadius: 4,
  },

  searchBlock: {
    paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 20, paddingHorizontal: 12, height: 42, gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 0 },

  suggestionsList: { maxHeight: 180, marginTop: 6 },
  suggestionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  suggestionName: { fontWeight: '700', fontSize: 14 },
  suggestionAddr: { fontSize: 12, marginTop: 1 },

  filtersRow: { gap: 8, paddingVertical: 10, paddingRight: 16 },
  filterPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1.5, borderRadius: 16,
    paddingVertical: 6, paddingHorizontal: 12,
  },
  filterPillText: { fontSize: 12, fontWeight: '600' },

  listContent: { paddingBottom: 24 },

  sectionBlock: {
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10,
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 10,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800' },

  sectionEmpty: { fontSize: 13, paddingVertical: 4 },

  placeCard: {
    width: 160, marginRight: 12, borderRadius: 12, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, elevation: 2,
  },
  placeCardImg: {
    width: '100%', height: 90,
    alignItems: 'center', justifyContent: 'center',
  },
  placeCardBody: { padding: 10 },
  placeCardName: { fontWeight: '700', fontSize: 13 },
  placeCardMeta: { fontSize: 11, marginTop: 2 },

  levelCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 12, padding: 12, marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  levelBadge: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#f1c40f',
    alignItems: 'center', justifyContent: 'center',
  },
  levelBadgeText: { fontWeight: '800', fontSize: 12 },
  levelName: { fontWeight: '700', fontSize: 14, marginBottom: 6 },
  progressBarBg: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%' },
  levelProgress: { fontSize: 11, marginTop: 4 },

  friendRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 12, padding: 10, marginBottom: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  friendAvatar: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  friendName: { fontWeight: '700', fontSize: 13 },
  friendMeta: { fontSize: 11, marginTop: 1 },

  promoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 12, padding: 12, marginBottom: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  promoCode: { flex: 1, fontWeight: '800', letterSpacing: 1, fontSize: 14 },

  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  historyText: { flex: 1, fontSize: 13 },
  historyDate: { fontSize: 12 },

  dragRail: {
    position: 'absolute', right: 8, top: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center', gap: 10, zIndex: 100,
  },
  dragRailDot: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
    elevation: 2,
  },
  dragRailDotText: { fontSize: 12, fontWeight: '700' },

  closeBtn: {
    position: 'absolute', top: 8, right: 8, zIndex: 10,
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    elevation: 3,
  },
  placeImg: {
    width: '100%', height: 180,
    alignItems: 'center', justifyContent: 'center',
  },
  placeBody: { paddingHorizontal: 16, paddingTop: 12 },
  placeCat: { fontWeight: '700', fontSize: 12, textTransform: 'uppercase' },
  placeName: { fontSize: 20, fontWeight: '800', marginTop: 4 },
  placeAddr: { marginTop: 2 },
  placeCheck: { fontWeight: '700', marginTop: 8, fontSize: 14 },
  placeDesc: { marginTop: 10, lineHeight: 20 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 12 },
  questLine: { fontSize: 15, marginBottom: 4 },
  startBtn: {
    marginTop: 16, borderRadius: 10,
    paddingVertical: 14, alignItems: 'center',
  },
  startBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  sessionBadge: {
    position: 'absolute', top: 16, right: 16,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 10, paddingHorizontal: 14,
    borderRadius: 22, elevation: 20, zIndex: 9999,
  },
  sessionBadgeText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});