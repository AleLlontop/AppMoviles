import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { formatSeconds, formatDateLabel } from '@/utils/dateFormatter';

export default function SessionDetailWidget({ sessionDetail }: any) {
  return (
    <View style={styles.card}>
      <Text style={styles.statsDate}>{formatDateLabel(sessionDetail.date)}</Text>
      
      <View style={styles.sessionContent}>
        <View style={styles.sessionTimer}>
          <View style={styles.sessionIconWrapper}>
            <IconSymbol name="house.fill" size={24} color="#E07A5F" />
          </View>
          <Text style={styles.sessionTimeValue}>{formatSeconds(sessionDetail.totalTime)}</Text>
        </View>
        
        <View style={styles.sessionHeatmap}>
          <View style={styles.heatmapYAxis}>
            {[5,6,7,8,9,10,11,12,1,2,3,4,5,6,7,8,9,10,11,12].map((h, i) => (
              <Text key={i} style={styles.heatmapYText}>{h}</Text>
            ))}
          </View>
          <View style={styles.heatmapCells}>
            {sessionDetail.activityHeatmap.map((lvl: number, i: number) => (
              <View key={i} style={[
                styles.heatmapCell,
                lvl === 1 && { backgroundColor: '#FFEDD5' },
                lvl === 2 && { backgroundColor: '#FED7AA' }
              ]} />
            ))}
          </View>
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
    width: '47%',
  },
  statsDate: {
    textAlign: 'center',
    fontSize: 11,
    color: '#4B5563',
    marginBottom: 16,
  },
  sessionContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sessionTimer: {
    alignItems: 'center',
    marginTop: 32,
  },
  sessionIconWrapper: {
    marginBottom: 8,
  },
  sessionTimeValue: {
    color: '#FB923C',
    fontWeight: 'bold',
    fontSize: 18,
  },
  sessionHeatmap: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    padding: 4,
    gap: 4,
  },
  heatmapYAxis: {
    gap: 1,
  },
  heatmapYText: {
    fontSize: 6,
    color: '#9CA3AF',
    textAlign: 'right',
    height: 6,
  },
  heatmapCells: {
    width: 16,
    gap: 1,
  },
  heatmapCell: {
    width: '100%',
    height: 6,
    backgroundColor: '#FFF7ED',
  },
});
