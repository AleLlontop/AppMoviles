import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, TextInput, ActivityIndicator, FlatList, Keyboard, Platform, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { supabase } from '@/utils/supabase';
import { useUser } from '@/hooks/use-user';
import { ConfirmModal } from '@/components/ConfirmModal';

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

export default function TareasScreen() {
  const c = useThemeColors();
  const router = useRouter();
  const user = useUser();
  const { id } = useLocalSearchParams(); // dashboard_id

  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form & Edit states
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskType, setTaskType] = useState<'multiple_choice' | 'open_answer'>('multiple_choice');
  const [questionText, setQuestionText] = useState('');
  const [openAnswerModel, setOpenAnswerModel] = useState(''); // Respuesta sugerida para open_answer
  const [options, setOptions] = useState<string[]>(['', '']); // Al menos 2 opciones iniciales
  const [correctOptionIndex, setCorrectOptionIndex] = useState<number>(0);

  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');

  // Mostrar/ocultar respuestas en la lista
  const [showAnswers, setShowAnswers] = useState(true);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Modo Examen
  const [examModalVisible, setExamModalVisible] = useState(false);
  const EXAM_PRESETS = [5, 10, 15, 30];
  const EXAM_MIN_MIN = 1;
  const EXAM_MAX_MIN = 180;
  const [selectedDuration, setSelectedDuration] = useState<number>(10);
  const [customDuration, setCustomDuration] = useState<string>('');

  // Resuelve la duración final y su validez (E-01)
  const resolvedDuration = customDuration.trim()
    ? parseInt(customDuration, 10)
    : selectedDuration;
  const durationIsValid =
    Number.isFinite(resolvedDuration) &&
    resolvedDuration >= EXAM_MIN_MIN &&
    resolvedDuration <= EXAM_MAX_MIN;

  const startExamMode = () => {
    if (!durationIsValid) return; // E-01: no arranca con duración inválida
    setExamModalVisible(false);
    router.push({
      pathname: '/tablero/[id]/quiz',
      params: {
        id: typeof id === 'string' ? id : id?.[0] || '',
        examMode: '1',
        duration: String(resolvedDuration),
      },
    });
  };

  // Altura del teclado para empujar el sheet
  const [kbHeight, setKbHeight] = useState(0);
  useEffect(() => {
    if (!createModalVisible) return;
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvt, (e) => setKbHeight(e.endCoordinates?.height ?? 0));
    const hide = Keyboard.addListener(hideEvt, () => setKbHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [createModalVisible]);

  useFocusEffect(
    useCallback(() => {
      if (id) {
        fetchTasks();
      }
    }, [id])
  );

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('tasks')
        .select('*, dashboard_items!inner(dashboard_id), task_options(*)')
        .eq('dashboard_items.dashboard_id', id)
        .order('created_at', { ascending: true }); // Ordenado para que no salten al editar

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetAndCloseModal = () => {
    setEditingTaskId(null);
    setQuestionText('');
    setOpenAnswerModel('');
    setOptions(['', '']);
    setCorrectOptionIndex(0);
    setTaskType('multiple_choice');
    setCreateModalVisible(false);
  };

  const openEditModal = (task: Task) => {
    setEditingTaskId(task.id);
    setTaskType(task.task_type);
    setQuestionText(task.question);

    if (task.task_type === 'multiple_choice') {
      const opts = task.task_options.map(o => o.text);
      const correctIdx = task.task_options.findIndex(o => o.is_correct);
      setOptions(opts.length > 0 ? opts : ['', '']);
      setCorrectOptionIndex(correctIdx !== -1 ? correctIdx : 0);
      setOpenAnswerModel('');
    } else {
      const suggested = task.task_options.find(o => o.is_correct)?.text || '';
      setOpenAnswerModel(suggested);
      setOptions(['', '']);
      setCorrectOptionIndex(0);
    }
    setCreateModalVisible(true);
  };

  const handleDeleteTask = (taskId: string) => {
    setConfirmDeleteId(taskId);
  };

  const executeDeleteTask = async () => {
    if (!confirmDeleteId) return;
    try {
      setLoading(true);
      await supabase.from('task_options').delete().eq('tasks_id', confirmDeleteId);
      const { error } = await supabase.from('tasks').delete().eq('id', confirmDeleteId);
      if (error) throw error;
      setConfirmDeleteId(null);
      fetchTasks();
    } catch (error) {
      console.error('Error deleting task:', error);
      setConfirmDeleteId(null);
      setAlertMessage('Hubo un error al eliminar la pregunta.');
      setShowAlert(true);
      setLoading(false);
    }
  };

  const handleAddField = () => {
    if (options.length < 5) {
      setOptions([...options, '']);
    }
  };

  const handleRemoveField = (index: number) => {
    if (options.length > 2) {
      const newOptions = [...options];
      newOptions.splice(index, 1);
      setOptions(newOptions);
      if (correctOptionIndex >= newOptions.length) {
        setCorrectOptionIndex(0);
      }
    }
  };

  const handleOptionTextChange = (text: string, index: number) => {
    const newOptions = [...options];
    newOptions[index] = text;
    setOptions(newOptions);
  };

  const handleSaveTask = async () => {
    if (!user || !id) return;

    // Validar pregunta
    const trimmedQuestion = questionText.trim();
    if (!trimmedQuestion) {
      setAlertMessage('La pregunta no puede estar vacía.');
      setShowAlert(true);
      return;
    }
    if (trimmedQuestion.length < 3) {
      setAlertMessage('La pregunta debe tener al menos 3 caracteres.');
      setShowAlert(true);
      return;
    }

    // Validar según tipo
    if (taskType === 'multiple_choice') {
      const filledOptions = options.map(o => o.trim()).filter(o => o !== '');
      if (filledOptions.length < 2) {
        setAlertMessage('Debes ingresar al menos 2 opciones de respuesta.');
        setShowAlert(true);
        return;
      }
    }

    try {
      setCreating(true);
      let targetTaskId = editingTaskId;

      if (editingTaskId) {
        // ACTUALIZAR TAREA EXISTENTE
        const { error: taskError } = await supabase
          .from('tasks')
          .update({
            question: trimmedQuestion,
            task_type: taskType
          })
          .eq('id', editingTaskId);

        if (taskError) throw taskError;

        // Borrar opciones antiguas para insertar las nuevas
        const { error: deleteOptionsError } = await supabase
          .from('task_options')
          .delete()
          .eq('tasks_id', editingTaskId);

        if (deleteOptionsError) throw deleteOptionsError;

      } else {
        // CREAR NUEVA TAREA
        let dashboardItemId = null;
        const { data: itemData, error: itemError } = await supabase
          .from('dashboard_items')
          .select('id')
          .eq('dashboard_id', id)
          .limit(1);

        if (itemError) throw itemError;

        if (itemData && itemData.length > 0) {
          dashboardItemId = itemData[0].id;
        } else {
          const { data: newItem, error: createError } = await supabase
            .from('dashboard_items')
            .insert([{ dashboard_id: id, user_id: user.id }])
            .select()
            .single();
          if (createError) throw createError;
          dashboardItemId = newItem.id;
        }

        const { data: taskData, error: taskError } = await supabase
          .from('tasks')
          .insert([{
            question: trimmedQuestion,
            dashboard_item_id: dashboardItemId,
            task_type: taskType
          }])
          .select()
          .single();

        if (taskError) throw taskError;
        targetTaskId = taskData.id;
      }

      // INSERTAR OPCIONES (Aplica para ambos casos: Crear o Editar)
      if (taskType === 'multiple_choice' && targetTaskId) {
        const insertOptions = options
          .map((text, idx) => ({
            text: text.trim(),
            is_correct: idx === correctOptionIndex,
            tasks_id: targetTaskId
          }))
          .filter(opt => opt.text !== '');

        const { error: optionsError } = await supabase
          .from('task_options')
          .insert(insertOptions);

        if (optionsError) throw optionsError;
      } else if (taskType === 'open_answer' && openAnswerModel.trim() && targetTaskId) {
        const { error: optionError } = await supabase
          .from('task_options')
          .insert([{
            text: openAnswerModel.trim(),
            is_correct: true,
            tasks_id: targetTaskId
          }]);
        if (optionError) throw optionError;
      }

      resetAndCloseModal();
      fetchTasks();
    } catch (error: any) {
      console.error('Error saving task:', error);
      setAlertMessage('Hubo un error al guardar la pregunta de práctica.');
      setShowAlert(true);
    } finally {
      setCreating(false);
    }
  };

  const EmptyState = () => (
    <View className="flex-1 items-center justify-center px-8">
      <View style={{ backgroundColor: c.surface }} className="w-32 h-32 rounded-full items-center justify-center mb-8">
        <Ionicons name="clipboard" size={48} color={c.accent} opacity={0.8} />
      </View>
      <Text style={{ color: c.textPrimary }} className="text-2xl font-bold text-center mb-4">
        No hay preguntas de práctica
      </Text>
      <Text style={{ color: c.textSecondary }} className="text-base text-center mb-8">
        Crea preguntas manuales sobre tus temas de estudio para repasar y prepararte para tus exámenes.
      </Text>
      <TouchableOpacity
        style={{ backgroundColor: c.accent }}
        className="w-full py-4 rounded-xl flex-row justify-center items-center"
        onPress={() => setCreateModalVisible(true)}
      >
        <Text style={{ color: c.textPrimary }} className="text-base font-bold">Crear Pregunta</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={{ backgroundColor: c.background, flex: 1 }} edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center px-5 pt-4 pb-2">
        <TouchableOpacity onPress={() => router.back()} className="mr-4">
          <Ionicons name="chevron-back" size={24} color={c.textPrimary} />
        </TouchableOpacity>
        <Text style={{ color: c.textPrimary }} className="text-2xl font-bold">
          Tareas de Práctica
        </Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={c.accent} />
        </View>
      ) : tasks.length === 0 ? (
        <EmptyState />
      ) : (
        <View className="flex-1 px-5 pt-4">
          {/* Tarjeta de Resumen */}
          <View style={{ backgroundColor: c.surface }} className="p-6 rounded-3xl mb-6">
            <View className="flex-row justify-between items-center mb-4">
              <View>
                <Text style={{ color: c.textPrimary }} className="text-lg font-bold">Autoevaluación</Text>
                <Text style={{ color: c.textSecondary }} className="text-sm">Pon a prueba tu conocimiento</Text>
              </View>
              <View style={{ backgroundColor: `${c.accent}20` }} className="px-3 py-1.5 rounded-full">
                <Text style={{ color: c.accentStrong }} className="text-xs font-bold">
                  {tasks.length} {tasks.length === 1 ? 'Pregunta' : 'Preguntas'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={{ backgroundColor: c.accent }}
              className="w-full py-4 rounded-2xl items-center justify-center"
              onPress={() => router.push({ pathname: '/tablero/[id]/quiz', params: { id: typeof id === 'string' ? id : id?.[0] || '' } })}
            >
              <Text style={{ color: c.textPrimary }} className="text-base font-bold">Iniciar Práctica (Quiz)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                backgroundColor: 'rgba(255,149,90,0.06)',
                borderColor: 'rgba(255,149,90,0.4)',
                borderWidth: 1.5,
                marginTop: 12,
              }}
              className="w-full px-4 py-3 rounded-2xl flex-row items-center justify-between"
              onPress={() => setExamModalVisible(true)}
            >
              <View className="flex-row items-center">
                <Ionicons name="timer-outline" size={22} color="#FF955A" style={{ marginRight: 12 }} />
                <View>
                  <Text style={{ color: c.textPrimary }} className="text-base font-bold">
                    Iniciar Modo Examen
                  </Text>
                  <Text style={{ color: c.textSecondary, fontSize: 11 }}>
                    Con temporizador · presión real
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={c.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Cabecera de la lista */}
          <View className="flex-row justify-between items-center mb-4 ml-1 pr-1">
            <Text style={{ color: c.textSecondary }} className="text-sm font-semibold">
              LISTADO DE PREGUNTAS
            </Text>
            <TouchableOpacity
              style={{ backgroundColor: `${c.accent}20` }}
              className="px-3 py-1.5 rounded-full"
              onPress={() => setShowAnswers(!showAnswers)}
            >
              <Text style={{ color: c.accentStrong }} className="text-xs font-bold">
                {showAnswers ? 'Ocultar Respuestas' : 'Mostrar Respuestas'}
              </Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={tasks}
            keyExtractor={item => item.id}
            contentContainerStyle={{ paddingBottom: 100 }}
            renderItem={({ item }) => (
              <View style={{ backgroundColor: c.surface }} className="p-5 rounded-2xl mb-3">
                <View className="flex-row justify-between items-start mb-2">
                  <Text style={{ color: c.textPrimary }} className="text-base font-semibold flex-1 mr-2">
                    {item.question}
                  </Text>

                  {/* Botones de acción y Pill de tipo de pregunta */}
                  <View className="items-end">
                    <View className="flex-row items-center mb-1 gap-2">
                      <TouchableOpacity onPress={() => openEditModal(item)} className="p-1">
                        <Ionicons name="pencil" size={18} color={c.accentStrong} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDeleteTask(item.id)} className="p-1">
                        <Ionicons name="trash-outline" size={18} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                    <View style={{ backgroundColor: c.background }} className="px-2 py-1 rounded-md">
                      <Text style={{ color: c.textSecondary, fontSize: 10, fontWeight: '700' }}>
                        {item.task_type === 'multiple_choice' ? 'MULTIPLE CHOICE' : 'RESP. ABIERTA'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Renderizado condicional de las respuestas */}
                {item.task_type === 'multiple_choice' && showAnswers && (
                  <View className="mt-2 pl-2">
                    {item.task_options.map((opt) => (
                      <View key={opt.id} className="flex-row items-center mt-1.5">
                        <View style={{ borderColor: opt.is_correct ? c.accentStrong : c.border }} className="w-4 h-4 rounded-full border items-center justify-center mr-2">
                          {opt.is_correct && <View style={{ backgroundColor: c.accentStrong }} className="w-2.5 h-2.5 rounded-full" />}
                        </View>
                        <Text style={{ color: opt.is_correct ? c.accentStrong : c.textSecondary }} className="text-sm">
                          {opt.text}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {item.task_type === 'open_answer' && item.task_options.length > 0 && showAnswers && (
                  <Text style={{ color: c.textSecondary }} className="text-sm italic mt-2">
                    Sugerencia: {item.task_options[0].text}
                  </Text>
                )}
              </View>
            )}
          />
        </View>
      )}

      {/* Botón flotante para crear pregunta */}
      {!loading && tasks.length > 0 && (
        <TouchableOpacity
          style={{ backgroundColor: c.accent, shadowColor: c.accent, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5 }}
          className="absolute bottom-10 right-5 w-14 h-14 rounded-full items-center justify-center"
          onPress={() => setCreateModalVisible(true)}
        >
          <Ionicons name="add" size={32} color={c.textPrimary} />
        </TouchableOpacity>
      )}

      {/* Modal para Crear / Editar Pregunta */}
      <Modal visible={createModalVisible} transparent animationType="slide" onRequestClose={() => !creating && resetAndCloseModal()}>
        <Pressable style={{ flex: 1, backgroundColor: c.modalOverlay, justifyContent: 'flex-end' }} onPress={() => !creating && resetAndCloseModal()}>
          <Pressable
            style={{
              backgroundColor: c.surface,
              paddingBottom: 40 + kbHeight,
            }}
            className="rounded-t-3xl p-6 pt-2"
            onPress={(e) => e.stopPropagation()}
          >
              <View className="items-center mb-6 mt-2">
                <View style={{ backgroundColor: c.handle }} className="w-12 h-1.5 rounded-full" />
              </View>

              <Text style={{ color: c.textPrimary }} className="text-xl font-bold text-center mb-6">
                {editingTaskId ? 'Editar Pregunta' : 'Crear Pregunta'}
              </Text>

              <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={true} className="mb-4">
                {/* Selector de Tipo de Pregunta */}
                <Text style={{ color: c.textSecondary }} className="text-sm font-semibold mb-2 ml-1">
                  Tipo de Pregunta
                </Text>
                <View className="flex-row mb-4">
                  <TouchableOpacity
                    onPress={() => setTaskType('multiple_choice')}
                    style={{
                      backgroundColor: taskType === 'multiple_choice' ? `${c.accent}20` : c.background,
                      borderColor: taskType === 'multiple_choice' ? c.accentStrong : c.border,
                      borderWidth: 1
                    }}
                    className="flex-row items-center justify-center flex-1 py-3 rounded-xl mr-2"
                  >
                    <Text style={{ color: taskType === 'multiple_choice' ? c.accentStrong : c.textPrimary, fontWeight: 'bold' }}>
                      Opción Múltiple
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setTaskType('open_answer')}
                    style={{
                      backgroundColor: taskType === 'open_answer' ? `${c.accent}20` : c.background,
                      borderColor: taskType === 'open_answer' ? c.accentStrong : c.border,
                      borderWidth: 1
                    }}
                    className="flex-row items-center justify-center flex-1 py-3 rounded-xl ml-2"
                  >
                    <Text style={{ color: taskType === 'open_answer' ? c.accentStrong : c.textPrimary, fontWeight: 'bold' }}>
                      Respuesta Abierta
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Enunciado */}
                <Text style={{ color: c.textSecondary }} className="text-sm font-semibold mb-2 ml-1">
                  Enunciado / Pregunta
                </Text>
                <TextInput
                  style={{ backgroundColor: c.background, color: c.textPrimary }}
                  className="p-4 rounded-xl mb-4 text-base"
                  placeholder="Ej: ¿Cuál es el límite de la función...?"
                  placeholderTextColor={c.textSecondary}
                  value={questionText}
                  onChangeText={setQuestionText}
                />

                {/* Campos dinámicos */}
                {taskType === 'multiple_choice' ? (
                  <View className="mb-6">
                    <Text style={{ color: c.textSecondary }} className="text-sm font-semibold mb-2 ml-1">
                      Opciones de Respuesta (Indica la correcta)
                    </Text>
                    <View className="gap-1">
                      {options.map((option, idx) => (
                        <View key={idx} className="flex-row items-center mb-3">
                          <TouchableOpacity
                            onPress={() => setCorrectOptionIndex(idx)}
                            style={{ borderColor: idx === correctOptionIndex ? c.accentStrong : c.border }}
                            className="w-6 h-6 rounded-full border items-center justify-center mr-3"
                          >
                            {idx === correctOptionIndex && <View style={{ backgroundColor: c.accentStrong }} className="w-3.5 h-3.5 rounded-full" />}
                          </TouchableOpacity>
                          <TextInput
                            style={{ backgroundColor: c.background, color: c.textPrimary, flex: 1 }}
                            className="p-3 rounded-xl text-sm"
                            placeholder={`Opción ${idx + 1}`}
                            placeholderTextColor={c.textSecondary}
                            value={option}
                            onChangeText={(text) => handleOptionTextChange(text, idx)}
                          />
                          {options.length > 2 && (
                            <TouchableOpacity onPress={() => handleRemoveField(idx)} className="ml-2 p-2">
                              <Ionicons name="trash-outline" size={20} color="#EF4444" />
                            </TouchableOpacity>
                          )}
                        </View>
                      ))}
                    </View>
                    {options.length < 5 && (
                      <TouchableOpacity onPress={handleAddField} className="flex-row items-center mt-2 ml-1">
                        <Ionicons name="add-circle-outline" size={20} color={c.accentStrong} />
                        <Text style={{ color: c.accentStrong }} className="text-sm font-semibold ml-1.5">Agregar Opción</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ) : (
                  <View className="mb-6">
                    <Text style={{ color: c.textSecondary }} className="text-sm font-semibold mb-2 ml-1">
                      Respuesta Sugerida (Opcional)
                    </Text>
                    <TextInput
                      style={{ backgroundColor: c.background, color: c.textPrimary }}
                      className="p-4 rounded-xl text-base"
                      placeholder="Ej: Es la aproximación de la función a un punto..."
                      placeholderTextColor={c.textSecondary}
                      value={openAnswerModel}
                      onChangeText={setOpenAnswerModel}
                      multiline
                    />
                  </View>
                )}
              </ScrollView>

              {/* Botón Guardar */}
              <TouchableOpacity
                style={{ backgroundColor: c.accent }}
                className="w-full py-4 rounded-xl flex-row justify-center items-center mb-4"
                onPress={handleSaveTask}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator color={c.textPrimary} />
                ) : (
                  <Text style={{ color: c.textPrimary }} className="text-base font-bold">
                    {editingTaskId ? 'Guardar Cambios' : 'Crear Pregunta'}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                className="w-full py-3 flex-row justify-center items-center"
                onPress={resetAndCloseModal}
                disabled={creating}
              >
                <Text style={{ color: c.textSecondary }} className="text-base">Cancelar</Text>
              </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal Configurar Modo Examen */}
      <Modal visible={examModalVisible} transparent animationType="slide" onRequestClose={() => setExamModalVisible(false)}>
        <Pressable style={{ flex: 1, backgroundColor: c.modalOverlay, justifyContent: 'flex-end' }} onPress={() => setExamModalVisible(false)}>
          <Pressable
            style={{ backgroundColor: c.surface, paddingBottom: 32 }}
            className="rounded-t-3xl px-6 pt-2"
            onPress={(e) => e.stopPropagation()}
          >
            <View className="items-center mb-4 mt-2">
              <View style={{ backgroundColor: c.handle }} className="w-12 h-1.5 rounded-full" />
            </View>

            <View className="items-center mb-4 mt-2">
              <View style={{ backgroundColor: 'rgba(255,149,90,0.15)' }} className="w-16 h-16 rounded-2xl items-center justify-center">
                <Ionicons name="timer-outline" size={32} color="#FF955A" />
              </View>
            </View>

            <Text style={{ color: c.textPrimary }} className="text-xl font-bold text-center mb-2">
              Configurar Modo Examen
            </Text>
            <Text style={{ color: c.textSecondary }} className="text-sm text-center mb-6 leading-5">
              Elegí la duración del temporizador.{'\n'}Al llegar a 0, la sesión se cierra automáticamente.
            </Text>

            {/* Preset chips */}
            <View className="flex-row justify-between mb-4">
              {EXAM_PRESETS.map((min) => {
                const isSel = !customDuration && selectedDuration === min;
                return (
                  <TouchableOpacity
                    key={min}
                    onPress={() => {
                      setSelectedDuration(min);
                      setCustomDuration('');
                    }}
                    style={{
                      backgroundColor: isSel ? 'rgba(165,149,249,0.18)' : c.background,
                      borderColor: isSel ? c.accentStrong : c.border,
                      borderWidth: 1.5,
                      width: '23%',
                    }}
                    className="py-3 rounded-2xl items-center justify-center"
                  >
                    <Text style={{ color: isSel ? c.accentStrong : c.textPrimary, fontSize: 20, fontWeight: '800' }}>
                      {min}
                    </Text>
                    <Text style={{ color: c.textSecondary, fontSize: 10, marginTop: 2 }}>minutos</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Custom */}
            <Text style={{ color: c.textSecondary }} className="text-xs font-semibold mb-2 ml-1">
              O INGRESÁ UNA DURACIÓN PERSONALIZADA
            </Text>
            <View
              style={{
                backgroundColor: c.background,
                borderWidth: !durationIsValid && customDuration.trim() ? 1.5 : 0,
                borderColor: '#EF4444',
              }}
              className="flex-row items-center px-4 rounded-xl mb-2"
            >
              <TextInput
                style={{
                  color: !durationIsValid && customDuration.trim() ? '#EF4444' : c.textPrimary,
                  fontSize: 16,
                  fontWeight: '600',
                  flex: 1,
                  paddingVertical: 14,
                }}
                placeholder="Ej: 45"
                placeholderTextColor={c.textSecondary}
                keyboardType="numeric"
                value={customDuration}
                onChangeText={setCustomDuration}
              />
              <Text style={{ color: c.textSecondary, fontSize: 13 }}>minutos</Text>
            </View>
            {!durationIsValid && customDuration.trim() ? (
              <View className="flex-row items-center mb-4 ml-1">
                <Ionicons name="warning-outline" size={14} color="#EF4444" />
                <Text style={{ color: '#EF4444', fontSize: 12, marginLeft: 6, fontWeight: '500' }}>
                  La duración debe ser entre {EXAM_MIN_MIN} y {EXAM_MAX_MIN} minutos.
                </Text>
              </View>
            ) : (
              <View className="mb-4" />
            )}

            {/* Info card */}
            <View
              style={{
                backgroundColor: 'rgba(255,149,90,0.08)',
                borderColor: 'rgba(255,149,90,0.3)',
                borderWidth: 1,
              }}
              className="px-4 py-3 rounded-xl mb-5 flex-row"
            >
              <Ionicons name="information-circle-outline" size={18} color="#FF955A" style={{ marginRight: 8, marginTop: 1 }} />
              <View className="flex-1">
                <Text style={{ color: '#FF955A', fontSize: 12, fontWeight: '700', marginBottom: 2 }}>
                  Modo Examen
                </Text>
                <Text style={{ color: c.textSecondary, fontSize: 11, lineHeight: 15 }}>
                  Sin ver respuestas, orden aleatorio y tiempo continuo. No se puede pausar.
                </Text>
              </View>
            </View>

            {/* Start */}
            <TouchableOpacity
              style={{ backgroundColor: c.accent, opacity: durationIsValid ? 1 : 0.35 }}
              className="w-full py-4 rounded-xl items-center justify-center mb-2"
              onPress={startExamMode}
              disabled={!durationIsValid}
            >
              <Text style={{ color: c.textPrimary }} className="text-base font-bold">
                {durationIsValid ? `Iniciar Examen (${resolvedDuration} min)` : 'Iniciar Examen'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity className="w-full py-3 items-center" onPress={() => setExamModalVisible(false)}>
              <Text style={{ color: c.textSecondary }} className="text-sm">Cancelar</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <ConfirmModal
        visible={confirmDeleteId !== null}
        title="Eliminar Pregunta"
        description="¿Estás seguro de que deseas eliminar esta pregunta? Esta acción no se puede deshacer."
        icon="trash-outline"
        confirmLabel="Eliminar"
        destructive
        onConfirm={executeDeleteTask}
        onCancel={() => setConfirmDeleteId(null)}
      />

      {/* Alerta de validación */}
      <Modal transparent visible={showAlert} animationType="fade" onRequestClose={() => setShowAlert(false)}>
        <View className="flex-1 items-center justify-center p-8" style={{ backgroundColor: c.modalOverlay }}>
          <View style={{ backgroundColor: c.modalBg, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 25 }} className="w-full max-w-sm rounded-[32px] p-8 items-center">
            <Text style={{ color: c.textPrimary }} className="text-2xl font-bold mb-4 text-center">
              {editingTaskId ? 'Editar Pregunta' : 'Crear Pregunta'}
            </Text>
            <Text style={{ color: c.textSecondary }} className="text-base text-center mb-6 leading-5">
              {alertMessage}
            </Text>
            <TouchableOpacity style={{ backgroundColor: c.accent }} className="w-full py-4 rounded-2xl items-center" onPress={() => setShowAlert(false)}>
              <Text style={{ color: c.textPrimary }} className="text-lg font-bold">
                OK
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}