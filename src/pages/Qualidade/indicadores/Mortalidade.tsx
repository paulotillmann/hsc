import React, { useState, useEffect, useMemo } from 'react';
import { Activity, TrendingDown, TrendingUp, AlertCircle, Search, Download, FileText } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, LabelList } from 'recharts';
import { webhookService } from '../../../services/webhookService';
import { jsPDF } from 'jspdf';
import { toPng } from 'html-to-image';

const normalizarPercentual = (val: any): string => {
  if (val === null || val === undefined) return '0,00 %';
  let str = String(val).trim();
  if (str.startsWith('.') || str.startsWith(',')) {
    str = '0' + str;
  } else if (str.startsWith('-.') || str.startsWith('-,')) {
    str = '-0' + str.substring(1);
  }
  
  if (!str.includes('%') && !isNaN(parseFloat(str.replace(',', '.')))) {
    return `${parseFloat(str.replace(',', '.')).toFixed(2).replace('.', ',')} %`;
  }
  return str.replace('.', ',');
};

const formatarDataBR = (dateStr: string): string => {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      // Tenta formatar string caso venha YYYY-MM-DD
      const parts = dateStr.split('T')[0].split('-');
      if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
      return dateStr;
    }
    return date.toLocaleDateString('pt-BR');
  } catch (e) {
    return dateStr;
  }
};

interface MortalidadeProps {
  dataInicio: string;
  dataFim: string;
  onKpiChange: (kpi: any) => void;
}

// Mocks alinhados exatamente com o relatório institucional real enviado na imagem
const MOCK_RESUMO = [
  { tipo_clinica: 'Clínica/Cirúrgica', faixa_etaria: 'ADULTO', qt_saidas: 137, qt_obitos: 1, perc_mortalidade: '0,73 %', sort_order: 1 },
  { tipo_clinica: 'Clínica/Cirúrgica', faixa_etaria: 'IDOSO', qt_saidas: 55, qt_obitos: 2, perc_mortalidade: '3,64 %', sort_order: 1 },
  { tipo_clinica: 'Clínica/Cirúrgica', faixa_etaria: 'NEONATAL_PRECOCE', qt_saidas: 39, qt_obitos: 0, perc_mortalidade: '0,00 %', sort_order: 1 },
  { tipo_clinica: 'Clínica/Cirúrgica', faixa_etaria: 'NEONATAL_TARDIO', qt_saidas: 2, qt_obitos: 0, perc_mortalidade: '0,00 %', sort_order: 1 },
  { tipo_clinica: 'Clínica/Cirúrgica', faixa_etaria: 'PEDIATRICO', qt_saidas: 17, qt_obitos: 0, perc_mortalidade: '0,00 %', sort_order: 1 },
  { tipo_clinica: '', faixa_etaria: '', qt_saidas: null, qt_obitos: null, perc_mortalidade: '', sort_order: 2 },
  { tipo_clinica: 'TOTAL', faixa_etaria: '', qt_saidas: 250, qt_obitos: 3, perc_mortalidade: '1,20 %', sort_order: 3 }
];

const MOCK_DETALHES = [
  {
    nr_atendimento: '111232',
    nm_paciente: 'Marcio Henrique de Melo',
    dt_entrada: '2026-07-02T10:00:00Z',
    dt_obito: '2026-07-11T14:30:00Z',
    ds_setor_atendimento: 'Posto 1',
    procedencia: 'Residência',
    cid: 'DISFAGIA',
    faixa_etaria: 'ADULTO'
  },
  {
    nr_atendimento: '111603',
    nm_paciente: 'Maria de Lourdes Machado de Paula',
    dt_entrada: '2026-07-05T08:15:00Z',
    dt_obito: '2026-07-14T19:45:00Z',
    ds_setor_atendimento: 'Posto 1',
    procedencia: 'Residência',
    cid: 'INFECÇÃO DO TRATO URINÁRIO DE LOCALIZAÇÃO NÃO ESPECIFICADA',
    faixa_etaria: 'IDOSO'
  },
  {
    nr_atendimento: '111434',
    nm_paciente: 'José Martins dos Santos',
    dt_entrada: '2026-07-03T22:30:00Z',
    dt_obito: '2026-07-06T03:10:00Z',
    ds_setor_atendimento: 'UTI Unidade 2',
    procedencia: 'Residência',
    cid: 'PNEUMONIA POR MICROORGANISMO NÃO ESPECIFICADO',
    faixa_etaria: 'IDOSO'
  }
];

