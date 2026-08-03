import React, { useState, useEffect, useMemo } from 'react';
import { RefreshCw, TrendingDown, TrendingUp, AlertCircle, Search, Download, FileText } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LabelList } from 'recharts';
import { webhookService } from '../../../services/webhookService';
import { jsPDF } from 'jspdf';
import { toPng } from 'html-to-image';

const normalizarPercentual = (val: any): string => {
  if (val === null || val === undefined) return '0.00 %';
  let str = String(val).trim();
  if (str.startsWith('.') || str.startsWith(',')) {
    str = '0' + str;
  } else if (str.startsWith('-.') || str.startsWith('-,')) {
    str = '-0' + str.substring(1);
  }
  return str;
};

interface ReinternacoesProps {
  dataInicio: string;
  dataFim: string;
  onKpiChange: (kpi: any) => void;
}

const MOCK_DATA = [
  { data: '2026-07-02', setor: 'Cardiologia', paciente: 'W.P.A', dias_apos_alta: 12, motivo: 'Descompensação de I.C.C', taxa: 8.5 },
  { data: '2026-07-05', setor: 'Ortopedia', paciente: 'F.B.G', dias_apos_alta: 21, motivo: 'Dor e Suspeita de Infecção de Sítio', taxa: 9.1 },
  { data: '2026-07-07', setor: 'Clínica Médica', paciente: 'M.Z.T', dias_apos_alta: 8, motivo: 'Nova crise respiratória (D.P.O.C)', taxa: 9.8 },
  { data: '2026-07-10', setor: 'Neurologia', paciente: 'T.H.R', dias_apos_alta: 18, motivo: 'Crise Convulsiva Pós-operatória', taxa: 10.2 },
  { data: '2026-07-13', setor: 'Cardiologia', paciente: 'K.D.S', dias_apos_alta: 14, motivo: 'Arritmia Cardíaca Recorrente', taxa: 9.4 }
];

