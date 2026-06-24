import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Activity,
  Search,
  Loader2,
  RefreshCcw,
  Calendar,
  CheckCircle,
  XCircle,
  ChevronDown,
  Clock,
  Users,
  ShieldAlert,
  Filter,
  ArrowUpDown,
  ArrowLeft,
  Moon,
  Sun,
  User,
  HeartPulse,
  Hourglass
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface PacientePA {
  id: string;
  nr_atendimento: number;
  nm_paciente: string;
  dt_entrada: string | null;
  dt_alta: string | null;
  ds_clinica: string | null;
  hr_inicio_consulta: string | null;
  dt_lib_medico: string | null;
  ie_status: string | null;
  status: string | null;
  ds_triagem: string | null;
  ie_internado: string | null;
  created_at: string;
  updated_at: string;
}

const parseLocalDate = (dateStr: string | null | undefined): Date | null => {
  if (!dateStr) return null;
  try {
    const cleanStr = dateStr.replace(/Z$/, '').replace(/[+-]\d{2}:\d{2}$/, '');
    const d = new Date(cleanStr);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
};

const getTriagemDotColor = (triagem: string | null): string => {
  if (!triagem) return 'bg-slate-300 dark:bg-slate-600';
  const text = triagem.toLowerCase();
  if (text.includes('1') || text.includes('emergencia') || text.includes('emergência')) return 'bg-red-500';
  if (text.includes('2') || text.includes('muito urgente')) return 'bg-orange-500 shadow-[0_0_6px_rgba(249,115,22,0.6)] border border-orange-500/30';
  if (text.includes('4') || text.includes('pouco urgente')) return 'bg-emerald-500';
  if (text.includes('5') || text.includes('nao urgente') || text.includes('não urgente') || text.includes('sem urgência') || text.includes('sem urgencia')) return 'bg-blue-500';
  if (text.includes('3') || text.includes('urgente')) return 'bg-yellow-400 shadow-[0_0_6px_rgba(250,204,21,0.6)] border border-yellow-500/30';
  return 'bg-slate-300 dark:bg-slate-600';
};

const SYNC_INTERVAL_MS = 3 * 60 * 1000; // 3 minutos

export default function ProntoAtendimento() {
  const navigate = useNavigate();
  const [pacientes, setPacientes] = useState<PacientePA[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [clinicaFilter, setClinicaFilter] = useState('');
  const [triagemFilter, setTriagemFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [internadoFilter, setInternadoFilter] = useState('');
  const [mostrarAltas, setMostrarAltas] = useState(true);

  // Controle de ordenação
  const [sortField, setSortField] = useState<'nm_paciente' | 'dt_entrada' | 'tempo_espera' | 'tempo_atendimento' | 'tempo_total'>('dt_entrada');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Estados de Sincronização
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncSuccess, setSyncSuccess] = useState<string | null>(null);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { profile } = useAuth();

  // Tema Escuro / Claro
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

  // Função para carregar dados do banco de dados
  const fetchPacientes = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      // Filtrar apenas atendimentos das últimas 24 horas baseados na dt_entrada (considerando fuso horário local)
      const localNow = new Date();
      const local24hAgo = new Date(localNow.getTime() - 24 * 60 * 60 * 1000);
      const year = local24hAgo.getFullYear();
      const month = String(local24hAgo.getMonth() + 1).padStart(2, '0');
      const day = String(local24hAgo.getDate()).padStart(2, '0');
      const hours = String(local24hAgo.getHours()).padStart(2, '0');
      const minutes = String(local24hAgo.getMinutes()).padStart(2, '0');
      const seconds = String(local24hAgo.getSeconds()).padStart(2, '0');
      const milliseconds = String(local24hAgo.getMilliseconds()).padStart(3, '0');
      const local24hAgoAsUTC = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}Z`;

      const { data, error } = await supabase
        .from('pacientes_pronto_atendimento')
        .select('*')
        .gte('dt_entrada', local24hAgoAsUTC)
        .order('dt_entrada', { ascending: false });

      if (error) throw error;
      if (data) {
        setPacientes(data);
      }
    } catch (err: any) {
      console.error('Erro ao buscar pacientes do PA:', err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  // Invocar a Edge Function para sincronizar os dados
  const runSync = useCallback(async (isManual = false) => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncError(null);
    if (isManual) setSyncSuccess(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão expirada. Faça login novamente.');

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://drbzogwimvaziaydwqfk.supabase.co';

      const response = await fetch(`${supabaseUrl}/functions/v1/sync-pacientes-pa`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Erro na sincronização: ${response.statusText}. ${errText}`);
      }

      const result = await response.json();

      if (result.success) {
        setLastSyncTime(new Date());
        if (isManual) {
          setSyncSuccess(`Sincronizado! ${result.upserted} pacientes atualizados.`);
          setTimeout(() => setSyncSuccess(null), 3000);
        }
        await fetchPacientes(true);
      } else {
        throw new Error(result.error || 'Erro desconhecido na Edge Function.');
      }
    } catch (err: any) {
      console.error('Erro de sincronização:', err);
      setSyncError(err.message || 'Falha ao sincronizar dados.');
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, fetchPacientes]);

  // Carregamento inicial e intervalo
  useEffect(() => {
    fetchPacientes(false);
    runSync(false);

    syncIntervalRef.current = setInterval(() => {
      runSync(false);
    }, SYNC_INTERVAL_MS);

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Formatar horário da última sync
  const formatSyncTime = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  // Obter tempo de espera em minutos
  const getWaitTimeMinutes = (entrada: string | null, inicio: string | null): number => {
    if (!entrada) return 0;
    const startObj = parseLocalDate(entrada);
    if (!startObj) return 0;
    const start = startObj.getTime();

    let end = Date.now();
    if (inicio) {
      const endObj = parseLocalDate(inicio);
      if (endObj) {
        end = endObj.getTime();
      }
    }
    return Math.max(0, Math.round((end - start) / 60000));
  };

  // Obter tempo em atendimento em minutos
  const getAtendimentoTimeMinutes = (inicio: string | null, libMedica: string | null, alta: string | null): number => {
    if (!inicio) return 0;
    const startObj = parseLocalDate(inicio);
    if (!startObj) return 0;
    const start = startObj.getTime();

    let end = Date.now();
    if (libMedica) {
      const endObj = parseLocalDate(libMedica);
      if (endObj) end = endObj.getTime();
    } else if (alta) {
      const endObj = parseLocalDate(alta);
      if (endObj) end = endObj.getTime();
    }
    return Math.max(0, Math.round((end - start) / 60000));
  };

  // Obter tempo total do atendimento em minutos
  const getTotalTimeMinutes = (entrada: string | null, alta: string | null, libMedica: string | null): number => {
    if (!entrada) return 0;
    const startObj = parseLocalDate(entrada);
    if (!startObj) return 0;
    const start = startObj.getTime();

    let end = Date.now();
    if (alta) {
      const endObj = parseLocalDate(alta);
      if (endObj) end = endObj.getTime();
    } else if (libMedica) {
      const endObj = parseLocalDate(libMedica);
      if (endObj) end = endObj.getTime();
    }
    return Math.max(0, Math.round((end - start) / 60000));
  };

  // Formatar minutos para string legível (ex: 1h 15min ou 45min)
  const formatWaitTime = (minutes: number): string => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  // Mapeamento visual das cores da triagem
  const getTriagemColor = (triagem: string | null) => {
    if (!triagem) return {
      badge: 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400 border border-slate-200 dark:border-slate-800/40',
      label: 'Sem Classificação'
    };

    const text = triagem.toLowerCase();
    if (text.includes('1') || text.includes('emergencia') || text.includes('emergência')) {
      return {
        badge: 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 animate-pulse',
        label: triagem
      };
    }
    if (text.includes('2') || text.includes('muito urgente')) {
      return {
        badge: 'bg-orange-500/20 text-orange-600 dark:text-orange-300 border border-orange-500/30 font-bold',
        label: triagem
      };
    }
    if (text.includes('4') || text.includes('pouco urgente')) {
      return {
        badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
        label: triagem
      };
    }
    if (text.includes('5') || text.includes('nao urgente') || text.includes('não urgente') || text.includes('sem urgência') || text.includes('sem urgencia')) {
      return {
        badge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20',
        label: triagem
      };
    }
    if (text.includes('3') || text.includes('urgente')) {
      return {
        badge: 'bg-yellow-400/20 text-yellow-600 dark:text-yellow-300 border border-yellow-400/30 font-bold',
        label: triagem
      };
    }

    return {
      badge: 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400 border border-slate-200 dark:border-slate-800/40',
      label: triagem
    };
  };

  // Mapeamento visual das cores do status
  const getStatusColor = (status: string | null) => {
    if (!status) return 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400 border border-slate-200 dark:border-slate-800/30';
    const text = status.toLowerCase();
    if (text.includes('alta') || text.includes('liberado')) {
      return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20';
    }
    if (text.includes('aguardando') || text.includes('fila')) {
      return 'bg-yellow-400/30 text-yellow-700 dark:text-yellow-400 border border-yellow-400/50 font-bold';
    }
    if (text.includes('atendimento') || text.includes('consultorio') || text.includes('consultório')) {
      return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20';
    }
    return 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20';
  };

  // Carregar listas de filtros únicos dinamicamente
  const uniqueClinicas = Array.from(new Set(pacientes.map(p => p.ds_clinica).filter(Boolean))).sort() as string[];
  const uniqueStatus = Array.from(new Set(pacientes.map(p => p.status).filter(Boolean))).sort() as string[];
  const uniqueTriagens = Array.from(new Set(pacientes.map(p => p.ds_triagem).filter(Boolean))).sort() as string[];

  // Tratamento de Ordenação
  const handleSort = (field: 'nm_paciente' | 'dt_entrada' | 'tempo_espera' | 'tempo_atendimento' | 'tempo_total') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc'); // Por padrão, datas e esperas maiores primeiro
    }
  };

  // Filtragem dos dados
  const filteredPacientes = pacientes.filter(p => {
    const matchSearch =
      p.nm_paciente.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.nr_atendimento.toString().includes(searchTerm);

    const matchClinica = clinicaFilter === '' || p.ds_clinica === clinicaFilter;
    const matchTriagem = triagemFilter === '' || p.ds_triagem === triagemFilter;
    const matchStatus = statusFilter === '' || p.status === statusFilter;
    const matchInternado = internadoFilter === '' || p.ie_internado === internadoFilter;

    const temAlta = p.dt_alta !== null || p.status?.toLowerCase() === 'alta' || p.ie_internado === 'S' || p.status?.toLowerCase() === 'internado' || p.ie_status?.toUpperCase() === 'IN';
    const matchAlta = mostrarAltas || !temAlta;

    return matchSearch && matchClinica && matchTriagem && matchStatus && matchInternado && matchAlta;
  });

  // Ordenação dos dados
  const sortedPacientes = [...filteredPacientes].sort((a, b) => {
    let valA: any;
    let valB: any;

    if (sortField === 'nm_paciente') {
      valA = a.nm_paciente || '';
      valB = b.nm_paciente || '';
    } else if (sortField === 'dt_entrada') {
      const dateA = parseLocalDate(a.dt_entrada);
      const dateB = parseLocalDate(b.dt_entrada);
      valA = dateA ? dateA.getTime() : 0;
      valB = dateB ? dateB.getTime() : 0;
    } else if (sortField === 'tempo_espera') {
      valA = getWaitTimeMinutes(a.dt_entrada, a.hr_inicio_consulta);
      valB = getWaitTimeMinutes(b.dt_entrada, b.hr_inicio_consulta);
    } else if (sortField === 'tempo_atendimento') {
      valA = getAtendimentoTimeMinutes(a.hr_inicio_consulta, a.dt_lib_medico, a.dt_alta);
      valB = getAtendimentoTimeMinutes(b.hr_inicio_consulta, b.dt_lib_medico, b.dt_alta);
    } else if (sortField === 'tempo_total') {
      valA = getTotalTimeMinutes(a.dt_entrada, a.dt_alta, a.dt_lib_medico);
      valB = getTotalTimeMinutes(b.dt_entrada, b.dt_alta, b.dt_lib_medico);
    }

    if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  // Cálculos de Indicadores Clínicos (Apenas para pacientes ativos, ou seja, sem data de alta, status diferente de Alta e não internados)
  const ativos = filteredPacientes.filter(p =>
    !p.dt_alta &&
    p.status?.toLowerCase() !== 'alta' &&
    p.ie_internado !== 'S' &&
    p.status?.toLowerCase() !== 'internado' &&
    p.ie_status?.toUpperCase() !== 'IN'
  );
  const totalAtivos = ativos.length;

  // Pacientes aguardando primeiro atendimento médico
  const aguardandoAtendimento = ativos.filter(p => !p.hr_inicio_consulta).length;

  // Pacientes em atendimento médico
  const emAtendimentoMedico = ativos.filter(p => p.hr_inicio_consulta && !p.dt_lib_medico).length;

  // Tempo médio de espera para pacientes atendidos ou que estão esperando (em minutos)
  const pacientesComTempoEspera = ativos;
  const tempoMedioEsperaMinutos = pacientesComTempoEspera.length > 0
    ? Math.round(
      pacientesComTempoEspera.reduce((sum, p) => sum + getWaitTimeMinutes(p.dt_entrada, p.hr_inicio_consulta), 0) /
      pacientesComTempoEspera.length
    )
    : 0;

  // Tempo médio de atendimento para pacientes atendidos ou em atendimento (em minutos)
  const pacientesComAtendimento = ativos.filter(p => p.hr_inicio_consulta);
  const tempoMedioAtendimentoMinutos = pacientesComAtendimento.length > 0
    ? Math.round(
      pacientesComAtendimento.reduce((sum, p) => sum + getAtendimentoTimeMinutes(p.hr_inicio_consulta, p.dt_lib_medico, p.dt_alta), 0) /
      pacientesComAtendimento.length
    )
    : 0;

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 md:p-8 animate-in fade-in zoom-in duration-500">

      {/* Top Header */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
        <div className="flex flex-col gap-2 w-full xl:w-auto">
          <div className="flex items-center gap-4 flex-wrap justify-between md:justify-start">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all border border-transparent hover:border-border text-muted-foreground hover:text-foreground flex items-center justify-center shrink-0"
              title="Voltar para a tela anterior"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex items-center pr-4 md:border-r md:border-border h-10">
              <img src="/LOGO_HSC_PRIMARY.png" alt="Santa Casa" className="h-10 w-auto dark:hidden object-contain" />
              <img src="/LOGO_HSC_WHITE.png" alt="Santa Casa" className="h-10 w-auto hidden dark:block object-contain" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-xl">
                <Activity className="h-6 w-6 text-primary animate-pulse" />
              </div>
              Pronto Atendimento
            </h1>
          </div>

          <p className="text-muted-foreground">
            Monitoramento de pacientes, tempos de espera e fluxos de atendimento do PA.
          </p>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-2 text-xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wider text-muted-foreground/80">Legenda Triagem:</span>
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <span className="h-3 w-3 rounded-full bg-red-500 shrink-0"></span>
              Emergência
            </span>
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <span className="h-3 w-3 rounded-full bg-orange-500 shrink-0"></span>
              Muito Urgente
            </span>
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <span className="h-3 w-3 rounded-full bg-yellow-400 shrink-0"></span>
              Urgente
            </span>
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <span className="h-3 w-3 rounded-full bg-emerald-500 shrink-0"></span>
              Pouco Urgente
            </span>
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <span className="h-3 w-3 rounded-full bg-blue-500 shrink-0"></span>
              Não Urgente
            </span>
          </div>
        </div>

        {/* Indicadores do Topo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 w-full xl:w-auto xl:min-w-[1100px]">

          {/* Card 1: Total Pacientes Ativos */}
          <div className="bg-card border rounded-xl p-5 flex items-center justify-between shadow-sm relative overflow-hidden group hover:border-primary/40 transition-all">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ativos no PA</span>
              <span className="text-3xl font-bold tracking-tight text-foreground">{totalAtivos}</span>
            </div>
            <div className="p-3 bg-primary/10 rounded-xl text-primary transition-transform group-hover:scale-110">
              <Users className="h-6 w-6" />
            </div>
          </div>

          {/* Card 3: Pacientes Aguardando Médico */}
          <div className="bg-card border rounded-xl p-5 flex items-center justify-between shadow-sm relative overflow-hidden group hover:border-primary/40 transition-all">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Aguardando Médico</span>
              <span className="text-3xl font-extrabold tracking-tight text-yellow-600 dark:text-yellow-400">{aguardandoAtendimento}</span>
            </div>
            <div className="p-3 bg-yellow-400/20 rounded-xl text-yellow-600 dark:text-yellow-400 transition-transform group-hover:scale-110">
              <Hourglass className="h-6 w-6 animate-spin-slow" />
            </div>
          </div>

          {/* Card 4: Em Consulta */}
          <div className="bg-card border rounded-xl p-5 flex items-center justify-between shadow-sm relative overflow-hidden group hover:border-primary/40 transition-all">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Em Atendimento</span>
              <span className="text-3xl font-bold tracking-tight text-foreground text-emerald-500">{emAtendimentoMedico}</span>
            </div>
            <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-500 transition-transform group-hover:scale-110">
              <HeartPulse className="h-6 w-6" />
            </div>
          </div>

          {/* Card 2: Tempo Médio de Espera */}
          <div className="bg-card border rounded-xl p-5 flex items-center justify-between shadow-sm relative overflow-hidden group hover:border-primary/40 transition-all">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Média de Espera</span>
              <span className="text-3xl font-bold tracking-tight text-foreground">
                {formatWaitTime(tempoMedioEsperaMinutos)}
              </span>
            </div>
            <div className="p-3 bg-blue-500/10 rounded-xl text-blue-500 transition-transform group-hover:scale-110">
              <Clock className="h-6 w-6" />
            </div>
          </div>

          {/* Card 5: Tempo Médio de Atendimento */}
          <div className="bg-card border rounded-xl p-5 flex items-center justify-between shadow-sm relative overflow-hidden group hover:border-primary/40 transition-all">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Média Atendimento</span>
              <span className="text-3xl font-bold tracking-tight text-violet-500 dark:text-violet-400">
                {formatWaitTime(tempoMedioAtendimentoMinutos)}
              </span>
            </div>
            <div className="p-3 bg-violet-500/10 rounded-xl text-violet-500 transition-transform group-hover:scale-110">
              <Activity className="h-6 w-6 animate-pulse" />
            </div>
          </div>
        </div>
      </div>

      {/* Alertas de Sincronização */}
      {syncError && (
        <div className="p-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl dark:bg-red-950/30 dark:border-red-900/50 dark:text-red-400 flex items-center gap-3">
          <XCircle className="h-5 w-5 shrink-0 text-red-500" />
          <div className="flex-1">
            <strong>Erro na sincronização:</strong> {syncError}
          </div>
          <button onClick={() => runSync(true)} className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-md transition-colors font-semibold text-xs flex items-center gap-1">
            <RefreshCcw className="h-3 w-3" /> Tentar Novamente
          </button>
        </div>
      )}

      {syncSuccess && (
        <div className="p-4 text-sm text-green-600 bg-green-50 border border-green-200 rounded-xl dark:bg-green-950/30 dark:border-green-900/50 dark:text-green-400 flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
          <CheckCircle className="h-5 w-5 shrink-0 text-green-500" />
          <div>{syncSuccess}</div>
        </div>
      )}

      {/* Main Container */}
      <div className="bg-card border rounded-xl shadow-sm flex flex-col flex-1 overflow-hidden min-h-[500px]">

        {/* Toolbar de Filtros */}
        <div className="p-5 border-b bg-muted/10 flex flex-col lg:flex-row gap-4 justify-between items-stretch">

          {/* Caixa de Busca */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por paciente ou atendimento..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm bg-background"
            />
          </div>

          {/* Grid de Filtros */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 flex-wrap">

            {/* Filtro Clínica */}
            <div className="relative">
              <select
                value={clinicaFilter}
                onChange={(e) => setClinicaFilter(e.target.value)}
                className="w-full pl-3 pr-8 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-xs bg-background appearance-none cursor-pointer text-ellipsis overflow-hidden"
              >
                <option value="">Clínicas (Todas)</option>
                {uniqueClinicas.map(c => (
                  <option key={c} value={c} className="bg-card text-foreground">{c}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>

            {/* Filtro Triagem */}
            <div className="relative">
              <select
                value={triagemFilter}
                onChange={(e) => setTriagemFilter(e.target.value)}
                className="w-full pl-3 pr-8 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-xs bg-background appearance-none cursor-pointer text-ellipsis"
              >
                <option value="">Triagem (Todas)</option>
                {uniqueTriagens.map(t => (
                  <option key={t} value={t} className="bg-card text-foreground">{t}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>

            {/* Filtro Status */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full pl-3 pr-8 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-xs bg-background appearance-none cursor-pointer text-ellipsis"
              >
                <option value="">Status (Todos)</option>
                {uniqueStatus.map(s => (
                  <option key={s} value={s} className="bg-card text-foreground">{s}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>

            {/* Filtro Internado */}
            <div className="relative">
              <select
                value={internadoFilter}
                onChange={(e) => setInternadoFilter(e.target.value)}
                className="w-full pl-3 pr-8 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-xs bg-background appearance-none cursor-pointer text-ellipsis"
              >
                <option value="">Internação (Todos)</option>
                <option value="S" className="bg-card text-foreground">Internado (Sim)</option>
                <option value="N" className="bg-card text-foreground">Internado (Não)</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>

            {/* Filtro Alta */}
            <div className="flex items-center">
              <label className="flex items-center gap-2.5 text-xs font-semibold text-muted-foreground cursor-pointer bg-background border rounded-lg px-3 py-2 hover:bg-muted/30 transition-all select-none w-full h-[38px] justify-center sm:justify-start">
                <input
                  type="checkbox"
                  checked={mostrarAltas}
                  onChange={(e) => setMostrarAltas(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary/50 h-4 w-4 cursor-pointer accent-primary"
                />
                <span>Mostrar Altas</span>
              </label>
            </div>

          </div>
        </div>

        {/* Tabela */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full min-h-[350px]">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : sortedPacientes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[350px] text-muted-foreground gap-3">
              <HeartPulse className="h-12 w-12 opacity-15" />
              <p className="text-sm font-medium">Nenhum paciente do PA encontrado com os filtros aplicados.</p>
            </div>
          ) : (
            <table className="w-full text-sm text-left border-collapse">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/40 sticky top-0 z-10 border-b">
                <tr>
                  <th className="px-5 py-3.5 font-semibold">Atendimento</th>

                  <th
                    className="px-5 py-3.5 font-semibold cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => handleSort('nm_paciente')}
                  >
                    <div className="flex items-center gap-1.5">
                      Paciente
                      <ArrowUpDown className={`h-3.5 w-3.5 ${sortField === 'nm_paciente' ? 'text-primary' : 'text-muted-foreground/50'}`} />
                    </div>
                  </th>

                  <th
                    className="px-5 py-3.5 font-semibold cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => handleSort('dt_entrada')}
                  >
                    <div className="flex items-center gap-1.5">
                      Horário Entrada
                      <ArrowUpDown className={`h-3.5 w-3.5 ${sortField === 'dt_entrada' ? 'text-primary' : 'text-muted-foreground/50'}`} />
                    </div>
                  </th>

                  <th
                    className="px-5 py-3.5 font-semibold cursor-pointer hover:text-foreground transition-colors text-center"
                    onClick={() => handleSort('tempo_espera')}
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      Tempo Fila
                      <ArrowUpDown className={`h-3.5 w-3.5 ${sortField === 'tempo_espera' ? 'text-primary' : 'text-muted-foreground/50'}`} />
                    </div>
                  </th>

                  <th
                    className="px-5 py-3.5 font-semibold cursor-pointer hover:text-foreground transition-colors text-center"
                    onClick={() => handleSort('tempo_atendimento')}
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      Tempo Atend.
                      <ArrowUpDown className={`h-3.5 w-3.5 ${sortField === 'tempo_atendimento' ? 'text-primary' : 'text-muted-foreground/50'}`} />
                    </div>
                  </th>

                  <th
                    className="px-5 py-3.5 font-semibold cursor-pointer hover:text-foreground transition-colors text-center"
                    onClick={() => handleSort('tempo_total')}
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      Tempo Total
                      <ArrowUpDown className={`h-3.5 w-3.5 ${sortField === 'tempo_total' ? 'text-primary' : 'text-muted-foreground/50'}`} />
                    </div>
                  </th>

                  <th className="px-5 py-3.5 font-semibold">Clínica</th>
                  <th className="px-5 py-3.5 font-semibold text-center">Início Med.</th>
                  <th className="px-5 py-3.5 font-semibold text-center">Lib. Med.</th>
                  <th className="px-5 py-3.5 font-semibold text-center">Status</th>
                  <th className="px-5 py-3.5 font-semibold text-center">Int.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sortedPacientes.map((p) => {
                  const triagemInfo = getTriagemColor(p.ds_triagem);
                  const statusClass = getStatusColor(p.status);
                  const tempoFilaMinutos = getWaitTimeMinutes(p.dt_entrada, p.hr_inicio_consulta);
                  const tempoAtendimentoMinutos = getAtendimentoTimeMinutes(p.hr_inicio_consulta, p.dt_lib_medico, p.dt_alta);
                  const tempoTotalMinutos = getTotalTimeMinutes(p.dt_entrada, p.dt_alta, p.dt_lib_medico);

                  return (
                    <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                      {/* Atendimento */}
                      <td className="px-5 py-4 font-mono font-medium text-foreground">
                        {p.nr_atendimento}
                      </td>

                      {/* Nome do Paciente com indicador de Triagem */}
                      <td className="px-5 py-4 max-w-[220px]" title={p.nm_paciente}>
                        <div className="flex items-center gap-2.5">
                          <div className="relative flex h-3.5 w-3.5 shrink-0" title={p.ds_triagem || 'Sem Classificação'}>
                            {(p.ds_triagem?.toLowerCase().includes('1') ||
                              p.ds_triagem?.toLowerCase().includes('emergencia') ||
                              p.ds_triagem?.toLowerCase().includes('emergência')) && (
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                              )}
                            <span className={`relative inline-flex rounded-full h-3.5 w-3.5 ${getTriagemDotColor(p.ds_triagem)}`}></span>
                          </div>
                          <span className="font-semibold text-foreground truncate">{p.nm_paciente}</span>
                        </div>
                      </td>

                      {/* Horário de Entrada */}
                      <td className="px-5 py-4 text-muted-foreground">
                        {(() => {
                          const d = parseLocalDate(p.dt_entrada);
                          if (!d) return <span className="text-muted-foreground/40">-</span>;
                          return (
                            <div className="flex flex-col">
                              <span className="font-medium text-foreground">
                                {d.toLocaleDateString('pt-BR')}
                              </span>
                              <span className="text-xs">
                                {d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          );
                        })()}
                      </td>

                      {/* Tempo de Fila */}
                      <td className="px-5 py-4 text-center">
                        {p.dt_alta || p.status?.toLowerCase() === 'alta' ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-slate-100 dark:bg-slate-900/30 px-2 py-1 rounded border border-border font-medium" title="Atendimento Concluído">
                            <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                            {formatWaitTime(tempoFilaMinutos)}
                          </span>
                        ) : (
                          <span className={`inline-flex items-center gap-1 font-semibold text-sm ${tempoFilaMinutos > 120
                              ? 'text-red-500'
                              : tempoFilaMinutos > 60
                                ? 'text-yellow-600 dark:text-yellow-400 font-bold'
                                : 'text-emerald-500'
                            }`}>
                            <Clock className="h-3.5 w-3.5" />
                            {formatWaitTime(tempoFilaMinutos)}
                          </span>
                        )}
                      </td>

                      {/* Tempo em Atendimento */}
                      <td className="px-5 py-4 text-center">
                        {!p.hr_inicio_consulta ? (
                          <span className="text-muted-foreground/40 font-medium">-</span>
                        ) : p.dt_lib_medico || p.dt_alta || p.status?.toLowerCase() === 'alta' ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-slate-100 dark:bg-slate-900/30 px-2 py-1 rounded border border-border font-medium">
                            {formatWaitTime(tempoAtendimentoMinutos)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-1 rounded border border-blue-500/20">
                            <Activity className="h-3 w-3 animate-pulse" />
                            {formatWaitTime(tempoAtendimentoMinutos)}
                          </span>
                        )}
                      </td>

                      {/* Tempo Total do Atendimento */}
                      <td className="px-5 py-4 text-center">
                        {p.dt_alta || p.status?.toLowerCase() === 'alta' ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-slate-100 dark:bg-slate-900/30 px-2 py-1 rounded border border-border font-medium">
                            {formatWaitTime(tempoTotalMinutos)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-foreground bg-primary/5 px-2 py-1 rounded border border-border">
                            {formatWaitTime(tempoTotalMinutos)}
                          </span>
                        )}
                      </td>



                      {/* Clínica */}
                      <td className="px-5 py-4 text-muted-foreground font-medium">
                        {p.ds_clinica || <span className="text-muted-foreground/30">Não informada</span>}
                      </td>

                      {/* Início Atendimento Médico */}
                      <td className="px-5 py-4 text-center text-muted-foreground">
                        {(() => {
                          const d = parseLocalDate(p.hr_inicio_consulta);
                          if (!d) {
                            return (
                              <div className="flex justify-center">
                                <span title="Aguardando atendimento médico">
                                  <Hourglass className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                                </span>
                              </div>
                            );
                          }
                          return (
                            <div className="flex flex-col items-center">
                              <span className="font-semibold text-foreground text-xs">
                                {d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <span className="text-[10px] opacity-75">
                                {d.toLocaleDateString('pt-BR')}
                              </span>
                            </div>
                          );
                        })()}
                      </td>

                      {/* Liberação Médica */}
                      <td className="px-5 py-4 text-center text-muted-foreground">
                        {(() => {
                          const d = parseLocalDate(p.dt_lib_medico);
                          if (!d) return <span className="text-muted-foreground/30">-</span>;
                          return (
                            <div className="flex flex-col items-center">
                              <span className="font-semibold text-foreground text-xs">
                                {d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <span className="text-[10px] opacity-75">
                                {d.toLocaleDateString('pt-BR')}
                              </span>
                            </div>
                          );
                        })()}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4 text-center">
                        <span className={`inline-flex px-2.5 py-1 text-xs font-bold rounded-full ${statusClass}`}>
                          {p.status || 'Desconhecido'}
                        </span>
                      </td>

                      {/* Internado? */}
                      <td className="px-5 py-4 text-center">
                        {p.ie_internado === 'S' ? (
                          <span className="inline-flex px-2 py-0.5 text-[10px] font-bold rounded bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400 border border-red-200 dark:border-red-900/40">SIM</span>
                        ) : (
                          <span className="inline-flex px-2 py-0.5 text-[10px] font-bold rounded bg-slate-100 text-slate-800 dark:bg-slate-900/40 dark:text-slate-400 border border-border">NÃO</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Rodapé / Totalizadores */}
        {!loading && sortedPacientes.length > 0 && (
          <div className="p-4 border-t bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-xs text-muted-foreground">
              Mostrando <span className="font-semibold text-foreground">{sortedPacientes.length}</span> pacientes de <span className="font-semibold text-foreground">{pacientes.length}</span> nas últimas 24h.
            </span>
            {lastSyncTime && (
              <span className="text-xs text-muted-foreground bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/20 font-medium">
                Última sincronização: {formatSyncTime(lastSyncTime)}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Controles de Ações Inferiores */}
      <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
        <div className="flex items-center gap-3">
          {/* Alternar Tema */}
          <button
            onClick={toggleTheme}
            className="p-2.5 rounded-lg border bg-background hover:bg-muted text-foreground transition-all shadow-sm flex items-center justify-center h-10 w-10"
            title="Alternar Tema"
          >
            {isDarkMode ? <Sun className="h-4 w-4 text-amber-500" /> : <Moon className="h-4 w-4 text-slate-600" />}
          </button>

          {/* Informação Adicional do Perfil */}
          {profile && (
            <div className="hidden sm:flex items-center gap-2 bg-muted/30 px-3 py-1.5 rounded-lg border text-xs text-muted-foreground">
              <User className="h-3.5 w-3.5" />
              <span>Usuário: <strong>{profile.full_name || profile.email || 'Sistema'}</strong></span>
            </div>
          )}
        </div>

        {/* Botão Sincronizar */}
        <button
          onClick={() => runSync(true)}
          disabled={isSyncing}
          className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/95 disabled:bg-primary/50 px-5 py-2 rounded-lg font-semibold transition-all shadow-sm text-sm h-10 cursor-pointer"
        >
          {isSyncing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Sincronizando...
            </>
          ) : (
            <>
              <RefreshCcw className="h-4 w-4" />
              Sincronizar PA
            </>
          )}
        </button>
      </div>

    </div>
  );
}