export default function Mortalidade({ dataInicio, dataFim, onKpiChange }: MortalidadeProps) {
  const [loading, setLoading] = useState(false);
  const [usingMock, setUsingMock] = useState(false);
  const [dadosResumo, setDadosResumo] = useState<any[]>([]);
  const [dadosDetalhes, setDadosDetalhes] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [exportandoPDF, setExportandoPDF] = useState(false);

  const carregarDados = async () => {
    setLoading(true);
    setUsingMock(false);
    try {
      // 1. Busca Resumo Consolidado
      const resResumo = await webhookService.fetchIndicadoresQualidade({
        indicador: 'taxa_mortalidade',
        data_inicio: dataInicio,
        data_fim: dataFim
      });

      // 2. Busca Detalhes dos Óbitos
      const resDetalhes = await webhookService.fetchIndicadoresQualidade({
        indicador: 'taxa_mortalidade_detalhes',
        data_inicio: dataInicio,
        data_fim: dataFim
      });

      if (resResumo && resResumo.length > 0) {
        setDadosResumo(resResumo);
        setDadosDetalhes(resDetalhes || []);
      } else {
        setDadosResumo(MOCK_RESUMO);
        setDadosDetalhes(MOCK_DETALHES);
        setUsingMock(true);
      }
    } catch (error) {
      console.error('Erro ao buscar dados de mortalidade:', error);
      setDadosResumo(MOCK_RESUMO);
      setDadosDetalhes(MOCK_DETALHES);
      setUsingMock(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, [dataInicio, dataFim]);

  const parsedDadosGrafico = useMemo(() => {
    const dadosFiltrados = dadosResumo.filter(item => {
      const clinicaVal = String(item.tipo_clinica || item.TIPO_CLINICA || '').trim();
      const sortOrder = item.sort_order ?? item.SORT_ORDER;
      if (sortOrder !== undefined) {
        return Number(sortOrder) === 1;
      }
      return clinicaVal && clinicaVal.toUpperCase() !== 'TOTAL';
    });

    return dadosFiltrados.map(item => {
      const val = item.perc_mortalidade || item.PERC_MORTALIDADE || item.taxa || 0;
      let numVal = 0;
      if (typeof val === 'number') {
        numVal = val;
      } else if (typeof val === 'string') {
        const cleanVal = val.replace('%', '').replace(',', '.').trim();
        numVal = parseFloat(cleanVal) || 0;
      }

      const faixa = item.faixa_etaria || item.FAIXA_ETARIA || '';
      let faixaFormatada = faixa;
      if (faixa === 'NEONATAL_PRECOCE') faixaFormatada = 'Neonatal Precoce';
      if (faixa === 'NEONATAL_TARDIO') faixaFormatada = 'Neonatal Tardio';
      if (faixa === 'PEDIATRICO') faixaFormatada = 'Pediátrico';
      if (faixa === 'ADULTO') faixaFormatada = 'Adulto';
      if (faixa === 'IDOSO') faixaFormatada = 'Idoso';

      const clinica = item.tipo_clinica || item.TIPO_CLINICA || '';
      const clinicaAbrev = clinica.toUpperCase().includes('CIRÚRGICA') || clinica.toUpperCase().includes('CIRURGICA') ? 'Cirúrgica' : 'Médica';
      const rotuloEixo = `${faixaFormatada} (${clinicaAbrev})`;

      return {
        ...item,
        valorGrafico: numVal,
        faixaFormatada,
        rotuloEixo
      };
    });
  }, [dadosResumo]);

  const kpi = useMemo(() => {
    if (dadosResumo.length === 0) return { taxaMedia: 0, totalObitos: 0, tendencia: 'baixa' };
    
    const linhaTotal = dadosResumo.find(item => {
      const clinicaVal = String(item.tipo_clinica || item.TIPO_CLINICA || '').trim().toUpperCase();
      return clinicaVal === 'TOTAL';
    });

    if (linhaTotal) {
      const taxaKey = 'PERC_MORTALIDADE' in linhaTotal ? 'PERC_MORTALIDADE' : ('perc_mortalidade' in linhaTotal ? 'perc_mortalidade' : '');
      const obitosKey = 'QT_OBITOS' in linhaTotal ? 'QT_OBITOS' : ('qt_obitos' in linhaTotal ? 'qt_obitos' : 'obitos');
      
      let taxaMedia = 0;
      if (taxaKey) {
        const val = linhaTotal[taxaKey];
        if (typeof val === 'number') {
          taxaMedia = val;
        } else if (typeof val === 'string') {
          const cleanVal = val.replace('%', '').replace(',', '.').trim();
          taxaMedia = parseFloat(cleanVal) || 0;
        }
      }
      
      const totalObitos = obitosKey ? (Number(linhaTotal[obitosKey]) || 0) : 0;
      const tendencia = taxaMedia > 3.0 ? 'alta' : 'baixa';
      return { taxaMedia, totalObitos, tendencia };
    }

    // Fallback
    const totalObitos = dadosDetalhes.length;
    const tendencia = 'baixa';
    return { taxaMedia: 1.2, totalObitos, tendencia };
  }, [dadosResumo, dadosDetalhes]);

  useEffect(() => {
    onKpiChange({
      taxaMedia: `${kpi.taxaMedia.toFixed(2).replace('.', ',')}%`,
      labelTaxa: 'Mortalidade Geral',
      totalValue: `${kpi.totalObitos} óbitos`,
      totalLabel: 'Volume de Óbitos',
      meta: '< 3,0% de Taxa Geral',
      metaDesc: 'Percentual acumulado de óbitos em relação ao total de saídas (altas + óbitos) de pacientes com internação superior a 24 horas no período.',

      usingMock,
      tendencia: kpi.tendencia,
      loading
    });
  }, [kpi, usingMock, loading]);

  const filteredDetalhes = useMemo(() => {
    if (!searchTerm.trim()) return dadosDetalhes;
    const term = searchTerm.toLowerCase();
    return dadosDetalhes.filter(item => 
      Object.values(item).some(val => String(val).toLowerCase().includes(term))
    );
  }, [dadosDetalhes, searchTerm]);

  // Processamento estruturado para a Tabela Consolidada de Faixas Etárias com quebra por Clínica
  const linhasConsolidadas = useMemo(() => {
    const result: any[] = [];
    const registrosReais = dadosResumo.filter(item => {
      const sortOrder = item.sort_order ?? item.SORT_ORDER;
      const clinicaVal = String(item.tipo_clinica || item.TIPO_CLINICA || '').trim().toUpperCase();
      if (sortOrder !== undefined) {
        return Number(sortOrder) === 1;
      }
      return clinicaVal !== 'TOTAL' && clinicaVal !== '';
    });

    const linhaTotal = dadosResumo.find(item => {
      const clinicaVal = String(item.tipo_clinica || item.TIPO_CLINICA || '').trim().toUpperCase();
      return clinicaVal === 'TOTAL';
    });

    const clinicasInstanciadas = new Set<string>();

    registrosReais.forEach(item => {
      const clinica = item.tipo_clinica || item.TIPO_CLINICA || 'Outros';
      const faixa = item.faixa_etaria || item.FAIXA_ETARIA || 'Não informado';
      const qtObitos = item.qt_obitos ?? item.QT_OBITOS ?? 0;
      const qtSaidas = item.qt_saidas ?? item.QT_SAIDAS ?? 0;
      const taxaRaw = item.perc_mortalidade ?? item.PERC_MORTALIDADE ?? item.taxa ?? '0%';
      const taxa = normalizarPercentual(taxaRaw);

      let faixaFormatada = faixa;
      if (faixa === 'NEONATAL_PRECOCE') faixaFormatada = 'NEONATAL_PRECOCE';
      if (faixa === 'NEONATAL_TARDIO') faixaFormatada = 'NEONATAL_TARDIO';
      if (faixa === 'PEDIATRICO') faixaFormatada = 'PEDIATRICO';
      if (faixa === 'ADULTO') faixaFormatada = 'ADULTO';
      if (faixa === 'IDOSO') faixaFormatada = 'IDOSO';

      // 1. Linha de quebra de clínica
      if (!clinicasInstanciadas.has(clinica)) {
        clinicasInstanciadas.add(clinica);
        result.push({
          isClinicaHeader: true,
          label: clinica
        });
      }

      // 2. Linha de dados
      result.push({
        isDataRow: true,
        faixaEtaria: faixaFormatada,
        qtSaidas,
        qtObitos,
        taxa
      });
    });

    if (linhaTotal) {
      const qtObitos = linhaTotal.qt_obitos ?? linhaTotal.QT_OBITOS ?? 0;
      const qtSaidas = linhaTotal.qt_saidas ?? linhaTotal.QT_SAIDAS ?? 0;
      const taxaRaw = linhaTotal.perc_mortalidade ?? linhaTotal.PERC_MORTALIDADE ?? '0%';
      const taxa = normalizarPercentual(taxaRaw);
      
      result.push({
        isTotalRow: true,
        qtSaidas,
        qtObitos,
        taxa
      });
    }

    return result;
  }, [dadosResumo]);

  const exportarCSV = () => {
    if (dadosDetalhes.length === 0) return;
    const headers = ['Atendimento', 'Paciente', 'Data Entrada', 'Data Obito', 'Setor Obito', 'Procedencia', 'CID', 'Faixa Etaria'];
    const csvRows = [headers.join(';')];
    
    for (const row of dadosDetalhes) {
      const nrAtendimento = row.nr_atendimento || row.NR_ATENDIMENTO || '';
      const nmPaciente = row.nm_paciente || row.NM_PACIENTE || '';
      const dtEntrada = row.dt_entrada || row.DT_ENTRADA || '';
      const dtObito = row.dt_obito || row.DT_OBITO || '';
      const dsSetor = row.ds_setor_atendimento || row.DS_SETOR_ATENDIMENTO || '';
      const procedencia = row.procedencia || row.PROCEDENCIA || '';
      const cid = row.cid || row.CID || '';
      const faixa = row.faixa_etaria || row.FAIXA_ETARIA || '';

      csvRows.push([
        nrAtendimento,
        `"${nmPaciente}"`,
        formatarDataBR(dtEntrada),
        formatarDataBR(dtObito),
        `"${dsSetor}"`,
        `"${procedencia}"`,
        `"${cid}"`,
        faixa
      ].join(';'));
    }
    
    const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `registro_obitos_detalhado_${dataInicio}_a_${dataFim}.csv`;
    link.click();
  };

  const exportarPDF = async () => {
    const kpisEl = document.getElementById('kpis-card-container');
    const chartEl = document.getElementById('mortalidade-chart-container');
    const chartWrapper = document.getElementById('mortalidade-chart-wrapper');

    if (!kpisEl || !chartEl) {
      alert('Elementos de relatório não encontrados na página.');
      return;
    }

    const card1 = kpisEl.children[0] as HTMLElement;
    const card2 = kpisEl.children[1] as HTMLElement;
    const card3 = kpisEl.children[2] as HTMLElement;

    const card1OriginalStyle = card1 ? card1.getAttribute('style') || '' : '';
    const card2OriginalStyle = card2 ? card2.getAttribute('style') || '' : '';
    const card3OriginalDisplay = card3 ? card3.style.display : '';

    const kpisOriginalClass = kpisEl.className;
    const kpisOriginalStyle = kpisEl.getAttribute('style') || '';
    const chartWrapperOriginalStyle = chartWrapper ? chartWrapper.getAttribute('style') || '' : '';

    try {
      setExportandoPDF(true);

      if (card3) card3.style.display = 'none';

      kpisEl.className = "flex flex-row gap-4 w-[750px] p-2 bg-white";
      kpisEl.setAttribute('style', 'display: flex !important; flex-direction: row !important; width: 750px !important; gap: 16px !important; background-color: #ffffff !important;');
      
      if (card1) card1.setAttribute('style', 'flex: 1 !important; width: 50% !important;');
      if (card2) card2.setAttribute('style', 'flex: 1 !important; width: 50% !important;');

      if (chartWrapper) chartWrapper.setAttribute('style', 'height: 480px !important;');

      await new Promise(resolve => setTimeout(resolve, 200));

      const kpisImgData = await toPng(kpisEl, { 
        backgroundColor: '#ffffff',
        pixelRatio: 2
      });

      const chartImgData = await toPng(chartEl, {
        backgroundColor: '#ffffff',
        pixelRatio: 2
      });

      if (card3) card3.style.display = card3OriginalDisplay;
      if (card1) card1.setAttribute('style', card1OriginalStyle);
      if (card2) card2.setAttribute('style', card2OriginalStyle);
      if (chartWrapper) chartWrapper.setAttribute('style', chartWrapperOriginalStyle);
      kpisEl.className = kpisOriginalClass;
      kpisEl.setAttribute('style', kpisOriginalStyle);

      const kpisWidth = 180;
      const kpisX = 15;
      
      const getImgDimensions = (dataUrl: string): Promise<{ width: number; height: number }> => {
        return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            resolve({ width: img.width, height: img.height });
          };
          img.src = dataUrl;
        });
      };

      const kpiDimensions = await getImgDimensions(kpisImgData);
      const kpisHeight = (kpiDimensions.height * kpisWidth) / kpiDimensions.width;

      const chartDimensions = await getImgDimensions(chartImgData);
      const chartWidth = 180;
      const chartX = 15;
      const chartHeight = (chartDimensions.height * chartWidth) / chartDimensions.width;

      const doc = new jsPDF('p', 'mm', 'a4');
      
      doc.setFillColor(90, 16, 16);
      doc.rect(0, 0, 210, 8, 'F');

      doc.setTextColor(90, 16, 16);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('HOSPITAL SANTA CASA DE MISERICORDIA DE ARAGUARI', 15, 22);

      doc.setTextColor(100, 116, 139);
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9);
      doc.text('GESTÃO DA QUALIDADE E SEGURANÇA DO PACIENTE', 15, 27);

      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(15, 30, 195, 30);

      doc.setTextColor(15, 23, 42);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(13);
      doc.text('Indicador: Taxa de Mortalidade Institucional (>24h)', 15, 39);

      doc.setTextColor(100, 116, 139);
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9.5);
      
      const formatarData = (dataStr: string) => {
        if (!dataStr) return '-';
        const parts = dataStr.split('-');
        if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
        return dataStr;
      };
      
      doc.text(`Período de Análise: ${formatarData(dataInicio)} a ${formatarData(dataFim)}`, 15, 45);

      doc.addImage(kpisImgData, 'PNG', kpisX, 52, kpisWidth, kpisHeight);

      const chartY = 52 + kpisHeight + 10;
      doc.addImage(chartImgData, 'PNG', chartX, chartY, chartWidth, chartHeight);

      doc.setTextColor(148, 163, 184);
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.text('Hospital Santa Casa de Araguari - Relatório Gerencial de Qualidade', 15, 285);
      doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`, 195, 285, { align: 'right' });

      doc.save(`relatorio_taxa_mortalidade_${dataInicio}_a_${dataFim}.pdf`);
    } catch (error) {
      console.error('Erro ao gerar relatório em PDF:', error);
      alert('Ocorreu um erro ao gerar o relatório em PDF.');
    } finally {
      if (card3) card3.style.display = card3OriginalDisplay;
      if (card1) card1.setAttribute('style', card1OriginalStyle);
      if (card2) card2.setAttribute('style', card2OriginalStyle);
      if (chartWrapper) chartWrapper.setAttribute('style', chartWrapperOriginalStyle);
      kpisEl.className = kpisOriginalClass;
      kpisEl.setAttribute('style', kpisOriginalStyle);
      setExportandoPDF(false);
    }
  };

  return (
    <div className="space-y-6 text-left">
      
      {/* Gráfico */}
      <div id="mortalidade-chart-container" className="bg-card border p-6 rounded-xl shadow-sm flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="font-semibold text-sm text-foreground">Taxa de Mortalidade por Faixa Etária</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Indicador percentual segmentado de saídas e óbitos</p>
            <div className="flex gap-4 mt-2">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded bg-[#5A1010]" />
                <span>Clínica Cirúrgica</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded bg-[#8C2D2D]" />
                <span>Clínica Médica</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <button 
              onClick={exportarCSV}
              className="flex items-center gap-2 px-3 py-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg shadow-sm transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Exportar CSV
            </button>
            <button
              onClick={exportarPDF}
              disabled={exportandoPDF}
              className="flex items-center gap-2 px-3 py-1.5 text-xs bg-muted text-muted-foreground hover:bg-muted/80 rounded-lg shadow-sm transition-colors border disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileText className="h-3.5 w-3.5" />
              {exportandoPDF ? 'Exportando...' : 'Exportar PDF'}
            </button>
          </div>
        </div>
        <div id="mortalidade-chart-wrapper" className="h-[240px] w-full">
          {loading ? (
            <div className="h-full w-full flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : dadosResumo.length === 0 ? (
            <div className="h-full w-full flex flex-col items-center justify-center text-muted-foreground gap-2">
              <Activity className="h-8 w-8 opacity-45" />
              <span className="text-sm">Nenhum dado encontrado para o período.</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={parsedDadosGrafico} margin={{ top: 20, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted/40" />
                <XAxis 
                  dataKey="rotuloEixo" 
                  tick={{ fontSize: 9, fontWeight: 'bold' }}
                  tickLine={false}
                  axisLine={true}
                />
                <YAxis 
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                  labelStyle={{ fontWeight: 'bold', fontSize: 11 }}
                  itemStyle={{ fontSize: 11 }}
                  formatter={(val: any) => [`${Number(val).toFixed(2).replace('.', ',')}%`, 'Taxa de Mortalidade']}
                />
                <Bar 
                  dataKey="valorGrafico" 
                  name="Mortalidade (%)" 
                  radius={[4, 4, 0, 0]} 
                  barSize={38}
                  isAnimationActive={false}
                >
                  {parsedDadosGrafico.map((entry, index) => {
                    const clinica = String(entry.tipo_clinica || entry.TIPO_CLINICA || '').toUpperCase();
                    const fill = clinica.includes('CIRÚRGICA') || clinica.includes('CIRURGICA') ? '#5A1010' : '#8C2D2D';
                    return <Cell key={`cell-${index}`} fill={fill} />;
                  })}
                  <LabelList
                    dataKey="valorGrafico"
                    position="top"
                    formatter={(val: any) => {
                      const num = Number(val);
                      if (isNaN(num)) return '';
                      return `${num.toFixed(2).replace('.', ',')}%`;
                    }}
                    style={{ fill: '#1e293b', fontSize: 10, fontWeight: 'bold' }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Tabela 1: Registro Detalhado de Óbitos */}
      <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
        <div className="p-5 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="font-bold text-base text-foreground">Registro Detalhado de Óbitos</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Óbitos registrados com tempo de internação superior a 24 horas.</p>
          </div>
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="Buscar paciente ou CID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-xs bg-background border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
            />
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground pointer-events-none">
              <Search className="h-3.5 w-3.5" />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto w-full">
          {loading ? (
            <div className="p-12 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredDetalhes.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-2">
              <Activity className="h-8 w-8 opacity-45" />
              <span>Nenhum óbito registrado no período selecionado.</span>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-muted/40 border-b">
                  <th className="p-3 font-semibold text-muted-foreground uppercase tracking-wider">Atendimento</th>
                  <th className="p-3 font-semibold text-muted-foreground uppercase tracking-wider">Paciente</th>
                  <th className="p-3 font-semibold text-muted-foreground uppercase tracking-wider">Data Entrada</th>
                  <th className="p-3 font-semibold text-muted-foreground uppercase tracking-wider">Data Óbito</th>
                  <th className="p-3 font-semibold text-muted-foreground uppercase tracking-wider">Setor Óbito</th>
                  <th className="p-3 font-semibold text-muted-foreground uppercase tracking-wider">Procedência</th>
                  <th className="p-3 font-semibold text-muted-foreground uppercase tracking-wider">CID</th>
                  <th className="p-3 font-semibold text-muted-foreground uppercase tracking-wider">Faixa Etária</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredDetalhes.map((row, idx) => {
                  const nrAtendimento = row.nr_atendimento || row.NR_ATENDIMENTO;
                  const nmPaciente = row.nm_paciente || row.NM_PACIENTE;
                  const dtEntrada = row.dt_entrada || row.DT_ENTRADA;
                  const dtObito = row.dt_obito || row.DT_OBITO;
                  const dsSetorAtendimento = row.ds_setor_atendimento || row.DS_SETOR_ATENDIMENTO;
                  const procedencia = row.procedencia || row.PROCEDENCIA;
                  const cid = row.cid || row.CID;
                  const faixaEtaria = row.faixa_etaria || row.FAIXA_ETARIA;

                  return (
                    <tr key={`detalhe-${idx}`} className="hover:bg-muted/5 transition-colors">
                      <td className="p-3 font-semibold text-foreground">{nrAtendimento}</td>
                      <td className="p-3 font-medium text-foreground">{nmPaciente}</td>
                      <td className="p-3 text-muted-foreground">{formatarDataBR(dtEntrada)}</td>
                      <td className="p-3 text-rose-600 font-medium">{formatarDataBR(dtObito)}</td>
                      <td className="p-3 text-foreground">{dsSetorAtendimento}</td>
                      <td className="p-3 text-muted-foreground">{procedencia}</td>
                      <td className="p-3 text-muted-foreground max-w-[200px] truncate" title={cid}>{cid}</td>
                      <td className="p-3 text-foreground font-semibold"><span className="px-2 py-0.5 bg-muted rounded text-[10px]">{faixaEtaria}</span></td>
                    </tr>
                  );
                })}
                <tr className="bg-muted/30 font-bold border-t-2">
                  <td className="p-3" colSpan={8}>
                    Total({filteredDetalhes.length})
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Tabela 2: Consolidado por Faixa Etária */}
      <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
        <div className="p-5 border-b">
          <h3 className="font-bold text-base text-foreground">Consolidado por Faixa Etária</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Indicador acumulado e percentual de taxa de mortalidade institucional.</p>
        </div>

        <div className="overflow-x-auto w-full">
          {loading ? (
            <div className="p-8 flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-muted/40 border-b">
                  <th className="p-4 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Faixa Etária</th>
                  <th className="p-4 font-semibold text-muted-foreground text-xs uppercase tracking-wider text-center">Total Atendimentos (Saídas)</th>
                  <th className="p-4 font-semibold text-muted-foreground text-xs uppercase tracking-wider text-center">Total de Óbitos</th>
                  <th className="p-4 font-semibold text-muted-foreground text-xs uppercase tracking-wider text-center">Taxa de Mortalidade</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {linhasConsolidadas.map((row, idx) => {
                  if (row.isClinicaHeader) {
                    return (
                      <tr key={`clinica-resumo-${idx}`} className="bg-muted/10 font-bold border-t border-border/60">
                        <td className="p-4 font-bold text-foreground text-sm pl-6" colSpan={4}>
                          CLÍNICA {row.label.toUpperCase()}
                        </td>
                      </tr>
                    );
                  }

                  if (row.isTotalRow) {
                    return (
                      <tr key={`total-resumo-${idx}`} className="bg-muted/60 font-bold border-t-2 border-border text-foreground">
                        <td className="p-4 font-bold text-sm pl-6">Total Geral</td>
                        <td className="p-4 text-center font-bold">{row.qtSaidas}</td>
                        <td className="p-4 text-center font-bold text-rose-600">{row.qtObitos}</td>
                        <td className="p-4 text-center font-bold text-primary">{row.taxa}</td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={`resumo-${idx}`} className="hover:bg-muted/5 transition-colors font-medium">
                      <td className="p-4 text-foreground font-semibold pl-12">{row.faixaEtaria}</td>
                      <td className="p-4 text-center text-foreground">{row.qtSaidas}</td>
                      <td className="p-4 text-center text-rose-600 font-bold">{row.qtObitos}</td>
                      <td className="p-4 text-center font-bold text-foreground">{row.taxa}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

    </div>
  );
}
