import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/hooks/use-theme-colors';

type Session = {
  duration: number;
  tags?: { id: string; slug: string; label: string; color: string } | null;
};

type Props = {
  sessions: Session[];
  periodLabel?: string; // ej: "esta semana"
};

export default function TagDistributionWidget({ sessions, periodLabel }: Props) {
  const c = useThemeColors();
  const router = useRouter();

  const { totals, total } = useMemo(() => {
    // El total es la suma de sesiones etiquetadas (no todas): así el % refleja
    // la distribución dentro de las sesiones que sí clasificaste.
    const map = new Map<string, { label: string; color: string; duration: number }>();
    let total = 0;
    for (const s of sessions) {
      const dur = s.duration ?? 0;
      if (!dur || !s.tags) continue;
      total += dur;
      const cur = map.get(s.tags.id);
      if (cur) cur.duration += dur;
      else map.set(s.tags.id, { label: s.tags.label, color: s.tags.color, duration: dur });
    }
    const totals = Array.from(map.values()).sort((a, b) => b.duration - a.duration);
    return { totals, total };
  }, [sessions]);

  const formatHM = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
    return `${m}m`;
  };

  if (totals.length === 0) {
    return (
      <View style={[styles.card, { backgroundColor: c.surface }]}>
        <Text style={[styles.title, { color: c.textPrimary }]}>Distribución por etiqueta</Text>
        <Text style={[styles.sub, { color: c.textSecondary }]}>
          Aún no etiquetaste sesiones {periodLabel ? `${periodLabel}` : ''}.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: c.surface }]}>
      <Text style={[styles.title, { color: c.textPrimary }]}>Distribución por etiqueta</Text>
      {periodLabel ? (
        <Text style={[styles.sub, { color: c.textSecondary }]}>
          Cómo repartiste tu tiempo {periodLabel}
        </Text>
      ) : null}

      {/* Stacked bar */}
      <View style={styles.stackedBar}>
        {totals.map((t, i) => (
          <View
            key={i}
            style={{
              flex: t.duration / total,
              backgroundColor: t.color,
              height: '100%',
            }}
          />
        ))}
      </View>

      {/* List */}
      <View style={{ marginTop: 16, gap: 12 }}>
        {totals.map((t, i) => {
          const pct = Math.round((t.duration / total) * 100);
          return (
            <View key={i} style={styles.row}>
              <View style={[styles.dot, { backgroundColor: t.color }]} />
              <Text style={[styles.label, { color: c.textPrimary }]}>{t.label}</Text>
              <View style={{ flex: 1 }} />
              <Text style={[styles.dur, { color: c.textPrimary }]}>{formatHM(t.duration)}</Text>
              <Text style={[styles.pct, { color: c.textSecondary }]}>{pct}%</Text>
            </View>
          );
        })}
      </View>

      <TouchableOpacity
        style={styles.linkRow}
        onPress={() => router.push('/sesiones')}
        activeOpacity={0.7}
      >
        <Text style={[styles.linkText, { color: c.accent }]}>Ver detalle por sesión</Text>
        <Ionicons name="chevron-forward" size={14} color={c.accent} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, padding: 20 },
  title: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  sub: { fontSize: 12, marginBottom: 14 },
  stackedBar: {
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    flexDirection: 'row',
    marginTop: 4,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  label: { fontSize: 14, fontWeight: '600' },
  dur: { fontSize: 14, fontWeight: '600', marginRight: 10 },
  pct: { fontSize: 12, fontWeight: '500', minWidth: 34, textAlign: 'right' },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: 16,
    gap: 4,
  },
  linkText: { fontSize: 13, fontWeight: '600' },
});
