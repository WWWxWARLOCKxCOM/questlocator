import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { subscribeToVenue } from '@/services/venueService';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { VenueAccount } from '@/types';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function VenueProfileScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [venue, setVenue] = useState<VenueAccount | null>(null);

  useEffect(() => {
    if (!user) return;
    return subscribeToVenue(user.uid, setVenue);
  }, [user]);

  if (!venue) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>{venue.companyName}</Text>
      <Text style={[styles.sub, { color: colors.textMuted }]}>{venue.contactEmail}</Text>
      {venue.contactPhone ? <Text style={[styles.sub, { color: colors.textMuted }]}>{venue.contactPhone}</Text> : null}

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.stat, { color: colors.primary }]}>{venue.balance || 0}</Text>
        <Text style={[styles.statLabel, { color: colors.textMuted }]}>Баллов на счету</Text>
      </View>

      <View style={styles.row}>
        <View style={[styles.statBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="map-marker" size={24} color={colors.primary} style={{ marginBottom: 4 }} />
          <Text style={[styles.statBoxValue, { color: colors.text }]}>
            {venue.pointsUsed || 0} / {venue.pointsLimit || 0}
          </Text>
          <Text style={[styles.statBoxLabel, { color: colors.textMuted }]}>Точек</Text>
        </View>

        <View style={[styles.statBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="ticket-percent" size={24} color={colors.primary} style={{ marginBottom: 4 }} />
          <Text style={[styles.statBoxValue, { color: colors.text }]}>
            {venue.couponsUsed || 0} / {venue.couponsLimit || 0}
          </Text>
          <Text style={[styles.statBoxLabel, { color: colors.textMuted }]}>Купонов</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, alignItems: 'center', gap: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '800' },
  sub: { fontSize: 14 },
  card: {
    marginTop: 24, borderRadius: 12, borderWidth: 1,
    padding: 24, alignItems: 'center', width: '100%',
  },
  stat: { fontSize: 32, fontWeight: '800' },
  statLabel: { marginTop: 6 },
  row: { flexDirection: 'row', gap: 12, width: '100%', marginTop: 12 },
  statBox: {
    flex: 1, borderRadius: 12, borderWidth: 1, padding: 16, alignItems: 'center',
  },
  statBoxValue: { fontSize: 18, fontWeight: '700' },
  statBoxLabel: { fontSize: 12, marginTop: 4 },
});