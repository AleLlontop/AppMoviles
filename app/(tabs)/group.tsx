import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Modal, TextInput, ActivityIndicator, Alert, Keyboard, Platform, Pressable,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { useUser } from '@/hooks/use-user';
import { useAppStore } from '@/store/useAppStore';
import { createGroup, joinGroup, getMyGroups, MyGroup } from '@/services/groupsService';

export default function GroupScreen() {
  const c = useThemeColors();
  const user = useUser();
  const router = useRouter();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(false);

  // --- Mis grupos ---
  const [myGroups, setMyGroups] = useState<MyGroup[] | null>(null); // null = todavía no cargado
  const loadMyGroups = useCallback(async () => {
    if (!user?.id) return;
    try {
      const list = await getMyGroups(user.id);
      setMyGroups(list);
    } catch (e: any) {
      // Si falla, no rompo la UI — solo dejo el estado vacío.
      setMyGroups([]);
    }
  }, [user?.id]);

  useFocusEffect(useCallback(() => {
    loadMyGroups();
  }, [loadMyGroups]));

  // --- Unirse con código ---
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const joinErrorMessages: Record<string, string> = {
    invalid_code: 'Código inválido — revisá los caracteres',
    group_full: 'El grupo está lleno (10/10)',
    already_member: 'Ya sos miembro de este grupo',
  };

  const fillCode = (raw: string) => {
    const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    const next = Array.from({ length: 6 }, (_, i) => cleaned[i] ?? '');
    setCode(next);
    setJoinError(null);
    const lastIdx = Math.min(cleaned.length - 1, 5);
    if (lastIdx >= 0) inputRefs.current[lastIdx]?.focus();
  };

  const handleCodeChange = (text: string, index: number) => {
    if (text.length > 1) { fillCode(text); return; }
    const char = text.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const next = [...code];
    next[index] = char;
    setCode(next);
    setJoinError(null);
    if (char && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handlePasteCode = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) fillCode(text);
  };

  const handleCodeKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !code[index] && index > 0) {
      const next = [...code];
      next[index - 1] = '';
      setCode(next);
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleJoin = async () => {
    const inviteCode = code.join('');
    if (inviteCode.length < 6) {
      setJoinError('invalid_code');
      return;
    }
    if (!user?.id) return;
    setJoining(true);
    setJoinError(null);
    try {
      const group = await joinGroup(inviteCode, user.id);
      setShowJoinModal(false);
      setCode(['', '', '', '', '', '']);
      useAppStore.getState().bumpPresence();
      if (group?.id) router.push(`/group/${group.id}`);
    } catch (e: any) {
      setJoinError(e?.name ?? 'invalid_code');
    } finally {
      setJoining(false);
    }
  };

  const handleCloseJoinModal = () => {
    if (joining) return;
    setShowJoinModal(false);
    setCode(['', '', '', '', '', '']);
    setJoinError(null);
  };

  const handleCreate = async () => {
    if (!groupName.trim()) {
      Alert.alert('Nombre requerido', 'Ingresá un nombre para el grupo.');
      return;
    }
    if (groupName.trim().length < 3) {
      Alert.alert('Nombre muy corto', 'El nombre debe tener al menos 3 caracteres.');
      return;
    }
    if (!user?.id) return;

    setLoading(true);
    try {
      const group = await createGroup(groupName, user.id);
      setShowCreateModal(false);
      setGroupName('');
      useAppStore.getState().bumpPresence();
      if (group?.id) router.push(`/group/${group.id}`);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'No se pudo crear el grupo.');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseModal = () => {
    if (loading) return;
    setShowCreateModal(false);
    setGroupName('');
  };

  const insets = useSafeAreaInsets();
  const [kbHeight, setKbHeight] = useState(0);
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvt, (e) => setKbHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener(hideEvt, () => setKbHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const isLoadingList = myGroups === null;
  const hasGroups = !!myGroups && myGroups.length > 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      {isLoadingList ? (
        <View style={styles.centered}>
          <ActivityIndicator color={c.accentStrong} />
        </View>
      ) : !hasGroups ? (
        <View style={styles.content}>
          <View style={[styles.iconWrapper, { borderColor: c.accent }]}>
            <View style={[styles.iconInner, { backgroundColor: c.surface }]}>
              <Ionicons name="people" size={52} color={c.textSecondary} />
            </View>
          </View>

          <Text style={[styles.title, { color: c.textPrimary }]}>
            Aún no estás en ningún grupo
          </Text>
          <Text style={[styles.subtitle, { color: c.textSecondary }]}>
            Creá uno o unite con el código que{'\n'}te compartió tu compañero.
          </Text>

          <View style={styles.buttonsContainer}>
            <TouchableOpacity
              style={[styles.buttonPrimary, { backgroundColor: '#826BF0' }]}
              activeOpacity={0.85}
              onPress={() => setShowCreateModal(true)}
            >
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.buttonPrimaryText}>Crear grupo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.buttonSecondary, { borderColor: '#826BF0' }]}
              activeOpacity={0.85}
              onPress={() => setShowJoinModal(true)}
            >
              <Text style={[styles.buttonSecondaryText, { color: '#826BF0' }]}>
                Unirse con código
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listScroll}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.listTitle, { color: c.textPrimary }]}>Mis grupos</Text>
          <Text style={[styles.listSubtitle, { color: c.textSecondary }]}>
            {myGroups!.length} {myGroups!.length === 1 ? 'grupo' : 'grupos'}
          </Text>

          <View style={{ gap: 12, marginTop: 18 }}>
            {myGroups!.map((g) => {
              const isOwner = g.role === 'owner';
              const isAdmin = g.role === 'admin';
              return (
                <TouchableOpacity
                  key={g.id}
                  activeOpacity={0.85}
                  onPress={() => router.push(`/group/${g.id}`)}
                  style={[styles.groupCard, styles.cardShadow, { backgroundColor: c.surface }]}
                >
                  <View style={[styles.groupIcon, { backgroundColor: `${c.accent}26` }]}>
                    <Ionicons name="people" size={22} color={c.accentStrong} />
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={styles.groupNameRow}>
                      <Text
                        style={[styles.groupName, { color: c.textPrimary }]}
                        numberOfLines={1}
                      >
                        {g.name}
                      </Text>
                      {(isOwner || isAdmin) && (
                        <View style={[styles.miniBadge, { borderColor: `${c.accent}99` }]}>
                          <Text style={[styles.miniBadgeText, { color: c.accentStrong }]}>
                            {isOwner ? 'OWNER' : 'ADMIN'}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.groupMeta, { color: c.textSecondary }]}>
                      {g.member_count} / {g.max_members} miembros · código {g.invite_code}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={c.textSecondary} />
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.listActions}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: c.accentStrong }]}
              activeOpacity={0.85}
              onPress={() => setShowCreateModal(true)}
            >
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.actionBtnText}>Crear</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnGhost, { borderColor: c.accentStrong }]}
              activeOpacity={0.85}
              onPress={() => setShowJoinModal(true)}
            >
              <Ionicons name="enter-outline" size={18} color={c.accentStrong} />
              <Text style={[styles.actionBtnText, { color: c.accentStrong }]}>Unirse</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* Modal Crear grupo */}
      <Modal visible={showCreateModal} transparent animationType="slide" onRequestClose={handleCloseModal}>
        <Pressable style={[styles.modalBackdrop, { backgroundColor: c.modalOverlay }]} onPress={handleCloseModal}>
          <Pressable
            style={[styles.modalSheet, { backgroundColor: c.modalBg, paddingBottom: Math.max(kbHeight, insets.bottom) + 16 }]}
            onPress={e => e.stopPropagation()}
          >
            <View style={[styles.handle, { backgroundColor: c.handle }]} />

            <View style={styles.modalIconRow}>
              <View style={[styles.modalIcon, { backgroundColor: `${c.accent}20` }]}>
                <Ionicons name="people" size={26} color={c.accentStrong} />
              </View>
            </View>

            <Text style={[styles.modalTitle, { color: c.textPrimary }]}>Nuevo grupo</Text>
            <Text style={[styles.modalSubtitle, { color: c.textSecondary }]}>
              Elegí un nombre para que tus compañeros lo reconozcan
            </Text>

            <TextInput
              style={[styles.input, { backgroundColor: c.separator, color: c.textPrimary, borderColor: c.border }]}
              placeholder="Ej: Compas de Análisis II"
              placeholderTextColor={c.textSecondary}
              value={groupName}
              onChangeText={setGroupName}
              maxLength={50}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleCreate}
            />

            <TouchableOpacity
              style={[styles.buttonPrimary, { backgroundColor: c.accentStrong, opacity: loading ? 0.7 : 1 }]}
              activeOpacity={0.85}
              onPress={handleCreate}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonPrimaryText}>Crear grupo</Text>}
            </TouchableOpacity>

            <TouchableOpacity onPress={handleCloseModal} disabled={loading}>
              <Text style={[styles.cancelText, { color: loading ? c.border : c.textSecondary }]}>Cancelar</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal Unirse con código */}
      <Modal visible={showJoinModal} transparent animationType="slide" onRequestClose={handleCloseJoinModal}>
        <Pressable style={[styles.modalBackdrop, { backgroundColor: c.modalOverlay }]} onPress={handleCloseJoinModal}>
          <Pressable
            style={[styles.modalSheet, { backgroundColor: c.modalBg, paddingBottom: Math.max(kbHeight, insets.bottom) + 16 }]}
            onPress={e => e.stopPropagation()}
          >
            <View style={[styles.handle, { backgroundColor: c.handle }]} />

            <View style={styles.modalIconRow}>
              <View style={[styles.modalIcon, { backgroundColor: `${c.accent}20` }]}>
                <Ionicons name="key" size={26} color={c.accentStrong} />
              </View>
            </View>

            <Text style={[styles.modalTitle, { color: c.textPrimary }]}>Código de invitación</Text>
            <Text style={[styles.modalSubtitle, { color: c.textSecondary }]}>
              Pedíselo a alguien que ya esté en el grupo
            </Text>

            {/* OTP cells */}
            <View style={styles.otpRow}>
              {code.map((char, i) => (
                <TextInput
                  key={i}
                  ref={ref => { inputRefs.current[i] = ref; }}
                  style={[
                    styles.otpCell,
                    {
                      backgroundColor: char ? `${c.accent}15` : c.separator,
                      color: c.accentStrong,
                      borderColor: joinError ? '#EF4444' : char ? c.accentStrong : c.border,
                    },
                  ]}
                  value={char}
                  onChangeText={text => handleCodeChange(text, i)}
                  onKeyPress={({ nativeEvent }) => handleCodeKeyPress(nativeEvent.key, i)}
                  maxLength={1}
                  autoCapitalize="characters"
                  keyboardType="default"
                  textAlign="center"
                  autoFocus={i === 0}
                  selectTextOnFocus
                />
              ))}
            </View>

            {/* Pegar */}
            <TouchableOpacity onPress={handlePasteCode} style={styles.pasteLink}>
              <Ionicons name="clipboard-outline" size={14} color={c.textSecondary} />
              <Text style={[styles.pasteLinkText, { color: c.textSecondary }]}>Pegar desde portapapeles</Text>
            </TouchableOpacity>

            {/* Error */}
            {joinError && (
              <View style={styles.errorBox}>
                <Ionicons name="warning" size={14} color="#EF4444" />
                <Text style={styles.errorText}>{joinErrorMessages[joinError] ?? 'Error desconocido'}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.buttonPrimary, { backgroundColor: c.accentStrong, opacity: joining ? 0.7 : 1 }]}
              activeOpacity={0.85}
              onPress={handleJoin}
              disabled={joining}
            >
              {joining ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonPrimaryText}>Unirse</Text>}
            </TouchableOpacity>

            <TouchableOpacity onPress={handleCloseJoinModal} disabled={joining}>
              <Text style={[styles.cancelText, { color: joining ? c.border : c.textSecondary }]}>Cancelar</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // ---- Lista de mis grupos ----
  listScroll: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 140 },
  listTitle: { fontSize: 26, fontWeight: '700' },
  listSubtitle: { fontSize: 13, marginTop: 2 },

  groupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  groupIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  groupName: { fontSize: 16, fontWeight: '700', flexShrink: 1 },
  groupMeta: { fontSize: 12 },
  miniBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  miniBadgeText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },

  listActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  actionBtnGhost: { backgroundColor: 'transparent', borderWidth: 1.5 },
  actionBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  cardShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 1,
  },

  // ---- Estado vacío original ----
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  iconWrapper: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2.5,
    borderColor: '#4A90D9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  iconInner: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },
  buttonsContainer: { width: '100%', gap: 12, marginTop: 16 },
  buttonPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
  },
  buttonPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  buttonSecondary: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  buttonSecondaryText: { fontSize: 16, fontWeight: '600' },

  // Modal
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modalSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 12,
    gap: 14,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 4,
  },
  modalIconRow: { alignItems: 'center', marginBottom: -4 },
  modalIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: -6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  cancelText: {
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '500',
    paddingVertical: 4,
  },

  // Join modal
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  otpCell: {
    width: 46,
    height: 58,
    borderRadius: 12,
    borderWidth: 1.5,
    fontSize: 24,
    fontWeight: '700',
  },
  pasteLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 8,
    marginBottom: 8,
  },
  pasteLinkText: { fontSize: 13 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    flex: 1,
  },
});
