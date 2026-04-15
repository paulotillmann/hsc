import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LogOut, Sun, Moon, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import DynamicIcon from './DynamicIcon';

const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const { signOut, profile } = useAuth();
  const { userModules } = usePermissions();
  const [isDark, setIsDark] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();

  // Acordeão específico para notificações
  const [isNotificacoesExpanded, setIsNotificacoesExpanded] = useState(() => {
    return window.location.pathname.startsWith('/notificacoes');
  });

  useEffect(() => {
    if (location.pathname.startsWith('/notificacoes') && !isNotificacoesExpanded && !isCollapsed) {
      setIsNotificacoesExpanded(true);
    }
  }, [location.pathname, isCollapsed]);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);

  const toggleTheme = () => {
    const root = document.documentElement;
    if (root.classList.contains('dark')) {
      root.classList.remove('dark');
      root.classList.add('light');
      setIsDark(false);
    } else {
      root.classList.remove('light');
      root.classList.add('dark');
      setIsDark(true);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/', { replace: true });
  };

  const toggleMenu = () => {
    setIsCollapsed(!isCollapsed);
  };

  const navLinkClass = (isActive: boolean) =>
    `flex items-center rounded-md text-sm transition-all duration-200 ${
      isCollapsed ? 'justify-center p-3' : 'justify-start gap-3 px-3 py-2'
    } ${
      isActive
        ? 'bg-primary text-primary-foreground shadow-sm hover:shadow-md hover:shadow-primary/20 font-medium'
        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
    }`;

  return (
    <aside 
      className={`border-r bg-card flex flex-col transition-all duration-300 ease-in-out h-screen sticky top-0 relative ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Botão flutuante de colapso */}
      <button 
        onClick={toggleMenu}
        title={isCollapsed ? 'Expandir Menu' : 'Reduzir Menu'}
        className="absolute -right-3 top-[74px] z-50 flex items-center justify-center h-7 w-7 bg-card border border-border text-muted-foreground hover:text-foreground rounded-md shadow hover:bg-muted transition-colors"
      >
        {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>

      <div className="h-[88px] flex items-center justify-center p-4 border-b border-border">
        {isCollapsed ? (
          <img 
            src={isDark ? "/LOGO_HSC_WHITE.png" : "/LOGO_HSC_PRIMARY.png"} 
            alt="Logo HSC Mini" 
            className="h-10 w-10 object-cover object-left transition-all duration-300 pointer-events-none" 
          />
        ) : (
          <img 
            src={isDark ? "/LOGO_HSC_WHITE.png" : "/LOGO_HSC_PRIMARY.png"} 
            alt="Logo HSC" 
            className="h-10 w-auto object-contain transition-all duration-300 pointer-events-none" 
          />
        )}
      </div>

      {/* ── Menu dinâmico gerado pelos módulos do perfil ── */}
      <nav className="flex-1 p-3 flex flex-col gap-2 overflow-x-hidden overflow-y-auto pt-8">
        {userModules
          .filter(m => m.slug !== 'configuracoes') // Configurações fica na área inferior
          .map(module => {
            if (module.slug === 'notificacoes') {
              const isActiveLocal = location.pathname.startsWith('/notificacoes');
              return (
                <div key={module.slug} className="flex flex-col">
                  {isCollapsed ? (
                    <NavLink
                      to={`/${module.slug}`}
                      title={module.name}
                      className={navLinkClass(isActiveLocal)}
                    >
                      <DynamicIcon name={module.icon} className="h-5 w-5 flex-shrink-0" />
                    </NavLink>
                  ) : (
                    <button
                      onClick={() => {
                        setIsNotificacoesExpanded(!isNotificacoesExpanded);
                        if (!isActiveLocal) navigate('/notificacoes');
                      }}
                      className={`flex items-center rounded-md text-sm transition-all duration-200 justify-start gap-3 px-3 py-2 w-full ${
                        isActiveLocal
                          ? 'bg-primary text-primary-foreground shadow-sm hover:shadow-md hover:shadow-primary/20 font-medium'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      <DynamicIcon name={module.icon} className="h-5 w-5 flex-shrink-0" />
                      <div className="flex flex-1 items-center justify-between">
                        <span className="truncate">{module.name}</span>
                        <ChevronRight className={`h-4 w-4 transition-transform ${isNotificacoesExpanded ? 'rotate-90' : ''}`} />
                      </div>
                    </button>
                  )}

                  {!isCollapsed && isNotificacoesExpanded && (
                    <div className="flex flex-col ml-9 mt-1 gap-1 border-l-2 border-border pl-2 border-primary/20">
                      <NavLink
                        to="/notificacoes"
                        end
                        className={({ isActive }) => 
                          `text-sm px-3 py-2 rounded-md transition-colors ${
                            isActive 
                              ? 'bg-primary text-primary-foreground shadow-sm font-medium' 
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                          }`
                        }
                      >
                         Cadastros
                      </NavLink>
                      <NavLink
                        to="/notificacoes/graficos"
                        className={({ isActive }) => 
                          `text-sm px-3 py-2 rounded-md transition-colors ${
                            isActive 
                              ? 'bg-primary text-primary-foreground shadow-sm font-medium' 
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                          }`
                        }
                      >
                         Gráficos
                      </NavLink>
                    </div>
                  )}
                </div>
              );
            }

            return (
              <NavLink
                key={module.slug}
                to={`/${module.slug}`}
                title={module.name}
                className={({ isActive }) => navLinkClass(isActive)}
              >
                <DynamicIcon name={module.icon} className="h-5 w-5 flex-shrink-0" />
                {!isCollapsed && <span className="truncate">{module.name}</span>}
              </NavLink>
            );
          })
        }
      </nav>

      <div className="p-3 border-t border-border flex flex-col gap-2 overflow-x-hidden">
        {/* Info do usuário logado */}
        {profile && (
          <NavLink 
            to="/perfil"
            title="Meu Perfil"
            className={({ isActive }) => 
              `flex items-center rounded-md transition-all duration-200 mb-1 ${
                isCollapsed ? 'justify-center p-2' : 'justify-start gap-3 px-3 py-2'
              } ${
                isActive 
                  ? 'bg-primary/10 text-primary font-medium' 
                  : 'hover:bg-muted text-foreground'
              }`
            }
          >
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0 overflow-hidden border border-primary/20">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="User Avatar" className="h-full w-full object-cover" />
              ) : (
                (profile.full_name ?? profile.email ?? 'U')[0].toUpperCase()
              )}
            </div>
            {!isCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold truncate leading-tight">{profile.full_name ?? profile.email}</p>
                <p className="text-[10px] text-muted-foreground capitalize leading-tight mt-0.5">{profile.role}</p>
              </div>
            )}
          </NavLink>
        )}

        {/* Configurações — apenas se o módulo estiver liberado para o perfil */}
        {userModules.some(m => m.slug === 'configuracoes') && (
          <NavLink
            to="/configuracoes"
            title="Configurações"
            className={({ isActive }) => navLinkClass(isActive)}
          >
            <DynamicIcon name="Settings" className="h-5 w-5 flex-shrink-0" />
            {!isCollapsed && <span className="truncate">Configurações</span>}
          </NavLink>
        )}

        <button 
          onClick={toggleTheme}
          title={isDark ? 'Mudar para Modo Claro' : 'Mudar para Modo Escuro'}
          className={`flex items-center rounded-md text-sm text-foreground hover:bg-muted transition-all duration-200 ${
            isCollapsed ? 'justify-center p-3' : 'justify-start gap-3 px-3 py-2 text-left'
          }`}
        >
          {isDark ? <Sun className="h-5 w-5 flex-shrink-0" /> : <Moon className="h-5 w-5 flex-shrink-0" />}
          {!isCollapsed && <span className="truncate">{isDark ? 'Modo Claro' : 'Modo Escuro'}</span>}
        </button>

        <button 
          onClick={handleLogout}
          title="Sair do Sistema"
          className={`flex items-center rounded-md text-sm text-red-500 hover:bg-red-500/10 transition-all duration-200 mt-1 ${
            isCollapsed ? 'justify-center p-3' : 'justify-start gap-3 px-3 py-2 text-left'
          }`}
        >
          <LogOut className="h-5 w-5 flex-shrink-0" />
          {!isCollapsed && <span className="truncate">Sair</span>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
