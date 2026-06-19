import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useAppStore } from '@/store/useAppStore';
import { isFocusGuardSuspended } from '@/utils/focusGuard';

// Si la app vuelve antes de este tiempo, no contamos la interrupción.
// Cubre: pantalla apagada y prendida rápido, swipe accidental del control center,
// banners de permisos, etc.
const GRACE_MS = 2000;

export function useFocusGuard() {
  const notifIdRef = useRef<string | null>(null);
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (nextState) => {
      const store = useAppStore.getState();

      if (nextState === 'background' && store.activeSubjectId && !isFocusGuardSuspended()) {
        // Esperamos GRACE_MS antes de contar la interrupción. Si volvés antes,
        // el timer se cancela y no pasa nada.
        pendingTimerRef.current = setTimeout(async () => {
          pendingTimerRef.current = null;
          // Re-chequeo al disparar: la sesión sigue activa y nada se suspendió mientras tanto.
          const s = useAppStore.getState();
          if (!s.activeSubjectId || isFocusGuardSuspended()) return;

          s.addInterruption();

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
        }, GRACE_MS);
      }

      if (nextState === 'active') {
        // Si volviste antes del GRACE, cancelo lo pendiente — no fue interrupción real.
        if (pendingTimerRef.current) {
          clearTimeout(pendingTimerRef.current);
          pendingTimerRef.current = null;
        }

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
          current.showFocusGuardModal(current.interruptions);
        }
      }
    });

    return () => sub.remove();
  }, []);
}
