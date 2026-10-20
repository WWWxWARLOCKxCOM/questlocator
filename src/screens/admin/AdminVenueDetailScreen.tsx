import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, TextInput,
  Modal, Alert, ActivityIndicator, ScrollView, Image, Linking,
} from 'react-native';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AdminStackParamList } from '@/navigation/AdminNavigator';
import {
  subscribeToAllPlaces, updatePlace, deletePlace, assignPlaceOwner,
} from '@/services/placesService';
import { 
  subscribeToAllVenues, 
  updateVenueLimits, 
  adjustVenueBalance 
} from '@/services/venueService'; // <-- ОБНОВЛЕННЫЙ ИМПОРТ
import LevelConstructor, { DEFAULT_LEVEL_CONFIG } from '@/components/LevelConstructor';
import {
  Place, PlaceCategory, VenueAccount, LevelConfig,
  CATEGORY_LABELS, ALL_CATEGORIES,
} from '@/types';

type Rt = RouteProp<AdminStackParamList, 'AdminVenueDetail'>;
type Nav = NativeStackNavigationProp<AdminStackParamList>;

const CATEGORY_ICONS: Record<PlaceCategory, keyof typeof MaterialCommunityIcons.glyphMap> = {
  restaurant: 'silverware-fork-knife',
  cafe: 'coffee',
  museum: 'bank',
  shop: 'shopping',
  exhibition: 'image-frame',
};

interface EditState {
  name: string;
  address: string;
  description: string;
  category: PlaceCategory;
  radiusMeters: number;
  website: string;
  phone: string;
  averageCheck: string;
  menuPdfUrl: string;
  levels: LevelConfig;
}

async function openLink(url: string) {
  try {
    const ok = await Linking.canOpenURL(url);
    if (!ok) return Alert.alert('Ошибка', 'Не удалось открыть ссылку');
    await Linking.openURL(url);
  } catch {
    Alert.alert('Ошибка', 'Не удалось открыть ссылку');
  }
}

