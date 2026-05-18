import React, { useEffect, useState } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { supabase } from '@/utils/supabase';
import { useUser } from '@/hooks/use-user';
import { getProfile, upsertProfile, CATEGORIES } from '@/services/profilesService';

const SettingRow = ({ title, value, showBorder = true, onPress, destructive = false }: any) => (
  <View>
    <TouchableOpacity style={styles.settingItem} activeOpacity={0.7} onPress={onPress}>
      <Text style={[styles.settingTitle, destructive && { color: '#FF3B30' }]}>{title}</Text>
      <View style={styles.settingRight}>
        {value ? <Text style={styles.settingValue}>{value}</Text> : null}
        {!destructive && <Ionicons name="chevron-forward" size={24} color="#C7C7CC" style={{ marginLeft: 8 }} />}
      </View>
    </TouchableOpacity>
    {showBorder ? <View style={styles.separator} /> : null}
  </View>
);

export default function MoreScreen() {
  const router = useRouter();
  const user = useUser();
  const isLoggedIn = !!user;
  const userEmail = user?.email ?? null;
  const userName = user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? null;
  const avatarUrl = user?.user_metadata?.avatar_url ?? user?.user_metadata?.picture ?? null;
  const initials = userName
    ? userName.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
    : userEmail?.[0]?.toUpperCase() ?? '?';

  const [nickname, setNickname] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      getProfile(user.id).then(p => {
        if (p?.nickname) setNickname(p.nickname);
        if (p?.category) setCategory(p.category);
      });
    }, [user])
  );

  const handleSelectCategory = async (cat: string) => {
    setShowCategoryModal(false);
    if (!user) return;
    setCategory(cat);
    try {
      await upsertProfile(user.id, { category: cat });
    } catch (err) {
      console.error('Error saving category:', err);
    }
  };

  const handleLogout = () => {
    Alert.alert('Cerrar sesión', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar sesión', style: 'destructive', onPress: async () => {
          await supabase.auth.signOut();
          router.replace('/login');
        }
      }
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Configuraciones</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Profile card */}
        {isLoggedIn && (
          <View style={styles.profileCard}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </View>
            )}
            <View style={styles.profileInfo}>
              {userName && <Text style={styles.profileName}>{userName}</Text>}
              <Text style={styles.profileEmail}>{userEmail}</Text>
            </View>
          </View>
        )}

        {/* Perfil */}
        <View style={styles.settingsGroup}>
          <SettingRow
            title="Apodo"
            value={nickname ?? 'Sin apodo'}
            onPress={() => router.push('/edit-nickname')}
          />
          <SettingRow
            title="Categoría"
            value={category ?? 'Seleccionar'}
            showBorder={false}
            onPress={() => setShowCategoryModal(true)}
          />
        </View>

        {/* Apariencia */}
        <View style={styles.settingsGroup}>
          <SettingRow title="Configurar tema" value="Light" showBorder={false} />
        </View>

        {/* Cuenta */}
        <View style={styles.settingsGroup}>
          {isLoggedIn ? (
            <SettingRow title="Cerrar sesión" showBorder={false} onPress={handleLogout} destructive />
          ) : (
            <SettingRow title="Iniciar Sesión" showBorder={false} onPress={() => router.push('/login')} />
          )}
        </View>

      </ScrollView>

      {/* Category picker modal */}
      <Modal visible={showCategoryModal} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowCategoryModal(false)}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Seleccionar categoría</Text>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.categoryRow, category === cat && styles.categoryRowActive]}
                onPress={() => handleSelectCategory(cat)}
              >
                <Text style={[styles.categoryText, category === cat && styles.categoryTextActive]}>
                  {cat}
                </Text>
                {category === cat && <Ionicons name="checkmark" size={20} color="#A594F9" />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F9FB' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  backButton: { padding: 8, marginLeft: -8 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#191C1E' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 120, gap: 24 },

  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  avatar: { width: 64, height: 64, borderRadius: 32 },
  avatarFallback: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#A594F9',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitials: { fontSize: 24, fontWeight: '700', color: '#FFF' },
  profileInfo: { flex: 1, gap: 2 },
  profileName: { fontSize: 18, fontWeight: '600', color: '#191C1E' },
  profileEmail: { fontSize: 14, color: '#7B7486' },

  settingsGroup: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  settingItem: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 20, paddingHorizontal: 20,
  },
  settingTitle: { fontSize: 18, fontWeight: '500', color: '#191C1E' },
  settingRight: { flexDirection: 'row', alignItems: 'center' },
  settingValue: { fontSize: 16, color: '#7B7486' },
  separator: {
    height: 1, backgroundColor: '#7B7486',
    opacity: 0.15, marginLeft: 24,
  },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 40,
    gap: 4,
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center', marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18, fontWeight: '700', color: '#191C1E',
    marginBottom: 12,
  },
  categoryRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  categoryRowActive: { backgroundColor: '#F5F3FF', borderRadius: 12, paddingHorizontal: 12 },
  categoryText: { fontSize: 17, color: '#374151' },
  categoryTextActive: { color: '#A594F9', fontWeight: '600' },
});
