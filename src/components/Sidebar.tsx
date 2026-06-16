import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LogOut, Sun, Moon, ChevronLeft, ChevronRight, ChevronDown, HeartPulse, Cpu, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import DynamicIcon from './DynamicIcon';

const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const { signOut, profile, isAdmin } = useAuth();
  const { userModules } = usePermissions();
  const [isDark, setIsDark] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();

  // Controle unificado de acordeão (apenas um aberto por vez)
  const [expandedMenu, setExpandedMenu] = useState<string | null>(() => {
    if (window.location.pathname.startsWith('/notificacoes')) return 'assistencial';
    if (window.location.pathname.startsWith('/recepcao')) return 'recepcao';
    if (window.location.pathname.startsWith('/taxa-ocupacao')) return 'assistencial';
    if (window.location.pathname.startsWith('/pronto-atendimento') || window.location.pathname.startsWith('/pacientes-internados') || window.location.pathname.startsWith('/centro-cirurgico')) return 'assistencial';
    if (window.location.pathname.startsWith('/gestao-pendencias')) return 'faturamento';
    if (window.location.pathname.startsWith('/gestao-escuta-santa-casa')) return 'gestao-escuta-santa-casa';
    if (window.location.pathname.startsWith('/plantao-ti') || window.location.pathname.startsWith('/ordem-servico')) return 'tecnologia-informacao';
    if (window.location.pathname.startsWith('/dashboard') || window.location.pathname.startsWith('/holerites') || window.location.pathname.startsWith('/informes')) return 'recursos-humanos';
    return null;
  });

  // Controle de submenus aninhados dentro de Assistencial
  const [expandedSubMenu, setExpandedSubMenu] = useState<string | null>(() => {
    if (window.location.pathname.startsWith('/notificacoes')) return 'notificacoes';
    if (window.location.pathname.startsWith('/taxa-ocupacao')) return 'taxa-ocupacao';
    return null;
  });

  useEffect(() => {
    if (isCollapsed) {
      setExpandedMenu(null);
      setExpandedSubMenu(null);
      return;
    }

    if (location.pathname.startsWith('/notificacoes')) {
      setExpandedMenu('assistencial');
      setExpandedSubMenu('notificacoes');
    } else if (location.pathname.startsWith('/recepcao')) {
      setExpandedMenu('recepcao');
    } else if (location.pathname.startsWith('/taxa-ocupacao')) {
      setExpandedMenu('assistencial');
      setExpandedSubMenu('taxa-ocupacao');
    } else if (location.pathname.startsWith('/pronto-atendimento') || location.pathname.startsWith('/pacientes-internados') || location.pathname.startsWith('/centro-cirurgico')) {
      setExpandedMenu('assistencial');
    } else if (location.pathname.startsWith('/gestao-pendencias')) {
      setExpandedMenu('faturamento');
    } else if (location.pathname.startsWith('/gestao-escuta-santa-casa')) {
      setExpandedMenu('gestao-escuta-santa-casa');
    } else if (location.pathname.startsWith('/plantao-ti') || location.pathname.startsWith('/ordem-servico')) {
      setExpandedMenu('tecnologia-informacao');
    } else if (location.pathname.startsWith('/dashboard') || location.pathname.startsWith('/holerites') || location.pathname.startsWith('/informes')) {
      setExpandedMenu('recursos-humanos');
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
    `flex items-center rounded-md text-sm transition-all duration-200 ${isCollapsed ? 'justify-center p-3' : 'justify-start gap-3 px-3 py-2'
    } ${isActive
      ? 'bg-primary text-primary-foreground shadow-sm hover:shadow-md hover:shadow-primary/20 font-medium'
      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
    }`;

  return (
    <aside
      className={`border-r bg-card flex flex-col transition-all duration-300 ease-in-out h-screen sticky top-0 relative ${isCollapsed ? 'w-20' : 'w-64'
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
      <nav className="flex-1 p-3 flex flex-col gap-2 overflow-x-hidden overflow-y-auto pt-8 scrollbar-hide">
        {/* Categoria Assistencial (Agrupador) */}
        {(() => {
          const hasPacientesAccess = userModules.some(m => m.slug === 'pacientes-internados');
          const hasCentroCirurgicoAccess = userModules.some(m => m.slug === 'centro-cirurgico');
          const hasProntoAtendimentoAccess = userModules.some(m => m.slug === 'pronto-atendimento');
          const hasNotificacoesAccess = userModules.some(m => m.slug === 'notificacoes');
          const hasTaxaOcupacaoAccess = userModules.some(m => m.slug === 'taxa-ocupacao');

          const showAssistencial = hasPacientesAccess || hasCentroCirurgicoAccess || hasProntoAtendimentoAccess || hasNotificacoesAccess || hasTaxaOcupacaoAccess;
          const isAssistencialActive = location.pathname.startsWith('/pacientes-internados') ||
            location.pathname.startsWith('/centro-cirurgico') ||
            location.pathname.startsWith('/pronto-atendimento') ||
            location.pathname.startsWith('/notificacoes') ||
            location.pathname.startsWith('/taxa-ocupacao');

          if (!showAssistencial) return null;

          let firstAssistRoute = '/pacientes-internados';
          if (hasPacientesAccess) firstAssistRoute = '/pacientes-internados';
          else if (hasCentroCirurgicoAccess) firstAssistRoute = '/centro-cirurgico';
          else if (hasProntoAtendimentoAccess) firstAssistRoute = '/pronto-atendimento';
          else if (hasNotificacoesAccess) firstAssistRoute = '/notificacoes';
          else if (hasTaxaOcupacaoAccess) firstAssistRoute = '/taxa-ocupacao';

          return (
            <div className="flex flex-col">
              {isCollapsed ? (
                <NavLink
                  to={firstAssistRoute}
                  title="Assistencial"
                  className={navLinkClass(isAssistencialActive)}
                >
                  <HeartPulse className="h-5 w-5 flex-shrink-0" />
                </NavLink>
              ) : (
                <button
                  onClick={() => {
                    setExpandedMenu(expandedMenu === 'assistencial' ? null : 'assistencial');
                  }}
                  className={`flex items-center rounded-md text-sm transition-all duration-200 justify-start gap-3 px-3 py-2 w-full ${isAssistencialActive
                      ? 'bg-primary text-primary-foreground shadow-sm hover:shadow-md hover:shadow-primary/20 font-medium'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                >
                  <HeartPulse className="h-5 w-5 flex-shrink-0" />
                  <div className="flex flex-1 items-center justify-between">
                    <span className="truncate">Assistencial</span>
                    <ChevronRight className={`h-4 w-4 transition-transform ${expandedMenu === 'assistencial' ? 'rotate-90' : ''}`} />
                  </div>
                </button>
              )}

              {!isCollapsed && expandedMenu === 'assistencial' && (
                <div className="flex flex-col ml-9 mt-1 gap-1 border-l-2 border-border pl-2 border-primary/20 animate-in fade-in duration-300">
                  {hasPacientesAccess && (
                    <NavLink
                      to="/pacientes-internados"
                      className={({ isActive }) =>
                        `text-sm px-3 py-2 rounded-md transition-colors ${isActive
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`
                      }
                    >
                      Pacientes Internados
                    </NavLink>
                  )}
                  {hasCentroCirurgicoAccess && (
                    <NavLink
                      to="/centro-cirurgico"
                      className={({ isActive }) =>
                        `text-sm px-3 py-2 rounded-md transition-colors ${isActive
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`
                      }
                    >
                      Centro Cirúrgico
                    </NavLink>
                  )}
                  {hasProntoAtendimentoAccess && (
                    <NavLink
                      to="/pronto-atendimento"
                      className={({ isActive }) =>
                        `text-sm px-3 py-2 rounded-md transition-colors ${isActive
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`
                      }
                    >
                      Pronto Atendimento
                    </NavLink>
                  )}
                  {hasNotificacoesAccess && (
                    <div className="flex flex-col">
                      <button
                        onClick={() => setExpandedSubMenu(expandedSubMenu === 'notificacoes' ? null : 'notificacoes')}
                        className={`flex items-center justify-between text-sm px-3 py-2 rounded-md transition-colors w-full ${location.pathname.startsWith('/notificacoes')
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                          }`}
                      >
                        <span className="truncate">Notificação</span>
                        <ChevronRight className={`h-3 w-3 transition-transform ${expandedSubMenu === 'notificacoes' ? 'rotate-90' : ''}`} />
                      </button>

                      {expandedSubMenu === 'notificacoes' && (
                        <div className="flex flex-col ml-3 mt-1 gap-1 border-l border-border pl-2 border-primary/10 animate-in fade-in duration-200">
                          <NavLink
                            to="/notificacoes"
                            end
                            className={({ isActive }) =>
                              `text-xs px-3 py-1.5 rounded-md transition-colors ${isActive
                                ? 'bg-primary/10 text-primary font-medium'
                                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                              }`
                            }
                          >
                            Cadastros
                          </NavLink>
                          <NavLink
                            to="/notificacoes/graficos"
                            className={({ isActive }) =>
                              `text-xs px-3 py-1.5 rounded-md transition-colors ${isActive
                                ? 'bg-primary/10 text-primary font-medium'
                                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                              }`
                            }
                          >
                            Gráficos
                          </NavLink>
                        </div>
                      )}
                    </div>
                  )}
                  {hasTaxaOcupacaoAccess && (
                    <div className="flex flex-col">
                      <button
                        onClick={() => setExpandedSubMenu(expandedSubMenu === 'taxa-ocupacao' ? null : 'taxa-ocupacao')}
                        className={`flex items-center justify-between text-sm px-3 py-2 rounded-md transition-colors w-full ${location.pathname.startsWith('/taxa-ocupacao')
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                          }`}
                      >
                        <span className="truncate">Taxa de Ocupação</span>
                        <ChevronRight className={`h-3 w-3 transition-transform ${expandedSubMenu === 'taxa-ocupacao' ? 'rotate-90' : ''}`} />
                      </button>

                      {expandedSubMenu === 'taxa-ocupacao' && (
                        <div className="flex flex-col ml-3 mt-1 gap-1 border-l border-border pl-2 border-primary/10 animate-in fade-in duration-200">
                          <NavLink
                            to="/taxa-ocupacao"
                            end
                            className={({ isActive }) =>
                              `text-xs px-3 py-1.5 rounded-md transition-colors ${isActive
                                ? 'bg-primary/10 text-primary font-medium'
                                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                              }`
                            }
                          >
                            Visão Geral
                          </NavLink>
                          {isAdmin && (
                            <NavLink
                              to="/taxa-ocupacao/cadastro-setor-leitos"
                              className={({ isActive }) =>
                                `text-xs px-3 py-1.5 rounded-md transition-colors ${isActive
                                  ? 'bg-primary/10 text-primary font-medium'
                                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                                }`
                              }
                            >
                              Cadastro Setor e Leitos
                            </NavLink>
                          )}
                          <NavLink
                            to="/taxa-ocupacao/lancamento-taxas"
                            className={({ isActive }) =>
                              `text-xs px-3 py-1.5 rounded-md transition-colors ${isActive
                                ? 'bg-primary/10 text-primary font-medium'
                                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                              }`
                            }
                          >
                            Lançamento de Taxas
                          </NavLink>
                          <NavLink
                            to="/taxa-ocupacao/relatorios"
                            className={({ isActive }) =>
                              `text-xs px-3 py-1.5 rounded-md transition-colors ${isActive
                                ? 'bg-primary/10 text-primary font-medium'
                                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                              }`
                            }
                          >
                            Relatórios
                          </NavLink>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* Categoria T.I (Agrupador) */}
        {(() => {
          const hasPlantaoTiAccess = userModules.some(m => m.slug === 'plantao-ti');
          const hasOrdemServicoAccess = userModules.some(m => m.slug === 'ordem-servico');
          const showTI = hasPlantaoTiAccess || hasOrdemServicoAccess;
          const isTIActive = location.pathname.startsWith('/plantao-ti') || location.pathname.startsWith('/ordem-servico');

          if (!showTI) return null;

          return (
            <div className="flex flex-col">
              {isCollapsed ? (
                <NavLink
                  to={hasPlantaoTiAccess ? "/plantao-ti" : "/ordem-servico"}
                  title="T.I"
                  className={navLinkClass(isTIActive)}
                >
                  <Cpu className="h-5 w-5 flex-shrink-0" />
                </NavLink>
              ) : (
                <button
                  onClick={() => {
                    setExpandedMenu(expandedMenu === 'tecnologia-informacao' ? null : 'tecnologia-informacao');
                  }}
                  className={`flex items-center rounded-md text-sm transition-all duration-200 justify-start gap-3 px-3 py-2 w-full ${isTIActive
                      ? 'bg-primary text-primary-foreground shadow-sm hover:shadow-md hover:shadow-primary/20 font-medium'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                    }`}
                >
                  <Cpu className="h-5 w-5 flex-shrink-0" />
                  <div className="flex flex-1 items-center justify-between">
                    <span className="truncate">T.I</span>
                    <ChevronRight className={`h-4 w-4 transition-transform ${expandedMenu === 'tecnologia-informacao' ? 'rotate-90' : ''}`} />
                  </div>
                </button>
              )}

              {!isCollapsed && expandedMenu === 'tecnologia-informacao' && (
                <div className="flex flex-col ml-9 mt-1 gap-1 border-l-2 border-border pl-2 border-primary/20 animate-in fade-in duration-300">
                  {hasPlantaoTiAccess && (
                    <NavLink
                      to="/plantao-ti"
                      className={({ isActive }) =>
                        `text-sm px-3 py-2 rounded-md transition-colors ${isActive
                          ? 'bg-primary text-primary-foreground shadow-sm font-medium'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`
                      }
                    >
                      Plantão TI
                    </NavLink>
                  )}
                  {hasOrdemServicoAccess && (
                    <NavLink
                      to="/ordem-servico"
                      className={({ isActive }) =>
                        `text-sm px-3 py-2 rounded-md transition-colors ${isActive
                          ? 'bg-primary text-primary-foreground shadow-sm font-medium'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`
                      }
                    >
                      Ordem de Serviço
                    </NavLink>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* Categoria Recursos Humanos (Agrupador) */}
        {(() => {
          const hasDashboardAccess = userModules.some(m => m.slug === 'dashboard');
          const hasHoleriteAccess = userModules.some(m => m.slug === 'holerites');
          const hasInformeAccess = userModules.some(m => m.slug === 'informes');
          const showRH = hasDashboardAccess || hasHoleriteAccess || hasInformeAccess;
          const isRHActive = location.pathname.startsWith('/dashboard') || location.pathname.startsWith('/holerites') || location.pathname.startsWith('/informes');

          if (!showRH) return null;

          let firstRHRoute = '/dashboard';
          if (hasDashboardAccess) firstRHRoute = '/dashboard';
          else if (hasHoleriteAccess) firstRHRoute = '/holerites';
          else if (hasInformeAccess) firstRHRoute = '/informes';

          return (
            <div className="flex flex-col">
              {isCollapsed ? (
                <NavLink
                  to={firstRHRoute}
                  title="Recursos Humanos"
                  className={navLinkClass(isRHActive)}
                >
                  <Users className="h-5 w-5 flex-shrink-0" />
                </NavLink>
              ) : (
                <button
                  onClick={() => {
                    setExpandedMenu(expandedMenu === 'recursos-humanos' ? null : 'recursos-humanos');
                  }}
                  className={`flex items-center rounded-md text-sm transition-all duration-200 justify-start gap-3 px-3 py-2 w-full ${isRHActive
                      ? 'bg-primary text-primary-foreground shadow-sm hover:shadow-md hover:shadow-primary/20 font-medium'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                >
                  <Users className="h-5 w-5 flex-shrink-0" />
                  <div className="flex flex-1 items-center justify-between">
                    <span className="truncate">Recursos Humanos</span>
                    <ChevronRight className={`h-4 w-4 transition-transform ${expandedMenu === 'recursos-humanos' ? 'rotate-90' : ''}`} />
                  </div>
                </button>
              )}

              {!isCollapsed && expandedMenu === 'recursos-humanos' && (
                <div className="flex flex-col ml-9 mt-1 gap-1 border-l-2 border-border pl-2 border-primary/20 animate-in fade-in duration-300">
                  {hasDashboardAccess && (
                    <NavLink
                      to="/dashboard"
                      className={({ isActive }) =>
                        `text-sm px-3 py-2 rounded-md transition-colors ${isActive
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`
                      }
                    >
                      Visão Geral
                    </NavLink>
                  )}
                  {hasHoleriteAccess && (
                    <NavLink
                      to="/holerites"
                      className={({ isActive }) =>
                        `text-sm px-3 py-2 rounded-md transition-colors ${isActive
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`
                      }
                    >
                      Holerite
                    </NavLink>
                  )}
                  {hasInformeAccess && (
                    <NavLink
                      to="/informes"
                      className={({ isActive }) =>
                        `text-sm px-3 py-2 rounded-md transition-colors ${isActive
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`
                      }
                    >
                      Informe
                    </NavLink>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {userModules
          .filter(m => m.slug !== 'configuracoes' && m.slug !== 'pacientes-internados' && m.slug !== 'centro-cirurgico' && m.slug !== 'pronto-atendimento' && m.slug !== 'plantao-ti' && m.slug !== 'ordem-servico' && m.slug !== 'dashboard' && m.slug !== 'holerites' && m.slug !== 'informes' && m.slug !== 'notificacoes' && m.slug !== 'taxa-ocupacao') // Configurações fica na área inferior, e assistenciais, TI, RH, notificações e taxas ficam agrupados
          .map(module => {

            if (module.slug === 'recepcao') {
              const isActiveLocal = location.pathname.startsWith('/recepcao');
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
                        setExpandedMenu(expandedMenu === 'recepcao' ? null : 'recepcao');
                        if (!isActiveLocal) navigate('/recepcao');
                      }}
                      className={`flex items-center rounded-md text-sm transition-all duration-200 justify-start gap-3 px-3 py-2 w-full ${isActiveLocal
                        ? 'bg-primary text-primary-foreground shadow-sm hover:shadow-md hover:shadow-primary/20 font-medium'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                        }`}
                    >
                      <DynamicIcon name={module.icon} className="h-5 w-5 flex-shrink-0" />
                      <div className="flex flex-1 items-center justify-between">
                        <span className="truncate">{module.name}</span>
                        <ChevronRight className={`h-4 w-4 transition-transform ${expandedMenu === 'recepcao' ? 'rotate-90' : ''}`} />
                      </div>
                    </button>
                  )}

                  {!isCollapsed && expandedMenu === 'recepcao' && (
                    <div className="flex flex-col ml-9 mt-1 gap-1 border-l-2 border-border pl-2 border-primary/20">
                      <NavLink
                        to="/recepcao"
                        end
                        className={({ isActive }) =>
                          `text-sm px-3 py-2 rounded-md transition-colors ${isActive
                            ? 'bg-primary text-primary-foreground shadow-sm font-medium'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                          }`
                        }
                      >
                        Visão Geral
                      </NavLink>
                      <NavLink
                        to="/recepcao/visitantes"
                        className={({ isActive }) =>
                          `text-sm px-3 py-2 rounded-md transition-colors ${isActive
                            ? 'bg-primary text-primary-foreground shadow-sm font-medium'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                          }`
                        }
                      >
                        Visitantes
                      </NavLink>
                      <NavLink
                        to="/recepcao/terceiros"
                        className={({ isActive }) =>
                          `text-sm px-3 py-2 rounded-md transition-colors ${isActive
                            ? 'bg-primary text-primary-foreground shadow-sm font-medium'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                          }`
                        }
                      >
                        Terceiros
                      </NavLink>
                      <NavLink
                        to="/recepcao/pacientes"
                        className={({ isActive }) =>
                          `text-sm px-3 py-2 rounded-md transition-colors ${isActive
                            ? 'bg-primary text-primary-foreground shadow-sm font-medium'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                          }`
                        }
                      >
                        Pacientes
                      </NavLink>
                      <NavLink
                        to="/senhas-atendente"
                        className={({ isActive }) =>
                          `text-sm px-3 py-2 rounded-md transition-colors ${isActive
                            ? 'bg-primary text-primary-foreground shadow-sm font-medium'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                          }`
                        }
                      >
                        Painel de Senhas
                      </NavLink>
                    </div>
                  )}
                </div>
              );
            }


            if (module.slug === 'gestao-pendencias') {
              const isActiveLocal = location.pathname.startsWith('/gestao-pendencias');
              return (
                <div key={module.slug} className="flex flex-col">
                  {isCollapsed ? (
                    <NavLink
                      to={`/${module.slug}`}
                      title="Faturamento"
                      className={navLinkClass(isActiveLocal)}
                    >
                      <DynamicIcon name="DollarSign" className="h-5 w-5 flex-shrink-0" />
                    </NavLink>
                  ) : (
                    <button
                      onClick={() => {
                        setExpandedMenu(expandedMenu === 'faturamento' ? null : 'faturamento');
                        if (!isActiveLocal) navigate('/gestao-pendencias');
                      }}
                      className={`flex items-center rounded-md text-sm transition-all duration-200 justify-start gap-3 px-3 py-2 w-full ${isActiveLocal
                        ? 'bg-primary text-primary-foreground shadow-sm hover:shadow-md hover:shadow-primary/20 font-medium'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                        }`}
                    >
                      <DynamicIcon name="DollarSign" className="h-5 w-5 flex-shrink-0" />
                      <div className="flex flex-1 items-center justify-between">
                        <span className="truncate">Faturamento</span>
                        <ChevronRight className={`h-4 w-4 transition-transform ${expandedMenu === 'faturamento' ? 'rotate-90' : ''}`} />
                      </div>
                    </button>
                  )}

                  {!isCollapsed && expandedMenu === 'faturamento' && (
                    <div className="flex flex-col ml-9 mt-1 gap-1 border-l-2 border-border pl-2 border-primary/20">
                      <NavLink
                        to="/gestao-pendencias"
                        end
                        className={({ isActive }) =>
                          `text-sm px-3 py-2 rounded-md transition-colors ${isActive
                            ? 'bg-primary text-primary-foreground shadow-sm font-medium'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                          }`
                        }
                      >
                        Gestão de Pendências
                      </NavLink>
                      <NavLink
                        to="/gestao-pendencias/consulta-faturamentos"
                        className={({ isActive }) =>
                          `text-sm px-3 py-2 rounded-md transition-colors ${isActive
                            ? 'bg-primary text-primary-foreground shadow-sm font-medium'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                          }`
                        }
                      >
                        Consulta Faturamentos
                      </NavLink>
                    </div>
                  )}
                </div>
              );
            }

            if (module.slug === 'gestao-escuta-santa-casa') {
              const isActiveLocal = location.pathname.startsWith('/gestao-escuta-santa-casa');
              return (
                <div key={module.slug} className="flex flex-col">
                  {isCollapsed ? (
                    <NavLink
                      to={`/${module.slug}`}
                      title="Escuta Santa Casa"
                      className={navLinkClass(isActiveLocal)}
                    >
                      <DynamicIcon name={module.icon} className="h-5 w-5 flex-shrink-0" />
                    </NavLink>
                  ) : (
                    <button
                      onClick={() => {
                        setExpandedMenu(expandedMenu === 'gestao-escuta-santa-casa' ? null : 'gestao-escuta-santa-casa');
                        if (!isActiveLocal) navigate('/gestao-escuta-santa-casa');
                      }}
                      className={`flex items-center rounded-md text-sm transition-all duration-200 justify-start gap-3 px-3 py-2 w-full ${isActiveLocal
                        ? 'bg-primary text-primary-foreground shadow-sm hover:shadow-md hover:shadow-primary/20 font-medium'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                        }`}
                    >
                      <DynamicIcon name={module.icon} className="h-5 w-5 flex-shrink-0" />
                      <div className="flex flex-1 items-center justify-between">
                        <span className="truncate">Escuta Santa Casa</span>
                        <ChevronRight className={`h-4 w-4 transition-transform ${expandedMenu === 'gestao-escuta-santa-casa' ? 'rotate-90' : ''}`} />
                      </div>
                    </button>
                  )}

                  {!isCollapsed && expandedMenu === 'gestao-escuta-santa-casa' && (
                    <div className="flex flex-col ml-9 mt-1 gap-1 border-l-2 border-border pl-2 border-primary/20">
                      <NavLink
                        to="/gestao-escuta-santa-casa"
                        end
                        className={({ isActive }) =>
                          `text-sm px-3 py-2 rounded-md transition-colors ${isActive
                            ? 'bg-primary text-primary-foreground shadow-sm font-medium'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                          }`
                        }
                      >
                        Gestão de Denúncias
                      </NavLink>
                      <a
                        href="/escuta-santa-casa"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm px-3 py-2 rounded-md transition-colors flex items-center justify-between text-muted-foreground hover:bg-muted hover:text-foreground font-medium"
                      >
                        <span>Canal Público</span>
                        <DynamicIcon name="ExternalLink" className="h-3.5 w-3.5 opacity-60" />
                      </a>
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
              `flex items-center rounded-md transition-all duration-200 mb-1 ${isCollapsed ? 'justify-center p-2' : 'justify-start gap-3 px-3 py-2'
              } ${isActive
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
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

        {/* Configurações — apenas se o módulo estiver liberado para o perfil ou for administrador */}
        {(isAdmin || userModules.some(m => m.slug === 'configuracoes')) && (
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
          className={`flex items-center rounded-md text-sm transition-all duration-200 ${isCollapsed ? 'justify-center p-3' : 'justify-start gap-3 px-3 py-2 text-left'
            } text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white`}
        >
          {isDark ? <Sun className="h-5 w-5 flex-shrink-0" /> : <Moon className="h-5 w-5 flex-shrink-0" />}
          {!isCollapsed && <span className="truncate">{isDark ? 'Modo Claro' : 'Modo Escuro'}</span>}
        </button>

        <button
          onClick={handleLogout}
          title="Sair do Sistema"
          className={`flex items-center rounded-md text-sm text-red-500 hover:bg-red-500/10 dark:hover:bg-red-500/20 transition-all duration-200 mt-1 ${isCollapsed ? 'justify-center p-3' : 'justify-start gap-3 px-3 py-2 text-left'
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
