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

interface EmailPayload {
  to: string;
  nomeColaborador: string;
  tipoDocumento: 'holerite' | 'informe';
  periodoReferencia: string;
  cpf: string;
  pdfUrl: string;
  isTest?: boolean;
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

  if (!config.smtp_host || !config.smtp_port || !config.smtp_user || !config.smtp_pass) {
    throw new Error('Configurações SMTP incompletas. Verifique host, porta, usuário e senha.');
  }
  return config as unknown as SmtpConfig;
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

// ---------- Envio via SMTP raw (Deno.connect + STARTTLS) ----------
async function sendEmailViaSMTP(
  smtp: SmtpConfig,
  to: string,
  subject: string,
  html: string
): Promise<void> {
  const port = parseInt(smtp.smtp_port, 10);
  const useDirectTLS = smtp.smtp_secure === 'ssl' || port === 465;

  console.log(`[SMTP] Connecting to ${smtp.smtp_host}:${port} (${useDirectTLS ? 'direct TLS' : 'STARTTLS'})`);

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

  const fromResp = await sendCommand(writer, reader, `MAIL FROM:<${smtp.smtp_from_email}>`);
  if (!fromResp.startsWith('250')) throw new Error(`MAIL FROM failed: ${fromResp}`);

  const rcptResp = await sendCommand(writer, reader, `RCPT TO:<${to}>`);
  if (!rcptResp.startsWith('250')) throw new Error(`RCPT TO failed: ${rcptResp}`);

  const dataResp = await sendCommand(writer, reader, 'DATA');
  if (!dataResp.startsWith('354')) throw new Error(`DATA failed: ${dataResp}`);

  const boundary = `boundary_${Date.now()}`;
  const message = [
    `From: ${smtp.smtp_from_name} <${smtp.smtp_from_email}>`,
    `To: ${to}`,
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
  } catch { /* ignore cleanup errors */ }
}

// ---------- Monta o HTML do e-mail ----------
function buildEmailHtml(payload: EmailPayload): string {
  const tipoLabel = payload.tipoDocumento === 'holerite'
    ? 'Demonstrativo de Pagamento (Holerite)'
    : 'Informe de Rendimentos';
  const tipoIcon = payload.tipoDocumento === 'holerite' ? '💰' : '📄';

  // Usamos altura fixa para ser proporcional e maior, como no sidebar
  const logoHtml = `<img src="${LOGO_URL}" alt="Santa Casa" height="64" style="display:block;height:64px;width:auto;outline:none;text-decoration:none;margin:0 auto;" />`;

  if (payload.isTest) {
    return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background-color:#f4f5f7;font-family:'Segoe UI',Roboto,Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:32px 0;"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);"><tr><td style="background:#0f172a;padding:32px;text-align:center;">${logoHtml}</td></tr><tr><td style="background:#ffffff;padding:36px 32px;"><h2 style="margin:0 0 16px;color:#0f172a;font-size:22px;font-weight:700;">✅ Teste de SMTP bem-sucedido!</h2><p style="margin:0 0 16px;color:#475569;font-size:15px;line-height:1.7;">Este e-mail confirma que as configurações de SMTP do sistema HSC estão funcionando corretamente.</p><p style="margin:0;color:#94a3b8;font-size:13px;">Enviado em: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p></td></tr><tr><td style="background:#ffffff;padding:16px 32px 28px;border-radius:0 0 12px 12px;"><p style="margin:0;color:#cbd5e1;font-size:11px;text-align:center;">Sistema de Gestão HSC - Hospital Santa Casa de Misericórdia de Araguari</p></td></tr></table></td></tr></table></body></html>`;
  }

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="margin:0;padding:0;background-color:#f4f5f7;font-family:'Segoe UI',Roboto,Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:32px 0;"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);"><tr><td style="background:#0f172a;padding:32px;text-align:center;">${logoHtml}</td></tr><tr><td style="background:#ffffff;padding:36px 32px 24px;"><h2 style="margin:0 0 8px;color:#0f172a;font-size:22px;font-weight:700;">Olá, ${payload.nomeColaborador}! 👋</h2><p style="margin:0 0 20px;color:#475569;font-size:15px;line-height:1.7;">Em nome do <strong>Hospital Santa Casa de Misericórdia de Araguari</strong>, gostaríamos de expressar nossa sincera gratidão pelo seu empenho e dedicação em mais um período de trabalho. Seu comprometimento é fundamental para que possamos continuar cuidando de quem precisa.</p><p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.7;">O seu <strong>${tipoLabel}</strong> referente ao período <strong>${payload.periodoReferencia}</strong> já está disponível. Você pode acessá-lo clicando no botão abaixo:</p></td></tr><tr><td style="background:#ffffff;padding:0 32px 24px;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;border-radius:10px;border:1px solid #e2e8f0;"><tr><td style="padding:20px 24px;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:1px;font-weight:600;padding-bottom:8px;">${tipoIcon} ${tipoLabel}</td></tr><tr><td style="color:#0f172a;font-size:16px;font-weight:700;padding-bottom:4px;">${payload.nomeColaborador}</td></tr><tr><td style="color:#64748b;font-size:14px;">Período: ${payload.periodoReferencia} - CPF: ${payload.cpf}</td></tr></table></td></tr></table></td></tr><tr><td style="background:#ffffff;padding:0 32px 36px;text-align:center;"><a href="${payload.pdfUrl}" target="_blank" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:8px;font-size:15px;font-weight:700;letter-spacing:0.3px;box-shadow:0 4px 12px rgba(37,99,235,0.3);">Acessar Documento</a></td></tr><tr><td style="background:#ffffff;padding:0 32px;"><hr style="border:none;border-top:1px solid #e2e8f0;margin:0;" /></td></tr><tr><td style="background:#ffffff;padding:24px 32px 28px;border-radius:0 0 12px 12px;"><p style="margin:0 0 6px;color:#94a3b8;font-size:12px;text-align:center;line-height:1.6;">Hospital Santa Casa de Misericórdia de Araguari<br/>Araguari - MG - CNPJ 16.826.067/0001-10</p><p style="margin:0;color:#cbd5e1;font-size:11px;text-align:center;line-height:1.5;">Este é um e-mail automático enviado pelo sistema de gestão HSC.<br/>Em caso de dúvidas, entre em contato com o setor de Recursos Humanos.</p></td></tr></table></td></tr></table></body></html>`;
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
  };

  try {
    const payload: EmailPayload = await req.json();
    if (!payload.to || !payload.nomeColaborador) {
      return new Response(JSON.stringify({ error: 'Campos obrigatórios: to, nomeColaborador' }), { status: 400, headers: corsHeaders });
    }

    const smtp = await getSmtpConfig();
    const tipoLabel = payload.tipoDocumento === 'holerite' ? 'Holerite' : 'Informe de Rendimentos';
    const subject = payload.isTest
      ? 'Teste de SMTP - Sistema HSC'
      : `${tipoLabel} - ${payload.periodoReferencia} | Hospital Santa Casa`;
    const html = buildEmailHtml(payload);

    await sendEmailViaSMTP(smtp, payload.to, subject, html);

    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
  } catch (err) {
    console.error('[SMTP] Erro:', err);
    const message = err instanceof Error ? err.message : 'Erro desconhecido ao enviar e-mail.';
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: corsHeaders });
  }
});
