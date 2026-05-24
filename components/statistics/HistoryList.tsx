import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { formatHM, formatSeconds } from '@/utils/dateFormatter';
import { useThemeColors } from '@/hooks/use-theme-colors';

export default function HistoryList({ history }: any) {
  const c = useThemeColors();

  return (
    <View style={[styles.card, { backgroundColor: c.surface }]}>
      <Text style={[styles.historyTitle, { color: c.textPrimary }]}>Historial</Text>
      <View style={styles.historyList}>
        {history.map((item: any, index: number) => {
          if (item.type === 'range') {
            return (
              <View key={index} style={styles.historyRangeItem}>
                <View style={[styles.historyRangeDotLine, { borderLeftColor: c.separator }]} />
                <View style={[styles.historyRangeBox, { backgroundColor: c.background }]}>
                  <Text style={[styles.historyRangeText, { color: c.textPrimary }]}>
                    {item.timeRange} <Text style={{ fontWeight: 'bold' }}>{formatHM(item.duration)}</Text>
                  </Text>
                  <Text style={[styles.historyRangePlus, { color: c.textSecondary }]}>+</Text>
                </View>
              </View>
            );
          } else {
            const itemColor = item.color || '#A594F9';
            return (
              <View key={index} style={styles.historySessionItem}>
                <View style={[styles.historySessionDashedLine, { borderLeftColor: c.separator }]} />
                <Text style={[styles.historySessionTime, { color: c.textSecondary }]}>{item.time}</Text>
                <View style={[styles.historySessionBox, { backgroundColor: c.surface, borderColor: c.border }]}>
                  <View style={[styles.historySessionPill, { backgroundColor: itemColor }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.historySessionName, { color: c.textPrimary }]}>{item.name}</Text>
                    <Text style={[styles.historySessionDuration, { color: c.textSecondary }]}>{formatSeconds(item.durationSeconds)}</Text>
                    <Text style={[styles.historySessionTimeRange, { color: c.textSecondary }]}>{item.timeRange}</Text>
                  </View>
                  <TouchableOpacity>
                    <IconSymbol name="chevron.right" size={20} color={c.textSecondary} />
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
  card:                     { borderRadius: 12, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 15, elevation: 2, marginBottom: 16 },
  historyTitle:             { textAlign: 'center', fontSize: 14, fontWeight: '500', marginBottom: 16 },
  historyList:              { gap: 16 },
  historyRangeItem:         { flexDirection: 'row', alignItems: 'center' },
  historyRangeDotLine:      { position: 'absolute', left: 13, top: -10, height: 40, borderLeftWidth: 1, borderStyle: 'dashed' },
  historyRangeBox:          { flex: 1, borderRadius: 8, padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginLeft: 32, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  historyRangeText:         { fontSize: 14 },
  historyRangePlus:         { fontSize: 18 },
  historySessionItem:       { flexDirection: 'row', alignItems: 'flex-start', position: 'relative' },
  historySessionDashedLine: { position: 'absolute', left: 13, top: 0, bottom: -32, borderLeftWidth: 1, borderStyle: 'dashed' },
  historySessionTime:       { fontSize: 10, width: 48, paddingTop: 16 },
  historySessionBox:        { flex: 1, borderRadius: 16, padding: 16, marginLeft: 8, borderWidth: 1, position: 'relative', flexDirection: 'row', justifyContent: 'space-between', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  historySessionPill:       { position: 'absolute', left: -4, top: 20, width: 8, height: 16, borderRadius: 4 },
  historySessionName:       { fontSize: 14, fontWeight: '600' },
  historySessionDuration:   { fontSize: 14, marginVertical: 2 },
  historySessionTimeRange:  { fontSize: 10 },
});
