import { useAppStore, type PresenceMap, type PresencePayload } from '@/store/useAppStore';

export type { PresenceMap, PresencePayload };

interface UseGroupPresenceArgs {
  groupId: string | null | undefined;
}

/**
 * Devuelve el estado de presencia de un grupo en tiempo real.
 *
 * No abre ningún canal — eso lo hace useGlobalPresence (montado en _layout.tsx),
 * que mantiene UN canal por grupo y escribe el estado en el store. Acá solo lo
 * leemos. Esto evita el warning "Cannot add 'presence' callbacks" que aparecía
 * cuando dos canales con el mismo nombre intentaban registrar handlers.
 */
export function useGroupPresence({ groupId }: UseGroupPresenceArgs): PresenceMap {
  return useAppStore((s) => (groupId ? s.groupPresence[groupId] : undefined) ?? EMPTY);
}

// Ref estable para que el selector no retorne un objeto nuevo en cada render
// cuando el grupo todavía no tiene estado.
const EMPTY: PresenceMap = {};
