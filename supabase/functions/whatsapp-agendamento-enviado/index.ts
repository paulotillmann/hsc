import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

// ── FORMATAÇÃO DE NÚMERO DO DESTINATÁRIO ─────────────────────────────────────
function formatPhoneNumber(phone: string | undefined | null, defaultPhone: string): string {
  if (!phone) return defaultPhone;
  let digits = String(phone).replace(/\D/g, '');
  if (!digits) return defaultPhone;

  // Se tiver 10 ou 11 dígitos (ex: 34988511343 ou 84998444889), adiciona o DDI Brasil (55)
  if ((digits.length === 10 || digits.length === 11) && !digits.startsWith('55')) {
    digits = `55${digits}`;
  }

  return digits;
}

// ── MONTAGEM DO TEXTO DA MENSAGEM ─────────────────────────────────────────────
interface AgendamentoPayload {
  cardId?: string;
  paciente?: string;
  prontuario?: string;
  medico?: string;
  crm?: string;
  especialidade?: string;
  consultorio?: string;
  horario?: string;
  data?: string;
  convenio?: string;
  telefone?: string;
  recipient?: string;
  text?: string;
  mensagem?: string;
  status?: string;
  tipo?: string;
  linkConfirmacao?: string;
  link?: string;
  origin?: string;
}

function formatDateToBR(dateStr?: string): string {
  if (!dateStr) return 'Data informada no agendamento';
  const trimmed = dateStr.trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) return trimmed;
  const clean = trimmed.split('T')[0];
  const parts = clean.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return trimmed;
}

function buildAppointmentMessage(data: AgendamentoPayload): string {
  if (data.text || data.mensagem) {
    const raw = (data.text || data.mensagem) as string;
    return raw.replace(/(\d{4})-(\d{2})-(\d{2})/g, '$3/$2/$1');
  }

  const paciente = data.paciente || 'Paciente';
  const medico = data.medico || 'Médico(a) do Centro Médico';
  const crmInfo = data.crm ? ` (CRM: ${data.crm})` : '';
  const especialidade = data.especialidade ? ` - ${data.especialidade}` : '';
  const dataConsulta = formatDateToBR(data.data);
  const horario = data.horario || 'Horário agendado';
  const consultorio = data.consultorio || 'Centro Médico';
  const convenio = data.convenio ? `\n📄 *Convênio:* ${data.convenio}` : '';

  const baseUrl = (data.origin || Deno.env.get('APP_URL') || 'http://localhost:3000').replace(/\/+$/, '');
  const linkConfirmacao = data.linkConfirmacao || data.link || `${baseUrl}/confirmar-consulta/${encodeURIComponent(data.cardId || 'cons-101')}`;

  // Mensagem para quando o card é movido para "Confirmadas"
  if (data.status === 'Confirmadas' || data.tipo === 'confirmacao') {
    return `🏥 *Centro Médico - Hospital Santa Casa*
Olá, *${paciente}*!

Confirmamos os dados da sua consulta no Centro Médico:

📅 *Data:* ${dataConsulta}
⏰ *Horário:* ${horario}
👨‍⚕️ *Médico(a):* ${medico}${crmInfo}${especialidade}
📍 *Local:* Centro Médico da Santa Casa${convenio}

🔗 *Confirmação de Consulta:*

${linkConfirmacao}

• Por favor, chegue com 15 minutos de antecedência portando documento oficial com foto e carteirinha do convênio (se aplicável).
• Em caso de dúvidas ou necessidade de reagendamento, entre em contato conosco.

_Hospital Santa Casa de Misericórdia_`;
  }

  // Mensagem padrão para "Enviadas"
  return `🏥 *Centro Médico - Hospital Santa Casa*
Olá, *${paciente}*!

Você tem uma consulta agendada no Centro Médico:

👨‍⚕️ *Médico(a):* ${medico}${crmInfo}${especialidade}
📅 *Data:* ${dataConsulta}
⏰ *Horário:* ${horario}
📍 *Local:* Centro Médico da Santa Casa${convenio}

• Por favor, chegue com 15 minutos de antecedência portando documento oficial com foto e carteirinha do convênio (se aplicável).
• Em caso de dúvidas ou necessidade de reagendamento, entre em contato conosco.

_Hospital Santa Casa de Misericórdia_`;
}

// ── ENVIO PARA A EVOLUTION API ─────────────────────────────────────────────
async function sendWhatsAppMessage(
  apiUrl: string,
  apiKey: string,
  instance: string,
  recipient: string,
  text: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  const cleanUrl = apiUrl.replace(/\/+$/, '');
  const url = `${cleanUrl}/message/sendText/${encodeURIComponent(instance)}`;

  const payload = {
    number: recipient,
    text: text
  };

  console.log(`[WhatsApp Agendamento] Enviando POST para: ${url} (Destinatário: ${recipient})`);

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

  const responseData = await response.json().catch(() => ({}));
  return { success: true, data: responseData };
}

