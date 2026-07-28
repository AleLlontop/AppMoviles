import { useEffect, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { checkAchievementConditions, Achievement } from '@/services/achievementsService';
import { supabase } from '@/utils/supabase';

export function useAchievementCheck() {
  const [newAchievements, setNewAchievements] = useState<Achievement[]>([]);
  const { showSessionSummary, hideSessionSummary } = useAppStore();

  useEffect(() => {
    const checkAchievements = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const unlocked = await checkAchievementConditions(user.id);
        if (unlocked.length > 0) {
          setNewAchievements(unlocked);
          // Mostrar notificación del primer logro desbloqueado
          // (en la práctica se mostraría un toast/modal)
        }
      } catch (error) {
        console.error('Error checking achievements:', error);
      }
    };

    checkAchievements();
  }, []);

  const clearNewAchievements = () => {
    setNewAchievements([]);
  };

  return { newAchievements, clearNewAchievements };
}
