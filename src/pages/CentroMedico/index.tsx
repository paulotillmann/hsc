import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Stethoscope,
  Calendar,
  Clock,
  User,
  Search,
  RefreshCw,
  Filter,
  CheckCircle2,
  AlertCircle,
  XCircle,
  UserCheck,
  Building2,
  Phone,
  ShieldAlert,
  FileText,
  ChevronDown,
  Sparkles,
  Users,
  CalendarDays,
  Activity,
  Check,
  Kanban,
  Send,
  MoveRight,
  GripVertical,
  ChevronRight,
  ChevronLeft,
  MessageCircle
} from 'lucide-react';
import { webhookService } from '../../services/webhookService';
import { supabase } from '../../lib/supabase';

// Tipos de Status do Kanban
export type KanbanStatus = 'Agendamentos' | 'Enviadas' | 'Confirmadas' | 'Concluídas' | 'Canceladas';

// Interfaces de Dados
export interface EscalaMedica {
  id: string;
  medico: string;
  crm: string;
  especialidade: string;
  setor: string;
  turno: 'Manhã' | 'Tarde' | 'Noite' | '24 Horas';
  horario: string;
  status: 'Presencial' | 'Sobreaviso' | 'Ausente' | 'Folga';
  contato: string;
  avatarUrl?: string;
}

export interface ConsultaAgendada {
  id: string;
  paciente: string;
  prontuario: string;
  idade: number;
  medico: string;
  crm: string;
  especialidade: string;
  horario: string;
  data: string;
  consultorio: string;
  convenio: string;
  status: KanbanStatus;
  statusReal?: string;
  telefone?: string;
  observacoes?: string;
  confirmadoPeloPaciente?: boolean;
  confirmadoEm?: string;
  addedAt?: number;
}

// Configuração das Colunas do Kanban
const KANBAN_COLUMNS: {
  id: KanbanStatus;
  label: string;
  color: string;
  badgeBg: string;
  border: string;
  dotColor: string;
  isSynced?: boolean;
}[] = [
  {
    id: 'Agendamentos',
    label: 'Agenda',
    color: 'text-blue-600 dark:text-blue-400',
    badgeBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
    border: 'border-blue-500/30',
    dotColor: 'bg-blue-500',
    isSynced: true
  },
  {
    id: 'Enviadas',
    label: 'Confirmação de agendamento',
    color: 'text-purple-600 dark:text-purple-400',
    badgeBg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30',
    border: 'border-purple-500/30',
    dotColor: 'bg-purple-500'
  },
  {
    id: 'Confirmadas',
    label: 'Envio de confirmação',
    color: 'text-emerald-600 dark:text-emerald-400',
    badgeBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    border: 'border-emerald-500/30',
    dotColor: 'bg-emerald-500'
  },
  {
    id: 'Canceladas',
    label: 'Canceladas',
    color: 'text-rose-600 dark:text-rose-400',
    badgeBg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30',
    border: 'border-rose-500/30',
    dotColor: 'bg-rose-500',
    isSynced: true
  }
];

// Helper para verificar se a consulta veio com status cancelado do Tasy
const isStatusCanceladoTasy = (statusReal?: string, statusOriginal?: string): boolean => {
  const s1 = (statusReal || '').trim().toLowerCase();
  const s2 = (statusOriginal || '').trim().toLowerCase();
  return s1.includes('cancelad') || s2.includes('cancelad');
};

// Funções auxiliares para datas
const getDateOffset = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

const formatDateLabel = (dateStr: string): string => {
  if (!dateStr) return '';
  const todayStr = getDateOffset(0);
  const yesterdayStr = getDateOffset(-1);
  const tomorrowStr = getDateOffset(1);

  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  const dateObj = new Date(year, month - 1, day);
  const formattedStr = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;

  if (dateStr === todayStr) return `Hoje (${formattedStr})`;
  if (dateStr === yesterdayStr) return `Ontem (${formattedStr})`;
  if (dateStr === tomorrowStr) return `Amanhã (${formattedStr})`;

  const daysOfWeek = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  return `${daysOfWeek[dateObj.getDay()]} (${formattedStr})`;
};

const formatDateToBR = (dateStr?: string): string => {
  if (!dateStr) return '';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return dateStr;
  const parts = dateStr.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    const [year, month, day] = parts;
    return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
  }
  return dateStr;
};

const TODAY = getDateOffset(0);
const YESTERDAY = getDateOffset(-1);
const TWO_DAYS_AGO = getDateOffset(-2);
const THREE_DAYS_AGO = getDateOffset(-3);
const TOMORROW = getDateOffset(1);

// Estilo visual da tag de status real do paciente
const getRealStatusBadgeStyle = (statusReal?: string): string => {
  if (!statusReal) return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20';
  const s = statusReal.toLowerCase();
  if (s.includes('confirmad')) {
    return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
  }
  if (s.includes('conclu') || s.includes('atendid')) {
    return 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/30';
  }
  if (s.includes('cancel') || s.includes('falt') || s.includes('desmarc')) {
    return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30';
  }
  if (s.includes('enviad') || s.includes('mensag') || s.includes('notific')) {
    return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30';
  }
  if (s.includes('agend')) {
    return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30';
  }
  return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30';
};

// Dados de demonstração (Mock Data)
const INITIAL_ESCALAS: EscalaMedica[] = [
  {
    id: 'esc-1',
    medico: 'Dr. Roberto Carlos Mendes',
    crm: 'CRM/MG 45.120',
    especialidade: 'Cardiologia',
    setor: 'Centro Médico - Consultório 01',
    turno: 'Manhã',
    horario: '07:00 - 13:00',
    status: 'Presencial',
    contato: '(34) 99876-1234'
  },
  {
    id: 'esc-2',
    medico: 'Dra. Amanda Silveira',
    crm: 'CRM/MG 52.890',
    especialidade: 'Pediatria',
    setor: 'Centro Médico - Consultório 03',
    turno: 'Tarde',
    horario: '13:00 - 19:00',
    status: 'Presencial',
    contato: '(34) 99123-4567'
  },
  {
    id: 'esc-3',
    medico: 'Dr. Fernando Henrique Lima',
    crm: 'CRM/MG 38.411',
    especialidade: 'Ortopedia',
    setor: 'Pronto Atendimento / Centro Médico',
    turno: '24 Horas',
    horario: '07:00 - 07:00 (Próx. dia)',
    status: 'Presencial',
    contato: '(34) 99765-4321'
  },
  {
    id: 'esc-4',
    medico: 'Dra. Juliana Vasconcelos',
    crm: 'CRM/MG 61.025',
    especialidade: 'Ginecologia e Obstetrícia',
    setor: 'Centro Médico - Consultório 05',
    turno: 'Manhã',
    horario: '08:00 - 12:00',
    status: 'Sobreaviso',
    contato: '(34) 99654-9876'
  },
  {
    id: 'esc-5',
    medico: 'Dr. Lucas Alcantara',
    crm: 'CRM/MG 49.332',
    especialidade: 'Neurologia',
    setor: 'Centro Médico - Consultório 02',
    turno: 'Tarde',
    horario: '14:00 - 18:00',
    status: 'Presencial',
    contato: '(34) 99432-1098'
  },
  {
    id: 'esc-6',
    medico: 'Dra. Patricia Medeiros',
    crm: 'CRM/MG 41.780',
    especialidade: 'Dermatologia',
    setor: 'Centro Médico - Consultório 04',
    turno: 'Manhã',
    horario: '08:00 - 12:00',
    status: 'Folga',
    contato: '(34) 99211-3344'
  }
];

