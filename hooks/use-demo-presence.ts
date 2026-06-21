import { useEffect, useRef } from 'react';
import { useAppStore, type PresenceMap } from '@/store/useAppStore';
import { useUser } from '@/hooks/use-user';
import { getMyGroups } from '@/services/groupsService';
import { DEMO_USERS } from '@/utils/demoUsers';

const ROTATION_MS = 30_000;
const STUDYING_COUNT = 2; // cuántos demo users están "estudiando" simultáneamente
const IDLE_COUNT = 2;     // cuántos están conectados sin estudiar

/**
 * Inyecta presencia fake en todos los grupos del usuario cuando "Modo
 * presentación" está activado en More → Avanzado.
 *
 * Solo afecta el estado local: otros celulares NO ven los demo users como
 * online. Es para presentaciones del lado de quien muestra la app.
 *
 * Rota los estados cada 30s para que se vea movimiento (entra/sale gente).
 */
export function useDemoPresence() {
  const user = useUser();
  const enabled = useAppStore((s) => s.presentationModeEnabled);

  const groupsRef = useRef<string[]>([]);
  const tickRef = useRef(0);

  useEffect(() => {
    if (!enabled || !user) {
      // Limpiar inyecciones al apagar
      useAppStore.getState().clearAllDemoPresence();
      return;
    }

    let cancelled = false;

    const refreshGroupList = async () => {
      try {
        const groups = await getMyGroups(user.id);
        if (cancelled) return;
        groupsRef.current = groups.map((g) => g.id);
        applyDemoPresence(groupsRef.current, tickRef.current);
      } catch {
        // ignore
      }
    };

    refreshGroupList();

    const interval = setInterval(() => {
      if (cancelled) return;
      tickRef.current += 1;
      applyDemoPresence(groupsRef.current, tickRef.current);
    }, ROTATION_MS);

    // Si el usuario crea/se une a un grupo nuevo mientras está prendido,
    // bumpPresence dispara y nosotros refrescamos la lista.
    const unsub = useAppStore.subscribe((s, prev) => {
      if (s.presenceVersion !== prev.presenceVersion) refreshGroupList();
    });

    return () => {
      cancelled = true;
      clearInterval(interval);
      unsub();
      useAppStore.getState().clearAllDemoPresence();
    };
  }, [enabled, user]);
}

function applyDemoPresence(groupIds: string[], tick: number) {
  if (groupIds.length === 0) return;
  const store = useAppStore.getState();
  const now = Date.now();

  // Rotamos el orden basado en el tick: cada ciclo, el primero va al final.
  const rotated = [...DEMO_USERS];
  const shift = tick % DEMO_USERS.length;
  for (let i = 0; i < shift; i++) rotated.push(rotated.shift()!);

  const studying = rotated.slice(0, STUDYING_COUNT);
  const idle = rotated.slice(STUDYING_COUNT, STUDYING_COUNT + IDLE_COUNT);

  // Construimos el map de presencia para cada grupo (es el mismo, los demo
  // users están "en todos los grupos" desde el punto de vista de la presencia
  // local — el render filtra después por miembros reales del grupo).
  const map: PresenceMap = {};

  studying.forEach((u, i) => {
    const subject = u.subjects[(tick + i) % u.subjects.length];
    // Cada uno arrancó hace entre 5 y 90 minutos (variable según tick + idx)
    const minutesAgo = 5 + ((tick * 13 + i * 17 + u.id.charCodeAt(20)) % 85);
    const startedAt = new Date(now - minutesAgo * 60_000).toISOString();
    map[u.id] = {
      user_id: u.id,
      is_studying: true,
      subject_name: subject,
      started_at: startedAt,
    };
  });

  idle.forEach((u) => {
    map[u.id] = {
      user_id: u.id,
      is_studying: false,
      subject_name: null,
      started_at: null,
    };
  });

  // El resto (absent) no se incluye → no aparecen como online.

  groupIds.forEach((gid) => store.setDemoGroupPresence(gid, map));
}
