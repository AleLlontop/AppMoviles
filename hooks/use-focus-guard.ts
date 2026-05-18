import { useEffect, useRef } from 'react';
import { AppState, Alert, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useAppStore } from '@/store/useAppStore';

export function useFocusGuard() {
  const notifIdRef = useRef<string | null>(null);

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (nextState) => {
      const store = useAppStore.getState();

      if (nextState === 'background' && store.activeSubjectId) {
        store.addInterruption();

        // Android 8+ requiere channelId obligatorio, sin él la notificación se descarta
        const id = await Notifications.scheduleNotificationAsync({
          content: {
            title: '⏱ Seguís en sesión de estudio',
            body: 'Volvé a la app y mantené la concentración. ¡Podés lograrlo!',
          },
          trigger: Platform.OS === 'android'
            ? { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 1, channelId: 'focus-guard' }
            : null,
        });
        notifIdRef.current = id;
      }

      if (nextState === 'active') {
        if (notifIdRef.current) {
          // Cancela si aún no disparó, descarta si ya está en la bandeja
          await Promise.allSettled([
            Notifications.cancelScheduledNotificationAsync(notifIdRef.current),
            Notifications.dismissNotificationAsync(notifIdRef.current),
          ]);
          notifIdRef.current = null;
        }

        const current = useAppStore.getState();
        if (current.activeSubjectId && current.interruptions > 0) {
          const n = current.interruptions;
          Alert.alert(
            '¡Bienvenido de vuelta! 💪',
            `Llevas ${n} interrupción${n > 1 ? 'es' : ''} en esta sesión.\nCada minuto enfocado cuenta.`,
            [{ text: 'Volver al estudio', style: 'default' }]
          );
        }
      }
    });

    return () => sub.remove();
  }, []);
}
