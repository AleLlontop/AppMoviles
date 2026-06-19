import { useEffect, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/utils/supabase';
import { useUser } from '@/hooks/use-user';
import { useAppStore, type PresenceMap, type PresencePayload } from '@/store/useAppStore';
import { getMyGroups } from '@/services/groupsService';

/**
 * Mantiene el estado de presencia del usuario activo en todos sus grupos
 * mientras la app esté corriendo. Se monta una sola vez en _layout.tsx.
 *
 * - "Conectado" = la app está abierta y el usuario está logueado.
 * - "Estudiando ahora" = además, hay una sesión activa en el timer.
 *
 * Cuando el usuario crea / se une / sale / elimina un grupo, alguien tiene que
 * llamar a useAppStore.getState().bumpPresence() para que se refresque el set
 * de canales suscritos.
 */
export function useGlobalPresence() {
  const user = useUser();
  const userId = user?.id ?? null;

  const activeSubjectId = useAppStore((s) => s.activeSubjectId);
  const sessionStartTime = useAppStore((s) => s.sessionStartTime);
  const cachedSubjects = useAppStore((s) => s.cachedSubjects);
  const presenceVersion = useAppStore((s) => s.presenceVersion);

  const subjectName =
    (cachedSubjects ?? []).find((s: any) => s.id === activeSubjectId)?.name ?? null;

  const channelsRef = useRef<Map<string, RealtimeChannel>>(new Map());
  const stateRef = useRef({
    is_studying: !!activeSubjectId,
    subject_name: subjectName as string | null,
    started_at: sessionStartTime as string | null,
  });

  // Mantenemos el ref con el estado actual para que el handler de subscribe()
  // siempre trackee con los valores frescos cuando un canal se conecta tarde.
  useEffect(() => {
    stateRef.current = {
      is_studying: !!activeSubjectId,
      subject_name: subjectName,
      started_at: sessionStartTime ?? null,
    };
  }, [activeSubjectId, subjectName, sessionStartTime]);

  // 1) Suscribir a un canal por cada grupo mío. Re-evalúa cuando cambia el user
  //    o se bumpea presenceVersion (al crear/unirme/salir/eliminar).
  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    (async () => {
      let myGroups;
      try {
        myGroups = await getMyGroups(userId);
      } catch (e) {
        console.warn('useGlobalPresence: failed to load groups', e);
        return;
      }
      if (cancelled) return;

      const wantedIds = new Set(myGroups.map((g) => g.id));

      // Cerrar canales de grupos que ya no son míos.
      channelsRef.current.forEach((ch, gid) => {
        if (!wantedIds.has(gid)) {
          ch.untrack().finally(() => supabase.removeChannel(ch));
          channelsRef.current.delete(gid);
          useAppStore.getState().clearGroupPresence(gid);
        }
      });

      // Abrir canales nuevos.
      for (const g of myGroups) {
        if (channelsRef.current.has(g.id)) continue;
        if (cancelled) break;

        const groupId = g.id;
        const channel = supabase.channel(`group:${groupId}`, {
          config: { presence: { key: userId } },
        });

        // Sync: refleja el estado del room en el store para que la pantalla del
        // detalle del grupo pueda leerlo sin abrir otro canal (eso causaba el
        // warning "Cannot add 'presence' callbacks" porque Supabase cachea
        // canales por nombre).
        channel.on('presence', { event: 'sync' }, () => {
          const raw = channel.presenceState() as Record<string, PresencePayload[]>;
          const map: PresenceMap = {};
          Object.entries(raw).forEach(([key, entries]) => {
            if (entries.length > 0) map[key] = entries[0];
          });
          useAppStore.getState().setGroupPresence(groupId, map);
        });

        channel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            channel
              .track({ user_id: userId, ...stateRef.current })
              .catch(() => {});
          }
        });

        channelsRef.current.set(groupId, channel);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, presenceVersion]);

  // 2) Re-track en todos los canales cuando cambia mi estado del timer.
  useEffect(() => {
    if (!userId) return;
    const payload = {
      user_id: userId,
      is_studying: !!activeSubjectId,
      subject_name: subjectName,
      started_at: sessionStartTime ?? null,
    };
    channelsRef.current.forEach((channel) => {
      channel.track(payload).catch(() => {});
    });
  }, [userId, activeSubjectId, subjectName, sessionStartTime]);

  // 3) Cleanup al desmontar la app o al deslogearse.
  useEffect(() => {
    return () => {
      channelsRef.current.forEach((ch, gid) => {
        ch.untrack().finally(() => supabase.removeChannel(ch));
        useAppStore.getState().clearGroupPresence(gid);
      });
      channelsRef.current.clear();
    };
  }, []);
}
