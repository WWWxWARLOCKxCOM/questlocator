import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, SectionList, StyleSheet, TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AdminStackParamList } from '@/navigation/AdminNavigator';
import { subscribeToAllVenues } from '@/services/venueService';
import { subscribeToAllPlaces } from '@/services/placesService';
import { Place, PlaceCategory, VenueAccount } from '@/types';

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

  useEffect(() => subscribeToAllVenues(setVenues), []);
  useEffect(() => subscribeToAllPlaces(setPlaces), []);

  const adminPlaces = useMemo(() => places.filter((p) => !p.ownerUid), [places]);

  const sections = useMemo(() => {
    const result: { title: string; data: any[]; type: 'venue' | 'place' }[] = [];
    result.push({ title: 'Заведения', type: 'venue', data: venues });
    if (adminPlaces.length > 0) {
      result.push({ title: 'Точки без владельца', type: 'place', data: adminPlaces });
    }
    return result;
  }, [venues, adminPlaces]);

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
          Точек: {item.pointsUsed} / {item.pointsLimit}
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
      <TouchableOpacity
        style={styles.addBtn}
        onPress={() => navigation.navigate('AdminCreateVenue')}
      >
        <Text style={styles.addBtnText}>+ Создать заведение</Text>
      </TouchableOpacity>

      <SectionList
        sections={sections}
        keyExtractor={(item: any, index) => item.uid ?? item.id ?? String(index)}
        renderItem={({ item, section }) =>
          (section as any).type === 'venue'
            ? renderVenue(item as VenueAccount)
            : renderPlace(item as Place)
        }
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
  venueIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#2c3e50',
    alignItems: 'center', justifyContent: 'center',
  },
  name: { fontWeight: '600', fontSize: 15 },
  meta: { color: '#666', fontSize: 12, marginTop: 1 },
  empty: { textAlign: 'center', marginTop: 40, color: '#999' },
});