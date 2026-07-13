// src/pages/Internato/Agenda.tsx
// Módulo de Agenda do Internato de Medicina para planejamento de aulas, salas, professores e horários

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Trash2, Edit2,
  Loader2, X, AlertCircle, CheckCircle, Info, MapPin, Users, BookOpen, Clock, FileText
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { supabase } from '../../lib/supabase';
import {
  fetchAgendaMes,
  fetchTurmasAtivas,
  fetchProfessores,
  criarEventoAgenda,
  atualizarEventoAgenda,
  excluirEventoAgenda,
  AgendaEvent
} from '../../services/internatoAgendaService';

// Mapeamento de cores premium por Clínica para destaque visual
const CLINICA_CORES: Record<string, { bg: string; border: string; text: string; bullet: string }> = {
  'GO': {
    bg: 'bg-rose-500/10 dark:bg-rose-500/20',
    border: 'border-rose-500/20 dark:border-rose-500/30',
    text: 'text-rose-700 dark:text-rose-300',
    bullet: 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]',
  },
  'Pediatria': {
    bg: 'bg-purple-500/10 dark:bg-purple-500/20',
    border: 'border-purple-500/20 dark:border-purple-500/30',
    text: 'text-purple-700 dark:text-purple-300',
    bullet: 'bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]',
  },
  'Clinica Medica': {
    bg: 'bg-blue-500/10 dark:bg-blue-500/20',
    border: 'border-blue-500/20 dark:border-blue-500/30',
    text: 'text-blue-700 dark:text-blue-300',
    bullet: 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]',
  },
  'Clinica Cirurgica': {
    bg: 'bg-amber-500/10 dark:bg-amber-500/20',
    border: 'border-amber-500/20 dark:border-amber-500/30',
    text: 'text-amber-700 dark:text-amber-300',
    bullet: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]',
  },
  'Saude Mental': {
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
    border: 'border-emerald-500/20 dark:border-emerald-500/30',
    text: 'text-emerald-700 dark:text-emerald-300',
    bullet: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]',
  },
  'Urgencia Emergencia': {
    bg: 'bg-red-500/10 dark:bg-red-500/20',
    border: 'border-red-500/20 dark:border-red-500/30',
    text: 'text-red-700 dark:text-red-300',
    bullet: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]',
  },
};

const CLINICAS = [
  { id: 'GO', nome: 'Ginecologia e Obstetrícia (G.O.)' },
  { id: 'Pediatria', nome: 'Pediatria' },
  { id: 'Clinica Medica', nome: 'Clínica Médica' },
  { id: 'Clinica Cirurgica', nome: 'Clínica Cirúrgica' },
  { id: 'Saude Mental', nome: 'Saúde Mental' },
  { id: 'Urgencia Emergencia', nome: 'Urgência e Emergência' }
];

function getClinicaEstilo(clinicaSlug?: string | null) {
  if (!clinicaSlug || !CLINICA_CORES[clinicaSlug]) {
    return {
      bg: 'bg-slate-500/10 dark:bg-slate-500/20',
      border: 'border-slate-500/20 dark:border-slate-500/30',
      text: 'text-slate-700 dark:text-slate-300',
      bullet: 'bg-slate-500 shadow-[0_0_8px_rgba(100,116,139,0.5)]',
    };
  }
  return CLINICA_CORES[clinicaSlug];
}

