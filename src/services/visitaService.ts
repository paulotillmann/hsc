// src/services/visitaService.ts
// Sincronização HSC_Visitas (Bubble → Supabase) + Resolução de FK

import { supabase } from '../lib/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface Visita {
  id: string;
  bubble_id: string;
  visitante_bubble_id: string | null;
  visitante_id: string | null;
  paciente: string;
  clinica: string | null;
  leito: string | null;
  apartamento: string | null;
  id_cracha: number | null;
  identificado_como: string;
  parentesco: string | null;
  data_hora_entrada: string | null;
  data_hora_saida: string | null;
  data_internacao: string | null;
  enfermagem: string | null;
  qrcode: string | null;
  atendente: string | null;
  bubble_created_by: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

// Resultado de sinc paginada (reutiliza o mesmo formato de Visitantes)
export interface SyncProgress {
  total: number;
  processado: number;
  inseridos: number;
  ignorados: number;
  erros: number;
  concluido: boolean;
  cancelado: boolean;
  mensagem: string;
  nextCursor?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Bubble API config
// ─────────────────────────────────────────────────────────────────────────────
const BUBBLE_BASE = 'https://hsc.santacasaaraguari.org.br/version-test/api/1.1/obj';
const BUBBLE_TOKEN = '3f3f85633f29b79f6b95dcc04a1988d6';
const BUBBLE_LIMIT = 50;

// ─────────────────────────────────────────────────────────────────────────────
// SINCRONIZAÇÃO Bubble → Supabase
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sincroniza HSC_Visitas do Bubble para a tabela `visitas` no Supabase.
 *
 * Estratégia de idempotência:
 * - Usa `bubble_id` com constraint UNIQUE.
 * - Upsert: se já existe, atualiza todos os campos.
 * - Nunca duplica registros.
 */
export async function sincronizarVisitas(
  onProgress: (progress: SyncProgress) => void,
  cancelRef: { current: boolean },
  options?: { startCursor?: number; reverseOrder?: boolean; previousProgress?: SyncProgress; dateFrom?: string; dateTo?: string }
): Promise<SyncProgress> {
  const isResume = !!options?.startCursor && options.startCursor > 0;

  const progress: SyncProgress = options?.previousProgress
    ? {
        ...options.previousProgress,
        concluido: false,
        cancelado: false,
        erros: 0,
      }
    : {
        total: 0,
        processado: 0,
        inseridos: 0,
        ignorados: 0,
        erros: 0,
        concluido: false,
        cancelado: false,
        mensagem: 'Iniciando sincronização de visitas...',
        nextCursor: 0,
      };

  try {
    let cursor = options?.startCursor || 0;

    // 1. Busca primeiro lote para descobrir o total
    const firstRes = await fetchBubblePage(cursor, options?.reverseOrder, 10, options?.dateFrom, options?.dateTo);

    if (!isResume) {
      progress.total = firstRes.count + firstRes.remaining;
      onProgress({ ...progress, mensagem: `Total de ${progress.total} visitas encontradas no Bubble.` });
    } else {
      if (!progress.total || progress.total === 0) {
        progress.total = cursor + firstRes.count + firstRes.remaining;
        progress.processado = cursor;
      }
      onProgress({ ...progress, mensagem: `Retomando a partir do registro ${cursor}... Total estimado: ${progress.total}` });
    }

    await processLote(firstRes.results, progress, onProgress);
    cursor += firstRes.results.length;
    progress.nextCursor = cursor;

    let remaining = firstRes.remaining;

    while (remaining > 0) {
      if (cancelRef.current) {
        progress.cancelado = true;
        progress.mensagem = `Cancelado pelo usuário. ${progress.processado} registros processados.`;
        onProgress({ ...progress });
        return progress;
      }

      const res = await fetchBubblePage(cursor, options?.reverseOrder, 10, options?.dateFrom, options?.dateTo);
      remaining = res.remaining;

      await processLote(res.results, progress, onProgress);
      cursor += res.results.length;
      progress.nextCursor = cursor;

      await delay(300);
    }

    progress.concluido = true;
    progress.mensagem = `✓ Concluído! ${progress.inseridos} inseridos/atualizados, ${progress.ignorados} sem alterações.`;
    onProgress({ ...progress });
    return progress;
  } catch (err: any) {
    progress.mensagem = `✗ Erro: ${err.message}`;
    onProgress({ ...progress });
    return progress;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FETCH VISITAS
// ─────────────────────────────────────────────────────────────────────────────

export async function listarVisitasPorVisitante(visitante_id: string): Promise<Visita[]> {
  const { data, error } = await supabase
    .from('visitas')
    .select('*')
    .eq('visitante_id', visitante_id)
    .order('data_hora_entrada', { ascending: false });

  if (error) {
    console.error('Erro ao buscar visitas do visitante:', error);
    throw error;
  }

  return data as Visita[];
}

export async function obterProximoCracha(): Promise<number> {
  const { data, error } = await supabase
    .from('visitas')
    .select('id_cracha')
    .not('id_cracha', 'is', null)
    .order('id_cracha', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Erro ao buscar próximo crachá:', error);
    return 1;
  }

  return (data?.id_cracha || 0) + 1;
}

export async function inserirVisita(visitaData: Partial<Visita>): Promise<Visita> {
  const { data, error } = await supabase
    .from('visitas')
    .insert([visitaData])
    .select()
    .single();

  if (error) {
    console.error('Erro ao inserir nova visita:', error);
    throw error;
  }

  return data as Visita;
}

// ─────────────────────────────────────────────────────────────────────────────
// RESOLUÇÃO DE FK — visitante_id
// ─────────────────────────────────────────────────────────────────────────────

export interface ResolverFkProgress {
  total: number;
  processado: number;
  concluido: boolean;
  mensagem: string;
}

/**
 * Resolve `visitante_id` nas visitas em lotes de 5000, chamando a RPC
 * `resolver_visitas_visitante_id_batch` repetidamente até zerar.
 * Isso evita statement timeout em volumes grandes (65k+).
 *
 * @returns Número total de registros atualizados.
 */
export async function resolverVisitantesFk(
  onProgress?: (progress: ResolverFkProgress) => void
): Promise<number> {
  // 1. Conta quantas visitas precisam de resolução
  const { count, error: countError } = await supabase
    .from('visitas')
    .select('id', { count: 'exact', head: true })
    .is('visitante_id', null)
    .not('visitante_bubble_id', 'is', null);

  if (countError) throw countError;

  const total = count ?? 0;
  if (total === 0) {
    onProgress?.({ total: 0, processado: 0, concluido: true, mensagem: 'Nenhuma visita pendente de resolução.' });
    return 0;
  }

  let totalProcessado = 0;
  const BATCH_SIZE = 5000;

  onProgress?.({
    total,
    processado: 0,
    concluido: false,
    mensagem: `Iniciando resolução de ${total.toLocaleString('pt-BR')} visitas...`,
  });

  // 2. Processa em lotes até retornar 0
  while (true) {
    const { data, error } = await supabase.rpc('resolver_visitas_visitante_id_batch', {
      p_limit: BATCH_SIZE,
    });

    if (error) throw error;

    const affected = (data as number) ?? 0;
    totalProcessado += affected;

    onProgress?.({
      total,
      processado: totalProcessado,
      concluido: affected === 0,
      mensagem: affected === 0
        ? `✓ Concluído! ${totalProcessado.toLocaleString('pt-BR')} visitas vinculadas.`
        : `Processando... ${totalProcessado.toLocaleString('pt-BR')} de ${total.toLocaleString('pt-BR')}`,
    });

    if (affected === 0) break;

    // Pequena pausa para não sobrecarregar
    await delay(200);
  }

  return totalProcessado;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers internos
// ─────────────────────────────────────────────────────────────────────────────

interface BubbleVisitaPage {
  count: number;
  remaining: number;
  results: any[];
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchBubblePage(cursor: number, reverseOrder: boolean = false, retries = 10, dateFrom?: string, dateTo?: string): Promise<BubbleVisitaPage> {
  const sortParams = reverseOrder ? '&sort_field=Created%20Date&descending=true' : '';
  
  // Constraints de filtro por data (para contornar limite de 50k do cursor)
  let constraintParams = '';
  if (dateFrom || dateTo) {
    const constraints: any[] = [];
    if (dateFrom) constraints.push({ key: 'Created Date', constraint_type: 'greater than', value: `${dateFrom}T00:00:00Z` });
    if (dateTo) constraints.push({ key: 'Created Date', constraint_type: 'less than', value: `${dateTo}T00:00:00Z` });
    constraintParams = `&constraints=${encodeURIComponent(JSON.stringify(constraints))}`;
  }
  
  const url = `${BUBBLE_BASE}/HSC_Visitas?cursor=${cursor}&limit=${BUBBLE_LIMIT}${sortParams}${constraintParams}`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${BUBBLE_TOKEN}`,
          Accept: 'application/json',
        },
      });
      if (!res.ok) throw new Error(`Bubble API erro ${res.status}`);
      const json = await res.json();
      return {
        count: json.response.count ?? 0,
        remaining: json.response.remaining ?? 0,
        results: json.response.results ?? [],
      };
    } catch (err: any) {
      console.warn(`[SyncVisitas] Tentativa ${attempt} falhou no cursor ${cursor}:`, err);
      if (attempt === retries) {
        throw new Error(`Bubble API: ${err.message}`);
      }
      const waitTime = Math.min(1000 * attempt, 5000);
      await delay(waitTime);
    }
  }

  throw new Error('Falha ao tentar buscar dados de Visitas no Bubble');
}

/**
 * Converte DataInternacao de DD/MM/YYYY para YYYY-MM-DD (ISO date).
 * Retorna null se inválido.
 */
function parseDataInternacao(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const match = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, dia, mes, ano] = match;
  return `${ano}-${mes}-${dia}`;
}

/**
 * Trim de string. Se resultado for vazio ou só espaços, retorna null.
 */
function trimOrNull(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function processLote(results: any[], progress: SyncProgress, onProgress: (p: SyncProgress) => void) {
  if (results.length === 0) return;

  // Filtra registros que possuem Paciente vazio ou nulo
  const registrosValidos = results.filter((r: any) => {
    const paciente = (r.Paciente ?? '').trim();
    return paciente.length > 0;
  });

  const ignoradosPorFiltro = results.length - registrosValidos.length;
  progress.ignorados += ignoradosPorFiltro;

  const rows = registrosValidos.map((r: any) => ({
    bubble_id: r._id,
    visitante_bubble_id: r.Visitante ?? null,
    paciente: (r.Paciente ?? '').trim(),
    clinica: trimOrNull(r.Clinica),
    leito: trimOrNull(r.Leito),
    apartamento: trimOrNull(r.Apartamento),
    id_cracha: r.IDcracha ?? null,
    identificado_como: r.IdentificadoComo ?? 'VISITANTE',
    parentesco: trimOrNull(r.Parentesco),
    data_hora_entrada: r.DataHoraEntrada ?? null,
    data_hora_saida: r.DataHoraSaida ?? null,
    data_internacao: parseDataInternacao(r.DataInternacao),
    enfermagem: trimOrNull(r.Enfermagem),
    qrcode: r.QRCode ?? null,
    atendente: trimOrNull(r.Atendente),
    bubble_created_by: r['Created By'] ?? null,
    ativo: true,
  }));

  // Chunking para evitar timeout
  const CHUNK_SIZE = 50;
  let totalInseridos = 0;

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);

    let attempt = 1;
    const maxAttempts = 3;
    let chunkSuccess = false;

    while (attempt <= maxAttempts && !chunkSuccess) {
      try {
        const { error, data } = await supabase
          .from('visitas')
          .upsert(chunk, {
            onConflict: 'bubble_id',
            ignoreDuplicates: false,
          })
          .select('id');

        if (error) {
          if (attempt === maxAttempts) {
            progress.erros += chunk.length;
            console.error('[SyncVisitas] Erro no chunk Supabase:', error);
            throw new Error(`Supabase Upsert: ${error.message}`);
          }
        } else {
          totalInseridos += data?.length ?? 0;
          chunkSuccess = true;
        }
      } catch (err: any) {
        if (attempt === maxAttempts) {
          throw new Error(`Supabase Error: ${err.message}`);
        }
      }

      if (!chunkSuccess) {
        await delay(1500 * attempt);
        attempt++;
      }
    }
  }

  progress.inseridos += totalInseridos;
  progress.ignorados += rows.length - totalInseridos;

  progress.processado += results.length;
  progress.mensagem = `Processando visitas... ${progress.processado} de ${progress.total}`;
  onProgress({ ...progress });
}

export async function excluirVisita(id: string): Promise<void> {
  const { data, error } = await supabase
    .from('visitas')
    .delete()
    .eq('id', id)
    .select();

  if (error) {
    console.error('[Visitas] Erro ao excluir visita:', error.message);
    throw new Error('Falha ao excluir a visita: ' + error.message);
  }

  // Se o data voltar vazio, significa que a política RLS do Supabase bloqueou o DELETE
  if (!data || data.length === 0) {
    throw new Error('Permissão negada pelo banco de dados (RLS). A política de DELETE na tabela "visitas" não está habilitada.');
  }
}

export async function buscarVisitaAbertaPorQRCode(qrcode: string): Promise<Visita | null> {
  // Verifica se o qrcode é numérico para evitar erro de tipo no Postgres (id_cracha é integer)
  const isNumeric = !isNaN(Number(qrcode)) && qrcode.trim() !== '';
  const orQuery = isNumeric 
    ? `qrcode.eq.${qrcode},id_cracha.eq.${qrcode},bubble_id.eq.${qrcode}`
    : `qrcode.eq.${qrcode},bubble_id.eq.${qrcode}`;

  // 1. Busca a visita ignorando se tem data_hora_saida ou não
  const { data, error } = await supabase
    .from('visitas')
    .select('*')
    .or(orQuery)
    .order('data_hora_entrada', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[Visitas] Erro ao buscar visita por QRCode:', error.message);
    throw new Error('Falha ao buscar visita no banco de dados.');
  }

  if (!data) {
    return null; // Não encontrou nenhum registro
  }

  // 2. Verifica se a visita já foi encerrada
  if (data.data_hora_saida !== null) {
    throw new Error(`A saída para este paciente (${data.paciente}) já foi registrada anteriormente.`);
  }

  return data as Visita;
}

export async function registrarSaidaVisita(visitaId: string): Promise<Visita> {
  const dataSaida = new Date().toISOString();

  // Atualiza a data de saída
  const { data: updatedData, error: updateError } = await supabase
    .from('visitas')
    .update({ data_hora_saida: dataSaida })
    .eq('id', visitaId)
    .select()
    .single();

  if (updateError) {
    console.error('[Visitas] Erro ao registrar saída:', updateError.message);
    throw new Error('Falha ao registrar a saída.');
  }

  return updatedData as Visita;
}

export interface SaidaLoteProgress {
  total: number;
  processado: number;
  mensagem: string;
}

export async function registrarSaidaLoteVisitantes(onProgress?: (p: SaidaLoteProgress) => void): Promise<number> {
  const dataSaida = new Date().toISOString();

  // 1. Localiza todas as visitas em andamento que contêm 'visitante' (case-insensitive)
  // E cujo campo data_hora_saida seja nulo ou vazio
  const { data: visitas, error: searchError } = await supabase
    .from('visitas')
    .select('id, data_hora_saida, identificado_como')
    .ilike('identificado_como', '%visitante%')
    .is('data_hora_saida', null);

  if (searchError) {
    console.error('[Visitas] Erro ao buscar visitas para lote:', searchError.message);
    throw new Error('Falha ao localizar visitas em aberto.');
  }

  if (!visitas || visitas.length === 0) {
    return 0;
  }

  // Filtra as que estão realmente abertas (nulas ou string vazia)
  const visitasAbertas = visitas.filter(v => !v.data_hora_saida || v.data_hora_saida.trim() === '');
  
  if (visitasAbertas.length === 0) {
    return 0;
  }

  const ids = visitasAbertas.map(v => v.id);
  const total = ids.length;
  let processado = 0;
  const chunkSize = 50;

  onProgress?.({ total, processado: 0, mensagem: `Iniciando atualização de ${total} registros...` });

  // 2. Atualiza em lotes para permitir a barra de progresso
  for (let i = 0; i < total; i += chunkSize) {
    const chunkIds = ids.slice(i, i + chunkSize);

    const { data: updatedRows, error: updateError } = await supabase
      .from('visitas')
      .update({ data_hora_saida: dataSaida })
      .in('id', chunkIds)
      .select('id');

    if (updateError) {
      console.error('[Visitas] Erro no lote:', updateError.message);
      throw new Error(`Ocorreu um erro. ${processado} registros foram atualizados antes da falha.`);
    }

    // Soma apenas os registros que realmente foram atualizados (passaram na RLS)
    processado += updatedRows ? updatedRows.length : 0;
    
    onProgress?.({
      total,
      processado,
      mensagem: `Atualizando ${processado} de ${total}...`
    });

    // Pausa suave para a animação do frontend
    await new Promise(res => setTimeout(res, 300));
  }

  return processado;
}
