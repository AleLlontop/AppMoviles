import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { supabase } from '@/utils/supabase';
import { useUser } from '@/hooks/use-user';

type TaskOption = { id: string; text: string; is_correct: boolean; };
type Task = { id: string; question: string; task_type: 'multiple_choice' | 'open_answer'; task_options: TaskOption[]; };

export default function GroupQuizScreen() {
  const c = useThemeColors();
  const router = useRouter();
  const user = useUser();

  const { id: group_id, activity_id } = useLocalSearchParams<{ id: string, activity_id: string }>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [actType, setActType] = useState('task'); // <- Guarda si es form o task

  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, { optionId?: string; text?: string }>>({});
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    if (activity_id) fetchTasks();
  }, [activity_id]);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      // Buscamos el tipo de actividad
      const { data: actData } = await supabase.from('group_activities').select('type').eq('id', activity_id).single();
      if (actData) setActType(actData.type);

      const { data, error } = await supabase.from('tasks').select('*, task_options(*)').eq('group_activity_id', activity_id);
      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOption = (taskId: string, optionId: string) => { setAnswers({ ...answers, [taskId]: { optionId } }); };
  const handleTextChange = (taskId: string, text: string) => { setAnswers({ ...answers, [taskId]: { text } }); };
  const handleNext = () => { if (currentIdx < tasks.length - 1) setCurrentIdx(currentIdx + 1); };
  const handlePrev = () => { if (currentIdx > 0) setCurrentIdx(currentIdx - 1); };

  const handleSubmit = async () => {
    if (!user || tasks.length === 0) return;
    try {
      setSaving(true);
      const taskIds = tasks.map(t => t.id);
      const { data: oldResps } = await supabase.from('task_responses').select('id').eq('user_id', user.id).in('task_id', taskIds);

      if (oldResps && oldResps.length > 0) {
        const oldIds = oldResps.map(r => r.id);
        await supabase.from('task_response_options').delete().in('task_response_id', oldIds);
        await supabase.from('task_responses').delete().in('id', oldIds);
      }

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

        const { data: respData, error: respError } = await supabase.from('task_responses').insert([{
          user_id: user.id, task_id: task.id, answer_text: answerText
        }]).select().single();

        if (respError) throw respError;

        if (isMC && answer?.optionId && respData) {
          await supabase.from('task_response_options').insert([{ task_response_id: respData.id, task_option_id: answer.optionId }]);
        }
      }
      setShowResults(true);
    } catch (error) {
      alert('Hubo un error al guardar tus respuestas.');
    } finally {
      setSaving(false);
    }
  };

  const getScore = () => {
    let correctCount = 0; let mcCount = 0;
    tasks.forEach(task => {
      if (task.task_type === 'multiple_choice') {
        mcCount++;
        const answer = answers[task.id];
        const selectedOpt = task.task_options.find(o => o.id === answer?.optionId);
        if (selectedOpt && selectedOpt.is_correct) correctCount++;
      }
    });
    return { correctCount, mcCount };
  };

  if (loading) return <SafeAreaView style={{ backgroundColor: c.background, flex: 1 }} className="items-center justify-center"><ActivityIndicator size="large" color={c.accent} /></SafeAreaView>;
  if (tasks.length === 0) return <SafeAreaView style={{ backgroundColor: c.background, flex: 1 }} className="items-center justify-center p-8"><Text style={{ color: c.textPrimary }}>Sin preguntas.</Text><TouchableOpacity style={{ backgroundColor: c.accent }} className="px-6 py-3 mt-4 rounded-xl" onPress={() => router.back()}><Text style={{ color: c.textPrimary }}>Volver</Text></TouchableOpacity></SafeAreaView>;

  const currentTask = tasks[currentIdx];
  const currentAnswer = answers[currentTask.id];
  const progressPercent = ((currentIdx + 1) / tasks.length) * 100;

  if (showResults) {
    const { correctCount, mcCount } = getScore();

    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={{ backgroundColor: c.background, flex: 1 }} edges={['top']}>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 60 }}>
            <View className="items-center mb-8">
              <View style={{ backgroundColor: `${c.accent}20` }} className="w-20 h-20 rounded-full items-center justify-center mb-4"><Ionicons name="checkmark-done" size={40} color={c.accentStrong} /></View>
              <Text style={{ color: c.textPrimary }} className="text-3xl font-extrabold text-center mb-2">¡Completado!</Text>
              <Text style={{ color: c.textSecondary }} className="text-base text-center">Tus respuestas han sido enviadas.</Text>
            </View>

            {actType === 'form' ? (
              <View style={{ backgroundColor: c.surface }} className="p-6 rounded-3xl mb-6 items-center">
                <Text style={{ color: c.textSecondary }} className="text-sm font-bold mb-1">PUNTUACIÓN</Text>
                <Text style={{ color: c.accentStrong }} className="text-4xl font-extrabold">{correctCount} / {mcCount}</Text>
                <Text style={{ color: c.textSecondary }} className="text-sm mt-1">({Math.round((correctCount / mcCount) * 100)}% de aciertos)</Text>
              </View>
            ) : (
              <View style={{ backgroundColor: c.surface, borderLeftColor: c.accentStrong, borderLeftWidth: 4 }} className="p-6 rounded-3xl mb-6">
                <Text style={{ color: c.textPrimary }} className="text-base font-bold mb-2">Evaluación Pendiente</Text>
                <Text style={{ color: c.textSecondary }} className="text-sm">Tus respuestas de desarrollo han sido guardadas con éxito. El administrador del grupo las revisará y te asignará una nota pronto.</Text>
              </View>
            )}

            <TouchableOpacity style={{ backgroundColor: c.accent }} className="w-full py-4 rounded-xl items-center justify-center mt-2" onPress={() => router.back()}>
              <Text style={{ color: c.textPrimary }} className="text-base font-bold">Volver a la Actividad</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={{ backgroundColor: c.background, flex: 1 }} edges={['top']}>
        <View className="px-5 pt-4 pb-2">
          <View className="flex-row justify-between items-center mb-2">
            <TouchableOpacity onPress={() => router.back()} className="p-1"><Ionicons name="chevron-back" size={24} color={c.textPrimary} /></TouchableOpacity>
            <Text style={{ color: c.textSecondary }} className="text-sm font-bold">Pregunta {currentIdx + 1} de {tasks.length}</Text>
            <View className="w-6 h-6" />
          </View>
          <View style={{ backgroundColor: c.separator }} className="w-full h-2 rounded-full overflow-hidden"><View style={{ backgroundColor: c.accentStrong, width: `${progressPercent}%` }} className="h-full" /></View>
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 }} className="flex-1">
            <View style={{ backgroundColor: c.surface }} className="p-6 rounded-3xl mb-6">
              <Text style={{ color: c.textPrimary }} className="text-2xl font-extrabold mb-4">{currentTask.question}</Text>
            </View>

            {currentTask.task_type === 'multiple_choice' ? (
              <View className="gap-3">
                {currentTask.task_options.map((option) => {
                  const isSelected = currentAnswer?.optionId === option.id;
                  return (
                    <TouchableOpacity key={option.id} onPress={() => handleSelectOption(currentTask.id, option.id)} style={{ backgroundColor: isSelected ? `${c.accent}20` : c.surface, borderColor: isSelected ? c.accentStrong : c.surface, borderWidth: 1 }} className="p-5 rounded-2xl flex-row items-center justify-between">
                      <Text style={{ color: isSelected ? c.accentStrong : c.textPrimary }} className="text-base font-medium flex-1 mr-3">{option.text}</Text>
                      <View style={{ borderColor: isSelected ? c.accentStrong : c.border }} className="w-5 h-5 rounded-full border items-center justify-center">{isSelected && <View style={{ backgroundColor: c.accentStrong }} className="w-3.5 h-3.5 rounded-full" />}</View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <View>
                <Text style={{ color: c.textSecondary }} className="text-sm font-semibold mb-2 ml-1">Desarrollo:</Text>
                <TextInput style={{ backgroundColor: c.surface, color: c.textPrimary }} className="p-5 rounded-2xl text-base h-40" placeholder="Escribe aquí..." placeholderTextColor={c.textSecondary} value={currentAnswer?.text || ''} onChangeText={(text) => handleTextChange(currentTask.id, text)} multiline />
              </View>
            )}
          </ScrollView>

          <View className="px-5 py-6 flex-row items-center gap-3">
            {currentIdx > 0 && (<TouchableOpacity style={{ backgroundColor: c.surface }} className="px-6 py-4 rounded-xl items-center justify-center" onPress={handlePrev} disabled={saving}><Text style={{ color: c.textPrimary }} className="font-bold">Anterior</Text></TouchableOpacity>)}
            {currentIdx < tasks.length - 1 ? (
              <TouchableOpacity style={{ backgroundColor: c.accent }} className="flex-1 py-4 rounded-xl items-center justify-center" onPress={handleNext} disabled={saving}><Text style={{ color: c.textPrimary }} className="text-base font-bold">Siguiente</Text></TouchableOpacity>
            ) : (
              <TouchableOpacity style={{ backgroundColor: c.accent }} className="flex-1 py-4 rounded-xl items-center justify-center flex-row" onPress={handleSubmit} disabled={saving}>
                {saving ? <ActivityIndicator color={c.textPrimary} /> : <Text style={{ color: c.textPrimary }} className="text-base font-bold">Finalizar y Enviar</Text>}
              </TouchableOpacity>
            )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}