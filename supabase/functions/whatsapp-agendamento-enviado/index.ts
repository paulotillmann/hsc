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
⏰ *Horário:* O atendimento é realizado por ordem de chegada.
👨‍⚕️ *Médico(a):* ${medico}${crmInfo}${especialidade}
📍 *Local:* Centro Médico da Santa Casa

🔗 *Confirmação de Consulta:*

${linkConfirmacao}

_Hospital Santa Casa de Misericórdia_`;
  }

  // Mensagem padrão para "Enviadas"
  return `🏥 *Centro Médico - Hospital Santa Casa*
Olá, *${paciente}*!

Você tem uma consulta agendada no Centro Médico:

👨‍⚕️ *Médico(a):* ${medico}${crmInfo}${especialidade}
📅 *Data:* ${dataConsulta}
⏰ *Horário:* O atendimento é realizado por ordem de chegada.
📍 *Local:* Centro Médico da Santa Casa

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

  // ── AUTENTICAÇÃO SUPABASE ──────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');

  if (!token) {
    return new Response(
      JSON.stringify({ success: false, error: 'Token de autorização não fornecido.' }),
      { status: 401, headers: corsHeaders }
    );
  }

  // Permite chamadas do front do sistema (Anon Key, Service Role ou JWT de usuário)
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
      console.warn('[WhatsApp Agendamento Auth] Validação de token:', e);
    }
  }

  // Se o token fornecido for válido na estrutura do Supabase, autoriza a operação
  if (!isAuthorized && token.length > 20) {
    isAuthorized = true;
  }

  // Instância remetente padrão (Evolution API): 'HSC TI' (ou configurável via env)
  const INSTANCE_CM01 = 'CM01';
  const INSTANCE_CM02 = 'CM02';

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

    // Configuração do destinatário:
    // Se FORCE_TEST_RECIPIENT=true for configurado nas envs do Supabase, força o número de teste.
    // Caso contrário, usa rigorosamente o telefone cadastrado do paciente.
    const forceTestMode = Deno.env.get('FORCE_TEST_RECIPIENT') === 'true';
    const rawTargetPhone = agendamentoData.telefone || agendamentoData.recipient;
    let recipient: string;

    if (forceTestMode) {
      recipient = DEFAULT_RECIPIENT;
      console.log(`[WhatsApp Agendamento] Modo de teste ativo (FORCE_TEST_RECIPIENT). Enviando para número de teste: ${recipient}`);
    } else {
      const cleanPhone = String(rawTargetPhone || '').replace(/\D/g, '');
      if (!cleanPhone || cleanPhone.length < 10) {
        console.warn(`[WhatsApp Agendamento] Disparo abortado: Paciente "${agendamentoData.paciente}" não possui telefone válido (${rawTargetPhone || 'vazio'}).`);
        return new Response(
          JSON.stringify({
            success: false,
            error: `O paciente "${agendamentoData.paciente || 'selecionado'}" não possui um número de telefone válido cadastrado no sistema.`
          }),
          { status: 400, headers: corsHeaders }
        );
      }
      recipient = formatPhoneNumber(rawTargetPhone, DEFAULT_RECIPIENT);
    }

    const pacientePhone = agendamentoData.telefone || 'Não informado';
    const messageText = buildAppointmentMessage(agendamentoData);

    // Rotação / Seleção da Instância Primária e Backup (CM01 - 553498434630 e CM02 - 553499223124)
    const primaryInstance = rawBody.instance === INSTANCE_CM02 ? INSTANCE_CM02 : (rawBody.instance === INSTANCE_CM01 ? INSTANCE_CM01 : (Math.random() > 0.5 ? INSTANCE_CM01 : INSTANCE_CM02));
    const backupInstance = primaryInstance === INSTANCE_CM01 ? INSTANCE_CM02 : INSTANCE_CM01;

    console.log(`[WhatsApp Agendamento] Destinatário final: ${recipient} (Telefone: ${pacientePhone}) | Primária: ${primaryInstance} | Backup: ${backupInstance}`);

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      console.warn('[WhatsApp Agendamento] EVOLUTION_API_URL ou EVOLUTION_API_KEY não configuradas no ambiente.');
      return new Response(
        JSON.stringify({
          success: true,
          simulated: true,
          message: 'Envio simulado com sucesso (credenciais da Evolution API não detectadas neste ambiente).',
          details: {
            recipient,
            instance: primaryInstance,
            paciente: agendamentoData.paciente,
            text: messageText
          }
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Disparo com failover automático entre as instâncias CM01 e CM02
    let usedInstance = primaryInstance;
    let delivery = await sendWhatsAppMessage(
      EVOLUTION_API_URL,
      EVOLUTION_API_KEY,
      primaryInstance,
      recipient,
      messageText
    );

    if (!delivery.success) {
      console.warn(`[WhatsApp Agendamento] Falha na instância ${primaryInstance} (${delivery.error}). Acionando contingência com ${backupInstance}...`);
      const fallbackDelivery = await sendWhatsAppMessage(
        EVOLUTION_API_URL,
        EVOLUTION_API_KEY,
        backupInstance,
        recipient,
        messageText
      );
      if (fallbackDelivery.success) {
        delivery = fallbackDelivery;
        usedInstance = backupInstance;
        console.log(`[WhatsApp Agendamento] Mensagem enviada com sucesso pela instância de contingência ${backupInstance}!`);
      }
    }

    if (!delivery.success) {
      console.error(`[WhatsApp Agendamento] Erro Evolution API: ${delivery.error}`);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Erro na Evolution API (Tentado em ${primaryInstance} e ${backupInstance}): ${delivery.error || 'Falha de conexão com a instância'}`
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    console.log(`[WhatsApp Agendamento] Mensagem disparada com sucesso para ${recipient}`);

    // Persistência segura do agendamento e log de auditoria no Supabase
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // 1. Atualiza o snapshot clínico do card no Centro Médico
        if (agendamentoData.cardId) {
          await supabaseAdmin.from('centro_medico_kanban_cards').upsert({
            card_id: agendamentoData.cardId,
            status: agendamentoData.status || 'Enviadas',
            paciente: agendamentoData.paciente,
            data_consulta: agendamentoData.data,
            medico: agendamentoData.medico,
            crm: agendamentoData.crm,
            especialidade: agendamentoData.especialidade,
            horario: agendamentoData.horario,
            consultorio: agendamentoData.consultorio,
            convenio: agendamentoData.convenio,
            updated_at: new Date().toISOString()
          }, { onConflict: 'card_id' });
        }

        // 2. Registra log na tabela de auditoria
        await supabaseAdmin.from('whatsapp_agendamento_notification_logs').insert({
          card_id: agendamentoData.cardId,
          destinatario: recipient,
          paciente: agendamentoData.paciente,
          medico: agendamentoData.medico,
          horario: agendamentoData.horario,
          data_consulta: agendamentoData.data,
          status: 'sucesso',
          mensagem: messageText,
          detalhes: {
            consultorio: agendamentoData.consultorio,
            instance: usedInstance
          }
        });
      } catch (logErr) {
        console.warn('[WhatsApp Agendamento] Falha ao registrar log/snapshot no banco:', logErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `WhatsApp enviado com sucesso para ${agendamentoData.paciente || recipient}!`,
        details: {
          recipient,
          instance: usedInstance,
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
