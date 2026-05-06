import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function LoginScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.modal}>
          <Text style={styles.title}>Iniciar Sesión</Text>
          <Text style={styles.subtitle}>Elige un método para continuar</Text>

          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={styles.authButton} 
              activeOpacity={0.7}
              onPress={() => {}} // Placeholder for Google auth
            >
              <Ionicons name="logo-google" size={24} color="#DB4437" style={styles.icon} />
              <Text style={styles.buttonText}>Google</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.authButton} 
              activeOpacity={0.7}
              onPress={() => {}} // Placeholder for GitHub auth
            >
              <Ionicons name="logo-github" size={24} color="#333" style={styles.icon} />
              <Text style={styles.buttonText}>GitHub</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.cancelText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FB',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modal: {
    width: '100%',
    maxWidth: 384,
    backgroundColor: '#FFFFFF',
    borderRadius: 40,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 30,
    elevation: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827', // text-gray-900
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6B7280', // text-gray-500
    marginBottom: 40,
  },
  buttonContainer: {
    width: '100%',
    gap: 16,
    marginBottom: 40,
  },
  authButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 16,
  },
  icon: {
    marginRight: 12,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937', // text-gray-800
  },
  cancelText: {
    fontSize: 20,
    fontWeight: '500',
    color: '#A594F9', // Brand purple (close to #a29bfe from HTML)
  },
});
