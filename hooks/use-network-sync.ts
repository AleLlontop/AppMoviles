import { useEffect, useRef, useCallback } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from '@/utils/supabase';
import { useAppStore, PendingSession } from '@/store/useAppStore';
import { isNetworkError } from '@/utils/network';

async function syncSession(session: PendingSession): Promise<boolean> {
  // Una row por cada sesión: mismo criterio que saveSession (online).
  try {
    const { error: insertError } = await supabase.from('study_sessions').insert({
      subject_id: session.subjectId,
      start_time: session.startTime,
      end_time: session.endTime,
      duration: session.duration,
      status: 'completed',
      ...(session.userId ? { user_id: session.userId } : {}),
      ...(session.tagId ? { tag_id: session.tagId } : {}),
    });
    if (insertError && isNetworkError(insertError)) return false;
    return true;
  } catch (e) {
    return !isNetworkError(e);
  }
}

export function useNetworkSync() {
  const isFlushing = useRef(false);

  const flush = useCallback(async () => {
    const store = useAppStore.getState();
    if (isFlushing.current || store.pendingQueue.length === 0) return;

    isFlushing.current = true;
    try {
      for (const session of useAppStore.getState().pendingQueue) {
        const synced = await syncSession(session);
        if (!synced) {
          useAppStore.getState().setOnlineStatus(false);
          return;
        }
        useAppStore.getState().removePendingSession(session.id);
      }
      useAppStore.getState().setOnlineStatus(true);
    } finally {
      isFlushing.current = false;
    }
  }, []);

  useEffect(() => {
    // Estado inicial
    NetInfo.fetch().then((state) => {
      const connected = state.isConnected && state.isInternetReachable !== false;
      useAppStore.getState().setOnlineStatus(!!connected);
      if (connected) flush();
    });

    // Listener en tiempo real — dispara inmediatamente al cambiar la red
    const unsub = NetInfo.addEventListener((state) => {
      const connected = state.isConnected && state.isInternetReachable !== false;
      useAppStore.getState().setOnlineStatus(!!connected);
      if (connected) flush();
    });

    return unsub;
  }, [flush]);
}
