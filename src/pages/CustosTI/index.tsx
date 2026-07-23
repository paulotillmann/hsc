import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Coins, Filter, RefreshCw, FileText, CheckCircle2, Clock, 
  AlertCircle, X, Search, ChevronLeft, ChevronRight, BarChart3, PieChart,
  Calendar, Building, ArrowUpRight, TrendingUp, Info, Check, ChevronDown
} from 'lucide-react';
import { webhookService } from '../../services/webhookService';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Legend, Cell, PieChart as ReChartsPie, Pie,
  ReferenceLine
} from 'recharts';

export interface TituloPagar {
  nr_titulo: number;
  VL_TITULO: number;
  VL_BAIXA?: number;
  NR_DOCUMENTO: string | null;
  DT_EMISSAO: string;
  DT_LIQUIDACAO: string | null;
  ds_centro_custo: string;
  Empresa: string;
  IE_SITUACAO: string; // 'L' = Liquidado, 'A' = Aberto / Outro
  DS_OBSERVACAO_TITULO: string | null;
  Nome?: string | null;
}

const cleanString = (val: any, fallback: string = ''): string => {
  if (val === undefined || val === null) return fallback;
  const str = String(val).trim();
  if (str.toLowerCase() === 'null' || str.toLowerCase() === 'undefined' || str === 'Não Informado') return fallback;
  return str;
};

const isValidEmpresa = (empresa: string | null | undefined): boolean => {
  if (!empresa) return false;
  const clean = empresa.trim().toLowerCase();
  return clean !== '' && clean !== 'sem empresa' && clean !== 'sem pj' && clean !== 'não informado';
};

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
};

const formatCompactCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
    compactDisplay: 'short'
  }).format(value);
};

const parseTasyDate = (dateStr: string | null): Date | null => {
  if (!dateStr) return null;
  // Se for uma data simples YYYY-MM-DD, força a interpretação no fuso de Brasília
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return new Date(`${dateStr}T00:00:00-03:00`);
  }
  // Se contiver timezone UTC (Z, +00:00, etc), substitui por -03:00 (Brasília)
  const normalizedStr = dateStr.replace(/(Z|\+00:00|\+00)$/i, '-03:00');
  const d = new Date(normalizedStr);
  return isNaN(d.getTime()) ? null : d;
};

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '-';
  const cleanStr = String(dateStr).trim().toLowerCase();
  if (cleanStr === 'null' || cleanStr === 'undefined' || cleanStr === '') return '-';
  
  // Format YYYY-MM-DD to DD/MM/YYYY
  const cleanDate = dateStr.split('T')[0];
  const parts = cleanDate.split('-');
  if (parts.length !== 3) return dateStr;
  const [year, month, day] = parts;
  return `${day}/${month}/${year}`;
};

const getStatusLabel = (situacao: string) => {
  switch (situacao) {
    case 'L': return 'Liquidado';
    case 'A': return 'Aberto';
    default: return situacao || 'Pendente';
  }
};

const getValorExibido = (t: TituloPagar): number => {
  if (t.VL_BAIXA !== undefined && t.VL_BAIXA !== null) {
    return t.VL_BAIXA;
  }
  return t.VL_TITULO;
};

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#34d399', '#f87171'];

// Default dates: first day of previous month to last day of current month
const getDefaultDates = () => {
  const today = new Date();
  
  const firstDayPrevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const fromYear = firstDayPrevMonth.getFullYear();
  const fromMonth = String(firstDayPrevMonth.getMonth() + 1).padStart(2, '0');
  const fromDay = '01';
  
  const lastDayCurrentMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const toYear = lastDayCurrentMonth.getFullYear();
  const toMonth = String(lastDayCurrentMonth.getMonth() + 1).padStart(2, '0');
  const toDay = String(lastDayCurrentMonth.getDate()).padStart(2, '0');
  
  return {
    from: `${fromYear}-${fromMonth}-${fromDay}`,
    to: `${toYear}-${toMonth}-${toDay}`
  };
};

