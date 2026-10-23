import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

interface SmtpConfig {
  smtp_host: string;
  smtp_port: string;
  smtp_user: string;
  smtp_pass: string;
  smtp_from_name: string;
  smtp_from_email: string;
  smtp_secure: string;
}

interface NpsReportPayload {
  to: string | string[];
  subject?: string;
  periodoReferencia?: string;
  html: string;
}

// ---------- Busca config SMTP da tabela app_settings ----------
async function getSmtpConfig(): Promise<SmtpConfig> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await supabase
    .from('app_settings')
    .select('key, value')
    .like('key', 'smtp_%');

  if (error) throw new Error(`Erro ao ler configurações SMTP: ${error.message}`);
  if (!data || data.length === 0) throw new Error('Configurações SMTP não encontradas. Configure em Configurações > Servidor SMTP.');

  const config: Record<string, string> = {};
  for (const row of data) config[row.key] = row.value;

  const host = config.smtp_host || '';
  const port = config.smtp_port || '587';
  const user = config.smtp_user || '';
  const pass = config.smtp_pass || '';
  const fromName = config.smtp_from_name || 'Hospital Santa Casa';
  const fromEmail = config.smtp_from_email || user;
  const secure = config.smtp_secure || 'tls';

  if (!host || !user || !pass) {
    throw new Error('Configurações SMTP incompletas. Verifique host, porta, usuário e senha em Configurações.');
  }

  return {
    smtp_host: host,
    smtp_port: port,
    smtp_user: user,
    smtp_pass: pass,
    smtp_from_name: fromName,
    smtp_from_email: fromEmail,
    smtp_secure: secure,
  };
}

