import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';

const Layout: React.FC = () => {
  const location = useLocation();
  const isWidePage = ['/dashboard', '/informes', '/holerites', '/configuracoes'].includes(location.pathname) || 
    location.pathname.startsWith('/notificacoes') || 
    location.pathname.startsWith('/recepcao') || 
    location.pathname.startsWith('/taxa-ocupacao') ||
    location.pathname.startsWith('/gestao-pendencias') ||
    location.pathname.startsWith('/centro-cirurgico') ||
    location.pathname.startsWith('/centro-medico') ||
    location.pathname.startsWith('/plantao-ti') ||
    location.pathname.startsWith('/ordem-servico') ||
    location.pathname.startsWith('/equipamentos') ||
    location.pathname.startsWith('/qualidade') ||
    location.pathname.startsWith('/custos-ti') ||
    location.pathname.startsWith('/gestao-prontuarios') ||
    location.pathname.startsWith('/internato-secretaria') ||
    location.pathname.startsWith('/internato-notas') ||
    location.pathname.startsWith('/internato-agenda') ||
    location.pathname.startsWith('/financeiro') ||
    location.pathname.startsWith('/usuarios-tasy') ||
    location.pathname.startsWith('/atendimentos') ||
    location.pathname.startsWith('/diretoria-atendimentos') ||
    location.pathname.startsWith('/nps-dashboard');

  return (
    <div className="flex h-screen w-full bg-background text-foreground transition-colors overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto overflow-x-hidden w-full min-w-0">
        <div className={`${isWidePage ? 'w-full max-w-none px-3 sm:px-5 lg:px-6 py-4 sm:py-6' : 'max-w-6xl mx-auto p-8'} transition-all duration-300 w-full min-w-0 overflow-x-hidden`}>
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;
