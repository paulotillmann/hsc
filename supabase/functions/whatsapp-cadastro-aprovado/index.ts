import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

// ── 1. VALIDAÇÃO DO EVENTO ────────────────────────────────────────────────────
function validateWebhookEvent(body: any): { isValid: boolean; record?: any; error?: string } {
  if (!body) {
    return { isValid: false, error: 'Corpo da requisição está vazio.' };
  }

  const { type, table, record, old_record } = body;

  // Aceita apenas "UPDATE" nas solicitações de cadastro
  if (type !== 'UPDATE') {
    return { isValid: false, error: `Evento ignorado. Tipo de evento recebido: ${type}. Apenas UPDATE é processado.` };
  }

  if (table !== 'solicitacoes_cadastro') {
    return { isValid: false, error: `Tabela ignorada: ${table}. Apenas solicitacoes_cadastro é processada.` };
  }

  if (!record || !record.id) {
    return { isValid: false, error: 'Registro inválido ou ID da solicitação ausente.' };
  }

  // Verifica se o status mudou para Aprovado
  const oldStatus = old_record?.status;
  const newStatus = record.status;

  if (newStatus !== 'Aprovado') {
    return { isValid: false, error: `Evento ignorado. Novo status é ${newStatus}, esperado Aprovado.` };
  }

  if (oldStatus === 'Aprovado') {
    return { isValid: false, error: 'Evento ignorado. O status já era Aprovado.' };
  }

  return { isValid: true, record };
}

// ── 2. PREVENÇÃO DE DUPLICIDADE (IDEMPOTÊNCIA NO BANCO) ───────────────────────
async function checkAndRegisterDelivery(
  supabaseClient: any,
  solicitacaoId: number
): Promise<{ success: boolean; alreadyExists?: boolean; error?: string }> {
  try {
    // Insere o registro na tabela de idempotência com status inicial 'enviando'
    const { error } = await supabaseClient
      .from('whatsapp_cadastro_notification_logs')
      .insert({
        solicitacao_id: solicitacaoId,
        status: 'enviando',
        created_at: new Date().toISOString()
      });

    if (error) {
      // Código de erro PostgreSQL para violação de constraint UNIQUE: "23505"
      if (error.code === '23505') {
        return { success: false, alreadyExists: true };
      }
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro desconhecido ao registrar idempotência.' };
  }
}

// Helper para formatar a data de YYYY-MM-DD para DD/MM/YYYY
function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return dateStr;
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[3]}/${match[2]}/${match[1]}`;
  }
  return dateStr;
}

// ── 3. MONTAGEM DA MENSAGEM ───────────────────────────────────────────────────
function buildWhatsAppMessage(
  pacienteNome: string,
  pacienteCpf: string,
  pacienteDataNascimento: string,
  pacienteContato: string,
  pacienteEmail: string
): string {
  const formattedDob = formatDate(pacienteDataNascimento) || 'Não informado';
  const contact = pacienteContato || 'Não informado';
  const email = pacienteEmail || 'Não informado';

  return `📋 *Cadastro Realizado com Sucesso*

*Nome Completo:* ${pacienteNome}
*CPF:* ${pacienteCpf}
*Data de Nascimento:* ${formattedDob}
*Nº de Contato:* ${contact}
*E-mail:* ${email}

O cadastro do paciente foi realizado com sucesso no sistema.
Acesse o painel para prosseguir com o atendimento.`;
}

// ── 4. ENVIO PARA A EVOLUTION API ─────────────────────────────────────────────
async function sendWhatsAppMessage(
  apiUrl: string,
  apiKey: string,
  instance: string,
  recipient: string,
  text: string
): Promise<{ success: boolean; error?: string }> {
  const cleanUrl = apiUrl.replace(/\/+$/, '');
  const url = `${cleanUrl}/message/sendText/${encodeURIComponent(instance)}`;

  const payload = {
    number: recipient,
    text: text
  };

  console.log(`[WhatsApp Cadastro] Enviando POST para: ${url}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': apiKey
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    return {
      success: false,
      error: `Evolution API retornou status ${response.status}: ${errorText}`
    };
  }

  return { success: true };
}

