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
}

export interface HoleriteUploadProgress {
  stage: 'reading' | 'extracting' | 'uploading' | 'saving' | 'done' | 'error' | 'interrupted';
  current: number;
  total: number;
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

/**
 * Extrai CPF, Nome, Mês/Ano e Total Líquido do texto de uma página de holerite.
 *
 * Estrutura do PDF (mapeada via análise do HOL-01A20-DEZ25.pdf):
 *   - CPF:          "CPF: 865.140.679-72"
 *   - Mês/Ano:      "12/2025" (aparece após "ARAGUARI")
 *   - Nome:         texto entre o número de cadastro e o código CBO (6 dígitos)
 *   - TotalLíquido: valor numérico imediatamente após "Total Líquido"
 *
 * O conteúdo de cada página aparece DUPLICADO (holerite impresso 2x para recibo).
 * Por isso usamos a PRIMEIRA ocorrência de cada campo.
 */
function extractDadosHolerite(text: string): ExtractedData {
  // CPF: "CPF: XXX.XXX.XXX-XX"
  const cpfMatch = text.match(/CPF:\s*([\d]{3}\.[\d]{3}\.[\d]{3}-[\d]{2})/);

  // Mês/Ano: primeiro "MM/YYYY" no texto (aparece logo após "ARAGUARI - MG")
  const mesAnoMatch = text.match(/ARAGUARI[^]*?(\d{2}\/\d{4})/);

  // Nome: texto em MAIÚSCULAS após o número de cadastro (ex: "964 ADENIR RODRIGUES 322205")
  // O padrão busca: número_cadastro (3-4 dígitos) + NOME EM CAPS + código CBO (6 dígitos)
  const nomeMatch = text.match(/\b(?:FL\s*)?\d{3,4}\s+([A-ZÀÁÂÃÇÉÊÍÓÔÕÚ][A-ZÀÁÂÃÇÉÊÍÓÔÕÚ\s]+?)\s+\d{6}\b/);

  // Total Líquido: valor numérico que aparece antes da string "Total Líquido" (ex: "3.784,61 Total Líquido")
  const totalMatch = text.match(/([\d.,]+)\s+Total Líquido/);
  let totalLiquido: number | null = null;
  if (totalMatch) {
    const rawValue = totalMatch[1].replace(/\./g, '').replace(',', '.');
    const parsed = parseFloat(rawValue);
    if (!isNaN(parsed)) totalLiquido = parsed;
  }

  return {
    cpf:          cpfMatch   ? cpfMatch[1]          : null,
    nomeCompleto: nomeMatch  ? nomeMatch[1].trim()  : null,
    mesAno:       mesAnoMatch ? mesAnoMatch[1]       : null,
    totalLiquido,
  };
}

async function getPageText(page: any): Promise<string> {
  const content = await page.getTextContent();
  return content.items.map((item: any) => item.str).join(' ');
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
      });
      return results;
    }

    // ── 1. Extrair texto da página ──
    const page = await pdfDoc.getPage(pageNum);
    const text = await getPageText(page);
    const { cpf, nomeCompleto, mesAno, totalLiquido } = extractDadosHolerite(text);

    console.log(`[Holerite] Página ${pageNum}: CPF=${cpf}, Nome=${nomeCompleto}, MêsAno=${mesAno}, Total=${totalLiquido}`);

    if (!cpf || !nomeCompleto || !mesAno) {
      console.warn(`[Holerite] Página ${pageNum}: dados incompletos, pulando.`);
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
  });

  return results;
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
