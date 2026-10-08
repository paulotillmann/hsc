// src/services/holeitesService.ts
// Serviço responsável por toda comunicação com Supabase para a feature de Holerites
// Processamento de PDF ocorre no browser (pdfjs-dist + pdf-lib)
// Estrutura do PDF: 1 página = 1 colaborador (conteúdo duplicado por folha — extraímos 1ª ocorrência)

import { supabase } from '../lib/supabase';
import { fetchEmailFromBubble, clearBubbleEmailCache } from './bubbleService';
// @ts-ignore
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { PDFDocument } from 'pdf-lib';

pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export interface HoleriteRecord {
  id: string;
  nome_completo: string;
  email: string | null;
  cpf: string;
  mes_ano: string;
  total_liquido: number | null;
  paginas: number[];
  pdf_url: string;
  pdf_filename: string;
  uploaded_by: string | null;
  created_at: string;
  email_enviado_em: string | null;
}

// ─────────────────────────────────────────────────────────────
// UPDATE — registra data/hora do envio de e-mail
// ─────────────────────────────────────────────────────────────
export async function updateEmailEnviadoEm(id: string): Promise<string> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('holerites')
    .update({ email_enviado_em: now })
    .eq('id', id);
  if (error) throw new Error(error.message);
  return now;
}

