import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
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
  ChevronLeft
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
    label: 'Agendamentos',
    color: 'text-blue-600 dark:text-blue-400',
    badgeBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
    border: 'border-blue-500/30',
    dotColor: 'bg-blue-500',
    isSynced: true
  },
  {
    id: 'Enviadas',
    label: 'Enviadas',
    color: 'text-purple-600 dark:text-purple-400',
    badgeBg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30',
    border: 'border-purple-500/30',
    dotColor: 'bg-purple-500'
  },
  {
    id: 'Confirmadas',
    label: 'Confirmadas',
    color: 'text-emerald-600 dark:text-emerald-400',
    badgeBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    border: 'border-emerald-500/30',
    dotColor: 'bg-emerald-500'
  },
  {
    id: 'Concluídas',
    label: 'Concluídas',
    color: 'text-teal-600 dark:text-teal-400',
    badgeBg: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/30',
    border: 'border-teal-500/30',
    dotColor: 'bg-teal-500'
  },
  {
    id: 'Canceladas',
    label: 'Canceladas',
    color: 'text-rose-600 dark:text-rose-400',
    badgeBg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30',
    border: 'border-rose-500/30',
    dotColor: 'bg-rose-500'
  }
];

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

// Lê o mapa de status manuais do localStorage
export const getStoredManualStatusMap = (): Record<string, KanbanStatus> => {
  try {
    const raw = localStorage.getItem(KANBAN_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

// Lê o mapa de confirmações do paciente
export const getStoredConfirmedPatientsMap = (): Record<string, { confirmadoPeloPaciente: boolean; confirmadoEm?: string }> => {
  try {
    const raw = localStorage.getItem(KANBAN_CONFIRMED_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

// Salva a confirmação no localStorage e Supabase
export const persistConfirmedPatient = async (cardId: string, confirmado: boolean) => {
  try {
    const current = getStoredConfirmedPatientsMap();
    if (confirmado) {
      current[cardId] = {
        confirmadoPeloPaciente: true,
        confirmadoEm: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      };
    } else {
      delete current[cardId];
    }
    localStorage.setItem(KANBAN_CONFIRMED_KEY, JSON.stringify(current));

    try {
      await supabase.from('centro_medico_kanban_cards').upsert({
        card_id: cardId,
        status: confirmado ? 'Confirmadas' : 'Agendamentos',
        confirmado_pelo_paciente: confirmado,
        updated_at: new Date().toISOString()
      }, { onConflict: 'card_id' });
    } catch {}

    // Notifica outros componentes da tela
    window.dispatchEvent(new CustomEvent('consulta_confirmada_evento', { detail: { cardId, confirmado } }));
  } catch (e) {
    console.warn('Erro ao persistir confirmação do paciente:', e);
  }
};

// Salva o novo status no localStorage e opcionalmente no Supabase
export const persistCardManualStatus = async (
  cardId: string,
  newStatus: KanbanStatus,
  cardData?: Partial<ConsultaAgendada>
) => {
  try {
    // 1. Persistência imediata no navegador (localStorage)
    const currentMap = getStoredManualStatusMap();
    currentMap[cardId] = newStatus;
    localStorage.setItem(KANBAN_STORAGE_KEY, JSON.stringify(currentMap));

    // 2. Persistência remota assíncrona no Supabase
    try {
      await supabase.from('centro_medico_kanban_cards').upsert({
        card_id: cardId,
        status: newStatus,
        paciente: cardData?.paciente || null,
        data_consulta: cardData?.data || null,
        updated_at: new Date().toISOString()
      }, { onConflict: 'card_id' });
    } catch {
      // Ignora falhas de conexão se a tabela remota for inacessível
    }
  } catch (err) {
    console.warn('[Kanban] Falha ao persistir status manual:', err);
  }
};

export default function CentroMedico() {
  // Estados Principais: Kanban e Escalas Médicas
  const [activeTab, setActiveTab] = useState<'escalas' | 'kanban'>('kanban');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [selectedEspecialidade, setSelectedEspecialidade] = useState<string>('TODAS');
  const [selectedStatus, setSelectedStatus] = useState<string>('TODOS');
  
  // Mapa de pacientes confirmados
  const [confirmedPatientsMap, setConfirmedPatientsMap] = useState(getStoredConfirmedPatientsMap);

  // Estados de Dados inicializados respeitando o status fixado e confirmações
  const [escalas, setEscalas] = useState<EscalaMedica[]>(INITIAL_ESCALAS);
  const [consultas, setConsultas] = useState<ConsultaAgendada[]>(() => {
    const manualMap = getStoredManualStatusMap();
    const confMap = getStoredConfirmedPatientsMap();
    return INITIAL_CONSULTAS.map(c => ({
      ...c,
      status: manualMap[c.id] || (confMap[c.id]?.confirmadoPeloPaciente ? 'Confirmadas' : c.status),
      confirmadoPeloPaciente: Boolean(confMap[c.id]?.confirmadoPeloPaciente),
      confirmadoEm: confMap[c.id]?.confirmadoEm
    }));
  });

  // Listener para sincronização em tempo real de confirmações
  useEffect(() => {
    const handleRemoteConfirmEvent = () => {
      const updated = getStoredConfirmedPatientsMap();
      setConfirmedPatientsMap(updated);
      setConsultas(prev => prev.map(c => ({
        ...c,
        confirmadoPeloPaciente: Boolean(updated[c.id]?.confirmadoPeloPaciente),
        confirmadoEm: updated[c.id]?.confirmadoEm,
        status: updated[c.id]?.confirmadoPeloPaciente ? 'Confirmadas' : c.status
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
          .select('card_id, status');

        if (!error && data && data.length > 0) {
          const currentMap = getStoredManualStatusMap();
          data.forEach((row: any) => {
            if (row.card_id && row.status) {
              currentMap[row.card_id] = row.status as KanbanStatus;
            }
          });
          localStorage.setItem(KANBAN_STORAGE_KEY, JSON.stringify(currentMap));

          setConsultas(prev => prev.map(c => {
            const manualStatus = currentMap[c.id];
            return manualStatus ? { ...c, status: manualStatus } : c;
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
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4500);
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
      showToast('info', `Buscando registros para ${formatDateLabel(targetDate)}...`);
      const response = await webhookService.triggerConsultaCentroMedico({
        date: targetDate,
        especialidade: selectedEspecialidade,
        search: searchTerm
      });

      if (response && (response.escalas || response.consultas)) {
        if (response.escalas) setEscalas(response.escalas);
        if (response.consultas) {
          setConsultas(prev => {
            const currentMemMap = new Map(prev.map(c => [c.id, c.status]));
            const localSavedMap = getStoredManualStatusMap();

            return response.consultas.map((incoming: any) => {
              // Mantém estritamente fixo o que foi movido manualmente, mesmo ao atualizar
              const manualStatus = localSavedMap[incoming.id] || currentMemMap.get(incoming.id);
              const targetColumn: KanbanStatus = manualStatus || 'Agendamentos';
              const realStatus = incoming.statusReal || incoming.status || 'Agendado';

              return {
                ...incoming,
                status: targetColumn,
                statusReal: realStatus
              };
            });
          });
        }
        setUsingMock(false);
        showToast('success', `Dados de ${formatDateLabel(targetDate)} sincronizados!`);
      } else {
        setUsingMock(true);
        // Aplica e mantém as posições manuais fixadas mesmo no fallback do mock
        setConsultas(prev => {
          const localSavedMap = getStoredManualStatusMap();
          return prev.map(c => ({
            ...c,
            status: localSavedMap[c.id] || c.status
          }));
        });
        showToast('info', `Exibindo agendamentos para ${formatDateLabel(targetDate)}.`);
      }
    } catch (error: any) {
      console.warn('Falha no webhook n8n:', error);
      setUsingMock(true);
      setConsultas(prev => {
        const localSavedMap = getStoredManualStatusMap();
        return prev.map(c => ({
          ...c,
          status: localSavedMap[c.id] || c.status
        }));
      });
      showToast('info', `Exibindo agendamentos para ${formatDateLabel(targetDate)}.`);
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

    // Atualiza o estado da coluna no Kanban
    setConsultas(prev => prev.map(c => c.id === cardId ? { ...c, status: newStatus } : c));
    showToast('success', `Paciente ${targetCard.paciente} movido para "${newStatus}".`);

    // Fixa a movimentação permanentemente no localStorage e Supabase até nova movimentação manual
    persistCardManualStatus(cardId, newStatus, targetCard);

    // Disparo de WhatsApp ao mover para "Enviadas" ou "Confirmadas"
    if (newStatus === 'Enviadas' || newStatus === 'Confirmadas') {
      const isConfirmacao = newStatus === 'Confirmadas';
      const actionLabel = isConfirmacao ? 'confirmação' : 'agendamento';

      try {
        showToast('info', `Disparando ${actionLabel} por WhatsApp para ${targetCard.paciente}...`);

        // Monta o link da tela de confirmação de consulta do paciente de forma limpa e direta
        const publicBaseUrl = (import.meta.env.VITE_PUBLIC_APP_URL as string) || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
        const cleanBaseUrl = publicBaseUrl.replace(/\/+$/, '');
        const linkConfirmacao = `${cleanBaseUrl}/confirmar-consulta/${targetCard.id}`;

        // Mensagem contextual com link de confirmação isolado quando movido para Confirmadas
        const customText = isConfirmacao
          ? `🏥 *Centro Médico - Hospital Santa Casa*\nOlá, *${targetCard.paciente}*!\n\nConfirmamos os dados da sua consulta no Centro Médico:\n📅 *Data:* ${targetCard.data}\n⏰ *Horário:* ${targetCard.horario}\n👨‍⚕️ *Médico(a):* ${targetCard.medico}${targetCard.crm ? ` (CRM: ${targetCard.crm})` : ''} - ${targetCard.especialidade}\n📍 *Local:* Centro Médico da Santa Casa${targetCard.convenio ? `\n📄 *Convênio:* ${targetCard.convenio}` : ''}\n\n🔗 *Confirmação de Consulta:*\n\n${linkConfirmacao}\n\n• Por favor, chegue com 15 minutos de antecedência portando documento oficial com foto e carteirinha do convênio (se aplicável).\n• Em caso de dúvidas ou necessidade de reagendamento, entre em contato conosco.\n\n_Hospital Santa Casa de Misericórdia_`
          : `🏥 *Centro Médico - Hospital Santa Casa*\nOlá, *${targetCard.paciente}*!\n\nVocê tem uma consulta agendada no Centro Médico:\n👨‍⚕️ *Médico(a):* ${targetCard.medico}${targetCard.crm ? ` (CRM: ${targetCard.crm})` : ''} - ${targetCard.especialidade}\n📅 *Data:* ${targetCard.data}\n⏰ *Horário:* ${targetCard.horario}\n📍 *Local:* Centro Médico da Santa Casa${targetCard.convenio ? `\n📄 *Convênio:* ${targetCard.convenio}` : ''}\n\n• Por favor, chegue com 15 minutos de antecedência portando documento oficial com foto e carteirinha do convênio (se aplicável).\n• Em caso de dúvidas ou necessidade de reagendamento, entre em contato conosco.\n\n_Hospital Santa Casa de Misericórdia_`;

        // Dispara a Edge Function especializada whatsapp-agendamento-enviado
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
            data: targetCard.data,
            convenio: targetCard.convenio,
            telefone: targetCard.telefone || '34988511343',
            recipient: '5584998444889',
            status: newStatus,
            tipo: isConfirmacao ? 'confirmacao' : 'envio',
            linkConfirmacao: linkConfirmacao,
            origin: origin,
            text: customText
          }
        });

        // Fallback para whatsapp-centro-medico se necessário
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
              data: targetCard.data,
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
          showToast('success', `WhatsApp de ${actionLabel} enviado com sucesso para ${targetCard.paciente}!`);
        } else {
          showToast('info', data?.message || 'Notificação processada.');
        }
      } catch (err: any) {
        console.error('[WhatsApp Agendamento] Falha na requisição:', err);
        showToast('error', `Erro ao disparar WhatsApp: ${err.message}`);
      }
    }
  };

  // Ação de Confirmação de Consulta do Paciente
  const handleToggleConfirmPatient = async (cardId: string) => {
    const target = consultas.find(c => c.id === cardId);
    if (!target) return;

    const isCurrentlyConfirmed = Boolean(target.confirmadoPeloPaciente || confirmedPatientsMap[cardId]?.confirmadoPeloPaciente);
    const newConfirmedState = !isCurrentlyConfirmed;

    // Atualiza estado de confirmação persistido
    await persistConfirmedPatient(cardId, newConfirmedState);
    const updatedMap = getStoredConfirmedPatientsMap();
    setConfirmedPatientsMap(updatedMap);

    // Se confirmou pelo paciente, move também a coluna do Kanban para "Confirmadas"
    const newStatus: KanbanStatus = newConfirmedState ? 'Confirmadas' : target.status;
    if (newConfirmedState) {
      persistCardManualStatus(cardId, 'Confirmadas', target);
    }

    setConsultas(prev => prev.map(c => {
      if (c.id === cardId) {
        return {
          ...c,
          status: newStatus,
          confirmadoPeloPaciente: newConfirmedState,
          confirmadoEm: newConfirmedState ? updatedMap[cardId]?.confirmadoEm : undefined
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
    const concluidos = consultas.filter(c => c.status === 'Concluídas').length;
    const confirmadas = consultas.filter(c => c.status === 'Confirmadas').length;

    return { totalPlantonistas, totalConsultasHoje, concluidos, confirmadas };
  }, [escalas, consultas]);

  return (
    <div className="flex-1 space-y-4 min-h-[85vh] pb-6 w-full mx-auto px-1 pt-2 text-foreground transition-all">
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border text-sm max-w-md ${
              toast.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                : toast.type === 'error'
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
                : 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400'
            }`}
          >
            {toast.type === 'success' && <CheckCircle2 className="h-5 w-5 flex-shrink-0" />}
            {toast.type === 'error' && <AlertCircle className="h-5 w-5 flex-shrink-0" />}
            {toast.type === 'info' && <RefreshCw className="h-5 w-5 flex-shrink-0 animate-spin text-blue-500" />}
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>



      {/* Header do Módulo */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card border border-border/80 p-5 rounded-2xl shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shadow-inner">
              <Stethoscope className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Centro Médico
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
                  DEV LOCALHOST
                </span>
              </h1>
              <p className="text-xs text-muted-foreground">
                Gestão integrada de escalas médicas, plantonistas e acompanhamento em modo Kanban.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Cards de Métricas / Estatísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-card border border-border/80 p-4 rounded-xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium">Plantonistas Ativos</p>
            <p className="text-2xl font-bold text-foreground mt-1">{stats.totalPlantonistas}</p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <UserCheck className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-card border border-border/80 p-4 rounded-xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium">Total de Pacientes</p>
            <p className="text-2xl font-bold text-foreground mt-1">{stats.totalConsultasHoje}</p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <CalendarDays className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-card border border-border/80 p-4 rounded-xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium">Consultas Confirmadas</p>
            <p className="text-2xl font-bold text-foreground mt-1">{stats.confirmadas}</p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-card border border-border/80 p-4 rounded-xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium">Atendimentos Concluídos</p>
            <p className="text-2xl font-bold text-foreground mt-1">{stats.concluidos}</p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">
            <Check className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Navegação entre Abas, Controle de Datas e Filtros (Design Moderno & Glassmorphism) */}
      <div className="bg-card border border-border/80 p-4 sm:p-5 rounded-2xl shadow-sm space-y-4 relative overflow-hidden">
        {/* Glow sutil de fundo */}
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-40 h-40 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3.5 relative z-10">
          {/* Lado Esquerdo: Abas de Navegação (Pill Container) */}
          <div className="inline-flex items-center bg-muted/60 p-1.5 rounded-2xl border border-border/50 shadow-inner gap-1 overflow-x-auto max-w-full">
            <button
              onClick={() => {
                setActiveTab('kanban');
                setSelectedStatus('TODOS');
              }}
              className={`flex items-center justify-center gap-2.5 px-4 py-2 rounded-xl font-medium text-xs sm:text-sm transition-all duration-200 whitespace-nowrap shrink-0 ${
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
              className={`flex items-center justify-center gap-2.5 px-4 py-2 rounded-xl font-medium text-xs sm:text-sm transition-all duration-200 whitespace-nowrap shrink-0 ${
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

            <Link
              to="/pacientes-confirmados"
              className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-xl font-medium text-xs sm:text-sm transition-all duration-200 whitespace-nowrap shrink-0 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/25 shadow-xs"
              title="Acessar tela independente de Pacientes Confirmados (Confirmação de Consulta)"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
              <span>Pacientes Confirmados</span>
              <span className="ml-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold border bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
                {consultas.filter(c => c.confirmadoPeloPaciente || confirmedPatientsMap[c.id]?.confirmadoPeloPaciente).length}
              </span>
            </Link>
          </div>

          {/* Lado Direito: Controle de Datas e Especialidades */}
          <div className="flex flex-wrap items-center gap-2.5 w-full xl:w-auto">
            {/* Seletor de Data em Pill Box com Hover Glow */}
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-1 bg-background border border-border/80 p-1 rounded-2xl text-xs shadow-xs hover:border-primary/40 transition-all max-w-full">
              <button
                onClick={() => handleStepDay(-1)}
                title="Dia Anterior"
                className="px-2.5 py-1.5 rounded-xl hover:bg-muted text-foreground transition-all flex items-center gap-1 font-medium text-xs active:scale-95"
              >
                <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                <span>Anterior</span>
              </button>

              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/40 rounded-xl border border-border/40 hover:bg-muted/70 transition-colors">
                <Calendar className="h-3.5 w-3.5 text-primary shrink-0" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => handleDateChange(e.target.value)}
                  className="bg-transparent text-foreground font-semibold focus:outline-none cursor-pointer text-xs max-w-[125px]"
                />
              </div>

              <button
                onClick={() => handleDateChange(getDateOffset(0))}
                title="Ir para Hoje"
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95 ${
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
                className="px-2.5 py-1.5 rounded-xl hover:bg-muted text-foreground transition-all flex items-center gap-1 font-medium text-xs active:scale-95"
              >
                <span>Próximo</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            {/* Filtro de Especialidade com Ícone de Destaque */}
            <div className="flex items-center gap-2 bg-background border border-border/80 px-3.5 py-2 rounded-2xl text-xs shadow-xs hover:border-primary/40 focus-within:ring-2 focus-within:ring-primary/20 transition-all w-full sm:w-auto min-w-[180px] max-w-full">
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

        {/* Input de Busca com Efeito Neon Ring no Focus */}
        <div className="relative group z-10">
          <Search className="h-4 w-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            placeholder={
              activeTab === 'escalas'
                ? 'Buscar por médico, CRM, especialidade ou setor...'
                : 'Buscar por paciente, prontuário, médico ou convênio...'
            }
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-background border border-border/80 rounded-2xl text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all shadow-xs"
          />
        </div>

        {/* Conteúdo Principal das Abas */}
        {/* ── ABA KANBAN ── */}
        {activeTab === 'kanban' && (
          <div key="tab-kanban" className="space-y-3">
              {/* Grid das Colunas Kanban (Com largura mínima confortável para cards respirarem) */}
              <div className="flex 2xl:grid 2xl:grid-cols-5 gap-3.5 items-start overflow-x-auto pb-4 custom-scrollbar">
                {KANBAN_COLUMNS.map(col => {
                  const colCards = filteredConsultas.filter(c => c.status === col.id);
                  const isOver = dragOverColumn === col.id;

                  return (
                    <div
                      key={col.id}
                      onDragOver={e => handleDragOver(e, col.id)}
                      onDragLeave={handleDragLeave}
                      onDrop={e => handleDrop(e, col.id)}
                      className={`bg-background border rounded-2xl p-3 space-y-3 min-h-[480px] flex flex-col transition-all duration-200 min-w-[280px] 2xl:min-w-0 flex-1 ${
                        col.border
                      } ${
                        isOver
                          ? 'ring-2 ring-primary bg-primary/5 shadow-md scale-[1.01]'
                          : 'bg-muted/10 hover:bg-background'
                      }`}
                    >
                      {/* Cabeçalho da Coluna */}
                      <div className="pb-2 border-b border-border/60 space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`h-2.5 w-2.5 rounded-full ${col.dotColor}`} />
                            <h3 className={`font-bold text-xs uppercase tracking-wide ${col.color}`}>
                              {col.label}
                            </h3>
                          </div>
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${col.badgeBg}`}>
                            {colCards.length}
                          </span>
                        </div>
                        <div className="text-[10px] flex items-center gap-1 font-medium">
                          {col.isSynced ? (
                            <span className="text-blue-600 dark:text-blue-400 flex items-center gap-1 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                              ⚡ Sincronizado (n8n)
                            </span>
                          ) : (
                            <span className="text-muted-foreground/70 flex items-center gap-1">
                              ✋ Movimentação Manual
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Lista de Cards da Coluna - Cards com expansão natural e sem barra de rolagem restritiva */}
                      <div className="flex-1 space-y-3">
                        {colCards.length === 0 ? (
                          <div className="h-32 border border-dashed border-border/70 rounded-xl flex items-center justify-center text-center p-3 text-muted-foreground text-xs">
                            Nenhum paciente
                          </div>
                        ) : (
                          colCards.map(card => {
                            const isConfirmed = Boolean(card.confirmadoPeloPaciente || confirmedPatientsMap[card.id]?.confirmadoPeloPaciente);

                            return (
                              <div
                                key={card.id}
                                draggable
                                onDragStart={e => handleDragStart(e, card.id)}
                                className={`p-3.5 rounded-xl transition-all cursor-grab active:cursor-grabbing space-y-2.5 relative group ${
                                  isConfirmed
                                    ? 'bg-emerald-600 dark:bg-emerald-600 text-white border-2 border-emerald-300 shadow-xl shadow-emerald-950/30 ring-2 ring-emerald-300/40'
                                    : 'bg-card border border-border/80 hover:border-primary/50 shadow-xs hover:shadow-md'
                                }`}
                              >
                                {/* Selo em destaque caso o paciente tenha confirmado */}
                                {isConfirmed && (
                                  <div className="flex items-center justify-between gap-1.5 bg-emerald-800/90 text-white px-2.5 py-1 rounded-lg border border-emerald-300 text-[10px] font-bold shadow-xs">
                                    <div className="flex items-center gap-1.5">
                                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300 animate-pulse" />
                                      <span>PACIENTE CONFIRMOU PRESENÇA</span>
                                    </div>
                                    {card.confirmadoEm && (
                                      <span className="text-emerald-200 font-mono text-[9px]">{card.confirmadoEm}</span>
                                    )}
                                  </div>
                                )}

                                {/* Header do Card: Paciente, Prontuário, Idade, Horário e Tag de Status Real */}
                                <div className="flex items-start justify-between gap-2">
                                  <div className="space-y-1 min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <h4 className={`font-bold text-sm leading-snug break-words transition-colors ${
                                        isConfirmed ? 'text-white font-extrabold' : 'text-foreground group-hover:text-primary'
                                      }`}>
                                        {card.paciente}
                                      </h4>
                                      {card.statusReal && !isConfirmed && (
                                        <span
                                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 shrink-0 ${getRealStatusBadgeStyle(card.statusReal)}`}
                                          title={`Status Real no Sistema: ${card.statusReal}`}
                                        >
                                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                                          {card.statusReal}
                                        </span>
                                      )}
                                    </div>
                                    <p className={`text-[11px] font-mono ${
                                      isConfirmed ? 'text-emerald-100' : 'text-muted-foreground'
                                    }`}>
                                      {card.prontuario} • {card.idade} anos
                                    </p>
                                  </div>
                                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border flex-shrink-0 whitespace-nowrap ${
                                    isConfirmed
                                      ? 'text-white bg-emerald-800 border-emerald-400 shadow-xs'
                                      : 'text-primary bg-primary/10 border-primary/20'
                                  }`}>
                                    {card.horario}
                                  </span>
                                </div>

                                {/* Info Médica Completa: Médico (sem corte), CRM, Especialidade e Consultório */}
                                <div className={`space-y-1.5 text-xs border-t pt-2 ${
                                  isConfirmed ? 'border-emerald-500/50 text-emerald-100' : 'border-border/50 text-muted-foreground'
                                }`}>
                                  <div className="space-y-0.5">
                                    <div className={`flex items-start gap-1.5 font-medium ${
                                      isConfirmed ? 'text-white' : 'text-foreground'
                                    }`}>
                                      <Stethoscope className={`h-3.5 w-3.5 flex-shrink-0 mt-0.5 ${
                                        isConfirmed ? 'text-emerald-200' : 'text-primary'
                                      }`} />
                                      <span className="break-words leading-tight">{card.medico}</span>
                                    </div>
                                    {card.crm && (
                                      <p className={`text-[10px] font-mono pl-5 ${
                                        isConfirmed ? 'text-emerald-200' : 'text-muted-foreground/80'
                                      }`}>
                                        {card.crm}
                                      </p>
                                    )}
                                  </div>

                                  <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] pt-0.5">
                                    <span className={`font-medium ${isConfirmed ? 'text-white' : 'text-foreground/80'}`}>
                                      {card.especialidade}
                                    </span>
                                    <span className={`font-mono flex items-center gap-1 px-1.5 py-0.5 rounded ${
                                      isConfirmed ? 'bg-emerald-700/80 text-emerald-100' : 'bg-muted/40 text-muted-foreground'
                                    }`}>
                                      <Building2 className={`h-3 w-3 ${isConfirmed ? 'text-emerald-200' : 'text-muted-foreground/70'}`} />
                                      {card.consultorio}
                                    </span>
                                  </div>
                                </div>

                                {/* Telefone e Observações (quando existirem) */}
                                {(card.telefone || card.observacoes) && (
                                  <div className={`space-y-1.5 border-t pt-2 text-[11px] ${
                                    isConfirmed ? 'border-emerald-500/50' : 'border-border/40'
                                  }`}>
                                    {card.telefone && (
                                      <div className={`flex items-center gap-1.5 ${
                                        isConfirmed ? 'text-emerald-100' : 'text-muted-foreground'
                                      }`}>
                                        <Phone className={`h-3 w-3 flex-shrink-0 ${
                                          isConfirmed ? 'text-emerald-200' : 'text-primary/70'
                                        }`} />
                                        <span className="font-mono">{card.telefone}</span>
                                      </div>
                                    )}
                                    {card.observacoes && (
                                      <div className={`flex items-start gap-1.5 p-2 rounded-lg border leading-tight break-words ${
                                        isConfirmed
                                          ? 'bg-emerald-700/60 border-emerald-400 text-white'
                                          : 'bg-muted/40 border-border/50 text-foreground/90'
                                      }`}>
                                        <FileText className={`h-3 w-3 mt-0.5 flex-shrink-0 ${
                                          isConfirmed ? 'text-emerald-200' : 'text-muted-foreground/80'
                                        }`} />
                                        <span>{card.observacoes}</span>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Footer do Card com Convênio e Ação de Mover */}
                                <div className={`flex flex-wrap items-center justify-between gap-2 pt-2 border-t text-[11px] ${
                                  isConfirmed ? 'border-emerald-500/50' : 'border-border/50'
                                }`}>
                                  <span className={`px-2 py-0.5 rounded font-medium break-words ${
                                    isConfirmed ? 'bg-emerald-700 text-white font-semibold' : 'bg-muted text-foreground'
                                  }`}>
                                    {card.convenio}
                                  </span>

                                  {/* Controles de Movimentação Rápida */}
                                  <div className="flex items-center gap-1">
                                    <select
                                      value={card.status}
                                      onChange={e => moveCardToStatus(card.id, e.target.value as KanbanStatus)}
                                      className={`text-[10px] rounded px-1.5 py-1 focus:outline-none cursor-pointer border ${
                                        isConfirmed
                                          ? 'bg-emerald-700 border-emerald-400 text-white font-medium'
                                          : 'bg-background border-border/80 text-foreground'
                                      }`}
                                      title="Mover paciente para..."
                                    >
                                      {KANBAN_COLUMNS.map(c => (
                                        <option key={c.id} value={c.id} className="bg-background text-foreground">
                                          Mover: {c.label}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
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
            <div key="tab-escalas" className="space-y-3">
              {filteredEscalas.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground space-y-2 border border-dashed border-border rounded-xl">
                  <Users className="h-8 w-8 mx-auto text-muted-foreground/60" />
                  <p className="font-medium text-sm">Nenhum plantonista encontrado com os filtros aplicados.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredEscalas.map(escala => (
                    <div
                      key={escala.id}
                      className="bg-background border border-border/70 p-4 rounded-xl shadow-xs hover:border-primary/40 transition-all flex flex-col justify-between gap-3 group"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">
                              {escala.medico}
                            </h3>
                            <p className="text-xs text-muted-foreground font-mono">{escala.crm}</p>
                          </div>
                          <span
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
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

                        <div className="space-y-1 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <Stethoscope className="h-3.5 w-3.5 text-primary" />
                            <span className="font-medium text-foreground">{escala.especialidade}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5" />
                            <span>{escala.setor}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" />
                            <span>{escala.turno} ({escala.horario})</span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-border/50 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Phone className="h-3.5 w-3.5" />
                          <span>{escala.contato}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
  );
}
