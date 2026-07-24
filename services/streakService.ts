import dayjs from 'dayjs';
import { supabase } from '@/utils/supabase';

export type StreakDay = {
  date: string;
  active: boolean;
  sessionCount: number;
  totalMinutes: number;
};

export type StreakData = {
  currentStreak: number;
  bestStreak: number;
  totalActiveDays: number;
  days: StreakDay[];
  monthLabel: string;
};

export async function getStreakData(month: dayjs.Dayjs): Promise<StreakData> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');

  const monthStart = month.startOf('month');
  const monthEnd = month.endOf('month');

  const lookback = dayjs().subtract(90, 'day').startOf('day');
  const fetchStart = lookback.isBefore(monthStart) ? lookback : monthStart;

  const { data: sessions, error } = await supabase
    .from('study_sessions')
    .select('start_time, duration')
    .eq('user_id', user.id)
    .gte('start_time', fetchStart.toISOString())
    .lte('start_time', monthEnd.toISOString())
    .order('start_time', { ascending: true });

  if (error) throw error;

  const dayMap = new Map<string, { count: number; minutes: number }>();
  (sessions ?? []).forEach((s: any) => {
    const d = dayjs(s.start_time).format('YYYY-MM-DD');
    const prev = dayMap.get(d) ?? { count: 0, minutes: 0 };
    dayMap.set(d, {
      count: prev.count + 1,
      minutes: prev.minutes + Math.round((s.duration ?? 0) / 60),
    });
  });

  const days: StreakDay[] = [];
  let cursor = monthStart;
  while (cursor.isBefore(monthEnd) || cursor.isSame(monthEnd, 'day')) {
    const dateStr = cursor.format('YYYY-MM-DD');
    const info = dayMap.get(dateStr);
    days.push({
      date: dateStr,
      active: !!info,
      sessionCount: info?.count ?? 0,
      totalMinutes: info?.minutes ?? 0,
    });
    cursor = cursor.add(1, 'day');
  }

  const today = dayjs();
  let currentStreak = 0;
  let check = today;
  while (dayMap.has(check.format('YYYY-MM-DD'))) {
    currentStreak++;
    check = check.subtract(1, 'day');
  }

  let bestStreak = 0;
  let tempStreak = 0;
  const allDates = Array.from(dayMap.keys()).sort();
  for (let i = 0; i < allDates.length; i++) {
    if (i === 0 || dayjs(allDates[i]).diff(dayjs(allDates[i - 1]), 'day') === 1) {
      tempStreak++;
    } else {
      tempStreak = 1;
    }
    bestStreak = Math.max(bestStreak, tempStreak);
  }

  const totalActiveDays = days.filter(d => d.active).length;

  return {
    currentStreak,
    bestStreak,
    totalActiveDays,
    days,
    monthLabel: monthStart.locale('es').format('MMMM YYYY'),
  };
}

export async function markTodayActive(): Promise<void> {
  // No-op: las sesiones ya se guardan en study_sessions al finalizar.
  // La racha se calcula dinámicamente desde esos registros.
}
