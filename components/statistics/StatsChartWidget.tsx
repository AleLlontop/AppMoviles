import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { formatSeconds, formatTimeOnly, formatHM } from '@/utils/dateFormatter';
import { BarChart, LineChart } from 'react-native-gifted-charts';
import { useThemeColors } from '@/hooks/use-theme-colors';

interface DaySummary {
  dateLabel: string;
  totalStudyTime: number;
  maxConcentration: number;
  startTime: string | null;
  endTime: string | null;
  comparisonPreviousDay: number;
  todayBars: number[];
  prevBars: number[];
  hasData: boolean;
  hasPrevData: boolean;
}

export default function StatsChartWidget({ daySummary }: { daySummary: DaySummary }) {
  const c = useThemeColors();

  const barData = daySummary.prevBars.map((value) => ({
    value,
    frontColor: c.separator,
    spacing: 2,
  }));

  const lineData = daySummary.todayBars.map((value) => ({ value }));

  const delta = daySummary.comparisonPreviousDay;
  const deltaAbs = Math.abs(delta);
  const sign = delta > 0 ? '+' : delta < 0 ? '-' : '';
  const deltaColor = delta > 0 ? '#10B981' : delta < 0 ? '#EF4444' : c.textPrimary;

  return (
    <View style={[styles.card, { backgroundColor: c.surface }]}>
      <Text style={[styles.statsDate, { color: c.textSecondary }]}>{daySummary.dateLabel}</Text>

      <View style={styles.statsGrid}>
        <View style={styles.statsItem}>
          <Text style={styles.statsLabel}>Tiempo total de estudio</Text>
          <Text style={[styles.statsValue, { color: c.textPrimary }]}>
            {daySummary.hasData ? formatSeconds(daySummary.totalStudyTime) : '—'}
          </Text>
        </View>
        <View style={[styles.statsItem, { alignItems: 'flex-end' }]}>
          <Text style={styles.statsLabel}>Concentración máxima</Text>
          <Text style={[styles.statsValue, { color: c.textPrimary }]}>
            {daySummary.hasData ? formatSeconds(daySummary.maxConcentration) : '—'}
          </Text>
        </View>
        <View style={styles.statsItem}>
          <Text style={styles.statsLabel}>Tiempo de inicio</Text>
          <Text style={[styles.statsValue, { color: c.textPrimary }]}>
            {formatTimeOnly(daySummary.startTime)}
          </Text>
        </View>
        <View style={[styles.statsItem, { alignItems: 'flex-end' }]}>
          <Text style={styles.statsLabel}>Tiempo de término</Text>
          <Text style={[styles.statsValue, { color: c.textPrimary }]}>
            {formatTimeOnly(daySummary.endTime)}
          </Text>
        </View>
      </View>

      <View style={[styles.chartContainer, { borderTopColor: c.separator }]}>
        <View style={styles.chartComparison}>
          <Text style={[styles.chartComparisonText, { color: c.textSecondary }]}>
            vs. día anterior
          </Text>
          <Text style={[styles.chartComparisonValue, { color: deltaColor }]}>
            {daySummary.hasPrevData || daySummary.hasData ? `${sign}${formatHM(deltaAbs)}` : '—'}
          </Text>
        </View>

        <View style={styles.chartLegend}>
          <View style={styles.chartLegendItem}>
            <Text style={[styles.chartLegendText, { color: c.textSecondary }]}>Hoy</Text>
            <View style={styles.chartLegendDotToday} />
          </View>
          <View style={styles.chartLegendItem}>
            <Text style={[styles.chartLegendText, { color: c.textSecondary }]}>Ayer</Text>
            <View style={[styles.chartLegendDotYest, { backgroundColor: c.separator }]} />
          </View>
        </View>

        <View style={styles.chartBars}>
          <View style={{ position: 'absolute', bottom: 10, left: 0, right: 0 }}>
            <BarChart
              data={barData}
              barWidth={10}
              spacing={6}
              hideRules
              hideYAxisText
              hideAxesAndRules
              barBorderRadius={2}
              height={40}
              width={140}
              initialSpacing={4}
              yAxisThickness={0}
              xAxisThickness={0}
              disableScroll
            />
          </View>
          <View style={{ position: 'absolute', bottom: 5, left: 0, right: 0 }}>
            <LineChart
              data={lineData}
              hideRules
              hideYAxisText
              hideAxesAndRules
              height={40}
              width={140}
              color="#A594F9"
              thickness={2}
              dataPointsColor="#A594F9"
              dataPointsRadius={2}
              hideDataPoints={false}
              curved={false}
              yAxisThickness={0}
              xAxisThickness={0}
              disableScroll
              spacing={18}
              initialSpacing={4}
            />
          </View>
        </View>

        <View style={styles.chartXAxis}>
          <Text style={[styles.chartXAxisText, { color: c.textSecondary }]}>00:00</Text>
          <Text style={[styles.chartXAxisText, { color: c.textSecondary }]}>12:00</Text>
          <Text style={[styles.chartXAxisText, { color: c.textSecondary }]}>23:59</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card:                 { borderRadius: 12, padding: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 15, elevation: 2, marginBottom: 16, width: '100%', justifyContent: 'space-between' },
  statsDate:            { textAlign: 'center', fontSize: 11, marginBottom: 16 },
  statsGrid:            { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 16 },
  statsItem:            { width: '45%' },
  statsLabel:           { fontSize: 9, color: '#A594F9', marginBottom: 2 },
  statsValue:           { fontSize: 14, fontWeight: '500' },
  chartContainer:       { borderTopWidth: 1, paddingTop: 12, height: 96, position: 'relative' },
  chartComparison:      { position: 'absolute', top: 4, left: 0 },
  chartComparisonText:  { fontSize: 9 },
  chartComparisonValue: { fontSize: 10, fontWeight: '700', marginTop: 1 },
  chartLegend:          { position: 'absolute', top: 4, right: 0, alignItems: 'flex-end', gap: 4 },
  chartLegendItem:      { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chartLegendText:      { fontSize: 9 },
  chartLegendDotToday:  { width: 12, height: 6, backgroundColor: '#A594F9', borderRadius: 3 },
  chartLegendDotYest:   { width: 12, height: 12, borderRadius: 2 },
  chartBars:            { position: 'absolute', bottom: -10, left: 0, right: 0, height: 80, overflow: 'hidden' },
  chartXAxis:           { position: 'absolute', bottom: -10, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between' },
  chartXAxisText:       { fontSize: 9 },
});
