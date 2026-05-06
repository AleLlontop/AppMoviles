import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { formatHM, formatSeconds } from '@/utils/dateFormatter';

export default function HistoryList({ history }: any) {
  return (
    <View style={styles.card}>
      <Text style={styles.historyTitle}>Historial</Text>
      <View style={styles.historyList}>
        {history.map((item: any, index: number) => {
          if (item.type === 'range') {
            return (
              <View key={index} style={styles.historyRangeItem}>
                <View style={styles.historyRangeDotLine} />
                <View style={styles.historyRangeBox}>
                  <Text style={styles.historyRangeText}>
                    {item.timeRange} <Text style={{fontWeight: 'bold'}}>{formatHM(item.duration)}</Text>
                  </Text>
                  <Text style={styles.historyRangePlus}>+</Text>
                </View>
              </View>
            );
          } else {
            const itemColor = item.color || '#A594F9';
            return (
              <View key={index} style={styles.historySessionItem}>
                <View style={styles.historySessionDashedLine} />
                <Text style={styles.historySessionTime}>{item.time}</Text>
                <View style={styles.historySessionBox}>
                  <View style={[styles.historySessionPill, { backgroundColor: itemColor }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.historySessionName}>{item.name}</Text>
                    <Text style={styles.historySessionDuration}>{formatSeconds(item.durationSeconds)}</Text>
                    <Text style={styles.historySessionTimeRange}>{item.timeRange}</Text>
                  </View>
                  <TouchableOpacity>
                    <IconSymbol name="chevron.right" size={20} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          }
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 2,
    marginBottom: 16,
  },
  historyTitle: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 16,
    color: '#374151',
  },
  historyList: {
    gap: 16,
  },
  historyRangeItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyRangeDotLine: {
    position: 'absolute',
    left: 13,
    top: -10,
    height: 40,
    borderLeftWidth: 1,
    borderLeftColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  historyRangeBox: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginLeft: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  historyRangeText: {
    fontSize: 14,
    color: '#374151',
  },
  historyRangePlus: {
    fontSize: 18,
    color: '#374151',
  },
  historySessionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    position: 'relative',
  },
  historySessionDashedLine: {
    position: 'absolute',
    left: 13,
    top: 0,
    bottom: -32,
    borderLeftWidth: 1,
    borderLeftColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  historySessionTime: {
    fontSize: 10,
    color: '#6B7280',
    width: 48,
    paddingTop: 16,
  },
  historySessionBox: {
    flex: 1,
    backgroundColor: '#F5F3FF', // bg-purple-50
    borderRadius: 16,
    padding: 16,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: '#EDE9FE',
    position: 'relative',
    flexDirection: 'row',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  historySessionPill: {
    position: 'absolute',
    left: -4,
    top: 20,
    width: 8,
    height: 16,
    borderRadius: 4,
  },
  historySessionName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  historySessionDuration: {
    fontSize: 14,
    color: '#4B5563',
    marginVertical: 2,
  },
  historySessionTimeRange: {
    fontSize: 10,
    color: '#9CA3AF',
  }
});
