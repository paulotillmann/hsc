import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const N8N_WEBHOOK_URL = 'https://n8n-n8n.7woir1.easypanel.host/webhook/consulta_os';

// Interface representando a estrutura que vem do n8n em UPPERCASE
interface N8NOrdemServico {
  DS_GRUPO_DES: string | null;
  NR_SEQUENCIA: number;
  NR_SEQ_LOCALIZACAO: number | null;
  DS_LOCALIZACAO: string | null;
  NR_SEQ_EQUIPAMENTO: number | null;
  DS_EQUIPAMENTO: string | null;
  NM_SOLICITANTE: string | null;
  TELEFONE_SOLICITANTE: string | null;
  NM_Executor: string | null;
  NM_USUARIO_ENCER: string | null;
  NM_USUARIO: string | null;
  DT_ORDEM_SERVICO: string | null;
  DT_ATUALIZACAO: string | null;
  MINUTOS_ATUALIZA: number | null;
  DS_ESTAGIO: string | null;
  IE_STATUS_ORDEM: string | null;
  IE_PRIORIDADE: string | null;
  DS_PRIORIDADE: string | null;
  IE_PARADO: string | null;
  DS_DANO_BREVE: string | null;
  DS_DANO: string | null;
  NR_SEQ_ESTAGIO: number | null;
  DS_SITUACAO: string | null;
  DS_SOLUCAO: string | null;
  DS_RELAT_TECNICO: string | null;
}