// ---------- Encoder/Decoder helpers ----------
const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function readResponse(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<string> {
  let result = '';
  while (true) {
    const { value, done } = await reader.read();
    if (value) result += decoder.decode(value, { stream: !done });
    if (done || result.includes('\r\n')) break;
  }
  return result.trim();
}

async function sendCommand(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  reader: ReadableStreamDefaultReader<Uint8Array>,
  command: string
): Promise<string> {
  await writer.write(encoder.encode(command + '\r\n'));
  await new Promise(r => setTimeout(r, 300));
  return await readResponse(reader);
}

// ---------- Normaliza e limpa endereços de e-mail ----------
function extractCleanRecipients(raw: string | string[]): string[] {
  const list = Array.isArray(raw) ? raw : [raw];
  const results: string[] = [];
  for (const item of list) {
    if (!item || typeof item !== 'string') continue;
    const parts = item.split(/[,;\n\r]+/);
    for (const part of parts) {
      const match = part.match(/<([^>]+)>/);
      const emailCandidate = (match ? match[1] : part).trim();
      const clean = emailCandidate.replace(/[<>'"\(\)\s]/g, '').toLowerCase();
      if (clean && /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/.test(clean)) {
        if (!results.includes(clean)) {
          results.push(clean);
        }
      }
    }
  }
  return results;
}

// ---------- Envio via SMTP raw (Deno.connect + STARTTLS / TLS direto) ----------
async function sendEmailViaSMTP(
  smtp: SmtpConfig,
  recipients: string[],
  subject: string,
  html: string
): Promise<void> {
  const port = parseInt(smtp.smtp_port, 10);
  const useDirectTLS = smtp.smtp_secure === 'ssl' || port === 465;

  console.log(`[SMTP NPS] Conectando a ${smtp.smtp_host}:${port} (${useDirectTLS ? 'direct TLS' : 'STARTTLS'})`);

  let conn: Deno.TcpConn | Deno.TlsConn;
  if (useDirectTLS) {
    conn = await Deno.connectTls({ hostname: smtp.smtp_host, port });
  } else {
    conn = await Deno.connect({ hostname: smtp.smtp_host, port });
  }

  let reader = conn.readable.getReader();
  let writer = conn.writable.getWriter();

  const greeting = await readResponse(reader);
  if (!greeting.startsWith('220')) throw new Error(`SMTP greeting failed: ${greeting}`);

  let ehlo = await sendCommand(writer, reader, `EHLO edge-function.supabase.co`);

  if (!useDirectTLS && (smtp.smtp_secure === 'tls' || ehlo.includes('STARTTLS'))) {
    const starttls = await sendCommand(writer, reader, 'STARTTLS');
    if (!starttls.startsWith('220')) throw new Error(`STARTTLS failed: ${starttls}`);
    
    reader.releaseLock();
    writer.releaseLock();
    
    conn = await Deno.startTls(conn as Deno.TcpConn, { hostname: smtp.smtp_host });
    reader = conn.readable.getReader();
    writer = conn.writable.getWriter();

    ehlo = await sendCommand(writer, reader, `EHLO edge-function.supabase.co`);
  }

  const authResp = await sendCommand(writer, reader, 'AUTH LOGIN');
  if (!authResp.startsWith('334')) throw new Error(`AUTH LOGIN failed: ${authResp}`);

  const userResp = await sendCommand(writer, reader, btoa(smtp.smtp_user));
  if (!userResp.startsWith('334')) throw new Error(`AUTH user failed: ${userResp}`);

  const passResp = await sendCommand(writer, reader, btoa(smtp.smtp_pass));
  if (!passResp.startsWith('235')) throw new Error(`AUTH password failed: ${passResp}`);

  const fromEmail = (smtp.smtp_from_email || smtp.smtp_user).replace(/[<>'"]+/g, '').trim();
  const fromResp = await sendCommand(writer, reader, `MAIL FROM:<${fromEmail}>`);
  if (!fromResp.startsWith('250')) throw new Error(`MAIL FROM failed: ${fromResp}`);

  for (const rcpt of recipients) {
    const rcptResp = await sendCommand(writer, reader, `RCPT TO:<${rcpt}>`);
    if (!rcptResp.startsWith('250')) throw new Error(`Falha no destinatário (${rcpt}): ${rcptResp}`);
  }

  const dataResp = await sendCommand(writer, reader, 'DATA');
  if (!dataResp.startsWith('354')) throw new Error(`DATA failed: ${dataResp}`);

  const boundary = `boundary_${Date.now()}`;
  const message = [
    `From: ${smtp.smtp_from_name} <${fromEmail}>`,
    `To: ${recipients.join(', ')}`,
    `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    `Date: ${new Date().toUTCString()}`,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    ``,
    btoa(unescape(encodeURIComponent(html))),
    ``,
    `--${boundary}--`,
    `.`,
  ].join('\r\n');

  const endResp = await sendCommand(writer, reader, message);
  if (!endResp.startsWith('250')) throw new Error(`Send failed: ${endResp}`);

  await sendCommand(writer, reader, 'QUIT');

  try {
    reader.releaseLock();
    writer.releaseLock();
    conn.close();
  } catch { /* cleanup */ }
}

// ---------- Handler principal ----------
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
    });
  }

  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // --- Validação de Autorização ---
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  let isAuthorized = token === SUPABASE_SERVICE_ROLE_KEY;

  if (!isAuthorized && token) {
    try {
      const supabaseClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY') || '', {
        global: { headers: { Authorization: authHeader } }
      });
      const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
      if (!userError && user) {
        isAuthorized = true;
      }
    } catch (e) {
      console.error('[NPS SMTP Auth] Erro ao verificar JWT:', e);
    }
  }

  if (!isAuthorized) {
    return new Response(
      JSON.stringify({ error: 'Acesso não autorizado. É necessário estar autenticado no sistema.' }),
      { status: 401, headers: corsHeaders }
    );
  }

  try {
    const payload: NpsReportPayload = await req.json();

    if (!payload.html || typeof payload.html !== 'string' || payload.html.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Conteúdo HTML do relatório não foi fornecido.' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const cleanRecipients = extractCleanRecipients(payload.to);
    if (cleanRecipients.length === 0) {
      return new Response(
        JSON.stringify({ error: `E-mail de destino inválido ou vazio: "${payload.to}". Forneça pelo menos um e-mail válido.` }),
        { status: 400, headers: corsHeaders }
      );
    }

    const smtp = await getSmtpConfig();
    const periodo = payload.periodoReferencia || 'Período Selecionado';
    const subject = payload.subject || `Relatório de Indicadores NPS (${periodo}) | Hospital Santa Casa`;

    await sendEmailViaSMTP(smtp, cleanRecipients, subject, payload.html);

    console.log(`[NPS SMTP] Relatório enviado com sucesso para: ${cleanRecipients.join(', ')}`);

    return new Response(
      JSON.stringify({ success: true, recipientsCount: cleanRecipients.length, recipients: cleanRecipients }),
      { headers: corsHeaders }
    );
  } catch (err) {
    console.error('[NPS SMTP] Erro:', err);
    const message = err instanceof Error ? err.message : 'Erro desconhecido ao enviar e-mail.';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: corsHeaders }
    );
  }
});