export async function updateHoleriteEmail(id: string, email: string): Promise<void> {
  const { error } = await supabase
    .from('holerites')
    .update({ email })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export interface HoleriteUploadProgress {
  stage: 'reading' | 'extracting' | 'uploading' | 'saving' | 'done' | 'error' | 'interrupted';
  current: number;
  total: number;
  percent: number;
  message: string;
  error?: string;
  skippedPages?: { page: number; reason: string; cpf?: string; nome?: string }[];
}

export interface SyncProgress {
  stage: 'syncing' | 'done' | 'error' | 'interrupted';
  current: number;
  total: number;
  updatedCount: number;
  percent: number;
  message: string;
  error?: string;
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function sanitizeFilename(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .replace(/\s+/g, '_')
    .toUpperCase();
}

interface ExtractedData {
  cpf: string | null;
  nomeCompleto: string | null;
  mesAno: string | null;
  totalLiquido: number | null;
}

function cleanExtractedName(rawName: string): string {
  return rawName
    .replace(/^Nome(?:\s+do)?\s+Funcion[aá]rio\s*/i, '')
    .replace(/\b(?:FL|CBO|Empresa|Local|Departamento)\b.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extrai CPF, Nome, Mês/Ano e Total Líquido do texto de uma página de holerite.
 *
 * Suporta formatos consolidados da Santa Casa de Araguari:
 *   - CPF:          "CPF: 753.734.676-34"
 *   - Mês/Ano:      "09/2026 Mensal" ou "12/2025" (competência principal)
 *   - Nome:         texto entre o cadastro (1-6 dígitos) e o CBO (6 dígitos) ou âncoras da tabela
 *   - TotalLíquido: valor numérico imediatamente após "Total Líquido"
 *
 * O conteúdo de cada página pode aparecer duplicado (recibo).
 * Usamos a primeira ocorrência válida de cada campo.
 */
function extractDadosHolerite(text: string): ExtractedData {
  // 1. CPF: "CPF: XXX.XXX.XXX-XX" (com tolerância a pontuação/espaços)
  let cpf: string | null = null;
  const cpfRawMatch = text.match(/CPF[:\s]*([\d\s.-]+)/i);
  if (cpfRawMatch) {
    const cleaned = cpfRawMatch[1].replace(/\D/g, '');
    if (cleaned.length >= 11) {
      const digits = cleaned.slice(0, 11);
      cpf = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
    }
  }

  // 2. Mês/Ano: prioriza a competência do cabeçalho da folha (ex: "09/2026 Mensal", "Araguari - MG 09/2026")
  let mesAno: string | null = null;
  const mesAnoHeadMatch = text.match(/(?:Araguari\s*[-–]\s*MG\s+)?\b(0[1-9]|1[0-2])\/(20\d{2})\s+(?:Mensal|Adiantamento|Folha|Rescis|13[ºo])/i) ||
                          text.match(/Araguari\s*[-–]\s*MG\s+\b(0[1-9]|1[0-2])\/(20\d{2})\b/i);
  if (mesAnoHeadMatch) {
    mesAno = `${mesAnoHeadMatch[1]}/${mesAnoHeadMatch[2]}`;
  } else {
    // Fallback geral para formato MM/YYYY
    const mesAnoMatch = text.match(/\b(0[1-9]|1[0-2])\/?(20\d{2})\b/);
    if (mesAnoMatch) {
      mesAno = `${mesAnoMatch[1]}/${mesAnoMatch[2]}`;
    }
  }

  // 3. Nome Completo
  let nomeCompleto: string | null = null;

  // Padrão 1: Matrícula (1-6 dígitos) + NOME (incluindo apóstrofos D'ARC, acentos, etc.) + CBO (6 dígitos)
  const nomeMatch = text.match(/\b(?:FL\s*\d{1,2}\s+)?\b\d{1,6}\s+([A-Za-zÀ-ÖØ-öø-ÿ'’.\s-]+?)\s+\d{6}\b/);
  if (nomeMatch) {
    const candidate = cleanExtractedName(nomeMatch[1]);
    if (candidate.length >= 4 && candidate.split(' ').length >= 2) {
      nomeCompleto = candidate.toUpperCase();
    }
  }

  // Padrão 2 (Fallback por âncora "Nome do Funcionário"):
  if (!nomeCompleto) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const idx = lines.findIndex(l => /Nome(?:\s+do)?\s+Funcion/i.test(l));
    if (idx !== -1) {
      for (let j = idx + 1; j < Math.min(idx + 6, lines.length); j++) {
        let line = lines[j];
        // Remove prefixo numérico se tiver matrícula na frente da linha
        line = line.replace(/^\d{1,6}\s+/, '');
        // Remove CBO no final se houver
        line = line.replace(/\s+\d{6}.*$/, '');
        line = cleanExtractedName(line);

        if (
          /^[A-Za-zÀ-ÖØ-öø-ÿ'’.\s-]+$/.test(line) &&
          line.split(/\s+/).length >= 2 &&
          line.length >= 5 &&
          !/Cadastro|CBO|Empresa|Local|Departamento|FL|CNPJ|CPF|Demonstrativo|Santa Casa|Data Admiss|Sal[aá]rio|Total/i.test(line)
        ) {
          nomeCompleto = line.toUpperCase();
          break;
        }
      }
    }
  }

  // Padrão 3 (Fallback inline geral):
  if (!nomeCompleto) {
    const fallbackInline = text.match(/Nome(?:\s+do)?\s+Funcion[aá]rio[^\n]*\n(?:\d{1,6}\s+)?([A-Za-zÀ-ÖØ-öø-ÿ'’.\s-]+?)(?:\s+\d{6}|\n|$)/i);
    if (fallbackInline) {
      const candidate = cleanExtractedName(fallbackInline[1]);
      if (candidate.length >= 4 && candidate.split(' ').length >= 2) {
        nomeCompleto = candidate.toUpperCase();
      }
    }
  }

  // 4. Total Líquido
  let totalLiquido: number | null = null;
  const totalMatchAfter = text.match(/Total\s+L[íi\s]*quido[:\s]*([\d.,]+)/i) ||
                          text.match(/Total\s+L[\s\S]{1,8}?do[:\s]*([\d.,]+)/i);
  const totalMatchBefore = text.match(/([\d.,]+)\s+Total\s+L[íi\s]*quido/i);
  const totalMatch = totalMatchAfter || totalMatchBefore;
  if (totalMatch) {
    const rawValue = totalMatch[1].replace(/\./g, '').replace(',', '.');
    const parsed = parseFloat(rawValue);
    if (!isNaN(parsed)) totalLiquido = parsed;
  }

  return {
    cpf,
    nomeCompleto,
    mesAno,
    totalLiquido,
  };
}

async function getPageText(page: any): Promise<string> {
  const content = await page.getTextContent();
  let lastY: number | null = null;
  let text = '';
  for (const item of content.items as any[]) {
    if (!item.str) continue;
    if (item.transform && typeof item.transform[5] === 'number') {
      const currentY = item.transform[5];
      if (lastY !== null && Math.abs(currentY - lastY) > 5) {
        text += '\n';
      } else if (text.length > 0 && !text.endsWith('\n') && !text.endsWith(' ')) {
        text += ' ';
      }
      lastY = currentY;
    } else {
      if (text.length > 0 && !text.endsWith('\n') && !text.endsWith(' ')) {
        text += ' ';
      }
    }
    text += item.str;
  }
  return text;
}

/**
 * Renderiza apenas os 45% superiores da página em um canvas e executa OCR com Tesseract.js.
 */
async function recognizePageTextWithOcr(page: any): Promise<string> {
  const viewport = page.getViewport({ scale: 2.0 }); // 2.0x DPI para maior clareza
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height * 0.45; // Corta nos 45% superiores (reduz tempo e ruído)
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Não foi possível obter o contexto 2D do canvas.');

  await page.render({
    canvasContext: context,
    viewport: viewport,
  }).promise;

  // Carrega tesseract.js dinamicamente (lazy loading)
  // @ts-ignore
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('por');
  await worker.setParameters({
    tessedit_pageseg_mode: '11' as any, // PSM 11 (Sparse text, works best for tables)
  });
  const { data: { text } } = await worker.recognize(canvas);
  await worker.terminate();
  return text;
}

// ─────────────────────────────────────────────────────────────
// FETCH — lista de holerites do banco
// ─────────────────────────────────────────────────────────────

export async function fetchHolerites(mesAno?: string, cpfFilter?: string): Promise<HoleriteRecord[]> {
  let query = supabase
    .from('holerites')
    .select('*')
    .order('nome_completo', { ascending: true });

  if (mesAno) {
    query = query.eq('mes_ano', mesAno);
  }

  // Se cpfFilter for fornecido, restringe aos registros do próprio colaborador
  if (cpfFilter) {
    query = query.eq('cpf', cpfFilter);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as HoleriteRecord[];
}

// ─────────────────────────────────────────────────────────────
// UPLOAD — processa PDF e persiste no Supabase
// ─────────────────────────────────────────────────────────────

export async function uploadHoleritePDF(
  file: File,
  uploadedBy: string,
  onProgress: (p: HoleriteUploadProgress) => void,
  abortSignal?: AbortSignal
): Promise<HoleriteRecord[]> {

  clearBubbleEmailCache();

  onProgress({ stage: 'reading', current: 0, total: 0, percent: 2, message: 'Lendo arquivo PDF...' });

  const arrayBuffer = await file.arrayBuffer();
  const pdfjsData = new Uint8Array(arrayBuffer.slice(0));

  console.log('[Holerite] Iniciando leitura do PDF...');
  const pdfDoc = await pdfjs.getDocument({ data: pdfjsData }).promise;
  const totalPages = pdfDoc.numPages;
  console.log(`[Holerite] Total de páginas: ${totalPages} (1 página = 1 colaborador)`);

  onProgress({ stage: 'extracting', current: 0, total: totalPages, percent: 5, message: 'Analisando colaboradores...' });

  const results: HoleriteRecord[] = [];
  const skippedPages: { page: number; reason: string; cpf?: string; nome?: string }[] = [];

  // ── Loop: 1 página = 1 colaborador ──
  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    if (abortSignal?.aborted) {
      console.log('[Holerite] Processo abortado pelo usuário.');
      onProgress({
        stage: 'interrupted',
        current: results.length,
        total: totalPages,
        percent: 100,
        message: `Importação interrompida. ${results.length} de ${totalPages} foram salvos.`,
        skippedPages,
      });
      return results;
    }

    // ── 1. Extrair texto da página ──
    const page = await pdfDoc.getPage(pageNum);
    const text = await getPageText(page);
    let { cpf, nomeCompleto, mesAno, totalLiquido } = extractDadosHolerite(text);

    // Fallback: se os dados obrigatórios estiverem ausentes, tenta OCR
    if (!cpf || !nomeCompleto || !mesAno) {
      console.log(`[Holerite] Página ${pageNum} sem texto selecionável. Tentando OCR como fallback...`);
      try {
        const pctProgress = 5 + Math.round((pageNum / totalPages) * 40);
        onProgress({
          stage: 'extracting',
          current: pageNum,
          total: totalPages,
          percent: pctProgress,
          message: `Processando OCR: Página ${pageNum}...`,
        });
        const ocrText = await recognizePageTextWithOcr(page);
        console.log(`[Holerite] OCR concluído para Página ${pageNum}`);
        const ocrData = extractDadosHolerite(ocrText);
        if (ocrData.cpf && ocrData.nomeCompleto && ocrData.mesAno) {
          cpf = ocrData.cpf;
          nomeCompleto = ocrData.nomeCompleto;
          mesAno = ocrData.mesAno;
          totalLiquido = ocrData.totalLiquido;
        }
      } catch (ocrErr: any) {
        console.error(`[Holerite] Erro ao executar OCR na página ${pageNum}:`, ocrErr);
      }
    }

    console.log(`[Holerite] Página ${pageNum}: CPF=${cpf}, Nome=${nomeCompleto}, MêsAno=${mesAno}, Total=${totalLiquido}`);

    if (!cpf || !nomeCompleto || !mesAno) {
      console.warn(`[Holerite] Página ${pageNum}: dados incompletos, pulando.`);
      const reasons: string[] = [];
      if (!cpf) reasons.push('CPF não encontrado');
      if (!nomeCompleto) reasons.push('Nome não encontrado');
      if (!mesAno) reasons.push('Mês/Ano não encontrado');
      
      skippedPages.push({
        page: pageNum,
        reason: reasons.join(', '),
        cpf: cpf || undefined,
        nome: nomeCompleto || undefined,
      });
      continue;
    }

    const pctProgress = 5 + Math.round((pageNum / totalPages) * 40); // 5 → 45%
    onProgress({
      stage: 'extracting',
      current: pageNum,
      total: totalPages,
      percent: pctProgress,
      message: `Extraindo: ${nomeCompleto}`,
    });

    // ── 2. Gerar subPDF (somente esta página) ──
    const srcPdf  = await PDFDocument.load(arrayBuffer.slice(0));
    const subPdf  = await PDFDocument.create();
    const [copied] = await subPdf.copyPages(srcPdf, [pageNum - 1]);
    subPdf.addPage(copied);
    const subBytes = await subPdf.save();

    // ── 3. Nomes de arquivo e path no Storage ──
    const safeName    = sanitizeFilename(nomeCompleto);
    const safeCpf     = cpf.replace(/\D/g, '');
    const safeMesAno  = mesAno.replace('/', '_'); // ex: "12_2025"
    const pdfFilename = `HOLERITE_${safeCpf}_${safeName}.pdf`;
    const storagePath = `${safeMesAno}/${pdfFilename}`;

    const pctUpload = 45 + Math.round((pageNum / totalPages) * 40); // 45 → 85%
    onProgress({
      stage: 'uploading',
      current: pageNum,
      total: totalPages,
      percent: pctUpload,
      message: `Enviando: ${nomeCompleto}`,
    });

    // ── 4. Upload para Supabase Storage ──
    console.log(`[Holerite] Enviando para storage: ${storagePath}`);
    const { error: storageError } = await supabase.storage
      .from('holerites-pdfs')
      .upload(storagePath, subBytes, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (storageError) {
      const msg = `Erro no Storage para "${nomeCompleto}": ${storageError.message}`;
      console.error('[Holerite]', msg);
      onProgress({ stage: 'error', current: pageNum, total: totalPages, percent: pctUpload, message: '', error: msg });
      throw new Error(msg);
    }

    // ── 5. URL pública permanente ──
    const { data: urlData } = supabase.storage
      .from('holerites-pdfs')
      .getPublicUrl(storagePath);
    const pdfUrl = urlData.publicUrl;

    // ── 6. Enriquecer e-mail via Bubble API ──
    onProgress({
      stage: 'saving',
      current: pageNum,
      total: totalPages,
      percent: pctUpload,
      message: `Buscando e-mail: ${nomeCompleto}`,
    });
    const emailFromBubble = await fetchEmailFromBubble(cpf);

    // ── 7. Upsert em public.holerites ──
    // Preserva e-mail existente se Bubble não retornar (não inclui campo null no payload)
    console.log(`[Holerite] Salvando: ${nomeCompleto} (${cpf}) | ${mesAno} | e-mail: ${emailFromBubble ?? '(não encontrado)'}`);

    const upsertPayload: Record<string, unknown> = {
      nome_completo: nomeCompleto,
      cpf,
      mes_ano:       mesAno,
      total_liquido: totalLiquido,
      paginas:       [pageNum],
      pdf_url:       pdfUrl,
      pdf_filename:  pdfFilename,
      uploaded_by:   uploadedBy,
    };

    if (emailFromBubble !== null) {
      upsertPayload.email = emailFromBubble;
    }

    const { data: saved, error: dbError } = await supabase
      .from('holerites')
      .upsert(upsertPayload, { onConflict: 'cpf,mes_ano' })
      .select()
      .single();

    if (dbError) {
      const msg = `Erro no banco para "${nomeCompleto}": ${dbError.message}`;
      console.error('[Holerite]', msg);
      onProgress({ stage: 'error', current: pageNum, total: totalPages, percent: pctUpload, message: '', error: msg });
      throw new Error(msg);
    }

    console.log(`[Holerite] ✓ ${nomeCompleto} salvo com id=${saved.id}`);
    results.push(saved as HoleriteRecord);
  }

  onProgress({
    stage: 'done',
    current: results.length,
    total: totalPages,
    percent: 100,
    message: `${results.length} holerites importados com sucesso!`,
    skippedPages,
  });

  return results;
}

// ─────────────────────────────────────────────────────────────
// SYNC EMAILS — Sincroniza e-mails em lote via webhook n8n
// ─────────────────────────────────────────────────────────────

export async function syncEmailsWithN8n(
  records: HoleriteRecord[],
  onProgress: (p: SyncProgress) => void,
  abortSignal?: AbortSignal
): Promise<number> {
  const total = records.length;
  let updatedCount = 0;

  onProgress({
    stage: 'syncing',
    current: 0,
    total,
    updatedCount,
    percent: 0,
    message: 'Iniciando sincronização...',
  });

  for (let i = 0; i < total; i++) {
    if (abortSignal?.aborted) {
      onProgress({
        stage: 'interrupted',
        current: i,
        total,
        updatedCount,
        percent: 100,
        message: `Sincronização interrompida. ${updatedCount} e-mails atualizados.`,
      });
      return updatedCount;
    }

    const record = records[i];
    const cpfClean = record.cpf.replace(/\D/g, '');

    const pct = Math.round(((i + 1) / total) * 100);
    onProgress({
      stage: 'syncing',
      current: i + 1,
      total,
      updatedCount,
      percent: pct,
      message: `Verificando: ${record.nome_completo}`,
    });

    try {
      const response = await fetch('https://n8n.technocode.site/webhook/colab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf: cpfClean }),
      });

      if (response.ok) {
        const text = await response.text();
        if (text && text.trim() !== '') {
          try {
            const data = JSON.parse(text);
            if (Array.isArray(data) && data.length > 0) {
              const emailFromN8n = data[0].EMAIL;
              if (emailFromN8n && typeof emailFromN8n === 'string' && emailFromN8n.trim() !== '') {
                const newEmail = emailFromN8n.trim().toLowerCase();
                // Só atualiza se o e-mail for diferente do atual
                if (newEmail !== record.email) {
                  await updateHoleriteEmail(record.id, newEmail);
                  updatedCount++;
                }
              }
            }
          } catch (e) {
            console.warn(`[Holerite Sync] Falha ao fazer parse do JSON para CPF ${cpfClean}:`, e);
          }
        }
      }
    } catch (err) {
      console.warn(`[Holerite Sync] Erro na requisição para CPF ${cpfClean}:`, err);
    }
  }

  onProgress({
    stage: 'done',
    current: total,
    total,
    updatedCount,
    percent: 100,
    message: `Sincronização concluída! ${updatedCount} e-mails atualizados.`,
  });

  return updatedCount;
}

// ─────────────────────────────────────────────────────────────
// DELETE — exclui registros do banco + arquivos do Storage
// ─────────────────────────────────────────────────────────────

export async function deleteHolerites(ids: string[], holerites: HoleriteRecord[]): Promise<void> {
  // 1. Excluir arquivos do Storage
  const toRemove = holerites
    .filter(h => ids.includes(h.id))
    .map(h => `${h.mes_ano.replace('/', '_')}/${h.pdf_filename}`);

  if (toRemove.length > 0) {
    const { error: storageErr } = await supabase.storage
      .from('holerites-pdfs')
      .remove(toRemove);
    if (storageErr) console.error('[Holerite] Erro ao remover do Storage:', storageErr.message);
  }

  // 2. Excluir registros do banco
  const { error: dbErr } = await supabase
    .from('holerites')
    .delete()
    .in('id', ids);

  if (dbErr) throw new Error(dbErr.message);
}

// ─────────────────────────────────────────────────────────────
// UTILS — gera lista de meses/anos para o filtro
// ─────────────────────────────────────────────────────────────

export function generateMesAnoOptions(qty = 24): string[] {
  const options: string[] = [];
  const now = new Date();
  for (let i = 0; i < qty; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    options.push(`${mm}/${yyyy}`);
  }
  return options;
}
