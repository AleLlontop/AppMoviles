import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import dayjs from 'dayjs';
import 'dayjs/locale/es';

import { getAllStatisticsData } from '@/services/statisticsService';
import { adaptStatisticsData } from '@/utils/statisticsAdapter';

import CalendarWidget from '@/components/statistics/CalendarWidget';
import StatsChartWidget from '@/components/statistics/StatsChartWidget';
import DonutChartsWidget from '@/components/statistics/DonutChartsWidget';
import HistoryList from '@/components/statistics/HistoryList';
import { useThemeColors } from '@/hooks/use-theme-colors';

type TabType = 'Day' | 'Week' | 'Month';

function getDateRange(tab: TabType): { startDate: string; endDate: string; targetDate: string; periodType: 'day' | 'week' | 'month' } {
  const today = dayjs();
  switch (tab) {
    case 'Day':
      return { startDate: today.startOf('day').toISOString(), endDate: today.endOf('day').toISOString(), targetDate: today.format('YYYY-MM-DD'), periodType: 'day' };
    case 'Week':
      return { startDate: today.startOf('week').toISOString(), endDate: today.endOf('week').toISOString(), targetDate: today.format('YYYY-MM-DD'), periodType: 'week' };
    case 'Month':
      return { startDate: today.startOf('month').toISOString(), endDate: today.endOf('month').toISOString(), targetDate: today.format('YYYY-MM-DD'), periodType: 'month' };
  }
}

export default function EstadisticasScreen() {
  const c = useThemeColors();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statsData, setStatsData] = useState<any>(null);
  const [selectedTab, setSelectedTab] = useState<TabType>('Month');

  useFocusEffect(useCallback(() => { fetchData(selectedTab); }, []));

  const fetchData = async (tab: TabType) => {
    try {
      setLoading(true);
      setError(null);
      const { startDate, endDate, targetDate, periodType } = getDateRange(tab);
      const rawData = await getAllStatisticsData(startDate, endDate);
      const adapted = adaptStatisticsData(rawData, targetDate, periodType);
      setStatsData(adapted);
    } catch (err: any) {
      setError(err.message || 'Error al cargar estadísticas');
    } finally {
      setLoading(false);
    }
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
        <TouchableOpacity onPress={() => fetchData(selectedTab)} style={{ padding: 10, backgroundColor: '#A594F9', borderRadius: 8 }}>
          <Text style={{ color: 'white' }}>Reintentar</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const { calendar, summary, distribution, history } = statsData;

  const formatTotal = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
    if (m > 0) return `${m}m`;
    return 'Sin sesiones';
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>

        <View style={[styles.header, { backgroundColor: c.accent }]}>
          <Text style={styles.headerDate}>
            {(() => { const d = dayjs().locale('es').format('dddd, D [de] MMMM'); return d.charAt(0).toUpperCase() + d.slice(1); })()}
          </Text>
          <Text style={styles.headerTitle}>Estadísticas</Text>
          <Text style={styles.headerSub}>
            {formatTotal(summary.totalStudyTime)} · {selectedTab === 'Day' ? 'hoy' : selectedTab === 'Week' ? 'esta semana' : 'este mes'}
          </Text>
        </View>

        <View style={[styles.tabNav, { backgroundColor: c.surface }]}>
          {(['Day', 'Week', 'Month'] as TabType[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tabButton, selectedTab === tab && styles.tabButtonActive]}
              onPress={() => { setSelectedTab(tab); fetchData(tab); }}
            >
              <Text style={[styles.tabText, { color: c.textSecondary }, selectedTab === tab && styles.tabTextActive]}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.mainContent}>
          <CalendarWidget calendarData={calendar} />
          <StatsChartWidget summary={summary} />
          <DonutChartsWidget distribution={distribution} />
          <HistoryList history={history} />
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header:        { paddingTop: 20, paddingBottom: 28, paddingHorizontal: 24 },
  headerDate:    { color: 'rgba(255,255,255,0.65)', fontSize: 12, fontWeight: '500', letterSpacing: 0.3, marginBottom: 6 },
  headerTitle:   { color: '#FFF', fontSize: 36, fontWeight: '800', letterSpacing: -0.5, marginBottom: 8 },
  headerSub:     { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '500' },
  tabNav:        { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, marginBottom: 16 },
  tabButton:     { paddingHorizontal: 20, paddingVertical: 6, borderRadius: 20 },
  tabButtonActive:{ backgroundColor: '#A594F9' },
  tabText:       { fontSize: 14, fontWeight: '500' },
  tabTextActive: { color: '#FFF' },
  mainContent:   { paddingHorizontal: 16, gap: 16 },
});
