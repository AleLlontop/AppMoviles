import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Svg, { Path, Defs, LinearGradient, Stop, Circle } from 'react-native-svg';
import dayjs from 'dayjs';

import { useThemeColors } from '@/hooks/use-theme-colors';
import { MemberAvatar } from '@/components/MemberAvatar';
import {
  getGroupStats,
  GroupStats,
  GroupStatsPeriod,
  GroupMemberStat,
} from '@/services/groupStatsService';

type TabKey = 'ranking' | 'activity';

const formatHM = (totalSeconds: number) => {
  const s = Math.max(0, totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${String(m).padStart(2, '0')}m`;
};

const PALETTE = ['#826BF0', '#E47A3B', '#2E9E6B', '#E84A7F', '#3B82F6', '#0EA5A4', '#D9A93B', '#E66B5C'];
const colorFor = (userId: string) => {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
};

export default function GroupStatsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const c = useThemeColors();

  const [period, setPeriod] = useState<GroupStatsPeriod>('week');
  const [tab, setTab] = useState<TabKey>('ranking');
  const [stats, setStats] = useState<GroupStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const { stats } = await getGroupStats(id, period);
      setStats(stats);
    } catch (e) {
      console.warn('GroupStats load error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, period]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  if (loading || !stats) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
        <Header c={c} onBack={() => router.back()} />
        <View style={styles.centered}>
          <ActivityIndicator color={c.accentStrong} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <Header c={c} onBack={() => router.back()} />

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
        {/* Total + delta */}
        <View style={styles.totalRow}>
          <Text style={[styles.total, { color: c.textPrimary }]}>
            {formatHM(stats.total_seconds)}
          </Text>
          {stats.delta_pct !== null && (
            <View
              style={[
                styles.deltaPill,
                stats.delta_pct >= 0 ? styles.deltaPositive : styles.deltaNegative,
              ]}
            >
              <Ionicons
                name={stats.delta_pct >= 0 ? 'arrow-up' : 'arrow-down'}
                size={11}
                color={stats.delta_pct >= 0 ? '#34D399' : '#F87171'}
              />
              <Text
                style={[
                  styles.deltaText,
                  { color: stats.delta_pct >= 0 ? '#34D399' : '#F87171' },
                ]}
              >
                {Math.abs(Math.round(stats.delta_pct))}%
              </Text>
            </View>
          )}
        </View>
        <Text style={[styles.deltaCaption, { color: c.textSecondary }]}>
          {stats.delta_pct === null
            ? 'sin datos previos para comparar'
            : `vs. ${periodLabelPrev(period)}`}
        </Text>

        {/* Period switcher */}
        <View style={[styles.switcher, { backgroundColor: c.separator }]}>
          {(['day', 'week', 'month'] as GroupStatsPeriod[]).map((p) => (
            <TouchableOpacity
              key={p}
              onPress={() => setPeriod(p)}
              style={[
                styles.switcherBtn,
                period === p && { backgroundColor: c.accentStrong },
              ]}
            >
              <Text
                style={[
                  styles.switcherText,
                  { color: period === p ? '#fff' : c.textSecondary },
                ]}
              >
                {p === 'day' ? 'Hoy' : p === 'week' ? 'Semana' : 'Mes'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tabs */}
        <View style={[styles.tabs, { borderColor: c.border }]}>
          <TabBtn
            label="Ranking"
            icon="trophy"
            active={tab === 'ranking'}
            onPress={() => setTab('ranking')}
            c={c}
          />
          <TabBtn
            label="Actividad"
            icon="analytics"
            active={tab === 'activity'}
            onPress={() => setTab('activity')}
            c={c}
          />
        </View>

        {tab === 'ranking' ? (
          <RankingTab stats={stats} c={c} />
        ) : (
          <ActivityTab stats={stats} c={c} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Header({ c, onBack }: { c: ReturnType<typeof useThemeColors>; onBack: () => void }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity
        onPress={onBack}
        hitSlop={10}
        style={[styles.iconBtn, { backgroundColor: c.separator }]}
      >
        <Ionicons name="chevron-back" size={20} color={c.textPrimary} />
      </TouchableOpacity>
      <Text style={[styles.headerTitle, { color: c.textPrimary }]}>Estadísticas</Text>
      <View style={{ width: 36 }} />
    </View>
  );
}

function TabBtn({
  label,
  icon,
  active,
  onPress,
  c,
}: {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  active: boolean;
  onPress: () => void;
  c: ReturnType<typeof useThemeColors>;
}) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.tab} activeOpacity={0.85}>
      <View style={styles.tabContent}>
        <Ionicons
          name={icon}
          size={15}
          color={active ? c.textPrimary : c.textSecondary}
        />
        <Text
          style={[
            styles.tabLabel,
            { color: active ? c.textPrimary : c.textSecondary },
          ]}
        >
          {label}
        </Text>
      </View>
      {active && <View style={[styles.tabUnderline, { backgroundColor: c.accentStrong }]} />}
    </TouchableOpacity>
  );
}

/* ============================ RANKING TAB ============================ */
function RankingTab({
  stats,
  c,
}: {
  stats: GroupStats;
  c: ReturnType<typeof useThemeColors>;
}) {
  if (stats.members.length === 0) {
    return (
      <View style={styles.emptyBox}>
        <Text style={{ color: c.textSecondary, textAlign: 'center' }}>
          Todavía no hay sesiones registradas en este período.
        </Text>
      </View>
    );
  }

  const [first, ...rest] = stats.members;
  const max = stats.members[0]?.total_seconds ?? 1;

  return (
    <View style={{ marginTop: 14 }}>
      {/* 1er lugar destacado */}
      <View
        style={[
          styles.firstCard,
          styles.cardShadow,
          {
            backgroundColor: c.surface,
            borderColor: 'rgba(248,193,70,0.3)',
          },
        ]}
      >
        <View style={{ position: 'relative' }}>
          <MemberAvatar
            userId={first.user_id}
            nickname={first.nickname ?? first.name}
            avatarUrl={first.avatar_url}
            size={44}
          />
          <View style={styles.medal}>
            <Text style={styles.medalText}>1</Text>
          </View>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.firstNameRow}>
            <Text style={[styles.firstName, { color: c.textPrimary }]} numberOfLines={1}>
              {displayName(first)}
            </Text>
            {first.role === 'owner' && (
              <View style={[styles.miniBadge, { borderColor: 'rgba(248,193,70,.4)', backgroundColor: 'rgba(248,193,70,.12)' }]}>
                <Text style={[styles.miniBadgeText, { color: '#F8C146' }]}>OWNER</Text>
              </View>
            )}
            {first.role === 'admin' && (
              <View style={[styles.miniBadge, { borderColor: `${c.accent}66`, backgroundColor: `${c.accent}1F` }]}>
                <Text style={[styles.miniBadgeText, { color: c.accentStrong }]}>ADMIN</Text>
              </View>
            )}
          </View>
          <Text style={[styles.firstSub, { color: c.textSecondary }]}>
            {first.sessions_count} {first.sessions_count === 1 ? 'sesión' : 'sesiones'}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.firstTime, { color: '#F8C146' }]}>{formatHM(first.total_seconds)}</Text>
          <Text style={[styles.firstPct, { color: c.textSecondary }]}>{first.percentage}%</Text>
        </View>
      </View>

      {/* Resto */}
      <View style={{ marginTop: 8, gap: 7 }}>
        {rest.map((m, i) => (
          <View
            key={m.user_id}
            style={[
              styles.rankRow,
              styles.cardShadow,
              { backgroundColor: c.surface, opacity: m.total_seconds === 0 ? 0.65 : 1 },
            ]}
          >
            <Text style={[styles.rankNumber, { color: c.textSecondary }]}>{i + 2}</Text>
            <MemberAvatar
              userId={m.user_id}
              nickname={m.nickname ?? m.name}
              avatarUrl={m.avatar_url}
              size={34}
            />
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={styles.rankNameRow}>
                <Text style={[styles.rankName, { color: c.textPrimary }]} numberOfLines={1}>
                  {displayName(m)}
                </Text>
                {m.role === 'owner' && (
                  <View style={[styles.miniBadge, { borderColor: 'rgba(248,193,70,.4)', backgroundColor: 'rgba(248,193,70,.12)' }]}>
                    <Text style={[styles.miniBadgeText, { color: '#F8C146' }]}>OWNER</Text>
                  </View>
                )}
                {m.role === 'admin' && (
                  <View style={[styles.miniBadge, { borderColor: `${c.accent}66`, backgroundColor: `${c.accent}1F` }]}>
                    <Text style={[styles.miniBadgeText, { color: c.accentStrong }]}>ADMIN</Text>
                  </View>
                )}
              </View>
              <View style={[styles.bar, { backgroundColor: c.separator }]}>
                <View
                  style={[
                    styles.barFill,
                    {
                      width: `${max > 0 ? (m.total_seconds / max) * 100 : 0}%`,
                      backgroundColor: c.accentStrong,
                      opacity: m.total_seconds > 0 ? 0.85 : 0,
                    },
                  ]}
                />
              </View>
            </View>
            <Text style={[styles.rankTime, { color: c.textPrimary }]}>
              {formatHM(m.total_seconds)}
            </Text>
          </View>
        ))}
      </View>

      {/* Contribución */}
      {stats.total_seconds > 0 && (
        <>
          <Text style={[styles.section, { color: c.textSecondary }]}>CONTRIBUCIÓN</Text>
          <View style={[styles.contribCard, styles.cardShadow, { backgroundColor: c.surface }]}>
            <View style={styles.stackBar}>
              {stats.members
                .filter((m) => m.total_seconds > 0)
                .map((m) => (
                  <View
                    key={m.user_id}
                    style={{
                      flex: m.total_seconds,
                      backgroundColor: colorFor(m.user_id),
                    }}
                  />
                ))}
            </View>
            <View style={{ marginTop: 10, gap: 6 }}>
              {stats.members.map((m) => (
                <View key={m.user_id} style={styles.legendRow}>
                  <View style={styles.legendLeft}>
                    <View style={[styles.legendDot, { backgroundColor: colorFor(m.user_id) }]} />
                    <Text style={[styles.legendName, { color: c.textSecondary }]} numberOfLines={1}>
                      {displayName(m)}
                    </Text>
                  </View>
                  <Text style={[styles.legendPct, { color: c.textPrimary }]}>
                    {m.percentage}%
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </>
      )}
    </View>
  );
}

/* ============================ ACTIVITY TAB ============================ */
function ActivityTab({
  stats,
  c,
}: {
  stats: GroupStats;
  c: ReturnType<typeof useThemeColors>;
}) {
  return (
    <View style={{ marginTop: 14, gap: 10 }}>
      {/* KPIs: sesiones + racha */}
      <View style={styles.kpiRow}>
        <View style={[styles.kpiCard, styles.cardShadow, { backgroundColor: c.surface }]}>
          <Text style={[styles.kpiLabel, { color: c.textSecondary }]}>Sesiones</Text>
          <Text style={[styles.kpiValue, { color: c.textPrimary }]}>{stats.sessions_count}</Text>
          <Text style={[styles.kpiSub, { color: c.textSecondary }]}>
            {stats.avg_session_minutes > 0
              ? `Promedio ${stats.avg_session_minutes}min`
              : 'Sin sesiones'}
          </Text>
        </View>

        <View style={[styles.kpiCard, styles.cardShadow, { backgroundColor: c.surface }]}>
          <Text style={[styles.kpiLabel, { color: c.textSecondary }]}>Racha grupal</Text>
          <View style={styles.kpiRowInline}>
            <Ionicons name="flame" size={18} color="#F8C146" />
            <Text style={[styles.kpiValue, { color: c.textPrimary, marginLeft: 4 }]}>
              {stats.streak_days}
            </Text>
            <Text style={[styles.kpiUnit, { color: c.textSecondary }]}>
              {stats.streak_days === 1 ? 'día' : 'días'}
            </Text>
          </View>
          <Text style={[styles.kpiSub, { color: c.textSecondary }]}>
            Al menos uno estudió
          </Text>
        </View>
      </View>

      {/* Chart 7 días */}
      <View style={{ marginTop: 4 }}>
        <View style={styles.sectionRow}>
          <Text style={[styles.section, { color: c.textSecondary, margin: 0 }]}>
            ÚLTIMOS 7 DÍAS
          </Text>
          <Text style={{ fontSize: 10, color: c.textSecondary }}>tiempo total</Text>
        </View>
        <View style={[styles.chartCard, styles.cardShadow, { backgroundColor: c.surface }]}>
          <SevenDaysChart data={stats.activity_last_7} accent={c.accentStrong} accentSoft={c.accent} />
          <View style={styles.chartLabels}>
            {stats.activity_last_7.map((p, i) => {
              const isToday = i === stats.activity_last_7.length - 1;
              const dayLabel = dayjs(p.date).format('dd').charAt(0).toUpperCase();
              return (
                <Text
                  key={p.date}
                  style={[
                    styles.chartLabel,
                    {
                      color: isToday ? c.accentStrong : c.textSecondary,
                      fontWeight: isToday ? '700' : '400',
                    },
                  ]}
                >
                  {isToday ? 'hoy' : dayLabel}
                </Text>
              );
            })}
          </View>
        </View>
      </View>

      {/* Hora pico */}
      {stats.peak_hour_label && (
        <View style={[styles.peakCard, styles.cardShadow, { backgroundColor: c.surface }]}>
          <View style={[styles.peakIcon, { backgroundColor: 'rgba(248,193,70,0.14)' }]}>
            <Ionicons name="sunny" size={18} color="#F8C146" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.peakTitle, { color: c.textPrimary }]}>Hora pico del grupo</Text>
            <Text style={[styles.peakSub, { color: c.textSecondary }]}>
              Suelen estudiar entre las {stats.peak_hour_label}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

function SevenDaysChart({
  data,
  accent,
  accentSoft,
}: {
  data: { date: string; total_seconds: number }[];
  accent: string;
  accentSoft: string;
}) {
  const W = 240;
  const H = 70;
  const max = Math.max(1, ...data.map((d) => d.total_seconds));
  const step = W / (data.length - 1);
  const points = data.map((d, i) => ({
    x: i * step,
    y: H - (d.total_seconds / max) * (H - 8) - 4,
  }));

  const path = points.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`)).join(' ');
  const areaPath = `${path} L${W},${H} L0,${H} Z`;
  const last = points[points.length - 1];

  return (
    <Svg viewBox={`0 0 ${W} ${H}`} width="100%" height={80}>
      <Defs>
        <LinearGradient id="grad7d" x1="0" x2="0" y1="0" y2="1">
          <Stop offset="0%" stopColor={accentSoft} stopOpacity={0.5} />
          <Stop offset="100%" stopColor={accentSoft} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Path d={areaPath} fill="url(#grad7d)" />
      <Path d={path} fill="none" stroke={accent} strokeWidth={1.8} strokeLinejoin="round" />
      <Circle cx={last.x} cy={last.y} r={6} fill={accent} opacity={0.25} />
      <Circle cx={last.x} cy={last.y} r={3} fill={accent} />
    </Svg>
  );
}

