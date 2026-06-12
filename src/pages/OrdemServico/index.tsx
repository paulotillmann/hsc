import React, { useState, useEffect } from 'react';
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
  Tag,
  AlertTriangle,
  Play,
  ArrowUpRight,
  CheckCircle,
  X,
  History,
  ClipboardList,
  Clock,
  ArrowLeft,
  Sun,
  Moon
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
  historico_ordem_servico?: { nr_sequencia: number }[] | null;
}

// Converte a data do Tasy (que vem com 'Z' ou offset de UTC mas está no fuso de Brasília)
// para um objeto Date correto interpretando-a no fuso de Brasília (UTC-3).
const parseTasyDate = (dateStr: string | null): Date | null => {
  if (!dateStr) return null;
  // Substitui o sufixo 'Z', '+00:00' ou '+00' por '-03:00' para forçar a interpretação como horário de Brasília
  const normalizedStr = dateStr.replace(/(Z|\+00:00|\+00)$/i, '-03:00');
  return new Date(normalizedStr);
};

// Formatação de duração amigável no escopo do módulo para evitar temporal dead zone (TDZ)
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

export default function OrdemServico() {
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
  const [stageLogs, setStageLogs] = useState<any[]>([]);

  // Filtragem dos itens (declarada acima dos hooks para evitar TDZ na avaliação de dependências)
  const filteredOrders = orders.filter(os => {
    // Verificar se a ordem está em triagem ou finalizada
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

    // Filtros de Data (ano e período) - ignorados se a OS estiver em triagem ou escalonada
    if (!isTriagem && !isEscalonado) {
      // Define a data alvo baseada no contexto (conclusão/atualização para resolvidos/em andamento)
      const targetDateStr = isFinalizado 
        ? (os.dt_atualizacao || os.updated_at)
        : (os.dt_atualizacao || os.updated_at || os.dt_ordem_servico);

      if (!targetDateStr) return false;
      const targetDate = parseTasyDate(targetDateStr);
      if (!targetDate) return false;

      // 1. Filtrar pelo ano de 2026
      if (targetDate.getFullYear() !== 2026) return false;

      // 2. Filtro por Período
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

        // Mapeia de forma extremamente rápida quais OS possuem histórico
        const hasHistorySet = new Set<number>();
        data.forEach((os: any) => {
          if (os.historico_ordem_servico && os.historico_ordem_servico.length > 0) {
            hasHistorySet.add(os.nr_sequencia);
          }
        });
        setOrdersWithHistory(hasHistorySet);

        // Buscar logs de estágio em lote para os chamados carregados
        const orderNums = data.map((os: any) => os.nr_sequencia);
        if (orderNums.length > 0) {
          const { data: logsData, error: logsError } = await supabase
            .from('ordem_servico_estagio_log')
            .select('nr_sequencia, estagio_kanban, dt_transicao')
            .in('nr_sequencia', orderNums)
            .order('dt_transicao', { ascending: true });

          if (!logsError && logsData) {
            setStageLogs(logsData);
          } else if (logsError) {
            console.error('Erro ao buscar logs de estágio:', logsError);
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
      const isAbortError = err?.name === 'AbortError' || err?.message?.includes('Lock broken');
      if (!isAbortError) {
        setError(`Erro ao carregar as ordens de serviço do banco de dados: ${err?.message || err?.details || JSON.stringify(err)}`);
      } else {
        console.warn('[FetchOrders] Consulta ao banco abortada por concorrência de locks. Novo carregamento ocorrerá automaticamente.');
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  // Referência para manter a OS selecionada atualizada no escopo das inscrições do Realtime
  const selectedOrderRef = React.useRef<OrdemServicoItem | null>(null);

  useEffect(() => {
    selectedOrderRef.current = selectedOrder;
  }, [selectedOrder]);

  // Debounce para fetchOrders para evitar chamadas múltiplas simultâneas em eventos de sincronização em lote
  const fetchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const triggerDebouncedFetch = React.useCallback(() => {
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }
    fetchTimeoutRef.current = setTimeout(() => {
      fetchOrders(true);
    }, 400); // 400ms de inatividade do Realtime
  }, []);

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
      fetchOrders(true);
    } catch (err) {
      console.warn('[Background Sync] Erro na sincronização em background:', err);
      setSyncError(true);
    } finally {
      setIsBackgroundSyncing(false);
    }
  };

  useEffect(() => {
    // Carrega dados iniciais do banco
    fetchOrders();

    // Atrasamos o início do sync inicial em background por 1 segundo
    // para evitar concorrência no IndexedDB durante a renovação do token
    const syncTimeout = setTimeout(() => {
      runBackgroundSync();
    }, 1000);

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
          triggerDebouncedFetch();

          // Se a OS modificada for a selecionada, atualiza seus dados no modal
          if (payload.new && (payload.new as any).nr_sequencia) {
            const updatedOS = payload.new as OrdemServicoItem;
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
          triggerDebouncedFetch();

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
        console.error('Erro ao carregar avatares dos executores:', err);
      }
    };

    loadExecutorAvatars();
  }, []);

  // Efeito para imprimir no console do navegador a auditoria detalhada dos tempos médios (completamente seguro contra exceções de RangeError)
  useEffect(() => {
    try {
      if (loading || filteredOrders.length === 0) return;

      const safeLocaleString = (val: any) => {
        if (!val) return 'N/A';
        const d = new Date(val);
        if (isNaN(d.getTime())) return 'Data Inválida';
        return d.toLocaleString('pt-BR');
      };

      console.group(`[Auditoria de Médias] Filtro de Período: ${dateFilter}`);

      // 1. Triagem
      const now = new Date().getTime();
      const logsByOrder = new Map<number, any[]>();
      stageLogs.forEach(log => {
        if (!logsByOrder.has(log.nr_sequencia)) {
          logsByOrder.set(log.nr_sequencia, []);
        }
        logsByOrder.get(log.nr_sequencia)!.push(log);
      });

      let totalTriagemMs = 0;
      let countTriagem = 0;
      const triagemDetails: any[] = [];

      filteredOrders.forEach(order => {
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

        if (!triagemEnd || isNaN(triagemEnd)) return;

        const duration = triagemEnd - triagemStart;
        if (duration > 0) {
          totalTriagemMs += duration;
          countTriagem++;
          triagemDetails.push({
            'OS #': order.nr_sequencia,
            'Início Triagem': triagemLog ? safeLocaleString(triagemLog.dt_transicao) : safeLocaleString(triagemStart) + ' (Abertura)',
            'Fim Triagem': nextLog ? safeLocaleString(nextLog.dt_transicao) : 'Ainda em Triagem (Até agora)',
            'Duração': formatDuration(duration)
          });
        }
      });

      console.log(`%cTempo Médio em Triagem: ${formatDuration(countTriagem > 0 ? totalTriagemMs / countTriagem : 0)} (Baseado em ${countTriagem} ordens)`, 'color: #3b82f6; font-weight: bold;');
      if (triagemDetails.length > 0) {
        console.table(triagemDetails);
      }

      // 2. Encerrados
      const closedOrders = filteredOrders.filter(os => {
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

      let totalClosedMs = 0;
      let countClosed = 0;
      const closedDetails: any[] = [];

      closedOrders.forEach(order => {
        const orderLogs = logsByOrder.get(order.nr_sequencia) || [];
        if (orderLogs.length === 0) {
          const start = parseTasyDate(order.dt_ordem_servico)?.getTime() || 0;
          const end = parseTasyDate(order.dt_atualizacao || order.updated_at)?.getTime() || 0;
          if (start > 0 && end >= start && !isNaN(start) && !isNaN(end)) {
            const duration = end - start;
            totalClosedMs += duration;
            countClosed++;
            closedDetails.push({
              'OS #': order.nr_sequencia,
              'Abertura': safeLocaleString(start),
              'Encerramento': safeLocaleString(end),
              'Tempo Bruto': formatDuration(duration),
              'Tempo Escalonado': '0m (Sem logs)',
              'Tempo Líquido': formatDuration(duration)
            });
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
          totalClosedMs += netDuration;
          countClosed++;
          closedDetails.push({
            'OS #': order.nr_sequencia,
            'Abertura': safeLocaleString(startTotal),
            'Encerramento': safeLocaleString(endTotal),
            'Tempo Bruto': formatDuration(totalDuration),
            'Tempo Escalonado': formatDuration(escalonadoMs),
            'Tempo Líquido': formatDuration(netDuration)
          });
        } else {
          const fallback = Math.max(0, totalDuration);
          totalClosedMs += fallback;
          countClosed++;
          closedDetails.push({
            'OS #': order.nr_sequencia,
            'Abertura': safeLocaleString(startTotal),
            'Encerramento': safeLocaleString(endTotal),
            'Tempo Bruto': formatDuration(totalDuration),
            'Tempo Escalonado': 'N/A (Líquido <= 0)',
            'Tempo Líquido': formatDuration(fallback)
          });
        }
      });

      console.log(`%cTempo Médio de Resolução (Líquido): ${formatDuration(countClosed > 0 ? totalClosedMs / countClosed : 0)} (Baseado em ${countClosed} ordens)`, 'color: #10b981; font-weight: bold;');
      if (closedDetails.length > 0) {
        console.table(closedDetails);
      }

      console.groupEnd();
    } catch (err) {
      console.error('Erro na auditoria de médias:', err);
    }
  }, [loading, filteredOrders, stageLogs, dateFilter]);

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

  // Formação de data (segura contra erros de RangeError com datas inválidas)
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
      console.error('Erro ao formatar data:', e);
      return '';
    }
  };

  // Variáveis para o Modal de Detalhes
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

  // Cálculo do tempo médio em Triagem (seguro contra valores NaN)
  const calculateAverageTriagemTime = (ordersList: OrdemServicoItem[], logs: any[]) => {
    try {
      let totalMs = 0;
      let count = 0;
      const now = new Date().getTime();

      // Mapear logs por nr_sequencia para busca rápida
      const logsByOrder = new Map<number, any[]>();
      logs.forEach(log => {
        if (!logsByOrder.has(log.nr_sequencia)) {
          logsByOrder.set(log.nr_sequencia, []);
        }
        logsByOrder.get(log.nr_sequencia)!.push(log);
      });

      ordersList.forEach(order => {
        const orderLogs = logsByOrder.get(order.nr_sequencia) || [];
        
        // Encontrar a primeira transição para 'triagem'
        const triagemLog = orderLogs.find(l => l.estagio_kanban === 'triagem');
        let triagemStart = triagemLog 
          ? new Date(triagemLog.dt_transicao).getTime() 
          : (parseTasyDate(order.dt_ordem_servico)?.getTime() || 0);

        if (!triagemStart || isNaN(triagemStart) || triagemStart === 0) return;

        // O estágio de triagem termina quando há qualquer transição subsequente no log
        const nextLog = orderLogs.find(l => 
          l.estagio_kanban !== 'triagem' && 
          new Date(l.dt_transicao).getTime() > triagemStart
        );

        let triagemEnd = nextLog 
          ? new Date(nextLog.dt_transicao).getTime() 
          : now; // Se não houver transição subsequente, ainda está na triagem (calculamos até agora)

        if (!triagemEnd || isNaN(triagemEnd)) return;

        const duration = triagemEnd - triagemStart;
        if (duration > 0) {
          totalMs += duration;
          count++;
        }
      });

      return count > 0 ? totalMs / count : 0;
    } catch (err) {
      console.error('Erro em calculateAverageTriagemTime:', err);
      return 0;
    }
  };

  // Cálculo do tempo médio total líquido dos encerrados (seguro contra valores NaN e excluindo tempo escalonado)
  const calculateAverageClosedTime = (ordersList: OrdemServicoItem[], logs: any[]) => {
    try {
      // Filtrar ordens finalizadas
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
          // Se não houver logs de estágio, faz um cálculo básico usando dt_ordem_servico e dt_atualizacao
          const start = parseTasyDate(order.dt_ordem_servico)?.getTime() || 0;
          const end = parseTasyDate(order.dt_atualizacao || order.updated_at)?.getTime() || 0;
          if (start > 0 && end >= start && !isNaN(start) && !isNaN(end)) {
            totalMs += (end - start);
            count++;
          }
          return;
        }

        // Ordenar logs cronologicamente
        const sortedLogs = [...orderLogs].sort(
          (a, b) => new Date(a.dt_transicao).getTime() - new Date(b.dt_transicao).getTime()
        );

        // Data de abertura: primeiro log ou dt_ordem_servico
        const startTotal = parseTasyDate(order.dt_ordem_servico)?.getTime() || new Date(sortedLogs[0].dt_transicao).getTime();

        // Data de encerramento: log 'finalizado' ou última transição
        const finalizadoLog = sortedLogs.find(l => l.estagio_kanban === 'finalizado');
        const endTotal = finalizadoLog 
          ? new Date(finalizadoLog.dt_transicao).getTime()
          : (parseTasyDate(order.dt_atualizacao || order.updated_at)?.getTime() || new Date(sortedLogs[sortedLogs.length - 1].dt_transicao).getTime());

        if (!startTotal || isNaN(startTotal) || !endTotal || isNaN(endTotal) || endTotal <= startTotal) return;

        const totalDuration = endTotal - startTotal;

        // Calcular o tempo gasto no estágio 'escalonado'
        let escalonadoMs = 0;
        for (let i = 0; i < sortedLogs.length; i++) {
          const log = sortedLogs[i];
          if (log.estagio_kanban === 'escalonado') {
            const escalonadoStart = new Date(log.dt_transicao).getTime();
            // O estágio escalonado termina na próxima transição ou, se for a última, no encerramento
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
      console.error('Erro em calculateAverageClosedTime:', err);
      return 0;
    }
  };

  // Cálculo das durações por estágio
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

  // Render do Card Kanban
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

    return (
      <div
        key={os.id}
        onClick={() => handleCardClick(os)}
        className="bg-card border border-border/80 rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 flex flex-col gap-3 group cursor-pointer"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-bold text-muted-foreground group-hover:text-primary transition-colors truncate">
            OS #{os.nr_sequencia}
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            {getPriorityBadge(os.ie_prioridade)}
          </div>
        </div>

        <h3 className="text-sm font-semibold text-foreground leading-snug line-clamp-2 uppercase">
          {os.ds_dano_breve || os.ds_dano || 'Sem descrição'}
        </h3>

        <div className="flex flex-col gap-1.5 text-sm text-foreground/90 mt-1">
          {(os.ds_localizacao || os.nm_executor) && (
            <div className="flex items-center justify-between gap-1.5 w-full">
              {os.ds_localizacao ? (
                <div className="flex items-center gap-1.5 min-w-0">
                  <MapPin className="h-4 w-4 shrink-0 text-muted-foreground/80" />
                  <span className="truncate">{os.ds_localizacao}</span>
                </div>
              ) : (
                <div />
              )}
              {os.nm_executor && (() => {
                const exec = executors.find(e => e.dbKey.toLowerCase() === os.nm_executor.trim().toLowerCase());
                const displayName = exec ? exec.displayName : os.nm_executor;
                const fullName = exec ? exec.fullName : os.nm_executor;
                const avatarUrl = exec ? exec.avatarUrl : null;
                const initials = displayName.substring(0, 2).toUpperCase();

                return (
                  <div className="shrink-0" title={`Executor: ${fullName}`}>
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={displayName}
                        className="h-9 w-9 rounded-full object-cover border border-emerald-500/30 dark:border-emerald-500/40 shadow-sm"
                      />
                    ) : (
                      <div className="h-9 w-9 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-sm font-bold border border-emerald-500/30 dark:border-emerald-500/40 shadow-sm">
                        {initials}
                      </div>
                    )}
                  </div>
                );
              })()}
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
          {dtEntrada && (() => {
            const colors = getBadgeColors(columnId);
            return (
              <div className={`flex items-center gap-1.5 text-[11px] font-semibold ${colors.container} px-2 py-0.5 rounded border w-fit max-w-full`} title="Data/Hora de entrada no estágio atual">
                <Clock className={`h-3.5 w-3.5 shrink-0 ${colors.clock}`} />
                <span className="truncate">{stageLabel}: {formatDate(dtEntrada)}</span>
              </div>
            );
          })()}
        </div>

        <div className="flex items-center justify-between border-t border-border/40 pt-2.5 mt-1 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground/90 dark:text-foreground/95 bg-muted px-2 py-0.5 rounded" title="Data de abertura do chamado">
            <Calendar className="h-3.5 w-3.5 text-foreground/70 dark:text-foreground/80" />
            <span>{formatDate(parseTasyDate(os.dt_ordem_servico))}</span>
          </div>
          {(os.ds_estagio || os.ds_situacao) && (
            <div className="flex items-center gap-1.5 shrink-0">
              {ordersWithHistory.has(os.nr_sequencia) && (
                <span title="Possui histórico de relatos" className="inline-flex shrink-0">
                  <History
                    className="h-4 w-4 text-sky-500 dark:text-sky-400 shrink-0"
                  />
                </span>
              )}
              <span className="font-semibold uppercase tracking-wider text-[9px] bg-muted px-1.5 py-0.5 rounded">
                {os.ds_estagio || os.ds_situacao}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Ordenar os executores em ordem alfabética pelo nome de exibição
  const sortedExecutors = [...executors].sort((a, b) => a.displayName.localeCompare(b.displayName));

  const avgTriagem = calculateAverageTriagemTime(filteredOrders, stageLogs);
  const avgClosed = calculateAverageClosedTime(filteredOrders, stageLogs);

  return (
    <div className="h-screen w-full flex flex-col p-4 overflow-hidden text-foreground bg-background transition-all gap-4">
      <div className="flex flex-col gap-3 pb-3 border-b border-border/40">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={() => navigate(-1)}
                className="p-1.5 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-all shrink-0 flex items-center justify-center shadow-sm"
                title="Voltar"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <Wrench className="h-7 w-7 text-primary animate-pulse shrink-0" />
                <span className="truncate">Ordem de Serviço</span>
              </h1>

              {/* Indicador de Sincronização e Alternador de Tema agrupados */}
              <div className="flex items-center gap-2 shrink-0 select-none">
                {(isBackgroundSyncing || syncError || lastSyncTime) && (
                  <>
                    {isBackgroundSyncing ? (
                      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/10 border border-blue-200/30 dark:border-blue-800/30 text-[10px] animate-in fade-in duration-200">
                        <RefreshCcw className="h-2.5 w-2.5 animate-spin text-blue-500" />
                        <span className="text-blue-600 dark:text-blue-400 font-semibold uppercase tracking-wider">Sincronizando...</span>
                      </div>
                    ) : syncError ? (
                      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-red-50 dark:bg-red-900/10 border border-red-200/30 dark:border-red-800/30 text-[10px] animate-in fade-in duration-200">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
                        </span>
                        <span className="text-red-600 dark:text-red-400 font-semibold uppercase tracking-wider">Erro na sync</span>
                      </div>
                    ) : lastSyncTime ? (
                      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200/30 dark:border-emerald-800/30 text-[10px] animate-in fade-in duration-200" title={`Última sincronização: ${formatSyncTime(lastSyncTime)}`}>
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                        </span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wider">
                          Sync {formatSyncTime(lastSyncTime)}
                        </span>
                      </div>
                    ) : null}
                  </>
                )}

                {/* Alternador de Tema ao lado do Sync */}
                <button
                  onClick={toggleTheme}
                  className="p-1 rounded-md border border-border bg-card hover:bg-muted text-foreground transition-colors shadow-sm flex items-center justify-center h-[22px] w-[22px]"
                  title="Alternar Tema"
                >
                  {isDarkMode ? <Sun className="h-3 w-3 text-amber-500" /> : <Moon className="h-3 w-3 text-slate-600" />}
                </button>
              </div>
            </div>
          </div>

          {/* Filtros da página ao lado do título */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
            {/* Avatares dos Executores */}
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap bg-muted/40 border border-border/60 px-2.5 py-1 rounded-xl">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider pl-0.5 select-none">Executores:</span>
              <div className="flex items-center gap-1.5">
                {sortedExecutors.map((exec) => {
                  const isSelected = selectedExecutor === exec.dbKey;
                  const initials = exec.displayName.substring(0, 2).toUpperCase();
                  return (
                    <button
                      key={exec.dbKey}
                      onClick={() => setSelectedExecutor(isSelected ? null : exec.dbKey)}
                      title={exec.fullName}
                      className={`relative flex items-center justify-center h-9 w-9 rounded-full border overflow-hidden p-0 transition-all duration-200 bg-background shrink-0 ${isSelected
                        ? 'border-primary ring-2 ring-primary/25 scale-105 shadow-sm'
                        : 'border-border hover:border-muted-foreground/50 hover:scale-105'
                        }`}
                    >
                      {exec.avatarUrl ? (
                        <img
                          src={exec.avatarUrl}
                          alt={exec.displayName}
                          className="h-full w-full rounded-full object-cover"
                        />
                      ) : (
                        <div className={`h-full w-full rounded-full flex items-center justify-center text-[10px] font-bold ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                          }`}>
                          {initials}
                        </div>
                      )}
                      {isSelected && (
                        <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[8px] text-primary-foreground font-bold border border-background shadow-sm">
                          ✓
                        </span>
                      )}
                    </button>
                  );
                })}

                {selectedExecutor && (
                  <button
                    onClick={() => setSelectedExecutor(null)}
                    className="text-[10px] text-muted-foreground hover:text-foreground font-semibold underline ml-1 whitespace-nowrap animate-in fade-in duration-200"
                  >
                    Limpar
                  </button>
                )}
              </div>
            </div>

            {/* Busca e Período */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-48 lg:w-56">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Buscar chamado..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-muted/40 border border-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-foreground placeholder:text-muted-foreground"
                />
              </div>

              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as any)}
                className="py-1.5 px-2.5 bg-muted/40 border border-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground font-semibold cursor-pointer shrink-0"
              >
                <option value="todas" className="bg-card text-foreground">Todas</option>
                <option value="dia" className="bg-card text-foreground">Dia</option>
                <option value="semana" className="bg-card text-foreground">Semana</option>
                <option value="mes" className="bg-card text-foreground">Mês</option>
              </select>
            </div>
          </div>
        </div>
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
          extraHeader={
            avgTriagem > 0 && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">
                ⏱️ Méd: {formatDuration(avgTriagem)}
              </span>
            )
          }
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
          extraHeader={
            avgClosed > 0 && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                ⏱️ Méd: {formatDuration(avgClosed)}
              </span>
            )
          }
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



      {/* Layout Kanban */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <RefreshCcw className="h-8 w-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Carregando ordens de serviço...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="flex-1 bg-card border border-border/80 shadow-sm rounded-xl p-8 text-center flex flex-col items-center justify-center gap-4">
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
        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pb-2">
          {/* Coluna 1: Triagem */}
          <div className="bg-slate-50 dark:bg-slate-900/30 border border-slate-200/60 dark:border-slate-800/40 rounded-xl p-3 flex flex-col h-full min-h-0">
            <div className="flex items-center justify-between pb-2 border-b border-border/40 mb-3 shrink-0">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-slate-400" />
                <h2 className="font-bold text-[16px] text-foreground">Triagem</h2>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar transition-colors">
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
          <div className="bg-sky-50/40 dark:bg-sky-950/5 border border-sky-200/40 dark:border-sky-900/10 rounded-xl p-3 flex flex-col h-full min-h-0">
            <div className="flex items-center justify-between pb-2 border-b border-border/40 mb-3 shrink-0">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-sky-500 animate-pulse" />
                <h2 className="font-bold text-[16px] text-foreground">Em processo</h2>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar transition-colors">
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
          <div className="bg-amber-50/30 dark:bg-amber-950/5 border border-amber-200/40 dark:border-amber-900/10 rounded-xl p-3 flex flex-col h-full min-h-0">
            <div className="flex items-center justify-between pb-2 border-b border-border/40 mb-3 shrink-0">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-amber-500" />
                <h2 className="font-bold text-[16px] text-foreground">Escalonado</h2>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar transition-colors">
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
          <div className="bg-emerald-50/20 dark:bg-emerald-950/5 border border-emerald-200/30 dark:border-emerald-900/10 rounded-xl p-3 flex flex-col h-full min-h-0">
            <div className="flex items-center justify-between pb-2 border-b border-border/40 mb-3 shrink-0">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <h2 className="font-bold text-[16px] text-foreground">Finalizado</h2>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar transition-colors">
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
            <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh] custom-scrollbar">
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
                    {formatDate(parseTasyDate(selectedOrder.dt_ordem_servico))}
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


