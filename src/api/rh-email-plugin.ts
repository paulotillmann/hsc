import fs from 'fs';
import path from 'path';
import net from 'net';
import tls from 'tls';
import zlib from 'zlib';
import type { Plugin } from 'vite';

const CURRICULOS_DIR = path.resolve('public', 'curriculos');

// Garante que a pasta public/curriculos exista para servir PDFs, DOCXs e Imagens extraídos dos e-mails
function ensureCurriculosDir() {
  if (!fs.existsSync(CURRICULOS_DIR)) {
    fs.mkdirSync(CURRICULOS_DIR, { recursive: true });
  }
}

// Decodifica cabeçalhos MIME encoded-word (=?UTF-8?B?...?= ou =?UTF-8?Q?...?=)
function decodeMimeWords(str: string): string {
  if (!str) return '';
  return str.replace(/=\?([^?]+)\?([BQbq])\?([^?]*)\?=/g, (_match, charset, encoding, text) => {
    try {
      const enc = String(encoding).toUpperCase();
      const normCharset = String(charset || 'utf-8').toLowerCase();
      const bufEncoding: BufferEncoding =
        normCharset.includes('iso-8859-1') || normCharset.includes('latin1') ? 'latin1' : 'utf8';

      if (enc === 'B') {
        return Buffer.from(text.replace(/\s/g, ''), 'base64').toString(bufEncoding);
      } else if (enc === 'Q') {
        const qText = text.replace(/_/g, ' ');
        const bytes: number[] = [];
        for (let i = 0; i < qText.length; i++) {
          if (qText[i] === '=' && /^[0-9A-Fa-f]{2}$/.test(qText.slice(i + 1, i + 3))) {
            bytes.push(parseInt(qText.slice(i + 1, i + 3), 16));
            i += 2;
          } else {
            bytes.push(qText.charCodeAt(i));
          }
        }
        return Buffer.from(bytes).toString(bufEncoding);
      }
    } catch {
      return text;
    }
    return text;
  });
}

// Decodifica conteúdo Quoted-Printable em UTF-8 ou Latin1
function decodeQuotedPrintable(input: string, charset = 'utf-8'): string {
  if (!input) return '';
  const softBreakRemoved = input.replace(/=\r?\n/g, '');
  const bytes: number[] = [];
  for (let i = 0; i < softBreakRemoved.length; i++) {
    if (
      softBreakRemoved[i] === '=' &&
      /^[0-9A-Fa-f]{2}$/.test(softBreakRemoved.slice(i + 1, i + 3))
    ) {
      bytes.push(parseInt(softBreakRemoved.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(softBreakRemoved.charCodeAt(i));
    }
  }
  const norm = charset.toLowerCase();
  const enc: BufferEncoding =
    norm.includes('iso-8859-1') || norm.includes('latin1') || norm.includes('windows-1252')
      ? 'latin1'
      : 'utf8';
  return Buffer.from(bytes).toString(enc);
}

// Remove tags HTML preservando quebras de linha para facilitar leitura de telefones e textos
function stripHtmlToText(html: string): string {
  if (!html) return '';
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<\/(p|div|tr|li|h[1-6]|br)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(Number(code)))
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export interface ParsedAttachment {
  filename: string;
  contentType: string;
  kind: 'pdf' | 'word' | 'image';
  buffer: Buffer;
}

interface ParsedEmailResult {
  textBody: string;
  attachments: ParsedAttachment[];
}

// Extrai nome de arquivo de Content-Disposition ou Content-Type
function extractFilenameFromHeaders(contentDisposition: string, contentType: string): string | null {
  const combined = `${contentDisposition}; ${contentType}`;

  const rfc2231Match = combined.match(/(?:filename|name)\*\s*=\s*([^;'"]+)''([^;\r\n"']+)/i);
  if (rfc2231Match && rfc2231Match[2]) {
    try {
      return decodeURIComponent(rfc2231Match[2].trim());
    } catch {
      return rfc2231Match[2].trim();
    }
  }

  const normalMatch =
    combined.match(/(?:filename|name)\s*=\s*"([^"]+)"/i) ||
    combined.match(/(?:filename|name)\s*=\s*([^;\s\r\n]+)/i);
  if (normalMatch && normalMatch[1]) {
    return decodeMimeWords(normalMatch[1].trim().replace(/^["']|["']$/g, ''));
  }

  return null;
}

// Parser recursivo de mensagem MIME:
// Captura texto/HTML, anexos PDF, Word (.docx/.doc) E imagens (anexadas ou coladas inline no corpo do e-mail)
function parseMimeMessage(rawMime: string): ParsedEmailResult {
  const result: ParsedEmailResult = {
    textBody: '',
    attachments: [],
  };

  let inlineImgCounter = 1;

  function walkEntity(entityRaw: string) {
    const sepMatch = entityRaw.match(/\r?\n\r?\n/);
    if (!sepMatch || sepMatch.index === undefined) return;

    const headerPart = entityRaw.slice(0, sepMatch.index).replace(/\r?\n[ \t]+/g, ' ');
    const bodyPart = entityRaw.slice(sepMatch.index + sepMatch[0].length);

    const ctMatch = headerPart.match(/^Content-Type:\s*([^\r\n]+)/im);
    const cteMatch = headerPart.match(/^Content-Transfer-Encoding:\s*([^\r\n]+)/im);
    const cdMatch = headerPart.match(/^Content-Disposition:\s*([^\r\n]+)/im);

    const contentTypeLine = ctMatch ? ctMatch[1].trim() : 'text/plain';
    const transferEncoding = cteMatch ? cteMatch[1].trim().toLowerCase() : '7bit';
    const contentDispositionLine = cdMatch ? cdMatch[1].trim() : '';

    const charsetMatch = contentTypeLine.match(/charset\s*=\s*"?([^";\s]+)"?/i);
    const charset = charsetMatch ? charsetMatch[1] : 'utf-8';

    // Se for multipart/* (mixed, alternative, related), percorre todas as partes filhas
    if (/^multipart\//i.test(contentTypeLine)) {
      const boundaryMatch =
        contentTypeLine.match(/boundary\s*=\s*"([^"]+)"/i) ||
        contentTypeLine.match(/boundary\s*=\s*([^;\s\r\n]+)/i);
      if (boundaryMatch && boundaryMatch[1]) {
        const boundary = boundaryMatch[1].trim();
        const escapedBoundary = boundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const parts = bodyPart.split(new RegExp(`--${escapedBoundary}(?:--)?\\r?\\n?`));
        for (let i = 1; i < parts.length; i++) {
          const part = parts[i];
          if (!part || !part.trim() || part.trim() === '--') continue;
          walkEntity(part);
        }
        return;
      }
    }

    const filename = extractFilenameFromHeaders(contentDispositionLine, contentTypeLine);
    const lowerCt = contentTypeLine.toLowerCase();
    const lowerFn = (filename || '').toLowerCase();

    const isPdf =
      lowerCt.includes('application/pdf') || lowerFn.endsWith('.pdf');
    const isWord =
      lowerCt.includes('msword') ||
      lowerCt.includes('wordprocessingml') ||
      lowerCt.includes('officedocument') ||
      lowerFn.endsWith('.docx') ||
      lowerFn.endsWith('.doc') ||
      lowerFn.endsWith('.rtf');
    const isImage =
      lowerCt.startsWith('image/') ||
      /\.(png|jpe?g|webp)$/i.test(lowerFn);

    if (isPdf || isWord || isImage || (/^attachment/i.test(contentDispositionLine) && filename)) {
      let fileBuffer: Buffer | null = null;
      if (transferEncoding === 'base64') {
        const cleanB64 = bodyPart
          .replace(/\)\s*$/, '')
          .replace(/[^A-Za-z0-9+/=]/g, '');
        if (cleanB64.length > 64) {
          fileBuffer = Buffer.from(cleanB64, 'base64');
        }
      } else if (transferEncoding === 'quoted-printable') {
        fileBuffer = Buffer.from(decodeQuotedPrintable(bodyPart, 'latin1'), 'latin1');
      }

      if (fileBuffer && fileBuffer.length > 200) {
        const magicHex = fileBuffer.slice(0, 4).toString('hex').toLowerCase();
        const isMagicPdf = fileBuffer.slice(0, 5).toString('ascii') === '%PDF-';
        const isMagicZipDocx = magicHex === '504b0304'; // PK.. (.docx)
        const isMagicOldDoc = magicHex === 'd0cf11e0'; // OLE2 (.doc)
        const isMagicPng = magicHex === '89504e47';
        const isMagicJpg = magicHex.startsWith('ffd8ff');

        let detectedKind: 'pdf' | 'word' | 'image' | null = null;
        let defaultExt = '.bin';

        if (isPdf || isMagicPdf) {
          detectedKind = 'pdf';
          defaultExt = '.pdf';
        } else if (isWord || isMagicZipDocx || isMagicOldDoc) {
          detectedKind = 'word';
          defaultExt = isMagicZipDocx || lowerFn.endsWith('.docx') ? '.docx' : '.doc';
        } else if (isImage || isMagicPng || isMagicJpg) {
          // Ignora logos de assinatura, banners e ícones pequenos (< 18KB ou com nome de logo/assinatura)
          const cleanFn = (filename || '').toLowerCase();
          const isLogoOrSignatureName =
            /^(logo|logomarca|assinatura|signature|banner|header|footer|rodape|icon|icone|selo|badge|avatar|image00\d|outlook)/i.test(
              cleanFn
            ) || /(?:^|[_-\s])(logo|logomarca|assinatura|signature|banner)(?:[_-\s.]|$)/i.test(cleanFn);

          if (!isLogoOrSignatureName && fileBuffer.length >= 18432) {
            detectedKind = 'image';
            defaultExt = isMagicPng || lowerCt.includes('png') ? '.png' : '.jpg';
          }
        }

        if (detectedKind) {
          let finalName = filename || `Curriculo_${inlineImgCounter++}${defaultExt}`;
          if (!/\.[a-z0-9]{2,5}$/i.test(finalName)) {
            finalName += defaultExt;
          }
          result.attachments.push({
            filename: finalName,
            contentType:
              detectedKind === 'pdf'
                ? 'application/pdf'
                : detectedKind === 'image'
                  ? isMagicPng
                    ? 'image/png'
                    : 'image/jpeg'
                  : contentTypeLine.split(';')[0],
            kind: detectedKind,
            buffer: fileBuffer,
          });
        }
      }
      return;
    }

    // Parte de texto ou HTML do corpo do e-mail
    if (/^text\/(plain|html)/i.test(contentTypeLine)) {
      let decodedText = '';
      if (transferEncoding === 'base64') {
        const cleanB64 = bodyPart.replace(/[^A-Za-z0-9+/=]/g, '');
        const norm = charset.toLowerCase();
        const enc: BufferEncoding =
          norm.includes('iso-8859-1') || norm.includes('latin1') ? 'latin1' : 'utf8';
        decodedText = Buffer.from(cleanB64, 'base64').toString(enc);
      } else if (transferEncoding === 'quoted-printable') {
        decodedText = decodeQuotedPrintable(bodyPart, charset);
      } else {
        decodedText = bodyPart;
      }

      if (/^text\/html/i.test(contentTypeLine)) {
        // Verifica se há imagens coladas como Data URI (<img src="data:image/png;base64,...">) no HTML do e-mail!
        const dataUriRegex = /data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=\s]+)/gi;
        let dMatch: RegExpExecArray | null;
        while ((dMatch = dataUriRegex.exec(decodedText)) !== null) {
          const ext = dMatch[1].toLowerCase() === 'png' ? '.png' : '.jpg';
          const b64 = dMatch[2].replace(/\s+/g, '');
          const imgBuf = Buffer.from(b64, 'base64');
          if (imgBuf.length >= 10240) {
            result.attachments.push({
              filename: `Curriculo_Imagem_Corpo_${inlineImgCounter++}${ext}`,
              contentType: ext === '.png' ? 'image/png' : 'image/jpeg',
              kind: 'image',
              buffer: imgBuf,
            });
          }
        }
        decodedText = stripHtmlToText(decodedText);
      }

      if (decodedText.trim()) {
        result.textBody += (result.textBody ? '\n\n' : '') + decodedText.trim();
      }
    }
  }

  walkEntity(rawMime);
  return result;
}

