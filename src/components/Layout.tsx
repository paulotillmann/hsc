import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';

const Layout: React.FC = () => {
  const location = useLocation();
  const isWidePage = ['/informes', '/holerites', '/configuracoes'].includes(location.pathname);

  return (
    <div className="flex min-h-screen bg-background text-foreground transition-colors overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className={`${isWidePage ? 'w-full max-w-none px-[60px] py-8' : 'max-w-6xl mx-auto p-8'} transition-all duration-300`}>
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;
