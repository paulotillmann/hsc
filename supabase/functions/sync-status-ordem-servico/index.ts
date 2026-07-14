import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const N8N_WEBHOOK_URL = 'https://n8n-n8n.7woir1.easypanel.host/webhook/consuta_status_os';

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
  HISTORICO: string | null;
  DT_HISTORICO: string | null;
  NR_GRUPO_PLANEJ: number | null;
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
  nr_grupo_planej: number | null;
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
    console.log('[Sync Status OS] Iniciando reconciliação de status de Ordens de Serviço...');

    // 1. Consultar webhook do n8n (novo webhook para verificar status)
    console.log(`[Sync Status OS] Chamando webhook n8n: ${N8N_WEBHOOK_URL}`);
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
    console.log(`[Sync Status OS] Resposta do webhook recebida. Comprimento do corpo: ${responseText.length} bytes.`);

    if (!responseText || responseText.trim() === '') {
      console.log('[Sync Status OS] Webhook do n8n retornou resposta vazia.');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Webhook do n8n retornou resposta vazia. Nenhuma OS atualizada.',
          updated: 0
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

    console.log(`[Sync Status OS] Webhook analisado com sucesso. Dados obtidos: ${Array.isArray(rawData) ? rawData.length : 0} registros.`);

    if (!Array.isArray(rawData)) {
      throw new Error('A resposta do n8n não retornou um array válido de ordens de serviço.');
    }

    // 2. Inicializar o cliente do Supabase
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Variáveis de ambiente do Supabase (URL/SERVICE_ROLE_KEY) não estão configuradas.');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 3. Buscar apenas as OS ativas (não encerradas/finalizadas) atualmente cadastradas no banco de dados do Supabase
    console.log('[Sync Status OS] Buscando OS ativas no banco de dados...');
    const { data: existingOS, error: queryError } = await supabase
      .from('ordem_servico')
      .select('nr_sequencia, dt_atualizacao, ds_situacao, ds_estagio, nm_usuario_encer')
      .or('ds_situacao.is.null,and(ds_situacao.not.ilike.%finalizada%,ds_situacao.not.ilike.%finalizado%,ds_situacao.not.ilike.%encerrada%,ds_situacao.not.ilike.%concluída%,ds_situacao.not.ilike.%concluido%)');

    if (queryError) {
      throw new Error(`Erro ao buscar OS existentes do banco: ${queryError.message}`);
    }

    const existingMap = new Map<number, {
      dt_atualizacao: string | null;
      ds_situacao: string | null;
      ds_estagio: string | null;
      nm_usuario_encer: string | null;
    }>();

    if (existingOS) {
      for (const os of existingOS) {
        existingMap.set(os.nr_sequencia, {
          dt_atualizacao: os.dt_atualizacao,
          ds_situacao: os.ds_situacao,
          ds_estagio: os.ds_estagio,
          nm_usuario_encer: os.nm_usuario_encer
        });
      }
    }

    console.log(`[Sync Status OS] Total de OS cadastradas no Supabase: ${existingMap.size}`);

    // 4. Mapear e Filtrar apenas as OS que já existem no banco do Supabase e que sofreram alterações
    const recordsToUpdate: DBOrdemServico[] = [];
    const rawDataToUpdate: N8NOrdemServico[] = []; // Guardar rawData para processamento do histórico
    const deletedSequences = new Set<number>();

    for (const item of rawData) {
      if (item.NR_SEQUENCIA === undefined || item.NR_SEQUENCIA === null) {
        continue;
      }

      const nrSeq = Number(item.NR_SEQUENCIA);

      // Validar o grupo de planejamento (apenas grupo 22 - TI)
      const nrGrupoPlanej = item.NR_GRUPO_PLANEJ !== undefined && item.NR_GRUPO_PLANEJ !== null ? Number(item.NR_GRUPO_PLANEJ) : null;
      
      // Validar se o grupo de destino pertence à Manutenção (fallback secundário)
      const dsGrupo = item.DS_GRUPO_DES ? String(item.DS_GRUPO_DES).trim() : '';
      const isManutencao = dsGrupo.toLowerCase().includes('manuten');

      // Se a OS não for do grupo de planejamento 22 (TI) ou for identificada como manutenção, remove do banco
      if ((nrGrupoPlanej !== null && nrGrupoPlanej !== 22) || isManutencao) {
        const existing = existingMap.get(nrSeq);
        if (existing) {
          console.log(`[Sync Status OS] OS #${nrSeq} fora do grupo de TI (Grupo Planejamento: ${nrGrupoPlanej}). Executando DELETE...`);
          const { error: deleteError } = await supabase
            .from('ordem_servico')
            .delete()
            .eq('nr_sequencia', nrSeq);
          if (deleteError) {
            console.error(`[Sync Status OS] Erro ao deletar OS ${nrSeq}:`, deleteError.message);
          } else {
            deletedSequences.add(nrSeq);
          }
        }
        continue; // Ignora upsert
      }

      const existing = existingMap.get(nrSeq);
      if (!existing) {
        continue; // Ignora se não existir no banco (criação é responsabilidade de sync-ordem-servico)
      }

      // Validação de Alterações
      const newDtAtualizacao = item.DT_ATUALIZACAO ? new Date(item.DT_ATUALIZACAO).toISOString() : null;
      const newDsSituacao = item.DS_SITUACAO ? String(item.DS_SITUACAO).trim() : null;
      const newDsEstagio = item.DS_ESTAGIO ? String(item.DS_ESTAGIO).trim() : null;
      const newNmUsuarioEncer = item.NM_USUARIO_ENCER ? String(item.NM_USUARIO_ENCER).trim() : null;

      // Comparar datas (seguro contra fusos e nulos)
      let datesDiffer = false;
      if (newDtAtualizacao && existing.dt_atualizacao) {
        datesDiffer = new Date(newDtAtualizacao).getTime() !== new Date(existing.dt_atualizacao).getTime();
      } else if (newDtAtualizacao !== existing.dt_atualizacao) {
        datesDiffer = true;
      }

      const statusDiffer = datesDiffer ||
        existing.ds_situacao !== newDsSituacao ||
        existing.ds_estagio !== newDsEstagio ||
        existing.nm_usuario_encer !== newNmUsuarioEncer;

      let shouldUpsert = false;
      if (statusDiffer) {
        shouldUpsert = true;
      }

      // Só atualiza ou insere se houver alteração ou for nova
      if (shouldUpsert) {
        const mappedRecord: DBOrdemServico = {
          nr_sequencia: nrSeq,
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
          dt_atualizacao: newDtAtualizacao,
          minutos_atualiza: item.MINUTOS_ATUALIZA ? Number(item.MINUTOS_ATUALIZA) : null,
          ds_estagio: newDsEstagio,
          ie_status_ordem: item.IE_STATUS_ORDEM ? String(item.IE_STATUS_ORDEM).trim() : null,
          ie_prioridade: item.IE_PRIORIDADE ? String(item.IE_PRIORIDADE).trim() : null,
          ds_prioridade: item.DS_PRIORIDADE ? String(item.DS_PRIORIDADE).trim() : null,
          ie_parado: item.IE_PARADO ? String(item.IE_PARADO).trim() : null,
          ds_dano_breve: item.DS_DANO_BREVE ? cleanHTML(item.DS_DANO_BREVE) : null,
          ds_dano: item.DS_DANO ? cleanHTML(item.DS_DANO) : null,
          nr_seq_estagio: item.NR_SEQ_ESTAGIO ? Number(item.NR_SEQ_ESTAGIO) : null,
          ds_situacao: newDsSituacao,
          ds_solucao: item.DS_SOLUCAO ? cleanHTML(item.DS_SOLUCAO) : null,
          ds_relat_tecnico: (item.HISTORICO || item.DS_RELAT_TECNICO) ? cleanHTML(item.HISTORICO || item.DS_RELAT_TECNICO) : null,
          nr_grupo_planej: nrGrupoPlanej,
        };

        recordsToUpdate.push(mappedRecord);
        rawDataToUpdate.push(item);
      }
    }

    console.log(`[Sync Status OS] Total de OS identificadas com alteração de status: ${recordsToUpdate.length}`);

    if (recordsToUpdate.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Todas as Ordens de Serviço cadastradas estão com status atualizado.',
          updated: 0,
          deleted: deletedSequences.size
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // 5. Executar UPSERT com base em nr_sequencia na tabela public.ordem_servico
    const { error: upsertError } = await supabase
      .from('ordem_servico')
      .upsert(recordsToUpdate, { onConflict: 'nr_sequencia' });

    if (upsertError) {
      throw new Error(`Erro ao realizar o UPSERT no Supabase (ordem_servico): ${upsertError.message}`);
    }

    // 6. Salvar histórico de relatos técnicos sem duplicar para as OS atualizadas
    console.log('[Sync Status OS] Processando histórico de relatos técnicos para OS alteradas...');
    const nrSequenciasAtualizadas = recordsToUpdate.map(r => r.nr_sequencia);

    const { data: existingRelatos, error: relatoQueryError } = await supabase
      .from('historico_ordem_servico')
      .select('nr_sequencia, ds_relat_tecnico, dt_historico, created_at')
      .in('nr_sequencia', nrSequenciasAtualizadas)
      .order('dt_historico', { ascending: false })
      .order('created_at', { ascending: false });

    if (relatoQueryError) {
      console.error('[Sync Status OS] Erro ao consultar historico_ordem_servico:', relatoQueryError.message);
    } else {
      const latestRelatoMap = new Map<number, { text: string; date: string | null }>();
      if (existingRelatos && existingRelatos.length > 0) {
        for (const r of existingRelatos) {
          if (!latestRelatoMap.has(r.nr_sequencia)) {
            latestRelatoMap.set(r.nr_sequencia, {
              text: (r.ds_relat_tecnico || '').trim(),
              date: r.dt_historico ? new Date(r.dt_historico).toISOString() : null
            });
          }
        }
      }

      const relatosToInsert: Array<{
        nr_sequencia: number;
        ds_relat_tecnico: string;
        dt_historico: string | null;
        nm_usuario: string | null;
      }> = [];

      for (const item of rawDataToUpdate) {
        const nrSeq = Number(item.NR_SEQUENCIA);
        const novoRelato = item.HISTORICO ? cleanHTML(item.HISTORICO) : '';
        const novaDataStr = item.DT_HISTORICO ? new Date(item.DT_HISTORICO).toISOString() : null;

        if (novoRelato !== '') {
          const ultimoGravado = latestRelatoMap.get(nrSeq);
          
          let isDifferent = true;
          if (ultimoGravado) {
            if (novaDataStr && ultimoGravado.date) {
              isDifferent = new Date(novaDataStr).getTime() !== new Date(ultimoGravado.date).getTime();
            } else {
              isDifferent = novoRelato !== ultimoGravado.text;
            }
          }

          if (isDifferent) {
            relatosToInsert.push({
              nr_sequencia: nrSeq,
              ds_relat_tecnico: novoRelato,
              dt_historico: novaDataStr,
              nm_usuario: item.NM_USUARIO ? String(item.NM_USUARIO).trim() : null
            });
            latestRelatoMap.set(nrSeq, {
              text: novoRelato,
              date: novaDataStr
            });
          }
        }
      }

      if (relatosToInsert.length > 0) {
        console.log(`[Sync Status OS] Inserindo ${relatosToInsert.length} novos relatos técnicos no histórico...`);
        const { error: insertRelatoError } = await supabase
          .from('historico_ordem_servico')
          .insert(relatosToInsert);

        if (insertRelatoError) {
          console.error('[Sync Status OS] Erro ao inserir relatos na tabela historico_ordem_servico:', insertRelatoError.message);
        }
      }
    }

    console.log(`[Sync Status OS] Reconciliação concluída com sucesso! ${recordsToUpdate.length} OS atualizadas.`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Reconciliação e atualização de status de OS concluída com sucesso.',
        updated: recordsToUpdate.length
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error: any) {
    console.error('[Sync Status OS] Falha no fluxo:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro desconhecido na sincronização de status de ordens de serviço.'
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