// ── FLUXO PRINCIPAL DA EDGE FUNCTION ────────────────────────────────────────
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

  // Autenticação flexível: aceita Service Role, Anon Key ou usuário logado com JWT
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
      console.warn('[WhatsApp Agendamento Auth] Validação de token:', e);
    }
  }

  // Instância remetente padrão (Evolution API): 'HSC TI' (ou configurável via env)
  const SENDER_INSTANCE = Deno.env.get('EVOLUTION_SENDER_INSTANCE') || Deno.env.get('EVOLUTION_INSTANCE') || 'HSC TI';

  // Destinatário padrão de contingência/teste
  const DEFAULT_RECIPIENT = Deno.env.get('DEFAULT_WHATSAPP_RECIPIENT') || '5584998444889';

  try {
    const rawBody = await req.json().catch(() => ({}));
    console.log('[WhatsApp Agendamento] Requisição recebida:', JSON.stringify(rawBody));

    // Suporta tanto chamada direta do front quanto Database Webhooks do Supabase
    let agendamentoData: AgendamentoPayload = {};

    if (rawBody.record) {
      // Formato disparado via Database Webhook / Trigger
      const rec = rawBody.record;
      agendamentoData = {
        cardId: rec.id?.toString(),
        paciente: rec.paciente || rec.nome_paciente || rec.nome,
        prontuario: rec.prontuario?.toString(),
        medico: rec.medico || rec.nome_medico,
        crm: rec.crm,
        especialidade: rec.especialidade,
        consultorio: rec.consultorio || rec.sala,
        horario: rec.horario || rec.hora,
        data: rec.data || rec.dt_agendamento,
        convenio: rec.convenio || rec.ds_convenio,
        telefone: rec.telefone || rec.celular || rec.contato,
        recipient: rawBody.recipient,
        text: rawBody.text || rawBody.mensagem,
        status: rec.status || rawBody.status,
        tipo: rawBody.tipo
      };
    } else {
      // Formato enviado diretamente pelo frontend
      agendamentoData = {
        cardId: rawBody.cardId || rawBody.id,
        paciente: rawBody.paciente,
        prontuario: rawBody.prontuario,
        medico: rawBody.medico,
        crm: rawBody.crm,
        especialidade: rawBody.especialidade,
        consultorio: rawBody.consultorio,
        horario: rawBody.horario,
        data: rawBody.data,
        convenio: rawBody.convenio,
        telefone: rawBody.telefone,
        recipient: rawBody.recipient,
        text: rawBody.text || rawBody.mensagem,
        status: rawBody.status,
        tipo: rawBody.tipo
      };
    }

    // Destinatário fixo por enquanto conforme solicitado: sempre 5584998444889
    const FIXED_RECIPIENT = '5584998444889';
    const recipient = FIXED_RECIPIENT;
    const pacientePhone = agendamentoData.telefone || agendamentoData.recipient || 'Não informado';
    const instance = rawBody.instance || SENDER_INSTANCE;
    const messageText = buildAppointmentMessage(agendamentoData);

    console.log(`[WhatsApp Agendamento] Destinatário fixado: ${recipient} (Telefone do cadastro: ${pacientePhone}) | Instância: ${instance}`);

    // Se as credenciais da Evolution API não estiverem disponíveis (ex: ambiente de desenvolvimento local)
    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      console.warn('[WhatsApp Agendamento] EVOLUTION_API_URL ou EVOLUTION_API_KEY não configuradas no ambiente.');
      return new Response(
        JSON.stringify({
          success: true,
          simulated: true,
          message: 'Envio simulado com sucesso (credenciais da Evolution API não detectadas neste ambiente).',
          details: {
            recipient,
            instance,
            paciente: agendamentoData.paciente,
            text: messageText
          }
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Disparar envio via Evolution API
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

    console.log(`[WhatsApp Agendamento] Mensagem disparada com sucesso para ${recipient}`);

    // Tentativa de log opcional no banco de dados se houver cliente configurado
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        await supabaseAdmin.from('whatsapp_notification_logs').insert({
          destinatario: recipient,
          mensagem: messageText,
          status: 'sucesso',
          tipo: 'agendamento_kanban_enviadas',
          detalhes: {
            cardId: agendamentoData.cardId,
            paciente: agendamentoData.paciente,
            medico: agendamentoData.medico,
            data: agendamentoData.data,
            horario: agendamentoData.horario,
            consultorio: agendamentoData.consultorio,
            instance: instance
          }
        });
      } catch (logErr) {
        console.warn('[WhatsApp Agendamento] Log no banco ignorado/tabela não existente:', logErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `WhatsApp enviado com sucesso para ${agendamentoData.paciente || recipient}!`,
        details: {
          recipient,
          instance,
          paciente: agendamentoData.paciente,
          medico: agendamentoData.medico,
          horario: agendamentoData.horario,
          text: messageText
        }
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error: any) {
    console.error('[WhatsApp Agendamento] Falha no processamento:', error.message);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro inesperado ao disparar mensagem de WhatsApp para o agendamento.'
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
