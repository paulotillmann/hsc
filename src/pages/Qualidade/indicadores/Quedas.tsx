import React, { useState, useEffect, useMemo } from 'react';
import { ShieldAlert, TrendingDown, TrendingUp, AlertCircle, Search, Download, FileText } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LabelList } from 'recharts';
import { webhookService } from '../../../services/webhookService';
import { jsPDF } from 'jspdf';
import { toPng } from 'html-to-image';

interface QuedasProps {
  dataInicio: string;
  dataFim: string;
  onKpiChange: (kpi: any) => void;
}

const MOCK_DATA = [
  { data: '2026-07-01', setor: 'U.T.I Adulto', paciente: 'M.A.S', idade: 68, grau_risco: 'Alto', total: 1 },
  { data: '2026-07-03', setor: 'Clínica Médica', paciente: 'J.R.F', idade: 74, grau_risco: 'Alto', total: 1 },
  { data: '2026-07-06', setor: 'Clínica Cirúrgica', paciente: 'A.L.M', idade: 59, grau_risco: 'Médio', total: 1 },
  { data: '2026-07-09', setor: 'Pediatria', paciente: 'G.V.S', idade: 4, grau_risco: 'Baixo', total: 1 },
  { data: '2026-07-12', setor: 'U.T.I Neonatal', paciente: 'R.C.D', idade: 0, grau_risco: 'Médio', total: 1 },
  { data: '2026-07-14', setor: 'Clínica Médica', paciente: 'E.J.N', idade: 81, grau_risco: 'Alto', total: 1 }
];

