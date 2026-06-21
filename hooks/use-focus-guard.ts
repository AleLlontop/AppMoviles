import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useAppStore } from '@/store/useAppStore';
import { isFocusGuardSuspended } from '@/utils/focusGuard';

// RF-02 (refinado v2). Dos features opcionales independientes:
//
//   1. focusGuardEnabled (toggle "Resumen al terminar la sesión"):
//      Cuenta cada salida en silencio. El feedback se da al detener el timer
//      en el SessionSummaryModal.
//
//   2. awayNotificationEnabled (toggle "Avisarme cuando salga"):
//      Dispara "Tu sesión de estudio sigue activa" si salís con el timer
//      corriendo. Se cancela al volver.
//
// IMPORTANTE sobre el grace period (GRACE_MS):
// El thread de JS se suspende en background, así que un setTimeout(GRACE_MS) NO
// se ejecuta hasta que la app vuelve a foreground — y para ese momento ya da
// igual. Por eso aplicamos el grace de dos formas distintas:
//
//   • Para el contador: medimos el tiempo real entre el background y la vuelta.
//     Si fue > GRACE_MS, cuenta como interrupción.
//   • Para la notif: la programamos vía el SO con TIME_INTERVAL trigger que
//     respeta el delay aunque JS esté suspendido. Si volvemos antes, la
//     cancelamos.

const GRACE_MS = 2000;

export function useFocusGuard() {
  const backgroundedAtRef = useRef<number | null>(null);
  const notifIdRef = useRef<string | null>(null);

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (nextState) => {
      const store = useAppStore.getState();

      if (nextState === 'background') {
        const shouldTrack =
          !!store.activeSubjectId &&
          !isFocusGuardSuspended() &&
          (store.focusGuardEnabled || store.awayNotificationEnabled);

        if (!shouldTrack) {
          backgroundedAtRef.current = null;
          return;
        }

        backgroundedAtRef.current = Date.now();

        if (store.awayNotificationEnabled) {
          try {
            const id = await Notifications.scheduleNotificationAsync({
              content: { title: 'Tu sesión de estudio sigue activa' },
              trigger: {
                type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                seconds: Math.ceil(GRACE_MS / 1000),
                ...(Platform.OS === 'android' ? { channelId: 'focus-guard' } : {}),
              },
            });
            notifIdRef.current = id;
          } catch {
            // permission denied o canal no creado: ignorar
          }
        }
      }

      if (nextState === 'active') {
        // Cancelar/dismiss la notif (esté programada o ya disparada)
        if (notifIdRef.current) {
          await Promise.allSettled([
            Notifications.cancelScheduledNotificationAsync(notifIdRef.current),
            Notifications.dismissNotificationAsync(notifIdRef.current),
          ]);
          notifIdRef.current = null;
        }

        // Contar interrupción según el tiempo real afuera
        if (backgroundedAtRef.current != null) {
          const elapsed = Date.now() - backgroundedAtRef.current;
          backgroundedAtRef.current = null;

          const s = useAppStore.getState();
          if (
            elapsed > GRACE_MS &&
            s.focusGuardEnabled &&
            s.activeSubjectId &&
            !isFocusGuardSuspended()
          ) {
            s.addInterruption();
          }
        }
      }
    });

    return () => sub.remove();
  }, []);
}
