// src/services/informesService.ts
// Serviço responsável por toda comunicação com Supabase para a feature de Informes
// Processamento de PDF ocorre no browser (pdfjs-dist + pdf-lib)

import { supabase } from '../lib/supabase';
import { fetchEmailFromBubble, clearBubbleEmailCache } from './bubbleService';
// @ts-ignore
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { PDFDocument } from 'pdf-lib';

// Worker local (copiado de node_modules para public/) — sem dependência de CDN
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export interface InformeRecord {
  id: string;
  nome_completo: string;
  email: string | null;
  cpf: string;
  paginas: number[];
  pdf_url: string;
  pdf_filename: string;
  ano_referencia: number;
  uploaded_by: string | null;
  created_at: string;
}

export interface UploadProgress {
  stage: 'reading' | 'extracting' | 'uploading' | 'saving' | 'done' | 'error' | 'interrupted';
  current: number;   // colaborador atual
  total: number;     // total de colaboradores
  percent: number;   // 0–100
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

function extractCpfAndName(text: string): { cpf: string | null; nomeCompleto: string | null } {
  const cpfMatch   = text.match(/CPF\s+([\d]{3}\.[\d]{3}\.[\d]{3}-[\d]{2})/);
  const nameMatch  = text.match(/Nome Completo\s+([A-ZÀ-ÚÇ\s]+?)(?=\s+Natureza)/);
  return {
    cpf:          cpfMatch  ? cpfMatch[1]          : null,
    nomeCompleto: nameMatch ? nameMatch[1].trim()  : null,
  };
}

async function getPageText(page: any): Promise<string> {
  const content = await page.getTextContent();
  return content.items.map((item: any) => item.str).join(' ');
}

// ─────────────────────────────────────────────────────────────
// FETCH — lista de informes do banco
// ─────────────────────────────────────────────────────────────

export async function fetchInformes(anoReferencia?: number, cpfFilter?: string): Promise<InformeRecord[]> {
  let query = supabase
    .from('informes')
    .select('*')
    .order('nome_completo', { ascending: true });

  if (anoReferencia) {
    query = query.eq('ano_referencia', anoReferencia);
  }

  // Se cpfFilter for fornecido, restringe aos registros do próprio colaborador
  if (cpfFilter) {
    query = query.eq('cpf', cpfFilter);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as InformeRecord[];
}

// ─────────────────────────────────────────────────────────────
// UPLOAD — processa PDF consolidado e persiste no Supabase
// ─────────────────────────────────────────────────────────────

export async function uploadInformePDF(
  file: File,
  anoReferencia: number,
  uploadedBy: string,
  onProgress: (p: UploadProgress) => void,
  abortSignal?: AbortSignal
): Promise<InformeRecord[]> {

  // Limpa o cache de e-mails do Bubble antes de cada importação
  clearBubbleEmailCache();

  onProgress({ stage: 'reading', current: 0, total: 0, percent: 2, message: 'Lendo arquivo PDF...' });

  const arrayBuffer = await file.arrayBuffer();

  // pdfjs-dist pode transferir (detach) o ArrayBuffer internamente.
  // Passamos uma CÓPIA para o pdfjs e mantemos o original para o pdf-lib.
  const pdfjsData = new Uint8Array(arrayBuffer.slice(0));

  // ── 1. Descobrir quantas páginas e colaboradores existem ──
  console.log('[Upload] Iniciando leitura do PDF...');
  const pdfDoc = await pdfjs.getDocument({ data: pdfjsData }).promise;
  const totalPages = pdfDoc.numPages;
  const totalColabs = Math.ceil(totalPages / 2);
  console.log(`[Upload] Total de páginas: ${totalPages}, colaboradores estimados: ${totalColabs}`);

  onProgress({ stage: 'extracting', current: 0, total: totalColabs, percent: 5, message: 'Analisando colaboradores...' });

  const results: InformeRecord[] = [];

  // ── 2. Iterar de 2 em 2 páginas ──
  for (let startPage = 1; startPage <= totalPages; startPage += 2) {
    if (abortSignal?.aborted) {
      console.log('[Upload] Processo abortado pelo usuário.');
      onProgress({
        stage: 'interrupted',
        current: results.length,
        total: totalColabs,
        percent: 100,
        message: `Importação interrompida. ${results.length} de ${totalColabs} foram salvos.`,
      });
      return results;
    }

    const colabIndex = Math.ceil(startPage / 2);
    const endPage    = Math.min(startPage + 1, totalPages);

    // Extrair texto da primeira página do par
    const page = await pdfDoc.getPage(startPage);
    const text = await getPageText(page);
    const { cpf, nomeCompleto } = extractCpfAndName(text);

    console.log(`[Upload] Página ${startPage}: CPF=${cpf}, Nome=${nomeCompleto}`);

    if (!cpf || !nomeCompleto) {
      console.warn(`[Upload] Página ${startPage}: não encontrou CPF/Nome, pulando.`);
      continue;
    }

    const pctProgress = 5 + Math.round((colabIndex / totalColabs) * 45); // 5 → 50%
    onProgress({
      stage: 'extracting',
      current: colabIndex,
      total: totalColabs,
      percent: pctProgress,
      message: `Extraindo: ${nomeCompleto}`,
    });

    // ── 3. Gerar subPDF com pdf-lib (cópia fresca do buffer a cada iteração) ──
    const srcPdf   = await PDFDocument.load(arrayBuffer.slice(0));
    const subPdf   = await PDFDocument.create();
    const indices  = [startPage - 1, ...(endPage > startPage ? [endPage - 1] : [])];
    const copied   = await subPdf.copyPages(srcPdf, indices);
    copied.forEach((p) => subPdf.addPage(p));
    const subBytes = await subPdf.save();

    const safeName    = sanitizeFilename(nomeCompleto);
    const safeCpf     = cpf.replace(/\D/g, '');
    const pdfFilename = `INFORME_${safeCpf}_${safeName}.pdf`;
    const storagePath = `${anoReferencia}/${pdfFilename}`;

    const pctUpload = 50 + Math.round((colabIndex / totalColabs) * 40); // 50 → 90%
    onProgress({
      stage: 'uploading',
      current: colabIndex,
      total: totalColabs,
      percent: pctUpload,
      message: `Enviando: ${nomeCompleto}`,
    });

    // ── 4. Upload para Supabase Storage ──
    console.log(`[Upload] Enviando para storage: ${storagePath}`);
    const { error: storageError } = await supabase.storage
      .from('informes-pdfs')
      .upload(storagePath, subBytes, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (storageError) {
      const msg = `Erro no Storage para "${nomeCompleto}": ${storageError.message}`;
      console.error('[Upload]', msg);
      onProgress({ stage: 'error', current: colabIndex, total: totalColabs, percent: pctUpload, message: '', error: msg });
      throw new Error(msg);
    }

    // ── 5. URL pública permanente ──
    const { data: urlData } = supabase.storage
      .from('informes-pdfs')
      .getPublicUrl(storagePath);
    const pdfUrl = urlData.publicUrl;
    console.log(`[Upload] URL pública: ${pdfUrl}`);

    // ── 6. Enriquecer e-mail via API do Bubble (usando CPF como chave) ──
    onProgress({
      stage: 'saving',
      current: colabIndex,
      total: totalColabs,
      percent: pctUpload,
      message: `Buscando e-mail: ${nomeCompleto}`,
    });
    const emailFromBubble = await fetchEmailFromBubble(cpf);

    // ── 7. Upsert em public.informes ──
    // Regra: preservar o e-mail existente no Supabase caso o Bubble não retorne.
    // Por isso montamos o payload condicionalmente — só incluímos `email`
    // se o Bubble retornou um valor não-nulo, evitando sobrescrever com null.
    console.log(`[Upload] Salvando no banco: ${nomeCompleto} (${cpf}) | e-mail: ${emailFromBubble ?? '(não encontrado)'}`);

    const upsertPayload: Record<string, unknown> = {
      nome_completo:  nomeCompleto,
      cpf,
      paginas:        [startPage, endPage],
      pdf_url:        pdfUrl,
      pdf_filename:   pdfFilename,
      ano_referencia: anoReferencia,
      uploaded_by:    uploadedBy,
    };

    // Só sobrescreve o e-mail se o Bubble retornou um valor válido
    if (emailFromBubble !== null) {
      upsertPayload.email = emailFromBubble;
    }

    const { data: saved, error: dbError } = await supabase
      .from('informes')
      .upsert(upsertPayload, { onConflict: 'cpf,ano_referencia' })
      .select()
      .single();

    if (dbError) {
      const msg = `Erro no banco para "${nomeCompleto}": ${dbError.message}`;
      console.error('[Upload]', msg);
      onProgress({ stage: 'error', current: colabIndex, total: totalColabs, percent: pctUpload, message: '', error: msg });
      throw new Error(msg);
    }

    console.log(`[Upload] ✓ ${nomeCompleto} salvo com id=${saved.id}`);
    results.push(saved as InformeRecord);
  }

  onProgress({
    stage: 'done',
    current: results.length,
    total: totalColabs,
    percent: 100,
    message: `${results.length} informes importados com sucesso!`,
  });

  return results;
}


// ─────────────────────────────────────────────────────────────
// DELETE — exclui registros do banco + arquivos do Storage
// ─────────────────────────────────────────────────────────────

export async function deleteInformes(ids: string[], informes: InformeRecord[]): Promise<void> {
  // 1. Excluir arquivos do Storage
  const toRemove = informes
    .filter(i => ids.includes(i.id))
    .map(i => `${i.ano_referencia}/${i.pdf_filename}`);

  if (toRemove.length > 0) {
    const { error: storageErr } = await supabase.storage
      .from('informes-pdfs')
      .remove(toRemove);
    if (storageErr) console.error('Erro ao remover do Storage:', storageErr.message);
  }

  // 2. Excluir registros do banco
  const { error: dbErr } = await supabase
    .from('informes')
    .delete()
    .in('id', ids);

  if (dbErr) throw new Error(dbErr.message);
}
