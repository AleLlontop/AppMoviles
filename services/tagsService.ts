import { supabase } from '@/utils/supabase';

export interface Tag {
  id: string;
  slug: string;
  label: string;
  description: string | null;
  color: string;
  sort_order: number;
}

export const getTags = async (): Promise<Tag[]> => {
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data || [];
};
