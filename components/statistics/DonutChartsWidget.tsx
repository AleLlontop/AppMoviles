import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';

export default function DonutChartsWidget({ distribution }: any) {
  // In our adapter, distribution.techniques maps the subjects breakdown 
  const subjectsData = distribution.techniques || [];
  
  const pieData = subjectsData.map((s: any) => ({
    value: s.percentage > 0 ? s.percentage : 0,
    color: s.color || '#A594F9'
  })).filter((s: any) => s.value > 0);

  // Fallback for empty
  if (pieData.length === 0) {
    pieData.push({ value: 100, color: '#E5E7EB' });
  }

  const maxSubject = subjectsData.length > 0 
    ? subjectsData.reduce((prev: any, current: any) => (prev.percentage > current.percentage) ? prev : current)
    : null;

  return (
    <View style={styles.card}>
      <View style={styles.donutRow}>
        <View style={styles.donutContainer}>
          <PieChart
            donut
            innerRadius={24}
            radius={40}
            data={pieData}
            centerLabelComponent={() => {
              if (maxSubject) {
                return (
                  <View style={{alignItems: 'center', justifyContent: 'center'}}>
                    <Text style={styles.donutPercentText}>{maxSubject.percentage}%</Text>
                  </View>
                );
              }
              return <Text style={styles.donutPercentText}>100%</Text>;
            }}
          />
        </View>
        <View style={styles.donutInfoList}>
          {subjectsData.length > 0 ? subjectsData.map((s: any, i: number) => (
            <View key={i} style={styles.donutInfoRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 }}>
                <View style={[styles.dot, { backgroundColor: s.color || '#A594F9' }]} />
                <Text style={styles.donutInfoName} numberOfLines={1}>{s.name}</Text>
              </View>
              <Text style={styles.donutInfoValue}>{s.timeFormatted} ({s.percentage}%)</Text>
            </View>
          )) : (
            <View style={styles.donutInfoRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={[styles.dot, { backgroundColor: '#E5E7EB' }]} />
                <Text style={styles.donutInfoName}>Sin materias</Text>
              </View>
              <Text style={styles.donutInfoValue}>00:00</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 2,
    marginBottom: 16,
    width: '100%',
  },
  donutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  donutContainer: {
    width: 80,
    height: 80,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  donutPercentText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#374151',
  },
  donutInfoList: {
    flex: 1,
    gap: 6,
  },
  donutInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  dot: {
    width: 4,
    height: 12,
    borderRadius: 2,
  },
  donutInfoName: {
    fontSize: 10,
    fontWeight: '500',
    color: '#374151',
    flexShrink: 1,
  },
  donutInfoValue: {
    fontSize: 10,
    color: '#374151',
  },
});
