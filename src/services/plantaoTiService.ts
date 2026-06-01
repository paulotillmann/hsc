// src/services/plantaoTiService.ts
// Serviço para gerenciamento de escalas de plantão de TI

import { supabase } from '../lib/supabase';

export interface ColaboradorTI {
  id: string;
  full_name: string;
  email: string;
}

export interface OcorrenciaPlantao {
  id: string;
  escala_id: string;
  nome_solicitante: string;
  setor_solicitante: string;
  descricao_plantao: string;
  atendimento_presencial: boolean;
  created_at: string;
}

export interface EscalaPlantao {
  id: string;
  data_plantao: string;
  usuario_id: string;
  ocorrencias?: OcorrenciaPlantao[];
  profiles: {
    id: string;
    full_name: string;
    email: string;
  } | null;
}

// ── Busca os colaboradores de TI no banco por e-mail ────────────────────────
export async function fetchColaboradoresTI(): Promise<ColaboradorTI[]> {
  const allowedEmails = [
    'talysson.resende@santacasaaraguari.org.br',
    'bruno.lima@santacasaaraguari.org.br',
    'jessica.araujo@santacasaaraguari.org.br',
    'jhon.silva@santacasaaraguari.org.br'
  ];

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .in('email', allowedEmails)
    .order('full_name');

  if (error) {
    console.error('Erro ao buscar colaboradores de TI:', error);
    throw error;
  }

  return data ?? [];
}

// ── Busca as escalas de plantão para um determinado mês e ano ───────────────
export async function fetchEscalasMes(ano: number, mes: number): Promise<EscalaPlantao[]> {
  // O mês no JS é 0-11, mas recebemos 1-12.
  // Criar data de início (YYYY-MM-01) e fim (último dia do mês)
  const startDate = `${ano}-${String(mes).padStart(2, '0')}-01`;
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const endDate = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;

  const { data, error } = await supabase
    .from('plantao_ti_escala')
    .select(`
      id,
      data_plantao,
      usuario_id,
      profiles (
        id,
        full_name,
        email
      ),
      plantao_ti_ocorrencias (
        id,
        escala_id,
        nome_solicitante,
        setor_solicitante,
        descricao_plantao,
        atendimento_presencial,
        created_at
      )
    `)
    .gte('data_plantao', startDate)
    .lte('data_plantao', endDate);

  if (error) {
    console.error('Erro ao buscar escalas do mês:', error);
    throw error;
  }

  // Converter para o tipo EscalaPlantao para consistência do TypeScript
  return (data as any[])?.map(item => ({
    id: item.id,
    data_plantao: item.data_plantao,
    usuario_id: item.usuario_id,
    profiles: Array.isArray(item.profiles) ? item.profiles[0] : item.profiles,
    ocorrencias: item.plantao_ti_ocorrencias ?? [],
  })) ?? [];
}

// ── Adiciona um colaborador à escala em uma data específica ───────────────
export async function adicionarPlantonista(
  data: string,
  usuarioId: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('plantao_ti_escala')
    .insert({
      data_plantao: data,
      usuario_id: usuarioId,
    });

  if (error) {
    // Tratar erro de restrição única (colaborador já escalado no dia)
    if (error.code === '23505') {
      return { success: false, error: 'Este colaborador já está escalado neste dia.' };
    }
    return { success: false, error: error.message };
  }

  return { success: true };
}

// ── Remove um colaborador da escala de plantão pelo ID da escala ────────────
export async function removerPlantonista(
  escalaId: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('plantao_ti_escala')
    .delete()
    .eq('id', escalaId);

  return error ? { success: false, error: error.message } : { success: true };
}

// ── Limpa todas as escalas de uma data específica ───────────────────────────
export async function limparEscalaDia(
  data: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('plantao_ti_escala')
    .delete()
    .eq('data_plantao', data);

  return error ? { success: false, error: error.message } : { success: true };
}

// ── Adiciona uma nova ocorrência de plantão ──────────────────────────────────
export async function adicionarOcorrenciaPlantao(
  escalaId: string,
  dados: {
    nome_solicitante: string;
    setor_solicitante: string;
    descricao_plantao: string;
    atendimento_presencial: boolean;
  }
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('plantao_ti_ocorrencias')
    .insert({
      escala_id: escalaId,
      nome_solicitante: dados.nome_solicitante,
      setor_solicitante: dados.setor_solicitante,
      descricao_plantao: dados.descricao_plantao,
      atendimento_presencial: dados.atendimento_presencial,
    });

  return error ? { success: false, error: error.message } : { success: true };
}

// ── Remove uma ocorrência de plantão pelo ID ─────────────────────────────────
export async function removerOcorrenciaPlantao(
  ocorrenciaId: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('plantao_ti_ocorrencias')
    .delete()
    .eq('id', ocorrenciaId);

  return error ? { success: false, error: error.message } : { success: true };
}