/* ============================ Helpers ============================ */
const displayName = (m: GroupMemberStat) =>
  m.nickname?.trim() || m.name?.trim() || 'Miembro';

const periodLabelPrev = (p: GroupStatsPeriod) =>
  p === 'day' ? 'ayer' : p === 'week' ? 'semana anterior' : 'mes anterior';

/* ============================ Styles ============================ */
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
  headerTitle: { fontSize: 16, fontWeight: '700' },

  scroll: { paddingHorizontal: 18, paddingBottom: 36 },

  totalRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 4 },
  total: {
    fontSize: 28,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: -0.5,
  },
  deltaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  deltaPositive: {
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderColor: 'rgba(16,185,129,0.25)',
  },
  deltaNegative: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderColor: 'rgba(239,68,68,0.25)',
  },
  deltaText: { fontSize: 11, fontWeight: '700' },
  deltaCaption: { fontSize: 11, marginTop: 4 },

  switcher: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 3,
    marginTop: 14,
  },
  switcherBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
  },
  switcherText: { fontSize: 12, fontWeight: '600' },

  tabs: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: { paddingTop: 8 },
  tabContent: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingBottom: 10 },
  tabLabel: { fontSize: 13, fontWeight: '600' },
  tabUnderline: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 1.5 },

  emptyBox: { padding: 32, alignItems: 'center' },

  /* Ranking */
  firstCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  medal: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#F8C146',
    alignItems: 'center',
    justifyContent: 'center',
  },
  medalText: { color: '#0B0B0E', fontSize: 10, fontWeight: '800' },
  firstNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  firstName: { fontSize: 15, fontWeight: '700', flexShrink: 1 },
  firstSub: { fontSize: 12, marginTop: 3 },
  firstTime: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  firstPct: { fontSize: 11, marginTop: 1 },

  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 14,
  },
  rankNumber: {
    fontSize: 12,
    width: 16,
    textAlign: 'center',
    fontWeight: '600',
  },
  rankNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rankName: { fontSize: 13, fontWeight: '600', flexShrink: 1 },
  bar: { height: 5, borderRadius: 3, marginTop: 7, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  rankTime: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  miniBadge: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  miniBadgeText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.4 },

  /* Contribución */
  section: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 18,
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  contribCard: { padding: 14, borderRadius: 16 },
  stackBar: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    gap: 2,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  legendLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 },
  legendDot: { width: 6, height: 6, borderRadius: 3 },
  legendName: { fontSize: 12, flex: 1 },
  legendPct: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  /* Activity tab */
  kpiRow: { flexDirection: 'row', gap: 10 },
  kpiCard: {
    flex: 1,
    padding: 14,
    borderRadius: 16,
  },
  kpiLabel: { fontSize: 11, fontWeight: '600' },
  kpiValue: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 6,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: -0.3,
  },
  kpiSub: { fontSize: 11, marginTop: 3 },
  kpiRowInline: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  kpiUnit: { fontSize: 13, marginLeft: 4 },

  chartCard: { padding: 14, borderRadius: 16 },
  chartLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  chartLabel: { fontSize: 10 },

  peakCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
  },
  peakIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  peakTitle: { fontSize: 13, fontWeight: '700' },
  peakSub: { fontSize: 12, marginTop: 2 },

  cardShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 1,
  },
});
