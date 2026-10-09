// src/hooks/usePermissions.ts
// Hook centralizado para verificação de permissões e módulos do usuário logado

import { useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { PermissionKey, Permissions, Module } from '../types/permissions';

interface UsePermissionsReturn {
  // Permissões de ação (legado — colunas booleanas na tabela roles)
  permissions: Permissions | null;
  can: (permission: PermissionKey) => boolean;
  isAdmin: boolean;
  // Sistema dinâmico de módulos
  userModules: Module[];
  /** Verifica se o usuário tem acesso a um módulo pelo slug.
   * @example canAccess('informes') // true | false
   */
  canAccess: (slug: string) => boolean;
}

/**
 * Hook para verificar permissões de ação e acesso a módulos do perfil logado.
 *
 * @example — Permissão de ação (legado)
 * const { can } = usePermissions();
 * if (can('can_upload')) { ... }
 *
 * @example — Acesso a módulo (novo sistema dinâmico)
 * const { canAccess } = usePermissions();
 * if (canAccess('relatorios')) { ... }
 */
export function usePermissions(): UsePermissionsReturn {
  const { permissions, isAdmin, userModules: rawUserModules } = useAuth();
  // Módulos do usuário
  const userModules = useMemo(() => {
    const hasCentroMedico = rawUserModules.some(m => m.slug === 'centro-medico');
    if (!hasCentroMedico) {
      return [
        ...rawUserModules,
        {
          id: 'm-centro-medico',
          name: 'Centro Médico',
          slug: 'centro-medico',
          icon: 'Stethoscope',
          description: 'Módulo de escalas médicas, consultas e agendamentos do Centro Médico',
          is_active: true,
          sort_order: 75,
          is_system: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        } as Module
      ];
    }
    return rawUserModules;
  }, [rawUserModules]);

  // Verifica permissão de ação (colunas booleanas na tabela roles)
  const can = useCallback(
    (permission: PermissionKey): boolean => {
      if (!permissions) return false;
      return permissions[permission] === true;
    },
    [permissions]
  );

  // Verifica acesso a módulo pelo slug (sistema dinâmico baseado no banco de dados e roles)
  const canAccess = useCallback(
    (slug: string): boolean => {
      if (isAdmin) return true;
      if (slug === 'gestao-prontuarios') return true;
      if (slug === 'centro-medico') return true;
      return userModules.some(m => m.slug === slug && m.is_active);
    },
    [isAdmin, userModules]
  );

  return { permissions, can, isAdmin, userModules, canAccess };
}

