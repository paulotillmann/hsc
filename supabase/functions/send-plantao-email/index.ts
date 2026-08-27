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

interface PlantaoItemDto {
  dataChamado: string;
  especialidade: string;
  tipoPlantao: string;
  valor: number;
}

interface ProducaoItemDto {
  tipo: string;
  valor: number;
}

interface SendPlantaoEmailPayload {
  to: string | string[];
  nomeMedico: string;
  periodoReferencia: string; // Ex: '01/07/2026 a 31/07/2026' ou 'Julho/2026'
  tipoPlantao?: string;
  resumo: {
    totalPlantoes: number;
    valorPlantoes: number;
    valorProducao: number;
    valorTotalGeral: number;
    valorPago?: number;
    valorPendente?: number;
    status?: string;
    tipoPlantao?: string;
  };
  itens?: PlantaoItemDto[];
  producoes?: ProducaoItemDto[];
  pdfBase64?: string; // PDF gerado pelo cliente em base64
  pdfFilename?: string;
}

// ---------- Busca config SMTP da tabela app_settings ----------
async function getSmtpConfig(): Promise<SmtpConfig> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await supabase
    .from('app_settings')
    .select('key, value')
    .like('key', 'smtp_%');

  if (error) throw new Error(`Erro ao ler configurações SMTP: ${error.message}`);
  if (!data || data.length === 0) throw new Error('Configurações SMTP não encontradas na tabela app_settings.');

  const config: Record<string, string> = {};
  for (const row of data) config[row.key] = row.value;

  const financeiroUser = config.smtp_financeiro_user || 'contasapagar@santacasaaraguari.org.br';
  const financeiroPass = config.smtp_financeiro_pass || 'Santac@s@123';
  const financeiroFromName = config.smtp_financeiro_from_name || 'Santa Casa de Araguari - Financeiro';
  const financeiroFromEmail = config.smtp_financeiro_from_email || financeiroUser;

  return {
    smtp_host: config.smtp_host,
    smtp_port: config.smtp_port,
    smtp_user: financeiroUser,
    smtp_pass: financeiroPass,
    smtp_from_name: financeiroFromName,
    smtp_from_email: financeiroFromEmail,
    smtp_secure: config.smtp_secure || 'tls'
  };
}

// ---------- Helpers de Leitura e Escrita SMTP ----------
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
  await new Promise(r => setTimeout(r, 200));
  return await readResponse(reader);
}

