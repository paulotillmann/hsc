import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Activity, Search, Loader2, RefreshCcw, Calendar, ChevronDown,
  User, Stethoscope, SlidersHorizontal, CheckCircle2,
  Clock, ShieldAlert, ChevronLeft, ChevronRight, LayoutGrid, List, Info, AlertTriangle, AlertCircle
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface EventoHistorico {
  evento: string;
  dt_registro: string;
  dt_evento: string;
}

interface Cirurgia {
  id: string;
  nr_atendimento: number | null;
  nm_paciente: string | null;
  ds_sexo: string | null;
  idade: number | null;
  nr_cirurgia: number;
  medico: string | null;
  procedimento: string | null;
  dt_agenda: string | null;
  nm_anestesista: string | null;
  ds_carater: string | null;
  sala: string | null;
  evento: string | null;
  dt_registro: string | null;
  circulante: string | null;
  enfermeiro: string | null;
  setor_origem: string | null;
  precaucao: string | null;
  alergia: string | null;
  historico_eventos_cirurgia?: EventoHistorico[];
}

// Constante com os 6 eventos cirúrgicos possíveis na ordem cronológica
const EVENTOS_FLUXO = [
  'Entrada do paciente em Sala Cirúrgica',
  'Início da Anestesia',
  'Início da Cirurgia/Procedimento',
  'Término Cirurgia/Procedimento',
  'Término da Anestesia',
  'Entrada em Recuperação Anestésica'
];

// Helper para verificar se o evento pertence ao fluxo do PPP
const isEventoPPP = (evento: string | null): boolean => {
  if (!evento) return false;
  const evtLower = evento.toLowerCase();
  return evtLower.includes('parto') || evtLower.includes('origem');
};

// Helper para verificar se a cirurgia está ativa em sala (entrou na sala mas ainda não entrou na RPA ou não retornou à origem)
const isCirurgiaAtiva = (evento: string | null): boolean => {
  if (!evento) return false;
  const evtLower = evento.toLowerCase().trim();

  if (isEventoPPP(evento)) {
    // No PPP, está ativo se for qualquer evento do parto que não seja o retorno
    return !evtLower.includes('retorno') && !evtLower.includes('origem');
  }

  return EVENTOS_FLUXO.slice(0, 5).some(e => e.toLowerCase() === evtLower);
};

