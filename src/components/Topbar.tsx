import React, { useState, useEffect, useMemo, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutGrid,
  ChevronRight,
  ChevronDown,
  Sun,
  Moon,
  LogOut,
  Settings,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { getVisibleCategories, findActiveNavigation } from '../config/navigationConfig';
import DynamicIcon from './DynamicIcon';

const Topbar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut, profile, isAdmin } = useAuth();
  const { userModules } = usePermissions();

  const [isDark, setIsDark] = useState(false);
  const [moduleMenuOpen, setModuleMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);

  // Fechar dropdown ao trocar de rota ou clicar fora
  useEffect(() => {
    setModuleMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setModuleMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const categories = useMemo(
    () => getVisibleCategories(userModules, isAdmin),
    [userModules, isAdmin]
  );

  const { category: activeCategory, item: activeItem } = useMemo(
    () => findActiveNavigation(location.pathname, categories),
    [location.pathname, categories]
  );

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

  const canConfig = isAdmin || userModules.some((m) => m.slug === 'configuracoes');
  const hasMultipleSiblingModules = activeCategory && activeCategory.items.length > 1;

  return (
    <header className="sticky top-0 z-40 h-14 w-full border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85 transition-colors">
      <div className="h-full px-3 sm:px-5 flex items-center justify-between gap-3">
        {/* ── Esquerda: Botão Hub + Logo + Contexto da Categoria/Módulo ── */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={() => navigate('/home')}
            title="Menu Principal (Categorias)"
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-all text-xs font-semibold flex-shrink-0"
          >
            <LayoutGrid className="h-4 w-4" />
            <span className="hidden sm:inline">Menu</span>
          </button>

          <button
            onClick={() => navigate('/home')}
            title="Ir para o Portal HSC"
            className="hidden md:flex items-center flex-shrink-0 focus:outline-none"
          >
            <img
              src={isDark ? '/LOGO_HSC_WHITE.png' : '/LOGO_HSC_PRIMARY.png'}
              alt="HSC"
              className="h-7 w-auto object-contain"
            />
          </button>

          {/* Separador e Trilha Contextual */}
          {activeCategory ? (
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <div className="h-5 w-px bg-border hidden md:block" />

              <button
                onClick={() => navigate(`/home?categoria=${activeCategory.id}`)}
                className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex-shrink-0"
                title={`Ver todos os módulos de ${activeCategory.name}`}
              >
                <DynamicIcon name={activeCategory.icon} className="h-3.5 w-3.5" />
                <span className="truncate max-w-[140px]">{activeCategory.name}</span>
              </button>

              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60 hidden sm:block flex-shrink-0" />

              {/* Troca rápida de módulo dentro da mesma categoria */}
              {hasMultipleSiblingModules ? (
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setModuleMenuOpen((prev) => !prev)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs sm:text-sm font-semibold text-foreground bg-muted/60 hover:bg-muted border border-border/60 transition-colors max-w-[200px] sm:max-w-[260px]"
                    title="Trocar de módulo nesta categoria"
                  >
                    {activeItem && (
                      <DynamicIcon
                        name={activeItem.icon}
                        className="h-3.5 w-3.5 text-primary flex-shrink-0"
                      />
                    )}
                    <span className="truncate">{activeItem?.label ?? activeCategory.name}</span>
                    <ChevronDown
                      className={`h-3.5 w-3.5 text-muted-foreground flex-shrink-0 transition-transform ${
                        moduleMenuOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {moduleMenuOpen && (
                    <div className="absolute left-0 mt-1.5 w-64 rounded-xl border border-border bg-card shadow-lg py-1.5 z-50 animate-in fade-in duration-150">
                      <div className="px-3 py-1.5 border-b border-border/70 mb-1">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {activeCategory.name}
                        </p>
                      </div>
                      {activeCategory.items.map((mod) => {
                        const isActive = activeItem?.id === mod.id;
                        if (mod.external) {
                          return (
                            <a
                              key={mod.id}
                              href={mod.path}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => setModuleMenuOpen(false)}
                              className="flex items-center justify-between gap-2 px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                            >
                              <span className="flex items-center gap-2.5 truncate">
                                <DynamicIcon name={mod.icon} className="h-4 w-4 flex-shrink-0" />
                                <span className="truncate">{mod.label}</span>
                              </span>
                              <ExternalLink className="h-3 w-3 opacity-60 flex-shrink-0" />
                            </a>
                          );
                        }
                        return (
                          <button
                            key={mod.id}
                            onClick={() => {
                              setModuleMenuOpen(false);
                              navigate(mod.path);
                            }}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-left transition-colors ${
                              isActive
                                ? 'bg-primary/10 text-primary font-semibold'
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                            }`}
                          >
                            <DynamicIcon name={mod.icon} className="h-4 w-4 flex-shrink-0" />
                            <span className="truncate">{mod.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <span className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-foreground truncate">
                  {activeItem && (
                    <DynamicIcon
                      name={activeItem.icon}
                      className="h-4 w-4 text-primary flex-shrink-0"
                    />
                  )}
                  <span className="truncate">{activeItem?.label ?? activeCategory.name}</span>
                </span>
              )}
            </div>
          ) : location.pathname === '/perfil' ? (
            <div className="flex items-center gap-2">
              <div className="h-5 w-px bg-border hidden md:block" />
              <span className="text-sm font-semibold text-foreground">Meu Perfil</span>
            </div>
          ) : null}
        </div>

        {/* ── Direita: Configurações, Tema, Perfil e Sair ── */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          {canConfig && (
            <NavLink
              to="/configuracoes"
              title="Configurações"
              className={({ isActive }) =>
                `p-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`
              }
            >
              <Settings className="h-4 w-4" />
            </NavLink>
          )}

          <button
            onClick={toggleTheme}
            title={isDark ? 'Mudar para Modo Claro' : 'Mudar para Modo Escuro'}
            className="p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {profile && (
            <NavLink
              to="/perfil"
              title="Meu Perfil"
              className={({ isActive }) =>
                `flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full border transition-colors ${
                  isActive
                    ? 'border-primary/40 bg-primary/10 text-primary'
                    : 'border-border bg-muted/40 hover:bg-muted text-foreground'
                }`
              }
            >
              <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-[11px] overflow-hidden flex-shrink-0">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt="Avatar"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  (profile.full_name ?? profile.email ?? 'U')[0].toUpperCase()
                )}
              </div>
              <span className="hidden lg:inline text-xs font-medium max-w-[120px] truncate">
                {profile.full_name?.split(' ')[0] ?? profile.email}
              </span>
            </NavLink>
          )}

          <button
            onClick={handleLogout}
            title="Sair do Sistema"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-500 hover:bg-red-500/10 dark:hover:bg-red-500/20 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden md:inline">Sair</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Topbar;
