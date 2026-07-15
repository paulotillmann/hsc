import React, { useState, useEffect, useMemo } from 'react';
import { 
  Activity, 
  Calendar, 
  Download, 
  RefreshCw, 
  Search, 
  AlertCircle, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  UserCheck, 
  ShieldAlert, 
  FileText, 
  ChevronLeft, 
  ChevronRight,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from 'recharts';
import { webhookService } from '../../services/webhookService';

// Interfaces
interface IndicadorOption {
  id: string;
  name: string;
  icon: any;
  meta: string;
  unidade: string;
  descricao: string;
}

const INDICADORES: IndicadorOption[] = [
  { 
    id: 'quedas', 
    name: 'Quedas de Pacientes', 
    icon: ShieldAlert, 
    meta: '< 2 por 1000 pac-dia', 
    unidade: 'ocorrências',
    descricao: 'Monitoramento do número total de quedas registradas de pacientes nas dependências da instituição por unidade.' 
  },
  { 
    id: 'reinternacoes', 
    name: 'Reinternações (30 dias)', 
    icon: RefreshCw, 
    meta: '< 10%', 
    unidade: '% de reinternações',
    descricao: 'Pacientes que reinternaram na instituição no período de até 30 dias após a alta da internação anterior.' 
  },
  { 
    id: 'mortalidade', 
    name: 'Taxa de Mortalidade', 
    icon: Activity, 
    meta: '< 3.5%', 
    unidade: '% óbitos',
    descricao: 'Percentual de óbitos ocorridos em relação ao total de saídas da internação (altas + óbitos).' 
  },
  { 
    id: 'tempo_espera', 
    name: 'Tempo de Espera (P.A.)', 
    icon: Clock, 
    meta: '< 45 minutos', 
    unidade: 'minutos',
    descricao: 'Média de tempo decorrido desde a abertura da ficha na recepção até o início da consulta médica.' 
  },
  { 
    id: 'infeccao_hospitalar', 
    name: 'Infecção Hospitalar (IRAS)', 
    icon: AlertCircle, 
    meta: '< 1.2%', 
    unidade: '% infecções',
    descricao: 'Índice de infecções relacionadas à assistência à saúde registradas pelo CCIH nas unidades críticas.' 
  },
  { 
    id: 'cirurgias_canceladas', 
    name: 'Cancelamento Cirúrgico', 
    icon: FileText, 
    meta: '< 2.5%', 
    unidade: '% cancelamentos',
    descricao: 'Métrica de cirurgias suspensas/canceladas em relação ao total de cirurgias agendadas no bloco.' 
  },
  { 
    id: 'satisfacao_paciente', 
    name: 'Satisfação do Paciente (NPS)', 
    icon: UserCheck, 
    meta: '> 75 NPS', 
    unidade: 'Score NPS',
    descricao: 'Indicador Net Promoter Score medido nas pesquisas de opinião pós-alta.' 
  },
  { 
    id: 'tempo_permanencia', 
    name: 'Tempo Médio de Permanência', 
    icon: Calendar, 
    meta: '< 5.5 dias', 
    unidade: 'dias',
    descricao: 'Média de dias que os pacientes permanecem internados na instituição por especialidade.' 
  }
];

// Dados simulados para Fallback (Mock) caso o webhook do n8n não retorne dados
const MOCK_DATA: Record<string, any[]> = {
  quedas: [
    { data: '2026-07-01', setor: 'U.T.I Adulto', paciente: 'M.A.S', idade: 68, grau_risco: 'Alto', total: 1 },
    { data: '2026-07-03', setor: 'Clínica Médica', paciente: 'J.R.F', idade: 74, grau_risco: 'Alto', total: 1 },
    { data: '2026-07-06', setor: 'Clínica Cirúrgica', paciente: 'A.L.M', idade: 59, grau_risco: 'Médio', total: 1 },
    { data: '2026-07-09', setor: 'Pediatria', paciente: 'G.V.S', idade: 4, grau_risco: 'Baixo', total: 1 },
    { data: '2026-07-12', setor: 'U.T.I Neonatal', paciente: 'R.C.D', idade: 0, grau_risco: 'Médio', total: 1 },
    { data: '2026-07-14', setor: 'Clínica Médica', paciente: 'E.J.N', idade: 81, grau_risco: 'Alto', total: 1 }
  ],
  reinternacoes: [
    { data: '2026-07-02', setor: 'Cardiologia', paciente: 'W.P.A', dias_apos_alta: 12, motivo: 'Descompensação de I.C.C', taxa: 8.5 },
    { data: '2026-07-05', setor: 'Ortopedia', paciente: 'F.B.G', dias_apos_alta: 21, motivo: 'Dor e Suspeita de Infecção de Sítio', taxa: 9.1 },
    { data: '2026-07-07', setor: 'Clínica Médica', paciente: 'M.Z.T', dias_apos_alta: 8, motivo: 'Nova crise respiratória (D.P.O.C)', taxa: 9.8 },
    { data: '2026-07-10', setor: 'Neurologia', paciente: 'T.H.R', dias_apos_alta: 18, motivo: 'Crise Convulsiva Pós-operatória', taxa: 10.2 },
    { data: '2026-07-13', setor: 'Cardiologia', paciente: 'K.D.S', dias_apos_alta: 14, motivo: 'Arritmia Cardíaca Recorrente', taxa: 9.4 }
  ],
  mortalidade: [
    { data: '2026-07-01', setor: 'U.T.I Coronariana', obitos: 2, altas: 45, taxa: 4.2 },
    { data: '2026-07-04', setor: 'U.T.I Adulto', obitos: 3, altas: 58, taxa: 4.9 },
    { data: '2026-07-08', setor: 'Pronto Socorro', obitos: 1, altas: 154, taxa: 0.6 },
    { data: '2026-07-11', setor: 'Clínica Médica', obitos: 2, altas: 92, taxa: 2.1 },
    { data: '2026-07-13', setor: 'U.T.I Adulto', obitos: 1, altas: 41, taxa: 2.3 }
  ],
  tempo_espera: [
    { data: '2026-07-01', setor: 'Clínica Médica', pacientes_atendidos: 120, tempo_medio: 32 },
    { data: '2026-07-03', setor: 'Pediatria', pacientes_atendidos: 85, tempo_medio: 22 },
    { data: '2026-07-06', setor: 'Ortopedia', pacientes_atendidos: 45, tempo_medio: 55 },
    { data: '2026-07-09', setor: 'Clínica Médica', pacientes_atendidos: 140, tempo_medio: 48 },
    { data: '2026-07-12', setor: 'Triagem Rápida', pacientes_atendidos: 210, tempo_medio: 15 },
    { data: '2026-07-14', setor: 'Clínica Médica', pacientes_atendidos: 130, tempo_medio: 38 }
  ],
  infeccao_hospitalar: [
    { data: '2026-07-01', setor: 'U.T.I Adulto', sitio: 'Trato Urinário (SVD)', germe: 'K. pneumoniae KPC', taxa: 1.4 },
    { data: '2026-07-04', setor: 'C.C.I.H', sitio: 'Corrente Sanguínea (CVC)', germe: 'S. aureus MRSA', taxa: 1.1 },
    { data: '2026-07-07', setor: 'Clínica Cirúrgica', sitio: 'Sítio Cirúrgico Profundo', germe: 'E. coli ESBL', taxa: 1.3 },
    { data: '2026-07-11', setor: 'U.T.I Adulto', sitio: 'Pneumonia (PAV)', germe: 'P. aeruginosa', taxa: 1.5 },
    { data: '2026-07-14', setor: 'U.T.I Neonatal', sitio: 'Corrente Sanguínea', germe: 'S. epidermidis', taxa: 1.2 }
  ],
  cirurgias_canceladas: [
    { data: '2026-07-02', setor: 'Ortopedia', motivo: 'Falta de material cirúrgico específico', cirurgiao: 'Dr. R. Lima', taxa: 2.1 },
    { data: '2026-07-05', setor: 'Cardiologia', motivo: 'Instabilidade clínica do paciente', cirurgiao: 'Dra. M. Souza', taxa: 1.8 },
    { data: '2026-07-08', setor: 'Geral', motivo: 'Estouro de tempo cirúrgico anterior', cirurgiao: 'Dr. J. Silva', taxa: 2.4 },
    { data: '2026-07-11', setor: 'Neurologia', motivo: 'Falta de leito de U.T.I pós-operatório', cirurgiao: 'Dr. A. Costa', taxa: 2.9 },
    { data: '2026-07-13', setor: 'Geral', motivo: 'Desistência do paciente', cirurgiao: 'Dr. P. Ramos', taxa: 2.2 }
  ],
  satisfacao_paciente: [
    { data: '2026-07-01', setor: 'Internação Geral', respondentes: 150, promotores: 120, detratores: 10, score: 73.3 },
    { data: '2026-07-05', setor: 'Pronto Atendimento', respondentes: 320, promotores: 240, detratores: 35, score: 64.0 },
    { data: '2026-07-09', setor: 'Maternidade', respondentes: 95, promotores: 88, detratores: 2, score: 90.5 },
    { data: '2026-07-12', setor: 'Internação Geral', respondentes: 140, promotores: 115, detratores: 8, score: 76.4 },
    { data: '2026-07-14', setor: 'Ambulatório', respondentes: 180, promotores: 160, detratores: 5, score: 86.1 }
  ],
  tempo_permanencia: [
    { data: '2026-07-01', setor: 'Clínica Médica', pacientes_saida: 84, dias_totais: 462, media_dias: 5.5 },
    { data: '2026-07-04', setor: 'Ortopedia', pacientes_saida: 52, dias_totais: 208, media_dias: 4.0 },
    { data: '2026-07-08', setor: 'U.T.I Adulto', pacientes_saida: 24, dias_totais: 288, media_dias: 12.0 },
    { data: '2026-07-11', setor: 'Clínica Cirúrgica', pacientes_saida: 98, dias_totais: 313, media_dias: 3.2 },
    { data: '2026-07-14', testor: 'Pediatria', pacientes_saida: 45, dias_totais: 148, media_dias: 3.3 }
  ]
};

export default function Qualidade() {
  // Obter datas do mês corrente para inicializar filtros
  const today = new Date().toISOString().split('T')[0];
  const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

  // Estados dos filtros
  const [indicadorId, setIndicadorId] = useState<string>('quedas');
  const [dataInicio, setDataInicio] = useState<string>(firstDayOfMonth);
  const [dataFim, setDataFim] = useState<string>(today);
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // Estados de dados e carregamento
  const [loading, setLoading] = useState<boolean>(false);
  const [usingMock, setUsingMock] = useState<boolean>(false);
  const [dados, setDados] = useState<any[]>([]);

  // Tabela Paginação
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 8;

  // Obter detalhes do indicador ativo
  const indicadorAtivo = useMemo(() => {
    return INDICADORES.find(i => i.id === indicadorId) || INDICADORES[0];
  }, [indicadorId]);

  // Função para buscar dados da API/Webhook
  const carregarIndicadores = async (forcarSinc: boolean = false) => {
    setLoading(true);
    setUsingMock(false);
    setCurrentPage(1);
    
    try {
      const response = await webhookService.fetchIndicadoresQualidade({
        indicador: indicadorId,
        data_inicio: dataInicio,
        data_fim: dataFim
      });
      
      if (response && response.length > 0) {
        setDados(response);
      } else {
        // Se a resposta for vazia e não for sincronização manual forçada, usa Mock correspondente
        setDados(MOCK_DATA[indicadorId] || []);
        setUsingMock(true);
      }
    } catch (error) {
      console.error('Erro ao carregar dados do n8n:', error);
      setDados(MOCK_DATA[indicadorId] || []);
      setUsingMock(true);
    } finally {
      setLoading(false);
    }
  };

  // Carrega ao mudar filtros ou indicador
  useEffect(() => {
    carregarIndicadores();
  }, [indicadorId, dataInicio, dataFim]);

  // Filtra dados da tabela por termo de pesquisa
  const filteredDados = useMemo(() => {
    if (!searchTerm.trim()) return dados;
    const term = searchTerm.toLowerCase();
    
    return dados.filter(item => {
      return Object.entries(item).some(([key, val]) => {
        if (val === null || val === undefined) return false;
        return String(val).toLowerCase().includes(term);
      });
    });
  }, [dados, searchTerm]);

  // Paginação
  const paginatedDados = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredDados.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredDados, currentPage]);

  const totalPages = Math.ceil(filteredDados.length / itemsPerPage) || 1;

  // Cálculos dinâmicos de Métricas de KPI
  const kpis = useMemo(() => {
    if (dados.length === 0) return { principal: 0, secundario: 'N/A', tendência: 'estavel' };

    let totalNumerico = 0;
    let principal = 0;
    let secundario = '';
    let tendencia: 'alta' | 'baixa' | 'estavel' = 'estavel';

    // Formatações customizadas por indicador
    switch (indicadorId) {
      case 'quedas':
        principal = dados.reduce((acc, curr) => acc + (curr.total || 0), 0);
        secundario = `${(principal / 15).toFixed(1)} p/ 1000 pac-dia`; // Estimativa fictícia
        tendencia = principal > 4 ? 'alta' : 'baixa';
        break;
      case 'reinternacoes':
        const somaTaxa = dados.reduce((acc, curr) => acc + (curr.taxa || 0), 0);
        principal = Number((somaTaxa / dados.length).toFixed(1));
        secundario = `Meta ${indicadorAtivo.meta}`;
        tendencia = principal > 10 ? 'alta' : 'baixa';
        break;
      case 'mortalidade':
        const somaMort = dados.reduce((acc, curr) => acc + (curr.taxa || 0), 0);
        principal = Number((somaMort / dados.length).toFixed(2));
        secundario = `Óbitos totais: ${dados.reduce((acc, curr) => acc + (curr.obitos || 0), 0)}`;
        tendencia = principal > 3.5 ? 'alta' : 'baixa';
        break;
      case 'tempo_espera':
        const somaEspera = dados.reduce((acc, curr) => acc + (curr.tempo_medio || 0), 0);
        principal = Math.round(somaEspera / dados.length);
        secundario = `Meta ${indicadorAtivo.meta}`;
        tendencia = principal > 45 ? 'alta' : 'baixa';
        break;
      case 'infeccao_hospitalar':
        const somaInfeccao = dados.reduce((acc, curr) => acc + (curr.taxa || 0), 0);
        principal = Number((somaInfeccao / dados.length).toFixed(2));
        secundario = `Meta ${indicadorAtivo.meta}`;
        tendencia = principal > 1.2 ? 'alta' : 'baixa';
        break;
      case 'cirurgias_canceladas':
        const somaCanc = dados.reduce((acc, curr) => acc + (curr.taxa || 0), 0);
        principal = Number((somaCanc / dados.length).toFixed(2));
        secundario = `Meta ${indicadorAtivo.meta}`;
        tendencia = principal > 2.5 ? 'alta' : 'baixa';
        break;
      case 'satisfacao_paciente':
        const somaNPS = dados.reduce((acc, curr) => acc + (curr.score || 0), 0);
        principal = Math.round(somaNPS / dados.length);
        secundario = `Total Respondentes: ${dados.reduce((acc, curr) => acc + (curr.respondentes || 0), 0)}`;
        tendencia = principal >= 75 ? 'baixa' : 'alta'; // Em NPS, estar acima é bom (baixa tendência de risco)
        break;
      case 'tempo_permanencia':
        const somaPermanencia = dados.reduce((acc, curr) => acc + (curr.media_dias || 0), 0);
        principal = Number((somaPermanencia / dados.length).toFixed(1));
        secundario = `Meta ${indicadorAtivo.meta}`;
        tendencia = principal > 5.5 ? 'alta' : 'baixa';
        break;
      default:
        principal = dados.length;
        secundario = 'Registros';
    }

    return { principal, secundario, tendencia };
  }, [dados, indicadorId, indicadorAtivo]);

  // Exportar dados da tabela para CSV
  const exportarCSV = () => {
    if (dados.length === 0) return;
    
    // Pegar cabeçalhos dinamicamente
    const headers = Object.keys(dados[0]);
    const csvRows = [];
    
    // Cabeçalho
    csvRows.push(headers.join(';'));
    
    // Linhas
    for (const row of dados) {
      const values = headers.map(header => {
        const escaped = ('' + row[header]).replace(/"/g, '\\"');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(';'));
    }
    
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + csvRows.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `indicador_${indicadorId}_hsc_${today}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Nomes de chaves das tabelas mais bonitos
  const getHeaderLabel = (key: string): string => {
    const labels: Record<string, string> = {
      data: 'Data',
      setor: 'Setor / Especialidade',
      paciente: 'Paciente',
      idade: 'Idade',
      grau_risco: 'Risco Queda',
      total: 'Quedas',
      dias_apos_alta: 'Dias Pós-Alta',
      motivo: 'Motivo / Causa',
      taxa: 'Taxa (%)',
      obitos: 'Óbitos',
      altas: 'Altas',
      pacientes_atendidos: 'Atendidos',
      tempo_medio: 'Tempo Médio (m)',
      sitio: 'Sítio Infeccioso',
      germe: 'Microrganismo',
      cirurgiao: 'Cirurgião',
      respondentes: 'Amostra (Pesquisa)',
      promotores: 'Promotores',
      detratores: 'Detratores',
      score: 'Score NPS',
      pacientes_saida: 'Saídas',
      dias_totais: 'Dias Acumulados',
      media_dias: 'Permanência Média (d)'
    };
    return labels[key] || key.charAt(0).toUpperCase() + key.slice(1);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card border p-6 rounded-xl shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 text-primary rounded-xl">
            <Activity className="h-8 w-8 animate-pulse" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Gestão da Qualidade</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Dashboard integrado de indicadores de performance e segurança do paciente da Santa Casa (Tasy).
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={() => carregarIndicadores(true)}
            disabled={loading}
            className="flex items-center justify-center gap-2 px-4 py-2 text-sm bg-muted text-foreground hover:bg-muted/80 border rounded-lg transition-colors w-full md:w-auto disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Sincronizar Tasy
          </button>
          
          <button
            onClick={exportarCSV}
            disabled={dados.length === 0}
            className="flex items-center justify-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg shadow-sm transition-colors w-full md:w-auto disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Grid de Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-card border p-4 rounded-xl shadow-sm">
        
        {/* Seletor de Indicador */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-muted-foreground">Indicador Hospitalar</label>
          <div className="relative">
            <select
              value={indicadorId}
              onChange={(e) => setIndicadorId(e.target.value)}
              className="w-full pl-3 pr-10 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer"
            >
              {INDICADORES.map(ind => (
                <option key={ind.id} value={ind.id}>{ind.name}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground">
              <Activity className="h-4 w-4" />
            </div>
          </div>
        </div>

        {/* Data Início */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-muted-foreground">Período - Início</label>
          <div className="relative">
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="w-full pl-10 pr-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
            />
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground pointer-events-none">
              <Calendar className="h-4 w-4" />
            </div>
          </div>
        </div>

        {/* Data Fim */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-muted-foreground">Período - Fim</label>
          <div className="relative">
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="w-full pl-10 pr-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
            />
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground pointer-events-none">
              <Calendar className="h-4 w-4" />
            </div>
          </div>
        </div>

      </div>

      {/* Caixa Informativa do Indicador Ativo */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex gap-3 items-start">
        <Info className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="font-semibold text-sm text-primary">{indicadorAtivo.name}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{indicadorAtivo.descricao}</p>
        </div>
      </div>

      {/* Grid de Informação Principal: KPIs & Gráfico */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Lado Esquerdo: KPIs */}
        <div className="flex flex-col gap-4">
          
          {/* Card Principal */}
          <div className="bg-card border p-6 rounded-xl shadow-sm flex flex-col justify-between h-[160px] relative overflow-hidden">
            <div className="z-10">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Métrica Consolidada</span>
              <h2 className="text-4xl font-extrabold mt-2 tracking-tight">
                {kpis.principal}
                <span className="text-sm font-medium text-muted-foreground ml-1">
                  {indicadorAtivo.unidade}
                </span>
              </h2>
            </div>
            
            <div className="flex items-center justify-between border-t pt-4 z-10">
              <span className="text-xs text-muted-foreground font-medium">{kpis.secundario}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${
                kpis.tendencia === 'baixa' 
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
              }`}>
                {kpis.tendencia === 'baixa' ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                {kpis.tendencia === 'baixa' ? 'Sob Controle' : 'Alerta de Risco'}
              </span>
            </div>

            {/* Fundo Decorativo */}
            <div className="absolute -right-6 -top-6 text-muted-foreground/5 pointer-events-none transform rotate-12">
              {React.createElement(indicadorAtivo.icon, { size: 120 })}
            </div>
          </div>

          {/* Card Meta */}
          <div className="bg-card border p-6 rounded-xl shadow-sm flex flex-col justify-between h-[130px]">
            <div>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Meta Institucional</span>
              <h3 className="text-lg font-bold mt-2 text-foreground flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-primary" />
                {indicadorAtivo.meta}
              </h3>
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Meta estabelecida pelo setor de Qualidade e Segurança para o ano corrente.
            </p>
          </div>

          {/* Aviso Mock fallback */}
          {usingMock && (
            <div className="bg-amber-500/5 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl p-4 text-xs space-y-1">
              <p className="font-semibold flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                Modo Demonstrativo (Mock)
              </p>
              <p className="text-muted-foreground leading-normal">
                Não conseguimos puxar os dados reais da API/Webhook de qualidade no momento. Exibindo dados simulados.
              </p>
            </div>
          )}

        </div>

        {/* Lado Direito: Gráfico de Linha/Área ou Barras */}
        <div className="lg:col-span-2 bg-card border p-6 rounded-xl shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm font-semibold">Tendência Histórica no Período</span>
            <span className="text-xs text-muted-foreground">Evolução por Ocorrência</span>
          </div>

          <div className="h-[230px] w-full">
            {loading ? (
              <div className="h-full w-full flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : dados.length === 0 ? (
              <div className="h-full w-full flex flex-col items-center justify-center text-muted-foreground gap-2">
                <ShieldAlert className="h-8 w-8 opacity-45" />
                <span className="text-sm">Nenhum dado para o período selecionado.</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                {/* Escolhe gráfico baseado no indicador para melhor apresentação */}
                {['tempo_espera', 'mortalidade', 'reinternacoes', 'satisfacao_paciente'].includes(indicadorId) ? (
                  <AreaChart data={dados} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-primary, #0f172a)" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="var(--color-primary, #0f172a)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/40" />
                    <XAxis 
                      dataKey="data" 
                      tickFormatter={(str) => {
                        try {
                          const parts = str.split('-');
                          return `${parts[2]}/${parts[1]}`;
                        } catch {
                          return str;
                        }
                      }}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                      labelStyle={{ fontWeight: 'bold', fontSize: 12 }}
                      itemStyle={{ fontSize: 12 }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey={indicadorId === 'tempo_espera' ? 'tempo_medio' : (indicadorId === 'satisfacao_paciente' ? 'score' : 'taxa')} 
                      name={indicadorAtivo.name} 
                      stroke="hsl(var(--primary))" 
                      fillOpacity={1} 
                      fill="url(#colorValue)" 
                      strokeWidth={2}
                    />
                  </AreaChart>
                ) : (
                  <BarChart data={dados} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/40" />
                    <XAxis 
                      dataKey="data" 
                      tickFormatter={(str) => {
                        try {
                          const parts = str.split('-');
                          return `${parts[2]}/${parts[1]}`;
                        } catch {
                          return str;
                        }
                      }}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                      labelStyle={{ fontWeight: 'bold', fontSize: 12 }}
                      itemStyle={{ fontSize: 12 }}
                    />
                    <Bar 
                      dataKey={indicadorId === 'quedas' ? 'total' : (indicadorId === 'tempo_permanencia' ? 'media_dias' : 'taxa')} 
                      name={indicadorAtivo.name} 
                      fill="hsl(var(--primary))" 
                      radius={[4, 4, 0, 0]} 
                    />
                  </BarChart>
                )}
              </ResponsiveContainer>
            )}
          </div>
        </div>

      </div>

      {/* Tabela Detalhada com Colunas Dinâmicas */}
      <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
        
        {/* Cabeçalho da Tabela */}
        <div className="p-5 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="font-bold text-base">Registros Detalhados</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Auditoria e listagem de eventos vinculados ao indicador selecionado.</p>
          </div>

          {/* Campo de Pesquisa */}
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="Buscar registros..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground pointer-events-none">
              <Search className="h-4 w-4" />
            </div>
          </div>
        </div>

        {/* Tabela Responsiva */}
        <div className="overflow-x-auto w-full">
          {loading ? (
            <div className="p-12 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredDados.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-2">
              <ShieldAlert className="h-8 w-8 opacity-45" />
              <span>Nenhum registro encontrado para a pesquisa.</span>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-muted/40 border-b">
                  {Object.keys(dados[0]).map((key) => (
                    <th key={key} className="p-4 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                      {getHeaderLabel(key)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {paginatedDados.map((row, idx) => (
                  <tr key={idx} className="hover:bg-muted/10 transition-colors">
                    {Object.entries(row).map(([key, val], subIdx) => (
                      <td key={subIdx} className="p-4">
                        {key === 'data' ? (
                          <span className="font-medium text-foreground">
                            {(() => {
                              try {
                                const parts = String(val).split('-');
                                return `${parts[2]}/${parts[1]}/${parts[0]}`;
                              } catch {
                                return String(val);
                              }
                            })()}
                          </span>
                        ) : key === 'taxa' ? (
                          <span className="font-semibold text-primary">{(val as any)}%</span>
                        ) : key === 'grau_risco' ? (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            val === 'Alto' ? 'bg-rose-500/10 text-rose-500' :
                            val === 'Médio' ? 'bg-amber-500/10 text-amber-500' :
                            'bg-emerald-500/10 text-emerald-500'
                          }`}>
                            {String(val)}
                          </span>
                        ) : (
                          String(val ?? '-')
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Paginação da Tabela */}
        {filteredDados.length > itemsPerPage && (
          <div className="p-4 border-t flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Mostrando {Math.min(filteredDados.length, (currentPage - 1) * itemsPerPage + 1)} a {Math.min(filteredDados.length, currentPage * itemsPerPage)} de {filteredDados.length} registros
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-1.5 bg-background border rounded-md hover:bg-muted transition-colors disabled:opacity-50 disabled:hover:bg-background"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs font-medium flex items-center px-2">
                Página {currentPage} de {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-1.5 bg-background border rounded-md hover:bg-muted transition-colors disabled:opacity-50 disabled:hover:bg-background"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

      </div>

    </div>
  );
}
