import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { formatSeconds, formatTimeOnly } from '@/utils/dateFormatter';
import { BarChart, LineChart } from 'react-native-gifted-charts';
import { useThemeColors } from '@/hooks/use-theme-colors';

export default function StatsChartWidget({ summary }: any) {
  const c = useThemeColors();

  const barData = summary.chartBars.map((value: number) => ({
    value,
    frontColor: c.separator,
    spacing: 2,
  }));

  const lineData = [
    { value: 20 }, { value: 30 }, { value: 25 }, { value: 35 }, { value: 40 }
  ];

  return (
    <View style={[styles.card, { backgroundColor: c.surface }]}>
      <Text style={[styles.statsDate, { color: c.textSecondary }]}>{summary.dateLabel}</Text>

      <View style={styles.statsGrid}>
        <View style={styles.statsItem}>
          <Text style={styles.statsLabel}>Tiempo total de estudio</Text>
          <Text style={[styles.statsValue, { color: c.textPrimary }]}>{formatSeconds(summary.totalStudyTime)}</Text>
        </View>
        <View style={[styles.statsItem, { alignItems: 'flex-end' }]}>
          <Text style={styles.statsLabel}>Concentración Máxima</Text>
          <Text style={[styles.statsValue, { color: c.textPrimary }]}>{formatSeconds(summary.maxConcentration)}</Text>
        </View>
        <View style={styles.statsItem}>
          <Text style={styles.statsLabel}>Tiempo de inicio</Text>
          <Text style={[styles.statsValue, { color: c.textPrimary }]}>{formatTimeOnly(summary.startTime)}</Text>
        </View>
        <View style={[styles.statsItem, { alignItems: 'flex-end' }]}>
          <Text style={styles.statsLabel}>Tiempo de término</Text>
          <Text style={[styles.statsValue, { color: c.textPrimary }]}>{formatTimeOnly(summary.endTime)}</Text>
        </View>
      </View>

      <View style={[styles.chartContainer, { borderTopColor: c.separator }]}>
        <View style={styles.chartComparison}>
          <Text style={[styles.chartComparisonText, { color: c.textSecondary }]}>Compared at 23</Text>
          <Text style={[styles.chartComparisonValue, { color: c.textPrimary }]}>
            {summary.comparisonPreviousDay < 0 ? '-' : ''}{formatSeconds(Math.abs(summary.comparisonPreviousDay))}
          </Text>
        </View>

        <View style={styles.chartLegend}>
          <View style={styles.chartLegendItem}>
            <Text style={[styles.chartLegendText, { color: c.textSecondary }]}>Today</Text>
            <View style={styles.chartLegendDotToday} />
          </View>
          <View style={styles.chartLegendItem}>
            <Text style={[styles.chartLegendText, { color: c.textSecondary }]}>Yesterday</Text>
            <View style={[styles.chartLegendDotYest, { backgroundColor: c.separator }]} />
          </View>
        </View>

        <View style={styles.chartBars}>
          <View style={{ position: 'absolute', bottom: 10, right: 0 }}>
            <BarChart data={barData} barWidth={8} hideRules hideYAxisText hideAxesAndRules barBorderRadius={0} height={40} width={80} initialSpacing={0} yAxisThickness={0} xAxisThickness={0} disableScroll />
          </View>
          <View style={{ position: 'absolute', bottom: 5, left: -20, right: 0, width: 200 }}>
            <LineChart data={lineData} hideRules hideYAxisText hideAxesAndRules height={40} width={160} color="#A594F9" thickness={2} dataPointsColor="#A594F9" dataPointsRadius={2} hideDataPoints={false} curved={false} yAxisThickness={0} xAxisThickness={0} disableScroll />
          </View>
        </View>

        <View style={styles.chartXAxis}>
          <Text style={[styles.chartXAxisText, { color: c.textSecondary }]}>5:00</Text>
          <Text style={[styles.chartXAxisText, { color: c.textSecondary }]}>17:00</Text>
          <Text style={[styles.chartXAxisText, { color: c.textSecondary }]}>5:00</Text>
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
  chartComparisonText:  { fontSize: 8 },
  chartComparisonValue: { fontSize: 8, fontWeight: '700' },
  chartLegend:          { position: 'absolute', top: 4, right: 0, alignItems: 'flex-end', gap: 4 },
  chartLegendItem:      { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chartLegendText:      { fontSize: 8 },
  chartLegendDotToday:  { width: 12, height: 6, backgroundColor: '#A594F9', borderRadius: 3 },
  chartLegendDotYest:   { width: 12, height: 12, borderRadius: 2 },
  chartBars:            { position: 'absolute', bottom: -15, left: 0, right: 0, height: 80, overflow: 'hidden' },
  chartXAxis:           { position: 'absolute', bottom: -10, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between' },
  chartXAxisText:       { fontSize: 7 },
});
