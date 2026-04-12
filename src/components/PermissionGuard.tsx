// src/components/PermissionGuard.tsx
// Componente de proteção de rota/conteúdo baseado em permissão do perfil

import React from 'react';
import { ShieldOff } from 'lucide-react';
import { usePermissions } from '../hooks/usePermissions';
import { PermissionKey } from '../types/permissions';

interface PermissionGuardProps {
  permission: PermissionKey;
  children: React.ReactNode;
  /** Conteúdo alternativo — se não fornecido, exibe tela padrão de acesso negado */
  fallback?: React.ReactNode;
}

const AccessDenied: React.FC = () => (
  <div className="flex flex-1 flex-col items-center justify-center min-h-[60vh] gap-6 p-8">
    <div className="flex items-center justify-center h-20 w-20 rounded-full bg-destructive/10 text-destructive">
      <ShieldOff className="h-10 w-10" />
    </div>
    <div className="text-center max-w-sm">
      <h2 className="text-xl font-bold text-foreground mb-2">Acesso Restrito</h2>
      <p className="text-muted-foreground text-sm leading-relaxed">
        Você não tem permissão para acessar esta área.
        Entre em contato com o administrador do sistema para solicitar acesso.
      </p>
    </div>
  </div>
);

const PermissionGuard: React.FC<PermissionGuardProps> = ({ permission, children, fallback }) => {
  const { can } = usePermissions();

  if (!can(permission)) {
    return fallback ? <>{fallback}</> : <AccessDenied />;
  }

  return <>{children}</>;
};

export default PermissionGuard;
