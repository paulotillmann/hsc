import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldAlert, 
  Search, 
  Filter, 
  ChevronDown, 
  ChevronUp, 
  ChevronLeft, 
  ChevronRight, 
  Eye, 
  Calendar, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  HelpCircle, 
  X, 
  SlidersHorizontal,
  FileText,
  UserCheck,
  ShieldCheck,
  ShieldAlert as LucideShieldAlert
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { denunciaService, Denuncia, AuditLog } from '../../services/denunciaService';

const CATEGORIES_MAP: Record<string, string> = {
  'assedio-moral': 'Assédio Moral / Abuso de Poder',
  'assedio-sexual': 'Assédio Sexual',
  'desvio-conduta': 'Desvio de Conduta Ética / Violamento de Normas',
  'fraude-corrupcao': 'Fraude / Desvio / Corrupção / Roubo',
  'seguranca-paciente': 'Segurança do Paciente',
  'discriminacao': 'Discriminação (Raça, Gênero, Orientação, Religião)',
  'outro': 'Outro Assunto (Não listado acima)'
};

export default function GestaoDenuncias() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  
  // Estados Reativos do Supabase (com fallback localStorage via service)
  const [denuncias, setDenuncias] = useState<Denuncia[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const carregarDados = async () => {
    try {
      setLoading(true);
      const dataDenuncias = await denunciaService.listarDenuncias();
      const dataLogs = await denunciaService.listarLogs();
      setDenuncias(dataDenuncias);
      setLogs(dataLogs);
    } catch (error) {
      console.error("Erro ao carregar dados do canal de escuta:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  // Estados de Navegação e Filtros
  const [activeTab, setActiveTab] = useState<'denuncias' | 'auditoria'>('denuncias');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategoria, setFilterCategoria] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPrioridade, setFilterPrioridade] = useState('');
  
  // Estados de Ordenação
  const [sortField, setSortField] = useState<'dataSubmetida' | 'prioridade' | 'status' | 'protocolo'>('dataSubmetida');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Estados de Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);

  // Estados da Gaveta Lateral (Drawer)
  const [selectedDenuncia, setSelectedDenuncia] = useState<Denuncia | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Estados de Ações de Edição
  const [newStatus, setNewStatus] = useState<'Pendente' | 'Em Investigação' | 'Concluído' | 'Arquivado'>('Pendente');
  const [newPriority, setNewPriority] = useState<'Baixa' | 'Média' | 'Alta' | 'Crítica'>('Baixa');
  const [changeJustificativa, setChangeJustificativa] = useState('');

  // ── AUDITORIA: Adicionar Log
  const addAuditLog = async (protocolo: string, acao: string) => {
    const usuario = profile?.full_name || profile?.email || 'Membro do Comitê';
    await denunciaService.registrarLog(protocolo, acao, usuario);
    const dataLogs = await denunciaService.listarLogs();
    setLogs(dataLogs);
  };

  // ── AÇÃO: Visualizar Detalhes
  const handleViewDetails = (denuncia: Denuncia) => {
    setSelectedDenuncia(denuncia);
    setNewStatus(denuncia.status);
    setNewPriority(denuncia.prioridade);
    setChangeJustificativa('');
    setDrawerOpen(true);
    addAuditLog(denuncia.protocolo, 'Visualização completa dos detalhes da denúncia');
  };

  // ── AÇÃO: Atualizar Status e Prioridade
  const handleUpdateStatusAndPriority = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDenuncia) return;

    const dataAtual = new Date().toISOString();
    const acoesRealizadas: string[] = [];

    // Mapeia novas alterações
    const statusAlterado = selectedDenuncia.status !== newStatus;
    const prioridadeAlterada = selectedDenuncia.prioridade !== newPriority;

    if (!statusAlterado && !prioridadeAlterada) return;

    if (statusAlterado) acoesRealizadas.push(`Status alterado de ${selectedDenuncia.status} para ${newStatus}`);
    if (prioridadeAlterada) acoesRealizadas.push(`Prioridade alterada de ${selectedDenuncia.prioridade} para ${newPriority}`);

    const newTimelineItem = {
      data: dataAtual,
      titulo: 'Atualização do Comitê de Ética',
      descricao: `${acoesRealizadas.join(' e ')}.${changeJustificativa ? ` Justificativa: ${changeJustificativa}` : ''}`,
      usuario: profile?.full_name || profile?.email || 'Membro do Comitê'
    };

    try {
      const updated = await denunciaService.atualizarDenuncia(
        selectedDenuncia.id,
        newStatus,
        newPriority,
        newTimelineItem
      );
      setSelectedDenuncia(updated);
      
      const dataDenuncias = await denunciaService.listarDenuncias();
      setDenuncias(dataDenuncias);
      
      await addAuditLog(selectedDenuncia.protocolo, acoesRealizadas.join(' e '));
      setChangeJustificativa('');
    } catch (err) {
      console.error("Erro ao atualizar status/prioridade:", err);
    }
  };

  // ── CÁLCULO DE MÉTRICAS (CARDS)
  const metricas = useMemo(() => {
    const total = denuncias.length;
    const pendentes = denuncias.filter(d => d.status === 'Pendente').length;
    const investigando = denuncias.filter(d => d.status === 'Em Investigação').length;
    const concluidas = denuncias.filter(d => d.status === 'Concluído').length;
    
    // Percentuais de Classificação
    const pctPendentes = total > 0 ? Math.round((pendentes / total) * 100) : 0;
    const pctInvestigando = total > 0 ? Math.round((investigando / total) * 100) : 0;
    const pctConcluidas = total > 0 ? Math.round((concluidas / total) * 100) : 0;

    return { total, pendentes, investigando, concluidas, pctPendentes, pctInvestigando, pctConcluidas };
  }, [denuncias]);

  // ── FILTRAGEM, BUSCA E ORDENAÇÃO
  const filteredAndSortedDenuncias = useMemo(() => {
    let result = [...denuncias];

    // Busca textual (protocolo ou texto de ocorrência)
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(d => 
        d.protocolo.toLowerCase().includes(term) || 
        d.descricao.toLowerCase().includes(term) ||
        (d.localOcorrencia && d.localOcorrencia.toLowerCase().includes(term))
      );
    }

    // Filtros rápidos
    if (filterCategoria) {
      result = result.filter(d => d.categoria === filterCategoria);
    }
    if (filterStatus) {
      result = result.filter(d => d.status === filterStatus);
    }
    if (filterPrioridade) {
      result = result.filter(d => d.prioridade === filterPrioridade);
    }

    // Ordenação
    result.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (sortField === 'dataSubmetida') {
        valA = new Date(a.dataSubmetida).getTime();
        valB = new Date(b.dataSubmetida).getTime();
      }

      // Prioridade mapeada numericamente para ordenação inteligente
      if (sortField === 'prioridade') {
        const priorityWeight = { 'Baixa': 1, 'Média': 2, 'Alta': 3, 'Crítica': 4 };
        valA = priorityWeight[a.prioridade] || 0;
        valB = priorityWeight[b.prioridade] || 0;
      }

      if (sortField === 'status') {
        const statusWeight = { 'Pendente': 1, 'Em Investigação': 2, 'Concluído': 3, 'Arquivado': 4 };
        valA = statusWeight[a.status] || 0;
        valB = statusWeight[b.status] || 0;
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [denuncias, searchTerm, filterCategoria, filterStatus, filterPrioridade, sortField, sortOrder]);

  // ── PAGINAÇÃO
  const totalPages = Math.ceil(filteredAndSortedDenuncias.length / itemsPerPage) || 1;
  const paginatedDenuncias = useMemo(() => {
    // Reset da página se ficar fora do range pós filtro
    const page = currentPage > totalPages ? 1 : currentPage;
    const startIndex = (page - 1) * itemsPerPage;
    return filteredAndSortedDenuncias.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAndSortedDenuncias, currentPage, itemsPerPage, totalPages]);

  // Mapeamento de Cores para Status e Prioridades
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Pendente':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20';
      case 'Em Investigação':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20';
      case 'Concluído':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20';
      case 'Arquivado':
        return 'bg-muted text-muted-foreground border border-border';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'Crítica':
        return 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 font-bold';
      case 'Alta':
        return 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 font-semibold';
      case 'Média':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20';
      case 'Baixa':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const toggleSort = (field: 'dataSubmetida' | 'prioridade' | 'status' | 'protocolo') => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc'); // Por padrão ordena do maior para o menor
    }
  };

  return (
    <div className="flex-1 min-h-screen pb-16 w-full mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8 max-w-7xl overflow-x-hidden">
      
      {/* ── HEADER PREMIUM ── */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-xl text-primary border border-primary/20">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Gestão de Denúncias</h1>
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed font-medium">
            Painel ético institucional confidencial do Hospital Santa Casa de Araguari.
          </p>
        </div>

        {/* Abas e Controles Premium */}
        <div className="flex items-center gap-2 bg-muted p-1 rounded-xl border">
          <button
            onClick={() => setActiveTab('denuncias')}
            className={`px-4 py-2 text-xs md:text-sm font-semibold rounded-lg transition-all ${
              activeTab === 'denuncias' 
                ? 'bg-card text-foreground shadow-sm' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Relatos
          </button>
          <button
            onClick={() => {
              setActiveTab('auditoria');
              addAuditLog('GERAL', 'Acesso ao Painel de Auditoria e Logs');
            }}
            className={`px-4 py-2 text-xs md:text-sm font-semibold rounded-lg transition-all ${
              activeTab === 'auditoria' 
                ? 'bg-card text-foreground shadow-sm' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Auditoria & Logs
          </button>
        </div>
      </div>

      {/* ── CONTEÚDO ── */}
      {activeTab === 'denuncias' ? (
        <>
          {/* CARDS DE MÉTRICAS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Card 1 - Total */}
            <div className="p-6 bg-card border rounded-2xl shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
              <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-xl pointer-events-none group-hover:scale-125 transition-transform" />
              <div className="flex justify-between items-start">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Denúncias Recebidas</span>
                <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-full font-semibold">Geral</span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-foreground">{metricas.total}</span>
                <span className="text-xs text-muted-foreground font-medium">relatos</span>
              </div>
              <div className="mt-4 h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: '100%' }} />
              </div>
            </div>

            {/* Card 2 - Pendente */}
            <div className="p-6 bg-card border rounded-2xl shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
              <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl pointer-events-none group-hover:scale-125 transition-transform" />
              <div className="flex justify-between items-start">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Triagem & Pendente</span>
                <span className="text-[10px] px-2 py-0.5 bg-amber-500/10 text-amber-600 border border-amber-500/20 rounded-full font-semibold">{metricas.pctPendentes}%</span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-foreground">{metricas.pendentes}</span>
                <span className="text-xs text-muted-foreground font-medium">aguardando</span>
              </div>
              <div className="mt-4 h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full transition-all duration-500" style={{ width: `${metricas.pctPendentes}%` }} />
              </div>
            </div>

            {/* Card 3 - Em Investigação */}
            <div className="p-6 bg-card border rounded-2xl shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-xl pointer-events-none group-hover:scale-125 transition-transform" />
              <div className="flex justify-between items-start">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Em Investigação</span>
                <span className="text-[10px] px-2 py-0.5 bg-blue-500/10 text-blue-600 border border-blue-500/20 rounded-full font-semibold">{metricas.pctInvestigando}%</span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-foreground">{metricas.investigando}</span>
                <span className="text-xs text-muted-foreground font-medium">em análise</span>
              </div>
              <div className="mt-4 h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${metricas.pctInvestigando}%` }} />
              </div>
            </div>

            {/* Card 4 - Resolvidas */}
            <div className="p-6 bg-card border rounded-2xl shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none group-hover:scale-125 transition-transform" />
              <div className="flex justify-between items-start">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Casos Concluídos</span>
                <span className="text-[10px] px-2 py-0.5 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 rounded-full font-semibold">{metricas.pctConcluidas}%</span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-foreground">{metricas.concluidas}</span>
                <span className="text-xs text-muted-foreground font-medium">concluídas</span>
              </div>
              <div className="mt-4 h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${metricas.pctConcluidas}%` }} />
              </div>
            </div>
          </div>

          {/* BARRA DE FILTROS E BUSCA AVANÇADA */}
          <div className="bg-card border rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center">
              {/* Barra de Pesquisa */}
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Pesquisar por código de protocolo ou palavras-chave..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full h-11 pl-10 pr-4 bg-background border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                />
              </div>

              {/* Botão de Limpeza Rápida */}
              {(searchTerm || filterCategoria || filterStatus || filterPrioridade) && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setFilterCategoria('');
                    setFilterStatus('');
                    setFilterPrioridade('');
                    setCurrentPage(1);
                  }}
                  className="inline-flex h-11 items-center justify-center gap-2 border hover:bg-muted text-muted-foreground hover:text-foreground text-xs md:text-sm font-semibold rounded-xl px-4 transition-colors"
                >
                  <X className="h-4 w-4" />
                  Limpar Filtros
                </button>
              )}
            </div>

            {/* Seletores de Filtros Rápidos */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Categoria do Relato</label>
                <div className="relative">
                  <select
                    value={filterCategoria}
                    onChange={(e) => {
                      setFilterCategoria(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full h-10 px-3 bg-background border rounded-lg appearance-none text-xs md:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 pr-8"
                  >
                    <option value="">Todas as categorias</option>
                    {Object.entries(CATEGORIES_MAP).map(([id, label]) => (
                      <option key={id} value={id}>{label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Status da Investigação</label>
                <div className="relative">
                  <select
                    value={filterStatus}
                    onChange={(e) => {
                      setFilterStatus(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full h-10 px-3 bg-background border rounded-lg appearance-none text-xs md:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 pr-8"
                  >
                    <option value="">Todos os status</option>
                    <option value="Pendente">Pendente</option>
                    <option value="Em Investigação">Em Investigação</option>
                    <option value="Concluído">Concluído</option>
                    <option value="Arquivado">Arquivado</option>
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Prioridade</label>
                <div className="relative">
                  <select
                    value={filterPrioridade}
                    onChange={(e) => {
                      setFilterPrioridade(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full h-10 px-3 bg-background border rounded-lg appearance-none text-xs md:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 pr-8"
                  >
                    <option value="">Todas as prioridades</option>
                    <option value="Crítica">Crítica</option>
                    <option value="Alta">Alta</option>
                    <option value="Média">Média</option>
                    <option value="Baixa">Baixa</option>
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          {/* TABELA DE DENÚNCIAS */}
          <div className="bg-card border rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto min-w-full">
              <table className="min-w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="bg-muted/40 border-b select-none">
                    <th 
                      onClick={() => toggleSort('protocolo')}
                      className="px-6 py-4 font-bold text-muted-foreground text-xs uppercase tracking-wider cursor-pointer hover:bg-muted/65 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        Protocolo
                        {sortField === 'protocolo' && (sortOrder === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                      </div>
                    </th>
                    <th 
                      onClick={() => toggleSort('dataSubmetida')}
                      className="px-6 py-4 font-bold text-muted-foreground text-xs uppercase tracking-wider cursor-pointer hover:bg-muted/65 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        Data Submissão
                        {sortField === 'dataSubmetida' && (sortOrder === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                      </div>
                    </th>
                    <th className="px-6 py-4 font-bold text-muted-foreground text-xs uppercase tracking-wider">
                      Categoria do Relato
                    </th>
                    <th 
                      onClick={() => toggleSort('prioridade')}
                      className="px-6 py-4 font-bold text-muted-foreground text-xs uppercase tracking-wider cursor-pointer hover:bg-muted/65 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        Prioridade
                        {sortField === 'prioridade' && (sortOrder === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                      </div>
                    </th>
                    <th 
                      onClick={() => toggleSort('status')}
                      className="px-6 py-4 font-bold text-muted-foreground text-xs uppercase tracking-wider cursor-pointer hover:bg-muted/65 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        Status
                        {sortField === 'status' && (sortOrder === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                      </div>
                    </th>
                    <th className="px-6 py-4 font-bold text-muted-foreground text-xs uppercase tracking-wider text-right">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {paginatedDenuncias.length > 0 ? (
                    paginatedDenuncias.map((denuncia) => (
                      <tr key={denuncia.id} className="hover:bg-muted/15 transition-colors">
                        <td className="px-6 py-4 font-mono font-bold text-foreground whitespace-nowrap">
                          {denuncia.protocolo}
                        </td>
                        <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5" />
                            {new Date(denuncia.dataSubmetida).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric'
                            })}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-foreground font-medium max-w-[280px] truncate">
                          {denuncia.categoriaLabel}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getPriorityBadge(denuncia.prioridade)}`}>
                            {denuncia.prioridade}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusBadge(denuncia.status)}`}>
                            {denuncia.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          <button
                            onClick={() => handleViewDetails(denuncia)}
                            className="inline-flex h-8 items-center gap-1.5 px-3 bg-secondary hover:bg-muted border rounded-lg text-xs font-bold text-foreground transition-all"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Visualizar
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-muted-foreground">
                        Nenhuma denúncia ética encontrada para os filtros aplicados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* SELETOR DE PAGINAÇÃO */}
            <div className="px-6 py-4 bg-muted/20 border-t flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-medium text-muted-foreground select-none">
              <div className="flex items-center gap-2">
                <span>Visualizar</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-background border rounded-lg px-2 py-1 focus:outline-none text-foreground font-semibold"
                >
                  <option value={5}>5 por página</option>
                  <option value={10}>10 por página</option>
                  <option value={20}>20 por página</option>
                </select>
                <span>de {filteredAndSortedDenuncias.length} denúncias</span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="h-8 w-8 rounded-lg flex items-center justify-center border hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-foreground"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentPage(i + 1)}
                      className={`h-8 w-8 rounded-lg border text-xs font-bold transition-all ${
                        currentPage === i + 1
                          ? 'bg-primary border-primary text-primary-foreground shadow-sm'
                          : 'hover:bg-muted text-foreground'
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="h-8 w-8 rounded-lg flex items-center justify-center border hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-foreground"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* ── AUDITORIA E LOGS ── */
        <div className="space-y-6">
          {/* Banner explicativo de conformidade de IP */}
          <div className="flex items-start gap-4 p-5 border border-emerald-100 dark:border-emerald-950/30 rounded-2xl bg-emerald-500/5 text-emerald-800 dark:text-emerald-400 text-sm shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-full bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
            <ShieldCheck className="h-6 w-6 text-emerald-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-foreground">Conformidade e Blindagem Ética Hospitalar</span>
              <p className="leading-relaxed text-muted-foreground text-xs md:text-sm">
                Seguindo as normas da Lei Geral de Proteção de Dados (LGPD) e as diretrizes do canal ético do Hospital Santa Casa de Araguari, todos os endereços de IP, cookies e metadados de rastreamento digital dos relatores são **anulados, blindados e completamente omitidos** do sistema na recepção. O comitê de ética possui acesso somente ao teor dos fatos para investigação imparcial.
              </p>
            </div>
          </div>

          <div className="bg-card border rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-muted/20">
              <div className="font-bold text-foreground text-sm uppercase tracking-wider">Histórico de Auditoria & Conformidade</div>
              <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                Auditoria Ativa
              </span>
            </div>

            <div className="overflow-x-auto min-w-full">
              <table className="min-w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="bg-muted/40 border-b text-xs font-bold text-muted-foreground uppercase tracking-wider select-none">
                    <th className="px-6 py-3">Data e Hora</th>
                    <th className="px-6 py-3">Protocolo</th>
                    <th className="px-6 py-3">Ação Investigativa</th>
                    <th className="px-6 py-3">Auditor Responsável</th>
                    <th className="px-6 py-3 text-right">Origem de Rede</th>
                  </tr>
                </thead>
                <tbody className="divide-y font-medium text-xs md:text-sm">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/15 transition-colors">
                      <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-mono">
                          <Clock className="h-3.5 w-3.5" />
                          {new Date(log.data).toLocaleString('pt-BR')}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono font-bold text-foreground whitespace-nowrap">
                        {log.protocolo}
                      </td>
                      <td className="px-6 py-4 text-foreground">
                        {log.acao}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {log.usuario}
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-black text-emerald-500 whitespace-nowrap">
                        {log.origem}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── DRAWER LATERAL DE DETALHES DA DENÚNCIA ── */}
      {drawerOpen && selectedDenuncia && (
        <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true">
          {/* Overlay de fundo */}
          <div 
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300" 
          />

          <div className="absolute inset-y-0 right-0 max-w-full flex">
            {/* Corpo do Drawer */}
            <div className="w-screen max-w-xl bg-card border-l flex flex-col h-full shadow-2xl relative transition-transform duration-300 ease-out transform">
              
              {/* Header do Drawer */}
              <div className="px-6 py-5 border-b flex items-center justify-between bg-muted/30">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  <span className="font-mono font-bold text-foreground text-base md:text-lg">
                    {selectedDenuncia.protocolo}
                  </span>
                </div>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors border"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Corpo de Rolagem */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
                
                {/* Status e Prioridades atuais */}
                <div className="grid grid-cols-2 gap-3.5 bg-muted/35 p-4 rounded-xl border border-border">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Status da Denúncia</span>
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadge(selectedDenuncia.status)}`}>
                      {selectedDenuncia.status}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Prioridade</span>
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getPriorityBadge(selectedDenuncia.prioridade)}`}>
                      {selectedDenuncia.prioridade}
                    </span>
                  </div>
                </div>

                {/* Banner de Anonimato Visual no Detalhe */}
                {selectedDenuncia.anonimo ? (
                  <div className="flex items-center gap-3 p-4 border border-blue-100 dark:border-blue-900/30 rounded-xl bg-blue-500/5 text-blue-800 dark:text-blue-300 text-xs font-medium">
                    <ShieldCheck className="h-5 w-5 text-blue-500 shrink-0" />
                    <span>
                      <strong className="text-foreground">Identidade Blindada:</strong> Este relato foi enviado de forma anônima. Dados de rede, IP, navegadores e arquivos de rastro digital foram eliminados pelo sistema.
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 p-4 border rounded-xl bg-muted/20">
                    <div className="flex items-center gap-2 text-xs font-bold text-foreground uppercase tracking-wider pb-1 border-b">
                      <UserCheck className="h-4 w-4 text-primary" />
                      Identificação do Relator (Confidencial)
                    </div>
                    <div className="grid grid-cols-2 gap-3.5 text-xs">
                      <div>
                        <span className="text-muted-foreground block font-bold">Nome</span>
                        <span className="text-foreground font-semibold">{selectedDenuncia.nomeRelator}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block font-bold">Cargo</span>
                        <span className="text-foreground font-semibold">{selectedDenuncia.cargoRelator || 'Não informado'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block font-bold">E-mail</span>
                        <a href={`mailto:${selectedDenuncia.emailRelator}`} className="text-primary hover:underline font-semibold truncate block">
                          {selectedDenuncia.emailRelator}
                        </a>
                      </div>
                      <div>
                        <span className="text-muted-foreground block font-bold">Telefone</span>
                        <span className="text-foreground font-semibold">{selectedDenuncia.telefoneRelator || 'Não informado'}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Detalhes Gerais da Ocorrência */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-foreground uppercase tracking-wider border-b pb-1.5">Informações do Ocorrido</h3>
                  <div className="grid grid-cols-2 gap-4 text-xs font-medium">
                    <div className="space-y-0.5">
                      <span className="text-muted-foreground block">Categoria da Ocorrência</span>
                      <span className="text-foreground font-bold">{selectedDenuncia.categoriaLabel}</span>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-muted-foreground block">Data da Ocorrência</span>
                      <span className="text-foreground font-bold">
                        {selectedDenuncia.dataOcorrencia 
                          ? new Date(selectedDenuncia.dataOcorrencia).toLocaleDateString('pt-BR') 
                          : 'Não informada'}
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-muted-foreground block">Local / Setor do Ocorrido</span>
                      <span className="text-foreground font-bold">{selectedDenuncia.localOcorrencia || 'Não informado'}</span>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-muted-foreground block">Data de Submissão</span>
                      <span className="text-foreground font-bold">
                        {new Date(selectedDenuncia.dataSubmetida).toLocaleString('pt-BR')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* O Relato Completo */}
                <div className="space-y-2 bg-muted/20 border p-4 rounded-xl">
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-wider block">Descrição dos Fatos Reportados</h3>
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap font-medium">
                    {selectedDenuncia.descricao}
                  </p>
                </div>

                {/* Anexos de Evidência */}
                {selectedDenuncia.anexos && selectedDenuncia.anexos.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wider block">Anexos e Evidências</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {selectedDenuncia.anexos.map((fileName, idx) => (
                        <div key={idx} className="flex items-center gap-2 p-2.5 rounded-lg border bg-muted/40 text-xs font-medium min-w-0">
                          <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span className="truncate flex-1">{fileName}</span>
                          <span className="text-[10px] text-muted-foreground uppercase bg-muted px-1.5 py-0.5 rounded font-mono font-bold">Arquivo</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* TIMELINE INTERATIVA */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-foreground uppercase tracking-wider border-b pb-1.5">Evolução do Caso / Timeline</h3>
                  <div className="relative pl-5 border-l-2 border-primary/20 space-y-5 ml-2.5">
                    {selectedDenuncia.timeline.map((step, index) => (
                      <div key={index} className="relative">
                        {/* Marcador flutuante da Timeline */}
                        <div className="absolute -left-[27px] top-1 h-3 w-3 rounded-full bg-primary border-4 border-card ring-2 ring-primary/20" />
                        
                        <div className="space-y-1">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                            <span className="text-xs font-bold text-foreground">{step.titulo}</span>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {new Date(step.data).toLocaleString('pt-BR')}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                            {step.descricao}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* PAINEL DE CONTROLE - ATUALIZAR STATUS E PRIORIDADE */}
                <div className="border-t pt-5 space-y-4">
                  <h3 className="text-sm font-bold text-foreground uppercase tracking-wider block">Painel de Ações do Comitê</h3>
                  
                  <form onSubmit={handleUpdateStatusAndPriority} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3.5">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-foreground">Atualizar Status</label>
                        <div className="relative">
                          <select
                            value={newStatus}
                            onChange={(e) => setNewStatus(e.target.value as any)}
                            className="w-full h-10 px-3 bg-background border rounded-lg appearance-none text-xs md:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/50 pr-8"
                          >
                            <option value="Pendente">Pendente</option>
                            <option value="Em Investigação">Em Investigação</option>
                            <option value="Concluído">Concluído</option>
                            <option value="Arquivado">Arquivado</option>
                          </select>
                          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-foreground">Alterar Prioridade</label>
                        <div className="relative">
                          <select
                            value={newPriority}
                            onChange={(e) => setNewPriority(e.target.value as any)}
                            className="w-full h-10 px-3 bg-background border rounded-lg appearance-none text-xs md:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/50 pr-8"
                          >
                            <option value="Baixa">Baixa</option>
                            <option value="Média">Média</option>
                            <option value="Alta">Alta</option>
                            <option value="Crítica">Crítica</option>
                          </select>
                          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground">Justificativa da Ação (Opcional)</label>
                      <textarea
                        rows={3}
                        placeholder="Informe o motivo da alteração de status/prioridade ou próximas etapas investigativas clínicas..."
                        value={changeJustificativa}
                        onChange={(e) => setChangeJustificativa(e.target.value)}
                        className="w-full border rounded-lg p-3 bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 text-xs leading-relaxed font-medium"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={selectedDenuncia.status === newStatus && selectedDenuncia.prioridade === newPriority}
                      className="w-full h-10 inline-flex items-center justify-center bg-primary text-primary-foreground text-xs md:text-sm font-bold rounded-lg shadow hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      Salvar Alterações Éticas
                    </button>
                  </form>
                </div>

              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
