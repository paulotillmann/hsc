import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const N8N_WEBHOOK_URL = 'https://n8n-n8n.7woir1.easypanel.host/webhook/consulta_paciente_pa';

interface N8NPacientePA {
  NR_ATENDIMENTO: number;
  NM_PACIENTE: string;
  DT_ENTRADA: string | null;
  DT_ALTA: string | null;
  DS_CLINICA: string | null;
  HR_INICIO_CONSULTA?: string | null;
  hr_inicio_consulta?: string | null;
  DT_LIB_MEDICO: string | null;
  IE_STATUS: string | null;
  STATUS: string | null;
  DS_TRIAGEM: string | null;
  IE_INTERNADO: string | null;
}

interface DBPacientePA {
  nr_atendimento: number;
  nm_paciente: string;
  dt_entrada: string | null;
  dt_alta: string | null;
  ds_clinica: string | null;
  hr_inicio_consulta: string | null;
  dt_lib_medico: string | null;
  ie_status: string | null;
  status: string | null;
  ds_triagem: string | null;
  ie_internado: string | null;
}

const parseDate = (dateStr: string | null): string | null => {
  if (!dateStr || dateStr.toLowerCase() === 'null' || dateStr.toLowerCase() === 'undefined') return null;
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d.toISOString();
  } catch {
    return null;
  }
};

const parseConsultaDate = (horaConsulta: string | null, dtEntrada: string | null): string | null => {
  if (!horaConsulta || horaConsulta.toLowerCase() === 'null' || horaConsulta.toLowerCase() === 'undefined') return null;
  
  const val = horaConsulta.trim();
  
  // Se já for uma data completa (contém T ou -), faz o parse normal
  if (val.includes('T') || val.includes('-')) {
    return parseDate(val);
  }
  
  // Se for apenas hora (ex: "11:23" ou "11:23:00") e tivermos a data de entrada
  if (dtEntrada && dtEntrada.length >= 10) {
    const dataPart = dtEntrada.substring(0, 10); // "YYYY-MM-DD"
    const horaPart = val.length === 5 ? `${val}:00` : val; // garante "HH:MM:SS"
    
    // Monta a string ISO
    const isoString = `${dataPart}T${horaPart}.000Z`;
    return parseDate(isoString);
  }
  
  return parseDate(val);
};


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
    console.log('[Sync Pacientes PA] Iniciando processo de sincronização...');

    // 1. Fazer requisição ao webhook do n8n
    console.log(`[Sync Pacientes PA] Consultando webhook n8n: ${N8N_WEBHOOK_URL}`);
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
    console.log(`[Sync Pacientes PA] Resposta do webhook recebida. Comprimento do corpo: ${responseText.length} bytes.`);

    if (!responseText || responseText.trim() === '') {
      console.log('[Sync Pacientes PA] Webhook do n8n retornou resposta vazia. Sincronização ignorada.');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Webhook do n8n retornou resposta vazia. Nenhum paciente sincronizado.',
          upserted: 0
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    let rawData: N8NPacientePA[];
    try {
      rawData = JSON.parse(responseText);
    } catch (e) {
      throw new Error(`A resposta do n8n não é um JSON válido: ${responseText.substring(0, 200)}`);
    }

    console.log(`[Sync Pacientes PA] Webhook analisado com sucesso. Dados obtidos: ${Array.isArray(rawData) ? rawData.length : 0} registros.`);

    if (!Array.isArray(rawData)) {
      throw new Error('A resposta do n8n não retornou um array válido de pacientes.');
    }

    // 2. Mapear os dados para o formato do banco de dados
    const recordsToInsert: DBPacientePA[] = [];

    for (const item of rawData) {
      if (item.NR_ATENDIMENTO === undefined || item.NR_ATENDIMENTO === null) {
        continue;
      }

      const mappedRecord: DBPacientePA = {
        nr_atendimento: Number(item.NR_ATENDIMENTO),
        nm_paciente: item.NM_PACIENTE ? item.NM_PACIENTE.trim() : 'NOME NÃO INFORMADO',
        dt_entrada: parseDate(item.DT_ENTRADA),
        dt_alta: parseDate(item.DT_ALTA),
        ds_clinica: item.DS_CLINICA ? item.DS_CLINICA.trim() : null,
        hr_inicio_consulta: parseConsultaDate(item.HR_INICIO_CONSULTA || item.hr_inicio_consulta || null, item.DT_ENTRADA),
        dt_lib_medico: parseDate(item.DT_LIB_MEDICO),
        ie_status: item.IE_STATUS ? item.IE_STATUS.trim() : null,
        status: item.STATUS ? item.STATUS.trim() : null,
        ds_triagem: item.DS_TRIAGEM ? item.DS_TRIAGEM.trim() : null,
        ie_internado: (item.IE_INTERNADO?.trim() === 'S' || item.STATUS?.trim() === 'Internado' || item.IE_STATUS?.trim() === 'IN') ? 'S' : 'N',
      };

      recordsToInsert.push(mappedRecord);
    }

    console.log(`[Sync Pacientes PA] Mapeamento concluído. ${recordsToInsert.length} pacientes prontos.`);

    if (recordsToInsert.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Nenhum paciente válido encontrado para sincronizar.',
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

    // 4. Limpar do banco os registros que não estão mais presentes no payload (pacientes que tiveram alta ou mudaram de setor)
    const currentNrAtendimentos = recordsToInsert.map(r => r.nr_atendimento);
    console.log(`[Sync Pacientes PA] Removendo pacientes antigos do banco que não estão no payload...`);
    const { error: deleteError } = await supabase
      .from('pacientes_pronto_atendimento')
      .delete()
      .not('nr_atendimento', 'in', `(${currentNrAtendimentos.join(',')})`);

    if (deleteError) {
      console.error(`[Sync Pacientes PA] Aviso: erro ao limpar registros antigos:`, deleteError.message);
    } else {
      console.log(`[Sync Pacientes PA] Limpeza de registros antigos concluída.`);
    }

    // 5. Executar UPSERT com base em nr_atendimento
    const { error: upsertError } = await supabase
      .from('pacientes_pronto_atendimento')
      .upsert(recordsToInsert, { onConflict: 'nr_atendimento' });

    if (upsertError) {
      throw new Error(`Erro ao realizar o UPSERT no Supabase (pacientes_pronto_atendimento): ${upsertError.message}`);
    }

    console.log(`[Sync Pacientes PA] Sincronização realizada com sucesso! ${recordsToInsert.length} registros atualizados.`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Sincronização de pacientes do PA concluída com sucesso.',
        upserted: recordsToInsert.length
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error: any) {
    console.error('[Sync Pacientes PA] Falha no fluxo:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro desconhecido na sincronização de pacientes do PA.'
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
