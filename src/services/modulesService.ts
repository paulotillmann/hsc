// src/services/modulesService.ts
// Serviço para gerenciar módulos e suas permissões por perfil

import { supabase } from '../lib/supabase';
import { Module } from '../types/permissions';

export interface ModuleWithRoles extends Module {
  roleIds: string[];
}

// ── Busca todos os módulos com os role_ids que têm acesso ─────────────────────
export async function fetchModulesWithRoles(): Promise<ModuleWithRoles[]> {
  const [modulesRes, permissionsRes] = await Promise.all([
    supabase.from('modules').select('*').order('sort_order'),
    supabase.from('role_module_permissions').select('role_id, module_id'),
  ]);

  if (modulesRes.error) throw modulesRes.error;

  const permissions = permissionsRes.data ?? [];

  return (modulesRes.data ?? []).map(m => ({
    ...m,
    roleIds: permissions.filter(p => p.module_id === m.id).map(p => p.role_id),
  }));
}

// ── Cria um novo módulo ───────────────────────────────────────────────────────
export async function createModule(
  data: Pick<Module, 'name' | 'slug' | 'icon' | 'description' | 'sort_order'>
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from('modules').insert({
    ...data,
    is_active: true,
    is_system: false,
  });
  return error ? { success: false, error: error.message } : { success: true };
}

// ── Atualiza um módulo existente ──────────────────────────────────────────────
export async function updateModule(
  id: string,
  data: Partial<Pick<Module, 'name' | 'icon' | 'description' | 'sort_order' | 'is_active'>>
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from('modules').update(data).eq('id', id);
  return error ? { success: false, error: error.message } : { success: true };
}

// ── Exclui um módulo (apenas não-sistema) ────────────────────────────────────
export async function deleteModule(id: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from('modules').delete().eq('id', id).eq('is_system', false);
  return error ? { success: false, error: error.message } : { success: true };
}

// ── Atualiza a permissão de um perfil para um módulo ─────────────────────────
export async function setRoleModuleAccess(
  roleId: string,
  moduleId: string,
  hasAccess: boolean
): Promise<{ success: boolean; error?: string }> {
  if (hasAccess) {
    const { error } = await supabase
      .from('role_module_permissions')
      .upsert({ role_id: roleId, module_id: moduleId }, { onConflict: 'role_id,module_id' });
    return error ? { success: false, error: error.message } : { success: true };
  } else {
    const { error } = await supabase
      .from('role_module_permissions')
      .delete()
      .eq('role_id', roleId)
      .eq('module_id', moduleId);
    return error ? { success: false, error: error.message } : { success: true };
  }
}
