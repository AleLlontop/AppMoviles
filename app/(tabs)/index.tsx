import React, {
  useState,
  useEffect,
  useCallback,
} from 'react';

import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';

import { TaskCard } from '@/components/TaskCard';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

import { supabase } from '@/utils/supabase';

export default function HomeScreen() {
  const router = useRouter();

  const [activeTab, setActiveTab] =
    useState('Timer');

  const [subjects, setSubjects] =
    useState<any[]>([]);

  const [activeSubjectId, setActiveSubjectId] =
    useState<string | null>(null);

  const [timerSeconds, setTimerSeconds] =
    useState(0);

  const [sessionStartTime, setSessionStartTime] =
    useState<Date | null>(null);

  const [user, setUser] = useState<any>(null);

  // =========================
  // LOAD USER
  // =========================
  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      console.log(
        'Error loading session:',
        error
      );

      setUser(null);
      setSubjects([]);

      return;
    }

    if (session?.user) {
      console.log(
        'USER:',
        session.user
      );

      setUser(session.user);
    } else {
      console.log('NO SESSION');

      setUser(null);

      setSubjects([]);

      setActiveSubjectId(null);

      setTimerSeconds(0);

      setSessionStartTime(null);
    }
  };

  // =========================
  // AUTH LISTENER
  // =========================
  useEffect(() => {
    const {
      data: authListener,
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          setUser(session.user);
        } else {
          setUser(null);

          setSubjects([]);

          setActiveSubjectId(null);

          setTimerSeconds(0);

          setSessionStartTime(null);
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // =========================
  // FETCH SUBJECTS
  // =========================
  useFocusEffect(
    useCallback(() => {
      if (user) {
        fetchSubjects();
      }
    }, [user])
  );

  const fetchSubjects = async () => {
    if (!user) return;

    console.log(
      'FETCHING SUBJECTS FOR:',
      user.id
    );

    const { data, error } =
      await supabase
        .from('subjects')
        .select('*')
        .eq('user_id', user.id);

    console.log('SUBJECTS:', data);
    console.log('ERROR:', error);

    if (error) {
      console.log(
        'Error fetching subjects:',
        error
      );
      return;
    }

    setSubjects(data || []);
  };

  // =========================
  // TIMER
  // =========================
  useEffect(() => {
    let interval: ReturnType<
      typeof setInterval
    >;

    if (activeSubjectId) {
      interval = setInterval(() => {
        setTimerSeconds((s) => s + 1);
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeSubjectId]);

  // =========================
  // SAVE SESSION
  // =========================
  const saveSession = async (
    subjectId: string,
    start: Date,
    durationSeconds: number
  ) => {
    if (!user) return;

    const endTime = new Date();

    const todayLocal = new Date();

    todayLocal.setHours(0, 0, 0, 0);

    const { data } = await supabase
      .from('study_sessions')
      .select('*')
      .eq('subject_id', subjectId)
      .eq('user_id', user.id)
      .gte(
        'start_time',
        todayLocal.toISOString()
      )
      .limit(1);

    if (data && data.length > 0) {
      const existing = data[0];

      await supabase
        .from('study_sessions')
        .update({
          end_time: endTime.toISOString(),

          duration:
            (existing.duration || 0) +
            durationSeconds,
        })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('study_sessions')
        .insert({
          subject_id: subjectId,

          user_id: user.id,

          start_time: start.toISOString(),

          end_time: endTime.toISOString(),

          duration: durationSeconds,

          status: 'completed',
        });
    }
  };

  // =========================
  // TOGGLE TIMER
  // =========================
  const toggleTimer = async (
    subjectId: string
  ) => {
    if (!user) return;

    if (activeSubjectId === subjectId) {
      setActiveSubjectId(null);

      if (sessionStartTime) {
        const duration = Math.floor(
          (new Date().getTime() -
            sessionStartTime.getTime()) /
            1000
        );

        await saveSession(
          subjectId,
          sessionStartTime,
          duration
        );
      }

      setTimerSeconds(0);
    } else {
      if (
        activeSubjectId &&
        sessionStartTime
      ) {
        const duration = Math.floor(
          (new Date().getTime() -
            sessionStartTime.getTime()) /
            1000
        );

        await saveSession(
          activeSubjectId,
          sessionStartTime,
          duration
        );
      }

      setActiveSubjectId(subjectId);

      setTimerSeconds(0);

      setSessionStartTime(new Date());
    }
  };

  // =========================
  // FORMAT TIME
  // =========================
  const formatTime = (
    totalSeconds: number
  ) => {
    const h = Math.floor(
      totalSeconds / 3600
    )
      .toString()
      .padStart(2, '0');

    const m = Math.floor(
      (totalSeconds % 3600) / 60
    )
      .toString()
      .padStart(2, '0');

    const s = (totalSeconds % 60)
      .toString()
      .padStart(2, '0');

    return `${h}:${m}:${s}`;
  };

  // =========================
  // DELETE SUBJECT
  // =========================
  const deleteSubject = async (
    subjectId: string
  ) => {
    if (!user) return;

    const { error } = await supabase
      .from('subjects')
      .delete()
      .eq('id', subjectId)
      .eq('user_id', user.id);

    if (!error) {
      setSubjects((s) =>
        s.filter(
          (x) => x.id !== subjectId
        )
      );

      if (
        activeSubjectId === subjectId
      ) {
        setActiveSubjectId(null);
        setTimerSeconds(0);
      }
    } else {
      console.error(
        'Error deleting subject:',
        error
      );
    }
  };

  // =========================
  // UI
  // =========================
  return (
    <View className="flex-1 bg-brand-light">
      {/* TOP TIMER */}
      <View className="h-[335px] min-h-[280px] bg-brand-lavender items-center justify-center relative overflow-hidden">
        <LinearGradient
          colors={[
            'rgba(255,255,255,0.1)',
            'transparent',
          ]}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          }}
        />

        <View className="z-10">
          <Text className="text-white text-[80px] font-bold tracking-widest">
            {formatTime(timerSeconds)}
          </Text>
        </View>
      </View>

      {/* TABS */}
      <View
        className="flex-row bg-white py-4 justify-center items-center shadow-sm z-20"
        style={{ elevation: 2 }}
      >
        <View className="mx-2">
          <TouchableOpacity
            className={
              activeTab === 'Timer'
                ? 'bg-brand-accent px-6 py-2.5 rounded-full items-center justify-center min-w-[120px]'
                : 'px-6 py-2.5 items-center justify-center min-w-[120px]'
            }
            onPress={() =>
              setActiveTab('Timer')
            }
          >
            <Text
              className={
                activeTab === 'Timer'
                  ? 'text-white text-sm font-semibold text-center'
                  : 'text-brand-accent text-sm font-medium text-center'
              }
            >
              Timer
            </Text>
          </TouchableOpacity>
        </View>

        <View className="mx-2">
          <TouchableOpacity
            className={
              activeTab ===
              'estadisticas'
                ? 'bg-brand-accent px-6 py-2.5 rounded-full items-center justify-center min-w-[120px]'
                : 'px-6 py-2.5 items-center justify-center min-w-[120px]'
            }
            onPress={() =>
              setActiveTab(
                'estadisticas'
              )
            }
          >
            <Text
              className={
                activeTab ===
                'estadisticas'
                  ? 'text-white text-sm font-semibold text-center'
                  : 'text-brand-accent text-sm font-medium text-center'
              }
            >
              Estadísticas
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* SUBJECTS */}
      <ScrollView
        contentContainerClassName="p-6 pb-[120px]"
        showsVerticalScrollIndicator={
          false
        }
      >
        {/* NO USER */}
        {!user ? (
          <View className="items-center justify-center mt-20 px-6">
            <Text className="text-3xl mb-4">
              😵
            </Text>

            <Text className="text-2xl font-bold text-brand-accent text-center">
              Oops...
            </Text>

            <Text className="text-base text-gray-500 text-center mt-3 leading-6">
              Primero crea una cuenta
              o inicia sesión para
              crear materias y usar
              los timers.
            </Text>
          </View>
        ) : (
          <>
            {subjects.map((subject) => {
              const isActive =
                activeSubjectId ===
                subject.id;

              return (
                <TaskCard
                  key={subject.id}
                  name={subject.name}
                  time={
                    isActive
                      ? formatTime(
                          timerSeconds
                        )
                      : '00:00:00'
                  }
                  active={isActive}
                  color={subject.color}
                  onPress={() =>
                    toggleTimer(
                      subject.id
                    )
                  }
                  onEdit={() =>
                    router.push({
                      pathname:
                        '/add-subject',
                      params: {
                        id: subject.id,
                      },
                    })
                  }
                  onDelete={() => {
                    Alert.alert(
                      'Eliminar Materia',
                      '¿Estás seguro de que quieres eliminar esta materia?',
                      [
                        {
                          text: 'Cancelar',
                          style:
                            'cancel',
                        },

                        {
                          text: 'Eliminar',
                          style:
                            'destructive',

                          onPress: () =>
                            deleteSubject(
                              subject.id
                            ),
                        },
                      ]
                    );
                  }}
                />
              );
            })}

            {/* BUTTONS */}
            <View className="flex-row gap-4 pt-8">
              <TouchableOpacity
                className="flex-1 py-3 px-4 border border-brand-accent/20 bg-white/50 rounded-[20px] flex-row items-center justify-center"
                onPress={() =>
                  router.push(
                    '/add-subject'
                  )
                }
              >
                <Text className="text-lg text-brand-accent mr-2 font-medium">
                  +
                </Text>

                <Text className="text-base text-brand-accent font-medium">
                  Subject
                </Text>
              </TouchableOpacity>

              <TouchableOpacity className="flex-1 py-3 px-4 border border-brand-accent/20 bg-white/50 rounded-[20px] flex-row items-center justify-center">
                <Text className="text-lg text-brand-accent mr-2 font-medium">
                  +
                </Text>

                <Text className="text-base text-brand-accent font-medium">
                  To-do
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}