import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'light' | 'dark' | 'system';

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

      pendingQueue: [],
      addPendingSession: (session) =>
        set((s) => ({ pendingQueue: [...s.pendingQueue, session] })),
      removePendingSession: (id) =>
        set((s) => ({ pendingQueue: s.pendingQueue.filter((p) => p.id !== id) })),

      cachedSubjects: [],
      setCachedSubjects: (subjects) => set({ cachedSubjects: subjects }),

      isOnline: true,
      setOnlineStatus: (online) => set({ isOnline: online }),
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
