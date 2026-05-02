// src/services/visitanteService.ts
// CRUD de Visitantes (Supabase) + Sincronização com Bubble.io

import { supabase } from '../lib/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface Visitante {
  id: string;
  bubble_id: string | null;
  nome: string;
  documento: string | null;
  cidade: string | null;
  endereco: string | null;
  telefone: string | null;
  telefone_contato: string | null;
  foto_url: string | null;
  ativo: boolean;
  bloqueado: boolean;
  motivo_bloqueio: string | null;
  terceiro: boolean;
  parentesco: string | null;
  created_at: string;
  updated_at: string;
}

export interface VisitanteInsert {
  bubble_id?: string | null;
  nome: string;
  documento?: string | null;
  cidade?: string | null;
  endereco?: string | null;
  telefone?: string | null;
  telefone_contato?: string | null;
  foto_url?: string | null;
  ativo?: boolean;
  bloqueado?: boolean;
  motivo_bloqueio?: string | null;
  terceiro?: boolean;
  parentesco?: string | null;
}

// Resultado de sinc paginada
export interface SyncProgress {
  total: number;         // total estimado no Bubble
  processado: number;    // quantos foram processados até agora
  inseridos: number;     // novos registros inseridos
  ignorados: number;     // já existiam (bubble_id duplicado)
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
const BUBBLE_LIMIT = 50; // reduzido para não dar timeout (Failed to fetch)

// ─────────────────────────────────────────────────────────────────────────────
// CRUD — Supabase
// ─────────────────────────────────────────────────────────────────────────────

/** Lista todos os visitantes ativos, ordenados por nome */
export async function listarVisitantes(opts?: {
  busca?: string;
  cidade?: string;
  page?: number;
  perPage?: number;
  orderBy?: string;
  orderAsc?: boolean;
}): Promise<{ data: Visitante[]; count: number }> {
  const page = opts?.page ?? 1;
  const perPage = opts?.perPage ?? 50;
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  let query = supabase
    .from('visitantes')
    .select('*', { count: 'exact' })
    .eq('ativo', true)
    .eq('terceiro', false)
    .order(opts?.orderBy || 'nome', { ascending: opts?.orderAsc ?? true })
    .range(from, to);

  if (opts?.busca) {
    query = query.or(`nome.ilike.%${opts.busca}%,documento.ilike.%${opts.busca}%,telefone.ilike.%${opts.busca}%`);
  }

  if (opts?.cidade) {
    query = query.eq('cidade', opts.cidade);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: data as Visitante[], count: count ?? 0 };
}

/** Lista cidades distintas dos visitantes ativos para popular o filtro */
export async function listarCidadesVisitantes(): Promise<string[]> {
  const { data, error } = await supabase.rpc('get_visitantes_cidades');
  if (error) {
    console.error('Erro ao buscar cidades:', error);
    return [];
  }
  return data.map((d: any) => d.cidade);
}

/** Busca um visitante pelo id */
export async function buscarVisitante(id: string): Promise<Visitante | null> {
  const { data, error } = await supabase
    .from('visitantes')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as Visitante;
}

/** Cria um novo visitante */
export async function criarVisitante(payload: VisitanteInsert): Promise<Visitante> {
  const { data, error } = await supabase
    .from('visitantes')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data as Visitante;
}

/** Atualiza um visitante existente */
export async function atualizarVisitante(id: string, payload: Partial<VisitanteInsert>): Promise<Visitante> {
  const { data, error } = await supabase
    .from('visitantes')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Visitante;
}

/** Soft-delete: marca ativo = false */
export async function desativarVisitante(id: string): Promise<void> {
  const { error } = await supabase
    .from('visitantes')
    .update({ ativo: false })
    .eq('id', id);
  if (error) throw error;
}

// ─────────────────────────────────────────────────────────────────────────────
// SINCRONIZAÇÃO Bubble → Supabase
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sincroniza HSC_Visitante do Bubble para a tabela `visitantes` no Supabase.
 *
 * Estratégia de idempotência:
 * - Usa `bubble_id` com constraint UNIQUE.
 * - Upsert: se já existe, atualiza nome/documento/cidade/endereco/telefone.
 * - Nunca duplica registros.
 *
 * @param onProgress  Callback chamado a cada lote com o progresso atual.
 * @param cancelRef   Objeto { current: boolean } — mude para `true` para cancelar.
 */
export async function sincronizarVisitantes(
  onProgress: (progress: SyncProgress) => void,
  cancelRef: { current: boolean },
  options?: { startCursor?: number, reverseOrder?: boolean, previousProgress?: SyncProgress }
): Promise<SyncProgress> {
  const isResume = !!options?.startCursor && options.startCursor > 0;
  
  const progress: SyncProgress = options?.previousProgress ? { 
    ...options.previousProgress, 
    concluido: false, 
    cancelado: false, 
    erros: 0 
  } : {
    total: 0,
    processado: 0,
    inseridos: 0,
    ignorados: 0,
    erros: 0,
    concluido: false,
    cancelado: false,
    mensagem: 'Iniciando sincronização...',
    nextCursor: 0,
  };

  try {
    let cursor = options?.startCursor || 0;
    
    // 1. Busca primeiro lote para descobrir o total ou remaining
    const firstRes = await fetchBubblePage(cursor, options?.reverseOrder);
    
    if (!isResume) {
      progress.total = firstRes.count + firstRes.remaining;
      onProgress({ ...progress, mensagem: `Total de ${progress.total} registros encontrados no Bubble.` });
    } else {
      // Se não havia um total anterior (foi digitado manualmente no input), a gente calcula
      if (!progress.total || progress.total === 0) {
        progress.total = cursor + firstRes.count + firstRes.remaining;
        progress.processado = cursor; 
      }
      onProgress({ ...progress, mensagem: `Retomando a partir do registro ${cursor}... Total estimado: ${progress.total}` });
    }

    let allResults = firstRes.results;
    await processLote(allResults, progress, onProgress);
    cursor += firstRes.results.length;
    progress.nextCursor = cursor;

    // Continua paginando enquanto houver remaining
    let remaining = firstRes.remaining;

    while (remaining > 0) {
      if (cancelRef.current) {
        progress.cancelado = true;
        progress.mensagem = `Cancelado pelo usuário. ${progress.processado} registros processados.`;
        onProgress({ ...progress });
        return progress;
      }

      const res = await fetchBubblePage(cursor, options?.reverseOrder);
      remaining = res.remaining;
      
      await processLote(res.results, progress, onProgress);
      cursor += res.results.length;
      progress.nextCursor = cursor;
      
      // Delay para não sobrecarregar a API do Bubble com muitas páginas por segundo
      await delay(300);
    }

    progress.concluido = true;
    progress.mensagem = `✓ Concluído! ${progress.inseridos} inseridos, ${progress.ignorados} já existiam.`;
    onProgress({ ...progress });
    return progress;

  } catch (err: any) {
    progress.mensagem = `✗ Erro: ${err.message}`;
    onProgress({ ...progress });
    return progress;
  }
}

// ─── helpers internos ───────────────────────────────────────────────────────

interface BubbleVisitantePage {
  count: number;
  remaining: number;
  results: any[];
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchBubblePage(cursor: number, reverseOrder: boolean = false, retries = 10): Promise<BubbleVisitantePage> {
  const sortParams = reverseOrder ? '&sort_field=Created%20Date&descending=true' : '';
  const url = `${BUBBLE_BASE}/HSC_Visitante?cursor=${cursor}&limit=${BUBBLE_LIMIT}${sortParams}`;
  
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
      console.warn(`[Sync] Tentativa ${attempt} falhou no cursor ${cursor}:`, err);
      if (attempt === retries) {
        throw new Error(`Bubble API: ${err.message}`); // joga pra fora com prefixo
      }
      // Espera um tempo antes de tentar de novo, com escalonamento (máximo 5 segundos de espera)
      const waitTime = Math.min(1000 * attempt, 5000);
      await delay(waitTime);
    }
  }
  
