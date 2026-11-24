import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams, NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  X,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  LogOut,
  ExternalLink,
  Settings,
  LayoutGrid,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { getVisibleCategories, NavCategory, NavModuleItem } from '../config/navigationConfig';
import DynamicIcon from '../components/DynamicIcon';

const ITEMS_PER_PAGE = 9;

const HomeHub: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { signOut, profile, isAdmin, profileLoaded } = useAuth();
  const { userModules } = usePermissions();

  const [isDark, setIsDark] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(0);

  const selectedCategoryId = searchParams.get('categoria');

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);

  const categories = useMemo(
    () => getVisibleCategories(userModules, isAdmin),
    [userModules, isAdmin]
  );

  const selectedCategory: NavCategory | null = useMemo(() => {
    if (!selectedCategoryId) return null;
    return categories.find((c) => c.id === selectedCategoryId) || null;
  }, [categories, selectedCategoryId]);

  // Resetar paginação ao mudar categoria ou busca
  useEffect(() => {
    setCurrentPage(0);
  }, [selectedCategoryId, searchQuery]);

  // Atalho ESC para voltar às categorias ou limpar busca
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (searchQuery) {
          setSearchQuery('');
        } else if (selectedCategoryId) {
          setSearchParams({});
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchQuery, selectedCategoryId, setSearchParams]);

  // Busca global em todos os módulos visíveis
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];

    const matches: Array<{ item: NavModuleItem; category: NavCategory }> = [];
    for (const category of categories) {
      const categoryMatches = category.name.toLowerCase().includes(q);
      for (const item of category.items) {
        if (
          categoryMatches ||
          item.label.toLowerCase().includes(q) ||
          (item.description && item.description.toLowerCase().includes(q))
        ) {
          matches.push({ item, category });
        }
      }
    }
    return matches;
  }, [searchQuery, categories]);

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

  const handleSelectCategory = (category: NavCategory) => {
    setSearchParams({ categoria: category.id });
  };

  const handleBackToCategories = () => {
    setSearchParams({});
  };

  const handleOpenModule = (item: NavModuleItem) => {
    if (item.external) {
      window.open(item.path, '_blank', 'noopener,noreferrer');
      return;
    }
    navigate(item.path);
  };

  // Paginação estilo Tasy (até 12 itens por página)
  const isSearching = searchQuery.trim().length > 0;
  const activeListLength = isSearching
    ? searchResults.length
    : selectedCategory
      ? selectedCategory.items.length
      : categories.length;

  const totalPages = Math.max(1, Math.ceil(activeListLength / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages - 1);
  const pageStart = safePage * ITEMS_PER_PAGE;
  const pageEnd = pageStart + ITEMS_PER_PAGE;

  const paginatedCategories = categories.slice(pageStart, pageEnd);
  const paginatedModules = selectedCategory ? selectedCategory.items.slice(pageStart, pageEnd) : [];
  const paginatedSearchResults = searchResults.slice(pageStart, pageEnd);

  const firstName = profile?.full_name?.split(' ')[0] || 'Colaborador';
  const canConfig = isAdmin || userModules.some((m) => m.slug === 'configuracoes');

  return (
    <div
      className="min-h-screen w-full flex flex-col transition-colors duration-300
        bg-gradient-to-br from-slate-100 via-slate-50 to-slate-200 text-slate-900
        dark:from-[#04122b] dark:via-[#07214a] dark:to-[#0a3168] dark:text-white"
    >
      {/* ── Header Superior Discreto ── */}
      <header className="w-full px-6 sm:px-10 py-4 flex items-center justify-between border-b border-slate-200/70 dark:border-white/10 backdrop-blur-sm bg-white/60 dark:bg-black/15">
        <button
          onClick={() => {
            setSearchQuery('');
            setSearchParams({});
          }}
          className="flex items-center gap-3 focus:outline-none group"
          title="Voltar para a tela inicial"
        >
          <img
            src={isDark ? '/LOGO_HSC_WHITE.png' : '/LOGO_HSC_PRIMARY.png'}
            alt="Hospital Santa Casa"
            className="h-9 sm:h-10 w-auto object-contain transition-transform duration-200 group-hover:scale-[1.02]"
          />
        </button>

        <div className="flex items-center gap-2 sm:gap-3">
          {canConfig && (
            <button
              onClick={() => navigate('/configuracoes')}
              title="Configurações do Sistema"
              className="p-2 rounded-lg text-slate-600 hover:bg-slate-200/70 hover:text-slate-900 dark:text-white/75 dark:hover:bg-white/10 dark:hover:text-white transition-colors"
            >
              <Settings className="h-5 w-5" />
            </button>
          )}

          <button
            onClick={toggleTheme}
            title={isDark ? 'Mudar para Modo Claro' : 'Mudar para Modo Escuro'}
            className="p-2 rounded-lg text-slate-600 hover:bg-slate-200/70 hover:text-slate-900 dark:text-white/75 dark:hover:bg-white/10 dark:hover:text-white transition-colors"
          >
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>

          {profile && (
            <NavLink
              to="/perfil"
              title="Meu Perfil"
              className="flex items-center gap-2.5 pl-1.5 pr-3 py-1 rounded-full bg-white/80 hover:bg-white border border-slate-200/80 dark:bg-white/10 dark:hover:bg-white/15 dark:border-white/15 transition-colors"
            >
              <div className="h-7 w-7 rounded-full bg-primary/15 dark:bg-white/20 flex items-center justify-center text-primary dark:text-white font-bold text-xs overflow-hidden">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  (profile.full_name ?? profile.email ?? 'U')[0].toUpperCase()
                )}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-semibold leading-tight max-w-[140px] truncate">
                  {profile.full_name ?? profile.email}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-blue-200/70 capitalize leading-tight">
                  {profile.role}
                </p>
              </div>
            </NavLink>
          )}

          <button
            onClick={handleLogout}
            title="Sair do Sistema"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-red-600 hover:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
      </header>

      {/* ── Conteúdo Central Estilo Tasy ── */}
      <main className="flex-1 flex flex-col justify-center items-center w-full px-4 sm:px-8 lg:px-16 py-6 sm:py-10">
        <div className="w-full max-w-6xl flex flex-col items-center">
          {/* Título + Barra de Busca */}
          <div className="w-full flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 sm:mb-10">
            <div>
              {selectedCategory && !isSearching ? (
                <div className="flex flex-col gap-2">
                  <button
                    onClick={handleBackToCategories}
                    className="inline-flex items-center gap-2 text-xs font-medium text-primary dark:text-blue-200 hover:underline w-fit"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Voltar para Categorias
                  </button>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 dark:bg-white/15 flex items-center justify-center text-primary dark:text-white">
                      <DynamicIcon name={selectedCategory.icon} className="h-5 w-5" />
                    </div>
                    <div>
                      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                        {selectedCategory.name}
                      </h1>
                      <p className="text-xs sm:text-sm text-slate-500 dark:text-blue-200/75">
                        {selectedCategory.description}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-primary dark:text-blue-300 mb-1">
                    Portal Hospital Santa Casa
                  </p>
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                    Olá, {firstName}
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-blue-200/75 mt-0.5">
                    {isSearching
                      ? `Resultados para "${searchQuery}" (${searchResults.length})`
                      : 'Selecione uma categoria para acessar os módulos'}
                  </p>
                </div>
              )}
            </div>

            {/* Busca Rápida */}
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-blue-200/60 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar módulo ou categoria..."
                className="w-full pl-10 pr-9 py-2.5 text-sm rounded-xl border transition-all outline-none
                  bg-white/90 border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20
                  dark:bg-white/10 dark:border-white/15 dark:text-white dark:placeholder:text-blue-200/50 dark:focus:border-blue-400/60 dark:focus:bg-white/15"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-slate-700 dark:text-blue-200/70 dark:hover:text-white"
                  title="Limpar busca"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* ── Área do Grid com Setas Laterais estilo Tasy ── */}
          {!profileLoaded ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <div className="h-9 w-9 rounded-full border-4 border-primary dark:border-white border-t-transparent animate-spin" />
              <p className="text-sm text-slate-500 dark:text-blue-200/75">Carregando módulos...</p>
            </div>
          ) : (
            <div className="relative w-full flex items-center">
              {/* Seta Anterior */}
              {totalPages > 1 && (
                <button
                  onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                  disabled={safePage === 0}
                  aria-label="Página anterior"
                  className="hidden lg:flex absolute -left-14 items-center justify-center h-12 w-12 rounded-full transition-all
                    text-slate-400 hover:text-slate-900 hover:bg-slate-200/70 disabled:opacity-20 disabled:pointer-events-none
                    dark:text-white/50 dark:hover:text-white dark:hover:bg-white/10"
                >
                  <ChevronLeft className="h-8 w-8" />
                </button>
              )}

              <div className="w-full min-h-[380px] sm:min-h-[420px]">
                <AnimatePresence mode="wait">
                  {/* ESTADO 1: BUSCA ATIVA */}
                  {isSearching ? (
                    <motion.div
                      key={`search-${safePage}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.18 }}
                      className="w-full"
                    >
                      {paginatedSearchResults.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                          <LayoutGrid className="h-12 w-12 text-slate-300 dark:text-white/25 mb-3" />
                          <p className="text-base font-medium">Nenhum módulo encontrado</p>
                          <p className="text-xs text-slate-500 dark:text-blue-200/65 mt-1">
                            Tente buscar por outro termo ou limpe a pesquisa.
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-7">
                          {paginatedSearchResults.map(({ item, category }) => (
                            <button
                              key={`${category.id}-${item.id}`}
                              onClick={() => handleOpenModule(item)}
                              className="group flex items-center gap-4 sm:gap-5 p-4 sm:p-5 lg:p-6 rounded-2xl text-left transition-all duration-200
                                hover:bg-white hover:shadow-lg hover:shadow-slate-200/80 border border-transparent hover:border-slate-200/80
                                dark:hover:bg-white/10 dark:hover:shadow-none dark:hover:border-white/15"
                            >
                              <div
                                className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all duration-200
                                  bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white group-hover:scale-105
                                  dark:bg-white/10 dark:text-white dark:group-hover:bg-white dark:group-hover:text-[#07214a]"
                              >
                                <DynamicIcon name={item.icon} className="h-7 w-7 sm:h-8 sm:w-8" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold text-base sm:text-lg leading-snug truncate">
                                    {item.label}
                                  </span>
                                  {item.external && (
                                    <ExternalLink className="h-4 w-4 opacity-60 flex-shrink-0" />
                                  )}
                                </div>
                                <p className="text-xs sm:text-sm text-slate-500 dark:text-blue-200/75 truncate mt-1">
                                  {category.name}
                                </p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  ) : selectedCategory ? (
                    /* ESTADO 2: MÓDULOS DA CATEGORIA SELECIONADA */
                    <motion.div
                      key={`cat-${selectedCategory.id}-${safePage}`}
                      initial={{ opacity: 0, x: 24 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -24 }}
                      transition={{ duration: 0.2 }}
                      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-7"
                    >
                      {paginatedModules.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => handleOpenModule(item)}
                          className="group flex items-center gap-4 sm:gap-5 p-4 sm:p-5 lg:p-6 rounded-2xl text-left transition-all duration-200
                            hover:bg-white hover:shadow-lg hover:shadow-slate-200/80 border border-transparent hover:border-slate-200/80
                            dark:hover:bg-white/10 dark:hover:shadow-none dark:hover:border-white/15"
                        >
                          <div
                            className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all duration-200
                              bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white group-hover:scale-105
                              dark:bg-white/10 dark:text-white dark:group-hover:bg-white dark:group-hover:text-[#07214a]"
                          >
                            <DynamicIcon name={item.icon} className="h-7 w-7 sm:h-8 sm:w-8" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-base sm:text-lg leading-snug">
                                {item.label}
                              </span>
                              {item.external && (
                                <ExternalLink className="h-4 w-4 opacity-60 flex-shrink-0" />
                              )}
                            </div>
                            {item.description && (
                              <p className="text-xs sm:text-sm text-slate-500 dark:text-blue-200/75 line-clamp-2 mt-1">
                                {item.description}
                              </p>
                            )}
                          </div>
                        </button>
                      ))}
                    </motion.div>
                  ) : (
                    /* ESTADO 3: GRID DE CATEGORIAS (TELA INICIAL) */
                    <motion.div
                      key={`root-${safePage}`}
                      initial={{ opacity: 0, x: -24 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 24 }}
                      transition={{ duration: 0.2 }}
                      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-7"
                    >
                      {paginatedCategories.map((category) => (
                        <button
                          key={category.id}
                          onClick={() => handleSelectCategory(category)}
                          className="group flex items-center gap-4 sm:gap-5 p-4 sm:p-5 lg:p-6 rounded-2xl text-left transition-all duration-200
                            hover:bg-white hover:shadow-lg hover:shadow-slate-200/80 border border-transparent hover:border-slate-200/80
                            dark:hover:bg-white/10 dark:hover:shadow-none dark:hover:border-white/15"
                        >
                          <div
                            className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all duration-200
                              bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white group-hover:scale-105
                              dark:bg-white/10 dark:text-white dark:group-hover:bg-white dark:group-hover:text-[#07214a]"
                          >
                            <DynamicIcon name={category.icon} className="h-7 w-7 sm:h-8 sm:w-8" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="font-semibold text-base sm:text-lg leading-snug block">
                              {category.name}
                            </span>
                            <p className="text-xs sm:text-sm text-slate-500 dark:text-blue-200/75 mt-1">
                              {category.items.length}{' '}
                              {category.items.length === 1 ? 'módulo' : 'módulos'}
                            </p>
                          </div>
                          <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-primary dark:text-white/25 dark:group-hover:text-white transition-all group-hover:translate-x-0.5 flex-shrink-0" />
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Seta Próxima */}
              {totalPages > 1 && (
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={safePage === totalPages - 1}
                  aria-label="Próxima página"
                  className="hidden lg:flex absolute -right-14 items-center justify-center h-12 w-12 rounded-full transition-all
                    text-slate-400 hover:text-slate-900 hover:bg-slate-200/70 disabled:opacity-20 disabled:pointer-events-none
                    dark:text-white/50 dark:hover:text-white dark:hover:bg-white/10"
                >
                  <ChevronRight className="h-8 w-8" />
                </button>
              )}
            </div>
          )}

          {/* ── Indicador de Páginas (Bolinhas estilo Tasy + setas no mobile/tablet) ── */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-8 sm:mt-10">
              <button
                onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                disabled={safePage === 0}
                aria-label="Página anterior"
                className="flex lg:hidden items-center justify-center h-9 w-9 rounded-full transition-all
                  text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 disabled:opacity-25 disabled:pointer-events-none
                  dark:text-white/60 dark:hover:text-white dark:hover:bg-white/10"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

              <div className="flex items-center justify-center gap-2.5">
                {Array.from({ length: totalPages }).map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentPage(idx)}
                    aria-label={`Ir para página ${idx + 1}`}
                    className={`h-2.5 rounded-full transition-all duration-200 ${
                      idx === safePage
                        ? 'w-8 bg-primary dark:bg-white'
                        : 'w-2.5 bg-slate-300 hover:bg-slate-400 dark:bg-white/30 dark:hover:bg-white/60'
                    }`}
                  />
                ))}
              </div>

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={safePage === totalPages - 1}
                aria-label="Próxima página"
                className="flex lg:hidden items-center justify-center h-9 w-9 rounded-full transition-all
                  text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 disabled:opacity-25 disabled:pointer-events-none
                  dark:text-white/60 dark:hover:text-white dark:hover:bg-white/10"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default HomeHub;