// ── 1. Extrator de Texto de PDF (pdfjs-dist) ─────────────────────────────────
async function extractTextFromPdfBuffer(pdfBuffer: Buffer): Promise<string> {
  try {
    const pdfjsLib: any = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const uint8Array = new Uint8Array(pdfBuffer);
    const loadingTask = pdfjsLib.getDocument({
      data: uint8Array,
      useSystemFonts: true,
      disableFontFace: true,
      verbosity: 0,
    });
    const doc = await loadingTask.promise;
    const maxPages = Math.min(doc.numPages || 1, 5);
    const pagesText: string[] = [];

    for (let p = 1; p <= maxPages; p++) {
      const page = await doc.getPage(p);
      const textContent = await page.getTextContent();
      const pageStr = (textContent.items || [])
        .map((item: any) => item.str || '')
        .join(' ');
      if (pageStr.trim()) {
        pagesText.push(pageStr.trim());
      }
    }

    return pagesText.join('\n');
  } catch (err: any) {
    console.warn('[rh-email-plugin] Aviso ao extrair texto do PDF via pdfjs:', err?.message);
    return '';
  }
}

// ── 2. Extrator de Texto de Word (.docx via ZIP/XML nativo e .doc binário) ───
function extractTextFromWordBuffer(wordBuffer: Buffer): string {
  try {
    // Verifica assinatura ZIP (PK\x03\x04 -> .docx)
    if (wordBuffer.length > 4 && wordBuffer.readUInt32LE(0) === 0x04034b50) {
      const extractedParts: string[] = [];

      // Procura entradas no Central Directory (0x02014b50) para ter tamanhos exatos mesmo com Data Descriptor
      let pos = 0;
      while (pos < wordBuffer.length - 46) {
        const sig = wordBuffer.readUInt32LE(pos);
        if (sig === 0x02014b50) {
          const compressionMethod = wordBuffer.readUInt16LE(pos + 10);
          const compressedSize = wordBuffer.readUInt32LE(pos + 20);
          const fnLen = wordBuffer.readUInt16LE(pos + 28);
          const extraLen = wordBuffer.readUInt16LE(pos + 30);
          const commentLen = wordBuffer.readUInt16LE(pos + 32);
          const localHeaderOffset = wordBuffer.readUInt32LE(pos + 42);

          const entryName = wordBuffer.slice(pos + 46, pos + 46 + fnLen).toString('utf8');

          // Lê document.xml, header1/2/3.xml e footer1/2/3.xml (muitos currículos têm nome/telefone no cabeçalho!)
          if (/^word\/(document|header\d*|footer\d*)\.xml$/i.test(entryName)) {
            if (localHeaderOffset + 30 < wordBuffer.length) {
              const localFnLen = wordBuffer.readUInt16LE(localHeaderOffset + 26);
              const localExtraLen = wordBuffer.readUInt16LE(localHeaderOffset + 28);
              const dataStart = localHeaderOffset + 30 + localFnLen + localExtraLen;
              const compSlice = wordBuffer.slice(dataStart, dataStart + compressedSize);

              let xmlStr = '';
              if (compressionMethod === 0) {
                xmlStr = compSlice.toString('utf8');
              } else if (compressionMethod === 8) {
                xmlStr = zlib.inflateRawSync(compSlice).toString('utf8');
              }

              if (xmlStr) {
                const plain = xmlStr
                  .replace(/<\/w:(p|tr)>/gi, '\n')
                  .replace(/<w:(br|cr)\b[^>]*\/?>/gi, '\n')
                  .replace(/<w:tab\b[^>]*\/?>/gi, ' ')
                  .replace(/<[^>]+>/g, '')
                  .replace(/&amp;/g, '&')
                  .replace(/&lt;/g, '<')
                  .replace(/&gt;/g, '>')
                  .replace(/&quot;/g, '"')
                  .replace(/&apos;/g, "'")
                  .replace(/[ \t]+/g, ' ')
                  .trim();
                if (plain) extractedParts.push(plain);
              }
            }
          }

          pos += 46 + fnLen + extraLen + commentLen;
        } else {
          pos++;
        }
      }

      if (extractedParts.length > 0) {
        return extractedParts.join('\n');
      }
    }

    // Fallback para arquivos .doc antigos (Word 97-2003 OLE2 ou RTF)
    const latinText = wordBuffer
      .toString('latin1')
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ');
    const blocks = latinText.match(/[A-Za-zÀ-ÿ0-9(),.:;/+-\s]{8,}/g) || [];
    const utf16Text = wordBuffer
      .toString('utf16le')
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ');
    const utf16Blocks = utf16Text.match(/[A-Za-zÀ-ÿ0-9(),.:;/+-\s]{8,}/g) || [];

    return [...blocks, ...utf16Blocks].join('\n').slice(0, 8000);
  } catch (err: any) {
    console.warn('[rh-email-plugin] Aviso ao ler arquivo Word:', err?.message);
    return '';
  }
}