  throw new Error('Falha ao tentar buscar dados no Bubble');
}

async function processLote(
  results: any[],
  progress: SyncProgress,
  onProgress: (p: SyncProgress) => void
) {
  if (results.length === 0) return;

  const formatarCidade = (cidadeOrigem: string | null) => {
    if (!cidadeOrigem) return null;
    const cidade = cidadeOrigem.trim();
    if (cidade.toUpperCase().includes('ARAGUARI')) {
      return 'Araguari';
    }
    return cidade;
  };

  // Filtra registros que possuem o nome vazio ou nulo
  const registrosValidos = results.filter((r: any) => {
    const nome = (r.Nome ?? '').trim();
    return nome.length > 0;
  });

  const ignoradosPorFiltro = results.length - registrosValidos.length;
  progress.ignorados += ignoradosPorFiltro;

  const rows = registrosValidos.map((r: any) => ({
    bubble_id: r._id,
    nome: (r.Nome ?? '').trim(),
    documento: r.Documento ?? null,
    cidade: formatarCidade(r.Cidade),
    endereco: r.Endereco ?? null,
    telefone: r.TelefonePessoal ?? null,
    telefone_contato: r.TelefoneContato ?? null,
    bloqueado: r.bloqueado ?? false,
    motivo_bloqueio: r.MotivoBloqueio ?? null,
    terceiro: r.Terceiro ?? false,
    ativo: true,
  }));

  // Dividir o lote em pedaços menores (chunks) para evitar TypeError: Failed to fetch (Timeout/Body Size)
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
          .from('visitantes')
          .upsert(chunk, {
            onConflict: 'bubble_id',
            ignoreDuplicates: false,
          })
          .select('id');

        if (error) {
          if (attempt === maxAttempts) {
            progress.erros += chunk.length;
            console.error('[Sync] Erro no chunk Supabase:', error);
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
  progress.mensagem = `Processando... ${progress.processado} de ${progress.total}`;
  onProgress({ ...progress });
}
