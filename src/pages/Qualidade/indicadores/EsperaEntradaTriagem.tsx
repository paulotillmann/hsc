import React, { useState, useEffect, useMemo } from 'react';
import { Clock, TrendingDown, TrendingUp, AlertCircle, Search, Download } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { webhookService } from '../../../services/webhookService';

interface EsperaProps {
  dataInicio: string;
  dataFim: string;
  onKpiChange: (kpi: any) => void;
}

const MOCK_DATA = [
  { data: '2026-07-01', setor: 'Pronto Atendimento', pacientes: 195, tempo_medio_minutos: 12 },
  { data: '2026-07-04', setor: 'Pediatria Emergência', pacientes: 112, tempo_medio_minutos: 8 },
  { data: '2026-07-08', setor: 'Ortopedia Emergência', pacientes: 67, tempo_medio_minutos: 14 },
  { data: '2026-07-11', setor: 'Pronto Atendimento', pacientes: 210, tempo_medio_minutos: 15 },
  { data: '2026-07-14', setor: 'Ginecologia Emergência', pacientes: 54, tempo_medio_minutos: 6 }
];

export default function EsperaEntradaTriagem({ dataInicio, dataFim, onKpiChange }: EsperaProps) {
  const [loading, setLoading] = useState(false);
  const [usingMock, setUsingMock] = useState(false);
  const [dados, setDados] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const carregarDados = async () => {
    setLoading(true);
    setUsingMock(false);
    try {
      const response = await webhookService.fetchIndicadoresQualidade({
        indicador: 'entrada_triagem',
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
      console.error('Erro ao buscar dados de espera entrada triagem:', error);
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
    if (dados.length === 0) return 'setor';
    const first = dados[0];
    if ('setor' in first) return 'setor';
    if ('SETOR' in first) return 'SETOR';
    return 'data';
  }, [dados]);

  // Eixo Y/Valor dinâmico para o gráfico
  const valorYKey = useMemo(() => {
    if (dados.length === 0) return 'tempo_medio_minutos';
    const first = dados[0];
    if ('tempo_medio_minutos' in first) return 'tempo_medio_minutos';
    if ('TEMPO_MEDIO_MINUTOS' in first) return 'TEMPO_MEDIO_MINUTOS';
    if ('tempo_medio' in first) return 'tempo_medio';
    if ('TEMPO_MEDIO' in first) return 'TEMPO_MEDIO';
    if ('tempo' in first) return 'tempo';
    if ('TEMPO' in first) return 'TEMPO';
    return 'tempo_medio_minutos';
  }, [dados]);

  const parsedDadosGrafico = useMemo(() => {
    return dados.map(item => {
      const val = item[valorYKey];
      let numVal = 0;
      if (typeof val === 'number') {
        numVal = val;
      } else if (typeof val === 'string') {
        numVal = parseFloat(val) || 0;
      }
      return {
        ...item,
        valorGrafico: numVal
      };
    });
  }, [dados, valorYKey]);

  const kpi = useMemo(() => {
    if (dados.length === 0) return { tempoMedio: 0, totalPacientes: 0, tendencia: 'baixa' };
    
    const first = dados[0];
    const pacientesKey = 'pacientes' in first ? 'pacientes' : ('PACIENTES' in first ? 'PACIENTES' : ('total_pacientes' in first ? 'total_pacientes' : ('QT_PACIENTES' in first ? 'QT_PACIENTES' : '')));
    const totalPacientes = pacientesKey ? dados.reduce((acc, curr) => acc + (Number(curr[pacientesKey]) || 0), 0) : 0;
    
    let tempoMedio = 0;
    const tempoKey = valorYKey;
    if (tempoKey) {
      let soma = 0;
      let count = 0;
      dados.forEach(item => {
        const val = item[tempoKey];
        if (val !== null && val !== undefined) {
          soma += Number(val) || 0;
          count++;
        }
      });
      tempoMedio = count > 0 ? Number((soma / count).toFixed(1)) : 0;
    } else {
      const somaEspera = dados.reduce((acc, curr) => acc + (curr.tempo_medio_minutos || 0), 0);
      tempoMedio = Number((somaEspera / dados.length).toFixed(1));
    }
    
    const tendencia = tempoMedio > 15 ? 'alta' : 'baixa';
    return { tempoMedio, totalPacientes, tendencia };
  }, [dados, valorYKey]);

  // Efeito para notificar o componente pai sobre os KPIs calculados
  useEffect(() => {
    onKpiChange({
      taxaMedia: `${kpi.tempoMedio} min`,
      labelTaxa: 'Espera Triagem',
      totalValue: `${kpi.totalPacientes} triagens`,
      totalLabel: 'Pacientes Acolhidos',
      meta: '< 15 min de Espera',
      metaDesc: 'Média de tempo decorrido da entrada na recepção até o início do acolhimento/triagem pelo enfermeiro.',
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
    return Object.keys(dados[0]).filter(k => k !== 'SORT_ORDER' && k !== 'sort_order');
  }, [dados]);

  const obterLabelCabecalho = (key: string) => {
    const mapeamento: Record<string, string> = {
      data: 'Data',
      setor: 'Setor de Emergência',
      SETOR: 'Setor de Emergência',
      pacientes: 'Pacientes Acolhidos',
      PACIENTES: 'Pacientes Acolhidos',
      QT_PACIENTES: 'Pacientes Acolhidos',
      tempo_medio_minutos: 'Tempo Médio (min)',
      TEMPO_MEDIO_MINUTOS: 'Tempo Médio (min)'
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
    
    if (keyLower.includes('tempo') || keyLower.includes('minutos') || keyLower.includes('espera') || keyLower.includes('media')) {
      return <span className="font-semibold text-primary">{val} min</span>;
    }
    
    if (keyLower.includes('paciente') || keyLower.includes('total') || keyLower.includes('qt')) {
      return <span>{val} pacientes</span>;
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
    link.download = `tempo_espera_entrada_triagem_${dataInicio}_a_${dataFim}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Gráfico */}
      <div className="bg-card border p-6 rounded-xl shadow-sm flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="font-semibold text-sm">Tempo de Espera Recepção - Triagem</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Média em minutos segmentado por dia / ala</p>
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
              <span className="text-sm">Nenhum dado encontrado para o período.</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={parsedDadosGrafico} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTriagem" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted/40" />
                <XAxis 
                  dataKey={eixoxKey} 
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
                <Area 
                  type="monotone" 
                  dataKey="valorGrafico" 
                  name="Tempo de Espera (minutos)" 
                  stroke="hsl(var(--primary))" 
                  fillOpacity={1} 
                  fill="url(#colorTriagem)" 
                  strokeWidth={2} 
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Tabela Detalhada */}
      <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
        <div className="p-5 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="font-bold text-base">Registros de Triagens</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Fluxos operacionais detalhados.</p>
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
