import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
  AlertTriangle,
  Play,
  X,
  History,
  ClipboardList,
  Clock,
  ArrowLeft,
  Sun,
  Moon,
  ChevronRight
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
  historico_ordem_servico?: { nr_sequencia: number }[] | null;
}

const parseTasyDate = (dateStr: string | null): Date | null => {
  if (!dateStr) return null;
  const normalizedStr = dateStr.replace(/(Z|\+00:00|\+00)$/i, '-03:00');
  return new Date(normalizedStr);
};

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

export default function OrdemServicoMobile() {
  const navigate = useNavigate();
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return document.documentElement.classList.contains('dark');
  });

  const toggleTheme = () => {
    const root = document.documentElement;
    if (root.classList.contains('dark')) {
      root.classList.remove('dark');
      root.classList.add('light');
      setIsDarkMode(false);
    } else {
      root.classList.add('dark');
      root.classList.remove('light');
      setIsDarkMode(true);
    }
  };

  const [orders, setOrders] = useState<OrdemServicoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isBackgroundSyncing, setIsBackgroundSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState(false);

  const formatSyncTime = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<'dia' | 'semana' | 'mes' | 'todas'>('todas');
  const [selectedExecutor, setSelectedExecutor] = useState<string | null>(null);
  
  // Abas Kanban Mobile
  const [activeTab, setActiveTab] = useState<'triagem' | 'processo' | 'escalonado' | 'finalizado'>('triagem');

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

  const [selectedOrder, setSelectedOrder] = useState<OrdemServicoItem | null>(null);
  const [orderHistory, setOrderHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [ordersWithHistory, setOrdersWithHistory] = useState<Set<number>>(new Set());
  const [stageHistory, setStageHistory] = useState<any[]>([]);
  const [loadingStageHistory, setLoadingStageHistory] = useState(false);
  const [stageLogs, setStageLogs] = useState<any[]>([]);

  // Filtragem dos itens
  const filteredOrders = orders.filter(os => {
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
    const isEmProcesso = !isFinalizado && (estagioLower === 'iniciada' || estagioLower === 'em desenvolvimento');
    const isEscalonado = !isFinalizado && !isTriagem && !isEmProcesso;

    // Filtros de Data - ignorados se estiver em triagem ou escalonado
    if (!isTriagem && !isEscalonado) {
      const targetDateStr = isFinalizado 
        ? (os.dt_atualizacao || os.updated_at)
        : (os.dt_atualizacao || os.updated_at || os.dt_ordem_servico);

      if (!targetDateStr) return false;
      const targetDate = parseTasyDate(targetDateStr);
      if (!targetDate) return false;

      if (targetDate.getFullYear() !== 2026) return false;

      const today = new Date();
      if (dateFilter === 'dia') {
        const isToday =
          targetDate.getDate() === today.getDate() &&
          targetDate.getMonth() === today.getMonth() &&
          targetDate.getFullYear() === today.getFullYear();
        if (!isToday) return false;
      } else if (dateFilter === 'semana') {
        const day = today.getDay();
        const diff = today.getDate() - day + (day === 0 ? -6 : 1);
        const startOfWeek = new Date(today);
        startOfWeek.setDate(diff);
        startOfWeek.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        const isInWeek = targetDate >= startOfWeek && targetDate <= endOfWeek;
        if (!isInWeek) return false;
      } else if (dateFilter === 'mes') {
        const isInMonth =
          targetDate.getMonth() === today.getMonth() &&
          targetDate.getFullYear() === today.getFullYear();
        if (!isInMonth) return false;
      }
    }

    if (selectedExecutor) {
      const execName = (os.nm_executor || '').toLowerCase();
      if (!execName.includes(selectedExecutor.toLowerCase())) {
        return false;
      }
    }

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

    return searchString.includes(searchTerm.toLowerCase());
  });

  const handleCardClick = async (os: OrdemServicoItem) => {
    setSelectedOrder(os);
    setOrderHistory([]);
    setStageHistory([]);
    setLoadingHistory(true);
    setLoadingStageHistory(true);
    try {
      const { data: relatoData, error: relatoError } = await supabase
        .from('historico_ordem_servico')
        .select('*')
        .eq('nr_sequencia', os.nr_sequencia)
        .order('created_at', { ascending: false });

      if (relatoError) throw relatoError;
      setOrderHistory(relatoData || []);

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

  const fetchOrders = async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      const { data, error: dbError } = await supabase
        .from('ordem_servico')
        .select('*, historico_ordem_servico(nr_sequencia)')
        .gte('dt_ordem_servico', '2026-01-01T00:00:00Z')
        .lte('dt_ordem_servico', '2026-12-31T23:59:59.999Z')
        .order('dt_ordem_servico', { ascending: false });

      if (dbError) throw dbError;

      if (data) {
        setOrders(data as OrdemServicoItem[]);

        const hasHistorySet = new Set<number>();
        data.forEach((os: any) => {
          if (os.historico_ordem_servico && os.historico_ordem_servico.length > 0) {
            hasHistorySet.add(os.nr_sequencia);
          }
        });
        setOrdersWithHistory(hasHistorySet);

        const orderNums = data.map((os: any) => os.nr_sequencia);
        if (orderNums.length > 0) {
          const { data: logsData, error: logsError } = await supabase
            .from('ordem_servico_estagio_log')
            .select('nr_sequencia, estagio_kanban, dt_transicao')
            .in('nr_sequencia', orderNums)
            .order('dt_transicao', { ascending: true });

          if (!logsError && logsData) {
            setStageLogs(logsData);
          }
        } else {
          setStageLogs([]);
        }
      } else {
        setOrders([]);
        setOrdersWithHistory(new Set());
        setStageLogs([]);
      }
    } catch (err: any) {
      console.error('Erro ao carregar ordens de serviço:', err);
      setError(`Erro ao carregar do banco: ${err?.message || JSON.stringify(err)}`);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const selectedOrderRef = useRef<OrdemServicoItem | null>(null);

  useEffect(() => {
    selectedOrderRef.current = selectedOrder;
  }, [selectedOrder]);

  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const triggerDebouncedFetch = useCallback(() => {
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }
    fetchTimeoutRef.current = setTimeout(() => {
      fetchOrders(true);
    }, 400);
  }, []);

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
      console.error('Erro ao atualizar histórico:', err);
    }
  };

  const runBackgroundSync = async () => {
    if (isBackgroundSyncing) return;
    setIsBackgroundSyncing(true);
    setSyncError(false);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('sync-ordem-servico', {
        method: 'POST',
      });

      if (fnError) throw new Error(fnError.message);
      if (data?.success === false) throw new Error(data.error || 'Falha na sync.');

      setLastSyncTime(new Date());
      fetchOrders(true);
    } catch (err) {
      console.warn('Erro na sync em background:', err);
      setSyncError(true);
    } finally {
      setIsBackgroundSyncing(false);
    }
  };

  useEffect(() => {
    fetchOrders();

    const syncTimeout = setTimeout(() => {
      runBackgroundSync();
    }, 1000);

    const syncInterval = setInterval(() => {
      runBackgroundSync();
    }, 3 * 60 * 1000);

    const ordersChannel = supabase
      .channel('ordem-servico-mobile-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ordem_servico' },
        (payload) => {
          triggerDebouncedFetch();
          if (payload.new && (payload.new as any).nr_sequencia) {
            const updatedOS = payload.new as OrdemServicoItem;
            if (selectedOrderRef.current && selectedOrderRef.current.nr_sequencia === updatedOS.nr_sequencia) {
              setSelectedOrder(updatedOS);
            }
          }
        }
      )
      .subscribe();

    const historyChannel = supabase
      .channel('historico-ordem-servico-mobile-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'historico_ordem_servico' },
        (payload) => {
          triggerDebouncedFetch();
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
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
      clearTimeout(syncTimeout);
      clearInterval(syncInterval);
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(historyChannel);
    };
  }, [triggerDebouncedFetch]);

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
        console.error('Erro ao carregar avatares:', err);
      }
    };
    loadExecutorAvatars();
  }, []);

  // Kanban Columns Distribution
  const getColumnOrders = (columnId: 'triagem' | 'processo' | 'escalonado' | 'finalizado') => {
    return filteredOrders.filter(os => {
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

      if (columnId === 'finalizado') return isFinalizado;
      if (isFinalizado) return false;

      const isTriagem = estagio === '';
      if (columnId === 'triagem') return isTriagem;
      if (isTriagem) return false;

      const isEmProcesso = estagioLower === 'iniciada' || estagioLower === 'em desenvolvimento';
      if (columnId === 'processo') return isEmProcesso;
      if (isEmProcesso) return false;

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

    const isFinalizado =
      situacao.includes('finalizada') ||
      situacao.includes('finalizado') ||
      situacao.includes('encerrada') ||
      situacao.includes('concluída') ||
      situacao.includes('concluido') ||
      encer !== '' ||
      estagioLower.includes('encerrad');
    if (isFinalizado) return 'finalizado';

    const isTriagem = estagio === '';
    if (isTriagem) return 'triagem';

    const isEmProcesso = estagioLower === 'iniciada' || estagioLower === 'em desenvolvimento';
    if (isEmProcesso) return 'processo';

    return 'escalonado';
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return '';
    try {
      const d = typeof date === 'string' ? new Date(date) : date;
      if (!d || isNaN(d.getTime())) return '';
      return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Sao_Paulo'
      }).replace(', ', ' - ');
    } catch (e) {
      return '';
    }
  };

  const formatSentenceCase = (text: string | null) => {
    if (!text) return '';
    const trimmed = text.trim();
    if (trimmed === trimmed.toUpperCase()) {
      let lower = trimmed.toLowerCase();
      lower = lower.replace(/(^\s*|[.!?]\s+)([a-z])/g, (match, separator, letter) => separator + letter.toUpperCase());
      const siglas = ['go', 'hsc', 'pa', 'ti', 'os', 'id', 'ip', 'cpu', 'xml', 'pdf', 'rj', 'sp', 'mg', 'df'];
      siglas.forEach(sigla => {
        const regex = new RegExp(`\\b${sigla}\\b`, 'gi');
        lower = lower.replace(regex, sigla.toUpperCase());
      });
      return lower;
    }
    return trimmed;
  };

  const calculateAverageTriagemTime = (ordersList: OrdemServicoItem[], logs: any[]) => {
    try {
      let totalMs = 0;
      let count = 0;
      const now = new Date().getTime();

      const logsByOrder = new Map<number, any[]>();
      logs.forEach(log => {
        if (!logsByOrder.has(log.nr_sequencia)) {
          logsByOrder.set(log.nr_sequencia, []);
        }
        logsByOrder.get(log.nr_sequencia)!.push(log);
      });

      ordersList.forEach(order => {
        const orderLogs = logsByOrder.get(order.nr_sequencia) || [];
        const triagemLog = orderLogs.find(l => l.estagio_kanban === 'triagem');
        let triagemStart = triagemLog 
          ? new Date(triagemLog.dt_transicao).getTime() 
          : (parseTasyDate(order.dt_ordem_servico)?.getTime() || 0);

        if (!triagemStart || isNaN(triagemStart) || triagemStart === 0) return;

        const nextLog = orderLogs.find(l => 
          l.estagio_kanban !== 'triagem' && 
          new Date(l.dt_transicao).getTime() > triagemStart
        );

        let triagemEnd = nextLog 
          ? new Date(nextLog.dt_transicao).getTime() 
          : now;

        const duration = triagemEnd - triagemStart;
        if (duration > 0) {
          totalMs += duration;
          count++;
        }
      });

      return count > 0 ? totalMs / count : 0;
    } catch (err) {
      return 0;
    }
  };

  const calculateAverageClosedTime = (ordersList: OrdemServicoItem[], logs: any[]) => {
    try {
      const closedOrders = ordersList.filter(os => {
        const situacao = (os.ds_situacao || '').toLowerCase();
        const encer = (os.nm_usuario_encer || '').trim();
        const estagioLower = (os.ds_estagio || '').trim().toLowerCase();
        return (
          situacao.includes('finalizada') ||
          situacao.includes('finalizado') ||
          situacao.includes('encerrada') ||
          situacao.includes('concluída') ||
          situacao.includes('concluido') ||
          encer !== '' ||
          estagioLower.includes('encerrad')
        );
      });

      if (closedOrders.length === 0) return 0;

      let totalMs = 0;
      let count = 0;

      const logsByOrder = new Map<number, any[]>();
      logs.forEach(log => {
        if (!logsByOrder.has(log.nr_sequencia)) {
          logsByOrder.set(log.nr_sequencia, []);
        }
        logsByOrder.get(log.nr_sequencia)!.push(log);
      });

      closedOrders.forEach(order => {
        const orderLogs = logsByOrder.get(order.nr_sequencia) || [];
        if (orderLogs.length === 0) {
          const start = parseTasyDate(order.dt_ordem_servico)?.getTime() || 0;
          const end = parseTasyDate(order.dt_atualizacao || order.updated_at)?.getTime() || 0;
          if (start > 0 && end >= start && !isNaN(start) && !isNaN(end)) {
            totalMs += (end - start);
            count++;
          }
          return;
        }

        const sortedLogs = [...orderLogs].sort(
          (a, b) => new Date(a.dt_transicao).getTime() - new Date(b.dt_transicao).getTime()
        );

        const startTotal = parseTasyDate(order.dt_ordem_servico)?.getTime() || new Date(sortedLogs[0].dt_transicao).getTime();
        const finalizadoLog = sortedLogs.find(l => l.estagio_kanban === 'finalizado');
        const endTotal = finalizadoLog 
          ? new Date(finalizadoLog.dt_transicao).getTime()
          : (parseTasyDate(order.dt_atualizacao || order.updated_at)?.getTime() || new Date(sortedLogs[sortedLogs.length - 1].dt_transicao).getTime());

        if (!startTotal || isNaN(startTotal) || !endTotal || isNaN(endTotal) || endTotal <= startTotal) return;

        const totalDuration = endTotal - startTotal;

        let escalonadoMs = 0;
        for (let i = 0; i < sortedLogs.length; i++) {
          const log = sortedLogs[i];
          if (log.estagio_kanban === 'escalonado') {
            const escalonadoStart = new Date(log.dt_transicao).getTime();
            let escalonadoEnd = endTotal;
            if (i + 1 < sortedLogs.length) {
              escalonadoEnd = new Date(sortedLogs[i + 1].dt_transicao).getTime();
            }
            if (isNaN(escalonadoStart) || isNaN(escalonadoEnd)) continue;
            const escDiff = escalonadoEnd - escalonadoStart;
            if (escDiff > 0) {
              escalonadoMs += escDiff;
            }
          }
        }

        const netDuration = totalDuration - escalonadoMs;
        if (!isNaN(netDuration) && netDuration > 0) {
          totalMs += netDuration;
          count++;
        } else {
          totalMs += Math.max(0, totalDuration);
          count++;
        }
      });

      return count > 0 ? totalMs / count : 0;
    } catch (err) {
      return 0;
    }
  };

  const getStageDurations = (logs: any[], currentEstagio: string, dtOrdemServico: string | null) => {
    const durations = {
      triagem: 0,
      processo: 0,
      escalonado: 0,
      total: 0
    };

    const getLogTime = (logDateStr: string | null): number => {
      if (!logDateStr) return 0;
      const parsed = parseTasyDate(logDateStr);
      return parsed ? parsed.getTime() : new Date(logDateStr).getTime();
    };

    if (!logs || logs.length === 0) {
      if (!dtOrdemServico) return durations;
      const start = getLogTime(dtOrdemServico);
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
      const start = getLogTime(log.dt_transicao);

      let end = now;
      if (i + 1 < logs.length) {
        end = getLogTime(logs[i + 1].dt_transicao);
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
    const startTotal = getLogTime(firstLog.dt_transicao);
    const endTotal = lastLog.estagio_kanban === 'finalizado'
      ? getLogTime(lastLog.dt_transicao)
      : now;
    durations.total = endTotal - startTotal;

    return durations;
  };

  const getPriorityBadge = (iePrioridade: string | null) => {
    const p = (iePrioridade || '').toUpperCase();
    if (p === 'A' || p.includes('ALT')) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">
          Alta
        </span>
      );
    }
    if (p === 'M' || p.includes('MED')) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
          Média
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-500 border border-blue-500/20">
        Baixa
      </span>
    );
  };

  const getBadgeColors = (colId: 'triagem' | 'processo' | 'escalonado' | 'finalizado') => {
    switch (colId) {
      case 'triagem':
        return {
          container: 'text-slate-700 dark:text-slate-400 bg-slate-500/5 border-slate-500/10',
          clock: 'text-slate-500'
        };
      case 'processo':
        return {
          container: 'text-sky-700 dark:text-sky-400 bg-sky-500/5 border-sky-500/10',
          clock: 'text-sky-500'
        };
      case 'escalonado':
        return {
          container: 'text-amber-700 dark:text-amber-400 bg-amber-500/5 border-amber-500/10',
          clock: 'text-amber-500'
        };
      case 'finalizado':
        return {
          container: 'text-emerald-700 dark:text-emerald-400 bg-emerald-500/5 border-emerald-500/10',
          clock: 'text-emerald-500'
        };
    }
  };

  // Render OS Card
  const renderCard = (os: OrdemServicoItem, columnId: 'triagem' | 'processo' | 'escalonado' | 'finalizado') => {
    const dtEntrada = columnId === 'triagem'
      ? parseTasyDate(os.dt_ordem_servico)
      : parseTasyDate(os.dt_atualizacao || os.updated_at);

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
        className="bg-card border border-border/80 rounded-xl p-4 shadow-sm active:bg-muted/30 transition-all duration-200 flex flex-col gap-3 group cursor-pointer"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-muted-foreground">
            OS #{os.nr_sequencia}
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            {getPriorityBadge(os.ie_prioridade)}
          </div>
        </div>

        <h3 className="text-sm font-semibold text-foreground leading-snug line-clamp-2 uppercase">
          {os.ds_dano_breve || os.ds_dano || 'Sem descrição'}
        </h3>

        <div className="flex flex-col gap-1.5 text-xs text-foreground/90 mt-1">
          {os.ds_localizacao && (
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{os.ds_localizacao}</span>
            </div>
          )}
          
          <div className="flex items-center justify-between gap-1.5 w-full">
            {os.ds_equipamento ? (
              <div className="flex items-center gap-1.5 min-w-0">
                <Cpu className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{os.ds_equipamento}</span>
              </div>
            ) : <div />}

            {os.nm_executor && (() => {
              const exec = executors.find(e => e.dbKey.toLowerCase() === os.nm_executor!.trim().toLowerCase());
              const displayName = exec ? exec.displayName : os.nm_executor!;
              const initials = displayName.substring(0, 2).toUpperCase();
              return (
                <div className="shrink-0">
                  {exec?.avatarUrl ? (
                    <img
                      src={exec.avatarUrl}
                      alt={displayName}
                      className="h-7 w-7 rounded-full object-cover border border-emerald-500/30"
                    />
                  ) : (
                    <div className="h-7 w-7 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-[10px] font-bold border border-emerald-500/30">
                      {initials}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {os.nm_solicitante && (
            <div className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">Solic.: {os.nm_solicitante}</span>
            </div>
          )}

          {os.ds_dano && (
            <div className="flex items-start gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-muted-foreground mt-0.5" />
              <span className="break-words line-clamp-2">{formatSentenceCase(os.ds_dano)}</span>
            </div>
          )}

          {dtEntrada && (() => {
            const colors = getBadgeColors(columnId);
            return (
              <div className={`flex items-center gap-1 text-[10px] font-semibold ${colors.container} px-2 py-0.5 rounded border w-fit max-w-full mt-1`}>
                <Clock className={`h-3 w-3 shrink-0 ${colors.clock}`} />
                <span className="truncate">{stageLabel}: {formatDate(dtEntrada)}</span>
              </div>
            );
          })()}
        </div>

        <div className="flex items-center justify-between border-t border-border/40 pt-2.5 mt-1 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1 text-[10px] font-semibold text-foreground/80 bg-muted px-1.5 py-0.5 rounded">
            <Calendar className="h-3 w-3 text-foreground/60" />
            <span>Abertura: {formatDate(parseTasyDate(os.dt_ordem_servico))}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {ordersWithHistory.has(os.nr_sequencia) && (
              <History className="h-3.5 w-3.5 text-sky-500" />
            )}
            {os.ds_estagio && (
              <span className="font-bold uppercase tracking-wider text-[8px] bg-muted px-1 rounded">
                {os.ds_estagio}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  const getActiveList = () => {
    switch (activeTab) {
      case 'triagem': return triagemItems;
      case 'processo': return processoItems;
      case 'escalonado': return escalonadoItems;
      case 'finalizado': return finalizadoItems;
    }
  };

  const activeOrders = getActiveList();
  const sortedExecutors = [...executors].sort((a, b) => a.displayName.localeCompare(b.displayName));
  const avgTriagem = calculateAverageTriagemTime(filteredOrders, stageLogs);
  const avgClosed = calculateAverageClosedTime(filteredOrders, stageLogs);

  // Variable helper for Modal
  const orderColumn = selectedOrder ? getKanbanColumn(selectedOrder) : 'triagem';
  const orderDtEntrada = selectedOrder
    ? (orderColumn === 'triagem'
      ? parseTasyDate(selectedOrder.dt_ordem_servico)
      : parseTasyDate(selectedOrder.dt_atualizacao || selectedOrder.updated_at))
    : null;
  const orderStageLabel = orderColumn === 'triagem'
    ? 'Triagem'
    : orderColumn === 'processo'
      ? 'Processo'
      : orderColumn === 'escalonado'
        ? 'Escalonado'
        : 'Finalizado';

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden text-foreground bg-background transition-all">
      {/* Header Mobile */}
      <header className="px-4 py-3 border-b border-border/40 bg-card/60 backdrop-blur-sm flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground active:scale-95 transition-all flex items-center justify-center shadow-sm"
          >
            <ArrowLeft className="h-4.5 w-4.5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-base font-bold tracking-tight flex items-center gap-1.5">
              <Wrench className="h-4.5 w-4.5 text-primary animate-pulse" />
              <span className="truncate">O.S. Mobile</span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Sync badge compact */}
          {isBackgroundSyncing ? (
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-500/10 text-[9px] font-bold text-blue-500">
              <RefreshCcw className="h-2 w-2 animate-spin" />
              <span>SYNC</span>
            </div>
          ) : lastSyncTime ? (
            <div className="text-[9px] font-semibold text-muted-foreground">
              Sync {formatSyncTime(lastSyncTime)}
            </div>
          ) : null}

          {/* Theme switcher */}
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-md border border-border bg-card text-foreground transition-colors shadow-sm flex items-center justify-center"
          >
            {isDarkMode ? <Sun className="h-3.5 w-3.5 text-amber-500" /> : <Moon className="h-3.5 w-3.5 text-slate-600" />}
          </button>
        </div>
      </header>

      {/* KPI horizontal carrousel */}
      <div className="px-4 pt-3 flex gap-3 overflow-x-auto shrink-0 scrollbar-hide py-1 border-b border-border/20 select-none snap-x">
        {/* KPI: Triagem */}
        <div className="snap-center bg-card border border-border rounded-xl p-3 flex flex-col justify-between min-w-[130px] flex-1 shadow-sm">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase text-muted-foreground">
            <span>Triagem</span>
            <Search className="h-3.5 w-3.5 opacity-60" />
          </div>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-xl font-extrabold">{triagemItems.length}</span>
            {avgTriagem > 0 && (
              <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-slate-500/10 text-slate-500">
                ⏱️{formatDuration(avgTriagem)}
              </span>
            )}
          </div>
        </div>

        {/* KPI: Processo */}
        <div className="snap-center bg-card border border-border rounded-xl p-3 flex flex-col justify-between min-w-[130px] flex-1 shadow-sm">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase text-muted-foreground">
            <span>Processo</span>
            <Play className="h-3.5 w-3.5 text-sky-500 opacity-80" />
          </div>
          <span className="text-xl font-extrabold mt-2">{processoItems.length}</span>
        </div>

        {/* KPI: Escalado */}
        <div className="snap-center bg-card border border-border rounded-xl p-3 flex flex-col justify-between min-w-[130px] flex-1 shadow-sm">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase text-muted-foreground">
            <span>Escalado</span>
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 opacity-80" />
          </div>
          <span className="text-xl font-extrabold mt-2">{escalonadoItems.length}</span>
        </div>

        {/* KPI: Encerrados */}
        <div className="snap-center bg-card border border-border rounded-xl p-3 flex flex-col justify-between min-w-[130px] flex-1 shadow-sm">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase text-muted-foreground">
            <span>Encerrados</span>
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 opacity-80" />
          </div>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-xl font-extrabold">{finalizadoItems.length}</span>
            {avgClosed > 0 && (
              <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-emerald-500/10 text-emerald-500">
                ⏱️{formatDuration(avgClosed)}
              </span>
            )}
          </div>
        </div>

        {/* KPI: Total */}
        <div className="snap-center bg-card border border-border rounded-xl p-3 flex flex-col justify-between min-w-[130px] flex-1 shadow-sm mr-4">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase text-muted-foreground">
            <span>Total</span>
            <ClipboardList className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="text-xl font-extrabold mt-2">{filteredOrders.length}</span>
        </div>
      </div>

      {/* Filters (Search & Selects & Executors Avatars) */}
      <div className="p-4 bg-muted/20 border-b border-border/40 flex flex-col gap-3 shrink-0">
        {/* Search & Select Period in one compact row */}
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar chamado..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-background border border-border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as any)}
            className="py-1.5 px-2 bg-background border border-border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary text-foreground font-semibold shrink-0"
          >
            <option value="todas">Todas</option>
            <option value="dia">Dia</option>
            <option value="semana">Semana</option>
            <option value="mes">Mês</option>
          </select>
        </div>

        {/* Executors avatars row */}
        <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-hide select-none">
          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap shrink-0">
            Executores:
          </span>
          <div className="flex items-center gap-1.5">
            {sortedExecutors.map((exec) => {
              const isSelected = selectedExecutor === exec.dbKey;
              const initials = exec.displayName.substring(0, 2).toUpperCase();
              return (
                <button
                  key={exec.dbKey}
                  onClick={() => setSelectedExecutor(isSelected ? null : exec.dbKey)}
                  className={`relative flex items-center justify-center h-8 w-8 rounded-full border overflow-hidden p-0 transition-all shrink-0 ${
                    isSelected
                      ? 'border-primary ring-2 ring-primary/20 scale-105 shadow-sm'
                      : 'border-border active:scale-95'
                  }`}
                >
                  {exec.avatarUrl ? (
                    <img
                      src={exec.avatarUrl}
                      alt={exec.displayName}
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    <div className={`h-full w-full rounded-full flex items-center justify-center text-[9px] font-bold ${
                      isSelected ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground'
                    }`}>
                      {initials}
                    </div>
                  )}
                  {isSelected && (
                    <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-primary text-[7px] text-primary-foreground font-bold border border-background">
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
            {selectedExecutor && (
              <button
                onClick={() => setSelectedExecutor(null)}
                className="text-[9px] text-primary font-bold underline ml-1.5 whitespace-nowrap"
              >
                Limpar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="px-4 py-2 bg-destructive/10 text-destructive text-xs font-semibold flex items-center gap-2 border-b border-destructive/20 shrink-0">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="truncate">{error}</span>
        </div>
      )}

      {/* Sticky Tab Navigation for Kanban columns */}
      <div className="flex border-b border-border/40 bg-card select-none shrink-0">
        <button
          onClick={() => setActiveTab('triagem')}
          className={`flex-1 py-3 text-center text-xs font-bold transition-all relative border-b-2 ${
            activeTab === 'triagem'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Triagem ({triagemItems.length})
        </button>
        <button
          onClick={() => setActiveTab('processo')}
          className={`flex-1 py-3 text-center text-xs font-bold transition-all relative border-b-2 ${
            activeTab === 'processo'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Processo ({processoItems.length})
        </button>
        <button
          onClick={() => setActiveTab('escalonado')}
          className={`flex-1 py-3 text-center text-xs font-bold transition-all relative border-b-2 ${
            activeTab === 'escalonado'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Escalado ({escalonadoItems.length})
        </button>
        <button
          onClick={() => setActiveTab('finalizado')}
          className={`flex-1 py-3 text-center text-xs font-bold transition-all relative border-b-2 ${
            activeTab === 'finalizado'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Finalizado ({finalizadoItems.length})
        </button>
      </div>

      {/* Active Tab List Container (scrolls independently) */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-muted/5">
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center gap-3">
            <RefreshCcw className="h-7 w-7 text-primary animate-spin" />
            <p className="text-xs text-muted-foreground">Carregando ordens de serviço...</p>
          </div>
        ) : activeOrders.length === 0 ? (
          <div className="py-12 text-center flex flex-col items-center justify-center gap-3 border border-dashed border-border/80 rounded-xl bg-card">
            <ClipboardList className="h-8 w-8 text-muted-foreground/60" />
            <h4 className="text-xs font-bold">Nenhum chamado nesta coluna</h4>
            <p className="text-[11px] text-muted-foreground max-w-[200px]">
              Tente alterar os termos de busca ou filtros de executor/período.
            </p>
          </div>
        ) : (
          <div className="space-y-3 pb-8">
            {activeOrders.map(os => renderCard(os, activeTab))}
          </div>
        )}
      </div>

      {/* Modal / Drawer Fullscreen de Detalhes da OS */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-background overflow-y-auto flex flex-col animate-in slide-in-from-bottom duration-250">
          {/* Header Modal */}
          <header className="px-4 py-3.5 border-b border-border bg-muted/30 sticky top-0 flex items-center justify-between z-10 backdrop-blur-md">
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-muted-foreground uppercase">OS #{selectedOrder.nr_sequencia}</span>
              <h2 className="text-sm font-bold text-foreground truncate mt-0.5">
                {selectedOrder.ds_dano_breve || 'Detalhes da OS'}
              </h2>
            </div>
            <button
              onClick={() => setSelectedOrder(null)}
              className="p-1.5 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground active:scale-90 transition-all flex items-center justify-center"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </header>

          {/* Conteúdo Modal */}
          <div className="flex-1 p-4 space-y-6 pb-12">
            {/* Localização & Equipamento */}
            <div className="bg-card border border-border rounded-xl p-4 space-y-3 shadow-sm">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/30 pb-1">
                Localização & Equipamento
              </h3>
              {selectedOrder.ds_localizacao && (
                <div className="flex items-center gap-2 text-xs">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold">{selectedOrder.ds_localizacao}</span>
                </div>
              )}
              {selectedOrder.ds_equipamento && (
                <div className="flex items-center gap-2 text-xs">
                  <Cpu className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold">{selectedOrder.ds_equipamento}</span>
                </div>
              )}
            </div>

            {/* Pessoas Envolvidas */}
            <div className="bg-card border border-border rounded-xl p-4 space-y-3 shadow-sm">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/30 pb-1">
                Pessoas Envolvidas
              </h3>
              {selectedOrder.nm_solicitante && (
                <div className="flex items-center gap-2 text-xs">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>Solicitante: <strong className="text-foreground">{selectedOrder.nm_solicitante}</strong></span>
                </div>
              )}
              {selectedOrder.nm_executor && (
                <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
                  <UserCheck className="h-4 w-4" />
                  <span>Executor: <strong>{selectedOrder.nm_executor}</strong></span>
                </div>
              )}
            </div>

            {/* Status & Prioridades Grid */}
            <div className="bg-muted/30 border border-border rounded-xl p-4 grid grid-cols-2 gap-y-4 gap-x-2 text-xs">
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-muted-foreground uppercase">Prioridade</span>
                <div className="mt-1">{getPriorityBadge(selectedOrder.ie_prioridade)}</div>
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-muted-foreground uppercase">Estágio</span>
                <span className="font-bold text-foreground mt-1 uppercase whitespace-normal break-words">
                  {selectedOrder.ds_estagio || 'Não Iniciada'}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-muted-foreground uppercase">Abertura</span>
                <span className="text-foreground/80 mt-1">
                  {formatDate(parseTasyDate(selectedOrder.dt_ordem_servico))}
                </span>
              </div>
              {orderDtEntrada && (
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider">{orderStageLabel}</span>
                  <span className="font-semibold text-foreground/80 mt-1">
                    {formatDate(orderDtEntrada)}
                  </span>
                </div>
              )}
              <div className="flex flex-col col-span-2">
                <span className="text-[9px] font-bold text-muted-foreground uppercase">Situação</span>
                <span className="font-semibold text-foreground/80 mt-1 uppercase">
                  {selectedOrder.ds_situacao || 'Sem situação'}
                </span>
              </div>
            </div>

            {/* Descrição do dano */}
            {selectedOrder.ds_dano && (
              <div className="space-y-2">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                  Descrição do Dano / Problema
                </h3>
                <div className="bg-card border border-border rounded-xl p-4 text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap break-words">
                  {formatSentenceCase(selectedOrder.ds_dano)}
                </div>
              </div>
            )}

            {/* Permanência por estágio */}
            {(() => {
              const durations = getStageDurations(stageHistory, selectedOrder.ds_estagio || '', selectedOrder.dt_ordem_servico);
              return (
                <div className="space-y-2">
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-primary" />
                    Tempo por Estágio
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-card border border-border rounded-xl p-3 flex flex-col justify-between shadow-sm">
                      <span className="text-[9px] font-bold text-slate-500 uppercase">Triagem</span>
                      <span className="text-base font-black text-foreground mt-1">
                        {formatDuration(durations.triagem)}
                      </span>
                    </div>
                    <div className="bg-card border border-border rounded-xl p-3 flex flex-col justify-between shadow-sm">
                      <span className="text-[9px] font-bold text-sky-500 uppercase">Em Processo</span>
                      <span className="text-base font-black text-foreground mt-1">
                        {formatDuration(durations.processo)}
                      </span>
                    </div>
                    <div className="bg-card border border-border rounded-xl p-3 flex flex-col justify-between shadow-sm">
                      <span className="text-[9px] font-bold text-amber-500 uppercase">Escalonado</span>
                      <span className="text-base font-black text-foreground mt-1">
                        {formatDuration(durations.escalonado)}
                      </span>
                    </div>
                    <div className="bg-card border border-border rounded-xl p-3 flex flex-col justify-between shadow-sm">
                      <span className="text-[9px] font-bold text-emerald-500 uppercase">Tempo Total</span>
                      <span className="text-base font-black text-foreground mt-1">
                        {formatDuration(durations.total)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Relatórios Históricos */}
            <div className="space-y-3">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <History className="h-3.5 w-3.5 text-primary" />
                Histórico de Relatos
              </h3>

              {loadingHistory ? (
                <div className="flex items-center justify-center p-6 gap-2 text-xs">
                  <RefreshCcw className="h-4 w-4 text-primary animate-spin" />
                  <span className="text-muted-foreground">Carregando relatos...</span>
                </div>
              ) : orderHistory.length === 0 ? (
                <div className="text-center py-6 text-xs text-muted-foreground border border-dashed border-border rounded-xl bg-card">
                  Nenhum relato histórico encontrado.
                </div>
              ) : (
                <div className="space-y-3">
                  {orderHistory.map((hist) => (
                    <div
                      key={hist.id}
                      className="bg-card border border-border/80 rounded-xl p-4 space-y-2 shadow-sm text-xs"
                    >
                      <div className="flex items-center justify-between text-muted-foreground text-[10px] pb-1 border-b border-border/20">
                        <span className="font-semibold text-foreground/80">
                          {hist.nm_usuario || 'Sistema'}
                        </span>
                        <span>{formatDate(hist.created_at)}</span>
                      </div>
                      <p className="text-foreground/90 whitespace-pre-wrap leading-relaxed break-words pt-1">
                        {hist.ds_relat_tecnico}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer Modal */}
          <footer className="p-4 border-t border-border bg-card sticky bottom-0 flex justify-end z-10">
            <button
              onClick={() => setSelectedOrder(null)}
              className="bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground font-semibold px-5 py-2.5 rounded-xl text-xs active:scale-95 transition-all border border-border/60"
            >
              Fechar Detalhes
            </button>
          </footer>
        </div>
      )}
    </div>
  );
}
