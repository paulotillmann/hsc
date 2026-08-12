// src/services/internatoAgendaService.ts
// Serviço para gerenciar agendamentos, turmas e professores no módulo de Internato

import { supabase } from '../lib/supabase';

export interface Professor {
  id: string;
  nome: string;
  email: string | null;
  especialidade: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface AgendaEvent {
  id: string;
  data: string; // YYYY-MM-DD
  turma_id: string | null;
  clinica: string | null;
  sala: string;
  professor_id: string | null;
  horario: string;
  observacao: string | null;
  cancelada?: boolean;
  created_at?: string;
  updated_at?: string;
  // Joins
  internato_turmas?: {
    id: string;
    nome: string;
    periodo: string;
  } | null;
  internato_professores?: {
    id: string;
    nome: string;
    email: string | null;
    especialidade: string | null;
  } | null;
}

export async function fetchAgendaMes(year: number, month: number): Promise<AgendaEvent[]> {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const { data, error } = await supabase
    .from('internato_agenda')
    .select(`
      *,
      internato_turmas(id, nome, periodo),
      internato_professores:professor_id(id, nome, email, especialidade)
    `)
    .gte('data', start)
    .lte('data', end)
    .order('data', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data as unknown as AgendaEvent[]) || [];
}

export async function fetchTurmasAtivas() {
  const { data, error } = await supabase
    .from('internato_turmas')
    .select('id, nome, periodo')
    .eq('ativa', true)
    .order('nome', { ascending: true });

  if (error) throw new Error(error.message);
  return data || [];
}

// ── PROFESSORES CRUD ────────────────────────────────────────────────────────

export async function fetchProfessores(): Promise<Professor[]> {
  const { data, error } = await supabase
    .from('internato_professores')
    .select('*')
    .order('nome', { ascending: true });

  if (error) throw new Error(error.message);
  return (data as Professor[]) || [];
}

export async function criarProfessor(nome: string, email: string | null, especialidade: string | null) {
  const { data, error } = await supabase
    .from('internato_professores')
    .insert({ nome, email, especialidade })
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

export async function atualizarProfessor(id: string, nome: string, email: string | null, especialidade: string | null) {
  const { data, error } = await supabase
    .from('internato_professores')
    .update({ nome, email, especialidade, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

export async function excluirProfessor(id: string) {
  const { error } = await supabase
    .from('internato_professores')
    .delete()
    .eq('id', id);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ── AGENDA CRUD ─────────────────────────────────────────────────────────────

export async function criarEventoAgenda(event: Omit<AgendaEvent, 'id' | 'created_at' | 'updated_at' | 'internato_turmas' | 'internato_professores'>) {
  const payload: any = { ...event };
  const { data, error } = await supabase
    .from('internato_agenda')
    .insert(payload)
    .select()
    .single();

  if (error) {
    if (error.message?.includes('cancelada') || error.code === 'PGRST204' || error.message?.includes('column')) {
      const { cancelada, ...payloadSemCancelada } = payload;
      const resRetry = await supabase
        .from('internato_agenda')
        .insert(payloadSemCancelada)
        .select()
        .single();
      if (resRetry.error) return { success: false, error: resRetry.error.message };
      return { success: true, data: resRetry.data };
    }
    return { success: false, error: error.message };
  }
  return { success: true, data };
}

export async function atualizarEventoAgenda(id: string, updates: Partial<Omit<AgendaEvent, 'id' | 'created_at' | 'updated_at' | 'internato_turmas' | 'internato_professores'>>) {
  const payload: any = { ...updates };
  const { data, error } = await supabase
    .from('internato_agenda')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (error.message?.includes('cancelada') || error.code === 'PGRST204' || error.message?.includes('column')) {
      const { cancelada, ...payloadSemCancelada } = payload;
      const resRetry = await supabase
        .from('internato_agenda')
        .update(payloadSemCancelada)
        .eq('id', id)
        .select()
        .single();
      if (resRetry.error) return { success: false, error: resRetry.error.message };
      return { success: true, data: resRetry.data };
    }
    return { success: false, error: error.message };
  }
  return { success: true, data };
}

export async function excluirEventoAgenda(id: string) {
  const { error } = await supabase
    .from('internato_agenda')
    .delete()
    .eq('id', id);

  if (error) return { success: false, error: error.message };
  return { success: true };
}