const INITIAL_CONSULTAS: ConsultaAgendada[] = [
  // ── HOJE ──
  {
    id: 'cons-101',
    paciente: 'Maria das Graças Oliveira',
    prontuario: 'PRONT-88492',
    idade: 64,
    medico: 'Dr. Roberto Carlos Mendes',
    crm: 'CRM/MG 45.120',
    especialidade: 'Cardiologia',
    horario: '08:30',
    data: TODAY,
    consultorio: 'Consultório 01',
    convenio: 'Unimed',
    status: 'Agendamentos',
    statusReal: 'Concluída',
    telefone: '(34) 99111-2233',
    observacoes: 'Consulta de retorno pós-exames de holter'
  },
  {
    id: 'cons-102',
    paciente: 'João Pedro Santos',
    prontuario: 'PRONT-91024',
    idade: 12,
    medico: 'Dra. Amanda Silveira',
    crm: 'CRM/MG 52.890',
    especialidade: 'Pediatria',
    horario: '09:15',
    data: TODAY,
    consultorio: 'Consultório 03',
    convenio: 'Ipasgo / HSC Saúde',
    status: 'Agendamentos',
    statusReal: 'Confirmada',
    telefone: '(34) 99222-3344',
    observacoes: 'Acompanhado pela mãe'
  },
  {
    id: 'cons-103',
    paciente: 'Carlos Eduardo Martins',
    prontuario: 'PRONT-73910',
    idade: 45,
    medico: 'Dr. Fernando Henrique Lima',
    crm: 'CRM/MG 38.411',
    especialidade: 'Ortopedia',
    horario: '10:00',
    data: TODAY,
    consultorio: 'Consultório 01',
    convenio: 'Bradesco Saúde',
    status: 'Agendamentos',
    statusReal: 'Agendado',
    telefone: '(34) 99333-4455',
    observacoes: 'Dor em joelho esquerdo'
  },
  {
    id: 'cons-104',
    paciente: 'Beatriz Costa Rezende',
    prontuario: 'PRONT-95821',
    idade: 29,
    medico: 'Dra. Juliana Vasconcelos',
    crm: 'CRM/MG 61.025',
    especialidade: 'Ginecologia e Obstetrícia',
    horario: '10:45',
    data: TODAY,
    consultorio: 'Consultório 05',
    convenio: 'Particular',
    status: 'Agendamentos',
    statusReal: 'Enviada',
    telefone: '(34) 99444-5566',
    observacoes: 'Lembrete enviado via WhatsApp'
  },
  {
    id: 'cons-105',
    paciente: 'Antônio Ferreira Filho',
    prontuario: 'PRONT-66231',
    idade: 71,
    medico: 'Dr. Lucas Alcantara',
    crm: 'CRM/MG 49.332',
    especialidade: 'Neurologia',
    horario: '14:30',
    data: TODAY,
    consultorio: 'Consultório 02',
    convenio: 'Cassi',
    status: 'Agendamentos',
    statusReal: 'Confirmada',
    telefone: '(34) 99555-6677',
    observacoes: 'Confirmado presencialmente'
  },
  {
    id: 'cons-106',
    paciente: 'Luciana Rocha',
    prontuario: 'PRONT-84729',
    idade: 38,
    medico: 'Dra. Patricia Medeiros',
    crm: 'CRM/MG 41.780',
    especialidade: 'Dermatologia',
    horario: '11:30',
    data: TODAY,
    consultorio: 'Consultório 04',
    convenio: 'Amil',
    status: 'Agendamentos',
    statusReal: 'Cancelada',
    telefone: '(34) 99666-7788',
    observacoes: 'Paciente desmarcou devido a imprevisto'
  },
  // ── ONTEM (D-1) ──
  {
    id: 'cons-090',
    paciente: 'Antônio Ferreira Souza',
    prontuario: 'PRONT-64102',
    idade: 58,
    medico: 'Dr. Roberto Carlos Mendes',
    crm: 'CRM/MG 45.120',
    especialidade: 'Cardiologia',
    horario: '09:00',
    data: YESTERDAY,
    consultorio: 'Consultório 01',
    convenio: 'Unimed',
    status: 'Agendamentos',
    statusReal: 'Concluída',
    telefone: '(34) 99555-6677',
    observacoes: 'Avaliados exames eletrocardiograma'
  },
  {
    id: 'cons-091',
    paciente: 'Luciana Aparecida Lima',
    prontuario: 'PRONT-52891',
    idade: 37,
    medico: 'Dra. Patricia Medeiros',
    crm: 'CRM/MG 41.780',
    especialidade: 'Dermatologia',
    horario: '11:00',
    data: YESTERDAY,
    consultorio: 'Consultório 04',
    convenio: 'HSC Saúde',
    status: 'Agendamentos',
    statusReal: 'Concluída',
    telefone: '(34) 99666-7788'
  },
  {
    id: 'cons-092',
    paciente: 'Gabriel Henrique Ramos',
    prontuario: 'PRONT-43109',
    idade: 19,
    medico: 'Dr. Fernando Henrique Lima',
    crm: 'CRM/MG 38.411',
    especialidade: 'Ortopedia',
    horario: '14:30',
    data: YESTERDAY,
    consultorio: 'Consultório 01',
    convenio: 'Bradesco Saúde',
    status: 'Agendamentos',
    statusReal: 'Concluída',
    telefone: '(34) 99777-8899'
  },
  // ── HÁ 2 DIAS (D-2) ──
  {
    id: 'cons-080',
    paciente: 'Raimundo Nonato Silva',
    prontuario: 'PRONT-31908',
    idade: 71,
    medico: 'Dr. Lucas Alcantara',
    crm: 'CRM/MG 49.332',
    especialidade: 'Neurologia',
    horario: '10:00',
    data: TWO_DAYS_AGO,
    consultorio: 'Consultório 02',
    convenio: 'Unimed',
    status: 'Agendamentos',
    statusReal: 'Concluída',
    telefone: '(34) 99888-9900'
  },
  {
    id: 'cons-081',
    paciente: 'Fernanda Cristina Rocha',
    prontuario: 'PRONT-29014',
    idade: 42,
    medico: 'Dra. Amanda Silveira',
    crm: 'CRM/MG 52.890',
    especialidade: 'Pediatria',
    horario: '15:00',
    data: TWO_DAYS_AGO,
    consultorio: 'Consultório 03',
    convenio: 'Amil',
    status: 'Agendamentos',
    statusReal: 'Concluída',
    telefone: '(34) 99999-0011'
  },
  // ── HÁ 3 DIAS (D-3) ──
  {
    id: 'cons-070',
    paciente: 'Sebastião Alves Ribeiro',
    prontuario: 'PRONT-18239',
    idade: 68,
    medico: 'Dr. Roberto Carlos Mendes',
    crm: 'CRM/MG 45.120',
    especialidade: 'Cardiologia',
    horario: '16:00',
    data: THREE_DAYS_AGO,
    consultorio: 'Consultório 01',
    convenio: 'Ipasgo',
    status: 'Agendamentos',
    statusReal: 'Concluída',
    telefone: '(34) 99000-1122'
  },
  // ── AMANHÃ (D+1) ──
  {
    id: 'cons-110',
    paciente: 'Camila Fernandes Vilela',
    prontuario: 'PRONT-99210',
    idade: 31,
    medico: 'Dra. Juliana Vasconcelos',
    crm: 'CRM/MG 61.025',
    especialidade: 'Ginecologia e Obstetrícia',
    horario: '08:30',
    data: TOMORROW,
    consultorio: 'Consultório 05',
    convenio: 'Unimed',
    status: 'Agendamentos',
    statusReal: 'Agendado',
    telefone: '(34) 99123-9876'
  }
];

// ── GERENCIAMENTO DE PERSISTÊNCIA MANUAL DO KANBAN E CONFIRMAÇÕES ────────────
const KANBAN_STORAGE_KEY = 'hsc_centro_medico_kanban_manual_status_v1';
const KANBAN_CONFIRMED_KEY = 'hsc_centro_medico_confirmacoes_v1';
const KANBAN_ADDED_ORDER_KEY = 'hsc_centro_medico_kanban_added_order_v1';
const KANBAN_LAST_SYNC_KEY = 'hsc_centro_medico_last_sync_v1';

