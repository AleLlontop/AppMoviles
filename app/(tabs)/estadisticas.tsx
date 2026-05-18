import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import dayjs from 'dayjs';

import { getAllStatisticsData } from '@/services/statisticsService';
import { adaptStatisticsData } from '@/utils/statisticsAdapter';

import CalendarWidget from '@/components/statistics/CalendarWidget';
import StatsChartWidget from '@/components/statistics/StatsChartWidget';
import DonutChartsWidget from '@/components/statistics/DonutChartsWidget';
import HistoryList from '@/components/statistics/HistoryList';

type TabType = 'Day' | 'Week' | 'Month' | 'Trend';

function getDateRange(tab: TabType): { startDate: string; endDate: string; targetDate: string; periodType: 'day' | 'week' | 'month' | 'trend' } {
  const today = dayjs();
  switch (tab) {
    case 'Day':
      return {
        startDate: today.startOf('day').toISOString(),
        endDate: today.endOf('day').toISOString(),
        targetDate: today.format('YYYY-MM-DD'),
        periodType: 'day',
      };
    case 'Week':
      return {
        startDate: today.startOf('week').toISOString(),
        endDate: today.endOf('week').toISOString(),
        targetDate: today.format('YYYY-MM-DD'),
        periodType: 'week',
      };
    case 'Month':
      return {
        startDate: today.startOf('month').toISOString(),
        endDate: today.endOf('month').toISOString(),
        targetDate: today.format('YYYY-MM-DD'),
        periodType: 'month',
      };
    case 'Trend':
      return {
        startDate: today.subtract(30, 'day').startOf('day').toISOString(),
        endDate: today.endOf('day').toISOString(),
        targetDate: today.format('YYYY-MM-DD'),
        periodType: 'trend',
      };
  }
}

export default function EstadisticasScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statsData, setStatsData] = useState<any>(null);
  const [selectedTab, setSelectedTab] = useState<TabType>('Month');

  useFocusEffect(
    useCallback(() => {
      fetchData(selectedTab);
    }, [])
  );

  const fetchData = async (tab: TabType) => {
    try {
      setLoading(true);
      setError(null);
      const { startDate, endDate, targetDate, periodType } = getDateRange(tab);
      const rawData = await getAllStatisticsData(startDate, endDate);
      const adapted = adaptStatisticsData(rawData, targetDate, periodType);
      setStatsData(adapted);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error al cargar estadísticas');
    } finally {
      setLoading(false);
    }
  };

  const handleTabPress = (tab: TabType) => {
    setSelectedTab(tab);
    fetchData(tab);
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F3F4F9', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#A594F9" />
      </SafeAreaView>
    );
  }

  if (error || !statsData) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F3F4F9', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: 'red', marginBottom: 8 }}>{error}</Text>
        <TouchableOpacity onPress={() => fetchData(selectedTab)} style={{ padding: 10, backgroundColor: '#A594F9', borderRadius: 8 }}>
          <Text style={{ color: 'white' }}>Reintentar</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const { calendar, summary, distribution, history } = statsData;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F3F4F9' }} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>estadísticas.</Text>
        </View>

        <View style={styles.tabNav}>
          {(['Day', 'Week', 'Month', 'Trend'] as TabType[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tabButton, selectedTab === tab && styles.tabButtonActive]}
              onPress={() => handleTabPress(tab)}
            >
              <Text style={[styles.tabText, selectedTab === tab && styles.tabTextActive]}>
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
  header: {
    backgroundColor: '#A594F9',
    paddingTop: 16,
    paddingBottom: 16,
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '400',
  },
  tabNav: {
    backgroundColor: '#FFF',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
  },
  tabButton: {
    paddingHorizontal: 20,
    paddingVertical: 6,
    borderRadius: 20,
  },
  tabButtonActive: {
    backgroundColor: '#A594F9',
  },
  tabText: {
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#FFF',
  },
  mainContent: {
    paddingHorizontal: 16,
    gap: 16,
  },
});
