import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, TextInput, ActivityIndicator, FlatList, Platform, Pressable, Alert, Switch, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { supabase } from '@/utils/supabase';
import { useUser } from '@/hooks/use-user';
// IMPORTAMOS TU MODAL
import { ConfirmModal } from '@/components/ConfirmModal';

type TaskOption = { id: string; text: string; is_correct: boolean; };
type Task = { id: string; question: string; task_type: 'multiple_choice' | 'open_answer'; task_options: TaskOption[]; };

export default function ActivityAndTasksScreen() {
  const c = useThemeColors();
  const router = useRouter();
  const user = useUser();

  const { id: group_id, activity_id } = useLocalSearchParams<{ id: string, activity_id: string }>();
  const isNewActivity = activity_id === 'new';

  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Form Actividad
  const [actTitle, setActTitle] = useState('');
  const [actType, setActType] = useState('task');
  const [actDuration, setActDuration] = useState('');
  const [actNotify, setActNotify] = useState(false);
  const [savingAct, setSavingAct] = useState(false);

  // Tareas
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activityTitle, setActivityTitle] = useState('Actividad');
  const [currentActType, setCurrentActType] = useState('task');
  const [showAnswers, setShowAnswers] = useState(true);

  // Modal Tarea
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [questionText, setQuestionText] = useState('');
  const [openAnswerModel, setOpenAnswerModel] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [correctOptionIndex, setCorrectOptionIndex] = useState<number>(0);
  const [kbHeight, setKbHeight] = useState(0);

  // ESTADOS PARA LOS MODALES DE ELIMINAR
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  const [activityToDelete, setActivityToDelete] = useState<boolean>(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!createModalVisible) return;
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvt, (e) => setKbHeight(e.endCoordinates?.height ?? 0));
    const hide = Keyboard.addListener(hideEvt, () => setKbHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, [createModalVisible]);

  useFocusEffect(
    useCallback(() => {
      if (group_id && activity_id && user) initScreenData();
    }, [group_id, activity_id, user])
  );

  const initScreenData = async () => {
    setLoading(true);
    try {
      const { data: roleData } = await supabase.from('group_members').select('role').eq('group_id', group_id).eq('user_id', user!.id).single();
      setIsAdmin(roleData?.role === 'admin' || roleData?.role === 'owner' || roleData?.role === 'creator');

      if (!isNewActivity) {
        const { data: actData } = await supabase.from('group_activities').select('title, type').eq('id', activity_id).single();
        if (actData) {
          setActivityTitle(actData.title);
          setCurrentActType(actData.type);
        }
        await fetchTasks();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchTasks = async () => {
    const { data, error } = await supabase.from('tasks').select('*, task_options(*)').eq('group_activity_id', activity_id).order('created_at', { ascending: true });
    if (!error) setTasks(data || []);
  };

  const handleCreateActivity = async () => {
    if (!actTitle.trim()) return Alert.alert('Error', 'El título es obligatorio.');
    if (!actDuration.trim() || isNaN(Number(actDuration))) return Alert.alert('Error', 'Duración inválida.');

    setSavingAct(true);
    try {
      const { data, error } = await supabase.from('group_activities').insert([{
        group_id: group_id,
        title: actTitle.trim(),
        type: actType,
        duration_min: parseInt(actDuration),
        notify_all: actNotify,
        created_by: user!.id
      }]).select().single();

      if (error) throw error;
      router.replace({ pathname: '/group/[id]/activity/[activity_id]', params: { id: group_id, activity_id: data.id } });
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setSavingAct(false);
    }
  };

  // FUNCIONES DEL MODAL DE ELIMINAR
  const confirmDeleteActivity = async () => {
    setDeleting(true);
    try {
      await supabase.from('group_activities').delete().eq('id', activity_id);
      setActivityToDelete(false);
      router.back();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setDeleting(false);
    }
  };

  const confirmDeleteTask = async () => {
    if (!taskToDelete) return;
    setDeleting(true);
    try {
      await supabase.from('tasks').delete().eq('id', taskToDelete);
      setTaskToDelete(null);
      await fetchTasks();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setDeleting(false);
    }
  };

  const resetAndCloseModal = () => {
    setEditingTaskId(null); setQuestionText(''); setOpenAnswerModel(''); setOptions(['', '']); setCorrectOptionIndex(0); setCreateModalVisible(false);
  };

  const openEditModal = (task: Task) => {
    setEditingTaskId(task.id); setQuestionText(task.question);
    if (task.task_type === 'multiple_choice') {
      const opts = task.task_options.map(o => o.text);
      setOptions(opts.length > 0 ? opts : ['', '']);
      setCorrectOptionIndex(task.task_options.findIndex(o => o.is_correct) !== -1 ? task.task_options.findIndex(o => o.is_correct) : 0);
      setOpenAnswerModel('');
    } else {
      setOpenAnswerModel(task.task_options.find(o => o.is_correct)?.text || '');
      setOptions(['', '']); setCorrectOptionIndex(0);
    }
    setCreateModalVisible(true);
  };

  const handleRemoveOption = (index: number) => {
    if (options.length > 2) {
      const newOptions = [...options];
      newOptions.splice(index, 1);
      setOptions(newOptions);
      if (correctOptionIndex >= newOptions.length) setCorrectOptionIndex(0);
    }
  };

  const handleSaveTask = async () => {
    const trimmedQuestion = questionText.trim();
    if (trimmedQuestion.length < 3) return Alert.alert('Atención', 'Pregunta muy corta.');
    const forcedTaskType = currentActType === 'form' ? 'multiple_choice' : 'open_answer';
    if (forcedTaskType === 'multiple_choice' && options.filter(o => o.trim() !== '').length < 2) return Alert.alert('Atención', 'Mínimo 2 opciones.');

    setCreatingTask(true);
    try {
      let targetTaskId = editingTaskId;

      if (editingTaskId) {
        await supabase.from('tasks').update({ question: trimmedQuestion, task_type: forcedTaskType }).eq('id', editingTaskId);
        await supabase.from('task_options').delete().eq('tasks_id', editingTaskId);
      } else {
        const { data: taskData, error: insError } = await supabase.from('tasks').insert([{ question: trimmedQuestion, group_activity_id: activity_id, task_type: forcedTaskType }]).select().single();
        if (insError) throw insError;
        targetTaskId = taskData!.id;
      }

      if (forcedTaskType === 'multiple_choice' && targetTaskId) {
        const insertOptions = options.map((text, idx) => ({ text: text.trim(), is_correct: idx === correctOptionIndex, tasks_id: targetTaskId })).filter(opt => opt.text !== '');
        await supabase.from('task_options').insert(insertOptions);
      } else if (forcedTaskType === 'open_answer' && openAnswerModel.trim() && targetTaskId) {
        await supabase.from('task_options').insert([{ text: openAnswerModel.trim(), is_correct: true, tasks_id: targetTaskId }]);
      }

      resetAndCloseModal();
      await fetchTasks();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setCreatingTask(false);
    }
  };

  if (isNewActivity) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={{ backgroundColor: c.background, flex: 1 }} edges={['top']}>
          <View className="flex-row items-center px-5 pt-4 pb-2">
            <TouchableOpacity onPress={() => router.back()} className="mr-4"><Ionicons name="chevron-back" size={24} color={c.textPrimary} /></TouchableOpacity>
            <Text style={{ color: c.textPrimary }} className="text-2xl font-bold flex-1">Nueva Actividad</Text>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <View style={{ backgroundColor: c.surface }} className="p-6 rounded-3xl">
              <Text style={{ color: c.textSecondary }} className="text-sm font-semibold mb-2 ml-1">Título</Text>
              <TextInput style={{ backgroundColor: c.background, color: c.textPrimary }} className="p-4 rounded-xl mb-5 text-base" placeholder="Ej: Repaso General" placeholderTextColor={c.textSecondary} value={actTitle} onChangeText={setActTitle} />
              <Text style={{ color: c.textSecondary }} className="text-sm font-semibold mb-2 ml-1">Tipo (Form = Choice / Task = Abiertas)</Text>
              <View className="flex-row mb-5 gap-2">
                {['task', 'form'].map(t => (
                  <TouchableOpacity key={t} onPress={() => setActType(t)} style={{ flex: 1, backgroundColor: actType === t ? `${c.accent}20` : c.background, borderColor: actType === t ? c.accentStrong : c.border, borderWidth: 1 }} className="py-3 rounded-xl items-center"><Text style={{ color: actType === t ? c.accentStrong : c.textPrimary, fontWeight: 'bold' }}>{t.toUpperCase()}</Text></TouchableOpacity>
                ))}
              </View>
              <Text style={{ color: c.textSecondary }} className="text-sm font-semibold mb-2 ml-1">Duración (minutos)</Text>
              <TextInput style={{ backgroundColor: c.background, color: c.textPrimary }} className="p-4 rounded-xl mb-6 text-base" placeholder="Ej: 30" placeholderTextColor={c.textSecondary} value={actDuration} onChangeText={setActDuration} keyboardType="numeric" />
              <View className="flex-row items-center justify-between mb-8 px-1">
                <Text style={{ color: c.textPrimary }} className="text-base font-semibold">Notificar a todos</Text>
                <Switch value={actNotify} onValueChange={setActNotify} trackColor={{ true: c.accentStrong, false: c.separator }} />
              </View>
              <TouchableOpacity style={{ backgroundColor: c.accent }} className="w-full py-4 rounded-xl items-center" onPress={handleCreateActivity} disabled={savingAct}>
                {savingAct ? <ActivityIndicator color={c.textPrimary} /> : <Text style={{ color: c.textPrimary }} className="text-base font-bold">Guardar y Crear Tareas</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={{ backgroundColor: c.background, flex: 1 }} edges={['top']}>
        <View className="flex-row items-center px-5 pt-4 pb-2">
          <TouchableOpacity onPress={() => router.back()} className="mr-4"><Ionicons name="chevron-back" size={24} color={c.textPrimary} /></TouchableOpacity>
          <Text style={{ color: c.textPrimary }} className="text-xl font-bold flex-1" numberOfLines={1}>{activityTitle}</Text>
          {isAdmin && (
            <TouchableOpacity onPress={() => setActivityToDelete(true)} className="p-2">
              <Ionicons name="trash-outline" size={22} color="#EF4444" />
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center"><ActivityIndicator size="large" color={c.accent} /></View>
        ) : (
          <View className="flex-1 px-5 pt-4">
            <View style={{ backgroundColor: c.surface }} className="p-6 rounded-3xl mb-6">
              <View className="flex-row justify-between items-center mb-4">
                <View><Text style={{ color: c.textPrimary }} className="text-lg font-bold">{currentActType === 'form' ? 'Formulario (Choice)' : 'Tarea (Desarrollo)'}</Text><Text style={{ color: c.textSecondary }} className="text-sm">{tasks.length} Preguntas</Text></View>
              </View>

              <TouchableOpacity style={{ backgroundColor: tasks.length > 0 ? c.accent : c.separator, marginBottom: isAdmin && tasks.length > 0 ? 12 : 0 }} className="w-full py-4 rounded-2xl items-center" onPress={() => tasks.length > 0 && router.push({ pathname: '/group/[id]/quiz', params: { id: group_id, activity_id } })}>
                <Text style={{ color: tasks.length > 0 ? c.textPrimary : c.textSecondary }} className="text-base font-bold">Responder Actividad</Text>
              </TouchableOpacity>

              {isAdmin && tasks.length > 0 && (
                <TouchableOpacity style={{ backgroundColor: `${c.accent}20` }} className="w-full py-4 rounded-2xl items-center flex-row justify-center" onPress={() => router.push(`/group/${group_id}/activity/${activity_id}/responses`)}>
                  <Ionicons name="people-outline" size={20} color={c.accentStrong} className="mr-2" />
                  <Text style={{ color: c.accentStrong }} className="text-base font-bold ml-2">Evaluar Respuestas</Text>
                </TouchableOpacity>
              )}
            </View>

            <View className="flex-row justify-between items-center mb-4">
              <Text style={{ color: c.textSecondary, fontWeight: 'bold' }}>PREGUNTAS</Text>
              <TouchableOpacity style={{ backgroundColor: `${c.accent}20` }} className="px-3 py-1.5 rounded-full" onPress={() => setShowAnswers(!showAnswers)}><Text style={{ color: c.accentStrong, fontSize: 12, fontWeight: 'bold' }}>{showAnswers ? 'Ocultar' : 'Mostrar'}</Text></TouchableOpacity>
            </View>

            <FlatList
              data={tasks}
              keyExtractor={item => item.id}
              contentContainerStyle={{ paddingBottom: 100 }}
              renderItem={({ item }) => (
                <View style={{ backgroundColor: c.surface }} className="p-5 rounded-2xl mb-3">
                  <View className="flex-row justify-between items-start mb-2">
                    <Text style={{ color: c.textPrimary }} className="text-base font-semibold flex-1 mr-2">{item.question}</Text>
                    <View className="items-end">
                      {isAdmin && (
                        <View className="flex-row items-center gap-2 mb-1">
                          <TouchableOpacity onPress={() => openEditModal(item)}><Ionicons name="pencil" size={18} color={c.accentStrong} /></TouchableOpacity>
                          {/* BOTÓN ELIMINAR PREGUNTA */}
                          <TouchableOpacity onPress={() => setTaskToDelete(item.id)}><Ionicons name="trash-outline" size={18} color="#EF4444" /></TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </View>
                  {item.task_type === 'multiple_choice' && showAnswers && (
                    <View className="mt-2 pl-2">
                      {item.task_options.map(opt => (
                        <View key={opt.id} className="flex-row items-center mt-1.5"><Ionicons name={opt.is_correct ? "checkmark-circle" : "ellipse-outline"} size={16} color={opt.is_correct ? c.accentStrong : c.border} /><Text style={{ color: opt.is_correct ? c.accentStrong : c.textSecondary, marginLeft: 6 }}>{opt.text}</Text></View>
                      ))}
                    </View>
                  )}
                  {item.task_type === 'open_answer' && showAnswers && item.task_options[0] && <Text style={{ color: c.textSecondary, fontStyle: 'italic', marginTop: 8 }}>Sugerencia: {item.task_options[0].text}</Text>}
                </View>
              )}
            />
          </View>
        )}

        {isAdmin && !loading && (
          <TouchableOpacity style={{ backgroundColor: c.accent }} className="absolute bottom-10 right-5 w-14 h-14 rounded-full items-center justify-center shadow-md" onPress={() => setCreateModalVisible(true)}><Ionicons name="add" size={32} color={c.textPrimary} /></TouchableOpacity>
        )}

        <Modal visible={createModalVisible} transparent animationType="slide" onRequestClose={resetAndCloseModal}>
          <Pressable style={{ flex: 1, backgroundColor: c.modalOverlay, justifyContent: 'flex-end' }} onPress={resetAndCloseModal}>
            <Pressable style={{ backgroundColor: c.surface, paddingBottom: 20 + kbHeight }} className="rounded-t-3xl pt-4" onPress={e => e.stopPropagation()}>
              <View className="px-6">
                <View className="items-center mb-6 mt-2"><View style={{ backgroundColor: c.handle }} className="w-12 h-1.5 rounded-full" /></View>
                <Text style={{ color: c.textPrimary, fontSize: 18, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' }}>{editingTaskId ? 'Editar Pregunta' : 'Crear Pregunta'}</Text>
              </View>
              <ScrollView style={{ maxHeight: Platform.OS === 'ios' ? 350 : 300 }} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 20 }}>
                <TextInput style={{ backgroundColor: c.background, color: c.textPrimary, padding: 16, borderRadius: 12, marginBottom: 16 }} placeholder="Enunciado de la pregunta" placeholderTextColor={c.textSecondary} value={questionText} onChangeText={setQuestionText} />

                {currentActType === 'form' ? (
                  <View>
                    <Text style={{ color: c.textSecondary, marginBottom: 8 }}>Opciones del Multiple Choice</Text>
                    {options.map((opt, idx) => (
                      <View key={idx} className="flex-row items-center mb-2">
                        <TouchableOpacity onPress={() => setCorrectOptionIndex(idx)} className="mr-3"><Ionicons name={idx === correctOptionIndex ? "radio-button-on" : "radio-button-off"} size={24} color={idx === correctOptionIndex ? c.accentStrong : c.border} /></TouchableOpacity>
                        <TextInput style={{ flex: 1, backgroundColor: c.background, color: c.textPrimary, padding: 12, borderRadius: 8 }} placeholder={`Opción ${idx + 1}`} placeholderTextColor={c.textSecondary} value={opt} onChangeText={text => { const newOpts = [...options]; newOpts[idx] = text; setOptions(newOpts); }} />
                        {options.length > 2 && (<TouchableOpacity onPress={() => handleRemoveOption(idx)} className="ml-2 p-2"><Ionicons name="trash-outline" size={20} color="#EF4444" /></TouchableOpacity>)}
                      </View>
                    ))}
                    {options.length < 5 && (
                      <TouchableOpacity onPress={() => setOptions([...options, ''])} className="mt-4 flex-row items-center"><Ionicons name="add-circle-outline" size={20} color={c.accentStrong} /><Text style={{ color: c.accentStrong, fontWeight: 'bold', marginLeft: 8 }}>Agregar Opción</Text></TouchableOpacity>
                    )}
                  </View>
                ) : (
                  <View>
                    <Text style={{ color: c.textSecondary, marginBottom: 8 }}>Desarrollo Abierto</Text>
                    <TextInput style={{ backgroundColor: c.background, color: c.textPrimary, padding: 16, borderRadius: 12, height: 100 }} placeholder="Respuesta sugerida (para guiar al profesor al evaluar)" placeholderTextColor={c.textSecondary} value={openAnswerModel} onChangeText={setOpenAnswerModel} multiline />
                  </View>
                )}
              </ScrollView>
              <View className="px-6 mt-2">
                <TouchableOpacity style={{ backgroundColor: c.accent, padding: 16, borderRadius: 12, alignItems: 'center' }} onPress={handleSaveTask} disabled={creatingTask}>
                  {creatingTask ? <ActivityIndicator color={c.textPrimary} /> : <Text style={{ color: c.textPrimary, fontWeight: 'bold' }}>Guardar Tarea</Text>}
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        {/* MODAL PARA ELIMINAR LA ACTIVIDAD (Con el texto de la imagen) */}
        <ConfirmModal
          visible={activityToDelete}
          title="Eliminar Actividad"
          description="¿Estás seguro de que deseas eliminar esta actividad? Esta acción no se puede deshacer."
          icon="trash-outline"
          confirmLabel="Eliminar"
          destructive
          onConfirm={confirmDeleteActivity}
          onCancel={() => !deleting && setActivityToDelete(false)}
        />

        {/* MODAL PARA ELIMINAR UNA PREGUNTA (Tal cual la imagen) */}
        <ConfirmModal
          visible={!!taskToDelete}
          title="Eliminar Pregunta"
          description="¿Estás seguro de que deseas eliminar esta pregunta? Esta acción no se puede deshacer."
          icon="trash-outline"
          confirmLabel="Eliminar"
          destructive
          onConfirm={confirmDeleteTask}
          onCancel={() => !deleting && setTaskToDelete(null)}
        />

      </SafeAreaView>
    </>
  );
}