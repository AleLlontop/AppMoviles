import React, { useState } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, Alert, Modal, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { supabase } from '@/utils/supabase';
import { useUser } from '@/hooks/use-user';
import { getProfile, upsertProfile, CATEGORIES } from '@/services/profilesService';
import { useAppStore, type ThemeMode } from '@/store/useAppStore';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { EditNameSheet } from '@/components/EditNameSheet';
import { ConfirmModal } from '@/components/ConfirmModal';

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'light',  label: 'Claro',   icon: 'sunny-outline' },
  { value: 'dark',   label: 'Oscuro',  icon: 'moon-outline' },
  { value: 'system', label: 'Sistema', icon: 'phone-portrait-outline' },
];

export default function MoreScreen() {
  const router = useRouter();
  const user = useUser();
  const { theme, setTheme } = useAppStore();
  const focusGuardEnabled = useAppStore((s) => s.focusGuardEnabled);
  const setFocusGuardEnabled = useAppStore((s) => s.setFocusGuardEnabled);
  const awayNotificationEnabled = useAppStore((s) => s.awayNotificationEnabled);
  const setAwayNotificationEnabled = useAppStore((s) => s.setAwayNotificationEnabled);
  const presentationModeEnabled = useAppStore((s) => s.presentationModeEnabled);
  const setPresentationModeEnabled = useAppStore((s) => s.setPresentationModeEnabled);
  const c = useThemeColors();

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
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showNicknameSheet, setShowNicknameSheet] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const currentThemeLabel = THEME_OPTIONS.find(o => o.value === theme)?.label ?? 'Sistema';

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

  const handleSelectTheme = (value: ThemeMode) => {
    setTheme(value);
    setShowThemeModal(false);
  };

  const handleLogout = () => setShowLogoutConfirm(true);

  const doLogout = async () => {
    await supabase.auth.signOut();
    setShowLogoutConfirm(false);
    router.replace('/login');
  };

  const SettingRow = ({ title, value, showBorder = true, onPress, destructive = false }: any) => (
    <View>
      <TouchableOpacity style={styles.settingItem} activeOpacity={0.7} onPress={onPress}>
        <Text style={[styles.settingTitle, { color: destructive ? '#FF3B30' : c.textPrimary }]}>{title}</Text>
        <View style={styles.settingRight}>
          {value ? <Text style={[styles.settingValue, { color: c.textSecondary }]}>{value}</Text> : null}
          {!destructive && <Ionicons name="chevron-forward" size={24} color={c.textSecondary} style={{ marginLeft: 8 }} />}
        </View>
      </TouchableOpacity>
      {showBorder ? <View style={[styles.separator, { backgroundColor: c.border }]} /> : null}
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color={c.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: c.textPrimary }]}>Configuraciones</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {isLoggedIn && (
          <View style={[styles.profileCard, { backgroundColor: c.surface }]}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarFallback, { backgroundColor: c.accent }]}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </View>
            )}
            <View style={styles.profileInfo}>
              {userName && <Text style={[styles.profileName, { color: c.textPrimary }]}>{userName}</Text>}
              <Text style={[styles.profileEmail, { color: c.textSecondary }]}>{userEmail}</Text>
            </View>
          </View>
        )}

        <View style={[styles.settingsGroup, { backgroundColor: c.surface }]}>
          <SettingRow title="Apodo" value={nickname ?? 'Sin apodo'} onPress={() => setShowNicknameSheet(true)} />
          <SettingRow title="Categoría" value={category ?? 'Seleccionar'} showBorder={false} onPress={() => setShowCategoryModal(true)} />
        </View>

        <View style={[styles.settingsGroup, { backgroundColor: c.surface }]}>
          <SettingRow title="Tema" value={currentThemeLabel} showBorder={false} onPress={() => setShowThemeModal(true)} />
        </View>

        {/* RF-02 (refinado): dos toggles opcionales independientes */}
        <View style={[styles.settingsGroup, { backgroundColor: c.surface }]}>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={[styles.settingTitle, { color: c.textPrimary }]}>Resumen al terminar la sesión</Text>
              <Text style={[styles.toggleDesc, { color: c.textSecondary }]}>
                Al detener el cronómetro, mostrar cuántas veces saliste de la app durante la sesión.
              </Text>
            </View>
            <Switch
              value={focusGuardEnabled}
              onValueChange={setFocusGuardEnabled}
              trackColor={{ false: c.separator, true: c.accentStrong }}
              thumbColor="#FFFFFF"
            />
          </View>
          <View style={[styles.separator, { backgroundColor: c.border }]} />
          <View style={styles.toggleRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={[styles.settingTitle, { color: c.textPrimary }]}>Avisarme cuando salga</Text>
              <Text style={[styles.toggleDesc, { color: c.textSecondary }]}>
                Si salís de la app con el cronómetro corriendo, recibir una notificación recordándolo.
              </Text>
            </View>
            <Switch
              value={awayNotificationEnabled}
              onValueChange={setAwayNotificationEnabled}
              trackColor={{ false: c.separator, true: c.accentStrong }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Sección Avanzado: features para demos / debug */}
        <Text style={[styles.sectionTitle, { color: c.textSecondary }]}>AVANZADO</Text>
        <View style={[styles.settingsGroup, { backgroundColor: c.surface }]}>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={[styles.settingTitle, { color: c.textPrimary }]}>Modo presentación</Text>
              <Text style={[styles.toggleDesc, { color: c.textSecondary }]}>
                Solo para mostrar la app. Inyecta usuarios fake conectados en tus grupos. El cambio es local a tu celular y rota cada 30 segundos.
              </Text>
            </View>
            <Switch
              value={presentationModeEnabled}
              onValueChange={setPresentationModeEnabled}
              trackColor={{ false: c.separator, true: c.accentStrong }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        <View style={[styles.settingsGroup, { backgroundColor: c.surface }]}>
          {isLoggedIn ? (
            <SettingRow title="Cerrar sesión" showBorder={false} onPress={handleLogout} destructive />
          ) : (
            <SettingRow title="Iniciar Sesión" showBorder={false} onPress={() => router.push('/login')} />
          )}
        </View>

      </ScrollView>

      {/* Category modal */}
      <Modal visible={showCategoryModal} transparent animationType="slide">
        <TouchableOpacity style={[styles.modalOverlay, { backgroundColor: c.modalOverlay }]} activeOpacity={1} onPress={() => setShowCategoryModal(false)}>
          <View style={[styles.modalSheet, { backgroundColor: c.modalBg }]}>
            <View style={[styles.modalHandle, { backgroundColor: c.handle }]} />
            <Text style={[styles.modalTitle, { color: c.textPrimary }]}>Seleccionar categoría</Text>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.optionRow, { borderBottomColor: c.separator }, category === cat && { backgroundColor: '#F5F3FF', borderRadius: 12, paddingHorizontal: 12 }]}
                onPress={() => handleSelectCategory(cat)}
              >
                <Text style={[styles.optionText, { color: c.optionText }, category === cat && { color: c.accent, fontWeight: '600' }]}>
                  {cat}
                </Text>
                {category === cat && <Ionicons name="checkmark" size={20} color={c.accent} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Theme modal */}
      <Modal visible={showThemeModal} transparent animationType="slide">
        <TouchableOpacity style={[styles.modalOverlay, { backgroundColor: c.modalOverlay }]} activeOpacity={1} onPress={() => setShowThemeModal(false)}>
          <View style={[styles.modalSheet, { backgroundColor: c.modalBg }]}>
            <View style={[styles.modalHandle, { backgroundColor: c.handle }]} />
            <Text style={[styles.modalTitle, { color: c.textPrimary }]}>Apariencia</Text>
            {THEME_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.optionRow, { borderBottomColor: c.separator }, theme === opt.value && { backgroundColor: '#F5F3FF', borderRadius: 12, paddingHorizontal: 12 }]}
                onPress={() => handleSelectTheme(opt.value)}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name={opt.icon} size={22} color={theme === opt.value ? c.accent : c.textSecondary} style={{ marginRight: 12 }} />
                  <Text style={[styles.optionText, { color: c.optionText }, theme === opt.value && { color: c.accent, fontWeight: '600' }]}>
                    {opt.label}
                  </Text>
                </View>
                {theme === opt.value && <Ionicons name="checkmark" size={20} color={c.accent} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      <ConfirmModal
        visible={showLogoutConfirm}
        title="Cerrar sesión"
        description="Vas a tener que volver a iniciar sesión la próxima vez que abras la app."
        icon="log-out-outline"
        confirmLabel="Cerrar sesión"
        destructive
        onConfirm={doLogout}
        onCancel={() => setShowLogoutConfirm(false)}
      />

      <EditNameSheet
        visible={showNicknameSheet}
        title="Editar apodo"
        description="Así te van a ver tus compañeros dentro de la app."
        icon="person-circle-outline"
        initialValue={nickname ?? ''}
        placeholder="Tu apodo"
        minLength={1}
        maxLength={30}
        onClose={() => setShowNicknameSheet(false)}
        onSave={async (newNick) => {
          if (!user) return;
          await upsertProfile(user.id, {
            nickname: newNick,
            name:
              user.user_metadata?.full_name ||
              user.user_metadata?.name ||
              user.email ||
              'Usuario',
          });
          setNickname(newNick);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1 },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 },
  backButton:   { padding: 8, marginLeft: -8 },
  headerTitle:  { fontSize: 22, fontWeight: '700' },
  scrollContent:{ paddingHorizontal: 20, paddingBottom: 120, gap: 24 },

  profileCard:  { borderRadius: 24, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 3 },
  avatar:       { width: 64, height: 64, borderRadius: 32 },
  avatarFallback:{ width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  avatarInitials:{ fontSize: 24, fontWeight: '700', color: '#FFF' },
  profileInfo:  { flex: 1, gap: 2 },
  profileName:  { fontSize: 18, fontWeight: '600' },
  profileEmail: { fontSize: 14 },

  settingsGroup:{ borderRadius: 24, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 3 },
  settingItem:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 20, paddingHorizontal: 20 },
  toggleRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 20 },
  toggleDesc:   { fontSize: 12, marginTop: 4, lineHeight: 17 },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginTop: 24, marginBottom: 8, marginLeft: 4 },
  settingTitle: { fontSize: 18, fontWeight: '500' },
  settingRight: { flexDirection: 'row', alignItems: 'center' },
  settingValue: { fontSize: 16 },
  separator:    { height: 1, opacity: 0.4, marginLeft: 24 },

  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalSheet:   { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40, gap: 4 },
  modalHandle:  { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitle:   { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  optionRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 4, borderBottomWidth: 1 },
  optionText:   { fontSize: 17 },
});
