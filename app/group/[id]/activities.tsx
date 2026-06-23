import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, TextInput, ActivityIndicator, FlatList, Switch, Platform, Alert, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { supabase } from '@/utils/supabase';
import { useUser } from '@/hooks/use-user';
// IMPORTAMOS TU MODAL
import { ConfirmModal } from '@/components/ConfirmModal';

type GroupActivity = { id: string; title: string; duration_min: number; type: string; };

export default function ActivitiesScreen() {
  const c = useThemeColors();
  const router = useRouter();
  const user = useUser();
  const { id: group_id } = useLocalSearchParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<GroupActivity[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  // Modal para crear la actividad
  const [modalVisible, setModalVisible] = useState(false);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState('');
  const [type, setType] = useState('task');
  const [notifyAll, setNotifyAll] = useState(false);

  // ESTADO PARA LA ALTURA DEL TECLADO
  const [kbHeight, setKbHeight] = useState(0);

  // ESTADOS DEL MODAL DE ELIMINAR
  const [actToDelete, setActToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // EFECTO PARA ESCUCHAR EL TECLADO
  useEffect(() => {
    if (!modalVisible) return;
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const show = Keyboard.addListener(showEvt, (e) => setKbHeight(e.endCoordinates?.height ?? 0));
    const hide = Keyboard.addListener(hideEvt, () => setKbHeight(0));

    return () => {
      show.remove();
      hide.remove();
    };
  }, [modalVisible]);

  useFocusEffect(
    useCallback(() => {
      if (group_id && user) loadData();
    }, [group_id, user])
  );

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: roleData } = await supabase.from('group_members').select('role').eq('group_id', group_id).eq('user_id', user!.id).single();
      setIsAdmin(roleData?.role === 'admin' || roleData?.role === 'owner' || roleData?.role === 'creator');

      const { data: actData, error } = await supabase.from('group_activities').select('*').eq('group_id', group_id).order('created_at', { ascending: false });
      if (error) throw error;
      setActivities(actData || []);
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateActivity = async () => {
    // Si es un timer, permitimos que pase sin duración (o le asignamos 0 internamente si querés)
    if (!title.trim() || (type !== 'timer' && !duration.trim())) {
      return Alert.alert('Error', 'El título y la duración son obligatorios.');
    }

    setCreating(true);
    try {
      const durationValue = type === 'timer' ? 0 : parseInt(duration);

      const { error } = await supabase.from('group_activities').insert([{
        group_id: group_id,
        title: title.trim(),
        duration_min: durationValue,
        type: type,
        notify_all: notifyAll,
        created_by: user!.id
      }]);

      if (error) throw error;

      setModalVisible(false);
      setTitle(''); setDuration(''); setNotifyAll(false);
      loadData();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setCreating(false);
    }
  };

  // FUNCIÓN PARA ELIMINAR DESDE EL MODAL
  const confirmDeleteActivity = async () => {
    if (!actToDelete) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('group_activities').delete().eq('id', actToDelete);
      if (error) throw error;
      setActToDelete(null);
      loadData();
    } catch (e: any) {
      Alert.alert('Error al eliminar', e.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={{ backgroundColor: c.background, flex: 1 }} edges={['top']}>
        <View className="flex-row items-center px-5 pt-4 pb-4">
          <TouchableOpacity onPress={() => router.back()} className="mr-4">
            <Ionicons name="chevron-back" size={24} color={c.textPrimary} />
          </TouchableOpacity>
          <Text style={{ color: c.textPrimary }} className="text-2xl font-bold">Actividades</Text>
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center"><ActivityIndicator color={c.accent} /></View>
        ) : activities.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <Ionicons name="folder-open" size={48} color={c.textSecondary} className="mb-4" />
            <Text style={{ color: c.textPrimary }} className="text-xl font-bold mb-2">No hay actividades</Text>
            <Text style={{ color: c.textSecondary }} className="text-center mb-6">Crea una actividad para empezar a cargar tareas.</Text>
            {isAdmin && (
              <TouchableOpacity style={{ backgroundColor: c.accent }} className="px-6 py-3 rounded-xl" onPress={() => setModalVisible(true)}>
                <Text style={{ color: c.textPrimary, fontWeight: 'bold' }}>Crear Actividad</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <FlatList
            data={activities}
            keyExtractor={item => item.id}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={{ backgroundColor: c.surface }}
                className="p-5 rounded-2xl mb-3 flex-row items-center justify-between"
                onPress={() => router.push(`/group/${group_id}/activity/${item.id}`)}
              >
                <View className="flex-1 pr-2">
                  <Text style={{ color: c.textPrimary }} className="text-lg font-bold mb-1">{item.title}</Text>
                  <Text style={{ color: c.textSecondary, fontSize: 12 }}>
                    {item.type === 'timer' ? 'Tipo: Cronómetro' : `${item.duration_min} min • Tipo: ${item.type}`}
                  </Text>
                </View>
                {isAdmin && (
                  <TouchableOpacity onPress={(e) => { e.stopPropagation(); setActToDelete(item.id); }}>
                    <Ionicons name="trash-outline" size={20} color="#EF4444" />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            )}
          />
        )}

        {isAdmin && activities.length > 0 && !loading && (
          <TouchableOpacity style={{ backgroundColor: c.accent }} className="absolute bottom-10 right-5 w-14 h-14 rounded-full items-center justify-center shadow-lg" onPress={() => setModalVisible(true)}>
            <Ionicons name="add" size={32} color={c.textPrimary} />
          </TouchableOpacity>
        )}

        {/* MODAL PARA CREAR LA ACTIVIDAD (CON PADDING DINÁMICO) */}
        <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
          <View style={{ flex: 1, backgroundColor: c.modalOverlay, justifyContent: 'flex-end' }}>
            <View style={{
              backgroundColor: c.surface,
              padding: 24,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingBottom: Platform.OS === 'ios' ? (kbHeight > 0 ? kbHeight + 20 : 40) : (kbHeight > 0 ? kbHeight : 24)
            }}>
              <Text style={{ color: c.textPrimary, fontSize: 18, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' }}>Nueva Actividad</Text>

              <Text style={{ color: c.textSecondary, marginBottom: 4 }}>Título</Text>
              <TextInput style={{ backgroundColor: c.background, color: c.textPrimary, padding: 14, borderRadius: 10, marginBottom: 12 }} value={title} onChangeText={setTitle} placeholder="Ej: Repaso General" placeholderTextColor={c.textSecondary} />

              <Text style={{ color: c.textSecondary, marginBottom: 4 }}>Tipo</Text>
              <View className="flex-row gap-2 mb-4">
                {['task', 'form', 'timer'].map(t => (
                  <TouchableOpacity key={t} onPress={() => setType(t)} style={{ flex: 1, padding: 10, borderRadius: 8, backgroundColor: type === t ? `${c.accent}30` : c.background, borderWidth: 1, borderColor: type === t ? c.accentStrong : 'transparent' }}>
                    <Text style={{ textAlign: 'center', color: type === t ? c.accentStrong : c.textPrimary, fontWeight: 'bold' }}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {type !== 'timer' && (
                <>
                  <Text style={{ color: c.textSecondary, marginBottom: 4 }}>Duración (minutos)</Text>
                  <TextInput style={{ backgroundColor: c.background, color: c.textPrimary, padding: 14, borderRadius: 10, marginBottom: 12 }} value={duration} onChangeText={setDuration} keyboardType="numeric" placeholder="Ej: 30" placeholderTextColor={c.textSecondary} />
                </>
              )}

              <View className="flex-row items-center justify-between mb-6">
                <Text style={{ color: c.textPrimary }}>Notificar a todos</Text>
                <Switch value={notifyAll} onValueChange={setNotifyAll} />
              </View>

              <TouchableOpacity style={{ backgroundColor: c.accent, padding: 16, borderRadius: 12, alignItems: 'center' }} onPress={handleCreateActivity} disabled={creating}>
                {creating ? <ActivityIndicator color={c.textPrimary} /> : <Text style={{ color: c.textPrimary, fontWeight: 'bold' }}>Guardar</Text>}
              </TouchableOpacity>
              <TouchableOpacity className="mt-4 py-2" onPress={() => setModalVisible(false)}><Text style={{ color: c.textSecondary, textAlign: 'center' }}>Cancelar</Text></TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* MODAL PERSONALIZADO DE ELIMINAR */}
        <ConfirmModal
          visible={!!actToDelete}
          title="Eliminar Actividad"
          description="¿Estás seguro de que deseas eliminar esta actividad y todas sus preguntas? Esta acción no se puede deshacer."
          icon="trash-outline"
          confirmLabel="Eliminar"
          destructive
          onConfirm={confirmDeleteActivity}
          onCancel={() => !deleting && setActToDelete(null)}
        />
      </SafeAreaView>
    </>
  );
}