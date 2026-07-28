import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { supabase } from '@/utils/supabase';
import { useUser } from '@/hooks/use-user';
import { useFocusEffect } from 'expo-router';

type GoalPeriod = 'daily' | 'weekly';
interface StudyGoal {
  id: string;
  period: GoalPeriod;
  target_minutes: number;
  created_at?: string;
  is_active?: boolean;
}

export default function MetasScreen() {
  const c = useThemeColors();
  const user = useUser();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const [currentView, setCurrentView] = useState<'main' | 'create'>('main');

  const [dailyGoal, setDailyGoal] = useState<StudyGoal | null>(null);
  const [weeklyGoal, setWeeklyGoal] = useState<StudyGoal | null>(null);

  const [studiedTodayMinutes, setStudiedTodayMinutes] = useState(0);
  const [studiedWeekMinutes, setStudiedWeekMinutes] = useState(0);

  const [todaySessions, setTodaySessions] = useState<{ subject: string; durationMins: number }[]>([]);
  const [weeklyProgress, setWeeklyProgress] = useState<boolean[]>([false, false, false, false, false, false, false]);

  const [createPeriod, setCreatePeriod] = useState<GoalPeriod>('weekly');
  const [createMinutes, setCreateMinutes] = useState(420);
  const [minutesInputText, setMinutesInputText] = useState('420');
  const [isSaving, setIsSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (user) fetchGoalsAndProgress();
    }, [user])
  );

  const fetchGoalsAndProgress = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const { data: goalsData, error: goalError } = await supabase
        .from('study_goals')
        .select('*')
        .eq('user_id', user!.id)
        .eq('is_active', true);

      if (goalError) throw goalError;

      const activeDaily = goalsData?.find(g => g.period === 'daily') || null;
      const activeWeekly = goalsData?.find(g => g.period === 'weekly') || null;

      setDailyGoal(activeDaily ? { id: activeDaily.id, period: 'daily', target_minutes: activeDaily.target_minutes } : null);
      setWeeklyGoal(activeWeekly ? { id: activeWeekly.id, period: 'weekly', target_minutes: activeWeekly.target_minutes } : null);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const dayOfWeek = today.getDay();
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() + diffToMonday);

      const { data: sessionsData, error: sessionsError } = await supabase
        .from('study_sessions')
        .select('duration, start_time, subjects(name)')
        .eq('user_id', user!.id)
        .gte('start_time', startOfWeek.toISOString());

      if (sessionsError) throw sessionsError;

      if (sessionsData) {
        const todaysSessions = sessionsData.filter(s => new Date(s.start_time) >= today);
        const totalSecondsToday = todaysSessions.reduce((acc, curr) => acc + (curr.duration || 0), 0);
        setStudiedTodayMinutes(Math.floor(totalSecondsToday / 60));

        const formattedSessions = todaysSessions.map(s => ({
          subject: (s.subjects as any)?.name || 'Estudio',
          durationMins: Math.floor((s.duration || 0) / 60)
        }));
        setTodaySessions(formattedSessions);

        const totalSecondsWeek = sessionsData.reduce((acc, curr) => acc + (curr.duration || 0), 0);
        setStudiedWeekMinutes(Math.floor(totalSecondsWeek / 60));

        const dailyTotalsSeconds = [0, 0, 0, 0, 0, 0, 0];
        sessionsData.forEach(session => {
          if (!session.start_time) return;
          const sessionDate = new Date(session.start_time);
          const dayIndex = (sessionDate.getDay() + 6) % 7;
          dailyTotalsSeconds[dayIndex] += (session.duration || 0);
        });

        const referenceDailyTarget = activeDaily ? activeDaily.target_minutes : (activeWeekly ? Math.floor(activeWeekly.target_minutes / 7) : 120);
        const newWeeklyProgress = dailyTotalsSeconds.map(totalSecs => {
          const totalMins = Math.floor(totalSecs / 60);
          return totalMins > 0 && totalMins >= referenceDailyTarget;
        });

        setWeeklyProgress(newWeeklyProgress);
      }
    } catch (e) {
      console.error(e);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGoal = async () => {
    if (createMinutes < 30) return;
    setIsSaving(true);
    setSaveError(false);
    try {
      // Releemos la meta activa vigente de este período justo antes de guardar,
      // en lugar de confiar en el estado en memoria (que puede estar desactualizado).
      // Así evitamos insertar un duplicado cuando ya existe una meta activa.
      const { data: existing, error: findError } = await supabase
        .from('study_goals')
        .select('id')
        .eq('user_id', user!.id)
        .eq('period', createPeriod)
        .eq('is_active', true)
        .maybeSingle();

      if (findError) throw findError;

      if (existing) {
        const { error: updateError } = await supabase
          .from('study_goals')
          .update({
            target_minutes: createMinutes,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('study_goals')
          .insert([{
            user_id: user!.id,
            period: createPeriod,
            target_minutes: createMinutes,
            is_active: true
          }]);
        if (insertError) throw insertError;
      }

      await fetchGoalsAndProgress();
      setCurrentView('main');
    } catch (e) {
      console.error(e);
      setSaveError(true);
    } finally {
      setIsSaving(false);
    }
  };

  const formatTime = (totalMins: number) => {
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h 00m`;
    return `0h ${m}m`;
  };

  const handleMinutesChangeText = (text: string) => {
    const numericOnly = text.replace(/[^0-9]/g, '');
    setMinutesInputText(numericOnly);
    const parsed = parseInt(numericOnly, 10);
    setCreateMinutes(isNaN(parsed) ? 0 : parsed);
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={c.accent} />
      </SafeAreaView>
    );
  }

  if (currentView === 'create') {
    const isInvalid = createMinutes < 30;
    const dailyRecommendationFromWeekly = weeklyGoal ? Math.ceil((weeklyGoal.target_minutes / 7) / 10) * 10 : 0;

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
        <View className="flex-row items-center px-5 pt-4 pb-6">
          <TouchableOpacity onPress={() => setCurrentView('main')} className="mr-4">
            <Ionicons name="chevron-back" size={24} color={c.textPrimary} />
          </TouchableOpacity>
          <Text style={{ color: c.textPrimary }} className="text-xl font-bold">
            {createPeriod === 'weekly' ? (weeklyGoal ? 'Editar meta semanal' : 'Nueva meta semanal') : (dailyGoal ? 'Editar meta diaria' : 'Nueva meta diaria')}
          </Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, flexGrow: 1 }}>
          <Text style={{ color: c.textSecondary }} className="text-xs font-bold mb-3 tracking-wider">TIPO DE META</Text>
          <View style={{ backgroundColor: c.surface }} className="flex-row rounded-xl mb-6 p-1">
            <TouchableOpacity
              style={{ backgroundColor: createPeriod === 'weekly' ? c.accent : 'transparent' }}
              className="flex-1 py-3 rounded-lg items-center"
              onPress={() => {
                setCreatePeriod('weekly');
                const target = weeklyGoal ? weeklyGoal.target_minutes : 420;
                setCreateMinutes(target);
                setMinutesInputText(target.toString());
              }}
            >
              <Text style={{ color: c.textPrimary, fontWeight: createPeriod === 'weekly' ? 'bold' : 'normal' }}>Semanal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ backgroundColor: createPeriod === 'daily' ? c.accent : 'transparent' }}
              className="flex-1 py-3 rounded-lg items-center"
              onPress={() => {
                setCreatePeriod('daily');
                const target = dailyGoal ? dailyGoal.target_minutes : 120;
                setCreateMinutes(target);
                setMinutesInputText(target.toString());
              }}
            >
              <Text style={{ color: c.textPrimary, fontWeight: createPeriod === 'daily' ? 'bold' : 'normal' }}>Diaria</Text>
            </TouchableOpacity>
          </View>

          {/* Recomendación dentro de la meta diaria si hay una meta semanal activa */}
          {createPeriod === 'daily' && weeklyGoal && (
            <View style={{ backgroundColor: c.surface }} className="p-4 rounded-2xl mb-6 border-l-4 border-l-[var(--accent)]">
              <View className="flex-row items-center mb-1">
                <Ionicons name="bulb-outline" size={18} color={c.accent} style={{ marginRight: 6 }} />
                <Text style={{ color: c.textPrimary }} className="font-bold text-sm">Basado en tu meta semanal</Text>
              </View>
              <Text style={{ color: c.textSecondary }} className="text-xs leading-5">
                Para cumplir tu meta semanal actual ({formatTime(weeklyGoal.target_minutes)}), te sugerimos un objetivo diario de aprox. <Text style={{ color: c.textPrimary, fontWeight: 'bold' }}>{formatTime(dailyRecommendationFromWeekly)}</Text>.
              </Text>
            </View>
          )}

          <Text style={{ color: c.textSecondary }} className="text-xs font-bold mb-3 tracking-wider">TIEMPO OBJETIVO (MINUTOS)</Text>
          <View style={{
              backgroundColor: c.surface,
              borderColor: isInvalid ? '#EF4444' : 'transparent',
              borderWidth: 1
            }}
            className="rounded-3xl p-6 items-center mb-2"
          >
            <View className="flex-row items-center justify-center mb-1">
              <TextInput
                style={{ color: isInvalid ? '#EF4444' : c.textPrimary, fontSize: 44, fontWeight: 'bold', textAlign: 'center', minWidth: 120 }}
                keyboardType="numeric"
                value={minutesInputText}
                onChangeText={handleMinutesChangeText}
                maxLength={5}
              />
              <Text style={{ color: c.textSecondary, fontSize: 18, marginLeft: 6 }}>min</Text>
            </View>
            <Text style={{ color: c.textSecondary, fontSize: 13 }}>Equivale a {formatTime(createMinutes)} por {createPeriod === 'weekly' ? 'semana' : 'día'}</Text>
          </View>

          {isInvalid && (
            <Text style={{ color: '#EF4444' }} className="text-xs mb-6 ml-2">• Elegí al menos 30 minutos de estudio</Text>
          )}

          <View className="flex-row justify-center items-center gap-6 mt-2 mb-6">
            <TouchableOpacity
              style={{ backgroundColor: c.surface }} className="w-12 h-12 rounded-full items-center justify-center"
              onPress={() => {
                const newVal = Math.max(0, createMinutes - (createPeriod === 'weekly' ? 60 : 30));
                setCreateMinutes(newVal);
                setMinutesInputText(newVal.toString());
              }}
            >
              <Ionicons name="remove" size={24} color={c.textPrimary} />
            </TouchableOpacity>
            <Text style={{ color: c.textSecondary }}>{createPeriod === 'weekly' ? '-1h' : '-30m'}</Text>
            <TouchableOpacity
              style={{ backgroundColor: c.surface }} className="w-12 h-12 rounded-full items-center justify-center"
              onPress={() => {
                const newVal = createMinutes + (createPeriod === 'weekly' ? 60 : 30);
                setCreateMinutes(newVal);
                setMinutesInputText(newVal.toString());
              }}
            >
              <Ionicons name="add" size={24} color={c.textPrimary} />
            </TouchableOpacity>
          </View>

          <Text style={{ color: c.textSecondary }} className="text-xs font-bold mb-3 tracking-wider">SUGERENCIAS RÁPIDAS</Text>
          <View className="flex-row justify-between mb-6">
            {(createPeriod === 'weekly' ? [300, 420, 600, 840, 1050] : [30, 60, 120, 180, 240]).map(mins => (
              <TouchableOpacity
                key={mins}
                style={{ backgroundColor: createMinutes === mins ? c.accent : c.surface }}
                className="px-2 py-3 rounded-xl flex-1 mx-1 items-center"
                onPress={() => {
                  setCreateMinutes(mins);
                  setMinutesInputText(mins.toString());
                }}
              >
                <Text style={{ color: c.textPrimary, fontSize: 11, fontWeight: createMinutes === mins ? 'bold' : 'normal' }}>
                  {mins < 60 ? `${mins}m` : `${Math.round(mins / 60)}h`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View className="flex-1 justify-end pb-8 mt-6">
            {saveError && (
              <View className="bg-red-500/20 p-4 rounded-xl flex-row items-center mb-4">
                <Ionicons name="alert-circle" size={20} color="#EF4444" className="mr-2" />
                <Text style={{ color: '#EF4444' }} className="ml-2 font-semibold">No se pudo guardar la meta. Reintentá.</Text>
              </View>
            )}
            <TouchableOpacity
              style={{ backgroundColor: isInvalid ? c.surface : c.accent, opacity: isInvalid ? 0.7 : 1 }}
              className="w-full py-4 rounded-xl items-center"
              onPress={handleSaveGoal}
              disabled={isInvalid || isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color={c.textPrimary} />
              ) : (
                <Text style={{ color: isInvalid ? c.textSecondary : c.textPrimary }} className="text-base font-bold">
                  Guardar meta
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!dailyGoal && !weeklyGoal && currentView === 'main') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
        <Text style={{ color: c.textPrimary }} className="text-xl font-bold text-center mt-4 mb-2">Metas</Text>
        <View className="flex-1 justify-center items-center px-6">
          <View style={{ backgroundColor: c.surface }} className="w-20 h-20 rounded-full items-center justify-center mb-8">
            <View style={{ backgroundColor: c.accent, width: 12, height: 12, borderRadius: 6 }} />
          </View>
          <Text style={{ color: c.textPrimary }} className="text-2xl font-bold mb-3 text-center">Definí tus metas de estudio</Text>
          <Text style={{ color: c.textSecondary }} className="text-center mb-10 px-4">
            Fijá tus objetivos semanales o diarios para medir tu constancia.
          </Text>
          <TouchableOpacity
            style={{ backgroundColor: c.accent }}
            className="w-full py-4 rounded-xl items-center mb-4"
            onPress={() => {
              setCreatePeriod('weekly');
              setCreateMinutes(420);
              setMinutesInputText('420');
              setCurrentView('create');
            }}
          >
            <Text style={{ color: c.textPrimary }} className="text-base font-bold">Crear meta</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isDailyMet = dailyGoal ? studiedTodayMinutes >= dailyGoal.target_minutes : false;
  const dailyProgressColor = isDailyMet ? '#10B981' : c.accent;
  const dailyRemaining = dailyGoal ? Math.max(0, dailyGoal.target_minutes - studiedTodayMinutes) : 0;
  const dailyPercentage = dailyGoal ? Math.min(100, Math.round((studiedTodayMinutes / dailyGoal.target_minutes) * 100)) : 0;

  const isWeeklyMet = weeklyGoal ? studiedWeekMinutes >= weeklyGoal.target_minutes : false;
  const weeklyProgressColor = isWeeklyMet ? '#10B981' : c.accent;
  const weeklyRemaining = weeklyGoal ? Math.max(0, weeklyGoal.target_minutes - studiedWeekMinutes) : 0;
  const weeklyPercentage = weeklyGoal ? Math.min(100, Math.round((studiedWeekMinutes / weeklyGoal.target_minutes) * 100)) : 0;

  const daysOfWeek = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const metDaysCount = weeklyProgress.filter(Boolean).length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
      <View className="flex-row items-center px-5 pt-4 pb-6">
        <View className="mr-4 w-6" />
        <Text style={{ color: c.textPrimary }} className="text-xl font-bold flex-1 text-center">Metas</Text>
        <View className="w-6" />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }}>
        {/* ORDEN: PRIMERO LA META SEMANAL */}
        {weeklyGoal ? (
          <View style={{ backgroundColor: c.surface }} className="p-6 rounded-3xl mb-6">
            <View className="flex-row items-center mb-6">
              <View
                style={{ borderColor: weeklyProgressColor, borderWidth: 6 }}
                className="w-24 h-24 rounded-full items-center justify-center mr-6"
              >
                {isWeeklyMet ? (
                   <Ionicons name="checkmark" size={40} color={weeklyProgressColor} />
                ) : (
                  <Text style={{ color: c.textPrimary }} className="text-xl font-bold">{weeklyPercentage}%</Text>
                )}
              </View>

              <View className="flex-1">
                <Text style={{ color: c.textSecondary }} className="text-sm font-semibold mb-1">Meta semanal</Text>
                <Text style={{ color: c.textPrimary }} className="text-2xl font-bold mb-1">
                  {formatTime(studiedWeekMinutes)} / {formatTime(weeklyGoal.target_minutes)}
                </Text>

                {isWeeklyMet ? (
                  <Text style={{ color: weeklyProgressColor }} className="text-sm font-semibold">¡Meta semanal cumplida!</Text>
                ) : (
                  <Text style={{ color: c.accentStrong }} className="text-sm">Te faltan {weeklyRemaining} minutos esta semana</Text>
                )}
              </View>
            </View>

            <TouchableOpacity
              style={{ borderColor: c.separator, borderWidth: 1 }}
              className="py-3 rounded-xl items-center flex-row justify-center"
              onPress={() => {
                setCreatePeriod('weekly');
                setCreateMinutes(weeklyGoal.target_minutes);
                setMinutesInputText(weeklyGoal.target_minutes.toString());
                setCurrentView('create');
              }}
            >
              <Ionicons name="pencil-outline" size={16} color={c.textPrimary} style={{ marginRight: 6 }} />
              <Text style={{ color: c.textPrimary }} className="font-semibold text-sm">Editar meta semanal</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={{ backgroundColor: c.surface, borderStyle: 'dashed', borderWidth: 1.5, borderColor: c.separator }}
            className="p-5 rounded-3xl mb-6 items-center flex-row justify-center"
            onPress={() => {
              setCreatePeriod('weekly');
              setCreateMinutes(420);
              setMinutesInputText('420');
              setCurrentView('create');
            }}
          >
            <Ionicons name="add-circle-outline" size={20} color={c.accent} style={{ marginRight: 8 }} />
            <Text style={{ color: c.textPrimary, fontWeight: 'bold' }}>Agregar meta semanal</Text>
          </TouchableOpacity>
        )}

        {/* SEGUNDO: LA META DIARIA */}
        {dailyGoal ? (
          <View style={{ backgroundColor: c.surface }} className="p-6 rounded-3xl mb-6">
            <View className="flex-row items-center mb-6">
              <View
                style={{ borderColor: dailyProgressColor, borderWidth: 6 }}
                className="w-24 h-24 rounded-full items-center justify-center mr-6"
              >
                {isDailyMet ? (
                   <Ionicons name="checkmark" size={40} color={dailyProgressColor} />
                ) : (
                  <Text style={{ color: c.textPrimary }} className="text-xl font-bold">{dailyPercentage}%</Text>
                )}
              </View>

              <View className="flex-1">
                <Text style={{ color: c.textSecondary }} className="text-sm font-semibold mb-1">Meta diaria</Text>
                <Text style={{ color: c.textPrimary }} className="text-2xl font-bold mb-1">
                  {formatTime(studiedTodayMinutes)} / {formatTime(dailyGoal.target_minutes)}
                </Text>

                {isDailyMet ? (
                  <Text style={{ color: dailyProgressColor }} className="text-sm font-semibold">¡Meta diaria cumplida!</Text>
                ) : (
                  <Text style={{ color: c.accentStrong }} className="text-sm">Te faltan {dailyRemaining} minutos para hoy</Text>
                )}
              </View>
            </View>

            <TouchableOpacity
              style={{ borderColor: c.separator, borderWidth: 1 }}
              className="py-3 rounded-xl items-center flex-row justify-center"
              onPress={() => {
                setCreatePeriod('daily');
                setCreateMinutes(dailyGoal.target_minutes);
                setMinutesInputText(dailyGoal.target_minutes.toString());
                setCurrentView('create');
              }}
            >
              <Ionicons name="pencil-outline" size={16} color={c.textPrimary} style={{ marginRight: 6 }} />
              <Text style={{ color: c.textPrimary }} className="font-semibold text-sm">Editar meta diaria</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={{ backgroundColor: c.surface, borderStyle: 'dashed', borderWidth: 1.5, borderColor: c.separator }}
            className="p-5 rounded-3xl mb-6 items-center flex-row justify-center"
            onPress={() => {
              setCreatePeriod('daily');
              setCreateMinutes(120);
              setMinutesInputText('120');
              setCurrentView('create');
            }}
          >
            <Ionicons name="add-circle-outline" size={20} color={c.accent} style={{ marginRight: 8 }} />
            <Text style={{ color: c.textPrimary, fontWeight: 'bold' }}>Agregar meta diaria</Text>
          </TouchableOpacity>
        )}

        {/* RESUMEN DE LA SEMANA Y SESIONES */}
        <View style={{ backgroundColor: c.surface }} className="p-6 rounded-3xl mb-6">
          <Text style={{ color: c.textPrimary }} className="text-lg font-bold mb-1">Esta semana</Text>
          <Text style={{ color: c.textSecondary }} className="text-sm mb-6">{metDaysCount} de 7 días cumplidos</Text>

          <View className="flex-row justify-between mb-8 px-2">
            {daysOfWeek.map((day, index) => {
              const isDone = weeklyProgress[index];
              return (
                <View key={index} className="items-center">
                  <View
                    style={{ backgroundColor: isDone ? c.accent : c.background }}
                    className="w-8 h-8 rounded-full items-center justify-center mb-2"
                  >
                    {isDone && <Ionicons name="checkmark" size={16} color={c.textPrimary} />}
                  </View>
                  <Text style={{ color: c.textSecondary, fontSize: 12 }}>{day}</Text>
                </View>
              );
            })}
          </View>

          <Text style={{ color: c.textPrimary }} className="text-base font-bold mb-3">Sesiones de hoy</Text>
          {todaySessions.length > 0 ? (
            <Text style={{ color: c.textSecondary }} className="text-sm leading-6">
              {todaySessions.map((s, i) => `${s.subject} · ${s.durationMins}m${i < todaySessions.length - 1 ? ' | ' : ''}`).join('')}
            </Text>
          ) : (
            <Text style={{ color: c.textSecondary }} className="text-sm italic">
              Aún no registraste estudio hoy.
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}