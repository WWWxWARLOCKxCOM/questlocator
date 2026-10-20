import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { subscribeToVenue } from '@/services/venueService';
import { subscribeToPlacesByOwner } from '@/services/placesService';
import { useAuth } from '@/context/AuthContext';
import { VenueAccount } from '@/types';

export default function VenueProfileScreen() {
  const { user } = useAuth();
  const [venue, setVenue] = useState<VenueAccount | null>(null);
  const [used, setUsed] = useState(0);

  useEffect(() => {
    if (!user) return;
    const u1 = subscribeToVenue(user.uid, setVenue);
    const u2 = subscribeToPlacesByOwner(user.uid, (list) => setUsed(list.length));
    return () => { u1(); u2(); };
  }, [user]);

  if (!venue) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{venue.companyName}</Text>
      <Text style={styles.sub}>{venue.contactEmail}</Text>
      {venue.contactPhone ? <Text style={styles.sub}>{venue.contactPhone}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.stat}>{used} / {venue.pointsLimit}</Text>
        <Text style={styles.statLabel}>Точек использовано</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, alignItems: 'center', gap: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '800' },
  sub: { color: '#666' },
  card: {
    marginTop: 24, backgroundColor: '#f5f5f5', borderRadius: 12,
    padding: 24, alignItems: 'center', width: '100%',
  },
  stat: { fontSize: 32, fontWeight: '800' },
  statLabel: { color: '#666', marginTop: 6 },
});