export default function Reinternacoes({ dataInicio, dataFim, onKpiChange }: ReinternacoesProps) {
  const [loading, setLoading] = useState(false);
  const [usingMock, setUsingMock] = useState(false);
  const [dados, setDados] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [exportandoPDF, setExportandoPDF] = useState(false);

  const carregarDados = async () => {
    setLoading(true);
    setUsingMock(false);
    try {
      const response = await webhookService.fetchIndicadoresQualidade({
        indicador: 'reinternacao',
        data_inicio: dataInicio,
        data_fim: dataFim
      });
      if (response && response.length > 0) {
        setDados(response);
      } else {
        setDados(MOCK_DATA);
        setUsingMock(true);
      }
    } catch (error) {
      console.error('Erro ao buscar dados de reinternacoes:', error);
      setDados(MOCK_DATA);
      setUsingMock(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, [dataInicio, dataFim]);

  // Eixo X dinâmico para o gráfico
  const eixoxKey = useMemo(() => {
    if (dados.length === 0) return 'data';
    const first = dados[0];
    if ('TIPO_CLINICA' in first) return 'TIPO_CLINICA';
    if ('tipo_clinica' in first) return 'tipo_clinica';
    return 'data';
  }, [dados]);

  // Eixo Y/Valor dinâmico para o gráfico
  const valorYKey = useMemo(() => {
    if (dados.length === 0) return 'taxa';
    const first = dados[0];
    if ('PERC_REINTERNACAO' in first) return 'PERC_REINTERNACAO';
    if ('perc_reinternacao' in first) return 'perc_reinternacao';
    if ('QT_REINTERNACOES' in first) return 'QT_REINTERNACOES';
    if ('qt_reinternacoes' in first) return 'qt_reinternacoes';
    return 'taxa';
  }, [dados]);

  const parsedDadosGrafico = useMemo(() => {
    // Filtra para remover linhas vazias ou de total do gráfico
    const dadosFiltrados = dados.filter(item => {
      const clinicaVal = String(item.tipo_clinica || item.TIPO_CLINICA || '').trim();
      const sortOrder = item.sort_order ?? item.SORT_ORDER;
      if (sortOrder !== undefined) {
        return Number(sortOrder) === 1;
      }
      return clinicaVal && clinicaVal.toUpperCase() !== 'TOTAL';
    });

    return dadosFiltrados.map(item => {
      const val = item[valorYKey];
      let numVal = 0;
      if (typeof val === 'number') {
        numVal = val;
      } else if (typeof val === 'string') {
        const cleanVal = val.replace('%', '').replace(',', '.').trim();
        numVal = parseFloat(cleanVal) || 0;
      }

      // Constrói o rótulo composto contendo Clínica, Sexo e Faixa Etária
      const clinica = item.tipo_clinica || item.TIPO_CLINICA;
      let labelComposto = '';
      if (clinica) {
        let sexo = item.ds_sexo || item.DS_SEXO || '';
        if (sexo === 'F' || sexo.toUpperCase() === 'FEMININO') sexo = 'Feminino';
        if (sexo === 'M' || sexo.toUpperCase() === 'MASCULINO') sexo = 'Masculino';
        const faixaEtaria = item.faixa_etaria || item.FAIXA_ETARIA || '';
        labelComposto = `${clinica} - ${sexo}${faixaEtaria ? ` (${faixaEtaria})` : ''}`;
      } else {
        // Fallback para dados de data (mock)
        labelComposto = item.data || item.DATA || '';
      }

      return {
        ...item,
        valorGrafico: numVal,
        labelComposto: labelComposto
      };
    });
  }, [dados, valorYKey]);

  const kpi = useMemo(() => {
    if (dados.length === 0) return { taxaMedia: 0, tendencia: 'baixa' };
    
    // Tenta encontrar a linha consolidada de TOTAL do Oracle
    const linhaTotal = dados.find(item => {
      const clinicaVal = String(item.tipo_clinica || item.TIPO_CLINICA || '').trim().toUpperCase();
      return clinicaVal === 'TOTAL';
    });

    if (linhaTotal) {
      const taxaKey = 'PERC_REINTERNACAO' in linhaTotal ? 'PERC_REINTERNACAO' : ('perc_reinternacao' in linhaTotal ? 'perc_reinternacao' : '');
      if (taxaKey) {
        const val = linhaTotal[taxaKey];
        let taxaMedia = 0;
        if (typeof val === 'number') {
          taxaMedia = val;
        } else if (typeof val === 'string') {
          const cleanVal = val.replace('%', '').replace(',', '.').trim();
          taxaMedia = parseFloat(cleanVal) || 0;
        }
        const tendencia = taxaMedia > 20 ? 'alta' : 'baixa';
        return { taxaMedia, tendencia };
      }
    }

    const first = dados[0];
    const taxaKey = 'PERC_REINTERNACAO' in first ? 'PERC_REINTERNACAO' : ('perc_reinternacao' in first ? 'perc_reinternacao' : ('taxa' in first ? 'taxa' : ''));
    
    let taxaMedia = 0;
    if (taxaKey) {
      let soma = 0;
      let count = 0;
      dados.forEach(item => {
        const val = item[taxaKey];
        if (val !== null && val !== undefined) {
          let numVal = 0;
          if (typeof val === 'number') {
            numVal = val;
          } else if (typeof val === 'string') {
            const cleanVal = val.replace('%', '').replace(',', '.').trim();
            numVal = parseFloat(cleanVal) || 0;
          }
          soma += numVal;
          count++;
        }
      });
      taxaMedia = count > 0 ? Number((soma / count).toFixed(1)) : 0;
    } else {
      const somaTaxa = dados.reduce((acc, curr) => acc + (curr.taxa || 0), 0);
      taxaMedia = Number((somaTaxa / dados.length).toFixed(1));
    }
    
    const tendencia = taxaMedia > 20 ? 'alta' : 'baixa';
    return { taxaMedia, tendencia };
  }, [dados]);

  // Efeito para notificar o componente pai sobre os KPIs calculados
  useEffect(() => {
    onKpiChange({
      taxaMedia: `${kpi.taxaMedia}%`,
      labelTaxa: 'Taxa de Reinternação',
      totalValue: 'Total de Altas',
      totalLabel: 'Base Calculada',
      meta: '<= 20% de Reinternações',
      metaDesc: 'Taxa de pacientes que retornam para internação em até 30 dias após a data da última alta.',
      usingMock,
      tendencia: kpi.tendencia,
      loading
    });
  }, [kpi, usingMock, loading]);

  const filteredDados = useMemo(() => {
    if (!searchTerm.trim()) return dados;
    const term = searchTerm.toLowerCase();
    return dados.filter(item => 
      Object.values(item).some(val => String(val).toLowerCase().includes(term))
    );
  }, [dados, searchTerm]);

  const linhasAgrupadas = useMemo(() => {
    if (usingMock || filteredDados.length === 0) return [];

    const result: any[] = [];
    
    // Filtramos para pegar apenas os registros reais (sort_order = 1)
    const registrosReais = filteredDados.filter(item => {
      const sortOrder = item.sort_order ?? item.SORT_ORDER;
      const clinicaVal = String(item.tipo_clinica || item.TIPO_CLINICA || '').trim().toUpperCase();
      if (sortOrder !== undefined) {
        return Number(sortOrder) === 1;
      }
      return clinicaVal !== 'TOTAL' && clinicaVal !== '';
    });

    // Encontra a linha de TOTAL se existir
    const linhaTotal = dados.find(item => {
      const clinicaVal = String(item.tipo_clinica || item.TIPO_CLINICA || '').trim().toUpperCase();
      return clinicaVal === 'TOTAL';
    });

    const clinicasInstanciadas = new Set<string>();
    const sexosInstanciadosPorClinica = new Map<string, Set<string>>();

    registrosReais.forEach(item => {
      const clinica = item.tipo_clinica || item.TIPO_CLINICA || 'Outros';
      let sexo = item.ds_sexo || item.DS_SEXO || 'Não informado';
      
      // Padroniza Gêneros
      if (sexo === 'F' || sexo.toUpperCase() === 'FEMININO') sexo = 'Feminino';
      if (sexo === 'M' || sexo.toUpperCase() === 'MASCULINO') sexo = 'Masculino';

      const faixaEtaria = item.faixa_etaria || item.FAIXA_ETARIA || 'Não informado';
      const qtReinternacoes = item.qt_reinternacoes ?? item.QT_REINTERNACOES ?? 0;
      const qtAltas = item.qt_saidas ?? item.QT_SAIDAS ?? 0;
      const mediaRaw = item.perc_reinternacao ?? item.PERC_REINTERNACAO ?? '0%';
      const media = normalizarPercentual(mediaRaw);

      // 1. Linha de cabeçalho da clínica se ainda não existir
      if (!clinicasInstanciadas.has(clinica)) {
        clinicasInstanciadas.add(clinica);
        result.push({
          isClinicaHeader: true,
          label: clinica
        });
        sexosInstanciadosPorClinica.set(clinica, new Set<string>());
      }

      // 2. Linha de cabeçalho do gênero se ainda não existir para esta clínica
      const sexosAdicionados = sexosInstanciadosPorClinica.get(clinica)!;
      if (!sexosAdicionados.has(sexo)) {
        sexosAdicionados.add(sexo);
        result.push({
          isSexoHeader: true,
          label: sexo
        });
      }

      // 3. Linha de dados com a faixa etária e as métricas
      result.push({
        isDataRow: true,
        faixaEtaria,
        qtReinternacoes,
        qtAltas,
        media
      });
    });

    // 4. Adiciona a linha consolidada de TOTAL no fim
    if (linhaTotal) {
      const qtReinternacoes = linhaTotal.qt_reinternacoes ?? linhaTotal.QT_REINTERNACOES ?? 0;
      const qtAltas = linhaTotal.qt_saidas ?? linhaTotal.QT_SAIDAS ?? 0;
      const mediaRaw = linhaTotal.perc_reinternacao ?? linhaTotal.PERC_REINTERNACAO ?? '0%';
      const media = normalizarPercentual(mediaRaw);
      
      result.push({
        isTotalRow: true,
        qtReinternacoes,
        qtAltas,
        media
      });
    }

    return result;
  }, [dados, filteredDados, usingMock]);

  // Colunas dinâmicas para a tabela
  const colunas = useMemo(() => {
    if (dados.length === 0) return [];
    return Object.keys(dados[0]).filter(k => k !== 'SORT_ORDER' && k !== 'sort_order');
  }, [dados]);

  const obterLabelCabecalho = (key: string) => {
    const mapeamento: Record<string, string> = {
      TIPO_CLINICA: 'Clínica / Especialidade',
      tipo_clinica: 'Clínica / Especialidade',
      DS_SEXO: 'Gênero',
      ds_sexo: 'Gênero',
      FAIXA_ETARIA: 'Faixa Etária',
      faixa_etaria: 'Faixa Etária',
      QT_SAIDAS: 'Saídas / Altas',
      qt_saidas: 'Saídas / Altas',
      QT_REINTERNACOES: 'Reinternações',
      qt_reinternacoes: 'Reinternações',
      PERC_REINTERNACAO: 'Taxa de Reinternação',
      perc_reinternacao: 'Taxa de Reinternação',
      data: 'Data',
      setor: 'Setor',
      paciente: 'Paciente',
      dias_apos_alta: 'Dias Pós-Alta',
      motivo: 'Motivo Principal',
      taxa: 'Taxa (%)'
    };
    return mapeamento[key] || key.replace(/_/g, ' ').toUpperCase();
  };

  const formatarValorCelula = (key: string, val: any) => {
    if (val === null || val === undefined) return '-';
    
    const keyLower = key.toLowerCase();
    
    if (keyLower.includes('data') || keyLower === 'dt') {
      try {
        const strVal = String(val);
        if (strVal.includes('-')) {
          return strVal.split('-').reverse().join('/');
        }
        return strVal;
      } catch {
        return String(val);
      }
    }
    
    if (keyLower.includes('taxa') || keyLower.includes('perc') || keyLower.includes('porcentagem')) {
      if (typeof val === 'number') {
        return `${val.toFixed(2)}%`;
      }
      return normalizarPercentual(val);
    }

    if (keyLower.includes('paciente') && String(val).length <= 4) {
      return <span className="font-mono font-bold text-primary">{String(val)}</span>;
    }
    
    if (keyLower.includes('dias') || keyLower.includes('retorno')) {
      return <span className="font-semibold text-rose-500">{val} dias</span>;
    }
    
    return String(val);
  };

  const exportarCSV = () => {
    if (dados.length === 0) return;
    const headers = colunas.map(c => obterLabelCabecalho(c));
    const csvRows = [headers.join(';')];
    for (const row of dados) {
      csvRows.push(colunas.map(col => {
        const val = row[col];
        return typeof val === 'string' ? `"${val}"` : val ?? '-';
      }).join(';'));
    }
    const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `reinternacoes_30_dias_${dataInicio}_a_${dataFim}.csv`;
    link.click();
  };

  const exportarPDF = async () => {
    const kpisEl = document.getElementById('kpis-card-container');
    const chartEl = document.getElementById('reinternacoes-chart-container');
    const chartWrapper = document.getElementById('reinternacoes-chart-wrapper');

    if (!kpisEl || !chartEl) {
      alert('Elementos de relatório não encontrados na página.');
      return;
    }

    // Guarda referências de exibição e estilo dos cards para restauração
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

      // Oculta o card 3 para o relatório em PDF
      if (card3) {
        card3.style.display = 'none';
      }

      // Altera temporariamente os cards de KPIs para a horizontal lado a lado
      kpisEl.className = "flex flex-row gap-4 w-[750px] p-2 bg-white";
      kpisEl.setAttribute('style', 'display: flex !important; flex-direction: row !important; width: 750px !important; gap: 16px !important; background-color: #ffffff !important;');
      
      if (card1) {
        card1.setAttribute('style', 'flex: 1 !important; width: 50% !important;');
      }
      if (card2) {
        card2.setAttribute('style', 'flex: 1 !important; width: 50% !important;');
      }

      // Aumenta temporariamente a altura do gráfico para ele ficar mais alto e proporcional no PDF
      if (chartWrapper) {
        chartWrapper.setAttribute('style', 'height: 480px !important;');
      }

      // Pequena pausa para o navegador processar a ocultação do card 3 e o novo flex horizontal do gráfico e kpis
      await new Promise(resolve => setTimeout(resolve, 200));

      // Captura o container de KPIs na horizontal lado a lado usando html-to-image
      const kpisImgData = await toPng(kpisEl, { 
        backgroundColor: '#ffffff',
        pixelRatio: 2
      });

      // Captura o gráfico usando html-to-image
      const chartImgData = await toPng(chartEl, {
        backgroundColor: '#ffffff',
        pixelRatio: 2
      });

      // Restaura o display e os estilos originais na tela imediatamente após as capturas
      if (card3) card3.style.display = card3OriginalDisplay;
      if (card1) card1.setAttribute('style', card1OriginalStyle);
      if (card2) card2.setAttribute('style', card2OriginalStyle);
      if (chartWrapper) chartWrapper.setAttribute('style', chartWrapperOriginalStyle);
      kpisEl.className = kpisOriginalClass;
      kpisEl.setAttribute('style', kpisOriginalStyle);

      const imgWidth = 180; // largura útil do A4
      
      // Proporções do bloco de KPIs (horizontal)
      const kpisWidth = 180;
      const kpisX = 15; // Alinha com as margens (15mm de margem esquerda)
      
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

      // Cria a instância do jsPDF
      const doc = new jsPDF('p', 'mm', 'a4');
      
      // Cabeçalho institucional do PDF
      doc.setFillColor(90, 16, 16); // Bordô #5A1010
      doc.rect(0, 0, 210, 8, 'F'); // Faixa no topo do A4

      doc.setTextColor(90, 16, 16); // Bordô #5A1010
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('HOSPITAL SANTA CASA DE MISERICORDIA DE ARAGUARI', 15, 22);

      doc.setTextColor(100, 116, 139); // Slate 500
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9);
      doc.text('GESTÃO DA QUALIDADE E SEGURANÇA DO PACIENTE', 15, 27);

      // Linha divisória
      doc.setDrawColor(226, 232, 240); // Border color
      doc.setLineWidth(0.5);
      doc.line(15, 30, 195, 30);

      // Título do Indicador
      doc.setTextColor(15, 23, 42); // Slate 900
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(13);
      doc.text('Indicador: Reinternação em 30 Dias', 15, 39);

      // Período
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

      // Adiciona a imagem dos Cards de KPIs (Horizontal lado a lado)
      doc.addImage(kpisImgData, 'PNG', kpisX, 52, kpisWidth, kpisHeight);

      // Adiciona a imagem do Gráfico
      const chartY = 52 + kpisHeight + 10;
      doc.addImage(chartImgData, 'PNG', chartX, chartY, chartWidth, chartHeight);

      // Rodapé do PDF
      doc.setTextColor(148, 163, 184); // Slate 400
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.text('Hospital Santa Casa de Araguari - Relatório Gerencial de Qualidade', 15, 285);
      doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`, 195, 285, { align: 'right' });

      // Baixa o arquivo para a máquina!
      doc.save(`relatorio_reinternacao_30_dias_${dataInicio}_a_${dataFim}.pdf`);
    } catch (error) {
      console.error('Erro ao gerar relatório em PDF:', error);
      alert('Ocorreu um erro ao gerar o relatório em PDF. Verifique o console do navegador para detalhes.');
    } finally {
      // Garante a restauração sob qualquer circunstância
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
    <div className="space-y-6">
      {/* Gráfico */}
      <div id="reinternacoes-chart-container" className="bg-card border p-6 rounded-xl shadow-sm flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="font-semibold text-sm">Evolução Histórica da Taxa</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Variação do percentual de reinternação por clínica / data</p>
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
        <div id="reinternacoes-chart-wrapper" className="h-[260px] w-full">
          {loading ? (
            <div className="h-full w-full flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : dados.length === 0 ? (
            <div className="h-full w-full flex flex-col items-center justify-center text-muted-foreground gap-2">
              <RefreshCw className="h-8 w-8 opacity-45" />
              <span className="text-sm">Nenhum dado encontrado para o período.</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={parsedDadosGrafico} margin={{ top: 20, right: 10, left: -20, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted/40" />
                <XAxis 
                  dataKey="labelComposto" 
                  tickFormatter={(str) => {
                    if (usingMock && str) {
                      try {
                        if (String(str).includes('-')) {
                          const parts = String(str).split('-');
                          return `${parts[2]}/${parts[1]}`;
                        }
                        return String(str);
                      } catch {
                        return String(str);
                      }
                    }
                    return str;
                  }}
                  tick={{ fontSize: 9 }}
                  tickLine={false}
                  axisLine={true}
                  angle={-20}
                  textAnchor="end"
                  height={55}
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
                  formatter={(val: any) => [`${Number(val).toFixed(2)}%`, 'Taxa de Reinternação']}
                  labelFormatter={(label) => {
                    if (!label) return '';
                    if (usingMock && String(label).includes('-')) {
                      return `Data: ${String(label).split('-').reverse().join('/')}`;
                    }
                    return `Grupo: ${label}`;
                  }}
                />
                <Bar 
                  dataKey="valorGrafico" 
                  name="Taxa de Reinternação" 
                  fill="#5A1010" 
                  radius={[4, 4, 0, 0]} 
                  barSize={32}
                  isAnimationActive={false}
                >
                  <LabelList
                    dataKey="valorGrafico"
                    position="top"
                    formatter={(val: any) => {
                      const num = Number(val);
                      if (isNaN(num) || num <= 0) return '';
                      return `${num.toFixed(2)}%`;
                    }}
                    style={{ fill: '#1e293b', fontSize: 10, fontWeight: 'bold' }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Tabela Detalhada */}
      <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
        <div className="p-5 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="font-bold text-base">Registros de Reinternados</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Detalhamento dos pacientes que retornaram ou consolidado por especialidade.</p>
          </div>
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="Buscar registros..."
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
          ) : filteredDados.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-2">
              <RefreshCw className="h-8 w-8 opacity-45" />
              <span>Nenhum registro encontrado.</span>
            </div>
          ) : !usingMock ? (
            /* Tabela com quebras de Clinica, Gênero e Faixa Etária (idêntica à imagem) */
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-muted/40 border-b">
                  <th className="p-4 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Clinica</th>
                  <th className="p-4 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Sexo</th>
                  <th className="p-4 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Faixa Etaria</th>
                  <th className="p-4 font-semibold text-muted-foreground text-xs uppercase tracking-wider text-center">Qtd. Reinternações</th>
                  <th className="p-4 font-semibold text-muted-foreground text-xs uppercase tracking-wider text-center">Qtd. Altas</th>
                  <th className="p-4 font-semibold text-muted-foreground text-xs uppercase tracking-wider text-center">Media</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {linhasAgrupadas.map((row, idx) => {
                  if (row.isClinicaHeader) {
                    return (
                      <tr key={`clinica-${idx}`} className="bg-muted/10 font-bold border-t border-border/60">
                        <td className="p-4 font-bold text-foreground text-sm">{row.label}</td>
                        <td className="p-4"></td>
                        <td className="p-4"></td>
                        <td className="p-4"></td>
                        <td className="p-4"></td>
                        <td className="p-4"></td>
                      </tr>
                    );
                  }
                  
                  if (row.isSexoHeader) {
                    return (
                      <tr key={`sexo-${idx}`} className="bg-background">
                        <td className="p-4"></td>
                        <td className="p-4 font-medium text-muted-foreground pl-6">{row.label}</td>
                        <td className="p-4"></td>
                        <td className="p-4"></td>
                        <td className="p-4"></td>
                        <td className="p-4"></td>
                      </tr>
                    );
                  }

                  if (row.isTotalRow) {
                    return (
                      <tr key={`total-${idx}`} className="bg-muted/60 font-bold border-t-2 border-border text-foreground">
                        <td className="p-4 font-bold text-sm">TOTAL</td>
                        <td className="p-4"></td>
                        <td className="p-4"></td>
                        <td className="p-4 text-center font-bold">{row.qtReinternacoes}</td>
                        <td className="p-4 text-center font-bold">{row.qtAltas}</td>
                        <td className="p-4 text-center font-bold text-primary">{row.media}</td>
                      </tr>
                    );
                  }

                  // Linha de dados real (isDataRow)
                  return (
                    <tr key={`data-${idx}`} className="hover:bg-muted/5 transition-colors">
                      <td className="p-4"></td>
                      <td className="p-4"></td>
                      <td className="p-4 text-muted-foreground pl-10">{row.faixaEtaria}</td>
                      <td className="p-4 text-center">{row.qtReinternacoes}</td>
                      <td className="p-4 text-center">{row.qtAltas}</td>
                      <td className="p-4 text-center font-semibold">{row.media}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            /* Tabela Plana Original (para dados de Mock/Demonstrativos) */
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-muted/40 border-b">
                  {colunas.map((col) => (
                    <th key={col} className="p-4 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                      {obterLabelCabecalho(col)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredDados.map((row, idx) => {
                  const clinicaUpper = String(row.tipo_clinica || row.TIPO_CLINICA || '').trim().toUpperCase();
                  const isTotal = clinicaUpper === 'TOTAL';
                  const sortOrder = row.sort_order ?? row.SORT_ORDER;
                  const isEmpty = sortOrder === 2 || (!row.tipo_clinica && !row.TIPO_CLINICA && !row.paciente);

                  return (
                    <tr 
                      key={idx} 
                      className={`transition-colors ${
                        isTotal 
                          ? 'bg-muted/60 font-bold border-t-2 border-border text-foreground hover:bg-muted/70' 
                          : isEmpty 
                            ? 'bg-muted/10 h-8 select-none pointer-events-none' 
                            : 'hover:bg-muted/5'
                      }`}
                    >
                      {colunas.map((col) => (
                        <td key={col} className={`p-4 ${isTotal ? 'font-bold' : ''}`}>
                          {isEmpty ? '' : formatarValorCelula(col, row[col])}
                        </td>
                      ))}
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
