import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, TextInput, FlatList, StyleSheet, TouchableOpacity,
  Image, ActivityIndicator, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FriendsStackParamList } from '@/navigation/ClientNavigator';
import { subscribeToFriends, searchUsers, addFriend } from '@/services/friendsService';
import { useAuth } from '@/context/AuthContext';
import { FriendEntry } from '@/types';

type Nav = NativeStackNavigationProp<FriendsStackParamList, 'FriendsList'>;

interface SearchResult {
  uid: string;
  name: string;
  surname: string;
  avatarUrl: string | null;
  questsCompleted: number;
}

function getDisplayName(item: { name?: string; surname?: string; uid?: string }): string {
  const full = [item.name, item.surname].filter(Boolean).join(' ').trim();
  if (full) return full;
  return `Пользователь ${item.uid?.slice(0, 6) ?? ''}`;
}

export default function FriendsScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);

  useEffect(() => {
    if (!user) return;
    return subscribeToFriends(user.uid, setFriends);
  }, [user]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await searchUsers(query.trim());
        setResults(res.users ?? []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  const friendUids = useMemo(() => new Set(friends.map((f) => f.uid)), [friends]);

  const handleAdd = async (uid: string) => {
    try {
      await addFriend(uid);
      setQuery('');
      setResults([]);
      Alert.alert('Готово', 'Пользователь добавлен в друзья');
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось добавить');
    }
  };

  const renderSearchRow = (item: SearchResult) => {
    const already = friendUids.has(item.uid);
    const displayName = getDisplayName(item);
    return (
      <View style={styles.row} key={item.uid}>
        {item.avatarUrl ? (
          <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarText}>
              {(displayName[0] ?? '?').toUpperCase()}
            </Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.meta}>Квестов: {item.questsCompleted ?? 0}</Text>
        </View>
        {already ? (
          <Text style={styles.already}>Уже друг</Text>
        ) : (
          <TouchableOpacity style={styles.addButton} onPress={() => handleAdd(item.uid)}>
            <Text style={styles.addButtonText}>Добавить</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderFriend = ({ item }: { item: FriendEntry }) => {
    const displayName = getDisplayName(item);
    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => navigation.navigate('FriendDetail', { friendUid: item.uid })}
      >
        {item.avatarUrl ? (
          <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarText}>
              {(displayName[0] ?? '?').toUpperCase()}
            </Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.meta}>
            {item.activePlaceId
              ? '🟢 Сейчас проходит квест'
              : `Квестов выполнено: ${item.questsCompleted ?? 0}`}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.searchInput}
        placeholder="Поиск по имени, email, телефону"
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {query.trim().length >= 2 ? (
        <View style={{ flex: 1 }}>
          {searching ? (
            <ActivityIndicator style={{ marginTop: 20 }} />
          ) : results.length === 0 ? (
            <Text style={styles.empty}>Никого не найдено</Text>
          ) : (
            <FlatList
              data={results}
              keyExtractor={(u) => u.uid}
              renderItem={({ item }) => renderSearchRow(item)}
            />
          )}
        </View>
      ) : (
        <FlatList
          data={friends}
          keyExtractor={(f) => f.uid}
          renderItem={renderFriend}
          ListEmptyComponent={<Text style={styles.empty}>У вас пока нет друзей</Text>}
          contentContainerStyle={{ paddingTop: 8 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12 },
  searchInput: {
    borderWidth: 1, borderColor: '#ccc', borderRadius: 8,
    padding: 12, marginBottom: 8, fontSize: 15,
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee', gap: 10,
  },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarPlaceholder: {
    backgroundColor: '#ddd', alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontWeight: '700', color: '#555', fontSize: 16 },
  name: { fontWeight: '700', fontSize: 15 },
  meta: { color: '#666', fontSize: 12, marginTop: 2 },
  already: { color: '#888', fontSize: 13 },
  addButton: {
    backgroundColor: '#2ecc71', borderRadius: 6,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  addButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  empty: { textAlign: 'center', marginTop: 40, color: '#999' },
});