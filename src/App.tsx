import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import DynamicRoute from './components/DynamicRoute';
import Login from './pages/Login';
import Perfil from './pages/Perfil';
import Layout from './components/Layout';

const App: React.FC = () => {
  // Configuração Global de Tema
  useEffect(() => {
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (prefersDark && !document.documentElement.classList.contains('light')) {
      document.documentElement.classList.add('dark');
    }
  }, []);

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Rota pública: Login */}
          <Route path="/" element={<Login />} />

          {/* Rotas protegidas — exigem sessão ativa */}
          <Route element={<PrivateRoute />}>
            <Route element={<Layout />}>
              {/* Perfil: rota pública para qualquer usuário autenticado */}
              <Route path="/perfil" element={<Perfil />} />

              {/* Rota dinâmica: resolve qualquer módulo cadastrado no banco */}
              {/* A permissão e o componente são resolvidos em DynamicRoute */}
              <Route path="/:moduleSlug/*" element={<DynamicRoute />} />
            </Route>
          </Route>

          {/* Fallback: qualquer rota desconhecida vai para login */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;