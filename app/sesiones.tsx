import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import 'dayjs/locale/es';

import { useThemeColors } from '@/hooks/use-theme-colors';
import { supabase } from '@/utils/supabase';
import { getTags, Tag } from '@/services/tagsService';

type SessionRow = {
  id: string;
  duration: number;
  start_time: string;
  subjects: { name: string; color: string | null } | null;
  tags: { id: string; label: string; slug: string; color: string } | null;
};

const formatHM = (sec: number) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
  return `${m}m`;
};

const relativeDay = (iso: string) => {
  const d = dayjs(iso);
  const today = dayjs().startOf('day');
  const yesterday = today.subtract(1, 'day');
  if (d.isSame(today, 'day')) return `Hoy · ${d.format('HH:mm')}`;
  if (d.isSame(yesterday, 'day')) return `Ayer · ${d.format('HH:mm')}`;
  return d.locale('es').format('D MMM · HH:mm');
};

export default function SesionesScreen() {
  const c = useThemeColors();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [filterTagId, setFilterTagId] = useState<string | null>(null); // null = "Todas"

  const load = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [{ data: sess }, tgs] = await Promise.all([
        supabase
          .from('study_sessions')
          .select('id, duration, start_time, subjects(name, color), tags(id, slug, label, color)')
          .eq('user_id', user.id)
          .order('start_time', { ascending: false })
          .limit(200),
        getTags(),
      ]);
      setSessions((sess as any) ?? []);
      setTags(tgs);
    } catch (e) {
      console.error('Error loading sessions:', e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const filtered = useMemo(() => {
    if (!filterTagId) return sessions;
    return sessions.filter((s) => s.tags?.id === filterTagId);
  }, [sessions, filterTagId]);

  const total = filtered.reduce((sum, s) => sum + (s.duration || 0), 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['top']}>
      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()} className="p-1">
          <Ionicons name="chevron-back" size={26} color={c.textPrimary} />
        </TouchableOpacity>
        <Text style={{ color: c.textPrimary, fontSize: 22, fontWeight: '800', marginLeft: 6 }}>
          Sesiones
        </Text>
      </View>

      {/* Filter chips */}
      <Text style={[styles.filterLabel, { color: c.textSecondary }]}>FILTRAR POR ETIQUETA</Text>
      <View style={{ height: 44, marginBottom: 8, flexShrink: 0 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 8, alignItems: 'center' }}
        style={{ flexGrow: 0 }}
      >
        <FilterChip
          label="Todas"
          color={c.accent}
          active={filterTagId === null}
          onPress={() => setFilterTagId(null)}
        />
        {tags.map((t) => (
          <FilterChip
            key={t.id}
            label={t.label}
            color={t.color}
            active={filterTagId === t.id}
            onPress={() => setFilterTagId(t.id)}
          />
        ))}
      </ScrollView>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={c.accent} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 }}>
          <Text style={{ color: c.textSecondary, fontSize: 12, marginBottom: 12 }}>
            {filtered.length} {filtered.length === 1 ? 'sesión' : 'sesiones'} · {formatHM(total)}
          </Text>

          {filtered.length === 0 ? (
            <View className="items-center py-16">
              <Ionicons name="albums-outline" size={40} color={c.textSecondary} />
              <Text style={{ color: c.textSecondary, marginTop: 12, fontSize: 14 }}>
                No hay sesiones {filterTagId ? 'con esta etiqueta' : ''} aún.
              </Text>
            </View>
          ) : (
            filtered.map((s) => (
              <View
                key={s.id}
                style={{ backgroundColor: c.surface }}
                className="p-4 rounded-2xl mb-3"
              >
                <View className="flex-row justify-between items-start">
                  <View className="flex-1 mr-3">
                    <Text style={{ color: c.textPrimary, fontSize: 16, fontWeight: '700' }}>
                      {s.subjects?.name ?? 'Sesión'}
                    </Text>
                    {s.tags ? (
                      <View
                        style={{
                          alignSelf: 'flex-start',
                          backgroundColor: `${s.tags.color}20`,
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 10,
                          marginTop: 6,
                          flexDirection: 'row',
                          alignItems: 'center',
                        }}
                      >
                        <View
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: s.tags.color,
                            marginRight: 6,
                          }}
                        />
                        <Text style={{ color: s.tags.color, fontSize: 11, fontWeight: '700' }}>
                          {s.tags.label}
                        </Text>
                      </View>
                    ) : (
                      <Text style={{ color: c.textSecondary, fontSize: 11, marginTop: 6 }}>
                        Sin etiqueta
                      </Text>
                    )}
                    <Text style={{ color: c.textSecondary, fontSize: 11, marginTop: 6 }}>
                      {relativeDay(s.start_time)}
                    </Text>
                  </View>
                  <Text style={{ color: c.textPrimary, fontSize: 16, fontWeight: '700' }}>
                    {formatHM(s.duration)}
                  </Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function FilterChip({
  label,
  color,
  active,
  onPress,
}: {
  label: string;
  color: string;
  active: boolean;
  onPress: () => void;
}) {
  const c = useThemeColors();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        backgroundColor: active ? `${color}20` : c.surface,
        borderColor: active ? color : c.textSecondary,
        borderWidth: 1.5,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 999,
        flexDirection: 'row',
        alignItems: 'center',
        height: 36,
      }}
    >
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, marginRight: 6 }} />
      <Text
        allowFontScaling={false}
        style={{
          color: active ? color : c.textPrimary,
          fontSize: 13,
          fontWeight: '600',
          lineHeight: 16,
          includeFontPadding: false,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
});
