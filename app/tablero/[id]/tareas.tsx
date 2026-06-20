import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, TextInput, ActivityIndicator, FlatList, Keyboard, Platform, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
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

export default function TareasScreen() {
  const c = useThemeColors();
  const router = useRouter();
  const user = useUser();
  const { id } = useLocalSearchParams(); // dashboard_id

  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form states
  const [taskType, setTaskType] = useState<'multiple_choice' | 'open_answer'>('multiple_choice');
  const [questionText, setQuestionText] = useState('');
  const [openAnswerModel, setOpenAnswerModel] = useState(''); // Respuesta sugerida para open_answer
  const [options, setOptions] = useState<string[]>(['', '']); // Al menos 2 opciones iniciales
  const [correctOptionIndex, setCorrectOptionIndex] = useState<number>(0);

  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');

  // Altura del teclado para empujar el sheet (KeyboardAvoidingView dentro de
  // Modal es flaky en Android — patrón ya usado en EditNameSheet).
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
      // Traer tareas asociadas a este dashboard a través de dashboard_items
      const { data, error } = await supabase
        .from('tasks')
        .select('*, dashboard_items!inner(dashboard_id), task_options(*)')
        .eq('dashboard_items.dashboard_id', id);

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
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

  const handleCreateTask = async () => {
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

      // 1. Obtener o crear dashboard_item para este tablero
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

      // 2. Insertar la tarea (quesion)
      const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .insert([{
          quesion: trimmedQuestion,
          dashboard_item_id: dashboardItemId,
          task_type: taskType
        }])
        .select()
        .single();

      if (taskError) throw taskError;

      // 3. Insertar opciones
      if (taskType === 'multiple_choice') {
        const insertOptions = options
          .map((text, idx) => ({
            text: text.trim(),
            is_correct: idx === correctOptionIndex,
            tasks_id: taskData.id
          }))
          .filter(opt => opt.text !== '');

        const { error: optionsError } = await supabase
          .from('task_options')
          .insert(insertOptions);

        if (optionsError) throw optionsError;
      } else if (taskType === 'open_answer' && openAnswerModel.trim()) {
        // Guardar la respuesta sugerida como opción con is_correct = true
        const { error: optionError } = await supabase
          .from('task_options')
          .insert([{
            text: openAnswerModel.trim(),
            is_correct: true,
            tasks_id: taskData.id
          }]);
        if (optionError) throw optionError;
      }

      // Limpiar formulario y cerrar modal
      setQuestionText('');
      setOpenAnswerModel('');
      setOptions(['', '']);
      setCorrectOptionIndex(0);
      setCreateModalVisible(false);
      fetchTasks();
    } catch (error: any) {
      console.error('Error creating task:', error);
      alert('Hubo un error al crear la pregunta de práctica');
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
          </View>

          <Text style={{ color: c.textSecondary }} className="text-sm font-semibold mb-4 ml-1">
            LISTADO DE PREGUNTAS
          </Text>

          <FlatList
            data={tasks}
            keyExtractor={item => item.id}
            contentContainerStyle={{ paddingBottom: 100 }}
            renderItem={({ item }) => (
              <View style={{ backgroundColor: c.surface }} className="p-5 rounded-2xl mb-3">
                <View className="flex-row justify-between items-start mb-2">
                  <Text style={{ color: c.textPrimary }} className="text-base font-semibold flex-1 mr-2">
                    {item.quesion}
                  </Text>
                  <View style={{ backgroundColor: c.background }} className="px-2 py-1 rounded-md">
                    <Text style={{ color: c.textSecondary, fontSize: 10, fontWeight: '700' }}>
                      {item.task_type === 'multiple_choice' ? 'MULTIPLE CHOICE' : 'RESPUESTA ABIERTA'}
                    </Text>
                  </View>
                </View>
                {item.task_type === 'multiple_choice' && (
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
                {item.task_type === 'open_answer' && item.task_options.length > 0 && (
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

      {/* Modal para Crear Pregunta */}
      <Modal visible={createModalVisible} transparent animationType="slide" onRequestClose={() => !creating && setCreateModalVisible(false)}>
        <Pressable style={{ flex: 1, backgroundColor: c.modalOverlay, justifyContent: 'flex-end' }} onPress={() => !creating && setCreateModalVisible(false)}>
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
                Crear Pregunta
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

                {/* Campos dinámicos según el tipo de pregunta */}
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
                onPress={handleCreateTask}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator color={c.textPrimary} />
                ) : (
                  <Text style={{ color: c.textPrimary }} className="text-base font-bold">Crear Pregunta</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                className="w-full py-3 flex-row justify-center items-center"
                onPress={() => setCreateModalVisible(false)}
                disabled={creating}
              >
                <Text style={{ color: c.textSecondary }} className="text-base">Cancelar</Text>
              </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Alerta de validación */}
      <Modal transparent visible={showAlert} animationType="fade" onRequestClose={() => setShowAlert(false)}>
        <View className="flex-1 items-center justify-center p-8" style={{ backgroundColor: c.modalOverlay }}>
          <View style={{ backgroundColor: c.modalBg, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 25 }} className="w-full max-w-sm rounded-[32px] p-8 items-center">
            <Text style={{ color: c.textPrimary }} className="text-2xl font-bold mb-4 text-center">
              Crear Pregunta
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
