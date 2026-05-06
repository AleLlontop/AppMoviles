import { supabase } from '../utils/supabase';

export const getSubjects = async () => {
  const { data, error } = await supabase.from('subjects').select('*');
  if (error) throw error;
  return data || [];
};

export const getTechniques = async () => {
  const { data, error } = await supabase.from('techniques').select('*');
  if (error) throw error;
  return data || [];
};

export const getStudySessions = async (startDate: string, endDate: string) => {
  const { data, error } = await supabase
    .from('study_sessions')
    .select('*, subjects(*), techniques(*)')
    .gte('start_time', startDate)
    .lte('start_time', endDate);
  if (error) throw error;
  return data || [];
};

export const getSessionSegments = async (sessionIds: string[]) => {
  if (sessionIds.length === 0) return [];
  const { data, error } = await supabase
    .from('session_segments')
    .select('*')
    .in('session_id', sessionIds);
  if (error) throw error;
  return data || [];
};

export const getAllStatisticsData = async (startDate: string, endDate: string) => {
  const [subjects, techniques, sessions] = await Promise.all([
    getSubjects(),
    getTechniques(),
    getStudySessions(startDate, endDate)
  ]);
  
  const sessionIds = sessions.map(s => s.id);
  const segments = await getSessionSegments(sessionIds);
  
  return { subjects, techniques, sessions, segments };
};