export default function Quedas({ dataInicio, dataFim, onKpiChange }: QuedasProps) {
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
        indicador: 'quedas',
        data_inicio: dataInicio,
        data_fim: dataFim
      });
      if (response && response.length > 0) {
        // Higieniza nomes de setores com erros de digitação ou sufixos inconsistentes vindos da base do hospital
        const sanitized = response.map((item: any) => {
          const newItem = { ...item };
          for (const key of Object.keys(newItem)) {
            if (typeof newItem[key] === 'string') {
              let val = newItem[key].trim();
              if (val.toLowerCase().includes('apartamenos')) {
                val = val.replace(/apartamenos/gi, 'Apartamentos');
              }
              if (val.toLowerCase().includes('posto 2 - apartamentos')) {
                val = 'Posto 2 - Apartamentos';
              }
              newItem[key] = val;
            }
          }
          return newItem;
        });
        setDados(sanitized);
      } else {
        setDados(MOCK_DATA);
        setUsingMock(true);
      }
    } catch (error) {
      console.error('Erro ao buscar dados de quedas:', error);
      setDados(MOCK_DATA);
      setUsingMock(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, [dataInicio, dataFim]);

  // Tratamento e normalização dos dados para plotagem no gráfico
  const parsedDadosGrafico = useMemo(() => {
    return dados.map(item => {
      // Procura a chave de setor em diferentes formatos
      const setorKey = 'SETOR' in item ? 'SETOR' : ('setor' in item ? 'setor' : ('DS_SETOR' in item ? 'DS_SETOR' : ('ds_setor' in item ? 'ds_setor' : '')));
      let setorNome = setorKey ? item[setorKey] : undefined;

      // Sanitiza nomes de setor vazios ou inconsistentes (como strings 'undefined' ou 'null')
      if (!setorNome || String(setorNome).toLowerCase() === 'undefined' || String(setorNome).toLowerCase() === 'null') {
        const dataVal = item.data || item.DATA || item.DT_REGISTRO || item.dt_registro;
        if (dataVal) {
          try {
            if (String(dataVal).includes('-')) {
              const parts = String(dataVal).split('-');
              setorNome = `${parts[2]}/${parts[1]}`;
            } else {
              setorNome = String(dataVal);
            }
          } catch {
            setorNome = String(dataVal);
          }
        } else {
          setorNome = 'Setor Não Informado';
        }
      }

      // Procura o valor total de quedas
      const totalKey = 'TOTAL' in item ? 'TOTAL' : ('total' in item ? 'total' : ('QT_QUEDAS' in item ? 'QT_QUEDAS' : ('qt_quedas' in item ? 'qt_quedas' : '')));
      const totalValor = totalKey ? item[totalKey] : undefined;

      // Procura a taxa do setor específico
      const taxaKey = 'TAXA' in item ? 'TAXA' : ('taxa' in item ? 'taxa' : '');
      let taxaSetor = taxaKey ? Number(item[taxaKey]) : undefined;

      // Fallback se não vier taxa (ex: dados do mock)
      if (taxaSetor === undefined) {
        const pacDiaKey = 'TOTAL_PACIENTE_DIA' in item ? 'TOTAL_PACIENTE_DIA' : ('total_paciente_dia' in item ? 'total_paciente_dia' : '');
        const pacDiaVal = pacDiaKey ? Number(item[pacDiaKey]) : 0;
        if (pacDiaVal > 0) {
          taxaSetor = (Number(totalValor) / pacDiaVal) * 1000;
        } else {
          taxaSetor = (Number(totalValor) / 15) * 1000;
        }
      }

      return {
        ...item,
        setorGrafico: setorNome,
        valorGrafico: Number(totalValor) || 0,
        taxaSetor: Number(taxaSetor) || 0
      };
    });
  }, [dados]);

  // Filtra para exibir no gráfico apenas os setores que possuem quedas (> 0)
  const dadosFiltradosGrafico = useMemo(() => {
    return parsedDadosGrafico.filter(item => item.valorGrafico > 0);
  }, [parsedDadosGrafico]);

  const kpi = useMemo(() => {
    if (parsedDadosGrafico.length === 0) {
      return { totalQuedas: 0, taxaEstimada: '0.00', totalPacDia: 0, tendencia: 'baixa' };
    }
    const totalQuedas = parsedDadosGrafico.reduce((acc, curr) => acc + curr.valorGrafico, 0);

    // Busca a chave de paciente-dia
    const pKey = Object.keys(parsedDadosGrafico[0] || {}).find(
      k => k.toLowerCase() === 'total_paciente_dia' || k.toLowerCase() === 'total_paciente_dias'
    );
    const totalPacDia = pKey ? parsedDadosGrafico.reduce((acc, curr) => acc + (Number(curr[pKey]) || 0), 0) : 0;

    // Calcula a taxa consolidada real do período selecionado, senão usa estimativa
    const taxaReal = totalPacDia > 0 ? (totalQuedas / totalPacDia) * 1000 : (totalQuedas / 15);
    const taxaFormatada = taxaReal.toFixed(2);

    // Tendência lógica baseada no valor da meta institucional (2.2)
    const tendencia = taxaReal > 2.2 ? 'alta' : 'baixa';

    return { totalQuedas, taxaEstimada: taxaFormatada, totalPacDia, tendencia };
  }, [parsedDadosGrafico]);

  // Efeito para notificar o componente pai sobre os KPIs calculados
  useEffect(() => {
    // Rótulo dinâmico e preciso
    const labelValor = kpi.totalPacDia > 0
      ? `${kpi.taxaEstimada} p/ 1000 pac-dia`
      : `${kpi.taxaEstimada} p/ 1000 pac-dia (est.)`;

    onKpiChange({
      taxaMedia: `${kpi.totalQuedas} ocorrências`,
      labelTaxa: 'Total de Quedas',
      totalValue: labelValor,
      totalLabel: 'Taxa do Período',
      meta: '<= 2,2 a cada 1000 pacientes-dia',
      metaDesc: 'Meta de segurança do paciente para incidência de quedas com ou sem dano no ambiente hospitalar.',
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

  // Colunas dinâmicas para a tabela ordenadas conforme solicitado
  const colunas = useMemo(() => {
    if (dados.length === 0) return [];
    const keys = Object.keys(dados[0]).filter(k => k !== 'SORT_ORDER' && k !== 'sort_order');

    // Identifica as chaves das colunas métricas solicitadas
    const chavePacienteDia = keys.find(k => k.toLowerCase() === 'total_paciente_dia' || k.toLowerCase() === 'total_paciente_dias');
    const chaveTotalQuedas = keys.find(k => k.toLowerCase() === 'total' || k.toLowerCase() === 'total_de_quedas' || k.toLowerCase() === 'qt_quedas');
    const chaveTaxa = keys.find(k => k.toLowerCase() === 'taxa');

    // Separa as demais colunas de identificação (como data, setor, etc.)
    const chavesIdentificacao = keys.filter(k =>
      k !== chavePacienteDia &&
      k !== chaveTotalQuedas &&
      k !== chaveTaxa
    );

    // Concatena na ordem definida: Identificações primeiro, depois as métricas específicas
    const ordenadas: string[] = [...chavesIdentificacao];
    if (chavePacienteDia) ordenadas.push(chavePacienteDia);
    if (chaveTotalQuedas) ordenadas.push(chaveTotalQuedas);
    if (chaveTaxa) ordenadas.push(chaveTaxa);

    return ordenadas;
  }, [dados]);

  const obterLabelCabecalho = (key: string) => {
    const mapeamento: Record<string, string> = {
      SETOR: 'Setor / Ala',
      setor: 'Setor / Ala',
      TOTAL: 'Total de Quedas',
      total: 'Total de Quedas',
      TOTAL_PACIENTE_DIA: 'Total Paciente-Dia',
      total_paciente_dia: 'Total Paciente-Dia',
      TAXA: 'Taxa (p/ 1000 pac-dia)',
      taxa: 'Taxa (p/ 1000 pac-dia)',
      data: 'Data',
      DATA: 'Data',
      paciente: 'Paciente',
      PACIENTE: 'Paciente',
      idade: 'Idade',
      IDADE: 'Idade',
      grau_risco: 'Grau do Dano',
      GRAU_RISCO: 'Grau do Dano'
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

    if (keyLower.includes('taxa') || keyLower.includes('perc')) {
      if (typeof val === 'number') {
        return `${val.toFixed(2)}`;
      }
      return String(val);
    }

    if (keyLower.includes('paciente') && String(val).length <= 4) {
      return <span className="font-mono font-bold text-primary">{String(val)}</span>;
    }

    if (keyLower.includes('risco') || keyLower.includes('grau')) {
      const strVal = String(val).toLowerCase();
      const isHigh = strVal.includes('alto') || strVal.includes('grave');
      const isMedium = strVal.includes('médio') || strVal.includes('moderado');
      return (
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${isHigh ? 'bg-rose-500/10 text-rose-500' :
          isMedium ? 'bg-amber-500/10 text-amber-500' :
            'bg-emerald-500/10 text-emerald-500'
          }`}>
          {String(val)}
        </span>
      );
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
    link.download = `incidencia_quedas_${dataInicio}_a_${dataFim}.csv`;
    link.click();
  };

  const exportarPDF = async () => {
    const kpisEl = document.getElementById('kpis-card-container');
    const chartEl = document.getElementById('quedas-chart-container');
    const chartWrapper = document.getElementById('quedas-chart-wrapper');

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
      // Como agora está lado a lado horizontal, vamos usar largura de 180mm no PDF para ocupar toda a largura da página
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
      doc.text('Indicador: Incidência de Quedas com Dano', 15, 39);

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
      doc.save(`relatorio_incidencia_quedas_${dataInicio}_a_${dataFim}.pdf`);
    } catch (error) {
      console.error('Erro ao gerar relatório em PDF:', error);
      alert('Ocorreu um erro ao gerar o relatório em PDF. Verifique o console do navegador para detalhes.');
    } finally {
      // Garante a restauração sob qualquer circunstância
      if (card3) {
        card3.style.display = card3OriginalDisplay;
      }
      if (card1) {
        card1.setAttribute('style', card1OriginalStyle);
      }
      if (card2) {
        card2.setAttribute('style', card2OriginalStyle);
      }
      if (chartWrapper) {
        chartWrapper.setAttribute('style', chartWrapperOriginalStyle);
      }
      kpisEl.className = kpisOriginalClass;
      kpisEl.setAttribute('style', kpisOriginalStyle);
      setExportandoPDF(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Gráfico */}
      <div id="quedas-chart-container" className="bg-card border p-6 rounded-xl shadow-sm flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="font-semibold text-sm">Distribuição das Ocorrências</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Quedas registradas por setor / ala hospitalar</p>
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
        <div id="quedas-chart-wrapper" className="h-[300px] w-full flex justify-center">
          {loading ? (
            <div className="h-full w-full flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : dados.length === 0 ? (
            <div className="h-full w-full flex flex-col items-center justify-center text-muted-foreground gap-2">
              <ShieldAlert className="h-8 w-8 opacity-45" />
              <span className="text-sm">Nenhum dado encontrado para o período.</span>
            </div>
          ) : (
            <div className="w-[90%] h-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dadosFiltradosGrafico} margin={{ top: 20, right: 20, left: -10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/40" />
                  <XAxis
                    dataKey="setorGrafico"
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={true}
                    angle={-35}
                    textAnchor="end"
                    height={75}
                    interval={0}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                    labelStyle={{ fontWeight: 'bold', fontSize: 12 }}
                    itemStyle={{ fontSize: 12 }}
                  />
                  <Bar dataKey="valorGrafico" name="Quedas" fill="#5A1010" radius={[4, 4, 0, 0]} barSize={28}>
                    <LabelList
                      dataKey="taxaSetor"
                      position="top"
                      formatter={(val: any) => {
                        const num = Number(val);
                        if (isNaN(num) || num <= 0) return '';
                        return num.toFixed(2);
                      }}
                      style={{ fill: '#0f172a', fontSize: 10, fontWeight: 'bold' }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Tabela Detalhada */}
      <div className="bg-card border rounded-xl shadow-sm overflow-hidden print:hidden">
        <div className="p-5 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="font-bold text-base">Registros de Incidentes</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Detalhamento para auditoria e plano de ação.</p>
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
              <ShieldAlert className="h-8 w-8 opacity-45" />
              <span>Nenhum registro encontrado.</span>
            </div>
          ) : (
            <table className="w-full text-center border-collapse text-sm">
              <thead>
                <tr className="bg-muted/40 border-b">
                  {colunas.map((col) => (
                    <th key={col} className="p-4 font-semibold text-muted-foreground text-xs uppercase tracking-wider text-center">
                      {obterLabelCabecalho(col)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredDados.map((row, idx) => (
                  <tr key={idx} className="hover:bg-muted/10 transition-colors">
                    {colunas.map((col) => (
                      <td key={col} className="p-4 text-center">
                        {formatarValorCelula(col, row[col])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-muted/30 border-t-2 border-border font-bold text-foreground">
                  {colunas.map((col, idx) => {
                    const keyLower = col.toLowerCase();

                    // Exibe "TOTAL" na primeira coluna
                    if (idx === 0) {
                      return (
                        <td key={col} className="p-4 text-center font-bold">
                          TOTAL
                        </td>
                      );
                    }

                    // Se for a coluna de Paciente-Dia, faz o somatório
                    if (keyLower === 'total_paciente_dia' || keyLower === 'total_paciente_dias') {
                      const totalPacDia = filteredDados.reduce((acc, curr) => acc + (Number(curr[col]) || 0), 0);
                      return (
                        <td key={col} className="p-4 text-center font-bold">
                          {totalPacDia}
                        </td>
                      );
                    }

                    // Se for a coluna de Total de Quedas, faz o somatório
                    if (keyLower === 'total' || keyLower === 'total_de_quedas' || keyLower === 'qt_quedas') {
                      const totalQuedas = filteredDados.reduce((acc, curr) => acc + (Number(curr[col]) || 0), 0);
                      return (
                        <td key={col} className="p-4 text-center font-bold">
                          {totalQuedas}
                        </td>
                      );
                    }

                    // Se for a coluna de Taxa, recalcula a taxa consolidada global
                    if (keyLower === 'taxa') {
                      const totalQuedas = filteredDados.reduce((acc, curr) => {
                        const qKey = colunas.find(k => k.toLowerCase() === 'total' || k.toLowerCase() === 'total_de_quedas' || k.toLowerCase() === 'qt_quedas');
                        return acc + (qKey ? (Number(curr[qKey]) || 0) : 0);
                      }, 0);

                      const totalPacDia = filteredDados.reduce((acc, curr) => {
                        const pKey = colunas.find(k => k.toLowerCase() === 'total_paciente_dia' || k.toLowerCase() === 'total_paciente_dias');
                        return acc + (pKey ? (Number(curr[pKey]) || 0) : 0);
                      }, 0);

                      const taxaGlobal = totalPacDia > 0 ? ((totalQuedas / totalPacDia) * 1000).toFixed(2) : '0.00';
                      return (
                        <td key={col} className="p-4 text-center font-bold">
                          {taxaGlobal}
                        </td>
                      );
                    }

                    // Exibe traço nas demais colunas (identificadores) para manter a tabela limpa
                    return (
                      <td key={col} className="p-4 text-center text-muted-foreground font-normal">
                        -
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
