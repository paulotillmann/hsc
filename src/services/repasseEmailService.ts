import { supabase } from '../lib/supabase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { RepasseItem, RepasseCompetencia, repasseService } from './repasseService';

export interface SendRelatorioFinanceiroParams {
  to: string[];
  competencia: RepasseCompetencia;
  itens: RepasseItem[];
  totalBruto: number;
  totalRetencao: number;
  totalLiquido: number;
  observacoes?: string;
}

export interface SendEmailResponse {
  success: boolean;
  error?: string;
  recipientsCount?: number;
}

const formatCurrency = (val: number = 0) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
};

const formatDateBR = (dateStr: string | null): string => {
  if (!dateStr) return '';
  const clean = String(dateStr).trim().slice(0, 10);
  if (clean.includes('-')) {
    const parts = clean.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
  }
  return clean;
};

/**
 * Gera o documento PDF Consolidado Oficial da Santa Casa (Resumo Geral + Detalhamento dos Setores)
 * e retorna em formato Data URI / Base64.
 */
export async function gerarPdfConsolidadoBase64(
  competencia: RepasseCompetencia,
  itens: RepasseItem[]
): Promise<string> {
  const doc = new jsPDF();
  const convenio = (competencia.convenio || 'UNIMED').toUpperCase();
  const competenciaStr = competencia.competencia;
  const valorNotaFiscal = competencia.valor_nota_fiscal || 0;

  // 1. Logo Oficial HSC e Cabeçalho Institucional
  try {
    const imgObj = new Image();
    imgObj.src = '/LOGO_HSC_PRIMARY.png';
    await new Promise((resolve) => {
      imgObj.onload = resolve;
      imgObj.onerror = resolve;
    });
    doc.addImage(imgObj, 'PNG', 14, 10, 45, 12);
  } catch (e) {
    console.warn('Erro ao carregar logo do HSC:', e);
  }

  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0);
  doc.text(`Resumo de Repasse ${convenio} - Competência ${competenciaStr}`, 14, 29);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(
    `Nº NOTA FISCAL: ${competencia.numero_nota_fiscal || 'N/A'}  |  Valor da NF: ${formatCurrency(valorNotaFiscal)}  |  Data de Emissão: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
    14,
    35
  );

  // 2. Tabela de Lançamentos de Repasses
  const totalLiquidoGeral = itens.reduce((acc, curr) => acc + (Number(curr.valor_liquido) || 0), 0);

  const tableData = itens.map((it, idx) => [
    idx + 1,
    it.tipo === 'setor' ? `[SETOR] ${it.descricao}` : it.descricao,
    formatCurrency(it.valor_bruto),
    `${it.desconto_percentual || 0}%`,
    formatCurrency(it.valor_liquido)
  ]);

  tableData.push([
    '',
    'TOTAL GERAL DE REPASSES',
    '',
    '',
    formatCurrency(totalLiquidoGeral)
  ]);

  autoTable(doc, {
    startY: 40,
    head: [['#', 'PROFISSIONAL / SETOR', 'VALOR BRUTO', 'DESC.', 'VALOR LÍQUIDO']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [90, 16, 16], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 35, halign: 'right' },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 40, halign: 'right', fontStyle: 'bold' }
    },
    didParseCell: (data) => {
      if (data.row.index === tableData.length - 1) {
        data.cell.styles.fillColor = [248, 240, 240];
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.textColor = [90, 16, 16];
      }
    }
  });

  // 3. Detalhamento de Produção dos Setores que possuem detalhes
  const itensComDetalhes = itens.filter(it => it.tipo === 'setor' || it.possui_detalhes);

  if (itensComDetalhes.length > 0) {
    const detalhesCarregados = await Promise.all(
      itensComDetalhes.map(async (it) => {
        const detalhes = await repasseService.listarDetalhes(it.id);
        return { item: it, detalhes };
      })
    );

    for (const { item: it, detalhes } of detalhesCarregados) {
      if (!detalhes || detalhes.length === 0) continue;

      let lastY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY : 40;
      if (lastY + 55 > 265) {
        doc.addPage();
        lastY = 18;
      } else {
        lastY += 14;
      }

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(90, 16, 16);
      doc.text(`Detalhamento de Produção — ${it.descricao.toUpperCase()}`, 14, lastY);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100);
      doc.text(
        `Setor: ${it.descricao}  |  Desconto Contratual: ${it.desconto_percentual || 0}%  |  Qtd. de Procedimentos: ${detalhes.length}`,
        14,
        lastY + 5
      );

      const sectorBody = detalhes.map((d, dIdx) => [
        dIdx + 1,
        (d.paciente || '').toUpperCase(),
        (d.procedimento || 'ATENDIMENTO DO INTENSIVISTA').toUpperCase(),
        formatDateBR(d.data_procedimento),
        Number(d.quantidade) || 1,
        formatCurrency(Number(d.valor_total) || 0)
      ]);

      sectorBody.push([
        '',
        `SUBTOTAL BRUTO (${it.descricao})`,
        '',
        '',
        '',
        formatCurrency(it.valor_bruto)
      ]);

      if ((it.desconto_percentual || 0) > 0 || (it.desconto_valor || 0) > 0) {
        sectorBody.push([
          '',
          `DESCONTO (${it.desconto_percentual || 0}%)`,
          '',
          '',
          '',
          `- ${formatCurrency(it.desconto_valor)}`
        ]);
      }

      sectorBody.push([
        '',
        `TOTAL LÍQUIDO DO SETOR`,
        '',
        '',
        '',
        formatCurrency(it.valor_liquido)
      ]);

      const numTotais = ((it.desconto_percentual || 0) > 0 || (it.desconto_valor || 0) > 0) ? 3 : 2;

      autoTable(doc, {
        startY: lastY + 9,
        head: [['#', 'PACIENTE', 'PROCEDIMENTO', 'DATA', 'QTD', 'VALOR TOTAL']],
        body: sectorBody,
        theme: 'grid',
        headStyles: { fillColor: [90, 16, 16], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 8, cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 'auto' },
          2: { cellWidth: 55 },
          3: { cellWidth: 22, halign: 'center' },
          4: { cellWidth: 12, halign: 'center' },
          5: { cellWidth: 30, halign: 'right', fontStyle: 'bold' }
        },
        didParseCell: (data) => {
          if (data.row.index >= sectorBody.length - numTotais) {
            data.cell.styles.fillColor = [248, 240, 240];
            data.cell.styles.fontStyle = 'bold';
            if (data.row.index === sectorBody.length - 1) {
              data.cell.styles.textColor = [90, 16, 16];
            }
          }
        }
      });
    }
  }

  // 4. Numeração de Páginas e Rodapé
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.3);
    doc.line(14, 283, 196, 283);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(130);
    doc.text(
      `Santa Casa de Misericórdia de Araguari • HSC Sistemas • Página ${i} de ${totalPages}`,
      14,
      288
    );
    doc.text(
      `Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
      196,
      288,
      { align: 'right' }
    );
  }

  return doc.output('datauristring');
}

