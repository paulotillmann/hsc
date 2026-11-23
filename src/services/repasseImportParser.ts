// src/services/repasseImportParser.ts
// Motor de extração e parsing inteligente de arquivos PDF e Excel/CSV para Repasses Médicos.
// Suporta:
// 1. UNIMED (Espelho de Pagamento Prestador - Sistema Cardio RptEventosPagos)
// 2. IPSEMG / SIGAS (Relatório de Processamento)
// 3. Padrão TISS ANS (ex: CEMIG SAÚDE - Demonstrativo de Análise de Conta)
// 4. HAPVIDA / GNDI MINAS (Demonstrativo de Análise de Contas)
// 5. PDF Genérico e Planilhas Excel / CSV (.xlsx, .xls, .csv)

// @ts-ignore
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import * as XLSX from 'xlsx';

pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

export type RepasseLayoutType =
  | 'UNIMED_CARDIO'
  | 'IPSEMG_SIGAS'
  | 'TISS_DEMONSTRATIVO'
  | 'GNDI_DEMONSTRATIVO'
  | 'EXCEL_DETALHADO'
  | 'EXCEL_RESUMO'
  | 'PDF_GENERICO';

export interface ParsedProcedimentoDetalhe {
  id: string;
  paciente: string;
  codigo_procedimento: string;
  procedimento: string;
  data_procedimento: string; // YYYY-MM-DD
  quantidade: number;
  valor_apresentado: number;
  valor_aprovado: number;
  tipo_servico?: string;
  participacao?: string;
  profissional_original?: string;
  eh_item_medico: boolean;
}

export interface ParsedRepasseGroup {
  id: string;
  selecionado: boolean;
  tipo: 'profissional' | 'setor';
  destinatario: string; // Nome do médico ou setor (ou '' quando aguarda vínculo manual)
  precisa_vinculo: boolean;
  desconto_percentual: number;
  valor_bruto_aprovado: number;
  valor_bruto_apresentado: number;
  detalhes: ParsedProcedimentoDetalhe[];
}

export interface ParsedImportResult {
  layout: RepasseLayoutType;
  layoutLabel: string;
  nomeArquivo: string;
  convenioDetectado: string | null;
  competenciaDetectada: string | null; // MM-AAAA
  numeroDocumentoDetectado: string | null;
  valorNotaFiscalDetectado: number | null;
  totalPaginas?: number;
  possuiMapeamentoAutomaticoMedico: boolean;
  grupos: ParsedRepasseGroup[];
  avisos: string[];
}

export interface ParseProgressCallback {
  (info: { current: number; total: number; message: string }): void;
}

interface PdfToken {
  str: string;
  x: number;
  y: number;
}

interface PdfRow {
  y: number;
  items: PdfToken[];
}

// Dicionário de descrições amigáveis para códigos TUSS/SIGAS recorrentes na Santa Casa
const TUSS_DESCRICOES: Record<string, string> = {
  '10104020': 'ATENDIMENTO DO INTENSIVISTA (DIÁRIA UTI POR PACIENTE)',
  '10104011': 'ATENDIMENTO MÉDICO DO INTENSIVISTA EM UTI GERAL OU PEDIÁTRICA',
  '10102019': 'VISITA HOSPITALAR (PACIENTE INTERNADO)',
  '10101012': 'CONSULTA EM CONSULTÓRIO',
  '10101039': 'CONSULTA EM PRONTO SOCORRO',
  '10103015': 'ATENDIMENTO AO RECÉM-NASCIDO EM BERÇÁRIO',
  '10103023': 'ATENDIMENTO AO RECÉM-NASCIDO EM SALA DE PARTO (BAIXO RISCO)',
  '10103031': 'ATENDIMENTO AO RECÉM-NASCIDO EM SALA DE PARTO (ALTO RISCO)',
  '01010760': 'VISITA / AVALIAÇÃO HOSPITALAR (IPSEMG)',
  '51030209': 'PROCEDIMENTO CIRÚRGICO / HONORÁRIO MÉDICO (51030209)',
  '51050145': 'PROCEDIMENTO CIRÚRGICO / HONORÁRIO MÉDICO (51050145)',
  '40090515': 'EXAME / PROCEDIMENTO DIAGNÓSTICO (40090515)',
  '20010010': 'ATENDIMENTO CLÍNICO / TERAPIA (20010010)',
  '30501458': 'TURBINECTOMIA OU TURBINOPLASTIA - UNILATERAL',
  '30205050': 'AMIGDALECTOMIA DAS PALATINAS',
  '30205042': 'ADENOIDECTOMIA',
  '30501369': 'SEPTOPLASTIA CARTILAGINOSA',
};

export function parseCurrencyValue(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const str = String(val).trim();
  const isNegative = str.startsWith('-') || str.endsWith('D');
  const clean = str.replace(/[R$\sCD+-]/gi, '');
  if (!clean) return 0;

  let normalized = clean;
  if (clean.includes(',') && clean.includes('.')) {
    // Decide qual vem por último (ex: 1.234,56 vs 1,234.56)
    if (clean.lastIndexOf(',') > clean.lastIndexOf('.')) {
      normalized = clean.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = clean.replace(/,/g, '');
    }
  } else if (clean.includes(',')) {
    normalized = clean.replace(',', '.');
  }

  const n = parseFloat(normalized);
  if (isNaN(n)) return 0;
  return isNegative ? -Math.abs(n) : n;
}

export function normalizeDateToISO(dateStr: string): string {
  if (!dateStr) return new Date().toISOString().slice(0, 10);
  const clean = String(dateStr).trim().split(' ')[0];
  const brMatch = clean.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) {
    return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
  }
  const isoMatch = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return clean;
  }
  return new Date().toISOString().slice(0, 10);
}

