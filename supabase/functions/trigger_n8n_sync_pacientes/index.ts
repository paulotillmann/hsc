import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fazer o pull (POST) no n8n - View ATENDIMENTO_PACIENTE_V
    const n8nUrl = "https://n8n-n8n.7woir1.easypanel.host/webhook/consulta_pacientes";
    console.log("Chamando n8nUrl:", n8nUrl);

    const n8nResponse = await fetch(n8nUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log("n8n status:", n8nResponse.status);

    if (!n8nResponse.ok) {
      const text = await n8nResponse.text();
      console.error("n8n response text:", text);
      throw new Error(`Erro ao comunicar com n8n: ${n8nResponse.status} ${n8nResponse.statusText}. Detalhe: ${text}`);
    }

    const payload = await n8nResponse.json();

    if (!Array.isArray(payload)) {
      console.error("Payload nao e array:", payload);
      throw new Error('O payload retornado pelo n8n nao e um array valido.');
    }

    // Converte datas BR (dd/MM/yyyy HH:mm) para ISO, preservando horario
    // Tambem aceita ISO diretamente (ex: 2026-05-15T10:02:29.000Z)
    const parseDateBR = (dateStr: string | null | undefined) => {
      if (!dateStr) return null;
      if (dateStr.includes('T') || /^\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr;
      const match = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
      if (match) {
        const [, day, month, year, hours, minutes] = match;
        if (hours && minutes) {
          return `${year}-${month}-${day}T${hours}:${minutes}:00-03:00`;
        }
        return `${year}-${month}-${day}`;
      }
      return null;
    };

    const upsertData = payload.map((p: any) => ({
      nr_atendimento: p.NR_ATENDIMENTO ?? p.CD_ATENDIMENTO,
      nome_idade: p["A.NM_PACIENTE||'-'||A.DS_IDADE"] || p.NM_PESSOA_FISICA || p.NM_PACIENTE || p.PACIENTE || null,
      paciente: p.PACIENTE || p.NM_PESSOA_FISICA || p["A.NM_PACIENTE||'-'||A.DS_IDADE"] || null,
      ds_setor_atendimento: p.DS_SETOR_ATENDIMENTO || p.SETOR || p.DS_CLINICA || null,
      leito: p.LEITO || p.CD_UNIDADE || null,
      cd_unidade: p.CD_UNIDADE || p.LEITO || null,
      dt_entrada: parseDateBR(p.DT_ENTRADA),
      cd_cid_principal: p.CD_CID_PRINCIPAL || null,
      dias_internado: p.DIAS_INTERNADO ?? p.QT_DIA_PERMANENCIA ?? null,
      teve_evolucao_hoje: p.TEVE_EVOLUCAO_HOJE || null,
      previsao_alta: parseDateBR(p.PREVISAO_ALTA || p.DT_PREVISTO_ALTA),
      ultima_prescricao: parseDateBR(p.ULTIMA_PRESCRICAO),
      ds_convenio: p.DS_CONVENIO || p.CONVENIO || null,
      dt_nascimento: parseDateBR(p.DT_NASCIMENTO),
      nm_guerra: p.NM_GUERRA || p.MEDICO || null,
      ds_categoria: p.DS_CATEGORIA || p.CATEGORIA || null,
      responsavel: p.RESPONSAVEL || null,
      cpf_responsavel: p.CPF_RESPONSAVEL || null,
      ds_probabilidade: p.DS_PROBABILIDADE || p.PROBABILIDADE_ALTA || null,
      nr_prontuario: p.NR_PRONTUARIO ?? null,
      cd_setor_atendimento: p.CD_SETOR_ATENDIMENTO ?? null,
      ativo: true,
      data_alta: null,
      updated_at: new Date().toISOString()
    })).filter((p: any) => p.nr_atendimento != null);

    const atendimentosIds = upsertData.map((p: any) => p.nr_atendimento);

    if (atendimentosIds.length === 0) {
      console.warn("Nenhum atendimento valido retornado.");
      return new Response(JSON.stringify({ error: "Nenhum atendimento valido retornado pelo n8n." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // 2. Inserir ou atualizar os ativos
    const { error: upsertError } = await supabase
      .from('pacientes_internados')
      .upsert(upsertData, { onConflict: 'nr_atendimento' });

    if (upsertError) {
      console.error("Erro no Upsert:", upsertError);
      throw upsertError;
    }

    // 3. Dar baixa nos pacientes que nao vieram na lista, mas estao ativos
    const idsString = `(${atendimentosIds.join(',')})`;
    const { error: dischargeError } = await supabase
      .from('pacientes_internados')
      .update({ ativo: false, data_alta: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('ativo', true)
      .filter('nr_atendimento', 'not.in', idsString);

    if (dischargeError) {
      console.error("Erro no Discharge:", dischargeError);
      throw dischargeError;
    }

    return new Response(JSON.stringify({
      success: true,
      message: "Sincronizacao com n8n concluida com sucesso.",
      upserted: upsertData.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error("Erro geral na funcao:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  }
});

