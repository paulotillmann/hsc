// src/hooks/usePermissions.ts
// Hook centralizado para verificação de permissões do usuário logado

import { useAuth } from '../contexts/AuthContext';
import { PermissionKey, Permissions } from '../types/permissions';

interface UsePermissionsReturn {
  permissions: Permissions | null;
  can: (permission: PermissionKey) => boolean;
  isAdmin: boolean;
}

/**
 * Hook para verificar permissões do perfil logado.
 *
 * @example
 * const { can } = usePermissions();
 * if (can('upload')) { ... }
 */
export function usePermissions(): UsePermissionsReturn {
  const { permissions, isAdmin } = useAuth();

  const can = (permission: PermissionKey): boolean => {
    if (!permissions) return false;
    return permissions[permission] === true;
  };

  return { permissions, can, isAdmin };
}
