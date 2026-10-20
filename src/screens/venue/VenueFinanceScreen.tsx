import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/config/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { subscribeToVenueTransactions } from '@/services/venueService';
import { subscribeToPlacesByOwner } from '@/services/placesService';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Place } from '@/types';

function formatDate(ms?: number) {
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

function daysUntil(ms?: number) {
  if (!ms) return null;
  const now = Date.now();
  return Math.max(0, Math.ceil((ms - now) / (1000 * 60 * 60 * 24)));
}

export default function VenueFinanceScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [venue, setVenue] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [settings, setSettings] = useState<{ pointsPerQuest: number; monthlyCostPerPlace: number }>({
    pointsPerQuest: 10,
    monthlyCostPerPlace: 100,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    
    // Подписка на баланс и лимиты
    const unsubVenue = onSnapshot(doc(db, 'venues', user.uid), (snap) => {
      setVenue(snap.data());
      setLoading(false);
    });

    // Подписка на историю транзакций
    const unsubTx = subscribeToVenueTransactions(user.uid, setTransactions);
    
    // Подписка на список точек (чтобы показать даты списаний)
    const unsubPlaces = subscribeToPlacesByOwner(user.uid, setPlaces);

    // Подписка на глобальные настройки (чтобы показать реальные цифры)
    const unsubSettings = onSnapshot(doc(db, 'settings', 'general'), (snap) => {
      if (snap.exists()) {
        setSettings({
          pointsPerQuest: snap.data().pointsPerQuest ?? 10,
          monthlyCostPerPlace: snap.data().monthlyCostPerPlace ?? 100,
        });
      }
    });

    return () => { unsubVenue(); unsubTx(); unsubPlaces(); unsubSettings(); };
  }, [user]);

  if (loading || !venue) {
    return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator /></View>;
  }

  // Сортируем точки по дате ближайшей оплаты
  const sortedPlaces = [...places].sort((a, b) => {
    const aDate = a.nextBillingDate ?? 0;
    const bDate = b.nextBillingDate ?? 0;
    return aDate - bDate;
  });

  const nearestPlace = sortedPlaces[0];
  const daysToNearest = nearestPlace ? daysUntil(nearestPlace.nextBillingDate) : null;

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.balanceLabel, { color: colors.textMuted }]}>Текущий баланс</Text>
        <Text style={[styles.balanceValue, { color: colors.primary }]}>
          {venue.balance || 0} баллов
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Правила</Text>
        
        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: colors.textMuted }]}>За человека (квест):</Text>
          <Text style={[styles.rowValue, { color: colors.success }]}>+{settings.pointsPerQuest} баллов</Text>
        </View>
        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: colors.textMuted }]}>Оплата за точку в месяц:</Text>
          <Text style={[styles.rowValue, { color: colors.danger }]}>-{settings.monthlyCostPerPlace} баллов</Text>
        </View>

        {daysToNearest !== null && (
          <>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.row}>
              <Text style={[styles.rowLabel, { color: colors.textMuted }]}>Ближайшее списание:</Text>
              <Text style={[styles.rowValue, { color: colors.text }]}>через {daysToNearest} дн.</Text>
            </View>
          </>
        )}
      </View>

      <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 16, marginBottom: 8 }]}>
        Предстоящие списания
      </Text>

      {places.length === 0 ? (
        <Text style={[styles.empty, { color: colors.textMuted }]}>У вас пока нет точек</Text>
      ) : (
        sortedPlaces.map((place) => {
          const days = daysUntil(place.nextBillingDate);
          const isSoon = days !== null && days <= 3;
          return (
            <View
              key={place.id}
              style={[styles.upcomingCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.upcomingName, { color: colors.text }]}>{place.name}</Text>
                <Text style={[styles.upcomingDate, { color: colors.textMuted }]}>
                  {formatDate(place.nextBillingDate)}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.upcomingAmount, { color: colors.danger }]}>
                  -{settings.monthlyCostPerPlace}
                </Text>
                <Text style={[styles.upcomingDays, { color: isSoon ? '#e74c3c' : colors.textMuted }]}>
                  {days === null ? '—' : days === 0 ? 'сегодня' : `через ${days} дн.`}
                </Text>
              </View>
            </View>
          );
        })
      )}

      <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 16, marginBottom: 8 }]}>
        История (за год)
      </Text>

      {transactions.length === 0 ? (
        <Text style={[styles.empty, { color: colors.textMuted }]}>История пуста</Text>
      ) : (
        transactions.map((tx) => (
          <View key={tx.id} style={[styles.txRow, { borderBottomColor: colors.border }]}>
            <MaterialCommunityIcons 
              name={tx.amount > 0 ? 'plus-circle' : 'minus-circle'} 
              size={24} 
              color={tx.amount > 0 ? colors.success : colors.danger} 
            />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.txDesc, { color: colors.text }]}>{tx.description}</Text>
              <Text style={[styles.txDate, { color: colors.textMuted }]}>
                {formatDate(tx.createdAt)}
              </Text>
            </View>
            <Text style={[styles.txAmount, { color: tx.amount > 0 ? colors.success : colors.danger }]}>
              {tx.amount > 0 ? '+' : ''}{tx.amount}
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: 16, paddingBottom: 48 },
  card: { borderRadius: 12, padding: 16, borderWidth: 1, marginBottom: 16 },
  balanceLabel: { fontSize: 14, textAlign: 'center' },
  balanceValue: { fontSize: 28, fontWeight: '800', textAlign: 'center', marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  rowLabel: { fontSize: 14 },
  rowValue: { fontSize: 14, fontWeight: '600' },
  divider: { height: 1, marginVertical: 8 },
  empty: { textAlign: 'center', marginTop: 16 },
  upcomingCard: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 12, padding: 14, borderWidth: 1, marginBottom: 8,
  },
  upcomingName: { fontWeight: '700', fontSize: 14 },
  upcomingDate: { fontSize: 12, marginTop: 2 },
  upcomingAmount: { fontWeight: '800', fontSize: 15 },
  upcomingDays: { fontSize: 11, marginTop: 2 },
  txRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
  txDesc: { fontSize: 14, fontWeight: '500' },
  txDate: { fontSize: 12, marginTop: 2 },
  txAmount: { fontSize: 16, fontWeight: '700' },
});