import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Activity, Search, Loader2, RefreshCcw, Calendar, ChevronDown,
  User, Stethoscope, SlidersHorizontal, CheckCircle2,
  Clock, ShieldAlert, ChevronLeft, ChevronRight, LayoutGrid, List, Info, AlertTriangle, AlertCircle,
  Sun, Moon
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

// Helper para abreviar o nome do paciente para iniciais
const formatNomeIniciais = (nome: string | null): string => {
  if (!nome) return '';
  return nome
    .trim()
    .split(/\s+/)
    .filter(p => p.length > 0 && !/^(de|da|do|dos|das|e)$/i.test(p))
    .map(p => p.charAt(0).toUpperCase())
    .join(' ');
};

const SYNC_INTERVAL_MS = 3 * 60 * 1000; // 3 minutos

const getTodayLocalString = (): string => {
  const d = new Date();
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 10);
};

const getDiferencaMinutos = (c: Cirurgia, eventoA: string, eventoB: string): string => {
  const histA = c.historico_eventos_cirurgia?.find(
    h => h.evento.toLowerCase().trim() === eventoA.toLowerCase().trim()
  );
  const histB = c.historico_eventos_cirurgia?.find(
    h => h.evento.toLowerCase().trim() === eventoB.toLowerCase().trim()
  );

  if (!histA || !histB || !histA.dt_registro || !histB.dt_registro) return '';

  try {
    const tA = new Date(histA.dt_registro.replace(/Z$/, '')).getTime();
    const tB = new Date(histB.dt_registro.replace(/Z$/, '')).getTime();
    const diffMs = tB - tA;
    if (diffMs < 0) return '';
    const diffMins = Math.round(diffMs / 60000);
    return `${diffMins} min`;
  } catch {
    return '';
  }
};

const getDuracaoTotalMinutos = (c: Cirurgia, now: Date): string => {
  if (!c.historico_eventos_cirurgia || c.historico_eventos_cirurgia.length === 0) return '';
  
  const ordenado = [...c.historico_eventos_cirurgia].sort(
    (a, b) => new Date(a.dt_registro).getTime() - new Date(b.dt_registro).getTime()
  );

  const tInicioStr = ordenado[0].dt_registro;
  const tFimStr = ordenado[ordenado.length - 1].dt_registro;

  if (!tInicioStr || !tFimStr) return '';

  try {
    const tInicio = new Date(tInicioStr.replace(/Z$/, '')).getTime();
    const status = getStatusPorEvento(c.evento);
    
    const tFim = status.percent === 100 
      ? new Date(tFimStr.replace(/Z$/, '')).getTime() 
      : now.getTime();

    const diffMs = tFim - tInicio;
    if (diffMs < 0) return '';
    const diffMins = Math.round(diffMs / 60000);
    
    if (diffMins < 60) {
      return `${diffMins} min`;
    } else {
      const hrs = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      return `${hrs}h ${mins}min`;
    }
  } catch {
    return '';
  }
};