// ── 3. Extrator OCR de Imagem (tesseract.js para currículos enviados como foto/print) ──
async function extractTextFromImageBuffer(imageBuffer: Buffer): Promise<string> {
  try {
    const Tesseract: any = await import('tesseract.js');
    const recognizeFn = Tesseract.recognize || Tesseract.default?.recognize;
    if (!recognizeFn) return '';

    const { data } = await recognizeFn(imageBuffer, 'por', {
      logger: () => {},
    });
    return (data?.text || '').trim();
  } catch (err: any) {
    console.warn('[rh-email-plugin] Aviso no OCR de imagem do currículo:', err?.message);
    return '';
  }
}

// Extrai telefone brasileiro (celular/WhatsApp ou fixo) do corpo do e-mail, PDF, Word ou OCR de imagem
function extractPhoneFromText(text: string): string | null {
  if (!text) return null;

  const normalized = text
    .replace(/[\u00A0\u2000-\u200B]/g, ' ')
    .replace(/[–—−]/g, '-');

  // 1. Prioriza telefones próximos a palavras como Tel, Telefone, Celular, WhatsApp, Contato, Fone, Recado
  const labeledRegex =
    /(?:tel(?:efone)?|cel(?:ular)?|whats(?:app)?|contato|fone|recado)\s*[:.-]?\s*(?:\+?55\s*)?(?:\(?\s*0?(\d{2})\s*\)?[\s.-]*)?(9?\s*\d{4}[\s.-]*\d{4})/gi;
  let labeledMatch: RegExpExecArray | null;
  while ((labeledMatch = labeledRegex.exec(normalized)) !== null) {
    const ddd = labeledMatch[1] || '34';
    const numDigits = labeledMatch[2].replace(/\D/g, '');
    if (numDigits.length === 8 || numDigits.length === 9) {
      return numDigits.length === 9
        ? `(${ddd}) ${numDigits.slice(0, 5)}-${numDigits.slice(5)}`
        : `(${ddd}) ${numDigits.slice(0, 4)}-${numDigits.slice(4)}`;
    }
  }

  // 2. Busca geral de telefones com DDD brasileiro: (34) 99999-9999, (34) 9 9999-9999, 34 99999-9999, 34999999999
  const generalRegex =
    /(?:\+?55[\s.-]*)?(?:\(\s*0?([1-9]\d)\s*\)|(?:\b0?([1-9]\d)))[\s.-]*(9?[\s.]*\d{4})[\s.-]*(\d{4})\b/g;

  let match: RegExpExecArray | null;
  while ((match = generalRegex.exec(normalized)) !== null) {
    const fullMatch = match[0];
    const beforeChar = normalized[Math.max(0, match.index - 1)] || '';
    const afterChar = normalized[match.index + fullMatch.length] || '';
    if (/[./-]/.test(beforeChar) || /[./]/.test(afterChar)) continue;

    const ddd = match[1] || match[2];
    const part1 = match[3].replace(/\D/g, '');
    const part2 = match[4].replace(/\D/g, '');
    const totalNumber = part1 + part2;

    if (/^(19|20)\d{2}$/.test(part1) && /^(19|20)\d{2}$/.test(part2)) continue;
    if (totalNumber === '32491500' || totalNumber === '988521601') continue;

    if (ddd && (totalNumber.length === 8 || totalNumber.length === 9)) {
      return totalNumber.length === 9
        ? `(${ddd}) ${totalNumber.slice(0, 5)}-${totalNumber.slice(5)}`
        : `(${ddd}) ${totalNumber.slice(0, 4)}-${totalNumber.slice(4)}`;
    }
  }

  return null;
}

// Identifica a vaga pretendida a partir do assunto, corpo do e-mail ou texto do currículo (PDF/Word/Imagem)
function extractVagaFromEmailAndPdf(subject: string, emailBody: string, docText: string): string {
  const cleanSubject = (subject || '').replace(/^(re|enc|fwd|fw)\s*:\s*/gi, '').trim();

  const subjectVagaMatch = cleanSubject.match(
    /(?:vaga\s*(?:de|para|:|-)?\s*|cargo\s*(?:de|:|-)?\s*)([a-zA-ZÀ-ÿ\s/()-]{3,45})/i
  );
  if (subjectVagaMatch && subjectVagaMatch[1]) {
    const candidate = subjectVagaMatch[1].split(/[-–|•]/)[0].trim();
    if (candidate.length >= 3 && !/^(emprego|curriculo|currículo|trabalho)$/i.test(candidate)) {
      return candidate;
    }
  }

  const combinedText = `${cleanSubject}\n${emailBody}\n${docText}`;

  const objetivoMatch = combinedText.match(
    /(?:objetivo(?:\s+profissional)?|cargo\s+pretendido|área\s+de\s+interesse|vaga\s+pretendida)\s*[:.-]\s*([^\r\n.;]{4,55})/i
  );
  if (objetivoMatch && objetivoMatch[1]) {
    const obj = objetivoMatch[1].trim();
    if (
      obj.length >= 4 &&
      obj.length <= 50 &&
      !/atuar\s+na\s+empresa|colaborar\s+com|fazer\s+parte|crescimento/i.test(obj)
    ) {
      return obj;
    }
  }

  const areasHospitalares: { regex: RegExp; label: string }[] = [
    { regex: /\bt[eé]cnico\s+(?:de|em)\s+enfermagem\b/i, label: 'Técnico(a) de Enfermagem' },
    { regex: /\benfermeir[oa]\b/i, label: 'Enfermeiro(a)' },
    { regex: /\bfarmac[eê]utic[oa]\b/i, label: 'Farmacêutico(a)' },
    { regex: /\b(?:auxiliar|atendente)\s+de\s+farm[aá]cia\b/i, label: 'Auxiliar de Farmácia' },
    { regex: /\brecepcionista\b|\brecep[cç][aã]o\b/i, label: 'Recepção / Atendimento' },
    { regex: /\bfaturamento\b/i, label: 'Faturamento Hospitalar' },
    { regex: /\bauxiliar\s+administrativo\b|\badministra[cç][aã]o\b/i, label: 'Auxiliar Administrativo' },
    { regex: /\bfisioterapeuta\b|\bfisioterapia\b/i, label: 'Fisioterapia' },
    { regex: /\bnutricionista\b|\bcopeir[oa]\b|\bnutri[cç][aã]o\b/i, label: 'Nutrição / Copa' },
    { regex: /\bpsic[oó]log[oa]\b|\bpsicologia\b/i, label: 'Psicologia' },
    { regex: /\bassistente\s+social\b|\bservi[cç]o\s+social\b/i, label: 'Serviço Social' },
    { regex: /\bbiom[eé]dic[oa]\b|\bbiomedicina\b/i, label: 'Biomedicina / Laboratório' },
    { regex: /\bradiologia\b/i, label: 'Técnico em Radiologia' },
    { regex: /\bseguran[cç]a\s+do\s+trabalho\b/i, label: 'Segurança do Trabalho' },
    { regex: /\bporteir[oa]\b|\bportaria\b|\bvigia\b/i, label: 'Portaria / Controle de Acesso' },
    { regex: /\bservi[cç]os\s+gerais\b|\bhigieniza[cç][aã]o\b|\blimpeza\b/i, label: 'Higienização / Serviços Gerais' },
    { regex: /\balmoxarifado\b|\bestoque\b|\blog[ií]stica\b/i, label: 'Almoxarifado / Suprimentos' },
    { regex: /\btecnologia\s+da\s+informa[cç][aã]o\b|\bsuporte\s+t[eé]cnico\b/i, label: 'Tecnologia da Informação (TI)' },
    { regex: /\bjovem\s+aprendiz\b/i, label: 'Jovem Aprendiz' },
  ];

  for (const area of areasHospitalares) {
    if (area.regex.test(combinedText)) {
      return area.label;
    }
  }

  if (
    cleanSubject.length >= 4 &&
    cleanSubject.length <= 50 &&
    !/^(curriculo|currículo|cv|meu curriculo|meu currículo|segue curriculo|segue currículo)$/i.test(cleanSubject)
  ) {
    return cleanSubject;
  }

  return 'Geral / Banco de Talentos';
}

