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
    location.pathname.startsWith('/plantao-ti') ||
    location.pathname.startsWith('/ordem-servico') ||
    location.pathname.startsWith('/equipamentos') ||
    location.pathname.startsWith('/gestao-prontuarios') ||
    location.pathname.startsWith('/internato-secretaria') ||
    location.pathname.startsWith('/internato-notas') ||
<<<<<<< HEAD
    location.pathname.startsWith('/internato-agenda') ||
    location.pathname.startsWith('/financeiro');

  return (
    <div className="flex h-screen w-full bg-background text-foreground transition-colors overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto w-full">
        <div className={`${isWidePage ? 'w-full max-w-none px-[20px] py-8' : 'max-w-6xl mx-auto p-8'} transition-all duration-300 w-full`}>
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;
