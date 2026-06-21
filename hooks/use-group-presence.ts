import { useMemo } from 'react';
import { useAppStore, type PresenceMap, type PresencePayload } from '@/store/useAppStore';

export type { PresenceMap, PresencePayload };

interface UseGroupPresenceArgs {
  groupId: string | null | undefined;
}

/**
 * Devuelve el estado de presencia de un grupo, mergeando:
 *   - real: lo que escribe useGlobalPresence desde Realtime
 *   - demo: lo que inyecta useDemoPresence cuando "Modo presentación" está ON
 *
 * Los UUIDs de demo users no se solapan con usuarios reales, así que el merge
 * es efectivamente una unión. La pantalla del grupo después filtra por la lista
 * de miembros reales de la DB, así que solo se muestran demo users que están
 * en el grupo seed.
 */
export function useGroupPresence({ groupId }: UseGroupPresenceArgs): PresenceMap {
  const real = useAppStore((s) => (groupId ? s.groupPresence[groupId] : undefined) ?? EMPTY);
  const demo = useAppStore((s) => (groupId ? s.demoGroupPresence[groupId] : undefined) ?? EMPTY);
  return useMemo(() => ({ ...real, ...demo }), [real, demo]);
}

const EMPTY: PresenceMap = {};
