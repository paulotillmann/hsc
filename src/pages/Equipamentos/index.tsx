import React, { useEffect, useState, useMemo } from 'react';
import { 
  Laptop, 
  ShieldCheck, 
  Building2, 
  Network, 
  Search, 
  X, 
  Check, 
  Copy, 
  ExternalLink, 
  Calendar, 
  Info, 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight, 
  Monitor, 
  Cpu, 
  Database, 
  FileText,
  AlertTriangle,
  Filter
} from 'lucide-react';
import { webhookService } from '../../services/webhookService';
import { VisaoGeralCard } from '../../components/recepcao/VisaoGeralCard';

interface Equipamento {
  NR_SEQUENCIA: number;
  DS_EQUIPAMENTO: string;
  LOCALIZACAO: string;
  TIPO: string;
  PROPRIEDADE: string;
  'OBTER_NOME_PJ(CD_CGC_TERC)': string | null;
  'OBTER_NOME_PJ(A.CD_CGC_TERC)'?: string | null;
  DS_CATEGORIA: string | null;
  PATRIMONIO: string | null;
  IP: string | null;
  PROCESSADOR: string | null;
  MEMORIA: string | null;
  ANYDESK: string | null;
  DS_OBSERVACAO_TENSAO: string | null;
  INICIO_CONTRATO: string | null;
  FIM_CONTRATO: string | null;
  FORNECEDOR?: string | null;
  fornecedor?: string | null;
}

