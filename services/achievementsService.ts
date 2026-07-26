import { supabase } from '../utils/supabase';

export interface Achievement {
  id: string;
  slug: string;
  title: string;
  description: string;
  icon: string;
  sort_order: number;
}

export interface UserAchievement extends Achievement {
  unlocked_at: string;
  isUnlocked: true;
}

export interface AchievementWithProgress extends Achievement {
  isUnlocked: boolean;
  progress?: number;
  target?: number;
  unlocked_at?: string;
}

export const getAchievements = async (): Promise<Achievement[]> => {
  const { data, error } = await supabase
    .from('achievements')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data || [];
};

export const getUserAchievements = async (): Promise<UserAchievement[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('user_achievements')
    .select(`
      achievement_id,
      unlocked_at,
      achievements(id, slug, title, description, icon, sort_order)
    `)
    .eq('user_id', user.id);
  if (error) throw error;

  return (data || []).map((ua: any) => ({
    ...ua.achievements,
    unlocked_at: ua.unlocked_at,
    isUnlocked: true,
  }));
};

export const getAchievementsWithProgress = async (): Promise<AchievementWithProgress[]> => {
  const [allAchievements, unlockedAchievements, sessions, streakDays] = await Promise.all([
    getAchievements(),
    getUserAchievements(),
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('study_sessions')
        .select('duration, start_time')
        .eq('user_id', user.id);
      if (error) return [];
      return data || [];
    }),
    getStreakDays(),
  ]);

  const unlockedIds = new Set(unlockedAchievements.map(a => a.id));
  const totalMinutes = Math.round((sessions as any[]).reduce((sum, s) => sum + (s.duration ?? 0), 0) / 60);

  return allAchievements.map(ach => {
    const isUnlocked = unlockedIds.has(ach.id);
    const unlockedData = unlockedAchievements.find(ua => ua.id === ach.id);

    let progress = 0;
    let target = 0;

    // Calcular progreso según el tipo de logro
    if (ach.slug.includes('minutos')) {
      progress = totalMinutes;
      target = parseInt(ach.slug.match(/\d+/)?.[0] || '0');
    } else if (ach.slug.includes('dias')) {
      progress = streakDays;
      target = parseInt(ach.slug.match(/\d+/)?.[0] || '0');
    }

    return {
      ...ach,
      isUnlocked,
      progress: progress || undefined,
      target: target || undefined,
      unlocked_at: unlockedData?.unlocked_at,
    };
  });
};

export const unlockAchievement = async (achievementId: string): Promise<boolean> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) return false;

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) throw new Error('EXPO_PUBLIC_SUPABASE_URL not configured');

  const response = await fetch(`${supabaseUrl}/functions/v1/unlock-achievement`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      userId: user.id,
      achievementId,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to unlock achievement');
  }

  const result = await response.json();
  return result.success && !result.already_unlocked;
};

// Logros por categoría
export const ACHIEVEMENT_CATEGORIES = {
  consistency: ['primer_dia', 'semana_impecable', '50_dias'],
  hours: ['50_minutos', '1000_horas'],
  streaks: ['3_dias_fuego', '14_dias_fuego'],
  habits: ['semilla_plantada', 'jardin_creciendo'],
};

// Formatea fecha local (YYYY-MM-DD) — evita el desfase de toISOString() que usa UTC
function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Helper: obtener streak days
async function getStreakDays(): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  // Ventana amplia: 400 días para soportar logros de hasta 365 días de racha
  const now = new Date();
  const from = new Date(now.getTime() - 400 * 24 * 60 * 60 * 1000);

  const { data: streakRows, error } = await supabase
    .from('study_sessions')
    .select('start_time')
    .eq('user_id', user.id)
    .gte('start_time', from.toISOString());

  if (error) return 0;

  const daysWithStudy = new Set<string>();
  (streakRows || []).forEach((x: any) => {
    daysWithStudy.add(localDateKey(new Date(x.start_time)));
  });

  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  while (daysWithStudy.has(localDateKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

// Funciones para verificar si se cumplen condiciones
export const checkAchievementConditions = async (userId: string) => {
  const achievements = await getAchievements();
  const userAchievements = await getUserAchievements();
  const unlockedIds = new Set(userAchievements.map(a => a.id));

  // Obtener datos del usuario
  const { data: sessions } = await supabase
    .from('study_sessions')
    .select('duration, start_time')
    .eq('user_id', userId);

  const totalMinutes = Math.round((sessions || []).reduce((sum, s: any) => sum + (s.duration ?? 0), 0) / 60);
  const streakDays = await getStreakDays();

  // Obtener cantidad de materias diferentes con sesiones
  const { data: subjects } = await supabase
    .from('study_sessions')
    .select('subject_id')
    .eq('user_id', userId);
  const differentSubjects = new Set((subjects || []).map((s: any) => s.subject_id)).size;

  const newlyUnlocked: Achievement[] = [];

  for (const achievement of achievements) {
    if (unlockedIds.has(achievement.id)) continue;

    let shouldUnlock = false;

    // Verificar condiciones por slug
    if (achievement.slug === 'primer_dia' && totalMinutes > 0) {
      shouldUnlock = true;
    } else if (achievement.slug === 'semilla_plantada' && streakDays >= 2) {
      shouldUnlock = true;
    } else if (achievement.slug === 'jardin_creciendo' && differentSubjects >= 3) {
      shouldUnlock = true;
    } else if (achievement.slug === '3_dias_fuego' && streakDays >= 3) {
      shouldUnlock = true;
    } else if (achievement.slug === 'semana_impecable' && streakDays >= 7) {
      shouldUnlock = true;
    } else if (achievement.slug === '50_dias' && streakDays >= 50) {
      shouldUnlock = true;
    } else if (achievement.slug === '50_minutos' && totalMinutes >= 50) {
      shouldUnlock = true;
    }

    if (shouldUnlock) {
      await unlockAchievement(achievement.id);
      newlyUnlocked.push(achievement);
    }
  }

  return newlyUnlocked;
};
