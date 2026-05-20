import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { TaskCard } from '@/components/TaskCard';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '@/utils/supabase';
import { useUser } from '@/hooks/use-user';
import { useAppStore } from '@/store/useAppStore';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { useNetworkSync } from '@/hooks/use-network-sync';
import { isNetworkError } from '@/utils/network';

export default function HomeScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('Timer');
  const user = useUser();
  const userId = user?.id ?? null;
  const c = useThemeColors();

  const [subjects, setSubjects] = useState<any[]>([]);
  const [showConnected, setShowConnected] = useState(false);

  const {
    activeSubjectId,
    timerSeconds,
    sessionStartTime,
    startTimer,
    stopTimer,
    tick,
    recoverTimer,
    addPendingSession,
    cachedSubjects,
    setCachedSubjects,
    isOnline,
    setOnlineStatus,
    pendingQueue,
  } = useAppStore();

  // Activa el sync en background (RNF-03)
  useNetworkSync();

  // Suscripción directa al store para detectar false→true en isOnline,
  // independiente del ciclo de renders del tick del cronómetro
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const unsub = useAppStore.subscribe((state, prev) => {
      if (!prev.isOnline && state.isOnline) {
        setShowConnected(true);
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => setShowConnected(false), 2500);
      }
    });
    return () => {
      unsub();
      clearTimeout(timeoutId);
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchSubjects();
    }, [userId])
  );

  const fetchSubjects = async () => {
    let query = supabase.from('subjects').select('*');
    if (userId) query = query.eq('user_id', userId);

    const { data, error } = await query;
    if (data) {
      setSubjects(data);
      setCachedSubjects(data);
      setOnlineStatus(true);
    } else if (error) {
      if (isNetworkError(error)) {
        // Error de red: usa el caché silenciosamente, el banner offline lo indica
        if (cachedSubjects.length > 0) setSubjects(cachedSubjects);
        setOnlineStatus(false);
      } else {
        console.error('Error fetching subjects:', error);
      }
    }
  };

  // Inicia el interval y sincroniza el tiempo real desde sessionStartTime (RNF-04)
  useEffect(() => {
    if (!activeSubjectId) return;
    recoverTimer();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [activeSubjectId]);

  const saveSession = async (subjectId: string, start: Date, durationSeconds: number) => {
    const endTime = new Date();
    const todayLocal = new Date();
    todayLocal.setHours(0, 0, 0, 0);

    try {
      const { data, error: fetchError } = await supabase
        .from('study_sessions')
        .select('*')
        .eq('subject_id', subjectId)
        .gte('start_time', todayLocal.toISOString())
        .limit(1);

      if (fetchError) throw fetchError;

      if (data && data.length > 0) {
        const existing = data[0];
        const { error: updateError } = await supabase
          .from('study_sessions')
          .update({
            end_time: endTime.toISOString(),
            duration: (existing.duration || 0) + durationSeconds,
          })
          .eq('id', existing.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from('study_sessions').insert({
          subject_id: subjectId,
          start_time: start.toISOString(),
          end_time: endTime.toISOString(),
          duration: durationSeconds,
          status: 'completed',
          ...(userId ? { user_id: userId } : {}),
        });
        if (insertError) throw insertError;
      }

      setOnlineStatus(true);
    } catch (e) {
      if (isNetworkError(e)) {
        // Encola la sesión para sincronizar cuando vuelva la conexión (RNF-03)
        addPendingSession({
          id: `${subjectId}-${Date.now()}`,
          subjectId,
          userId,
          startTime: start.toISOString(),
          endTime: endTime.toISOString(),
          duration: durationSeconds,
        });
        setOnlineStatus(false);
      }
    }
  };

  const toggleTimer = async (subjectId: string) => {
    if (activeSubjectId === subjectId) {
      if (sessionStartTime) {
        const duration = Math.floor(
          (new Date().getTime() - new Date(sessionStartTime).getTime()) / 1000
        );
        await saveSession(subjectId, new Date(sessionStartTime), duration);
      }
      stopTimer();
    } else {
      if (activeSubjectId && sessionStartTime) {
        const duration = Math.floor(
          (new Date().getTime() - new Date(sessionStartTime).getTime()) / 1000
        );
        await saveSession(activeSubjectId, new Date(sessionStartTime), duration);
      }
      startTimer(subjectId);
    }
  };

  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Buenos días';
    if (h < 19) return 'Buenas tardes';
    return 'Buenas noches';
  })();
  const displayName =
    user?.user_metadata?.full_name?.split(' ')[0] ??
    user?.user_metadata?.name?.split(' ')[0] ??
    null;

  return (
    <View className="flex-1" style={{ backgroundColor: c.background }}>
      {/* Timer header */}
      <View
        className="h-[300px] items-center justify-center relative overflow-hidden"
        style={{ backgroundColor: c.timerHeader }}
      >
        <LinearGradient
          colors={['rgba(255,255,255,0.12)', 'transparent']}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
        {displayName && (
          <Text
            style={{
              color: 'rgba(255,255,255,0.75)',
              fontSize: 15,
              fontWeight: '500',
              marginBottom: 4,
              zIndex: 10,
            }}
          >
            {greeting}, {displayName} 👋
          </Text>
        )}
        <Text className="text-white text-[72px] font-bold tracking-widest z-10">
          {formatTime(timerSeconds)}
        </Text>
        {activeSubjectId && (
          <Text
            style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 6, zIndex: 10 }}
          >
            {subjects.find((s) => s.id === activeSubjectId)?.name ?? ''}
          </Text>
        )}
      </View>

      {/* Banner offline (RNF-03) */}
      {!isOnline && (
        <View
          style={{
            backgroundColor: '#F59E0B',
            paddingVertical: 6,
            paddingHorizontal: 12,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: 'white', fontSize: 12, fontWeight: '600' }}>
            Sin conexión
            {pendingQueue.length > 0
              ? ` · ${pendingQueue.length} sesión${pendingQueue.length !== 1 ? 'es' : ''} por sincronizar`
              : ''}
          </Text>
        </View>
      )}

      {/* Banner conectado — visible 2.5s al recuperar la conexión */}
      {showConnected && (
        <View
          style={{
            backgroundColor: '#22C55E',
            paddingVertical: 6,
            paddingHorizontal: 12,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: 'white', fontSize: 12, fontWeight: '600' }}>
            Conectado · Sesiones sincronizadas
          </Text>
        </View>
      )}

      {/* Tab nav */}
      <View
        className="flex-row py-4 justify-center items-center shadow-sm z-20"
        style={{ backgroundColor: c.surface, elevation: 2 }}
      >
        {(['Timer', 'Estadísticas'] as const).map((tab) => (
          <View key={tab} className="mx-2">
            <TouchableOpacity
              className={
                activeTab === tab
                  ? 'bg-brand-accent px-6 py-2.5 rounded-full items-center justify-center min-w-[120px]'
                  : 'px-6 py-2.5 items-center justify-center min-w-[120px]'
              }
              style={
                activeTab === tab
                  ? {
                      shadowColor: '#826BF0',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.39,
                      shadowRadius: 14,
                      elevation: 8,
                    }
                  : {}
              }
              onPress={() => {
                setActiveTab(tab);
                if (tab === 'Estadísticas') router.push('/(tabs)/estadisticas');
              }}
            >
              <Text
                className={
                  activeTab === tab
                    ? 'text-white text-sm font-semibold'
                    : 'text-brand-accent text-sm font-medium'
                }
              >
                {tab}
              </Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {/* Subject list */}
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Section header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 14,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: '600',
              color: c.textSecondary,
              letterSpacing: 0.8,
              textTransform: 'uppercase',
            }}
          >
            Materias · {subjects.length}
          </Text>
        </View>

        {subjects.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 32, gap: 8 }}>
            <Text style={{ fontSize: 32 }}>📚</Text>
            <Text style={{ fontSize: 16, fontWeight: '600', color: c.textPrimary }}>
              Sin materias aún
            </Text>
            <Text style={{ fontSize: 13, color: c.textSecondary, textAlign: 'center' }}>
              Agregá tu primera materia para empezar a estudiar
            </Text>
          </View>
        ) : (
          subjects.map((subject) => {
            const isActive = activeSubjectId === subject.id;
            return (
              <TaskCard
                key={subject.id}
                name={subject.name}
                time={isActive ? formatTime(timerSeconds) : '00:00:00'}
                active={isActive}
                color={subject.color}
                onPress={() => toggleTimer(subject.id)}
                onEdit={() =>
                  router.push({ pathname: '/add-subject', params: { id: subject.id } })
                }
                onDelete={() => {
                  Alert.alert('Eliminar Materia', '¿Estás seguro?', [
                    { text: 'Cancelar', style: 'cancel' },
                    {
                      text: 'Eliminar',
                      style: 'destructive',
                      onPress: async () => {
                        const { error } = await supabase
                          .from('subjects')
                          .delete()
                          .eq('id', subject.id);
                        if (!error) {
                          setSubjects((s) => s.filter((x) => x.id !== subject.id));
                          if (activeSubjectId === subject.id) stopTimer();
                        }
                      },
                    },
                  ]);
                }}
              />
            );
          })
        )}

        {/* Action button */}
        <TouchableOpacity
          style={{
            paddingVertical: 14,
            paddingHorizontal: 24,
            borderWidth: 1.5,
            borderColor: 'rgba(130,107,240,0.2)',
            backgroundColor: 'rgba(255,255,255,0.6)',
            borderRadius: 20,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
          onPress={() => router.push('/add-subject')}
        >
          <Text style={{ fontSize: 20, color: '#826BF0', lineHeight: 22 }}>+</Text>
          <Text style={{ fontSize: 15, color: '#826BF0', fontWeight: '600' }}>Nueva materia</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
