import React, { useState, useEffect } from 'react';

import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

import {
  useRouter,
  useLocalSearchParams,
} from 'expo-router';

import { supabase } from '@/utils/supabase';

import { Ionicons } from '@expo/vector-icons';

import { useThemeColors } from '@/hooks/use-theme-colors';

import { useUser } from '@/hooks/use-user';

const COLORS = [
  '#EA4335',
  '#F57C00',
  '#FDD835',
  '#4CAF50',
  '#2196F3',
  '#9C27B0',
  '#FF4081',
  '#00BFA5',
  '#8BC34A',
  '#D500F9',
  '#5E35B1',
  '#D4AF37',
  '#795548',
  '#757575',
  '#37474F',
  '#69F0AE',
];

export default function AddSubjectScreen() {
  const router = useRouter();

  const { id } = useLocalSearchParams();

  const user = useUser();

  const c = useThemeColors();

  const [name, setName] = useState('');

  const [color, setColor] =
    useState('#EA4335');

  const [loading, setLoading] =
    useState(false);

  const [initialLoading, setInitialLoading] =
    useState(!!id);

  const [showColorPicker, setShowColorPicker] =
    useState(false);

  const [showAlert, setShowAlert] =
    useState(false);

  const [alertMessage, setAlertMessage] =
    useState('');

  useEffect(() => {
    if (id) {
      fetchSubject();
    }
  }, [id]);

  const fetchSubject = async () => {
    try {
      const { data, error } =
        await supabase
          .from('subjects')
          .select('*')
          .eq('id', id)
          .single();

      if (error) throw error;

      if (data) {
        setName(data.name);

        setColor(
          data.color || '#EA4335'
        );
      }
    } catch (err) {
      console.error(
        'Error fetching subject',
        err
      );
    } finally {
      setInitialLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) {
      setAlertMessage(
        'Debes iniciar sesión para crear materias.'
      );

      setShowAlert(true);

      return;
    }

    if (name.trim().length < 2) {
      setAlertMessage(
        'Debe poseer más de un caracter'
      );

      setShowAlert(true);

      return;
    }

    try {
      setLoading(true);

      if (id) {
        const { error } = await supabase
          .from('subjects')
          .update({
            name: name.trim(),
            color,
          })
          .eq('id', id)
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('subjects')
          .insert([
            {
              name: name.trim(),

              color,

              user_id: user.id,
            },
          ]);

        if (error) throw error;
      }

      router.back();
    } catch (err: any) {
      console.log(err);

      setAlertMessage(
        err.message || 'Error al guardar'
      );

      setShowAlert(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: c.background,
        paddingTop:
          Platform.OS === 'android'
            ? 24
            : 0,
      }}
    >
      {/* Header */}
      <View
        style={{
          backgroundColor: c.accent,
        }}
        className="px-4 py-3 flex-row items-center justify-between"
      >
        <TouchableOpacity
          onPress={() => router.back()}
          className="px-2"
        >
          <Text className="text-white text-lg font-normal">
            Cancelar
          </Text>
        </TouchableOpacity>

        <Text className="text-white text-lg font-medium flex-1 text-center truncate mx-2">
          {id
            ? 'Editar asignatura'
            : 'Nueva asignatura'}
        </Text>

        <TouchableOpacity
          onPress={handleSave}
          className="px-2"
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white text-lg font-semibold">
              Listo
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Main */}
      <View className="flex-1 p-4 space-y-4 pt-6">
        {initialLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator
              size="large"
              color={c.accent}
            />
          </View>
        ) : (
          <>
            {/* Input */}
            <View className="mb-4">
              <TextInput
                value={name}
                onChangeText={setName}
                autoFocus={!id}
                placeholder="Ej. Matemáticas, inglés, ciencias..."
                placeholderTextColor={
                  c.textSecondary
                }
                style={{
                  backgroundColor:
                    c.surface,

                  color: c.textPrimary,

                  borderColor: c.border,

                  borderWidth: 1,

                  borderRadius: 16,

                  paddingHorizontal: 16,

                  height: 56,

                  fontSize: 16,
                }}
              />
            </View>

            {/* Color Picker */}
            <TouchableOpacity
              onPress={() =>
                setShowColorPicker(true)
              }
              style={{
                backgroundColor:
                  c.surface,

                borderColor: c.border,

                borderWidth: 1,

                borderRadius: 16,

                height: 56,

                paddingHorizontal: 16,
              }}
              className="flex-row items-center justify-between"
            >
              <Text
                style={{
                  color: c.textPrimary,
                  fontSize: 18,
                }}
              >
                Color de la asignatura
              </Text>

              <View
                className="w-10 h-10 rounded-full"
                style={{
                  backgroundColor:
                    color,
                }}
              />
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Alert */}
      <Modal
        transparent
        visible={showAlert}
        animationType="fade"
      >
        <View
          className="flex-1 items-center justify-center p-8"
          style={{
            backgroundColor:
              c.modalOverlay,
          }}
        >
          <View
            style={{
              backgroundColor:
                c.modalBg,

              elevation: 10,

              shadowColor: '#000',

              shadowOffset: {
                width: 0,
                height: 10,
              },

              shadowOpacity: 0.1,

              shadowRadius: 25,
            }}
            className="w-full max-w-sm rounded-[32px] p-8 items-center"
          >
            <Text
              style={{
                color: c.textPrimary,
              }}
              className="text-2xl font-semibold mb-4"
            >
              Agregar asignatura
            </Text>

            <Text
              style={{
                color: c.textSecondary,
              }}
              className="text-lg font-medium text-center mb-6"
            >
              {alertMessage}
            </Text>

            <TouchableOpacity
              style={{
                backgroundColor:
                  c.accent,
              }}
              className="w-full py-4 rounded-2xl items-center"
              onPress={() =>
                setShowAlert(false)
              }
            >
              <Text className="text-white text-xl font-medium">
                OK
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Color Modal */}
      <Modal
        transparent
        visible={showColorPicker}
        animationType="fade"
      >
        <View
          className="flex-1 items-center justify-center p-8"
          style={{
            backgroundColor:
              c.modalOverlay,
          }}
        >
          <View
            style={{
              backgroundColor:
                c.modalBg,

              elevation: 15,

              shadowColor: '#000',

              shadowOffset: {
                width: 0,
                height: 15,
              },

              shadowOpacity: 0.15,

              shadowRadius: 30,
            }}
            className="w-full max-w-sm rounded-3xl p-8 items-center"
          >
            <View
              className="flex-row flex-wrap justify-center mb-6"
              style={{
                gap: 16,
              }}
            >
              {COLORS.map((cItem) => (
                <TouchableOpacity
                  key={cItem}
                  className="w-12 h-12 rounded-full items-center justify-center"
                  style={{
                    backgroundColor:
                      cItem,
                  }}
                  onPress={() => {
                    setColor(cItem);

                    setShowColorPicker(
                      false
                    );
                  }}
                >
                  {color === cItem && (
                    <Ionicons
                      name="checkmark"
                      size={24}
                      color="white"
                    />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <View className="w-full flex-row justify-end mt-2">
              <TouchableOpacity
                onPress={() =>
                  setShowColorPicker(
                    false
                  )
                }
                className="px-4 py-2"
              >
                <Text
                  style={{
                    color:
                      c.textSecondary,
                  }}
                  className="text-lg font-normal"
                >
                  Cancelar
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}