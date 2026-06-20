import dayjs from 'dayjs';
import { supabase } from '@/utils/supabase';
import { getGroupMembers, GroupMember } from './groupsService';

export type GroupStatsPeriod = 'day' | 'week' | 'month';

export type GroupMemberStat = {
  user_id: string;
  nickname: string | null;
  name: string | null;
  avatar_url: string | null;
  role: 'owner' | 'admin' | 'member';
  total_seconds: number;
  sessions_count: number;
  percentage: number; // 0-100 sobre el total del grupo en el período
};

export type GroupActivityPoint = {
  date: string; // YYYY-MM-DD
  total_seconds: number;
};

export type GroupStats = {
  total_seconds: number;
  total_seconds_prev: number;
  delta_pct: number | null; // null si no hay base para comparar
  members: GroupMemberStat[];
  activity_last_7: GroupActivityPoint[];
  sessions_count: number;
  avg_session_minutes: number;
  streak_days: number; // racha "al menos uno estudió"
  peak_hour_label: string | null;
};

const emptyStats = (): GroupStats => ({
  total_seconds: 0,
  total_seconds_prev: 0,
  delta_pct: null,
  members: [],
  activity_last_7: Array.from({ length: 7 }, (_, i) => ({
    date: dayjs().subtract(6 - i, 'day').format('YYYY-MM-DD'),
    total_seconds: 0,
  })),
  sessions_count: 0,
  avg_session_minutes: 0,
  streak_days: 0,
  peak_hour_label: null,
});

const rangeFor = (period: GroupStatsPeriod) => {
  const now = dayjs();
  let start;
  if (period === 'day') start = now.startOf('day');
  else if (period === 'week') start = now.startOf('week');
  else start = now.startOf('month');
  return { start, end: now };
};

const prevRangeFor = (period: GroupStatsPeriod) => {
  const now = dayjs();
  if (period === 'day') {
    const start = now.startOf('day').subtract(1, 'day');
    return { start, end: now.startOf('day') };
  }
  if (period === 'week') {
    const start = now.startOf('week').subtract(1, 'week');
    return { start, end: now.startOf('week') };
  }
  const start = now.startOf('month').subtract(1, 'month');
  return { start, end: now.startOf('month') };
};