/**
 * Dispara o Relatório Detalhado de Repasse ao Setor Financeiro via Edge Function
 */
export async function sendRelatorioRepasseFinanceiroEmail(
  params: SendRelatorioFinanceiroParams
): Promise<SendEmailResponse> {
  try {
    const { to, competencia, itens, totalBruto, totalRetencao, totalLiquido, observacoes } = params;

    // 1. Gera o PDF consolidado idêntico ao baixado pelo usuário
    const pdfBase64 = await gerarPdfConsolidadoBase64(competencia, itens);

    const safeConv = (competencia.convenio || 'CONVENIO').replace(/[^a-zA-Z0-9]/g, '_');
    const safeComp = (competencia.competencia || '').replace(/[^a-zA-Z0-9]/g, '-');
    const pdfFilename = `Relatorio_Repasse_${safeConv}_${safeComp}.pdf`;

    const subject = `Relatório de Repasses Médicos — ${competencia.convenio} (${competencia.competencia})${competencia.numero_nota_fiscal ? ` — NF ${competencia.numero_nota_fiscal}` : ''} | Santa Casa de Araguari`;

    // 2. Prepara o payload para a Edge Function
    const payload = {
      to,
      nomeMedico: 'Setor Financeiro',
      periodoReferencia: competencia.competencia,
      tipoModulo: 'repasse',
      convenio: competencia.convenio,
      subject,
      resumoRepasse: {
        convenio: competencia.convenio,
        competencia: competencia.competencia,
        valorBruto: totalBruto,
        descontoPercentual: totalBruto > 0 ? Number(((totalRetencao / totalBruto) * 100).toFixed(2)) : 0,
        descontoValor: totalRetencao,
        valorLiquido: totalLiquido
      },
      // Resumo compatível
      resumo: {
        totalPlantoes: itens.length,
        valorPlantoes: totalBruto,
        valorProducao: 0,
        valorTotalGeral: totalLiquido,
        tipoPlantao: `Repasse ${competencia.convenio}`
      },
      observacoes,
      pdfBase64,
      pdfFilename
    };

    // 3. Invoca a Edge Function
    const { data, error } = await supabase.functions.invoke('send-plantao-email', {
      body: payload
    });

    if (error) {
      console.error('[Send Repasse Email] Erro ao invocar edge function:', error);
      let errMsg = error.message || 'Falha ao contatar o servidor de e-mails.';
      try {
        if ((error as any).context) {
          const bodyJson = await (error as any).context.json();
          if (bodyJson?.error) errMsg = bodyJson.error;
        }
      } catch (_) {}
      return { success: false, error: errMsg };
    }

    if (data?.error) {
      console.error('[Send Repasse Email] Erro retornado pela função:', data.error);
      return { success: false, error: data.error };
    }

    // 4. Registra no banco de dados o envio da competência
    await repasseService.registrarEnvioEmailCompetencia(competencia.id, to);

    return {
      success: true,
      recipientsCount: data?.recipientsCount || to.length
    };
  } catch (err: any) {
    console.error('[Send Repasse Email] Exceção:', err);
    return {
      success: false,
      error: err.message || 'Erro inesperado ao gerar relatório e enviar e-mail.'
    };
  }
}
