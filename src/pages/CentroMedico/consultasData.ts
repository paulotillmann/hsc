// src/pages/CentroMedico/consultasData.ts

export type KanbanStatus = 'Agendamentos' | 'Enviadas' | 'Confirmadas' | 'Concluídas' | 'Canceladas';

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

export const KANBAN_STORAGE_KEY = 'hsc_centro_medico_kanban_manual_status_v1';
export const KANBAN_CONFIRMED_KEY = 'hsc_centro_medico_confirmacoes_v1';
export const KANBAN_ADDED_ORDER_KEY = 'hsc_centro_medico_kanban_added_order_v1';

export const KANBAN_COLUMNS: {
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

export const getDateOffset = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

export const formatDateLabel = (dateStr: string): string => {
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

export const TODAY = getDateOffset(0);
export const YESTERDAY = getDateOffset(-1);
export const TWO_DAYS_AGO = getDateOffset(-2);
export const THREE_DAYS_AGO = getDateOffset(-3);
export const TOMORROW = getDateOffset(1);

export const getRealStatusBadgeStyle = (statusReal?: string): string => {
  if (!statusReal) return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20';
  const s = statusReal.toLowerCase();
  if (s.includes('confirmad')) {
    return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
  }
  if (s.includes('concl') || s.includes('atendid')) {
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

export const INITIAL_ESCALAS: EscalaMedica[] = [
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

export const INITIAL_CONSULTAS: ConsultaAgendada[] = [
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
    telefone: '(34) 99888-1122'
  },
  {
    id: 'cons-091',
    paciente: 'Carla Dias Silva',
    prontuario: 'PRONT-77812',
    idade: 33,
    medico: 'Dra. Amanda Silveira',
    crm: 'CRM/MG 52.890',
    especialidade: 'Pediatria',
    horario: '10:30',
    data: YESTERDAY,
    consultorio: 'Consultório 03',
    convenio: 'Bradesco Saúde',
    status: 'Agendamentos',
    statusReal: 'Concluída',
    telefone: '(34) 99888-2233'
  },
  {
    id: 'cons-092',
    paciente: 'Marcos Vinicius Duarte',
    prontuario: 'PRONT-52319',
    idade: 42,
    medico: 'Dr. Fernando Henrique Lima',
    crm: 'CRM/MG 38.411',
    especialidade: 'Ortopedia',
    horario: '14:00',
    data: YESTERDAY,
    consultorio: 'Consultório 01',
    convenio: 'Particular',
    status: 'Agendamentos',
    statusReal: 'Concluída',
    telefone: '(34) 99888-3344'
  },
  // ── HÁ 2 DIAS (D-2) ──
  {
    id: 'cons-080',
    paciente: 'Renata Albuquerque',
    prontuario: 'PRONT-45190',
    idade: 27,
    medico: 'Dra. Juliana Vasconcelos',
    crm: 'CRM/MG 61.025',
    especialidade: 'Ginecologia e Obstetrícia',
    horario: '08:30',
    data: TWO_DAYS_AGO,
    consultorio: 'Consultório 05',
    convenio: 'Unimed',
    status: 'Agendamentos',
    statusReal: 'Concluída',
    telefone: '(34) 99888-4455'
  },
  {
    id: 'cons-081',
    paciente: 'Geraldo Magela Pires',
    prontuario: 'PRONT-31908',
    idade: 69,
    medico: 'Dr. Roberto Carlos Mendes',
    crm: 'CRM/MG 45.120',
    especialidade: 'Cardiologia',
    horario: '11:00',
    data: TWO_DAYS_AGO,
    consultorio: 'Consultório 01',
    convenio: 'Cassi',
    status: 'Agendamentos',
    statusReal: 'Concluída',
    telefone: '(34) 99888-5566'
  },
  // ── HÁ 3 DIAS (D-3) ──
  {
    id: 'cons-070',
    paciente: 'Soraia Meireles',
    prontuario: 'PRONT-90231',
    idade: 52,
    medico: 'Dr. Lucas Alcantara',
    crm: 'CRM/MG 49.332',
    especialidade: 'Neurologia',
    horario: '15:00',
    data: THREE_DAYS_AGO,
    consultorio: 'Consultório 02',
    convenio: 'Amil',
    status: 'Agendamentos',
    statusReal: 'Concluída',
    telefone: '(34) 99888-6677'
  },
  // ── AMANHÃ (D+1) ──
  {
    id: 'cons-110',
    paciente: 'Valéria Cristina Fontes',
    prontuario: 'PRONT-99120',
    idade: 49,
    medico: 'Dr. Roberto Carlos Mendes',
    crm: 'CRM/MG 45.120',
    especialidade: 'Cardiologia',
    horario: '08:00',
    data: TOMORROW,
    consultorio: 'Consultório 01',
    convenio: 'Unimed',
    status: 'Agendamentos',
    statusReal: 'Agendado',
    telefone: '(34) 99888-7788',
    observacoes: 'Primeira vez no Centro Médico'
  },
  {
    id: 'cons-111',
    paciente: 'Danilo Silveira Borges',
    prontuario: 'PRONT-82194',
    idade: 36,
    medico: 'Dr. Fernando Henrique Lima',
    crm: 'CRM/MG 38.411',
    especialidade: 'Ortopedia',
    horario: '09:30',
    data: TOMORROW,
    consultorio: 'Consultório 01',
    convenio: 'Bradesco Saúde',
    status: 'Agendamentos',
    statusReal: 'Agendado',
    telefone: '(34) 99888-8899',
    observacoes: 'Trazer exames de ressonância'
  },
  {
    id: 'cons-112',
    paciente: 'Helena Ribeiro Castro',
    prontuario: 'PRONT-76402',
    idade: 8,
    medico: 'Dra. Amanda Silveira',
    crm: 'CRM/MG 52.890',
    especialidade: 'Pediatria',
    horario: '14:00',
    data: TOMORROW,
    consultorio: 'Consultório 03',
    convenio: 'HSC Saúde',
    status: 'Agendamentos',
    statusReal: 'Agendado',
    telefone: '(34) 99888-9900'
  }
];
