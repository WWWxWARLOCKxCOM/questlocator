import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, Modal, ScrollView, Alert, ActivityIndicator
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { 
  subscribeToVenueApplications, 
  approveVenueApplication, 
  rejectVenueApplication 
} from '@/services/venueService';
import { VenueApplication } from '@/types';
import { useTheme } from '@/context/ThemeContext';

export default function AdminVenueApplicationsScreen() {
  const { colors } = useTheme();
  const [applications, setApplications] = useState<VenueApplication[]>([]);
  const [selected, setSelected] = useState<VenueApplication | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => subscribeToVenueApplications(setApplications), []);

  const handleApprove = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await approveVenueApplication(selected.uid);
      Alert.alert('Успех', 'Компания одобрена и получила уведомление.');
      setSelected(null);
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message);
    } finally {
      setBusy(false);
    }
  };

  const handleReject = () => {
    if (!selected) return;
    Alert.alert('Отклонить?', 'Аккаунт компании и все её данные будут удалены безвозвратно.', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: async () => {
        setBusy(true);
        try {
          await rejectVenueApplication(selected.uid);
          setSelected(null);
        } catch (e: any) {
          Alert.alert('Ошибка', e?.message);
        } finally {
          setBusy(false);
        }
      }}
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={applications}
        keyExtractor={(item) => item.uid}
        contentContainerStyle={{ padding: 12 }}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} 
            onPress={() => setSelected(item)}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: colors.text }]}>{item.companyName}</Text>
              <Text style={[styles.meta, { color: colors.textMuted }]}>{item.loginEmail}</Text>
              <Text style={[styles.meta, { color: colors.textMuted }]}>ИНН: {item.taxId}</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color={colors.textMuted} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={[styles.empty, { color: colors.textMuted }]}>Новых заявок нет</Text>}
      />

      <Modal visible={!!selected} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { backgroundColor: colors.background }]}>
            <ScrollView contentContainerStyle={{ padding: 20 }}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Заявка компании</Text>
              
              <InfoRow label="Название" value={selected?.companyName} colors={colors} />
              <InfoRow label="Рег. номер" value={selected?.regNumber} colors={colors} />
              <InfoRow label="Страна" value={selected?.country} colors={colors} />
              <InfoRow label="Юр. адрес" value={selected?.legalAddress} colors={colors} />
              <InfoRow label="ИНН / Налоговый" value={selected?.taxId} colors={colors} />
              <InfoRow label="Корп. почта" value={selected?.corporateEmail} colors={colors} />
              <InfoRow label="Телефон" value={selected?.companyPhone} colors={colors} />
              <InfoRow label="Сотрудник" value={`${selected?.employeeName} (${selected?.employeePosition || '—'})`} colors={colors} />
              <InfoRow label="Сайт" value={selected?.website || '—'} colors={colors} />
              <InfoRow label="Email для входа" value={selected?.loginEmail} colors={colors} />

              <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
                <TouchableOpacity 
                  style={[styles.btn, { backgroundColor: colors.danger }]} 
                  onPress={handleReject}
                  disabled={busy}
                >
                  {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Отклонить</Text>}
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.btn, { backgroundColor: colors.success }]} 
                  onPress={handleApprove}
                  disabled={busy}
                >
                  {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Одобрить</Text>}
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={{ marginTop: 16, alignItems: 'center' }} onPress={() => setSelected(null)}>
                <Text style={{ color: colors.textMuted }}>Закрыть</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function InfoRow({ label, value, colors }: any) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: 2 }}>{label}</Text>
      <Text style={{ fontSize: 15, color: colors.text, fontWeight: '500' }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  card: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  name: { fontSize: 16, fontWeight: '700' },
  meta: { fontSize: 13, marginTop: 2 },
  empty: { textAlign: 'center', marginTop: 40 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%' },
  modalTitle: { fontSize: 20, fontWeight: '800', marginBottom: 20 },
  btn: { flex: 1, padding: 16, borderRadius: 10, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});