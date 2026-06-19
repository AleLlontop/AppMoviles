import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'light' | 'dark' | 'system';

export type PresencePayload = {
  user_id: string;
  is_studying: boolean;
  subject_name: string | null;
  started_at: string | null;
};
export type PresenceMap = Record<string, PresencePayload>;

export interface PendingSession {
  id: string;
  subjectId: string;
  userId: string | null;
  startTime: string;
  endTime: string;
  duration: number;
}

interface AppStore {
  // Tema
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;

  // Cronómetro
  activeSubjectId: string | null;
  timerSeconds: number;
  sessionStartTime: string | null;
  startTimer: (subjectId: string) => void;
  stopTimer: () => void;
  tick: () => void;
  recoverTimer: () => void;

  // Interrupciones (RF-02)
  interruptions: number;
  addInterruption: () => void;
  resetInterruptions: () => void;

  // Modal de bienvenida (RF-02)
  focusGuardModal: { visible: boolean; interruptions: number };
  showFocusGuardModal: (interruptions: number) => void;
  hideFocusGuardModal: () => void;

  // Cola offline (RNF-03)
  pendingQueue: PendingSession[];
  addPendingSession: (session: PendingSession) => void;
  removePendingSession: (id: string) => void;

  // Caché de materias (RNF-03)
  cachedSubjects: any[];
  setCachedSubjects: (subjects: any[]) => void;

  // Estado de conectividad (RNF-03)
  isOnline: boolean;
  setOnlineStatus: (online: boolean) => void;

  // Trigger para que el presence global re-suscriba a mis grupos (al crear/unirme/salir/eliminar)
  presenceVersion: number;
  bumpPresence: () => void;

  // Estado de presencia por grupo (no persistido). Lo escribe useGlobalPresence
  // y lo lee useGroupPresence en la pantalla del detalle.
  groupPresence: Record<string, PresenceMap>;
  setGroupPresence: (groupId: string, map: PresenceMap) => void;
  clearGroupPresence: (groupId: string) => void;
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      theme: 'system',
      setTheme: (theme) => set({ theme }),

      activeSubjectId: null,
      timerSeconds: 0,
      sessionStartTime: null,
      startTimer: (subjectId) =>
        set({
          activeSubjectId: subjectId,
          timerSeconds: 0,
          sessionStartTime: new Date().toISOString(),
          interruptions: 0,
        }),
      stopTimer: () =>
        set({ activeSubjectId: null, timerSeconds: 0, sessionStartTime: null }),
      tick: () => set((s) => ({ timerSeconds: s.timerSeconds + 1 })),
      // Recalcula los segundos reales desde sessionStartTime (RNF-04)
      recoverTimer: () => {
        const { sessionStartTime } = get();
        if (!sessionStartTime) return;
        const elapsed = Math.floor((Date.now() - new Date(sessionStartTime).getTime()) / 1000);
        set({ timerSeconds: Math.max(0, elapsed) });
      },

      interruptions: 0,
      addInterruption: () => set((s) => ({ interruptions: s.interruptions + 1 })),
      resetInterruptions: () => set({ interruptions: 0 }),

      focusGuardModal: { visible: false, interruptions: 0 },
      showFocusGuardModal: (interruptions) =>
        set({ focusGuardModal: { visible: true, interruptions } }),
      hideFocusGuardModal: () =>
        set({ focusGuardModal: { visible: false, interruptions: 0 } }),

      pendingQueue: [],
      addPendingSession: (session) =>
        set((s) => ({ pendingQueue: [...s.pendingQueue, session] })),
      removePendingSession: (id) =>
        set((s) => ({ pendingQueue: s.pendingQueue.filter((p) => p.id !== id) })),

      cachedSubjects: [],
      setCachedSubjects: (subjects) => set({ cachedSubjects: subjects }),

      isOnline: true,
      setOnlineStatus: (online) => set({ isOnline: online }),

      presenceVersion: 0,
      bumpPresence: () => set((s) => ({ presenceVersion: s.presenceVersion + 1 })),

      groupPresence: {},
      setGroupPresence: (groupId, map) =>
        set((s) => ({ groupPresence: { ...s.groupPresence, [groupId]: map } })),
      clearGroupPresence: (groupId) =>
        set((s) => {
          if (!s.groupPresence[groupId]) return s;
          const next = { ...s.groupPresence };
          delete next[groupId];
          return { groupPresence: next };
        }),
    }),
    {
      name: 'app-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        theme: state.theme,
        // Persiste estado del cronómetro para RNF-04
        activeSubjectId: state.activeSubjectId,
        sessionStartTime: state.sessionStartTime,
        // Persiste cola y caché para RNF-03
        pendingQueue: state.pendingQueue,
        cachedSubjects: state.cachedSubjects,
      }),
    }
  )
);
