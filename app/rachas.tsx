import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import 'dayjs/locale/es';

import { useThemeColors } from '@/hooks/use-theme-colors';
import { getStreakData, StreakData, StreakDay } from '@/services/streakService';

const CELL_SIZE = Math.floor((Dimensions.get('window').width - 64) / 7);
const WEEKDAYS = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sáb', 'Dom'];

function StreakHeader({ streak, best, c }: { streak: number; best: number; c: any }) {
  return (
    <View style={[styles.streakCard, { backgroundColor: c.surface }]}>
      <View style={styles.streakMain}>
        <Ionicons name="flame" size={40} color="#FF6B35" />
        <View style={{ marginLeft: 12 }}>
          <Text style={[styles.streakNumber, { color: c.textPrimary }]}>{streak}</Text>
          <Text style={[styles.streakLabel, { color: c.textSecondary }]}>
            {streak === 1 ? 'día consecutivo' : 'días consecutivos'}
          </Text>
        </View>
      </View>
      <View style={[styles.bestStreak, { backgroundColor: c.background }]}>
        <Ionicons name="trophy" size={16} color={c.accent} />
        <Text style={[styles.bestStreakText, { color: c.textSecondary }]}>
          Mejor racha: <Text style={{ color: c.accent, fontWeight: '700' }}>{best} días</Text>
        </Text>
      </View>
    </View>
  );
}

function CalendarGrid({
  days, month, c, today,
}: {
  days: StreakDay[]; month: dayjs.Dayjs; c: any; today: string;
}) {
  const firstDay = month.startOf('month');
  let startOffset = firstDay.day() - 1;
  if (startOffset < 0) startOffset = 6;

  const blanks = Array.from({ length: startOffset }, (_, i) => (
    <View key={`blank-${i}`} style={styles.calCell} />
  ));

  return (
    <View style={[styles.calendarCard, { backgroundColor: c.surface }]}>
      <View style={styles.weekdayRow}>
        {WEEKDAYS.map(d => (
          <View key={d} style={styles.calCell}>
            <Text style={[styles.weekdayText, { color: c.textSecondary }]}>{d}</Text>
          </View>
        ))}
      </View>
      <View style={styles.daysGrid}>
        {blanks}
        {days.map(day => {
          const isToday = day.date === today;
          const isFuture = dayjs(day.date).isAfter(dayjs(), 'day');
          return (
            <View key={day.date} style={styles.calCell}>
              <View
                style={[
                  styles.dayCircle,
                  day.active && styles.dayActive,
                  isToday && styles.dayToday,
                  isFuture && { opacity: 0.3 },
                ]}
              >
                <Text
                  style={[
                    styles.dayText,
                    { color: day.active ? '#FFF' : c.textPrimary },
                    isFuture && { color: c.textSecondary },
                  ]}
                >
                  {dayjs(day.date).date()}
                </Text>
              </View>
              {day.active && (
                <Text style={styles.dayMinutes}>
                  {day.totalMinutes}m
                </Text>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

function StatsRow({ activeDays, totalDays, c }: { activeDays: number; totalDays: number; c: any }) {
  const pct = totalDays > 0 ? Math.round((activeDays / totalDays) * 100) : 0;
  return (
    <View style={[styles.statsCard, { backgroundColor: c.surface }]}>
      <Text style={[styles.statsTitle, { color: c.textPrimary }]}>Resumen del mes</Text>
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: c.accent }]}>{activeDays}</Text>
          <Text style={[styles.statLabel, { color: c.textSecondary }]}>Días activos</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: c.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: c.accent }]}>{pct}%</Text>
          <Text style={[styles.statLabel, { color: c.textSecondary }]}>Constancia</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: c.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: c.accent }]}>{totalDays - activeDays}</Text>
          <Text style={[styles.statLabel, { color: c.textSecondary }]}>Días sin estudio</Text>
        </View>
      </View>
      <View style={styles.progressBarBg}>
        <View style={[styles.progressBarFill, { width: `${pct}%` }]} />
      </View>
    </View>
  );
}

