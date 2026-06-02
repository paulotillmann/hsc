import React, { useState, useEffect } from 'react';
import { 
  Wrench, 
  RefreshCcw, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  MapPin, 
  Cpu, 
  User, 
  UserCheck, 
  Calendar, 
  Tag,
  AlertTriangle,
  Play,
  ArrowUpRight,
  CheckCircle
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface OrdemServicoItem {
  id: string;
  nr_sequencia: number;
  ds_grupo_des: string | null;
  nr_seq_localizacao: number | null;
  ds_localizacao: string | null;
  nr_seq_equipamento: number | null;
  ds_equipamento: string | null;
  nm_solicitante: string | null;
  telefone_solicitante: string | null;
  nm_executor: string | null;
  nm_usuario_encer: string | null;
  nm_usuario: string | null;
  dt_ordem_servico: string | null;
  dt_atualizacao: string | null;
  minutos_atualiza: number | null;
  ds_estagio: string | null;
  ie_status_ordem: string | null;
  ie_prioridade: string | null;
  ds_prioridade: string | null;
  ie_parado: string | null;
  ds_dano_breve: string | null;
  ds_dano: string | null;
  nr_seq_estagio: number | null;
  ds_situacao: string | null;
  ds_solucao: string | null;
  ds_relat_tecnico: string | null;
  created_at: string;
  updated_at: string;
}

export default function OrdemServico() {
  const [orders, setOrders] = useState<OrdemServicoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<'dia' | 'semana' | 'mes' | 'todas'>('todas');

  interface ExecutorInfo {
    email: string;
    dbKey: string;
    displayName: string;
    fullName: string;
    avatarUrl: string | null;
  }

  const [executors, setExecutors] = useState<ExecutorInfo[]>([
    {
      email: 'talysson.resende@santacasaaraguari.org.br',
      dbKey: 'talysson.resend',
      displayName: 'Talysson',
      fullName: 'Talysson Marins Resende',
      avatarUrl: null
    },
    {
      email: 'brunoy.lima@santacasaaraguari.org.br',
      dbKey: 'bruno.lima',
      displayName: 'Bruno',
      fullName: 'Bruno José M A Lima',
      avatarUrl: null
    },
    {
      email: 'jessica.araujo@santacasaaraguari.org.br',
      dbKey: 'jessica.araujo',
      displayName: 'Jessica',
      fullName: 'Jessica Dantas de Araújo Cardoso',
      avatarUrl: null
    },
    {
      email: 'jhon.silva@santacasaaraguari.org.br',
      dbKey: 'jhon.silva',
      displayName: 'Jhon',
      fullName: 'Jhon Willy da Silva',
      avatarUrl: null
    }
  ]);

  const [selectedExecutor, setSelectedExecutor] = useState<string | null>(null);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const { data, error: dbError } = await supabase
        .from('ordem_servico')
        .select('*')
        .gte('dt_ordem_servico', '2026-01-01T00:00:00Z')
        .lte('dt_ordem_servico', '2026-12-31T23:59:59.999Z')
        .order('dt_ordem_servico', { ascending: false });

      if (dbError) throw dbError;
      setOrders(data || []);
    } catch (err: any) {
      console.error('Erro ao carregar ordens de serviço:', err);
      setError('Erro ao carregar as ordens de serviço do banco de dados.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  useEffect(() => {
    const loadExecutorAvatars = async () => {
      try {
        const emails = executors.map(e => e.email);
        const { data, error } = await supabase
          .from('profiles')
          .select('email, avatar_url')
          .in('email', emails);

        if (error) throw error;

        if (data && data.length > 0) {
          setExecutors(prev =>
            prev.map(exec => {
              const profile = data.find(p => p.email?.toLowerCase() === exec.email.toLowerCase());
              return {
                ...exec,
                avatarUrl: profile?.avatar_url || null
              };
            })
          );
        }
      } catch (err) {
        console.error('Erro ao carregar avatares dos executores:', err);
      }
    };

    loadExecutorAvatars();
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    setSuccess(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('sync-ordem-servico', {
        method: 'POST',
      });

      if (fnError) {
        throw new Error(fnError.message || 'Erro ao comunicar com a Edge Function.');
      }

      if (data?.success === false) {
        throw new Error(data.error || 'Falha na sincronização.');
      }

      setSuccess(`Sincronização realizada! ${data?.upserted || 0} ordens de serviço atualizadas.`);
      await fetchOrders(); // Atualiza a grid com os novos dados
      
      setTimeout(() => {
        setSuccess(null);
      }, 5000);
    } catch (err: any) {
      console.error('Erro ao sincronizar:', err);
      setError(err.message || 'Falha ao sincronizar dados com o n8n.');
    } finally {
      setSyncing(false);
    }
  };

  // Filtragem dos itens
  const filteredOrders = orders.filter(os => {
    // 1. Filtrar apenas o ano de 2026
    if (!os.dt_ordem_servico) return false;
    const orderDate = new Date(os.dt_ordem_servico);
    if (orderDate.getFullYear() !== 2026) return false;

    // 2. Filtro por Período
    const today = new Date();
    if (dateFilter === 'dia') {
      const isToday = 
        orderDate.getDate() === today.getDate() &&
        orderDate.getMonth() === today.getMonth() &&
        orderDate.getFullYear() === today.getFullYear();
      if (!isToday) return false;
    } else if (dateFilter === 'semana') {
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      startOfWeek.setHours(0, 0, 0, 0);

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      const isInWeek = orderDate >= startOfWeek && orderDate <= endOfWeek;
      if (!isInWeek) return false;
    } else if (dateFilter === 'mes') {
      const isInMonth = 
        orderDate.getMonth() === today.getMonth() &&
        orderDate.getFullYear() === today.getFullYear();
      if (!isInMonth) return false;
    }

    // 2.5 Filtro por Executor Selecionado (Foto)
    if (selectedExecutor) {
      const execName = (os.nm_executor || '').toLowerCase();
      if (!execName.includes(selectedExecutor.toLowerCase())) {
        return false;
      }
    }

    // 3. Filtro por Busca
    const searchString = [
      os.nr_sequencia,
      os.ds_grupo_des,
      os.ds_localizacao,
      os.ds_equipamento,
      os.nm_solicitante,
      os.nm_executor,
      os.ds_dano_breve,
      os.ds_dano,
      os.ds_situacao
    ].join(' ').toLowerCase();

    const matchesSearch = searchString.includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  // Função para distribuir as OSs nas colunas do Kanban
  const getColumnOrders = (columnId: 'triagem' | 'processo' | 'escalonado' | 'finalizado') => {
    return filteredOrders.filter(os => {
      const situacao = (os.ds_situacao || '').toLowerCase();
      const executor = (os.nm_executor || '').trim();
      const encer = (os.nm_usuario_encer || '').trim();
      const estagio = (os.ds_estagio || '').trim();
      const estagioLower = estagio.toLowerCase();

      // 1. Finalizado (ou Encerrado)
      const isFinalizado = 
        situacao.includes('finalizada') || 
        situacao.includes('finalizado') || 
        situacao.includes('encerrada') || 
        situacao.includes('concluída') || 
        situacao.includes('concluido') || 
        encer !== '' ||
        estagioLower.includes('encerrad');

      if (columnId === 'finalizado') return isFinalizado;
      if (isFinalizado) return false;

      // 2. Triagem (Ordens de Serviço com DS Estagio em branco)
      const isTriagem = estagio === '';
      if (columnId === 'triagem') return isTriagem;
      if (isTriagem) return false;

      // 3. Em processo (ds_estagio = Iniciada ou Em Desenvolvimento)
      const isEmProcesso = estagioLower === 'iniciada' || estagioLower === 'em desenvolvimento';
      if (columnId === 'processo') return isEmProcesso;
      if (isEmProcesso) return false;

      // 4. Escalonado (todos os outros menos encerrado)
      return columnId === 'escalonado';
    });
  };

  const triagemItems = getColumnOrders('triagem');
  const processoItems = getColumnOrders('processo');
  const escalonadoItems = getColumnOrders('escalonado');
  const finalizadoItems = getColumnOrders('finalizado');

  // Formatação de prioridade
  const getPriorityBadge = (iePrioridade: string | null) => {
    const p = (iePrioridade || '').toUpperCase();
    if (p === 'A' || p.includes('ALT')) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border border-rose-200/40">
          Alta
        </span>
      );
    }
    if (p === 'M' || p.includes('MED')) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border border-amber-200/40">
          Média
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 border border-blue-200/40">
        Baixa
      </span>
    );
  };

  // Formatação de data
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Render do Card Kanban
  const renderCard = (os: OrdemServicoItem) => (
    <div 
      key={os.id} 
      className="bg-card border border-border/80 rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 flex flex-col gap-3 group"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-muted-foreground group-hover:text-primary transition-colors">
          OS #{os.nr_sequencia}
        </span>
        {getPriorityBadge(os.ie_prioridade)}
      </div>

      <h3 className="text-sm font-semibold text-foreground leading-snug line-clamp-2">
        {os.ds_dano_breve || os.ds_dano || 'Sem descrição'}
      </h3>

      <div className="flex flex-col gap-1.5 text-xs text-muted-foreground mt-1">
        {os.ds_localizacao && (
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
            <span className="truncate">{os.ds_localizacao}</span>
          </div>
        )}
        {os.ds_equipamento && (
          <div className="flex items-center gap-1.5">
            <Cpu className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
            <span className="truncate">{os.ds_equipamento}</span>
          </div>
        )}
        {os.nm_solicitante && (
          <div className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
            <span className="truncate">Sol: {os.nm_solicitante}</span>
          </div>
        )}
        {os.nm_executor && (
          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-500/5 px-1.5 py-0.5 rounded border border-emerald-500/10 w-fit max-w-full">
            <UserCheck className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Exec: {os.nm_executor}</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-border/40 pt-2.5 mt-1 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          <span>{formatDate(os.dt_ordem_servico)}</span>
        </div>
        {(os.ds_estagio || os.ds_situacao) && (
          <span className="font-semibold uppercase tracking-wider text-[9px] bg-muted px-1.5 py-0.5 rounded">
            {os.ds_estagio || os.ds_situacao}
          </span>
        )}
      </div>
    </div>
  );

  // Ordenar os executores em ordem alfabética pelo nome de exibição
  const sortedExecutors = [...executors].sort((a, b) => a.displayName.localeCompare(b.displayName));

  return (
    <div className="flex-1 space-y-4 min-h-[85vh] pb-4 w-full mx-auto px-1 pt-2 text-foreground transition-all">
      {/* Cabeçalho do Módulo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Wrench className="h-8 w-8 text-primary animate-pulse" />
            Ordem de Serviço
          </h1>
          <p className="text-muted-foreground mt-1 text-xs">
            Acompanhamento das ordens de serviço integradas com o n8n.
          </p>
        </div>

        {/* Botão de Sincronização */}
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center justify-center gap-2 bg-primary hover:bg-primary/95 text-primary-foreground font-semibold px-4 py-2.5 rounded-lg text-sm transition-all shadow-sm hover:shadow active:scale-95 disabled:opacity-50 disabled:pointer-events-none shrink-0"
        >
          <RefreshCcw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Sincronizando...' : 'Sincronizar com n8n'}
        </button>
      </div>

      {/* Feedbacks de Operação */}
      {success && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-300 rounded-xl animate-in slide-in-from-top duration-300">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-500 shrink-0" />
          <span className="text-sm font-medium">{success}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl animate-in slide-in-from-top duration-300">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      {/* Estatísticas Rápidas */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="bg-card border border-border/80 rounded-xl p-3 flex flex-col justify-between shadow-sm border-l-4 border-l-slate-400">
            <span className="text-xs font-semibold text-muted-foreground font-medium">Em Triagem</span>
            <span className="text-2xl font-bold mt-1 text-slate-700 dark:text-slate-300">{triagemItems.length}</span>
          </div>
          <div className="bg-card border border-border/80 rounded-xl p-3 flex flex-col justify-between shadow-sm border-l-4 border-l-sky-500">
            <span className="text-xs font-semibold text-muted-foreground font-medium">Em Processo</span>
            <span className="text-2xl font-bold mt-1 text-sky-600 dark:text-sky-400">{processoItems.length}</span>
          </div>
          <div className="bg-card border border-border/80 rounded-xl p-3 flex flex-col justify-between shadow-sm border-l-4 border-l-amber-500">
            <span className="text-xs font-semibold text-muted-foreground font-medium">Escalado / Parado</span>
            <span className="text-2xl font-bold mt-1 text-amber-600 dark:text-amber-400">{escalonadoItems.length}</span>
          </div>
          <div className="bg-card border border-border/80 rounded-xl p-3 flex flex-col justify-between shadow-sm border-l-4 border-l-emerald-500">
            <span className="text-xs font-semibold text-muted-foreground font-medium">Encerrados</span>
            <span className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">{finalizadoItems.length}</span>
          </div>
          <div className="bg-card border border-border/80 rounded-xl p-3 flex flex-col justify-between shadow-sm border-l-4 border-l-primary">
            <span className="text-xs font-semibold text-muted-foreground font-medium">Total</span>
            <span className="text-2xl font-bold mt-1 text-primary">{filteredOrders.length}</span>
          </div>
        </div>
      )}

      {/* Filtros e Busca */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-card border border-border/80 p-3.5 rounded-xl shadow-sm w-full">
        {/* Avatares dos Executores (Esquerda) */}
        <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
          <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Executores:</span>
          <div className="flex items-center gap-2">
            {sortedExecutors.map((exec) => {
              const isSelected = selectedExecutor === exec.dbKey;
              const initials = exec.displayName.substring(0, 2).toUpperCase();
              
              return (
                <button
                  key={exec.dbKey}
                  onClick={() => setSelectedExecutor(isSelected ? null : exec.dbKey)}
                  title={exec.fullName}
                  className={`relative flex items-center justify-center h-10 w-10 rounded-full border overflow-hidden p-0 transition-all duration-200 bg-background ${
                    isSelected
                      ? 'border-primary ring-2 ring-primary/30 scale-110 shadow-sm'
                      : 'border-border hover:border-muted-foreground/50 hover:scale-105'
                  }`}
                >
                  {exec.avatarUrl ? (
                    <img
                      src={exec.avatarUrl}
                      alt={exec.displayName}
                      className="h-full w-full rounded-full object-cover antialiased"
                    />
                  ) : (
                    <div className={`h-full w-full rounded-full flex items-center justify-center text-xs font-bold ${
                      isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                    }`}>
                      {initials}
                    </div>
                  )}
                  {isSelected && (
                    <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[9px] text-primary-foreground font-bold border border-background shadow-sm">
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
            
            {selectedExecutor && (
              <button
                onClick={() => setSelectedExecutor(null)}
                className="text-[10px] text-muted-foreground hover:text-foreground font-medium underline ml-1 whitespace-nowrap"
              >
                Limpar
              </button>
            )}
          </div>
        </div>

        {/* Busca e Período (Direita) */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto justify-end">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por OS, solicitante..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-muted/40 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-foreground placeholder:text-muted-foreground"
            />
          </div>
          
          {/* Filtro de Período */}
          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            <Calendar className="h-4 w-4 text-muted-foreground shrink-0 hidden sm:block" />
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="w-full sm:w-32 py-2 px-3 bg-muted/40 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground"
            >
              <option value="todas">Todas</option>
              <option value="dia">Dia</option>
              <option value="semana">Semana</option>
              <option value="mes">Mês</option>
            </select>
          </div>
        </div>
      </div>

      {/* Layout Kanban */}
      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3">
          <RefreshCcw className="h-8 w-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Carregando ordens de serviço...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-card border border-border/80 shadow-sm rounded-xl p-8 text-center flex flex-col items-center justify-center min-h-[40vh] gap-4">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
            <Search className="h-8 w-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground mb-1">Nenhum chamado encontrado</h2>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              Experimente alterar os filtros de pesquisa ou utilize o botão de sincronização para baixar novos dados.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start overflow-x-auto pb-4">
          {/* Coluna 1: Triagem */}
          <div className="bg-slate-50 dark:bg-slate-900/30 border border-slate-200/60 dark:border-slate-800/40 rounded-xl p-3 flex flex-col h-[calc(100vh-340px)] min-h-[450px]">
            <div className="flex items-center justify-between pb-2 border-b border-border/40 mb-3 shrink-0">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-slate-400" />
                <h2 className="font-bold text-sm text-foreground">Triagem</h2>
              </div>
              <span className="text-xs bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold px-2 py-0.5 rounded-full">
                {triagemItems.length}
              </span>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/45 transition-colors">
              {triagemItems.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground border border-dashed rounded-lg">
                  Sem chamados na triagem
                </div>
              ) : (
                triagemItems.map(renderCard)
              )}
            </div>
          </div>

          {/* Coluna 2: Em Processo */}
          <div className="bg-sky-50/40 dark:bg-sky-950/5 border border-sky-200/40 dark:border-sky-900/10 rounded-xl p-3 flex flex-col h-[calc(100vh-340px)] min-h-[450px]">
            <div className="flex items-center justify-between pb-2 border-b border-border/40 mb-3 shrink-0">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-sky-500 animate-pulse" />
                <h2 className="font-bold text-sm text-foreground">Em processo</h2>
              </div>
              <span className="text-xs bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-400 font-semibold px-2 py-0.5 rounded-full">
                {processoItems.length}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/45 transition-colors">
              {processoItems.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground border border-dashed rounded-lg">
                  Sem chamados em processo
                </div>
              ) : (
                processoItems.map(renderCard)
              )}
            </div>
          </div>

          {/* Coluna 3: Escalonado */}
          <div className="bg-amber-50/30 dark:bg-amber-950/5 border border-amber-200/40 dark:border-amber-900/10 rounded-xl p-3 flex flex-col h-[calc(100vh-340px)] min-h-[450px]">
            <div className="flex items-center justify-between pb-2 border-b border-border/40 mb-3 shrink-0">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-amber-500" />
                <h2 className="font-bold text-sm text-foreground">Escalonado</h2>
              </div>
              <span className="text-xs bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 font-semibold px-2 py-0.5 rounded-full">
                {escalonadoItems.length}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/45 transition-colors">
              {escalonadoItems.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground border border-dashed rounded-lg">
                  Sem chamados escalonados
                </div>
              ) : (
                escalonadoItems.map(renderCard)
              )}
            </div>
          </div>

          {/* Coluna 4: Finalizado */}
          <div className="bg-emerald-50/20 dark:bg-emerald-950/5 border border-emerald-200/30 dark:border-emerald-900/10 rounded-xl p-3 flex flex-col h-[calc(100vh-340px)] min-h-[450px]">
            <div className="flex items-center justify-between pb-2 border-b border-border/40 mb-3 shrink-0">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <h2 className="font-bold text-sm text-foreground">Finalizado</h2>
              </div>
              <span className="text-xs bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 font-semibold px-2 py-0.5 rounded-full">
                {finalizadoItems.length}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/45 transition-colors">
              {finalizadoItems.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground border border-dashed rounded-lg">
                  Nenhum chamado finalizado
                </div>
              ) : (
                finalizadoItems.map(renderCard)
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


