import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { supabase } from '@/utils/supabase';

WebBrowser.maybeCompleteAuthSession();
export default function LoginScreen() {
  const router = useRouter();

  const createSessionFromUrl = async (url: string) => {
    try {
      // Manual parsing to avoid React Native URL polyfill crashes
      const hashIndex = url.indexOf('#');
      const queryIndex = url.indexOf('?');
      
      let paramsString = '';
      if (hashIndex !== -1) {
        paramsString = url.substring(hashIndex + 1);
      } else if (queryIndex !== -1) {
        paramsString = url.substring(queryIndex + 1);
      }

      if (!paramsString) return;

      const params = paramsString.split('&').reduce((acc, current) => {
        const [key, value] = current.split('=');
        if (key && value) {
          acc[key] = decodeURIComponent(value);
        }
        return acc;
      }, {} as Record<string, string>);

      if (params.error_description) {
        throw new Error(params.error_description);
      }

      const access_token = params.access_token;
      const refresh_token = params.refresh_token;

      if (!access_token || !refresh_token) {
         return;
      }

      const { data, error } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });
      
      if (error) throw error;
      return data.session;
    } catch (err: any) {
      Alert.alert("Error procesando sesión", err.message || "Error desconocido al leer la URL");
      throw err;
    }
  };

  React.useEffect(() => {
    // 1. Listen for Supabase auth state changes (native deep linking handles this sometimes)
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        router.replace('/(tabs)');
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const handleOAuthLogin = async (provider: 'github' | 'google') => {
    try {
      const redirectUrl = AuthSession.makeRedirectUri();

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: provider,
        options: {
          redirectTo: redirectUrl,
          queryParams: provider === 'google' ? {
            access_type: 'offline',
            prompt: 'consent',
          } : undefined,
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        Alert.alert("Error de Supabase", error.message);
        return;
      }

      if (data?.url) {
        // En lugar de usar WebBrowser (que es lo que está crasheando tu celular a nivel nativo),
        // usamos Linking para abrir el navegador del sistema externo y evitar el crasheo de Expo Go.
        const Linking = await import('expo-linking');
        
        // Agregar un listener para cuando la app vuelva del navegador externo
        const subscription = Linking.addEventListener('url', async (event) => {
          if (event.url) {
            await createSessionFromUrl(event.url);
            subscription.remove();
            router.replace('/(tabs)');
          }
        });

        // Abrir la URL en el navegador del celular (Safari/Chrome externo)
        await Linking.openURL(data.url);
      }
    } catch (error: any) {
      Alert.alert("Error Crítico", error.message || "Ocurrió un problema inesperado.");
      console.error("Login unexpected error:", error);
    }
  };

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
              onPress={() => handleOAuthLogin('google')}
            >
              <Ionicons name="logo-google" size={24} color="#DB4437" style={styles.icon} />
              <Text style={styles.buttonText}>Google</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.authButton} 
              activeOpacity={0.7}
              onPress={() => handleOAuthLogin('github')}
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