function getProcedimentoLabel(codigo: string, descricaoBruta?: string, tpServico?: string, partServ?: string): string {
  const cleanCod = (codigo || '').trim();
  const cleanDesc = (descricaoBruta || '').replace(/\s+/g, ' ').trim();
  if (cleanDesc && cleanDesc.length > 3 && !/^\d+$/.test(cleanDesc)) {
    return cleanCod ? `${cleanCod} - ${cleanDesc.toUpperCase()}` : cleanDesc.toUpperCase();
  }
  if (cleanCod && TUSS_DESCRICOES[cleanCod]) {
    return `${cleanCod} - ${TUSS_DESCRICOES[cleanCod]}`;
  }
  const extras = [tpServico, partServ].filter(Boolean).join(' / ');
  if (cleanCod && extras) {
    return `${cleanCod} - ${extras.toUpperCase()}`;
  }
  return cleanCod || 'PROCEDIMENTO MÉDICO';
}

function isMedicalTussCode(code: string, desc: string): boolean {
  const c = (code || '').trim();
  const d = (desc || '').toUpperCase();
  // Taxas, materiais, medicamentos e gases geralmente começam com 6, 7, 8, 9 ou 000
  if (/^(6|7|8|9|000)/.test(c)) return false;
  if (/TAXA|MATERIAL|MEDICAMENTO|SERINGA|AGULHA|EQUIPO|COMPRESSA|LUVA|CATETER|SONDA|OXIGENIO|ENFERMARIA|SORO|AGUA PARA INJECAO|CLORIDRATO|TROMETAMOL/i.test(d)) {
    return false;
  }
  // Códigos TUSS médicos/cirúrgicos/exames geralmente começam com 1, 2, 3, 4, 5
  return true;
}

async function getPageTokens(page: any): Promise<PdfToken[]> {
  const content = await page.getTextContent();
  return (content.items as any[])
    .filter(item => item.str && String(item.str).trim().length > 0)
    .map(item => ({
      str: String(item.str).trim(),
      x: item.transform ? Number(item.transform[4]) : 0,
      y: item.transform ? Number(item.transform[5]) : 0,
    }));
}

function groupRows(tokens: PdfToken[], tolerance = 2.5): PdfRow[] {
  const rows: PdfRow[] = [];
  for (const t of tokens) {
    let row = rows.find(r => Math.abs(r.y - t.y) <= tolerance);
    if (!row) {
      row = { y: t.y, items: [] };
      rows.push(row);
    }
    row.items.push(t);
  }
  rows.sort((a, b) => b.y - a.y);
  for (const r of rows) {
    r.items.sort((a, b) => a.x - b.x);
  }
  return rows;
}

function rowsToPlainText(rows: PdfRow[]): string {
  return rows.map(r => r.items.map(i => i.str).join(' ')).join('\n');
}

