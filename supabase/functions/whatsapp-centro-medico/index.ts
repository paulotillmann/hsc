import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

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
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL') || '';
  const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY') || '';

  // Autenticação flexível: aceita Service Role, Anon Key ou usuário logado via JWT
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  let isAuthorized = !token || token === SUPABASE_SERVICE_ROLE_KEY || token === SUPABASE_ANON_KEY;

  if (!isAuthorized && token && SUPABASE_URL) {
    try {
      const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY || SUPABASE_SERVICE_ROLE_KEY, {
        global: { headers: { Authorization: authHeader } }
      });
      const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
      if (!userError && user) {
        isAuthorized = true;
      }
    } catch (e) {
      console.warn('[WhatsApp Centro Médico Auth] Validação de token:', e);
    }
  }

  // Remetente (instância): usa a instância vinculada ao número 34988511343 ('HSC TI' ou configurável via env)
  const SENDER_INSTANCE = Deno.env.get('EVOLUTION_SENDER_INSTANCE') || Deno.env.get('EVOLUTION_INSTANCE') || 'HSC TI';

  // Destinatário fixo solicitado: 84998444889 (formato internacional: 5584998444889)
  const DEFAULT_RECIPIENT = '5584998444889';

  // Mensagem solicitada: "Você tem uma consulta no Centro Médico da Santa Casa"
  const DEFAULT_MESSAGE = 'Você tem uma consulta no Centro Médico da Santa Casa';

  try {
    // 1. Parsear corpo da requisição
    const body = await req.json().catch(() => ({}));
    console.log('[WhatsApp Centro Médico] Payload recebido:', JSON.stringify(body));

    const recipient = body.recipient || DEFAULT_RECIPIENT;
    // Permite usar a instância HSC TI (número 34988511343)
    const instance = body.instance || SENDER_INSTANCE;
    let messageText = body.text || DEFAULT_MESSAGE;
    // Formatar datas no padrão brasileiro DD/MM/AAAA (dia, mês e ano)
    messageText = messageText.replace(/(\d{4})-(\d{2})-(\d{2})/g, '$3/$2/$1');

    // 2. Se as credenciais da Evolution API não estiverem disponíveis (ex: ambiente local sem secrets)
    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      console.warn('[WhatsApp Centro Médico] EVOLUTION_API_URL ou EVOLUTION_API_KEY não configuradas no ambiente Supabase.');
      return new Response(
        JSON.stringify({
          success: true,
          simulated: true,
          message: 'Envio simulado com sucesso (configure EVOLUTION_API_URL e EVOLUTION_API_KEY no Supabase para envio em produção)',
          details: {
            recipient,
            instance,
            text: messageText
          }
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // 3. Enviar mensagem via Evolution API
    const delivery = await sendWhatsAppMessage(
      EVOLUTION_API_URL,
      EVOLUTION_API_KEY,
      instance,
      recipient,
      messageText
    );

    if (!delivery.success) {
      throw new Error(`Erro ao enviar mensagem via Evolution API: ${delivery.error}`);
    }

    console.log(`[WhatsApp Centro Médico] Mensagem enviada com sucesso para ${recipient} via ${instance}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Mensagem de WhatsApp enviada com sucesso!',
        details: {
          recipient,
          instance,
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
