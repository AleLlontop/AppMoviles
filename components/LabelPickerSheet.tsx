import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Pressable, ActivityIndicator } from 'react-native';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { getTags, Tag } from '@/services/tagsService';

type Props = {
  visible: boolean;
  onClose: () => void;
  onConfirm: (tagId: string) => void;
  subjectName?: string;
};

export default function LabelPickerSheet({ visible, onClose, onConfirm, subjectName }: Props) {
  const c = useThemeColors();
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setSelectedId(null);
    setLoading(true);
    getTags()
      .then((t) => setTags(t))
      .catch((e) => console.error('Error loading tags:', e))
      .finally(() => setLoading(false));
  }, [visible]);

  const confirm = () => {
    if (!selectedId) return;
    onConfirm(selectedId);
  };

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: c.modalOverlay, justifyContent: 'flex-end' }}
        onPress={onClose}
      >
        <Pressable
          style={{ backgroundColor: c.surface, paddingBottom: 32 }}
          className="rounded-t-3xl px-6 pt-2"
          onPress={(e) => e.stopPropagation()}
        >
          <View className="items-center mb-4 mt-2">
            <View style={{ backgroundColor: c.handle }} className="w-12 h-1.5 rounded-full" />
          </View>

          <Text style={{ color: c.textPrimary }} className="text-xl font-bold text-center mb-1">
            Elegí una etiqueta
          </Text>
          <Text style={{ color: c.textSecondary }} className="text-sm text-center mb-5">
            {subjectName ? `Para clasificar esta sesión de ${subjectName}` : 'Para clasificar esta sesión de estudio'}
          </Text>

          {loading ? (
            <View className="items-center py-8">
              <ActivityIndicator color={c.accent} />
            </View>
          ) : (
            <View className="gap-2 mb-5">
              {tags.map((tag) => {
                const isSel = selectedId === tag.id;
                return (
                  <TouchableOpacity
                    key={tag.id}
                    onPress={() => setSelectedId(tag.id)}
                    style={{
                      backgroundColor: isSel ? `${tag.color}20` : c.background,
                      borderColor: isSel ? tag.color : 'transparent',
                      borderWidth: 1.5,
                    }}
                    className="flex-row items-center py-4 px-4 rounded-2xl"
                  >
                    <View
                      style={{
                        backgroundColor: tag.color,
                        width: 12,
                        height: 12,
                        borderRadius: 6,
                        marginRight: 14,
                      }}
                    />
                    <View className="flex-1">
                      <Text style={{ color: isSel ? tag.color : c.textPrimary, fontSize: 15, fontWeight: '700' }}>
                        {tag.label}
                      </Text>
                      {tag.description ? (
                        <Text style={{ color: c.textSecondary, fontSize: 12, marginTop: 2 }}>
                          {tag.description}
                        </Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <TouchableOpacity
            style={{ backgroundColor: c.accent, opacity: selectedId ? 1 : 0.4 }}
            className="w-full py-4 rounded-xl items-center justify-center mb-2"
            onPress={confirm}
            disabled={!selectedId}
          >
            <Text style={{ color: c.textPrimary }} className="text-base font-bold">
              Iniciar sesión
            </Text>
          </TouchableOpacity>

          <TouchableOpacity className="w-full py-2 items-center" onPress={onClose}>
            <Text style={{ color: c.textSecondary }} className="text-sm">Cancelar</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