// ─────────────────────────────────────────────────────────────
// 1. PARSER UNIMED (ESPELHO DE PAGAMENTO PRESTADOR - CARDIO)
// ─────────────────────────────────────────────────────────────
async function parseUnimedPdf(
  doc: any,
  fileName: string,
  onProgress?: ParseProgressCallback
): Promise<ParsedImportResult> {
  let competencia: string | null = null;
  let numeroDoc: string | null = null;
  let valorNotaFiscal: number | null = null;
  let currentBeneficiario = 'PACIENTE NÃO IDENTIFICADO';

  const detalhesPorProfissional = new Map<string, ParsedProcedimentoDetalhe[]>();

  for (let p = 1; p <= doc.numPages; p++) {
    if (onProgress && (p === 1 || p % 15 === 0 || p === doc.numPages)) {
      onProgress({
        current: p,
        total: doc.numPages,
        message: `Lendo página ${p} de ${doc.numPages} (Espelho UNIMED)...`,
      });
    }

    const page = await doc.getPage(p);
    const tokens = await getPageTokens(page);
    const rows = groupRows(tokens, 2.5);
    const pageText = rowsToPlainText(rows);

    if (p === 1) {
      const compMatch = pageText.match(/Comp\.Pagamento:\s*(\d{2}-\d{4})/i);
      if (compMatch) competencia = compMatch[1];
      const docMatch = pageText.match(/N[º°o]\s*Doc\.\s*Financeiro:\s*(\d+)/i);
      if (docMatch) numeroDoc = docMatch[1];
    }

    if (p >= doc.numPages - 2) {
      const liqMatch = pageText.match(/Valor\s+L[íi]quido\s+a\s+Receber:\s*R?\$?\s*([\d.,]+)/i);
      if (liqMatch) {
        valorNotaFiscal = parseCurrencyValue(liqMatch[1]);
      } else if (!valorNotaFiscal) {
        const totMatch = pageText.match(/Total\s+de\s+Pagamento:[\s\S]{0,60}?R\$\s*([\d.,]+)/i);
        if (totMatch) valorNotaFiscal = parseCurrencyValue(totMatch[1]);
      }
    }

    for (const r of rows) {
      const first = r.items[0];
      if (!first) continue;

      // Cabeçalho de Beneficiário: código de 13 a 18 dígitos na margem esquerda (x < 30)
      if (first.x < 30 && /^\d{13,18}$/.test(first.str)) {
        const nameTokens = r.items.filter(i => i.x >= 75 && i.x < 250);
        if (nameTokens.length > 0) {
          currentBeneficiario = nameTokens.map(i => i.str).join(' ').trim().toUpperCase();
        }
        continue;
      }

      // Linha de Evento Pago: começa com Seq numérico em x entre 24 e 48
      if (first.x >= 24 && first.x <= 48 && /^\d+$/.test(first.str)) {
        const solic = r.items.find(i => i.x >= 52 && i.x < 115 && /^\d+$/.test(i.str));
        const servico = r.items.find(i => i.x >= 305 && i.x < 385 && /^\d{6,10}$/.test(i.str));
        if (!solic || !servico) continue;

        const prestadorRaw = r.items
          .filter(i => i.x >= 120 && i.x < 260)
          .map(i => i.str)
          .join(' ')
          .trim()
          .toUpperCase();

        if (
          !prestadorRaw ||
          prestadorRaw.includes('SANTA CASA') ||
          prestadorRaw.includes('HOSPITAL SANTA CASA')
        ) {
          continue;
        }

        const tpServico = r.items.filter(i => i.x >= 260 && i.x < 312).map(i => i.str).join(' ').trim();
        const dtHr = r.items.filter(i => i.x >= 488 && i.x < 560).map(i => i.str).join(' ').trim();
        const partServ = r.items.filter(i => i.x >= 560 && i.x < 610).map(i => i.str).join(' ').trim();
        const qtdeItem = r.items.find(i => i.x >= 680 && i.x < 712);
        const vlPagoItem = r.items.find(i => i.x >= 712 && i.x < 746);
        const cdItem = r.items.find(i => i.x >= 746 && (i.str === 'C' || i.str === 'D'));

        const sign = cdItem && cdItem.str === 'D' ? -1 : 1;
        const qtde = (qtdeItem ? parseCurrencyValue(qtdeItem.str) : 1) * sign;
        const vlPago = Number(((vlPagoItem ? parseCurrencyValue(vlPagoItem.str) : 0) * sign).toFixed(2));
        const dataAtend = normalizeDateToISO(dtHr.split(' ')[0] || '');

        const detalhe: ParsedProcedimentoDetalhe = {
          id: `unimed-${p}-${first.str}-${solic.str}-${Math.random().toString(36).slice(2, 6)}`,
          paciente: currentBeneficiario,
          codigo_procedimento: servico.str,
          procedimento: getProcedimentoLabel(servico.str, undefined, tpServico, partServ),
          data_procedimento: dataAtend,
          quantidade: qtde || 1,
          valor_apresentado: vlPago,
          valor_aprovado: vlPago,
          tipo_servico: tpServico,
          participacao: partServ,
          profissional_original: prestadorRaw,
          eh_item_medico: true,
        };

        const lista = detalhesPorProfissional.get(prestadorRaw) || [];
        lista.push(detalhe);
        detalhesPorProfissional.set(prestadorRaw, lista);
      }
    }
  }

  const grupos: ParsedRepasseGroup[] = [];
  for (const [prof, detalhes] of Array.from(detalhesPorProfissional.entries()).sort((a, b) =>
    a[0].localeCompare(b[0])
  )) {
    // Agrupa estornos e diárias do mesmo paciente + mesmo procedimento para deixar o detalhamento limpo
    const consolidadoMap = new Map<string, ParsedProcedimentoDetalhe>();
    for (const d of detalhes) {
      const key = `${d.paciente}||${d.codigo_procedimento}`;
      const existing = consolidadoMap.get(key);
      if (!existing) {
        consolidadoMap.set(key, { ...d });
      } else {
        existing.quantidade = Number((existing.quantidade + d.quantidade).toFixed(2));
        existing.valor_aprovado = Number((existing.valor_aprovado + d.valor_aprovado).toFixed(2));
        existing.valor_apresentado = Number((existing.valor_apresentado + d.valor_apresentado).toFixed(2));
        if (d.data_procedimento < existing.data_procedimento) {
          existing.data_procedimento = d.data_procedimento;
        }
      }
    }

    const detalhesConsolidados = Array.from(consolidadoMap.values()).filter(
      d => Math.abs(d.valor_aprovado) >= 0.01
    );

    const somaAprovado = Number(
      detalhesConsolidados.reduce((acc, c) => acc + c.valor_aprovado, 0).toFixed(2)
    );

    if (somaAprovado <= 0) continue;

    grupos.push({
      id: `grp-unimed-${prof.replace(/\s+/g, '_')}`,
      selecionado: true,
      tipo: 'profissional',
      destinatario: prof,
      precisa_vinculo: false,
      desconto_percentual: 0,
      valor_bruto_aprovado: somaAprovado,
      valor_bruto_apresentado: somaAprovado,
      detalhes: detalhesConsolidados,
    });
  }

  return {
    layout: 'UNIMED_CARDIO',
    layoutLabel: 'Espelho de Pagamento UNIMED (Sistema Cardio)',
    nomeArquivo: fileName,
    convenioDetectado: 'UNIMED',
    competenciaDetectada: competencia,
    numeroDocumentoDetectado: numeroDoc,
    valorNotaFiscalDetectado: valorNotaFiscal,
    totalPaginas: doc.numPages,
    possuiMapeamentoAutomaticoMedico: true,
    grupos,
    avisos: [
      `Extraídos ${grupos.length} profissionais com produção médica líquida positiva das ${doc.numPages} páginas.`,
      'Você pode redirecionar qualquer médico ou plantonista para um Setor (ex: UTI ADULTO I, UTI NEONATAL, PEDIATRIA) diretamente na tabela abaixo.',
    ],
  };
}

