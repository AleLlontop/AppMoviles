import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { supabase } from '@/utils/supabase';
import { useUser } from '@/hooks/use-user';

type TaskOption = {
  id: string;
  text: string;
  is_correct: boolean;
};

type Task = {
  id: string;
  quesion: string; // Columna 'quesion' en Supabase
  task_type: 'multiple_choice' | 'open_answer';
  task_options: TaskOption[];
};

export default function QuizScreen() {
  const c = useThemeColors();
  const router = useRouter();
  const user = useUser();
  const { id } = useLocalSearchParams(); // dashboard_id

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  
  // Game states
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, { optionId?: string; text?: string }>>({});
  const [showResults, setShowResults] = useState(false);

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
      setTasks(data || []);
    } catch (error) {
      console.error('Error fetching tasks for quiz:', error);
    } finally {
      setLoading(false);
    }
  };

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

      setShowResults(true);
    } catch (error) {
      console.error('Error submitting responses:', error);
      alert('Hubo un error al guardar tus respuestas.');
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
            <View style={{ backgroundColor: `${c.accent}20` }} className="w-20 h-20 rounded-full items-center justify-center mb-4">
              <Ionicons name="trophy" size={40} color={c.accentStrong} />
            </View>
            <Text style={{ color: c.textPrimary }} className="text-3xl font-extrabold text-center mb-2">
              ¡Cuestionario Completado!
            </Text>
            <Text style={{ color: c.textSecondary }} className="text-base text-center">
              Has respondido todas las preguntas de práctica.
            </Text>
          </View>

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
                  {idx + 1}. {task.quesion}
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
          <TouchableOpacity onPress={() => router.back()} className="p-1">
            <Ionicons name="chevron-back" size={24} color={c.textPrimary} />
          </TouchableOpacity>
          <Text style={{ color: c.textSecondary }} className="text-sm font-bold">
            Pregunta {currentIdx + 1} de {tasks.length}
          </Text>
          <View className="w-6 h-6" />
        </View>
        <View style={{ backgroundColor: c.separator }} className="w-full h-2 rounded-full overflow-hidden">
          <View style={{ backgroundColor: c.accentStrong, width: `${progressPercent}%` }} className="h-full" />
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
              {currentTask.quesion}
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
          {currentIdx > 0 ? (
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
    </SafeAreaView>
  );
}
