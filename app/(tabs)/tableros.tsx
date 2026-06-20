import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, Image, Modal, TextInput, FlatList, Pressable, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '@/utils/supabase';
import { useUser } from '@/hooks/use-user';

type Subject = { id: string; name: string; color: string; };
type Tablero = { 
  id: string; 
  title: string; 
  description: string | null; 
  subjects: { name: string; color: string; } | null; 
  subjects_id: string | null;
};

export default function TablerosScreen() {
  const c = useThemeColors();
  const router = useRouter();
  const user = useUser();

  const [hasData, setHasData] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  
  const [newBoardName, setNewBoardName] = useState('');
  const [newBoardDesc, setNewBoardDesc] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);

  const [tableros, setTableros] = useState<Tablero[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');

  useFocusEffect(
    useCallback(() => {
      if (user) {
        fetchData();
      }
    }, [user])
  );

  const fetchData = async () => {
    try {
      setLoading(true);
      // Traer Tableros con su materia asignada (Join)
      const { data: dashData, error: dashError } = await supabase
        .from('dashboards')
        .select('*, subjects(name, color)')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (dashError) throw dashError;
      
      // Traer materias del usuario para el selector
      const { data: subjData, error: subjError } = await supabase
        .from('subjects')
        .select('*')
        .eq('user_id', user?.id);

      if (subjError) throw subjError;

      setTableros(dashData || []);
      setSubjects(subjData || []);
      setHasData((dashData && dashData.length > 0) ? true : false);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBoard = async () => {
    if (!user) return;
    
    const trimmedName = newBoardName.trim();
    if (!trimmedName) {
      setAlertMessage('El nombre del tablero no puede estar vacío.');
      setShowAlert(true);
      return;
    }
    if (trimmedName.length < 3) {
      setAlertMessage('El nombre debe tener al menos 3 caracteres.');
      setShowAlert(true);
      return;
    }
    
    try {
      setCreating(true);
      const { data, error } = await supabase
        .from('dashboards')
        .insert([{ 
          title: trimmedName, 
          description: newBoardDesc.trim(),
          user_id: user.id,
          subjects_id: selectedSubjectId
        }])
        .select('*, subjects(name, color)')
        .single();

      if (error) throw error;

      if (data) {
        setTableros([data, ...tableros]);
        setHasData(true);
        setModalVisible(false);
        setNewBoardName('');
        setNewBoardDesc('');
        setSelectedSubjectId(null);
      }
    } catch (error) {
      console.error('Error creating tablero:', error);
      alert('Hubo un error al crear el tablero');
    } finally {
      setCreating(false);
    }
  };

  const EmptyState = () => (
    <View className="flex-1 items-center justify-center px-8">
      {loading ? (
        <ActivityIndicator size="large" color={c.accent} />
      ) : (
        <>
          <View style={{ backgroundColor: c.surface }} className="w-32 h-32 rounded-full items-center justify-center mb-8">
            <Ionicons name="map" size={48} color={c.accent} opacity={0.8} />
          </View>
          <Text style={{ color: c.textPrimary }} className="text-2xl font-bold text-center mb-4">
            Todavía no creaste ningún Tablero
          </Text>
          <Text style={{ color: c.textSecondary }} className="text-base text-center mb-8">
            Comenza a organizar tus resumenes, crear tareas y mejorar la calidad de tu estudio
          </Text>
          <TouchableOpacity
            style={{ backgroundColor: c.accent }}
            className="w-full py-4 rounded-xl flex-row justify-center items-center"
            onPress={() => setModalVisible(true)}
          >
            <Text style={{ color: c.textPrimary }} className="text-base font-bold">Crear Dashboard</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );

  const ListState = () => (
    <View className="flex-1 px-5 pt-8">
      <Text style={{ color: c.textPrimary }} className="text-2xl font-bold mb-6">
        ¡Bienvenido a tus Tableros!
      </Text>
      
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={c.accent} />
        </View>
      ) : (
        <FlatList
          data={tableros}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={{ backgroundColor: c.surface }}
              className="flex-row items-center justify-between px-6 py-10 rounded-3xl mb-4"
              onPress={() => router.push({
                pathname: '/tablero/[id]',
                params: {
                  id: item.id,
                  title: item.title,
                  description: item.description || ''
                }
              })}
            >
              <View className="flex-1 mr-4">
                {item.subjects && (
                  <View className="flex-row items-center mb-3">
                    <View style={{ backgroundColor: item.subjects.color, width: 8, height: 8, borderRadius: 4, marginRight: 6 }} />
                    <Text style={{ color: item.subjects.color, fontSize: 12, fontWeight: '600' }}>
                      {item.subjects.name}
                    </Text>
                  </View>
                )}
                <Text style={{ color: c.textPrimary }} className="text-3xl font-bold">
                  {item.title}
                </Text>
                {item.description ? (
                  <Text style={{ color: c.textSecondary }} className="text-sm mt-3" numberOfLines={1}>
                    {item.description}
                  </Text>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={24} color={c.textSecondary} />
            </TouchableOpacity>
          )}
        />
      )}
      
      {/* Botón flotante para crear más tableros si ya hay datos */}
      {!loading && (
        <TouchableOpacity
          style={{ backgroundColor: c.accent, shadowColor: c.accent, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5 }}
          className="absolute bottom-36 right-5 w-14 h-14 rounded-full items-center justify-center"
          onPress={() => setModalVisible(true)}
        >
          <Ionicons name="add" size={32} color={c.textPrimary} />
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView style={{ backgroundColor: c.background, flex: 1 }} edges={['top']}>
      {hasData ? <ListState /> : <EmptyState />}

      {/* Modal para Crear Tablero */}
      <Modal visible={modalVisible} transparent={true} animationType="slide">
        <Pressable 
          style={{ flex: 1, backgroundColor: c.modalOverlay, justifyContent: 'flex-end' }} 
          onPress={() => setModalVisible(false)}
        >
          <KeyboardAvoidingView 
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <Pressable style={{ backgroundColor: c.surface }} className="rounded-t-3xl p-6 pt-2 pb-10" onPress={(e) => e.stopPropagation()}>
              {/* Grabber */}
              <View className="items-center mb-6 mt-2">
                <View style={{ backgroundColor: c.handle }} className="w-12 h-1.5 rounded-full" />
              </View>
              
              <Text style={{ color: c.textPrimary }} className="text-xl font-bold text-center mb-6">
                Crear Tablero
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
                placeholder="Ej: Preparación Primer Cuatrimestre"
                placeholderTextColor={c.textSecondary}
                value={newBoardName}
                onChangeText={setNewBoardName}
              />

              <Text style={{ color: c.textSecondary }} className="text-sm font-semibold mb-2 ml-1">
                Descripcion
              </Text>
              <TextInput
                style={{ backgroundColor: c.background, color: c.textPrimary }}
                className="p-4 rounded-xl mb-8 text-base"
                placeholder="Ej: Pasos a seguir para aprobar el primer..."
                placeholderTextColor={c.textSecondary}
                value={newBoardDesc}
                onChangeText={setNewBoardDesc}
                multiline
              />

              <TouchableOpacity
                style={{ backgroundColor: c.accent }}
                className="w-full py-4 rounded-xl flex-row justify-center items-center mb-4"
                onPress={handleCreateBoard}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator color={c.textPrimary} />
                ) : (
                  <Text style={{ color: c.textPrimary }} className="text-base font-bold">Crear</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                className="w-full py-3 flex-row justify-center items-center"
                onPress={() => setModalVisible(false)}
                disabled={creating}
              >
                <Text style={{ color: c.textSecondary }} className="text-base">Cancelar</Text>
              </TouchableOpacity>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      {/* Alerta de validación */}
      <Modal transparent visible={showAlert} animationType="fade" onRequestClose={() => setShowAlert(false)}>
        <View className="flex-1 items-center justify-center p-8" style={{ backgroundColor: c.modalOverlay }}>
          <View style={{ backgroundColor: c.modalBg, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 25 }} className="w-full max-w-sm rounded-[32px] p-8 items-center">
            <Text style={{ color: c.textPrimary }} className="text-2xl font-bold mb-4 text-center">
              Crear Tablero
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
