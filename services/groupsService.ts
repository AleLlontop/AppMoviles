import { supabase } from '@/utils/supabase';

const generateInviteCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
};

export const createGroup = async (name: string, userId: string) => {
  let inviteCode = generateInviteCode();

  // Reintenta si hay colisión (muy improbable con ~1B combinaciones)
  const { data: existing } = await supabase
    .from('groups')
    .select('id')
    .eq('invite_code', inviteCode)
    .maybeSingle();

  if (existing) inviteCode = generateInviteCode();

  const { data: group, error: groupError } = await supabase
    .from('groups')
    .insert({ name: name.trim(), invite_code: inviteCode, created_by: userId })
    .select()
    .single();

  if (groupError) throw groupError;

  const { error: memberError } = await supabase
    .from('group_members')
    .insert({ group_id: group.id, user_id: userId, role: 'owner' });

  if (memberError) throw memberError;

  return group;
};

export type JoinGroupError = 'invalid_code' | 'group_full' | 'already_member';

export const joinGroup = async (inviteCode: string, userId: string): Promise<void> => {
  const code = inviteCode.trim().toUpperCase();

  // Busca el grupo por código
  const { data: group, error: groupError } = await supabase
    .from('groups')
    .select('id, max_members')
    .eq('invite_code', code)
    .maybeSingle();

  if (groupError) throw groupError;
  if (!group) {
    const err = new Error('invalid_code');
    err.name = 'invalid_code';
    throw err;
  }

  // Verifica si ya es miembro
  const { data: membership } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', group.id)
    .eq('user_id', userId)
    .maybeSingle();

  if (membership) {
    const err = new Error('already_member');
    err.name = 'already_member';
    throw err;
  }

  // Verifica capacidad
  const { count } = await supabase
    .from('group_members')
    .select('id', { count: 'exact', head: true })
    .eq('group_id', group.id);

  if ((count ?? 0) >= group.max_members) {
    const err = new Error('group_full');
    err.name = 'group_full';
    throw err;
  }

  const { error: insertError } = await supabase
    .from('group_members')
    .insert({ group_id: group.id, user_id: userId, role: 'member' });

  if (insertError) throw insertError;
};
