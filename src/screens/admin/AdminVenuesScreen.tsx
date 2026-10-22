import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, SectionList, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { AdminStackParamList } from '@/navigation/AdminNavigator';
import { 
  subscribeToAllVenues, 
  updateGlobalSettings,
  subscribeToVenueApplications,
  approveVenueApplication,
  rejectVenueApplication
} from '@/services/venueService';
import { subscribeToAllPlaces } from '@/services/placesService';
import { Place, PlaceCategory, VenueAccount, VenueApplication } from '@/types';

type Nav = NativeStackNavigationProp<AdminStackParamList>;

const CATEGORY_ICONS: Record<PlaceCategory, keyof typeof MaterialCommunityIcons.glyphMap> = {
  restaurant: 'silverware-fork-knife',
  cafe: 'coffee',
  museum: 'bank',
  shop: 'shopping',
  exhibition: 'image-frame',
};

export default function AdminVenuesScreen() {
  const navigation = useNavigation<Nav>();
  const [venues, setVenues] = useState<VenueAccount[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [applications, setApplications] = useState<VenueApplication[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  
  // Глобальные настройки
  const [pointsPerQuest, setPointsPerQuest] = useState('10');
  const [monthlyCost, setMonthlyCost] = useState('100');
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => subscribeToAllVenues(setVenues), []);
  useEffect(() => subscribeToAllPlaces(setPlaces), []);
  useEffect(() => subscribeToVenueApplications(setApplications), []);
  
  useEffect(() => {
    return onSnapshot(doc(db, 'settings', 'general'), (snap) => {
      if (snap.exists()) {
        setPointsPerQuest(String(snap.data().pointsPerQuest ?? 10));
        setMonthlyCost(String(snap.data().monthlyCostPerPlace ?? 100));
      }
    });
  }, []);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await updateGlobalSettings(Number(pointsPerQuest) || 0, Number(monthlyCost) || 0);
      Alert.alert('Успех', 'Глобальные настройки сохранены');
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleApprove = async (id: string) => {
    setBusyId(id);
    try {
      await approveVenueApplication(id);
      Alert.alert('Успех', 'Компания одобрена и может войти в систему.');
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось одобрить заявку');
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = (id: string) => {
    Alert.alert(
      'Отклонить заявку?',
      'Пользователь не сможет войти в систему, а его данные будут удалены.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Отклонить',
          style: 'destructive',
          onPress: async () => {
            setBusyId(id);
            try {
              await rejectVenueApplication(id);
            } catch (e: any) {
              Alert.alert('Ошибка', e?.message ?? 'Не удалось отклонить заявку');
            } finally {
              setBusyId(null);
            }
          },
        },
      ]
    );
  };

  const adminPlaces = useMemo(() => places.filter((p) => !p.ownerUid), [places]);

  const sections = useMemo(() => {
    const result: { title: string; data: any[]; type: 'venue' | 'place' | 'app' }[] = [];
    
    if (applications.length > 0) {
      result.push({ title: 'Заявки на регистрацию', type: 'app', data: applications });
    }
    
    result.push({ title: 'Заведения', type: 'venue', data: venues });
    
    if (adminPlaces.length > 0) {
      result.push({ title: 'Точки без владельца', type: 'place', data: adminPlaces });
    }
    
    return result;
  }, [venues, adminPlaces, applications]);

  const renderApplication = (item: VenueApplication) => (
    <View style={styles.appRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{item.companyName}</Text>
        <Text style={styles.meta}>{item.loginEmail}</Text>
        <Text style={styles.meta}>{item.employeeName}</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TouchableOpacity 
          style={[styles.appBtn, { backgroundColor: '#2ecc71' }, busyId === item.uid && { opacity: 0.5 }]} 
          onPress={() => handleApprove(item.uid)}
          disabled={busyId === item.uid}
        >
          {busyId === item.uid ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.appBtnText}>Одобрить</Text>}
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.appBtn, { backgroundColor: '#e74c3c' }, busyId === item.uid && { opacity: 0.5 }]} 
          onPress={() => handleReject(item.uid)}
          disabled={busyId === item.uid}
        >
          <Text style={styles.appBtnText}>Отклонить</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderVenue = (item: VenueAccount) => (
    <TouchableOpacity
      style={styles.row}
      onPress={() =>
        navigation.navigate('AdminVenueDetail', {
          venueUid: item.uid,
          venueName: item.companyName,
        })
      }
    >
      <View style={styles.venueIcon}>
        <MaterialCommunityIcons name="store" size={22} color="#fff" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{item.companyName}</Text>
        <Text style={styles.meta}>{item.contactEmail}</Text>
        <Text style={styles.meta}>
          Точек: {item.pointsUsed} / {item.pointsLimit} · Купонов: {item.couponsUsed || 0} / {item.couponsLimit || 0}
        </Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={22} color="#999" />
    </TouchableOpacity>
  );

  const renderPlace = (item: Place) => (
    <TouchableOpacity
      style={styles.row}
      onPress={() =>
        navigation.navigate('AdminVenueDetail', {
          venueUid: null,
          venueName: item.name,
        })
      }
    >
      <View style={[styles.venueIcon, { backgroundColor: '#95a5a6' }]}>
        <MaterialCommunityIcons
          name={CATEGORY_ICONS[item.category]}
          size={22}
          color="#fff"
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.meta}>{item.address}</Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={22} color="#999" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* ГЛОБАЛЬНЫЕ НАСТРОЙКИ */}
      <View style={styles.settingsCard}>
        <Text style={styles.settingsTitle}>Глобальные настройки</Text>
        <View style={styles.settingsRow}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Баллов за квест:</Text>
            <TextInput 
              style={styles.input} 
              keyboardType="numeric" 
              value={pointsPerQuest} 
              onChangeText={setPointsPerQuest} 
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Списание за точку (мес):</Text>
            <TextInput 
              style={styles.input} 
              keyboardType="numeric" 
              value={monthlyCost} 
              onChangeText={setMonthlyCost} 
            />
          </View>
        </View>
        <TouchableOpacity 
          style={[styles.saveSettingsBtn, savingSettings && { opacity: 0.6 }]} 
          onPress={handleSaveSettings}
          disabled={savingSettings}
        >
          {savingSettings ? <ActivityIndicator color="#fff" size="small"/> : <Text style={styles.saveSettingsText}>Сохранить настройки</Text>}
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.addBtn}
        onPress={() => navigation.navigate('AdminCreateVenue')}
      >
        <Text style={styles.addBtnText}>+ Создать заведение вручную</Text>
      </TouchableOpacity>

      <SectionList
        sections={sections}
        keyExtractor={(item: any, index) => item.uid ?? item.id ?? String(index)}
        renderItem={({ item, section }) => {
          if ((section as any).type === 'app') return renderApplication(item as VenueApplication);
          if ((section as any).type === 'venue') return renderVenue(item as VenueAccount);
          return renderPlace(item as Place);
        }}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Пока ничего нет</Text>}
        contentContainerStyle={{ paddingBottom: 40 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12 },
  settingsCard: { backgroundColor: '#f0f0f0', borderRadius: 12, padding: 16, marginBottom: 16 },
  settingsTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12, color: '#333' },
  settingsRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  inputGroup: { flex: 1 },
  inputLabel: { fontSize: 12, color: '#666', marginBottom: 4 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 15 },
  saveSettingsBtn: { backgroundColor: '#3498db', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  saveSettingsText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  addBtn: {
    backgroundColor: '#2ecc71', borderRadius: 8, padding: 12,
    alignItems: 'center', marginBottom: 12,
  },
  addBtnText: { color: '#fff', fontWeight: '700' },
  sectionHeader: {
    fontSize: 13, color: '#888', fontWeight: '700',
    textTransform: 'uppercase', marginTop: 16, marginBottom: 6, paddingHorizontal: 4,
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee', gap: 12,
  },
  appRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee', gap: 12,
    backgroundColor: '#fffbea',
  },
  appBtn: {
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, alignItems: 'center', justifyContent: 'center',
  },
  appBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  venueIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#2c3e50',
    alignItems: 'center', justifyContent: 'center',
  },
  name: { fontWeight: '600', fontSize: 15 },
  meta: { color: '#666', fontSize: 12, marginTop: 1 },
  empty: { textAlign: 'center', marginTop: 40, color: '#999' },
});