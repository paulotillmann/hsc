// src/components/PrivateRoute.tsx
// Guard de rota: redireciona para login se não autenticado

import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const PrivateRoute: React.FC = () => {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground font-medium">Verificando sessão...</p>
        </div>
      </div>
    );
  }

  return session ? <Outlet /> : <Navigate to="/" replace />;
};

export default PrivateRoute;