export default function CentroCirurgico() {
  const [cirurgias, setCirurgias] = useState<Cirurgia[]>([]);
  const [loading, setLoading] = useState(true);
  const [salaFilter, setSalaFilter] = useState(''); // Usado na aba de tabela
  const [caraterFilter, setCaraterFilter] = useState('');
  const [dateFilter, setDateFilter] = useState(getTodayLocalString);
  const [searchQuery, setSearchQuery] = useState('');
  const dateInputRef = useRef<HTMLInputElement>(null);

  const handlePrevDay = () => {
    const baseDateStr = dateFilter || getTodayLocalString();
    const d = new Date(baseDateStr + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    setDateFilter(d.toISOString().slice(0, 10));
  };

  const handleNextDay = () => {
    const baseDateStr = dateFilter || getTodayLocalString();
    const d = new Date(baseDateStr + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    setDateFilter(d.toISOString().slice(0, 10));
  };
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [now, setNow] = useState(new Date());

  // Novos estados para a visualização avançada
  const [viewMode, setViewMode] = useState<'salas' | 'tabela'>('salas');

  const { profile } = useAuth();

  const [isDark, setIsDark] = useState(false);

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
  const SALAS_PADRAO = ['1', '2', '3', '4', '5', '6', '7'];

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

  // Coletar outras salas presentes nas cirurgias de hoje que não correspondem às salas 1 a 7
  const outrasSalasDeHoje = Array.from(
    new Set(
      cirurgiasDeHoje
        .map(c => c.sala?.trim())
        .filter(Boolean)
        .filter(sala => {
          const norm = getSalaNormalizada(sala);
          return !norm || !SALAS_PADRAO.includes(norm);
        })
    )
  ).sort() as string[];

  // As salas que serão exibidas no painel de cards
  const SALAS_PAINEL = [...SALAS_PADRAO, ...outrasSalasDeHoje];

  // Filtros aplicados (sala, caráter, data e busca por nome, quando em modo tabela)
  const filteredCirurgias = cirurgias
    .filter(c => {
      // Desconsidera totalmente o que contiver PPP, PP ou P.P. na coluna sala
      const salaLower = c.sala?.toLowerCase() || '';
      if (salaLower.includes('ppp') || salaLower.includes('pp') || salaLower.includes('p.p.')) {
        return false;
      }

      if (viewMode === 'salas') {
        if (!c.dt_agenda) return false;
        const agendaDate = new Date(c.dt_agenda);
        const today = new Date();
        return (
          agendaDate.getDate() === today.getDate() &&
          agendaDate.getMonth() === today.getMonth() &&
          agendaDate.getFullYear() === today.getFullYear()
        );
      } else {
        // 1. Filtro de Data
        if (dateFilter) {
          if (!c.dt_agenda) return false;
          const agendaDate = new Date(c.dt_agenda);
          const [year, month, day] = dateFilter.split('-').map(Number);
          
          const matchesDate = agendaDate.getFullYear() === year &&
                              (agendaDate.getMonth() + 1) === month &&
                              agendaDate.getDate() === day;
          if (!matchesDate) return false;
        }

        // 2. Filtro de Sala
        if (salaFilter && c.sala !== salaFilter) {
          return false;
        }

        // 3. Filtro de Caráter
        if (caraterFilter) {
          const caraterLower = c.ds_carater?.toLowerCase() || '';
          if (caraterFilter === 'eletiva') {
            if (!caraterLower.includes('eletiv')) return false;
          } else if (caraterFilter === 'urgencia') {
            if (!caraterLower.includes('urg') && !caraterLower.includes('emerg')) return false;
          }
        }

        // 4. Filtro de Busca por Nome (Paciente)
        if (searchQuery) {
          const nameLower = c.nm_paciente?.toLowerCase() || '';
          const queryLower = searchQuery.toLowerCase().trim();
          if (!nameLower.includes(queryLower)) return false;
        }

        return true;
      }
    })
    .sort((a, b) => {
      if (viewMode !== 'tabela') return 0;

      const getPriority = (c: Cirurgia): number => {
        if (!c.evento) return 1; // Agendada (prioridade média)
        const status = getStatusPorEvento(c.evento);
        if (status.percent > 0 && status.percent < 100) return 0; // Em processo (prioridade máxima, topo)
        if (status.percent === 100) return 2; // Finalizada (prioridade mínima, base)
        return 1; // Outros
      };

      const pA = getPriority(a);
      const pB = getPriority(b);

      if (pA !== pB) {
        return pA - pB;
      }

      // Ordenar secundariamente por data/hora de agendamento (mais cedo primeiro)
      const timeA = a.dt_agenda ? new Date(a.dt_agenda).getTime() : 0;
      const timeB = b.dt_agenda ? new Date(b.dt_agenda).getTime() : 0;
      return timeA - timeB;
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

  // Agrupamento por sala para o painel de cards
  // Distribui com base apenas nas cirurgias ativas (sendo realizadas no momento)
  const cirurgiasPorSala = SALAS_PAINEL.reduce((acc, salaNum) => {
    const cirurgiasDaSala = filteredCirurgias.filter(c => {
      if (SALAS_PADRAO.includes(salaNum)) {
        return getSalaNormalizada(c.sala) === salaNum;
      }
      return c.sala?.trim() === salaNum;
    });

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

  // Cálculo de linhas e colunas para o grid adaptativo na TV (sem rolagem)
  const totalCards = SALAS_PAINEL.length;
  let cols = 4;
  let rows = 2;
  if (totalCards <= 4) {
    cols = 2;
    rows = 2;
  } else if (totalCards <= 6) {
    cols = 3;
    rows = 2;
  } else if (totalCards <= 8) {
    cols = 4;
    rows = 2;
  } else if (totalCards <= 9) {
    cols = 3;
    rows = 3;
  } else if (totalCards <= 12) {
    cols = 4;
    rows = 3;
  } else {
    cols = Math.ceil(Math.sqrt(totalCards));
    rows = Math.ceil(totalCards / cols);
  }

  return (
    <div className={`flex flex-col w-full bg-background text-foreground transition-colors animate-in fade-in zoom-in duration-500 ${viewMode === 'salas' ? 'h-screen overflow-hidden p-4 gap-3' : 'min-h-screen p-6 md:p-8 gap-6'
      }`}>

      {/* Header e Controles */}
      <div className={`flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 flex-shrink-0 ${viewMode === 'salas' ? 'pb-2 border-b' : 'pb-0'
        }`}>
        <div className="flex flex-col gap-1 w-full xl:w-auto">
          <div className="flex items-center gap-3 flex-wrap justify-between md:justify-start">
            <h1 className={`${viewMode === 'salas' ? 'text-xl' : 'text-3xl'} font-bold tracking-tight text-foreground flex items-center gap-2`}>
              <div className={`${viewMode === 'salas' ? 'p-1.5' : 'p-2'} bg-primary/10 rounded-xl`}>
                <Activity className={`${viewMode === 'salas' ? 'h-5 w-5' : 'h-6 w-6'} text-primary animate-pulse`} />
              </div>
              Centro Cirúrgico
            </h1>
            {/* Badges de Indicadores compactos (Apenas em modo salas) */}
            {viewMode === 'salas' && (
              <div className="flex items-center gap-2.5 ml-2 text-[11px]">
                <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-card border border-border shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  <span className="text-muted-foreground font-medium">Cirurgias Hoje:</span>
                  <span className="font-bold text-foreground text-xs">{totalCirurgias}</span>
                  <span className="text-muted-foreground/40 font-light">|</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">{totalEletivas} Eletivas</span>
                  <span className="text-muted-foreground/30 font-light">•</span>
                  <span className="text-red-600 dark:text-red-400 font-bold">{totalUrgencias} Urgências</span>
                </div>

                <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-card border border-border shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span className="text-muted-foreground font-medium">Salas Ocupadas:</span>
                  <span className="font-bold text-foreground text-xs">{salasAtivas} de {SALAS_PAINEL.length}</span>
                </div>
              </div>
            )}
          </div>
          {viewMode !== 'salas' && (
            <p className="text-muted-foreground text-sm">
              Acompanhamento em tempo real de cirurgias agendadas, distribuição de salas e equipes médicas.
            </p>
          )}
        </div>

        {/* Botão Sincronizar e Modo de Exibição */}
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0 ml-auto xl:ml-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 border rounded-lg p-0.5 bg-muted/30">
              <button
                onClick={() => setViewMode('salas')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all ${viewMode === 'salas'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                <LayoutGrid className="h-3 w-3" />
                Painel
              </button>
              <button
                onClick={() => setViewMode('tabela')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all ${viewMode === 'tabela'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                <List className="h-3 w-3" />
                Tabela
              </button>
            </div>

            <button
              onClick={toggleTheme}
              title={isDark ? 'Mudar para Modo Claro' : 'Mudar para Modo Escuro'}
              className="flex items-center justify-center gap-1.5 bg-muted hover:bg-muted/80 text-foreground border border-border px-3 py-1 rounded-md font-semibold transition-all shadow-sm text-xs h-[30px]"
            >
              {isDark ? (
                <Sun className="h-3.5 w-3.5 text-amber-500 animate-in spin-in-12 duration-300" />
              ) : (
                <Moon className="h-3.5 w-3.5 text-slate-700 dark:text-slate-300" />
              )}
              {isDark ? 'Claro' : 'Escuro'}
            </button>
          </div>

          {(isSyncing || (syncMessage && syncMessage.type === 'error') || lastSyncTime) && (
            <div className="flex items-center gap-2 select-none pr-1">
              {isSyncing ? (
                <div className="flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                  <span className="text-blue-600 dark:text-blue-400 font-medium text-[10px]">Sincronizando...</span>
                </div>
              ) : syncMessage && syncMessage.type === 'error' ? (
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
                  </span>
                  <span className="text-red-600 dark:text-red-400 font-medium text-[10px]">Erro</span>
                </div>
              ) : lastSyncTime ? (
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                  </span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium text-[10px]">
                    Sync {formatSyncTime(lastSyncTime)}
                  </span>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* Seletor de data removido a pedido */}

      {/* Grid de Indicadores Premium (Apenas na tabela) */}
      {viewMode === 'tabela' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-shrink-0">
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
      )}

      {/* Toolbar de Filtros (Apenas na Lista Geral/Tabela) */}
      {viewMode === 'tabela' && (
        <div className="bg-card border rounded-xl p-5 flex flex-col gap-4 bg-muted/10 shadow-sm flex-shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Filtros da Tabela</h3>
            </div>
            {(salaFilter || caraterFilter || searchQuery || dateFilter !== getTodayLocalString()) && (
              <button
                onClick={() => {
                  setSalaFilter('');
                  setCaraterFilter('');
                  setSearchQuery('');
                  setDateFilter(getTodayLocalString());
                }}
                className="text-xs text-primary hover:text-primary/80 font-medium underline underline-offset-4 cursor-pointer"
              >
                Limpar Filtros
              </button>
            )}
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {/* Busca por Nome */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Nome do Paciente</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  placeholder="Buscar paciente..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm bg-background text-foreground"
                />
              </div>
            </div>

            {/* Filtro de Sala */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Sala</label>
              <div className="relative">
                <SlidersHorizontal className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <select
                  value={salaFilter}
                  onChange={(e) => setSalaFilter(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm bg-background text-foreground appearance-none cursor-pointer"
                >
                  <option value="">Todas as Salas</option>
                  {uniqueSalas.map(sala => (
                    <option key={sala} value={sala}>{sala}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            {/* Filtro de Caráter */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Caráter</label>
              <div className="relative">
                <Info className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <select
                  value={caraterFilter}
                  onChange={(e) => setCaraterFilter(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm bg-background text-foreground appearance-none cursor-pointer"
                >
                  <option value="">Todos</option>
                  <option value="eletiva">Eletiva</option>
                  <option value="urgencia">Urgência / Emergência</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            {/* Filtro de Data */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Data da Cirurgia</label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handlePrevDay}
                  className="flex items-center justify-center p-2 border rounded-lg hover:bg-muted text-foreground transition-all cursor-pointer h-9 w-9 flex-shrink-0"
                  title="Dia Anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="relative flex-1">
                  <button
                    type="button"
                    onClick={() => dateInputRef.current?.showPicker()}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer z-10"
                    title="Abrir Calendário"
                  >
                    <Calendar className="h-4 w-4" />
                  </button>
                  <input
                    ref={dateInputRef}
                    type="date"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm bg-background text-foreground h-9 [&::-webkit-calendar-picker-indicator]:hidden"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleNextDay}
                  className="flex items-center justify-center p-2 border rounded-lg hover:bg-muted text-foreground transition-all cursor-pointer h-9 w-9 flex-shrink-0"
                  title="Próximo Dia"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ÁREA DE CONTEÚDO PRINCIPAL */}
      {loading ? (
        <div className="bg-card border rounded-xl flex flex-1 items-center justify-center min-h-[400px] shadow-sm">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-sm font-medium text-muted-foreground">Carregando cirurgias...</span>
          </div>
        </div>
      ) : viewMode === 'salas' ? (
        /* PAINEL EM FORMATO DE CARDS DE SALAS ADAPTATIVO PARA TV */
        <div className="flex-1 min-h-0 w-full flex flex-col">
          <div
            className="grid gap-3 w-full flex-1 min-h-0"
            style={{
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
            }}
          >
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
                  className={`bg-card border-2 rounded-xl shadow-sm flex flex-col transition-all duration-300 relative overflow-hidden group hover:shadow-md min-w-0 h-full min-h-0 ${ocupada
                    ? isUrgente
                      ? 'border-red-500/30 hover:border-red-500/50 hover:shadow-red-500/5'
                      : 'border-blue-500/30 hover:border-blue-500/50 hover:shadow-blue-500/5'
                    : 'border-border opacity-90 hover:opacity-100'
                    }`}
                >
                  {/* Cabeçalho do Card */}
                  {ocupada ? (
                    <div className={`p-[13px] border-b flex items-start justify-between gap-[13px] transition-colors flex-shrink-0 ${isUrgente
                      ? 'bg-red-500/5 border-red-500/10'
                      : 'bg-blue-500/5 border-blue-500/10'
                      }`}>
                      {/* Bloco Esquerda + Centro (Sala + Paciente) */}
                      <div className="flex items-start gap-[13px] flex-1 min-w-0">
                        {/* Esquerda: Destaque da Sala */}
                        <div className={`flex flex-col items-center justify-center p-2 rounded-lg min-w-[53px] h-[53px] border ${isUrgente
                          ? 'bg-red-500/10 border-red-500/20'
                          : 'bg-blue-500/10 border-blue-500/20'
                          }`}>
                          <span className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Sala</span>
                          <span className={`font-extrabold leading-none text-foreground ${salaNum.length > 2 ? 'text-[12px] uppercase font-black text-center whitespace-normal break-words leading-tight px-0.5' : 'text-[21px]'}`}>{salaNum}</span>
                        </div>

                        {/* Centro: Paciente */}
                        <div className="flex-1 min-w-0 flex flex-col gap-1">
                          <h4 className="font-bold text-[15px] md:text-[17px] text-foreground uppercase whitespace-normal break-words leading-tight truncate" title={principal.nm_paciente || ''}>
                            {formatNomeIniciais(principal.nm_paciente)}
                          </h4>
                          <p className="text-[13px] text-black dark:text-white">
                            {principal.idade ? `${principal.idade}a` : 'N/I'} • {principal.ds_sexo || 'Sexo N/I'}
                          </p>
                          {principal.setor_origem && (
                            <p className="text-[13px] text-muted-foreground">
                              Origem: <strong className="font-semibold text-foreground/80">{principal.setor_origem}</strong>
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Bloco Direita (Caráter) */}
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className={`inline-flex px-2 py-1 text-[11px] font-bold uppercase rounded border ${isUrgente
                          ? 'bg-red-500/10 text-red-500 border-red-500/20 animate-pulse'
                          : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                          }`}>
                          {principal.ds_carater?.toLowerCase().includes('urg') ? 'Urgente' : 'Eletiva'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-[13px] border-b flex items-center justify-between bg-muted/10 flex-shrink-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground text-[17px] md:text-[19px]">
                          {salaNum.toLowerCase().includes('sala') ? salaNum : `Sala ${salaNum}`}
                        </span>
                      </div>
                      <span className="inline-flex items-center gap-1.5 px-[11px] py-[5px] rounded-full text-[13px] font-bold border bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                        <span className="w-[9px] h-[9px] rounded-full bg-emerald-500 animate-pulse" />
                        Livre
                      </span>
                    </div>
                  )}

                  {/* Corpo do Card */}
                  <div className="p-[15px] flex-1 flex flex-col min-h-0 overflow-y-auto scrollbar-hide gap-2.5">
                    {ocupada ? (
                      <>
                        {/* Alergias e Precauções */}
                        {(principal.alergia || principal.precaucao) && (
                          <div className="flex flex-col gap-1 p-[9px] rounded bg-muted/20 border border-border/30 animate-in fade-in duration-200 flex-shrink-0">
                            {principal.alergia && (
                              <div className="flex flex-wrap gap-1.5 items-center">
                                <span className="text-[13px] font-extrabold text-red-600 dark:text-red-400 uppercase tracking-wider mr-1.5">Alergia:</span>
                                {principal.alergia.split(',').map((a, i) => {
                                  const trimmed = a.trim();
                                  if (!trimmed) return null;
                                  return (
                                    <span key={`alergia-${i}`} className="inline-flex items-center gap-1.5 px-[11px] py-[5px] rounded-full text-[13px] font-bold bg-red-50 text-red-955 border border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20 leading-none">
                                      <span className="w-1 h-1 rounded-full bg-red-600 dark:bg-red-400" />
                                      {trimmed}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                            {principal.precaucao && (
                              <div className="flex flex-wrap gap-1.5">
                                {principal.precaucao.split(',').map((p, i) => {
                                  const trimmed = p.trim();
                                  if (!trimmed) return null;
                                  return (
                                    <span key={`precaucao-${i}`} className="inline-flex items-center gap-1.5 px-[11px] py-[5px] rounded-full text-[13px] font-bold bg-amber-50 text-amber-955 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20 leading-none">
                                      <span className="w-1 h-1 rounded-full bg-amber-500 dark:bg-amber-400" />
                                      {trimmed}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Status Atual / Evento com Duração */}
                        <div className="flex items-center justify-start w-full gap-2 flex-nowrap flex-shrink-0 min-w-0">
                          <span className={`inline-flex items-center gap-1.5 px-[13px] py-[5px] rounded-[12px] text-[15px] font-bold border ${statusInfo?.color} flex-1 min-w-0 whitespace-normal break-words leading-tight`} title={principal.evento || 'Status'}>
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusInfo?.dot}`} />
                            <span className="min-w-0 break-words">{statusInfo?.label}</span>
                          </span>
                          {isCirurgiaAtiva(principal.evento) && (
                            <span className={`inline-flex items-center gap-1.5 px-[13px] py-[5px] rounded-full text-[15px] font-semibold border text-muted-foreground whitespace-nowrap shadow-sm flex-shrink-0 ${isUrgente
                              ? 'border-red-500/20 bg-red-500/10 dark:border-red-500/20 dark:bg-red-500/10'
                              : 'border-blue-500/20 bg-blue-500/10 dark:border-blue-500/20 dark:bg-blue-500/10'
                              }`}>
                              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isUrgente
                                ? 'bg-red-500 dark:bg-red-400'
                                : 'bg-blue-500 dark:bg-blue-400'
                                }`} />
                              <span>Duração: <strong className="font-extrabold text-foreground">{getDuracaoCirurgia(principal, now)}</strong></span>
                            </span>
                          )}
                        </div>

                        {/* Procedimento */}
                        <div className="flex flex-col gap-1 flex-shrink-0">
                          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Procedimento</span>
                          <p className="text-[14px] font-bold text-foreground uppercase line-clamp-2 leading-tight whitespace-normal break-words" title={principal.procedimento || ''}>
                            {principal.procedimento || 'Não informado'}
                          </p>
                        </div>

                        {/* Equipe Médica e Enfermagem */}
                        <div className="flex flex-col gap-1 pt-[7px] border-t border-border/50 mt-auto flex-shrink-0">
                          <div className="flex items-center gap-1.5 text-[13px] font-bold text-foreground">
                            <Stethoscope className="h-[15px] w-[15px] text-muted-foreground flex-shrink-0" />
                            <span className="truncate" title={`Cirurgião: ${principal.medico || 'Não informado'}`}>
                              Cirurgião: <strong className="font-extrabold">{principal.medico || 'N/I'}</strong>
                            </span>
                          </div>
                          {(principal.nm_anestesista || principal.enfermeiro || principal.circulante) && (
                            <div className="grid grid-cols-3 gap-1 mt-1 border-t border-dashed border-border/30 pt-[7px]">
                              {principal.nm_anestesista && (
                                <div className="flex items-center gap-1 text-[12px] text-muted-foreground min-w-0" title={`Anestesista: ${principal.nm_anestesista}`}>
                                  <User className="h-[13px] w-[13px] flex-shrink-0 text-muted-foreground/60" />
                                  <span className="truncate">
                                    Anest: <strong className="font-bold text-foreground/80">{principal.nm_anestesista.split(' ')[0]}</strong>
                                  </span>
                                </div>
                              )}
                              {principal.enfermeiro && (
                                <div className="flex items-center gap-1 text-[12px] text-muted-foreground min-w-0" title={`Enfermeiro: ${principal.enfermeiro}`}>
                                  <User className="h-[13px] w-[13px] flex-shrink-0 text-muted-foreground/60" />
                                  <span className="truncate">
                                    Enf: <strong className="font-bold text-foreground/80">{principal.enfermeiro.split(' ')[0]}</strong>
                                  </span>
                                </div>
                              )}
                              {principal.circulante && (
                                <div className="flex items-center gap-1 text-[12px] text-muted-foreground min-w-0" title={`Circulante: ${principal.circulante}`}>
                                  <User className="h-[13px] w-[13px] flex-shrink-0 text-muted-foreground/60" />
                                  <span className="truncate">
                                    Circ: <strong className="font-bold text-foreground/80">{principal.circulante.split(' ')[0]}</strong>
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Progresso da Cirurgia */}
                        <div className="flex flex-col gap-1.5 pt-[9px] border-t border-dashed border-border/40 flex-shrink-0">
                          <div className="flex justify-between items-center text-[12px] font-bold text-muted-foreground">
                            <span>Progresso da Cirurgia</span>
                            <span className="text-foreground">{statusInfo?.percent}%</span>
                          </div>

                          {/* Barra visual com 6 divisórias de etapa */}
                          <div className="relative h-[7px] w-full bg-muted rounded-full overflow-hidden flex gap-0.5">
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
                      <div className="flex-1 flex flex-col justify-center items-center text-center p-[11px] text-muted-foreground gap-[9px] my-auto">
                        <div className="p-[9px] bg-emerald-500/10 text-emerald-600 rounded-full border border-emerald-500/20 group-hover:scale-105 transition-transform flex-shrink-0">
                          <CheckCircle2 className="h-[23px] w-[23px]" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <h5 className="font-bold text-foreground text-[15px]">Sala Livre</h5>
                          <p className="text-[12px] max-w-[180px] leading-tight text-muted-foreground/80">
                            Pronta para novos procedimentos.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
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
                      <React.Fragment key={c.id}>
                        <tr className="hover:bg-muted/20 transition-all duration-150">
                          {/* Cirurgia */}
                          <td className="px-6 py-4 text-sm font-bold font-mono text-foreground">
                            {c.nr_cirurgia}
                          </td>

                          {/* Paciente */}
                          <td className="px-6 py-4 font-medium text-foreground min-w-[180px]">
                            <div className="flex flex-col gap-1">
                              <span className="font-semibold text-foreground text-sm" title={c.nm_paciente || ''}>{formatNomeIniciais(c.nm_paciente)}</span>
                              <span className="text-xs text-black dark:text-white mt-0.5">
                                {c.idade ? `${c.idade} anos` : 'Idade N/I'} • {c.ds_sexo || 'Sexo N/I'}
                              </span>
                              {c.setor_origem && (
                                <span className="text-xs text-muted-foreground/90 font-medium mt-0.5">
                                  Origem: <strong className="font-semibold text-foreground/80">{c.setor_origem}</strong>
                                </span>
                              )}
                              {(c.alergia || c.precaucao) && (
                                <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                                  {c.alergia && (
                                    <>
                                      <span className="text-[11px] font-extrabold text-red-600 dark:text-red-400 uppercase tracking-wider mr-1">Alergia:</span>
                                      {c.alergia.split(',').map((a, i) => {
                                        const trimmed = a.trim();
                                        if (!trimmed) return null;
                                        return (
                                          <span key={`alergia-${i}`} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-50 text-red-955 border border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20">
                                            <span className="w-1.5 h-1.5 rounded-full bg-red-600 dark:bg-red-400" />
                                            {trimmed}
                                          </span>
                                        );
                                      })}
                                    </>
                                  )}
                                  {c.precaucao &&
                                    c.precaucao.split(',').map((p, i) => {
                                      const trimmed = p.trim();
                                      if (!trimmed) return null;
                                      return (
                                        <span key={`precaucao-${i}`} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-955 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20">
                                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-400" />
                                          {trimmed}
                                        </span>
                                      );
                                    })}
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
                        {(() => {
                          const tempoEsp = getDiferencaMinutos(c, 'Entrada do paciente em Sala Cirúrgica', 'Início da Anestesia');
                          const tempoPrep = getDiferencaMinutos(c, 'Início da Anestesia', 'Início da Cirurgia/Procedimento');
                          const tempoCir = getDiferencaMinutos(c, 'Início da Cirurgia/Procedimento', 'Término Cirurgia/Procedimento');
                          const tempoDesp = getDiferencaMinutos(c, 'Término Cirurgia/Procedimento', 'Término da Anestesia');
                          const tempoRpa = getDiferencaMinutos(c, 'Término da Anestesia', 'Entrada em Recuperação Anestésica');
                          const tempoTotal = getDuracaoTotalMinutos(c, now);

                          const temTempos = tempoEsp || tempoPrep || tempoCir || tempoDesp || tempoRpa || tempoTotal;

                          if (!temTempos) return null;

                          return (
                            <tr className="bg-muted/5 dark:bg-muted/2">
                              <td colSpan={9} className="px-6 py-2 pb-3.5 border-b border-border/40">
                                <div className="flex items-center gap-6 text-xs text-muted-foreground bg-muted/20 dark:bg-muted/10 px-4 py-2.5 rounded-lg border border-border/30">
                                  <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[10px] text-muted-foreground/80">
                                    <Clock className="h-3.5 w-3.5 text-muted-foreground/60" />
                                    <span>Tempos de Transição:</span>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-4 flex-1">
                                    {tempoEsp && (
                                      <div className="flex items-center gap-1.5 bg-background dark:bg-slate-900 px-2.5 py-1 rounded-md border border-border/40 shadow-xs">
                                        <span className="font-medium text-muted-foreground/90">Espera p/ Anestesia:</span>
                                        <strong className="text-foreground font-bold">{tempoEsp}</strong>
                                      </div>
                                    )}
                                    {tempoPrep && (
                                      <div className="flex items-center gap-1.5 bg-background dark:bg-slate-900 px-2.5 py-1 rounded-md border border-border/40 shadow-xs">
                                        <span className="font-medium text-muted-foreground/90">Indução/Preparação:</span>
                                        <strong className="text-foreground font-bold">{tempoPrep}</strong>
                                      </div>
                                    )}
                                    {tempoCir && (
                                      <div className="flex items-center gap-1.5 bg-background dark:bg-slate-900 px-2.5 py-1 rounded-md border border-border/40 shadow-xs">
                                        <span className="font-medium text-muted-foreground/90">Tempo Cirúrgico:</span>
                                        <strong className="text-foreground font-bold">{tempoCir}</strong>
                                      </div>
                                    )}
                                    {tempoDesp && (
                                      <div className="flex items-center gap-1.5 bg-background dark:bg-slate-900 px-2.5 py-1 rounded-md border border-border/40 shadow-xs">
                                        <span className="font-medium text-muted-foreground/90">Despertar:</span>
                                        <strong className="text-foreground font-bold">{tempoDesp}</strong>
                                      </div>
                                    )}
                                    {tempoRpa && (
                                      <div className="flex items-center gap-1.5 bg-background dark:bg-slate-900 px-2.5 py-1 rounded-md border border-border/40 shadow-xs">
                                        <span className="font-medium text-muted-foreground/90">Saída p/ RPA:</span>
                                        <strong className="text-foreground font-bold">{tempoRpa}</strong>
                                      </div>
                                    )}
                                  </div>
                                  {tempoTotal && (
                                    <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-3.5 py-1.5 rounded-md font-bold shadow-xs">
                                      <span className="uppercase text-[9px] tracking-wider font-extrabold opacity-75">Duração Total:</span>
                                      <span className="text-sm font-mono">{tempoTotal}</span>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })()}
                      </React.Fragment>
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

