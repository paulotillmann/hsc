import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  TrendingUp,
  RefreshCw,
  FileSpreadsheet,
  FileText,
  Calendar,
  Search,
  Building2,
  ShieldCheck,
  Award,
  PieChart as PieIcon,
  BarChart3,
  Layers,
  ArrowUpDown,
  X,
  Sparkles,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  Wallet,
  Activity
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  Legend
} from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  atendimentosService,
  ConvenioResumo,
  AtendimentosDiretoriaResponse
} from '../../../services/atendimentosService';

type PeriodoPredefinido = 'hoje' | '7d' | '15d' | '30d' | 'mes_atual' | 'ano_atual' | 'custom';
type CategoriaFiltro = 'todos' | 'SUS' | 'Privado' | 'Particular';

const CORES_PALETA = [
  '#2563eb', // Blue
  '#10b981', // Emerald
  '#8b5cf6', // Violet
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#f97316', // Orange
  '#6366f1', // Indigo
  '#14b8a6', // Teal
  '#64748b'  // Slate
];

export default function AtendimentosDiretoria() {
  // ── Estados de Dados ──────────────────────────────────────────────────────
  const [dados, setDados] = useState<AtendimentosDiretoriaResponse | null>(null);
  const [carregando, setCarregando] = useState<boolean>(true);

  // ── Estados de Filtros ────────────────────────────────────────────────────
  const [periodo, setPeriodo] = useState<PeriodoPredefinido>('30d');
  const [dataInicio, setDataInicio] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [dataFim, setDataFim] = useState<string>(() => new Date().toISOString().split('T')[0]);

  const [busca, setBusca] = useState<string>('');
  const [categoriaFiltro, setCategoriaFiltro] = useState<CategoriaFiltro>('todos');
  const [setorFiltro, setSetorFiltro] = useState<string>('0');
  const [tipoFiltro, setTipoFiltro] = useState<string>('0');
  const [clinicaFiltro, setClinicaFiltro] = useState<string>('0');

  // ── Estados de Ordenação e Paginação ──────────────────────────────────────
  const [ordenarPor, setOrdenarPor] = useState<keyof ConvenioResumo>('qtde');
  const [ordemAscendente, setOrdemAscendente] = useState<boolean>(false);
  const [paginaAtual, setPaginaAtual] = useState<number>(1);
  const [itensPorPagina, setItensPorPagina] = useState<number>(15);

  // ── Carregar Dados do Webhook ─────────────────────────────────────────────
  const carregarDados = useCallback(async () => {
    setCarregando(true);
    try {
      const res = await atendimentosService.buscarAtendimentos({
        dtInicio: dataInicio,
        dtFim: dataFim,
        setor: setorFiltro !== '0' ? setorFiltro : undefined,
        tipoAtendimento: tipoFiltro !== '0' ? tipoFiltro : undefined,
        clinica: clinicaFiltro !== '0' ? clinicaFiltro : undefined
      });
      setDados(res);
    } catch (err) {
      console.error('Erro ao consultar atendimentos da diretoria:', err);
    } finally {
      setCarregando(false);
    }
  }, [dataInicio, dataFim, setorFiltro, tipoFiltro, clinicaFiltro]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  // ── Atualização do Período Rápido ─────────────────────────────────────────
  const handleMudarPeriodo = (tipo: PeriodoPredefinido) => {
    setPeriodo(tipo);
    const hoje = new Date();
    const hojeStr = hoje.toISOString().split('T')[0];

    if (tipo === 'hoje') {
      setDataInicio(hojeStr);
      setDataFim(hojeStr);
    } else if (tipo === '7d') {
      const d = new Date();
      d.setDate(hoje.getDate() - 7);
      setDataInicio(d.toISOString().split('T')[0]);
      setDataFim(hojeStr);
    } else if (tipo === '15d') {
      const d = new Date();
      d.setDate(hoje.getDate() - 15);
      setDataInicio(d.toISOString().split('T')[0]);
      setDataFim(hojeStr);
    } else if (tipo === '30d') {
      const d = new Date();
      d.setDate(hoje.getDate() - 30);
      setDataInicio(d.toISOString().split('T')[0]);
      setDataFim(hojeStr);
    } else if (tipo === 'mes_atual') {
      const d = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      setDataInicio(d.toISOString().split('T')[0]);
      setDataFim(hojeStr);
    } else if (tipo === 'ano_atual') {
      const d = new Date(hoje.getFullYear(), 0, 1);
      setDataInicio(d.toISOString().split('T')[0]);
      setDataFim(hojeStr);
    }
  };

  // ── Filtragem em Memória ──────────────────────────────────────────────────
  const listaConvenios = useMemo(() => {
    if (!dados?.convenios) return [];
    return dados.convenios;
  }, [dados]);

  const conveniosFiltrados = useMemo(() => {
    return listaConvenios.filter(c => {
      // Filtro de Busca
      if (busca.trim()) {
        const query = busca.toLowerCase().trim();
        if (!c.dsConvenio.toLowerCase().includes(query)) {
          return false;
        }
      }

      // Filtro de Categoria
      if (categoriaFiltro !== 'todos' && c.categoria !== categoriaFiltro) {
        return false;
      }

      return true;
    });
  }, [listaConvenios, busca, categoriaFiltro]);

  // ── Ordenação e Paginação ─────────────────────────────────────────────────
  const conveniosOrdenados = useMemo(() => {
    return [...conveniosFiltrados].sort((a, b) => {
      let vA = a[ordenarPor];
      let vB = b[ordenarPor];

      if (typeof vA === 'string') {
        vA = vA.toLowerCase();
        vB = (vB as string).toLowerCase();
      }

      if (vA < vB) return ordemAscendente ? -1 : 1;
      if (vA > vB) return ordemAscendente ? 1 : -1;
      return 0;
    });
  }, [conveniosFiltrados, ordenarPor, ordemAscendente]);

  const totalPaginas = Math.ceil(conveniosOrdenados.length / itensPorPagina) || 1;
  const conveniosPaginados = useMemo(() => {
    const inicio = (paginaAtual - 1) * itensPorPagina;
    return conveniosOrdenados.slice(inicio, inicio + itensPorPagina);
  }, [conveniosOrdenados, paginaAtual, itensPorPagina]);

  const alternarOrdenacao = (coluna: keyof ConvenioResumo) => {
    if (ordenarPor === coluna) {
      setOrdemAscendente(!ordemAscendente);
    } else {
      setOrdenarPor(coluna);
      setOrdemAscendente(true);
    }
  };

  // ── Dados para Gráficos ───────────────────────────────────────────────────

  // Top 10 Convênios para o Gráfico de Barras Horizontal
  const dadosTopBarras = useMemo(() => {
    return listaConvenios.slice(0, 10).map(c => ({
      name: c.dsConvenio.length > 22 ? `${c.dsConvenio.substring(0, 20)}...` : c.dsConvenio,
      nomeCompleto: c.dsConvenio,
      qtde: c.qtde,
      percentual: c.percentual,
      categoria: c.categoria
    }));
  }, [listaConvenios]);

  // Distribuição de Market Share para o Gráfico Donut (Top 5 + Outros)
  const dadosDonutShare = useMemo(() => {
    if (listaConvenios.length === 0) return [];
    const top5 = listaConvenios.slice(0, 5);
    const outrosQtde = listaConvenios.slice(5).reduce((acc, c) => acc + c.qtde, 0);

    const resultado = top5.map(c => ({
      name: c.dsConvenio.length > 18 ? `${c.dsConvenio.substring(0, 16)}...` : c.dsConvenio,
      nomeCompleto: c.dsConvenio,
      value: c.qtde,
      percentual: c.percentual
    }));

    if (outrosQtde > 0) {
      const totalGeral = dados?.totalGeral || 1;
      resultado.push({
        name: 'Demais Convênios',
        nomeCompleto: 'Demais Convênios Agrupados',
        value: outrosQtde,
        percentual: Number(((outrosQtde / totalGeral) * 100).toFixed(2))
      });
    }

    return resultado;
  }, [listaConvenios, dados?.totalGeral]);

  // ── Exportações (CSV e PDF) ───────────────────────────────────────────────
  const exportarCSV = () => {
    if (conveniosFiltrados.length === 0) return;

    const colunas = ['Ranking', 'Convênio / Operadora', 'Categoria', 'Quantidade Atendimentos', 'Participação (%)'];
    const linhas = conveniosFiltrados.map((c, idx) => [
      `${idx + 1}º`,
      `"${c.dsConvenio.replace(/"/g, '""')}"`,
      `"${c.categoria}"`,
      c.qtde,
      `"${c.percentual.toFixed(2)}%"`
    ]);

    // Linha de total
    linhas.push([
      'TOTAL GERAL',
      'TODOS OS CONVÊNIOS',
      '-',
      dados?.totalGeral || 0,
      '100.00%'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [colunas.join(';'), ...linhas.map(e => e.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `atendimentos_convenios_diretoria_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportarPDF = () => {
    if (conveniosFiltrados.length === 0) return;

    const doc = new jsPDF('portrait');

    // Cabeçalho
    doc.setFontSize(16);
    doc.setTextColor(24, 43, 73);
    doc.text('Relatório Executivo de Atendimentos por Convênio', 14, 16);

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Período: ${dataInicio.split('-').reverse().join('/')} até ${dataFim.split('-').reverse().join('/')} | Gerado em: ${new Date().toLocaleString('pt-BR')}`,
      14,
      22
    );

    // Box de Resumo
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(14, 26, 182, 14, 2, 2, 'F');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(
      `Total Geral: ${(dados?.totalGeral || 0).toLocaleString('pt-BR')}  |  SUS: ${dados?.percentualSus || 0}%  |  Planos: ${dados?.percentualPrivado || 0}%  |  Particular: ${dados?.percentualParticular || 0}%`,
      18,
      35
    );

    // Tabela
    const head = [['#', 'Convênio / Operadora', 'Categoria', 'Atendimentos', 'Share (%)']];
    const data = conveniosFiltrados.map((c, idx) => [
      `${idx + 1}º`,
      c.dsConvenio,
      c.categoria,
      c.qtde.toLocaleString('pt-BR'),
      `${c.percentual.toFixed(2)}%`
    ]);

    // Linha final de total
    data.push([
      'TOTAL',
      'TOTAL CONSOLIDADO',
      '-',
      (dados?.totalGeral || 0).toLocaleString('pt-BR'),
      '100.00%'
    ]);

    autoTable(doc, {
      head,
      body: data,
      startY: 44,
      styles: { fontSize: 8.5, cellPadding: 2.5 },
      headStyles: { fillColor: [37, 99, 235], textColor: 255 },
      alternateRowStyles: { fillColor: [248, 250, 252] }
    });

    doc.save(`relatorio_atendimentos_diretoria_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const limparFiltros = () => {
    setBusca('');
    setCategoriaFiltro('todos');
    setSetorFiltro('0');
    setTipoFiltro('0');
    setClinicaFiltro('0');
    handleMudarPeriodo('30d');
  };

  const temFiltroAtivo =
    busca !== '' ||
    categoriaFiltro !== 'todos' ||
    setorFiltro !== '0' ||
    tipoFiltro !== '0' ||
    clinicaFiltro !== '0';

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-300">
      {/* ── Topo: Cabeçalho Executivo ────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-card border border-border/80 rounded-2xl p-5 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-xs">
            <TrendingUp className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Painel de Atendimentos
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                Diretoria Executiva
              </span>
            </div>
            <p className="text-xs md:text-sm text-muted-foreground flex items-center gap-2 mt-0.5">
              <span>Indicadores hospitalares e volume por convênio via Tasy Oracle</span>
              {dados?.dataAtualizacao && (
                <>
                  <span>•</span>
                  <span>Atualizado às {dados.dataAtualizacao}</span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Badge de Origem dos Dados */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border ${
              dados?.isMock
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
            }`}
          >
            <div className={`h-2 w-2 rounded-full animate-pulse ${dados?.isMock ? 'bg-amber-500' : 'bg-emerald-500'}`} />
            <span>{dados?.isMock ? 'Modo Demonstração' : 'Tasy Live Webhook'}</span>
          </div>

          {/* Botão de Atualizar */}
          <button
            onClick={carregarDados}
            disabled={carregando}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-card hover:bg-muted text-foreground border border-border shadow-xs transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${carregando ? 'animate-spin text-primary' : ''}`} />
            <span>Atualizar</span>
          </button>

          {/* Botões de Exportação */}
          <button
            onClick={exportarCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-card hover:bg-muted text-foreground border border-border shadow-xs transition-all active:scale-95 cursor-pointer"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
            <span>CSV</span>
          </button>

          <button
            onClick={exportarPDF}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-card hover:bg-muted text-foreground border border-border shadow-xs transition-all active:scale-95 cursor-pointer"
          >
            <FileText className="h-3.5 w-3.5 text-rose-600" />
            <span>PDF</span>
          </button>
        </div>
      </div>

      {/* ── Filtros e Períodos ───────────────────────────────────────────────── */}
      <div className="bg-card border border-border/80 rounded-2xl p-4 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-border/60 pb-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-muted-foreground mr-1 flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" /> Período:
            </span>
            {(
              [
                { id: 'hoje', label: 'Hoje' },
                { id: '7d', label: '7 Dias' },
                { id: '15d', label: '15 Dias' },
                { id: '30d', label: '30 Dias' },
                { id: 'mes_atual', label: 'Este Mês' },
                { id: 'ano_atual', label: 'Este Ano' },
                { id: 'custom', label: 'Personalizado' }
              ] as const
            ).map(opt => (
              <button
                key={opt.id}
                onClick={() => handleMudarPeriodo(opt.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  periodo === opt.id
                    ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                    : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Date Picker Customizado */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dataInicio}
              onChange={e => {
                setDataInicio(e.target.value);
                setPeriodo('custom');
              }}
              className="px-2.5 py-1.5 text-xs rounded-lg bg-background border border-border text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20"
            />
            <span className="text-xs text-muted-foreground">até</span>
            <input
              type="date"
              value={dataFim}
              onChange={e => {
                setDataFim(e.target.value);
                setPeriodo('custom');
              }}
              className="px-2.5 py-1.5 text-xs rounded-lg bg-background border border-border text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        {/* Linha de Filtros por Categoria e Busca */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Busca por Nome do Convênio */}
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por convênio ou operadora..."
              value={busca}
              onChange={e => {
                setBusca(e.target.value);
                setPaginaAtual(1);
              }}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>

          {/* Filtro por Categoria de Convênio */}
          <div>
            <select
              value={categoriaFiltro}
              onChange={e => {
                setCategoriaFiltro(e.target.value as CategoriaFiltro);
                setPaginaAtual(1);
              }}
              className="w-full px-3 py-2 text-xs rounded-xl bg-background border border-border text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20"
            >
              <option value="todos">Todas as Categorias</option>
              <option value="SUS">SUS (Sistema Único de Saúde)</option>
              <option value="Privado">Planos de Saúde Privados</option>
              <option value="Particular">Particular / Direto</option>
            </select>
          </div>

          {/* Filtro por Tipo de Atendimento Tasy */}
          <div>
            <select
              value={tipoFiltro}
              onChange={e => {
                setTipoFiltro(e.target.value);
                setPaginaAtual(1);
              }}
              className="w-full px-3 py-2 text-xs rounded-xl bg-background border border-border text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20"
            >
              <option value="0">Todos os Tipos de Atendimento</option>
              <option value="1">Ambulatório / Consultas</option>
              <option value="2">Pronto Atendimento / Urgência</option>
              <option value="3">Internação</option>
              <option value="4">Exames Diagnósticos</option>
            </select>
          </div>

          {/* Botão Limpar Filtros */}
          <div className="flex items-center gap-2">
            <select
              value={clinicaFiltro}
              onChange={e => {
                setClinicaFiltro(e.target.value);
                setPaginaAtual(1);
              }}
              className="w-full px-3 py-2 text-xs rounded-xl bg-background border border-border text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20"
            >
              <option value="0">Todas as Clínicas</option>
              <option value="1">Clínica Médica</option>
              <option value="2">Clínica Cirúrgica</option>
              <option value="3">Pediatria</option>
              <option value="4">Obstetrícia</option>
            </select>

            {temFiltroAtivo && (
              <button
                onClick={limparFiltros}
                title="Limpar filtros"
                className="p-2 rounded-xl bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-all cursor-pointer flex-shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Cards de Indicadores (KPIs Executivos) ───────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Geral de Atendimentos */}
        <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-blue-500/10 rounded-full blur-xl group-hover:bg-blue-500/20 transition-all pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Atendimentos
            </span>
            <div className="h-9 w-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Activity className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-foreground tracking-tight">
              {(dados?.totalGeral || 0).toLocaleString('pt-BR')}
            </span>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-blue-500" />
              <span>Volume consolidado</span>
            </p>
          </div>
        </div>

        {/* Total SUS */}
        <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl group-hover:bg-emerald-500/20 transition-all pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Atendimentos SUS
            </span>
            <div className="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <ShieldCheck className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight">
                {(dados?.totalSus || 0).toLocaleString('pt-BR')}
              </span>
              <span className="text-xs font-bold text-emerald-600/80 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                {dados?.percentualSus || 0}%
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Participação pública</p>
          </div>
        </div>

        {/* Total Planos Privados */}
        <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-violet-500/10 rounded-full blur-xl group-hover:bg-violet-500/20 transition-all pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Planos de Saúde
            </span>
            <div className="h-9 w-9 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center">
              <Building2 className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-violet-600 dark:text-violet-400 tracking-tight">
                {(dados?.totalPrivado || 0).toLocaleString('pt-BR')}
              </span>
              <span className="text-xs font-bold text-violet-600/80 bg-violet-500/10 px-1.5 py-0.5 rounded">
                {dados?.percentualPrivado || 0}%
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Operadoras privadas</p>
          </div>
        </div>

        {/* Total Particular */}
        <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-amber-500/10 rounded-full blur-xl group-hover:bg-amber-500/20 transition-all pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Particular
            </span>
            <div className="h-9 w-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Wallet className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-amber-600 dark:text-amber-400 tracking-tight">
                {(dados?.totalParticular || 0).toLocaleString('pt-BR')}
              </span>
              <span className="text-xs font-bold text-amber-600/80 bg-amber-500/10 px-1.5 py-0.5 rounded">
                {dados?.percentualParticular || 0}%
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Atendimento direto</p>
          </div>
        </div>

        {/* Operadoras Ativas */}
        <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-cyan-500/10 rounded-full blur-xl group-hover:bg-cyan-500/20 transition-all pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Operadoras Ativas
            </span>
            <div className="h-9 w-9 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
              <Award className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-foreground tracking-tight">
              {dados?.totalOperadoras || 0}
            </span>
            <p className="text-xs text-muted-foreground mt-1 truncate" title={dados?.topConvenio ? `Top: ${dados.topConvenio.dsConvenio}` : ''}>
              Top: <strong>{dados?.topConvenio?.dsConvenio || 'Nenhum'}</strong>
            </p>
          </div>
        </div>
      </div>

      {/* ── Painel de Gráficos Recharts ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico 1: Ranking dos Maiores Convênios por Volume (Top 10) */}
        <div className="lg:col-span-2 bg-card border border-border/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Top 10 Convênios por Volume
              </h2>
              <p className="text-xs text-muted-foreground">Ranking das maiores operadoras por atendimentos</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1 text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-600 inline-block" /> Atendimentos
              </span>
            </div>
          </div>

          <div className="h-80 w-full">
            {dadosTopBarras.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                Nenhum dado encontrado para o período.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dadosTopBarras} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={150} tickLine={false} axisLine={false} />
                  <RechartsTooltip
                    formatter={(value: any, name: any, item: any) => [
                      `${Number(value).toLocaleString('pt-BR')} atendimentos (${item.payload.percentual}%)`,
                      'Volume'
                    ]}
                    labelFormatter={(label, payload) => payload?.[0]?.payload?.nomeCompleto || label}
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.95)',
                      borderColor: '#334155',
                      borderRadius: '12px',
                      color: '#fff',
                      fontSize: '12px'
                    }}
                  />
                  <Bar
                    dataKey="qtde"
                    fill="#3b82f6"
                    radius={[0, 8, 8, 0]}
                    name="Atendimentos"
                    barSize={18}
                  >
                    {dadosTopBarras.map((entry, index) => {
                      let barColor = '#3b82f6';
                      if (entry.categoria === 'SUS') barColor = '#10b981';
                      else if (entry.categoria === 'Particular') barColor = '#f59e0b';
                      return <Cell key={`cell-${index}`} fill={barColor} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Gráfico 2: Donut Market Share */}
        <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="mb-2">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <PieIcon className="h-4 w-4 text-emerald-500" />
              Market Share por Operadora
            </h2>
            <p className="text-xs text-muted-foreground">Distribuição percentual da carteira</p>
          </div>

          <div className="h-60 w-full flex items-center justify-center">
            {dadosDonutShare.length === 0 ? (
              <span className="text-xs text-muted-foreground">Sem dados</span>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dadosDonutShare}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {dadosDonutShare.map((_, index) => (
                      <Cell key={`donut-${index}`} fill={CORES_PALETA[index % CORES_PALETA.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    formatter={(value: any, name: any, item: any) => [
                      `${Number(value).toLocaleString('pt-BR')} (${item.payload.percentual}%)`,
                      item.payload.nomeCompleto || name
                    ]}
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.95)',
                      borderColor: '#334155',
                      borderRadius: '12px',
                      color: '#fff',
                      fontSize: '12px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Legenda compacta */}
          <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-border/50 text-[11px]">
            {dadosDonutShare.slice(0, 4).map((c, i) => (
              <div key={c.name} className="flex items-center gap-1.5 truncate">
                <span
                  className="h-2 w-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: CORES_PALETA[i % CORES_PALETA.length] }}
                />
                <span className="truncate text-muted-foreground">{c.name}:</span>
                <span className="font-bold text-foreground">{c.percentual}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tabela Consolidada de Convênios ──────────────────────────────────── */}
      <div className="bg-card border border-border/80 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              Consolidação de Atendimentos por Convênio
            </h2>
            <p className="text-xs text-muted-foreground">
              Exibindo {conveniosFiltrados.length} operadoras com movimentação no período
            </p>
          </div>

          {/* Linhas por Página */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Linhas:</span>
            <select
              value={itensPorPagina}
              onChange={e => {
                setItensPorPagina(Number(e.target.value));
                setPaginaAtual(1);
              }}
              className="px-2.5 py-1 text-xs rounded-lg bg-background border border-border text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20"
            >
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={30}>30</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>

        {/* Tabela de Dados */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border/60 bg-muted/40 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                <th className="py-3 px-4 w-16 text-center">#</th>
                <th
                  onClick={() => alternarOrdenacao('dsConvenio')}
                  className="py-3 px-4 cursor-pointer hover:text-foreground transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Convênio / Operadora</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th
                  onClick={() => alternarOrdenacao('categoria')}
                  className="py-3 px-4 cursor-pointer hover:text-foreground transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Categoria</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th
                  onClick={() => alternarOrdenacao('qtde')}
                  className="py-3 px-4 text-right cursor-pointer hover:text-foreground transition-colors"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Quantidade</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th
                  onClick={() => alternarOrdenacao('percentual')}
                  className="py-3 px-4 w-60 cursor-pointer hover:text-foreground transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Participação (% Share)</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 text-xs">
              {carregando ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="h-6 w-6 animate-spin text-primary" />
                      <span>Consultando dados no Tasy Oracle...</span>
                    </div>
                  </td>
                </tr>
              ) : conveniosPaginados.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertCircle className="h-6 w-6 text-muted-foreground/60" />
                      <span className="font-semibold text-foreground">Nenhum convênio encontrado</span>
                      <span className="text-xs">Tente ajustar o filtro de busca ou a categoria.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                conveniosPaginados.map((item, index) => {
                  const rankingGlobal = (paginaAtual - 1) * itensPorPagina + index + 1;
                  const isTop1 = rankingGlobal === 1;
                  const isTop2 = rankingGlobal === 2;
                  const isTop3 = rankingGlobal === 3;

                  let badgeColor = 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20';
                  if (item.categoria === 'SUS') {
                    badgeColor = 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20';
                  } else if (item.categoria === 'Particular') {
                    badgeColor = 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20';
                  }

                  return (
                    <tr key={item.dsConvenio} className="hover:bg-muted/40 transition-colors group">
                      {/* Posição / Ranking */}
                      <td className="py-3.5 px-4 text-center">
                        {isTop1 ? (
                          <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold text-xs border border-amber-500/40">
                            1º
                          </span>
                        ) : isTop2 ? (
                          <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs">
                            2º
                          </span>
                        ) : isTop3 ? (
                          <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-amber-700/20 text-amber-700 dark:text-amber-300 font-bold text-xs">
                            3º
                          </span>
                        ) : (
                          <span className="text-muted-foreground font-medium">{rankingGlobal}º</span>
                        )}
                      </td>

                      {/* Nome do Convênio */}
                      <td className="py-3.5 px-4 font-semibold text-foreground">
                        <div className="flex items-center gap-2">
                          <span>{item.dsConvenio}</span>
                        </div>
                      </td>

                      {/* Categoria */}
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${badgeColor}`}>
                          {item.categoria === 'SUS'
                            ? 'SUS'
                            : item.categoria === 'Privado'
                            ? 'Plano Privado'
                            : 'Particular'}
                        </span>
                      </td>

                      {/* Quantidade */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-foreground text-sm">
                        {item.qtde.toLocaleString('pt-BR')}
                      </td>

                      {/* Barra de Progresso do Percentual */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                            <div
                              style={{ width: `${Math.min(100, item.percentual)}%` }}
                              className={`h-full rounded-full ${
                                item.categoria === 'SUS'
                                  ? 'bg-emerald-500'
                                  : item.categoria === 'Particular'
                                  ? 'bg-amber-500'
                                  : 'bg-primary'
                              }`}
                            />
                          </div>
                          <span className="font-mono text-xs font-semibold text-muted-foreground w-12 text-right">
                            {item.percentual.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Linha de Total Consolidado */}
            {conveniosFiltrados.length > 0 && !carregando && (
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/60 font-bold text-xs">
                  <td className="py-3.5 px-4 text-center text-primary">★</td>
                  <td className="py-3.5 px-4 text-foreground uppercase tracking-wide">
                    Total Geral Consolidado
                  </td>
                  <td className="py-3.5 px-4 text-muted-foreground">
                    {conveniosFiltrados.length} convênios
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-foreground text-sm font-extrabold">
                    {(dados?.totalGeral || 0).toLocaleString('pt-BR')}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="font-mono text-xs text-primary font-bold">100.0%</span>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Paginação */}
        <div className="p-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            Página <strong className="text-foreground">{paginaAtual}</strong> de <strong className="text-foreground">{totalPaginas}</strong> ({conveniosFiltrados.length} operadoras listadas)
          </span>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPaginaAtual(p => Math.max(1, p - 1))}
              disabled={paginaAtual === 1}
              className="px-3 py-1.5 rounded-xl bg-card border border-border text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer text-xs font-medium"
            >
              Anterior
            </button>
            <button
              onClick={() => setPaginaAtual(p => Math.min(totalPaginas, p + 1))}
              disabled={paginaAtual === totalPaginas}
              className="px-3 py-1.5 rounded-xl bg-card border border-border text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer text-xs font-medium"
            >
              Próxima
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
