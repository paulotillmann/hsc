// src/components/PrivateRoute.tsx
// Guard de rota: redireciona para login se não autenticado
// Aguarda tanto o auth quanto o perfil antes de renderizar o conteúdo

import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const PrivateRoute: React.FC = () => {
  const { session, loading, profileLoaded, profile } = useAuth();
  const location = useLocation();

  // Mostra spinner enquanto verifica sessão OU enquanto perfil ainda não foi carregado
  if (loading || (session && !profileLoaded)) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground font-medium">Carregando sistema...</p>
        </div>
      </div>
    );
  }

  if (session && profileLoaded) {
    const userEmail = (session.user?.email || profile?.email || '').toLowerCase();
    const roleSlug = profile?.roles?.slug?.toLowerCase() || '';

    // Terminal de atendimento PA
    if ((roleSlug === 'enfermagem_pa' || userEmail === 'pa@email.com') && location.pathname !== '/pronto-atendimento') {
      return <Navigate to="/pronto-atendimento" replace />;
    }

    // Painel TV do Pronto Atendimento
    if ((roleSlug === 'tv_pa' || userEmail === 'tvpa@email.com') && 
        location.pathname !== '/pronto-atendimento/tv' && 
        location.pathname !== '/painel-pa') {
      return <Navigate to="/pronto-atendimento/tv" replace />;
    }

    // Terminais de Posto de Enfermagem (setor de internação)
    if (profile?.setor_usuarios && location.pathname !== '/pacientes-internados') {
      return <Navigate to="/pacientes-internados" replace />;
    }
  }

  return session ? <Outlet /> : <Navigate to="/" replace />;
};

export default PrivateRoute;
