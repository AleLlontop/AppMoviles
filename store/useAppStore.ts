import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'light' | 'dark' | 'system';

interface AppStore {
  // Tema
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;

  // Cronómetro
  activeSubjectId: string | null;
  timerSeconds: number;
  sessionStartTime: Date | null;
  startTimer: (subjectId: string) => void;
  stopTimer: () => void;
  tick: () => void;

  // Interrupciones (RF-02)
  interruptions: number;
  addInterruption: () => void;
  resetInterruptions: () => void;
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      theme: 'system',
      setTheme: (theme) => set({ theme }),

      activeSubjectId: null,
      timerSeconds: 0,
      sessionStartTime: null,
      // Al iniciar timer se resetean las interrupciones de la sesión anterior
      startTimer: (subjectId) =>
        set({ activeSubjectId: subjectId, timerSeconds: 0, sessionStartTime: new Date(), interruptions: 0 }),
      stopTimer: () =>
        set({ activeSubjectId: null, timerSeconds: 0, sessionStartTime: null }),
      tick: () => set((s) => ({ timerSeconds: s.timerSeconds + 1 })),

      interruptions: 0,
      addInterruption: () => set((s) => ({ interruptions: s.interruptions + 1 })),
      resetInterruptions: () => set({ interruptions: 0 }),
    }),
    {
      name: 'app-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ theme: state.theme }),
    }
  )
);
