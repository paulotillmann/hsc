import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

// ── 1. VALIDAÇÃO DO EVENTO ────────────────────────────────────────────────────
function validateWebhookEvent(body: any): { isValid: boolean; solicitacaoId?: string; error?: string } {
  if (!body) {
    return { isValid: false, error: 'Corpo da requisição está vazio.' };
  }

  const { type, table, record } = body;

  // Aceita "INSERT" nas tabelas correspondentes a solicitações de prontuário
  if (type !== 'INSERT') {
    return { isValid: false, error: `Evento ignorado. Tipo de evento recebido: ${type}. Apenas INSERT é processado.` };
  }

  if (table !== 'solicitacoes_prontuario' && table !== 'solicitacoes') {
    return { isValid: false, error: `Tabela ignorada: ${table}. Apenas solicitacoes_prontuario é processada.` };
  }

  if (!record || !record.id) {
    return { isValid: false, error: 'Registro inválido ou ID da solicitação ausente.' };
  }

  return { isValid: true, solicitacaoId: record.id };
}

// ── 2. PREVENÇÃO DE DUPLICIDADE (IDEMPOTÊNCIA NO BANCO) ───────────────────────
async function checkAndRegisterDelivery(
  supabaseClient: any,
  solicitacaoId: string
): Promise<{ success: boolean; alreadyExists?: boolean; error?: string }> {
  try {
    // Insere o registro na tabela de idempotência com status inicial 'enviando'
    const { error } = await supabaseClient
      .from('whatsapp_notification_logs')
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

// ── 3. MONTAGEM DA MENSAGEM ───────────────────────────────────────────────────
function buildWhatsAppMessage(): string {
  return `📋 *Nova Solicitação de Prontuário*

Uma nova solicitação foi registrada.

Acesse o sistema para realizar a análise da solicitação.`;
}

// ── 4. ENVIO PARA A EVOLUTION API ─────────────────────────────────────────────
async function sendWhatsAppMessage(
  apiUrl: string,
  apiKey: string,
  instance: string,
  recipient: string,
  text: string
): Promise<{ success: boolean; error?: string }> {
  // Limpa a URL removendo barras extras no final
  const cleanUrl = apiUrl.replace(/\/+$/, '');
  const url = `${cleanUrl}/message/sendText/${encodeURIComponent(instance)}`;

  const payload = {
    number: recipient,
    text: text
  };

  console.log(`[WhatsApp Function] Enviando POST para: ${url}`);

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
    console.log('[WhatsApp Function] Payload do webhook recebido:', JSON.stringify(body));

    // 3. Validar evento
    const validation = validateWebhookEvent(body);
    if (!validation.isValid) {
      console.log(`[WhatsApp Function] Webhook ignorado: ${validation.error}`);
      return new Response(
        JSON.stringify({ success: true, message: validation.error }),
        { status: 200, headers: corsHeaders }
      );
    }

    const solicitacaoId = validation.solicitacaoId!;
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 4. Verificar duplicidade e registrar envio inicial
    const idempotency = await checkAndRegisterDelivery(supabaseClient, solicitacaoId);
    if (!idempotency.success) {
      if (idempotency.alreadyExists) {
        console.log(`[WhatsApp Function] Notificação já enviada para a solicitação ${solicitacaoId}. Ignorando envio duplicado.`);
        return new Response(
          JSON.stringify({ success: true, message: 'Notificação de WhatsApp já enviada anteriormente (evitado duplicado).' }),
          { status: 200, headers: corsHeaders }
        );
      }
      throw new Error(`Falha no controle de idempotência: ${idempotency.error}`);
    }

    // 5. Montar mensagem
    const messageText = buildWhatsAppMessage();

    // 6. Enviar via Evolution API
    const delivery = await sendWhatsAppMessage(
      EVOLUTION_API_URL,
      EVOLUTION_API_KEY,
      SENDER_INSTANCE,
      RECIPIENT_NUMBER,
      messageText
    );

    if (!delivery.success) {
      // Se falhou o envio do WhatsApp, removemos o log de idempotência
      // para permitir que retries automáticos ou novas tentativas possam enviar novamente.
      await supabaseClient
        .from('whatsapp_notification_logs')
        .delete()
        .eq('solicitacao_id', solicitacaoId);

      throw new Error(`Erro no envio da mensagem via Evolution API: ${delivery.error}`);
    }

    // 7. Atualizar status de idempotência para sucesso
    const { error: updateError } = await supabaseClient
      .from('whatsapp_notification_logs')
      .update({ status: 'sucesso' })
      .eq('solicitacao_id', solicitacaoId);

    if (updateError) {
      console.error('[WhatsApp Function] Erro ao atualizar status de idempotência para sucesso:', updateError.message);
    }

    console.log(`[WhatsApp Function] Mensagem de WhatsApp enviada com sucesso para a solicitação ${solicitacaoId}`);
    return new Response(
      JSON.stringify({ success: true, message: 'Mensagem enviada com sucesso!' }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error: any) {
    console.error('[WhatsApp Function] Falha na execução:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Erro desconhecido na execução.' }),
      { status: 500, headers: corsHeaders }
    );
  }
});
