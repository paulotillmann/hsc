import React, { useState, useEffect, useCallback } from 'react';
import { 
  Activity, Search, Loader2, RefreshCcw, Calendar, ChevronDown, 
  User, Stethoscope, SlidersHorizontal, CheckCircle2, 
  Clock, ShieldAlert, ChevronLeft, ChevronRight, LayoutGrid, List, Info, AlertTriangle, AlertCircle
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

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
}

export default function CentroCirurgico() {
  const [cirurgias, setCirurgias] = useState<Cirurgia[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [caraterFilter, setCaraterFilter] = useState('');
  const [salaFilter, setSalaFilter] = useState(''); // Usado na aba de tabela
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Novos estados para a visualização avançada
  const [viewMode, setViewMode] = useState<'salas' | 'tabela'>('salas');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const { profile } = useAuth();

  const fetchCirurgias = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('cirurgias')
        .select('*')
        .order('dt_agenda', { ascending: true });

      if (error) throw error;
      if (data) {
        setCirurgias(data as Cirurgia[]);
      }
    } catch (err) {
      console.error('Erro ao buscar cirurgias:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const runSync = async () => {
    if (isSyncing) return;
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
      setIsSyncing(false);
      // Limpa mensagem de feedback após 5 segundos
      setTimeout(() => setSyncMessage(null), 5000);
    }
  };

  useEffect(() => {
    fetchCirurgias();
  }, [fetchCirurgias]);

  // Navegação de datas
  const handlePrevDay = () => {
    setSelectedDate(prev => {
      const newDate = new Date(prev);
      newDate.setDate(newDate.getDate() - 1);
      return newDate;
    });
  };

  const handleNextDay = () => {
    setSelectedDate(prev => {
      const newDate = new Date(prev);
      newDate.setDate(newDate.getDate() + 1);
      return newDate;
    });
  };

  const handleToday = () => {
    setSelectedDate(new Date());
  };

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

  // Filtragem das cirurgias com base na data selecionada
  const cirurgiasNaData = cirurgias.filter(c => {
    if (!c.dt_agenda) return false;
    const agendaDate = new Date(c.dt_agenda);
    return (
      agendaDate.getDate() === selectedDate.getDate() &&
      agendaDate.getMonth() === selectedDate.getMonth() &&
      agendaDate.getFullYear() === selectedDate.getFullYear()
    );
  });

  // Filtros aplicados no topo (busca e caráter)
  const filteredCirurgias = cirurgiasNaData.filter(c => {
    const matchSearch = 
      (c.nm_paciente?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
      (c.procedimento?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
      (c.medico?.toLowerCase().includes(searchTerm.toLowerCase()) || false);
    
    const matchCarater = caraterFilter === '' || c.ds_carater === caraterFilter;
    const matchSala = viewMode === 'salas' || salaFilter === '' || c.sala === salaFilter;

    return matchSearch && matchCarater && matchSala;
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
  // Filtra cirurgias já finalizadas para não exibi-las nos cards
  const cirurgiasPorSala = SALAS_PAINEL.reduce((acc, salaNum) => {
    const cirurgiasDaSala = filteredCirurgias
      .filter(c => getSalaNormalizada(c.sala) === salaNum)
      .filter(c => !isCirurgiaFinalizada(c.dt_agenda)); // Remove finalizadas dos cards
    // Ordena por horário
    cirurgiasDaSala.sort((a, b) => {
      const t1 = a.dt_agenda ? new Date(a.dt_agenda).getTime() : 0;
      const t2 = b.dt_agenda ? new Date(b.dt_agenda).getTime() : 0;
      return t1 - t2;
    });
    acc[salaNum] = cirurgiasDaSala;
    return acc;
  }, {} as Record<string, Cirurgia[]>);

  // Filtros de caráter únicos das cirurgias gerais para o Select
  const uniqueCarater = Array.from(new Set(cirurgias.map(c => c.ds_carater).filter(Boolean))).sort() as string[];
  const uniqueSalas = Array.from(new Set(cirurgias.map(c => c.sala).filter(Boolean))).sort() as string[];

  // Indicadores (baseados no dia selecionado)
  const totalCirurgias = filteredCirurgias.length;
  const totalEletivas = filteredCirurgias.filter(c => c.ds_carater?.toLowerCase().includes('eletiva') || c.ds_carater?.toLowerCase().includes('eletivo')).length;
  const totalUrgencias = totalCirurgias - totalEletivas;
  const salasAtivas = SALAS_PAINEL.filter(sNum => cirurgiasPorSala[sNum]?.length > 0).length;

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


  // Helper para determinar status em tempo real da cirurgia
  const getCirurgiaStatus = (dateStr: string | null) => {
    if (!dateStr) return { label: 'Agendada', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20', dot: 'bg-blue-500' };
    
    const now = new Date();
    const agendaTime = new Date(dateStr);
    
    // Diferença em minutos
    const diffMs = now.getTime() - agendaTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    // Se estiver no dia de hoje e o horário atual for entre 15 minutos antes e 2 horas depois do agendado
    const isToday = now.getDate() === agendaTime.getDate() && 
                    now.getMonth() === agendaTime.getMonth() && 
                    now.getFullYear() === agendaTime.getFullYear();

    if (isToday) {
      if (diffMins >= -15 && diffMins <= 120) {
        return { label: 'Em Procedimento', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20 animate-pulse', dot: 'bg-amber-500 animate-ping' };
      } else if (diffMins > 120) {
        return { label: 'Finalizada', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20', dot: 'bg-emerald-500' };
      }
    }
    
    return { label: 'Agendada', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20', dot: 'bg-blue-500' };
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
          {syncMessage && (
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium animate-in fade-in slide-in-from-top duration-300 ${
              syncMessage.type === 'success' 
                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' 
                : 'bg-destructive/10 text-destructive border-destructive/20'
            }`}>
              {syncMessage.type === 'success' && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
              <span>{syncMessage.text}</span>
            </div>
          )}

          {lastSyncTime && !syncMessage && (
            <span className="text-xs text-muted-foreground self-center">
              Última Sync: {lastSyncTime.toLocaleTimeString('pt-BR')}
            </span>
          )}

          <div className="flex items-center gap-2 border rounded-lg p-1 bg-muted/30">
            <button
              onClick={() => setViewMode('salas')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                viewMode === 'salas'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Painel de Salas
            </button>
            <button
              onClick={() => setViewMode('tabela')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                viewMode === 'tabela'
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

      {/* Seletor de Data Premium no Topo do Painel */}
      <div className="bg-card border rounded-xl p-4 flex flex-col md:flex-row justify-between items-center gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <Calendar className="h-5 w-5 text-primary" />
          <span className="font-semibold text-foreground text-sm md:text-base">
            Cronograma do Dia:
          </span>
          <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-0.5">
            <button 
              onClick={handlePrevDay}
              className="p-1.5 hover:bg-background rounded-md transition-all text-muted-foreground hover:text-foreground"
              title="Dia Anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-3 py-1 font-bold text-sm text-foreground min-w-[120px] text-center">
              {selectedDate.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}
            </span>
            <button 
              onClick={handleNextDay}
              className="p-1.5 hover:bg-background rounded-md transition-all text-muted-foreground hover:text-foreground"
              title="Próximo Dia"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <button 
            onClick={handleToday}
            className="px-2.5 py-1.5 hover:bg-muted text-xs font-semibold rounded-md border text-muted-foreground hover:text-foreground transition-all"
          >
            Hoje
          </button>
        </div>

        {/* Resumo da Ocupação */}
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-muted-foreground font-medium">
              Salas Ocupadas: <strong className="text-foreground font-bold">{salasAtivas} de 7</strong>
            </span>
          </div>
          <div className="h-4 w-px bg-border hidden sm:block"></div>
          <span className="text-muted-foreground font-medium hidden sm:inline">
            Total de Cirurgias no Dia: <strong className="text-foreground font-bold">{totalCirurgias}</strong>
          </span>
        </div>
      </div>

      {/* Grid de Indicadores Premium */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Card 1: Total Cirurgias */}
        <div className="bg-card border rounded-xl px-6 py-5 flex items-center justify-between shadow-sm relative overflow-hidden group hover:border-primary/40 transition-all hover:shadow-md">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-muted-foreground">Cirurgias no Dia Selecionado</span>
            <span className="text-4xl font-bold tracking-tight text-foreground">{totalCirurgias}</span>
          </div>
          <div className="p-3.5 bg-primary/10 rounded-xl text-primary transition-transform group-hover:scale-110">
            <Activity className="h-6 w-6" />
          </div>
        </div>

        {/* Card 2: Eletivas vs Urgências */}
        <div className="bg-card border rounded-xl px-6 py-5 flex flex-col gap-3 shadow-sm relative overflow-hidden group hover:border-primary/40 transition-all hover:shadow-md">
          <div className="flex items-center justify-between w-full">
            <span className="text-sm font-medium text-muted-foreground">Caráter no Dia</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-500 border border-orange-500/20">
              {totalUrgencias} Urgência{totalUrgencias !== 1 && 's'}
            </span>
          </div>
          
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-xs font-medium text-muted-foreground">
              <span>{totalEletivas} Eletiva{totalEletivas !== 1 && 's'}</span>
              <span>{totalCirurgias > 0 ? Math.round((totalEletivas / totalCirurgias) * 100) : 0}%</span>
            </div>
            {/* Barra de Progresso customizada */}
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary rounded-full transition-all duration-500" 
                style={{ width: `${totalCirurgias > 0 ? (totalEletivas / totalCirurgias) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 3: Salas Ocupadas */}
        <div className="bg-card border rounded-xl px-6 py-5 flex items-center justify-between shadow-sm relative overflow-hidden group hover:border-primary/40 transition-all hover:shadow-md">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-muted-foreground">Taxa de Utilização de Salas</span>
            <span className="text-4xl font-bold tracking-tight text-foreground">
              {Math.round((salasAtivas / 7) * 100)}<span className="text-xl font-semibold text-muted-foreground">%</span>
            </span>
          </div>
          <div className="p-3.5 bg-blue-500/10 rounded-xl text-blue-500 transition-transform group-hover:scale-110">
            <Calendar className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Toolbar de Filtros e Busca */}
      <div className="bg-card border rounded-xl p-4 flex flex-col md:flex-row gap-4 bg-muted/10 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por paciente, procedimento ou médico..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm bg-background text-foreground"
          />
        </div>

        <div className="flex items-center gap-3">
          {/* Filtro de Caráter */}
          <div className="relative w-full md:w-48">
            <SlidersHorizontal className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <select
              value={caraterFilter}
              onChange={(e) => setCaraterFilter(e.target.value)}
              className="w-full pl-9 pr-8 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm bg-background text-foreground appearance-none cursor-pointer"
            >
              <option value="">Caráter (Todos)</option>
              {uniqueCarater.map(carater => (
                <option key={carater} value={carater}>{carater}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          </div>

          {/* Filtro de Sala para aba de Tabela */}
          {viewMode === 'tabela' && (
            <div className="relative w-full md:w-48">
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
          )}
        </div>
      </div>

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
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
            {SALAS_PAINEL.map((salaNum) => {
              const fila = cirurgiasPorSala[salaNum] || [];
              const ocupada = fila.length > 0;
              const principal = fila[0];
              
              // Se houver cirurgia principal, determina o status e se é urgente
              const statusInfo = ocupada ? getCirurgiaStatus(principal.dt_agenda) : null;
              const isUrgente = ocupada && (principal.ds_carater?.toLowerCase().includes('urg') || principal.ds_carater?.toLowerCase().includes('emerg'));

              return (
                <div 
                  key={salaNum}
                  className={`bg-card border rounded-xl shadow-sm flex flex-col transition-all duration-300 relative overflow-hidden group hover:shadow-md ${
                    ocupada 
                      ? isUrgente 
                        ? 'border-orange-500/30 hover:border-orange-500/50 hover:shadow-orange-500/5' 
                        : 'border-primary/30 hover:border-primary/50 hover:shadow-primary/5'
                      : 'border-border opacity-90 hover:opacity-100'
                  }`}
                >
                  {/* Cabeçalho do Card */}
                  <div className={`p-4 border-b flex items-center justify-between transition-colors ${
                    ocupada 
                      ? isUrgente 
                        ? 'bg-orange-500/5 border-orange-500/10' 
                        : 'bg-primary/5 border-primary/10'
                      : 'bg-muted/10'
                  }`}>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground text-lg">Sala {salaNum}</span>
                      {fila.length > 1 && (
                        <span className="bg-muted px-1.5 py-0.5 rounded text-[10px] font-bold text-muted-foreground border">
                          +{fila.length - 1} na fila
                        </span>
                      )}
                    </div>
                    {ocupada ? (
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${statusInfo?.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${statusInfo?.dot}`} />
                        {statusInfo?.label}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Disponível
                      </span>
                    )}
                  </div>

                  {/* Corpo do Card */}
                  <div className="p-5 flex-1 flex flex-col gap-4">
                    {ocupada ? (
                      <>
                        {/* Horário e Caráter */}
                        <div className="flex items-center justify-between">
                          <span className="inline-flex items-center gap-1.5 font-bold px-2.5 py-1 rounded-md text-xs bg-primary/10 text-primary border border-primary/20">
                            <Clock className="h-3.5 w-3.5" />
                            {formatTime(principal.dt_agenda)}
                          </span>
                          <span className={`inline-flex px-2.5 py-0.5 text-[10px] font-bold uppercase rounded-full border ${
                            isUrgente
                              ? 'bg-orange-500/10 text-orange-500 border-orange-500/20'
                              : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                          }`}>
                            {principal.ds_carater || 'Eletiva'}
                          </span>
                        </div>

                        {/* Detalhes do Paciente */}
                        <div className="flex flex-col gap-1.5 bg-muted/20 p-3 rounded-lg border border-border/40">
                          <div className="flex items-start gap-2.5">
                            <div className="p-1.5 bg-primary/10 rounded-md text-primary mt-0.5">
                              <User className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-sm text-foreground uppercase truncate" title={principal.nm_paciente || ''}>
                                {principal.nm_paciente}
                              </h4>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {principal.idade ? `${principal.idade} anos` : 'Idade N/I'} • {principal.ds_sexo || 'Sexo N/I'}
                              </p>
                              {principal.nr_atendimento && (
                                <p className="text-[10px] text-muted-foreground/80 mt-1 font-mono">
                                  Atend: {principal.nr_atendimento}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Procedimento */}
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Procedimento</span>
                          <p className="text-sm font-semibold text-foreground line-clamp-2 leading-relaxed whitespace-normal break-words" title={principal.procedimento || ''}>
                            {principal.procedimento || 'Não informado'}
                          </p>
                        </div>

                        {/* Equipe Médica */}
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
                        </div>

                        {/* Outras cirurgias na fila do dia nesta sala */}
                        {fila.length > 1 && (
                          <div className="pt-3 border-t border-dashed mt-3">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1 mb-2">
                              <Calendar className="h-3 w-3" />
                              Próximas Cirurgias do Dia
                            </span>
                            <div className="flex flex-col gap-2 max-h-[120px] overflow-y-auto pr-1 scrollbar-thin">
                              {fila.slice(1).map((prox, idx) => (
                                <div key={prox.id} className="text-xs bg-muted/40 p-2 rounded border border-border/30 hover:bg-muted/70 transition-all flex items-start justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <p className="font-semibold text-foreground uppercase truncate">{prox.nm_paciente}</p>
                                    <p className="text-[10px] text-muted-foreground truncate">{prox.procedimento}</p>
                                  </div>
                                  <span className="text-[10px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded flex-shrink-0 self-center">
                                    {formatTime(prox.dt_agenda)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      /* Estado Vazio - Sala Livre */
                      <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-muted-foreground gap-3.5 my-auto">
                        <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-full border border-emerald-500/20 group-hover:scale-105 transition-transform">
                          <CheckCircle2 className="h-8 w-8" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <h5 className="font-bold text-foreground text-sm">Nenhum procedimento</h5>
                          <p className="text-xs max-w-[200px] leading-relaxed">
                            Esta sala está livre e higienizada para novos agendamentos hoje.
                          </p>
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
                    Existem {cirurgiasForaDoPadrao.length} cirurgias agendadas em salas que não estão no painel padrão (Salas 1 a 7).
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
                    <th className="px-6 py-4 font-semibold">Horário</th>
                    <th className="px-6 py-4 font-semibold">Paciente</th>
                    <th className="px-6 py-4 font-semibold">Procedimento</th>
                    <th className="px-6 py-4 font-semibold">Médico Responsável</th>
                    <th className="px-6 py-4 font-semibold text-center">Sala</th>
                    <th className="px-6 py-4 font-semibold text-center">Caráter</th>
                    <th className="px-6 py-4 font-semibold">Anestesista</th>
                    <th className="px-6 py-4 text-right pr-8">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredCirurgias.map((c) => {
                    const isUrgente = c.ds_carater?.toLowerCase().includes('urg') || c.ds_carater?.toLowerCase().includes('emerg');
                    const statusInfo = getCirurgiaStatus(c.dt_agenda);
                    
                    return (
                      <tr key={c.id} className="hover:bg-muted/20 transition-all duration-150">
                        {/* Horário */}
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center font-bold px-2.5 py-1 rounded-md text-sm bg-primary/10 text-primary border border-primary/20">
                            {formatTime(c.dt_agenda)}
                          </span>
                        </td>

                        {/* Paciente */}
                        <td className="px-6 py-4 font-medium text-foreground min-w-[180px]">
                          <div className="flex flex-col">
                            <span className="font-semibold text-foreground text-sm">{c.nm_paciente}</span>
                            <span className="text-xs text-muted-foreground mt-0.5">
                              {c.idade ? `${c.idade} anos` : 'Idade N/I'} • {c.ds_sexo || 'Sexo N/I'}
                            </span>
                          </div>
                        </td>

                        {/* Procedimento */}
                        <td className="px-6 py-4 text-sm font-medium text-foreground max-w-[280px] min-w-[200px] whitespace-normal break-words" title={c.procedimento || ''}>
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
                          <span className="inline-flex px-2.5 py-1 text-xs font-bold rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20">
                            {c.sala || 'N/I'}
                          </span>
                        </td>

                        {/* Caráter */}
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex px-2.5 py-1 text-xs font-bold rounded-full border ${
                            isUrgente
                              ? 'bg-orange-500/10 text-orange-500 border-orange-500/20'
                              : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                          }`}>
                            {c.ds_carater || 'Eletiva'}
                          </span>
                        </td>

                        {/* Anestesista */}
                        <td className="px-6 py-4 text-sm text-muted-foreground min-w-[150px]">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span className="whitespace-normal break-words">{c.nm_anestesista || 'Sem anestesista'}</span>
                          </div>
                        </td>

                        {/* Data */}
                        <td className="px-6 py-4 text-right pr-8 font-medium text-sm text-muted-foreground">
                          {formatDate(c.dt_agenda)}
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
                Mostrando <span className="font-semibold text-foreground">{filteredCirurgias.length}</span> cirurgia{filteredCirurgias.length !== 1 && 's'} agendada{filteredCirurgias.length !== 1 && 's'} para o dia selecionado.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

