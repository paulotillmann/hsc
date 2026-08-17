import { supabase } from '../lib/supabase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PlantaoMedicoSintetico, PlantaoMedicoItem } from '../pages/Financeiro/PlantaoMedico';

export interface SendPlantaoMedicoEmailParams {
  to: string[];
  nomeMedico: string;
  periodoReferencia: string;
  resumo: {
    totalPlantoes: number;
    valorPlantoes: number;
    valorProducao: number;
    valorTotalGeral: number;
    valorPago?: number;
    valorPendente?: number;
    status?: string;
  };
  sinteticoItem: PlantaoMedicoSintetico;
}

export interface SendEmailResponse {
  success: boolean;
  error?: string;
  recipientsCount?: number;
}

const formatCurrency = (val: number = 0) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
};

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return '-';
  const str = String(dateStr).trim();
  if (str.includes('/') && str.length >= 10) return str;
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const parts = str.split('T')[0].split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return str;
};

/**
 * Gera o documento PDF individualizado do médico com timbrado da Santa Casa
 * e retorna em formato Base64 para anexo do e-mail.
 */
export async function gerarPdfIndividualMedicoBase64(
  sinteticoItem: PlantaoMedicoSintetico,
  periodoReferencia: string
): Promise<string> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const logoUrl = 'https://drbzogwimvaziaydwqfk.supabase.co/storage/v1/object/public/assets/logo_hsc.png';

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = 'Anonymous';
      image.onload = () => resolve(image);
      image.onerror = (e) => reject(e);
      image.src = logoUrl;
    });
    doc.addImage(img, 'PNG', 14, 10, 42, 12);
  } catch (e) {
    console.warn('Logo não carregada no PDF:', e);
  }

  // Título e Cabeçalho do Demonstrativo
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(138, 21, 21);
  doc.text('DEMONSTRATIVO DE PLANTÕES E HONORÁRIOS MÉDICOS', 14, 28);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(`Período de Referência: ${periodoReferencia}`, 14, 34);
  doc.text(`Emissão: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, 14, 39);

  // Card com Dados do Médico
  doc.setDrawColor(220, 220, 220);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, 43, 182, 22, 2, 2, 'FD');

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(sinteticoItem.MEDICO, 18, 51);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(`Especialidade Principal: ${sinteticoItem.ESPECIALIDADE || 'Geral'}`, 18, 58);
  doc.text(`Tipo de Escala: ${sinteticoItem.TIPO_PLANTAO || 'Plantão'}`, 110, 58);

  // Tabela de Resumo de Valores
  const valorPlantoes = sinteticoItem.ITEMS.reduce((acc, i) => acc + (i.VALOR || 0), 0);
  const valorProducao = sinteticoItem.valorProducaoTotal || 0;
  const valorTotal = sinteticoItem.VALOR_TOTAL;

  autoTable(doc, {
    startY: 69,
    margin: { left: 14, right: 14 },
    head: [['Qtd. Plantões', 'Valor dos Plantões (R$)', 'Produção / Adicionais (R$)', 'Total Geral (R$)']],
    body: [[
      sinteticoItem.QTD_PLANTOES.toString(),
      formatCurrency(valorPlantoes),
      formatCurrency(valorProducao),
      formatCurrency(valorTotal)
    ]],
    theme: 'grid',
    headStyles: { fillColor: [138, 21, 21], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: 9 },
    styles: { fontSize: 9, cellPadding: 3, halign: 'center' },
    columnStyles: {
      3: { fontStyle: 'bold', textColor: [138, 21, 21] }
    }
  });

  let currentY = (doc as any).lastAutoTable.finalY + 8;

  // Se houver produções detalhadas
  if (sinteticoItem.producoes && sinteticoItem.producoes.length > 0) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('Detalhamento de Produção e Atividades Adicionais', 14, currentY);

    const bodyProd = sinteticoItem.producoes.map(p => [
      p.tipoProducao,
      formatCurrency(p.valorProducao)
    ]);

    autoTable(doc, {
      startY: currentY + 3,
      margin: { left: 14, right: 14 },
      head: [['Tipo de Atividade / Procedimento', 'Valor Atribuído (R$)']],
      body: bodyProd,
      theme: 'striped',
      headStyles: { fillColor: [71, 85, 105], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
      styles: { fontSize: 8.5, cellPadding: 2.2 },
      columnStyles: {
        0: { halign: 'left' },
        1: { halign: 'right', fontStyle: 'bold' }
      }
    });

    currentY = (doc as any).lastAutoTable.finalY + 8;
  }

  // Tabela com os Itens / Escalas de Plantões
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('Discriminação das Escalas e Chamados', 14, currentY);

  const bodyPlantoes = sinteticoItem.ITEMS.map(item => [
    formatDate(item.DT_CHAMADO),
    item.ESPECIALIDADE || '-',
    item.TIPO_PLANTAO || '-',
    formatCurrency(item.VALOR)
  ]);

  autoTable(doc, {
    startY: currentY + 3,
    margin: { left: 14, right: 14 },
    head: [['Data / Hora do Chamado', 'Especialidade', 'Tipo Plantão', 'Valor (R$)']],
    body: bodyPlantoes,
    theme: 'striped',
    headStyles: { fillColor: [138, 21, 21], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
    styles: { fontSize: 8.5, cellPadding: 2.2 },
    columnStyles: {
      0: { halign: 'center' },
      1: { halign: 'left' },
      2: { halign: 'left' },
      3: { halign: 'right', fontStyle: 'bold' }
    }
  });

  // Rodapé da página
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150);
    doc.text(
      'Hospital Santa Casa de Misericórdia de Araguari • Setor Financeiro • financeiro@santacasaaraguari.org.br',
      14,
      doc.internal.pageSize.height - 8
    );
    doc.text(
      `Página ${i} de ${pageCount}`,
      doc.internal.pageSize.width - 28,
      doc.internal.pageSize.height - 8
    );
  }

  // Retorna Data URI / Base64 do PDF
  return doc.output('datauristring');
}

/**
 * Dispara o e-mail do médico através da Edge Function `send-plantao-email`
 */
export async function sendPlantaoMedicoEmail(
  params: SendPlantaoMedicoEmailParams
): Promise<SendEmailResponse> {
  try {
    // 1. Gera o PDF do médico em base64
    const pdfBase64 = await gerarPdfIndividualMedicoBase64(
      params.sinteticoItem,
      params.periodoReferencia
    );

    // 2. Prepara o payload para a Edge Function
    const payload = {
      to: params.to,
      nomeMedico: params.nomeMedico,
      periodoReferencia: params.periodoReferencia,
      resumo: params.resumo,
      pdfBase64: pdfBase64,
      pdfFilename: `Demonstrativo_Plantao_${params.nomeMedico.replace(/\s+/g, '_')}_${params.periodoReferencia.replace(/\//g, '-')}.pdf`
    };

    // 3. Invoca a Edge Function
    const { data, error } = await supabase.functions.invoke('send-plantao-email', {
      body: payload
    });

    if (error) {
      console.error('[Send Plantao Email] Erro ao invocar função:', error);
      let errMsg = error.message || 'Falha na comunicação com o servidor de e-mails.';
      try {
        if ((error as any).context) {
          const bodyJson = await (error as any).context.json();
          if (bodyJson?.error) errMsg = bodyJson.error;
        }
      } catch (_) {}
      return { success: false, error: errMsg };
    }

    if (data?.error) {
      console.error('[Send Plantao Email] Erro retornado:', data.error);
      return { success: false, error: data.error };
    }

    return { success: true, recipientsCount: data?.recipientsCount || params.to.length };
  } catch (err: any) {
    console.error('[Send Plantao Email] Exception:', err);
    return { success: false, error: err.message || 'Erro inesperado ao gerar e enviar e-mail.' };
  }
}
