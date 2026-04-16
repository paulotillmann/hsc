import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Users, User, Activity, Download } from 'lucide-react';
import { fetchNotificacoes, NotificacaoRecord } from '../../services/notificacaoService';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

// Padrão de Cores
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899', '#84cc16', '#eab308'];
const GENDER_COLORS: Record<string, string> = {
  'MASCULINO': '#3b82f6',
  'FEMININO': '#ec4899',
  'OUTROS': '#eab308'
};

// --- Utilitário de Parsing de Idade ---
function getAgeBucket(idadeStr: string | null): string {
  if (!idadeStr) return 'Não Informado';
  
  const str = idadeStr.toUpperCase();
  const match = str.match(/(\d+)\s*(ANO|ANOS|MES|MESES|DIA|DIAS)/);
  if (!match) return 'Não Informado';

  const value = parseInt(match[1], 10);
  const unit = match[2];

  if (unit.includes('DIA')) return '0 a 6 MESES';
  
  if (unit.includes('MES')) {
    if (value <= 6) return '0 a 6 MESES';
    return '7 a 11 MESES';
  }

  if (unit.includes('ANO')) {
    if (value >= 1 && value <= 5) return '1 a 5 ANOS';
    if (value >= 6 && value <= 11) return '6 a 11 ANOS';
    if (value >= 12 && value <= 19) return '12 a 19 ANOS';
    if (value >= 20 && value <= 29) return '20 a 29 ANOS';
    if (value >= 30 && value <= 39) return '30 a 39 ANOS';
    if (value >= 40 && value <= 49) return '40 a 49 ANOS';
    if (value >= 50 && value <= 59) return '50 a 59 ANOS';
    if (value >= 60 && value <= 69) return '60 a 69 ANOS';
    if (value >= 70 && value <= 79) return '70 a 79 ANOS';
    if (value >= 80 && value <= 100) return '80 a 100 ANOS';
    if (value > 100) return 'MAIS DE 101 ANOS';
  }
  
  return 'Não Informado';
}

const AGE_BUCKET_ORDER = [
  '0 a 6 MESES', '7 a 11 MESES', '1 a 5 ANOS', '6 a 11 ANOS', '12 a 19 ANOS', 
  '20 a 29 ANOS', '30 a 39 ANOS', '40 a 49 ANOS', '50 a 59 ANOS', '60 a 69 ANOS', 
  '70 a 79 ANOS', '80 a 100 ANOS', 'MAIS DE 101 ANOS'
];

