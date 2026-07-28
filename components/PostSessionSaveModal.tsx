import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { getTags, Tag } from '@/services/tagsService';

type Props = {
  visible: boolean;
  durationSeconds: number;
  initialTagId: string | null;
  onSave: (tagId: string | null) => void; // tagId=null → guardar sin etiqueta
  onClose: () => void;
};

const formatDur = (sec: number) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, '0')}s`;
  return `${s}s`;
};

export default function PostSessionSaveModal({
  visible,
  durationSeconds,
  initialTagId,
  onSave,
  onClose,
}: Props) {
  const c = useThemeColors();
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(initialTagId);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!visible) return;
    setSelectedId(initialTagId);
    setLoading(true);
    getTags()
      .then(setTags)
      .catch((e) => console.error('Error loading tags:', e))
      .finally(() => setLoading(false));
  }, [visible, initialTagId]);

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.75)',
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 24,
          paddingVertical: 40,
        }}
      >
        <ScrollView
          style={{ width: '100%', maxHeight: '100%' }}
          contentContainerStyle={{ justifyContent: 'center', flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
        >
        <View style={{ backgroundColor: c.surface }} className="w-full p-6 rounded-3xl items-center">
          {/* Check icon */}
          <View
            style={{ backgroundColor: 'rgba(48,192,64,0.15)' }}
            className="w-16 h-16 rounded-full items-center justify-center mb-4"
          >
            <Ionicons name="checkmark" size={32} color="#30C040" />
          </View>

          <Text style={{ color: c.textPrimary }} className="text-2xl font-extrabold mb-1">
            ¡Buena sesión!
          </Text>
          <Text style={{ color: c.textSecondary }} className="text-sm mb-6">
            Estudiaste {formatDur(durationSeconds)}
          </Text>

          <Text
            style={{ color: c.textSecondary, letterSpacing: 0.6 }}
            className="text-xs font-bold self-start mb-3"
          >
            ¿QUÉ HICISTE EN ESTA SESIÓN?
          </Text>

          {loading ? (
            <View className="items-center py-6 w-full">
              <ActivityIndicator color={c.accent} />
            </View>
          ) : (
            <View className="flex-row flex-wrap w-full" style={{ marginHorizontal: -4, marginBottom: 20 }}>
              {tags.map((tag) => {
                const isSel = selectedId === tag.id;
                return (
                  <View key={tag.id} style={{ width: '50%', padding: 4 }}>
                    <TouchableOpacity
                      onPress={() => setSelectedId(tag.id)}
                      style={{
                        backgroundColor: isSel ? `${tag.color}20` : c.background,
                        borderColor: isSel ? tag.color : 'transparent',
                        borderWidth: 1.5,
                      }}
                      className="flex-row items-center py-3 px-3 rounded-2xl"
                    >
                      <View
                        style={{
                          backgroundColor: tag.color,
                          width: 10,
                          height: 10,
                          borderRadius: 5,
                          marginRight: 8,
                        }}
                      />
                      <Text
                        style={{ color: isSel ? tag.color : c.textPrimary, fontSize: 14, fontWeight: '600' }}
                      >
                        {tag.label}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}

          <TouchableOpacity
            style={{ backgroundColor: c.accent, opacity: selectedId ? 1 : 0.4 }}
            className="w-full py-4 rounded-xl items-center justify-center mb-3"
            onPress={() => onSave(selectedId)}
            disabled={!selectedId}
          >
            <Text style={{ color: c.textPrimary }} className="text-base font-bold">
              Guardar sesión
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{ backgroundColor: c.background }}
            className="w-full py-3 rounded-xl items-center justify-center"
            onPress={() => onSave(null)}
          >
            <Text style={{ color: c.textSecondary, fontSize: 14, fontWeight: '600' }}>
              Guardar sin etiqueta
            </Text>
          </TouchableOpacity>
        </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
