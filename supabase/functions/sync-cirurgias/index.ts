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
  EVENTO: string | null;
  DT_REGISTRO: string | null;
  CIRCULANTE: string | null;
  ENFERMEIRO: string | null;
  SETOR_ORIGEM: string | null;
  PRECAUCAO: string | null;
  ALERGIA: string | null;
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
  evento: string | null;
  dt_registro: string | null;
  circulante: string | null;
  enfermeiro: string | null;
  setor_origem: string | null;
  precaucao: string | null;
  alergia: string | null;
}

interface DBHistoricoEvento {
  nr_cirurgia: number;
  evento: string;
  dt_registro: string;
  dt_evento: string;
}

function mergeUniqueItems(existingStr: string | null, newStr: string | null): string | null {
  const items = new Set<string>();
  
  const processStr = (str: string | null) => {
    if (!str) return;
    str.split(/[,;]+/).forEach(val => {
      const trimmed = val.trim();
      if (trimmed && trimmed.toLowerCase() !== 'null' && trimmed.toLowerCase() !== 'undefined') {
        items.add(trimmed);
      }
    });
  };

  processStr(existingStr);
  processStr(newStr);

  return items.size > 0 ? Array.from(items).join(', ') : null;
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

    const responseText = await n8nResponse.text();
    console.log(`[Sync Cirurgias] Resposta do webhook recebida. Comprimento do corpo: ${responseText.length} bytes.`);

    if (!responseText || responseText.trim() === '') {
      console.log('[Sync Cirurgias] Webhook do n8n retornou resposta vazia. Sincronização ignorada.');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Webhook do n8n retornou resposta vazia. Nenhuma cirurgia sincronizada.',
          upserted: 0,
          historico_upserted: 0
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

    console.log(`[Sync Cirurgias] Webhook analisado com sucesso. Dados obtidos: ${Array.isArray(rawData) ? rawData.length : 0} registros.`);

    if (!Array.isArray(rawData)) {
      throw new Error('A resposta do n8n não retornou um array válido de cirurgias.');
    }

    // 2. Mapear e de-duplicar os dados para manter apenas o evento mais recente por nr_cirurgia
    const uniqueRecordsMap = new Map<number, DBCirurgia>();
    const uniqueHistoricoMap = new Map<string, DBHistoricoEvento>();

    for (const item of rawData) {
      if (item.NR_CIRURGIA === undefined || item.NR_CIRURGIA === null) {
        continue;
      }

      const nrCirurgia = Number(item.NR_CIRURGIA);
      const mappedRecord: DBCirurgia = {
        nr_atendimento: item.NR_ATENDIMENTO ? Number(item.NR_ATENDIMENTO) : null,
        nm_paciente: item.NM_PACIENTE ? item.NM_PACIENTE.trim() : null,
        ds_sexo: item.DS_SEXO ? item.DS_SEXO.trim() : null,
        idade: item.IDADE ? Number(item.IDADE) : null,
        nr_cirurgia: nrCirurgia,
        medico: item.MEDICO ? item.MEDICO.trim() : null,
        procedimento: item.PROCEDIMENTO ? item.PROCEDIMENTO.trim() : null,
        dt_agenda: item.DT_AGENDA ? new Date(item.DT_AGENDA).toISOString() : null,
        nm_anestesista: item.NM_ANESTESISTA ? item.NM_ANESTESISTA.trim() : null,
        ds_carater: item.DS_CARATER ? item.DS_CARATER.trim() : null,
        sala: item.SALA ? item.SALA.trim() : null,
        evento: item.EVENTO ? item.EVENTO.trim() : null,
        dt_registro: item.DT_REGISTRO ? new Date(item.DT_REGISTRO).toISOString() : null,
        circulante: item.CIRCULANTE ? item.CIRCULANTE.trim() : null,
        enfermeiro: item.ENFERMEIRO ? item.ENFERMEIRO.trim() : null,
        setor_origem: item.SETOR_ORIGEM ? item.SETOR_ORIGEM.trim() : null,
        precaucao: item.PRECAUCAO ? item.PRECAUCAO.trim() : null,
        alergia: item.ALERGIA ? item.ALERGIA.trim() : null,
      };

      const existing = uniqueRecordsMap.get(nrCirurgia);
      if (!existing) {
        uniqueRecordsMap.set(nrCirurgia, mappedRecord);
      } else {
        // Acumula as alergias e precauções de ambos os registros para não perder dados de múltiplos eventos
        const mergedAlergia = mergeUniqueItems(existing.alergia, mappedRecord.alergia);
        const mergedPrecaucao = mergeUniqueItems(existing.precaucao, mappedRecord.precaucao);

        const existingTime = existing.dt_registro ? new Date(existing.dt_registro).getTime() : 0;
        const newTime = mappedRecord.dt_registro ? new Date(mappedRecord.dt_registro).getTime() : 0;

        if (newTime >= existingTime) {
          mappedRecord.alergia = mergedAlergia;
          mappedRecord.precaucao = mergedPrecaucao;
          uniqueRecordsMap.set(nrCirurgia, mappedRecord);
        } else {
          existing.alergia = mergedAlergia;
          existing.precaucao = mergedPrecaucao;
          uniqueRecordsMap.set(nrCirurgia, existing);
        }
      }

      // Mapeamento para o histórico de eventos
      if (item.EVENTO) {
        const eventoStr = item.EVENTO.trim();
        const dtStr = item.DT_REGISTRO ? new Date(item.DT_REGISTRO).toISOString() : new Date().toISOString();
        const histKey = `${nrCirurgia}_${eventoStr}`;

        const mappedHist: DBHistoricoEvento = {
          nr_cirurgia: nrCirurgia,
          evento: eventoStr,
          dt_registro: dtStr,
          dt_evento: dtStr
        };

        const existingHist = uniqueHistoricoMap.get(histKey);
        if (!existingHist) {
          uniqueHistoricoMap.set(histKey, mappedHist);
        } else {
          const existingTime = new Date(existingHist.dt_registro).getTime();
          const newTime = new Date(dtStr).getTime();
          if (newTime >= existingTime) {
            uniqueHistoricoMap.set(histKey, mappedHist);
          }
        }
      }
    }

    const recordsToInsert = Array.from(uniqueRecordsMap.values());
    const historicoRecords = Array.from(uniqueHistoricoMap.values());

    console.log(`[Sync Cirurgias] Mapeamento concluído. ${recordsToInsert.length} cirurgias prontas e ${historicoRecords.length} eventos históricos.`);

    if (recordsToInsert.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Nenhuma cirurgia válida encontrada para sincronizar.',
          upserted: 0,
          historico_upserted: 0
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // 3. Inicializar o cliente do Supabase
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Variáveis de ambiente do Supabase (URL/SERVICE_ROLE_KEY) não estão configuradas.');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Mesclar alergias e precauções com os dados que já existem no banco de dados para evitar perda de histórico
    const nrCirurgiasList = recordsToInsert.map(r => r.nr_cirurgia);
    if (nrCirurgiasList.length > 0) {
      console.log(`[Sync Cirurgias] Buscando registros atuais do banco de dados para mesclagem clínica...`);
      const { data: dbRecords, error: dbSelectError } = await supabase
        .from('cirurgias')
        .select('nr_cirurgia, alergia, precaucao')
        .in('nr_cirurgia', nrCirurgiasList);

      if (dbSelectError) {
        console.error('[Sync Cirurgias] Erro ao buscar registros prévios do banco para mesclar:', dbSelectError.message);
      } else if (dbRecords) {
        const dbRecordsMap = new Map(dbRecords.map(r => [r.nr_cirurgia, r as any]));
        for (const record of recordsToInsert) {
          const dbRec = dbRecordsMap.get(record.nr_cirurgia) as any;
          if (dbRec) {
            record.alergia = mergeUniqueItems(dbRec.alergia, record.alergia);
            record.precaucao = mergeUniqueItems(dbRec.precaucao, record.precaucao);
          }
        }
      }
    }

    // 4. Executar UPSERT com base em nr_cirurgia na tabela principal
    const { error: upsertError } = await supabase
      .from('cirurgias')
      .upsert(recordsToInsert, { onConflict: 'nr_cirurgia' });

    if (upsertError) {
      throw new Error(`Erro ao realizar o UPSERT no Supabase (cirurgias): ${upsertError.message}`);
    }

    // 5. Executar UPSERT dos eventos no histórico
    if (historicoRecords.length > 0) {
      console.log(`[Sync Cirurgias] Executando UPSERT de ${historicoRecords.length} eventos de histórico...`);
      const { error: histError } = await supabase
        .from('historico_eventos_cirurgia')
        .upsert(historicoRecords, { onConflict: 'nr_cirurgia,evento' });

      if (histError) {
        throw new Error(`Erro ao realizar o UPSERT no Supabase (historico_eventos_cirurgia): ${histError.message}`);
      }
    }

    console.log(`[Sync Cirurgias] Sincronização realizada com sucesso! ${recordsToInsert.length} registros e ${historicoRecords.length} históricos atualizados.`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Sincronização de cirurgias concluída com sucesso.',
        upserted: recordsToInsert.length,
        historico_upserted: historicoRecords.length
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
