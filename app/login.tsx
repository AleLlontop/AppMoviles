import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { supabase } from '@/utils/supabase';

WebBrowser.maybeCompleteAuthSession();

// Google "G" logo con los colores oficiales de la marca
const GoogleG = () => (
  <View style={googleGStyles.container}>
    <Text style={[googleGStyles.letter, { color: '#4285F4' }]}>G</Text>
    <View style={[googleGStyles.bar, { backgroundColor: '#34A853', bottom: 0, left: '50%' }]} />
    <View style={[googleGStyles.bar, { backgroundColor: '#FBBC05', bottom: 0, right: '50%' }]} />
    <View style={[googleGStyles.bar, { backgroundColor: '#EA4335', top: 0, right: '50%' }]} />
  </View>
);

const googleGStyles = StyleSheet.create({
  container: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  letter: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
  },
  bar: {
    position: 'absolute',
    width: '48%',
    height: 2.5,
    borderRadius: 2,
  },
});

export default function LoginScreen() {
  const [loadingProvider, setLoadingProvider] = useState<'google' | 'github' | null>(null);

  const createSessionFromUrl = async (url: string) => {
    try {
      const hashIndex = url.indexOf('#');
      const queryIndex = url.indexOf('?');
      let paramsString = '';
      if (hashIndex !== -1) paramsString = url.substring(hashIndex + 1);
      else if (queryIndex !== -1) paramsString = url.substring(queryIndex + 1);
      if (!paramsString) return;

      const params = paramsString.split('&').reduce((acc, current) => {
        const [key, value] = current.split('=');
        if (key && value) acc[key] = decodeURIComponent(value);
        return acc;
      }, {} as Record<string, string>);

      if (params.error_description) throw new Error(params.error_description);
      const { access_token, refresh_token } = params;
      if (!access_token || !refresh_token) return;

      const { error } = await supabase.auth.setSession({ access_token, refresh_token });
      if (error) throw error;
    } catch (err: any) {
      Alert.alert('Error de autenticación', err.message || 'No se pudo iniciar sesión');
    }
  };

  const handleOAuthLogin = async (provider: 'google' | 'github') => {
    try {
      setLoadingProvider(provider);
      const redirectUrl = AuthSession.makeRedirectUri();

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
          queryParams: provider === 'google'
            ? { access_type: 'offline', prompt: 'consent' }
            : undefined,
        },
      });

      if (error) { Alert.alert('Error', error.message); return; }
      if (!data?.url) return;

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
      if (result.type === 'success' && result.url) {
        await createSessionFromUrl(result.url);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Ocurrió un problema inesperado');
    } finally {
      setLoadingProvider(null);
    }
  };

  return (
    <LinearGradient colors={['#A799E7', '#6B4FBB']} style={styles.gradient}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topSection}>
          <View style={styles.logoMark}>
            <Text style={styles.logoSymbol}>⏱</Text>
          </View>
          <Text style={styles.appName}>time-lab.</Text>
          <Text style={styles.tagline}>Enfocá tu tiempo. Dominá tu progreso.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Bienvenido</Text>
          <Text style={styles.cardSubtitle}>Iniciá sesión para continuar</Text>

          {/* Google */}
          <TouchableOpacity
            style={styles.googleBtn}
            activeOpacity={0.85}
            onPress={() => handleOAuthLogin('google')}
            disabled={!!loadingProvider}
          >
            {loadingProvider === 'google' ? (
              <ActivityIndicator size="small" color="#4285F4" />
            ) : (
              <>
                <GoogleG />
                <Text style={styles.googleBtnText}>Continuar con Google</Text>
              </>
            )}
          </TouchableOpacity>

          {/* GitHub */}
          <TouchableOpacity
            style={styles.githubBtn}
            activeOpacity={0.85}
            onPress={() => handleOAuthLogin('github')}
            disabled={!!loadingProvider}
          >
            {loadingProvider === 'github' ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="logo-github" size={22} color="#fff" style={{ marginRight: 10 }} />
                <Text style={styles.githubBtnText}>Continuar con GitHub</Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={styles.terms}>
            Al continuar, aceptás los términos de uso y la política de privacidad.
          </Text>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safeArea: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
    paddingBottom: 32,
  },

  topSection: {
    alignItems: 'center',
    marginBottom: 40,
    flex: 1,
    justifyContent: 'center',
  },
  logoMark: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoSymbol: { fontSize: 36 },
  appName: {
    fontSize: 36,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    fontWeight: '400',
  },

  card: {
    backgroundColor: '#fff',
    borderRadius: 32,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 32,
    elevation: 12,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#191C1E',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#7B7486',
    marginBottom: 24,
  },

  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    marginBottom: 12,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  googleBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#191C1E',
  },

  githubBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: '#24292e',
    borderRadius: 16,
    marginBottom: 20,
    gap: 10,
  },
  githubBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },

  terms: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 18,
  },
});
