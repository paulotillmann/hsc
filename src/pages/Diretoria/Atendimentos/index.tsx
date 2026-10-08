import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  TrendingUp,
  RefreshCw,
  FileSpreadsheet,
  FileText,
  Calendar,
  Search,
  Building2,
  ShieldCheck,
  PieChart as PieIcon,
  BarChart3,
  Layers,
  ArrowUpDown,
  X,
  Sparkles,
  AlertCircle,
  SlidersHorizontal,
  Wallet,
  Activity,
  CalendarDays,
  Clock,
  HeartPulse,
  Table as TableIcon,
  ChevronDown,
  Check
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
  Legend,
  AreaChart,
  Area
} from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  atendimentosService,
  ConvenioResumo,
  AtendimentosDiretoriaResponse,
  OPCOES_CONVENIOS,
  OPCOES_SETORES,
  OPCOES_CLINICAS,
  OPCOES_TIPOS_ATENDIMENTO
} from '../../../services/atendimentosService';

type AbaAtiva = 'convenios' | 'evolucao_mensal';

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

// ── Componente Reutilizável de Multi-Select com Checkbox ────────────────────
interface MultiSelectDropdownProps {
  label: string;
  options: { cd: string; ds: string }[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
}

function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
  placeholder = 'Todos'
}: MultiSelectDropdownProps) {
  const [aberto, setAberto] = useState(false);
  const [termoBusca, setTermoBusca] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Fechar ao clicar fora
  useEffect(() => {
    function handleClickFora(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener('mousedown', handleClickFora);
    return () => document.removeEventListener('mousedown', handleClickFora);
  }, []);

  const opcoesFiltradas = useMemo(() => {
    if (!termoBusca.trim()) return options;
    const t = termoBusca.toLowerCase().trim();
    return options.filter(
      opt => opt.ds.toLowerCase().includes(t) || opt.cd.includes(t)
    );
  }, [options, termoBusca]);

  const toggleItem = (cd: string) => {
    if (selected.includes(cd)) {
      onChange(selected.filter(item => item !== cd));
    } else {
      onChange([...selected, cd]);
    }
  };

  const selecionarTodos = () => {
    onChange(options.map(opt => opt.cd));
  };

  const limparSelecao = () => {
    onChange([]);
  };

  // Texto do botão
  const textoBotao = useMemo(() => {
    if (selected.length === 0) return `--- ${placeholder} ---`;
    if (selected.length === 1) {
      const item = options.find(o => o.cd === selected[0]);
      return item ? item.ds : '1 selecionado';
    }
    if (selected.length === options.length) {
      return `Todos (${options.length})`;
    }
    return `${selected.length} selecionados`;
  }, [selected, options, placeholder]);

  return (
    <div className="relative w-full" ref={containerRef}>
      <label className="block text-xs font-bold text-foreground mb-1.5">
        {label}
      </label>

      {/* Botão Trigger */}
      <button
        type="button"
        onClick={() => setAberto(prev => !prev)}
        className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-sm rounded-xl bg-background border text-left transition-all cursor-pointer ${
          aberto
            ? 'border-primary ring-2 ring-primary/20 shadow-xs font-medium'
            : selected.length > 0
            ? 'border-primary/60 text-foreground font-semibold bg-primary/5'
            : 'border-border text-foreground hover:border-border/80'
        }`}
      >
        <span className="truncate">{textoBotao}</span>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {selected.length > 0 && (
            <span className="h-5 min-w-5 px-1.5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
              {selected.length}
            </span>
          )}
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${aberto ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Popover Menu com Checkboxes */}
      {aberto && (
        <div className="absolute z-50 left-0 right-0 mt-2 min-w-[260px] max-w-[340px] bg-card border border-border rounded-2xl shadow-2xl p-3 space-y-2.5 animate-in fade-in zoom-in-95 duration-150">
          {/* Busca interna */}
          {options.length > 5 && (
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar por nome..."
                value={termoBusca}
                onChange={e => setTermoBusca(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl bg-muted/60 border border-border text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20"
              />
            </div>
          )}

          {/* Ações Rápidas (Selecionar Todos / Limpar) */}
          <div className="flex items-center justify-between text-xs px-1 pt-0.5 border-b border-border/60 pb-2">
            <button
              type="button"
              onClick={selecionarTodos}
              className="text-primary hover:underline font-bold cursor-pointer"
            >
              Marcar todos
            </button>
            <button
              type="button"
              onClick={() => limparSelecao()}
              className="text-muted-foreground hover:text-foreground font-medium cursor-pointer"
            >
              Limpar seleção
            </button>
          </div>

          {/* Lista de Checkboxes */}
          <div className="max-h-60 overflow-y-auto space-y-1 pr-1 custom-scrollbar text-sm">
            {opcoesFiltradas.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                Nenhum item encontrado
              </p>
            ) : (
              opcoesFiltradas.map(opt => {
                const isSelected = selected.includes(opt.cd);
                return (
                  <label
                    key={opt.cd}
                    onClick={() => toggleItem(opt.cd)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-primary/10 text-primary font-semibold'
                        : 'hover:bg-muted text-foreground'
                    }`}
                  >
                    <div
                      className={`h-4.5 w-4.5 rounded-md flex items-center justify-center border transition-all flex-shrink-0 ${
                        isSelected
                          ? 'bg-primary border-primary text-primary-foreground shadow-2xs'
                          : 'border-border bg-background'
                      }`}
                    >
                      {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                    </div>
                    <span className="text-sm truncate" title={opt.ds}>
                      {opt.ds}
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Página Principal ────────────────────────────────────────────────────────
export default function AtendimentosDiretoria() {
  // ── Estados de Dados ──────────────────────────────────────────────────────
  const [dados, setDados] = useState<AtendimentosDiretoriaResponse | null>(null);
  const [carregando, setCarregando] = useState<boolean>(true);
  const [abaAtiva, setAbaAtiva] = useState<AbaAtiva>('convenios');

  // ── Estados de Filtros (Multi-Select Arrays) ──────────────────────────────
  const [dataInicio, setDataInicio] = useState<string>('2026-10-01');
  const [dataFim, setDataFim] = useState<string>('2026-10-07');
  const [conveniosSelecionados, setConveniosSelecionados] = useState<string[]>([]);
  const [setoresSelecionados, setSetoresSelecionados] = useState<string[]>([]);
  const [clinicasSelecionadas, setClinicasSelecionadas] = useState<string[]>([]);
  const [tiposSelecionados, setTiposSelecionados] = useState<string[]>([]);
  const [buscaTabela, setBuscaTabela] = useState<string>('');

  // ── Estados de Ordenação da Tabela ────────────────────────────────────────
  const [ordenarPor, setOrdenarPor] = useState<keyof ConvenioResumo>('dsConvenio');
  const [ordemAscendente, setOrdemAscendente] = useState<boolean>(true);

  // ── Carregar Dados do Banco Oracle Tasy via n8n ───────────────────────────
  const carregarDados = useCallback(async (ignorarCache: boolean = false) => {
    setCarregando(true);
    try {
      // Se houver exatamente 1 convênio selecionado, passa o código, senão '0'
      const convParam = conveniosSelecionados.length === 1 ? conveniosSelecionados[0] : '0';
      const setorParam = setoresSelecionados.length === 1 ? setoresSelecionados[0] : '0';
      const clinicaParam = clinicasSelecionadas.length === 1 ? clinicasSelecionadas[0] : '0';
      const tipoParam = tiposSelecionados.length === 1 ? tiposSelecionados[0] : '0';

      const res = await atendimentosService.buscarAtendimentos({
        dtInicio: dataInicio,
        dtFim: dataFim,
        convenio: convParam,
        setor: setorParam,
        tipoAtendimento: tipoParam,
        clinica: clinicaParam
      }, ignorarCache);
      setDados(res);
    } catch (err) {
      console.error('Erro ao consultar atendimentos da diretoria:', err);
    } finally {
      setCarregando(false);
    }
  }, [dataInicio, dataFim, conveniosSelecionados, setoresSelecionados, clinicasSelecionadas, tiposSelecionados]);

  // Dispara a consulta sempre que filtros ou datas mudam
  useEffect(() => {
    carregarDados(false);
  }, [carregarDados]);

  // ── Atalhos de Período Rápido ─────────────────────────────────────────────
  const aplicarPeriodoRapido = (ini: string, fim: string) => {
    setDataInicio(ini);
    setDataFim(fim);
  };

  // ── Limpar Filtros ────────────────────────────────────────────────────────
  const limparFiltros = () => {
    setDataInicio('2026-10-01');
    setDataFim('2026-10-07');
    setConveniosSelecionados([]);
    setSetoresSelecionados([]);
    setClinicasSelecionadas([]);
    setTiposSelecionados([]);
    setBuscaTabela('');
  };

  const temFiltroAtivo =
    conveniosSelecionados.length > 0 ||
    setoresSelecionados.length > 0 ||
    clinicasSelecionadas.length > 0 ||
    tiposSelecionados.length > 0 ||
    buscaTabela !== '';

  // ── Formatação de Data BR ─────────────────────────────────────────────────
  const formatarDataBR = (dataStr: string) => {
    if (!dataStr) return '';
    const [ano, mes, dia] = dataStr.split('-');
    return `${dia}/${mes}/${ano}`;
  };

  // ── Mapa de Nomes dos Convênios Selecionados para Filtragem na Tela ────────
  const nomesConveniosSelecionados = useMemo(() => {
    if (conveniosSelecionados.length === 0) return null;
    const setNomes = new Set<string>();
    conveniosSelecionados.forEach(cd => {
      const opt = OPCOES_CONVENIOS.find(o => o.cd === cd);
      if (opt) {
        setNomes.add(opt.ds.toLowerCase().trim());
      }
    });
    return setNomes;
  }, [conveniosSelecionados]);

  // ── Filtragem de Convênios na Tabela (Multi-Select + Busca Livre) ──────────
  const conveniosFiltrados = useMemo(() => {
    if (!dados?.convenios) return [];
    return dados.convenios.filter(c => {
      // Filtro de Multi-Select de Convênios
      if (nomesConveniosSelecionados && nomesConveniosSelecionados.size > 0) {
        const nomeAtual = c.dsConvenio.toLowerCase().trim();
        // Verifica se algum convênio selecionado bate com o nome
        const match = Array.from(nomesConveniosSelecionados).some(n =>
          nomeAtual.includes(n) || n.includes(nomeAtual)
        );
        if (!match) return false;
      }

      // Filtro de Busca Livre por texto
      if (buscaTabela.trim()) {
        const query = buscaTabela.toLowerCase().trim();
        if (!c.dsConvenio.toLowerCase().includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [dados?.convenios, nomesConveniosSelecionados, buscaTabela]);

  // ── Recálculo Dinâmico de Totais, Percentuais e Estatísticas ──────────────
  const metricasConsolidadas = useMemo(() => {
    const totalGeral = conveniosFiltrados.reduce((acc, c) => acc + c.qtde, 0);
    const totalSus = conveniosFiltrados.filter(c => c.categoria === 'SUS').reduce((acc, c) => acc + c.qtde, 0);
    const totalParticular = conveniosFiltrados.filter(c => c.categoria === 'Particular').reduce((acc, c) => acc + c.qtde, 0);
    const totalPrivado = conveniosFiltrados.filter(c => c.categoria === 'Privado').reduce((acc, c) => acc + c.qtde, 0);

    return {
      totalGeral: conveniosSelecionados.length > 0 ? totalGeral : (dados?.totalGeral || totalGeral),
      totalSus,
      percentualSus: totalGeral > 0 ? Number(((totalSus / totalGeral) * 100).toFixed(1)) : 0,
      totalPrivado,
      percentualPrivado: totalGeral > 0 ? Number(((totalPrivado / totalGeral) * 100).toFixed(1)) : 0,
      totalParticular,
      percentualParticular: totalGeral > 0 ? Number(((totalParticular / totalGeral) * 100).toFixed(1)) : 0,
      totalOperadoras: conveniosFiltrados.length
    };
  }, [conveniosFiltrados, conveniosSelecionados.length, dados?.totalGeral]);

  // ── Itens com Percentual Proporcional ─────────────────────────────────────
  const conveniosComPercentual = useMemo(() => {
    const total = metricasConsolidadas.totalGeral;
    return conveniosFiltrados.map(c => ({
      ...c,
      percentual: total > 0 ? Number(((c.qtde / total) * 100).toFixed(2)) : 0
    }));
  }, [conveniosFiltrados, metricasConsolidadas.totalGeral]);

  // ── Ordenação ─────────────────────────────────────────────────────────────
  const conveniosOrdenados = useMemo(() => {
    return [...conveniosComPercentual].sort((a, b) => {
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
  }, [conveniosComPercentual, ordenarPor, ordemAscendente]);

  const alternarOrdenacao = (coluna: keyof ConvenioResumo) => {
    if (ordenarPor === coluna) {
      setOrdemAscendente(!ordemAscendente);
    } else {
      setOrdenarPor(coluna);
      setOrdemAscendente(true);
    }
  };

  // ── Gráficos ──────────────────────────────────────────────────────────────
  const dadosTopBarras = useMemo(() => {
    if (conveniosComPercentual.length === 0) return [];
    return [...conveniosComPercentual]
      .sort((a, b) => b.qtde - a.qtde)
      .slice(0, 8)
      .map(c => ({
        name: c.dsConvenio.length > 20 ? `${c.dsConvenio.substring(0, 18)}...` : c.dsConvenio,
        nomeCompleto: c.dsConvenio,
        qtde: c.qtde,
        percentual: c.percentual,
        categoria: c.categoria
      }));
  }, [conveniosComPercentual]);

  const dadosDonutShare = useMemo(() => {
    if (conveniosComPercentual.length === 0) return [];
    const ordenados = [...conveniosComPercentual].sort((a, b) => b.qtde - a.qtde);
    const top5 = ordenados.slice(0, 5);
    const outrosQtde = ordenados.slice(5).reduce((acc, c) => acc + c.qtde, 0);

    const resultado = top5.map(c => ({
      name: c.dsConvenio.length > 18 ? `${c.dsConvenio.substring(0, 16)}...` : c.dsConvenio,
      nomeCompleto: c.dsConvenio,
      value: c.qtde,
      percentual: c.percentual
    }));

    if (outrosQtde > 0) {
      const totalGeral = metricasConsolidadas.totalGeral || 1;
      resultado.push({
        name: 'Demais Convênios',
        nomeCompleto: 'Demais Convênios Agrupados',
        value: outrosQtde,
        percentual: Number(((outrosQtde / totalGeral) * 100).toFixed(2))
      });
    }

    return resultado;
  }, [conveniosComPercentual, metricasConsolidadas.totalGeral]);

  // ── Exportação CSV / Excel ─────────────────────────────────────────────────
  const exportarCSV = () => {
    if (conveniosComPercentual.length === 0) return;

    const colunas = ['Convênio / Operadora', 'Categoria', 'Qtd. Atendimentos', 'Participação (%)'];
    const linhas = conveniosComPercentual.map(c => [
      `"${c.dsConvenio.replace(/"/g, '""')}"`,
      `"${c.categoria}"`,
      c.qtde,
      `"${c.percentual.toFixed(2)}%"`
    ]);

    linhas.push([
      'TOTAL GERAL',
      '-',
      metricasConsolidadas.totalGeral || 0,
      '100.00%'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [colunas.join(';'), ...linhas.map(e => e.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `atendimentos_convenio_${dataInicio}_a_${dataFim}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ── Exportação PDF (Fiel ao Relatório da Santa Casa - Imagem 1) ────────────
  const exportarPDF = () => {
    if (conveniosComPercentual.length === 0) return;

    const doc = new jsPDF('portrait');

    // Cabeçalho Santa Casa
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text('SANTA CASA', 14, 18);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('De Misericórdia de Araguari-MG', 14, 23);

    // Título Principal Centralizado
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text('TOTAL DE ATENDIMENTOS POR CONVÊNIO', 105, 18, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`De ${formatarDataBR(dataInicio)} até ${formatarDataBR(dataFim)}`, 105, 24, { align: 'center' });

    // Linha divisória
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.5);
    doc.line(14, 28, 196, 28);

    // Tabela no formato exato da Imagem 1
    const head = [['Convênio', 'Qtd. Atendimentos']];
    const data = conveniosOrdenados.map(c => [
      c.dsConvenio,
      c.qtde.toLocaleString('pt-BR')
    ]);

    // Linha Final de TOTAL
    data.push([
      'TOTAL',
      (metricasConsolidadas.totalGeral || 0).toLocaleString('pt-BR')
    ]);

    autoTable(doc, {
      head,
      body: data,
      startY: 32,
      styles: {
        fontSize: 9.5,
        cellPadding: 3,
        textColor: [15, 23, 42]
      },
      headStyles: {
        fillColor: [203, 213, 225],
        textColor: [15, 23, 42],
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [255, 255, 255]
      },
      columnStyles: {
        0: { halign: 'left' },
        1: { halign: 'center', fontStyle: 'normal' }
      },
      didParseCell: function (dataHook) {
        if (dataHook.row.index === data.length - 1) {
          dataHook.cell.styles.fontStyle = 'bold';
          dataHook.cell.styles.fillColor = [241, 245, 249];
        }
      }
    });

    doc.save(`relatorio_atendimentos_santacasa_${dataInicio}_a_${dataFim}.pdf`);
  };

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-300">
      {/* ── Topo: Cabeçalho Executivo ──────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border/80 rounded-2xl p-5 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center border border-rose-500/20 shadow-xs flex-shrink-0">
            <HeartPulse className="h-6 w-6" />
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-foreground">
              Gestão de Atendimentos
            </h1>
            <div
              title={dados?.isMock ? 'Modo Demonstração' : `Conectado ao Oracle Tasy • Atualizado às ${dados?.dataAtualizacao || ''}`}
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border shadow-2xs ${
                dados?.isMock
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
              }`}
            >
              <div className={`h-1.5 w-1.5 rounded-full ${dados?.isMock ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500 animate-pulse'}`} />
              <span className="uppercase tracking-wider text-[10px]">SYNC</span>
              {dados?.dataAtualizacao && (
                <span className="font-mono text-[10px] opacity-75 font-normal">
                  {dados.dataAtualizacao}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Botões de Ações */}
        <div className="flex items-center gap-2">
          {/* Exportar CSV */}
          <button
            onClick={exportarCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-card hover:bg-muted text-foreground border border-border shadow-xs transition-all active:scale-95 cursor-pointer"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
            <span>CSV</span>
          </button>

          {/* Exportar PDF com layout Santa Casa */}
          <button
            onClick={exportarPDF}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-card hover:bg-muted text-foreground border border-border shadow-xs transition-all active:scale-95 cursor-pointer"
          >
            <FileText className="h-3.5 w-3.5 text-rose-600" />
            <span>PDF</span>
          </button>
        </div>
      </div>

      {/* ── PAINEL DE PARÂMETROS E FILTROS COM MULTI-SELECT E CHECKBOXES ───── */}
      <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-xs space-y-4">
        {/* Barra Superior: Título + Atalhos Rápidos de Período */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">Parâmetros de Consulta</h2>
          </div>

          {/* Atalhos de Período */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold text-muted-foreground mr-1">Atalhos:</span>
            <button
              onClick={() => aplicarPeriodoRapido('2026-10-01', '2026-10-07')}
              className={`px-2.5 py-1 text-xs rounded-lg transition-colors cursor-pointer ${
                dataInicio === '2026-10-01' && dataFim === '2026-10-07'
                  ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              01 a 07/Out/26
            </button>
            <button
              onClick={() => aplicarPeriodoRapido('2026-09-01', '2026-09-30')}
              className={`px-2.5 py-1 text-xs rounded-lg transition-colors cursor-pointer ${
                dataInicio === '2026-09-01' && dataFim === '2026-09-30'
                  ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              Setembro/26
            </button>
            <button
              onClick={() => aplicarPeriodoRapido('2026-08-01', '2026-08-31')}
              className={`px-2.5 py-1 text-xs rounded-lg transition-colors cursor-pointer ${
                dataInicio === '2026-08-01' && dataFim === '2026-08-31'
                  ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              Agosto/26
            </button>
            <button
              onClick={() => aplicarPeriodoRapido('2026-01-01', '2026-10-07')}
              className={`px-2.5 py-1 text-xs rounded-lg transition-colors cursor-pointer ${
                dataInicio === '2026-01-01' && dataFim === '2026-10-07'
                  ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              Ano 2026
            </button>
          </div>
        </div>

        {/* Grid de Controles de Filtro (Multi-Selects com Checkboxes) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
          {/* Data Inicial */}
          <div>
            <label className="block text-xs font-bold text-foreground mb-1.5">
              Data Inicial
            </label>
            <input
              type="date"
              value={dataInicio}
              onChange={e => setDataInicio(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm font-medium rounded-xl bg-background border border-border text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Data Final */}
          <div>
            <label className="block text-xs font-bold text-foreground mb-1.5">
              Data Final
            </label>
            <input
              type="date"
              value={dataFim}
              onChange={e => setDataFim(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm font-medium rounded-xl bg-background border border-border text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Multi-Select: Convênio */}
          <MultiSelectDropdown
            label="Convênio(s)"
            options={OPCOES_CONVENIOS}
            selected={conveniosSelecionados}
            onChange={setConveniosSelecionados}
            placeholder="Todos os Convênios"
          />

          {/* Multi-Select: Setor */}
          <MultiSelectDropdown
            label="Setor(es)"
            options={OPCOES_SETORES}
            selected={setoresSelecionados}
            onChange={setSetoresSelecionados}
            placeholder="Todos os Setores"
          />

          {/* Multi-Select: Clínica */}
          <MultiSelectDropdown
            label="Clínica(s)"
            options={OPCOES_CLINICAS}
            selected={clinicasSelecionadas}
            onChange={setClinicasSelecionadas}
            placeholder="Todas as Clínicas"
          />

          {/* Multi-Select: Tipo de Atendimento */}
          <MultiSelectDropdown
            label="Tipo de Atendimento"
            options={OPCOES_TIPOS_ATENDIMENTO}
            selected={tiposSelecionados}
            onChange={setTiposSelecionados}
            placeholder="Todos os Tipos"
          />
        </div>

        {/* Linha de Ações de Filtro */}
        <div className="flex items-center justify-between pt-2.5 border-t border-border/40">
          <span className="text-xs font-medium text-muted-foreground">
            {carregando ? (
              <span className="flex items-center gap-1.5 text-primary font-bold">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Consultando base de dados...
              </span>
            ) : (
              <span>
                Período consultado: <strong className="text-foreground">{formatarDataBR(dataInicio)}</strong> até <strong className="text-foreground">{formatarDataBR(dataFim)}</strong>
              </span>
            )}
          </span>

          <div className="flex items-center gap-2">
            {temFiltroAtivo && (
              <button
                onClick={limparFiltros}
                className="flex items-center gap-1 px-3.5 py-2 rounded-xl text-xs font-semibold bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-all cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
                <span>Limpar Filtros</span>
              </button>
            )}

            <button
              onClick={() => carregarDados(true)}
              disabled={carregando}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${carregando ? 'animate-spin' : ''}`} />
              <span>Atualizar Consulta</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Navegação entre Abas (Convênios vs Evolução Mensal) ─────────────── */}
      <div className="flex items-center justify-between border-b border-border/80 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAbaAtiva('convenios')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              abaAtiva === 'convenios'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'bg-card text-muted-foreground hover:bg-muted hover:text-foreground border border-border/60'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>Total por Convênio (Relatório)</span>
          </button>

          <button
            onClick={() => setAbaAtiva('evolucao_mensal')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              abaAtiva === 'evolucao_mensal'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'bg-card text-muted-foreground hover:bg-muted hover:text-foreground border border-border/60'
            }`}
          >
            <TableIcon className="h-4 w-4" />
            <span>Acompanhamento Mensal & Produtividade</span>
          </button>
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {/* ── ABA 1: TOTAL DE ATENDIMENTOS POR CONVÊNIO (IMAGEM 1) ─────────────── */}
      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {abaAtiva === 'convenios' && (
        <div className="space-y-6">
          {/* Cards de KPIs Principais */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Geral */}
            <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all relative overflow-hidden group">
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
                  {(metricasConsolidadas.totalGeral || 0).toLocaleString('pt-BR')}
                </span>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-blue-500" />
                  <span>No período selecionado</span>
                </p>
              </div>
            </div>

            {/* Total SUS */}
            <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all relative overflow-hidden group">
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
                    {(metricasConsolidadas.totalSus || 0).toLocaleString('pt-BR')}
                  </span>
                  <span className="text-xs font-bold text-emerald-600/80 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                    {metricasConsolidadas.percentualSus || 0}%
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Participação Pública</p>
              </div>
            </div>

            {/* Planos Privados */}
            <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Planos Privados
                </span>
                <div className="h-9 w-9 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center">
                  <Building2 className="h-4.5 w-4.5" />
                </div>
              </div>
              <div className="mt-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-violet-600 dark:text-violet-400 tracking-tight">
                    {(metricasConsolidadas.totalPrivado || 0).toLocaleString('pt-BR')}
                  </span>
                  <span className="text-xs font-bold text-violet-600/80 bg-violet-500/10 px-1.5 py-0.5 rounded">
                    {metricasConsolidadas.percentualPrivado || 0}%
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Unimed, IPSEMG, etc.</p>
              </div>
            </div>

            {/* Particular */}
            <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all relative overflow-hidden group">
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
                    {(metricasConsolidadas.totalParticular || 0).toLocaleString('pt-BR')}
                  </span>
                  <span className="text-xs font-bold text-amber-600/80 bg-amber-500/10 px-1.5 py-0.5 rounded">
                    {metricasConsolidadas.percentualParticular || 0}%
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Atendimentos Particulares</p>
              </div>
            </div>
          </div>

          {/* Gráficos de Apoio */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Gráfico de Barras: Maiores Convênios */}
            <div className="lg:col-span-2 bg-card border border-border/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    Top Convênios por Volume
                  </h2>
                  <p className="text-xs text-muted-foreground">Distribuição dos maiores convênios no período</p>
                </div>
              </div>

              <div className="h-72 w-full">
                {dadosTopBarras.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                    Nenhum dado encontrado para os filtros selecionados.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dadosTopBarras} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={140} tickLine={false} axisLine={false} />
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
                      <Bar dataKey="qtde" fill="#3b82f6" radius={[0, 8, 8, 0]} barSize={16}>
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

            {/* Donut Chart: Market Share */}
            <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
              <div className="mb-2">
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <PieIcon className="h-4 w-4 text-emerald-500" />
                  Market Share
                </h2>
                <p className="text-xs text-muted-foreground">Distribuição percentual da carteira</p>
              </div>

              <div className="h-56 w-full flex items-center justify-center">
                {dadosDonutShare.length === 0 ? (
                  <span className="text-xs text-muted-foreground">Sem dados</span>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={dadosDonutShare}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
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

          {/* ── Tabela Fiel ao Relatório da Santa Casa (Imagem 1) ───────────── */}
          <div className="bg-card border border-border/80 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="relative w-72">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Filtrar convênio na tabela..."
                    value={buscaTabela}
                    onChange={e => setBuscaTabela(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <span className="text-xs text-muted-foreground">
                Exibindo <strong className="text-foreground">{conveniosFiltrados.length}</strong> convênios
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border/80 bg-muted/60 text-xs font-bold text-foreground">
                    <th
                      onClick={() => alternarOrdenacao('dsConvenio')}
                      className="py-3 px-6 cursor-pointer hover:text-primary transition-colors"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Convênio</span>
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </div>
                    </th>
                    <th
                      onClick={() => alternarOrdenacao('qtde')}
                      className="py-3 px-6 text-center cursor-pointer hover:text-primary transition-colors w-48"
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <span>Qtd. Atendimentos</span>
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </div>
                    </th>
                    <th
                      onClick={() => alternarOrdenacao('percentual')}
                      className="py-3 px-6 text-center cursor-pointer hover:text-primary transition-colors w-40"
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <span>Participação (%)</span>
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 text-xs">
                  {carregando ? (
                    <tr>
                      <td colSpan={3} className="py-12 text-center text-muted-foreground">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <RefreshCw className="h-6 w-6 animate-spin text-primary" />
                          <span>Carregando atendimentos...</span>
                        </div>
                      </td>
                    </tr>
                  ) : conveniosOrdenados.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-12 text-center text-muted-foreground">
                        <AlertCircle className="h-6 w-6 mx-auto text-muted-foreground/60 mb-2" />
                        <span className="font-semibold text-foreground">Nenhum atendimento localizado para estes filtros</span>
                      </td>
                    </tr>
                  ) : (
                    conveniosOrdenados.map(item => (
                      <tr key={item.dsConvenio} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-6 font-medium text-foreground">
                          {item.dsConvenio}
                        </td>
                        <td className="py-3 px-6 text-center font-mono font-bold text-foreground text-sm">
                          {item.qtde.toLocaleString('pt-BR')}
                        </td>
                        <td className="py-3 px-6 text-center font-mono text-muted-foreground">
                          {item.percentual.toFixed(2)}%
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {/* Linha de Total - Fiel à Imagem 1 */}
                {conveniosFiltrados.length > 0 && !carregando && (
                  <tfoot>
                    <tr className="border-t-2 border-border bg-muted/80 font-black text-xs text-foreground">
                      <td className="py-4 px-6 uppercase tracking-wider">
                        TOTAL
                      </td>
                      <td className="py-4 px-6 text-center font-mono font-extrabold text-base text-primary">
                        {(metricasConsolidadas.totalGeral || 0).toLocaleString('pt-BR')}
                      </td>
                      <td className="py-4 px-6 text-center font-mono text-xs text-primary font-bold">
                        100.00%
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {/* ── ABA 2: ACOMPANHAMENTO MENSAL & PRODUTIVIDADE (IMAGEM 3) ──────────── */}
      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {abaAtiva === 'evolucao_mensal' && (
        <div className="space-y-6">
          {/* Cards Rápidos de Médias Assistenciais */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Média Diária Global (Clínica / Dias)
                </span>
                <Clock className="h-4.5 w-4.5 text-blue-500" />
              </div>
              <div className="mt-2">
                <span className="text-3xl font-extrabold text-foreground">
                  {Math.round(
                    (dados?.evolucaoMensal || []).reduce((acc, m) => acc + m.mediaDiaria, 0) /
                      (dados?.evolucaoMensal?.length || 1)
                  )}
                </span>
                <span className="text-xs text-muted-foreground ml-2">pacientes / dia</span>
              </div>
            </div>

            <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Média por Turno (Diária / 3)
                </span>
                <CalendarDays className="h-4.5 w-4.5 text-emerald-500" />
              </div>
              <div className="mt-2">
                <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
                  {Math.round(
                    (dados?.evolucaoMensal || []).reduce((acc, m) => acc + m.porTurno6h, 0) /
                      (dados?.evolucaoMensal?.length || 1)
                  )}
                </span>
                <span className="text-xs text-muted-foreground ml-2">pacientes / plantão</span>
              </div>
            </div>

            <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Mês com Maior Volume
                </span>
                <TrendingUp className="h-4.5 w-4.5 text-violet-500" />
              </div>
              <div className="mt-2">
                {(() => {
                  const lista = dados?.evolucaoMensal || [];
                  const topMes = lista.length > 0 ? [...lista].sort((a, b) => b.total - a.total)[0] : null;
                  return (
                    <>
                      <span className="text-2xl font-extrabold text-violet-600 dark:text-violet-400">
                        {topMes ? `Mês ${topMes.mes} (${topMes.mesNome})` : '-'}
                      </span>
                      {topMes && (
                        <span className="text-xs text-muted-foreground ml-2">
                          {topMes.total.toLocaleString('pt-BR')} atendimentos
                        </span>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* Gráfico de Evolução Mensal */}
          <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Evolução Mensal: Total vs. SUS vs. Não SUS
                </h2>
                <p className="text-xs text-muted-foreground">Comparativo de atendimentos por perfil assistencial</p>
              </div>
            </div>

            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dados?.evolucaoMensal || []} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="corTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="corNaoSus" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="corSus" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="mesNome" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.95)',
                      borderColor: '#334155',
                      borderRadius: '12px',
                      color: '#fff',
                      fontSize: '12px'
                    }}
                  />
                  <Legend verticalAlign="top" height={36} />
                  <Area type="monotone" dataKey="total" name="Total Geral" stroke="#3b82f6" fillOpacity={1} fill="url(#corTotal)" strokeWidth={2.5} />
                  <Area type="monotone" dataKey="naoSus" name="Não SUS (Privado/Part)" stroke="#8b5cf6" fillOpacity={1} fill="url(#corNaoSus)" strokeWidth={2} />
                  <Area type="monotone" dataKey="sus" name="SUS" stroke="#10b981" fillOpacity={1} fill="url(#corSus)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── Tabela Idêntica à Planilha Excel (Imagem 3) ────────────────── */}
          <div className="bg-card border border-border/80 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 border-b border-border bg-muted/20">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <TableIcon className="h-4 w-4 text-primary" />
                Planilha Consolidada de Atendimentos e Produtividade Mensal
              </h2>
              <p className="text-xs text-muted-foreground">Valores fiéis à matriz de controle hospitalar</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-center border-collapse">
                <thead>
                  <tr className="border-b border-border/80 bg-muted/60 text-xs font-bold text-foreground">
                    <th className="py-3 px-4 text-left">Mês</th>
                    <th className="py-3 px-4">Total</th>
                    <th className="py-3 px-4 text-emerald-600 dark:text-emerald-400">SUS</th>
                    <th className="py-3 px-4 text-violet-600 dark:text-violet-400">Não SUS</th>
                    <th className="py-3 px-4">Clínica</th>
                    <th className="py-3 px-4">IPSEMG</th>
                    <th className="py-3 px-4">SUS (Clínica)</th>
                    <th className="py-3 px-4">Total Clínica</th>
                    <th className="py-3 px-4 text-blue-600 dark:text-blue-400">Média Diária</th>
                    <th className="py-3 px-4 text-amber-600 dark:text-amber-400">Por Turno de 6h</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 text-xs">
                  {(dados?.evolucaoMensal || []).map(row => (
                    <tr key={row.mes} className="hover:bg-muted/30 transition-colors font-mono">
                      <td className="py-3 px-4 text-left font-sans font-bold text-foreground">
                        {row.mes} ({row.mesNome})
                      </td>
                      <td className="py-3 px-4 font-bold text-foreground">
                        {row.total.toLocaleString('pt-BR')}
                      </td>
                      <td className="py-3 px-4 text-emerald-600 dark:text-emerald-400 font-semibold">
                        {row.sus.toLocaleString('pt-BR')}
                      </td>
                      <td className="py-3 px-4 text-violet-600 dark:text-violet-400 font-semibold">
                        {row.naoSus.toLocaleString('pt-BR')}
                      </td>
                      <td className="py-3 px-4 font-semibold text-foreground">
                        {row.clinica.toLocaleString('pt-BR')}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {row.ipsemg.toLocaleString('pt-BR')}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {row.susClinica.toLocaleString('pt-BR')}
                      </td>
                      <td className="py-3 px-4 font-bold text-foreground">
                        {row.totalClinica.toLocaleString('pt-BR')}
                      </td>
                      <td className="py-3 px-4 font-bold text-blue-600 dark:text-blue-400 bg-blue-500/5">
                        {row.mediaDiaria}
                      </td>
                      <td className="py-3 px-4 font-bold text-amber-600 dark:text-amber-400 bg-amber-500/5">
                        {row.porTurno6h}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
