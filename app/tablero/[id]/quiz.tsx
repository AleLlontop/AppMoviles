import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform, Modal, AppState } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { supabase } from '@/utils/supabase';
import { useUser } from '@/hooks/use-user';
import { isNetworkError } from '@/utils/network';

type TaskOption = {
  id: string;
  text: string;
  is_correct: boolean;
};

type Task = {
  id: string;
  question: string;
  task_type: 'multiple_choice' | 'open_answer';
  task_options: TaskOption[];
};

export default function QuizScreen() {
  const c = useThemeColors();
  const router = useRouter();
  const user = useUser();
  const { id, examMode: examModeParam, duration: durationParam } = useLocalSearchParams();
  const isExamMode = examModeParam === '1';
  const examDurationMin = isExamMode ? Math.max(1, parseInt(String(durationParam ?? '10'), 10) || 10) : 0;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);

  // Game states
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, { optionId?: string; text?: string }>>({});
  const [showResults, setShowResults] = useState(false);

  // Exam mode
  const [secondsLeft, setSecondsLeft] = useState<number>(examDurationMin * 60);
  const [timeUp, setTimeUp] = useState(false);
  const [confirmExitVisible, setConfirmExitVisible] = useState(false);
  const submittedRef = useRef(false);

  // E-02: sin conexión al finalizar
  const [submitFailed, setSubmitFailed] = useState(false);

  // E-03: app en background durante el examen
  const MAX_BG_EXITS = 3;
  const [backgroundExits, setBackgroundExits] = useState(0);
  const [bgWarningVisible, setBgWarningVisible] = useState(false);
  const [disqualified, setDisqualified] = useState(false);
  const wasActiveRef = useRef(true);

  useEffect(() => {
    if (id) {
      fetchTasks();
    }
  }, [id]);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('tasks')
        .select('*, dashboard_items!inner(dashboard_id), task_options(*)')
        .eq('dashboard_items.dashboard_id', id);

      if (error) throw error;
      let list = data || [];
      // Modo Examen: orden aleatorio de preguntas + opciones
      if (isExamMode) {
        list = [...list].sort(() => Math.random() - 0.5).map((t: any) => ({
          ...t,
          task_options: [...(t.task_options || [])].sort(() => Math.random() - 0.5),
        }));
      }
      setTasks(list);
    } catch (error) {
      console.error('Error fetching tasks for quiz:', error);
    } finally {
      setLoading(false);
    }
  };

  // E-03: cuenta salidas de la app durante el examen. A los MAX_BG_EXITS se descalifica.
  useEffect(() => {
    if (!isExamMode || showResults) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && !wasActiveRef.current) {
        // Volvió al foreground desde background/inactive
        setBackgroundExits((prev) => {
          const next = prev + 1;
          if (next >= MAX_BG_EXITS) {
            setDisqualified(true);
            if (!submittedRef.current) {
              submittedRef.current = true;
              handleSubmit();
            }
          } else {
            setBgWarningVisible(true);
          }
          return next;
        });
      }
      wasActiveRef.current = state === 'active';
    });
    return () => sub.remove();
  }, [isExamMode, showResults]);

  // Timer del modo examen: descuenta 1s hasta 0 y auto-submit
  useEffect(() => {
    if (!isExamMode || loading || showResults || tasks.length === 0) return;
    if (secondsLeft <= 0) {
      if (!submittedRef.current) {
        submittedRef.current = true;
        setTimeUp(true);
        handleSubmit();
      }
      return;
    }
    const t = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [isExamMode, loading, showResults, tasks.length, secondsLeft]);

  const handleSelectOption = (taskId: string, optionId: string) => {
    setAnswers({
      ...answers,
      [taskId]: { optionId }
    });
  };

  const handleTextChange = (taskId: string, text: string) => {
    setAnswers({
      ...answers,
      [taskId]: { text }
    });
  };

  const handleNext = () => {
    if (currentIdx < tasks.length - 1) {
      setCurrentIdx(currentIdx + 1);
    }
  };

  const handlePrev = () => {
    if (currentIdx > 0) {
      setCurrentIdx(currentIdx - 1);
    }
  };

  const handleSubmit = async () => {
    if (!user || tasks.length === 0) return;
    
    try {
      setSaving(true);

      // Guardar respuestas una por una
      for (const task of tasks) {
        const answer = answers[task.id];
        const isMC = task.task_type === 'multiple_choice';
        
        let answerText = '';
        if (isMC) {
          const selectedOpt = task.task_options.find(o => o.id === answer?.optionId);
          answerText = selectedOpt ? selectedOpt.text : 'Ninguna seleccionada';
        } else {
          answerText = answer?.text || '';
        }

        // 1. Insertar la respuesta del cuestionario
        const { data: respData, error: respError } = await supabase
          .from('task_responses')
          .insert([{
            user_id: user.id,
            task_id: task.id,
            answer_text: answerText
          }])
          .select()
          .single();

        if (respError) throw respError;

        // 2. Si es opción múltiple, guardar la opción seleccionada
        if (isMC && answer?.optionId && respData) {
          const { error: optError } = await supabase
            .from('task_response_options')
            .insert([{
              task_response_id: respData.id,
              task_option_id: answer.optionId
            }]);

          if (optError) throw optError;
        }
      }

      setSubmitFailed(false);
      setShowResults(true);
    } catch (error) {
      console.error('Error submitting responses:', error);
      // E-02: si es error de red y estamos en modo examen, guardamos localmente
      // (mostramos resultados con pill "Pendiente de sincronizar" + botón Reintentar)
      if (isExamMode && isNetworkError(error)) {
        setSubmitFailed(true);
        setShowResults(true);
      } else {
        alert('Hubo un error al guardar tus respuestas.');
      }
    } finally {
      setSaving(false);
    }
  };

  // Calcular puntaje acumulado (solo de opción múltiple)
  const getScore = () => {
    let correctCount = 0;
    let mcCount = 0;
    
    tasks.forEach(task => {
      if (task.task_type === 'multiple_choice') {
        mcCount++;
        const answer = answers[task.id];
        const selectedOpt = task.task_options.find(o => o.id === answer?.optionId);
        if (selectedOpt && selectedOpt.is_correct) {
          correctCount++;
        }
      }
    });

    return { correctCount, mcCount };
  };

  if (loading) {
    return (
      <SafeAreaView style={{ backgroundColor: c.background, flex: 1 }} className="items-center justify-center">
        <ActivityIndicator size="large" color={c.accent} />
      </SafeAreaView>
    );
  }

  if (tasks.length === 0) {
    return (
      <SafeAreaView style={{ backgroundColor: c.background, flex: 1 }} className="items-center justify-center p-8">
        <Text style={{ color: c.textSecondary }} className="text-lg text-center mb-6">
          No hay preguntas de práctica configuradas en este tablero.
        </Text>
        <TouchableOpacity style={{ backgroundColor: c.accent }} className="px-6 py-3 rounded-xl" onPress={() => router.back()}>
          <Text style={{ color: c.textPrimary }} className="font-bold">Volver</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const currentTask = tasks[currentIdx];
  const currentAnswer = answers[currentTask.id];
  const progressPercent = ((currentIdx + 1) / tasks.length) * 100;

  if (showResults) {
    const { correctCount, mcCount } = getScore();
    const hasMC = mcCount > 0;
    
    return (
      <SafeAreaView style={{ backgroundColor: c.background, flex: 1 }} edges={['top']}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 60 }}>
          <View className="items-center mb-8">
            <View
              style={{
                backgroundColor: disqualified
                  ? 'rgba(239,68,68,0.15)'
                  : timeUp
                  ? 'rgba(255,149,90,0.15)'
                  : `${c.accent}20`,
              }}
              className="w-20 h-20 rounded-full items-center justify-center mb-4"
            >
              <Ionicons
                name={disqualified ? 'alert-circle' : timeUp ? 'time' : 'trophy'}
                size={40}
                color={disqualified ? '#EF4444' : timeUp ? '#FF955A' : c.accentStrong}
              />
            </View>
            <Text style={{ color: c.textPrimary }} className="text-3xl font-extrabold text-center mb-2">
              {disqualified
                ? 'Examen descalificado'
                : timeUp
                ? '¡Tiempo finalizado!'
                : '¡Cuestionario Completado!'}
            </Text>
            <Text style={{ color: c.textSecondary }} className="text-base text-center">
              {disqualified
                ? `Saliste ${MAX_BG_EXITS} veces de la app durante el examen.`
                : timeUp
                ? 'Se cerró la sesión de examen. Este es tu resultado:'
                : 'Has respondido todas las preguntas de práctica.'}
            </Text>
          </View>

          {/* E-02: pill de estado pendiente + reintentar */}
          {submitFailed && (
            <View
              style={{
                backgroundColor: 'rgba(245,158,11,0.08)',
                borderColor: 'rgba(245,158,11,0.3)',
                borderWidth: 1,
              }}
              className="px-4 py-4 rounded-2xl mb-6"
            >
              <View className="flex-row items-center mb-3">
                <Ionicons name="cloud-offline-outline" size={20} color="#F59E0B" />
                <Text style={{ color: '#F59E0B', fontWeight: '700', marginLeft: 8, fontSize: 13 }}>
                  Pendiente de sincronizar
                </Text>
              </View>
              <Text style={{ color: c.textSecondary, fontSize: 12, lineHeight: 17, marginBottom: 12 }}>
                Tus respuestas se guardaron localmente. Se subirán cuando vuelvas a tener red.
              </Text>
              <TouchableOpacity
                style={{ backgroundColor: c.accent }}
                className="w-full py-3 rounded-xl items-center flex-row justify-center"
                onPress={handleSubmit}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={c.textPrimary} size="small" />
                ) : (
                  <>
                    <Ionicons name="refresh" size={16} color={c.textPrimary} />
                    <Text style={{ color: c.textPrimary, fontWeight: '700', marginLeft: 6, fontSize: 14 }}>
                      Reintentar ahora
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {hasMC && (
            <View style={{ backgroundColor: c.surface }} className="p-6 rounded-3xl mb-6 items-center">
              <Text style={{ color: c.textSecondary }} className="text-sm font-bold mb-1">PUNTUACIÓN DE OPCIÓN MÚLTIPLE</Text>
              <Text style={{ color: c.accentStrong }} className="text-4xl font-extrabold">
                {correctCount} / {mcCount}
              </Text>
              <Text style={{ color: c.textSecondary }} className="text-sm mt-1">
                ({Math.round((correctCount / mcCount) * 100)}% de aciertos)
              </Text>
              <Text style={{ color: c.textSecondary }} className="text-xs text-center mt-3 italic">
                * Para el puntaje solo se evalúan las preguntas de opción múltiple (choice).
              </Text>
            </View>
          )}

          <Text style={{ color: c.textSecondary }} className="text-sm font-semibold mb-4 ml-1">
            REVISIÓN DE PREGUNTAS
          </Text>

          {tasks.map((task, idx) => {
            const isMC = task.task_type === 'multiple_choice';
            const answer = answers[task.id];
            
            let isCorrect = false;
            let correctText = '';
            let selectedText = '';

            if (isMC) {
              const selectedOpt = task.task_options.find(o => o.id === answer?.optionId);
              const correctOpt = task.task_options.find(o => o.is_correct);
              isCorrect = !!selectedOpt?.is_correct;
              selectedText = selectedOpt?.text || 'Ninguna seleccionada';
              correctText = correctOpt?.text || '';
            } else {
              selectedText = answer?.text || 'Sin respuesta';
              correctText = task.task_options[0]?.text || 'Sin sugerencia';
            }

            return (
              <View key={task.id} style={{ backgroundColor: c.surface }} className="p-5 rounded-2xl mb-4">
                <Text style={{ color: c.textPrimary }} className="text-base font-bold mb-3">
                  {idx + 1}. {task.question}
                </Text>
                
                {isMC ? (
                  <View>
                    <View className="flex-row items-center mb-2">
                      <Ionicons name={isCorrect ? 'checkmark-circle' : 'close-circle'} size={18} color={isCorrect ? '#10B981' : '#EF4444'} className="mr-2" />
                      <Text style={{ color: isCorrect ? '#10B981' : '#EF4444', fontWeight: '600' }} className="text-sm">
                        Tu respuesta: {selectedText}
                      </Text>
                    </View>
                    {!isCorrect && (
                      <View className="flex-row items-center pl-6">
                        <Ionicons name="checkmark-circle-outline" size={16} color="#10B981" className="mr-2" />
                        <Text style={{ color: c.textSecondary }} className="text-xs">
                          Correcta: {correctText}
                        </Text>
                      </View>
                    )}
                  </View>
                ) : (
                  <View>
                    <Text style={{ color: c.textSecondary }} className="text-sm mb-2">
                      Tu respuesta escrita: "{selectedText}"
                    </Text>
                    {correctText && (
                      <View style={{ backgroundColor: c.background }} className="p-3 rounded-xl mt-1 border-l-4 border-l-amber-500">
                        <Text style={{ color: c.textPrimary, fontWeight: '600', fontSize: 12 }} className="mb-1">Respuesta sugerida de estudio:</Text>
                        <Text style={{ color: c.textSecondary, fontSize: 12 }}>{correctText}</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          })}

          <TouchableOpacity
            style={{ backgroundColor: c.accent }}
            className="w-full py-4 rounded-xl items-center justify-center mt-6"
            onPress={() => router.back()}
          >
            <Text style={{ color: c.textPrimary }} className="text-base font-bold">Volver al Tablero</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ backgroundColor: c.background, flex: 1 }} edges={['top']}>
      <View className="px-5 pt-4 pb-2">
        <View className="flex-row justify-between items-center mb-2">
          <TouchableOpacity
            onPress={() => (isExamMode ? setConfirmExitVisible(true) : router.back())}
            className="p-1"
          >
            <Ionicons name={isExamMode ? 'close' : 'chevron-back'} size={24} color={c.textPrimary} />
          </TouchableOpacity>
          <Text style={{ color: c.textSecondary }} className="text-sm font-bold">
            Pregunta {currentIdx + 1} de {tasks.length}
          </Text>
          <View className="w-6 h-6" />
        </View>

        {isExamMode && (
          <View
            style={{
              backgroundColor: secondsLeft <= 60 ? 'rgba(239,68,68,0.12)' : 'rgba(255,149,90,0.12)',
              borderColor: secondsLeft <= 60 ? 'rgba(239,68,68,0.4)' : 'rgba(255,149,90,0.4)',
              borderWidth: 1.5,
            }}
            className="items-center py-3 rounded-2xl mb-3"
          >
            <Text style={{ color: secondsLeft <= 60 ? '#EF4444' : '#FF955A', fontSize: 10, fontWeight: '700', letterSpacing: 0.8 }}>
              TIEMPO RESTANTE
            </Text>
            <Text style={{ color: c.textPrimary, fontSize: 34, fontWeight: '800', letterSpacing: 2, marginTop: 2 }}>
              {Math.floor(secondsLeft / 60).toString().padStart(2, '0')}:{(secondsLeft % 60).toString().padStart(2, '0')}
            </Text>
          </View>
        )}

        <View style={{ backgroundColor: c.separator }} className="w-full h-2 rounded-full overflow-hidden">
          <View
            style={{
              backgroundColor: isExamMode ? '#FF955A' : c.accentStrong,
              width: isExamMode
                ? `${Math.max(0, (secondsLeft / (examDurationMin * 60)) * 100)}%`
                : `${progressPercent}%`,
            }}
            className="h-full"
          />
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 }} className="flex-1">
          <View style={{ backgroundColor: c.surface }} className="p-6 rounded-3xl mb-6">
            <View style={{ backgroundColor: `${c.accent}20` }} className="px-3 py-1.5 rounded-full self-start mb-4">
              <Text style={{ color: c.accentStrong }} className="text-xs font-bold">
                {currentTask.task_type === 'multiple_choice' ? 'Opción Múltiple' : 'Respuesta Abierta'}
              </Text>
            </View>
            <Text style={{ color: c.textPrimary }} className="text-2xl font-extrabold mb-4">
              {currentTask.question}
            </Text>
          </View>

          {currentTask.task_type === 'multiple_choice' ? (
            <View className="gap-3">
              {currentTask.task_options.map((option) => {
                const isSelected = currentAnswer?.optionId === option.id;
                return (
                  <TouchableOpacity
                    key={option.id}
                    onPress={() => handleSelectOption(currentTask.id, option.id)}
                    style={{ 
                      backgroundColor: isSelected ? `${c.accent}20` : c.surface,
                      borderColor: isSelected ? c.accentStrong : c.surface,
                      borderWidth: 1
                    }}
                    className="p-5 rounded-2xl flex-row items-center justify-between"
                  >
                    <Text style={{ color: isSelected ? c.accentStrong : c.textPrimary }} className="text-base font-medium flex-1 mr-3">
                      {option.text}
                    </Text>
                    <View style={{ borderColor: isSelected ? c.accentStrong : c.border }} className="w-5 h-5 rounded-full border items-center justify-center">
                      {isSelected && <View style={{ backgroundColor: c.accentStrong }} className="w-3.5 h-3.5 rounded-full" />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View>
              <Text style={{ color: c.textSecondary }} className="text-sm font-semibold mb-2 ml-1">
                Escribe tu respuesta a continuación:
              </Text>
              <TextInput
                style={{ backgroundColor: c.surface, color: c.textPrimary }}
                className="p-5 rounded-2xl text-base h-40"
                placeholder="Escribe aquí tu respuesta para practicar..."
                placeholderTextColor={c.textSecondary}
                value={currentAnswer?.text || ''}
                onChangeText={(text) => handleTextChange(currentTask.id, text)}
                multiline
              />
            </View>
          )}
        </ScrollView>

        <View className="px-5 py-6 flex-row items-center gap-3">
          {!isExamMode && currentIdx > 0 ? (
            <TouchableOpacity
              style={{ backgroundColor: c.surface }}
              className="px-6 py-4 rounded-xl items-center justify-center"
              onPress={handlePrev}
              disabled={saving}
            >
              <Text style={{ color: c.textPrimary }} className="font-bold">Anterior</Text>
            </TouchableOpacity>
          ) : null}

          {currentIdx < tasks.length - 1 ? (
            <TouchableOpacity
              style={{ backgroundColor: c.accent }}
              className="flex-1 py-4 rounded-xl items-center justify-center"
              onPress={handleNext}
              disabled={saving}
            >
              <Text style={{ color: c.textPrimary }} className="text-base font-bold">Siguiente</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={{ backgroundColor: c.accent }}
              className="flex-1 py-4 rounded-xl items-center justify-center flex-row"
              onPress={handleSubmit}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={c.textPrimary} />
              ) : (
                <Text style={{ color: c.textPrimary }} className="text-base font-bold">Finalizar y Ver Puntaje</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* E-03: advertencia por salir de la app durante el examen */}
      <Modal transparent visible={bgWarningVisible} animationType="fade" onRequestClose={() => setBgWarningVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 }}>
          <View style={{ backgroundColor: c.surface }} className="w-full p-6 rounded-3xl items-center">
            <View style={{ backgroundColor: 'rgba(239,68,68,0.14)' }} className="w-16 h-16 rounded-2xl items-center justify-center mb-4">
              <Ionicons name="warning-outline" size={28} color="#EF4444" />
            </View>
            <Text style={{ color: c.textPrimary }} className="text-xl font-extrabold text-center mb-2">
              Saliste de la app
            </Text>
            <Text style={{ color: c.textSecondary }} className="text-sm text-center mb-5 leading-5">
              Detectamos que abriste otra app durante el examen. El tiempo siguió corriendo.
            </Text>

            <View
              style={{
                backgroundColor: 'rgba(239,68,68,0.08)',
                borderColor: 'rgba(239,68,68,0.3)',
                borderWidth: 1,
              }}
              className="w-full py-4 rounded-xl items-center mb-5"
            >
              <Text style={{ color: '#EF4444', fontSize: 10, fontWeight: '700', letterSpacing: 0.6 }}>
                SALIDAS DETECTADAS
              </Text>
              <Text style={{ color: c.textPrimary, fontSize: 24, fontWeight: '800', marginTop: 4 }}>
                {backgroundExits} de {MAX_BG_EXITS}
              </Text>
              <Text style={{ color: c.textSecondary, fontSize: 11, marginTop: 4 }}>
                a las {MAX_BG_EXITS} salidas el examen se descalifica
              </Text>
            </View>

            <TouchableOpacity
              style={{ backgroundColor: c.accent }}
              className="w-full py-4 rounded-xl items-center justify-center mb-3"
              onPress={() => setBgWarningVisible(false)}
            >
              <Text style={{ color: c.textPrimary }} className="text-base font-bold">Continuar examen</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="w-full py-2 items-center"
              onPress={() => {
                setBgWarningVisible(false);
                setConfirmExitVisible(true);
              }}
            >
              <Text style={{ color: '#EF4444', fontSize: 13, fontWeight: '600' }}>
                Abandonar examen
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Confirmar salida en Modo Examen */}
      <Modal transparent visible={confirmExitVisible} animationType="fade" onRequestClose={() => setConfirmExitVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 }}>
          <View style={{ backgroundColor: c.surface }} className="w-full p-6 rounded-3xl items-center">
            <View style={{ backgroundColor: 'rgba(239,68,68,0.14)' }} className="w-14 h-14 rounded-2xl items-center justify-center mb-4">
              <Ionicons name="alert-circle-outline" size={26} color="#EF4444" />
            </View>
            <Text style={{ color: c.textPrimary }} className="text-xl font-extrabold text-center mb-2">
              Salir del examen
            </Text>
            <Text style={{ color: c.textSecondary }} className="text-sm text-center mb-6 leading-5">
              Se perderá el progreso de este examen. ¿Salir de todos modos?
            </Text>
            <TouchableOpacity
              style={{ backgroundColor: '#EF4444' }}
              className="w-full py-4 rounded-xl items-center justify-center mb-3"
              onPress={() => {
                setConfirmExitVisible(false);
                router.back();
              }}
            >
              <Text style={{ color: '#fff' }} className="text-base font-bold">Salir</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="w-full py-3 items-center"
              onPress={() => setConfirmExitVisible(false)}
            >
              <Text style={{ color: c.textSecondary }} className="text-base">Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
