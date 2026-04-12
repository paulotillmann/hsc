// src/hooks/usePermissions.ts
// Hook centralizado para verificação de permissões do usuário logado

import { useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { PermissionKey, Permissions } from '../types/permissions';

interface UsePermissionsReturn {
  permissions: Permissions | null;
  can: (permission: PermissionKey) => boolean;
  isAdmin: boolean;
}

/**
 * Hook para verificar permissões do perfil logado.
 * A função `can` é memoizada para não causar re-renders desnecessários.
 *
 * @example
 * const { can } = usePermissions();
 * if (can('can_upload')) { ... }
 */
export function usePermissions(): UsePermissionsReturn {
  const { permissions, isAdmin } = useAuth();

  // useCallback garante referência estável — essencial para não quebrar
  // dependências de useCallback/useEffect nos componentes consumidores.
  const can = useCallback(
    (permission: PermissionKey): boolean => {
      if (!permissions) return false;
      return permissions[permission] === true;
    },
    [permissions]
  );

  return { permissions, can, isAdmin };
}
