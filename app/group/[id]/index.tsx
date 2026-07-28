import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Share,
  Modal,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// IMPORTANTE: Agregamos "Stack" a la importación
import { useLocalSearchParams, useRouter, useFocusEffect, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useThemeColors } from '@/hooks/use-theme-colors';
import { useUser } from '@/hooks/use-user';
import { MemberAvatar } from '@/components/MemberAvatar';
import { EditNameSheet } from '@/components/EditNameSheet';
import { ConfirmModal } from '@/components/ConfirmModal';
import { suspendFocusGuard, resumeFocusGuard } from '@/utils/focusGuard';
import { useGroupPresence } from '@/hooks/use-group-presence';
import { useAppStore } from '@/store/useAppStore';
import { supabase } from '@/utils/supabase';
import {
  getGroup,
  getGroupMembers,
  leaveGroup,
  deleteGroup,
  updateGroupName,
  Group,
  GroupMember,
} from '@/services/groupsService';

export default function GroupDetailScreen() {
  const c = useThemeColors();
  const router = useRouter();
  const user = useUser();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Bottom sheet de opciones (kebab ⋮)
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [editNameVisible, setEditNameVisible] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<'leave' | 'delete' | null>(null);

  // El tracking de mi presencia lo hace useGlobalPresence (en _layout.tsx).
  // Acá solo escucho el estado de los demás miembros del grupo.
  const presence = useGroupPresence({ groupId: id ?? null });

  // Re-render cada 1s para refrescar los timers de otros usuarios.
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const hasOthersStudying = Object.values(presence).some(
      (p) => p.is_studying && p.user_id !== user?.id
    );
    if (!hasOthersStudying) return;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [presence, user?.id]);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [g, m] = await Promise.all([getGroup(id), getGroupMembers(id)]);
      setGroup(g);
      setMembers(m);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'No se pudo cargar el grupo.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Re-cargo al volver al detalle (e.g. después de editar el nombre).
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Memoizar el string de IDs para que el useEffect del canal no se dispare de más
  const memberIdsString = useMemo(() => members.map((m) => m.user_id).sort().join(','), [members]);

  // Realtime sobre profiles (apodo / avatar / categoría) y group_members
  // (rol, entradas, salidas). Cualquier cambio dispara recarga.
  useEffect(() => {
    if (!id || !memberIdsString) return;

    const channel = supabase
      .channel(`group-detail:${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `user_id=in.(${memberIdsString})`,
        },
        () => load()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'group_members',
          filter: `group_id=eq.${id}`,
        },
        () => load()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, memberIdsString, load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const isOwner = !!user && !!group && group.created_by === user.id;
  const myMembership = members.find((m) => m.user_id === user?.id);
  const myRole = myMembership?.role ?? 'member';

  const shareCode = async () => {
    if (!group) return;
    suspendFocusGuard();
    try {
      await Share.share({
        message: `Te invito a mi grupo de estudio "${group.name}". Código: ${group.invite_code}`,
      });
    } catch {
      // cancelado
    } finally {
      // Pequeño margen para que el AppState 'active' que llega después del
      // share termine de procesarse antes de volver a habilitar el guard.
      setTimeout(resumeFocusGuard, 500);
    }
  };

  const confirmLeave = () => {
    setOptionsVisible(false);
    setPendingConfirm('leave');
  };

  const confirmDelete = () => {
    setOptionsVisible(false);
    setPendingConfirm('delete');
  };

  const runPendingConfirm = async () => {
    if (!pendingConfirm || !group) return;
    setActionLoading(true);
    try {
      if (pendingConfirm === 'leave') {
        if (!user?.id) return;
        await leaveGroup(group.id, user.id);
      } else {
        await deleteGroup(group.id);
      }
      useAppStore.getState().bumpPresence();
      setPendingConfirm(null);
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'No se pudo completar la acción.');
    } finally {
      setActionLoading(false);
    }
  };

  const displayName = (m: GroupMember) =>
    m.nickname?.trim() || m.name?.trim() || 'Miembro';

  const formatHMS = (totalSeconds: number) => {
    const s = Math.max(0, totalSeconds);
    const h = Math.floor(s / 3600).toString().padStart(2, '0');
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
    const ss = (s % 60).toString().padStart(2, '0');
    return `${h}:${m}:${ss}`;
  };

  // Tick existe para forzar re-render cada segundo (timer en vivo de otros usuarios).
  void tick;

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
        <View style={styles.centered}>
          <ActivityIndicator color={c.accentStrong} />
        </View>
      </SafeAreaView>
    );
  }

  if (!group) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
        <View style={styles.centered}>
          <Text style={{ color: c.textSecondary }}>Grupo no encontrado.</Text>
          <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 12 }}>
            <Text style={{ color: c.accentStrong, fontWeight: '600' }}>Volver</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <>
      {/* OCULTAMOS EL ENCABEZADO DE EXPO ROUTER */}
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={[styles.container, { backgroundColor: c.background }]} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.accentStrong} />}
          showsVerticalScrollIndicator={false}
        >
          {/* Header Personalizado */}
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={22} color={c.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setOptionsVisible(true)}
              hitSlop={10}
              style={[styles.kebabBtn, { backgroundColor: c.separator }]}
            >
              <Ionicons name="ellipsis-vertical" size={18} color={c.textPrimary} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.title, { color: c.textPrimary }]}>{group.name}</Text>

          <View style={styles.chipsRow}>
            <View style={[styles.roleChip, { backgroundColor: `${c.accent}2E` }]}>
              <Ionicons
                name={isOwner ? 'star' : myRole === 'admin' ? 'shield-checkmark' : 'person'}
                size={11}
                color={c.accentStrong}
              />
              <Text style={[styles.roleChipText, { color: c.accentStrong }]}>
                {isOwner ? 'Owner' : myRole === 'admin' ? 'Admin' : 'Miembro'}
              </Text>
            </View>
            <Text style={[styles.membersCount, { color: c.textSecondary }]}>
              {members.length} / {group.max_members} miembros
            </Text>
          </View>

          {/* Invite code */}
          <View style={[styles.codeCard, { backgroundColor: c.surface, borderColor: `${c.accent}66` }]}>
            <View style={styles.codeLeft}>
              <Ionicons name="key" size={17} color={c.accentStrong} />
              <Text style={[styles.codeText, { color: c.textPrimary }]}>{group.invite_code}</Text>
            </View>
            <TouchableOpacity onPress={shareCode} style={styles.codeShare} hitSlop={8}>
              <Ionicons name="share-social" size={15} color={c.accentStrong} />
              <Text style={[styles.codeShareText, { color: c.accentStrong }]}>Compartir</Text>
            </TouchableOpacity>
          </View>

          {/* Lista de miembros, particionada por presencia en vivo */}
          {(() => {
            const studyingMembers = members.filter((m) => presence[m.user_id]?.is_studying);
            const onlineNotStudyingMembers = members.filter(
              (m) => presence[m.user_id] && !presence[m.user_id]?.is_studying
            );
            const offlineMembers = members.filter((m) => !presence[m.user_id]);

            const renderMember = (m: GroupMember, status: 'studying' | 'online' | 'offline') => {
              const isOwnerRow = m.role === 'owner';
              const isAdmin = m.role === 'admin';
              const p = presence[m.user_id];

              // Línea 2: subLine según el estado
              let subLine: string;
              if (status === 'studying') {
                subLine = p?.subject_name?.trim() || 'Estudiando';
              } else if (status === 'online') {
                subLine = m.category?.trim() ? `En línea • ${m.category.trim()}` : 'En línea';
              } else {
                subLine = m.category?.trim() || 'Desconectado';
              }

              // Timer en verde: si está estudiando y soy yo, uso el del store; si no, lo derivo de started_at.
              let timerText: string | null = null;
              if (status === 'studying') {
                if (m.user_id === user?.id) {
                  timerText = formatHMS(useAppStore.getState().timerSeconds);
                } else if (p?.started_at) {
                  const elapsed = Math.max(
                    0,
                    Math.floor((Date.now() - new Date(p.started_at).getTime()) / 1000)
                  );
                  timerText = formatHMS(elapsed);
                }
              }

              // Opacidad y si lleva aro verde
              const cardOpacity = status === 'offline' ? 0.5 : 1.0;
              const studying = status === 'studying';

              return (
                <View
                  key={m.id}
                  style={[
                    styles.memberCard,
                    styles.cardShadow,
                    { backgroundColor: c.surface, opacity: cardOpacity },
                  ]}
                >
                  <MemberAvatar
                    userId={m.user_id}
                    nickname={m.nickname ?? m.name}
                    avatarUrl={m.avatar_url}
                    ring={studying}
                    size={44}
                  />
                  <View style={styles.memberInfo}>
                    <View style={styles.nameRow}>
                      <Text style={[styles.memberName, { color: c.textPrimary }]} numberOfLines={1}>
                        {displayName(m)}
                      </Text>
                      {(isOwnerRow || isAdmin) && (
                        <View style={[styles.miniBadge, { borderColor: `${c.accent}99` }]}>
                          <Text style={[styles.miniBadgeText, { color: c.accentStrong }]}>
                            {isOwnerRow ? 'OWNER' : 'ADMIN'}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.memberSub, { color: c.textSecondary }]} numberOfLines={1}>
                      {subLine}
                    </Text>
                  </View>
                  {timerText && (
                    <Text style={styles.timer} numberOfLines={1}>
                      {timerText}
                    </Text>
                  )}
                </View>
              );
            };

            return (
              <>
                {/* Banner de "en vivo" */}
                <View style={[styles.liveBanner, { backgroundColor: '#D1FAE5' }]}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>
                    {studyingMembers.length} estudiando ahora · actualización en tiempo real
                  </Text>
                </View>

                {studyingMembers.length > 0 && (
                  <>
                    <Text style={[styles.section, { color: c.textSecondary }]}>ESTUDIANDO AHORA</Text>
                    <View style={{ gap: 10 }}>
                      {studyingMembers.map((m) => renderMember(m, 'studying'))}
                    </View>
                  </>
                )}

                {onlineNotStudyingMembers.length > 0 && (
                  <>
                    <Text style={[styles.section, { color: c.textSecondary }]}>CONECTADOS</Text>
                    <View style={{ gap: 10 }}>
                      {onlineNotStudyingMembers.map((m) => renderMember(m, 'online'))}
                    </View>
                  </>
                )}

                {offlineMembers.length > 0 && (
                  <>
                    <Text style={[styles.section, { color: c.textSecondary }]}>DESCONECTADOS</Text>
                    <View style={{ gap: 10 }}>
                      {offlineMembers.map((m) => renderMember(m, 'offline'))}
                    </View>
                  </>
                )}
              </>
            );
          })()}

          {/* Section: del grupo */}
          <Text style={[styles.section, { color: c.textSecondary }]}>DEL GRUPO</Text>

          <View style={{ gap: 10 }}>
            {/* RUTAS ARREGLADAS (Usando comillas invertidas) */}
            <NavRow
              colors={c}
              icon="chatbubbles"
              label="Chat de grupo"
              onPress={() => router.push(`/group/${group.id}/chat`)}
            />
            <NavRow
              colors={c}
              icon="list"
              label="Actividades"
              onPress={() => router.push(`/group/${group.id}/activities`)}
            />
            <NavRow
              colors={c}
              icon="stats-chart"
              label="Estadísticas del grupo"
              onPress={() => router.push(`/group/${group.id}/stats`)}
            />
            {(isOwner || myRole === 'admin') && (
              <NavRow
                colors={c}
                icon="people"
                label="Gestionar miembros"
                onPress={() => router.push(`/group/${group.id}/manage`)}
              />
            )}
            <NavRow
              colors={c}
              icon="information-circle"
              label="Info del grupo"
              onPress={() => router.push(`/group/${group.id}/info`)}
            />
          </View>
        </ScrollView>

        {/* Bottom sheet de opciones (kebab ⋮) */}
        <Modal
          transparent
          visible={optionsVisible}
          animationType="slide"
          onRequestClose={() => !actionLoading && setOptionsVisible(false)}
        >
          <TouchableOpacity
            style={[styles.sheetOverlay, { backgroundColor: c.modalOverlay }]}
            activeOpacity={1}
            onPress={() => !actionLoading && setOptionsVisible(false)}
          >
            <View style={[styles.sheet, { backgroundColor: c.modalBg }]}>
              <View style={[styles.sheetHandle, { backgroundColor: c.handle }]} />

              <View style={styles.sheetHeader}>
                <View style={[styles.sheetDot, { backgroundColor: c.accentStrong }]} />
                <View>
                  <Text style={[styles.sheetTitle, { color: c.textPrimary }]} numberOfLines={1}>
                    {group?.name}
                  </Text>
                  <Text style={[styles.sheetSub, { color: c.textSecondary }]}>¿Qué deseas hacer?</Text>
                </View>
              </View>

              <SheetBtn
                colors={c}
                icon="share-social"
                label="Compartir código"
                onPress={() => {
                  setOptionsVisible(false);
                  shareCode();
                }}
              />

              {isOwner && (
                <SheetBtn
                  colors={c}
                  icon="pencil"
                  label="Editar grupo"
                  trailing="Owner"
                  onPress={() => {
                    setOptionsVisible(false);
                    // pequeño delay para que las animaciones de los dos sheets no se peleen
                    setTimeout(() => setEditNameVisible(true), 250);
                  }}
                />
              )}

              {!isOwner && (
                <SheetBtn
                  colors={c}
                  icon="log-out-outline"
                  label="Salir del grupo"
                  onPress={confirmLeave}
                />
              )}

              {isOwner && (
                <SheetBtn
                  colors={c}
                  icon="trash-outline"
                  label="Eliminar grupo"
                  danger
                  onPress={confirmDelete}
                />
              )}

              <TouchableOpacity
                style={styles.sheetCancel}
                onPress={() => !actionLoading && setOptionsVisible(false)}
                disabled={actionLoading}
              >
                <Text style={[styles.sheetCancelText, { color: c.textSecondary }]}>Cancelar</Text>
              </TouchableOpacity>

              {actionLoading && (
                <View style={styles.sheetSpinner} pointerEvents="none">
                  <ActivityIndicator color={c.accentStrong} />
                </View>
              )}
            </View>
          </TouchableOpacity>
        </Modal>

        <ConfirmModal
          visible={pendingConfirm === 'leave'}
          title="Salir del grupo"
          description={`Vas a dejar "${group?.name}". Si querés volver vas a tener que pedir el código de invitación de nuevo.`}
          icon="log-out-outline"
          confirmLabel="Salir"
          destructive
          onConfirm={runPendingConfirm}
          onCancel={() => !actionLoading && setPendingConfirm(null)}
        />

        <ConfirmModal
          visible={pendingConfirm === 'delete'}
          title="Eliminar grupo"
          description={`"${group?.name}" se elimina para todos los miembros. También se borran las actividades del grupo. Esta acción no se puede deshacer.`}
          icon="trash-outline"
          confirmLabel="Eliminar grupo"
          destructive
          onConfirm={runPendingConfirm}
          onCancel={() => !actionLoading && setPendingConfirm(null)}
        />

        <EditNameSheet
          visible={editNameVisible}
          title="Editar grupo"
          description="Cambiá el nombre del grupo. Lo van a ver todos los miembros."
          icon="pencil"
          initialValue={group?.name ?? ''}
          placeholder="Ej: Compas de facultad"
          minLength={3}
          maxLength={50}
          onClose={() => setEditNameVisible(false)}
          onSave={async (newName) => {
            if (!group) return;
            await updateGroupName(group.id, newName);
            await load();
          }}
        />
      </SafeAreaView>
    </>
  );
}

function SheetBtn({
  colors,
  icon,
  label,
  trailing,
  danger,
  onPress,
}: {
  colors: ReturnType<typeof useThemeColors>;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  trailing?: string;
  danger?: boolean;
  onPress: () => void;
}) {
  const fg = danger ? '#EF4444' : colors.textPrimary;
  const iconFg = danger ? '#EF4444' : colors.accentStrong;
  const bg = danger ? '#FEF2F2' : colors.separator;
  const iconBg = danger ? '#FEE2E2' : `${colors.accent}26`;
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.sheetBtn, { backgroundColor: bg }]}
      activeOpacity={0.85}
    >
      <View style={[styles.sheetBtnIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={18} color={iconFg} />
      </View>
      <Text style={[styles.sheetBtnText, { color: fg }]}>{label}</Text>
      {trailing && (
        <View style={[styles.sheetTrailing, { backgroundColor: `${colors.accent}2E` }]}>
          <Text style={[styles.sheetTrailingText, { color: colors.accentStrong }]}>{trailing}</Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={16} color={danger ? '#EF4444' : colors.textSecondary} />
    </TouchableOpacity>
  );
}

function NavRow({
  colors,
  icon,
  label,
  ownerOnly,
  onPress,
}: {
  colors: ReturnType<typeof useThemeColors>;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  ownerOnly?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.navRow, styles.cardShadow, { backgroundColor: colors.surface }]}
    >
      <View style={[styles.navIcon, { backgroundColor: `${colors.accent}26` }]}>
        <Ionicons name={icon} size={18} color={colors.accentStrong} />
      </View>
      <Text style={[styles.navLabel, { color: colors.textPrimary }]}>{label}</Text>
      <View style={{ flex: 1 }} />
      {ownerOnly && (
        <View style={[styles.ownerChip, { backgroundColor: `${colors.accent}2E` }]}>
          <Text style={[styles.ownerChipText, { color: colors.accentStrong }]}>Owner</Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 20, paddingBottom: 120, paddingTop: 4 },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  backBtn: { padding: 4 },
  kebabBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 3,
  },

  title: { fontSize: 24, fontWeight: '700', marginTop: 4 },

  chipsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  roleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  roleChipText: { fontSize: 11, fontWeight: '700' },
  membersCount: { fontSize: 13 },

  codeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 16,
  },
  codeLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  codeText: { fontSize: 16, fontWeight: '700', letterSpacing: 3 },
  codeShare: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  codeShareText: { fontSize: 12, fontWeight: '700' },

  section: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginTop: 22, marginBottom: 10, marginLeft: 4 },

  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  memberInfo: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  memberName: { fontSize: 15, fontWeight: '700' },
  memberSub: { fontSize: 12 },
  miniBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  miniBadgeText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },

  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  navIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLabel: { fontSize: 14, fontWeight: '600' },
  ownerChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginRight: 8 },
  ownerChipText: { fontSize: 10, fontWeight: '700' },

  cardShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 1,
  },

  // ---- Presencia en vivo ----
  liveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginTop: 16,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  liveText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#065F46',
    flex: 1,
  },
  timer: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '700',
    fontSize: 15,
    color: '#10B981',
  },

  // ---- Bottom sheet de opciones ----
  sheetOverlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 10,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  sheetDot: { width: 12, height: 12, borderRadius: 6 },
  sheetTitle: { fontSize: 17, fontWeight: '700' },
  sheetSub: { fontSize: 13, marginTop: 1 },
  sheetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 18,
    padding: 16,
  },
  sheetBtnIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetBtnText: { flex: 1, fontSize: 15, fontWeight: '600' },
  sheetTrailing: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginRight: 6 },
  sheetTrailingText: { fontSize: 10, fontWeight: '700' },
  sheetCancel: { alignItems: 'center', paddingVertical: 12, marginTop: 2 },
  sheetCancelText: { fontSize: 15, fontWeight: '500' },
  sheetSpinner: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
});