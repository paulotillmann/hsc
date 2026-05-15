// src/services/rolesService.ts
// Serviço para operações CRUD na tabela roles e gerenciamento de usuários

import { supabase } from '../lib/supabase';
import { Role } from '../types/permissions';

// ── SETORES ────────────────────────────────────────────────────────────────
export interface Sector {
  id: string;
  nome_setor: string;
}

export async function fetchAllSectors(): Promise<Sector[]> {
  const { data, error } = await supabase
    .from('taxa_setores')
    .select('id, nome_setor')
    .eq('ativo', true)
    .order('nome_setor', { ascending: true });
  if (error) throw new Error(error.message);
  return data as Sector[];
}

export async function fetchUserSectors(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('taxa_setores_usuarios')
    .select('setor_id')
    .eq('usuario_id', userId);
  if (error) throw new Error(error.message);
  return data.map((d: any) => d.setor_id);
}

export async function updateUserSectors(userId: string, sectorIds: string[]): Promise<{ success: boolean; error?: string }> {
  const { error: delError } = await supabase
    .from('taxa_setores_usuarios')
    .delete()
    .eq('usuario_id', userId);
  if (delError) return { success: false, error: delError.message };
  
  if (sectorIds.length > 0) {
    const inserts = sectorIds.map(setor_id => ({ usuario_id: userId, setor_id }));
    const { error: insError } = await supabase
      .from('taxa_setores_usuarios')
      .insert(inserts);
    if (insError) return { success: false, error: insError.message };
  }
  return { success: true };
}

// ── ROLES ──────────────────────────────────────────────────────────────────

export async function fetchRoles(): Promise<Role[]> {
  const { data, error } = await supabase
    .from('roles')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return (data as Role[]) ?? [];
}

export async function createRole(
  role: Omit<Role, 'id' | 'created_at' | 'updated_at'>
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from('roles').insert(role);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function updateRole(
  id: string,
  updates: Partial<Omit<Role, 'id' | 'created_at' | 'updated_at' | 'slug' | 'is_system'>>
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from('roles').update(updates).eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function deleteRole(id: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from('roles').delete().eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ── USERS ──────────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  cpf: string | null;
  role: string;
  role_id: string | null;
  avatar_url: string | null;
  created_at: string;
  default_module_slug: string | null;
  roles: { name: string; slug: string } | null;
  is_blocked: boolean;
  setor_usuarios: string | null;
}

export async function fetchUsers(): Promise<UserProfile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, cpf, role, role_id, avatar_url, created_at, default_module_slug, is_blocked, setor_usuarios, roles(name, slug)')
    .order('full_name', { ascending: true });

  if (error) throw new Error(error.message);
  return (data as unknown as UserProfile[]) ?? [];
}

export async function fetchPacientesSetores(): Promise<string[]> {
  const { data, error } = await supabase
    .from('pacientes_internados')
    .select('ds_setor_atendimento')
    .order('ds_setor_atendimento', { ascending: true });

  if (error) throw new Error(error.message);
  
  const sectors = data.map(d => d.ds_setor_atendimento).filter(Boolean);
  return Array.from(new Set(sectors));
}

export async function updateUserDefaultModule(
  userId: string,
  slug: string | null
): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ default_module_slug: slug })
    .eq('id', userId)
    .select('id');

  if (error) return { success: false, error: error.message };
  if (!data || data.length === 0) return { success: false, error: 'Sem permissão para atualizar este perfil.' };
  return { success: true };
}

export async function updateUserRole(
  userId: string,
  roleId: string
): Promise<{ success: boolean; error?: string }> {
  // Apenas atualiza role_id — o trigger sync_profile_role() cuida de sincronizar
  // o campo role (legado) automaticamente com base no slug do role selecionado.
  const { data, error } = await supabase
    .from('profiles')
    .update({ role_id: roleId })
    .eq('id', userId)
    .select('id');

  if (error) return { success: false, error: error.message };
  if (!data || data.length === 0) return { success: false, error: 'Sem permissão para atualizar este perfil.' };
  return { success: true };
}

export async function updateUserBlockedStatus(
  userId: string,
  isBlocked: boolean
): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ is_blocked: isBlocked })
    .eq('id', userId)
    .select('id');

  if (error) return { success: false, error: error.message };
  if (!data || data.length === 0) return { success: false, error: 'Sem permissão para atualizar este perfil.' };
  return { success: true };
}

export async function updateUserProfile(
  userId: string,
  updates: Partial<Pick<UserProfile, 'full_name' | 'cpf' | 'role_id' | 'default_module_slug' | 'setor_usuarios'>>
): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select('id');

  if (error) return { success: false, error: error.message };
  if (!data || data.length === 0) return { success: false, error: 'Sem permissão para atualizar este perfil.' };
  return { success: true };
}