// Lê o mapa de status manuais do localStorage
const getStoredManualStatusMap = (): Record<string, KanbanStatus> => {
  try {
    const raw = localStorage.getItem(KANBAN_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

// Lê o mapa de confirmações do paciente
const getStoredConfirmedPatientsMap = (): Record<string, { confirmadoPeloPaciente: boolean; confirmadoEm?: string }> => {
  try {
    const raw = localStorage.getItem(KANBAN_CONFIRMED_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

// Lê o mapa da sequência/ordem em que os cards foram sendo adicionados (timestamp em ms)
const getStoredAddedOrderMap = (): Record<string, number> => {
  try {
    const raw = localStorage.getItem(KANBAN_ADDED_ORDER_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

// Grava o timestamp de adição de um card
const recordCardAddedOrder = (cardId: string, timestamp: number = Date.now()): Record<string, number> => {
  try {
    const current = getStoredAddedOrderMap();
    current[cardId] = timestamp;
    localStorage.setItem(KANBAN_ADDED_ORDER_KEY, JSON.stringify(current));
    return current;
  } catch {
    return {};
  }
};

// Salva a confirmação no localStorage e Supabase
const persistConfirmedPatient = async (cardId: string, confirmado: boolean) => {
  try {
    const current = getStoredConfirmedPatientsMap();
    const now = Date.now();
    if (confirmado) {
      current[cardId] = {
        confirmadoPeloPaciente: true,
        confirmadoEm: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      };
      recordCardAddedOrder(cardId, now);
    } else {
      delete current[cardId];
    }
    localStorage.setItem(KANBAN_CONFIRMED_KEY, JSON.stringify(current));

    try {
      await supabase.from('centro_medico_kanban_cards').upsert({
        card_id: cardId,
        status: confirmado ? 'Confirmadas' : 'Agendamentos',
        confirmado_pelo_paciente: confirmado,
        updated_at: new Date(now).toISOString()
      }, { onConflict: 'card_id' });
    } catch {}

    // Notifica outros componentes da tela
    window.dispatchEvent(new CustomEvent('consulta_confirmada_evento', { detail: { cardId, confirmado, addedAt: now } }));
  } catch (e) {
    console.warn('Erro ao persistir confirmação do paciente:', e);
  }
};

// Salva o novo status no localStorage e opcionalmente no Supabase
const persistCardManualStatus = async (
  cardId: string,
  newStatus: KanbanStatus,
  cardData?: Partial<ConsultaAgendada>
) => {
  try {
    const now = Date.now();
    // 1. Persistência imediata no navegador (localStorage)
    const currentMap = getStoredManualStatusMap();
    currentMap[cardId] = newStatus;
    localStorage.setItem(KANBAN_STORAGE_KEY, JSON.stringify(currentMap));

    // Se estiver sendo adicionado/movido para Confirmadas, grava a ordem de adição
    if (newStatus === 'Confirmadas') {
      recordCardAddedOrder(cardId, now);
    }

    // 2. Persistência remota assíncrona no Supabase
    try {
      await supabase.from('centro_medico_kanban_cards').upsert({
        card_id: cardId,
        status: newStatus,
        paciente: cardData?.paciente || null,
        data_consulta: cardData?.data || null,
        updated_at: new Date(now).toISOString()
      }, { onConflict: 'card_id' });
    } catch {
      // Ignora falhas de conexão se a tabela remota for inacessível
    }
  } catch (err) {
    console.warn('[Kanban] Falha ao persistir status manual:', err);
  }
};

// Referência persistente para reaproveitar a mesma aba do WhatsApp Web sem abrir múltiplas abas
let whatsAppWindowRef: Window | null = null;

export default function CentroMedico() {
  // Estados Principais: Kanban e Escalas Médicas
  const [activeTab, setActiveTab] = useState<'escalas' | 'kanban'>('kanban');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [selectedEspecialidade, setSelectedEspecialidade] = useState<string>('TODAS');
  const [selectedStatus, setSelectedStatus] = useState<string>('TODOS');
  
  // Mapa de pacientes confirmados e mapa de ordem de adição
  const [confirmedPatientsMap, setConfirmedPatientsMap] = useState(getStoredConfirmedPatientsMap);
  const [addedOrderMap, setAddedOrderMap] = useState<Record<string, number>>(getStoredAddedOrderMap);

  // Estados de Dados inicializados respeitando o status fixado, confirmações e sequência de adição
  const [escalas, setEscalas] = useState<EscalaMedica[]>(INITIAL_ESCALAS);
  const [consultas, setConsultas] = useState<ConsultaAgendada[]>(() => {
    const manualMap = getStoredManualStatusMap();
    const confMap = getStoredConfirmedPatientsMap();
    const orderMap = getStoredAddedOrderMap();
    return INITIAL_CONSULTAS.map(c => {
      const isCancelado = isStatusCanceladoTasy(c.statusReal, c.status);
      const targetStatus: KanbanStatus = isCancelado
        ? 'Canceladas'
        : (manualMap[c.id] || (confMap[c.id]?.confirmadoPeloPaciente ? 'Confirmadas' : c.status));

      return {
        ...c,
        status: targetStatus,
        confirmadoPeloPaciente: Boolean(confMap[c.id]?.confirmadoPeloPaciente),
        confirmadoEm: confMap[c.id]?.confirmadoEm,
        addedAt: orderMap[c.id]
      };
    });
  });

  // Salva cache de consultas para acesso pela tela de confirmação de consulta
  useEffect(() => {
    try {
      localStorage.setItem('hsc_centro_medico_consultas_cache_v1', JSON.stringify(consultas));
    } catch {}
  }, [consultas]);

  // Listener para sincronização em tempo real de confirmações
  useEffect(() => {
    const handleRemoteConfirmEvent = (e?: any) => {
      const updatedConf = getStoredConfirmedPatientsMap();
      const updatedOrder = getStoredAddedOrderMap();

      if (e?.detail?.cardId && e?.detail?.addedAt) {
        updatedOrder[e.detail.cardId] = e.detail.addedAt;
      }

      setConfirmedPatientsMap(updatedConf);
      setAddedOrderMap(updatedOrder);

      setConsultas(prev => prev.map(c => ({
        ...c,
        confirmadoPeloPaciente: Boolean(updatedConf[c.id]?.confirmadoPeloPaciente),
        confirmadoEm: updatedConf[c.id]?.confirmadoEm,
        status: updatedConf[c.id]?.confirmadoPeloPaciente ? 'Confirmadas' : c.status,
        addedAt: updatedOrder[c.id] ?? c.addedAt
      })));
    };

    window.addEventListener('consulta_confirmada_evento', handleRemoteConfirmEvent);
    window.addEventListener('storage', handleRemoteConfirmEvent);
    return () => {
      window.removeEventListener('consulta_confirmada_evento', handleRemoteConfirmEvent);
      window.removeEventListener('storage', handleRemoteConfirmEvent);
    };
  }, []);

  // Efeito ao carregar o componente para sincronizar posições salvas no Supabase
  useEffect(() => {
    const syncRemoteKanbanStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('centro_medico_kanban_cards')
          .select('card_id, status, updated_at');

        if (!error && data && data.length > 0) {
          const currentMap = getStoredManualStatusMap();
          const currentOrderMap = getStoredAddedOrderMap();

          data.forEach((row: any) => {
            if (row.card_id && row.status) {
              currentMap[row.card_id] = row.status as KanbanStatus;
            }
            if (row.card_id && row.updated_at && !currentOrderMap[row.card_id]) {
              currentOrderMap[row.card_id] = new Date(row.updated_at).getTime();
            }
          });

          localStorage.setItem(KANBAN_STORAGE_KEY, JSON.stringify(currentMap));
          localStorage.setItem(KANBAN_ADDED_ORDER_KEY, JSON.stringify(currentOrderMap));

          setAddedOrderMap(currentOrderMap);
          setConsultas(prev => prev.map(c => {
            if (isStatusCanceladoTasy(c.statusReal, c.status)) {
              return { ...c, status: 'Canceladas' };
            }
            const manualStatus = currentMap[c.id];
            const addedTimestamp = currentOrderMap[c.id];
            return {
              ...c,
              ...(manualStatus ? { status: manualStatus } : {}),
              ...(addedTimestamp ? { addedAt: addedTimestamp } : {})
            };
          }));
        }
      } catch {
        // Fallback silencioso mantendo o localStorage
      }
    };

    syncRemoteKanbanStatus();
  }, []);
  
  // Estados de Drag and Drop
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<KanbanStatus | null>(null);

  // Estados de Operação / Sincronização
  const [isSyncing, setIsSyncing] = useState(false);
  const [usingMock, setUsingMock] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(() => {
    return localStorage.getItem(KANBAN_LAST_SYNC_KEY) || null;
  });
  const [resendingCardId, setResendingCardId] = useState<string | null>(null);
  const [isSendingAll, setIsSendingAll] = useState(false);
  const [sendingProgress, setSendingProgress] = useState<{ current: number; total: number } | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [debugModalOpen, setDebugModalOpen] = useState(false);
  const [debugData, setDebugData] = useState<{
    url?: string;
    method?: string;
    timestamp?: string;
    targetDate?: string;
    count?: number;
    raw?: any;
    error?: string;
  } | null>(null);

  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  };

  // Lista de especialidades únicas para filtro
  const especialidades = useMemo(() => {
    const setEsp = new Set<string>();
    escalas.forEach(e => setEsp.add(e.especialidade));
    consultas.forEach(c => setEsp.add(c.especialidade));
    return ['TODAS', ...Array.from(setEsp)];
  }, [escalas, consultas]);

  // Handler de Sincronização com n8n por Data
  const handleSyncWebhookForDate = async (targetDate: string) => {
    setIsSyncing(true);
    try {
      showToast('info', `Consultando n8n para atualizar agendamentos de ${formatDateLabel(targetDate)}...`);
      const [ano, mes, dia] = targetDate.split('-');
      const dataBR = `${dia}/${mes}/${ano}`;

      // Calcula o dia seguinte para garantir que o BETWEEN do Oracle cubra as 24h do dia
      const dTarget = new Date(parseInt(ano, 10), parseInt(mes, 10) - 1, parseInt(dia, 10));
      const dNext = new Date(dTarget);
      dNext.setDate(dNext.getDate() + 1);
      const nextDia = String(dNext.getDate()).padStart(2, '0');
      const nextMes = String(dNext.getMonth() + 1).padStart(2, '0');
      const nextAno = dNext.getFullYear();
      const dataBRNext = `${nextDia}/${nextMes}/${nextAno}`;

      const espFilter = selectedEspecialidade && selectedEspecialidade !== 'TODAS' ? selectedEspecialidade : undefined;
      const searchFilter = searchTerm && searchTerm.trim() ? searchTerm.trim() : undefined;

      // Payload exatamente compatível com a query SQL do n8n:
      // AND a.DT_AGENDA BETWEEN TO_DATE(:dataini, 'DD/MM/YYYY') AND TO_DATE(:datafim, 'DD/MM/YYYY')
      const payload = {
        dataini: dataBR,               // '07/10/2026'
        datafim: dataBRNext,           // '08/10/2026' (dia seguinte para cobrir todas as horas de 07/10/2026 no BETWEEN do Oracle)
        dataini_dia: dataBR,
        datafim_dia: dataBR,
        DATAINI: dataBR,
        DATAFIM: dataBRNext,
        data_ini: dataBR,
        data_fim: dataBRNext,
        date: targetDate,              // '2026-10-07'
        data: dataBR,                  // '07/10/2026'
        data_br: dataBR,               // '07/10/2026'
        dt_agenda: dataBR,             // '07/10/2026'
        dt_agenda_br: dataBR,          // '07/10/2026'
        data_inicio: dataBR,
        dia,
        mes,
        ano,
        cd_setor_atendimento: '109',
        setor: '109',
        ...(espFilter ? { especialidade: espFilter } : {}),
        ...(searchFilter ? { search: searchFilter, busca: searchFilter } : {})
      };

      const result = await webhookService.triggerConsultaCentroMedico(payload);
      console.log('[Centro Médico] Resposta bruta recebida:', result);

      const responseData = (result && typeof result === 'object' && result.data !== undefined)
        ? result.data
        : result;

      const endpointUrl = result?.url || 'https://n8n-n8n.7woir1.easypanel.host/webhook/d3f00b1e-9dac-4be8-ad07-f58ec85789e5';
      const httpMethod = result?.method || 'POST';

      // Detecta aviso de Workflow Started
      const isWorkflowStartedNotice = 
        responseData && 
        typeof responseData === 'object' && 
        !Array.isArray(responseData) && 
        typeof responseData.message === 'string' && 
        responseData.message.toLowerCase().includes('workflow started');

      if (isWorkflowStartedNotice) {
        setDebugData({
          url: endpointUrl,
          method: httpMethod,
          timestamp: new Date().toLocaleTimeString('pt-BR'),
          targetDate,
          count: 0,
          raw: responseData,
          error: 'O nó Webhook do n8n está configurado com "Respond: Immediately". Altere para "Respond: When Last Node Finishes" no n8n para devolver a lista de agendamentos.'
        });
        showToast(
          'error',
          'O n8n iniciou o fluxo, mas o nó Webhook respondeu "Workflow started". No n8n, altere "Respond" para "When Last Node Finishes" para devolver as consultas.'
        );
        setIsSyncing(false);
        return;
      }

      // 1. Extração universal de consultas e escalas da resposta
      let rawConsultasList: any[] = [];
      let rawEscalasList: any[] = [];

      const extractItemsList = (data: any): any[] => {
        if (!data) return [];
        if (typeof data === 'string') {
          try {
            const parsed = JSON.parse(data);
            return extractItemsList(parsed);
          } catch {
            return [];
          }
        }
        if (Array.isArray(data)) return data;
        if (typeof data === 'object') {
          for (const key of ['consultas', 'agendamentos', 'agenda', 'data', 'items', 'result', 'results', 'rows', 'output', 'body', 'pacientes', 'consultas_agendadas']) {
            if (Array.isArray(data[key])) return data[key];
          }
          if (data.json || data.nm_paciente || data.paciente || data.cd_agenda || data.NM_PACIENTE) {
            return [data];
          }
        }
        return [];
      };

      rawConsultasList = extractItemsList(responseData);

      if (responseData && typeof responseData === 'object' && !Array.isArray(responseData)) {
        if (Array.isArray(responseData.escalas)) rawEscalasList = responseData.escalas;
        else if (Array.isArray(responseData.plantonistas)) rawEscalasList = responseData.plantonistas;
      }

      if (rawEscalasList.length > 0) {
        setEscalas(rawEscalasList);
      }

      // Guarda informações no painel de debug para conferência imediata
      setDebugData({
        url: endpointUrl,
        method: httpMethod,
        timestamp: new Date().toLocaleTimeString('pt-BR'),
        targetDate,
        count: rawConsultasList.length,
        raw: responseData
      });

      if (rawConsultasList.length > 0) {
        setConsultas(prev => {
          const currentMemMap = new Map(prev.map(c => [c.id, c.status]));
          const localSavedMap = getStoredManualStatusMap();

          return rawConsultasList.map((incoming: any, idx: number) => {
            const target = incoming?.json && typeof incoming.json === 'object' 
              ? { ...incoming.json, ...incoming } 
              : incoming;

            const getVal = (possibleKeys: string[], defaultVal: any = '') => {
              if (!target || typeof target !== 'object') return defaultVal;
              for (const key of possibleKeys) {
                const foundKey = Object.keys(target).find(k => k.trim().toUpperCase() === key.toUpperCase());
                if (foundKey !== undefined && target[foundKey] !== null && target[foundKey] !== undefined && target[foundKey] !== '') {
                  return target[foundKey];
                }
              }
              return defaultVal;
            };

            // Mapeamento exato das colunas retornadas pela query Oracle
            const rawId = getVal(['NR_SEQUENCIA', 'id', 'cd_agenda', 'nr_atendimento', 'id_consulta'], `cons-tasy-${idx}`);
            const paciente = String(getVal(['NM_PACIENTE', 'nm_pessoa_fisica', 'paciente', 'nome_paciente', 'nome'], 'Paciente Não Informado'));
            const prontuario = String(getVal(['NR_PRONTUARIO', 'nr_sequencia', 'cd_pessoa_fisica', 'pront'], `SEQ-${rawId}`));
            const idade = Number(getVal(['idade', 'nr_idade', 'age', 'qt_anos'], 0)) || 0;
            const medico = String(getVal(['MEDICO', 'nm_medico', 'nm_prestador', 'prestador', 'profissional'], 'Médico Responsável'));
            const crm = String(getVal(['crm', 'cd_crm', 'nr_crm', 'nr_registro'], ''));
            const especialidade = String(getVal(['ESPECIALIDADE', 'ds_especialidade', 'specialty'], 'Clínica Geral'));
            
            // Tratamento de data
            let rawData = String(getVal(['DT_AGENDA', 'data', 'dt_consulta', 'date'], targetDate)).trim();
            if (/^\d{4}-\d{2}-\d{2}/.test(rawData)) rawData = rawData.slice(0, 10);
            else if (/^\d{2}\/\d{2}\/\d{4}/.test(rawData)) {
              const [d, m, y] = rawData.slice(0, 10).split('/');
              rawData = `${y}-${m}-${d}`;
            } else {
              rawData = targetDate;
            }

            // Tratamento de horário a partir de DT_AGENDA (Oracle) ou campo específico
            let rawHora = String(getVal(['horario', 'hr_agenda', 'hora', 'time', 'hora_agenda'], '')).trim();
            if (!rawHora || rawHora === '') {
              const dtOriginal = String(getVal(['DT_AGENDA', 'dt_consulta', 'dt_atendimento'], ''));
              const horaMatch = dtOriginal.match(/\b([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?\b/);
              rawHora = horaMatch ? horaMatch[0].slice(0, 5) : '08:00';
            } else if (/^\d{2}:\d{2}/.test(rawHora)) {
              rawHora = rawHora.slice(0, 5);
            }

            // Setor / Consultório retornado da query
            const consultorio = String(getVal(['SETOR', 'obter_desc_setor_atend', 'consultorio', 'ds_consultorio', 'ds_local', 'local'], 'Centro Médico (Setor 109)'));
            
            // Tipo de agendamento (Consulta, Retorno, Encaixe) da coluna DS_CLASSIFICACAO
            const convenio = String(getVal(['DS_CLASSIFICACAO', 'convenio', 'ds_convenio', 'nm_convenio'], 'Consulta'));
            
            // Telefone da coluna NR_TELEFONE
            const telefone = String(getVal(['NR_TELEFONE', 'telefone', 'nr_telefone_celular', 'nr_celular', 'phone', 'celular'], ''));
            
            // Status real da coluna DS_STATUS_AGENDA
            const realStatus = String(getVal(['DS_STATUS_AGENDA', 'statusReal', 'status_real', 'ds_status', 'ie_status'], 'Normal'));

            const isCancelado = isStatusCanceladoTasy(realStatus, target?.ds_status_agenda || target?.status);

            const manualStatus = localSavedMap[rawId] || currentMemMap.get(rawId);
            const targetColumn: KanbanStatus = isCancelado ? 'Canceladas' : (manualStatus || 'Agendamentos');

            return {
              id: String(rawId),
              paciente,
              prontuario,
              idade,
              medico,
              crm,
              especialidade,
              horario: rawHora,
              data: rawData,
              consultorio,
              convenio,
              telefone,
              status: targetColumn,
              statusReal: realStatus
            };
          });
        });

        setUsingMock(false);
        const timeNow = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        setLastSyncTime(timeNow);
        localStorage.setItem(KANBAN_LAST_SYNC_KEY, timeNow);
        showToast('success', `${rawConsultasList.length} agendamento(s) sincronizados via n8n com sucesso às ${timeNow}!`);
      } else {
        setUsingMock(false);
        setConsultas([]);
        showToast('info', `O n8n respondeu com sucesso, mas retornou 0 agendamentos para ${formatDateLabel(targetDate)}.`);
      }
    } catch (error: any) {
      console.error('[Centro Médico] Falha ao consultar n8n:', error);
      const errMsg = error?.message || 'Falha de conexão com o webhook n8n';
      setDebugData({
        url: 'https://n8n-n8n.7woir1.easypanel.host/webhook/d3f00b1e-9dac-4be8-ad07-f58ec85789e5',
        method: 'POST',
        timestamp: new Date().toLocaleTimeString('pt-BR'),
        targetDate,
        count: 0,
        error: errMsg
      });
      showToast('error', `Erro na sincronização: ${errMsg}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncWebhook = async () => {
    await handleSyncWebhookForDate(selectedDate);
  };

  const handleDateChange = (newDateStr: string) => {
    setSelectedDate(newDateStr);
    handleSyncWebhookForDate(newDateStr);
  };

  const handleStepDay = (days: number) => {
    if (!selectedDate) return;
    const parts = selectedDate.split('-');
    if (parts.length !== 3) return;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    const d = new Date(year, month - 1, day);
    d.setDate(d.getDate() + days);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const newDateStr = `${yyyy}-${mm}-${dd}`;
    handleDateChange(newDateStr);
  };

  // Mover Card de Consulta entre Colunas do Kanban
  const moveCardToStatus = async (cardId: string, newStatus: KanbanStatus) => {
    const targetCard = consultas.find(c => c.id === cardId);
    if (!targetCard) return;

    const now = Date.now();
    const timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    // Atualiza o estado da coluna no Kanban registrando a data/hora de movimentação
    setConsultas(prev => prev.map(c => {
      if (c.id === cardId) {
        return {
          ...c,
          status: newStatus,
          addedAt: now,
          ...(newStatus === 'Confirmadas' && !c.confirmadoEm ? { confirmadoEm: timeStr } : {})
        };
      }
      return c;
    }));

    if (newStatus === 'Confirmadas') {
      recordCardAddedOrder(cardId, now);
      setAddedOrderMap(prev => ({ ...prev, [cardId]: now }));
    }

    showToast('success', `Paciente ${targetCard.paciente} movido para "${newStatus}".`);

    // Fixa a movimentação permanentemente no localStorage e Supabase até nova movimentação manual
    persistCardManualStatus(cardId, newStatus, targetCard);

    // Disparo de WhatsApp ao mover para "Enviadas" ou "Confirmadas"
    if (newStatus === 'Enviadas' || newStatus === 'Confirmadas') {
      sendWhatsAppNotification(targetCard, newStatus, false);
    }
  };

  // Disparo / Reenvio de notificação de WhatsApp (utilizado no drag-and-drop e no botão de reenvio exclusivo do Kanban)
  const sendWhatsAppNotification = async (targetCard: ConsultaAgendada, statusRef: KanbanStatus, isResend = false) => {
    const isConfirmacao = statusRef === 'Confirmadas';
    const actionLabel = isConfirmacao ? 'confirmação' : 'agendamento';
    const verb = isResend ? 'Reenviando' : 'Disparando';

    try {
      showToast('info', `${verb} mensagem de ${actionLabel} por WhatsApp para ${targetCard.paciente}...`);

      const publicBaseUrl = (import.meta.env.VITE_PUBLIC_APP_URL as string) || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
      const cleanBaseUrl = publicBaseUrl.replace(/\/+$/, '');
      const linkConfirmacao = `${cleanBaseUrl}/confirmar-consulta/${targetCard.id}`;

      const dataFormatada = formatDateToBR(targetCard.data);
      const customText = isConfirmacao
        ? `🏥 *Centro Médico - Hospital Santa Casa*\nOlá, *${targetCard.paciente}*!\n\nConfirmamos os dados da sua consulta no Centro Médico:\n📅 *Data:* ${dataFormatada}\n⏰ *Horário:* O atendimento é realizado por ordem de chegada.\n👨‍⚕️ *Médico(a):* ${targetCard.medico}${targetCard.crm ? ` (CRM: ${targetCard.crm})` : ''} - ${targetCard.especialidade}\n📍 *Local:* Centro Médico da Santa Casa\n\n🔗 *Confirmação de Consulta:*\n\n${linkConfirmacao}\n\n_Hospital Santa Casa de Misericórdia_`
        : `🏥 *Centro Médico - Hospital Santa Casa*\nOlá, *${targetCard.paciente}*!\n\nVocê tem uma consulta agendada no Centro Médico:\n👨‍⚕️ *Médico(a):* ${targetCard.medico}${targetCard.crm ? ` (CRM: ${targetCard.crm})` : ''} - ${targetCard.especialidade}\n📅 *Data:* ${dataFormatada}\n⏰ *Horário:* O atendimento é realizado por ordem de chegada.\n📍 *Local:* Centro Médico da Santa Casa\n\n_Hospital Santa Casa de Misericórdia_`;

      const appOrigin = typeof window !== 'undefined' ? window.location.origin : '';

      let res = await supabase.functions.invoke('whatsapp-agendamento-enviado', {
        body: {
          cardId: targetCard.id,
          paciente: targetCard.paciente,
          prontuario: targetCard.prontuario,
          medico: targetCard.medico,
          crm: targetCard.crm,
          especialidade: targetCard.especialidade,
          consultorio: targetCard.consultorio,
          horario: targetCard.horario,
          data: dataFormatada,
          convenio: targetCard.convenio,
          telefone: targetCard.telefone || '34988511343',
          recipient: '5584998444889',
          status: statusRef,
          tipo: isConfirmacao ? 'confirmacao' : 'envio',
          linkConfirmacao: linkConfirmacao,
          origin: appOrigin,
          text: customText,
          isResend: isResend
        }
      });

      if (res.error) {
        console.warn('[WhatsApp Agendamento] Tentando fallback para whatsapp-centro-medico:', res.error);
        res = await supabase.functions.invoke('whatsapp-centro-medico', {
          body: {
            cardId: targetCard.id,
            paciente: targetCard.paciente,
            prontuario: targetCard.prontuario,
            medico: targetCard.medico,
            crm: targetCard.crm,
            especialidade: targetCard.especialidade,
            consultorio: targetCard.consultorio,
            horario: targetCard.horario,
            data: dataFormatada,
            convenio: targetCard.convenio,
            sender: '34988511343',
            recipient: '5584998444889',
            text: customText || 'Você tem uma consulta no Centro Médico da Santa Casa'
          }
        });
      }

      const { data, error } = res;

      if (error) {
        console.warn('[WhatsApp Agendamento] Erro ao invocar Edge Function:', error);
        showToast('error', `Falha no envio do WhatsApp: ${error.message || 'Erro de comunicação'}`);
      } else if (data?.success) {
        showToast('success', `WhatsApp de ${actionLabel} ${isResend ? 'reenviado' : 'enviado'} com sucesso para ${targetCard.paciente}!`);
      } else {
        showToast('info', data?.message || 'Notificação processada.');
      }
    } catch (err: any) {
      console.error('[WhatsApp Agendamento] Falha na requisição:', err);
      showToast('error', `Erro ao disparar WhatsApp: ${err.message}`);
    }
  };

  // Reenvio manual exclusivo do Kanban para um card específico
  const handleResendWhatsApp = async (card: ConsultaAgendada) => {
    if (resendingCardId) return;
    setResendingCardId(card.id);
    try {
      await sendWhatsAppNotification(card, card.status, true);
    } finally {
      setResendingCardId(null);
    }
  };

  // Abrir conversa diretamente no WhatsApp Web reutilizando a aba caso já esteja aberta
  const handleOpenWhatsAppChat = (card: ConsultaAgendada) => {
    const rawTelefone = card.telefone ? String(card.telefone).trim() : '';
    if (!rawTelefone) {
      showToast('info', `O paciente ${card.paciente} não possui telefone cadastrado no Tasy.`);
      return;
    }

    // Remove qualquer caractere não numérico
    let cleanPhone = rawTelefone.replace(/\D/g, '');
    if (!cleanPhone) {
      showToast('error', `O telefone informado (${rawTelefone}) é inválido.`);
      return;
    }

    // Se vier com 8 ou 9 dígitos (sem DDD), assume o DDD padrão regional (34)
    if (cleanPhone.length === 8 || cleanPhone.length === 9) {
      cleanPhone = `34${cleanPhone}`;
    }

    // Se tiver 10 ou 11 dígitos (DDD + número), adiciona o DDI do Brasil (55)
    if (cleanPhone.length === 10 || cleanPhone.length === 11) {
      cleanPhone = `55${cleanPhone}`;
    }

    const dataFormatada = formatDateToBR(card.data);
    const defaultMsg = `🏥 *Centro Médico - Hospital Santa Casa*\nOlá, *${card.paciente}*!\n\nVocê tem uma consulta agendada no Centro Médico:\n👨‍⚕️ *Médico(a):* ${card.medico}${card.crm ? ` (CRM: ${card.crm})` : ''} - ${card.especialidade}\n📅 *Data:* ${dataFormatada}\n⏰ *Horário:* O atendimento é realizado por ordem de chegada.\n📍 *Local:* Centro Médico da Santa Casa\n\n_Hospital Santa Casa de Misericórdia_`;

    // URL direta do WhatsApp Web com mensagem pré-preenchida
    const url = `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(defaultMsg)}`;

    try {
      // Se a aba do WhatsApp já estiver aberta na sessão, foca nela e carrega a conversa do paciente
      if (whatsAppWindowRef && !whatsAppWindowRef.closed) {
        whatsAppWindowRef = window.open(url, 'hsc_whatsapp_web_tab');
        if (whatsAppWindowRef) {
          whatsAppWindowRef.focus();
        }
      } else {
        // Se ainda não estiver aberta, cria a aba nomeada e traz o foco para ela
        whatsAppWindowRef = window.open(url, 'hsc_whatsapp_web_tab');
        if (whatsAppWindowRef) {
          whatsAppWindowRef.focus();
        }
      }
    } catch {
      // Fallback seguro caso o navegador restrinja acesso à referência
      const fallbackWin = window.open(url, 'hsc_whatsapp_web_tab');
      if (fallbackWin) {
        fallbackWin.focus();
      }
    }
  };

  // Enviar todos os pacientes de "Agendamentos" para "Enviadas" com disparo de WhatsApp
  const handleSendAllAgendamentosToEnviadas = async () => {
    if (isSendingAll) return;
    const agendamentosCards = filteredConsultas.filter(c => c.status === 'Agendamentos');
    if (agendamentosCards.length === 0) {
      showToast('info', 'Não há pacientes na coluna Agendamentos para enviar.');
      return;
    }

    setIsSendingAll(true);
    setSendingProgress({ current: 0, total: agendamentosCards.length });
    showToast('info', `Iniciando envio de ${agendamentosCards.length} agendamento(s) para "Enviadas"...`);

    const now = Date.now();
    const updatedIds = new Set(agendamentosCards.map(c => c.id));

    // Move os cards visualmente para a coluna "Enviadas" imediatamente
    setConsultas(prev => prev.map(c => {
      if (updatedIds.has(c.id)) {
        return {
          ...c,
          status: 'Enviadas' as KanbanStatus,
          statusReal: 'Enviadas',
          addedAt: now
        };
      }
      return c;
    }));

    // Dispara WhatsApp e persiste cada paciente
    let successCount = 0;
    for (let i = 0; i < agendamentosCards.length; i++) {
      const card = agendamentosCards[i];
      setSendingProgress({ current: i + 1, total: agendamentosCards.length });
      const updatedCard: ConsultaAgendada = { ...card, status: 'Enviadas', statusReal: 'Enviadas', addedAt: now };
      persistCardManualStatus(card.id, 'Enviadas', updatedCard);

      try {
        await sendWhatsAppNotification(updatedCard, 'Enviadas', false);
        successCount++;
      } catch (err) {
        console.error(`Erro ao disparar WhatsApp para ${card.paciente}:`, err);
      }

      if (i < agendamentosCards.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 600));
      }
    }

    setIsSendingAll(false);
    setSendingProgress(null);
    showToast('success', `${successCount} paciente(s) movidos para "Enviadas" com sucesso!`);
  };

  // Ação de Confirmação de Consulta do Paciente
  const handleToggleConfirmPatient = async (cardId: string) => {
    const target = consultas.find(c => c.id === cardId);
    if (!target) return;

    const isCurrentlyConfirmed = Boolean(target.confirmadoPeloPaciente || confirmedPatientsMap[cardId]?.confirmadoPeloPaciente);
    const newConfirmedState = !isCurrentlyConfirmed;

    const now = Date.now();

    // Atualiza estado de confirmação persistido
    await persistConfirmedPatient(cardId, newConfirmedState);
    const updatedMap = getStoredConfirmedPatientsMap();
    setConfirmedPatientsMap(updatedMap);

    // Se confirmou pelo paciente, move também a coluna do Kanban para "Confirmadas"
    const newStatus: KanbanStatus = newConfirmedState ? 'Confirmadas' : target.status;
    if (newConfirmedState) {
      persistCardManualStatus(cardId, 'Confirmadas', target);
      recordCardAddedOrder(cardId, now);
      setAddedOrderMap(prev => ({ ...prev, [cardId]: now }));
    }

    setConsultas(prev => prev.map(c => {
      if (c.id === cardId) {
        return {
          ...c,
          status: newStatus,
          confirmadoPeloPaciente: newConfirmedState,
          confirmadoEm: newConfirmedState ? updatedMap[cardId]?.confirmadoEm : undefined,
          addedAt: newConfirmedState ? now : c.addedAt
        };
      }
      return c;
    }));

    if (newConfirmedState) {
      showToast('success', `Consulta de ${target.paciente} confirmada com sucesso! O agendamento agora está completamente verde no Centro Médico.`);
    } else {
      showToast('info', `Confirmação de ${target.paciente} desfeita.`);
    }
  };

  // Eventos de Drag & Drop HTML5 Native
  const handleDragStart = (e: React.DragEvent, cardId: string) => {
    setDraggedCardId(cardId);
    e.dataTransfer.setData('text/plain', cardId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, status: KanbanStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumn !== status) {
      setDragOverColumn(status);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent, targetStatus: KanbanStatus) => {
    e.preventDefault();
    setDragOverColumn(null);
    const cardId = e.dataTransfer.getData('text/plain') || draggedCardId;
    if (cardId) {
      moveCardToStatus(cardId, targetStatus);
    }
    setDraggedCardId(null);
  };

  // Escalas Filtradas
  const filteredEscalas = useMemo(() => {
    return escalas.filter(item => {
      const matchesSearch =
        item.medico.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.crm.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.especialidade.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.setor.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesEsp = selectedEspecialidade === 'TODAS' || item.especialidade === selectedEspecialidade;
      const matchesStatus = selectedStatus === 'TODOS' || item.status === selectedStatus;

      return matchesSearch && matchesEsp && matchesStatus;
    });
  }, [escalas, searchTerm, selectedEspecialidade, selectedStatus]);

  // Consultas Filtradas (com filtro por data selecionada)
  const filteredConsultas = useMemo(() => {
    return consultas.filter(item => {
      const matchesDate = !selectedDate || item.data === selectedDate;

      const matchesSearch =
        item.paciente.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.prontuario.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.medico.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.convenio.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesEsp = selectedEspecialidade === 'TODAS' || item.especialidade === selectedEspecialidade;
      const matchesStatus = selectedStatus === 'TODOS' || item.status === selectedStatus;

      return matchesDate && matchesSearch && matchesEsp && matchesStatus;
    });
  }, [consultas, selectedDate, searchTerm, selectedEspecialidade, selectedStatus]);

  // Cards de Métricas
  const stats = useMemo(() => {
    const totalPlantonistas = escalas.filter(e => e.status === 'Presencial' || e.status === 'Sobreaviso').length;
    const totalConsultasHoje = consultas.length;
    const canceladas = consultas.filter(c => c.status === 'Canceladas').length;
    const confirmadas = consultas.filter(c => c.status === 'Confirmadas').length;

    return { totalPlantonistas, totalConsultasHoje, canceladas, confirmadas };
  }, [escalas, consultas]);

  return (
    <div className="flex-1 space-y-4 min-h-[85vh] pb-6 w-full mx-auto px-1 sm:px-2 pt-2 text-foreground transition-all">
      {/* Header do Módulo Responsivo */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card border border-border/80 p-4 sm:p-5 rounded-2xl shadow-sm w-full min-w-0">
        <div className="space-y-1 min-w-0 w-full">
          <div className="flex items-start sm:items-center gap-3 w-full min-w-0">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shadow-inner shrink-0 mt-0.5 sm:mt-0">
              <Stethoscope className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex flex-wrap items-center gap-2">
                <span>Centro Médico</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium shrink-0">
                  DEV LOCALHOST
                </span>
              </h1>
              <p className="text-xs text-muted-foreground break-words mt-0.5">
                Gestão integrada de escalas médicas, plantonistas e acompanhamento em modo Kanban.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Cards de Métricas / Estatísticas Responsivos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 w-full min-w-0">
        <div className="bg-card border border-border/80 p-3.5 sm:p-4 rounded-xl shadow-sm flex items-center justify-between gap-3 min-w-0">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground font-medium truncate">Plantonistas Ativos</p>
            <p className="text-2xl font-bold text-foreground mt-1 truncate">{stats.totalPlantonistas}</p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <UserCheck className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-card border border-border/80 p-3.5 sm:p-4 rounded-xl shadow-sm flex items-center justify-between gap-3 min-w-0">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground font-medium truncate">Total de Pacientes</p>
            <p className="text-2xl font-bold text-foreground mt-1 truncate">{stats.totalConsultasHoje}</p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <CalendarDays className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-card border border-border/80 p-3.5 sm:p-4 rounded-xl shadow-sm flex items-center justify-between gap-3 min-w-0">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground font-medium truncate">Consultas Confirmadas</p>
            <p className="text-2xl font-bold text-foreground mt-1 truncate">{stats.confirmadas}</p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-card border border-border/80 p-3.5 sm:p-4 rounded-xl shadow-sm flex items-center justify-between gap-3 min-w-0">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground font-medium truncate">Agendas Canceladas</p>
            <p className="text-2xl font-bold text-foreground mt-1 truncate">{stats.canceladas}</p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
            <XCircle className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Navegação entre Abas, Controle de Datas e Filtros (Totalmente Responsivo) */}
      <div className="bg-card border border-border/80 p-3.5 sm:p-5 rounded-2xl shadow-sm space-y-4 relative w-full min-w-0">
        {/* Glow sutil de fundo */}
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-40 h-40 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3.5 relative z-10 w-full min-w-0">
          {/* Lado Esquerdo: Abas de Navegação */}
          <div className="flex items-center bg-muted/60 p-1.5 rounded-2xl border border-border/50 shadow-inner gap-1 max-w-full w-full sm:w-auto shrink-0">
            <button
              onClick={() => {
                setActiveTab('kanban');
                setSelectedStatus('TODOS');
              }}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-xl font-medium text-xs sm:text-sm transition-all duration-200 whitespace-nowrap shrink-0 ${
                activeTab === 'kanban'
                  ? 'bg-background text-primary shadow-sm font-bold border border-border/60 ring-1 ring-black/5 dark:ring-white/10 scale-[1.01]'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              }`}
            >
              <Kanban className="h-4 w-4 shrink-0 text-primary" />
              <span>Agenda</span>
              <span className="ml-0.5 px-2 py-0.5 rounded-full text-[10px] bg-primary/10 text-primary font-bold border border-primary/20">
                {filteredConsultas.length}
              </span>
            </button>

            <button
              onClick={() => {
                setActiveTab('escalas');
                setSelectedStatus('TODOS');
              }}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-xl font-medium text-xs sm:text-sm transition-all duration-200 whitespace-nowrap shrink-0 ${
                activeTab === 'escalas'
                  ? 'bg-background text-primary shadow-sm font-bold border border-border/60 ring-1 ring-black/5 dark:ring-white/10 scale-[1.01]'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              }`}
            >
              <Users className="h-4 w-4 shrink-0 text-primary" />
              <span>Escalas Médicas</span>
              <span className="ml-0.5 px-2 py-0.5 rounded-full text-[10px] bg-primary/10 text-primary font-bold border border-primary/20">
                {filteredEscalas.length}
              </span>
            </button>
          </div>

          {/* Lado Direito: Controle de Datas e Especialidades Fluido */}
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5 w-full xl:w-auto min-w-0">
            {/* Seletor de Data em Pill Box sem barra de rolagem */}
            <div className="flex items-center justify-between sm:justify-start gap-1 bg-background border border-border/80 p-1 rounded-2xl text-xs shadow-xs hover:border-primary/40 transition-all w-full sm:w-auto shrink-0">
              <button
                onClick={() => handleStepDay(-1)}
                title="Dia Anterior"
                className="px-2 sm:px-2.5 py-1.5 rounded-xl hover:bg-muted text-foreground transition-all flex items-center gap-1 font-medium text-xs active:scale-95 shrink-0"
              >
                <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                <span className="hidden sm:inline">Anterior</span>
              </button>

              <div className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 bg-muted/40 rounded-xl border border-border/40 hover:bg-muted/70 transition-colors shrink-0">
                <Calendar className="h-3.5 w-3.5 text-primary shrink-0" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => handleDateChange(e.target.value)}
                  className="bg-transparent text-foreground font-semibold focus:outline-none cursor-pointer text-xs w-[105px] sm:w-[115px]"
                />
              </div>

              <button
                onClick={() => handleDateChange(getDateOffset(0))}
                title="Ir para Hoje"
                className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95 shrink-0 ${
                  selectedDate === getDateOffset(0)
                    ? 'bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/30'
                    : 'hover:bg-muted text-muted-foreground'
                }`}
              >
                Hoje
              </button>

              <button
                onClick={() => handleStepDay(1)}
                title="Próximo Dia"
                className="px-2 sm:px-2.5 py-1.5 rounded-xl hover:bg-muted text-foreground transition-all flex items-center gap-1 font-medium text-xs active:scale-95 shrink-0"
              >
                <span className="hidden sm:inline">Próximo</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            {/* Filtro de Especialidade com Largura Flexível */}
            <div className="flex items-center gap-2 bg-background border border-border/80 px-3.5 py-2 rounded-2xl text-xs shadow-xs hover:border-primary/40 focus-within:ring-2 focus-within:ring-primary/20 transition-all w-full sm:w-auto sm:min-w-[210px] min-w-0">
              <Filter className="h-3.5 w-3.5 text-primary shrink-0" />
              <select
                value={selectedEspecialidade}
                onChange={e => setSelectedEspecialidade(e.target.value)}
                className="bg-transparent text-foreground focus:outline-none font-semibold cursor-pointer w-full text-xs min-w-0"
              >
                {especialidades.map(esp => (
                  <option key={esp} value={esp} className="bg-card text-foreground">
                    {esp === 'TODAS' ? 'Todas Especialidades' : esp}
                  </option>
                ))}
              </select>
            </div>

            {/* Botão de Atualização de Agenda (Gatilho para n8n) */}
            <button
              type="button"
              onClick={handleSyncWebhook}
              disabled={isSyncing}
              title="Consultar o n8n para atualizar os agendamentos do Tasy agora"
              className="flex items-center justify-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0 w-full sm:w-auto whitespace-nowrap"
            >
              <RefreshCw className={`h-3.5 w-3.5 shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Atualizando Agenda...' : 'Atualizar Agenda'}</span>
            </button>
          </div>
        </div>

        {/* Input de Busca com Largura Total e Padding Confortável */}
        <div className="relative group z-10 w-full min-w-0">
          <Search className="h-4 w-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors shrink-0" />
          <input
            type="text"
            placeholder={
              activeTab === 'escalas'
                ? 'Buscar por médico, CRM, especialidade ou setor...'
                : 'Buscar por paciente, médico ou classificação...'
            }
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-background border border-border/80 rounded-2xl text-xs sm:text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all shadow-xs"
          />
        </div>

        {/* Conteúdo Principal das Abas */}
        {/* ── ABA KANBAN ── */}
        {activeTab === 'kanban' && (
          <div key="tab-kanban" className="space-y-3 w-full min-w-0">
              {/* Grid das Colunas Kanban (4 colunas principais com distribuição perfeita e fluida sem barra de rolagem desnecessária) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch w-full min-w-0 pb-4">
                {KANBAN_COLUMNS.map(col => {
                  let colCards = filteredConsultas.filter(c => c.status === col.id);

                  // Organização rigorosa de todos os agendamentos
                  if (col.id === 'Confirmadas') {
                    // Na coluna "Confirmação", os pacientes confirmados recentemente ficam no topo, desempate por horário
                    colCards = [...colCards].sort((a, b) => {
                      const orderA = addedOrderMap[a.id] ?? a.addedAt ?? 0;
                      const orderB = addedOrderMap[b.id] ?? b.addedAt ?? 0;
                      if (orderA !== orderB) {
                        return orderB - orderA;
                      }
                      return (a.horario || '').localeCompare(b.horario || '', undefined, { numeric: true });
                    });
                  } else {
                    // Em todas as outras colunas (Agendamentos, Enviadas, Canceladas):
                    // Ordenação cronológica contínua por horário (ex: 07:00, 07:30, 08:00, 08:30...)
                    colCards = [...colCards].sort((a, b) => {
                      return (a.horario || '').localeCompare(b.horario || '', undefined, { numeric: true });
                    });
                  }

                  const isOver = dragOverColumn === col.id;

                  return (
                    <div
                      key={col.id}
                      onDragOver={e => handleDragOver(e, col.id)}
                      onDragLeave={handleDragLeave}
                      onDrop={e => handleDrop(e, col.id)}
                      className={`bg-background border rounded-2xl p-3 sm:p-3.5 space-y-3 min-h-[500px] sm:min-h-[540px] flex flex-col justify-between transition-all duration-200 w-full min-w-0 ${
                        col.border
                      } ${
                        isOver
                          ? 'ring-2 ring-primary bg-primary/5 shadow-md scale-[1.01]'
                          : 'bg-muted/10 hover:bg-background'
                      }`}
                    >
                      {/* Cabeçalho da Coluna Perfeitamente Alinhado */}
                      <div className="pb-3 border-b border-border/60 space-y-2 shrink-0 w-full min-w-0">
                        <div className="flex items-start justify-between gap-2 w-full min-w-0">
                          <div className="flex items-start gap-2 min-w-0 flex-1">
                            <span className={`h-2.5 w-2.5 rounded-full shrink-0 mt-0.5 ${col.dotColor}`} />
                            <h3 className={`font-bold text-xs uppercase tracking-tight leading-snug break-words ${col.color}`}>
                              {col.label}
                            </h3>
                          </div>
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${col.badgeBg}`}>
                            {colCards.length}
                          </span>
                        </div>
                        {/* Indicador de quando a sincronização funcionou (exclusivo para Agenda / Agendamentos) */}
                        {col.id === 'Agendamentos' && (
                          <div className="flex items-center justify-between gap-2 w-full min-w-0 pt-0.5">
                            {lastSyncTime ? (
                              <div
                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[11px] font-medium min-w-0 flex-1 shadow-xs"
                                title={`Última sincronização bem-sucedida com o Tasy às ${lastSyncTime}`}
                              >
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                                <span className="break-words leading-tight">Sincronizado às {lastSyncTime}</span>
                              </div>
                            ) : isSyncing ? (
                              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-[11px] font-medium min-w-0 flex-1 shadow-xs">
                                <RefreshCw className="h-3 w-3 animate-spin shrink-0 text-blue-500" />
                                <span className="break-words leading-tight">Sincronizando com Tasy...</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/60 text-muted-foreground border border-border/40 text-[11px] font-medium min-w-0 flex-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 shrink-0" />
                                <span className="break-words leading-tight">Aguardando sincronização</span>
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={handleSyncWebhook}
                              disabled={isSyncing}
                              title="Sincronizar agendamentos agora com o Tasy / n8n"
                              className="p-1.5 rounded-lg hover:bg-muted/80 text-muted-foreground hover:text-primary transition-all disabled:opacity-50 shrink-0 cursor-pointer"
                            >
                              <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin text-primary' : ''}`} />
                            </button>
                          </div>
                        )}

                        {/* Botão de Enviar Todos para o Kanban Enviadas */}
                        {col.id === 'Agendamentos' && (
                          <button
                            type="button"
                            onClick={handleSendAllAgendamentosToEnviadas}
                            disabled={colCards.length === 0 || isSendingAll}
                            title={
                              colCards.length === 0
                                ? 'Nenhum agendamento para enviar'
                                : `Mover todos os ${colCards.length} pacientes para Confirmação de agendamento e disparar WhatsApp`
                            }
                            className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition-all active:scale-[0.98] cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed text-center break-words mt-1 ${
                              isSendingAll
                                ? 'bg-purple-600/20 text-purple-700 dark:text-purple-300 border border-purple-500/40'
                                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20'
                            }`}
                          >
                            {isSendingAll ? (
                              <>
                                <RefreshCw className="h-3.5 w-3.5 animate-spin shrink-0" />
                                <span>
                                  {sendingProgress
                                    ? `Enviando (${sendingProgress.current}/${sendingProgress.total})...`
                                    : 'Enviando todos...'}
                                </span>
                              </>
                            ) : (
                              <>
                                <Send className="h-3.5 w-3.5 shrink-0" />
                                <span>Enviar Todos</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      {/* Lista de Cards da Coluna com Organização Uniforme */}
                      <div className="flex-1 space-y-2.5 overflow-y-auto pr-0.5 custom-scrollbar w-full min-w-0">
                        {colCards.length === 0 ? (
                          <div className="h-36 border border-dashed border-border/70 rounded-xl flex items-center justify-center text-center p-3 text-muted-foreground text-xs">
                            Nenhum paciente nesta etapa
                          </div>
                        ) : (
                          colCards.map(card => {
                            const isConfirmed = Boolean(card.confirmadoPeloPaciente || confirmedPatientsMap[card.id]?.confirmadoPeloPaciente);

                            return (
                              <div
                                key={card.id}
                                draggable
                                onDragStart={e => handleDragStart(e, card.id)}
                                className={`w-full max-w-full min-w-0 box-border p-3 sm:p-3.5 rounded-2xl transition-all cursor-grab active:cursor-grabbing flex flex-col gap-2.5 relative group border shadow-xs hover:shadow-md ${
                                  isConfirmed
                                    ? 'bg-emerald-600 dark:bg-emerald-600 text-white border-emerald-400 shadow-emerald-950/20 ring-1 ring-emerald-300/40'
                                    : 'bg-card border-border/80 hover:border-primary/40'
                                }`}
                              >
                                {/* Selo de Confirmação do Paciente */}
                                {isConfirmed && (
                                  <div className="w-full min-w-0 flex items-center gap-1.5 bg-emerald-800/90 text-white px-2.5 py-1 rounded-xl border border-emerald-300/40 text-[9.5px] sm:text-[10px] font-bold shadow-xs">
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300 animate-pulse shrink-0" />
                                    <span className="leading-tight break-words">PACIENTE CONFIRMOU PRESENÇA</span>
                                  </div>
                                )}

                                {/* Topo: Classificação */}
                                <div className="flex items-center w-full min-w-0">
                                  <span className={`px-2 py-0.5 rounded-md font-semibold text-[10.5px] uppercase tracking-wide border break-words ${
                                    isConfirmed
                                      ? 'bg-emerald-800/80 border-emerald-400/50 text-emerald-100'
                                      : 'bg-muted/70 border-border/60 text-muted-foreground'
                                  }`}>
                                    {card.convenio || 'Consulta'}
                                  </span>
                                </div>

                                {/* Nome do Paciente */}
                                <div className="w-full min-w-0">
                                  <h4 className={`text-sm sm:text-[15px] font-bold tracking-tight leading-snug break-words transition-colors ${
                                    isConfirmed ? 'text-white font-extrabold' : 'text-foreground group-hover:text-primary'
                                  }`}>
                                    {card.paciente}
                                  </h4>
                                </div>

                                {/* Bloco Clínico: Médico e Especialidade */}
                                <div className={`p-2.5 rounded-xl border space-y-1 text-xs w-full min-w-0 ${
                                  isConfirmed
                                    ? 'bg-emerald-700/50 border-emerald-400/30 text-emerald-50'
                                    : 'bg-muted/30 border-border/60 text-muted-foreground'
                                }`}>
                                  <div className="flex items-start gap-2 w-full min-w-0">
                                    <Stethoscope className={`h-3.5 w-3.5 flex-shrink-0 mt-0.5 ${
                                      isConfirmed ? 'text-emerald-200' : 'text-primary'
                                    }`} />
                                    <div className="flex-1 min-w-0 space-y-0.5">
                                      <p className={`font-semibold text-xs leading-snug break-words ${isConfirmed ? 'text-white' : 'text-foreground'}`}>
                                        {card.medico}
                                      </p>
                                      <p className={`text-[11px] font-medium leading-tight break-words ${isConfirmed ? 'text-emerald-100' : 'text-muted-foreground'}`}>
                                        {card.especialidade}
                                      </p>
                                    </div>
                                  </div>
                                </div>

                                {/* Contato: Telefone do Paciente */}
                                {card.telefone && (
                                  <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-xs w-full min-w-0 ${
                                    isConfirmed
                                      ? 'bg-emerald-700/40 border-emerald-400/30 text-emerald-100'
                                      : 'bg-muted/20 border-border/50 text-foreground'
                                  }`}>
                                    <Phone className={`h-3.5 w-3.5 shrink-0 ${isConfirmed ? 'text-emerald-200' : 'text-muted-foreground'}`} />
                                    <span className="font-medium text-[11.5px] tracking-wide break-words flex-1">
                                      {card.telefone}
                                    </span>
                                  </div>
                                )}

                                {/* Observações (quando existirem) */}
                                {card.observacoes && (
                                  <div className="w-full min-w-0">
                                    <div className={`flex items-start gap-1.5 p-2 rounded-lg border leading-relaxed text-xs w-full min-w-0 break-words ${
                                      isConfirmed
                                        ? 'bg-emerald-700/60 border-emerald-400 text-white'
                                        : 'bg-muted/40 border-border/50 text-foreground/90'
                                    }`}>
                                      <FileText className={`h-3.5 w-3.5 mt-0.5 flex-shrink-0 ${
                                        isConfirmed ? 'text-emerald-200' : 'text-muted-foreground/80'
                                      }`} />
                                      <span className="flex-1 min-w-0 break-words">{card.observacoes}</span>
                                    </div>
                                  </div>
                                )}

                                {/* Rodapé com Botões de Ação */}
                                <div className="pt-1 w-full min-w-0 space-y-1.5">
                                  {/* Botão na coluna "Agendamentos": Abrir no WhatsApp */}
                                  {card.status === 'Agendamentos' && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenWhatsAppChat(card);
                                      }}
                                      disabled={!card.telefone}
                                      title={
                                        card.telefone
                                          ? `Abrir conversa no WhatsApp com ${card.paciente} (${card.telefone})`
                                          : `Telefone não cadastrado no Tasy para ${card.paciente}`
                                      }
                                      className={`w-full min-w-0 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition-all active:scale-[0.98] shadow-xs text-center break-words ${
                                        card.telefone
                                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-emerald-500/20'
                                          : 'bg-muted/60 text-muted-foreground border border-border/40 opacity-70 cursor-not-allowed'
                                      }`}
                                    >
                                      <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                                      <span className="break-words">
                                        {card.telefone ? 'Abrir no WhatsApp' : 'Sem Telefone'}
                                      </span>
                                    </button>
                                  )}

                                  {/* Botões nas colunas "Enviadas" e "Confirmadas": Reenviar WhatsApp e Abrir Chat */}
                                  {(card.status === 'Enviadas' || card.status === 'Confirmadas') && (
                                    <div className="flex items-center gap-1.5 w-full min-w-0">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleResendWhatsApp(card);
                                        }}
                                        disabled={resendingCardId === card.id}
                                        title={`Reenviar notificação de WhatsApp para ${card.paciente}`}
                                        className={`flex-1 min-w-0 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition-all active:scale-[0.98] cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed text-center break-words ${
                                          isConfirmed
                                            ? 'bg-emerald-800 hover:bg-emerald-900 text-white border border-emerald-300/50'
                                            : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                                        }`}
                                      >
                                        {resendingCardId === card.id ? (
                                          <>
                                            <RefreshCw className="h-3.5 w-3.5 animate-spin text-emerald-400 shrink-0" />
                                            <span className="break-words">Reenviando...</span>
                                          </>
                                        ) : (
                                          <>
                                            <MessageCircle className={`h-3.5 w-3.5 shrink-0 ${isConfirmed ? 'text-emerald-200' : 'text-emerald-600 dark:text-emerald-400'}`} />
                                            <span className="break-words">Reenviar WhatsApp</span>
                                          </>
                                        )}
                                      </button>

                                      {card.telefone && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenWhatsAppChat(card);
                                          }}
                                          title={`Abrir conversa no WhatsApp com ${card.paciente}`}
                                          className={`p-2 rounded-xl border transition-all active:scale-95 shrink-0 cursor-pointer ${
                                            isConfirmed
                                              ? 'bg-emerald-800 hover:bg-emerald-900 text-white border border-emerald-300/50'
                                              : 'bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground border-border/60'
                                          }`}
                                        >
                                          <MessageCircle className="h-3.5 w-3.5 text-emerald-500" />
                                        </button>
                                      )}
                                    </div>
                                  )}

                                  {/* Aviso de Cancelamento no Tasy para a coluna Canceladas */}
                                  {card.status === 'Canceladas' && (
                                    <div className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-[11px] font-semibold text-center">
                                      <XCircle className="h-3.5 w-3.5 shrink-0" />
                                      <span>Cancelado no Tasy</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── ABA ESCALAS ── */}
          {activeTab === 'escalas' && (
            <div key="tab-escalas" className="space-y-3 w-full min-w-0">
              {filteredEscalas.length === 0 ? (
                <div className="p-8 sm:p-12 text-center text-muted-foreground space-y-2 border border-dashed border-border rounded-xl">
                  <Users className="h-8 w-8 mx-auto text-muted-foreground/60" />
                  <p className="font-medium text-sm">Nenhum plantonista encontrado com os filtros aplicados.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 w-full min-w-0">
                  {filteredEscalas.map(escala => (
                    <div
                      key={escala.id}
                      className="bg-background border border-border/70 p-3.5 sm:p-4 rounded-xl shadow-xs hover:border-primary/40 transition-all flex flex-col justify-between gap-3 group w-full min-w-0"
                    >
                      <div className="space-y-2 w-full min-w-0">
                        <div className="flex items-start justify-between gap-2 w-full min-w-0">
                          <div className="min-w-0 flex-1">
                            <h3 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors break-words">
                              {escala.medico}
                            </h3>
                            <p className="text-xs text-muted-foreground font-mono break-words">{escala.crm}</p>
                          </div>
                          <span
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border shrink-0 break-words ${
                              escala.status === 'Presencial'
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                                : escala.status === 'Sobreaviso'
                                ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
                                : escala.status === 'Ausente'
                                ? 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
                                : 'bg-slate-500/10 border-slate-500/30 text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            {escala.status}
                          </span>
                        </div>

                        <div className="space-y-1.5 text-xs text-muted-foreground w-full min-w-0">
                          <div className="flex items-center gap-1.5 w-full min-w-0">
                            <Stethoscope className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span className="font-medium text-foreground break-words min-w-0 flex-1">{escala.especialidade}</span>
                          </div>
                          <div className="flex items-center gap-1.5 w-full min-w-0">
                            <Building2 className="h-3.5 w-3.5 shrink-0" />
                            <span className="break-words min-w-0 flex-1">{escala.setor}</span>
                          </div>
                          <div className="flex items-center gap-1.5 w-full min-w-0">
                            <Clock className="h-3.5 w-3.5 shrink-0" />
                            <span className="break-words min-w-0 flex-1">{escala.turno} ({escala.horario})</span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-border/50 flex items-center justify-between text-xs w-full min-w-0">
                        <div className="flex items-center gap-1.5 text-muted-foreground min-w-0 flex-1">
                          <Phone className="h-3.5 w-3.5 shrink-0" />
                          <span className="break-words truncate">{escala.contato}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Notificações Flutuantes (Toast) com feedback detalhado de sincronização */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="fixed top-5 right-5 z-50 max-w-md w-[calc(100vw-2.5rem)] sm:w-full shadow-2xl rounded-2xl overflow-hidden pointer-events-auto border backdrop-blur-md"
            >
              <div
                className={`p-4 flex items-start gap-3.5 ${
                  toast.type === 'success'
                    ? 'bg-emerald-950/95 text-emerald-100 border-emerald-500/50 shadow-emerald-500/10'
                    : toast.type === 'error'
                    ? 'bg-rose-950/95 text-rose-100 border-rose-500/50 shadow-rose-500/10'
                    : 'bg-slate-900/95 text-slate-100 border-blue-500/50 shadow-blue-500/10'
                }`}
              >
                <div className="shrink-0 mt-0.5">
                  {toast.type === 'success' && <CheckCircle2 className="h-5 w-5 text-emerald-400" />}
                  {toast.type === 'error' && <AlertCircle className="h-5 w-5 text-rose-400" />}
                  {toast.type === 'info' && <RefreshCw className="h-5 w-5 text-blue-400 animate-spin" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wider opacity-80">
                    {toast.type === 'success' ? 'Sincronização Concluída' : toast.type === 'error' ? 'Atenção na Sincronização' : 'Atualizando Agenda'}
                  </p>
                  <p className="text-sm mt-0.5 leading-relaxed break-words">{toast.message}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setToast(null)}
                  className="text-white/60 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors shrink-0"
                  title="Fechar notificação"
                >
                  <XCircle className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal de Diagnóstico da Resposta do n8n */}
        <AnimatePresence>
          {debugModalOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm"
              onClick={() => setDebugModalOpen(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 10 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-card border border-border rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden"
              >
                <div className="flex items-center justify-between p-4 border-b border-border bg-muted/20">
                  <div className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-primary" />
                    <h3 className="font-bold text-sm sm:text-base text-foreground">
                      Diagnóstico da Resposta n8n
                    </h3>
                  </div>
                  <button
                    onClick={() => setDebugModalOpen(false)}
                    className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                  >
                    <XCircle className="h-5 w-5" />
                  </button>
                </div>

                <div className="p-4 space-y-4 overflow-y-auto text-xs">
                  <div className="grid grid-cols-2 gap-2.5 p-3.5 bg-muted/40 rounded-xl border border-border/50">
                    <div>
                      <span className="text-muted-foreground font-medium">Data Consultada:</span>
                      <p className="font-semibold text-foreground text-sm">{debugData?.targetDate || selectedDate}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground font-medium">Horário da Consulta:</span>
                      <p className="font-semibold text-foreground text-sm">{debugData?.timestamp || '-'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground font-medium">Registros Encontrados:</span>
                      <p className={`font-bold text-sm ${debugData?.count && debugData.count > 0 ? 'text-emerald-500' : 'text-amber-500'}`}>
                        {debugData?.count ?? 0} agendamento(s)
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground font-medium">Método HTTP:</span>
                      <p className="font-semibold text-foreground text-sm">{debugData?.method || 'POST'}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground font-medium">URL do Webhook:</span>
                      <p className="font-mono text-[11px] text-foreground break-all">{debugData?.url || '-'}</p>
                    </div>
                  </div>

                  {debugData?.error && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs">
                      <strong>Aviso / Erro:</strong> {debugData.error}
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-semibold text-foreground">Dados Brutos Retornados pelo n8n (JSON):</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(JSON.stringify(debugData?.raw, null, 2));
                          showToast('success', 'JSON copiado para a área de transferência!');
                        }}
                        className="text-[11px] text-primary hover:underline font-medium cursor-pointer"
                      >
                        Copiar JSON
                      </button>
                    </div>
                    <pre className="p-3 bg-muted rounded-xl text-[11px] font-mono overflow-x-auto max-h-60 border border-border/60 text-foreground">
                      {JSON.stringify(debugData?.raw, null, 2)}
                    </pre>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <button
                      type="button"
                      onClick={() => {
                        setConsultas(INITIAL_CONSULTAS);
                        setUsingMock(true);
                        setDebugModalOpen(false);
                        showToast('info', 'Dados de demonstração (mock) restaurados.');
                      }}
                      className="px-3 py-1.5 rounded-xl border border-border text-muted-foreground hover:text-foreground text-xs font-medium cursor-pointer"
                    >
                      Restaurar Mock de Exemplo
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleSyncWebhook();
                        setDebugModalOpen(false);
                      }}
                      className="px-4 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 cursor-pointer"
                    >
                      Consultar Novamente
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
  );
}
