import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, TrendingDown, TrendingUp, AlertCircle, Search, Download } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { webhookService } from '../../../services/webhookService';

interface InternacaoProps {
  dataInicio: string;
  dataFim: string;
  onKpiChange: (kpi: any) => void;
}

const MOCK_DATA = [
  { data: '2026-07-01', setor: 'Clínica Médica', pacientes_saida: 84, dias_totais: 462, media_dias: 5.5 },
  { data: '2026-07-04', setor: 'Ortopedia', pacientes_saida: 52, dias_totais: 208, media_dias: 4.0 },
  { data: '2026-07-08', setor: 'U.T.I Adulto', pacientes_saida: 24, dias_totais: 288, media_dias: 12.0 },
  { data: '2026-07-11', setor: 'Clínica Cirúrgica', pacientes_saida: 98, dias_totais: 313, media_dias: 3.2 },
  { data: '2026-07-14', setor: 'Pediatria', pacientes_saida: 45, dias_totais: 148, media_dias: 3.3 }
];

export default function MediaInternacao({ dataInicio, dataFim, onKpiChange }: InternacaoProps) {
  const [loading, setLoading] = useState(false);
  const [usingMock, setUsingMock] = useState(false);
  const [dados, setDados] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const carregarDados = async () => {
    setLoading(true);
    setUsingMock(false);
    try {
      const response = await webhookService.fetchIndicadoresQualidade({
        indicador: 'media_interncacao',
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
      console.error('Erro ao buscar dados de media internacao:', error);
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
    if (dados.length === 0) return 'media_dias';
    const first = dados[0];
    if ('media_dias' in first) return 'media_dias';
    if ('MEDIA_DIAS' in first) return 'MEDIA_DIAS';
    if ('tempo_medio' in first) return 'tempo_medio';
    if ('TEMPO_MEDIO' in first) return 'TEMPO_MEDIO';
    if ('media' in first) return 'media';
    if ('MEDIA' in first) return 'MEDIA';
    return 'media_dias';
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
    if (dados.length === 0) return { tempoMedio: 0, totalSaidas: 0, tendencia: 'baixa' };
    
    const first = dados[0];
    const totalSaidasKey = 'pacientes_saida' in first ? 'pacientes_saida' : ('PACIENTES_SAIDA' in first ? 'PACIENTES_SAIDA' : ('QT_SAIDAS' in first ? 'QT_SAIDAS' : ''));
    const totalSaidas = totalSaidasKey ? dados.reduce((acc, curr) => acc + (Number(curr[totalSaidasKey]) || 0), 0) : 0;
    
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
      const somaPermanencia = dados.reduce((acc, curr) => acc + (curr.media_dias || 0), 0);
      tempoMedio = Number((somaPermanencia / dados.length).toFixed(1));
    }
    
    const tendencia = tempoMedio > 5.5 ? 'alta' : 'baixa';
    return { tempoMedio, totalSaidas, tendencia };
  }, [dados, valorYKey]);

  // Efeito para notificar o componente pai sobre os KPIs calculados
  useEffect(() => {
    onKpiChange({
      taxaMedia: `${kpi.tempoMedio} dias`,
      labelTaxa: 'Média de Permanência',
      totalValue: `${kpi.totalSaidas} saídas`,
      totalLabel: 'Pacientes Saída',
      meta: '< 5.5 dias de média',
      metaDesc: 'Meta de giro de leitos estabelecida para otimização da capacidade instalada das enfermarias e UTIs.',
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
      setor: 'Setor',
      SETOR: 'Setor',
      pacientes_saida: 'Pacientes de Saída',
      PACIENTES_SAIDA: 'Pacientes de Saída',
      dias_totais: 'Dias Acumulados',
      dias_totais_leito: 'Dias Acumulados',
      media_dias: 'Média (dias)',
      MEDIA_DIAS: 'Média (dias)'
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
    
    if (keyLower.includes('media') || keyLower.includes('tempo') || keyLower.includes('permanencia')) {
      return <span className="font-semibold text-primary">{val} dias</span>;
    }
    
    if (keyLower.includes('saida') || keyLower.includes('pacientes')) {
      return <span>{val} saídas</span>;
    }

    if (keyLower.includes('dias') || keyLower.includes('totais')) {
      return <span>{val} dias</span>;
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
    link.download = `tempo_medio_internacao_${dataInicio}_a_${dataFim}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Gráfico */}
      <div className="bg-card border p-6 rounded-xl shadow-sm flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="font-semibold text-sm">Média de Permanência por Setor</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Distribuição do tempo médio em dias por ala hospitalar / data</p>
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
              <Calendar className="h-8 w-8 opacity-45" />
              <span className="text-sm">Nenhum dado encontrado para o período.</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={parsedDadosGrafico} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                <Bar dataKey="valorGrafico" name="Permanência Média (dias)" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Tabela Detalhada */}
      <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
        <div className="p-5 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="font-bold text-base">Registros de Saídas e Leitos</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Visão consolidada de internações.</p>
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
              <Calendar className="h-8 w-8 opacity-45" />
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
