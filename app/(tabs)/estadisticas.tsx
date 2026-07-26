import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import dayjs, { Dayjs } from 'dayjs';
import 'dayjs/locale/es';

import { getAllStatisticsData } from '@/services/statisticsService';
import { adaptStatisticsData } from '@/utils/statisticsAdapter';

import CalendarWidget from '@/components/statistics/CalendarWidget';
import StatsChartWidget from '@/components/statistics/StatsChartWidget';
import DonutChartsWidget from '@/components/statistics/DonutChartsWidget';
import HistoryList from '@/components/statistics/HistoryList';
import TagDistributionWidget from '@/components/statistics/TagDistributionWidget';
import { useThemeColors } from '@/hooks/use-theme-colors';

type TabType = 'Day' | 'Week' | 'Month';

function getDateRange(tab: TabType, ref: Dayjs) {
  const unit = tab === 'Day' ? 'day' : tab === 'Week' ? 'week' : 'month';
  return {
    startDate:  ref.startOf(unit).toISOString(),
    endDate:    ref.endOf(unit).toISOString(),
    targetDate: ref.format('YYYY-MM-DD'),
    periodType: unit as 'day' | 'week' | 'month',
  };
}

export default function EstadisticasScreen() {
  const c = useThemeColors();
  const router = useRouter();
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [statsData, setStatsData]       = useState<any>(null);
  const [selectedTab, setSelectedTab]     = useState<TabType>('Month');
  const [referenceDate, setReferenceDate] = useState<Dayjs>(dayjs());
  const isFocused = useIsFocused();

  // Corre cuando la pantalla gana foco O cuando cambia tab/fecha
  useEffect(() => {
    if (isFocused) {
      fetchData(selectedTab, referenceDate);
    }
  }, [selectedTab, referenceDate, isFocused]);

  const fetchData = async (tab: TabType, ref: Dayjs) => {
    try {
      setLoading(true);
      setError(null);
      const { startDate, endDate, targetDate, periodType } = getDateRange(tab, ref);
      const rawData = await getAllStatisticsData(startDate, endDate);
      const adapted = adaptStatisticsData(rawData, targetDate, periodType);
      setStatsData(adapted);
    } catch (err: any) {
      setError(err.message || 'Error al cargar estadísticas');
    } finally {
      setLoading(false);
    }
  };

  // Flechas del calendario: solo cambian el mes visible.
  // En Month tab recarga los datos. En Week/Day solo mueve el calendario
  // sin cambiar los datos (el usuario toca un día para eso).
  const handleMonthChange = (month: { year: number; month: number }) => {
    if (selectedTab === 'Month') {
      const newRef = dayjs().year(month.year).month(month.month - 1).date(1);
      setReferenceDate(newRef);
    }
    // Week / Day: las flechas solo navegan el calendario visualmente,
    // el usuario toca un día para seleccionar la semana o el día.
  };

  // Tap en un día del calendario: en Week → semana de ese día,
  // en Day → ese día exacto. En Month no hace nada (las flechas ya lo manejan).
  const handleDayPress = (day: { dateString: string }) => {
    if (selectedTab === 'Month') return;
    const newRef = dayjs(day.dateString);
    setReferenceDate(newRef);
  };

  const handleTabChange = (tab: TabType) => {
    setSelectedTab(tab);
    setReferenceDate(dayjs()); // volver al período actual al cambiar tab
  };

  const formatTotal = (seconds: number) => {
    if (!seconds || seconds === 0) return 'Sin sesiones';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const getPeriodLabel = () => {
    const isCurrent = referenceDate.isSame(dayjs(), selectedTab === 'Day' ? 'day' : selectedTab === 'Week' ? 'week' : 'month');
    if (selectedTab === 'Day')   return isCurrent ? 'hoy' : referenceDate.locale('es').format('D [de] MMMM');
    if (selectedTab === 'Week')  return isCurrent ? 'esta semana' : `sem. del ${referenceDate.startOf('week').format('D MMM')}`;
    return isCurrent ? 'este mes' : referenceDate.locale('es').format('MMMM YYYY');
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#A594F9" />
      </SafeAreaView>
    );
  }

  if (error || !statsData) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.background, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: 'red', marginBottom: 8 }}>{error}</Text>
        <TouchableOpacity onPress={() => fetchData(selectedTab, referenceDate)} style={{ padding: 10, backgroundColor: '#A594F9', borderRadius: 8 }}>
          <Text style={{ color: 'white' }}>Reintentar</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const { calendar, summary, daySummary, distribution, history, rawSessions } = statsData;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>

        {/* Header */}
        <View style={[styles.header, { backgroundColor: c.accent }]}>
          <Text style={styles.headerDate}>
            {(() => {
              const d = dayjs().locale('es').format('dddd, D [de] MMMM');
              return d.charAt(0).toUpperCase() + d.slice(1);
            })()}
          </Text>
          <Text style={styles.headerTitle}>Estadísticas</Text>
          <Text style={styles.headerSub}>
            {formatTotal(summary.totalStudyTime)} · {getPeriodLabel()}
          </Text>
        </View>

        {/* Racha banner */}
        <TouchableOpacity
          onPress={() => router.push('/rachas')}
          style={[styles.streakBanner, { backgroundColor: c.surface, marginBottom: 17 , marginTop: 15}]}
          activeOpacity={0.7}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="flame" size={20} color="#FF6B35" />
            <Text style={[styles.streakBannerText, { color: c.textPrimary }]}>
              Mi racha de estudio
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={c.textSecondary} />
        </TouchableOpacity>

        {/* Logros banner */}
        <TouchableOpacity
          onPress={() => router.push('/logros')}
          style={[styles.streakBanner, { backgroundColor: c.surface }]}
          activeOpacity={0.7}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 18 }}>🏆</Text>
            <Text style={[styles.streakBannerText, { color: c.textPrimary }]}>
              Mis logros
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={c.textSecondary} />
        </TouchableOpacity>

        {/* Tabs Day / Week / Month */}
        <View style={[styles.tabNav, { backgroundColor: c.surface }]}>
          {(['Day', 'Week', 'Month'] as TabType[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tabButton, selectedTab === tab && styles.tabButtonActive]}
              onPress={() => handleTabChange(tab)}
            >
              <Text style={[styles.tabText, { color: c.textSecondary }, selectedTab === tab && styles.tabTextActive]}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Widgets — el calendario maneja su propia navegación con las flechas nativas */}
        <View style={styles.mainContent}>
          <CalendarWidget
            calendarData={calendar}
            onMonthChange={handleMonthChange}
            onDayPress={handleDayPress}
            selectedTab={selectedTab}
          />
          <StatsChartWidget daySummary={daySummary} />
          <TagDistributionWidget sessions={rawSessions ?? []} periodLabel={getPeriodLabel()} />
          <DonutChartsWidget distribution={distribution} />
          <HistoryList history={history} />
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header:          { paddingTop: 20, paddingBottom: 28, paddingHorizontal: 24 },
  headerDate:      { color: 'rgba(255,255,255,0.65)', fontSize: 12, fontWeight: '500', letterSpacing: 0.3, marginBottom: 6 },
  headerTitle:     { color: '#FFF', fontSize: 36, fontWeight: '800', letterSpacing: -0.5, marginBottom: 8 },
  headerSub:       { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '500' },
  tabNav:          { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, marginBottom: 16 },
  tabButton:       { paddingHorizontal: 20, paddingVertical: 6, borderRadius: 20 },
  tabButtonActive: { backgroundColor: '#A594F9' },
  tabText:         { fontSize: 14, fontWeight: '500' },
  tabTextActive:   { color: '#FFF' },
  mainContent:     { paddingHorizontal: 16, gap: 16 },
  streakBanner:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 16, marginBottom: 16, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  streakBannerText: { fontSize: 14, fontWeight: '600' },
});
