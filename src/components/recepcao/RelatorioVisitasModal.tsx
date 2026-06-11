import React, { useState } from 'react';
import { X, Calendar, FileText, Download, Loader2, Info } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface RelatorioVisitasModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SectorSummary {
  sector: string;
  visitantes: number;
  acompanhantes: number;
  terceiros: number;
  total: number;
}

const RelatorioVisitasModal: React.FC<RelatorioVisitasModalProps> = ({ isOpen, onClose }) => {
  // Inicializa o período com o mês corrente
  const [dataInicio, setDataInicio] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [dataFim, setDataFim] = useState<string>(() => {
    const d = new Date();
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  });

  const [loading, setLoading] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [reportPreview, setReportPreview] = useState<SectorSummary[] | null>(null);
  const [previewTotals, setPreviewTotals] = useState<{ visitantes: number; acompanhantes: number; terceiros: number; total: number } | null>(null);

  if (!isOpen) return null;

  const processarAgrupamento = (visits: any[]) => {
    const grouping: Record<string, { visitantes: number; acompanhantes: number; terceiros: number; total: number }> = {};

    visits.forEach((v) => {
      const tipo = (v.identificado_como || 'VISITANTE').toUpperCase();
      
      // Regra de definição do Setor/Clínica
      let sector = 'NÃO INFORMADO';
      if (tipo === 'TERCEIRO' || tipo === 'PRESTADOR DE SERVIÇO' || tipo === 'EXAME EXTERNO' || tipo === 'ENTREGADOR') {
        sector = (v.setor_acesso_terceiro || '').trim();
      } else {
        sector = (v.clinica || '').trim();
      }

      if (!sector) {
        sector = 'NÃO INFORMADO';
      } else {
        sector = sector.toUpperCase();
      }

      if (!grouping[sector]) {
        grouping[sector] = { visitantes: 0, acompanhantes: 0, terceiros: 0, total: 0 };
      }

      if (tipo === 'VISITANTE') {
        grouping[sector].visitantes++;
      } else if (tipo === 'ACOMPANHANTE') {
        grouping[sector].acompanhantes++;
      } else {
        grouping[sector].terceiros++;
      }
      grouping[sector].total++;
    });

    const summaries = Object.entries(grouping)
      .map(([name, counts]) => ({
        sector: name,
        ...counts
      }))
      .sort((a, b) => b.total - a.total || a.sector.localeCompare(b.sector));

    return summaries;
  };

  const executarRelatorio = async () => {
    if (!dataInicio || !dataFim) return;

    setLoading(true);
    setProgressText('Preparando filtros...');
    setReportPreview(null);
    setPreviewTotals(null);

    try {
      // Ajuste de fuso horário local
      const [y1, m1, d1] = dataInicio.split('-').map(Number);
      const startIso = new Date(y1, m1 - 1, d1, 0, 0, 0, 0).toISOString();

      const [y2, m2, d2] = dataFim.split('-').map(Number);
      const endIso = new Date(y2, m2 - 1, d2, 23, 59, 59, 999).toISOString();

      let allVisits: any[] = [];
      let hasMore = true;
      let page = 0;
      const pageSize = 2500;

      setProgressText('Buscando dados no banco de dados...');

      while (hasMore) {
        const { data, error } = await supabase
          .from('visitas')
          .select('identificado_como, clinica, setor_acesso_terceiro')
          .gte('data_hora_entrada', startIso)
          .lte('data_hora_entrada', endIso)
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) throw error;

        if (data) {
          allVisits = [...allVisits, ...data];
          setProgressText(`Buscando dados... (${allVisits.length} registros localizados)`);
          if (data.length < pageSize) {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }

        page++;
      }

      if (allVisits.length === 0) {
        setProgressText('Nenhum registro encontrado no período selecionado.');
        setLoading(false);
        return;
      }

      setProgressText('Processando agrupamento de dados...');
      const summaries = processarAgrupamento(allVisits);

      // Calcular os totais gerais da pré-visualização
      let totVisitantes = 0;
      let totAcompanhantes = 0;
      let totTerceiros = 0;
      let totGeral = 0;

      summaries.forEach((s) => {
        totVisitantes += s.visitantes;
        totAcompanhantes += s.acompanhantes;
        totTerceiros += s.terceiros;
        totGeral += s.total;
      });

      setPreviewTotals({
        visitantes: totVisitantes,
        acompanhantes: totAcompanhantes,
        terceiros: totTerceiros,
        total: totGeral
      });

      setReportPreview(summaries);
      setProgressText(`Sucesso! ${allVisits.length} registros processados.`);
    } catch (err: any) {
      console.error('Erro ao gerar relatório:', err);
      setProgressText(`Erro: ${err.message || 'Erro desconhecido'}`);
    } finally {
      setLoading(false);
    }
  };

  const gerarPDF = async () => {
    if (!reportPreview || !previewTotals) return;

    try {
      const doc = new jsPDF();

      // Carregar a logo do hospital
      try {
        const imgObj = new Image();
        imgObj.src = '/LOGO_HSC_PRIMARY.png';
        await new Promise((resolve) => {
          imgObj.onload = resolve;
          imgObj.onerror = resolve; // Ignora o erro e segue em frente
        });
        doc.addImage(imgObj, 'PNG', 14, 10, 45, 12);
      } catch (e) {
        console.error('Erro ao adicionar logo no PDF:', e);
      }

      // Título
      doc.setFontSize(15);
      doc.setTextColor(30);
      doc.text('Relatório de Movimentação por Setor/Clínica', 14, 30);

      // Metadados do relatório
      doc.setFontSize(9);
      doc.setTextColor(100);
      
      const formatarDataBR = (dateStr: string) => dateStr.split('-').reverse().join('/');
      
      doc.text(`Período de Referência: ${formatarDataBR(dataInicio)} a ${formatarDataBR(dataFim)}`, 14, 37);
      doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, 14, 42);

      // Linha separadora
      doc.setDrawColor(220);
      doc.line(14, 46, 196, 46);

      // Tabela de Dados
      const headers = [['Setor / Clínica', 'Visitantes', 'Acompanhantes', 'Terceiros', 'Total Geral']];
      
      const body = reportPreview.map((item) => [
        item.sector,
        item.visitantes.toLocaleString('pt-BR'),
        item.acompanhantes.toLocaleString('pt-BR'),
        item.terceiros.toLocaleString('pt-BR'),
        item.total.toLocaleString('pt-BR')
      ]);

      // Adicionar linha de totalizador
      body.push([
        'TOTAL GERAL',
        previewTotals.visitantes.toLocaleString('pt-BR'),
        previewTotals.acompanhantes.toLocaleString('pt-BR'),
        previewTotals.terceiros.toLocaleString('pt-BR'),
        previewTotals.total.toLocaleString('pt-BR')
      ]);

      autoTable(doc, {
        startY: 50,
        head: headers,
        body: body,
        theme: 'striped',
        headStyles: {
          fillColor: [138, 21, 21], // Cor bordô institucional
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'center'
        },
        columnStyles: {
          0: { halign: 'left', fontStyle: 'bold' },
          1: { halign: 'center' },
          2: { halign: 'center' },
          3: { halign: 'center' },
          4: { halign: 'center', fontStyle: 'bold' }
        },
        didParseCell: (data) => {
          // Destacar a linha de totais na base da tabela
          if (data.row.index === body.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [240, 240, 240];
          }
        },
        styles: {
          fontSize: 8.5,
          cellPadding: 3
        }
      });

      // Rodapé
      const finalY = (doc as any).lastAutoTable.finalY || 100;
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text('Hospital Santa Casa de Araguari - Controle de Recepção e Acessos', 14, finalY + 15);

      // Salva o PDF
      doc.save(`relatorio_visitas_setor_${dataInicio}_a_${dataFim}.pdf`);
    } catch (error) {
      console.error('Erro ao gerar arquivo PDF:', error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-background rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh] overflow-hidden border border-border animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-500/10 text-[#8a1515] dark:text-[#f43f5e] rounded-xl border border-red-500/10">
              <FileText size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Relatório de Movimentação por Setor</h2>
              <p className="text-sm text-muted-foreground">Consolidação de acessos de visitantes, acompanhantes e terceiros</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:bg-muted hover:text-foreground rounded-xl transition-colors cursor-pointer"
          >
            <X size={24} />
          </button>
        </div>

        {/* Filters and Action Bar */}
        <div className="p-6 border-b border-border bg-card flex flex-col sm:flex-row items-end gap-4">
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Calendar size={14} /> Data Inicial
              </label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-foreground focus:ring-2 focus:ring-red-500/20 focus:border-red-600 outline-none transition-all text-sm font-semibold"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Calendar size={14} /> Data Final
              </label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-foreground focus:ring-2 focus:ring-red-500/20 focus:border-red-600 outline-none transition-all text-sm font-semibold"
              />
            </div>
          </div>
          <div className="w-full sm:w-auto shrink-0">
            <button
              onClick={executarRelatorio}
              disabled={loading || !dataInicio || !dataFim}
              className="w-full sm:w-auto px-6 py-2.5 bg-[#8a1515] hover:bg-[#8a1515]/90 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer text-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Buscando...
                </>
              ) : (
                'Executar Relatório'
              )}
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto bg-muted/5 p-6 flex flex-col justify-between">
          {!reportPreview ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 min-h-[150px]">
              {loading ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="h-10 w-10 rounded-full border-2 border-red-700 border-t-transparent animate-spin" />
                  <p className="text-sm font-semibold text-muted-foreground mt-2 animate-pulse">{progressText}</p>
                </div>
              ) : (
                <>
                  <div className="w-16 h-16 bg-red-500/5 rounded-full flex items-center justify-center border border-red-500/10 mb-4 text-[#8a1515] dark:text-[#f43f5e]">
                    <FileText size={32} />
                  </div>
                  <h3 className="text-lg font-bold text-foreground">Aguardando Filtro</h3>
                  <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                    {progressText || 'Selecione o período de início e fim acima e clique em "Executar Relatório" para calcular.'}
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-6 h-full justify-between">
              {/* Preview Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-card p-4 rounded-xl border border-border">
                  <span className="text-xs text-muted-foreground font-semibold block uppercase">Total Visitantes</span>
                  <span className="text-2xl font-extrabold text-foreground">{previewTotals?.visitantes.toLocaleString('pt-BR')}</span>
                </div>
                <div className="bg-card p-4 rounded-xl border border-border">
                  <span className="text-xs text-muted-foreground font-semibold block uppercase">Total Acompanhantes</span>
                  <span className="text-2xl font-extrabold text-foreground">{previewTotals?.acompanhantes.toLocaleString('pt-BR')}</span>
                </div>
                <div className="bg-card p-4 rounded-xl border border-border">
                  <span className="text-xs text-muted-foreground font-semibold block uppercase">Total Terceiros</span>
                  <span className="text-2xl font-extrabold text-foreground">{previewTotals?.terceiros.toLocaleString('pt-BR')}</span>
                </div>
                <div className="bg-card p-4 rounded-xl border border-border bg-red-500/5 border-red-500/10">
                  <span className="text-xs text-[#8a1515] dark:text-[#f43f5e] font-semibold block uppercase">Total Geral</span>
                  <span className="text-2xl font-extrabold text-[#8a1515] dark:text-[#f43f5e]">{previewTotals?.total.toLocaleString('pt-BR')}</span>
                </div>
              </div>

              {/* Action and Summary Info */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-border pt-4 bg-transparent mt-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Info className="h-4 w-4 shrink-0 text-blue-500" />
                  <span>Agrupado com sucesso por Setor e Clínicas. Pronto para exportação.</span>
                </div>
                <button
                  onClick={gerarPDF}
                  className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-600/90 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer text-sm"
                >
                  <Download size={16} /> Baixar PDF
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default RelatorioVisitasModal;