// Monta um resumo completo (até 600 caracteres) a partir do PDF, Word, OCR da Imagem ou Corpo do E-mail
function buildCandidateSummary(emailBody: string, docText: string, attachmentName: string | null): string {
  const cleanEmail = (emailBody || '')
    .replace(/Enviado do meu iPhone|Enviado do Email para Windows|Obter o Outlook para .*/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  const cleanDoc = (docText || '')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleanDoc.length > 25 && cleanEmail.length > 20) {
    const combined = `${cleanEmail} — Currículo: ${cleanDoc}`;
    return combined.length > 500 ? `${combined.slice(0, 500).trim()}...` : combined;
  }

  if (cleanDoc.length > 25) {
    return cleanDoc.length > 500 ? `${cleanDoc.slice(0, 500).trim()}...` : cleanDoc;
  }

  if (cleanEmail.length > 15) {
    return cleanEmail.length > 500 ? `${cleanEmail.slice(0, 500).trim()}...` : cleanEmail;
  }

  if (attachmentName) {
    return `Currículo anexado (${attachmentName}).`;
  }

  return 'Currículo recebido via Webmail do RH.';
}

// ── Normalização e Validação Inteligente de Currículos vs E-mails de DP/Contabilidade ──
const DEFAULT_BLOCKED_TERMS = [
  'pessoal consulte',
  'consulte contabilidade',
  'rescisao',
  'comunicado de dispensa',
  'aviso previo',
  'quebra a pedido',
  'folha de pagamento',
  'guia de recolhimento',
  'fgts',
  'esocial',
  'exame demissional',
  'exame periodico',
  'nota fiscal',
  'boleto',
  'fatura',
  'orcamento',
  'ponto eletronico',
  'homologacao',
  'holerite',
  'contra-cheque',
  'contracheque',
  'demonstrativo de pagamento',
];

function normalizeTextForMatch(str: string): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// Verifica se uma palavra-chave aparece como PALAVRA INTEIRA (evita que "CV" case dentro de links ou códigos aleatórios)
function matchesKeywordWholeWord(text: string, keyword: string): boolean {
  const normText = normalizeTextForMatch(text);
  const normKw = normalizeTextForMatch(keyword);
  if (!normText || !normKw) return false;

  const escaped = normKw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, 'i');
  return regex.test(normText);
}

// Verifica se o remetente, assunto ou nome do anexo bate em algum termo bloqueado (ex: "Pessoal Consulte", "Rescisão", "Dispensa")
function matchesBlockedTerm(fields: (string | null | undefined)[], customBlocked?: string[]): boolean {
  const blockedList =
    customBlocked && customBlocked.length > 0
      ? Array.from(new Set([...DEFAULT_BLOCKED_TERMS, ...customBlocked]))
      : DEFAULT_BLOCKED_TERMS;

  const combined = normalizeTextForMatch(fields.filter(Boolean).join(' | '));
  if (!combined) return false;

  for (const term of blockedList) {
    const normTerm = normalizeTextForMatch(term);
    if (!normTerm) continue;
    if (normTerm.length <= 4) {
      if (matchesKeywordWholeWord(combined, normTerm)) return true;
    } else if (combined.includes(normTerm)) {
      return true;
    }
  }
  return false;
}

// Valida se o e-mail realmente possui evidência de ser um currículo de candidato (e não um documento administrativo/contábil)
function hasRealCurriculumEvidence(params: {
  fromName: string;
  fromEmail: string;
  subject: string;
  attachmentFilename: string | null;
  emailBody: string;
  docText: string;
  hasValidAttachment: boolean;
}): boolean {
  const normFrom = normalizeTextForMatch(`${params.fromName} ${params.fromEmail}`);
  const normSubj = normalizeTextForMatch(params.subject);
  const normFile = normalizeTextForMatch(params.attachmentFilename || '');
  const normDoc = normalizeTextForMatch(params.docText);
  const normBody = normalizeTextForMatch(params.emailBody);

  // 1. Remetentes corporativos/automáticos ou de contabilidade/DP que não são candidatos
  if (
    /\b(pessoal\s*consulte|contabilidade|financeiro|faturamento|fiscal|dp@|pessoal@|noreply|no-reply|mailer-daemon|postmaster|notificacao)\b/i.test(
      normFrom
    )
  ) {
    return false;
  }

  // 2. Documentos de rescisão/dispensa/DP dentro do texto extraído do PDF/Word
  if (
    /\b(termo de rescisao|comunicado de dispensa|aviso previo|quebra a pedido|guia de recolhimento|chave de acesso|nota fiscal eletronica|danfe|homologacao de rescisao)\b/i.test(
      `${normSubj} ${normFile} ${normDoc.slice(0, 1000)}`
    )
  ) {
    return false;
  }

  // 3. Evidência explícita no Assunto ou no Nome do Arquivo anexado
  const explicitTerms = [
    'curriculo',
    'curriculum',
    'vitae',
    'cv',
    'vaga',
    'processo seletivo',
    'trabalhe conosco',
    'candidatura',
    'oportunidade',
    'selecao',
    'banco de talentos',
    'indeed',
    'catho',
    'infojobs',
    'gupy',
    'linkedin',
  ];

  const hasExplicitInSubjectOrFile = explicitTerms.some(
    t => matchesKeywordWholeWord(normSubj, t) || matchesKeywordWholeWord(normFile.replace(/[_.-]/g, ' '), t)
  );

  // 4. Evidência estrutural de currículo dentro do PDF / Word / OCR ou Corpo do E-mail
  const resumeSectionMarkers = [
    'objetivo',
    'experiencia profissional',
    'experiencias profissionais',
    'historico profissional',
    'formacao academica',
    'formacao escolar',
    'escolaridade',
    'ensino medio',
    'ensino superior',
    'graduacao',
    'tecnico em',
    'tecnico de enfermagem',
    'cursos complementares',
    'qualificacoes',
    'habilidades',
    'sintese de qualificacoes',
    'dados pessoais',
    'estado civil',
    'brasileir',
    'disponibilidade de horario',
    'coren',
    'crf',
    'crefito',
    'cnh',
  ];

  const combinedContent = `${normDoc} ${normBody}`;
  let sectionHits = 0;
  for (const marker of resumeSectionMarkers) {
    if (combinedContent.includes(marker)) {
      sectionHits++;
    }
  }

  // Se não tem anexo de currículo (PDF/Word/Imagem válida), exige que o assunto seja de currículo E tenha seções de currículo no corpo
  if (!params.hasValidAttachment) {
    return hasExplicitInSubjectOrFile && sectionHits >= 2;
  }

  // Se tem anexo (PDF, Word ou Imagem), aceita se o assunto/nome do arquivo indicar currículo OU se o conteúdo tiver estrutura de currículo (2+ marcadores)
  return hasExplicitInSubjectOrFile || sectionHits >= 2;
}

interface ImapRequestPayload {
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
  maxMessages?: number;
  max_messages?: number;
  keywords?: string[];
  palavras_chave?: string[];
  ignoredKeywords?: string[];
  palavras_ignoradas?: string[];
  exigirEvidenciaCurriculo?: boolean;
  buscarEm?: 'assunto_e_corpo' | 'apenas_assunto';
  apenasNaoLidos?: boolean;
}

