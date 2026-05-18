import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useUser } from '@/hooks/use-user';
import { getProfile, upsertProfile } from '@/services/profilesService';

const MAX_LENGTH = 240;

export default function EditNicknameScreen() {
  const router = useRouter();
  const user = useUser();
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getProfile(user.id)
      .then(p => { if (p?.nickname) setNickname(p.nickname); })
      .finally(() => setInitialLoading(false));
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    const trimmed = nickname.trim();
    if (trimmed.length === 0) return;

    try {
      setLoading(true);
      await upsertProfile(user.id, { nickname: trimmed });
      router.back();
    } catch (err) {
      console.error('Error saving nickname:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.cancelBtn}>
          <Text style={styles.cancelText}>Cancelar</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Apodo</Text>
        <TouchableOpacity onPress={handleSave} style={styles.saveBtn} disabled={loading || nickname.trim().length === 0}>
          {loading
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.saveText}>Listo</Text>
          }
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {initialLoading ? (
          <ActivityIndicator color="#A594F9" size="large" />
        ) : (
          <>
            <TextInput
              style={styles.input}
              value={nickname}
              onChangeText={setNickname}
              maxLength={MAX_LENGTH}
              placeholder="Tu apodo..."
              placeholderTextColor="#9CA3AF"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleSave}
            />
            <Text style={[
              styles.counter,
              nickname.length > MAX_LENGTH * 0.9 && { color: '#F97316' }
            ]}>
              {nickname.length} / {MAX_LENGTH}
            </Text>
            <Text style={styles.hint}>
              Este apodo se mostrará en tu perfil dentro de la app.
            </Text>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F9FB',
    paddingTop: Platform.OS === 'android' ? 24 : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#A594F9',
  },
  cancelBtn: { padding: 4 },
  cancelText: { color: '#fff', fontSize: 16 },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '600' },
  saveBtn: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
  },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  content: {
    flex: 1,
    padding: 24,
    gap: 12,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    fontSize: 18,
    color: '#191C1E',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  counter: {
    textAlign: 'right',
    fontSize: 12,
    color: '#9CA3AF',
  },
  hint: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 4,
  },
});
