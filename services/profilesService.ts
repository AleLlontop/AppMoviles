import { supabase } from '@/utils/supabase';

export type Profile = {
  id: string;
  user_id: string;
  nickname: string | null;
  category: string | null;
};

export const CATEGORIES = [
  'Universidad',
  'Programación',
  'Trabajo',
  'Personal',
  'Diseño',
  'Idiomas',
  'Ciencias',
  'Arte',
];

export const getProfile = async (userId: string): Promise<Profile | null> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, user_id, nickname, category')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
};

export const upsertProfile = async (
  userId: string,
  fields: { nickname?: string; category?: string }
): Promise<void> => {
  const { error } = await supabase
    .from('profiles')
    .upsert({ user_id: userId, ...fields }, { onConflict: 'user_id' });
  if (error) throw error;
};