export const getGroupStats = async (
  groupId: string,
  period: GroupStatsPeriod
): Promise<{ stats: GroupStats; members: GroupMember[] }> => {
  const members = await getGroupMembers(groupId);
  const userIds = members.map((m) => m.user_id);
  if (userIds.length === 0) return { stats: emptyStats(), members };

  const { start, end } = rangeFor(period);
  const { start: prevStart, end: prevEnd } = prevRangeFor(period);
  const now = dayjs();

  // 1) Sesiones del período actual (con materia para futura extensibilidad)
  const { data: sessions, error: sErr } = await supabase
    .from('study_sessions')
    .select('user_id, duration, start_time')
    .in('user_id', userIds)
    .gte('start_time', start.toISOString())
    .lt('start_time', end.toISOString())
    .order('start_time', { ascending: true });
  if (sErr) throw sErr;

  // 2) Total del período anterior (solo necesitamos duration para el delta)
  const { data: prev, error: pErr } = await supabase
    .from('study_sessions')
    .select('duration')
    .in('user_id', userIds)
    .gte('start_time', prevStart.toISOString())
    .lt('start_time', prevEnd.toISOString());
  if (pErr) throw pErr;

  const total = (sessions ?? []).reduce((s: number, x: any) => s + (x.duration || 0), 0);
  const totalPrev = (prev ?? []).reduce((s: number, x: any) => s + (x.duration || 0), 0);
  const deltaPct = totalPrev > 0 ? ((total - totalPrev) / totalPrev) * 100 : null;

  // 3) Por miembro
  const byUser = new Map<string, { total: number; count: number }>();
  (sessions ?? []).forEach((x: any) => {
    const e = byUser.get(x.user_id) ?? { total: 0, count: 0 };
    e.total += x.duration || 0;
    e.count += 1;
    byUser.set(x.user_id, e);
  });

  const memberStats: GroupMemberStat[] = members
    .map((m) => {
      const e = byUser.get(m.user_id) ?? { total: 0, count: 0 };
      return {
        user_id: m.user_id,
        nickname: m.nickname,
        name: m.name,
        avatar_url: m.avatar_url,
        role: m.role,
        total_seconds: e.total,
        sessions_count: e.count,
        percentage: total > 0 ? Math.round((e.total / total) * 100) : 0,
      };
    })
    .sort((a, b) => b.total_seconds - a.total_seconds);

  // 4) Últimos 7 días (fijo, independiente del period switcher)
  const days7 = Array.from({ length: 7 }, (_, i) =>
    now.subtract(6 - i, 'day').format('YYYY-MM-DD')
  );

  const week7Start = now.subtract(6, 'day').startOf('day');
  const { data: week7, error: wErr } = await supabase
    .from('study_sessions')
    .select('start_time, duration')
    .in('user_id', userIds)
    .gte('start_time', week7Start.toISOString());
  if (wErr) throw wErr;

  const activityMap = new Map<string, number>();
  (week7 ?? []).forEach((x: any) => {
    const d = dayjs(x.start_time).format('YYYY-MM-DD');
    activityMap.set(d, (activityMap.get(d) ?? 0) + (x.duration || 0));
  });
  const activity = days7.map((d) => ({
    date: d,
    total_seconds: activityMap.get(d) ?? 0,
  }));

  // 5) Sesiones del período actual
  const sessionsCount = (sessions ?? []).length;
  const avgSessionMinutes =
    sessionsCount > 0 ? Math.round(total / sessionsCount / 60) : 0;

  // 6) Racha "al menos uno estudió" — días consecutivos desde HOY hacia atrás
  // donde algún miembro registró al menos una sesión. Mira últimos 60 días.
  const streakStart = now.subtract(60, 'day').startOf('day');
  const { data: streakRows, error: stErr } = await supabase
    .from('study_sessions')
    .select('start_time')
    .in('user_id', userIds)
    .gte('start_time', streakStart.toISOString());
  if (stErr) throw stErr;

  const daysWithStudy = new Set<string>();
  (streakRows ?? []).forEach((x: any) => {
    daysWithStudy.add(dayjs(x.start_time).format('YYYY-MM-DD'));
  });

  let streak = 0;
  let cursor = now;
  // Solo cuenta racha si hoy ya hubo estudio; sino se rompe en cero.
  while (daysWithStudy.has(cursor.format('YYYY-MM-DD'))) {
    streak++;
    cursor = cursor.subtract(1, 'day');
  }

  // 7) Hora pico — ventana de 2 horas con mayor tiempo agregado dentro del período
  const hourBuckets = new Array(24).fill(0);
  (sessions ?? []).forEach((x: any) => {
    const h = dayjs(x.start_time).hour();
    hourBuckets[h] += x.duration || 0;
  });

  let peakStart = 0;
  let peakSum = 0;
  for (let h = 0; h < 23; h++) {
    const sum = hourBuckets[h] + hourBuckets[h + 1];
    if (sum > peakSum) {
      peakSum = sum;
      peakStart = h;
    }
  }
  const peakHourLabel =
    peakSum > 0
      ? `${String(peakStart).padStart(2, '0')}:00 a ${String(peakStart + 2).padStart(2, '0')}:00`
      : null;

  return {
    stats: {
      total_seconds: total,
      total_seconds_prev: totalPrev,
      delta_pct: deltaPct,
      members: memberStats,
      activity_last_7: activity,
      sessions_count: sessionsCount,
      avg_session_minutes: avgSessionMinutes,
      streak_days: streak,
      peak_hour_label: peakHourLabel,
    },
    members,
  };
};