export default function Equipamentos() {
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTipo, setSelectedTipo] = useState('');
  const [selectedPropriedade, setSelectedPropriedade] = useState('');
  const [selectedLocalizacoes, setSelectedLocalizacoes] = useState<string[]>([]);
  const [selectedCategorias, setSelectedCategorias] = useState<string[]>([]);
  const [isCategoriaDropdownOpen, setIsCategoriaDropdownOpen] = useState(false);
  const [isLocalizacaoDropdownOpen, setIsLocalizacaoDropdownOpen] = useState(false);
  const [startGarantia, setStartGarantia] = useState('');
  const [endGarantia, setEndGarantia] = useState('');
  
  // Paginação e Ordenação
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;
  const [sortField, setSortField] = useState<keyof Equipamento>('NR_SEQUENCIA');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Modal de Detalhes
  const [selectedEquipamento, setSelectedEquipamento] = useState<Equipamento | null>(null);
  const [copiedAnydesk, setCopiedAnydesk] = useState(false);

  const loadData = async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    try {
      const data = await webhookService.fetchEquipamentosTi();
      setEquipamentos(data);
      setCurrentPage(1);
    } catch (err) {
      console.error('Erro ao carregar equipamentos:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Fechar dropdowns ao clicar fora
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.categoria-dropdown-container')) {
        setIsCategoriaDropdownOpen(false);
      }
      if (!target.closest('.localizacao-dropdown-container')) {
        setIsLocalizacaoDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Resetar todos os filtros
  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedTipo('');
    setSelectedPropriedade('');
    setSelectedLocalizacoes([]);
    setSelectedCategorias([]);
    setStartGarantia('');
    setEndGarantia('');
    setCurrentPage(1);
  };

  // Listas de opções para filtros (obtidas dinamicamente a partir dos dados)
  const filterOptions = useMemo(() => {
    const tipos = new Set<string>();
    const propriedades = new Set<string>();
    const localizacoes = new Set<string>();
    const categorias = new Set<string>();

    equipamentos.forEach(e => {
      if (e.TIPO) tipos.add(e.TIPO.trim());
      if (e.PROPRIEDADE) propriedades.add(e.PROPRIEDADE.trim());
      if (e.LOCALIZACAO) localizacoes.add(e.LOCALIZACAO.trim());
      if (e.DS_CATEGORIA) categorias.add(e.DS_CATEGORIA.trim());
    });

    return {
      tipos: Array.from(tipos).sort(),
      propriedades: Array.from(propriedades).sort(),
      localizacoes: Array.from(localizacoes).sort(),
      categorias: Array.from(categorias).sort()
    };
  }, [equipamentos]);



  // Ordenação de dados
  const handleSort = (field: keyof Equipamento) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Filtragem e Ordenação
  const filteredAndSortedEquipamentos = useMemo(() => {
    return equipamentos
      .filter(e => {
        // Busca textual
        const term = searchTerm.toLowerCase();
        const matchesSearch = !term || 
          e.DS_EQUIPAMENTO?.toLowerCase().includes(term) ||
          e.LOCALIZACAO?.toLowerCase().includes(term) ||
          e.PATRIMONIO?.toLowerCase().includes(term) ||
          e.IP?.toLowerCase().includes(term) ||
          e.ANYDESK?.toLowerCase().includes(term) ||
          e.PROCESSADOR?.toLowerCase().includes(term) ||
          e.MEMORIA?.toLowerCase().includes(term) ||
          e.DS_CATEGORIA?.toLowerCase().includes(term) ||
          e.NR_SEQUENCIA?.toString().includes(term) ||
          e.FORNECEDOR?.toLowerCase().includes(term) ||
          e.fornecedor?.toLowerCase().includes(term) ||
          e['OBTER_NOME_PJ(A.CD_CGC_TERC)']?.toLowerCase().includes(term) ||
          e['OBTER_NOME_PJ(CD_CGC_TERC)']?.toLowerCase().includes(term);

        // Filtros estruturados
        const matchesTipo = !selectedTipo || e.TIPO?.trim() === selectedTipo;
        const matchesPropriedade = !selectedPropriedade || e.PROPRIEDADE?.trim() === selectedPropriedade;
        const matchesLocalizacao = selectedLocalizacoes.length === 0 || 
          (e.LOCALIZACAO && selectedLocalizacoes.includes(e.LOCALIZACAO.trim()));
        const matchesCategoria = selectedCategorias.length === 0 || 
          (e.DS_CATEGORIA && selectedCategorias.includes(e.DS_CATEGORIA.trim()));

        // Filtro de Datas de Contrato/Garantia
        let matchesGarantia = true;
        if (startGarantia) {
          if (e.INICIO_CONTRATO) {
            const dateEquipStart = new Date(e.INICIO_CONTRATO).getTime();
            const filterStart = new Date(startGarantia + 'T00:00:00').getTime();
            if (dateEquipStart < filterStart) matchesGarantia = false;
          } else {
            matchesGarantia = false;
          }
        }

        if (endGarantia) {
          if (e.FIM_CONTRATO) {
            const dateEquipEnd = new Date(e.FIM_CONTRATO).getTime();
            const filterEnd = new Date(endGarantia + 'T23:59:59').getTime();
            if (dateEquipEnd > filterEnd) matchesGarantia = false;
          } else {
            matchesGarantia = false;
          }
        }

        return matchesSearch && matchesTipo && matchesPropriedade && matchesLocalizacao && matchesCategoria && matchesGarantia;
      })
      .sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];

        // Trata nulos
        if (valA === null || valA === undefined) return sortDirection === 'asc' ? 1 : -1;
        if (valB === null || valB === undefined) return sortDirection === 'asc' ? -1 : 1;

        if (typeof valA === 'string' && typeof valB === 'string') {
          return sortDirection === 'asc' 
            ? valA.localeCompare(valB)
            : valB.localeCompare(valA);
        }

        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortDirection === 'asc' ? valA - valB : valB - valA;
        }

        return 0;
      });
  }, [equipamentos, searchTerm, selectedTipo, selectedPropriedade, selectedLocalizacoes, selectedCategorias, startGarantia, endGarantia, sortField, sortDirection]);

  // Estatísticas / KPIs calculadas dinamicamente com base nos dados filtrados
  const stats = useMemo(() => {
    const total = filteredAndSortedEquipamentos.length;
    const proprios = filteredAndSortedEquipamentos.filter(e => e.PROPRIEDADE === 'Próprio').length;
    const terceiros = filteredAndSortedEquipamentos.filter(e => e.PROPRIEDADE === 'Terceiros').length;
    const emRede = filteredAndSortedEquipamentos.filter(e => e.IP && e.IP.trim() !== '').length;
    const comAnydesk = filteredAndSortedEquipamentos.filter(e => e.ANYDESK && e.ANYDESK.trim() !== '').length;

    return { total, proprios, terceiros, emRede, comAnydesk };
  }, [filteredAndSortedEquipamentos]);

  // Paginação
  const paginatedEquipamentos = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedEquipamentos.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAndSortedEquipamentos, currentPage]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedEquipamentos.length / itemsPerPage));

  // Funções Auxiliares
  const handleCopyAnydesk = (anydeskId: string) => {
    navigator.clipboard.writeText(anydeskId);
    setCopiedAnydesk(true);
    setTimeout(() => setCopiedAnydesk(false), 2000);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Não definida';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return new Intl.DateTimeFormat('pt-BR').format(d);
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="flex-1 space-y-8 min-h-screen pb-12 w-full mx-auto pt-4 animate-in fade-in duration-300">
      {/* Header Geral com Filtros Inline Compactos */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-card border border-border/50 rounded-2xl p-4 shadow-sm">
        <div className="shrink-0">
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Monitor className="h-6 w-6 text-primary" />
            Equipamentos de T.I.
          </h1>
          <p className="text-muted-foreground text-xs mt-0.5">
            Gestão, controle patrimonial e indicadores.
          </p>
        </div>

        {/* Painel de Filtros Inline */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          {/* 1. Busca rápida */}
          <div className="relative w-full sm:w-44">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Pesquisa rápida..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-background border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all h-[34px]"
            />
          </div>

          {/* 2. Tipo */}
          <select
            value={selectedTipo}
            onChange={(e) => {
              setSelectedTipo(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full sm:w-32 bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all font-medium h-[34px]"
          >
            <option value="">Todos os Tipos</option>
            {filterOptions.tipos.map(tipo => (
              <option key={tipo} value={tipo}>{tipo}</option>
            ))}
          </select>

          {/* 3. Categoria (Multi-seleção Checkbox) */}
          <div className="relative w-full sm:w-40 categoria-dropdown-container">
            <button
              type="button"
              onClick={() => setIsCategoriaDropdownOpen(!isCategoriaDropdownOpen)}
              className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground text-left flex justify-between items-center focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all font-medium h-[34px]"
            >
              <span className="truncate max-w-[85%]">
                {selectedCategorias.length === 0
                  ? 'Categorias'
                  : selectedCategorias.length === 1
                  ? selectedCategorias[0]
                  : `${selectedCategorias.length} selecionadas`}
              </span>
              <ChevronRight className={`h-3 w-3 transform transition-transform text-muted-foreground ${isCategoriaDropdownOpen ? 'rotate-90' : ''}`} />
            </button>

            {isCategoriaDropdownOpen && (
              <div className="absolute top-[100%] left-0 right-0 z-20 mt-1 bg-card border border-border rounded-lg shadow-lg py-1.5 max-h-48 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150">
                <div className="flex flex-col px-1">
                  {filterOptions.categorias.map(cat => {
                    const isChecked = selectedCategorias.includes(cat);
                    return (
                      <label
                        key={cat}
                        className="flex items-center gap-2 px-2 py-1 hover:bg-muted rounded cursor-pointer text-xs transition-colors select-none font-medium text-foreground"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setSelectedCategorias(prev => prev.filter(c => c !== cat));
                            } else {
                              setSelectedCategorias(prev => [...prev, cat]);
                            }
                            setCurrentPage(1);
                          }}
                          className="h-3.5 w-3.5 rounded border-border text-primary focus:ring-primary"
                        />
                        <span className="truncate">{cat}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 4. Propriedade */}
          <select
            value={selectedPropriedade}
            onChange={(e) => {
              setSelectedPropriedade(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full sm:w-32 bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all font-medium h-[34px]"
          >
            <option value="">Propriedades</option>
            {filterOptions.propriedades.map(prop => (
              <option key={prop} value={prop}>{prop}</option>
            ))}
          </select>

          {/* 5. Localização / Setor (Multi-seleção Checkbox) */}
          <div className="relative w-full sm:w-40 localizacao-dropdown-container">
            <button
              type="button"
              onClick={() => setIsLocalizacaoDropdownOpen(!isLocalizacaoDropdownOpen)}
              className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground text-left flex justify-between items-center focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all font-medium h-[34px]"
            >
              <span className="truncate max-w-[85%]">
                {selectedLocalizacoes.length === 0
                  ? 'Setores'
                  : selectedLocalizacoes.length === 1
                  ? selectedLocalizacoes[0]
                  : `${selectedLocalizacoes.length} selecionadas`}
              </span>
              <ChevronRight className={`h-3 w-3 transform transition-transform text-muted-foreground ${isLocalizacaoDropdownOpen ? 'rotate-90' : ''}`} />
            </button>

            {isLocalizacaoDropdownOpen && (
              <div className="absolute top-[100%] left-0 right-0 z-20 mt-1 bg-card border border-border rounded-lg shadow-lg py-1.5 max-h-48 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150">
                <div className="flex flex-col px-1">
                  {filterOptions.localizacoes.map(loc => {
                    const isChecked = selectedLocalizacoes.includes(loc);
                    return (
                      <label
                        key={loc}
                        className="flex items-center gap-2 px-2 py-1 hover:bg-muted rounded cursor-pointer text-xs transition-colors select-none font-medium text-foreground"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setSelectedLocalizacoes(prev => prev.filter(l => l !== loc));
                            } else {
                              setSelectedLocalizacoes(prev => [...prev, loc]);
                            }
                            setCurrentPage(1);
                          }}
                          className="h-3.5 w-3.5 rounded border-border text-primary focus:ring-primary"
                        />
                        <span className="truncate">{loc}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 6. Datas de Contrato */}
          <div className="flex items-center gap-1 bg-background border border-border rounded-lg px-2 py-1 text-xs text-foreground h-[34px]">
            <span className="text-muted-foreground shrink-0 font-medium">Contrato:</span>
            <input
              type="date"
              value={startGarantia}
              onChange={(e) => {
                setStartGarantia(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-transparent border-none p-0 focus:ring-0 w-24 focus:outline-none text-foreground font-medium text-xs shadow-none outline-none border-0"
            />
            <span className="text-muted-foreground shrink-0 font-medium">até</span>
            <input
              type="date"
              value={endGarantia}
              onChange={(e) => {
                setEndGarantia(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-transparent border-none p-0 focus:ring-0 w-24 focus:outline-none text-foreground font-medium text-xs shadow-none outline-none border-0"
            />
          </div>

          {/* Botão de Limpar Filtros */}
          {(searchTerm || selectedTipo || selectedPropriedade || selectedLocalizacoes.length > 0 || selectedCategorias.length > 0 || startGarantia || endGarantia) && (
            <button
              onClick={handleResetFilters}
              title="Limpar Filtros"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20 text-xs font-semibold transition-colors h-[34px]"
            >
              <X className="h-3.5 w-3.5" />
              Limpar
            </button>
          )}

          {/* Botão de Atualizar Dados */}
          <button
            onClick={() => loadData(true)}
            disabled={isLoading || isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors border border-border text-xs font-medium disabled:opacity-50 h-[34px]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Atualizando...' : 'Atualizar'}
          </button>
        </div>
      </div>

      {/* Seção 1: Indicadores (KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <VisaoGeralCard 
          isLoading={isLoading} 
          title="Total Geral" 
          value={stats.total} 
          icon={Laptop} 
          subtext="🖥️ Equipamentos cadastrados" 
          subtextColorClass="text-slate-500 dark:text-slate-400"
        />
        <VisaoGeralCard 
          isLoading={isLoading} 
          title="Próprios" 
          value={stats.proprios} 
          icon={ShieldCheck} 
          subtext="🛡️ Patrimônio da Santa Casa" 
          subtextColorClass="text-emerald-600 dark:text-emerald-400"
        />
        <VisaoGeralCard 
          isLoading={isLoading} 
          title="De Terceiros" 
          value={stats.terceiros} 
          icon={Building2} 
          subtext="🏢 Locados / Fornecedores" 
          subtextColorClass="text-amber-600 dark:text-amber-400"
        />
        <VisaoGeralCard 
          isLoading={isLoading} 
          title="Em Rede" 
          value={stats.emRede} 
          icon={Network} 
          subtext="🌐 Possuem IP configurado" 
          subtextColorClass="text-sky-600 dark:text-sky-400"
        />
        <VisaoGeralCard 
          isLoading={isLoading} 
          title="Com AnyDesk" 
          value={stats.comAnydesk} 
          icon={Monitor} 
          subtext="⚡ Acesso remoto configurado" 
          subtextColorClass="text-purple-600 dark:text-purple-400"
        />
      </div>

      {/* Seção 3: Tabela */}
      <div className="bg-card text-card-foreground rounded-xl border border-border/50 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
            <p className="text-sm text-muted-foreground font-medium">Buscando equipamentos...</p>
          </div>
        ) : filteredAndSortedEquipamentos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center px-4">
            <Info className="h-10 w-10 text-muted-foreground" />
            <h3 className="font-semibold text-foreground text-lg">Nenhum equipamento encontrado</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Não foram encontrados equipamentos para a combinação de filtros selecionada. Tente redefinir os filtros.
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/40 font-medium text-muted-foreground">
                    <th 
                      onClick={() => handleSort('NR_SEQUENCIA')} 
                      className="px-6 py-3.5 cursor-pointer hover:text-foreground transition-colors select-none"
                    >
                      Seq {sortField === 'NR_SEQUENCIA' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      onClick={() => handleSort('DS_EQUIPAMENTO')} 
                      className="px-6 py-3.5 cursor-pointer hover:text-foreground transition-colors select-none"
                    >
                      Equipamento {sortField === 'DS_EQUIPAMENTO' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      onClick={() => handleSort('TIPO')} 
                      className="px-6 py-3.5 cursor-pointer hover:text-foreground transition-colors select-none"
                    >
                      Tipo {sortField === 'TIPO' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      onClick={() => handleSort('DS_CATEGORIA')} 
                      className="px-6 py-3.5 cursor-pointer hover:text-foreground transition-colors select-none"
                    >
                      Categoria {sortField === 'DS_CATEGORIA' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      onClick={() => handleSort('PROPRIEDADE')} 
                      className="px-6 py-3.5 cursor-pointer hover:text-foreground transition-colors select-none"
                    >
                      Propriedade {sortField === 'PROPRIEDADE' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      onClick={() => handleSort('FORNECEDOR' as any)} 
                      className="px-6 py-3.5 cursor-pointer hover:text-foreground transition-colors select-none"
                    >
                      Fornecedor {sortField === 'FORNECEDOR' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      onClick={() => handleSort('LOCALIZACAO')} 
                      className="px-6 py-3.5 cursor-pointer hover:text-foreground transition-colors select-none"
                    >
                      Localização {sortField === 'LOCALIZACAO' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      onClick={() => handleSort('IP')} 
                      className="px-6 py-3.5 cursor-pointer hover:text-foreground transition-colors select-none"
                    >
                      IP {sortField === 'IP' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      onClick={() => handleSort('ANYDESK')} 
                      className="px-6 py-3.5 cursor-pointer hover:text-foreground transition-colors select-none"
                    >
                      AnyDesk {sortField === 'ANYDESK' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {paginatedEquipamentos.map((eq) => (
                    <tr 
                      key={eq.NR_SEQUENCIA}
                      className="hover:bg-muted/30 transition-colors group cursor-pointer"
                      onClick={() => setSelectedEquipamento(eq)}
                    >
                      <td className="px-6 py-4 font-mono font-medium text-xs text-muted-foreground">
                        {eq.NR_SEQUENCIA}
                      </td>
                      <td className="px-6 py-4 font-semibold text-foreground">
                        {eq.DS_EQUIPAMENTO}
                        {eq.PATRIMONIO && (
                          <span className="block text-xs font-normal text-muted-foreground mt-0.5">
                            Patr: {eq.PATRIMONIO}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          eq.TIPO?.trim() === 'Hardware' 
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' 
                            : 'bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300'
                        }`}>
                          {eq.TIPO}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground max-w-[150px] truncate" title={eq.DS_CATEGORIA || ''}>
                        {eq.DS_CATEGORIA || <span className="text-muted-foreground/45">—</span>}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          eq.PROPRIEDADE?.trim() === 'Próprio' 
                            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300' 
                            : 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300'
                        }`}>
                          {eq.PROPRIEDADE}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground max-w-[180px] truncate" title={eq.FORNECEDOR || eq.fornecedor || eq['OBTER_NOME_PJ(A.CD_CGC_TERC)'] || eq['OBTER_NOME_PJ(CD_CGC_TERC)'] || ''}>
                        {eq.FORNECEDOR || eq.fornecedor || eq['OBTER_NOME_PJ(A.CD_CGC_TERC)'] || eq['OBTER_NOME_PJ(CD_CGC_TERC)'] || <span className="text-muted-foreground/45">—</span>}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground max-w-[200px] truncate" title={eq.LOCALIZACAO}>
                        {eq.LOCALIZACAO}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-foreground">
                        {eq.IP || <span className="text-muted-foreground/45">—</span>}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-foreground">
                        {eq.ANYDESK || <span className="text-muted-foreground/45">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Rodapé e Paginação */}
            <div className="flex flex-col sm:flex-row items-center justify-between border-t border-border/50 px-6 py-4 gap-4 bg-muted/20">
              <span className="text-xs text-muted-foreground font-medium">
                Exibindo {paginatedEquipamentos.length} de {filteredAndSortedEquipamentos.length} equipamentos
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-secondary/60 disabled:opacity-40 transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                
                <span className="text-xs font-semibold px-3 py-1.5 rounded-md border border-border bg-background min-w-[70px] text-center">
                  {currentPage} / {totalPages}
                </span>

                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-secondary/60 disabled:opacity-40 transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Detalhes do Equipamento */}
      {selectedEquipamento && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col scale-in animate-in zoom-in-95 duration-200">
            {/* Header Modal */}
            <div className="flex items-start justify-between border-b border-border/60 p-6">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-primary/10 text-primary">
                    # {selectedEquipamento.NR_SEQUENCIA}
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-semibold ${
                    selectedEquipamento.TIPO?.trim() === 'Hardware' 
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' 
                      : 'bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300'
                  }`}>
                    {selectedEquipamento.TIPO}
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-semibold ${
                    selectedEquipamento.PROPRIEDADE?.trim() === 'Próprio' 
                      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300' 
                      : 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300'
                  }`}>
                    {selectedEquipamento.PROPRIEDADE}
                  </span>
                  {selectedEquipamento.DS_CATEGORIA && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-semibold bg-secondary text-secondary-foreground border border-border">
                      {selectedEquipamento.DS_CATEGORIA}
                    </span>
                  )}
                </div>
                <h3 className="text-xl font-bold text-foreground">
                  {selectedEquipamento.DS_EQUIPAMENTO}
                </h3>
              </div>
              <button
                onClick={() => setSelectedEquipamento(null)}
                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Conteúdo Modal */}
            <div className="p-6 space-y-6">
              {/* Informações Básicas Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-muted/40 border border-border/30 flex items-start gap-3">
                  <Database className="h-5 w-5 text-primary/75 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-2xs font-bold text-muted-foreground uppercase tracking-wider">Patrimônio</p>
                    <p className="text-sm font-semibold text-foreground mt-0.5">
                      {selectedEquipamento.PATRIMONIO || 'Não informado'}
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-muted/40 border border-border/30 flex items-start gap-3">
                  <Building2 className="h-5 w-5 text-primary/75 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-2xs font-bold text-muted-foreground uppercase tracking-wider">Localização / Setor</p>
                    <p className="text-sm font-semibold text-foreground mt-0.5">
                      {selectedEquipamento.LOCALIZACAO || 'Não informada'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Informações de Rede e Conectividade */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider border-b border-border/35 pb-1">
                  Rede e Suporte
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Endereço IP */}
                  <div className="p-4 rounded-lg bg-muted/40 border border-border/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Network className="h-4 w-4 text-primary" />
                        <span className="text-xs font-semibold text-foreground">Endereço IP</span>
                      </div>
                    </div>
                    <p className="text-base font-mono font-medium text-foreground">
                      {selectedEquipamento.IP || 'Sem IP atribuído'}
                    </p>
                  </div>

                  {/* AnyDesk */}
                  <div className="p-4 rounded-lg bg-muted/40 border border-border/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Laptop className="h-4 w-4 text-primary" />
                        <span className="text-xs font-semibold text-foreground">AnyDesk</span>
                      </div>
                      {selectedEquipamento.ANYDESK && (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleCopyAnydesk(selectedEquipamento.ANYDESK!)}
                            className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-all"
                            title="Copiar ID"
                          >
                            {copiedAnydesk ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                          </button>
                          <a
                            href={`anydesk:${selectedEquipamento.ANYDESK.replace(/\s+/g, '')}`}
                            className="p-1 rounded hover:bg-secondary text-primary hover:text-primary/80 transition-all"
                            title="Conectar"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </div>
                      )}
                    </div>
                    <p className="text-base font-mono font-medium text-foreground">
                      {selectedEquipamento.ANYDESK || 'Não cadastrado'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Especificações de Hardware */}
              {(selectedEquipamento.PROCESSADOR || selectedEquipamento.MEMORIA) && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider border-b border-border/35 pb-1">
                    Especificações Técnicas
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedEquipamento.PROCESSADOR && (
                      <div className="p-4 rounded-lg bg-muted/40 border border-border/30 flex items-start gap-3">
                        <Cpu className="h-5 w-5 text-primary/75 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-2xs font-bold text-muted-foreground uppercase tracking-wider">Processador</p>
                          <p className="text-sm font-semibold text-foreground mt-0.5">
                            {selectedEquipamento.PROCESSADOR}
                          </p>
                        </div>
                      </div>
                    )}
                    {selectedEquipamento.MEMORIA && (
                      <div className="p-4 rounded-lg bg-muted/40 border border-border/30 flex items-start gap-3">
                        <Database className="h-5 w-5 text-primary/75 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-2xs font-bold text-muted-foreground uppercase tracking-wider">Memória RAM</p>
                          <p className="text-sm font-semibold text-foreground mt-0.5">
                            {selectedEquipamento.MEMORIA}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Informações de Contrato (Se houver ou se for Terceirizado) */}
              {(selectedEquipamento.PROPRIEDADE === 'Terceiros' || selectedEquipamento.INICIO_CONTRATO) && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider border-b border-border/35 pb-1">
                    Informações do Contrato / Proprietário
                  </h4>
                  <div className="space-y-3">
                    <div className="p-4 rounded-lg bg-muted/40 border border-border/30 flex flex-col gap-3">
                      <div>
                        <p className="text-2xs font-bold text-muted-foreground uppercase tracking-wider">Proprietário / Fornecedor</p>
                        <p className="text-sm font-semibold text-foreground mt-0.5">
                          {selectedEquipamento['OBTER_NOME_PJ(CD_CGC_TERC)'] || selectedEquipamento['OBTER_NOME_PJ(A.CD_CGC_TERC)'] || 'Não informado'}
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-border/40 pt-3 mt-1">
                        <div className="flex items-center gap-2.5">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-2xs font-bold text-muted-foreground uppercase tracking-wider">Início do Contrato</p>
                            <p className="text-xs font-semibold text-foreground mt-0.5">
                              {formatDate(selectedEquipamento.INICIO_CONTRATO)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-2xs font-bold text-muted-foreground uppercase tracking-wider">Fim do Contrato</p>
                            <p className="text-xs font-semibold text-foreground mt-0.5">
                              {formatDate(selectedEquipamento.FIM_CONTRATO)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Observações / Tensão */}
              {selectedEquipamento.DS_OBSERVACAO_TENSAO && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider border-b border-border/35 pb-1 flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Observações e Licenciamento
                  </h4>
                  <div className="p-4 rounded-lg bg-amber-50/10 border border-amber-500/20 text-sm text-foreground flex gap-3">
                    <FileText className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="leading-relaxed font-medium">
                      {selectedEquipamento.DS_OBSERVACAO_TENSAO}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Modal */}
            <div className="border-t border-border/60 p-4 bg-muted/20 flex justify-end">
              <button
                onClick={() => setSelectedEquipamento(null)}
                className="px-4 py-2 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border text-sm font-semibold transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
