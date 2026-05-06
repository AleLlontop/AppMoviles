import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Platform, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface TaskCardProps {
  name: string;
  time: string;
  active?: boolean;
  color?: string;
  onPress?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function TaskCard({ name, time, active, color, onPress, onEdit, onDelete }: TaskCardProps) {
  const brandColor = color || '#826BF0';
  const lightBg = `${brandColor}15`; // 15 opacity in hex
  const [modalVisible, setModalVisible] = useState(false);

  const handleOptions = () => {
    setModalVisible(true);
  };

  return (
    <>
      <View 
        className={`rounded-[24px] p-4 flex-row items-center justify-between mb-4 border ${active ? 'bg-white/90' : 'border-white bg-white/80'}`}
        style={[
          { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 20, elevation: 2 },
          active && { borderColor: brandColor, borderWidth: 1 }
        ]}
      >
        <TouchableOpacity onPress={onPress} className="flex-row items-center flex-1">
          {active ? (
            <LinearGradient
              colors={[brandColor, brandColor]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                width: 48,
                height: 48,
                borderRadius: 16,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 16,
                shadowColor: brandColor,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.4,
                shadowRadius: 10,
                elevation: 5
              }}
            >
              <Ionicons name="square" size={16} color="white" />
            </LinearGradient>
          ) : (
            <View 
              className="w-12 h-12 rounded-2xl items-center justify-center mr-4"
              style={{ backgroundColor: lightBg }}
            >
              <Ionicons name="play" size={20} color={brandColor} />
            </View>
          )}
          <Text className={`text-lg flex-1 ${active ? 'font-semibold text-slate-800' : 'font-medium text-slate-700'}`} numberOfLines={1}>
            {name}
          </Text>
        </TouchableOpacity>

        <View className="flex-row items-center">
          <Text 
            className={`font-mono mr-2 ${active ? 'text-slate-500 font-semibold' : 'text-slate-400'}`}
            style={{ fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}
          >
            {time}
          </Text>
          
          {(onEdit || onDelete) && (
            <TouchableOpacity onPress={handleOptions} className="p-2 ml-1">
              <Ionicons name="ellipsis-vertical" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <Modal
        transparent={true}
        visible={modalVisible}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity 
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' }} 
          activeOpacity={1} 
          onPress={() => setModalVisible(false)}
        >
          <View 
            className="bg-white w-[85%] rounded-[32px] p-6 items-center" 
            style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 }}
          >
            <View className="w-12 h-1.5 bg-gray-200 rounded-full mb-6" />
            
            <Text className="text-xl font-bold text-slate-800 mb-2 text-center">{name}</Text>
            <Text className="text-sm text-slate-500 mb-8 text-center">¿Qué deseas hacer con esta materia?</Text>

            {onEdit && (
              <TouchableOpacity 
                className="w-full bg-[#826BF0]/10 py-4 rounded-[20px] flex-row justify-center items-center mb-3"
                onPress={() => {
                  setModalVisible(false);
                  onEdit();
                }}
              >
                <Ionicons name="pencil" size={20} color="#826BF0" />
                <Text className="text-[#826BF0] font-semibold text-base ml-2">Editar materia</Text>
              </TouchableOpacity>
            )}

            {onDelete && (
              <TouchableOpacity 
                className="w-full bg-red-50 py-4 rounded-[20px] flex-row justify-center items-center mb-6"
                onPress={() => {
                  setModalVisible(false);
                  onDelete();
                }}
              >
                <Ionicons name="trash" size={20} color="#EF4444" />
                <Text className="text-red-500 font-semibold text-base ml-2">Eliminar materia</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity 
              className="w-full py-2 rounded-2xl flex-row justify-center items-center"
              onPress={() => setModalVisible(false)}
            >
              <Text className="text-slate-400 font-medium text-base">Cancelar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}
