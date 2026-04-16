// src/services/rolesService.ts
// Serviço para operações CRUD na tabela roles e gerenciamento de usuários

import { supabase } from '../lib/supabase';
import { Role } from '../types/permissions';

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
}

export async function fetchUsers(): Promise<UserProfile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, cpf, role, role_id, avatar_url, created_at, default_module_slug, roles(name, slug)')
    .order('full_name', { ascending: true });

  if (error) throw new Error(error.message);
  return (data as unknown as UserProfile[]) ?? [];
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
