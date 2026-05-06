import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const SettingRow = ({ title, value, showBorder = true, onPress }: any) => (
  <View>
    <TouchableOpacity style={styles.settingItem} activeOpacity={0.7} onPress={onPress}>
      <Text style={styles.settingTitle}>{title}</Text>
      <View style={styles.settingRight}>
        {value ? <Text style={styles.settingValue}>{value}</Text> : null}
        <Ionicons name="chevron-forward" size={24} color="#C7C7CC" style={{ marginLeft: 8 }} />
      </View>
    </TouchableOpacity>
    {showBorder ? <View style={styles.separator} /> : null}
  </View>
);

export default function MoreScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>-Configuraciones</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.settingsGroup}>
          <SettingRow title="Apodo" value="Alex 💻📝" />
          <SettingRow title="Mensaje de estado" />
          <SettingRow title="Studicon settings" />
          <SettingRow title="Categorías" value="Uni." showBorder={false} />
        </View>

        <View style={styles.settingsGroup}>
          <SettingRow title="Configurar tema" value="Light" showBorder={false} />
        </View>

        <View style={styles.settingsGroup}>
          <SettingRow title="Seleccionar región" value="ARGENTINA" />
          <SettingRow title="Cambiar lenguaje" showBorder={false} />
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
    backgroundColor: '#F7F9FB', // Surface Light from guidelines
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
    fontWeight: '700', // Bold from guidelines
    color: '#191C1E', // On-Surface from guidelines
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
    fontWeight: '500', // Medium
    color: '#191C1E', // On-Surface from guidelines
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingValue: {
    fontSize: 18,
    fontWeight: '400', // Regular
    color: '#7B7486', // Outline color used for secondary text
  },
  separator: {
    height: 1,
    backgroundColor: '#7B7486', // Outline color from guidelines
    opacity: 0.15, // Subtle separator
    marginLeft: 24,
  },
});
