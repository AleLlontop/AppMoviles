import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { TaskCard } from '@/components/TaskCard';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '@/utils/supabase';
import { useUser } from '@/hooks/use-user';

export default function HomeScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('Timer');
  const user = useUser();
  const userId = user?.id ?? null;

  const [subjects, setSubjects] = useState<any[]>([]);
  const [activeSubjectId, setActiveSubjectId] = useState<string | null>(null);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchSubjects();
    }, [userId])
  );

  const fetchSubjects = async () => {
    let query = supabase.from('subjects').select('*');
    if (userId) {
      query = query.eq('user_id', userId);
    }
    const { data, error } = await query;
    if (data) {
      setSubjects(data);
    } else if (error) {
      console.error('Error fetching subjects:', error);
    }
  };

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (activeSubjectId) {
      interval = setInterval(() => {
        setTimerSeconds(s => s + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeSubjectId]);

  const saveSession = async (subjectId: string, start: Date, durationSeconds: number) => {
    const endTime = new Date();
    const todayLocal = new Date();
    todayLocal.setHours(0, 0, 0, 0);

    const { data } = await supabase
      .from('study_sessions')
      .select('*')
      .eq('subject_id', subjectId)
      .gte('start_time', todayLocal.toISOString())
      .limit(1);

    if (data && data.length > 0) {
      const existing = data[0];
      await supabase.from('study_sessions').update({
        end_time: endTime.toISOString(),
        duration: (existing.duration || 0) + durationSeconds,
      }).eq('id', existing.id);
    } else {
      await supabase.from('study_sessions').insert({
        subject_id: subjectId,
        start_time: start.toISOString(),
        end_time: endTime.toISOString(),
        duration: durationSeconds,
        status: 'completed',
        ...(userId ? { user_id: userId } : {}),
      });
    }
  };

  const toggleTimer = async (subjectId: string) => {
    if (activeSubjectId === subjectId) {
      setActiveSubjectId(null);
      setTimerSeconds(0);

      if (sessionStartTime) {
        const duration = Math.floor((new Date().getTime() - sessionStartTime.getTime()) / 1000);
        await saveSession(subjectId, sessionStartTime, duration);
      }
    } else {
      if (activeSubjectId && sessionStartTime) {
        const duration = Math.floor((new Date().getTime() - sessionStartTime.getTime()) / 1000);
        await saveSession(activeSubjectId, sessionStartTime, duration);
      }

      setActiveSubjectId(subjectId);
      setTimerSeconds(0);
      setSessionStartTime(new Date());
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
  const displayName = user?.user_metadata?.full_name?.split(' ')[0]
    ?? user?.user_metadata?.name?.split(' ')[0]
    ?? null;

  return (
    <View className="flex-1 bg-brand-light">
      {/* Timer header */}
      <View className="h-[300px] bg-brand-lavender items-center justify-center relative overflow-hidden">
        <LinearGradient
          colors={['rgba(255,255,255,0.12)', 'transparent']}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
        {/* Greeting */}
        {displayName && (
          <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 15, fontWeight: '500', marginBottom: 4, zIndex: 10 }}>
            {greeting}, {displayName} 👋
          </Text>
        )}
        <Text className="text-white text-[72px] font-bold tracking-widest z-10">
          {formatTime(timerSeconds)}
        </Text>
        {activeSubjectId && (
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 6, zIndex: 10 }}>
            {subjects.find(s => s.id === activeSubjectId)?.name ?? ''}
          </Text>
        )}
      </View>

      {/* Tab nav */}
      <View className="flex-row bg-white py-4 justify-center items-center shadow-sm z-20" style={{ elevation: 2 }}>
        {(['Timer', 'Estadísticas'] as const).map(tab => (
          <View key={tab} className="mx-2">
            <TouchableOpacity
              className={activeTab === tab ? 'bg-brand-accent px-6 py-2.5 rounded-full items-center justify-center min-w-[120px]' : 'px-6 py-2.5 items-center justify-center min-w-[120px]'}
              style={activeTab === tab ? { shadowColor: '#826BF0', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.39, shadowRadius: 14, elevation: 8 } : {}}
              onPress={() => {
                setActiveTab(tab);
                if (tab === 'Estadísticas') router.push('/(tabs)/estadisticas');
              }}
            >
              <Text className={activeTab === tab ? 'text-white text-sm font-semibold' : 'text-brand-accent text-sm font-medium'}>
                {tab}
              </Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {/* Subject list */}
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>

        {/* Section header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#7B7486', letterSpacing: 0.8, textTransform: 'uppercase' }}>
            Materias · {subjects.length}
          </Text>
        </View>

        {subjects.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 32, gap: 8 }}>
            <Text style={{ fontSize: 32 }}>📚</Text>
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#191C1E' }}>Sin materias aún</Text>
            <Text style={{ fontSize: 13, color: '#7B7486', textAlign: 'center' }}>
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
                onEdit={() => router.push({ pathname: '/add-subject', params: { id: subject.id } })}
                onDelete={() => {
                  Alert.alert('Eliminar Materia', '¿Estás seguro?', [
                    { text: 'Cancelar', style: 'cancel' },
                    {
                      text: 'Eliminar', style: 'destructive', onPress: async () => {
                        const { error } = await supabase.from('subjects').delete().eq('id', subject.id);
                        if (!error) {
                          setSubjects(s => s.filter(x => x.id !== subject.id));
                          if (activeSubjectId === subject.id) { setActiveSubjectId(null); setTimerSeconds(0); }
                        }
                      }
                    }
                  ]);
                }}
              />
            );
          })
        )}

        {/* Action button */}
        <TouchableOpacity
          style={{ paddingVertical: 14, paddingHorizontal: 24, borderWidth: 1.5, borderColor: 'rgba(130,107,240,0.2)', backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          onPress={() => router.push('/add-subject')}
        >
          <Text style={{ fontSize: 20, color: '#826BF0', lineHeight: 22 }}>+</Text>
          <Text style={{ fontSize: 15, color: '#826BF0', fontWeight: '600' }}>Nueva materia</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