// ─────────────────────────────────────────────────────────────
// 2. PARSER IPSEMG / SIGAS
// ─────────────────────────────────────────────────────────────
async function parseIpsemgPdf(
  doc: any,
  fileName: string,
  onProgress?: ParseProgressCallback
): Promise<ParsedImportResult> {
  let competencia: string | null = null;
  let valorNotaFiscal: number | null = null;
  const detalhesPorProfissional = new Map<string, ParsedProcedimentoDetalhe[]>();

  for (let p = 1; p <= doc.numPages; p++) {
    onProgress?.({
      current: p,
      total: doc.numPages,
      message: `Processando página ${p} de ${doc.numPages} (Relatório IPSEMG)...`,
    });

    const page = await doc.getPage(p);
    const tokens = await getPageTokens(page);
    const rows = groupRows(tokens, 2.5);
    const pageText = rowsToPlainText(rows);

    if (!competencia) {
      const procIdx = rows.findIndex(r => r.items.some(i => /PROCESSAMENTO/i.test(i.str)));
      if (procIdx !== -1) {
        for (let k = procIdx; k <= Math.min(procIdx + 2, rows.length - 1); k++) {
          const lineStr = rows[k].items.map(i => i.str).join(' ');
          const m = lineStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
          if (m) {
            competencia = `${m[2]}-${m[3]}`;
            break;
          }
        }
      }
    }

    // Extrai T. APROVADO ou T. LIQUIDO na última página
    if (p === doc.numPages) {
      const totIdx = rows.findIndex(r => r.items.some(i => /T\.\s*APRESENTADO/i.test(i.str)));
      if (totIdx !== -1 && rows[totIdx + 1]) {
        const valRow = rows[totIdx + 1].items.map(i => parseCurrencyValue(i.str)).filter(v => v > 0);
        // No IPSEMG a linha de totais traz: T.APRESENTADO | T.APROVADO | T.I.R. | T.INSS | T.LIQUIDO
        if (valRow.length >= 2) {
          valorNotaFiscal = valRow[1]; // T. APROVADO (valor bruto da NF)
        }
      }
    }

    // Âncoras de linha: coluna DOC começa com CHO em x < 70
    const anchors = rows.filter(r => r.items[0] && r.items[0].x < 70 && /^CHO\b/.test(r.items[0].str));

    for (let i = 0; i < anchors.length; i++) {
      const anchor = anchors[i];
      const prevY = i > 0 ? anchors[i - 1].y : anchor.y + 18;
      const nextY = i < anchors.length - 1 ? anchors[i + 1].y : anchor.y - 18;
      const upperY = Math.min(anchor.y + 18, (anchor.y + prevY) / 2);
      const lowerY = Math.max(anchor.y - 18, (anchor.y + nextY) / 2);

      const bandTokens = tokens.filter(
        t =>
          t.y <= upperY &&
          t.y > lowerY &&
          !/^(DOC|N_DOC|N_SIGAS|CPF_EXEC|PROFISSIONAL|BENEFICIARIO|UNID_ORG|ESTABELECIMENTO)/i.test(t.str)
      );

      const profTokens = bandTokens
        .filter(t => t.x >= 355 && t.x < 402)
        .sort((a, b) => b.y - a.y || a.x - b.x);
      const benefTokens = bandTokens
        .filter(t => t.x >= 402 && t.x < 452)
        .sort((a, b) => b.y - a.y || a.x - b.x);
      const codTokens = bandTokens.filter(t => t.x >= 250 && t.x < 290 && /^\d{6,10}$/.test(t.str));
      const aprovTokens = anchor.items.filter(t => t.x >= 205 && t.x < 250);
      const dtApresTokens = anchor.items.filter(t => t.x >= 130 && t.x < 205);

      const profissional = profTokens.map(t => t.str).join(' ').replace(/\s+/g, ' ').trim().toUpperCase();
      if (!profissional) continue; // Linha sem profissional é taxa hospitalar da Santa Casa

      const beneficiario =
        benefTokens.map(t => t.str).join(' ').replace(/\s+/g, ' ').trim().toUpperCase() ||
        'PACIENTE IPSEMG';

      const dtApresStr = dtApresTokens.map(t => t.str).join(' ');
      const dtMatch = dtApresStr.match(/(\d{2}\/\d{2}\/\d{4})\s*([\d.,]+)?/);
      const dataAtend = normalizeDateToISO(dtMatch ? dtMatch[1] : '');
      const valApres = dtMatch && dtMatch[2] ? parseCurrencyValue(dtMatch[2]) : 0;
      const valAprov = aprovTokens.length > 0 ? parseCurrencyValue(aprovTokens[0].str) : valApres;
      const codProc = codTokens.map(t => t.str).join('') || '01010760';

      const detalhe: ParsedProcedimentoDetalhe = {
        id: `ipsemg-${p}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        paciente: beneficiario,
        codigo_procedimento: codProc,
        procedimento: getProcedimentoLabel(codProc),
        data_procedimento: dataAtend,
        quantidade: 1,
        valor_apresentado: valApres,
        valor_aprovado: valAprov,
        profissional_original: profissional,
        eh_item_medico: true,
      };

      const lista = detalhesPorProfissional.get(profissional) || [];
      lista.push(detalhe);
      detalhesPorProfissional.set(profissional, lista);
    }
  }

  const grupos: ParsedRepasseGroup[] = [];
  for (const [prof, detalhes] of Array.from(detalhesPorProfissional.entries()).sort((a, b) =>
    a[0].localeCompare(b[0])
  )) {
    const somaAprov = Number(detalhes.reduce((acc, c) => acc + c.valor_aprovado, 0).toFixed(2));
    const somaApres = Number(detalhes.reduce((acc, c) => acc + c.valor_apresentado, 0).toFixed(2));

    grupos.push({
      id: `grp-ipsemg-${prof.replace(/\s+/g, '_')}`,
      selecionado: true,
      tipo: 'profissional',
      destinatario: prof,
      precisa_vinculo: false,
      desconto_percentual: 0,
      valor_bruto_aprovado: somaAprov,
      valor_bruto_apresentado: somaApres,
      detalhes,
    });
  }

  return {
    layout: 'IPSEMG_SIGAS',
    layoutLabel: 'Demonstrativo IPSEMG / SIGAS',
    nomeArquivo: fileName,
    convenioDetectado: 'IPSEMG',
    competenciaDetectada: competencia,
    numeroDocumentoDetectado: null,
    valorNotaFiscalDetectado: valorNotaFiscal,
    totalPaginas: doc.numPages,
    possuiMapeamentoAutomaticoMedico: true,
    grupos,
    avisos: [
      `Foram identificados ${grupos.length} médicos executantes e ${grupos.reduce((a, g) => a + g.detalhes.length, 0)} atendimentos no relatório IPSEMG.`,
    ],
  };
}

// ─────────────────────────────────────────────────────────────
// 3. PARSER DEMONSTRATIVO TISS ANS (EX: CEMIG SAÚDE)
// ─────────────────────────────────────────────────────────────
async function parseTissDemonstrativoPdf(
  doc: any,
  fileName: string,
  onProgress?: ParseProgressCallback
): Promise<ParsedImportResult> {
  let convenio: string | null = null;
  let protocolo: string | null = null;
  let competencia: string | null = null;
  let valorLiberadoGeral: number | null = null;
  let currentBeneficiario = 'BENEFICIÁRIO TISS';

  const procedimentosExtraidos: ParsedProcedimentoDetalhe[] = [];

  for (let p = 1; p <= doc.numPages; p++) {
    onProgress?.({
      current: p,
      total: doc.numPages,
      message: `Lendo página ${p} de ${doc.numPages} (Demonstrativo TISS)...`,
    });

    const page = await doc.getPage(p);
    const tokens = await getPageTokens(page);
    const rows = groupRows(tokens, 2.5);

    for (let rIdx = 0; rIdx < rows.length; rIdx++) {
      const rowText = rows[rIdx].items.map(i => i.str).join(' ');
      const nextRow = rows[rIdx + 1];

      // 3 - Nome da Operadora
      if (/3\s*-\s*Nome\s+da\s+Operadora/i.test(rowText) && nextRow) {
        const opTokens = nextRow.items.filter(i => i.x >= 140 && i.x < 480);
        if (opTokens.length > 0) {
          convenio = opTokens.map(i => i.str).join(' ').trim().toUpperCase();
        }
      }

      // 10 - Número do Protocolo e 11 - Data do Protocolo
      if (/10\s*-\s*N[úu]mero\s+do\s+Protocolo/i.test(rowText)) {
        for (let k = rIdx + 1; k <= Math.min(rIdx + 3, rows.length - 1); k++) {
          const cand = rows[k];
          const protTok = cand.items.find(i => i.x >= 200 && i.x < 380 && /^\d+$/.test(i.str));
          const dtTok = cand.items.find(i => i.x >= 400 && i.x < 540 && /^\d{2}\/\d{2}\/\d{4}$/.test(i.str));
          if (protTok && !protocolo) protocolo = protTok.str;
          if (dtTok && !competencia) {
            const parts = dtTok.str.split('/');
            competencia = `${parts[1]}-${parts[2]}`;
          }
        }
      }

      // 17 - Nome do Beneficiário
      if (/17\s*-\s*Nome\s+do\s+Benefici[áa]rio/i.test(rowText) && nextRow) {
        const benTokens = nextRow.items.filter(i => i.x < 500);
        if (benTokens.length > 0) {
          currentBeneficiario = benTokens.map(i => i.str).join(' ').trim().toUpperCase();
        }
      }

      // 46 - Valor Liberado Geral ou 38 - Valor Liberado da Guia
      if (/(46\s*-\s*Valor\s+Liberado\s+Geral|38\s*-\s*Valor\s+Liberado\s+da\s+Guia)/i.test(rowText) && nextRow) {
        const libTokens = nextRow.items.filter(i => i.x >= 420 && i.x < 600);
        const val = parseCurrencyValue(libTokens.map(i => i.str).join(' '));
        if (val > 0) valorLiberadoGeral = val;
      }

      // Linha de procedimento: começa com data DD/MM/AAAA em x < 85
      const first = rows[rIdx].items[0];
      if (first && first.x < 85 && /^\d{2}\/\d{2}\/\d{4}$/.test(first.str)) {
        const codTok = rows[rIdx].items.find(i => i.x >= 145 && i.x < 260 && /^\d{6,10}$/.test(i.str));
        if (!codTok) continue;

        const descTokens = rows[rIdx].items.filter(i => i.x >= 265 && i.x < 455);
        const valInfTokens = rows[rIdx].items.filter(i => i.x >= 455 && i.x < 522);
        const qtdTokens = rows[rIdx].items.filter(i => i.x >= 522 && i.x < 575);
        const valLibTokens = rows[rIdx].items.filter(i => i.x >= 640 && i.x < 702);

        const desc = descTokens.map(i => i.str).join(' ').trim();
        const valInf = parseCurrencyValue(valInfTokens.map(i => i.str).join(' '));
        const valLib = parseCurrencyValue(valLibTokens.map(i => i.str).join(' '));
        const qtd = parseCurrencyValue(qtdTokens.map(i => i.str).join(' ')) || 1;
        const ehMed = isMedicalTussCode(codTok.str, desc);

        procedimentosExtraidos.push({
          id: `tiss-${p}-${rIdx}-${codTok.str}`,
          paciente: currentBeneficiario,
          codigo_procedimento: codTok.str,
          procedimento: getProcedimentoLabel(codTok.str, desc),
          data_procedimento: normalizeDateToISO(first.str),
          quantidade: qtd,
          valor_apresentado: valInf,
          valor_aprovado: valLib,
          eh_item_medico: ehMed,
        });
      }
    }
  }

  // Cada procedimento médico vira um item pré-selecionado aguardando vínculo do Médico/Setor
  const grupos: ParsedRepasseGroup[] = procedimentosExtraidos.map((proc, idx) => ({
    id: `grp-tiss-${idx}-${proc.codigo_procedimento}`,
    selecionado: proc.eh_item_medico && (proc.valor_aprovado > 0 || proc.valor_apresentado > 0),
    tipo: 'profissional',
    destinatario: '',
    precisa_vinculo: true,
    desconto_percentual: 0,
    valor_bruto_aprovado: proc.valor_aprovado,
    valor_bruto_apresentado: proc.valor_apresentado,
    detalhes: [proc],
  }));

  return {
    layout: 'TISS_DEMONSTRATIVO',
    layoutLabel: 'Demonstrativo de Análise de Conta (Padrão TISS ANS)',
    nomeArquivo: fileName,
    convenioDetectado: convenio || 'CEMIG SAUDE',
    competenciaDetectada: competencia,
    numeroDocumentoDetectado: protocolo,
    valorNotaFiscalDetectado: valorLiberadoGeral,
    totalPaginas: doc.numPages,
    possuiMapeamentoAutomaticoMedico: false,
    grupos,
    avisos: [
      'Este demonstrativo padrão TISS não traz o nome do médico executante.',
      'Selecione o Médico ou Setor correspondente para os procedimentos médicos na coluna "Vincular Médico / Setor" abaixo.',
    ],
  };
}

// ─────────────────────────────────────────────────────────────
// 4. PARSER DEMONSTRATIVO HAPVIDA / GNDI MINAS
// ─────────────────────────────────────────────────────────────
async function parseGndiDemonstrativoPdf(
  doc: any,
  fileName: string,
  onProgress?: ParseProgressCallback
): Promise<ParsedImportResult> {
  let convenio = 'GNDI MINAS';
  let processo: string | null = null;
  let competencia: string | null = null;
  let valorNotaFiscal: number | null = null;

  const todosProcedimentos: ParsedProcedimentoDetalhe[] = [];

  for (let p = 1; p <= doc.numPages; p++) {
    onProgress?.({
      current: p,
      total: doc.numPages,
      message: `Lendo página ${p} de ${doc.numPages} (Demonstrativo GNDI/Hapvida)...`,
    });

    const page = await doc.getPage(p);
    const tokens = await getPageTokens(page);
    const rows = groupRows(tokens, 2.5);
    const pageText = rowsToPlainText(rows);

    if (p === 1) {
      const procMatch = pageText.match(/Processo:\s*(\d+)/i);
      if (procMatch) processo = procMatch[1];

      const entregaMatch = pageText.match(/Data\s+de\s+Entrega:\s*(\d{2})\/(\d{2})\/(\d{4})/i);
      if (entregaMatch) competencia = `${entregaMatch[2]}-${entregaMatch[3]}`;

      const nfMatch =
        pageText.match(/Valor\s+L[íi]quido\s+R\$:\s*([\d.,]+)/i) ||
        pageText.match(/Valor\s+Bruto\s+NF\s+R\$:\s*([\d.,]+)/i);
      if (nfMatch) valorNotaFiscal = parseCurrencyValue(nfMatch[1]);
    }

    for (let rIdx = 0; rIdx < rows.length; rIdx++) {
      const r = rows[rIdx];
      // Na tabela GNDI: Data Atendimento fica em x ~ 184 e Cód. Procedimento em x ~ 231
      const dtTok = r.items.find(i => i.x >= 170 && i.x < 220 && /^\d{2}\/\d{2}\/\d{4}$/.test(i.str));
      const codTok = r.items.find(i => i.x >= 220 && i.x < 270 && /^\d{7,10}$/.test(i.str));
      if (!dtTok || !codTok) continue;

      const userTok = r.items.find(i => i.x < 85);
      const docTok = r.items.find(i => i.x >= 125 && i.x < 170);
      const valFatTokens = r.items.filter(i => i.x >= 385 && i.x < 438);
      const valAnaTokens = r.items.filter(i => i.x >= 438 && i.x < 488);

      // A descrição do procedimento pode ocupar 1 a 2 linhas seguintes em x ~ 278
      const descParts = r.items.filter(i => i.x >= 270 && i.x < 385).map(i => i.str);
      for (let k = rIdx + 1; k <= Math.min(rIdx + 2, rows.length - 1); k++) {
        const subRow = rows[k];
        const hasNewDate = subRow.items.some(i => i.x >= 170 && i.x < 220 && /^\d{2}\/\d{2}\/\d{4}$/.test(i.str));
        const isGlosaLine = subRow.items.some(i => /Glosa\s+ANS|Motivo\s+Glosa/i.test(i.str));
        if (hasNewDate || isGlosaLine) break;
        const contTokens = subRow.items.filter(i => i.x >= 270 && i.x < 385);
        if (contTokens.length > 0) {
          descParts.push(...contTokens.map(i => i.str));
        }
      }

      const descFull = descParts.join(' ').replace(/\s+/g, ' ').trim();
      const valFaturado = parseCurrencyValue(valFatTokens.map(i => i.str).join(' '));
      const valAnalisado = parseCurrencyValue(valAnaTokens.map(i => i.str).join(' '));
      const ehMedico = isMedicalTussCode(codTok.str, descFull);

      todosProcedimentos.push({
        id: `gndi-${p}-${rIdx}-${codTok.str}`,
        paciente: `GUIA ${docTok?.str || ''} (${userTok?.str || 'PACIENTE'})`.trim(),
        codigo_procedimento: codTok.str,
        procedimento: getProcedimentoLabel(codTok.str, descFull),
        data_procedimento: normalizeDateToISO(dtTok.str),
        quantidade: 1,
        valor_apresentado: valFaturado,
        valor_aprovado: valAnalisado,
        eh_item_medico: ehMedico,
      });
    }
  }

  // Filtra prioritariamente os procedimentos médicos/cirúrgicos (ex: códigos 30...), ou exibe todos se não houver médicos
  const procedimentosMedicos = todosProcedimentos.filter(p => p.eh_item_medico);
  const listaBase = procedimentosMedicos.length > 0 ? procedimentosMedicos : todosProcedimentos;

  // Agrupa os procedimentos médicos em um único grupo ou linhas individuais para o usuário vincular ao médico cirurgião
  const somaAprov = Number(listaBase.reduce((acc, c) => acc + c.valor_aprovado, 0).toFixed(2));
  const somaApres = Number(listaBase.reduce((acc, c) => acc + c.valor_apresentado, 0).toFixed(2));

  const grupos: ParsedRepasseGroup[] = [];

  if (listaBase.length > 0) {
    // Criamos um grupo consolidado da guia cirúrgica/médica (com todos os procedimentos nos detalhes)
    grupos.push({
      id: `grp-gndi-consolidado`,
      selecionado: true,
      tipo: 'profissional',
      destinatario: '',
      precisa_vinculo: true,
      desconto_percentual: 0,
      valor_bruto_aprovado: somaAprov,
      valor_bruto_apresentado: somaApres,
      detalhes: listaBase,
    });
  }

  return {
    layout: 'GNDI_DEMONSTRATIVO',
    layoutLabel: 'Demonstrativo de Análise de Contas (GNDI Minas / Hapvida)',
    nomeArquivo: fileName,
    convenioDetectado: convenio,
    competenciaDetectada: competencia,
    numeroDocumentoDetectado: processo,
    valorNotaFiscalDetectado: valorNotaFiscal,
    totalPaginas: doc.numPages,
    possuiMapeamentoAutomaticoMedico: false,
    grupos,
    avisos: [
      `Extraídos automaticamente ${listaBase.length} procedimento(s) médico(s)/cirúrgico(s) (filtrados ${todosProcedimentos.length - listaBase.length} itens de materiais/medicamentos/taxas hospitalares).`,
      'Selecione o Médico ou Setor responsável para vincular a produção desta guia.',
    ],
  };
}

// ─────────────────────────────────────────────────────────────
// 5. PARSER EXCEL / CSV (.xlsx, .xls, .csv)
// ─────────────────────────────────────────────────────────────
export async function parseExcelFile(file: File): Promise<ParsedImportResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

  return parseTabularRows(rows, file.name);
}

export function parseTabularRows(rows: any[][], sourceName = 'Planilha Excel'): ParsedImportResult {
  const validRows = rows.filter(
    r => Array.isArray(r) && r.some(cell => String(cell ?? '').trim().length > 0)
  );

  if (validRows.length === 0) {
    return {
      layout: 'EXCEL_RESUMO',
      layoutLabel: 'Planilha Excel / CSV',
      nomeArquivo: sourceName,
      convenioDetectado: null,
      competenciaDetectada: null,
      numeroDocumentoDetectado: null,
      valorNotaFiscalDetectado: null,
      possuiMapeamentoAutomaticoMedico: true,
      grupos: [],
      avisos: ['Nenhuma linha válida encontrada na planilha.'],
    };
  }

  // Verifica se há linha de cabeçalho
  const firstRowNormalized = validRows[0].map(c =>
    String(c ?? '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
  );

  const hasHeader = firstRowNormalized.some(c =>
    /medico|profissional|setor|paciente|beneficiario|valor|bruto|liquido|procedimento/.test(c)
  );

  const dataRows = hasHeader ? validRows.slice(1) : validRows;

  // Detecta se é planilha detalhada (com coluna Paciente + Procedimento) ou Resumo (Profissional/Setor + Valor)
  const idxProf = firstRowNormalized.findIndex(c => /medico|profissional|setor|prestador|destinatario/.test(c));
  const idxPaciente = firstRowNormalized.findIndex(c => /paciente|beneficiario|usuario/.test(c));
  const idxProc = firstRowNormalized.findIndex(c => /procedimento|servico|descricao/.test(c));
  const idxData = firstRowNormalized.findIndex(c => /data|dt|atendimento/.test(c));
  const idxQtd = firstRowNormalized.findIndex(c => /qtd|qtde|quantidade/.test(c));
  const idxValor = firstRowNormalized.findIndex(c => /valor|bruto|aprovado|pago|total/.test(c));
  const idxDesconto = firstRowNormalized.findIndex(c => /desconto|retencao|%/.test(c));

  if (hasHeader && idxPaciente !== -1) {
    // Planilha Detalhada por Paciente
    const gruposMap = new Map<string, ParsedProcedimentoDetalhe[]>();

    for (let i = 0; i < dataRows.length; i++) {
      const r = dataRows[i];
      const prof = idxProf !== -1 ? String(r[idxProf] ?? '').trim().toUpperCase() : 'PRODUÇÃO IMPORTADA';
      const paciente = String(r[idxPaciente] ?? '').trim().toUpperCase();
      if (!paciente && !prof) continue;

      const proc = idxProc !== -1 ? String(r[idxProc] ?? '').trim().toUpperCase() : 'PROCEDIMENTO';
      const dataAtend = idxData !== -1 ? normalizeDateToISO(String(r[idxData] ?? '')) : new Date().toISOString().slice(0, 10);
      const qtd = idxQtd !== -1 ? parseCurrencyValue(r[idxQtd]) || 1 : 1;
      const val = idxValor !== -1 ? parseCurrencyValue(r[idxValor]) : parseCurrencyValue(r[r.length - 1]);

      if (val === 0 && !paciente) continue;

      const det: ParsedProcedimentoDetalhe = {
        id: `xls-det-${i}`,
        paciente: paciente || 'PACIENTE',
        codigo_procedimento: '',
        procedimento: proc || 'PROCEDIMENTO MÉDICO',
        data_procedimento: dataAtend,
        quantidade: qtd,
        valor_apresentado: val,
        valor_aprovado: val,
        profissional_original: prof,
        eh_item_medico: true,
      };

      const key = prof || 'VINCULAR DESTINATÁRIO';
      const list = gruposMap.get(key) || [];
      list.push(det);
      gruposMap.set(key, list);
    }

    const grupos: ParsedRepasseGroup[] = Array.from(gruposMap.entries()).map(([dest, detalhes], idx) => {
      const soma = Number(detalhes.reduce((a, b) => a + b.valor_aprovado, 0).toFixed(2));
      const isSetor = /UTI|PEDIATRIA|BERCARIO|MATERNIDADE|SETOR|PLANTAO/i.test(dest);
      const semNome = dest === 'VINCULAR DESTINATÁRIO' || dest === 'PRODUÇÃO IMPORTADA';
      return {
        id: `grp-xls-det-${idx}`,
        selecionado: soma > 0,
        tipo: isSetor ? 'setor' : 'profissional',
        destinatario: semNome ? '' : dest,
        precisa_vinculo: semNome,
        desconto_percentual: isSetor ? 10 : 0,
        valor_bruto_aprovado: soma,
        valor_bruto_apresentado: soma,
        detalhes,
      };
    });

    return {
      layout: 'EXCEL_DETALHADO',
      layoutLabel: 'Planilha Excel Detalhada (Pacientes & Procedimentos)',
      nomeArquivo: sourceName,
      convenioDetectado: null,
      competenciaDetectada: null,
      numeroDocumentoDetectado: null,
      valorNotaFiscalDetectado: null,
      possuiMapeamentoAutomaticoMedico: true,
      grupos,
      avisos: [`Importados ${grupos.length} destinatário(s) com detalhamento de pacientes da planilha.`],
    };
  }

  // Planilha Resumo (Profissional/Setor | Valor Bruto | Desconto % | Valor Líquido)
  const grupos: ParsedRepasseGroup[] = [];
  for (let i = 0; i < dataRows.length; i++) {
    const r = dataRows[i];
    const nome = String(r[idxProf !== -1 ? idxProf : 0] ?? '').trim().toUpperCase();
    if (!nome || /^(TOTAL|SUBTOTAL|RESUMO|ASSINATURA|MEDICO|PROFISSIONAL)$/i.test(nome)) continue;

    let bruto = 0;
    let descPerc = 0;

    if (idxValor !== -1) {
      bruto = parseCurrencyValue(r[idxValor]);
    } else {
      const numCols = r.slice(1).map(c => parseCurrencyValue(c)).filter(v => v > 0);
      bruto = numCols[0] || 0;
    }

    if (idxDesconto !== -1) {
      descPerc = parseCurrencyValue(r[idxDesconto]);
    }

    if (bruto <= 0) continue;

    const isSetor = /UTI|PEDIATRIA|BERCARIO|MATERNIDADE|SETOR|PLANTAO/i.test(nome);
    if (isSetor && descPerc === 0) descPerc = 10;

    grupos.push({
      id: `grp-xls-res-${i}`,
      selecionado: true,
      tipo: isSetor ? 'setor' : 'profissional',
      destinatario: nome,
      precisa_vinculo: false,
      desconto_percentual: descPerc,
      valor_bruto_aprovado: bruto,
      valor_bruto_apresentado: bruto,
      detalhes: [],
    });
  }

  return {
    layout: 'EXCEL_RESUMO',
    layoutLabel: 'Planilha Resumo de Repasses (Excel / CSV)',
    nomeArquivo: sourceName,
    convenioDetectado: null,
    competenciaDetectada: null,
    numeroDocumentoDetectado: null,
    valorNotaFiscalDetectado: null,
    possuiMapeamentoAutomaticoMedico: true,
    grupos,
    avisos: [`Foram extraídos ${grupos.length} lançamentos da planilha.`],
  };
}

// ─────────────────────────────────────────────────────────────
// FUNÇÃO PRINCIPAL DE DETECÇÃO E PARSING DE ARQUIVO (PDF / EXCEL)
// ─────────────────────────────────────────────────────────────
export async function parseRepasseFile(
  file: File,
  onProgress?: ParseProgressCallback
): Promise<ParsedImportResult> {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';

  if (['xlsx', 'xls', 'csv'].includes(ext)) {
    onProgress?.({ current: 1, total: 1, message: 'Lendo planilha Excel/CSV...' });
    return parseExcelFile(file);
  }

  // Processamento de PDF via pdfjs-dist
  onProgress?.({ current: 0, total: 1, message: 'Carregando documento PDF...' });
  const arrayBuffer = await file.arrayBuffer();
  const uint8 = new Uint8Array(arrayBuffer);
  const doc = await pdfjs.getDocument({ data: uint8 }).promise;

  // Inspeciona a página 1 para detectar automaticamente o layout
  const firstPage = await doc.getPage(1);
  const firstTokens = await getPageTokens(firstPage);
  const firstRows = groupRows(firstTokens, 2.5);
  const firstPageText = rowsToPlainText(firstRows);

  if (
    /Espelho\s+de\s+Pagamento\s+Prestador/i.test(firstPageText) ||
    /RptEventosPagos/i.test(firstPageText) ||
    /Sistema\s+Cardio/i.test(firstPageText)
  ) {
    return parseUnimedPdf(doc, file.name, onProgress);
  }

  if (/N_SIGAS/i.test(firstPageText) || /CPF_EXEC/i.test(firstPageText)) {
    return parseIpsemgPdf(doc, file.name, onProgress);
  }

  if (
    /DEMONSTRATIVO\s+DE\s+AN[ÁA]LISE\s+DE\s+CONTAS/i.test(firstPageText) &&
    (/DISCRIMINATIVO\s+DOS\s+SERVI[ÇC]OS\s+EXECUTADOS/i.test(firstPageText) ||
      /GNDI\s+MINAS/i.test(firstPageText))
  ) {
    return parseGndiDemonstrativoPdf(doc, file.name, onProgress);
  }

  if (
    /DEMONSTRATIVO\s+DE\s+AN[ÁA]LISE\s+DE\s+CONTA/i.test(firstPageText) ||
    /1\s*-\s*Registro\s+ANS/i.test(firstPageText)
  ) {
    return parseTissDemonstrativoPdf(doc, file.name, onProgress);
  }

  // Fallback genérico caso seja outro PDF TISS/Demonstrativo
  return parseTissDemonstrativoPdf(doc, file.name, onProgress);
}
