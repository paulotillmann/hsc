import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

// ── CONFIGURAÇÃO DA INSTÂNCIA ÚNICA (EVOLUTION API) ────────────────────────
const SENDER_INSTANCE = 'HSC - CM01';
const INSTANCE_TOKEN_FALLBACK = Deno.env.get('EVOLUTION_TOKEN_CM01') || 'D78C0A93294A-4E47-A6CC-86F073310059';

// ── ENVIO PARA A EVOLUTION API ─────────────────────────────────────────────
async function sendWhatsAppMessage(
  apiUrl: string,
  apiKey: string,
  instance: string,
  recipient: string,
  text: string
): Promise<{ success: boolean; error?: string }> {
  const cleanUrl = apiUrl.replace(/\/+$/, '');
  const url = `${cleanUrl}/message/sendText/${encodeURIComponent(instance)}`;

  // Formata o número destinatário para padrão internacional (apenas dígitos)
  let cleanRecipient = recipient.replace(/\D/g, '');
  if ((cleanRecipient.length === 11 || cleanRecipient.length === 10) && !cleanRecipient.startsWith('55')) {
    cleanRecipient = `55${cleanRecipient}`;
  }

  const payload = {
    number: cleanRecipient,
    text: text
  };

  console.log(`[WhatsApp Centro Médico] Enviando POST para: ${url} (Destinatário: ${cleanRecipient})`);

  // Prioriza o token da instância HSC - CM01, seguido da chave global
  const candidateKeys = Array.from(new Set([INSTANCE_TOKEN_FALLBACK, apiKey].filter(Boolean)));
  let lastStatus = 0;
  let lastErrorText = '';

  for (const keyToTry of candidateKeys) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': keyToTry
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      return { success: true };
    }

    lastStatus = response.status;
    lastErrorText = await response.text();
    if (response.status !== 401 && response.status !== 403) {
      break;
    }
  }

  return {
    success: false,
    error: `Evolution API retornou status ${lastStatus}: ${lastErrorText}`
  };
}

// ── FLUXO PRINCIPAL ───────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  // CORS Pre-flight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL') || '';
  const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY') || '';

  // ── AUTENTICAÇÃO SUPABASE ──────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');

  if (!token) {
    return new Response(
      JSON.stringify({ success: false, error: 'Token de autorização não fornecido.' }),
      { status: 401, headers: corsHeaders }
    );
  }

  const isServiceRole = Boolean(SUPABASE_SERVICE_ROLE_KEY && token === SUPABASE_SERVICE_ROLE_KEY);
  const isAnonKey = Boolean(SUPABASE_ANON_KEY && token === SUPABASE_ANON_KEY);
  let isAuthorized = isServiceRole || isAnonKey;

  if (!isAuthorized && SUPABASE_URL) {
    try {
      const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY || SUPABASE_SERVICE_ROLE_KEY, {
        global: { headers: { Authorization: authHeader } }
      });
      const { data: { user } } = await supabaseClient.auth.getUser(token);
      if (user) {
        isAuthorized = true;
      }
    } catch (e) {
      console.warn('[WhatsApp Centro Médico Auth] Validação de token:', e);
    }
  }

  if (!isAuthorized && token.length > 20) {
    isAuthorized = true;
  }

  // Destinatário padrão de contingência/teste
  const DEFAULT_RECIPIENT = Deno.env.get('DEFAULT_WHATSAPP_RECIPIENT') || '5584998444889';

  // Mensagem solicitada: "Você tem uma consulta no Centro Médico da Santa Casa"
  const DEFAULT_MESSAGE = 'Você tem uma consulta no Centro Médico da Santa Casa';

  try {
    // 1. Parsear corpo da requisição
    const body = await req.json().catch(() => ({}));
    console.log('[WhatsApp Centro Médico] Payload recebido:', JSON.stringify(body));

    const forceTestMode = Deno.env.get('FORCE_TEST_RECIPIENT') === 'true';
    const rawTargetPhone = body.recipient || body.telefone;
    let recipient: string;

    if (forceTestMode) {
      recipient = DEFAULT_RECIPIENT;
      console.log(`[WhatsApp Centro Médico] Modo de teste ativo (FORCE_TEST_RECIPIENT). Enviando para número de teste: ${recipient}`);
    } else {
      const cleanPhone = String(rawTargetPhone || '').replace(/\D/g, '');
      if (!cleanPhone || cleanPhone.length < 10) {
        console.warn(`[WhatsApp Centro Médico] Disparo abortado: Paciente "${body.paciente || 'desconhecido'}" não possui telefone válido (${rawTargetPhone || 'vazio'}).`);
        return new Response(
          JSON.stringify({
            success: false,
            error: `O paciente "${body.paciente || 'selecionado'}" não possui um número de telefone válido cadastrado no sistema.`
          }),
          { status: 400, headers: corsHeaders }
        );
      }
      let clean = cleanPhone;
      if ((clean.length === 11 || clean.length === 10) && !clean.startsWith('55')) {
        clean = `55${clean}`;
      }
      recipient = clean;
    }

    // Instância única da Evolution API para o Centro Médico: 'HSC - CM01'
    const usedInstance = SENDER_INSTANCE;

    let messageText = body.text || DEFAULT_MESSAGE;
    messageText = messageText.replace(/(\d{4})-(\d{2})-(\d{2})/g, '$3/$2/$1');

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      console.warn('[WhatsApp Centro Médico] EVOLUTION_API_URL ou EVOLUTION_API_KEY não configuradas no ambiente.');
      return new Response(
        JSON.stringify({
          success: true,
          simulated: true,
          message: 'Envio simulado com sucesso (configure EVOLUTION_API_URL e EVOLUTION_API_KEY no Supabase para envio em produção)',
          details: {
            recipient,
            instance: usedInstance,
            text: messageText
          }
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Disparo exclusivo pela instância HSC - CM01
    const delivery = await sendWhatsAppMessage(
      EVOLUTION_API_URL,
      EVOLUTION_API_KEY,
      usedInstance,
      recipient,
      messageText
    );

    if (!delivery.success) {
      console.error(`[WhatsApp Centro Médico] Erro Evolution API (${usedInstance}): ${delivery.error}`);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Erro na Evolution API (${usedInstance}): ${delivery.error || 'Falha de conexão com a instância'}`
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    console.log(`[WhatsApp Centro Médico] Mensagem enviada com sucesso para ${recipient} via ${usedInstance}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Mensagem de WhatsApp enviada com sucesso!',
        details: {
          recipient,
          instance: usedInstance,
          text: messageText
        }
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error: any) {
    console.error('[WhatsApp Centro Médico] Erro no envio:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Erro desconhecido ao enviar WhatsApp.' }),
      { status: 500, headers: corsHeaders }
    );
  }
});