const CustosTI: React.FC = () => {
  const [titulos, setTitulos] = useState<TituloPagar[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [syncTime, setSyncTime] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [situacaoFilter, setSituacaoFilter] = useState<string>('L'); // Todos, L, A
  const [periodFrom, setPeriodFrom] = useState<string>(() => getDefaultDates().from);
  const [periodTo, setPeriodTo] = useState<string>(() => getDefaultDates().to);
  const [selectedFornecedores, setSelectedFornecedores] = useState<string[]>([]);
  const [isFornecedoresOpen, setIsFornecedoresOpen] = useState<boolean>(false);
  const [fornecedorSearch, setFornecedorSearch] = useState<string>('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Detect clicks outside to close supplier dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsFornecedoresOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sorting
  const [sortField, setSortField] = useState<keyof TituloPagar>('DT_EMISSAO');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 10;

  // Selected title for modal details
  const [selectedTitulo, setSelectedTitulo] = useState<TituloPagar | null>(null);

  // Fetch titles from webhook
  const fetchTitulos = useCallback(async (showLoading = true, forceRefresh = false) => {
    if (showLoading) setLoading(true);
    setSyncStatus('idle');

    try {
      // Pass parameters according to the Oracle SQL query expectations
      const response = await webhookService.fetchCustosTi({
        dt_inicio: periodFrom || null,
        dt_fim: periodTo || null,
        situacao: situacaoFilter === 'Todos' ? null : situacaoFilter
      });

      const nowTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      if (response && Array.isArray(response)) {
        // Map keys in case of casing differences (upper vs lower)
        const mappedList: TituloPagar[] = response.map((item: any) => {
          return {
            nr_titulo: Number(item.NR_TITULO !== undefined ? item.NR_TITULO : (item.nr_titulo || 0)),
            VL_TITULO: Number(item.VL_TITULO !== undefined ? item.VL_TITULO : (item.vl_titulo || 0)),
            VL_BAIXA: item.VL_BAIXA !== undefined && item.VL_BAIXA !== null ? Number(item.VL_BAIXA) : (item.vl_baixa !== undefined && item.vl_baixa !== null ? Number(item.vl_baixa) : undefined),
            NR_DOCUMENTO: cleanString(item.NR_DOCUMENTO !== undefined ? item.NR_DOCUMENTO : item.nr_documento, null),
            DT_EMISSAO: String(item.DT_EMISSAO !== undefined ? item.DT_EMISSAO : (item.dt_emissao || '')),
            DT_LIQUIDACAO: item.DT_LIQUIDACAO ? String(item.DT_LIQUIDACAO) : (item.dt_liquidacao ? String(item.dt_liquidacao) : null),
            ds_centro_custo: cleanString(item.DS_CENTRO_COSTO !== undefined ? item.DS_CENTRO_COSTO : (item.ds_centro_custo || 'TI - Tecnologia da Informação')),
            Empresa: cleanString(item.EMPRESA !== undefined ? item.EMPRESA : (item.empresa || item.Empresa || 'Sem Empresa')),
            IE_SITUACAO: cleanString(item.IE_SITUACAO !== undefined ? item.IE_SITUACAO : (item.ie_situacao || 'A')),
            DS_OBSERVACAO_TITULO: cleanString(item.DS_OBSERVACAO_TITULO !== undefined ? item.DS_OBSERVACAO_TITULO : item.ds_observacao_titulo, null),
            Nome: cleanString(item.NOME !== undefined ? item.NOME : item.Nome !== undefined ? item.Nome : item.nome, null)
          };
        });

        setTitulos(mappedList);
        setSyncTime(nowTime);
        setSyncStatus('success');
      } else {
        setSyncStatus('error');
      }
    } catch (e) {
      console.error('Erro ao carregar títulos:', e);
      setSyncStatus('error');
    } finally {
      setLoading(false);
    }
  }, [periodFrom, periodTo, situacaoFilter]);

  // Initial load
  useEffect(() => {
    fetchTitulos(true);
  }, [fetchTitulos]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedFornecedores, situacaoFilter, periodFrom, periodTo]);

  // Extract unique providers (fornecedores)
  const fornecedoresDisponiveis = useMemo(() => {
    const list = Array.from(new Set(titulos.map(t => t.Empresa).filter(Boolean)));
    return list.sort((a, b) => a.localeCompare(b));
  }, [titulos]);

  // Filter providers in search inside dropdown
  const fornecedoresFiltrados = useMemo(() => {
    return fornecedoresDisponiveis.filter(f =>
      f.toLowerCase().includes(fornecedorSearch.toLowerCase())
    );
  }, [fornecedoresDisponiveis, fornecedorSearch]);

  // Handle column header sorting
  const handleSort = (field: keyof TituloPagar) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // Filtered and sorted titles list
  const titulosFiltrados = useMemo(() => {
    let result = titulos.filter(t => {
      // Free text search
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matches = 
          t.Empresa.toLowerCase().includes(term) || 
          t.ds_centro_custo.toLowerCase().includes(term) || 
          String(t.nr_titulo).includes(term) || 
          (t.NR_DOCUMENTO && t.NR_DOCUMENTO.toLowerCase().includes(term)) ||
          (t.DS_OBSERVACAO_TITULO && t.DS_OBSERVACAO_TITULO.toLowerCase().includes(term)) ||
          (t.Nome && t.Nome.toLowerCase().includes(term));
        
        if (!matches) return false;
      }

      // Filter by multiple selected providers/fornecedores
      if (selectedFornecedores.length > 0) {
        if (!selectedFornecedores.includes(t.Empresa)) return false;
      }

      return true;
    });

    // Sorting logic
    result.sort((a, b) => {
      let valA = sortField === 'VL_TITULO' ? getValorExibido(a) : a[sortField];
      let valB = sortField === 'VL_TITULO' ? getValorExibido(b) : b[sortField];

      if (valA === null || valA === undefined) return sortAsc ? -1 : 1;
      if (valB === null || valB === undefined) return sortAsc ? 1 : -1;

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortAsc ? valA - valB : valB - valA;
      }

      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();

      if (strA < strB) return sortAsc ? -1 : 1;
      if (strA > strB) return sortAsc ? 1 : -1;
      return 0;
    });

    return result;
  }, [titulos, searchTerm, selectedFornecedores, sortField, sortAsc]);

  // KPIs Calculations
  const kpis = useMemo(() => {
    let totalValor = 0;
    let totalLiquidado = 0;
    let totalAberto = 0;

    titulosFiltrados.forEach(t => {
      const valor = getValorExibido(t);
      totalValor += valor;
      if (t.IE_SITUACAO === 'L') {
        totalLiquidado += valor;
      } else {
        totalAberto += valor;
      }
    });

    return {
      totalValor,
      totalLiquidado,
      totalAberto,
      count: titulosFiltrados.length
    };
  }, [titulosFiltrados]);

  // Chart data: Monthly costs and average calculation
  const { monthlyChartData, averageMonthlyCost } = useMemo(() => {
    const dataMap: Record<string, number> = {};
    
    // Calculate total months in the filtered period using parseTasyDate
    const fromDate = parseTasyDate(periodFrom) || new Date();
    const toDate = parseTasyDate(periodTo) || new Date();
    let totalMonths = 1;
    if (fromDate && toDate && !isNaN(fromDate.getTime()) && !isNaN(toDate.getTime())) {
      const yearsDiff = toDate.getFullYear() - fromDate.getFullYear();
      const monthsDiff = toDate.getMonth() - fromDate.getMonth();
      totalMonths = (yearsDiff * 12) + monthsDiff + 1;
      if (totalMonths <= 0) totalMonths = 1;
    }

    // Group titles by month
    titulosFiltrados.forEach(t => {
      if (!t.DT_EMISSAO) return;
      const date = parseTasyDate(t.DT_EMISSAO);
      if (!date || isNaN(date.getTime())) return;
      
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const key = `${year}-${month}`;
      
      dataMap[key] = (dataMap[key] || 0) + getValorExibido(t);
    });

    // Generate all months in the selected period to show continuous zero costs if applicable
    if (fromDate && toDate && !isNaN(fromDate.getTime()) && !isNaN(toDate.getTime())) {
      const current = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1);
      const end = new Date(toDate.getFullYear(), toDate.getMonth(), 1);
      let limit = 0;
      while (current <= end && limit < 120) {
        const year = current.getFullYear();
        const month = String(current.getMonth() + 1).padStart(2, '0');
        const key = `${year}-${month}`;
        if (dataMap[key] === undefined) {
          dataMap[key] = 0;
        }
        current.setMonth(current.getMonth() + 1);
        limit++;
      }
    }

    // Convert to sorted list
    const sortedKeys = Object.keys(dataMap).sort();
    const monthsAbbr = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    
    const chartData = sortedKeys.map(key => {
      const [year, monthStr] = key.split('-');
      const monthIdx = parseInt(monthStr, 10) - 1;
      const yearShort = year.substring(2);
      const label = `${monthsAbbr[monthIdx]}/${yearShort}`;
      return {
        name: label,
        value: dataMap[key]
      };
    });

    const totalVal = titulosFiltrados.reduce((acc, t) => acc + getValorExibido(t), 0);
    const avg = totalVal / totalMonths;

    return {
      monthlyChartData: chartData,
      averageMonthlyCost: avg
    };
  }, [titulosFiltrados, periodFrom, periodTo]);

  // MoM (Month over Month) Growth metrics
  const momMetrics = useMemo(() => {
    if (monthlyChartData.length < 2) return { percentage: null, valueDiff: 0, label: '' };
    const lastMonth = monthlyChartData[monthlyChartData.length - 1];
    const prevMonth = monthlyChartData[monthlyChartData.length - 2];
    
    if (!prevMonth || prevMonth.value === 0) return { percentage: null, valueDiff: 0, label: '' };
    
    const diff = lastMonth.value - prevMonth.value;
    const pct = (diff / prevMonth.value) * 100;
    return {
      percentage: pct,
      valueDiff: diff,
      label: `${lastMonth.name} vs ${prevMonth.name}`
    };
  }, [monthlyChartData]);

  // Chart data: Costs grouped by Company (Empresa)
  const empresaChartData = useMemo(() => {
    const dataMap: Record<string, number> = {};
    titulosFiltrados.forEach(t => {
      const emp = t.Empresa;
      dataMap[emp] = (dataMap[emp] || 0) + getValorExibido(t);
    });

    return Object.entries(dataMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6); // Top 6 companies
  }, [titulosFiltrados]);

  // Pagination slice
  const paginatedTitulos = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return titulosFiltrados.slice(start, start + itemsPerPage);
  }, [titulosFiltrados, currentPage]);

  const totalPages = Math.ceil(titulosFiltrados.length / itemsPerPage);

  // Export PDF Report
  const handleExportPDF = async () => {
    const doc = new jsPDF();
    
    try {
      const img = new Image();
      img.src = '/LOGO_HSC_PRIMARY.png';
      await new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
      });
      doc.addImage(img, 'PNG', 14, 10, 45, 12);
    } catch (e) {
      console.error('Erro logo PDF:', e);
    }

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Relatório de Contas a Pagar - TI', 14, 32);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(`Emitido em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, 38);
    
    const activeFilters = [];
    if (situacaoFilter !== 'Todos') activeFilters.push(`Situação: ${getStatusLabel(situacaoFilter)}`);
    if (periodFrom || periodTo) {
      const format = (p: string) => p.split('-').reverse().join('/');
      activeFilters.push(`Período: ${format(periodFrom)} a ${format(periodTo)}`);
    }

    if (activeFilters.length > 0) {
      doc.text(`Filtros Ativos: ${activeFilters.join(' | ')}`, 14, 43);
    }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text('Resumo dos Custos', 14, 52);

    autoTable(doc, {
      startY: 56,
      head: [['Total de Títulos', 'Valor Total', 'Total Liquidado', 'Total em Aberto']],
      body: [[
        kpis.count.toString(),
        formatCurrency(kpis.totalValor),
        formatCurrency(kpis.totalLiquidado),
        formatCurrency(kpis.totalAberto)
      ]],
      theme: 'grid',
      headStyles: { fillColor: [90, 16, 16], halign: 'center' },
      columnStyles: {
        0: { halign: 'center', fontStyle: 'bold' },
        1: { halign: 'center' },
        2: { halign: 'center' },
        3: { halign: 'center', fontStyle: 'bold' }
      }
    });

    const nextY = (doc as any).lastAutoTable.finalY + 12;
    doc.text('Detalhamento de Títulos', 14, nextY);

    const tableBody = titulosFiltrados.map(t => [
      t.nr_titulo,
      t.NR_DOCUMENTO || '-',
      isValidEmpresa(t.Empresa) 
        ? (t.Nome ? `${t.Empresa.toUpperCase()} / ${t.Nome.toUpperCase()}` : t.Empresa.toUpperCase()) 
        : (t.Nome ? t.Nome.toUpperCase() : 'SEM EMPRESA'),
      t.ds_centro_custo,
      formatDate(t.DT_EMISSAO),
      formatDate(t.DT_LIQUIDACAO),
      formatCurrency(getValorExibido(t)),
      getStatusLabel(t.IE_SITUACAO)
    ]);

    autoTable(doc, {
      startY: nextY + 4,
      head: [['Título', 'Doc.', 'Fornecedor / Favorecido', 'Centro de Custo', 'Emissão', 'Liquidação', 'Valor', 'Status']],
      body: tableBody,
      theme: 'striped',
      headStyles: { fillColor: [90, 16, 16] },
      columnStyles: {
        0: { halign: 'center' },
        1: { halign: 'center' },
        4: { halign: 'center' },
        5: { halign: 'center' },
        6: { halign: 'right', fontStyle: 'bold' },
        7: { halign: 'center' }
      }
    });

    doc.save(`HSC_Relatorio_Custos_TI_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // Export CSV/Excel
  const handleExportCSV = () => {
    const headers = ['Titulo', 'Documento', 'Fornecedor_PJ', 'Nome_PF', 'Centro_Custo', 'Dt_Emissao', 'Dt_Liquidacao', 'Valor', 'Valor_Baixa', 'Situacao', 'Observacao'];
    const rows = titulosFiltrados.map(t => [
      t.nr_titulo,
      t.NR_DOCUMENTO || '',
      t.Empresa,
      t.Nome || '',
      t.ds_centro_custo,
      t.DT_EMISSAO.split('T')[0],
      t.DT_LIQUIDACAO ? t.DT_LIQUIDACAO.split('T')[0] : '',
      getValorExibido(t),
      t.VL_BAIXA !== undefined && t.VL_BAIXA !== null ? t.VL_BAIXA : '',
      getStatusLabel(t.IE_SITUACAO),
      t.DS_OBSERVACAO_TITULO || ''
    ]);

    const csvContent = 
      'data:text/csv;charset=utf-8,\uFEFF' + 
      [headers.join(';'), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(';'))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `HSC_Custos_TI_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 w-full px-[40px] max-w-none pb-12 animate-in fade-in duration-500 bg-background text-foreground">
      
      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border/60 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-[#8a1515]/10 flex items-center justify-center border border-[#8a1515]/20 text-[#8a1515] dark:text-[#f43f5e]">
              <Coins className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground font-sans">Custos TI</h1>
              <p className="text-sm text-muted-foreground mt-0.5 font-sans">Gerenciamento e conciliação de contas a pagar e despesas do escopo fixo de TI</p>
            </div>
          </div>
        </div>

        {/* Sync Status Info */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
          <div className="flex items-center gap-2 bg-muted/60 dark:bg-slate-900 border border-border px-3 py-1.5 rounded-lg text-xs">
            <span className="flex h-2 w-2 relative">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                syncStatus === 'success' ? 'bg-emerald-400' : syncStatus === 'error' ? 'bg-rose-400' : 'bg-amber-400'
              }`} />
              <span className={`relative inline-flex rounded-full h-2 w-2 ${
                syncStatus === 'success' ? 'bg-emerald-500' : syncStatus === 'error' ? 'bg-rose-500' : 'bg-amber-500'
              }`} />
            </span>
            <span className="font-medium text-muted-foreground font-sans">
              {syncStatus === 'success' ? `Atualizado às ${syncTime}` : syncStatus === 'error' ? 'Erro de Sincronismo' : 'Buscando dados...'}
            </span>
          </div>

          <button
            onClick={() => fetchTitulos(true, true)}
            disabled={loading}
            className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/95 font-medium text-xs px-3.5 py-2 rounded-lg transition-all active:scale-[0.98] disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="font-sans">Atualizar</span>
          </button>
        </div>
      </div>

      {/* ── FILTROS ── */}
      <div className="bg-card dark:bg-slate-950 border border-border/80 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-border/40 pb-3">
          <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
            <Filter className="h-4 w-4 text-primary" />
            <span className="font-sans">Filtros de Pesquisa</span>
          </div>
          {(searchTerm || selectedFornecedores.length > 0 || situacaoFilter !== 'L' || periodFrom !== getDefaultDates().from || periodTo !== getDefaultDates().to) && (
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedFornecedores([]);
                setSituacaoFilter('L');
                const defaults = getDefaultDates();
                setPeriodFrom(defaults.from);
                setPeriodTo(defaults.to);
              }}
              className="text-xs text-primary hover:underline flex items-center gap-1 font-medium font-sans"
            >
              <X className="h-3 w-3" />
              Limpar Filtros
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
          {/* Data Início */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1 font-sans">
              <Calendar className="h-3.5 w-3.5" />
              Data Emissão (Início)
            </label>
            <input
              type="date"
              value={periodFrom}
              onChange={(e) => setPeriodFrom(e.target.value)}
              className="w-full bg-background border border-border hover:border-muted-foreground/40 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-3 py-2 text-sm text-foreground outline-none transition-colors"
            />
          </div>

          {/* Data Fim */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1 font-sans">
              <Calendar className="h-3.5 w-3.5" />
              Data Emissão (Fim)
            </label>
            <input
              type="date"
              value={periodTo}
              onChange={(e) => setPeriodTo(e.target.value)}
              className="w-full bg-background border border-border hover:border-muted-foreground/40 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-3 py-2 text-sm text-foreground outline-none transition-colors"
            />
          </div>

          {/* Situação */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1 font-sans">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Situação do Título
            </label>
            <select
              value={situacaoFilter}
              onChange={(e) => setSituacaoFilter(e.target.value)}
              className="w-full bg-background border border-border hover:border-muted-foreground/40 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-3 py-2 text-sm text-foreground outline-none transition-colors"
            >
              <option value="Todos">Todos</option>
              <option value="A">Em Aberto</option>
              <option value="L">Liquidado</option>
            </select>
          </div>

          {/* Fornecedores (Multi-seleção) */}
          <div className="flex flex-col gap-1.5" ref={dropdownRef}>
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1 font-sans">
              <Building className="h-3.5 w-3.5" />
              Fornecedores
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsFornecedoresOpen(!isFornecedoresOpen)}
                className="w-full flex items-center justify-between bg-background border border-border hover:border-muted-foreground/40 rounded-lg px-3 py-2 text-sm text-foreground outline-none transition-colors text-left font-sans"
              >
                <span className="truncate">
                  {selectedFornecedores.length === 0
                    ? 'Todos os fornecedores'
                    : selectedFornecedores.length === 1
                    ? selectedFornecedores[0]
                    : `${selectedFornecedores.length} selecionados`}
                </span>
                <ChevronDown className="h-4 w-4 text-muted-foreground/60 flex-shrink-0 ml-1" />
              </button>

              <AnimatePresence>
                {isFornecedoresOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 sm:left-0 z-50 mt-1 w-[280px] bg-card dark:bg-slate-900 border border-border rounded-lg shadow-xl p-3 space-y-2 focus:outline-none"
                  >
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Buscar fornecedor..."
                        value={fornecedorSearch}
                        onChange={(e) => setFornecedorSearch(e.target.value)}
                        className="w-full bg-background border border-border rounded-md pl-8 pr-3 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                      />
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground/60" />
                    </div>

                    <div className="flex justify-between text-[10px] border-b border-border/40 pb-1.5 px-1">
                      <button
                        type="button"
                        onClick={() => setSelectedFornecedores(fornecedoresDisponiveis)}
                        className="text-primary hover:underline font-semibold font-sans"
                      >
                        Selecionar Todos
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedFornecedores([])}
                        className="text-muted-foreground hover:underline font-semibold font-sans"
                      >
                        Limpar
                      </button>
                    </div>

                    <div className="max-h-[180px] overflow-y-auto space-y-0.5 pr-1 custom-scrollbar">
                      {fornecedoresFiltrados.length === 0 ? (
                        <div className="text-center py-4 text-xs text-muted-foreground font-sans">
                          Nenhum fornecedor encontrado
                        </div>
                      ) : (
                        fornecedoresFiltrados.map((forn) => {
                          const isSelected = selectedFornecedores.includes(forn);
                          return (
                            <button
                              key={forn}
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedFornecedores(selectedFornecedores.filter((f) => f !== forn));
                                } else {
                                  setSelectedFornecedores([...selectedFornecedores, forn]);
                                }
                              }}
                              className="w-full flex items-center gap-2 rounded px-2 py-1.5 text-xs text-left hover:bg-muted dark:hover:bg-slate-800 transition-colors text-foreground font-sans"
                            >
                              <div className={`h-3.5 w-3.5 rounded border border-border flex items-center justify-center flex-shrink-0 transition-colors ${
                                isSelected ? 'bg-primary border-primary text-primary-foreground' : 'bg-background'
                              }`}>
                                {isSelected && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                              </div>
                              <span className="truncate" title={forn}>{forn}</span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Busca Geral */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1 font-sans">
              <Search className="h-3.5 w-3.5" />
              Pesquisa Livre
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Título, fornecedor, observação..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-background border border-border hover:border-muted-foreground/40 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg pl-9 pr-3 py-2 text-sm text-foreground outline-none transition-colors"
              />
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/60" />
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI: Total Custos */}
        <div className="bg-card dark:bg-slate-950 border border-border/80 rounded-xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground tracking-wide uppercase font-sans">Total Custos TI</span>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-2xl font-bold tracking-tight text-foreground font-sans">{formatCurrency(kpis.totalValor)}</h3>
                {momMetrics.percentage !== null && (
                  <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    momMetrics.percentage > 0 
                      ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400' 
                      : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  }`} title={`Variação do último mês (${momMetrics.label})`}>
                    {momMetrics.percentage > 0 ? '▲' : '▼'} {Math.abs(momMetrics.percentage).toFixed(1)}% MoM
                  </span>
                )}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-sans">Títulos Conciliados</span>
            <span className="font-bold text-foreground font-sans">{kpis.count} títulos</span>
          </div>
        </div>

        {/* KPI: Total Liquidado */}
        <div className="bg-card dark:bg-slate-950 border border-border/80 rounded-xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground tracking-wide uppercase font-sans">Total Pago / Liquidado</span>
              <h3 className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 font-sans">{formatCurrency(kpis.totalLiquidado)}</h3>
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-sans">Percentual Pago</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400 font-sans">
              {kpis.totalValor > 0 ? `${((kpis.totalLiquidado / kpis.totalValor) * 100).toFixed(1)}%` : '0%'}
            </span>
          </div>
        </div>

        {/* KPI: Total em Aberto */}
        <div className="bg-card dark:bg-slate-950 border border-border/80 rounded-xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground tracking-wide uppercase font-sans">Total em Aberto</span>
              <h3 className="text-2xl font-bold tracking-tight text-amber-500 dark:text-amber-400 font-sans">{formatCurrency(kpis.totalAberto)}</h3>
            </div>
            <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-500 dark:text-amber-400">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-sans">Percentual Aberto</span>
            <span className="font-bold text-amber-500 dark:text-amber-400 font-sans">
              {kpis.totalValor > 0 ? `${((kpis.totalAberto / kpis.totalValor) * 100).toFixed(1)}%` : '0%'}
            </span>
          </div>
        </div>

        {/* KPI: Custo Médio Mensal */}
        <div className="bg-card dark:bg-slate-950 border border-border/80 rounded-xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground tracking-wide uppercase font-sans">Custo Médio Mensal</span>
              <h3 className="text-2xl font-bold tracking-tight text-foreground font-sans">{formatCurrency(averageMonthlyCost || 0)}</h3>
            </div>
            <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <BarChart3 className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-sans">Período Selecionado</span>
            <span className="font-bold text-foreground font-sans">
              {monthlyChartData.length} {monthlyChartData.length === 1 ? 'mês' : 'meses'}
            </span>
          </div>
        </div>
      </div>

      {/* ── GRÁFICOS VISUAIS ── */}
      {!loading && titulosFiltrados.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Gráfico: Média Mensal de Custos */}
          <div className="bg-card dark:bg-slate-950 border border-border rounded-xl p-5 shadow-sm">
            <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2 font-sans">
              <TrendingUp className="h-4 w-4 text-primary" />
              Média Mensal e Evolução de Custos (BRL)
            </h3>
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyChartData} margin={{ top: 20, right: 15, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128,128,128,0.1)" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 10 }} 
                    stroke="rgba(128,128,128,0.5)"
                  />
                  <YAxis 
                    tickFormatter={(value) => formatCompactCurrency(value)}
                    tick={{ fontSize: 10 }}
                    stroke="rgba(128,128,128,0.5)"
                  />
                  <Tooltip 
                    formatter={(value: any) => [formatCurrency(Number(value)), 'Gasto Total']}
                    labelStyle={{ fontSize: 11, fontWeight: 'bold' }}
                    contentStyle={{ borderRadius: '8px', padding: '10px' }}
                  />
                  <Bar dataKey="value" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                  {averageMonthlyCost > 0 && (
                    <ReferenceLine 
                      y={averageMonthlyCost} 
                      stroke="#ef4444" 
                      strokeDasharray="5 5" 
                      strokeWidth={2}
                      label={{ 
                        value: `Média: ${formatCompactCurrency(averageMonthlyCost)}`, 
                        position: 'top', 
                        fill: '#ef4444',
                        fontSize: 10,
                        fontWeight: 'bold'
                      }} 
                    />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Gráfico: Top Fornecedores / Empresas */}
          <div className="bg-card dark:bg-slate-950 border border-border rounded-xl p-5 shadow-sm">
            <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2 font-sans">
              <PieChart className="h-4 w-4 text-primary" />
              Distribuição por Empresa (Top 6 PJ)
            </h3>
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ReChartsPie>
                  <Pie
                    data={empresaChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                    nameKey="name"
                  >
                    {empresaChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any, name: any) => [formatCurrency(Number(value)), name]} />
                  <Legend 
                    layout="vertical" 
                    verticalAlign="middle" 
                    align="right"
                    wrapperStyle={{ fontSize: '10px', paddingLeft: '10px' }}
                    formatter={(value) => value.length > 20 ? `${value.substring(0, 18)}...` : value}
                  />
                </ReChartsPie>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ── TABELA DE DADOS ── */}
      <div className="bg-card dark:bg-slate-950 border border-border rounded-xl shadow-sm overflow-hidden">
        {/* Tabela Header & Exports */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-5 border-b border-border gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-foreground font-sans">Listagem de Contas a Pagar</h2>
            <span className="text-xs bg-primary/10 text-primary dark:text-[#f43f5e] font-semibold px-2 py-0.5 rounded-full font-sans">
              {titulosFiltrados.length} títulos
            </span>
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={handleExportPDF}
              disabled={loading || titulosFiltrados.length === 0}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-muted dark:bg-slate-900 border border-border hover:bg-muted/80 text-foreground font-semibold text-xs px-3.5 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              <FileText className="h-3.5 w-3.5 text-primary" />
              <span className="font-sans">PDF Executivo</span>
            </button>
            <button
              onClick={handleExportCSV}
              disabled={loading || titulosFiltrados.length === 0}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-muted dark:bg-slate-900 border border-border hover:bg-muted/80 text-foreground font-semibold text-xs px-3.5 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              <ArrowUpRight className="h-3.5 w-3.5 text-[#10b981]" />
              <span className="font-sans">Exportar CSV</span>
            </button>
          </div>
        </div>

        {/* Tabela Principal */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <RefreshCw className="h-8 w-8 text-primary animate-spin" />
              <span className="text-sm text-muted-foreground font-sans">Buscando lançamentos no banco de dados Oracle...</span>
            </div>
          ) : titulosFiltrados.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <AlertCircle className="h-10 w-10 text-muted-foreground/60 mb-2" />
              <h3 className="text-sm font-bold text-foreground font-sans">Nenhum título encontrado</h3>
              <p className="text-xs text-muted-foreground max-w-sm mt-1 font-sans">
                Não localizamos títulos com os filtros aplicados. Tente alterar o período ou os termos de pesquisa livre.
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted/40 dark:bg-slate-900/50 border-b border-border text-xs font-semibold text-muted-foreground">
                  <th className="p-4 text-center cursor-pointer select-none font-sans hover:text-foreground" onClick={() => handleSort('nr_titulo')}>
                    Título {sortField === 'nr_titulo' && (sortAsc ? '↑' : '↓')}
                  </th>
                  <th className="p-4 text-center cursor-pointer select-none font-sans hover:text-foreground" onClick={() => handleSort('NR_DOCUMENTO')}>
                    Documento {sortField === 'NR_DOCUMENTO' && (sortAsc ? '↑' : '↓')}
                  </th>
                  <th className="p-4 cursor-pointer select-none font-sans hover:text-foreground" onClick={() => handleSort('Empresa')}>
                    Fornecedor / Favorecido {sortField === 'Empresa' && (sortAsc ? '↑' : '↓')}
                  </th>
                  <th className="p-4 cursor-pointer select-none font-sans hover:text-foreground" onClick={() => handleSort('ds_centro_custo')}>
                    Centro de Custo {sortField === 'ds_centro_custo' && (sortAsc ? '↑' : '↓')}
                  </th>
                  <th className="p-4 text-center cursor-pointer select-none font-sans hover:text-foreground" onClick={() => handleSort('DT_EMISSAO')}>
                    Emissão {sortField === 'DT_EMISSAO' && (sortAsc ? '↑' : '↓')}
                  </th>
                  <th className="p-4 text-center cursor-pointer select-none font-sans hover:text-foreground" onClick={() => handleSort('DT_LIQUIDACAO')}>
                    Liquidação {sortField === 'DT_LIQUIDACAO' && (sortAsc ? '↑' : '↓')}
                  </th>
                  <th className="p-4 text-right cursor-pointer select-none font-sans hover:text-foreground" onClick={() => handleSort('VL_TITULO')}>
                    Valor {sortField === 'VL_TITULO' && (sortAsc ? '↑' : '↓')}
                  </th>
                  <th className="p-4 text-center cursor-pointer select-none font-sans hover:text-foreground" onClick={() => handleSort('IE_SITUACAO')}>
                    Situação {sortField === 'IE_SITUACAO' && (sortAsc ? '↑' : '↓')}
                  </th>
                  <th className="p-4 text-center font-sans">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 text-sm">
                {paginatedTitulos.map((t) => (
                  <tr 
                    key={t.nr_titulo} 
                    className="hover:bg-muted/20 dark:hover:bg-slate-900/20 transition-colors"
                  >
                    <td className="p-4 text-center font-mono text-xs font-semibold text-foreground">{t.nr_titulo}</td>
                    <td className="p-4 text-center font-sans text-xs text-muted-foreground">{t.NR_DOCUMENTO || '-'}</td>
                    <td className="p-4 font-sans font-medium text-foreground max-w-[200px] truncate" title={
                      isValidEmpresa(t.Empresa) 
                        ? (t.Nome ? `${t.Empresa.toUpperCase()} (${t.Nome.toUpperCase()})` : t.Empresa.toUpperCase()) 
                        : (t.Nome ? t.Nome.toUpperCase() : 'SEM EMPRESA')
                    }>
                      <div className="flex flex-col">
                        <span className="truncate font-semibold text-foreground text-xs tracking-wide">
                          {isValidEmpresa(t.Empresa) 
                            ? t.Empresa.toUpperCase() 
                            : (t.Nome ? t.Nome.toUpperCase() : 'SEM EMPRESA')}
                        </span>
                        {t.Nome && isValidEmpresa(t.Empresa) && (
                          <span className="text-[10px] text-muted-foreground truncate font-normal tracking-wide mt-0.5">
                            {t.Nome.toUpperCase()}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 font-sans text-xs text-muted-foreground max-w-[200px] truncate" title={t.ds_centro_custo}>{t.ds_centro_custo}</td>
                    <td className="p-4 text-center font-sans text-xs">{formatDate(t.DT_EMISSAO)}</td>
                    <td className="p-4 text-center font-sans text-xs text-muted-foreground">{formatDate(t.DT_LIQUIDACAO)}</td>
                    <td className="p-4 text-right font-sans font-bold text-foreground">
                      <div className="flex items-center justify-end gap-1.5 font-sans">
                        {t.IE_SITUACAO === 'L' && t.VL_BAIXA !== undefined && t.VL_BAIXA !== t.VL_TITULO && (
                          <span 
                            className="text-[9px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1 py-0.5 rounded font-medium cursor-help"
                            title={`Título original: ${formatCurrency(t.VL_TITULO)} (Liquidado por valor ${t.VL_BAIXA > t.VL_TITULO ? 'maior' : 'menor'})`}
                          >
                            Pago R$
                          </span>
                        )}
                        <span>{formatCurrency(getValorExibido(t))}</span>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium font-sans ${
                        t.IE_SITUACAO === 'L' 
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                      }`}>
                        {t.IE_SITUACAO === 'L' ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <Clock className="h-3 w-3" />
                        )}
                        {getStatusLabel(t.IE_SITUACAO)}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <div className="relative inline-flex items-center justify-center gap-1.5 group">
                        <button
                          onClick={() => setSelectedTitulo(t)}
                          className="text-xs text-primary hover:underline font-semibold font-sans"
                        >
                          Detalhes
                        </button>
                        {t.DS_OBSERVACAO_TITULO && (
                          <div className="relative flex items-center justify-center">
                            <FileText className="h-3.5 w-3.5 text-muted-foreground/60 hover:text-primary transition-colors cursor-help" />
                            {/* Premium Popover Tooltip */}
                            <div className="absolute bottom-full right-0 mb-2 hidden group-hover:flex flex-col w-64 bg-card dark:bg-slate-900 border border-border shadow-xl rounded-lg p-3 z-50 text-left pointer-events-none animate-in fade-in slide-in-from-bottom-2 duration-200">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Observação</span>
                              <p className="text-xs text-foreground font-normal leading-relaxed break-words font-sans">
                                {t.DS_OBSERVACAO_TITULO}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Paginação */}
        {!loading && totalPages > 1 && (
          <div className="flex justify-between items-center p-4 border-t border-border/60 bg-muted/20 dark:bg-slate-900/20 text-xs">
            <span className="text-muted-foreground font-sans">
              Mostrando página <span className="font-bold text-foreground">{currentPage}</span> de <span className="font-bold text-foreground">{totalPages}</span> ({titulosFiltrados.length} lançamentos no total)
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-border hover:bg-muted/80 text-foreground disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-border hover:bg-muted/80 text-foreground disabled:opacity-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── MODAL DE DETALHES ── */}
      <AnimatePresence>
        {selectedTitulo && (
          <div className="fixed inset-0 bg-black/65 flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card dark:bg-slate-950 border border-border/80 rounded-xl shadow-xl w-full max-w-lg overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex justify-between items-center p-5 border-b border-border bg-muted/40 dark:bg-slate-900/50">
                <div className="flex items-center gap-2">
                  <Coins className="h-5 w-5 text-primary" />
                  <h3 className="text-base font-bold text-foreground font-sans">Detalhamento do Título</h3>
                </div>
                <button 
                  onClick={() => setSelectedTitulo(null)}
                  className="p-1 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs font-semibold text-muted-foreground block font-sans">Número do Título</span>
                    <span className="font-mono font-bold text-foreground text-sm">{selectedTitulo.nr_titulo}</span>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-muted-foreground block font-sans">Número do Documento</span>
                    <span className="font-sans text-foreground text-sm">{selectedTitulo.NR_DOCUMENTO || '-'}</span>
                  </div>
                </div>

                <div className="border-t border-border/60 my-2" />

                <div>
                  <span className="text-xs font-semibold text-muted-foreground block font-sans">Fornecedor / Credor PJ</span>
                  <span className="font-sans text-foreground text-sm font-semibold block mt-0.5">{selectedTitulo.Empresa.toUpperCase()}</span>
                </div>

                {selectedTitulo.Nome && (
                  <div>
                    <span className="text-xs font-semibold text-muted-foreground block font-sans">Pessoa Física / Beneficiário</span>
                    <span className="font-sans text-foreground text-sm font-semibold block mt-0.5 text-primary dark:text-[#f43f5e]">{selectedTitulo.Nome.toUpperCase()}</span>
                  </div>
                )}

                <div>
                  <span className="text-xs font-semibold text-muted-foreground block font-sans">Centro de Custo</span>
                  <span className="font-sans text-foreground text-sm block mt-0.5">{selectedTitulo.ds_centro_custo}</span>
                </div>

                <div className="border-t border-border/60 my-2" />

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs font-semibold text-muted-foreground block font-sans">Data de Emissão</span>
                    <span className="font-sans text-foreground text-sm block mt-0.5">{formatDate(selectedTitulo.DT_EMISSAO)}</span>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-muted-foreground block font-sans">Data de Liquidação</span>
                    <span className="font-sans text-foreground text-sm block mt-0.5">{formatDate(selectedTitulo.DT_LIQUIDACAO)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-1">
                  <div>
                    <span className="text-xs font-semibold text-muted-foreground block font-sans">Valor do Título</span>
                    <span className="font-sans font-bold text-foreground text-base block mt-0.5">{formatCurrency(selectedTitulo.VL_TITULO)}</span>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-muted-foreground block font-sans">Situação</span>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium font-sans mt-1.5 ${
                      selectedTitulo.IE_SITUACAO === 'L' 
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                    }`}>
                      {selectedTitulo.IE_SITUACAO === 'L' ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                      {getStatusLabel(selectedTitulo.IE_SITUACAO)}
                    </span>
                  </div>
                </div>

                {selectedTitulo.IE_SITUACAO === 'L' && selectedTitulo.VL_BAIXA !== undefined && (
                  <div className="grid grid-cols-2 gap-4 pt-1">
                    <div>
                      <span className="text-xs font-semibold text-muted-foreground block font-sans">Valor de Baixa</span>
                      <span className="font-sans font-bold text-emerald-600 dark:text-emerald-400 text-base block mt-0.5">{formatCurrency(selectedTitulo.VL_BAIXA)}</span>
                    </div>
                    {selectedTitulo.VL_BAIXA > selectedTitulo.VL_TITULO && (
                      <div className="flex items-end pb-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium font-sans">
                        * Liquidado por valor maior
                      </div>
                    )}
                  </div>
                )}

                {selectedTitulo.DS_OBSERVACAO_TITULO && (
                  <>
                    <div className="border-t border-border/60 my-2" />
                    <div>
                      <span className="text-xs font-semibold text-muted-foreground block font-sans">Observações do Título</span>
                      <p className="font-sans text-foreground text-xs leading-relaxed mt-1.5 bg-muted/40 dark:bg-slate-900/60 p-3 rounded-lg border border-border/50 max-h-[120px] overflow-y-auto">
                        {selectedTitulo.DS_OBSERVACAO_TITULO}
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end p-4 border-t border-border bg-muted/20 dark:bg-slate-900/20">
                <button
                  onClick={() => setSelectedTitulo(null)}
                  className="bg-muted dark:bg-slate-800 hover:bg-muted/80 text-foreground font-semibold text-xs px-4 py-2 rounded-lg transition-colors border border-border font-sans"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CustosTI;