export default function AdminVenueDetailScreen() {
  const route = useRoute<Rt>();
  const navigation = useNavigation<Nav>();
  const { venueUid, venueName } = route.params;

  const [places, setPlaces] = useState<Place[]>([]);
  const [venues, setVenues] = useState<VenueAccount[]>([]);
  const [expandedPlaceId, setExpandedPlaceId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Place | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [busy, setBusy] = useState(false);
  const [ownerPickerOpen, setOwnerPickerOpen] = useState<Place | null>(null);
  
  // Модалка лимитов
  const [limitModalOpen, setLimitModalOpen] = useState(false);
  const [newLimit, setNewLimit] = useState('');
  const [newCouponsLimit, setNewCouponsLimit] = useState('');

  // Модалка изменения баланса
  const [balanceModalOpen, setBalanceModalOpen] = useState(false);
  const [balanceAmount, setBalanceAmount] = useState('');
  const [balanceDesc, setBalanceDesc] = useState('');

  useEffect(() => subscribeToAllPlaces(setPlaces), []);
  useEffect(() => subscribeToAllVenues(setVenues), []);

  const venue: VenueAccount | null = useMemo(() => {
    if (!venueUid) return null;
    return venues.find((v) => v.uid === venueUid) ?? null;
  }, [venues, venueUid]);

  const visiblePlaces = useMemo(() => {
    if (venueUid === null) {
      return places.filter((p) => !p.ownerUid);
    }
    return places.filter((p) => p.ownerUid === venueUid);
  }, [places, venueUid]);

  const handleCopy = async (value: string) => {
    await Clipboard.setStringAsync(value);
    Alert.alert('Скопировано', 'Код скопирован в буфер обмена');
  };

  const openEdit = (place: Place) => {
    setEditing(place);
    setEditState({
      name: place.name,
      address: place.address,
      description: place.description ?? '',
      category: place.category,
      radiusMeters: place.radiusMeters,
      website: place.website ?? '',
      phone: place.phone ?? '',
      averageCheck:
        typeof place.averageCheck === 'number' ? String(place.averageCheck) : '',
      menuPdfUrl: place.menuPdfUrl ?? '',
      levels: place.levels ?? DEFAULT_LEVEL_CONFIG,
    });
  };

  const handleSave = async () => {
    if (!editing || !editState) return;
    if (!editState.name.trim()) return Alert.alert('Введите название');
    if (!editState.address.trim()) return Alert.alert('Введите адрес');

    const avg = editState.averageCheck.trim();
    const avgNum = avg ? Number(avg) : undefined;
    if (avg && (!Number.isFinite(avgNum) || (avgNum as number) < 0)) {
      return Alert.alert('Средний чек должен быть числом ≥ 0');
    }

    setBusy(true);
    try {
      await updatePlace(editing.id, {
        name: editState.name.trim(),
        address: editState.address.trim(),
        description: editState.description.trim(),
        category: editState.category,
        radiusMeters: editState.radiusMeters,
        website: editState.website.trim(),
        phone: editState.phone.trim(),
        averageCheck: avgNum,
        menuPdfUrl: editState.menuPdfUrl.trim(),
        levels: editState.levels,
      });
      setEditing(null);
      setEditState(null);
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось сохранить');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = (place: Place) => {
    Alert.alert(
      'Удалить точку?',
      `Точка «${place.name}» и её квест будут удалены безвозвратно.`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await deletePlace(place.id);
            } catch (e: any) {
              Alert.alert('Ошибка', e?.message ?? 'Не удалось удалить');
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const handleAssignOwner = async (place: Place, newOwnerUid: string | null) => {
    setOwnerPickerOpen(null);
    setBusy(true);
    try {
      await assignPlaceOwner(place.id, newOwnerUid);
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось переназначить владельца');
    } finally {
      setBusy(false);
    }
  };

  const openLimitModal = () => {
    if (!venue) return;
    setNewLimit(String(venue.pointsLimit));
    setNewCouponsLimit(String(venue.couponsLimit ?? 1));
    setLimitModalOpen(true);
  };

  const saveLimit = async () => {
    if (!venue) return;
    const n = Number(newLimit);
    const c = Number(newCouponsLimit);
    
    if (!Number.isFinite(n) || n < 0 || !Number.isFinite(c) || c < 0) {
      return Alert.alert('Некорректный лимит');
    }
    
    setBusy(true);
    try {
      await updateVenueLimits(venue.uid, n, c);
      setLimitModalOpen(false);
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message);
    } finally {
      setBusy(false);
    }
  };

  const saveBalance = async () => {
    if (!venue) return;
    const amount = Number(balanceAmount);
    if (!Number.isFinite(amount) || amount === 0) {
      return Alert.alert('Введите сумму', 'Число должно быть отлично от 0 (может быть отрицательным)');
    }
    
    setBusy(true);
    try {
      await adjustVenueBalance(venue.uid, amount, balanceDesc.trim());
      setBalanceModalOpen(false);
      setBalanceAmount('');
      setBalanceDesc('');
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message);
    } finally {
      setBusy(false);
    }
  };

  const isFood = editState?.category === 'cafe' || editState?.category === 'restaurant';

  return (
    <View style={styles.container}>
      <FlatList
        data={visiblePlaces}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          venue ? (
            <View style={styles.header}>
              <View style={styles.headerIcon}>
                <MaterialCommunityIcons name="store" size={26} color="#fff" />
              </View>
              <Text style={styles.headerName}>{venue.companyName}</Text>
              <Text style={styles.headerMeta}>{venue.contactEmail}</Text>
              {venue.contactPhone ? (
                <Text style={styles.headerMeta}>{venue.contactPhone}</Text>
              ) : null}

              {/* Статистика заведения */}
              <View style={styles.headerStats}>
                <View style={[styles.statBox, { backgroundColor: '#fff8e1', borderColor: '#f1c40f', borderWidth: 1 }]}>
                  <Text style={[styles.statValue, { color: '#d35400' }]}>{venue.balance || 0}</Text>
                  <Text style={styles.statLabel}>баланс</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{venue.pointsUsed} / {venue.pointsLimit}</Text>
                  <Text style={styles.statLabel}>точки</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{venue.couponsUsed ?? 0} / {venue.couponsLimit ?? 1}</Text>
                  <Text style={styles.statLabel}>купоны</Text>
                </View>
              </View>

              <View style={styles.headerActions}>
                <TouchableOpacity style={[styles.editLimitBtn, { backgroundColor: '#3498db' }]} onPress={openLimitModal}>
                  <MaterialCommunityIcons name="pencil" size={16} color="#fff" />
                  <Text style={styles.editLimitText}>Лимиты</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.editLimitBtn, { backgroundColor: '#f39c12' }]} onPress={() => setBalanceModalOpen(true)}>
                  <MaterialCommunityIcons name="cash-edit" size={16} color="#fff" />
                  <Text style={styles.editLimitText}>Баланс</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.sectionTitle}>
                Точки заведения ({visiblePlaces.length})
              </Text>
            </View>
          ) : (
            <Text style={styles.sectionTitle}>
              Точки без владельца ({visiblePlaces.length})
            </Text>
          )
        }
        ListEmptyComponent={
          <Text style={styles.empty}>У заведения пока нет точек</Text>
        }
        renderItem={({ item }) => {
          const expanded = expandedPlaceId === item.id;
          return (
            <View style={styles.card}>
              <TouchableOpacity
                style={styles.cardHeader}
                onPress={() => setExpandedPlaceId(expanded ? null : item.id)}
              >
                <View style={styles.iconBubble}>
                  <MaterialCommunityIcons
                    name={CATEGORY_ICONS[item.category]}
                    size={20}
                    color="#fff"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.category}>{CATEGORY_LABELS[item.category]}</Text>
                  <Text style={styles.address} numberOfLines={1}>{item.address}</Text>
                </View>
                <MaterialCommunityIcons
                  name={expanded ? 'chevron-up' : 'chevron-down'}
                  size={24}
                  color="#999"
                />
              </TouchableOpacity>

              {expanded && (
                <View style={styles.expandedBlock}>
                  {item.photoUrl ? (
                    <Image source={{ uri: item.photoUrl }} style={styles.photo} />
                  ) : null}

                  {/* Контакты и меню */}
                  {(item.website || item.phone || item.averageCheck || item.menuPdfUrl) && (
                    <View style={styles.infoBlock}>
                      {item.website ? (
                        <TouchableOpacity style={styles.infoRow} onPress={() => openLink(item.website!)}>
                          <MaterialCommunityIcons name="web" size={16} color="#3498db" />
                          <Text style={[styles.infoText, styles.linkText]}>{item.website}</Text>
                        </TouchableOpacity>
                      ) : null}

                      {item.phone ? (
                        <TouchableOpacity style={styles.infoRow} onPress={() => openLink(`tel:${item.phone}`)}>
                          <MaterialCommunityIcons name="phone" size={16} color="#27ae60" />
                          <Text style={[styles.infoText, styles.linkText]}>{item.phone}</Text>
                        </TouchableOpacity>
                      ) : null}

                      {typeof item.averageCheck === 'number' ? (
                        <View style={styles.infoRow}>
                          <MaterialCommunityIcons name="cash" size={16} color="#27ae60" />
                          <Text style={styles.infoText}>Средний чек: от {item.averageCheck} ₽</Text>
                        </View>
                      ) : null}

                      {item.menuPdfUrl ? (
                        <TouchableOpacity style={styles.infoRow} onPress={() => openLink(item.menuPdfUrl!)}>
                          <MaterialCommunityIcons name="file-pdf-box" size={16} color="#c0392b" />
                          <Text style={[styles.infoText, styles.linkText]}>Открыть меню (PDF)</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  )}

                  {/* Уровни */}
                  {item.levels?.enabled ? (
                    <View style={styles.levelsInfoBlock}>
                      <View style={styles.infoRow}>
                        <MaterialCommunityIcons name="star-circle" size={16} color="#f1c40f" />
                        <Text style={styles.infoText}>
                          Уровни: макс. {item.levels.maxLevel} · {item.levels.completionsPerLevel}{' '}
                          прохождений/уровень
                        </Text>
                      </View>
                      <View style={styles.infoRow}>
                        <MaterialCommunityIcons name="sale" size={16} color="#27ae60" />
                        <Text style={styles.infoText}>
                          Скидки: {(item.levels.discounts ?? []).map((d) => `${d}%`).join(' · ')}
                        </Text>
                      </View>
                      <View style={styles.infoRow}>
                        <MaterialCommunityIcons name="refresh" size={16} color="#888" />
                        <Text style={styles.infoText}>
                          Сброс:{' '}
                          {item.levels.resetPeriod === 'month'
                            ? 'раз в месяц'
                            : item.levels.resetPeriod === '3months'
                            ? 'раз в 3 месяца'
                            : item.levels.resetPeriod === '6months'
                            ? 'раз в полгода'
                            : item.levels.resetPeriod === 'year'
                            ? 'раз в год'
                            : 'никогда'}
                        </Text>
                      </View>
                    </View>
                  ) : null}

                  {item.description ? (
                    <Text style={styles.description}>{item.description}</Text>
                  ) : null}

                  <Text style={styles.radius}>Радиус: {item.radiusMeters} м</Text>

                  {item.qrCode ? (
                    <>
                      <View style={styles.qrWrap}>
                        <QRCode value={item.qrCode} size={240} backgroundColor="#fff" color="#000" />
                      </View>
                      <Text style={styles.codeText} selectable>{item.qrCode}</Text>
                      <TouchableOpacity style={styles.copyBtn} onPress={() => handleCopy(item.qrCode)}>
                        <MaterialCommunityIcons name="content-copy" size={16} color="#fff" />
                        <Text style={styles.copyText}>Скопировать код</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <Text style={styles.pending}>QR генерируется...</Text>
                  )}

                  <View style={styles.actionsRow}>
                    <TouchableOpacity style={[styles.actionBtn, styles.editBtn]} onPress={() => openEdit(item)}>
                      <MaterialCommunityIcons name="pencil" size={16} color="#fff" />
                      <Text style={styles.actionText}>Изменить</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.actionBtn, styles.ownerBtn]} onPress={() => setOwnerPickerOpen(item)}>
                      <MaterialCommunityIcons name="account-switch" size={16} color="#fff" />
                      <Text style={styles.actionText}>Владелец</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]} onPress={() => handleDelete(item)}>
                      <MaterialCommunityIcons name="trash-can" size={16} color="#fff" />
                      <Text style={styles.actionText}>Удалить</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          );
        }}
      />

      {/* Модалка редактирования точки */}
      <Modal visible={!!editing} animationType="slide" onRequestClose={() => setEditing(null)}>
        <ScrollView contentContainerStyle={styles.modalContainer}>
          <Text style={styles.modalTitle}>Редактировать точку</Text>

          <Text style={styles.label}>Название</Text>
          <TextInput
            style={styles.input}
            value={editState?.name ?? ''}
            onChangeText={(v) => setEditState((s) => (s ? { ...s, name: v } : s))}
          />

          <Text style={styles.label}>Адрес</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={editState?.address ?? ''}
            onChangeText={(v) => setEditState((s) => (s ? { ...s, address: v } : s))}
            multiline
          />

          <Text style={styles.label}>Описание</Text>
          <TextInput
            style={[styles.input, styles.multiline, { minHeight: 100 }]}
            value={editState?.description ?? ''}
            onChangeText={(v) => setEditState((s) => (s ? { ...s, description: v } : s))}
            multiline
            placeholder="Что здесь можно найти"
          />

          <Text style={styles.sectionLabel}>Контакты и меню</Text>

          <Text style={styles.label}>Сайт</Text>
          <TextInput
            style={styles.input}
            value={editState?.website ?? ''}
            onChangeText={(v) => setEditState((s) => (s ? { ...s, website: v } : s))}
            placeholder="https://example.com"
            autoCapitalize="none"
            keyboardType="url"
          />

          <Text style={styles.label}>Телефон</Text>
          <TextInput
            style={styles.input}
            value={editState?.phone ?? ''}
            onChangeText={(v) => setEditState((s) => (s ? { ...s, phone: v } : s))}
            placeholder="+7 900 000 00 00"
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>Категория</Text>
          <View style={styles.chipsRow}>
            {ALL_CATEGORIES.map((c) => (
              <TouchableOpacity
                key={c}
                style={[styles.chip, editState?.category === c && styles.chipActive]}
                onPress={() => setEditState((s) => (s ? { ...s, category: c } : s))}
              >
                <Text style={editState?.category === c ? styles.chipTextActive : styles.chipText}>
                  {CATEGORY_LABELS[c]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {isFood && (
            <>
              <Text style={styles.label}>Средний чек, ₽</Text>
              <TextInput
                style={styles.input}
                value={editState?.averageCheck ?? ''}
                onChangeText={(v) => setEditState((s) => (s ? { ...s, averageCheck: v } : s))}
                placeholder="500"
                keyboardType="numeric"
              />

              <Text style={styles.label}>Ссылка на меню (PDF)</Text>
              <TextInput
                style={styles.input}
                value={editState?.menuPdfUrl ?? ''}
                onChangeText={(v) => setEditState((s) => (s ? { ...s, menuPdfUrl: v } : s))}
                placeholder="https://example.com/menu.pdf"
                autoCapitalize="none"
                keyboardType="url"
              />
            </>
          )}

          <Text style={styles.label}>Радиус (м)</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={String(editState?.radiusMeters ?? 50)}
            onChangeText={(v) =>
              setEditState((s) => (s ? { ...s, radiusMeters: Math.max(1, Number(v) || 50) } : s))
            }
          />

          <Text style={styles.sectionLabel}>Уровни и скидки</Text>
          <LevelConstructor
            value={editState?.levels ?? DEFAULT_LEVEL_CONFIG}
            onChange={(v) => setEditState((s) => (s ? { ...s, levels: v } : s))}
          />

          <TouchableOpacity style={[styles.saveBtn, busy && { opacity: 0.6 }]} onPress={handleSave} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Сохранить</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditing(null)}>
            <Text style={styles.cancelText}>Отмена</Text>
          </TouchableOpacity>
        </ScrollView>
      </Modal>

      {/* Модалка выбора владельца */}
      <Modal visible={!!ownerPickerOpen} transparent animationType="fade" onRequestClose={() => setOwnerPickerOpen(null)}>
        <View style={styles.pickerBg}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>Назначить владельца</Text>

            <TouchableOpacity style={styles.pickerItem} onPress={() => ownerPickerOpen && handleAssignOwner(ownerPickerOpen, null)}>
              <Text style={styles.pickerItemText}>Без владельца (админ)</Text>
            </TouchableOpacity>

            <FlatList
              data={venues}
              keyExtractor={(v) => v.uid}
              style={{ maxHeight: 320 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.pickerItem}
                  onPress={() => ownerPickerOpen && handleAssignOwner(ownerPickerOpen, item.uid)}
                >
                  <Text style={styles.pickerItemText}>{item.companyName}</Text>
                  <Text style={styles.pickerItemMeta}>
                    {item.pointsUsed} / {item.pointsLimit} точек
                  </Text>
                </TouchableOpacity>
              )}
            />

            <TouchableOpacity style={styles.pickerCancel} onPress={() => setOwnerPickerOpen(null)}>
              <Text style={styles.pickerCancelText}>Отмена</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Модалка изменения лимитов (точек и купонов) */}
      <Modal visible={limitModalOpen} transparent animationType="fade" onRequestClose={() => setLimitModalOpen(false)}>
        <View style={styles.pickerBg}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>Лимиты для {venue?.companyName}</Text>
            
            <Text style={styles.label}>Лимит точек</Text>
            <TextInput
              style={[styles.input, { marginTop: 4 }]}
              keyboardType="numeric"
              value={newLimit}
              onChangeText={setNewLimit}
            />

            <Text style={[styles.label, { marginTop: 12 }]}>Лимит купонов</Text>
            <TextInput
              style={[styles.input, { marginTop: 4 }]}
              keyboardType="numeric"
              value={newCouponsLimit}
              onChangeText={setNewCouponsLimit}
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                style={[styles.saveBtn, { flex: 1, backgroundColor: '#eee', marginTop: 0 }]}
                onPress={() => setLimitModalOpen(false)}
              >
                <Text style={[styles.saveText, { color: '#333' }]}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, { flex: 1, marginTop: 0 }, busy && { opacity: 0.6 }]}
                onPress={saveLimit}
                disabled={busy}
              >
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Сохранить</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* НОВАЯ Модалка корректировки баланса */}
      <Modal visible={balanceModalOpen} transparent animationType="fade" onRequestClose={() => setBalanceModalOpen(false)}>
        <View style={styles.pickerBg}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>Корректировка баланса</Text>
            <Text style={{ color: '#666', marginBottom: 12 }}>Текущий баланс: {venue?.balance || 0}</Text>
            
            <Text style={styles.label}>Сумма (+/-)</Text>
            <TextInput
              style={[styles.input, { marginTop: 4 }]}
              keyboardType="numeric"
              value={balanceAmount}
              onChangeText={setBalanceAmount}
              placeholder="Например: 500 или -100"
            />

            <Text style={[styles.label, { marginTop: 12 }]}>Причина (необязательно)</Text>
            <TextInput
              style={[styles.input, { marginTop: 4 }]}
              value={balanceDesc}
              onChangeText={setBalanceDesc}
              placeholder="Оплата, бонус и т.д."
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                style={[styles.saveBtn, { flex: 1, backgroundColor: '#eee', marginTop: 0 }]}
                onPress={() => setBalanceModalOpen(false)}
              >
                <Text style={[styles.saveText, { color: '#333' }]}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, { flex: 1, marginTop: 0, backgroundColor: '#f39c12' }, busy && { opacity: 0.6 }]}
                onPress={saveBalance}
                disabled={busy}
              >
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Применить</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 12, paddingBottom: 40 },

  header: { alignItems: 'center', paddingVertical: 12, gap: 6 },
  headerIcon: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#2c3e50',
    alignItems: 'center', justifyContent: 'center',
  },
  headerName: { fontSize: 20, fontWeight: '800', marginTop: 6 },
  headerMeta: { color: '#666', fontSize: 13 },
  
  headerStats: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 12 },
  statBox: {
    backgroundColor: '#f0f0f0', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
    alignItems: 'center', minWidth: 80,
  },
  statValue: { fontSize: 18, fontWeight: '800' },
  statLabel: { color: '#666', fontSize: 11, marginTop: 2 },
  
  headerActions: { flexDirection: 'row', gap: 12, marginTop: 12 },
  editLimitBtn: {
    borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  editLimitText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  sectionTitle: {
    fontSize: 14, color: '#555', fontWeight: '700',
    marginTop: 24, marginBottom: 8, alignSelf: 'flex-start',
  },

  card: {
    backgroundColor: '#f7f7f7', borderRadius: 12, padding: 12,
    marginBottom: 12,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBubble: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#2ecc71',
    alignItems: 'center', justifyContent: 'center',
  },
  name: { fontSize: 15, fontWeight: '700' },
  category: { color: '#2ecc71', fontSize: 12, fontWeight: '700' },
  address: { color: '#666', fontSize: 12, marginTop: 2 },

  expandedBlock: {
    marginTop: 12, alignItems: 'center', gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ddd', paddingTop: 12,
  },
  photo: { width: '100%', height: 160, borderRadius: 10 },
  description: {
    color: '#333', fontSize: 13, lineHeight: 18,
    alignSelf: 'stretch', marginTop: 4,
  },
  radius: { color: '#888', fontSize: 12, alignSelf: 'flex-start' },

  infoBlock: {
    alignSelf: 'stretch',
    backgroundColor: '#fff', borderRadius: 10, padding: 10,
    gap: 6, marginTop: 4,
  },
  levelsInfoBlock: {
    alignSelf: 'stretch',
    backgroundColor: '#fffbea', borderRadius: 10, padding: 10,
    gap: 6, marginTop: 4,
    borderLeftWidth: 4, borderLeftColor: '#f1c40f',
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText: { fontSize: 13, color: '#333', flex: 1 },
  linkText: { color: '#2f6fed', textDecorationLine: 'underline' },

  qrWrap: {
    backgroundColor: '#fff', padding: 16, borderRadius: 12, elevation: 2,
    marginTop: 8,
  },
  codeText: {
    color: '#333', fontSize: 12, fontFamily: 'monospace',
    textAlign: 'center', marginTop: 8,
  },
  copyBtn: {
    marginTop: 8, backgroundColor: '#2c3e50', borderRadius: 8,
    paddingVertical: 8, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  copyText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  pending: { color: '#999', marginTop: 8 },

  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 12, alignSelf: 'stretch' },
  actionBtn: {
    flex: 1, borderRadius: 8, paddingVertical: 10,
    alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 4,
  },
  editBtn: { backgroundColor: '#3498db' },
  ownerBtn: { backgroundColor: '#9b59b6' },
  deleteBtn: { backgroundColor: '#e74c3c' },
  actionText: { color: '#fff', fontWeight: '700', fontSize: 12 },

  empty: { textAlign: 'center', marginTop: 40, color: '#999' },

  modalContainer: { padding: 20, paddingBottom: 60, gap: 6 },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  sectionLabel: {
    fontSize: 14, color: '#2c3e50', fontWeight: '800',
    marginTop: 20, marginBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc', paddingBottom: 4,
  },
  label: { fontSize: 13, color: '#555', marginTop: 10 },
  input: {
    borderWidth: 1, borderColor: '#ccc', borderRadius: 8,
    padding: 12, fontSize: 15,
  },
  multiline: { minHeight: 60, textAlignVertical: 'top' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  chip: {
    paddingVertical: 6, paddingHorizontal: 12,
    borderRadius: 16, backgroundColor: '#eee',
  },
  chipActive: { backgroundColor: '#2ecc71' },
  chipText: { color: '#333' },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  saveBtn: {
    marginTop: 24, backgroundColor: '#2ecc71', borderRadius: 10,
    paddingVertical: 16, alignItems: 'center',
  },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  cancelBtn: { marginTop: 12, alignItems: 'center', padding: 12 },
  cancelText: { color: '#666' },

  pickerBg: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center', padding: 20,
  },
  pickerCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    width: '100%', maxHeight: '80%',
  },
  pickerTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  pickerItem: {
    paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  pickerItemText: { fontSize: 15, fontWeight: '600' },
  pickerItemMeta: { fontSize: 12, color: '#888', marginTop: 2 },
  pickerCancel: { marginTop: 16, padding: 12, alignItems: 'center' },
  pickerCancelText: { color: '#e74c3c', fontWeight: '600' },
});