import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, TextInput, ActivityIndicator, FlatList, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { supabase } from '@/utils/supabase';
import { useUser } from '@/hooks/use-user';

type Summary = {
  id: string;
  created_at: string;
  tittle: string;
  content: string | null;
  dashboard_item_id: string;
};

export default function ResumenesScreen() {
  const c = useThemeColors();
  const router = useRouter();
  const user = useUser();
  const { id } = useLocalSearchParams(); // dashboard_id

  const [loading, setLoading] = useState(true);
  const [summaries, setSummaries] = useState<Summary[]>([]);

  // Modal states
  const [readerVisible, setReaderVisible] = useState(false);
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);
  const [updating, setUpdating] = useState(false);

  // Form & selection states
  const [selectedSummary, setSelectedSummary] = useState<Summary | null>(null);
  const [summaryTitle, setSummaryTitle] = useState('');
  const [summaryContent, setSummaryContent] = useState('');

  // Validation alert states
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');

  useFocusEffect(
    useCallback(() => {
      if (id) {
        fetchSummaries();
      }
    }, [id])
  );

  const fetchSummaries = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('summaries')
        .select('*, dashboard_items!inner(dashboard_id)')
        .eq('dashboard_items.dashboard_id', id);

      if (error) throw error;
      setSummaries(data || []);
    } catch (error) {
      console.error('Error fetching summaries:', error);
    } finally {
      setLoading(false);
    }
  };

  const openReader = (summary: Summary) => {
    setSelectedSummary(summary);
    setSummaryTitle(summary.tittle);
    setSummaryContent(summary.content || '');
    setReaderVisible(true);
  };

  const handleCreateSummary = async () => {
    if (!user || !id) return;

    const defaultTitle = "Nuevo Resumen";

    try {
      setUpdating(true);

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
          .insert([
            {
              dashboard_id: id,
              user_id: user.id,
            },
          ])
          .select()
          .single();

        if (createError) throw createError;

        dashboardItemId = newItem.id;
      }

      const { data: newSummary, error: summaryError } = await supabase
        .from('summaries')
        .insert([
          {
            tittle: defaultTitle,
            content: '',
            dashboard_item_id: dashboardItemId,
          },
        ])
        .select()
        .single();

      if (summaryError) throw summaryError;

      // Abrimos directamente el lector
      setSelectedSummary(newSummary);
      setSummaryTitle(newSummary.tittle);
      setSummaryContent('');
      setReaderVisible(true);

      fetchSummaries();
    } catch (error) {
      console.error('Error creating summary:', error);
      Alert.alert('Error', 'Hubo un error al crear el resumen.');
    } finally {
      setUpdating(false);
    }
  };

  const handleEditSummary = async () => {
    if (!selectedSummary) return;
    const trimmedTitle = summaryTitle.trim();
    try {
      setUpdating(true);
      const { error } = await supabase
        .from('summaries')
        .update({
          tittle: trimmedTitle,
          content: summaryContent.trim()
        })
        .eq('id', selectedSummary.id);

      if (error) throw error;
      fetchSummaries();
    } catch (error) {
      console.error('Error updating summary:', error);
      Alert.alert('Error', 'Hubo un error al actualizar el resumen.');
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteSummary = async () => {
    if (!selectedSummary) return;

    try {
      setUpdating(true);
      const { error } = await supabase
        .from('summaries')
        .delete()
        .eq('id', selectedSummary.id);

      if (error) throw error;

      setConfirmDeleteVisible(false);
      setReaderVisible(false);
      setSelectedSummary(null);
      fetchSummaries();
    } catch (error) {
      console.error('Error deleting summary:', error);
      Alert.alert('Error', 'Hubo un error al eliminar el resumen.');
    } finally {
      setUpdating(false);
    }
  };

  const EmptyState = () => (
    <View className="flex-1 items-center justify-center px-8">
      <View style={{ backgroundColor: c.surface }} className="w-32 h-32 rounded-full items-center justify-center mb-8">
        <Ionicons name="document-text" size={48} color={c.accent} opacity={0.8} />
      </View>
      <Text style={{ color: c.textPrimary }} className="text-2xl font-bold text-center mb-4">
        No hay resúmenes de estudio
      </Text>
      <Text style={{ color: c.textSecondary }} className="text-base text-center mb-8">
        Crea tus propios resúmenes en formato texto o Markdown para tener todo tu contenido de estudio a mano.
      </Text>
      <TouchableOpacity
        style={{ backgroundColor: c.accent }}
        className="w-full py-4 rounded-xl flex-row justify-center items-center"
        onPress={handleCreateSummary}
      >
        <Text style={{ color: c.textPrimary }} className="text-base font-bold">Crear Resumen</Text>
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
          Resumenes
        </Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={c.accent} />
        </View>
      ) : summaries.length === 0 ? (
        <EmptyState />
      ) : (
        <View className="flex-1 px-5 pt-4">
          <FlatList
            data={summaries}
            keyExtractor={item => item.id}
            contentContainerStyle={{ paddingBottom: 100 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={{ backgroundColor: c.surface }}
                className="p-5 rounded-2xl mb-3 flex-row justify-between items-center"
                onPress={() => openReader(item)}
              >
                <View className="flex-1 mr-4">
                  <Text style={{ color: c.textPrimary }} className="text-lg font-bold mb-1" numberOfLines={1}>
                    {item.tittle}
                  </Text>
                  <Text style={{ color: c.textSecondary }} className="text-sm" numberOfLines={2}>
                    {item.content || 'Sin contenido de texto.'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={c.textSecondary} />
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* Botón flotante para crear resumen */}
      {!loading && summaries.length > 0 && (
        <TouchableOpacity
          style={{ backgroundColor: c.accent, shadowColor: c.accent, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5 }}
          className="absolute bottom-10 right-5 w-14 h-14 rounded-full items-center justify-center"
          onPress={handleCreateSummary}
        >
          <Ionicons name="add" size={32} color={c.textPrimary} />
        </TouchableOpacity>
      )}

      {/* Modal de Lector Detallado (Pantalla Completa) */}
      <Modal visible={readerVisible} transparent animationType="slide" onRequestClose={() => setReaderVisible(false)}>
        <SafeAreaView style={{ backgroundColor: c.background, flex: 1 }} edges={['top']}>
          {/* Header del Lector */}
          <View className="flex-row items-center justify-between px-5 pt-4 pb-2">
            <TouchableOpacity onPress={() => setReaderVisible(false)} className="p-1">
              <Ionicons name="close" size={24} color={c.textPrimary} />
            </TouchableOpacity>

            <View className="flex-row items-center gap-3">
              <TouchableOpacity
                onPress={handleEditSummary}
                className="p-1"
              >
                <Ionicons
                  name="save-outline"
                  size={22}
                  color={c.accent}
                />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setConfirmDeleteVisible(true)} className="p-1">
                <Ionicons name="trash-outline" size={20} color="#EF4444" />
              </TouchableOpacity>
            </View>
          </View>

          {selectedSummary && (
            <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 60 }} showsVerticalScrollIndicator={true}>
              <TextInput
                style={{ color: c.textPrimary }}
                className="text-3xl font-extrabold mb-6 p-0"
                value={summaryTitle}
                onChangeText={setSummaryTitle}
                placeholder="Título del resumen..."
                placeholderTextColor={c.textSecondary}
              />

              <TextInput
                style={{
                  color: c.textPrimary,
                  fontSize: 16,
                  lineHeight: 26,
                  minHeight: 450,
                  textAlignVertical: 'top'
                }}
                multiline
                value={summaryContent}
                onChangeText={setSummaryContent}
                placeholder="Empieza a escribir..."
                placeholderTextColor={c.textSecondary}
              />
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      {/* Modal de Confirmar Eliminar Resumen */}
      <Modal transparent visible={confirmDeleteVisible} animationType="fade" onRequestClose={() => setConfirmDeleteVisible(false)}>
        <Pressable style={{ flex: 1, backgroundColor: c.modalOverlay, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 }} onPress={() => !updating && setConfirmDeleteVisible(false)}>
          <Pressable style={{ backgroundColor: c.surface }} className="w-full p-6 rounded-3xl items-center" onPress={(e) => e.stopPropagation()}>
            <View className="w-14 h-14 rounded-2xl items-center justify-center mb-4" style={{ backgroundColor: 'rgba(239,68,68,0.14)' }}>
              <Ionicons name="trash-outline" size={26} color="#EF4444" />
            </View>
            <Text style={{ color: c.textPrimary }} className="text-xl font-extrabold text-center mb-2">Eliminar Resumen</Text>
            <Text style={{ color: c.textSecondary }} className="text-sm text-center mb-6 leading-5">
              ¿Estás seguro de que quieres eliminar "{selectedSummary?.tittle}"? Esta acción no se puede deshacer.
            </Text>
            <TouchableOpacity
              style={{ backgroundColor: '#EF4444' }}
              className="w-full py-4 rounded-xl items-center justify-center mb-3"
              onPress={handleDeleteSummary}
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

      {/* Alerta de validación */}
      <Modal transparent visible={showAlert} animationType="fade" onRequestClose={() => setShowAlert(false)}>
        <View className="flex-1 items-center justify-center p-8" style={{ backgroundColor: c.modalOverlay }}>
          <View style={{ backgroundColor: c.modalBg, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 25 }} className="w-full max-w-sm rounded-[32px] p-8 items-center">
            <Text style={{ color: c.textPrimary }} className="text-2xl font-bold mb-4 text-center">
              Resumen
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