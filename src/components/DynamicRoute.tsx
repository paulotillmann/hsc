// src/components/DynamicRoute.tsx
// Rota genérica: lê o slug da URL, verifica permissão e renderiza o componente correto

import React, { Suspense } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { ShieldOff, PackageSearch } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { pageRegistry } from '../registry/pageRegistry';

// ── Loading enquanto o componente carrega (code splitting) ────────────────────
const PageLoading: React.FC = () => (
  <div className="flex flex-1 flex-col items-center justify-center min-h-[60vh] gap-4">
    <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
    <p className="text-sm text-muted-foreground font-medium">Carregando...</p>
  </div>
);

// ── Acesso negado ─────────────────────────────────────────────────────────────
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

// ── Módulo não encontrado no registry ─────────────────────────────────────────
const ModuleNotFound: React.FC<{ slug: string }> = ({ slug }) => (
  <div className="flex flex-1 flex-col items-center justify-center min-h-[60vh] gap-6 p-8">
    <div className="flex items-center justify-center h-20 w-20 rounded-full bg-muted text-muted-foreground">
      <PackageSearch className="h-10 w-10" />
    </div>
    <div className="text-center max-w-sm">
      <h2 className="text-xl font-bold text-foreground mb-2">Módulo não implementado</h2>
      <p className="text-muted-foreground text-sm leading-relaxed">
        O módulo <span className="font-mono font-semibold text-primary">/{slug}</span> está
        cadastrado no sistema, mas sua página ainda não foi implementada.
        <br />Entre em contato com o desenvolvedor.
      </p>
    </div>
  </div>
);

// ── DynamicRoute ──────────────────────────────────────────────────────────────
const DynamicRoute: React.FC = () => {
  const { moduleSlug } = useParams<{ moduleSlug: string }>();
  const { profileLoaded } = useAuth();
  const { canAccess } = usePermissions();

  // Aguarda o perfil carregar antes de julgar permissões
  if (!profileLoaded) {
    return <PageLoading />;
  }

  if (!moduleSlug) {
    return <Navigate to="/" replace />;
  }

  // Verifica permissão de acesso ao módulo pelo slug
  if (!canAccess(moduleSlug)) {
    return <AccessDenied />;
  }

  // Busca o componente no registry
  const PageComponent = pageRegistry[moduleSlug];
  if (!PageComponent) {
    return <ModuleNotFound slug={moduleSlug} />;
  }

  return (
    <Suspense fallback={<PageLoading />}>
      <PageComponent />
    </Suspense>
  );
};

export default DynamicRoute;
