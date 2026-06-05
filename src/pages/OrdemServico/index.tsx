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
  CheckCircle,
  X,
  History,
  ClipboardList,
  Clock
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { VisaoGeralCard } from '../../components/recepcao/VisaoGeralCard';

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
  const [error, setError] = useState<string | null>(null);

  // Estados para o indicador visual de sincronização periódica
  const [isBackgroundSyncing, setIsBackgroundSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState(false);

  // Formatar horário da última sync
  const formatSyncTime = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };


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
      email: 'bruno.lima@santacasaaraguari.org.br',
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

  const [selectedOrder, setSelectedOrder] = useState<OrdemServicoItem | null>(null);
  const [orderHistory, setOrderHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [ordersWithHistory, setOrdersWithHistory] = useState<Set<number>>(new Set());
  const [stageHistory, setStageHistory] = useState<any[]>([]);
  const [loadingStageHistory, setLoadingStageHistory] = useState(false);

  const handleCardClick = async (os: OrdemServicoItem) => {
    setSelectedOrder(os);
    setOrderHistory([]);
    setStageHistory([]);
    setLoadingHistory(true);
    setLoadingStageHistory(true);
    try {
      // 1. Carrega relatos técnicos
      const { data: relatoData, error: relatoError } = await supabase
        .from('historico_ordem_servico')
        .select('*')
        .eq('nr_sequencia', os.nr_sequencia)
        .order('created_at', { ascending: false });

      if (relatoError) throw relatoError;
      setOrderHistory(relatoData || []);

      // 2. Carrega histórico de estágios
      const { data: stageData, error: stageError } = await supabase
        .from('ordem_servico_estagio_log')
        .select('*')
        .eq('nr_sequencia', os.nr_sequencia)
        .order('dt_transicao', { ascending: true });

      if (stageError) throw stageError;
      setStageHistory(stageData || []);
    } catch (err) {
      console.error('Erro ao carregar detalhes da OS:', err);
    } finally {
      setLoadingHistory(false);
      setLoadingStageHistory(false);
    }
  };

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

      // Normaliza as datas do Tasy (soma 3 horas para corrigir o fuso "falso UTC" gravado pelo n8n)
      const adjustTasyDate = (dateStr: string | null): string | null => {
        if (!dateStr) return null;
        const date = new Date(dateStr);
        date.setHours(date.getHours() + 3);
        return date.toISOString();
      };

      const normalizedData = (data || []).map(os => ({
        ...os,
        dt_ordem_servico: adjustTasyDate(os.dt_ordem_servico),
        dt_atualizacao: adjustTasyDate(os.dt_atualizacao),
        updated_at: adjustTasyDate(os.updated_at)
      }));

      setOrders(normalizedData);

      // Buscar os históricos das ordens carregadas para identificar quais possuem histórico
      if (data && data.length > 0) {
        const nrSequencias = data.map(o => o.nr_sequencia);
        const { data: histData, error: histError } = await supabase
          .from('historico_ordem_servico')
          .select('nr_sequencia')
          .in('nr_sequencia', nrSequencias);

        if (!histError && histData) {
          const hasHistorySet = new Set(histData.map(h => h.nr_sequencia));
          setOrdersWithHistory(hasHistorySet);
        }
      }
    } catch (err: any) {
      console.error('Erro ao carregar ordens de serviço:', err);
      setError('Erro ao carregar as ordens de serviço do banco de dados.');
    } finally {
      setLoading(false);
    }
  };

  // Referência para manter a OS selecionada atualizada no escopo das inscrições do Realtime
  const selectedOrderRef = React.useRef<OrdemServicoItem | null>(null);
  
  useEffect(() => {
    selectedOrderRef.current = selectedOrder;
  }, [selectedOrder]);

  // Função auxiliar para atualizar o histórico e estágios da OS em exibição no modal
  const refreshSelectedOrderDetails = async (os: OrdemServicoItem) => {
    try {
      const { data: relatoData, error: relatoError } = await supabase
        .from('historico_ordem_servico')
        .select('*')
        .eq('nr_sequencia', os.nr_sequencia)
        .order('created_at', { ascending: false });

      if (!relatoError) {
        setOrderHistory(relatoData || []);
      }

      const { data: stageData, error: stageError } = await supabase
        .from('ordem_servico_estagio_log')
        .select('*')
        .eq('nr_sequencia', os.nr_sequencia)
        .order('dt_transicao', { ascending: true });

      if (!stageError) {
        setStageHistory(stageData || []);
      }
    } catch (err) {
      console.error('Erro ao atualizar histórico da OS selecionada:', err);
    }
  };

  // Sincronização automática em background (silenciosa) com o n8n
  const runBackgroundSync = async () => {
    if (isBackgroundSyncing) return;
    setIsBackgroundSyncing(true);
    setSyncError(false);
    try {
      console.log('[Background Sync] Iniciando sincronização periódica com o n8n...');
      const { data, error: fnError } = await supabase.functions.invoke('sync-ordem-servico', {
        method: 'POST',
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data?.success === false) {
        throw new Error(data.error || 'Falha na sincronização.');
      }

      console.log(`[Background Sync] Sincronização concluída! ${data.upserted || 0} ordens de serviço atualizadas.`);
      setLastSyncTime(new Date());
      fetchOrders();
    } catch (err) {
      console.warn('[Background Sync] Erro na sincronização em background:', err);
      setSyncError(true);
    } finally {
      setIsBackgroundSyncing(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    
    // Dispara uma sincronização imediata ao entrar na tela
    runBackgroundSync();

    // Configura o intervalo de 3 minutos para a sincronização periódica
    const syncInterval = setInterval(() => {
      runBackgroundSync();
    }, 3 * 60 * 1000); // 3 minutos

    // Inscreve no Realtime para alterações nas ordens de serviço
    const ordersChannel = supabase
      .channel('ordem-servico-realtime-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ordem_servico' },
        (payload) => {
          console.log('[Realtime] Alteração na tabela ordem_servico:', payload.eventType);
          fetchOrders();

          // Se a OS modificada for a selecionada, atualiza seus dados no modal
          if (payload.new && (payload.new as any).nr_sequencia) {
            const adjustTasyDate = (dateStr: string | null): string | null => {
              if (!dateStr) return null;
              const date = new Date(dateStr);
              date.setHours(date.getHours() + 3);
              return date.toISOString();
            };

            const rawOS = payload.new as any;
            const updatedOS: OrdemServicoItem = {
              ...rawOS,
              dt_ordem_servico: adjustTasyDate(rawOS.dt_ordem_servico),
              dt_atualizacao: adjustTasyDate(rawOS.dt_atualizacao),
              updated_at: adjustTasyDate(rawOS.updated_at)
            };

            if (selectedOrderRef.current && selectedOrderRef.current.nr_sequencia === updatedOS.nr_sequencia) {
              setSelectedOrder(updatedOS);
            }
          }
        }
      )
      .subscribe();

    // Inscreve no Realtime para novos relatos históricos
    const historyChannel = supabase
      .channel('historico-ordem-servico-realtime-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'historico_ordem_servico' },
        (payload) => {
          console.log('[Realtime] Alteração na tabela historico_ordem_servico:', payload.eventType);
          fetchOrders();

          // Se o novo relato for da OS selecionada, atualiza o histórico dela no modal
          const newRecord = payload.new as any;
          if (newRecord && newRecord.nr_sequencia) {
            if (selectedOrderRef.current && selectedOrderRef.current.nr_sequencia === newRecord.nr_sequencia) {
              refreshSelectedOrderDetails(selectedOrderRef.current);
            }
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(syncInterval);
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(historyChannel);
    };
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



  // Filtragem dos itens
  const filteredOrders = orders.filter(os => {
    // 1. Filtrar apenas o ano de 2026
    if (!os.dt_ordem_servico) return false;
    const orderDate = new Date(os.dt_ordem_servico);
    if (orderDate.getFullYear() !== 2026) return false;

    // Verificar se a ordem está em triagem
    const situacao = (os.ds_situacao || '').toLowerCase();
    const encer = (os.nm_usuario_encer || '').trim();
    const estagio = (os.ds_estagio || '').trim();
    const estagioLower = estagio.toLowerCase();

    const isFinalizado =
      situacao.includes('finalizada') ||
      situacao.includes('finalizado') ||
      situacao.includes('encerrada') ||
      situacao.includes('concluída') ||
      situacao.includes('concluido') ||
      encer !== '' ||
      estagioLower.includes('encerrad');

    const isTriagem = !isFinalizado && estagio === '';

    // 2. Filtro por Período (ignora se estiver em triagem)
    if (!isTriagem) {
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
  const processoItems = getColumnOrders('processo').sort((a, b) => {
    const dateA = new Date(a.dt_atualizacao || a.updated_at || 0).getTime();
    const dateB = new Date(b.dt_atualizacao || b.updated_at || 0).getTime();
    return dateB - dateA;
  });
  const escalonadoItems = getColumnOrders('escalonado').sort((a, b) => {
    const dateA = new Date(a.dt_atualizacao || a.updated_at || 0).getTime();
    const dateB = new Date(b.dt_atualizacao || b.updated_at || 0).getTime();
    return dateB - dateA;
  });
  const finalizadoItems = getColumnOrders('finalizado').sort((a, b) => {
    const dateA = new Date(a.dt_atualizacao || a.updated_at || 0).getTime();
    const dateB = new Date(b.dt_atualizacao || b.updated_at || 0).getTime();
    return dateB - dateA;
  });

  const getKanbanColumn = (os: OrdemServicoItem): 'triagem' | 'processo' | 'escalonado' | 'finalizado' => {
    const situacao = (os.ds_situacao || '').toLowerCase();
    const encer = (os.nm_usuario_encer || '').trim();
    const estagio = (os.ds_estagio || '').trim();
    const estagioLower = estagio.toLowerCase();

    // 1. Finalizado
    const isFinalizado =
      situacao.includes('finalizada') ||
      situacao.includes('finalizado') ||
      situacao.includes('encerrada') ||
      situacao.includes('concluída') ||
      situacao.includes('concluido') ||
      encer !== '' ||
      estagioLower.includes('encerrad');
    if (isFinalizado) return 'finalizado';

    // 2. Triagem
    const isTriagem = estagio === '';
    if (isTriagem) return 'triagem';

    // 3. Em processo
    const isEmProcesso = estagioLower === 'iniciada' || estagioLower === 'em desenvolvimento';
    if (isEmProcesso) return 'processo';

    // 4. Escalonado
    return 'escalonado';
  };

  // Variáveis para o Modal de Detalhes
  const orderColumn = selectedOrder ? getKanbanColumn(selectedOrder) : 'triagem';
  const orderDtEntrada = selectedOrder 
    ? (orderColumn === 'triagem' ? selectedOrder.dt_ordem_servico : (selectedOrder.dt_atualizacao || selectedOrder.updated_at))
    : null;
  const orderStageLabel = orderColumn === 'triagem' 
    ? 'Triagem' 
    : orderColumn === 'processo' 
      ? 'Processo' 
      : orderColumn === 'escalonado' 
        ? 'Escalonado' 
        : 'Finalizado';

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

  // Formação de data
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo'
    });
  };

  // Formatar texto para o padrão pt-br (Sentence Case) suavizando CAIXA ALTA
  const formatSentenceCase = (text: string | null) => {
    if (!text) return '';
    const trimmed = text.trim();
    if (trimmed === trimmed.toUpperCase()) {
      let lower = trimmed.toLowerCase();
      // Capitaliza a primeira letra de cada frase
      lower = lower.replace(/(^\s*|[.!?]\s+)([a-z])/g, (match, separator, letter) => separator + letter.toUpperCase());
      // Lista de siglas para manter em maiúsculas
      const siglas = ['go', 'hsc', 'pa', 'ti', 'os', 'id', 'ip', 'cpu', 'xml', 'pdf', 'rj', 'sp', 'mg', 'df'];
      siglas.forEach(sigla => {
        const regex = new RegExp(`\\b${sigla}\\b`, 'gi');
        lower = lower.replace(regex, sigla.toUpperCase());
      });
      return lower;
    }
    return trimmed;
  };

  // Formatação de duração amigável
  const formatDuration = (ms: number) => {
    if (ms <= 0) return '0m';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      const remainingHours = hours % 24;
      return `${days}d ${remainingHours}h`;
    }
    if (hours > 0) {
      const remainingMinutes = minutes % 60;
      return `${hours}h ${remainingMinutes}m`;
    }
    return `${minutes}m`;
  };

  // Cálculo das durações por estágio
  const getStageDurations = (logs: any[], currentEstagio: string, dtOrdemServico: string | null) => {
    const durations = {
      triagem: 0,
      processo: 0,
      escalonado: 0,
      total: 0
    };

    if (!logs || logs.length === 0) {
      if (!dtOrdemServico) return durations;
      const start = new Date(dtOrdemServico).getTime();
      const end = new Date().getTime();
      const diff = end - start;
      if (currentEstagio === 'triagem') durations.triagem = diff;
      else if (currentEstagio === 'processo') durations.processo = diff;
      else if (currentEstagio === 'escalonado') durations.escalonado = diff;
      durations.total = diff;
      return durations;
    }

    const now = new Date().getTime();

    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];
      const start = new Date(log.dt_transicao).getTime();
      
      let end = now;
      if (i + 1 < logs.length) {
        end = new Date(logs[i + 1].dt_transicao).getTime();
      } else if (log.estagio_kanban === 'finalizado') {
        end = start;
      }

      const diff = end - start;
      
      if (log.estagio_kanban === 'triagem') {
        durations.triagem += diff;
      } else if (log.estagio_kanban === 'processo') {
        durations.processo += diff;
      } else if (log.estagio_kanban === 'escalonado') {
        durations.escalonado += diff;
      }
    }

    const firstLog = logs[0];
    const lastLog = logs[logs.length - 1];
    const startTotal = new Date(firstLog.dt_transicao).getTime();
    const endTotal = lastLog.estagio_kanban === 'finalizado' 
      ? new Date(lastLog.dt_transicao).getTime() 
      : now;
    durations.total = endTotal - startTotal;

    return durations;
  };

  // Render do Card Kanban
  const renderCard = (os: OrdemServicoItem, columnId: 'triagem' | 'processo' | 'escalonado' | 'finalizado') => {
    const dtEntrada = columnId === 'triagem' 
      ? os.dt_ordem_servico 
      : (os.dt_atualizacao || os.updated_at);

    const stageLabel = columnId === 'triagem' 
      ? 'Triagem' 
      : columnId === 'processo' 
        ? 'Processo' 
        : columnId === 'escalonado' 
          ? 'Escalonado' 
          : 'Finalizado';

    return (
      <div
        key={os.id}
        onClick={() => handleCardClick(os)}
        className="bg-card border border-border/80 rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 flex flex-col gap-3 group cursor-pointer"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-muted-foreground group-hover:text-primary transition-colors">
            OS #{os.nr_sequencia}
          </span>
          {getPriorityBadge(os.ie_prioridade)}
        </div>

        <h3 className="text-sm font-semibold text-foreground leading-snug line-clamp-2 uppercase">
          {os.ds_dano_breve || os.ds_dano || 'Sem descrição'}
        </h3>

        <div className="flex flex-col gap-1.5 text-sm text-foreground/90 mt-1">
          {os.ds_localizacao && (
            <div className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4 shrink-0 text-muted-foreground/80" />
              <span className="truncate">{os.ds_localizacao}</span>
            </div>
          )}
          {os.ds_equipamento && (
            <div className="flex items-center gap-1.5">
              <Cpu className="h-4 w-4 shrink-0 text-muted-foreground/80" />
              <span className="truncate">{os.ds_equipamento}</span>
            </div>
          )}
          {os.nm_solicitante && (
            <div className="flex items-center gap-1.5">
              <User className="h-4 w-4 shrink-0 text-muted-foreground/80" />
              <span className="truncate">{os.nm_solicitante}</span>
            </div>
          )}
          {os.ds_dano && (
            <div className="flex items-start gap-1.5">
              <AlertTriangle className="h-4 w-4 shrink-0 text-muted-foreground/80 mt-0.5" />
              <span className="break-words whitespace-normal" title={os.ds_dano}>{formatSentenceCase(os.ds_dano)}</span>
            </div>
          )}
          {os.nm_executor && (
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-500/5 px-1.5 py-0.5 rounded border border-emerald-500/10 w-fit max-w-full">
              <UserCheck className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Exec: {os.nm_executor}</span>
            </div>
          )}
          {dtEntrada && (
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-sky-700 dark:text-sky-400 bg-sky-500/5 px-2 py-0.5 rounded border border-sky-500/10 w-fit max-w-full" title="Data/Hora de entrada no estágio atual">
              <Clock className="h-3.5 w-3.5 shrink-0 text-sky-500" />
              <span className="truncate">{stageLabel}: {formatDate(dtEntrada)}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border/40 pt-2.5 mt-1 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground/90 dark:text-foreground/95 bg-muted px-2 py-0.5 rounded" title="Data de abertura do chamado">
              <Calendar className="h-3.5 w-3.5 text-foreground/70 dark:text-foreground/80" />
              <span>{formatDate(os.dt_ordem_servico)}</span>
            </div>
            {ordersWithHistory.has(os.nr_sequencia) && (
              <div 
                className="flex items-center gap-0.5 text-sky-600 dark:text-sky-400 bg-sky-500/10 dark:bg-sky-500/5 px-1 py-0.5 rounded font-semibold border border-sky-500/10 shrink-0" 
                title="Possui histórico de relatos"
              >
                <History className="h-3 w-3 shrink-0" />
                <span className="text-[8px] uppercase tracking-wider font-bold">Histórico</span>
              </div>
            )}
          </div>
          {(os.ds_estagio || os.ds_situacao) && (
            <span className="font-semibold uppercase tracking-wider text-[9px] bg-muted px-1.5 py-0.5 rounded">
              {os.ds_estagio || os.ds_situacao}
            </span>
          )}
        </div>
      </div>
    );
  };

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
          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs select-none">
            <span className="text-muted-foreground">
              Acompanhamento das ordens de serviço integradas com o n8n.
            </span>
          </div>
        </div>

        {/* Indicador de Sincronização à direita */}
        {(isBackgroundSyncing || syncError || lastSyncTime) && (
          <div className="flex items-center gap-1.5 select-none shrink-0">
            {isBackgroundSyncing ? (
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 border border-blue-200/40 dark:border-blue-800/40 text-xs">
                <RefreshCcw className="h-3 w-3 animate-spin text-blue-500" />
                <span className="text-blue-600 dark:text-blue-400 font-medium">Sincronizando...</span>
              </div>
            ) : syncError ? (
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-50 dark:bg-red-900/20 border border-red-200/40 dark:border-red-800/40 text-xs">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
                </span>
                <span className="text-red-600 dark:text-red-400 font-medium">Erro na sync</span>
              </div>
            ) : lastSyncTime ? (
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200/40 dark:border-emerald-800/40 text-xs">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                </span>
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                  Sync {formatSyncTime(lastSyncTime)}
                </span>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl animate-in slide-in-from-top duration-300">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      {/* Estatísticas Rápidas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <VisaoGeralCard
          title="Em Triagem"
          value={triagemItems.length}
          icon={Search}
          subtext="🔍 Aguardando análise"
          subtextColorClass="text-slate-500 dark:text-slate-400"
          isLoading={loading}
        />
        <VisaoGeralCard
          title="Em Processo"
          value={processoItems.length}
          icon={Play}
          subtext="⚡ Técnicos em atendimento"
          subtextColorClass="text-sky-600 dark:text-sky-400"
          isLoading={loading}
        />
        <VisaoGeralCard
          title="Escalado / Parado"
          value={escalonadoItems.length}
          icon={AlertTriangle}
          subtext="⚠️ Aguardando peça/terceiro"
          subtextColorClass="text-amber-600 dark:text-amber-400"
          isLoading={loading}
        />
        <VisaoGeralCard
          title="Encerrados"
          value={finalizadoItems.length}
          icon={CheckCircle2}
          subtext="✅ Chamados finalizados"
          subtextColorClass="text-emerald-600 dark:text-emerald-400"
          isLoading={loading}
        />
        <VisaoGeralCard
          title="Total"
          value={filteredOrders.length}
          icon={ClipboardList}
          subtext="📋 Total de ordens no período"
          subtextColorClass="text-primary dark:text-primary/95"
          isLoading={loading}
        />
      </div>

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
                  className={`relative flex items-center justify-center h-10 w-10 rounded-full border overflow-hidden p-0 transition-all duration-200 bg-background ${isSelected
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
                    <div className={`h-full w-full rounded-full flex items-center justify-center text-xs font-bold ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
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
                <h2 className="font-bold text-[16px] text-foreground">Triagem</h2>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/45 transition-colors">
              {triagemItems.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground border border-dashed rounded-lg">
                  Sem chamados na triagem
                </div>
              ) : (
                triagemItems.map(os => renderCard(os, 'triagem'))
              )}
            </div>
          </div>

          {/* Coluna 2: Em Processo */}
          <div className="bg-sky-50/40 dark:bg-sky-950/5 border border-sky-200/40 dark:border-sky-900/10 rounded-xl p-3 flex flex-col h-[calc(100vh-340px)] min-h-[450px]">
            <div className="flex items-center justify-between pb-2 border-b border-border/40 mb-3 shrink-0">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-sky-500 animate-pulse" />
                <h2 className="font-bold text-[16px] text-foreground">Em processo</h2>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/45 transition-colors">
              {processoItems.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground border border-dashed rounded-lg">
                  Sem chamados em processo
                </div>
              ) : (
                processoItems.map(os => renderCard(os, 'processo'))
              )}
            </div>
          </div>

          {/* Coluna 3: Escalonado */}
          <div className="bg-amber-50/30 dark:bg-amber-950/5 border border-amber-200/40 dark:border-amber-900/10 rounded-xl p-3 flex flex-col h-[calc(100vh-340px)] min-h-[450px]">
            <div className="flex items-center justify-between pb-2 border-b border-border/40 mb-3 shrink-0">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-amber-500" />
                <h2 className="font-bold text-[16px] text-foreground">Escalonado</h2>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/45 transition-colors">
              {escalonadoItems.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground border border-dashed rounded-lg">
                  Sem chamados escalonados
                </div>
              ) : (
                escalonadoItems.map(os => renderCard(os, 'escalonado'))
              )}
            </div>
          </div>

          {/* Coluna 4: Finalizado */}
          <div className="bg-emerald-50/20 dark:bg-emerald-950/5 border border-emerald-200/30 dark:border-emerald-900/10 rounded-xl p-3 flex flex-col h-[calc(100vh-340px)] min-h-[450px]">
            <div className="flex items-center justify-between pb-2 border-b border-border/40 mb-3 shrink-0">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <h2 className="font-bold text-[16px] text-foreground">Finalizado</h2>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/45 transition-colors">
              {finalizadoItems.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground border border-dashed rounded-lg">
                  Nenhum chamado finalizado
                </div>
              ) : (
                finalizadoItems.map(os => renderCard(os, 'finalizado'))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalhes da OS */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-card border border-border/80 rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden flex flex-col my-8 animate-in zoom-in-95 duration-200">
            {/* Cabeçalho */}
            <div className="flex items-center justify-between p-4 border-b border-border/40 bg-muted/30">
              <div>
                <span className="text-xs font-bold text-muted-foreground">OS #{selectedOrder.nr_sequencia}</span>
                <h2 className="text-lg font-bold text-foreground line-clamp-1 mt-0.5">
                  {selectedOrder.ds_dano_breve || 'Detalhes da OS'}
                </h2>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Conteúdo */}
            <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh] scrollbar-thin">
              {/* Informações Básicas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-muted/40 border border-border/40 rounded-xl p-3.5 space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Localização & Equipamento</h3>
                  {selectedOrder.ds_localizacao && (
                    <div className="flex items-center gap-2 text-sm text-foreground/90">
                      <MapPin className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                      <span>{selectedOrder.ds_localizacao}</span>
                    </div>
                  )}
                  {selectedOrder.ds_equipamento && (
                    <div className="flex items-center gap-2 text-sm text-foreground/90">
                      <Cpu className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                      <span>{selectedOrder.ds_equipamento}</span>
                    </div>
                  )}
                </div>

                <div className="bg-muted/40 border border-border/40 rounded-xl p-3.5 space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Pessoas Envolvidas</h3>
                  {selectedOrder.nm_solicitante && (
                    <div className="flex items-center gap-2 text-sm text-foreground/90">
                      <User className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                      <span>Solicitante: {selectedOrder.nm_solicitante}</span>
                    </div>
                  )}
                  {selectedOrder.nm_executor && (
                    <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                      <UserCheck className="h-4 w-4 shrink-0" />
                      <span>Executor: {selectedOrder.nm_executor}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Status & Prioridade */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-muted/20 border border-border/40 rounded-xl p-4">
                <div className="flex flex-col">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase">Prioridade</span>
                  <div className="mt-1">{getPriorityBadge(selectedOrder.ie_prioridade)}</div>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase">Estágio</span>
                  <span className="text-sm font-bold text-foreground mt-1 uppercase whitespace-normal break-words leading-tight" title={selectedOrder.ds_estagio || 'Não Iniciada'}>
                    {selectedOrder.ds_estagio || 'Não Iniciada'}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase">Abertura</span>
                  <span className="text-xs text-foreground/80 mt-1.5">
                    {formatDate(selectedOrder.dt_ordem_servico)}
                  </span>
                </div>
                {orderDtEntrada && (
                  <div className="flex flex-col">
                    <span className="text-[10px] font-semibold text-sky-600 dark:text-sky-400 uppercase tracking-wider">{orderStageLabel}</span>
                    <span className="text-xs font-semibold text-foreground/80 mt-1.5">
                      {formatDate(orderDtEntrada)}
                    </span>
                  </div>
                )}
                <div className="flex flex-col">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase">Situação</span>
                  <span className="text-xs font-semibold text-foreground/80 mt-1.5 uppercase whitespace-normal break-words leading-tight" title={selectedOrder.ds_situacao || 'Sem situação'}>
                    {selectedOrder.ds_situacao || 'Sem situação'}
                  </span>
                </div>
              </div>
              {selectedOrder.ds_dano && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Descrição do Dano / Problema
                  </h3>
                  <div className="bg-muted/40 border border-border/40 rounded-xl p-4 text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap break-words">
                    {formatSentenceCase(selectedOrder.ds_dano)}
                  </div>
                </div>
              )}

              {/* Métricas de Permanência por Estágio */}
              {(() => {
                const durations = getStageDurations(stageHistory, selectedOrder.ds_estagio || '', selectedOrder.dt_ordem_servico);
                return (
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-primary" />
                      Tempo de Permanência por Estágio
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {/* Triagem */}
                      <div className="bg-slate-500/5 dark:bg-slate-400/5 border border-slate-500/10 dark:border-slate-400/10 rounded-xl p-3.5 flex flex-col justify-between min-h-[85px] shadow-sm">
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Triagem</span>
                        <span className="text-xl font-black text-slate-800 dark:text-slate-200 mt-1.5">
                          {formatDuration(durations.triagem)}
                        </span>
                      </div>

                      {/* Em Processo */}
                      <div className="bg-sky-500/5 dark:bg-sky-400/5 border border-sky-500/10 dark:border-sky-400/10 rounded-xl p-3.5 flex flex-col justify-between min-h-[85px] shadow-sm">
                        <span className="text-[10px] font-bold text-sky-500 dark:text-sky-400 uppercase tracking-wider">Em Processo</span>
                        <span className="text-xl font-black text-sky-800 dark:text-sky-200 mt-1.5">
                          {formatDuration(durations.processo)}
                        </span>
                      </div>

                      {/* Escalonado */}
                      <div className="bg-amber-500/5 dark:bg-amber-400/5 border border-amber-500/10 dark:border-amber-400/10 rounded-xl p-3.5 flex flex-col justify-between min-h-[85px] shadow-sm">
                        <span className="text-[10px] font-bold text-amber-500 dark:text-amber-400 uppercase tracking-wider">Escalonado</span>
                        <span className="text-xl font-black text-amber-800 dark:text-amber-200 mt-1.5">
                          {formatDuration(durations.escalonado)}
                        </span>
                      </div>

                      {/* Tempo Total */}
                      <div className="bg-emerald-500/5 dark:bg-emerald-400/5 border border-emerald-500/10 dark:border-emerald-400/10 rounded-xl p-3.5 flex flex-col justify-between min-h-[85px] shadow-sm">
                        <span className="text-[10px] font-bold text-emerald-500 dark:text-emerald-400 uppercase tracking-wider">Tempo Total</span>
                        <span className="text-xl font-black text-emerald-800 dark:text-emerald-200 mt-1.5">
                          {formatDuration(durations.total)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Histórico */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <RefreshCcw className="h-4 w-4 text-primary" />
                  Histórico
                </h3>

                {loadingHistory ? (
                  <div className="flex items-center justify-center p-8 gap-2">
                    <RefreshCcw className="h-5 w-5 text-primary animate-spin" />
                    <span className="text-sm text-muted-foreground">Buscando histórico...</span>
                  </div>
                ) : orderHistory.length === 0 ? (
                  <div className="text-center py-6 text-sm text-muted-foreground border border-dashed border-border rounded-xl">
                    Nenhum relato histórico encontrado para esta OS.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {orderHistory.map((hist) => (
                      <div
                        key={hist.id}
                        className="bg-card border border-border/60 rounded-xl p-4 space-y-2 shadow-sm"
                      >
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="font-semibold text-foreground/75">
                            {hist.nm_usuario || 'Sistema'}
                          </span>
                          <span>{formatDate(hist.created_at)}</span>
                        </div>
                        <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed break-words border-t border-border/40 pt-2">
                          {hist.ds_relat_tecnico}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Rodapé */}
            <div className="flex justify-end p-4 border-t border-border/40 bg-muted/30">
              <button
                onClick={() => setSelectedOrder(null)}
                className="bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground font-semibold px-4 py-2 rounded-lg text-sm transition-all border border-border/60"
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


