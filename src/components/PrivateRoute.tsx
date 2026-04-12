// src/components/PrivateRoute.tsx
// Guard de rota: redireciona para login se não autenticado
// Aguarda tanto o auth quanto o perfil antes de renderizar o conteúdo

import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const PrivateRoute: React.FC = () => {
  const { session, loading, profileLoaded } = useAuth();

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

  return session ? <Outlet /> : <Navigate to="/" replace />;
};

export default PrivateRoute;
