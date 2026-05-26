import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const N8N_WEBHOOK_URL = 'https://n8n-n8n.7woir1.easypanel.host/webhook/consulta_cirurgias';

// Interface representando a estrutura que vem do n8n
interface N8NCirurgia {
  NR_ATENDIMENTO: number | null;
  NM_PACIENTE: string | null;
  DS_SEXO: string | null;
  IDADE: number | null;
  NR_CIRURGIA: number; // Identificador único / Chave de Negócio
  MEDICO: string | null;
  PROCEDIMENTO: string | null;
  DT_AGENDA: string | null;
  NM_ANESTESISTA: string | null;
  DS_CARATER: string | null;
  SALA: string | null;
}

// Interface representando a estrutura do banco Supabase (tabela cirurgias)
interface DBCirurgia {
  nr_atendimento: number | null;
  nm_paciente: string | null;
  ds_sexo: string | null;
  idade: number | null;
  nr_cirurgia: number;
  medico: string | null;
  procedimento: string | null;
  dt_agenda: string | null;
  nm_anestesista: string | null;
  ds_carater: string | null;
  sala: string | null;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

Deno.serve(async (req: Request) => {
  // Trata requisição OPTIONS para CORS pre-flight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders,
    });
  }

  try {
    console.log('[Sync Cirurgias] Iniciando processo de sincronização...');

    // 1. Fazer requisição ao webhook do n8n
    console.log(`[Sync Cirurgias] Consultando webhook n8n: ${N8N_WEBHOOK_URL}`);
    const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!n8nResponse.ok) {
      throw new Error(`Erro ao consultar o n8n: HTTP ${n8nResponse.status} - ${n8nResponse.statusText}`);
    }

    const rawData = await n8nResponse.json();
    console.log(`[Sync Cirurgias] Webhook retornado com sucesso. Dados obtidos: ${Array.isArray(rawData) ? rawData.length : 0} registros.`);

    if (!Array.isArray(rawData)) {
      throw new Error('A resposta do n8n não retornou um array válido de cirurgias.');
    }

    // 2. Mapear os dados para o padrão de colunas do banco
    const recordsToInsert: DBCirurgia[] = rawData
      .filter((item: any) => item.NR_CIRURGIA !== undefined && item.NR_CIRURGIA !== null)
      .map((item: N8NCirurgia) => {
        return {
          nr_atendimento: item.NR_ATENDIMENTO ? Number(item.NR_ATENDIMENTO) : null,
          nm_paciente: item.NM_PACIENTE ? item.NM_PACIENTE.trim() : null,
          ds_sexo: item.DS_SEXO ? item.DS_SEXO.trim() : null,
          idade: item.IDADE ? Number(item.IDADE) : null,
          nr_cirurgia: Number(item.NR_CIRURGIA),
          medico: item.MEDICO ? item.MEDICO.trim() : null,
          procedimento: item.PROCEDIMENTO ? item.PROCEDIMENTO.trim() : null,
          dt_agenda: item.DT_AGENDA ? new Date(item.DT_AGENDA).toISOString() : null,
          nm_anestesista: item.NM_ANESTESISTA ? item.NM_ANESTESISTA.trim() : null,
          ds_carater: item.DS_CARATER ? item.DS_CARATER.trim() : null,
          sala: item.SALA ? item.SALA.trim() : null,
        };
      });

    console.log(`[Sync Cirurgias] Mapeamento concluído. ${recordsToInsert.length} registros prontos para upsert.`);

    if (recordsToInsert.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Nenhuma cirurgia válida encontrada para sincronizar.',
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

    // 4. Executar UPSERT com base em nr_cirurgia
    const { error: upsertError } = await supabase
      .from('cirurgias')
      .upsert(recordsToInsert, { onConflict: 'nr_cirurgia' });

    if (upsertError) {
      throw new Error(`Erro ao realizar o UPSERT no Supabase: ${upsertError.message}`);
    }

    console.log(`[Sync Cirurgias] Sincronização realizada com sucesso! ${recordsToInsert.length} registros inseridos/atualizados.`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Sincronização de cirurgias concluída com sucesso.',
        upserted: recordsToInsert.length
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error: any) {
    console.error('[Sync Cirurgias] Falha no fluxo:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro desconhecido na sincronização de cirurgias.'
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
