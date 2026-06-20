import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useThemeColors } from '@/hooks/use-theme-colors';
import { useUser } from '@/hooks/use-user';
import { useAppStore } from '@/store/useAppStore';
import { supabase } from '@/utils/supabase';
import { MemberAvatar } from '@/components/MemberAvatar';
import { ConfirmModal } from '@/components/ConfirmModal';
import {
  getGroup,
  getGroupMembers,
  updateMemberRole,
  kickMember,
  transferOwnership,
  Group,
  GroupMember,
} from '@/services/groupsService';

type SheetTarget = {
  member: GroupMember;
};

type ConfirmKind = 'promote' | 'demote' | 'kick' | 'transfer';
type Pending = { kind: ConfirmKind; member: GroupMember } | null;

export default function ManageMembersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const c = useThemeColors();
  const user = useUser();

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [sheet, setSheet] = useState<SheetTarget | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const presence = useAppStore((s) => (id ? s.groupPresence[id] : undefined) ?? EMPTY_PRESENCE);

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

  // Realtime: cambios en group_members (rol o membresía) y profiles (apodo/avatar)
  // refrescan la pantalla en vivo.
  useEffect(() => {
    if (!id || members.length === 0) return;
    const memberIds = members.map((m) => m.user_id);
    const channel = supabase
      .channel(`group-manage:${id}`)
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
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `user_id=in.(${memberIds.join(',')})`,
        },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, members.map((m) => m.user_id).join(','), load]);

  const myMembership = members.find((m) => m.user_id === user?.id);
  const myRole = myMembership?.role ?? 'member';
  const iAmOwner = myRole === 'owner';
  const iAmAdmin = myRole === 'admin';

  // Reglas de qué acciones puedo ejecutar sobre cada miembro.
  const actionsFor = (target: GroupMember) => {
    const isSelf = target.user_id === user?.id;
    const isOwner = target.role === 'owner';
    const isAdmin = target.role === 'admin';

    if (isSelf || isOwner) return { canOpen: false } as const;

    if (iAmOwner) {
      return {
        canOpen: true as const,
        canPromote: target.role === 'member',
        canDemote: isAdmin,
        canKick: true,
        canTransfer: true,
      };
    }
    if (iAmAdmin) {
      // Admin no puede tocar a otros admins
      if (isAdmin) return { canOpen: false } as const;
      return {
        canOpen: true as const,
        canPromote: false,
        canDemote: false,
        canKick: true,
        canTransfer: false,
      };
    }
    return { canOpen: false } as const;
  };

  const openSheet = (member: GroupMember) => {
    const a = actionsFor(member);
    if (!a.canOpen) return;
    setSheet({ member });
  };

  const displayName = (m: GroupMember) =>
    m.nickname?.trim() || m.name?.trim() || 'Miembro';

  const handlePromote = (member: GroupMember) => {
    setSheet(null);
    setPending({ kind: 'promote', member });
  };

  const handleDemote = (member: GroupMember) => {
    setSheet(null);
    setPending({ kind: 'demote', member });
  };

  const handleKick = (member: GroupMember) => {
    setSheet(null);
    setPending({ kind: 'kick', member });
  };

  const handleTransfer = (member: GroupMember) => {
    setSheet(null);
    setPending({ kind: 'transfer', member });
  };

  const runPending = async () => {
    if (!pending || !id) return;
    const { kind, member } = pending;
    setActionLoading(true);
    try {
      if (kind === 'promote') await updateMemberRole(id, member.user_id, 'admin');
      else if (kind === 'demote') await updateMemberRole(id, member.user_id, 'member');
      else if (kind === 'kick') await kickMember(id, member.user_id);
      else if (kind === 'transfer') await transferOwnership(id, member.user_id);
      await load();
      setPending(null);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'No se pudo completar la acción.');
    } finally {
      setActionLoading(false);
    }
  };

  // Config visual del modal según la acción pendiente
  const confirmConfig = pending
    ? (() => {
        const n = displayName(pending.member);
        switch (pending.kind) {
          case 'promote':
            return {
              title: 'Promover a Admin',
              description: `${n} va a poder crear actividades y expulsar miembros del grupo.`,
              icon: 'shield-checkmark' as const,
              confirmLabel: 'Promover',
              destructive: false,
            };
          case 'demote':
            return {
              title: 'Quitar privilegios',
              description: `${n} vuelve a ser miembro común y deja de poder crear actividades.`,
              icon: 'shield-outline' as const,
              confirmLabel: 'Quitar privilegios',
              destructive: false,
            };
          case 'kick':
            return {
              title: 'Expulsar del grupo',
              description: `${n} va a salir del grupo. Esta acción no se puede deshacer.`,
              icon: 'person-remove' as const,
              confirmLabel: 'Expulsar',
              destructive: true,
            };
          case 'transfer':
            return {
              title: 'Transferir grupo',
              description: `${n} pasa a ser el dueño del grupo. Vos vas a quedar como Admin y podrás salir o ser expulsado. Esta acción no se puede deshacer sin que el nuevo dueño te la devuelva.`,
              icon: 'swap-horizontal' as const,
              confirmLabel: `Transferir a ${n}`,
              destructive: true,
            };
        }
      })()
    : null;

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
          <Text style={{ color: c.textSecondary }}>Grupo no disponible.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const onlineCount = members.filter((m) => presence[m.user_id]).length;

  // Ordeno: owner primero, después admins, después members (por joined_at del backend).
  const orderedMembers = [
    ...members.filter((m) => m.role === 'owner'),
    ...members.filter((m) => m.role === 'admin'),
    ...members.filter((m) => m.role === 'member'),
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={10}
          style={[styles.iconBtn, { backgroundColor: c.separator }]}
        >
          <Ionicons name="chevron-back" size={20} color={c.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: c.textPrimary }]} numberOfLines={1}>
          Gestionar miembros
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={c.accentStrong}
          />
        }
      >
        {/* Meta row */}
        <View style={styles.metaRow}>
          <View style={styles.metaLeft}>
            <Ionicons name="people" size={14} color={c.accentStrong} />
            <Text style={[styles.metaText, { color: c.textSecondary }]}>
              {members.length} / {group.max_members} miembros
            </Text>
          </View>
          {onlineCount > 0 && (
            <View style={styles.onlinePill}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>
                {onlineCount} {onlineCount === 1 ? 'conectado' : 'conectados'}
              </Text>
            </View>
          )}
        </View>

        {/* Lista */}
        <View style={{ gap: 10, marginTop: 14 }}>
          {orderedMembers.map((m) => {
            const a = actionsFor(m);
            const isSelf = m.user_id === user?.id;
            const isOwnerRow = m.role === 'owner';
            const isAdminRow = m.role === 'admin';
            const p = presence[m.user_id];
            const isStudying = !!p?.is_studying;

            const subline = isOwnerRow
              ? 'Creador del grupo'
              : isStudying
              ? p?.subject_name ?? 'Estudiando'
              : m.category?.trim() || 'Sin sesión activa';

            return (
              <View
                key={m.id}
                style={[
                  styles.memberCard,
                  styles.cardShadow,
                  { backgroundColor: c.surface, opacity: a.canOpen ? 1 : 0.6 },
                ]}
              >
                <MemberAvatar
                  userId={m.user_id}
                  nickname={m.nickname ?? m.name}
                  avatarUrl={m.avatar_url}
                  ring={isStudying}
                  size={42}
                />
                <View style={styles.memberInfo}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.memberName, { color: c.textPrimary }]} numberOfLines={1}>
                      {displayName(m)}
                    </Text>
                    {isOwnerRow && (
                      <View style={[styles.miniBadge, { borderColor: 'rgba(248,193,70,.4)', backgroundColor: 'rgba(248,193,70,.12)' }]}>
                        <Text style={[styles.miniBadgeText, { color: '#F8C146' }]}>OWNER</Text>
                      </View>
                    )}
                    {isAdminRow && (
                      <View style={[styles.miniBadge, { borderColor: `${c.accent}66`, backgroundColor: `${c.accent}1F` }]}>
                        <Text style={[styles.miniBadgeText, { color: c.accentStrong }]}>ADMIN</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.memberSub, { color: c.textSecondary }]} numberOfLines={1}>
                    {subline}
                  </Text>
                </View>
                {a.canOpen ? (
                  <TouchableOpacity
                    onPress={() => openSheet(m)}
                    hitSlop={8}
                    style={[styles.kebabBtn, { backgroundColor: c.separator }]}
                  >
                    <Ionicons name="ellipsis-vertical" size={16} color={c.textPrimary} />
                  </TouchableOpacity>
                ) : (
                  <Ionicons name="lock-closed" size={14} color={c.textSecondary} />
                )}
              </View>
            );
          })}
        </View>

        {/* Hint para admins */}
        {iAmAdmin && (
          <View style={[styles.hintBox, { borderColor: c.border, backgroundColor: c.surface }]}>
            <Ionicons name="information-circle-outline" size={14} color={c.textSecondary} />
            <Text style={[styles.hintText, { color: c.textSecondary }]}>
              Como admin podés expulsar miembros. Solo el owner puede cambiar roles.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Bottom sheet */}
      <Modal
        transparent
        visible={!!sheet}
        animationType="slide"
        onRequestClose={() => !actionLoading && setSheet(null)}
      >
        {sheet && (
          <TouchableOpacity
            style={[styles.sheetOverlay, { backgroundColor: c.modalOverlay }]}
            activeOpacity={1}
            onPress={() => !actionLoading && setSheet(null)}
          >
            <View
              style={[styles.sheet, { backgroundColor: c.modalBg }]}
              onStartShouldSetResponder={() => true}
            >
              <View style={[styles.sheetHandle, { backgroundColor: c.handle }]} />

              {/* Header del sheet con el miembro */}
              <View style={styles.sheetHeader}>
                <MemberAvatar
                  userId={sheet.member.user_id}
                  nickname={sheet.member.nickname ?? sheet.member.name}
                  avatarUrl={sheet.member.avatar_url}
                  ring={!!presence[sheet.member.user_id]?.is_studying}
                  size={42}
                />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={styles.sheetNameRow}>
                    <Text style={[styles.sheetName, { color: c.textPrimary }]} numberOfLines={1}>
                      {displayName(sheet.member)}
                    </Text>
                    {sheet.member.role === 'admin' && (
                      <View style={[styles.miniBadge, { borderColor: `${c.accent}66`, backgroundColor: `${c.accent}1F` }]}>
                        <Text style={[styles.miniBadgeText, { color: c.accentStrong }]}>ADMIN</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.sheetSub, { color: c.textSecondary }]} numberOfLines={1}>
                    {presence[sheet.member.user_id]?.is_studying
                      ? `Estudiando · ${presence[sheet.member.user_id]?.subject_name ?? 'materia'}`
                      : sheet.member.category?.trim() || 'Sin sesión activa'}
                  </Text>
                </View>
              </View>

              {/* Acciones */}
              {(() => {
                const a = actionsFor(sheet.member);
                if (!a.canOpen) return null;
                return (
                  <>
                    {a.canPromote && (
                      <SheetAction
                        c={c}
                        icon="shield-checkmark"
                        label="Promover a Admin"
                        onPress={() => handlePromote(sheet.member)}
                      />
                    )}
                    {a.canDemote && (
                      <SheetAction
                        c={c}
                        icon="shield-outline"
                        label="Quitar privilegios"
                        onPress={() => handleDemote(sheet.member)}
                      />
                    )}
                    {a.canKick && (
                      <SheetAction
                        c={c}
                        icon="person-remove"
                        label="Expulsar del grupo"
                        danger
                        onPress={() => handleKick(sheet.member)}
                      />
                    )}
                    {a.canTransfer && (
                      <SheetAction
                        c={c}
                        icon="swap-horizontal"
                        label="Transferir grupo"
                        danger
                        onPress={() => handleTransfer(sheet.member)}
                      />
                    )}
                  </>
                );
              })()}

              <TouchableOpacity
                onPress={() => !actionLoading && setSheet(null)}
                style={styles.sheetCancel}
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
        )}
      </Modal>

      {/* Confirmación con UI propia, reemplaza Alert.alert nativo */}
      {confirmConfig && (
        <ConfirmModal
          visible={!!pending}
          title={confirmConfig.title}
          description={confirmConfig.description}
          icon={confirmConfig.icon}
          confirmLabel={confirmConfig.confirmLabel}
          destructive={confirmConfig.destructive}
          onConfirm={runPending}
          onCancel={() => !actionLoading && setPending(null)}
        />
      )}
    </SafeAreaView>
  );
}

