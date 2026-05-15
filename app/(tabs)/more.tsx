import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { supabase } from '../../utils/supabase';

const categories = [
  'Universidad',
  'Programación',
  'Trabajo',
  'Personal',
  'Diseño',
];

const SettingRow = ({
  title,
  value,
  showBorder = true,
  onPress,
}: any) => (
  <View>
    <TouchableOpacity
      style={styles.settingItem}
      activeOpacity={0.7}
      onPress={onPress}
    >
      <Text style={styles.settingTitle}>{title}</Text>

      <View style={styles.settingRight}>
        {value ? (
          <Text style={styles.settingValue}>{value}</Text>
        ) : null}

        <Ionicons
          name="chevron-forward"
          size={24}
          color="#C7C7CC"
          style={{ marginLeft: 8 }}
        />
      </View>
    </TouchableOpacity>

    {showBorder ? <View style={styles.separator} /> : null}
  </View>
);

export default function MoreScreen() {
  const router = useRouter();

  // =========================
  // LOCAL SETTINGS
  // =========================
  const [nickname, setNickname] = useState('');
  const [editingNickname, setEditingNickname] = useState(false);

  const [selectedCategory, setSelectedCategory] =
    useState('Universidad');

  const [showCategories, setShowCategories] =
    useState(false);

  // =========================
  // AUTH
  // =========================
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] =
    useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [firstName, setFirstName] =
    useState('');
  const [lastName, setLastName] =
    useState('');

  const [loadingAuth, setLoadingAuth] =
    useState(false);

  const [user, setUser] = useState<any>(null);

  // =========================
  // LOAD DATA
  // =========================
  useEffect(() => {
    loadData();
    loadUser();
  }, []);

  const loadData = async () => {
    const savedNickname =
      await AsyncStorage.getItem('nickname');

    const savedCategory =
      await AsyncStorage.getItem('category');

    if (savedNickname)
      setNickname(savedNickname);

    if (savedCategory)
      setSelectedCategory(savedCategory);
  };

  const loadUser = async () => {
    const { data } =
      await supabase.auth.getUser();

    setUser(data?.user ?? null);
  };

  // =========================
  // SETTINGS
  // =========================
  const saveNickname = async () => {
    await AsyncStorage.setItem(
      'nickname',
      nickname
    );

    setEditingNickname(false);
  };

  const selectCategory = async (
    category: string
  ) => {
    setSelectedCategory(category);

    await AsyncStorage.setItem(
      'category',
      category
    );

    setShowCategories(false);
  };

  // =========================
  // LOGIN
  // =========================
  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert(
        'Faltan datos',
        'Completa email y contraseña.'
      );

      return;
    }

    setLoadingAuth(true);

    const { error } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    setLoadingAuth(false);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert(
        'Bienvenido',
        'Inicio de sesión exitoso.'
      );

      setShowLogin(false);

      setEmail('');
      setPassword('');

      loadUser();
    }
  };

  // =========================
  // REGISTER
  // =========================
  const handleSignUp = async () => {
    if (
      !firstName ||
      !lastName ||
      !email ||
      !password
    ) {
      Alert.alert(
        'Faltan datos',
        'Completa todos los campos.'
      );

      return;
    }

    if (password.length < 6) {
      Alert.alert(
        'Contraseña inválida',
        'Debe tener al menos 6 caracteres.'
      );

      return;
    }

    setLoadingAuth(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,

      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          full_name: `${firstName} ${lastName}`,
        },
      },
    });

    setLoadingAuth(false);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert(
        'Cuenta creada',
        'Revisa tu correo si hay verificación.'
      );

      setShowRegister(false);

      setFirstName('');
      setLastName('');
      setEmail('');
      setPassword('');
    }
  };

  // =========================
  // LOGOUT
  // =========================
  const handleLogout = async () => {
    await supabase.auth.signOut();

    setUser(null);

    Alert.alert(
      'Sesión cerrada',
      'Has salido de tu cuenta.'
    );
  };

  // =========================
  // UI
  // =========================
  return (
    <SafeAreaView
      style={styles.container}
      edges={['top']}
    >
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons
            name="chevron-back"
            size={28}
            color="#1A1A1A"
          />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>
          Configuraciones
        </Text>

        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        contentContainerStyle={
          styles.scrollContent
        }
        showsVerticalScrollIndicator={false}
      >
        {/* SETTINGS */}
        <View style={styles.settingsGroup}>
          <View style={styles.settingItem}>
            <Text style={styles.settingTitle}>
              Apodo
            </Text>

            {editingNickname ? (
              <TextInput
                style={styles.input}
                value={nickname}
                onChangeText={setNickname}
                placeholder="Tu apodo"
                autoFocus
                onSubmitEditing={
                  saveNickname
                }
              />
            ) : (
              <TouchableOpacity
                onPress={() =>
                  setEditingNickname(true)
                }
              >
                <Text
                  style={styles.settingValue}
                >
                  {nickname || 'Editar'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.separator} />

          <TouchableOpacity
            style={styles.settingItem}
            onPress={() =>
              setShowCategories(
                !showCategories
              )
            }
          >
            <Text style={styles.settingTitle}>
              Categorías
            </Text>

            <View
              style={styles.settingRight}
            >
              <Text
                style={styles.settingValue}
              >
                {selectedCategory}
              </Text>

              <Ionicons
                name={
                  showCategories
                    ? 'chevron-up'
                    : 'chevron-down'
                }
                size={22}
                color="#C7C7CC"
              />
            </View>
          </TouchableOpacity>

          {showCategories && (
            <View style={styles.dropdown}>
              {categories.map(
                (category) => (
                  <TouchableOpacity
                    key={category}
                    style={
                      styles.dropdownItem
                    }
                    onPress={() =>
                      selectCategory(
                        category
                      )
                    }
                  >
                    <Text
                      style={
                        styles.dropdownText
                      }
                    >
                      {category}
                    </Text>
                  </TouchableOpacity>
                )
              )}
            </View>
          )}
        </View>

        {/* AUTH */}
        <View style={styles.settingsGroup}>
          {/* USER */}
          {user && (
            <>
              <View style={styles.userBox}>
                <Text style={styles.userName}>
                  {user.user_metadata
                    ?.full_name ||
                    'Usuario'}
                </Text>

                <Text
                  style={styles.userEmail}
                >
                  {user.email}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.logoutBtn}
                onPress={handleLogout}
              >
                <Text
                  style={styles.logoutText}
                >
                  Cerrar sesión
                </Text>
              </TouchableOpacity>

              <View
                style={styles.separator}
              />
            </>
          )}

          {/* LOGIN */}
          {!user && (
            <>
              <SettingRow
                title="Iniciar Sesión"
                showBorder={false}
                onPress={() => {
                  setShowLogin(
                    !showLogin
                  );

                  setShowRegister(
                    false
                  );
                }}
              />

              {showLogin && (
                <View style={styles.authBox}>
                  <TextInput
                    placeholder="Email"
                    value={email}
                    onChangeText={
                      setEmail
                    }
                    style={
                      styles.inputAuth
                    }
                    autoCapitalize="none"
                  />

                  <TextInput
                    placeholder="Contraseña"
                    value={password}
                    onChangeText={
                      setPassword
                    }
                    style={
                      styles.inputAuth
                    }
                    secureTextEntry
                  />

                  <TouchableOpacity
                    style={
                      styles.authBtn
                    }
                    onPress={
                      handleLogin
                    }
                    disabled={
                      loadingAuth
                    }
                  >
                    <Text
                      style={
                        styles.authBtnText
                      }
                    >
                      Entrar
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              <View
                style={styles.separator}
              />

              {/* REGISTER */}
              <SettingRow
                title="Registrarse"
                showBorder={false}
                onPress={() => {
                  setShowRegister(
                    !showRegister
                  );

                  setShowLogin(
                    false
                  );
                }}
              />

              {showRegister && (
                <View style={styles.authBox}>
                  <TextInput
                    placeholder="Nombre"
                    value={firstName}
                    onChangeText={
                      setFirstName
                    }
                    style={
                      styles.inputAuth
                    }
                  />

                  <TextInput
                    placeholder="Apellido"
                    value={lastName}
                    onChangeText={
                      setLastName
                    }
                    style={
                      styles.inputAuth
                    }
                  />

                  <TextInput
                    placeholder="Email"
                    value={email}
                    onChangeText={
                      setEmail
                    }
                    style={
                      styles.inputAuth
                    }
                    autoCapitalize="none"
                  />

                  <TextInput
                    placeholder="Contraseña"
                    value={password}
                    onChangeText={
                      setPassword
                    }
                    style={
                      styles.inputAuth
                    }
                    secureTextEntry
                  />

                  <TouchableOpacity
                    style={[
                      styles.authBtn,
                      styles.authBtnSecondary,
                    ]}
                    onPress={
                      handleSignUp
                    }
                    disabled={
                      loadingAuth
                    }
                  >
                    <Text
                      style={
                        styles.authBtnText
                      }
                    >
                      Crear cuenta
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* STYLES */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F9FB',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },

  backButton: {
    padding: 8,
    marginLeft: -8,
  },

  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#191C1E',
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 120,
    gap: 24,
  },

  settingsGroup: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },

    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },

  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',

    paddingVertical: 20,
    paddingHorizontal: 20,
  },

  settingTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#191C1E',
  },

  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  settingValue: {
    fontSize: 18,
    color: '#7B7486',
  },

  separator: {
    height: 1,
    backgroundColor: '#7B7486',
    opacity: 0.15,
    marginLeft: 24,
  },

  input: {
    minWidth: 120,
    fontSize: 18,
    textAlign: 'right',
    color: '#191C1E',
  },

  dropdown: {
    paddingBottom: 12,
  },

  dropdownItem: {
    paddingVertical: 14,
    paddingHorizontal: 24,
  },

  dropdownText: {
    fontSize: 16,
    color: '#191C1E',
  },

  authBox: {
    padding: 16,
    gap: 12,
  },

  inputAuth: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    backgroundColor: '#FFF',
  },

  authBtn: {
    backgroundColor: '#191C1E',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },

  authBtnSecondary: {
    backgroundColor: '#7B7486',
  },

  authBtnText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 16,
  },

  userBox: {
    padding: 20,
    alignItems: 'center',
  },

  userName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#191C1E',
  },

  userEmail: {
    fontSize: 15,
    color: '#7B7486',
    marginTop: 4,
  },

  logoutBtn: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: '#E53935',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },

  logoutText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 16,
  },
});