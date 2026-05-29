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
  const { permissions, isAdmin, userModules } = useAuth();

  // Injetar o módulo mockado "escuta-santa-casa" para visualização e navegação no frontend
  const mockModules = useMemo(() => {
    const idx = userModules.findIndex(m => m.slug === 'pacientes-internados' || m.slug === 'pacientes');
    const mockEscuta: Module = {
      id: 'escuta-santa-casa-mock-id',
      name: 'Gestão Escuta Santa Casa',
      slug: 'escuta-santa-casa',
      icon: 'ShieldAlert',
      is_active: true,
      sort_order: idx !== -1 ? userModules[idx].sort_order + 1 : 50,
      is_system: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const list = [...userModules];
    if (!list.some(m => m.slug === 'escuta-santa-casa')) {
      if (idx !== -1) {
        list.splice(idx + 1, 0, mockEscuta);
      } else {
        list.push(mockEscuta);
      }
    }
    return list;
  }, [userModules]);

  // Verifica permissão de ação (colunas booleanas na tabela roles)
  const can = useCallback(
    (permission: PermissionKey): boolean => {
      if (!permissions) return false;
      return permissions[permission] === true;
    },
    [permissions]
  );

  // Verifica acesso a módulo pelo slug (sistema dinâmico)
  const canAccess = useCallback(
    (slug: string): boolean => {
      if (slug === 'escuta-santa-casa') return true;
      return mockModules.some(m => m.slug === slug && m.is_active);
    },
    [mockModules]
  );

  return { permissions, can, isAdmin, userModules: mockModules, canAccess };
}

