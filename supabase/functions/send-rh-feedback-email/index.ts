import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const LOGO_URL = 'https://drbzogwimvaziaydwqfk.supabase.co/storage/v1/object/public/assets/logo_hsc_white.png';

interface SmtpConfig {
  smtp_host: string;
  smtp_port: string;
  smtp_user: string;
  smtp_pass: string;
  smtp_from_name: string;
  smtp_from_email: string;
  smtp_secure: string;
}

interface RhFeedbackPayload {
  to: string;
  nomeCandidato: string;
  vaga: string;
  subject: string;
  messageBody: string;
  smtpOverride?: {
    host?: string;
    port?: string;
    user?: string;
    pass?: string;
    secure?: string;
    fromName?: string;
    fromEmail?: string;
  };
}

async function getSmtpConfig(override?: RhFeedbackPayload['smtpOverride']): Promise<SmtpConfig> {
  if (override?.host && override?.user && override?.pass) {
    return {
      smtp_host: override.host,
      smtp_port: override.port || '465',
      smtp_user: override.user,
      smtp_pass: override.pass,
      smtp_from_name: override.fromName || 'Recursos Humanos - Hospital Santa Casa',
      smtp_from_email: override.fromEmail || override.user,
      smtp_secure: override.secure || 'ssl',
    };
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Tenta primeiro a configuração específica do RH (se tiver senha preenchida)
  const { data: rhData } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'rh_recrutamento_email_config')
    .maybeSingle();

  if (rhData?.value) {
    try {
      const parsed = JSON.parse(rhData.value);
      const host = parsed.useSameSmtp ? parsed.imapHost : (parsed.smtpHost || parsed.imapHost);
      const port = parsed.useSameSmtp ? (parsed.smtpPort || '465') : (parsed.smtpPort || '587');
      const user = parsed.imapUser || parsed.emailMonitorado;
      const pass = parsed.imapPass;
      if (host && user && pass) {
        return {
          smtp_host: host,
          smtp_port: String(port),
          smtp_user: user,
          smtp_pass: pass,
          smtp_from_name: parsed.remetenteNome || 'Recursos Humanos - Hospital Santa Casa',
          smtp_from_email: user,
          smtp_secure: String(port) === '465' ? 'ssl' : 'tls',
        };
      }
    } catch {
      // Continua para o SMTP global
    }
  }

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
  const fromName = config.smtp_from_name || 'Recursos Humanos - Hospital Santa Casa';
  const fromEmail = config.smtp_from_email || user;
  const secure = config.smtp_secure || 'tls';

  if (!host || !user || !pass) {
    throw new Error('Configurações SMTP incompletas em Configurações > Servidor SMTP.');
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

function buildFeedbackHtml(payload: RhFeedbackPayload): string {
  const logoHtml = `<img src="${LOGO_URL}" alt="Santa Casa" height="60" style="display:block;height:60px;width:auto;outline:none;text-decoration:none;margin:0 auto;" />`;
  const paragraphs = payload.messageBody
    .split(/\n+/)
    .filter(p => p.trim().length > 0)
    .map(p => `<p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.7;">${p.trim()}</p>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:'Segoe UI',Roboto,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:#0f172a;padding:28px 32px;text-align:center;">
              ${logoHtml}
              <p style="margin:10px 0 0;color:#cbd5e1;font-size:12px;letter-spacing:1.2px;text-transform:uppercase;font-weight:600;">Recursos Humanos • Recrutamento & Seleção</p>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;padding:36px 32px 24px;">
              ${paragraphs}
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;padding:0 32px;">
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:0;" />
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;padding:20px 32px 28px;border-radius:0 0 12px 12px;">
              <p style="margin:0 0 4px;color:#64748b;font-size:12px;text-align:center;font-weight:600;">
                Hospital Santa Casa de Misericórdia de Araguari
              </p>
              <p style="margin:0;color:#94a3b8;font-size:11px;text-align:center;line-height:1.5;">
                Setor de Recursos Humanos • Araguari - MG
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendEmailViaSMTP(
  smtp: SmtpConfig,
  toEmail: string,
  subject: string,
  html: string
): Promise<void> {
  const port = parseInt(smtp.smtp_port, 10);
  const useDirectTLS = smtp.smtp_secure === 'ssl' || port === 465;

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

  const rcptResp = await sendCommand(writer, reader, `RCPT TO:<${toEmail}>`);
  if (!rcptResp.startsWith('250')) throw new Error(`Falha no destinatário (${toEmail}): ${rcptResp}`);

  const dataResp = await sendCommand(writer, reader, 'DATA');
  if (!dataResp.startsWith('354')) throw new Error(`DATA failed: ${dataResp}`);

  const boundary = `boundary_${Date.now()}`;
  const message = [
    `From: ${smtp.smtp_from_name} <${fromEmail}>`,
    `To: ${toEmail}`,
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
  } catch { /* ignore */ }
}

Deno.serve(async (req: Request) => {
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: RhFeedbackPayload = await req.json();
    const toClean = (payload.to || '').trim().toLowerCase();

    if (!toClean || !toClean.includes('@')) {
      return new Response(JSON.stringify({ error: 'E-mail de candidato inválido.' }), { status: 400, headers: corsHeaders });
    }

    const smtp = await getSmtpConfig(payload.smtpOverride);
    const html = buildFeedbackHtml(payload);
    await sendEmailViaSMTP(smtp, toClean, payload.subject, html);

    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido ao enviar e-mail.';
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: corsHeaders });
  }
});

