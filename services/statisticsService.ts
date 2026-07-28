import { supabase } from '../utils/supabase';

// Filtros explícitos por user_id en todas las queries. Antes nos confiábamos en
// la RLS para recortar a "solo mis sesiones", pero al sumar la policy
// sessions_read_group_mates (para las stats grupales) la RLS pasó a devolver
// también las sesiones de los miembros de mis grupos. Sin filtro explícito,
// las stats personales mostraban todo mezclado.

export const getSubjects = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('subjects')
    .select('*')
    .eq('user_id', user.id);
  if (error) throw error;
  return data || [];
};

export const getStudySessions = async (startDate: string, endDate: string) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('study_sessions')
    .select('*, subjects(*), tags(id, slug, label, color)')
    .eq('user_id', user.id)
    .gte('start_time', startDate)
    .lte('start_time', endDate)
    .order('start_time', { ascending: true });
  if (error) throw error;
  return data || [];
};

export const getAllStatisticsData = async (startDate: string, endDate: string) => {
  const [subjects, sessions] = await Promise.all([
    getSubjects(),
    getStudySessions(startDate, endDate),
  ]);

  return { subjects, sessions };
};
