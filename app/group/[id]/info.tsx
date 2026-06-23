import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { useUser } from '@/hooks/use-user';
import { EditNameSheet } from '@/components/EditNameSheet';
import { getGroup, getGroupMembers, updateGroupDescription, Group, GroupMember } from '@/services/groupsService';

export default function GroupInfoScreen() {
  const c = useThemeColors();
  const router = useRouter();
  const user = useUser();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDescVisible, setEditDescVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [g, m] = await Promise.all([getGroup(id), getGroupMembers(id)]);
      setGroup(g);
      setMembers(m);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const myRole = members.find((m) => m.user_id === user?.id)?.role ?? 'member';
  const canEdit = myRole === 'owner' || myRole === 'admin';

  const ownerMember = members.find((m) => m.role === 'owner');
  const ownerDisplay = ownerMember?.nickname?.trim() || ownerMember?.name?.trim() || 'Desconocido';

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const copyCode = async () => {
    if (!group) return;
    await Clipboard.setStringAsync(group.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.centered}>
          <ActivityIndicator color={c.accentStrong} />
        </View>
      </SafeAreaView>
    );
  }

  if (!group) return null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={c.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: c.textPrimary }]}>Info del grupo</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Descripción */}
        <View style={[styles.card, { backgroundColor: c.surface }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardLabel, { color: c.textSecondary }]}>DESCRIPCIÓN</Text>
            {canEdit && (
              <TouchableOpacity onPress={() => setEditDescVisible(true)} hitSlop={8}>
                <Ionicons name="pencil" size={16} color={c.accentStrong} />
              </TouchableOpacity>
            )}
          </View>
          {group.description ? (
            <Text style={[styles.descText, { color: c.textPrimary }]}>{group.description}</Text>
          ) : (
            <Text style={[styles.descEmpty, { color: c.textSecondary }]}>
              {canEdit
                ? 'Agregá una descripción para que los miembros sepan de qué trata el grupo.'
                : 'El grupo no tiene descripción todavía.'}
            </Text>
          )}
          {canEdit && !group.description && (
            <TouchableOpacity
              onPress={() => setEditDescVisible(true)}
              style={[styles.addDescBtn, { borderColor: `${c.accent}66` }]}
            >
              <Ionicons name="add" size={16} color={c.accentStrong} />
              <Text style={[styles.addDescText, { color: c.accentStrong }]}>Agregar descripción</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Metadata */}
        <View style={[styles.card, { backgroundColor: c.surface }]}>
          <Text style={[styles.cardLabel, { color: c.textSecondary }]}>DETALLES</Text>

          <InfoRow icon="calendar-outline" label="Creado el" value={formatDate(group.created_at)} colors={c} />
          <View style={[styles.divider, { backgroundColor: c.border }]} />
          <InfoRow icon="person-outline" label="Owner" value={ownerDisplay} colors={c} />
          <View style={[styles.divider, { backgroundColor: c.border }]} />
          <InfoRow
            icon="people-outline"
            label="Miembros"
            value={`${members.length} de ${group.max_members}`}
            colors={c}
          />
        </View>

        {/* Código de invitación */}
        <View style={[styles.card, { backgroundColor: c.surface }]}>
          <Text style={[styles.cardLabel, { color: c.textSecondary }]}>CÓDIGO DE INVITACIÓN</Text>
          <View style={styles.codeRow}>
            <View style={styles.codeLeft}>
              <Ionicons name="key-outline" size={18} color={c.accentStrong} />
              <Text style={[styles.codeText, { color: c.textPrimary }]}>{group.invite_code}</Text>
            </View>
            <TouchableOpacity onPress={copyCode} style={[styles.shareBtn, { backgroundColor: copied ? '#D1FAE5' : `${c.accent}20` }]}>
              <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={15} color={copied ? '#10B981' : c.accentStrong} />
              <Text style={[styles.shareBtnText, { color: copied ? '#10B981' : c.accentStrong }]}>
                {copied ? 'Copiado' : 'Copiar'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

      </ScrollView>

      <EditNameSheet
        visible={editDescVisible}
        title="Descripción del grupo"
        description={canEdit && myRole === 'admin'
          ? 'Visible para todos los miembros. Podés editarla vos o el owner.'
          : 'Visible para todos los miembros del grupo.'}
        icon="document-text-outline"
        initialValue={group.description ?? ''}
        placeholder="Ej: Grupo para rendir Análisis II en julio. Compartimos resúmenes y fechas de práctica."
        minLength={0}
        maxLength={300}
        onClose={() => setEditDescVisible(false)}
        onSave={async (text) => {
          if (!group) return;
          await updateGroupDescription(group.id, text);
          await load();
        }}
      />
    </SafeAreaView>
  );
}

function InfoRow({
  icon,
  label,
  value,
  colors,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
  colors: ReturnType<typeof useThemeColors>;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={[styles.infoIcon, { backgroundColor: `${colors.accent}20` }]}>
        <Ionicons name={icon} size={16} color={colors.accentStrong} />
      </View>
      <View style={styles.infoTexts}>
        <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{label}</Text>
        <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 20, paddingBottom: 60, paddingTop: 4, gap: 16 },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700' },

  card: {
    borderRadius: 20,
    padding: 18,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 1,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },

  descText: { fontSize: 15, lineHeight: 22 },
  descEmpty: { fontSize: 14, fontStyle: 'italic', lineHeight: 20 },
  addDescBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
  },
  addDescText: { fontSize: 13, fontWeight: '600' },

  divider: { height: 1, opacity: 0.4 },

  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTexts: { flex: 1, gap: 1 },
  infoLabel: { fontSize: 11, fontWeight: '600' },
  infoValue: { fontSize: 15, fontWeight: '500' },

  codeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  codeLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  codeText: { fontSize: 18, fontWeight: '700', letterSpacing: 3 },
  shareBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  shareBtnText: { fontSize: 13, fontWeight: '600' },
});