// Interface representando o schema do PostgreSQL no Supabase (snake_case)
interface DBOrdemServico {
  nr_sequencia: number;
  ds_grupo_des: string | null;
  nr_seq_localizacao: number | null;
  ds_localizacao: string | null;
  nr_seq_equipamento: number | null;
  ds_equipamento: string | null;
  nm_solicitante: string | null;
  telefone_solicitante: string | null;
  nm_executor: string | null;
  nm_usuario_encer: string | null;
  nm_usuario: string | null;
  dt_ordem_servico: string | null;
  dt_atualizacao: string | null;
  minutos_atualiza: number | null;
  ds_estagio: string | null;
  ie_status_ordem: string | null;
  ie_prioridade: string | null;
  ds_prioridade: string | null;
  ie_parado: string | null;
  ds_dano_breve: string | null;
  ds_dano: string | null;
  nr_seq_estagio: number | null;
  ds_situacao: string | null;
  ds_solucao: string | null;
  ds_relat_tecnico: string | null;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

// Função para remover tags HTML e decodificar entidades HTML comuns
function cleanHTML(html: string | null): string {
  if (!html) return '';
  
  // 1. Remover tags HTML
  let text = html.replace(/<[^>]*>/g, '');
  
  // 2. Substituir entidades HTML comuns
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
    
  return text.trim();
}

Deno.serve(async (req: Request) => {
  // Trata requisição OPTIONS para CORS pre-flight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders,
    });
  }

  try {
    console.log('[Sync OS] Iniciando processo de sincronização de Ordens de Serviço...');

    // 1. Consultar webhook do n8n
    console.log(`[Sync OS] Chamando webhook n8n: ${N8N_WEBHOOK_URL}`);
    const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!n8nResponse.ok) {
      throw new Error(`Erro ao consultar o n8n: HTTP ${n8nResponse.status} - ${n8nResponse.statusText}`);
    }

    const responseText = await n8nResponse.text();
    console.log(`[Sync OS] Resposta do webhook recebida. Comprimento do corpo: ${responseText.length} bytes.`);

    if (!responseText || responseText.trim() === '') {
      console.log('[Sync OS] Webhook do n8n retornou resposta vazia. Sincronização ignorada.');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Webhook do n8n retornou resposta vazia. Nenhuma ordem de serviço sincronizada.',
          upserted: 0
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    let rawData;
    try {
      rawData = JSON.parse(responseText);
    } catch (e) {
      throw new Error(`A resposta do n8n não é um JSON válido: ${responseText.substring(0, 200)}`);
    }

    console.log(`[Sync OS] Webhook analisado com sucesso. Dados obtidos: ${Array.isArray(rawData) ? rawData.length : 0} registros.`);

    if (!Array.isArray(rawData)) {
      throw new Error('A resposta do n8n não retornou um array válido de ordens de serviço.');
    }

    // 2. Mapear os dados para a estrutura do banco de dados
    const recordsToInsert: DBOrdemServico[] = [];

    for (const item of rawData) {
      if (item.NR_SEQUENCIA === undefined || item.NR_SEQUENCIA === null) {
        continue;
      }

      const mappedRecord: DBOrdemServico = {
        nr_sequencia: Number(item.NR_SEQUENCIA),
        ds_grupo_des: item.DS_GRUPO_DES ? String(item.DS_GRUPO_DES).trim() : null,
        nr_seq_localizacao: item.NR_SEQ_LOCALIZACAO ? Number(item.NR_SEQ_LOCALIZACAO) : null,
        ds_localizacao: item.DS_LOCALIZACAO ? String(item.DS_LOCALIZACAO).trim() : null,
        nr_seq_equipamento: item.NR_SEQ_EQUIPAMENTO ? Number(item.NR_SEQ_EQUIPAMENTO) : null,
        ds_equipamento: item.DS_EQUIPAMENTO ? String(item.DS_EQUIPAMENTO).trim() : null,
        nm_solicitante: item.NM_SOLICITANTE ? String(item.NM_SOLICITANTE).trim() : null,
        telefone_solicitante: item.TELEFONE_SOLICITANTE ? String(item.TELEFONE_SOLICITANTE).trim() : null,
        nm_executor: item.NM_Executor ? String(item.NM_Executor).trim() : null,
        nm_usuario_encer: item.NM_USUARIO_ENCER ? String(item.NM_USUARIO_ENCER).trim() : null,
        nm_usuario: item.NM_USUARIO ? String(item.NM_USUARIO).trim() : null,
        dt_ordem_servico: item.DT_ORDEM_SERVICO ? new Date(item.DT_ORDEM_SERVICO).toISOString() : null,
        dt_atualizacao: item.DT_ATUALIZACAO ? new Date(item.DT_ATUALIZACAO).toISOString() : null,
        minutos_atualiza: item.MINUTOS_ATUALIZA ? Number(item.MINUTOS_ATUALIZA) : null,
        ds_estagio: item.DS_ESTAGIO ? String(item.DS_ESTAGIO).trim() : null,
        ie_status_ordem: item.IE_STATUS_ORDEM ? String(item.IE_STATUS_ORDEM).trim() : null,
        ie_prioridade: item.IE_PRIORIDADE ? String(item.IE_PRIORIDADE).trim() : null,
        ds_prioridade: item.DS_PRIORIDADE ? String(item.DS_PRIORIDADE).trim() : null,
        ie_parado: item.IE_PARADO ? String(item.IE_PARADO).trim() : null,
        ds_dano_breve: item.DS_DANO_BREVE ? cleanHTML(item.DS_DANO_BREVE) : null,
        ds_dano: item.DS_DANO ? cleanHTML(item.DS_DANO) : null,
        nr_seq_estagio: item.NR_SEQ_ESTAGIO ? Number(item.NR_SEQ_ESTAGIO) : null,
        ds_situacao: item.DS_SITUACAO ? String(item.DS_SITUACAO).trim() : null,
        ds_solucao: item.DS_SOLUCAO ? cleanHTML(item.DS_SOLUCAO) : null,
        ds_relat_tecnico: item.DS_RELAT_TECNICO ? cleanHTML(item.DS_RELAT_TECNICO) : null,
      };

      recordsToInsert.push(mappedRecord);
    }

    console.log(`[Sync OS] Mapeamento concluído. ${recordsToInsert.length} ordens de serviço prontas para persistência.`);

    if (recordsToInsert.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Nenhuma ordem de serviço válida encontrada para sincronizar.',
          upserted: 0
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // 3. Inicializar o cliente do Supabase
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Variáveis de ambiente do Supabase (URL/SERVICE_ROLE_KEY) não estão configuradas.');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 4. Executar UPSERT com base em nr_sequencia na tabela public.ordem_servico
    const { error: upsertError } = await supabase
      .from('ordem_servico')
      .upsert(recordsToInsert, { onConflict: 'nr_sequencia' });

    if (upsertError) {
      throw new Error(`Erro ao realizar o UPSERT no Supabase (ordem_servico): ${upsertError.message}`);
    }

    // 5. Salvar histórico de relatos técnicos sem duplicar
    console.log('[Sync OS] Iniciando processamento do histórico de relatos técnicos...');
    const nrSequenciasSincronizadas = recordsToInsert.map(r => r.nr_sequencia);

    // Buscar o último relato inserido para cada uma das OSs sincronizadas
    const { data: existingRelatos, error: queryError } = await supabase
      .from('historico_ordem_servico')
      .select('nr_sequencia, ds_relat_tecnico, created_at')
      .in('nr_sequencia', nrSequenciasSincronizadas)
      .order('created_at', { ascending: false });

    if (queryError) {
      console.error('[Sync OS] Erro ao consultar historico_ordem_servico. A tabela já foi criada no banco?', queryError.message);
    } else {
      // Mapear o último relato gravado no banco para cada nr_sequencia
      const latestRelatoMap = new Map<number, string>();
      if (existingRelatos && existingRelatos.length > 0) {
        for (const r of existingRelatos) {
          if (!latestRelatoMap.has(r.nr_sequencia)) {
            latestRelatoMap.set(r.nr_sequencia, (r.ds_relat_tecnico || '').trim());
          }
        }
      }

      // Preparar os relatos a serem inseridos
      const relatosToInsert: Array<{
        nr_sequencia: number;
        ds_relat_tecnico: string;
        nm_usuario: string | null;
      }> = [];

      for (const item of rawData) {
        if (item.NR_SEQUENCIA === undefined || item.NR_SEQUENCIA === null) {
          continue;
        }

        const nrSeq = Number(item.NR_SEQUENCIA);
        const novoRelato = item.DS_RELAT_TECNICO ? cleanHTML(item.DS_RELAT_TECNICO) : '';

        // Só insere se houver relato técnico não nulo/vazio e for diferente do último gravado
        if (novoRelato !== '') {
          const ultimoGravado = latestRelatoMap.get(nrSeq) || '';
          if (novoRelato !== ultimoGravado) {
            relatosToInsert.push({
              nr_sequencia: nrSeq,
              ds_relat_tecnico: novoRelato,
              nm_usuario: item.NM_USUARIO ? String(item.NM_USUARIO).trim() : null
            });
            // Atualiza o mapa para evitar adicionar duplicados no mesmo lote
            latestRelatoMap.set(nrSeq, novoRelato);
          }
        }
      }

      if (relatosToInsert.length > 0) {
        console.log(`[Sync OS] Inserindo ${relatosToInsert.length} novos relatos no histórico...`);
        const { error: insertRelatoError } = await supabase
          .from('historico_ordem_servico')
          .insert(relatosToInsert);

        if (insertRelatoError) {
          console.error('[Sync OS] Erro ao inserir relatos na tabela historico_ordem_servico:', insertRelatoError.message);
        } else {
          console.log('[Sync OS] Histórico de relatos técnicos atualizado com sucesso.');
        }
      } else {
        console.log('[Sync OS] Nenhum relato técnico novo ou diferente detectado.');
      }
    }

    console.log(`[Sync OS] Sincronização realizada com sucesso! ${recordsToInsert.length} registros inseridos/atualizados.`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Sincronização de ordens de serviço concluída com sucesso.',
        upserted: recordsToInsert.length
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error: any) {
    console.error('[Sync OS] Falha no fluxo:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro desconhecido na sincronização de ordens de serviço.'
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