function SheetAction({
  c,
  icon,
  label,
  danger,
  onPress,
}: {
  c: ReturnType<typeof useThemeColors>;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  danger?: boolean;
  onPress: () => void;
}) {
  const fg = danger ? '#EF4444' : c.textPrimary;
  const iconFg = danger ? '#EF4444' : c.accentStrong;
  const bg = danger ? 'rgba(239,68,68,.07)' : c.separator;
  const iconBg = danger ? 'rgba(239,68,68,.14)' : `${c.accent}26`;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.sheetAction, { backgroundColor: bg, borderColor: danger ? 'rgba(239,68,68,.2)' : 'transparent' }]}
    >
      <View style={[styles.sheetActionIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={17} color={iconFg} />
      </View>
      <Text style={[styles.sheetActionText, { color: fg }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={15} color={danger ? '#EF4444' : c.textSecondary} />
    </TouchableOpacity>
  );
}

const EMPTY_PRESENCE = {};

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 16, fontWeight: '700' },

  scroll: { paddingHorizontal: 18, paddingBottom: 36 },

  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  metaLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  metaText: { fontSize: 12 },

  onlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16,185,129,.12)',
    borderColor: 'rgba(16,185,129,.3)',
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' },
  onlineText: { fontSize: 11, fontWeight: '600', color: '#10B981' },

  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  memberInfo: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  memberName: { fontSize: 15, fontWeight: '700', flexShrink: 1 },
  memberSub: { fontSize: 12, marginTop: 2 },
  miniBadge: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  miniBadgeText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.4 },

  kebabBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cardShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 1,
  },

  hintBox: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
  },
  hintText: { fontSize: 11, flex: 1 },

  // Sheet
  sheetOverlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 36,
    gap: 10,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 2,
    marginBottom: 10,
  },
  sheetNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sheetName: { fontSize: 16, fontWeight: '700', flexShrink: 1 },
  sheetSub: { fontSize: 12, marginTop: 2 },

  sheetAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    borderRadius: 16,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sheetActionIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetActionText: { flex: 1, fontSize: 14, fontWeight: '600' },

  sheetCancel: { alignItems: 'center', paddingVertical: 12, marginTop: 4 },
  sheetCancelText: { fontSize: 14, fontWeight: '500' },

  sheetSpinner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
});
