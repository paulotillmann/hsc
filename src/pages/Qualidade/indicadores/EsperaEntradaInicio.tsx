import React, { useState, useEffect, useMemo } from 'react';
import { Clock, TrendingDown, TrendingUp, AlertCircle, Search, Download } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { webhookService } from '../../../services/webhookService';

interface EsperaProps {
  dataInicio: string;
  dataFim: string;
  onKpiChange: (kpi: any) => void;
}

const MOCK_DATA = [
  { data: '2026-07-01', classificacao: 'Verde (Pouco Urgente)', atendimentos: 142, tempo_medio_minutos: 48 },
  { data: '2026-07-04', classificacao: 'Amarelo (Urgente)', atendimentos: 88, tempo_medio_minutos: 32 },
  { data: '2026-07-08', classificacao: 'Vermelho (Emergência)', atendimentos: 12, tempo_medio_minutos: 4 },
  { data: '2026-07-11', classificacao: 'Verde (Pouco Urgente)', atendimentos: 165, tempo_medio_minutos: 52 },
  { data: '2026-07-14', classificacao: 'Laranja (Muito Urgente)', atendimentos: 34, tempo_medio_minutos: 18 }
];

export default function EsperaEntradaInicio({ dataInicio, dataFim, onKpiChange }: EsperaProps) {
  const [loading, setLoading] = useState(false);
  const [usingMock, setUsingMock] = useState(false);
  const [dados, setDados] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const carregarDados = async () => {
    setLoading(true);
    setUsingMock(false);
    try {
      const response = await webhookService.fetchIndicadoresQualidade({
        indicador: 'espera_entrada_inicio',
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
      console.error('Erro ao buscar dados de espera entrada inicio:', error);
      setDados(MOCK_DATA);
      setUsingMock(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, [dataInicio, dataFim]);

  // Verifica se os dados recebidos são detalhados (um registro por atendimento individual)
  const isDadosDetalhados = useMemo(() => {
    if (dados.length === 0) return false;
    const first = dados[0];
    return 'NR_ATENDIMENTO' in first || 'nr_atendimento' in first || 'NM_PACIENTE' in first || 'nm_paciente' in first;
  }, [dados]);

  // Dados processados para o gráfico (agrupados por dia caso os dados sejam detalhados)
  const dadosGraficoAgrupados = useMemo(() => {
    if (dados.length === 0) return [];

    if (!isDadosDetalhados) {
      // Caso já venha agrupado (ex: mock ou query pré-agrupada)
      const first = dados[0];
      const valYKey = 'tempo_medio_minutos' in first ? 'tempo_medio_minutos' : 
                      ('TEMPO_MEDIO_MINUTOS' in first ? 'TEMPO_MEDIO_MINUTOS' : 
                      ('tempo_medio' in first ? 'tempo_medio' : 
                      ('TEMPO_MEDIO' in first ? 'TEMPO_MEDIO' : 
                      ('tempo' in first ? 'tempo' : 
                      ('TEMPO' in first ? 'TEMPO' : 'tempo_medio_minutos')))));
      
      const xKey = 'classificacao' in first ? 'classificacao' : 
                   ('CLASSIFICACAO' in first ? 'CLASSIFICACAO' : 'data');

      return dados.map(item => {
        const val = item[valYKey];
        let numVal = 0;
        if (typeof val === 'number') {
          numVal = val;
        } else if (typeof val === 'string') {
          numVal = parseFloat(val) || 0;
        }
        return {
          ...item,
          eixoX: item[xKey] || '',
          valorGrafico: numVal
        };
      });
    }

    // Caso os dados sejam detalhados, agrupamos por dia da DT_ENTRADA
    const grupos: Record<string, { dataStr: string; totalMinutos: number; count: number }> = {};

    dados.forEach(item => {
      const dtEntradaRaw = item.DT_ENTRADA || item.dt_entrada || '';
      if (!dtEntradaRaw) return;
      
      // Extrai apenas a data YYYY-MM-DD
      const dateKey = dtEntradaRaw.substring(0, 10);
      
      // Converte tempo_medio_minutos ou calcula a partir de tempo_medio_hhmi
      let tempoMinutos = 0;
      if ('tempo_medio_minutos' in item || 'TEMPO_MEDIO_MINUTOS' in item) {
        tempoMinutos = Number(item.tempo_medio_minutos || item.TEMPO_MEDIO_MINUTOS) || 0;
      } else if (item.tempo_medio_hhmi || item.TEMPO_MEDIO_HHMI) {
        const hhmi = String(item.tempo_medio_hhmi || item.TEMPO_MEDIO_HHMI);
        if (hhmi.includes(':')) {
          const [h, m] = hhmi.split(':').map(Number);
          tempoMinutos = (h * 60) + (m || 0);
        }
      }

      if (!grupos[dateKey]) {
        grupos[dateKey] = { dataStr: dateKey, totalMinutos: 0, count: 0 };
      }
      grupos[dateKey].totalMinutos += tempoMinutos;
      grupos[dateKey].count += 1;
    });

    // Gera lista agrupada e ordenada por data
    return Object.values(grupos)
      .map(g => ({
        eixoX: g.dataStr, // ex: "2026-07-15"
        valorGrafico: Number((g.totalMinutos / g.count).toFixed(1)),
        atendimentos: g.count
      }))
      .sort((a, b) => a.eixoX.localeCompare(b.eixoX));
  }, [dados, isDadosDetalhados]);

  const kpi = useMemo(() => {
    if (dados.length === 0) return { tempoMedio: 0, totalAtendimentos: 0, tendencia: 'baixa' };
    
    let totalAtendimentos = 0;
    let tempoMedio = 0;

    if (!isDadosDetalhados) {
      const first = dados[0];
      const atendimentosKey = 'atendimentos' in first ? 'atendimentos' : 
                              ('ATENDIMENTOS' in first ? 'ATENDIMENTOS' : 
                              ('total_atendimentos' in first ? 'total_atendimentos' : 
                              ('QT_ATENDIMENTOS' in first ? 'QT_ATENDIMENTOS' : '')));
      totalAtendimentos = atendimentosKey ? dados.reduce((acc, curr) => acc + (Number(curr[atendimentosKey]) || 0), 0) : 0;
      
      const valYKey = 'tempo_medio_minutos' in first ? 'tempo_medio_minutos' : 
                      ('TEMPO_MEDIO_MINUTOS' in first ? 'TEMPO_MEDIO_MINUTOS' : 'tempo_medio_minutos');
      
      let soma = 0;
      let count = 0;
      dados.forEach(item => {
        const val = item[valYKey];
        if (val !== null && val !== undefined) {
          soma += Number(val) || 0;
          count++;
        }
      });
      tempoMedio = count > 0 ? Number((soma / count).toFixed(1)) : 0;
    } else {
      // Para dados detalhados (registros de pacientes):
      totalAtendimentos = dados.length;
      
      let somaMinutos = 0;
      let count = 0;
      dados.forEach(item => {
        let tempoMinutos = 0;
        if ('tempo_medio_minutos' in item || 'TEMPO_MEDIO_MINUTOS' in item) {
          tempoMinutos = Number(item.tempo_medio_minutos || item.TEMPO_MEDIO_MINUTOS) || 0;
        } else if (item.tempo_medio_hhmi || item.TEMPO_MEDIO_HHMI) {
          const hhmi = String(item.tempo_medio_hhmi || item.TEMPO_MEDIO_HHMI);
          if (hhmi.includes(':')) {
            const [h, m] = hhmi.split(':').map(Number);
            tempoMinutos = (h * 60) + (m || 0);
          }
        }
        somaMinutos += tempoMinutos;
        count++;
      });
      tempoMedio = count > 0 ? Number((somaMinutos / count).toFixed(1)) : 0;
    }
    
    const tendencia = tempoMedio > 45 ? 'alta' : 'baixa';
    return { tempoMedio, totalAtendimentos, tendencia };
  }, [dados, isDadosDetalhados]);

  // Efeito para notificar o componente pai sobre os KPIs calculados
  useEffect(() => {
    onKpiChange({
      taxaMedia: `${kpi.tempoMedio} min`,
      labelTaxa: 'Média de Espera',
      totalValue: `${kpi.totalAtendimentos} consultas`,
      totalLabel: 'Atendimentos',
      meta: '< 45 min de Espera',
      metaDesc: 'Média de tempo total do acolhimento na recepção até o início efetivo do atendimento médico.',
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

  // Colunas dinâmicas para a tabela
  const colunas = useMemo(() => {
    if (dados.length === 0) return [];
    // Ocultar códigos internos do Oracle e a coluna auxiliar do gráfico
    const ocultar = [
      'SORT_ORDER', 'sort_order', 
      'IE_CLINICA', 'ie_clinica', 
      'IE_TIPO_ATENDIMENTO', 'ie_tipo_atendimento',
      'tempo_medio_minutos', 'TEMPO_MEDIO_MINUTOS',
      'valorGrafico'
    ];
    return Object.keys(dados[0]).filter(k => !ocultar.includes(k));
  }, [dados]);

  const obterLabelCabecalho = (key: string) => {
    const mapeamento: Record<string, string> = {
      data: 'Data',
      classificacao: 'Protocolo de Manchester',
      CLASSIFICACAO: 'Protocolo de Manchester',
      atendimentos: 'Consultas Médicas',
      ATENDIMENTOS: 'Consultas Médicas',
      QT_ATENDIMENTOS: 'Consultas Médicas',
      tempo_medio_minutos: 'Espera Média (min)',
      TEMPO_MEDIO_MINUTOS: 'Espera Média (min)',
      NR_ATENDIMENTO: 'Nº Atendimento',
      nr_atendimento: 'Nº Atendimento',
      NM_PACIENTE: 'Paciente',
      nm_paciente: 'Paciente',
      DT_ENTRADA: 'Data/Hora Entrada',
      dt_entrada: 'Data/Hora Entrada',
      DT_ATEND_MEDICO: 'Data/Hora Atend. Médico',
      dt_atend_medico: 'Data/Hora Atend. Médico',
      tempo_medio_hhmi: 'Tempo de Espera',
      TEMPO_MEDIO_HHMI: 'Tempo de Espera',
      medico: 'Médico Responsável',
      MEDICO: 'Médico Responsável',
      DS_CLINICA: 'Especialidade Clínica',
      ds_clinica: 'Especialidade Clínica'
    };
    return mapeamento[key] || key.replace(/_/g, ' ').toUpperCase();
  };

  const formatarValorCelula = (key: string, val: any) => {
    if (val === null || val === undefined) return '-';
    
    const keyLower = key.toLowerCase();
    
    // Formatar datas no padrão local
    if (keyLower === 'dt_entrada' || keyLower === 'dt_atend_medico' || keyLower === 'dt') {
      try {
        const date = new Date(val);
        if (!isNaN(date.getTime())) {
          return date.toLocaleString('pt-BR');
        }
        return String(val);
      } catch {
        return String(val);
      }
    }
    
    if (keyLower.includes('data')) {
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
    
    // Formatar tempos em minutos/horas
    if (keyLower.includes('tempo_medio_minutos') || keyLower.includes('tempo_medio_min') || keyLower.includes('minutos')) {
      return <span className="font-semibold text-primary">{val} min</span>;
    }
    
    if (keyLower === 'tempo_medio_hhmi' || keyLower === 'tempo_medio_hhmm') {
      return <span className="font-semibold text-primary">{val} hs</span>;
    }
    
    if (keyLower.includes('atendimento') || keyLower.includes('total') || keyLower.includes('qt')) {
      return <span>{val} consultas</span>;
    }
    
    // Protocolo de Manchester / Classificações de Urgência
    if (keyLower.includes('classificacao') || keyLower.includes('manchester') || keyLower.includes('protocolo')) {
      const strVal = String(val).toLowerCase();
      const isUrgent = strVal.includes('vermelho') || strVal.includes('emergência') || strVal.includes('laranja');
      const isMedium = strVal.includes('amarelo');
      return (
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
          isUrgent ? 'bg-rose-500/10 text-rose-500' :
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
    link.download = `tempo_espera_entrada_consulta_${dataInicio}_a_${dataFim}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Gráfico */}
      <div className="bg-card border p-6 rounded-xl shadow-sm flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="font-semibold text-sm">Tempo de Espera por Especialidade / Data</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Visão cronológica e por classificação de triagem</p>
          </div>
          <button 
            onClick={exportarCSV}
            className="flex items-center gap-2 px-3 py-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg shadow-sm transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Exportar CSV
          </button>
        </div>
        <div className="h-[260px] w-full">
          {loading ? (
            <div className="h-full w-full flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : dados.length === 0 ? (
            <div className="h-full w-full flex flex-col items-center justify-center text-muted-foreground gap-2">
              <Clock className="h-8 w-8 opacity-45" />
              <span className="text-sm">Nenhum data encontrado para o período.</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dadosGraficoAgrupados} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted/40" vertical={false} />
                <XAxis 
                  dataKey="eixoX" 
                  tickFormatter={(str) => {
                    if (!str) return '';
                    try {
                      if (String(str).includes('-')) {
                        const parts = String(str).split('-');
                        return `${parts[2]}/${parts[1]}`;
                      }
                      return String(str);
                    } catch {
                      return String(str);
                    }
                  }}
                  tick={{ fontSize: 11 }}
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                  labelStyle={{ fontWeight: 'bold', fontSize: 12 }}
                  itemStyle={{ fontSize: 12 }}
                  labelFormatter={(label) => {
                    if (!label) return '';
                    if (String(label).includes('-')) {
                      return `Data: ${String(label).split('-').reverse().join('/')}`;
                    }
                    return label;
                  }}
                />
                <Bar 
                  dataKey="valorGrafico" 
                  name="Espera Média (minutos)" 
                  fill="var(--primary)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={50}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Tabela Detalhada */}
      <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
        <div className="p-5 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="font-bold text-base">Registros de Fluxo de Entrada</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Visão consolidada de tempos de atendimento.</p>
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
              <Clock className="h-8 w-8 opacity-45" />
              <span>Nenhum registro encontrado.</span>
            </div>
          ) : (
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
                {filteredDados.map((row, idx) => (
                  <tr key={idx} className="hover:bg-muted/10 transition-colors">
                    {colunas.map((col) => (
                      <td key={col} className="p-4">
                        {formatarValorCelula(col, row[col])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