function removerAcentos(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function getLocalEstilo(sala?: string | null) {
  if (!sala) {
    return {
      bg: 'bg-slate-500/10 dark:bg-slate-500/20',
      border: 'border-slate-500/20 dark:border-slate-500/30',
      text: 'text-slate-700 dark:text-slate-300',
      bullet: 'bg-slate-500',
    };
  }

  const normalizado = removerAcentos(sala.toLowerCase());

  if (normalizado.includes('estudo')) {
    // Sala de Estudos -> Emerald (Verde)
    return {
      bg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
      border: 'border-emerald-500/20 dark:border-emerald-500/30',
      text: 'text-emerald-700 dark:text-emerald-300',
      bullet: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]',
    };
  }
  
  if (normalizado.includes('auditorio')) {
    // Auditório -> Amber (Laranja)
    return {
      bg: 'bg-amber-500/10 dark:bg-amber-500/20',
      border: 'border-amber-500/20 dark:border-amber-500/30',
      text: 'text-amber-700 dark:text-amber-300',
      bullet: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]',
    };
  }
  
  if (normalizado.includes('ambulatorio')) {
    // Ambulatório -> Blue (Azul)
    return {
      bg: 'bg-blue-500/10 dark:bg-blue-500/20',
      border: 'border-blue-500/20 dark:border-blue-500/30',
      text: 'text-blue-700 dark:text-blue-300',
      bullet: 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]',
    };
  }
  
  if (normalizado.includes('simulacao') || normalizado.includes('realistica')) {
    // Simulação Realística -> Purple (Roxo)
    return {
      bg: 'bg-purple-500/10 dark:bg-purple-500/20',
      border: 'border-purple-500/20 dark:border-purple-500/30',
      text: 'text-purple-700 dark:text-purple-300',
      bullet: 'bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]',
    };
  }
  
  if (normalizado.includes('aula') || normalizado.includes('sala')) {
    // Sala de Aula / Salas -> Indigo
    return {
      bg: 'bg-indigo-500/10 dark:bg-indigo-500/20',
      border: 'border-indigo-500/20 dark:border-indigo-500/30',
      text: 'text-indigo-700 dark:text-indigo-300',
      bullet: 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]',
    };
  }

  if (normalizado.includes('lab') || normalizado.includes('laboratorio')) {
    // Laboratório -> Violet
    return {
      bg: 'bg-violet-500/10 dark:bg-violet-500/20',
      border: 'border-violet-500/20 dark:border-violet-500/30',
      text: 'text-violet-700 dark:text-violet-300',
      bullet: 'bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.5)]',
    };
  }

  // Padrão: Sky
  return {
    bg: 'bg-sky-500/10 dark:bg-sky-500/20',
    border: 'border-sky-500/20 dark:border-sky-500/30',
    text: 'text-sky-700 dark:text-sky-300',
    bullet: 'bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.5)]',
  };
}

// ── Cálculo e Lista de Feriados Nacionais do Brasil ────────────────────────
interface Feriado {
  name: string;
  isHoliday: boolean;
}

function obterPascoa(ano: number): Date {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes - 1, dia);
}