export default function NotificacoesGraficos() {
  const [data, setData] = useState<NotificacaoRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros Padrão
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

  const [dateFrom, setDateFrom] = useState(firstDay);
  const [dateTo, setDateTo] = useState(lastDay);

  const [selectedSexo, setSelectedSexo] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await fetchNotificacoes({ 
        limit: 5000, 
        dateFrom: dateFrom || undefined, 
        dateTo: dateTo || undefined 
      });
      setData(result.data);
    } catch (err) {
      console.error('Erro ao buscar notificações para gráficos', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    setSelectedSexo(null); // Reseta o filtro clicável ao mudar a data
  }, [dateFrom, dateTo]);

  // -- KPIs (Usa raw data) --
  const kpis = useMemo(() => {
    let masc = 0;
    let fem = 0;
    data.forEach(item => {
      const sexo = item.SexoPaciente?.toUpperCase().trim();
      if (sexo === 'MASCULINO') masc++;
      else if (sexo === 'FEMININO') fem++;
    });
    return { total: data.length, masc, fem };
  }, [data]);

  // Aplica o filtro selecionado (Masculino/Feminino) apenas nos gráficos
  const filteredData = useMemo(() => {
    if (!selectedSexo) return data;
    return data.filter(item => item.SexoPaciente?.toUpperCase().trim() === selectedSexo);
  }, [data, selectedSexo]);

  // -- 1. Gráfico de Idade --
  const ageData = useMemo(() => {
    const counts: Record<string, number> = {};
    AGE_BUCKET_ORDER.forEach(b => counts[b] = 0);
    filteredData.forEach(item => {
      const bucket = getAgeBucket(item.IdadePaciente);
      if (counts[bucket] !== undefined) counts[bucket]++;
    });
    const total = filteredData.length || 1;
    return AGE_BUCKET_ORDER.map(name => ({
      name, value: counts[name], percentual: ((counts[name] / total) * 100).toFixed(0) + '%'
    }));
  }, [filteredData]);

  // -- 2. Gráfico de Cor / Raça --
  const corRacaData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredData.forEach(item => {
      let name = item.CorRacaPaciente?.trim().toUpperCase() || 'NÃO INFORMADA';
      if(name === '' || name === 'IGNORADO') name = 'NÃO INFORMADA';
      counts[name] = (counts[name] || 0) + 1;
    });
    
    // Calcula o total para percentuais
    const total = filteredData.length || 1;
    
    return Object.entries(counts)
      .map(([name, value]) => ({ 
        name, 
        value, 
        percentual: ((value / total) * 100).toFixed(1).replace('.', ',') + '%' 
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredData]);

  // -- 3. Gráfico de Escolaridade --
  const escolaridadeData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredData.forEach(item => {
      let name = item.EscolaridadePaciente?.trim().toUpperCase() || 'NÃO INFORMADA';
      if(name === '' || name === 'IGNORADO') name = 'NÃO INFORMADA';
      counts[name] = (counts[name] || 0) + 1;
    });
    
    const total = filteredData.length || 1;
    
    return Object.entries(counts)
      .map(([name, value]) => ({ 
        name, 
        value, 
        percentual: ((value / total) * 100).toFixed(1).replace('.', ',') + '%' 
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredData]);

  // -- 4. Gráfico de Saídas --
  const saidasData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredData.forEach(item => {
      let name = item.Saida?.trim().toUpperCase() || 'EM ABERTO';
      if(name === '' || name === 'IGNORADO') name = 'EM ABERTO';
      counts[name] = (counts[name] || 0) + 1;
    });
    
    const total = filteredData.length || 1;
    
    return Object.entries(counts)
      .map(([name, value]) => ({ 
        name, 
        value, 
        percentual: ((value / total) * 100).toFixed(1).replace('.', ',') + '%' 
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredData]);

  // -- 5. Gráfico de Doenças / Agravo por Setor --
  const { doencasSetorData, setoresUnicos } = useMemo(() => {
    const dataMap: Record<string, Record<string, number>> = {};
    const setoresSet = new Set<string>();

    filteredData.forEach(item => {
      let doenca = item.DoencaAgravo?.trim().toUpperCase() || 'NÃO INFORMADA';
      if(doenca === '' || doenca === 'IGNORADO') doenca = 'NÃO INFORMADA';

      let setor = item.Setor?.trim().toUpperCase() || 'NÃO INFORMADO';
      if(setor === '' || setor === 'IGNORADO') setor = 'NÃO INFORMADO';

      setoresSet.add(setor);

      if(!dataMap[doenca]) {
        dataMap[doenca] = { total: 0 };
      }
      dataMap[doenca][setor] = (dataMap[doenca][setor] || 0) + 1;
      dataMap[doenca].total += 1;
    });

    const totalGeral = filteredData.length || 1;

    const DataArray = Object.entries(dataMap)
      .map(([name, counts]) => {
        const rowData: any = { name, ...counts };
        Object.keys(counts).forEach(k => {
          if(k !== 'total') {
            rowData[`${k}_percent`] = ((counts[k] / totalGeral) * 100).toFixed(1).replace('.', ',') + '%';
          }
        });
        return rowData;
      })
      .sort((a, b) => (b.total as number) - (a.total as number))
      .slice(0, 15); // limit length to top 15 diseases to avoid unreadable charts

    return { doencasSetorData: DataArray, setoresUnicos: Array.from(setoresSet).sort() };
  }, [filteredData]);

  // -- 6. Tabelas Detalhadas por Setor --
  const dataPorSetor = useMemo(() => {
    const map: Record<string, { total: number, doencas: Record<string, number> }> = {};
    const totalGeral = filteredData.length || 1;

    filteredData.forEach(item => {
      let setor = item.Setor?.trim().toUpperCase() || 'NÃO INFORMADO';
      if(setor === '' || setor === 'IGNORADO') setor = 'NÃO INFORMADO';
      
      let doenca = item.DoencaAgravo?.trim() || 'Não Informada';
      if(doenca.toUpperCase() === '' || doenca.toUpperCase() === 'IGNORADO') doenca = 'Não Informada';

      if (!map[setor]) map[setor] = { total: 0, doencas: {} };
      
      map[setor].total += 1;
      map[setor].doencas[doenca] = (map[setor].doencas[doenca] || 0) + 1;
    });

    return Object.entries(map).map(([setorName, data]) => {
       const doencasList = Object.entries(data.doencas)
         .map(([nome, qtd]) => {
           const percentual = ((qtd / totalGeral) * 100).toFixed(1).replace('.', ',') + '%';
           return { nome, qtd, percentual };
         })
         .sort((a, b) => b.qtd - a.qtd);

       // Formatando Setor ex: PRONTO ATENDIMENTO -> Pronto Atendimento
       const setorFormatado = setorName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');

       return {
         setor: setorFormatado,
         total: data.total,
         doencas: doencasList
       };
    }).sort((a, b) => a.setor.localeCompare(b.setor)); 
  }, [filteredData]);

  // Helper de clique de filtro
  const toggleSexoFilter = (sexo: string) => {
    setSelectedSexo(prev => prev === sexo ? null : sexo);
  };

  const setFiltroMesAtual = () => {
    const today = new Date();
    const first = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const last = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
    setDateFrom(first);
    setDateTo(last);
  };

  const dashboardRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportPDF = async () => {
    if (!dashboardRef.current) {
      alert("Erro: Referência do dashboard não encontrada.");
      return;
    }
    setIsExporting(true);
    try {
      // A biblioteca html-to-image usa o próprio navegador para desenhar a ref lidando perfeitamente com CSS moderno (Tawilwind oklab/oklch)
      const imgData = await toPng(dashboardRef.current, { 
        cacheBust: true,
        backgroundColor: '#ffffff',
        pixelRatio: 2
      });
      
      const elementWidth = dashboardRef.current.offsetWidth;
      const elementHeight = dashboardRef.current.offsetHeight;
      
      const margin = 40;
      const pdfWidth = elementWidth + (margin * 2);
      const pdfHeight = elementHeight + (margin * 2);
      
      // Criando PDF tamanho customizado em pixels para garantir a margem de 40px
      const customPdf = new jsPDF({
        orientation: 'p',
        unit: 'px',
        format: [pdfWidth, pdfHeight]
      });
      
      customPdf.addImage(imgData, 'PNG', margin, margin, elementWidth, elementHeight);
      
      // Abrir na nova tab do navegador em vez de baixar o arquivo obrigatoriamente
      const pdfUrl = customPdf.output('bloburl');
      window.open(pdfUrl, '_blank');
    } catch (e) {
      console.error('Erro ao gerar PDF:', e);
      alert('Erro inesperado ao gerar PDF: ' + (e as Error).message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 w-full px-[40px] max-w-none pb-12 pt-8"
      style={{ backgroundColor: 'var(--background)' }}
    >
      <div ref={dashboardRef} className="space-y-6 w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Estatísticas</h1>
          <p className="text-sm text-muted-foreground">Visão analítica dos registros epidemiológicos</p>
        </div>
      </div>
      
      {/* FILTERS */}
      <div className="bg-card text-card-foreground rounded-xl border border-border shadow-sm">
        <div className="p-4 flex flex-col sm:flex-row items-center gap-4">
          <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Período Selecionado:</span>
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto">
            <input
              type="date"
              className="flex h-10 w-full sm:w-40 rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&::-webkit-calendar-picker-indicator]:dark:invert"
              title="Data Inicial"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
            <span className="text-muted-foreground">até</span>
            <input
              type="date"
              className="flex h-10 w-full sm:w-40 rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&::-webkit-calendar-picker-indicator]:dark:invert"
              title="Data Final"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
            <button
              onClick={setFiltroMesAtual}
              className="ml-2 h-10 px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-sm font-semibold rounded-md border border-blue-500/20 transition-colors whitespace-nowrap"
            >
              Mês Atual
            </button>
            <button
              onClick={handleExportPDF}
              disabled={isExporting}
              className="ml-2 h-10 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm font-semibold rounded-md border border-emerald-500/20 transition-colors flex items-center gap-2 whitespace-nowrap disabled:opacity-50"
            >
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {isExporting ? 'Gerando...' : 'Exportar PDF'}
            </button>
          </div>
        </div>
      </div>

      {/* KPI CARDS */}
      {!loading && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div 
            className={`bg-card rounded-2xl border ${selectedSexo === null ? 'border-primary ring-2 ring-primary/20' : 'border-border'} shadow-md p-6 relative overflow-hidden flex flex-col justify-center cursor-pointer hover:border-primary transition-all`}
            onClick={() => setSelectedSexo(null)}
          >
            <div className="relative z-10 pointer-events-none">
              <p className="text-sm font-medium text-muted-foreground mb-1">Pacientes (Total)</p>
              <h3 className="text-4xl font-bold text-blue-500">{kpis.total}</h3>
            </div>
            <Users className={`absolute right-[-10px] top-[10px] w-28 h-28 pointer-events-none transition-all ${selectedSexo === null ? 'text-primary opacity-20' : 'text-muted-foreground opacity-10'}`} />
          </div>

          <div 
            className={`bg-card rounded-2xl border ${selectedSexo === 'MASCULINO' ? 'border-sky-400 ring-2 ring-sky-400/20' : 'border-border'} shadow-md p-6 relative overflow-hidden flex flex-col justify-center cursor-pointer hover:border-sky-400 transition-all`}
            onClick={() => toggleSexoFilter('MASCULINO')}
          >
            <div className="relative z-10 pointer-events-none">
              <p className="text-sm font-medium text-muted-foreground mb-1">Masculino</p>
              <h3 className="text-4xl font-bold text-sky-400">{kpis.masc}</h3>
            </div>
            <User className={`absolute right-[-10px] top-[10px] w-28 h-28 pointer-events-none transition-all ${selectedSexo === 'MASCULINO' ? 'text-sky-400 opacity-20' : 'text-muted-foreground opacity-10'}`} />
          </div>

          <div 
            className={`bg-card rounded-2xl border ${selectedSexo === 'FEMININO' ? 'border-pink-500 ring-2 ring-pink-500/20' : 'border-border'} shadow-md p-6 relative overflow-hidden flex flex-col justify-center cursor-pointer hover:border-pink-500 transition-all`}
            onClick={() => toggleSexoFilter('FEMININO')}
          >
            <div className="relative z-10 pointer-events-none">
              <p className="text-sm font-medium text-muted-foreground mb-1">Feminino</p>
              <h3 className="text-4xl font-bold text-pink-500">{kpis.fem}</h3>
            </div>
            <User className={`absolute right-[-10px] top-[10px] w-28 h-28 pointer-events-none transition-all ${selectedSexo === 'FEMININO' ? 'text-pink-500 opacity-20' : 'text-muted-foreground opacity-10'}`} />
          </div>
        </div>
      )}

      {/* GRÁFICOS */}
      {loading ? (
        <div className="bg-card text-card-foreground rounded-xl border border-border shadow-sm p-6 flex flex-col items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-sm text-muted-foreground">Carregando dados estatísticos...</p>
        </div>
      ) : data.length === 0 ? (
        <div className="bg-card text-card-foreground rounded-xl border border-border shadow-sm p-6 flex flex-col items-center justify-center min-h-[400px]">
          <p className="text-sm text-muted-foreground">Nenhum dado encontrado para o período selecionado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* GRÁFICO 1: FAIXA ETÁRIA */}
          <div className="bg-card text-card-foreground rounded-xl border border-border shadow-sm p-6 flex flex-col w-full">
            <div className="mb-6">
              <h2 className="text-lg font-semibold tracking-tight">Faixa Etária</h2>
              <p className="text-sm text-muted-foreground whitespace-nowrap">
                Variação de idades ({data.length} registros)
              </p>
            </div>
            
            <div className="h-[450px] w-full mt-auto">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={ageData}
                  margin={{ top: 5, right: 40, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} className="stroke-muted" />
                  <XAxis type="number" hide />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#ffffff', fontSize: 13 }}
                    width={140}
                  />
                  <Tooltip 
                    cursor={{fill: 'var(--muted)'}}
                    contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--card)', color: 'var(--card-foreground)'}}
                    formatter={(value: number) => [`${value} casos`, 'Quantidade']}
                  />
                  <Bar dataKey="value" fill="var(--color-primary, #b32624)" radius={[0, 4, 4, 0]} barSize={16}>
                    <LabelList 
                      dataKey="value" 
                      content={(props: any) => {
                        const { x, y, width, height, value, index } = props;
                        if (!value) return null;
                        return (
                          <text 
                            x={(x as number) + (width as number) + 8} 
                            y={(y as number) + (height as number) / 2} 
                            dy={4} 
                            className="fill-foreground text-xs font-semibold"
                          >
                            {value} ({ageData[index]?.percentual})
                          </text>
                        );
                      }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* GRÁFICO 2: COR / RAÇA */}
          <div className="bg-card text-card-foreground rounded-xl border border-border shadow-sm p-6 flex flex-col w-full items-center">
            <div className="mb-6 text-left w-full">
              <h2 className="text-lg font-semibold tracking-tight">Cor / Raça</h2>
              <p className="text-sm text-muted-foreground whitespace-nowrap">
                Distribuição demográfica por pele/etnia
              </p>
            </div>
            
            <div className="relative h-[320px] w-full flex justify-center items-center mb-6">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--card)', color: 'var(--card-foreground)'}}
                    formatter={(value: number, name: string, props: { payload: { percentual: string } }) => [
                      `${value} casos (${props.payload.percentual})`, name
                    ]}
                  />
                  <Pie
                    data={corRacaData}
                    cx="50%"
                    cy="50%"
                    outerRadius={140}
                    innerRadius={105}
                    paddingAngle={4}
                    cornerRadius={8}
                    fill="#8884d8"
                    dataKey="value"
                    stroke="none"
                  >
                    {corRacaData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>

              {/* TEXTO CENTRAL ABSOLUTO */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-5xl font-bold tracking-tighter text-foreground">
                  {corRacaData.length > 0 ? corRacaData[0].percentual.split(',')[0] : '0'}%
                </span>
                {corRacaData.length > 0 && (
                  <span className="text-sm text-muted-foreground mt-1 max-w-[120px] text-center uppercase truncate">
                    {corRacaData[0].name.replace('(O)', '')}
                  </span>
                )}
              </div>
            </div>
            
            {/* LEGENDA NO FORMATO GRID ABAIXO DO GRÁFICO */}
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 px-2 w-full">
              {corRacaData.map((item, idx) => (
                <div key={idx} className="flex items-center justify-start gap-2 p-2 rounded-lg hover:bg-muted/40 transition-colors">
                  <div 
                    className="w-3 h-3 rounded-full shrink-0" 
                    style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                  ></div>
                  <span className="text-sm font-medium tracking-tight text-foreground truncate max-w-[130px]" title={item.name}>
                    {item.name.replace('(O)', '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}
                  </span>
                  <div className="flex items-center gap-1 shrink-0 ml-1">
                    <span className="text-sm font-bold text-foreground">{item.value}</span>
                    <span className="text-xs font-semibold text-muted-foreground">({item.percentual})</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* GRÁFICO 3: ESCOLARIDADE */}
          <div className="bg-card text-card-foreground rounded-xl border border-border shadow-sm p-6 flex flex-col w-full">
            <div className="mb-6">
              <h2 className="text-lg font-semibold tracking-tight">Escolaridade</h2>
              <p className="text-sm text-muted-foreground whitespace-nowrap">
                Frequência e percentual
              </p>
            </div>
            
            <div className="h-[550px] w-full mt-auto">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={escolaridadeData}
                  margin={{ top: 5, right: 60, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} className="stroke-muted" />
                  <XAxis type="number" hide />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#ffffff', fontSize: 12 }}
                    width={180}
                  />
                  <Tooltip 
                    cursor={{fill: 'var(--muted)'}}
                    contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--card)', color: 'var(--card-foreground)'}}
                    formatter={(value: number, name: string, props: any) => [`${value} casos (${props.payload.percentual})`, 'Quantidade']}
                  />
                  <Bar dataKey="value" fill="#10b981" radius={[0, 4, 4, 0]} barSize={32}>
                    <LabelList 
                      dataKey="value" 
                      content={(props: any) => {
                        const { x, y, width, height, value, index } = props;
                        if (!value) return null;
                        return (
                          <text 
                            x={(x as number) + (width as number) + 8} 
                            y={(y as number) + (height as number) / 2} 
                            dy={4} 
                            className="fill-foreground text-xs font-semibold"
                          >
                            {value} ({escolaridadeData[index]?.percentual})
                          </text>
                        );
                      }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* GRÁFICO 4: SAÍDAS */}
          <div className="bg-card text-card-foreground rounded-xl border border-border shadow-sm p-6 flex flex-col w-full items-center">
            <div className="mb-6 text-left w-full">
              <h2 className="text-lg font-semibold tracking-tight">Saídas</h2>
              <p className="text-sm text-muted-foreground whitespace-nowrap">
                Tipos de alta e desfecho clínico
              </p>
            </div>
            
            <div className="relative h-[320px] w-full flex justify-center items-center mb-6 mt-auto">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--card)', color: 'var(--card-foreground)'}}
                    formatter={(value: number, name: string, props: { payload: { percentual: string } }) => [
                      `${value} casos (${props.payload.percentual})`, name
                    ]}
                  />
                  <Pie
                    data={saidasData}
                    cx="50%"
                    cy="50%"
                    outerRadius={140}
                    fill="#8884d8"
                    dataKey="value"
                    stroke="var(--card)"
                    strokeWidth={2}
                  >
                    {saidasData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[(index + 3) % COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            {/* LEGENDA NO FORMATO GRID ABAIXO DO GRÁFICO */}
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 px-2 w-full mb-auto">
              {saidasData.map((item, idx) => (
                <div key={idx} className="flex items-center justify-start gap-2 p-2 rounded-lg hover:bg-muted/40 transition-colors">
                  <div 
                    className="w-3 h-3 rounded-full shrink-0" 
                    style={{ backgroundColor: COLORS[(idx + 3) % COLORS.length] }}
                  ></div>
                  <span className="text-sm font-medium tracking-tight text-foreground truncate max-w-[130px]" title={item.name}>
                    {item.name.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}
                  </span>
                  <div className="flex items-center gap-1 shrink-0 ml-1">
                    <span className="text-sm font-bold text-foreground">{item.value}</span>
                    <span className="text-xs font-semibold text-muted-foreground">({item.percentual})</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* TABELAS POR SETOR */}
          <div className="bg-card text-card-foreground rounded-xl border border-border shadow-sm p-6 flex flex-col w-full h-full lg:col-span-1">
            <div className="mb-6">
              <h2 className="text-lg font-semibold tracking-tight">Detalhamento por Setor</h2>
              <p className="text-sm text-muted-foreground whitespace-nowrap">
                Casos consolidados informados em cada setor
              </p>
            </div>

            <div className="flex-1 space-y-6 pr-2">
              {dataPorSetor.map((setorData, idx) => (
                <div key={idx} className="border border-border rounded-lg overflow-hidden bg-card">
                  <div className="bg-muted/40 px-4 py-3 border-b border-border font-bold text-center text-foreground text-sm uppercase">
                    {setorData.setor} ({setorData.total})
                  </div>
                  <table className="w-full text-sm text-left">
                    <thead className="bg-[#f8fafc] dark:bg-muted/10 text-muted-foreground font-semibold">
                      <tr>
                        <th className="px-4 py-2 border-b border-border">Doenças / Agravo</th>
                        <th className="px-4 py-2 text-center w-20 border-b border-border">qtd.</th>
                        <th className="px-4 py-2 text-center w-28 border-b border-border">Percentual</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {setorData.doencas.map((d, i) => (
                        <tr key={i} className="hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-2.5 text-foreground leading-tight text-[13px]">{d.nome}</td>
                          <td className="px-4 py-2.5 text-center font-medium text-[13px]">{d.qtd}</td>
                          <td className="px-4 py-2.5 text-center text-muted-foreground text-[13px]">{d.percentual}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </div>

          {/* GRÁFICO 5: DOENÇAS / AGRAVO POR SETOR */}
          <div className="bg-card text-card-foreground rounded-xl border border-border shadow-sm p-6 flex flex-col w-full lg:col-span-1 h-fit">
            <div className="mb-6">
              <h2 className="text-lg font-semibold tracking-tight">Doenças / Agravos por Setor</h2>
              <p className="text-sm text-muted-foreground whitespace-nowrap">
                Frequência das principais doenças categorizada pelo setor do hospital
              </p>
            </div>
            
            <div className="w-full mt-auto" style={{ height: `${Math.max(doencasSetorData.length * 60 + 80, 200)}px` }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={doencasSetorData}
                  margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} className="stroke-muted" />
                  <XAxis type="number" hide />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#ffffff', fontSize: 11 }}
                    width={220}
                  />
                  <Tooltip 
                    cursor={{fill: 'var(--muted)'}}
                    contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--card)', color: 'var(--card-foreground)'}}
                  />
                  <Legend wrapperStyle={{ paddingTop: '10px' }} />
                  {setoresUnicos.map((setor, index) => (
                    <Bar 
                      key={setor} 
                      dataKey={setor} 
                      name={setor}
                      stackId="a" 
                      fill={COLORS[index % COLORS.length]} 
                      barSize={36}
                      radius={[0, 4, 4, 0]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      )}
      </div>
    </motion.div>
  );
}
