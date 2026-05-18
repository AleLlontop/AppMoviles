import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import 'react-native-reanimated';
import '../global.css';

import * as Notifications from 'expo-notifications';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/utils/supabase';
import { useAppStore } from '@/store/useAppStore';
import { useFocusGuard } from '@/hooks/use-focus-guard';

// Cuando la app está en primer plano y llega una notificación, no la mostramos
// (no debería pasar, pero por seguridad)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const systemScheme = useColorScheme();
  const { theme } = useAppStore();
  const colorScheme = theme === 'system' ? systemScheme : theme;
  const router = useRouter();
  const segments = useSegments();
  const [session, setSession] = useState<any>(undefined);

  // RF-02: activa el guard de concentración globalmente
  useFocusGuard();

  useEffect(() => {
    // Pide permisos de notificación al usuario
    Notifications.requestPermissionsAsync();

    // Canal de Android necesario para que las notificaciones aparezcan
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('focus-guard', {
        name: 'Concentración',
        description: 'Recordatorios cuando salís de la app durante una sesión de estudio',
        importance: Notifications.AndroidImportance.HIGH,
        sound: null,
      });
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session === undefined) return;
    const inLoginScreen = segments[0] === 'login';
    if (session && inLoginScreen) {
      router.replace('/(tabs)');
    }
  }, [session, segments]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        <Stack.Screen name="add-subject" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="edit-nickname" options={{ presentation: 'modal', headerShown: false }} />
      </Stack>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}
