import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

interface ImapSyncPayload {
  action?: 'test' | 'sync';
  imapHost?: string;
  imap_host?: string;
  imapPort?: string | number;
  imap_port?: string | number;
  imapUser?: string;
  imap_user?: string;
  imapPass?: string;
  imap_pass?: string;
  imapSecure?: 'ssl' | 'tls' | 'none';
  imap_secure?: 'ssl' | 'tls' | 'none';
  mailbox?: string;
  days_back?: number;
  maxMessages?: number;
  max_messages?: number;
  keywords?: string[];
  palavras_chave?: string[];
  buscarEm?: 'assunto_e_corpo' | 'apenas_assunto';
  apenasNaoLidos?: boolean;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

// Lê resposta IMAP até encontrar a tag de finalização (ex: "A001 OK" / "A001 NO" / "A001 BAD")
async function readImapUntilTag(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  tag: string,
  timeoutMs = 10000
): Promise<string> {
  let buffer = '';
  const start = Date.now();
  const tagRegex = new RegExp(`(^|\\r\\n)${tag}\\s+(OK|NO|BAD)\\b`, 'i');

  while (Date.now() - start < timeoutMs) {
    const readPromise = reader.read();
    const timeoutPromise = new Promise<{ value: undefined; done: boolean }>(resolve =>
      setTimeout(() => resolve({ value: undefined, done: true }), 2500)
    );
    const { value, done } = await Promise.race([readPromise, timeoutPromise]);
    if (value) {
      buffer += decoder.decode(value, { stream: true });
      if (tagRegex.test(buffer)) break;
    }
    if (done) break;
  }
  return buffer;
}

async function sendImapCommand(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  reader: ReadableStreamDefaultReader<Uint8Array>,
  tag: string,
  cmd: string,
  timeoutMs = 10000
): Promise<string> {
  await writer.write(encoder.encode(`${tag} ${cmd}\r\n`));
  return await readImapUntilTag(reader, tag, timeoutMs);
}

// Decodifica cabeçalhos MIME encoded-word (=?UTF-8?B?...?= ou =?UTF-8?Q?...?=)
function decodeMimeWords(str: string): string {
  if (!str) return '';
  return str.replace(/=\?([^?]+)\?([BQbq])\?([^?]*)\?=/g, (_match, charset, encoding, text) => {
    try {
      const enc = encoding.toUpperCase();
      if (enc === 'B') {
        const binary = atob(text.replace(/\s/g, ''));
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return new TextDecoder(charset || 'utf-8').decode(bytes);
      } else if (enc === 'Q') {
        const qText = text
          .replace(/_/g, ' ')
          .replace(/=([0-9A-Fa-f]{2})/g, (_: string, hex: string) => String.fromCharCode(parseInt(hex, 16)));
        const bytes = new Uint8Array(qText.length);
        for (let i = 0; i < qText.length; i++) bytes[i] = qText.charCodeAt(i);
        return new TextDecoder(charset || 'utf-8').decode(bytes);
      }
    } catch {
      return text;
    }
    return text;
  });
}

// Extrai telefone brasileiro do texto do e-mail
function extractPhoneFromText(text: string): string | null {
  if (!text) return null;
  const regex = /(?:\+?55\s*)?(?:\(?\d{2}\)?[\s.-]*)?\d{4,5}[\s.-]?\d{4}/g;
  const matches = text.match(regex);
  if (!matches) return null;
  for (const m of matches) {
    const digits = m.replace(/\D/g, '');
    if (digits.length === 10 || digits.length === 11) {
      const ddd = digits.slice(0, 2);
      const rest = digits.slice(2);
      return rest.length === 9
        ? `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`
        : `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
    }
  }
  return null;
}

// Identifica a vaga a partir do assunto do e-mail
function extractVagaFromSubject(subject: string): string {
  if (!subject) return 'Geral / Banco de Talentos';
  const clean = subject
    .replace(/^(re|enc|fwd|fw)\s*:\s*/gi, '')
    .trim();

  // Tenta capturar após "vaga", "vaga de", "vaga para", "cargo"
  const vagaMatch = clean.match(/(?:vaga\s*(?:de|para|:|-)?\s*|cargo\s*(?:de|:|-)?\s*)([a-zA-ZÀ-ÿ\s/()-]{3,45})/i);
  if (vagaMatch && vagaMatch[1]) {
    const candidate = vagaMatch[1].split(/[-–|•]/)[0].trim();
    if (candidate.length >= 3) return candidate;
  }

  return clean.length <= 50 ? clean : 'Geral / Banco de Talentos';
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
    const payload: ImapSyncPayload = await req.json();
    const host = (payload.imapHost || payload.imap_host || '').trim();
    const port = Number(payload.imapPort || payload.imap_port || 993);
    const user = (payload.imapUser || payload.imap_user || '').trim();
    const pass = payload.imapPass ?? payload.imap_pass ?? '';
    const secure = payload.imapSecure || payload.imap_secure || (port === 993 ? 'ssl' : 'tls');
    const useTls = secure !== 'none' && (port === 993 || secure === 'ssl');
    const mailbox = payload.mailbox || 'INBOX';
    const rawKeywords = payload.keywords || payload.palavras_chave;
    const keywords = (rawKeywords && rawKeywords.length > 0)
      ? rawKeywords
      : ['Currículo', 'Curriculo', 'Vaga', 'Seleção', 'CV', 'Trabalhe Conosco'];

    if (!host || !user || !pass) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Informe o Host IMAP, E-mail e Senha nas configurações de leitura de e-mail.',
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    let conn: Deno.TcpConn | Deno.TlsConn;
    if (useTls) {
      conn = await Deno.connectTls({ hostname: host, port });
    } else {
      conn = await Deno.connect({ hostname: host, port });
    }

    const reader = conn.readable.getReader();
    const writer = conn.writable.getWriter();

    // Lê saudação inicial do servidor IMAP
    await new Promise(r => setTimeout(r, 350));
    const greetingChunk = await reader.read();
    const greeting = greetingChunk.value ? decoder.decode(greetingChunk.value) : '';
    if (!greeting.includes('OK')) {
      throw new Error(`Servidor IMAP não respondeu corretamente: ${greeting.slice(0, 120)}`);
    }

    // Autenticação LOGIN
    const escapedPass = pass.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const loginResp = await sendImapCommand(writer, reader, 'A001', `LOGIN "${user}" "${escapedPass}"`);
    if (!/A001\s+OK/i.test(loginResp)) {
      throw new Error('Falha na autenticação IMAP. Verifique o e-mail e a senha informados.');
    }

    // Seleciona a caixa de entrada (INBOX)
    const selectResp = await sendImapCommand(writer, reader, 'A002', `SELECT "${mailbox}"`);
    if (!/A002\s+OK/i.test(selectResp)) {
      throw new Error(`Não foi possível abrir a caixa de e-mail "${mailbox}".`);
    }

    const existsMatch = selectResp.match(/\*\s+(\d+)\s+EXISTS/i);
    const totalMessages = existsMatch ? parseInt(existsMatch[1], 10) : 0;

    // Se for apenas teste de conexão, finaliza e retorna sucesso
    if (payload.action === 'test') {
      await sendImapCommand(writer, reader, 'A099', 'LOGOUT', 3000);
      try {
        reader.releaseLock();
        writer.releaseLock();
        conn.close();
      } catch { /* ignore */ }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Conexão IMAP estabelecida com sucesso! Caixa "${mailbox}" possui ${totalMessages} mensagens.`,
          totalMessages,
        }),
        { headers: corsHeaders }
      );
    }

    // Busca as últimas N mensagens da caixa de entrada para inspecionar assunto/remetente/corpo
    const maxToInspect = Math.min(payload.max_messages || 25, totalMessages);
    const candidatosEncontrados: any[] = [];

    if (totalMessages > 0 && maxToInspect > 0) {
      const startSeq = Math.max(1, totalMessages - maxToInspect + 1);
      const fetchCmd = `FETCH ${startSeq}:${totalMessages} (UID BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE MESSAGE-ID)] BODY.PEEK[TEXT]<0.1500>)`;
      const fetchResp = await sendImapCommand(writer, reader, 'A003', fetchCmd, 15000);

      // Divide cada mensagem retornada pelo FETCH
      const blocks = fetchResp.split(/\*\s+\d+\s+FETCH\s+\(/i).slice(1);

      for (const block of blocks) {
        const subjectMatch = block.match(/Subject:\s*([^\r\n]+(?:\r?\n[ \t]+[^\r\n]+)*)/i);
        const fromMatch = block.match(/From:\s*([^\r\n]+(?:\r?\n[ \t]+[^\r\n]+)*)/i);
        const dateMatch = block.match(/Date:\s*([^\r\n]+)/i);
        const msgIdMatch = block.match(/Message-ID:\s*([^\r\n]+)/i);

        const rawSubject = subjectMatch ? decodeMimeWords(subjectMatch[1].replace(/\r?\n[ \t]+/g, ' ').trim()) : '';
        const rawFrom = fromMatch ? decodeMimeWords(fromMatch[1].replace(/\r?\n[ \t]+/g, ' ').trim()) : '';
        const rawDate = dateMatch ? dateMatch[1].trim() : '';
        const rawMsgId = msgIdMatch ? msgIdMatch[1].trim() : `${user}-${rawDate}-${rawSubject}`;

        // Extrai nome e e-mail do From
        const emailMatch = rawFrom.match(/<([^>]+)>/) || rawFrom.match(/([a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
        const fromEmail = emailMatch ? emailMatch[1].trim().toLowerCase() : '';
        if (!fromEmail || fromEmail === user.toLowerCase()) continue;

        let fromName = rawFrom
          .replace(/<[^>]+>/g, '')
          .replace(/["']/g, '')
          .trim();
        if (!fromName || fromName.includes('@')) {
          fromName = fromEmail.split('@')[0].replace(/[._-]/g, ' ');
        }

        // Verifica se o assunto ou trecho do corpo contém alguma das palavras-chave
        const fullTextForSearch = `${rawSubject} ${block}`.toLowerCase();
        const matchedKeywords = keywords.filter(kw =>
          fullTextForSearch.includes(kw.toLowerCase().trim())
        );

        if (matchedKeywords.length === 0) continue;

        const phone = extractPhoneFromText(block);
        const vaga = extractVagaFromSubject(rawSubject);
        let parsedDate = new Date().toISOString();
        if (rawDate) {
          const d = new Date(rawDate);
          if (!isNaN(d.getTime())) parsedDate = d.toISOString();
        }

        candidatosEncontrados.push({
          nome_candidato: fromName,
          email_candidato: fromEmail,
          telefone: phone,
          vaga_identificada: vaga,
          assunto_email: rawSubject || 'Currículo recebido por e-mail',
          palavras_chave_detectadas: matchedKeywords,
          resumo_perfil: `Capturado automaticamente da caixa ${user} via palavras-chave: ${matchedKeywords.join(', ')}.`,
          email_message_id: rawMsgId,
          data_recebimento: parsedDate,
          origem: 'email_n8n',
        });
      }
    }

    await sendImapCommand(writer, reader, 'A099', 'LOGOUT', 3000);
    try {
      reader.releaseLock();
      writer.releaseLock();
      conn.close();
    } catch { /* ignore */ }

    // Salva no Supabase se a tabela existir
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY && candidatosEncontrados.length > 0) {
      try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        await supabase
          .from('rh_candidatos_triagem')
          .upsert(candidatosEncontrados, { onConflict: 'email_message_id', ignoreDuplicates: true });
      } catch (e) {
        console.warn('[sync-rh-emails] Aviso ao gravar no banco:', e);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        totalMessages,
        novosImportados: candidatosEncontrados.length,
        candidatos: candidatosEncontrados,
      }),
      { headers: corsHeaders }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: err?.message || 'Erro ao conectar no servidor IMAP de e-mail.',
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});

