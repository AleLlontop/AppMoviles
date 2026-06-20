import React, { useEffect, useState } from 'react';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { TouchableOpacity, Text, View, ActivityIndicator, Modal, TextInput, Pressable, Keyboard, Platform, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { supabase } from '@/utils/supabase';

export default function TableroLayout() {
  const router = useRouter();
  const c = useThemeColors();
  const { id, title: paramTitle, description: paramDesc } = useLocalSearchParams();

  const [title, setTitle] = useState(paramTitle ? String(paramTitle) : 'Cargando...');
  const [description, setDescription] = useState(paramDesc ? String(paramDesc) : '');
  const [loading, setLoading] = useState(!paramTitle);

  const [optionsVisible, setOptionsVisible] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [updating, setUpdating] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');

  // Altura del teclado para empujar el sheet (KeyboardAvoidingView dentro de
  // Modal es flaky en Android — patrón ya usado en EditNameSheet).
  const [kbHeight, setKbHeight] = useState(0);
  useEffect(() => {
    if (!editVisible) return;
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvt, (e) => setKbHeight(e.endCoordinates?.height ?? 0));
    const hide = Keyboard.addListener(hideEvt, () => setKbHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [editVisible]);

  useEffect(() => {
    if (id) {
      fetchTableroDetails();
      fetchSubjects();
    }
  }, [id]);

  const fetchTableroDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('dashboards')
        .select('title, description, subjects_id')
        .eq('id', id)
        .single();
        
      if (error) throw error;
      if (data) {
        setTitle(data.title);
        setDescription(data.description || '');
        setSelectedSubjectId(data.subjects_id);
      }
    } catch (error) {
      console.error('Error fetching tablero details:', error);
      setTitle('Tablero Desconocido');
    } finally {
      setLoading(false);
    }
  };

  const fetchSubjects = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from('subjects')
        .select('*')
        .eq('user_id', user.id);
      if (error) throw error;
      setSubjects(data || []);
    } catch (error) {
      console.error('Error fetching subjects:', error);
    }
  };

  const openEditModal = () => {
    setEditTitle(title);
    setEditDescription(description);
    setOptionsVisible(false);
    setEditVisible(true);
  };

  const handleDelete = async () => {
    try {
      setUpdating(true);
      const { error } = await supabase
        .from('dashboards')
        .delete()
        .eq('id', id);
      if (error) throw error;
      setConfirmDeleteVisible(false);
      router.replace('/(tabs)/tableros');
    } catch (error: any) {
      console.error('Error deleting tablero:', error);
      Alert.alert('Error', 'No se pudo eliminar el tablero.');
    } finally {
      setUpdating(false);
    }
  };

  const handleSaveEdit = async () => {
    const trimmedTitle = editTitle.trim();
    if (!trimmedTitle) {
      setAlertMessage('El nombre del tablero no puede estar vacío.');
      setShowAlert(true);
      return;
    }
    if (trimmedTitle.length < 3) {
      setAlertMessage('El nombre debe tener al menos 3 caracteres.');
      setShowAlert(true);
      return;
    }
    try {
      setUpdating(true);
      const { error } = await supabase
        .from('dashboards')
        .update({
          title: trimmedTitle,
          description: editDescription.trim(),
          subjects_id: selectedSubjectId,
        })
        .eq('id', id);
      if (error) throw error;
      setTitle(trimmedTitle);
      setDescription(editDescription.trim());
      setEditVisible(false);
    } catch (error: any) {
      console.error('Error updating tablero:', error);
      Alert.alert('Error', 'No se pudo actualizar el tablero.');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <>
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: c.background,
          },
          headerShadowVisible: false,
          headerLeft: () => (
            <TouchableOpacity 
              onPress={() => router.back()}
              className="flex-row items-center ml-2"
            >
              <Ionicons name="chevron-back" size={24} color={c.textPrimary} />
            </TouchableOpacity>
          ),
          headerTitle: '',
        }}
      >
        <Stack.Screen 
          name="index" 
          options={{ 
            headerShown: true,
            header: () => (
              <View style={{ backgroundColor: c.background, paddingTop: 60, paddingHorizontal: 20, paddingBottom: 10 }}>
                <View className="flex-row items-center justify-between mb-4">
                  <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="chevron-back" size={24} color={c.textPrimary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setOptionsVisible(true)}
                    className="w-9 h-9 rounded-xl items-center justify-center"
                    style={{ backgroundColor: c.separator }}
                  >
                    <Ionicons name="ellipsis-vertical" size={18} color={c.textPrimary} />
                  </TouchableOpacity>
                </View>
                {loading ? (
                  <ActivityIndicator color={c.accent} size="small" style={{ alignSelf: 'flex-start', marginBottom: 8 }} />
                ) : (
                  <>
                    <Text style={{ color: c.textPrimary }} className="text-2xl font-bold mb-2">
                      {title}
                    </Text>
                    {description ? (
                      <Text style={{ color: c.textSecondary }} className="text-sm">
                        {description}
                      </Text>
                    ) : null}
                  </>
                )}
              </View>
            )
          }} 
        />
        <Stack.Screen 
          name="resumenes" 
          options={{ headerShown: false }} 
        />
        <Stack.Screen 
          name="tareas" 
          options={{ headerShown: false }} 
        />
        <Stack.Screen 
          name="quiz" 
          options={{ headerShown: false }} 
        />
      </Stack>

      {/* Modal de opciones */}
      <Modal transparent visible={optionsVisible} animationType="slide" onRequestClose={() => setOptionsVisible(false)}>
        <Pressable style={{ flex: 1, backgroundColor: c.modalOverlay, justifyContent: 'flex-end' }} onPress={() => setOptionsVisible(false)}>
          <View style={{ backgroundColor: c.surface }} className="rounded-t-3xl p-6 pb-10">
            <View className="items-center mb-6 mt-2">
              <View style={{ backgroundColor: c.handle }} className="w-12 h-1.5 rounded-full" />
            </View>
            <Text style={{ color: c.textPrimary }} className="text-xl font-bold text-center mb-6">
              Opciones del Tablero
            </Text>

            <TouchableOpacity
              onPress={openEditModal}
              className="flex-row items-center p-4 rounded-xl mb-3"
              style={{ backgroundColor: c.background }}
            >
              <Ionicons name="pencil" size={20} color={c.accentStrong} style={{ marginRight: 12 }} />
              <Text style={{ color: c.textPrimary }} className="text-base font-semibold">Editar Tablero</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setOptionsVisible(false);
                setConfirmDeleteVisible(true);
              }}
              className="flex-row items-center p-4 rounded-xl mb-6"
              style={{ backgroundColor: c.background }}
            >
              <Ionicons name="trash-outline" size={20} color="#EF4444" style={{ marginRight: 12 }} />
              <Text style={{ color: '#EF4444' }} className="text-base font-semibold">Eliminar Tablero</Text>
            </TouchableOpacity>

            <TouchableOpacity className="w-full py-3 items-center" onPress={() => setOptionsVisible(false)}>
              <Text style={{ color: c.textSecondary }} className="text-base">Cancelar</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Modal de Confirmar Eliminar */}
      <Modal transparent visible={confirmDeleteVisible} animationType="fade" onRequestClose={() => setConfirmDeleteVisible(false)}>
        <Pressable style={{ flex: 1, backgroundColor: c.modalOverlay, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 }} onPress={() => !updating && setConfirmDeleteVisible(false)}>
          <Pressable style={{ backgroundColor: c.surface }} className="w-full p-6 rounded-3xl items-center" onPress={(e) => e.stopPropagation()}>
            <View className="w-14 h-14 rounded-2xl items-center justify-center mb-4" style={{ backgroundColor: 'rgba(239,68,68,0.14)' }}>
              <Ionicons name="trash-outline" size={26} color="#EF4444" />
            </View>
            <Text style={{ color: c.textPrimary }} className="text-xl font-extrabold text-center mb-2">Eliminar Tablero</Text>
            <Text style={{ color: c.textSecondary }} className="text-sm text-center mb-6 leading-5">
              ¿Estás seguro de que quieres eliminar "{title}"? Esta acción no se puede deshacer.
            </Text>
            <TouchableOpacity
              style={{ backgroundColor: '#EF4444' }}
              className="w-full py-4 rounded-xl items-center justify-center mb-3"
              onPress={handleDelete}
              disabled={updating}
            >
              {updating ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff' }} className="text-base font-bold">Eliminar</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={{ backgroundColor: c.background }}
              className="w-full py-4 rounded-xl items-center justify-center"
              onPress={() => setConfirmDeleteVisible(false)}
              disabled={updating}
            >
              <Text style={{ color: c.textSecondary }} className="text-base font-semibold">Cancelar</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal para Editar Tablero */}
      <Modal visible={editVisible} transparent animationType="slide" onRequestClose={() => !updating && setEditVisible(false)}>
        <Pressable style={{ flex: 1, backgroundColor: c.modalOverlay, justifyContent: 'flex-end' }} onPress={() => !updating && setEditVisible(false)}>
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
                Editar Tablero
              </Text>

              <Text style={{ color: c.textSecondary }} className="text-sm font-semibold mb-2 ml-1">
                Seleccionar Materia
              </Text>
              <View className="mb-4">
                {subjects.length > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="pb-2">
                    {subjects.map((subject) => {
                      const isSelected = selectedSubjectId === subject.id;
                      return (
                        <TouchableOpacity
                          key={subject.id}
                          onPress={() => setSelectedSubjectId(isSelected ? null : subject.id)}
                          style={{ 
                            backgroundColor: isSelected ? `${subject.color}20` : c.background,
                            borderColor: isSelected ? subject.color : c.border,
                            borderWidth: 1
                          }}
                          className="flex-row items-center px-4 py-2 rounded-full mr-3"
                        >
                          <View style={{ backgroundColor: subject.color, width: 10, height: 10, borderRadius: 5, marginRight: 8 }} />
                          <Text style={{ color: isSelected ? subject.color : c.textPrimary, fontWeight: isSelected ? 'bold' : 'normal' }}>
                            {subject.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                ) : (
                  <Text style={{ color: c.textSecondary }} className="text-sm italic ml-1">
                    No tienes materias creadas.
                  </Text>
                )}
              </View>

              <Text style={{ color: c.textSecondary }} className="text-sm font-semibold mb-2 ml-1">
                Nombre del Tablero
              </Text>
              <TextInput
                style={{ backgroundColor: c.background, color: c.textPrimary }}
                className="p-4 rounded-xl mb-4 text-base"
                value={editTitle}
                onChangeText={setEditTitle}
                placeholder="Nombre del tablero"
                placeholderTextColor={c.textSecondary}
              />

              <Text style={{ color: c.textSecondary }} className="text-sm font-semibold mb-2 ml-1">
                Descripción
              </Text>
              <TextInput
                style={{ backgroundColor: c.background, color: c.textPrimary }}
                className="p-4 rounded-xl mb-8 text-base"
                value={editDescription}
                onChangeText={setEditDescription}
                placeholder="Descripción del tablero"
                placeholderTextColor={c.textSecondary}
                multiline
              />

              <TouchableOpacity
                style={{ backgroundColor: c.accent }}
                className="w-full py-4 rounded-xl flex-row justify-center items-center mb-4"
                onPress={handleSaveEdit}
                disabled={updating}
              >
                {updating ? <ActivityIndicator color={c.textPrimary} /> : <Text style={{ color: c.textPrimary }} className="text-base font-bold">Guardar Cambios</Text>}
              </TouchableOpacity>

              <TouchableOpacity className="w-full py-3 flex-row justify-center items-center" onPress={() => setEditVisible(false)} disabled={updating}>
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
              Editar Tablero
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
    </>
  );
}
