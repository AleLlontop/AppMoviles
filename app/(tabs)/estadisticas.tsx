import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import dayjs from 'dayjs';

import { getAllStatisticsData } from '@/services/statisticsService';
import { adaptStatisticsData } from '@/utils/statisticsAdapter';

// Import refactored widgets
import CalendarWidget from '@/components/statistics/CalendarWidget';
import StatsChartWidget from '@/components/statistics/StatsChartWidget';
import DonutChartsWidget from '@/components/statistics/DonutChartsWidget';
import HistoryList from '@/components/statistics/HistoryList';

export default function EstadisticasScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statsData, setStatsData] = useState<any>(null);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      // Fetch data for the current month
      const targetDate = dayjs().format('YYYY-MM-DD');
      const startDate = dayjs(targetDate).startOf('month').toISOString();
      const endDate = dayjs(targetDate).endOf('month').toISOString();
      
      const rawData = await getAllStatisticsData(startDate, endDate);
      const adapted = adaptStatisticsData(rawData, targetDate);
      setStatsData(adapted);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error fetching statistics');
    } finally {
      setLoading(false);
    }
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
        <Text style={{ color: 'red' }}>{error}</Text>
        <TouchableOpacity onPress={fetchData} style={{ marginTop: 16, padding: 10, backgroundColor: '#A594F9', borderRadius: 8 }}>
          <Text style={{ color: 'white' }}>Reintentar</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const { calendar, summary, distribution, sessionDetail, history } = statsData;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F3F4F9' }} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Top Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>estadísticas.</Text>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabNav}>
          {['Day', 'Week', 'Month', 'Trend'].map((tab, idx) => (
            <TouchableOpacity
              key={idx}
              style={[
                styles.tabButton,
                idx === 0 && styles.tabButtonActive
              ]}
            >
              <Text style={[styles.tabText, idx === 0 && styles.tabTextActive]}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Main Content */}
        <View style={styles.mainContent}>
          
          <View style={styles.gridContainer}>
            <CalendarWidget calendarData={calendar} />
            <StatsChartWidget summary={summary} />
            <DonutChartsWidget distribution={distribution} />
          </View>

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
    paddingHorizontal: 24,
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
  gridContainer: {
    flexDirection: 'column',
    gap: 16,
  },
});
