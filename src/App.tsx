import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import PermissionGuard from './components/PermissionGuard';
import Login from './pages/Login';
import Informes from './pages/Informes';
import Perfil from './pages/Perfil';
import Holerites from './pages/Holerites';
import Configuracoes from './pages/Configuracoes';
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
              <Route path="/informes" element={
                <PermissionGuard permission="can_informes">
                  <Informes />
                </PermissionGuard>
              } />
              <Route path="/holerites" element={
                <PermissionGuard permission="can_holerites">
                  <Holerites />
                </PermissionGuard>
              } />
              <Route path="/configuracoes" element={
                <PermissionGuard permission="can_config">
                  <Configuracoes />
                </PermissionGuard>
              } />
              <Route path="/perfil" element={<Perfil />} />
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