// ---------- Envio SMTP com suporte a múltiplos destinatários e Anexo PDF ----------
async function sendEmailViaSMTP(
  smtp: SmtpConfig,
  recipients: string[],
  subject: string,
  html: string,
  pdfBase64?: string,
  pdfFilename: string = 'Demonstrativo_Plantao_Medico.pdf'
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

  const fromResp = await sendCommand(writer, reader, `MAIL FROM:<${smtp.smtp_from_email}>`);
  if (!fromResp.startsWith('250')) throw new Error(`MAIL FROM failed: ${fromResp}`);

  // Registra cada destinatário RCPT TO
  for (const rcpt of recipients) {
    const rcptResp = await sendCommand(writer, reader, `RCPT TO:<${rcpt}>`);
    if (!rcptResp.startsWith('250')) throw new Error(`RCPT TO failed for ${rcpt}: ${rcptResp}`);
  }

  const dataResp = await sendCommand(writer, reader, 'DATA');
  if (!dataResp.startsWith('354')) throw new Error(`DATA failed: ${dataResp}`);

  const mixedBoundary = `boundary_mixed_${Date.now()}`;
  const altBoundary = `boundary_alt_${Date.now()}`;

  const headers = [
    `From: ${smtp.smtp_from_name} <${smtp.smtp_from_email}>`,
    `To: ${recipients.join(', ')}`,
    `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
    `Date: ${new Date().toUTCString()}`,
    ``
  ];

  let body = [
    `--${mixedBoundary}`,
    `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
    ``,
    `--${altBoundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    ``,
    btoa(unescape(encodeURIComponent(html))),
    ``,
    `--${altBoundary}--`
  ];

  if (pdfBase64) {
    // Remove qualquer prefixo Data URI se presente
    const cleanBase64 = pdfBase64.includes('base64,') 
      ? pdfBase64.split('base64,')[1] 
      : pdfBase64.replace(/\s+/g, '');

    // Formatar Base64 em linhas de 76 caracteres (Padrão RFC 2045 para anexos MIME em SMTP)
    const formattedBase64 = cleanBase64.match(/.{1,76}/g)?.join('\r\n') || cleanBase64;

    body = body.concat([
      ``,
      `--${mixedBoundary}`,
      `Content-Type: application/pdf; name="${pdfFilename}"`,
      `Content-Disposition: attachment; filename="${pdfFilename}"`,
      `Content-Transfer-Encoding: base64`,
      ``,
      formattedBase64
    ]);
  }

  body.push(`--${mixedBoundary}--`, `.`, ``);

  const message = headers.concat(body).join('\r\n');
  const endResp = await sendCommand(writer, reader, message);
  if (!endResp.startsWith('250')) throw new Error(`Send failed: ${endResp}`);

  await sendCommand(writer, reader, 'QUIT');

  try {
    reader.releaseLock();
    writer.releaseLock();
    conn.close();
  } catch { /* cleanup */ }
}

const formatCurrency = (val: number = 0) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
};

// ---------- Template HTML Profissional com Design HSC ----------
function buildPlantaoEmailHtml(payload: SendPlantaoEmailPayload): string {
  const logoHtml = `<img src="${LOGO_URL}" alt="Santa Casa de Araguari" height="54" style="display:block;height:54px;width:auto;outline:none;text-decoration:none;margin:0 auto;" />`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.06);border:1px solid #e2e8f0;">
          
          <!-- Header Banner -->
          <tr>
            <td style="background:linear-gradient(135deg, #8a1515 0%, #5e0b0b 100%);padding:28px 24px;text-align:center;">
              ${logoHtml}
              <div style="margin-top:14px;color:#fecdd3;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;font-weight:700;">
                Setor Financeiro & Escalas Médicas
              </div>
            </td>
          </tr>

          <!-- Conteúdo Principal -->
          <tr>
            <td style="padding:32px 32px 20px;">
              <h2 style="margin:0 0 10px;color:#0f172a;font-size:20px;font-weight:700;">
                Olá, Dr(a). ${payload.nomeMedico}! 👋
              </h2>
              <p style="margin:0 0 20px;color:#475569;font-size:14px;line-height:1.6;">
                Segue o <strong>Demonstrativo Consolidado de Plantões e Honorários Médicos</strong> referente ao período de <strong>${payload.periodoReferencia}</strong>.
              </p>

              <!-- Card de Resumo Financeiro -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;margin-bottom:24px;">
                <tr>
                  <td style="padding:18px 20px;">
                    <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:12px;">
                      📊 Resumo do Período
                    </div>
                    <table width="100%" cellpadding="4" cellspacing="0" style="font-size:13px;color:#334155;">
                      ${(payload.tipoPlantao || payload.resumo?.tipoPlantao) ? `
                      <tr>
                        <td>Tipo de Plantão:</td>
                        <td align="right" style="font-weight:700;color:#0f172a;">${payload.tipoPlantao || payload.resumo?.tipoPlantao}</td>
                      </tr>` : ''}
                      <tr>
                        <td>Total de Plantões:</td>
                        <td align="right" style="font-weight:700;color:#0f172a;">${payload.resumo.totalPlantoes} plantão(ões)</td>
                      </tr>
                      <tr>
                        <td>Valor de Plantões:</td>
                        <td align="right" style="font-weight:600;">${formatCurrency(payload.resumo.valorPlantoes)}</td>
                      </tr>
                      ${payload.resumo.valorProducao > 0 ? `
                      <tr>
                        <td>Produção / Adicionais:</td>
                        <td align="right" style="font-weight:600;">${formatCurrency(payload.resumo.valorProducao)}</td>
                      </tr>` : ''}
                      <tr>
                        <td style="border-top:1px solid #cbd5e1;padding-top:8px;font-weight:700;color:#8a1515;font-size:14px;">Total Geral:</td>
                        <td align="right" style="border-top:1px solid #cbd5e1;padding-top:8px;font-weight:800;color:#8a1515;font-size:15px;">${formatCurrency(payload.resumo.valorTotalGeral)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Aviso do PDF Anexo -->
              <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:14px 16px;margin-bottom:24px;display:flex;align-items:center;">
                <span style="font-size:18px;margin-right:10px;">📎</span>
                <span style="font-size:13px;color:#065f46;line-height:1.5;">
                  O relatório detalhado com a discriminação de todas as datas, especialidades e valores está <strong>anexado a este e-mail em formato PDF</strong>.
                </span>
              </div>

              <!-- Dados Cadastrais / Faturamento da Santa Casa -->
              <div style="margin-top:24px;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
                <div style="background:#f8fafc;padding:10px 16px;border-bottom:1px solid #e2e8f0;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.8px;">
                  🏢 Dados da Instituição para Emissão / Contato
                </div>
                <div style="padding:14px 16px;background:#ffffff;font-size:12.5px;color:#334155;line-height:1.7;">
                  <div><strong>RAZÃO SOCIAL:</strong> SANTA CASA DE MISERICORDIA DE ARAGUARI</div>
                  <div><strong>CNPJ:</strong> 16.826.067/0001-10</div>
                  <div><strong>ENDEREÇO:</strong> PRAÇA DOM ALMIR MARQUES, Nº 2 - BAIRRO ROSÁRIO</div>
                  <div><strong>CEP:</strong> 38440-036 - ARAGUARI/MG</div>
                  <div style="margin-top:6px;padding-top:6px;border-top:1px dashed #e2e8f0;">
                    <div><strong>E-MAIL FINANCEIRO:</strong> <a href="mailto:contasapagar@santacasaaraguari.org.br" style="color:#8a1515;text-decoration:none;font-weight:600;">contasapagar@santacasaaraguari.org.br</a></div>
                    <div><strong>CONTATO / WHATSAPP:</strong> <span style="font-weight:600;color:#0f172a;">(34) 98852-1601</span> (Edna e/ou Poliana)</div>
                  </div>
                </div>
              </div>

              <p style="margin:20px 0 0;color:#64748b;font-size:12.5px;line-height:1.6;">
                Em caso de dúvidas ou divergências nas informações, favor entrar em contato através dos canais acima.
              </p>
            </td>
          </tr>

          <!-- Rodapé Institucional -->
          <tr>
            <td style="background:#f1f5f9;padding:20px 32px;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0 0 4px;color:#64748b;font-size:12px;font-weight:600;">
                Hospital Santa Casa de Misericórdia de Araguari
              </p>
              <p style="margin:0;color:#94a3b8;font-size:11px;">
                E-mail automático enviado pelo Setor Financeiro • contasapagar@santacasaaraguari.org.br
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

// ---------- Handler Deno Server ----------
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

  // Validação de Autorização
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  let isAuthorized = token === SUPABASE_SERVICE_ROLE_KEY;

  if (!isAuthorized && token) {
    try {
      const supabaseClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY') || '', {
        global: { headers: { Authorization: authHeader } }
      });
      const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
      if (!userError && user) isAuthorized = true;
    } catch (e) {
      console.error('[SMTP Auth] Erro ao verificar JWT:', e);
    }
  }

  if (!isAuthorized) {
    return new Response(
      JSON.stringify({ error: 'Acesso não autorizado.' }),
      { status: 401, headers: corsHeaders }
    );
  }

  try {
    const payload: SendPlantaoEmailPayload = await req.json();
    
    // Normalizar lista de e-mails destinatários
    const recipients = Array.isArray(payload.to) 
      ? payload.to.filter(e => e && e.includes('@')) 
      : [payload.to].filter(e => e && e.includes('@'));

    if (recipients.length === 0 || !payload.nomeMedico) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatórios ausentes: to (e-mails válidos), nomeMedico' }), 
        { status: 400, headers: corsHeaders }
      );
    }

    const smtp = await getSmtpConfig();
    const subject = `Demonstrativo de Plantões e Honorários Médicos - ${payload.periodoReferencia} | Santa Casa de Araguari`;
    const html = buildPlantaoEmailHtml(payload);

    await sendEmailViaSMTP(
      smtp, 
      recipients, 
      subject, 
      html, 
      payload.pdfBase64, 
      payload.pdfFilename || `Demonstrativo_Plantao_${payload.nomeMedico.replace(/\s+/g, '_')}.pdf`
    );

    return new Response(JSON.stringify({ success: true, recipientsCount: recipients.length }), { headers: corsHeaders });
  } catch (err: any) {
    console.error('[Send Plantao Email] Erro:', err);
    return new Response(JSON.stringify({ error: err.message || 'Falha ao enviar e-mail de plantão médico.' }), { status: 500, headers: corsHeaders });
  }
});
