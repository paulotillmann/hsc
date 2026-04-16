// src/services/notificacaoService.ts
// Serviço responsável por Notificações Epidemiológicas
// - Leitura via Supabase (tabela notificacao)
// - Sync via Edge Function sync-notificacoes (Bubble → Supabase)

import { supabase } from '../lib/supabase';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export interface NotificacaoRecord {
  id: string;
  bubble_id: string;
  Paciente: string | null;
  IdadePaciente: string | null;
  DataNascimento: string | null;
  SexoPaciente: string | null;
  CorRacaPaciente: string | null;
  EscolaridadePaciente: string | null;
  OcupacaoPaciente: string | null;
  Endereco: string | null;
  DataSintoma: string | null;
  DataNotificacao: string | null;
  DoencaAgravo: string | null;
  Resultado: string | null;
  Saida: string | null;
  Setor: string | null;
  'Created By': string | null;
  'Created Date': string | null;
  'Modified Date': string | null;
  created_at: string;
  updated_at: string;
}

export interface SyncResult {
  success: boolean;
  totalFetched?: number;
  totalUpserted?: number;
  message?: string;
  error?: string;
}

// ─────────────────────────────────────────────────────────────
// FETCH — lista notificações do Supabase (com filtros opcionais)
// ─────────────────────────────────────────────────────────────

export interface FetchNotificacoesParams {
  setor?: string;
  doencaAgravo?: string;
  dateFrom?: string;  // ISO string
  dateTo?: string;    // ISO string
  limit?: number;
  offset?: number;
}

export async function fetchNotificacoes(
  params: FetchNotificacoesParams = {}
): Promise<{ data: NotificacaoRecord[]; count: number }> {
  const { setor, doencaAgravo, dateFrom, dateTo, limit = 50, offset = 0 } = params;

  let query = supabase
    .from('notificacao')
    .select('*', { count: 'exact' })
    .order('DataNotificacao', { ascending: false })
    .range(offset, offset + limit - 1);

  if (setor)        query = query.eq('Setor', setor);
  if (doencaAgravo) query = query.ilike('DoencaAgravo', `%${doencaAgravo}%`);
  if (dateFrom)     query = query.gte('DataNotificacao', dateFrom);
  if (dateTo)       query = query.lte('DataNotificacao', dateTo);

  const { data, error, count } = await query;

  if (error) throw new Error(error.message);
  return { data: (data ?? []) as NotificacaoRecord[], count: count ?? 0 };
}

// ─────────────────────────────────────────────────────────────
// GET BY ID — busca uma única notificação
// ─────────────────────────────────────────────────────────────

export async function getNotificacaoById(id: string): Promise<NotificacaoRecord | null> {
  const { data, error } = await supabase
    .from('notificacao')
    .select('*')
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') throw new Error(error.message);
  return data ? (data as NotificacaoRecord) : null;
}

// ─────────────────────────────────────────────────────────────
// DELETE — exclui uma notificação
// ─────────────────────────────────────────────────────────────

export async function deleteNotificacao(id: string): Promise<void> {
  const { error } = await supabase
    .from('notificacao')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}

// ─────────────────────────────────────────────────────────────
// SYNC — aciona Edge Function para buscar Bubble e gravar no Supabase
// ─────────────────────────────────────────────────────────────

export async function syncNotificacoes(): Promise<SyncResult> {
  const { data, error } = await supabase.functions.invoke('sync-notificacoes');

  if (error) {
    console.error('[notificacaoService] Erro ao invocar sync-notificacoes:', error);
    return { success: false, error: error.message };
  }

  return data as SyncResult;
}

// ─────────────────────────────────────────────────────────────
// FETCH DASHBOARD FILTERS (Ocupações e Resultados)
// ─────────────────────────────────────────────────────────────

export async function getTodasOcupacoes(): Promise<string[]> {
  const { data, error } = await supabase
    .from('notificacao_ocupacao')
    .select('DescricaoOcupacao')
    .order('DescricaoOcupacao', { ascending: true });

  if (error) {
    console.error('[notificacaoService] Erro listar ocupações:', error);
    return [];
  }
  
  return data
    .map(item => item.DescricaoOcupacao)
    .filter((v): v is string => !!v);
}

export async function getTodosResultados(): Promise<string[]> {
  const { data, error } = await supabase
    .from('notificacao_resultado')
    .select('DescricaoResultado')
    .order('DescricaoResultado', { ascending: true });

  if (error) {
    console.error('[notificacaoService] Erro listar resultados:', error);
    return [];
  }
  
  return data
    .map(item => item.DescricaoResultado)
    .filter((v): v is string => !!v);
}