async function runSingleImapAttempt(
  host: string,
  port: number,
  secure: 'ssl' | 'tls' | 'none',
  user: string,
  pass: string,
  mailbox: string,
  maxMessages: number,
  keywords: string[],
  ignoredKeywords: string[],
  exigirEvidenciaCurriculo: boolean,
  buscarEm: 'assunto_e_corpo' | 'apenas_assunto',
  apenasNaoLidos?: boolean,
  action?: 'test' | 'sync'
): Promise<any> {
  return new Promise(resolve => {
    let settled = false;
    let socket: net.Socket | tls.TLSSocket | null = null;

    const finish = (result: any) => {
      if (settled) return;
      settled = true;
      try {
        if (socket && !socket.destroyed) {
          socket.write('A999 LOGOUT\r\n');
          socket.destroy();
        }
      } catch {
        // ignore
      }
      resolve(result);
    };

    const timeoutMs = action === 'sync' ? 90000 : 12000;
    const overallTimeout = setTimeout(() => {
      finish({
        success: false,
        isNetworkError: true,
        error: `Tempo limite excedido ao conectar em ${host}:${port}.`,
      });
    }, timeoutMs);

    let buffer = '';
    let waitingTag: string | null = null;
    let waitingGreeting = true;
    let onResponseCallback: ((resp: string) => void) | null = null;

    const checkBuffer = () => {
      if (waitingGreeting) {
        if (/\*\s+(OK|PREAUTH)/i.test(buffer) && buffer.includes('\n')) {
          waitingGreeting = false;
          const cb = onResponseCallback;
          onResponseCallback = null;
          const current = buffer;
          buffer = '';
          if (cb) cb(current);
        } else if (/^220[\s-]/i.test(buffer.trim()) && buffer.includes('\n')) {
          clearTimeout(overallTimeout);
          finish({
            success: false,
            isSmtpPort: true,
            error: `A porta ${port} respondeu como SMTP (envio) em vez de IMAP (leitura).`,
          });
        } else if (/\*\s+(NO|BAD|BYE)/i.test(buffer) && buffer.includes('\n')) {
          clearTimeout(overallTimeout);
          finish({
            success: false,
            error: `O servidor IMAP recusou a conexão inicial: ${buffer.trim()}`,
          });
        }
        return;
      }

      if (waitingTag) {
        const tail = buffer.length > 600 ? buffer.slice(-600) : buffer;
        const tagRegex = new RegExp(`(^|\\r?\\n)${waitingTag}\\s+(OK|NO|BAD)\\b[^\\n]*\\n`, 'i');
        if (tagRegex.test(tail)) {
          const cb = onResponseCallback;
          onResponseCallback = null;
          waitingTag = null;
          const current = buffer;
          buffer = '';
          if (cb) cb(current);
        }
      }
    };

    const sendCmd = (tag: string, cmd: string): Promise<string> => {
      return new Promise((resCmd, rejCmd) => {
        if (!socket || socket.destroyed) {
          return rejCmd(new Error('Conexão encerrada pelo servidor.'));
        }
        buffer = '';
        waitingTag = tag;
        onResponseCallback = resp => resCmd(resp);
        socket.write(`${tag} ${cmd}\r\n`);
      });
    };

    const useDirectTls = secure === 'ssl' || port === 993;

    const startSession = async (
      activeSocket: net.Socket | tls.TLSSocket,
      greetingText: string
    ) => {
      try {
        if (!useDirectTls && (secure === 'tls' || greetingText.includes('STARTTLS'))) {
          const stlsResp = await sendCmd('A000', 'STARTTLS');
          if (/(^|\r?\n)A000\s+OK\b/i.test(stlsResp)) {
            const upgraded = await new Promise<tls.TLSSocket>((resTls, rejTls) => {
              const tlsSock = tls.connect(
                {
                  socket: activeSocket as net.Socket,
                  host,
                  servername: host,
                  rejectUnauthorized: false,
                },
                () => resTls(tlsSock)
              );
              tlsSock.once('error', rejTls);
            });
            upgraded.setEncoding('utf8');
            upgraded.on('data', (chunk: string) => {
              buffer += chunk;
              checkBuffer();
            });
            socket = upgraded;
          }
        }

        const escapedUser = user.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        const escapedPass = pass.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        const loginResp = await sendCmd('A001', `LOGIN "${escapedUser}" "${escapedPass}"`);
        if (!/(^|\r?\n)A001\s+OK\b/i.test(loginResp)) {
          clearTimeout(overallTimeout);
          return finish({
            success: false,
            isAuthError: true,
            error: `Falha na autenticação para "${user}". Verifique se o e-mail e a senha estão corretos.`,
          });
        }

        const selectResp = await sendCmd('A002', `SELECT "${mailbox}"`);
        if (!/(^|\r?\n)A002\s+OK\b/i.test(selectResp)) {
          clearTimeout(overallTimeout);
          return finish({
            success: false,
            error: `Autenticado com sucesso, mas a pasta "${mailbox}" não foi encontrada no Webmail.`,
          });
        }

        const existsMatch = selectResp.match(/\*\s+(\d+)\s+EXISTS/i);
        const totalMessages = existsMatch ? parseInt(existsMatch[1], 10) : 0;

        if (action === 'test') {
          clearTimeout(overallTimeout);
          return finish({
            success: true,
            totalMessages,
            message: `Conexão IMAP autenticada com sucesso em ${host}:${port}! Caixa "${mailbox}" acessível (${totalMessages} e-mails na caixa).`,
          });
        }

        // ── MODO SYNC: Lê PDF, Word (.docx/.doc) e Imagens (anexadas ou coladas no corpo do e-mail) ──
        ensureCurriculosDir();
        const candidatosEncontrados: any[] = [];
        const inspectCount = Math.min(maxMessages, totalMessages);

        if (totalMessages > 0 && inspectCount > 0) {
          const startSeq = Math.max(1, totalMessages - inspectCount + 1);
          const headerFetchCmd = `FETCH ${startSeq}:${totalMessages} (UID FLAGS BODYSTRUCTURE BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE MESSAGE-ID)])`;
          const headerFetchResp = await sendCmd('A003', headerFetchCmd);

          const headerBlocks = headerFetchResp.split(/\*\s+\d+\s+FETCH\s+\(/i).slice(1);
          const messagesToDownload: {
            uid: string;
            rawSubject: string;
            fromName: string;
            fromEmail: string;
            parsedDate: string;
            rawMsgId: string;
          }[] = [];

          for (const block of headerBlocks) {
            if (apenasNaoLidos && /FLAGS\s*\([^)]*\\Seen/i.test(block)) {
              continue;
            }

            const uidMatch = block.match(/\bUID\s+(\d+)/i);
            if (!uidMatch) continue;
            const uid = uidMatch[1];

            const subjectMatch = block.match(/Subject:\s*([^\r\n]+(?:\r?\n[ \t]+[^\r\n]+)*)/i);
            const fromMatch = block.match(/From:\s*([^\r\n]+(?:\r?\n[ \t]+[^\r\n]+)*)/i);
            const dateMatch = block.match(/Date:\s*([^\r\n]+)/i);
            const msgIdMatch = block.match(/Message-ID:\s*([^\r\n]+)/i);

            const rawSubject = subjectMatch
              ? decodeMimeWords(subjectMatch[1].replace(/\r?\n[ \t]+/g, ' ').trim())
              : '';
            const rawFrom = fromMatch
              ? decodeMimeWords(fromMatch[1].replace(/\r?\n[ \t]+/g, ' ').trim())
              : '';
            const rawDate = dateMatch ? dateMatch[1].trim() : '';
            const rawMsgId = msgIdMatch
              ? msgIdMatch[1].trim()
              : `${user}-uid-${uid}`;

            const emailMatch =
              rawFrom.match(/<([^>]+)>/) ||
              rawFrom.match(/([a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
            const fromEmail = emailMatch ? emailMatch[1].trim().toLowerCase() : '';
            if (!fromEmail || fromEmail === user.toLowerCase()) continue;

            let fromName = rawFrom
              .replace(/<[^>]+>/g, '')
              .replace(/["']/g, '')
              .trim();
            if (!fromName || fromName.includes('@')) {
              fromName = fromEmail.split('@')[0].replace(/[._-]/g, ' ');
            }

            let parsedDate = new Date().toISOString();
            if (rawDate) {
              const d = new Date(rawDate);
              if (!isNaN(d.getTime())) parsedDate = d.toISOString();
            }

            // 1. Filtra já no cabeçalho se o Remetente ou o Assunto contiverem palavras bloqueadas (ex: "Pessoal Consulte", "Rescisão", "Dispensa")
            if (matchesBlockedTerm([fromName, fromEmail, rawSubject], ignoredKeywords)) {
              continue;
            }

            const hasAttachmentInStructure =
              /\.pdf\b|application\/pdf|\.docx?\b|msword|wordprocessingml|image\/(jpeg|jpg|png|webp)/i.test(
                block
              );
            const subjectMatchesKw =
              keywords.length === 0 ||
              keywords.some(kw => matchesKeywordWholeWord(rawSubject, kw));

            if (buscarEm === 'apenas_assunto' && !subjectMatchesKw) {
              continue;
            }

            if (subjectMatchesKw || hasAttachmentInStructure || buscarEm === 'assunto_e_corpo') {
              messagesToDownload.push({
                uid,
                rawSubject,
                fromName,
                fromEmail,
                parsedDate,
                rawMsgId,
              });
            }
          }

          let cmdCounter = 10;
          for (const msgMeta of messagesToDownload.reverse()) {
            cmdCounter++;
            const tag = `A0${cmdCounter}`;
            const fullFetchResp = await sendCmd(tag, `UID FETCH ${msgMeta.uid} (BODY.PEEK[])`);

            const parsedMime = parseMimeMessage(fullFetchResp);

            let curriculoUrl: string | null = null;
            let curriculoNome: string | null = null;
            let documentExtractedText = '';
            let primaryAtt: ParsedAttachment | null = null;

            // Prioridade de anexo principal: 1º PDF, 2º Word (.docx/.doc), 3º Imagem (maior resolução, ignorando logos)
            if (parsedMime.attachments.length > 0) {
              const pdfAtt = parsedMime.attachments.find(a => a.kind === 'pdf');
              const wordAtt = parsedMime.attachments.find(a => a.kind === 'word');
              const imageAtts = parsedMime.attachments
                .filter(a => a.kind === 'image')
                .sort((a, b) => b.buffer.length - a.buffer.length);

              primaryAtt = pdfAtt || wordAtt || imageAtts[0] || parsedMime.attachments[0];
              curriculoNome = primaryAtt.filename;

              // Se o nome do arquivo em anexo for de Rescisão, Dispensa, Folha, Nota Fiscal etc., descarta imediatamente!
              if (matchesBlockedTerm([curriculoNome], ignoredKeywords)) {
                continue;
              }

              // Extrai o texto em memória ANTES de salvar no disco para validar se realmente é um currículo
              if (primaryAtt.kind === 'pdf') {
                documentExtractedText = await extractTextFromPdfBuffer(primaryAtt.buffer);
              } else if (primaryAtt.kind === 'word') {
                documentExtractedText = extractTextFromWordBuffer(primaryAtt.buffer);
              } else if (primaryAtt.kind === 'image') {
                documentExtractedText = await extractTextFromImageBuffer(primaryAtt.buffer);
              }

              // Se ainda não achou telefone no anexo principal e houver outras partes (ex: imagem no corpo + doc), verifica também
              if (!extractPhoneFromText(parsedMime.textBody) && !extractPhoneFromText(documentExtractedText)) {
                for (const extraAtt of parsedMime.attachments) {
                  if (extraAtt === primaryAtt) continue;
                  let extraText = '';
                  if (extraAtt.kind === 'pdf') extraText = await extractTextFromPdfBuffer(extraAtt.buffer);
                  else if (extraAtt.kind === 'word') extraText = extractTextFromWordBuffer(extraAtt.buffer);
                  else if (extraAtt.kind === 'image') extraText = await extractTextFromImageBuffer(extraAtt.buffer);
                  if (extraText) {
                    documentExtractedText += `\n${extraText}`;
                  }
                }
              }
            }

            // 2. Verifica novamente se o conteúdo extraído ou assunto bate em algum termo bloqueado (DP/Contabilidade/Rescisão)
            if (
              matchesBlockedTerm(
                [msgMeta.fromName, msgMeta.fromEmail, msgMeta.rawSubject, curriculoNome, documentExtractedText.slice(0, 600)],
                ignoredKeywords
              )
            ) {
              continue;
            }

            // 3. Busca por palavras-chave como PALAVRA INTEIRA (evita falsos positivos de "CV" dentro de links/códigos)
            const fullSearchableText =
              buscarEm === 'apenas_assunto'
                ? msgMeta.rawSubject
                : `${msgMeta.rawSubject} ${parsedMime.textBody} ${(curriculoNome || '').replace(/[_.-]/g, ' ')} ${documentExtractedText}`;

            const matchedKeywords =
              keywords.length === 0
                ? ['Currículo']
                : keywords.filter(kw => matchesKeywordWholeWord(fullSearchableText, kw));

            if (matchedKeywords.length === 0) continue;

            // 4. Validação Inteligente de Evidência de Currículo (ignora e-mails administrativos/corporativos sem currículo)
            if (exigirEvidenciaCurriculo) {
              const isRealCurriculum = hasRealCurriculumEvidence({
                fromName: msgMeta.fromName,
                fromEmail: msgMeta.fromEmail,
                subject: msgMeta.rawSubject,
                attachmentFilename: curriculoNome,
                emailBody: parsedMime.textBody,
                docText: documentExtractedText,
                hasValidAttachment: Boolean(primaryAtt),
              });
              if (!isRealCurriculum) {
                continue;
              }
            }

            // 5. Agora que foi validado como currículo real, salva o arquivo na pasta public/curriculos
            if (primaryAtt) {
              const safeFilename = primaryAtt.filename
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-zA-Z0-9._-]/g, '_');
              const storedFileName = `cv_${msgMeta.uid}_${safeFilename}`;
              const storedFilePath = path.join(CURRICULOS_DIR, storedFileName);

              try {
                fs.writeFileSync(storedFilePath, primaryAtt.buffer);
                curriculoUrl = `/curriculos/${storedFileName}`;
              } catch (errWrite: any) {
                console.warn('[rh-email-plugin] Erro ao salvar arquivo extraído:', errWrite?.message);
              }
            }

            // Extrai o telefone tanto do corpo do e-mail quanto do PDF, Word (.docx/.doc) ou Imagem (OCR)!
            const phone =
              extractPhoneFromText(parsedMime.textBody) ||
              extractPhoneFromText(documentExtractedText) ||
              extractPhoneFromText(msgMeta.rawSubject);

            const vaga = extractVagaFromEmailAndPdf(
              msgMeta.rawSubject,
              parsedMime.textBody,
              documentExtractedText
            );

            const resumo = buildCandidateSummary(
              parsedMime.textBody,
              documentExtractedText,
              curriculoNome
            );

            candidatosEncontrados.push({
              nome_candidato: msgMeta.fromName,
              email_candidato: msgMeta.fromEmail,
              telefone: phone,
              vaga_identificada: vaga,
              assunto_email: msgMeta.rawSubject || 'Currículo recebido por e-mail',
              palavras_chave_detectadas: matchedKeywords,
              resumo_perfil: resumo,
              curriculo_url: curriculoUrl,
              curriculo_nome: curriculoNome,
              email_message_id: msgMeta.rawMsgId,
              data_recebimento: msgMeta.parsedDate,
              origem: 'email_n8n',
            });
          }
        }

        clearTimeout(overallTimeout);
        return finish({
          success: true,
          totalMessages,
          novosImportados: candidatosEncontrados.length,
          candidatos: candidatosEncontrados,
          message:
            candidatosEncontrados.length > 0
              ? `${candidatosEncontrados.length} currículo(s) processado(s) (PDF, Word e Imagens)!`
              : `Leitura concluída em "${mailbox}" (${totalMessages} e-mails verificados). Nenhum currículo encontrado com as palavras-chave.`,
        });
      } catch (err: any) {
        clearTimeout(overallTimeout);
        return finish({
          success: false,
          isNetworkError: true,
          error: err?.message || 'Erro durante comunicação IMAP.',
        });
      }
    };

    onResponseCallback = greetingText => {
      if (socket) startSession(socket, greetingText);
    };

    try {
      if (useDirectTls) {
        socket = tls.connect({
          host,
          port,
          rejectUnauthorized: false,
          servername: host,
        });
      } else {
        socket = net.connect({ host, port });
      }

      socket.setEncoding('utf8');
      socket.on('data', (chunk: string) => {
        buffer += chunk;
        checkBuffer();
      });

      socket.on('error', (err: any) => {
        clearTimeout(overallTimeout);
        finish({
          success: false,
          isNetworkError: true,
          error: `Erro de conexão com ${host}:${port} (${err?.code || err?.message || 'Verifique Host e Porta'}).`,
        });
      });

      socket.on('close', () => {
        if (!settled) {
          clearTimeout(overallTimeout);
          finish({
            success: false,
            isNetworkError: true,
            error: `Conexão encerrada por ${host}:${port}.`,
          });
        }
      });
    } catch (err: any) {
      clearTimeout(overallTimeout);
      finish({
        success: false,
        isNetworkError: true,
        error: err?.message || 'Erro ao iniciar socket IMAP.',
      });
    }
  });
}

async function testSmtpAuthOnly(host: string, port: number, user: string, pass: string): Promise<any> {
  return new Promise(resolve => {
    let settled = false;
    let socket: net.Socket | tls.TLSSocket | null = null;

    const finish = (res: any) => {
      if (settled) return;
      settled = true;
      try {
        if (socket && !socket.destroyed) socket.destroy();
      } catch {
        // ignore
      }
      resolve(res);
    };

    const timeout = setTimeout(() => {
      finish({ success: false });
    }, 8000);

    const sendLine = (sock: net.Socket | tls.TLSSocket, line?: string): Promise<string> => {
      return new Promise((resLine, rejLine) => {
        let buf = '';
        const onData = (chunk: Buffer | string) => {
          buf += chunk.toString();
          const lines = buf.split(/\r?\n/).filter(Boolean);
          const last = lines[lines.length - 1] || '';
          if (/^\d{3}\s/.test(last)) {
            sock.removeListener('data', onData);
            resLine(buf.trim());
          }
        };
        sock.on('data', onData);
        sock.once('error', rejLine);
        if (line !== undefined) sock.write(line + '\r\n');
      });
    };

    const runAuth = async (initialSock: net.Socket | tls.TLSSocket, isTls: boolean) => {
      try {
        let activeSock = initialSock;
        const greeting = await sendLine(activeSock);
        if (!greeting.startsWith('220')) throw new Error('Not SMTP');

        let ehlo = await sendLine(activeSock, 'EHLO hsc-rh.local');
        if (!isTls && ehlo.includes('STARTTLS')) {
          const stls = await sendLine(activeSock, 'STARTTLS');
          if (stls.startsWith('220')) {
            activeSock = await new Promise<tls.TLSSocket>((resTls, rejTls) => {
              const tlsSock = tls.connect(
                { socket: activeSock as net.Socket, host, rejectUnauthorized: false },
                () => resTls(tlsSock)
              );
              tlsSock.once('error', rejTls);
            });
            socket = activeSock;
            ehlo = await sendLine(activeSock, 'EHLO hsc-rh.local');
          }
        }

        const auth = await sendLine(activeSock, 'AUTH LOGIN');
        if (!auth.startsWith('334')) throw new Error('AUTH LOGIN rejected');
        const uResp = await sendLine(activeSock, Buffer.from(user, 'utf8').toString('base64'));
        if (!uResp.startsWith('334')) throw new Error('User rejected');
        const pResp = await sendLine(activeSock, Buffer.from(pass, 'utf8').toString('base64'));
        if (!pResp.startsWith('235')) {
          clearTimeout(timeout);
          return finish({
            success: false,
            isAuthError: true,
            error: `Falha na autenticação para "${user}": usuário ou senha incorretos.`,
          });
        }

        await sendLine(activeSock, 'QUIT').catch(() => {});
        clearTimeout(timeout);
        finish({
          success: true,
          message: `Conexão autenticada com sucesso para ${user} em ${host}:${port}!`,
        });
      } catch {
        clearTimeout(timeout);
        finish({ success: false });
      }
    };

    try {
      if (port === 465) {
        socket = tls.connect({ host, port, rejectUnauthorized: false, servername: host });
        runAuth(socket, true);
      } else {
        socket = net.connect({ host, port });
        runAuth(socket, false);
      }
      socket.on('error', () => {
        clearTimeout(timeout);
        finish({ success: false });
      });
    } catch {
      clearTimeout(timeout);
      finish({ success: false });
    }
  });
}

async function runImapOperation(payload: ImapRequestPayload): Promise<any> {
  const rawHost = (payload.imapHost || payload.imap_host || '').trim();
  const rawPort = Number(payload.imapPort || payload.imap_port || 993);
  const user = (payload.imapUser || payload.imap_user || '').trim();
  const pass = payload.imapPass ?? payload.imap_pass ?? '';
  const secure = payload.imapSecure || payload.imap_secure || (rawPort === 993 ? 'ssl' : 'tls');
  const mailbox = (payload.mailbox || 'INBOX').trim() || 'INBOX';
  const maxMessages = Number(payload.maxMessages || payload.max_messages || 30);
  const keywords =
    payload.keywords ||
    payload.palavras_chave || [
      'Currículo',
      'Curriculo',
      'Vaga',
      'Seleção',
      'CV',
      'Trabalhe Conosco',
      'Emprego',
    ];
  const ignoredKeywords =
    payload.ignoredKeywords ||
    payload.palavras_ignoradas ||
    DEFAULT_BLOCKED_TERMS;
  const exigirEvidenciaCurriculo = payload.exigirEvidenciaCurriculo !== false;
  const buscarEm = payload.buscarEm || 'assunto_e_corpo';

  if (!rawHost || !user || !pass) {
    return {
      success: false,
      error: 'Informe o Servidor IMAP, E-mail e Senha para conectar ao Webmail.',
    };
  }

  const attempts: { host: string; port: number; secure: 'ssl' | 'tls' | 'none' }[] = [];
  if (rawPort !== 587 && rawPort !== 465) {
    attempts.push({ host: rawHost, port: rawPort, secure });
  }
  if (rawPort !== 993 || secure !== 'ssl') {
    attempts.push({ host: rawHost, port: 993, secure: 'ssl' });
  }
  if (rawPort !== 143) {
    attempts.push({ host: rawHost, port: 143, secure: 'tls' });
  }
  if (/^smtp\./i.test(rawHost)) {
    const imapVariant = rawHost.replace(/^smtp\./i, 'imap.');
    attempts.push({ host: imapVariant, port: 993, secure: 'ssl' });
    attempts.push({ host: imapVariant, port: 143, secure: 'tls' });
  }

  let lastResult: any = null;
  for (const att of attempts) {
    const res = await runSingleImapAttempt(
      att.host,
      att.port,
      att.secure,
      user,
      pass,
      mailbox,
      maxMessages,
      keywords,
      ignoredKeywords,
      exigirEvidenciaCurriculo,
      buscarEm,
      payload.apenasNaoLidos,
      payload.action
    );
    if (res.success) return res;
    if (res.isAuthError) return res;
    lastResult = res;
  }

  if (payload.action === 'test') {
    const smtpPorts = rawPort === 587 || rawPort === 465 ? [rawPort, 587, 465] : [465, 587];
    for (const sp of Array.from(new Set(smtpPorts))) {
      const smtpRes = await testSmtpAuthOnly(rawHost, sp, user, pass);
      if (smtpRes.success) return smtpRes;
      if (smtpRes.isAuthError) return smtpRes;
    }
  }

  return (
    lastResult || {
      success: false,
      error: `Não foi possível conectar em ${rawHost}:${rawPort}.`,
    }
  );
}

async function runSingleSmtpAttempt(
  host: string,
  port: number,
  user: string,
  pass: string,
  fromName: string,
  fromEmail: string,
  toEmail: string,
  subject: string,
  messageBody: string
): Promise<any> {
  return new Promise(resolve => {
    let settled = false;
    let socket: net.Socket | tls.TLSSocket | null = null;

    const finish = (res: any) => {
      if (settled) return;
      settled = true;
      try {
        if (socket && !socket.destroyed) socket.destroy();
      } catch {
        // ignore
      }
      resolve(res);
    };

    const timeout = setTimeout(() => {
      finish({ success: false, isNetworkError: true, error: `Timeout ao conectar ao SMTP ${host}:${port}` });
    }, 12000);

    const sendLine = (sock: net.Socket | tls.TLSSocket, line?: string): Promise<string> => {
      return new Promise((resLine, rejLine) => {
        let buf = '';
        const onData = (chunk: Buffer | string) => {
          buf += chunk.toString();
          const lines = buf.split(/\r?\n/).filter(Boolean);
          const last = lines[lines.length - 1] || '';
          if (/^\d{3}\s/.test(last)) {
            sock.removeListener('data', onData);
            resLine(buf.trim());
          }
        };
        sock.on('data', onData);
        sock.once('error', rejLine);
        if (line !== undefined) {
          sock.write(line + '\r\n');
        }
      });
    };

    const runProtocol = async (initialSock: net.Socket | tls.TLSSocket, isTls: boolean) => {
      try {
        let activeSock = initialSock;
        const greeting = await sendLine(activeSock);
        if (!greeting.startsWith('220')) throw new Error(`Saudação SMTP inválida: ${greeting}`);

        let ehlo = await sendLine(activeSock, 'EHLO hsc-rh.local');
        if (!isTls && ehlo.includes('STARTTLS')) {
          const stls = await sendLine(activeSock, 'STARTTLS');
          if (stls.startsWith('220')) {
            activeSock = await new Promise<tls.TLSSocket>((resTls, rejTls) => {
              const tlsSock = tls.connect(
                { socket: activeSock as net.Socket, host, rejectUnauthorized: false },
                () => resTls(tlsSock)
              );
              tlsSock.once('error', rejTls);
            });
            socket = activeSock;
            ehlo = await sendLine(activeSock, 'EHLO hsc-rh.local');
          }
        }

        const auth = await sendLine(activeSock, 'AUTH LOGIN');
        if (!auth.startsWith('334')) throw new Error(`AUTH LOGIN recusado: ${auth}`);

        const uResp = await sendLine(activeSock, Buffer.from(user, 'utf8').toString('base64'));
        if (!uResp.startsWith('334')) {
          clearTimeout(timeout);
          return finish({ success: false, isAuthError: true, error: `Usuário SMTP recusado (${user}): ${uResp}` });
        }

        const pResp = await sendLine(activeSock, Buffer.from(pass, 'utf8').toString('base64'));
        if (!pResp.startsWith('235')) {
          clearTimeout(timeout);
          return finish({ success: false, isAuthError: true, error: `Senha SMTP incorreta para ${user} (${host}:${port}).` });
        }

        const mFrom = await sendLine(activeSock, `MAIL FROM:<${fromEmail}>`);
        if (!mFrom.startsWith('250')) throw new Error(`MAIL FROM recusado: ${mFrom}`);

        const rTo = await sendLine(activeSock, `RCPT TO:<${toEmail}>`);
        if (!rTo.startsWith('250')) throw new Error(`Destinatário recusado (${toEmail}): ${rTo}`);

        const dataCmd = await sendLine(activeSock, 'DATA');
        if (!dataCmd.startsWith('354')) throw new Error(`DATA recusado: ${dataCmd}`);

        const paragraphs = (messageBody || '')
          .split(/\n+/)
          .filter(p => p.trim().length > 0)
          .map(
            p =>
              `<p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.7;">${p.trim()}</p>`
          )
          .join('');

        const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"></head><body style="margin:0;padding:24px;background:#f4f5f7;font-family:'Segoe UI',Arial,sans-serif;"><div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;"><div style="background:#0f172a;padding:24px;text-align:center;color:#fff;font-weight:700;font-size:14px;letter-spacing:1px;text-transform:uppercase;">Hospital Santa Casa de Misericórdia de Araguari • RH</div><div style="padding:32px;">${paragraphs}</div><div style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;font-size:12px;color:#64748b;">${fromName} • Processo Seletivo</div></div></body></html>`;

        const boundary = `boundary_${Date.now()}`;
        const mimeMsg = [
          `From: "=?UTF-8?B?${Buffer.from(fromName, 'utf8').toString('base64')}?=" <${fromEmail}>`,
          `To: <${toEmail}>`,
          `Subject: =?UTF-8?B?${Buffer.from(subject || 'Retorno Processo Seletivo', 'utf8').toString('base64')}?=`,
          `MIME-Version: 1.0`,
          `Content-Type: multipart/alternative; boundary="${boundary}"`,
          `Date: ${new Date().toUTCString()}`,
          ``,
          `--${boundary}`,
          `Content-Type: text/html; charset=UTF-8`,
          `Content-Transfer-Encoding: base64`,
          ``,
          Buffer.from(html, 'utf8').toString('base64'),
          ``,
          `--${boundary}--`,
          `.`,
        ].join('\r\n');

        const endData = await sendLine(activeSock, mimeMsg);
        if (!endData.startsWith('250')) throw new Error(`Envio recusado: ${endData}`);

        await sendLine(activeSock, 'QUIT').catch(() => {});
        clearTimeout(timeout);
        finish({
          success: true,
          message: `E-mail enviado com sucesso de ${fromEmail} para ${toEmail} via ${host}:${port}!`,
        });
      } catch (err: any) {
        clearTimeout(timeout);
        finish({ success: false, isNetworkError: true, error: err?.message || 'Erro no envio SMTP.' });
      }
    };

    const useDirectSsl = port === 465;
    if (useDirectSsl) {
      socket = tls.connect({ host, port, rejectUnauthorized: false, servername: host });
      runProtocol(socket, true);
    } else {
      socket = net.connect({ host, port });
      runProtocol(socket, false);
    }
    socket.on('error', (err: any) => {
      clearTimeout(timeout);
      finish({ success: false, isNetworkError: true, error: err?.message || 'Falha de rede SMTP.' });
    });
  });
}

async function runSmtpSend(payload: {
  host: string;
  port: string | number;
  user: string;
  pass: string;
  fromName?: string;
  fromEmail?: string;
  to: string;
  subject: string;
  messageBody: string;
}): Promise<any> {
  const rawHost = (payload.host || '').trim();
  const rawPort = Number(payload.port || 465);
  const user = (payload.user || '').trim();
  const pass = payload.pass || '';
  const fromName = payload.fromName || 'Recursos Humanos - Hospital Santa Casa';
  const fromEmail = (payload.fromEmail || user).trim();
  const toEmail = (payload.to || '').trim();

  if (!rawHost || !user || !pass || !toEmail) {
    return {
      success: false,
      error: 'Informe o Servidor SMTP, E-mail de Disparo, Senha e E-mail de Destino.',
    };
  }

  const attempts: { host: string; port: number }[] = [{ host: rawHost, port: rawPort }];
  if (rawPort !== 465) attempts.push({ host: rawHost, port: 465 });
  if (rawPort !== 587) attempts.push({ host: rawHost, port: 587 });

  if (/^imap\./i.test(rawHost)) {
    const smtpHostVariant = rawHost.replace(/^imap\./i, 'smtp.');
    attempts.push({ host: smtpHostVariant, port: 465 });
    attempts.push({ host: smtpHostVariant, port: 587 });
  }

  let lastResult: any = null;
  for (const att of attempts) {
    const res = await runSingleSmtpAttempt(
      att.host,
      att.port,
      user,
      pass,
      fromName,
      fromEmail,
      toEmail,
      payload.subject,
      payload.messageBody
    );
    if (res.success) return res;
    if (res.isAuthError) return res;
    lastResult = res;
  }

  return (
    lastResult || {
      success: false,
      error: `Não foi possível enviar via SMTP (${rawHost}:${rawPort}).`,
    }
  );
}

export default function rhEmailPlugin(): Plugin {
  return {
    name: 'vite-plugin-rh-email',
    configureServer(server) {
      server.middlewares.use('/api/rh-email/imap', (req, res, next) => {
        if (req.method !== 'POST') return next();

        let body = '';
        req.on('data', chunk => {
          body += chunk.toString();
        });
        req.on('end', async () => {
          res.setHeader('Content-Type', 'application/json');
          try {
            const payload = body ? JSON.parse(body) : {};
            const result = await runImapOperation(payload);
            res.statusCode = 200;
            res.end(JSON.stringify(result));
          } catch (err: any) {
            res.statusCode = 500;
            res.end(
              JSON.stringify({
                success: false,
                error: err?.message || 'Erro interno no teste de conexão IMAP.',
              })
            );
          }
        });
      });

      server.middlewares.use('/api/rh-email/smtp', (req, res, next) => {
        if (req.method !== 'POST') return next();

        let body = '';
        req.on('data', chunk => {
          body += chunk.toString();
        });
        req.on('end', async () => {
          res.setHeader('Content-Type', 'application/json');
          try {
            const payload = body ? JSON.parse(body) : {};
            const result = await runSmtpSend(payload);
            res.statusCode = 200;
            res.end(JSON.stringify(result));
          } catch (err: any) {
            res.statusCode = 500;
            res.end(
              JSON.stringify({
                success: false,
                error: err?.message || 'Erro interno no envio SMTP.',
              })
            );
          }
        });
      });
    },
  };
}