export default function RachasScreen() {
  const c = useThemeColors();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<StreakData | null>(null);
  const [currentMonth, setCurrentMonth] = useState(dayjs());

  const today = dayjs().format('YYYY-MM-DD');

  const fetchData = useCallback(async (month: dayjs.Dayjs) => {
    try {
      setLoading(true);
      setError(null);
      const result = await getStreakData(month);
      setData(result);
    } catch (err: any) {
      setError(err.message || 'Error al cargar rachas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(currentMonth);
  }, [currentMonth, fetchData]);

  const goMonth = (dir: -1 | 1) => {
    const next = currentMonth.add(dir, 'month');
    if (next.isAfter(dayjs(), 'month')) return;
    setCurrentMonth(next);
  };

  if (loading && !data) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={c.accent} />
      </SafeAreaView>
    );
  }

  if (error || !data) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.background, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}>
        <Ionicons name="cloud-offline-outline" size={48} color={c.textSecondary} />
        <Text style={{ color: c.textSecondary, marginTop: 12, fontSize: 14, textAlign: 'center' }}>
          {error || 'No se pudieron cargar las rachas'}
        </Text>
        <TouchableOpacity
          onPress={() => fetchData(currentMonth)}
          style={[styles.retryBtn, { backgroundColor: c.accent }]}
        >
          <Text style={{ color: '#FFF', fontWeight: '600' }}>Reintentar</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const pastMonth = data.days.filter(d => !dayjs(d.date).isAfter(dayjs(), 'day'));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={c.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: c.textPrimary }]}>Rachas</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}>
        <StreakHeader streak={data.currentStreak} best={data.bestStreak} c={c} />

        {/* Month navigation */}
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={() => goMonth(-1)} style={styles.monthArrow}>
            <Ionicons name="chevron-back" size={20} color={c.textSecondary} />
          </TouchableOpacity>
          <Text style={[styles.monthLabel, { color: c.textPrimary }]}>
            {data.monthLabel.charAt(0).toUpperCase() + data.monthLabel.slice(1)}
          </Text>
          <TouchableOpacity
            onPress={() => goMonth(1)}
            style={styles.monthArrow}
            disabled={currentMonth.isSame(dayjs(), 'month')}
          >
            <Ionicons
              name="chevron-forward"
              size={20}
              color={currentMonth.isSame(dayjs(), 'month') ? c.border : c.textSecondary}
            />
          </TouchableOpacity>
        </View>

        <CalendarGrid days={data.days} month={currentMonth} c={c} today={today} />

        {/* Legend */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#A594F9' }]} />
            <Text style={[styles.legendText, { color: c.textSecondary }]}>Día con estudio</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }]} />
            <Text style={[styles.legendText, { color: c.textSecondary }]}>Sin actividad</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { borderWidth: 2, borderColor: '#826BF0', backgroundColor: 'transparent' }]} />
            <Text style={[styles.legendText, { color: c.textSecondary }]}>Hoy</Text>
          </View>
        </View>

        <StatsRow activeDays={data.totalActiveDays} totalDays={pastMonth.length} c={c} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: { width: 32, height: 32, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },

  streakCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  streakMain: { flexDirection: 'row', alignItems: 'center' },
  streakNumber: { fontSize: 36, fontWeight: '800', lineHeight: 40 },
  streakLabel: { fontSize: 13, fontWeight: '500', marginTop: 2 },
  bestStreak: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 6,
  },
  bestStreakText: { fontSize: 13, fontWeight: '500' },

  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  monthArrow: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
  monthLabel: { fontSize: 16, fontWeight: '700' },

  calendarCard: {
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  weekdayRow: { flexDirection: 'row', marginBottom: 8 },
  weekdayText: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: { width: CELL_SIZE, alignItems: 'center', marginBottom: 8 },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayActive: { backgroundColor: '#A594F9' },
  dayToday: { borderWidth: 2, borderColor: '#826BF0' },
  dayText: { fontSize: 13, fontWeight: '600' },
  dayMinutes: { fontSize: 8, color: '#A594F9', marginTop: 1 },

  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 20,
    paddingVertical: 4,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 11 },

  statsCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  statsTitle: { fontSize: 15, fontWeight: '700', marginBottom: 16 },
  statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', marginBottom: 16 },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '800' },
  statLabel: { fontSize: 11, fontWeight: '500', marginTop: 4 },
  statDivider: { width: 1, height: 32 },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(165,148,249,0.15)',
  },
  progressBarFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#A594F9',
  },

  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
  },
});
