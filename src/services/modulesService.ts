// src/services/modulesService.ts
// Serviço para gerenciar módulos e suas permissões por perfil

import { supabase } from '../lib/supabase';
import { Module } from '../types/permissions';

export interface ModuleWithRoles extends Module {
  roleIds: string[];
}

// ── Garante que o módulo do Centro Médico está registrado na tabela modules ────
export async function ensureCentroMedicoModule(): Promise<Module | null> {
  try {
    const { data: existing, error: selectError } = await supabase
      .from('modules')
      .select('*')
      .eq('slug', 'centro-medico')
      .maybeSingle();

    if (!selectError && existing) {
      return existing as Module;
    }

    const { data: inserted, error: insertError } = await supabase
      .from('modules')
      .insert({
        name: 'Centro Médico',
        slug: 'centro-medico',
        icon: 'Stethoscope',
        description: 'Módulo de escalas médicas, consultas e agendamentos do Centro Médico',
        is_active: true,
        sort_order: 75,
        is_system: false,
      })
      .select('*')
      .maybeSingle();

    if (!insertError && inserted) {
      // Concede acesso inicial à role de administrador para viabilizar o primeiro acesso
      const { data: adminRoles } = await supabase
        .from('roles')
        .select('id')
        .or('slug.eq.admin,name.ilike.%Administrador%');

      if (adminRoles && adminRoles.length > 0) {
        const perms = adminRoles.map(r => ({ role_id: r.id, module_id: inserted.id }));
        await supabase.from('role_module_permissions').upsert(perms, { onConflict: 'role_id,module_id' });
      }

      return inserted as Module;
    }
  } catch (err) {
    console.warn('[modulesService] Auto-registro do Centro Médico:', err);
  }
  return null;
}

// ── Busca todos os módulos com os role_ids que têm acesso ─────────────────────
export async function fetchModulesWithRoles(): Promise<ModuleWithRoles[]> {
  // Garante a existência do módulo Centro Médico no banco para gestão
  await ensureCentroMedicoModule();

  const [modulesRes, permissionsRes] = await Promise.all([
    supabase.from('modules').select('*').order('sort_order'),
    supabase.from('role_module_permissions').select('role_id, module_id'),
  ]);

  if (modulesRes.error) throw modulesRes.error;

  const permissions = permissionsRes.data ?? [];
  let allModules = [...(modulesRes.data ?? [])];

  // Caso o banco esteja com política RLS bloqueando o insert anônimo, assegura exibição
  if (!allModules.some(m => m.slug === 'centro-medico')) {
    allModules.push({
      id: 'm-centro-medico',
      name: 'Centro Médico',
      slug: 'centro-medico',
      icon: 'Stethoscope',
      description: 'Módulo de escalas médicas, consultas e agendamentos do Centro Médico',
      sort_order: 75,
      is_active: true,
      is_system: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  return allModules.map(m => ({
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
  let targetModuleId = moduleId;
  if (targetModuleId === 'm-centro-medico') {
    const ensured = await ensureCentroMedicoModule();
    if (ensured) targetModuleId = ensured.id;
  }

  if (hasAccess) {
    const { error } = await supabase
      .from('role_module_permissions')
      .upsert({ role_id: roleId, module_id: targetModuleId }, { onConflict: 'role_id,module_id' });
    return error ? { success: false, error: error.message } : { success: true };
  } else {
    const { error } = await supabase
      .from('role_module_permissions')
      .delete()
      .eq('role_id', roleId)
      .eq('module_id', targetModuleId);
    return error ? { success: false, error: error.message } : { success: true };
  }
}
