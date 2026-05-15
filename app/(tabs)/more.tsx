import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

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

  const [nickname, setNickname] = useState('');
  const [editingNickname, setEditingNickname] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState('Universidad');

  const [showCategories, setShowCategories] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const savedNickname = await AsyncStorage.getItem('nickname');

    const savedCategory = await AsyncStorage.getItem('category');

    if (savedNickname) {
      setNickname(savedNickname);
    }

    if (savedCategory) {
      setSelectedCategory(savedCategory);
    }
  };

  const saveNickname = async () => {
    await AsyncStorage.setItem('nickname', nickname);

    setEditingNickname(false);
  };

  const selectCategory = async (category: string) => {
    setSelectedCategory(category);

    await AsyncStorage.setItem('category', category);

    setShowCategories(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
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

        <Text style={styles.headerTitle}>Configuraciones</Text>

        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.settingsGroup}>
          <View style={styles.settingItem}>
            <Text style={styles.settingTitle}>Apodo</Text>

            {editingNickname ? (
              <TextInput
                style={styles.input}
                value={nickname}
                onChangeText={setNickname}
                placeholder="Tu apodo"
                autoFocus
                onSubmitEditing={saveNickname}
              />
            ) : (
              <TouchableOpacity
                onPress={() => setEditingNickname(true)}
              >
                <Text style={styles.settingValue}>
                  {nickname || 'Editar'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.separator} />

          <TouchableOpacity
            style={styles.settingItem}
            onPress={() =>
              setShowCategories(!showCategories)
            }
          >
            <Text style={styles.settingTitle}>
              Categorías
            </Text>

            <View style={styles.settingRight}>
              <Text style={styles.settingValue}>
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
              {categories.map((category) => (
                <TouchableOpacity
                  key={category}
                  style={styles.dropdownItem}
                  onPress={() =>
                    selectCategory(category)
                  }
                >
                  <Text style={styles.dropdownText}>
                    {category}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <View style={styles.settingsGroup}>
          <SettingRow
            title="Iniciar Sesión / Cuenta"
            showBorder={false}
            onPress={() => router.push('/login')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

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
    shadowOffset: { width: 0, height: 4 },
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
    fontWeight: '400',
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
    color: '#191C1E',
    textAlign: 'right',
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
});