// Helper para calcular o tempo de duração da cirurgia desde a entrada em sala cirúrgica
const getDuracaoCirurgia = (c: Cirurgia, now: Date): string => {
  const eventoEntrada = c.historico_eventos_cirurgia?.find(h => {
    const name = h.evento.toLowerCase();
    return name.includes('entrada') && name.includes('sala') && name.includes('cirurg');
  });

  let dataReferenciaStr = eventoEntrada?.dt_registro;
  if (!dataReferenciaStr && c.historico_eventos_cirurgia && c.historico_eventos_cirurgia.length > 0) {
    const ordenado = [...c.historico_eventos_cirurgia].sort(
      (a, b) => new Date(a.dt_registro).getTime() - new Date(b.dt_registro).getTime()
    );
    dataReferenciaStr = ordenado[0].dt_registro;
  }

  if (!dataReferenciaStr) {
    dataReferenciaStr = c.dt_registro;
  }

  if (!dataReferenciaStr) return '00:00';

  // Força a data a ser lida como hora local (removendo Z ou offsets de fuso)
  const cleanStr = dataReferenciaStr.replace(/Z$/, '').replace(/[+-]\d{2}:\d{2}$/, '');
  const dataReferencia = new Date(cleanStr);
  const diffMs = now.getTime() - dataReferencia.getTime();

  if (diffMs <= 0) return '00:00';

  const diffMins = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(hours)}:${pad(mins)}`;
};

// Helper para determinar status, cor e progresso baseado no evento
const getStatusPorEvento = (evento: string | null) => {
  if (!evento) {
    return {
      label: 'Agendada',
      color: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
      dot: 'bg-blue-500',
      percent: 0
    };
  }

  const evtLower = evento.toLowerCase().trim();

  // Se o status for "Retornado ao Setor", altera para "Retorno ao Setor de Origem"
  if (evtLower === 'retornado ao setor' || evtLower.includes('retornado ao setor')) {
    return {
      label: 'Retorno ao Setor de Origem',
      color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
      dot: 'bg-emerald-500',
      percent: 100
    };
  }

  // Se for um evento do PPP obstétrico
  if (isEventoPPP(evento)) {
    if (evtLower.includes('entrada')) {
      return {
        label: 'Entrada em Sala de Parto',
        color: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
        dot: 'bg-blue-500',
        percent: 25
      };
    }
    if (evtLower.includes('inicio') || evtLower.includes('início')) {
      return {
        label: 'Trabalho de Parto',
        color: 'bg-amber-500/10 text-amber-600 border-amber-500/20 animate-pulse',
        dot: 'bg-amber-500 animate-ping',
        percent: 50
      };
    }
    if (evtLower.includes('fim')) {
      return {
        label: 'Parto Concluído',
        color: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
        dot: 'bg-purple-500',
        percent: 75
      };
    }
    if (evtLower.includes('retorno') || evtLower.includes('origem')) {
      return {
        label: 'Retorno ao Setor de Origem',
        color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
        dot: 'bg-emerald-500',
        percent: 100
      };
    }
    return {
      label: evento,
      color: 'bg-slate-500/10 text-slate-600 border-slate-500/20',
      dot: 'bg-slate-500',
      percent: 50
    };
  }

  // Se for o fluxo tradicional do Centro Cirúrgico
  const index = EVENTOS_FLUXO.findIndex(e => e.toLowerCase() === evtLower);
  if (index === -1) {
    return {
      label: evento,
      color: 'bg-slate-500/10 text-slate-600 border-slate-500/20',
      dot: 'bg-slate-500',
      percent: 0
    };
  }

  const percent = Math.round(((index + 1) / EVENTOS_FLUXO.length) * 100);

  switch (index) {
    case 0: // Entrada em sala
      return {
        label: evento,
        color: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
        dot: 'bg-blue-500',
        percent
      };
    case 1: // Início da Anestesia
      return {
        label: evento,
        color: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
        dot: 'bg-purple-500',
        percent
      };
    case 2: // Início da Cirurgia
      return {
        label: evento,
        color: 'bg-amber-500/10 text-amber-600 border-amber-500/20 animate-pulse',
        dot: 'bg-amber-500 animate-ping',
        percent
      };
    case 3: // Término da Cirurgia
      return {
        label: evento,
        color: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
        dot: 'bg-indigo-500',
        percent
      };
    case 4: // Término da Anestesia
      return {
        label: evento,
        color: 'bg-teal-500/10 text-teal-600 border-teal-500/20',
        dot: 'bg-teal-500',
        percent
      };
    case 5: // Entrada em Recuperação Anestésica
      return {
        label: evento,
        color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
        dot: 'bg-emerald-500',
        percent
      };
    default:
      return {
        label: evento,
        color: 'bg-slate-500/10 text-slate-600 border-slate-500/20',
        dot: 'bg-slate-500',
        percent
      };
  }
};

const SYNC_INTERVAL_MS = 3 * 60 * 1000; // 3 minutos

export default function CentroCirurgico() {
  const [cirurgias, setCirurgias] = useState<Cirurgia[]>([]);
  const [loading, setLoading] = useState(true);
  const [salaFilter, setSalaFilter] = useState(''); // Usado na aba de tabela
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [now, setNow] = useState(new Date());

  // Novos estados para a visualização avançada
  const [viewMode, setViewMode] = useState<'salas' | 'tabela'>('salas');

  const { profile } = useAuth();

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 30000); // atualiza a cada 30 segundos
    return () => clearInterval(timer);
  }, []);

  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isSyncingRef = useRef(false);

  const fetchCirurgias = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('cirurgias')
        .select(`
          *,
          historico_eventos_cirurgia (
            evento,
            dt_registro,
            dt_evento
          )
        `)
        .order('dt_agenda', { ascending: true });

      if (error) throw error;
      if (data) {
        setCirurgias(data as unknown as Cirurgia[]);
      }
    } catch (err) {
      console.error('Erro ao buscar cirurgias:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const runSync = useCallback(async () => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    setIsSyncing(true);
    setSyncMessage(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão expirada. Faça login novamente.');

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://drbzogwimvaziaydwqfk.supabase.co';
      const response = await fetch(`${supabaseUrl}/functions/v1/sync-cirurgias`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();

      if (result.success) {
        setLastSyncTime(new Date());
        setSyncMessage({ type: 'success', text: `Sincronização concluída! ${result.upserted} cirurgias atualizadas.` });
        await fetchCirurgias();
      } else {
        setSyncMessage({ type: 'error', text: result.error || 'Erro na sincronização.' });
      }
    } catch (err: any) {
      console.error('Erro ao sincronizar:', err);
      setSyncMessage({ type: 'error', text: err.message || 'Falha de comunicação com o servidor.' });
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
      // Limpa mensagem de feedback após 5 segundos
      setTimeout(() => setSyncMessage(null), 5000);
    }
  }, [fetchCirurgias]);

  // Dispara a sincronização de cirurgias assim que o componente é montado (entrada na tela)
  // e configura o intervalo para buscar a cada 3 minutos
  useEffect(() => {
    runSync();

    syncIntervalRef.current = setInterval(() => {
      runSync();
    }, SYNC_INTERVAL_MS);

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [runSync]);

  useEffect(() => {
    fetchCirurgias();

    // Inscreve no canal Realtime do Supabase para ouvir qualquer alteração (INSERT, UPDATE, DELETE) na tabela 'cirurgias'
    const channel = supabase
      .channel('cirurgias-realtime-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cirurgias' },
        () => {
          console.log('[Realtime] Alteração detectada na tabela cirurgias. Atualizando dados...');
          fetchCirurgias();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchCirurgias]);

  // Navegação de datas removida (filtro por dia fixo em Hoje)

  // Normalização e extração de número de sala
  const SALAS_PAINEL = ['1', '2', '3', '4', '5', '6', '7'];

  const getSalaNormalizada = (salaStr: string | null): string | null => {
    if (!salaStr) return null;
    const match = salaStr.match(/\d+/);
    if (match) {
      return parseInt(match[0], 10).toString();
    }
    return null;
  };

  // Filtragem das cirurgias com base no dia de hoje (data atual do sistema)
  const today = new Date();
  const cirurgiasDeHoje = cirurgias.filter(c => {
    if (!c.dt_agenda) return false;

    // Desconsidera totalmente o que contiver PPP, PP ou P.P. na coluna sala
    const salaLower = c.sala?.toLowerCase() || '';
    if (salaLower.includes('ppp') || salaLower.includes('pp') || salaLower.includes('p.p.')) {
      return false;
    }

    const agendaDate = new Date(c.dt_agenda);
    return (
      agendaDate.getDate() === today.getDate() &&
      agendaDate.getMonth() === today.getMonth() &&
      agendaDate.getFullYear() === today.getFullYear()
    );
  });

  // Filtros aplicados (sala, quando em modo tabela)
  const filteredCirurgias = cirurgiasDeHoje.filter(c => {
    const matchSala = viewMode === 'salas' || salaFilter === '' || c.sala === salaFilter;
    return matchSala;
  });

  // Identifica cirurgias fora do padrão de salas 1-7
  const cirurgiasForaDoPadrao = filteredCirurgias.filter(c => {
    const salaNorm = getSalaNormalizada(c.sala);
    return !salaNorm || !SALAS_PAINEL.includes(salaNorm);
  });

  // Helper para verificar se uma cirurgia já foi finalizada (mais de 2h após agendamento, no dia de hoje)
  const isCirurgiaFinalizada = (dateStr: string | null): boolean => {
    if (!dateStr) return false;
    const now = new Date();
    const agendaTime = new Date(dateStr);
    const diffMs = now.getTime() - agendaTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const isToday = now.getDate() === agendaTime.getDate() &&
      now.getMonth() === agendaTime.getMonth() &&
      now.getFullYear() === agendaTime.getFullYear();
    return isToday && diffMins > 120;
  };

  // Agrupamento por sala para o painel de 7 cards
  // Distribui com base apenas nas cirurgias ativas (sendo realizadas no momento)
  const cirurgiasPorSala = SALAS_PAINEL.reduce((acc, salaNum) => {
    const cirurgiasDaSala = filteredCirurgias.filter(
      c => getSalaNormalizada(c.sala) === salaNum
    );

    // Procura por cirurgia ativa na sala (com evento de entrada em sala até término de anestesia)
    const ativa = cirurgiasDaSala.find(c => isCirurgiaAtiva(c.evento)) || null;

    acc[salaNum] = { ativa, proximas: [] };
    return acc;
  }, {} as Record<string, { ativa: Cirurgia | null; proximas: Cirurgia[] }>);

  const uniqueSalas = Array.from(new Set(cirurgias.map(c => c.sala).filter(Boolean))).sort() as string[];

  // Indicadores (baseados no dia selecionado)
  const totalCirurgias = filteredCirurgias.length;
  const totalEletivas = filteredCirurgias.filter(c => c.ds_carater?.toLowerCase().includes('eletiva') || c.ds_carater?.toLowerCase().includes('eletivo')).length;
  const totalUrgencias = totalCirurgias - totalEletivas;
  const salasAtivas = SALAS_PAINEL.filter(sNum => !!cirurgiasPorSala[sNum]?.ativa).length;

  // Formata data e hora
  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return '--:--';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '--/--/----';
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR');
  };

  const formatSyncTime = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 md:p-8 animate-in fade-in zoom-in duration-500">

      {/* Header e Controles */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
        <div className="flex flex-col gap-2 w-full xl:w-auto">
          <div className="flex items-center gap-4 flex-wrap justify-between md:justify-start">
            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-xl">
                <Activity className="h-6 w-6 text-primary animate-pulse" />
              </div>
              Centro Cirúrgico
            </h1>
          </div>
          <p className="text-muted-foreground">
            Acompanhamento em tempo real de cirurgias agendadas, distribuição de salas e equipes médicas.
          </p>
        </div>

        {/* Botão Sincronizar e Modo de Exibição */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full xl:w-auto">
          {(isSyncing || (syncMessage && syncMessage.type === 'error') || lastSyncTime) && (
            <div className="flex items-center gap-2 select-none self-center">
              {isSyncing ? (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/40">
                  <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                  <span className="text-blue-600 dark:text-blue-400 font-medium text-xs">Sincronizando...</span>
                </div>
              ) : syncMessage && syncMessage.type === 'error' ? (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40">
                  <span className="relative flex h-2 w-2">
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                  </span>
                  <span className="text-red-600 dark:text-red-400 font-medium text-xs">Erro na sync</span>
                </div>
              ) : lastSyncTime ? (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 animate-in fade-in duration-300">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium text-xs">
                    Sync {formatSyncTime(lastSyncTime)}
                  </span>
                </div>
              ) : null}
            </div>
          )}

          <div className="flex items-center gap-2 border rounded-lg p-1 bg-muted/30">
            <button
              onClick={() => setViewMode('salas')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${viewMode === 'salas'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Painel de Salas
            </button>
            <button
              onClick={() => setViewMode('tabela')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${viewMode === 'tabela'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              <List className="h-3.5 w-3.5" />
              Lista Geral
            </button>
          </div>

          <button
            onClick={runSync}
            disabled={isSyncing}
            className="flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/95 disabled:opacity-50 px-4 py-2 rounded-md font-medium transition-all shadow-sm text-sm h-[38px]"
          >
            {isSyncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
            Sincronizar
          </button>
        </div>
      </div>

      {/* Seletor de data removido a pedido */}

      {/* Grid de Indicadores Premium */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Card 1: Total Cirurgias & Caráter */}
        <div className="bg-card border rounded-xl px-6 py-5 flex items-center justify-between shadow-sm relative overflow-hidden group hover:border-primary/40 transition-all hover:shadow-md">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-muted-foreground">Cirurgias de Hoje</span>
            <div className="flex items-baseline gap-4">
              <span className="text-4xl font-bold tracking-tight text-foreground">{totalCirurgias}</span>
              <div className="flex items-center gap-2 text-xs font-semibold border-l pl-3 h-6 border-border">
                <span className="text-foreground">{totalEletivas} Eletivas</span>
                <span className="text-muted-foreground">•</span>
                <span className="text-red-500">{totalUrgencias} Urgentes</span>
              </div>
            </div>
          </div>
          <div className="p-3.5 bg-primary/10 rounded-xl text-primary transition-transform group-hover:scale-110">
            <Activity className="h-6 w-6" />
          </div>
        </div>

        {/* Card 2: Salas Ocupadas */}
        <div className="bg-card border rounded-xl px-6 py-5 flex items-center justify-between shadow-sm relative overflow-hidden group hover:border-primary/40 transition-all hover:shadow-md">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-muted-foreground">Salas Ocupadas no Momento</span>
            <span className="text-4xl font-bold tracking-tight text-foreground">
              {salasAtivas} <span className="text-xl font-semibold text-muted-foreground">de {SALAS_PAINEL.length}</span>
            </span>
          </div>
          <div className="p-3.5 bg-blue-500/10 rounded-xl text-blue-500 transition-transform group-hover:scale-110">
            <Calendar className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Toolbar de Filtros (Apenas na Lista Geral/Tabela) */}
      {viewMode === 'tabela' && (
        <div className="bg-card border rounded-xl p-4 flex flex-col sm:flex-row gap-4 bg-muted/10 shadow-sm items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">Filtrar registros por sala:</span>
          <div className="relative w-full sm:w-64">
            <SlidersHorizontal className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <select
              value={salaFilter}
              onChange={(e) => setSalaFilter(e.target.value)}
              className="w-full pl-9 pr-8 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm bg-background text-foreground appearance-none cursor-pointer"
            >
              <option value="">Todas as Salas</option>
              {uniqueSalas.map(sala => (
                <option key={sala} value={sala}>{sala}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          </div>
        </div>
      )}

      {/* ÁREA DE CONTEÚDO PRINCIPAL */}
      {loading ? (
        <div className="bg-card border rounded-xl flex items-center justify-center min-h-[400px] shadow-sm">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-sm font-medium text-muted-foreground">Carregando cirurgias...</span>
          </div>
        </div>
      ) : viewMode === 'salas' ? (
        /* PAINEL EM FORMATO DE CARDS DE 7 SALAS */
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-6">
            {SALAS_PAINEL.map((salaNum) => {
              const salaInfo = cirurgiasPorSala[salaNum] || { ativa: null, proximas: [] };
              const { ativa: principal, proximas } = salaInfo;
              const ocupada = !!principal;

              // Se houver cirurgia principal, determina o status e se é urgente
              const statusInfo = ocupada ? getStatusPorEvento(principal.evento) : null;
              const isUrgente = ocupada && (principal.ds_carater?.toLowerCase().includes('urg') || principal.ds_carater?.toLowerCase().includes('emerg'));

              return (
                <div
                  key={salaNum}
                  className={`bg-card border-2 rounded-xl shadow-sm flex flex-col transition-all duration-300 relative overflow-hidden group hover:shadow-md min-w-0 sm:min-w-[460px] ${ocupada
                    ? isUrgente
                      ? 'border-red-500/30 hover:border-red-500/50 hover:shadow-red-500/5'
                      : 'border-blue-500/30 hover:border-blue-500/50 hover:shadow-blue-500/5'
                    : 'border-border opacity-90 hover:opacity-100'
                    }`}
                >
                  {/* Cabeçalho do Card */}
                  {ocupada ? (
                    <div className={`p-4 border-b flex items-start justify-between gap-3 transition-colors ${isUrgente
                      ? 'bg-red-500/5 border-red-500/10'
                      : 'bg-blue-500/5 border-blue-500/10'
                      }`}>
                      {/* Bloco Esquerda + Centro (Sala + Paciente) */}
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        {/* Esquerda: Destaque da Sala */}
                        <div className={`flex flex-col items-center justify-center p-2 rounded-lg min-w-[55px] h-[55px] border ${isUrgente
                          ? 'bg-red-500/10 border-red-500/20'
                          : 'bg-blue-500/10 border-blue-500/20'
                          }`}>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Sala</span>
                          <span className="text-xl font-extrabold leading-none text-foreground">{salaNum}</span>
                        </div>

                        {/* Centro: Paciente */}
                        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                          <h4 className="font-bold text-sm text-foreground uppercase whitespace-normal break-words" title={principal.nm_paciente || ''}>
                            {principal.nm_paciente}
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            {principal.idade ? `${principal.idade} anos` : 'Idade N/I'} • {principal.ds_sexo || 'Sexo N/I'}
                          </p>
                          {principal.setor_origem && (
                            <p className="text-xs text-muted-foreground/90 font-medium mt-0.5">
                              Origem: <strong className="font-semibold text-foreground/80">{principal.setor_origem}</strong>
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Bloco Direita (Caráter) */}
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        <span className={`inline-flex px-2 py-1 text-[9px] font-bold uppercase rounded border ${isUrgente
                          ? 'bg-red-500/10 text-red-500 border-red-500/20 animate-pulse'
                          : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                          }`}>
                          {principal.ds_carater || 'Eletiva'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 border-b flex items-center justify-between bg-muted/10">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground text-lg">
                          {salaNum.startsWith('PPP') ? salaNum : `Sala ${salaNum}`}
                        </span>
                      </div>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Disponível
                      </span>
                    </div>
                  )}

                  {/* Corpo do Card */}
                  <div className="p-5 flex-1 flex flex-col gap-4">
                    {ocupada ? (
                      <>
                        {/* Status Atual / Evento */}
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${statusInfo?.color} whitespace-nowrap`} title={principal.evento || 'Status'}>
                              <span className={`w-1.5 h-1.5 rounded-full ${statusInfo?.dot}`} />
                              {statusInfo?.label}
                            </span>
                          </div>
                        </div>

                        {/* Alergias e Precauções */}
                        {(principal.alergia || principal.precaucao) && (
                          <div className="flex flex-col gap-2 p-2.5 rounded-lg bg-muted/20 border border-border/40 animate-in fade-in duration-200">
                            {principal.alergia && (
                              <div className="flex items-start gap-2">
                                <span className="text-[10px] font-extrabold text-red-500 dark:text-red-400 uppercase tracking-wider mt-0.5 flex-shrink-0 flex items-center gap-1">
                                  <AlertCircle className="h-3.5 w-3.5" /> Alergias:
                                </span>
                                <div className="flex flex-wrap gap-1">
                                  {principal.alergia.split(',').map((a, i) => {
                                    const trimmed = a.trim();
                                    if (!trimmed) return null;
                                    return (
                                      <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/10 text-red-700 dark:bg-red-500/20 dark:text-red-300 border border-red-500/20 shadow-sm">
                                        {trimmed}
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                            {principal.precaucao && (
                              <div className="flex items-start gap-2">
                                <span className="text-[10px] font-extrabold text-amber-600 dark:text-amber-500 uppercase tracking-wider mt-0.5 flex-shrink-0 flex items-center gap-1">
                                  <AlertTriangle className="h-3.5 w-3.5" /> Precauções:
                                </span>
                                <div className="flex flex-wrap gap-1">
                                  {principal.precaucao.split(',').map((p, i) => {
                                    const trimmed = p.trim();
                                    if (!trimmed) return null;
                                    return (
                                      <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 border border-amber-500/20 shadow-sm">
                                        {trimmed}
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Procedimento */}
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Procedimento</span>
                          <p className="text-sm font-semibold text-foreground uppercase line-clamp-2 leading-relaxed whitespace-normal break-words" title={principal.procedimento || ''}>
                            {principal.procedimento || 'Não informado'}
                          </p>
                        </div>

                        {/* Equipe Médica e Enfermagem */}
                        <div className="flex flex-col gap-2 pt-2 border-t border-border/65 mt-auto">
                          <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                            <Stethoscope className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            <span className="truncate" title={`Cirurgião: ${principal.medico || 'Não informado'}`}>
                              Cirurgião: <strong className="font-bold">{principal.medico || 'N/I'}</strong>
                            </span>
                          </div>
                          {principal.nm_anestesista && (
                            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                              <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                              <span className="truncate" title={`Anestesista: ${principal.nm_anestesista}`}>
                                Anest: <strong className="font-semibold text-foreground/80">{principal.nm_anestesista}</strong>
                              </span>
                            </div>
                          )}
                          {principal.enfermeiro && (
                            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                              <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                              <span className="truncate" title={`Enfermeiro: ${principal.enfermeiro}`}>
                                Enf: <strong className="font-semibold text-foreground/80">{principal.enfermeiro}</strong>
                              </span>
                            </div>
                          )}
                          {principal.circulante && (
                            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                              <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                              <span className="truncate" title={`Circulante: ${principal.circulante}`}>
                                Circ: <strong className="font-semibold text-foreground/80">{principal.circulante}</strong>
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Tempo de Duração e Progresso */}
                        <div className="flex flex-col gap-1.5 pt-3 border-t border-dashed mt-3">
                          <div className="flex justify-between items-center text-[10px] font-medium text-muted-foreground">
                            <span className="flex items-center gap-1 text-sm font-bold text-foreground">
                              <span>Duração:</span>
                              <span className="flex items-center gap-0.5">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                {getDuracaoCirurgia(principal, now)}
                              </span>
                            </span>
                            <span className="font-bold text-foreground">{statusInfo?.percent}%</span>
                          </div>

                          {/* Barra visual com 6 divisórias de etapa */}
                          <div className="relative h-2 w-full bg-muted rounded-full overflow-hidden flex gap-0.5">
                            {EVENTOS_FLUXO.map((evt, idx) => {
                              const principalIdx = EVENTOS_FLUXO.findIndex(e => e.toLowerCase() === (principal.evento || '').toLowerCase().trim());
                              const isCompleted = (statusInfo?.percent === 100) || principalIdx >= idx;

                              let stepColor = 'bg-muted';
                              if (isCompleted) {
                                if (statusInfo?.percent === 100) stepColor = 'bg-emerald-500';
                                else if (principalIdx === 2) stepColor = 'bg-amber-500'; // Em cirurgia
                                else if (principalIdx === 0) stepColor = 'bg-blue-500';
                                else if (principalIdx === 1) stepColor = 'bg-purple-500';
                                else if (principalIdx === 3) stepColor = 'bg-indigo-500';
                                else if (principalIdx === 4) stepColor = 'bg-teal-500';
                                else stepColor = 'bg-emerald-500';
                              }

                              return (
                                <div
                                  key={evt}
                                  className={`h-full flex-1 transition-all duration-300 ${stepColor} ${isCompleted && principalIdx === idx && idx === 2 ? 'animate-pulse' : ''
                                    }`}
                                  title={`${idx + 1}. ${evt}`}
                                />
                              );
                            })}
                          </div>
                        </div>


                      </>
                    ) : (
                      /* Estado Vazio - Sala Livre */
                      <div className="flex-1 flex flex-col justify-between h-full gap-4">
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-4 text-muted-foreground gap-3 my-auto">
                          <div className="p-2.5 bg-emerald-500/10 text-emerald-600 rounded-full border border-emerald-500/20 group-hover:scale-105 transition-transform">
                            <CheckCircle2 className="h-7 w-7" />
                          </div>
                          <div className="flex flex-col gap-1">
                            <h5 className="font-bold text-foreground text-sm">Sala Disponível</h5>
                            <p className="text-xs max-w-[200px] leading-relaxed">
                              Sala higienizada e liberada para procedimentos.
                            </p>
                          </div>
                        </div>


                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Alerta de cirurgias em outras salas que não sejam 1 a 7 */}
          {cirurgiasForaDoPadrao.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-in fade-in">
              <div className="flex items-start sm:items-center gap-3">
                <div className="p-2 bg-amber-500/20 rounded-lg text-amber-600 mt-1 sm:mt-0">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-amber-700 text-sm">
                    Cirurgias em outras salas detectadas
                  </h4>
                  <p className="text-xs text-amber-600/90 mt-0.5">
                    Existem {cirurgiasForaDoPadrao.length} cirurgias agendadas em salas que não estão no painel padrão.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setViewMode('tabela')}
                className="px-3.5 py-1.5 bg-amber-500 text-white hover:bg-amber-600 font-bold rounded-lg text-xs transition-all shadow-sm flex-shrink-0"
              >
                Visualizar na Lista Geral
              </button>
            </div>
          )}
        </div>
      ) : (
        /* VISÃO LISTA GERAL (TABELA) */
        <div className="bg-card border rounded-xl shadow-sm flex flex-col flex-1 overflow-hidden min-h-[500px]">
          <div className="flex-1 overflow-auto scrollbar-hide">
            {filteredCirurgias.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-muted-foreground gap-3">
                <Activity className="h-12 w-12 opacity-15" />
                <p className="font-medium">Nenhuma cirurgia agendada com os filtros atuais para este dia.</p>
              </div>
            ) : (
              <table className="w-full text-base text-left border-collapse">
                <thead className="text-sm text-muted-foreground uppercase bg-muted/40 sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Cirurgia</th>
                    <th className="px-6 py-4 font-semibold">Paciente</th>
                    <th className="px-6 py-4 font-semibold">Procedimento</th>
                    <th className="px-6 py-4 font-semibold">Médico Responsável</th>
                    <th className="px-6 py-4 font-semibold text-center">Sala</th>
                    <th className="px-6 py-4 font-semibold text-center">Caráter</th>
                    <th className="px-6 py-4 font-semibold">Anestesista</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                    <th className="px-6 py-4 text-right pr-8">Progresso</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredCirurgias.map((c) => {
                    const isUrgente = c.ds_carater?.toLowerCase().includes('urg') || c.ds_carater?.toLowerCase().includes('emerg');
                    const statusInfo = getStatusPorEvento(c.evento);

                    return (
                      <tr key={c.id} className="hover:bg-muted/20 transition-all duration-150">
                        {/* Cirurgia */}
                        <td className="px-6 py-4 text-sm font-bold font-mono text-foreground">
                          {c.nr_cirurgia}
                        </td>

                        {/* Paciente */}
                        <td className="px-6 py-4 font-medium text-foreground min-w-[180px]">
                          <div className="flex flex-col gap-1">
                            <span className="font-semibold text-foreground text-sm">{c.nm_paciente}</span>
                            <span className="text-xs text-muted-foreground mt-0.5">
                              {c.idade ? `${c.idade} anos` : 'Idade N/I'} • {c.ds_sexo || 'Sexo N/I'}
                            </span>
                            {c.setor_origem && (
                              <span className="text-xs text-muted-foreground/90 font-medium mt-0.5">
                                Origem: <strong className="font-semibold text-foreground/80">{c.setor_origem}</strong>
                              </span>
                            )}
                            {(c.alergia || c.precaucao) && (
                              <div className="flex flex-col gap-1 mt-1.5">
                                {c.alergia && (
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[9px] font-extrabold text-red-500 dark:text-red-400 uppercase tracking-wide">Alergias:</span>
                                    {c.alergia.split(',').map((a, i) => {
                                      const trimmed = a.trim();
                                      if (!trimmed) return null;
                                      return (
                                        <span key={i} className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold bg-red-500/10 text-red-700 dark:bg-red-500/20 dark:text-red-300 border border-red-500/20">
                                          {trimmed}
                                        </span>
                                      );
                                    })}
                                  </div>
                                )}
                                {c.precaucao && (
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[9px] font-extrabold text-amber-600 dark:text-amber-500 uppercase tracking-wide">Precauções:</span>
                                    {c.precaucao.split(',').map((p, i) => {
                                      const trimmed = p.trim();
                                      if (!trimmed) return null;
                                      return (
                                        <span key={i} className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/10 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 border border-amber-500/20">
                                          {trimmed}
                                        </span>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Procedimento */}
                        <td className="px-6 py-4 text-sm font-medium text-foreground uppercase max-w-[280px] min-w-[200px] whitespace-normal break-words" title={c.procedimento || ''}>
                          {c.procedimento || 'Procedimento não informado'}
                        </td>

                        {/* Médico Responsável */}
                        <td className="px-6 py-4 text-sm font-medium text-foreground min-w-[160px]">
                          <div className="flex items-center gap-2">
                            <Stethoscope className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span className="whitespace-normal break-words">{c.medico || 'Médico não informado'}</span>
                          </div>
                        </td>

                        {/* Sala */}
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex px-2.5 py-1 text-xs font-bold rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20 whitespace-nowrap">
                            {c.sala || 'N/I'}
                          </span>
                        </td>

                        {/* Caráter */}
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex px-2.5 py-1 text-xs font-bold rounded-full border ${isUrgente
                            ? 'bg-red-500/10 text-red-500 border-red-500/20 animate-pulse'
                            : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                            }`}>
                            {c.ds_carater || 'Eletiva'}
                          </span>
                        </td>

                        {/* Anestesista */}
                        <td className="px-6 py-4 text-sm text-muted-foreground min-w-[180px]">
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <span className="whitespace-normal break-words text-foreground/80 font-medium">Anest: {c.nm_anestesista || 'Sem anestesista'}</span>
                            </div>
                            {(c.enfermeiro || c.circulante) && (
                              <div className="text-[11px] text-muted-foreground pl-6 flex flex-col gap-0.5 border-t border-border/40 pt-1">
                                {c.enfermeiro && <span>Enf: <strong className="font-semibold text-foreground/75">{c.enfermeiro}</strong></span>}
                                {c.circulante && <span>Circ: <strong className="font-semibold text-foreground/75">{c.circulante}</strong></span>}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Status / Evento */}
                        <td className="px-6 py-4 text-sm">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${statusInfo.color} whitespace-nowrap`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`} />
                            {statusInfo.label}
                          </span>
                        </td>

                        {/* Progresso */}
                        <td className="px-6 py-4 text-right pr-8">
                          <div className="inline-flex flex-col items-end gap-1 w-24">
                            <span className="text-[10px] font-bold text-foreground">{statusInfo.percent}%</span>
                            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden flex gap-0.5">
                              {EVENTOS_FLUXO.map((evt, idx) => {
                                const principalIdx = EVENTOS_FLUXO.findIndex(e => e.toLowerCase() === (c.evento || '').toLowerCase().trim());
                                const isCompleted = (statusInfo.percent === 100) || principalIdx >= idx;

                                let stepColor = 'bg-muted';
                                if (isCompleted) {
                                  if (statusInfo.percent === 100) stepColor = 'bg-emerald-500';
                                  else if (principalIdx === 2) stepColor = 'bg-amber-500';
                                  else if (principalIdx === 0) stepColor = 'bg-blue-500';
                                  else if (principalIdx === 1) stepColor = 'bg-purple-500';
                                  else if (principalIdx === 3) stepColor = 'bg-indigo-500';
                                  else if (principalIdx === 4) stepColor = 'bg-teal-500';
                                  else stepColor = 'bg-emerald-500';
                                }

                                return (
                                  <div
                                    key={evt}
                                    className={`h-full flex-1 ${stepColor}`}
                                  />
                                );
                              })}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Contador Geral no Rodapé */}
          {!loading && filteredCirurgias.length > 0 && (
            <div className="p-4 border-t bg-muted/20 flex flex-col md:flex-row items-center justify-between gap-4">
              <span className="text-sm text-muted-foreground font-medium">
                Mostrando <span className="font-semibold text-foreground">{filteredCirurgias.length}</span> cirurgia{filteredCirurgias.length !== 1 && 's'} agendada{filteredCirurgias.length !== 1 && 's'} para o dia de hoje.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

