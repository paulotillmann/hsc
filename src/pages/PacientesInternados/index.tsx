import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BedDouble, Search, Loader2, RefreshCcw, Calendar, CheckCircle, XCircle, ChevronDown, LogOut, Moon, Sun } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import SyncModal from './SyncModal';
import { useAuth } from '../../contexts/AuthContext';

interface Paciente {
  id: string;
  nr_atendimento: number;
  paciente: string;
  ds_setor_atendimento: string | null;
  cd_cid_principal: string | null;
  dias_internado: number | null;
  teve_evolucao_hoje: string | null;
  previsao_alta: string | null;
  ativo: boolean;
  dt_entrada: string | null;
  leito: string | null;
  ultima_prescricao: string | null;
}

const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos

export default function PacientesInternados() {
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [setorTerm, setSetorTerm] = useState('');



  // Sync Modal (apenas para usuários sem setor)
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

  // Auto-sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState(false);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { profile, signOut } = useAuth();

  // Theme state
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

  const handleLogout = async () => {
    await signOut();
    window.location.href = '/';
  };

  const fetchPacientes = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('pacientes_internados')
      .select('id, nr_atendimento, paciente, ds_setor_atendimento, cd_cid_principal, dias_internado, teve_evolucao_hoje, previsao_alta, ativo, dt_entrada, leito, ultima_prescricao')
      .eq('ativo', true)
      .order('paciente', { ascending: true });

    if (profile?.setor_usuarios) {
      query = query.eq('ds_setor_atendimento', profile.setor_usuarios);
    }

    const { data, error } = await query;

    if (!error && data) {
      setPacientes(data);
    }
    setLoading(false);
  }, [profile?.setor_usuarios]);

  // Sincronização automática em background (chama a Edge Function)
  const runAutoSync = useCallback(async () => {
    if (isSyncing) return; // Evita execuções simultâneas

    setIsSyncing(true);
    setSyncError(false);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://drbzogwimvaziaydwqfk.supabase.co';

      const response = await fetch(`${supabaseUrl}/functions/v1/trigger_n8n_sync_pacientes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();

      if (result.success) {
        setLastSyncTime(new Date());
        // Recarrega os dados do banco após sync bem-sucedida
        await fetchPacientes();
      } else {
        console.error('Erro na sincronização automática:', result.error);
        setSyncError(true);
      }
    } catch (err) {
      console.error('Erro na sincronização automática:', err);
      setSyncError(true);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, fetchPacientes]);

  // Carregamento inicial dos dados
  useEffect(() => {
    fetchPacientes();
  }, [fetchPacientes]);

  // Cron job: sincroniza a cada 5 minutos
  useEffect(() => {
    // Executa a primeira sincronização imediatamente
    runAutoSync();

    // Configura o intervalo
    syncIntervalRef.current = setInterval(() => {
      runAutoSync();
    }, SYNC_INTERVAL_MS);

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  // Setores únicos para o dropdown
  const uniqueSetores = Array.from(
    new Set(pacientes.map(p => p.ds_setor_atendimento).filter(Boolean))
  ).sort() as string[];

  // Filtragem
  const filteredPacientes = pacientes.filter(p => {
    const matchName = p.paciente?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchSetor = p.ds_setor_atendimento?.toLowerCase().includes(setorTerm.toLowerCase()) || setorTerm === '';
    return matchName && matchSetor;
  });

  // Todos os registros filtrados sendo exibidos (sem paginação)
  const currentRecords = filteredPacientes;

  // Formata horário da última sync
  const formatSyncTime = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 md:p-8 animate-in fade-in zoom-in duration-500">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl">
              <BedDouble className="h-6 w-6 text-primary" />
            </div>
            Pacientes Internados {profile?.setor_usuarios ? `- ${profile.setor_usuarios}` : ''}
          </h1>
          <p className="text-muted-foreground">
            Acompanhamento de pacientes atualmente internados na instituição.
          </p>
          <div className="flex flex-wrap items-center gap-4 mt-2 text-xs">
            <span className="font-semibold uppercase tracking-wider text-muted-foreground/80">Legenda:</span>
            <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
              <XCircle className="h-4 w-4 text-red-500 dark:text-red-400" />
              <span>Não informado</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
              <CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400" />
              <span>Ok, realizado</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Indicador de Sincronização Automática */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground select-none">
            {isSyncing ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/40">
                <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                <span className="text-blue-600 dark:text-blue-400 font-medium">Sincronizando...</span>
              </div>
            ) : syncError ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40">
                <span className="relative flex h-2 w-2">
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
                <span className="text-red-600 dark:text-red-400 font-medium">Erro na sync</span>
              </div>
            ) : lastSyncTime ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                  Sync {formatSyncTime(lastSyncTime)}
                </span>
              </div>
            ) : null}
          </div>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2.5 rounded-md border bg-background hover:bg-muted text-foreground transition-colors shadow-sm flex items-center justify-center"
            title="Alternar Tema"
          >
            {isDarkMode ? <Sun className="h-5 w-5 text-amber-500" /> : <Moon className="h-5 w-5 text-slate-600" />}
          </button>

          {/* Botão Sincronizar - apenas para usuários SEM setor definido */}
          {!profile?.setor_usuarios && (
            <button
              onClick={() => setIsSyncModalOpen(true)}
              className="flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 rounded-md font-medium transition-colors shadow-sm"
            >
              <RefreshCcw className="h-5 w-5" />
              Sincronizar Pacientes
            </button>
          )}

          {/* Botão Sair - apenas para usuários com setor definido */}
          {profile?.setor_usuarios && (
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 bg-red-600/10 text-red-600 hover:bg-red-600/20 px-4 py-2 rounded-md font-medium transition-colors shadow-sm border border-red-600/20"
              title="Sair do Sistema"
            >
              <LogOut className="h-5 w-5" />
              Sair
            </button>
          )}
        </div>
      </div>

      <div className="bg-card border rounded-lg shadow-sm flex flex-col flex-1 overflow-hidden min-h-[500px]">
        {/* Toolbar & Filters */}
        {!profile?.setor_usuarios && (
          <div className="p-4 border-b flex flex-col md:flex-row gap-4 justify-between bg-muted/20">
            <div className="flex flex-1 gap-4 max-w-2xl">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Buscar por nome do paciente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm bg-background"
                />
              </div>
              <div className="relative flex-1">
                <BedDouble className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <select
                  value={setorTerm}
                  onChange={(e) => setSetorTerm(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm bg-background appearance-none cursor-pointer"
                >
                  <option value="">Todos os Setores</option>
                  {uniqueSetores.map(setor => (
                    <option key={setor} value={setor}>
                      {setor}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full min-h-[400px]">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : currentRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-muted-foreground gap-2">
              <BedDouble className="h-12 w-12 opacity-20" />
              <p>Nenhum paciente internado encontrado com os filtros atuais.</p>
            </div>
          ) : (
            <table className="w-full text-base text-left">
              <thead className="text-sm text-muted-foreground uppercase bg-muted/50 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-6 py-3 font-semibold">Atendimento</th>
                  <th className="px-6 py-3 font-semibold">Paciente</th>
                  <th className="px-6 py-3 font-semibold text-center">Leito</th>
                  {!profile?.setor_usuarios && <th className="px-6 py-3 font-semibold">Setor</th>}
                  <th className="px-6 py-3 font-semibold text-center">CID</th>
                  <th className="px-6 py-3 font-semibold">Data Entrada</th>
                  <th className="px-6 py-3 font-semibold">Dias Int.</th>
                  <th className="px-6 py-3 font-semibold text-center">Prev. Alta</th>
                  <th className="px-6 py-3 font-semibold text-center">Últ. Prescrição</th>
                  <th className="px-6 py-3 font-semibold text-center">EV. Médica</th>
                  <th className="px-6 py-3 font-semibold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {currentRecords.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4 font-medium text-foreground">
                      {p.nr_atendimento}
                    </td>
                    <td className="px-6 py-4 font-medium text-foreground">
                      {p.paciente}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {p.leito ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 border border-blue-100 dark:border-blue-800/30">
                          {p.leito}
                        </span>
                      ) : (
                        <div className="flex justify-center">
                          <XCircle className="h-5 w-5 text-red-500 dark:text-red-400" title="Sem leito" />
                        </div>
                      )}
                    </td>
                    {!profile?.setor_usuarios && (
                      <td className="px-6 py-4 text-muted-foreground">
                        {p.ds_setor_atendimento || (
                          <div className="flex justify-start">
                            <XCircle className="h-5 w-5 text-red-500 dark:text-red-400" title="Sem setor" />
                          </div>
                        )}
                      </td>
                    )}
                    <td className="px-6 py-4 text-center">
                      {p.cd_cid_principal ? (
                        <span className="inline-flex items-center justify-center px-2.5 py-1 rounded text-sm font-bold bg-blue-600/20 text-white dark:bg-blue-500/20 font-mono tracking-wider shadow-sm min-w-[3rem]">
                          {p.cd_cid_principal}
                        </span>
                      ) : (
                        <div className="flex justify-center">
                          <XCircle className="h-5 w-5 text-red-500 dark:text-red-400" title="Sem CID" />
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 font-medium text-foreground">
                      {p.dt_entrada ? new Date(p.dt_entrada).toLocaleDateString('pt-BR') : (
                        <div className="flex justify-start">
                          <XCircle className="h-5 w-5 text-red-500 dark:text-red-400" title="Sem data de entrada" />
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 font-medium text-foreground">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>{p.dias_internado ?? 0}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium text-foreground text-center">
                      {p.previsao_alta ? (() => {
                        const hoje = new Date();
                        hoje.setHours(0, 0, 0, 0);
                        const hojeTime = hoje.getTime();

                        // Parse da data de previsão (vem como string YYYY-MM-DD do banco)
                        const [year, month, day] = p.previsao_alta.split('T')[0].split('-').map(Number);
                        const previsao = new Date(year, month - 1, day);
                        previsao.setHours(0, 0, 0, 0);
                        const previsaoTime = previsao.getTime();

                        // Previsão - 1 dia
                        const previsaoMenos1 = new Date(previsaoTime);
                        previsaoMenos1.setDate(previsaoMenos1.getDate() - 1);
                        const previsaoMenos1Time = previsaoMenos1.getTime();

                        // Determina a cor
                        let colorClass = '';
                        if (hojeTime > previsaoTime) {
                          // Data atual MAIOR que previsão → VERMELHO
                          colorClass = 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800/40';
                        } else if (hojeTime === previsaoMenos1Time || hojeTime === previsaoTime) {
                          // Data atual = previsão - 1 dia OU data atual = previsão → LARANJA
                          colorClass = 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border border-orange-200 dark:border-orange-800/40';
                        }

                        const dataFormatada = previsao.toLocaleDateString('pt-BR');

                        return colorClass ? (
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ${colorClass}`}>
                            {dataFormatada}
                          </span>
                        ) : (
                          <span>{dataFormatada}</span>
                        );
                      })() : (
                        <div className="flex justify-center">
                          <XCircle className="h-5 w-5 text-red-500 dark:text-red-400" title="Sem previsão" />
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {p.ultima_prescricao ? (
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border ${(() => {
                          const diff = new Date().getTime() - new Date(p.ultima_prescricao).getTime();
                          return diff >= 0 && diff <= 30 * 60 * 1000;
                        })()
                          ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300 border-green-100 dark:border-green-800/30'
                          : 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 border-blue-100 dark:border-blue-800/30'
                          }`}>
                          {new Date(p.ultima_prescricao).toLocaleDateString('pt-BR')} {new Date(p.ultima_prescricao).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      ) : (
                        <div className="flex justify-center">
                          <XCircle className="h-5 w-5 text-red-500 dark:text-red-400" title="Sem prescrição" />
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {p.teve_evolucao_hoje === 'S' ? (
                        <div className="flex justify-center">
                          <CheckCircle className="h-5 w-5 text-green-500 dark:text-green-400" title="Sim" />
                        </div>
                      ) : (
                        <div className="flex justify-center">
                          <XCircle className="h-5 w-5 text-red-500 dark:text-red-400" title="Não" />
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex px-3 py-1.5 text-sm font-semibold rounded-full ${p.ativo
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                        : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                        {p.ativo ? 'Internado' : 'Alta'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Total de registros */}
        {!loading && filteredPacientes.length > 0 && (
          <div className="p-4 border-t bg-muted/20 flex flex-col md:flex-row items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">
              Total de <span className="font-medium text-foreground">{filteredPacientes.length}</span> resultados
            </span>
          </div>
        )}
      </div>

      <SyncModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        onSuccess={fetchPacientes}
      />

    </div>
  );
}