function obterFeriadosBrasil(ano: number): Record<string, Feriado> {
  const feriados: Record<string, Feriado> = {};

  const formatarData = (d: Date) => {
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${ano}-${month}-${day}`;
  };

  feriados[`${ano}-01-01`] = { name: 'Ano Novo', isHoliday: true };
  feriados[`${ano}-04-21`] = { name: 'Tiradentes', isHoliday: true };
  feriados[`${ano}-05-01`] = { name: 'Dia do Trab.', isHoliday: true };
  feriados[`${ano}-09-07`] = { name: 'Independência', isHoliday: true };
  feriados[`${ano}-10-12`] = { name: 'N. Sra. Aparecida', isHoliday: true };
  feriados[`${ano}-11-02`] = { name: 'Finados', isHoliday: true };
  feriados[`${ano}-11-15`] = { name: 'Procl. República', isHoliday: true };
  feriados[`${ano}-11-20`] = { name: 'Consc. Negra', isHoliday: true };
  feriados[`${ano}-12-25`] = { name: 'Natal', isHoliday: true };

  // Feriados Municipais Araguari/MG
  feriados[`${ano}-08-06`] = { name: 'Bom Jesus (Mun.)', isHoliday: true };
  feriados[`${ano}-08-15`] = { name: 'N. Sra. Abadia (Mun.)', isHoliday: true };
  feriados[`${ano}-08-28`] = { name: 'Aniv. Araguari (Mun.)', isHoliday: true };

  const pascoa = obterPascoa(ano);

  const sextaSanta = new Date(pascoa);
  sextaSanta.setDate(pascoa.getDate() - 2);
  feriados[formatarData(sextaSanta)] = { name: 'Paixão de Cristo', isHoliday: true };

  const carnaval = new Date(pascoa);
  carnaval.setDate(pascoa.getDate() - 47);
  feriados[formatarData(carnaval)] = { name: 'Carnaval', isHoliday: false };

  const corpusChristi = new Date(pascoa);
  corpusChristi.setDate(pascoa.getDate() + 60);
  feriados[formatarData(corpusChristi)] = { name: 'Corpus Christi', isHoliday: false };

  return feriados;
}

const DIAS_SEMANA = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export default function InternatoAgenda() {
  const { isAdmin } = useAuth();
  const { canAccess } = usePermissions();

  // Permissão de escrita: Secretaria ou Admin ou Módulo Agenda
  const temPermissaoEscrita = useMemo(() => {
    return isAdmin || canAccess('internato-secretaria') || canAccess('internato-agenda');
  }, [isAdmin, canAccess]);

  // Estados de data e navegação
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());

  // Estados de dados
  const [agenda, setAgenda] = useState<AgendaEvent[]>([]);
  const [turmas, setTurmas] = useState<any[]>([]);
  const [professores, setProfessores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [operando, setOperando] = useState(false);

  // Formulário
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);

  const [formTurmaId, setFormTurmaId] = useState('');
  const [formClinica, setFormClinica] = useState('');
  const [formSala, setFormSala] = useState('');
  const [formProfessorId, setFormProfessorId] = useState('');
  const [formHorario, setFormHorario] = useState('Manhã');
  const [formHorarioPersonalizado, setFormHorarioPersonalizado] = useState('');
  const [formObservacao, setFormObservacao] = useState('');

  // Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const showToast = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  const feriadosDoAno = useMemo(() => {
    return obterFeriadosBrasil(currentYear);
  }, [currentYear]);

  const selectedDateString = useMemo(() => {
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, [selectedDate]);

  // Carregar dados
  const loadAgenda = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAgendaMes(currentYear, currentMonth + 1);
      setAgenda(data);
    } catch (err: any) {
      showToast('error', 'Erro ao carregar dados da agenda.');
    } finally {
      setLoading(false);
    }
  }, [currentYear, currentMonth, showToast]);

  const loadDropdowns = useCallback(async () => {
    try {
      const [dataTurmas, dataProfs] = await Promise.all([
        fetchTurmasAtivas(),
        fetchProfessores()
      ]);
      setTurmas(dataTurmas);
      setProfessores(dataProfs);
    } catch (err) {
      console.error('Erro ao carregar dropdowns:', err);
    }
  }, []);

  useEffect(() => {
    loadAgenda();
  }, [loadAgenda]);

  useEffect(() => {
    loadDropdowns();
  }, [loadDropdowns]);

  // Realtime
  useEffect(() => {
    console.log('[Realtime] Conectando ao canal internato_agenda_realtime...');
    const channel = supabase
      .channel('internato_agenda_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'internato_agenda' },
        (payload) => {
          console.log('[Realtime] Alteração na tabela internato_agenda:', payload);
          loadAgenda();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadAgenda]);

  // Mapeamento dos dias no grid
  const slotsCalendario = useMemo(() => {
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
    const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();

    const slots: { day: number; date: Date; isCurrentMonth: boolean; dateStr: string }[] = [];

    // Mês anterior
    const prevMonthTotalDays = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = prevMonthTotalDays - i;
      const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      const date = new Date(prevYear, prevMonth, d);
      const dateStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      slots.push({ day: d, date, isCurrentMonth: false, dateStr });
    }

    // Mês atual
    for (let d = 1; d <= totalDays; d++) {
      const date = new Date(currentYear, currentMonth, d);
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      slots.push({ day: d, date, isCurrentMonth: true, dateStr });
    }

    // Próximo mês
    const remainingSlots = 42 - slots.length;
    for (let d = 1; d <= remainingSlots; d++) {
      const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
      const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
      const date = new Date(nextYear, nextMonth, d);
      const dateStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      slots.push({ day: d, date, isCurrentMonth: false, dateStr });
    }

    return slots;
  }, [currentYear, currentMonth]);

  // Agrupamento dos eventos por data
  const agendaAgrupada = useMemo(() => {
    const mapa: Record<string, AgendaEvent[]> = {};
    agenda.forEach(item => {
      if (!mapa[item.data]) {
        mapa[item.data] = [];
      }
      mapa[item.data].push(item);
    });
    return mapa;
  }, [agenda]);

  const eventosDoDiaSelecionado = useMemo(() => {
    return agendaAgrupada[selectedDateString] ?? [];
  }, [agendaAgrupada, selectedDateString]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  };

  const handleOpenCreateModal = () => {
    if (!temPermissaoEscrita) return;
    setIsEditing(false);
    setEditingId(null);
    setFormTurmaId('');
    setFormClinica('');
    setFormSala('');
    setFormProfessorId('');
    setFormHorario('Manhã');
    setFormHorarioPersonalizado('08:00 às 12:00');
    setFormObservacao('');
    setShowFormModal(true);
  };

  const handleOpenEditModal = (evento: AgendaEvent) => {
    if (!temPermissaoEscrita) return;
    setIsEditing(true);
    setEditingId(evento.id);
    setFormTurmaId(evento.turma_id || 'acolhimento');
    setFormClinica(evento.clinica || '');
    setFormSala(evento.sala);
    setFormProfessorId(evento.professor_id || '');
    
    setFormHorarioPersonalizado(evento.horario);
    
    const hor = evento.horario.toLowerCase();
    if (hor.includes('08:00 às 12:00') || hor.includes('manhã') || hor.startsWith('07:') || hor.startsWith('08:') || hor.startsWith('09:') || hor.startsWith('10:') || hor.startsWith('11:')) {
      setFormHorario('Manhã');
    } else if (hor.includes('13:00 às 17:00') || hor.includes('tarde') || hor.startsWith('12:') || hor.startsWith('13:') || hor.startsWith('14:') || hor.startsWith('15:') || hor.startsWith('16:') || hor.startsWith('17:')) {
      setFormHorario('Tarde');
    } else if (hor.includes('18:00 às 22:00') || hor.includes('noite') || hor.startsWith('18:') || hor.startsWith('19:') || hor.startsWith('20:') || hor.startsWith('21:') || hor.startsWith('22:')) {
      setFormHorario('Noite');
    } else if (hor.includes('08:00 às 18:00') || hor.includes('dia todo') || hor.includes('dia inteiro')) {
      setFormHorario('Dia todo');
    } else {
      setFormHorario('Manhã');
    }

    setFormObservacao(evento.observacao || '');
    setShowFormModal(true);
  };

  const handleSaveEvento = async (e: React.FormEvent) => {
    e.preventDefault();
    const clinicaObrigatoria = formTurmaId !== 'acolhimento';
    const horarioParaSalvar = formHorarioPersonalizado;

    if (!formSala || !horarioParaSalvar || !formTurmaId || (clinicaObrigatoria && !formClinica)) {
      showToast('error', 'Preencha todos os campos obrigatórios.');
      return;
    }

    setOperando(true);
    const payload = {
      data: selectedDateString,
      turma_id: formTurmaId === 'acolhimento' ? null : (formTurmaId || null),
      clinica: formClinica || null,
      sala: formSala,
      professor_id: formProfessorId || null,
      horario: horarioParaSalvar,
      observacao: formObservacao || null
    };

    try {
      if (isEditing && editingId) {
        const res = await atualizarEventoAgenda(editingId, payload);
        if (res.success) {
          showToast('success', 'Agendamento atualizado com sucesso!');
          setShowFormModal(false);
          await loadAgenda();
        } else {
          showToast('error', res.error || 'Erro ao atualizar.');
        }
      } else {
        const res = await criarEventoAgenda(payload);
        if (res.success) {
          showToast('success', 'Agendamento criado com sucesso!');
          setShowFormModal(false);
          await loadAgenda();
        } else {
          showToast('error', res.error || 'Erro ao criar agendamento.');
        }
      }
    } catch {
      showToast('error', 'Ocorreu um erro inesperado.');
    } finally {
      setOperando(false);
    }
  };

  const handleDeleteEvento = async (id: string) => {
    if (!temPermissaoEscrita) return;
    if (!window.confirm('Tem certeza que deseja remover este agendamento?')) return;

    setOperando(true);
    try {
      const res = await excluirEventoAgenda(id);
      if (res.success) {
        showToast('success', 'Agendamento removido.');
        await loadAgenda();
      } else {
        showToast('error', res.error || 'Erro ao remover agendamento.');
      }
    } catch {
      showToast('error', 'Erro ao excluir agendamento.');
    } finally {
      setOperando(false);
    }
  };

  const hojeStr = useMemo(() => {
    const hoje = new Date();
    return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
  }, []);

  return (
    <div className="flex-1 space-y-3 min-h-[60vh] pb-4 w-full mx-auto px-1 pt-2 text-foreground transition-all">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border text-sm max-w-sm ${
              toast.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                : toast.type === 'error'
                  ? 'bg-destructive/10 border-destructive/30 text-destructive'
                  : 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle className="h-5 w-5 flex-shrink-0" />
            ) : toast.type === 'error' ? (
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
            ) : (
              <Info className="h-5 w-5 flex-shrink-0" />
            )}
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <CalendarIcon className="h-8 w-8 text-primary" />
            Agenda do Internato
          </h1>
          <p className="text-muted-foreground mt-1 text-xs">
            Planejamento diário de salas, especialidades/clínicas, professores e horários para as turmas.
          </p>
        </div>
        {temPermissaoEscrita && (
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/95 font-semibold text-xs px-4 py-2.5 rounded-lg shadow transition-all duration-200 self-start md:self-center"
          >
            <Plus className="h-4 w-4" />
            Agendar Compromisso
          </button>
        )}
      </div>

      {/* Grid Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Painel Esquerda: Calendário (9 cols) */}
        <div className="lg:col-span-9 bg-card border border-border/80 shadow-md rounded-xl p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/55 pb-2">
            <div>
              <h2 className="text-lg font-bold text-foreground">Agenda do Mês</h2>
              <p className="text-xs text-muted-foreground">Clique em um dia para ver os detalhes na barra lateral.</p>
            </div>

            <div className="flex items-center gap-2 self-center bg-background border border-border/70 rounded-lg p-1">
              <button
                onClick={handlePrevMonth}
                className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="Mês anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-semibold px-3 text-center min-w-[120px]">
                {MESES[currentMonth]} {currentYear}
              </span>
              <button
                onClick={handleNextMonth}
                className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="Próximo mês"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="h-[400px] flex flex-col items-center justify-center text-muted-foreground gap-3">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <span>Carregando agenda...</span>
            </div>
          ) : (
            <div className="space-y-1">
              {/* Dias da semana */}
              <div className="grid grid-cols-7 text-center">
                {DIAS_SEMANA.map(dia => (
                  <span key={dia} className="text-xs font-semibold text-muted-foreground uppercase tracking-wider py-1">
                    {dia}
                  </span>
                ))}
              </div>

              {/* Grid 6x7 de slots de dias */}
              <div className="grid grid-cols-7 gap-1">
                {slotsCalendario.map((slot, index) => {
                  const diaEventos = agendaAgrupada[slot.dateStr] ?? [];
                  const isSelected = selectedDateString === slot.dateStr;
                  const isToday = hojeStr === slot.dateStr;
                  const feriadoInfo = feriadosDoAno[slot.dateStr];
                  const hasFeriado = !!feriadoInfo;
                  const temPlanejamento = diaEventos.length > 0;

                  let diaClasses = 'bg-card border-border/50 text-foreground';
                  if (hasFeriado) {
                    diaClasses = 'border-rose-200/85 dark:border-rose-950/80 bg-rose-500/[0.04] dark:bg-rose-500/[0.06] text-foreground';
                  }

                  return (
                    <button
                      key={index}
                      onClick={() => setSelectedDate(slot.date)}
                      className={`min-h-[110px] p-2 rounded-lg border flex flex-col justify-between items-stretch text-left transition-all relative ${
                        slot.isCurrentMonth
                          ? diaClasses
                          : 'bg-muted/10 border-border/20 text-muted-foreground opacity-50'
                      } ${
                        isSelected
                          ? 'ring-2 ring-primary border-transparent bg-primary/5 shadow-inner'
                          : 'hover:border-border-hover hover:bg-muted/20'
                      }`}
                    >
                      {/* Número do Dia */}
                      <div className="flex justify-between items-start w-full gap-1">
                        {isToday ? (
                          <span className="text-xs font-bold bg-primary text-primary-foreground h-5 w-5 rounded-full flex items-center justify-center shadow-sm">
                            {slot.day}
                          </span>
                        ) : (
                          <span className={`text-xs font-bold ${
                            isSelected
                              ? 'text-primary'
                              : feriadoInfo
                                ? 'text-rose-600 dark:text-rose-400'
                                : ''
                          }`}>
                            {slot.day}
                          </span>
                        )}

                        {feriadoInfo && (
                          <span
                            className="text-[9px] px-1 py-0.5 rounded font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 truncate max-w-[50px] sm:max-w-[70px]"
                            title={feriadoInfo.name}
                          >
                            {feriadoInfo.name}
                          </span>
                        )}
                      </div>

                      {/* Mini lista de agendamentos */}
                      <div className="flex-1 mt-1.5 space-y-1 pr-0.5">
                        {diaEventos.map(evento => {
                          const estilo = getLocalEstilo(evento.sala);
                          return (
                            <div
                              key={evento.id}
                              className={`flex items-center flex-wrap gap-1 px-1 py-0.5 rounded text-[10px] font-semibold border ${estilo.bg} ${estilo.border} ${estilo.text}`}
                              title={`${evento.internato_turmas?.nome || 'Acolhimento'} - ${evento.sala} (${evento.horario})`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${estilo.bullet}`} />
                              <span className="flex-1 break-words">
                                {evento.internato_turmas?.nome || 'Acolhimento'}
                              </span>
                              <span className="text-[9.5px] opacity-90 font-medium shrink-0 ml-1 border-l border-current/20 pl-1">
                                {evento.sala}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Painel Direita: Detalhes do Dia (3 cols) */}
        <div className="lg:col-span-3 bg-card border border-border/80 shadow-md rounded-xl p-4 space-y-4">
          <div className="border-b border-border/55 pb-2 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold text-foreground">Planejamento do Dia</h2>
              <p className="text-xs text-muted-foreground">
                {selectedDate.toLocaleDateString('pt-BR', { dateStyle: 'long' })}
              </p>
            </div>
            {temPermissaoEscrita && (
              <button
                onClick={handleOpenCreateModal}
                className="p-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-all border border-primary/10"
                title="Novo planejamento para este dia"
              >
                <Plus className="h-4.5 w-4.5" strokeWidth={3} />
              </button>
            )}
          </div>

          <div className="space-y-3 pr-1">
            {eventosDoDiaSelecionado.length === 0 ? (
              <div className="h-[200px] flex flex-col items-center justify-center text-muted-foreground gap-2 border border-dashed border-border rounded-xl bg-muted/5">
                <CalendarIcon className="h-8 w-8 text-muted-foreground/50" />
                <span className="text-sm font-medium">Nenhum compromisso agendado</span>
                {temPermissaoEscrita && (
                  <button
                    onClick={handleOpenCreateModal}
                    className="text-xs text-primary font-bold hover:underline"
                  >
                    Agendar agora
                  </button>
                )}
              </div>
            ) : (
              eventosDoDiaSelecionado.map(evento => {
                const estilo = getLocalEstilo(evento.sala);
                const clinicaNome = CLINICAS.find(c => c.id === evento.clinica)?.nome || evento.clinica || 'Não informado';
                return (
                  <div
                    key={evento.id}
                    className={`p-3 rounded-xl border flex flex-col gap-2 relative group hover:shadow-md transition-all duration-200 ${estilo.bg} ${estilo.border}`}
                  >
                    {/* Botões de Ação */}
                    {temPermissaoEscrita && (
                      <div className="absolute top-2 right-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <button
                          onClick={() => handleOpenEditModal(evento)}
                          className="p-1 hover:bg-muted rounded text-foreground hover:text-primary transition-colors"
                          title="Editar"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteEvento(evento.id)}
                          className="p-1 hover:bg-muted rounded text-foreground hover:text-destructive transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Badge da Clínica */}
                    <div className="flex items-center gap-1.5">
                      <span className={`h-2.5 w-2.5 rounded-full ${estilo.bullet}`} />
                      <span className={`text-[11px] font-bold uppercase tracking-wider ${estilo.text}`}>
                        {clinicaNome}
                      </span>
                    </div>

                    {/* Turma e Informações */}
                    <div>
                      <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                        <Users className="h-4 w-4 text-muted-foreground/80" />
                        {evento.internato_turmas ? (
                          <>
                            {evento.internato_turmas.nome}
                            <span className="text-xs font-normal text-muted-foreground">
                              {' '}({evento.internato_turmas.periodo})
                            </span>
                          </>
                        ) : (
                          'Acolhimento'
                        )}
                      </h3>
                    </div>

                    {/* Detalhes específicos */}
                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground pt-1 border-t border-border/20">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground/75" />
                        <span className="break-words" title={evento.horario}>
                          {evento.horario}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground/75" />
                        <span className="break-words" title={evento.sala}>
                          {evento.sala}
                        </span>
                      </div>
                    </div>

                    {evento.internato_professores && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <BookOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground/75" />
                        <span className="break-words" title={`${evento.internato_professores.nome || 'Sem nome'}${evento.internato_professores.especialidade ? ` - ${evento.internato_professores.especialidade}` : ''}`}>
                          Prof. {evento.internato_professores.nome || 'Sem nome'}
                          {evento.internato_professores.especialidade && (
                            <span className="text-[10px] text-muted-foreground/70 font-normal"> ({evento.internato_professores.especialidade})</span>
                          )}
                        </span>
                      </div>
                    )}

                    {evento.observacao && (
                      <div className="mt-1 text-[11px] text-muted-foreground/90 bg-background/40 p-2 rounded border border-border/10 italic flex gap-1 items-start">
                        <FileText className="h-3.5 w-3.5 shrink-0 mt-0.5 opacity-75" />
                        <span className="break-all">{evento.observacao}</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Modal / Popup Form de Criação/Edição */}
      <AnimatePresence>
        {showFormModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-xl bg-card border border-border rounded-2xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              {/* Header Modal */}
              <div className="flex justify-between items-center p-4 border-b border-border bg-muted/20">
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5 text-primary" />
                  {isEditing ? 'Editar Agendamento' : 'Agendar Compromisso'}
                </h3>
                <button
                  onClick={() => setShowFormModal(false)}
                  className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleSaveEvento} className="p-4 space-y-4 overflow-y-auto flex-1">
                {/* Turma */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Turma *</label>
                  <select
                    value={formTurmaId}
                    onChange={e => setFormTurmaId(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                    required
                  >
                    <option value="" disabled>Selecione uma turma</option>
                    <option value="acolhimento">Acolhimento</option>
                    {turmas.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.nome} ({t.periodo})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Sala */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Sala / Setor *</label>
                    <select
                      value={formSala}
                      onChange={e => setFormSala(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                      required
                    >
                      <option value="" disabled>Selecione</option>
                      <option value="Auditório">Auditório</option>
                      <option value="Sala de Estudo">Sala de Estudo</option>
                    </select>
                  </div>

                  {/* Horário */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Turno *</label>
                    <select
                      value={formHorario}
                      onChange={e => {
                        const val = e.target.value;
                        setFormHorario(val);
                        if (val === 'Manhã') setFormHorarioPersonalizado('08:00 às 12:00');
                        else if (val === 'Tarde') setFormHorarioPersonalizado('13:00 às 17:00');
                        else if (val === 'Noite') setFormHorarioPersonalizado('18:00 às 22:00');
                        else if (val === 'Dia todo') setFormHorarioPersonalizado('08:00 às 18:00');
                      }}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                      required
                    >
                      <option value="Manhã">Manhã</option>
                      <option value="Tarde">Tarde</option>
                      <option value="Noite">Noite</option>
                      <option value="Dia todo">Dia todo</option>
                    </select>

                    <input
                      type="text"
                      value={formHorarioPersonalizado}
                      onChange={e => setFormHorarioPersonalizado(e.target.value)}
                      placeholder="Horário da aula (Ex: 08:30 às 11:30)"
                      className="w-full px-3 py-2 mt-1.5 text-sm rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                      required
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase">
                    Clínica {formTurmaId !== 'acolhimento' && '*'}
                  </label>
                  <select
                    value={formClinica}
                    onChange={e => setFormClinica(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                    required={formTurmaId !== 'acolhimento'}
                  >
                    <option value="" disabled>Selecione uma clínica</option>
                    {CLINICAS.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Professor */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Professor / Supervisor</label>
                  <select
                    value={formProfessorId}
                    onChange={e => setFormProfessorId(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  >
                    <option value="">Selecione um professor (opcional)</option>
                    {professores.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.nome || p.email}{p.especialidade ? ` (${p.especialidade})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Observação */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Observação</label>
                  <textarea
                    value={formObservacao}
                    onChange={e => setFormObservacao(e.target.value)}
                    placeholder="Adicione informações adicionais (opcional)"
                    rows={3}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none"
                  />
                </div>

                {/* Footer Modal */}
                <div className="flex justify-end gap-2 pt-2 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setShowFormModal(false)}
                    className="px-4 py-2 text-xs font-bold text-foreground hover:bg-muted border border-border rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={operando}
                    className="px-4 py-2 text-xs font-bold text-primary-foreground bg-primary hover:bg-primary/95 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    {operando ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      'Salvar'
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
