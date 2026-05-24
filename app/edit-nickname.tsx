import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useUser } from '@/hooks/use-user';
import {
  getProfile,
  upsertProfile,
} from '@/services/profilesService';

import { useThemeColors } from '@/hooks/use-theme-colors';

const MAX_LENGTH = 240;

export default function EditNicknameScreen() {
  const router = useRouter();

  const user = useUser();

  const c = useThemeColors();

  const [nickname, setNickname] =
    useState('');

  const [loading, setLoading] =
    useState(false);

  const [initialLoading, setInitialLoading] =
    useState(true);

  useEffect(() => {
    if (!user) return;

    getProfile(user.id)
      .then((p) => {
        if (p?.nickname) {
          setNickname(p.nickname);
        }
      })
      .finally(() =>
        setInitialLoading(false)
      );
  }, [user]);

  const handleSave = async () => {
    if (!user) return;

    const trimmed = nickname.trim();

    if (trimmed.length === 0) return;

    try {
      setLoading(true);

      await upsertProfile(user.id, {
        nickname: trimmed,

        // IMPORTANTE
        name:
          user.user_metadata
            ?.full_name ||
          user.user_metadata?.name ||
          user.email ||
          'Usuario',
      });

      router.back();
    } catch (err) {
      console.error(
        'Error saving nickname:',
        err
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView
      style={[
        styles.container,
        {
          backgroundColor:
            c.background,
        },
      ]}
      edges={['top']}
    >
      {/* HEADER */}
      <View
        style={[
          styles.header,
          {
            backgroundColor:
              c.accent,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() =>
            router.back()
          }
          style={styles.cancelBtn}
        >
          <Text
            style={styles.cancelText}
          >
            Cancelar
          </Text>
        </TouchableOpacity>

        <Text
          style={styles.headerTitle}
        >
          Apodo
        </Text>

        <TouchableOpacity
          onPress={handleSave}
          style={styles.saveBtn}
          disabled={
            loading ||
            nickname.trim()
              .length === 0
          }
        >
          {loading ? (
            <ActivityIndicator
              color="#fff"
              size="small"
            />
          ) : (
            <Text
              style={
                styles.saveText
              }
            >
              Listo
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* CONTENT */}
      <View style={styles.content}>
        {initialLoading ? (
          <ActivityIndicator
            color={c.accent}
            size="large"
          />
        ) : (
          <>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor:
                    c.surface,

                  color:
                    c.textPrimary,

                  borderColor:
                    c.border,
                },
              ]}
              value={nickname}
              onChangeText={
                setNickname
              }
              maxLength={
                MAX_LENGTH
              }
              placeholder="Tu apodo..."
              placeholderTextColor={
                c.textSecondary
              }
              autoFocus
              returnKeyType="done"
              onSubmitEditing={
                handleSave
              }
            />

            <Text
              style={[
                styles.counter,
                {
                  color:
                    nickname.length >
                    MAX_LENGTH *
                      0.9
                      ? '#F97316'
                      : c.textSecondary,
                },
              ]}
            >
              {nickname.length} /{' '}
              {MAX_LENGTH}
            </Text>

            <Text
              style={[
                styles.hint,
                {
                  color:
                    c.textSecondary,
                },
              ]}
            >
              Este apodo se
              mostrará en tu
              perfil dentro de
              la app.
            </Text>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,

    paddingTop:
      Platform.OS ===
      'android'
        ? 24
        : 0,
  },

  header: {
    flexDirection: 'row',

    alignItems: 'center',

    justifyContent:
      'space-between',

    paddingHorizontal: 16,

    paddingVertical: 12,
  },

  cancelBtn: {
    padding: 4,
  },

  cancelText: {
    color: '#fff',

    fontSize: 16,
  },

  headerTitle: {
    color: '#fff',

    fontSize: 17,

    fontWeight: '600',
  },

  saveBtn: {
    backgroundColor:
      'rgba(255,255,255,0.25)',

    paddingHorizontal: 14,

    paddingVertical: 6,

    borderRadius: 12,
  },

  saveText: {
    color: '#fff',

    fontSize: 16,

    fontWeight: '600',
  },

  content: {
    flex: 1,

    padding: 24,

    gap: 12,
  },

  input: {
    borderRadius: 16,

    paddingHorizontal: 20,

    paddingVertical: 16,

    fontSize: 18,

    borderWidth: 1,

    shadowColor: '#000',

    shadowOffset: {
      width: 0,
      height: 2,
    },

    shadowOpacity: 0.04,

    shadowRadius: 8,

    elevation: 2,
  },

  counter: {
    textAlign: 'right',

    fontSize: 12,
  },

  hint: {
    fontSize: 13,

    marginTop: 4,
  },
});