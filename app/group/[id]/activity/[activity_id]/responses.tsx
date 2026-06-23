import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, LayoutAnimation, Platform, UIManager, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { supabase } from '@/utils/supabase';
import { MemberAvatar } from '@/components/MemberAvatar';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type UserResult = {
  user_id: string;
  name: string;
  nickname: string;
  avatar_url: string;
  score: number;
  mcCount: number;
  answers: {
    respId: string;
    question: string;
    answerText: string;
    isCorrect: boolean | null;
    isMC: boolean;
    correctOptionText: string;
    manualScore: number | null;
  }[];
};

export default function ActivityResponsesScreen() {
  const c = useThemeColors();
  const router = useRouter();
  const { id: group_id, activity_id } = useLocalSearchParams<{ id: string, activity_id: string }>();

  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<UserResult[]>([]);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [actType, setActType] = useState('task');

  // Estado para las notas que el admin está tipeando
  const [draftScores, setDraftScores] = useState<Record<string, string>>({});

  useEffect(() => {
    if (activity_id) fetchResponses();
  }, [activity_id]);

  const fetchResponses = async () => {
    setLoading(true);
    try {
      const { data: actData } = await supabase.from('group_activities').select('type').eq('id', activity_id).single();
      if (actData) setActType(actData.type);

      const { data: tasksData, error: tasksError } = await supabase.from('tasks').select('*, task_options(*)').eq('group_activity_id', activity_id);
      if (tasksError) throw tasksError;
      if (!tasksData || tasksData.length === 0) { setResults([]); return; }

      const taskIds = tasksData.map(t => t.id);

      // Aseguramos pedir explícitamente todos los campos necesarios
      const { data: respData, error: respError } = await supabase.from('task_responses').select('*').in('task_id', taskIds);
      if (respError) throw respError;

      const userIds = [...new Set(respData.map(r => r.user_id))];
      const { data: profilesData, error: profError } = await supabase.from('profiles').select('user_id, name, nickname, avatar_url').in('user_id', userIds);
      if (profError) throw profError;

      const usersMap: Record<string, UserResult> = {};
      profilesData.forEach(prof => {
        usersMap[prof.user_id] = { user_id: prof.user_id, name: prof.name, nickname: prof.nickname, avatar_url: prof.avatar_url, score: 0, mcCount: 0, answers: [] };
      });

      respData.forEach(r => {
        const uId = r.user_id;
        const task = tasksData.find(t => t.id === r.task_id);
        if (!usersMap[uId] || !task) return;

        const isMC = task.task_type === 'multiple_choice';
        let isCorrect = null;
        let correctOptText = '';

        // Limpiamos el texto para evitar que saltos de línea invisibles rompan las comparaciones
        const cleanAnswerText = (r.answer_text && r.answer_text.trim() !== '') ? r.answer_text.trim() : '';

        if (isMC) {
          usersMap[uId].mcCount++;
          const correctOpt = task.task_options.find((o: any) => o.is_correct);

          if (correctOpt) {
            correctOptText = correctOpt.text.trim();
            // Comparamos los textos sanitizados
            if (cleanAnswerText === correctOptText) {
              isCorrect = true;
              usersMap[uId].score++;
            } else {
              isCorrect = false;
            }
          } else {
            isCorrect = false;
          }
        } else {
          // Si es abierta, el score total del alumno es la suma de sus manualScores
          usersMap[uId].score += (r.score || 0);
          const suggestedOpt = task.task_options.find((o: any) => o.is_correct);
          if (suggestedOpt) correctOptText = suggestedOpt.text.trim();
        }

        usersMap[uId].answers.push({
          respId: r.id,
          question: task.question,
          answerText: cleanAnswerText !== '' ? cleanAnswerText : '(Respuesta en blanco)',
          isCorrect,
          isMC,
          correctOptionText: correctOptText,
          manualScore: r.score
        });
      });

      setResults(Object.values(usersMap).sort((a, b) => b.score - a.score));

    } catch (e: any) {
      Alert.alert('Error', 'No se pudieron cargar las respuestas: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (userId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedUserId(expandedUserId === userId ? null : userId);
  };

  const handleSaveScore = async (respId: string) => {
    const scoreStr = draftScores[respId];
    if (!scoreStr || isNaN(Number(scoreStr))) return Alert.alert("Error", "Ingresa un número válido para la nota.");

    try {
      const { error } = await supabase.from('task_responses').update({ score: parseInt(scoreStr) }).eq('id', respId);
      if (error) throw error;
      Alert.alert("Éxito", "Nota guardada correctamente.");
      fetchResponses(); // Recargamos para actualizar el total
    } catch (e: any) {
      Alert.alert("Error", "No se pudo guardar la nota: " + e.message);
    }
  };

  if (loading) return <SafeAreaView style={{ backgroundColor: c.background, flex: 1 }} className="items-center justify-center"><ActivityIndicator size="large" color={c.accent} /></SafeAreaView>;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={{ backgroundColor: c.background, flex: 1 }} edges={['top']}>
        <View className="flex-row items-center px-5 pt-4 pb-4">
          <TouchableOpacity onPress={() => router.back()} className="mr-4"><Ionicons name="chevron-back" size={24} color={c.textPrimary} /></TouchableOpacity>
          <Text style={{ color: c.textPrimary }} className="text-2xl font-bold">Evaluaciones</Text>
        </View>

        {results.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <Ionicons name="document-text-outline" size={48} color={c.textSecondary} className="mb-4" />
            <Text style={{ color: c.textPrimary }} className="text-xl font-bold mb-2">Sin Entregas</Text>
            <Text style={{ color: c.textSecondary }} className="text-center">Todavía ningún miembro completó esta actividad.</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
            {results.map((res) => {
              const isExpanded = expandedUserId === res.user_id;
              const displayName = res.nickname || res.name || 'Alumno';

              return (
                <View key={res.user_id} style={{ backgroundColor: c.surface }} className="rounded-2xl mb-4 overflow-hidden shadow-sm">
                  <TouchableOpacity activeOpacity={0.8} onPress={() => toggleExpand(res.user_id)} className="p-4 flex-row items-center justify-between">
                    <View className="flex-row items-center flex-1">
                      <MemberAvatar userId={res.user_id} nickname={displayName} avatarUrl={res.avatar_url} size={40} />
                      <View className="ml-3 flex-1">
                        <Text style={{ color: c.textPrimary }} className="text-base font-bold">{displayName}</Text>
                        <Text style={{ color: c.textSecondary }} className="text-sm">
                          {actType === 'form' ? 'Puntaje Formulario: ' : 'Puntaje Acumulado: '}
                          <Text style={{ color: c.accentStrong, fontWeight: 'bold' }}>{res.score}{actType === 'form' ? `/${res.mcCount}` : ''}</Text>
                        </Text>
                      </View>
                    </View>
                    <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={20} color={c.textSecondary} />
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={{ backgroundColor: c.background }} className="p-4 border-t border-gray-800/10">
                      {res.answers.map((ans, idx) => (
                        <View key={ans.respId} className="mb-6 last:mb-0">
                          <Text style={{ color: c.textPrimary }} className="font-semibold mb-2">
                            {idx + 1}. {ans.question}
                          </Text>

                          {ans.isMC ? (
                            <View className="flex-row items-start">
                              <Ionicons name={ans.isCorrect ? "checkmark-circle" : "close-circle"} size={16} color={ans.isCorrect ? "#10B981" : "#EF4444"} className="mr-2 mt-0.5" />
                              <View className="flex-1">
                                <Text style={{ color: ans.isCorrect ? "#10B981" : "#EF4444" }} className="text-base font-bold">
                                  {ans.answerText}
                                </Text>
                                {!ans.isCorrect && ans.correctOptionText && (
                                  <Text style={{ color: c.textSecondary }} className="text-xs mt-1">
                                    Correcta: {ans.correctOptionText}
                                  </Text>
                                )}
                              </View>
                            </View>
                          ) : (
                            <View>
                              {/* RESPUESTA ABIERTA BLINDADA */}
                              <View style={{ backgroundColor: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: c.border }}>
                                <Text style={{ color: c.textPrimary }} className="text-base">
                                  {ans.answerText}
                                </Text>
                              </View>

                              {/* SECCIÓN DE CORRECCIÓN MANUAL */}
                              <View className="flex-row items-center mt-3 gap-2">
                                <Text style={{ color: c.textPrimary }} className="text-sm font-bold">Nota:</Text>
                                <TextInput
                                  style={{ backgroundColor: c.surface, color: c.textPrimary }}
                                  className="px-3 py-2 rounded-lg w-16 text-center"
                                  keyboardType="numeric"
                                  placeholder={ans.manualScore !== null ? String(ans.manualScore) : '-'}
                                  placeholderTextColor={c.textSecondary}
                                  value={draftScores[ans.respId] !== undefined ? draftScores[ans.respId] : (ans.manualScore !== null ? String(ans.manualScore) : '')}
                                  onChangeText={(t) => setDraftScores({ ...draftScores, [ans.respId]: t })}
                                />
                                <TouchableOpacity
                                  style={{ backgroundColor: c.accent }}
                                  className="px-3 py-2 rounded-lg"
                                  onPress={() => handleSaveScore(ans.respId)}
                                >
                                  <Text style={{ color: c.textPrimary, fontSize: 12, fontWeight: 'bold' }}>Guardar Nota</Text>
                                </TouchableOpacity>
                              </View>

                              {ans.correctOptionText ? (
                                <View style={{ backgroundColor: c.surface }} className="mt-3 p-3 rounded-lg border-l-2 border-amber-500">
                                  <Text style={{ color: c.textPrimary, fontSize: 11, fontWeight: 'bold', marginBottom: 4 }}>Sugerencia del profesor:</Text>
                                  <Text style={{ color: c.textSecondary, fontSize: 13 }}>{ans.correctOptionText}</Text>
                                </View>
                              ) : null}
                            </View>
                          )}
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>
        )}
      </SafeAreaView>
    </>
  );
}