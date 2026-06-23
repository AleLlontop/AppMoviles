import { supabase } from '@/utils/supabase';

export type Group = {
  id: string;
  name: string;
  description: string | null;
  invite_code: string;
  created_by: string;
  created_at: string;
  max_members: number;
};

export type GroupMember = {
  id: string;
  group_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
  // Datos del profile (join)
  nickname: string | null;
  name: string | null;
  avatar_url: string | null;
  category: string | null;
};

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

const JOIN_ERROR_NAMES: JoinGroupError[] = ['invalid_code', 'group_full', 'already_member'];

export const joinGroup = async (inviteCode: string, _userId?: string) => {
  // Toda la validación (código, duplicado, capacidad) ocurre server-side en el
  // RPC SECURITY DEFINER join_group_by_code. Esto evita que RLS bloquee la lectura
  // del grupo a un usuario que todavía no es miembro.
  const { data: group, error } = await supabase
    .rpc('join_group_by_code', { p_code: inviteCode.trim().toUpperCase() })
    .single();

  if (error) {
    // El RPC lanza el código de error en error.message (invalid_code / group_full / already_member)
    const matched = JOIN_ERROR_NAMES.find((name) => error.message.includes(name));
    const err = new Error(matched ?? 'invalid_code');
    err.name = matched ?? 'invalid_code';
    throw err;
  }

  return group as Group;
};

export type MyGroup = Group & {
  role: 'owner' | 'admin' | 'member';
  member_count: number;
};

export const getMyGroups = async (userId: string): Promise<MyGroup[]> => {
  // 1) Membresías del usuario con el grupo embebido (FK group_members.group_id → groups.id existe).
  const { data: memberships, error: mErr } = await supabase
    .from('group_members')
    .select(`role, joined_at,
             group:groups(id, name, invite_code, created_by, created_at, max_members)`)
    .eq('user_id', userId)
    .order('joined_at', { ascending: false });

  if (mErr) throw mErr;
  if (!memberships || memberships.length === 0) return [];

  // 2) Contar miembros por grupo en una sola query.
  const groupIds = memberships
    .map((m: any) => m.group?.id)
    .filter((id: string | undefined): id is string => !!id);

  const { data: countsRaw, error: cErr } = await supabase
    .from('group_members')
    .select('group_id')
    .in('group_id', groupIds);

  if (cErr) throw cErr;

  const counts = new Map<string, number>();
  (countsRaw ?? []).forEach((r: any) => {
    counts.set(r.group_id, (counts.get(r.group_id) ?? 0) + 1);
  });

  return memberships
    .filter((m: any) => m.group)
    .map((m: any) => ({
      ...m.group,
      role: m.role,
      member_count: counts.get(m.group.id) ?? 1,
    }));
};

export const getGroup = async (groupId: string): Promise<Group | null> => {
  const { data, error } = await supabase
    .from('groups')
    .select('id, name, description, invite_code, created_by, created_at, max_members')
    .eq('id', groupId)
    .maybeSingle();
  if (error) throw error;
  return data;
};

export const updateGroupDescription = async (groupId: string, description: string): Promise<void> => {
  const { error } = await supabase.rpc('update_group_description', {
    p_group_id: groupId,
    p_description: description.trim() || null,
  });
  if (error) throw error;
};

export const updateGroupName = async (groupId: string, name: string): Promise<void> => {
  // RLS groups_owner_write deja UPDATE solo si created_by = auth.uid().
  // El CHECK del esquema valida 3..50 chars.
  const { error } = await supabase
    .from('groups')
    .update({ name: name.trim() })
    .eq('id', groupId);
  if (error) throw error;
};

export const updateMemberRole = async (
  groupId: string,
  userId: string,
  newRole: 'admin' | 'member'
): Promise<void> => {
  // RLS members_update_role: solo el owner puede UPDATE roles. El owner
  // tampoco puede modificarse a sí mismo (CHECK no lo prohíbe, pero el front
  // lo bloquea — owner mismo no aparece accionable).
  const { error } = await supabase
    .from('group_members')
    .update({ role: newRole })
    .eq('group_id', groupId)
    .eq('user_id', userId);
  if (error) throw error;
};

export type TransferOwnershipError =
  | 'not_owner'
  | 'already_owner'
  | 'target_not_member'
  | 'group_not_found';

const TRANSFER_ERROR_NAMES: TransferOwnershipError[] = [
  'not_owner',
  'already_owner',
  'target_not_member',
  'group_not_found',
];

export const transferOwnership = async (
  groupId: string,
  newOwnerId: string
): Promise<void> => {
  // Operación atómica server-side: cambia groups.created_by y los roles en
  // group_members en una sola transacción. El RPC corre con SECURITY DEFINER
  // y valida que el caller sea el owner actual y que el target sea miembro.
  const { error } = await supabase.rpc('transfer_group_ownership', {
    p_group_id: groupId,
    p_new_owner_id: newOwnerId,
  });
  if (error) {
    const matched = TRANSFER_ERROR_NAMES.find((name) => error.message.includes(name));
    const err = new Error(matched ?? error.message);
    err.name = matched ?? 'transfer_failed';
    throw err;
  }
};

export const kickMember = async (groupId: string, userId: string): Promise<void> => {
  // RLS members_delete (extendida): owner kickea a cualquiera, admin solo kickea
  // members. El servidor valida; el front solo debe ofrecer la acción cuando
  // aplica para no sorprender con un error.
  const { error } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId);
  if (error) throw error;
};

export const leaveGroup = async (groupId: string, userId: string): Promise<void> => {
  // RLS members_delete permite borrar la propia fila (user_id = auth.uid()).
  const { error } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId);
  if (error) throw error;
};

export const deleteGroup = async (groupId: string): Promise<void> => {
  // RLS groups_owner_delete permite borrar solo si created_by = auth.uid().
  // El ON DELETE CASCADE de group_members/group_activities los limpia solos.
  const { error } = await supabase
    .from('groups')
    .delete()
    .eq('id', groupId);
  if (error) throw error;
};

export const getGroupMembers = async (groupId: string): Promise<GroupMember[]> => {
  // No hay FK directa group_members → profiles (ambas apuntan a auth.users),
  // así que el embed de PostgREST no funciona. Hago dos queries y joineo en el cliente.
  // Con max 10 miembros por grupo el costo es despreciable.
  const { data: members, error: membersErr } = await supabase
    .from('group_members')
    .select('id, group_id, user_id, role, joined_at')
    .eq('group_id', groupId)
    .order('joined_at', { ascending: true });

  if (membersErr) throw membersErr;
  if (!members || members.length === 0) return [];

  const userIds = members.map((m: any) => m.user_id);
  const { data: profiles, error: profilesErr } = await supabase
    .from('profiles')
    .select('user_id, nickname, name, avatar_url, category')
    .in('user_id', userIds);

  if (profilesErr) throw profilesErr;

  const profileByUserId = new Map<string, any>();
  (profiles ?? []).forEach((p: any) => profileByUserId.set(p.user_id, p));

  return members.map((m: any) => {
    const p = profileByUserId.get(m.user_id);
    return {
      id: m.id,
      group_id: m.group_id,
      user_id: m.user_id,
      role: m.role,
      joined_at: m.joined_at,
      nickname: p?.nickname ?? null,
      name: p?.name ?? null,
      avatar_url: p?.avatar_url ?? null,
      category: p?.category ?? null,
    };
  });
};