// ── FLUXO PRINCIPAL ───────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  // CORS Pre-flight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL') || '';
  const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY') || '';
  
  // Conforme a especificação, remetente (instância) e destinatário fixos:
  const SENDER_INSTANCE = 'HSC TI';
  const RECIPIENT_NUMBER = '5584998444889';

  try {
    // 1. Validar configuração do ambiente
    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      throw new Error('Configuração incompleta: EVOLUTION_API_URL ou EVOLUTION_API_KEY não estão definidas.');
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Configuração incompleta: Variáveis internas do Supabase ausentes.');
    }

    // 2. Parsear corpo da requisição
    const body = await req.json().catch(() => null);
    console.log('[WhatsApp Cadastro] Payload do webhook recebido:', JSON.stringify(body));

    // 3. Validar evento
    const validation = validateWebhookEvent(body);
    if (!validation.isValid) {
      console.log(`[WhatsApp Cadastro] Webhook ignorado: ${validation.error}`);
      return new Response(
        JSON.stringify({ success: true, message: validation.error }),
        { status: 200, headers: corsHeaders }
      );
    }

    const record = validation.record!;
    const solicitacaoId = record.id;
    const pacienteNome = record.paciente_nome || 'Paciente';
    const pacienteCpf = record.paciente_cpf || '';
    const pacienteDataNascimento = record.paciente_data_nascimento || '';
    const pacienteContato = record.paciente_contato || '';
    const pacienteEmail = record.paciente_email || '';

    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 4. Verificar duplicidade e registrar envio inicial
    const idempotency = await checkAndRegisterDelivery(supabaseClient, solicitacaoId);
    if (!idempotency.success) {
      if (idempotency.alreadyExists) {
        console.log(`[WhatsApp Cadastro] Notificação já enviada para o cadastro ${solicitacaoId}. Ignorando envio duplicado.`);
        return new Response(
          JSON.stringify({ success: true, message: 'Notificação de WhatsApp já enviada anteriormente (evitado duplicado).' }),
          { status: 200, headers: corsHeaders }
        );
      }
      throw new Error(`Falha no controle de idempotência: ${idempotency.error}`);
    }

    // 5. Montar mensagem
    const messageText = buildWhatsAppMessage(
      pacienteNome,
      pacienteCpf,
      pacienteDataNascimento,
      pacienteContato,
      pacienteEmail
    );

    // 6. Enviar via Evolution API
    const delivery = await sendWhatsAppMessage(
      EVOLUTION_API_URL,
      EVOLUTION_API_KEY,
      SENDER_INSTANCE,
      RECIPIENT_NUMBER,
      messageText
    );

    if (!delivery.success) {
      // Se falhou o envio, removemos o log de idempotência para retries
      await supabaseClient
        .from('whatsapp_cadastro_notification_logs')
        .delete()
        .eq('solicitacao_id', solicitacaoId);

      throw new Error(`Erro no envio da mensagem via Evolution API: ${delivery.error}`);
    }

    // 7. Atualizar status de idempotência para sucesso
    const { error: updateError } = await supabaseClient
      .from('whatsapp_cadastro_notification_logs')
      .update({ status: 'sucesso' })
      .eq('solicitacao_id', solicitacaoId);

    if (updateError) {
      console.error('[WhatsApp Cadastro] Erro ao atualizar status de idempotência para sucesso:', updateError.message);
    }

    console.log(`[WhatsApp Cadastro] Mensagem de WhatsApp enviada com sucesso para o cadastro ${solicitacaoId}`);
    return new Response(
      JSON.stringify({ success: true, message: 'Mensagem enviada com sucesso!' }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error: any) {
    console.error('[WhatsApp Cadastro] Falha na execução:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Erro desconhecido na execução.' }),
      { status: 500, headers: corsHeaders }
    );
  }
});
