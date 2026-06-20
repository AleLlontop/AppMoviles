import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/hooks/use-theme-colors';

export default function TableroIndex() {
  const router = useRouter();
  const c = useThemeColors();
  const { id } = useLocalSearchParams();

  return (
    <View style={{ backgroundColor: c.background, flex: 1, paddingHorizontal: 20, paddingTop: 20 }}>
      <TouchableOpacity
        style={{ backgroundColor: c.surface }}
        className="flex-row items-center justify-between px-6 py-10 rounded-3xl mb-6"
        onPress={() => router.push({ pathname: '/tablero/[id]/resumenes', params: { id: typeof id === 'string' ? id : id?.[0] || '' } })}
      >
        <Text style={{ color: c.accent }} className="text-2xl font-bold">
          Resumenes
        </Text>
        <Ionicons name="chevron-forward" size={24} color={c.textSecondary} />
      </TouchableOpacity>

      <TouchableOpacity
        style={{ backgroundColor: c.surface }}
        className="flex-row items-center justify-between px-6 py-10 rounded-3xl"
        onPress={() => router.push({ pathname: '/tablero/[id]/tareas', params: { id: typeof id === 'string' ? id : id?.[0] || '' } })}
      >
        <Text style={{ color: c.accent }} className="text-2xl font-bold">
          Tareas
        </Text>
        <Ionicons name="chevron-forward" size={24} color={c.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}
