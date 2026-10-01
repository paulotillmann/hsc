// src/pages/CentroMedico/PacientesConfirmados.tsx
import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  Clock,
  Calendar,
  User,
  Search,
  RefreshCw,
  Filter,
  Building2,
  Phone,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Stethoscope,
  HeartHandshake,
  CalendarDays,
  ArrowRight
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  ConsultaAgendada,
  INITIAL_CONSULTAS,
  KANBAN_CONFIRMED_KEY,
  KANBAN_STORAGE_KEY,
  TODAY,
  getDateOffset,
  formatDateLabel
} from './consultasData';

export default function PacientesConfirmados() {
  const [selectedDate, setSelectedDate] = useState<string>(TODAY);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'TODOS' | 'CONFIRMADOS' | 'PENDENTES'>('TODOS');
  const [selectedEspecialidade, setSelectedEspecialidade] = useState('TODAS');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Mapa de confirmações salvas no localStorage
  const [confirmedMap, setConfirmedMap] = useState<Record<string, { confirmadoPeloPaciente: boolean; confirmadoEm?: string }>>(() => {
    try {
      const stored = localStorage.getItem(KANBAN_CONFIRMED_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  // Mapa de status do Kanban
  const [statusMap, setStatusMap] = useState<Record<string, string>>(() => {
    try {
      const stored = localStorage.getItem(KANBAN_STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  // Sincronização com eventos locais e remotos
  useEffect(() => {
    const handleStorageChange = () => {
      try {
        const storedConf = localStorage.getItem(KANBAN_CONFIRMED_KEY);
        if (storedConf) setConfirmedMap(JSON.parse(storedConf));
        const storedStatus = localStorage.getItem(KANBAN_STORAGE_KEY);
        if (storedStatus) setStatusMap(JSON.parse(storedStatus));
      } catch (err) {
        console.error('Erro ao ler localStorage em PacientesConfirmados:', err);
      }
    };

    const handleCustomEvent = (e: any) => {
      const detail = e.detail;
      if (detail && detail.cardId) {
        setConfirmedMap(prev => ({
          ...prev,
          [detail.cardId]: {
            confirmadoPeloPaciente: detail.confirmado,
            confirmadoEm: detail.confirmado ? new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : undefined
          }
        }));
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('consulta_confirmada_evento', handleCustomEvent);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('consulta_confirmada_evento', handleCustomEvent);
    };
  }, []);

  // Consultas combinadas com o estado das confirmações
  const allConsultas = useMemo(() => {
    return INITIAL_CONSULTAS.map(c => {
      const isConf = confirmedMap[c.id]?.confirmadoPeloPaciente || c.confirmadoPeloPaciente;
      const confEm = confirmedMap[c.id]?.confirmadoEm || c.confirmadoEm;
      return {
        ...c,
        confirmadoPeloPaciente: isConf,
        confirmadoEm: confEm
      };
    });
  }, [confirmedMap]);

  // Lista de especialidades únicas
  const especialidades = useMemo(() => {
    const setEsp = new Set<string>();
    INITIAL_CONSULTAS.forEach(c => setEsp.add(c.especialidade));
    return ['TODAS', ...Array.from(setEsp).sort()];
  }, []);

  // Filtragem das consultas
  const filteredConsultas = useMemo(() => {
    return allConsultas.filter(c => {
      // Filtro de data
      if (c.data !== selectedDate) return false;

      // Filtro de status
      if (statusFilter === 'CONFIRMADOS' && !c.confirmadoPeloPaciente) return false;
      if (statusFilter === 'PENDENTES' && c.confirmadoPeloPaciente) return false;

      // Filtro de especialidade
      if (selectedEspecialidade !== 'TODAS' && c.especialidade !== selectedEspecialidade) return false;

      // Filtro de busca
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesPaciente = c.paciente.toLowerCase().includes(query);
        const matchesPront = c.prontuario.toLowerCase().includes(query);
        const matchesMedico = c.medico.toLowerCase().includes(query);
        const matchesConvenio = c.convenio.toLowerCase().includes(query);
        if (!matchesPaciente && !matchesPront && !matchesMedico && !matchesConvenio) return false;
      }

      return true;
    });
  }, [allConsultas, selectedDate, statusFilter, selectedEspecialidade, searchTerm]);

  // Métricas do dia selecionado
  const metrics = useMemo(() => {
    const diaConsultas = allConsultas.filter(c => c.data === selectedDate);
    const total = diaConsultas.length;
    const confirmados = diaConsultas.filter(c => c.confirmadoPeloPaciente).length;
    const pendentes = total - confirmados;
    const porcentagem = total > 0 ? Math.round((confirmados / total) * 100) : 0;
    return { total, confirmados, pendentes, porcentagem };
  }, [allConsultas, selectedDate]);

  // Alternar confirmação do paciente
  const handleToggleConfirmacao = async (consulta: ConsultaAgendada) => {
    const isCurrentlyConfirmed = !!consulta.confirmadoPeloPaciente;
    const newStatus = !isCurrentlyConfirmed;
    const timestamp = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    // 1. Atualizar confirmedMap no localStorage
    const newMap = {
      ...confirmedMap,
      [consulta.id]: {
        confirmadoPeloPaciente: newStatus,
        confirmadoEm: newStatus ? timestamp : undefined,
        data: new Date().toISOString()
      }
    };
    setConfirmedMap(newMap);
    try {
      localStorage.setItem(KANBAN_CONFIRMED_KEY, JSON.stringify(newMap));
    } catch (err) {
      console.error('Erro ao salvar confirmação:', err);
    }

    // 2. Se confirmado, atualiza no Kanban manual para ir para a coluna 'Confirmadas'
    if (newStatus) {
      const newStatusMap = {
        ...statusMap,
        [consulta.id]: 'Confirmadas'
      };
      setStatusMap(newStatusMap);
      try {
        localStorage.setItem(KANBAN_STORAGE_KEY, JSON.stringify(newStatusMap));
      } catch (err) {
        console.error('Erro ao salvar status no Kanban:', err);
      }
    }

    // 3. Dispara evento global para o Centro Médico sincronizar instantaneamente
    window.dispatchEvent(
      new CustomEvent('consulta_confirmada_evento', {
        detail: {
          cardId: consulta.id,
          confirmado: newStatus,
          timestamp: newStatus ? timestamp : null
        }
      })
    );

    // 4. Salvar assincronamente no Supabase se disponível
    try {
      await supabase.from('centro_medico_kanban_cards').upsert(
        {
          card_id: consulta.id,
          column_id: newStatus ? 'Confirmadas' : 'Agendamentos',
          paciente: consulta.paciente,
          medico: consulta.medico,
          horario: consulta.horario,
          data: consulta.data,
          confirmado_paciente: newStatus,
          confirmado_em: newStatus ? new Date().toISOString() : null,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'card_id' }
      );
    } catch (err) {
      // Ignora erro remoto caso a tabela ainda esteja em migração
    }

    // 5. Exibir Toast de feedback
    if (newStatus) {
      setToastMessage(`Consulta de ${consulta.paciente} confirmada com sucesso! O agendamento na tela Centro Médico ficou completamente verde.`);
    } else {
      setToastMessage(`Confirmação de ${consulta.paciente} desfeita.`);
    }

    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // Copiar link do canal seguro para o paciente
  const handleCopyLink = (consulta: ConsultaAgendada) => {
    const url = `${window.location.origin}/confirmar-consulta?id=${consulta.id}&paciente=${encodeURIComponent(
      consulta.paciente
    )}&medico=${encodeURIComponent(consulta.medico)}&crm=${encodeURIComponent(
      consulta.crm
    )}&esp=${encodeURIComponent(consulta.especialidade)}&hora=${encodeURIComponent(
      consulta.horario
    )}&data=${encodeURIComponent(formatDateLabel(consulta.data))}&convenio=${encodeURIComponent(
      consulta.convenio
    )}`;

    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(consulta.id);
      setTimeout(() => setCopiedId(null), 2500);
      setToastMessage('Link de Confirmação de Consulta copiado para a área de transferência!');
      setTimeout(() => setToastMessage(null), 3000);
    });
  };

  // Abrir canal seguro do paciente em nova aba
  const handleOpenCanalSeguro = (consulta?: ConsultaAgendada) => {
    if (consulta) {
      const url = `/confirmar-consulta?id=${consulta.id}&paciente=${encodeURIComponent(
        consulta.paciente
      )}&medico=${encodeURIComponent(consulta.medico)}&crm=${encodeURIComponent(
        consulta.crm
      )}&esp=${encodeURIComponent(consulta.especialidade)}&hora=${encodeURIComponent(
        consulta.horario
      )}&data=${encodeURIComponent(formatDateLabel(consulta.data))}&convenio=${encodeURIComponent(
        consulta.convenio
      )}`;
      window.open(url, '_blank');
    } else {
      window.open('/confirmar-consulta', '_blank');
    }
  };

  const handleStepDay = (step: number) => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + step);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    try {
      const storedConf = localStorage.getItem(KANBAN_CONFIRMED_KEY);
      if (storedConf) setConfirmedMap(JSON.parse(storedConf));
    } catch {}
    setTimeout(() => setIsRefreshing(false), 500);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Toast de Alerta Flutuante */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-6 right-6 z-50 max-w-md bg-emerald-600 text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-start gap-3 border border-emerald-400"
          >
            <CheckCircle2 className="h-5 w-5 text-white shrink-0 mt-0.5" />
            <div className="flex-1 text-xs sm:text-sm font-medium leading-relaxed">
              {toastMessage}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── HEADER DA TELA INDEPENDENTE ── */}
      <div className="bg-card border border-border/80 p-6 rounded-3xl shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative overflow-hidden">
        <div className="flex items-start sm:items-center gap-4 relative z-10">
          <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20 shadow-inner shrink-0">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                Pacientes Confirmados
              </h1>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-bold uppercase tracking-wider flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Confirmação de Consulta Santa Casa
              </span>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground font-medium max-w-2xl">
              Painel independente de validação de presença. Ao confirmar uma consulta aqui ou pelo paciente na Confirmação de Consulta, o agendamento no Kanban do Centro Médico fica <strong>completamente verde</strong>.
            </p>
          </div>
        </div>

        {/* Botões do Topo */}
        <div className="flex flex-wrap items-center gap-2.5 relative z-10">
          <button
            onClick={() => handleOpenCanalSeguro()}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary/10 hover:bg-primary/15 text-primary rounded-xl text-xs sm:text-sm font-semibold border border-primary/20 transition-all shadow-xs"
            title="Abrir página pública onde o paciente confirma sua própria consulta"
          >
            <ShieldCheck className="h-4 w-4" />
            <span>Abrir Confirmação de Consulta</span>
            <ExternalLink className="h-3.5 w-3.5 opacity-70" />
          </button>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-muted/60 hover:bg-muted text-foreground rounded-xl text-xs sm:text-sm font-medium border border-border/80 transition-all"
            title="Recarregar confirmações"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-primary' : 'text-muted-foreground'}`} />
            <span className="hidden sm:inline">Atualizar</span>
          </button>
        </div>
      </div>

      {/* ── CARDS DE MÉTRICAS EM DESTAQUE ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {/* Total do Dia */}
        <div className="bg-card border border-border/80 p-4 rounded-2xl shadow-xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold">
            <span>Consultas do Dia</span>
            <CalendarDays className="h-4 w-4 text-primary" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-foreground">
            {metrics.total}
          </div>
          <p className="text-[11px] text-muted-foreground">Agendamentos no Centro Médico</p>
        </div>

        {/* Confirmados */}
        <div className="bg-emerald-500/10 border border-emerald-500/25 p-4 rounded-2xl shadow-xs space-y-1">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 text-xs font-bold">
            <span>Confirmados</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
            {metrics.confirmados}
            <span className="text-xs font-bold px-2 py-0.5 bg-emerald-500/20 rounded-full border border-emerald-500/30">
              {metrics.porcentagem}%
            </span>
          </div>
          <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">Cards verdes no Centro Médico</p>
        </div>

        {/* Pendentes */}
        <div className="bg-amber-500/10 border border-amber-500/25 p-4 rounded-2xl shadow-xs space-y-1">
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 text-xs font-bold">
            <span>Pendentes</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400">
            {metrics.pendentes}
          </div>
          <p className="text-[11px] text-amber-700 dark:text-amber-300 font-medium">Aguardando confirmação</p>
        </div>

        {/* Local Oficial */}
        <div className="bg-card border border-border/80 p-4 rounded-2xl shadow-xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold">
            <span>Local Oficial</span>
            <Building2 className="h-4 w-4 text-primary" />
          </div>
          <div className="text-sm sm:text-base font-bold text-foreground truncate">
            Centro Médico
          </div>
          <p className="text-[11px] text-muted-foreground truncate">Hospital Santa Casa</p>
        </div>
      </div>

      {/* ── BARRA DE CONTROLE, FILTROS E BUSCA ── */}
      <div className="bg-card border border-border/80 p-4 rounded-2xl shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Navegação por Data */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-1 bg-background border border-border/80 p-1 rounded-2xl text-xs shadow-xs">
            <button
              onClick={() => handleStepDay(-1)}
              title="Dia Anterior"
              className="px-2.5 py-1.5 rounded-xl hover:bg-muted text-foreground transition-all flex items-center gap-1 font-medium text-xs active:scale-95"
            >
              <ChevronLeft className="h-4 w-4 text-muted-foreground" />
              <span>Anterior</span>
            </button>

            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/40 rounded-xl border border-border/40">
              <Calendar className="h-3.5 w-3.5 text-primary shrink-0" />
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="bg-transparent text-foreground font-semibold focus:outline-none cursor-pointer text-xs max-w-[125px]"
              />
            </div>

            <button
              onClick={() => setSelectedDate(TODAY)}
              title="Ir para Hoje"
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95 ${
                selectedDate === TODAY
                  ? 'bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/30'
                  : 'hover:bg-muted text-muted-foreground'
              }`}
            >
              Hoje
            </button>

            <button
              onClick={() => handleStepDay(1)}
              title="Próximo Dia"
              className="px-2.5 py-1.5 rounded-xl hover:bg-muted text-foreground transition-all flex items-center gap-1 font-medium text-xs active:scale-95"
            >
              <span>Próximo</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>

            <span className="ml-2 font-bold text-xs text-primary px-2 hidden sm:inline">
              {formatDateLabel(selectedDate)}
            </span>
          </div>

          {/* Filtros de Status (Todos, Confirmados, Pendentes) */}
          <div className="flex items-center gap-1.5 bg-muted/50 p-1 rounded-2xl border border-border/60">
            <button
              onClick={() => setStatusFilter('TODOS')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                statusFilter === 'TODOS'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Todos ({metrics.total})
            </button>
            <button
              onClick={() => setStatusFilter('CONFIRMADOS')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                statusFilter === 'CONFIRMADOS'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-muted-foreground hover:text-emerald-600'
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Confirmados ({metrics.confirmados})</span>
            </button>
            <button
              onClick={() => setStatusFilter('PENDENTES')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                statusFilter === 'PENDENTES'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-muted-foreground hover:text-amber-600'
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              <span>Pendentes ({metrics.pendentes})</span>
            </button>
          </div>
        </div>

        {/* Linha de Busca e Especialidade */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por paciente, prontuário, médico ou convênio..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-background border border-border/80 rounded-xl text-xs sm:text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className="flex items-center gap-2 bg-background border border-border/80 px-3.5 py-2 rounded-xl text-xs w-full sm:w-auto min-w-[200px]">
            <Filter className="h-3.5 w-3.5 text-primary shrink-0" />
            <select
              value={selectedEspecialidade}
              onChange={e => setSelectedEspecialidade(e.target.value)}
              className="bg-transparent text-foreground focus:outline-none font-semibold cursor-pointer w-full text-xs"
            >
              {especialidades.map(esp => (
                <option key={esp} value={esp} className="bg-card text-foreground">
                  {esp === 'TODAS' ? 'Todas Especialidades' : esp}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── LISTAGEM DE CONSULTAS COM INFORMAÇÕES DE CONFIRMAÇÃO E BOTÃO ── */}
      {filteredConsultas.length === 0 ? (
        <div className="bg-card border border-border/80 rounded-3xl p-12 text-center space-y-3">
          <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center mx-auto text-muted-foreground">
            <Search className="h-6 w-6" />
          </div>
          <h3 className="font-bold text-base text-foreground">Nenhuma consulta encontrada</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Não foram localizados agendamentos para a data e filtros selecionados. Altere a data ou limpe os filtros para visualizar outros registros.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {filteredConsultas.map(consulta => {
            const isConfirmed = !!consulta.confirmadoPeloPaciente;

            return (
              <motion.div
                key={consulta.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-5 rounded-2xl border transition-all relative overflow-hidden flex flex-col justify-between gap-4 ${
                  isConfirmed
                    ? 'bg-emerald-500/10 border-emerald-500/40 shadow-md ring-1 ring-emerald-500/30 dark:bg-emerald-950/20'
                    : 'bg-card border-border/80 hover:border-primary/40 shadow-xs'
                }`}
              >
                {/* Faixa decorativa no topo para os confirmados */}
                {isConfirmed && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500" />
                )}

                {/* Topo do Card: Paciente, Horário e Status */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`h-11 w-11 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 border shadow-xs ${
                          isConfirmed
                            ? 'bg-emerald-600 text-white border-emerald-400'
                            : 'bg-primary/10 text-primary border-primary/20'
                        }`}
                      >
                        {isConfirmed ? (
                          <CheckCircle2 className="h-6 w-6 text-white" />
                        ) : (
                          <User className="h-5 w-5" />
                        )}
                      </div>

                      <div className="min-w-0 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-bold text-base text-foreground leading-snug break-words">
                            {consulta.paciente}
                          </h3>
                        </div>
                        <p className="text-xs text-muted-foreground font-mono">
                          {consulta.prontuario} • {consulta.idade} anos • {consulta.convenio}
                        </p>
                      </div>
                    </div>

                    {/* Horário */}
                    <div className="flex flex-col items-end shrink-0">
                      <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-background border border-border/80 text-foreground font-bold text-xs shadow-xs">
                        <Clock className="h-3.5 w-3.5 text-primary" />
                        {consulta.horario}
                      </span>
                    </div>
                  </div>

                  {/* Informações da Consulta */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-2 border-t border-border/50">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Stethoscope className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="font-semibold text-foreground">{consulta.medico}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground pl-5">
                        {consulta.crm} • {consulta.especialidade}
                      </p>
                    </div>

                    <div className="space-y-1 sm:text-right">
                      <div className="flex items-center sm:justify-end gap-1.5 text-muted-foreground">
                        <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="font-semibold text-foreground">Centro Médico da Santa Casa</span>
                      </div>
                      <div className="flex items-center sm:justify-end gap-1.5 text-[11px] text-muted-foreground">
                        <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span>{consulta.telefone || '(84) 99844-4889'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Status Badge e Mensagem de Confirmação */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/40">
                    {isConfirmed ? (
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-600 text-white font-bold text-[11px] shadow-sm">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          PACIENTE CONFIRMOU PRESENÇA
                        </span>
                        {consulta.confirmadoEm && (
                          <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                            às {consulta.confirmadoEm}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-bold text-[11px]">
                        <Clock className="h-3.5 w-3.5" />
                        AGUARDANDO CONFIRMAÇÃO
                      </span>
                    )}

                    <span className="text-[11px] text-muted-foreground italic">
                      {isConfirmed
                        ? '🟢 Card totalmente verde no Kanban'
                        : 'Aguardando validação para ficar verde'}
                    </span>
                  </div>
                </div>

                {/* ── BOTÕES DE AÇÃO: CONFIRMAR E CANAL SEGURO ── */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-border/60">
                  {/* Botões do Canal Seguro do Paciente */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleCopyLink(consulta)}
                      className="px-2.5 py-1.5 bg-background hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg border border-border/80 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs"
                      title="Copiar link de Confirmação de Consulta exclusivo para este paciente"
                    >
                      {copiedId === consulta.id ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-500" />
                          <span className="text-emerald-600 font-bold">Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>Copiar Link</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleOpenCanalSeguro(consulta)}
                      className="px-2.5 py-1.5 bg-background hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg border border-border/80 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs"
                      title="Abrir como o paciente veria no celular"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span>Ver Tela</span>
                    </button>
                  </div>

                  {/* Botão Principal de Confirmação */}
                  <button
                    onClick={() => handleToggleConfirmacao(consulta)}
                    className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer ${
                      isConfirmed
                        ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-900/20 border border-emerald-400'
                    }`}
                  >
                    {isConfirmed ? (
                      <>
                        <span>Desfazer Confirmação</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Confirmar Consulta</span>
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
