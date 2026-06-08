import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  DollarSign, Search, Filter, RefreshCw, FileText, 
  Calendar, CheckCircle2, Clock, AlertCircle, FileSpreadsheet 
} from 'lucide-react';
import { webhookService } from '../../services/webhookService';
import { supabase } from '../../lib/supabase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// ── Interface de dados do Faturamento ──
export interface FaturamentoProtocolo {
  nrProtocolo: string;        // NR_PROTOCOLO (VARCHAR2)
  convenio: string;          // CONVENIO
  ieStatusProtocolo: number; // IE_STATUS_PROTOCOLO
  dtMesanoReferencia: string;// DT_MESANO_REFERENCIA
  valor: number;             // VALOR (OBTER_TOTAL_PROTOCOLO)
  sus: number;               // SUS (SUS_OBTER_VALOR_PROTOCOLO)
}

// ── Mock de Faturamento para Fallback ──
const generateMockFaturamentos = (): FaturamentoProtocolo[] => {
  return [
    { nrProtocolo: '100234', convenio: 'SUS - Sistema Único de Saúde', ieStatusProtocolo: 2, dtMesanoReferencia: '04/2026', valor: 0, sus: 345000.50 },
    { nrProtocolo: '100235', convenio: 'UNIMED INTERCAMBIO', ieStatusProtocolo: 2, dtMesanoReferencia: '04/2026', valor: 125430.20, sus: 0 },
    { nrProtocolo: '100236', convenio: 'BRADESCO SAUDE', ieStatusProtocolo: 1, dtMesanoReferencia: '04/2026', valor: 98450.00, sus: 0 },
    { nrProtocolo: '100237', convenio: 'SULAMERICA', ieStatusProtocolo: 1, dtMesanoReferencia: '05/2026', valor: 75200.00, sus: 0 },
    { nrProtocolo: '100238', convenio: 'SUS - AIH CLINICA', ieStatusProtocolo: 2, dtMesanoReferencia: '05/2026', valor: 0, sus: 412000.00 },
    { nrProtocolo: '100239', convenio: 'CASSI', ieStatusProtocolo: 2, dtMesanoReferencia: '05/2026', valor: 45300.00, sus: 0 },
    { nrProtocolo: '100240', convenio: 'IPSEMG', ieStatusProtocolo: 1, dtMesanoReferencia: '05/2026', valor: 62100.80, sus: 0 },
    { nrProtocolo: '100241', convenio: 'SUS - HOSP. DIA', ieStatusProtocolo: 1, dtMesanoReferencia: '05/2026', valor: 0, sus: 189300.25 },
    { nrProtocolo: '100242', convenio: 'GOLDEN CROSS', ieStatusProtocolo: 2, dtMesanoReferencia: '04/2026', valor: 31200.00, sus: 0 },
    { nrProtocolo: '100243', convenio: 'ALLIANZ SAUDE', ieStatusProtocolo: 1, dtMesanoReferencia: '04/2026', valor: 18900.50, sus: 0 }
  ];
};

// Auxiliar para detectar convênio SUS
const isSusConvenio = (convenioName: string): boolean => {
  return convenioName.toUpperCase().includes('SUS');
};

// Auxiliar para obter valor correto por protocolo
const getProtocoloValor = (item: FaturamentoProtocolo): number => {
  return isSusConvenio(item.convenio) ? item.sus : item.valor;
};

// Auxiliar para formatar moeda brasileira
const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
};

// Auxiliar para formatar moeda de forma compacta (K, M) no gráfico
const formatCompactCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
    compactDisplay: 'short'
  }).format(value);
};

// Auxiliar para converter formato de referência em data para comparação de períodos
const parseReferenceMonth = (str: string): Date | null => {
  if (!str) return null;
  
  // Formato: YYYY-MM-DD (de input date)
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [year, month] = str.split('-').map(Number);
    return new Date(year, month - 1, 1);
  }
  
  // Formato: YYYY-MM
  if (/^\d{4}-\d{2}$/.test(str)) {
    const [year, month] = str.split('-').map(Number);
    return new Date(year, month - 1, 1);
  }
  
  // Formato: MM/YYYY
  if (/^\d{2}\/\d{4}$/.test(str)) {
    const [month, year] = str.split('/').map(Number);
    return new Date(year, month - 1, 1);
  }
  
  // Formato: data ISO
  const parsed = Date.parse(str);
  if (!isNaN(parsed)) {
    const d = new Date(parsed);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }
  
  return null;
};

// Auxiliar para obter a data padrão de consulta (último dia do mês retrasado até o último dia do mês anterior)
const getDefaultDates = () => {
  const today = new Date();
  // Último dia do mês anterior (dia 0 do mês atual)
  const lastDayOfPrevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
  // Último dia do mês retrasado (dia 0 do mês anterior)
  const lastDayOfTwoMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 1, 0);

  const formatYYYYMMDD = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  return {
    from: formatYYYYMMDD(lastDayOfTwoMonthsAgo),
    to: formatYYYYMMDD(lastDayOfPrevMonth)
  };
};

const ConsultaFaturamentos: React.FC = () => {
  const [data, setData] = useState<FaturamentoProtocolo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [syncTime, setSyncTime] = useState<string | null>(null);

  // Filtros
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [convenioFilter, setConvenioFilter] = useState<string>('Todos');
  const [statusFilter, setStatusFilter] = useState<string>('Todos');
  
  // Filtros de período (Mesmo formato de Gestão de Pendência: date)
  const [periodFrom, setPeriodFrom] = useState<string>(() => getDefaultDates().from);
  const [periodTo, setPeriodTo] = useState<string>(() => getDefaultDates().to);

  // Paginação
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 10;

  // ── Utilitários de Cache de Sessão (sessionStorage) ──
  const saveToCache = (
    dataList: FaturamentoProtocolo[],
    time: string | null,
    isDemo: boolean,
    status: 'idle' | 'success' | 'error',
    from: string,
    to: string
  ) => {
    try {
      sessionStorage.setItem('hsc_faturamentos_cache_data', JSON.stringify(dataList));
      if (time) sessionStorage.setItem('hsc_faturamentos_cache_time', time);
      sessionStorage.setItem('hsc_faturamentos_cache_is_demo', String(isDemo));
      sessionStorage.setItem('hsc_faturamentos_cache_status', status);
      sessionStorage.setItem('hsc_faturamentos_cache_from', from);
      sessionStorage.setItem('hsc_faturamentos_cache_to', to);
    } catch (e) {
      console.error('Erro ao salvar cache de faturamentos:', e);
    }
  };

  // Carregamento de dados com n8n webhook
  const fetchFaturamentos = useCallback(async (showLoading = true, forceRefresh = false) => {
    // Verificar se existe cache válido para o período atual
    if (!forceRefresh) {
      try {
        const cachedData = sessionStorage.getItem('hsc_faturamentos_cache_data');
        const cachedTime = sessionStorage.getItem('hsc_faturamentos_cache_time');
        const cachedIsDemo = sessionStorage.getItem('hsc_faturamentos_cache_is_demo');
        const cachedStatus = sessionStorage.getItem('hsc_faturamentos_cache_status');
        const cachedFrom = sessionStorage.getItem('hsc_faturamentos_cache_from');
        const cachedTo = sessionStorage.getItem('hsc_faturamentos_cache_to');

        if (cachedData && cachedFrom === periodFrom && cachedTo === periodTo) {
          setData(JSON.parse(cachedData));
          setSyncTime(cachedTime);
          setIsDemoMode(cachedIsDemo === 'true');
          setSyncStatus((cachedStatus as any) || 'success');
          setLoading(false);
          return;
        }
      } catch (e) {
        console.error('Erro ao recuperar cache de faturamentos:', e);
      }
    }

    if (showLoading) setLoading(true);
    setSyncStatus('idle');

    try {
      const response = await webhookService.triggerConsultaFaturamentos({
        action: 'list',
        dateFrom: periodFrom,
        dateTo: periodTo,
        timestamp: new Date().toISOString()
      });

      const nowTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      // Se obtiver dados do webhook do n8n
      if (response && (Array.isArray(response) || Array.isArray(response.data))) {
        const rawList = Array.isArray(response) ? response : response.data;

        // Mapeamento das colunas do Oracle
        const formatted: FaturamentoProtocolo[] = rawList.map((item: any, idx: number) => {
          const getVal = (possibleKeys: string[], defaultVal: any) => {
            for (const key of possibleKeys) {
              const foundKey = Object.keys(item).find(k => k.toUpperCase() === key.toUpperCase());
              if (foundKey !== undefined && item[foundKey] !== null) {
                return item[foundKey];
              }
            }
            return defaultVal;
          };

          const nrProtocolo = String(getVal(['NR_PROTOCOLO', 'protocolo', 'nr_protocolo'], `M-${idx + 100000}`));
          const convenio = String(getVal(['CONVENIO', 'cd_convenio', 'convenio_desc'], 'Não Informado'));
          const ieStatusProtocolo = Number(getVal(['IE_STATUS_PROTOCOLO', 'status', 'status_protocolo'], 1));
          const dtMesanoReferencia = String(getVal(['DT_MESANO_REFERENCIA', 'mesano', 'referencia'], ''));
          const valor = Number(getVal(['VALOR', 'valor_total', 'total'], 0));
          const sus = Number(getVal(['SUS', 'valor_sus', 'total_sus'], 0));

          return {
            nrProtocolo,
            convenio,
            ieStatusProtocolo,
            dtMesanoReferencia,
            valor,
            sus
          };
        });

        setData(formatted);
        setIsDemoMode(false);
        setSyncStatus('success');
        setSyncTime(nowTime);
        saveToCache(formatted, nowTime, false, 'success', periodFrom, periodTo);

        // Salvar log no Supabase (Opcional)
        try {
          await supabase.from('pendencias_webhook_logs').insert({
            date_from: periodFrom,
            date_to: periodTo,
            payload: { webhook: 'consulta-faturamentos', recordsCount: formatted.length },
            status: 'sucesso'
          });
        } catch (e) {
          console.warn('Logging no Supabase ignorado:', e);
        }
      } else {
        // Mock
        const mockData = generateMockFaturamentos();
        setData(mockData);
        setIsDemoMode(true);
        setSyncStatus('success');
        setSyncTime(nowTime);
        saveToCache(mockData, nowTime, true, 'success', periodFrom, periodTo);
      }
    } catch (error) {
      console.error('Erro ao buscar faturamentos do webhook:', error);
      const mockData = generateMockFaturamentos();
      setData(mockData);
      setIsDemoMode(true);
      setSyncStatus('error');
      const nowTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      setSyncTime(nowTime);
      saveToCache(mockData, nowTime, true, 'error', periodFrom, periodTo);
    } finally {
      setLoading(false);
    }
  }, [periodFrom, periodTo]);

  // Carrega ao iniciar e quando o período muda
  useEffect(() => {
    fetchFaturamentos();
  }, [fetchFaturamentos]);

  // Lista dinâmica de convênios para o filtro
  const listConvenios = useMemo(() => {
    const set = new Set<string>();
    data.forEach(item => {
      if (item.convenio) set.add(item.convenio);
    });
    return Array.from(set).sort();
  }, [data]);

  // Filtragem dos dados em tempo real
  const filteredData = useMemo(() => {
    return data.filter(item => {
      // 1. Busca Livre por número de protocolo ou convênio
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesSearch = 
          item.nrProtocolo.toLowerCase().includes(term) ||
          item.convenio.toLowerCase().includes(term);
        if (!matchesSearch) return false;
      }

      // 2. Filtro de convênio
      if (convenioFilter !== 'Todos' && item.convenio !== convenioFilter) return false;

      // 3. Filtro de status
      if (statusFilter !== 'Todos') {
        if (Number(statusFilter) !== item.ieStatusProtocolo) return false;
      }

      // 4. Filtro de período local
      const itemDate = parseReferenceMonth(item.dtMesanoReferencia);
      if (itemDate) {
        if (periodFrom) {
          const dateLimitFrom = parseReferenceMonth(periodFrom);
          if (dateLimitFrom && itemDate < dateLimitFrom) return false;
        }
        if (periodTo) {
          const dateLimitTo = parseReferenceMonth(periodTo);
          if (dateLimitTo && itemDate > dateLimitTo) return false;
        }
      }

      return true;
    });
  }, [data, searchTerm, convenioFilter, statusFilter, periodFrom, periodTo]);

  // KPIs Dinâmicos com base nos dados filtrados
  const kpis = useMemo(() => {
    let totalGeral = 0;
    let totalSus = 0;
    let totalOutros = 0;
    let totalProtocolos = filteredData.length;

    filteredData.forEach(item => {
      const valorCorreto = getProtocoloValor(item);
      totalGeral += valorCorreto;

      if (isSusConvenio(item.convenio)) {
        totalSus += valorCorreto;
      } else {
        totalOutros += valorCorreto;
      }
    });

    return {
      totalGeral,
      totalSus,
      totalOutros,
      totalProtocolos
    };
  }, [filteredData]);

  // ── Agrupamento de faturamento por convênio para o Gráfico ──
  const convenioChartData = useMemo(() => {
    const grouped = filteredData.reduce((acc, curr) => {
      const conv = curr.convenio || 'Não Informado';
      const valor = getProtocoloValor(curr);
      acc[conv] = (acc[conv] || 0) + valor;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(grouped)
      .map(([name, value]) => ({
        name,
        value,
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredData]);

  // Paginação
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(start, start + itemsPerPage);
  }, [filteredData, currentPage]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  // Reinicia a página ao filtrar
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, convenioFilter, statusFilter, periodFrom, periodTo]);

  // Exportar Relatório em PDF
  const exportarPDF = async () => {
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
      console.error('Erro ao renderizar logo no PDF', e);
    }

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Relatório de Consulta de Faturamentos', 14, 32);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(`Data de Geração: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, 38);
    
    // Filtros aplicados no PDF
    const activeFilters = [];
    if (convenioFilter !== 'Todos') activeFilters.push(`Convênio: ${convenioFilter}`);
    if (statusFilter !== 'Todos') activeFilters.push(`Status: ${statusFilter === '2' ? 'Definitivo' : 'Provisório'}`);
    
    // Período formatado no PDF
    if (periodFrom || periodTo) {
      const formatPeriod = (p: string) => {
        if (!p) return '-';
        return p.split('-').reverse().join('/');
      };
      activeFilters.push(`Período: ${formatPeriod(periodFrom)} a ${formatPeriod(periodTo)}`);
    }
    
    if (searchTerm) activeFilters.push(`Busca: "${searchTerm}"`);
    
    if (activeFilters.length > 0) {
      doc.text(`Filtros Aplicados: ${activeFilters.join(' | ')}`, 14, 43);
    }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text('Resumo Executivo', 14, 52);

    autoTable(doc, {
      startY: 56,
      head: [['Total Geral Faturado', 'Total SUS', 'Total Outros Convênios', 'Qtd. Protocolos']],
      body: [[
        formatCurrency(kpis.totalGeral),
        formatCurrency(kpis.totalSus),
        formatCurrency(kpis.totalOutros),
        kpis.totalProtocolos.toString()
      ]],
      theme: 'grid',
      headStyles: { fillColor: [90, 16, 16], halign: 'center' },
      columnStyles: {
        0: { halign: 'center', fontStyle: 'bold' },
        1: { halign: 'center' },
        2: { halign: 'center' },
        3: { halign: 'center' }
      }
    });

    const nextY = (doc as any).lastAutoTable.finalY + 12;
    doc.text('Resumo de Faturamento por Convênio', 14, nextY);

    const convenioTableBody = convenioChartData.map(item => [
      item.name,
      formatCurrency(item.value)
    ]);

    autoTable(doc, {
      startY: nextY + 4,
      head: [['Convênio', 'Valor Faturado (Ponderado)']],
      body: convenioTableBody,
      theme: 'striped',
      headStyles: { fillColor: [90, 16, 16] },
      columnStyles: {
        0: { halign: 'left' },
        1: { halign: 'right', fontStyle: 'bold' }
      }
    });

    doc.save(`Resumo_Faturamento_Convenios_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 w-full px-[40px] max-w-none pb-12"
    >
      {/* ── SEÇÃO HEADER PRINCIPAL ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border/60 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
              <DollarSign className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground font-sans">Consulta Faturamentos</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Auditoria e visualização integrada de protocolos de convênios</p>
            </div>
          </div>
        </div>

        {/* Ações e Status de Sincronização */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {isDemoMode && (
            <div className="flex items-center gap-1 bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 px-3 py-1.5 rounded-full text-xs font-semibold border border-amber-200 dark:border-amber-900/50">
              Modo Demonstração (Mock)
            </div>
          )}

          {syncTime && syncStatus === 'success' && (
            <div className="flex items-center gap-1.5 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 px-3 py-1.5 rounded-full text-xs font-semibold border border-emerald-200 dark:border-emerald-900/50 shadow-sm">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Sync {syncTime}
            </div>
          )}

          {syncStatus === 'error' && (
            <div className="flex items-center gap-1.5 bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 px-3 py-1.5 rounded-full text-xs font-semibold border border-red-200 dark:border-red-900/50 shadow-sm">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
              Erro na conexão
            </div>
          )}

          <button
            onClick={() => fetchFaturamentos(true, true)}
            disabled={loading}
            className="flex items-center justify-center rounded-md text-sm font-semibold bg-card border border-border text-foreground hover:bg-muted h-10 w-10 transition-all shadow-sm"
            title="Atualizar dados"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={exportarPDF}
            disabled={loading || filteredData.length === 0}
            className="flex-1 md:flex-none inline-flex items-center justify-center rounded-md text-sm font-semibold bg-card border border-border text-foreground hover:bg-muted h-10 px-4 transition-all shadow-sm disabled:opacity-50"
          >
            <FileText className="mr-2 h-4 w-4 text-rose-600" />
            Exportar PDF
          </button>
        </div>
      </div>

      {/* ── SEÇÃO DE CARDS DE KPI & SELETOR DE PERÍODO (MESMO FORMATO DA GESTÃO DE PENDÊNCIAS) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* KPI 1: Faturamento Geral */}
        <div className="lg:col-span-3 bg-card border border-border rounded-xl p-5 shadow-sm relative overflow-hidden group hover:shadow-md transition-all flex flex-col justify-center">
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Faturamento Geral</p>
              <h3 className="text-2xl font-bold tracking-tight text-foreground">
                {loading ? '---' : formatCurrency(kpis.totalGeral)}
              </h3>
            </div>
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20 text-primary">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 text-[11px] text-muted-foreground">
            Soma ponderada dos convênios
          </div>
        </div>

        {/* KPI 2: Faturamento SUS */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5 shadow-sm relative overflow-hidden group hover:shadow-md transition-all flex flex-col justify-center">
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Faturamento SUS</p>
              <h3 className="text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                {loading ? '---' : formatCurrency(kpis.totalSus)}
              </h3>
            </div>
            <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-3 text-[11px] text-muted-foreground">
            Coluna de valores SUS
          </div>
        </div>

        {/* KPI 3: Outros Convênios */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5 shadow-sm relative overflow-hidden group hover:shadow-md transition-all flex flex-col justify-center">
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Outros Convênios</p>
              <h3 className="text-xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
                {loading ? '---' : formatCurrency(kpis.totalOutros)}
              </h3>
            </div>
            <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20 text-blue-600 dark:text-blue-400">
              <DollarSign className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-3 text-[11px] text-muted-foreground">
            Coluna de valores padrão
          </div>
        </div>

        {/* KPI 4: Quantidade de Protocolos */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5 shadow-sm relative overflow-hidden group hover:shadow-md transition-all flex flex-col justify-center">
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Protocolos</p>
              <h3 className="text-2xl font-bold tracking-tight text-foreground">
                {loading ? '---' : kpis.totalProtocolos}
              </h3>
            </div>
            <div className="h-9 w-9 rounded-lg bg-purple-500/10 flex items-center justify-center border border-purple-500/20 text-purple-600 dark:text-purple-400">
              <FileSpreadsheet className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-3 text-[11px] text-muted-foreground">
            Guias listadas na grade
          </div>
        </div>

        {/* SELETOR DE PERÍODO (MESMO FORMATO DA GESTÃO DE PENDÊNCIAS) */}
        <div className="lg:col-span-3 bg-card text-card-foreground p-5 rounded-xl border border-primary/20 bg-primary/5 shadow-sm flex flex-col justify-center">
          <p className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            Mês de Referência (Período)
          </p>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div>
              <label className="text-[10px] text-muted-foreground uppercase font-bold">Início</label>
              <input
                type="date"
                value={periodFrom}
                onChange={(e) => { setPeriodFrom(e.target.value); setCurrentPage(1); }}
                className="w-full bg-background border border-input rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary [&::-webkit-calendar-picker-indicator]:dark:invert"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase font-bold">Fim</label>
              <input
                type="date"
                value={periodTo}
                onChange={(e) => { setPeriodTo(e.target.value); setCurrentPage(1); }}
                className="w-full bg-background border border-input rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary [&::-webkit-calendar-picker-indicator]:dark:invert"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── GRÁFICOS DE FATURAMENTO POR CONVÊNIO ── */}
      {!loading && filteredData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Gráfico de Barras */}
          <div className="lg:col-span-8 bg-card border border-border rounded-xl p-5 shadow-sm flex flex-col h-[520px]">
            <div className="mb-4 flex-shrink-0">
              <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-primary" />
                Faturamento por Convênio
              </h3>
              <p className="text-[11px] text-muted-foreground">Valores ponderados (SUS utiliza valor SUS, outros utilizam valor padrão)</p>
            </div>
            <div className="flex-1 min-h-0 w-full pr-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={convenioChartData}
                  layout="vertical"
                  margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#52525b" opacity={0.15} />
                  <XAxis 
                    type="number" 
                    tickFormatter={formatCompactCurrency} 
                    stroke="#a1a1aa" 
                    fontSize={11} 
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    stroke="#a1a1aa" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false} 
                    width={180}
                    interval={0}
                  />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), 'Faturado']}
                    contentStyle={{ 
                      backgroundColor: 'var(--color-card)', 
                      borderColor: 'var(--color-border)', 
                      color: 'var(--color-foreground)', 
                      borderRadius: '8px' 
                    }}
                    itemStyle={{ color: 'var(--color-foreground)' }}
                  />
                  <Bar dataKey="value" fill="var(--color-primary)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Resumo em Lista */}
          <div className="lg:col-span-4 bg-card border border-border rounded-xl p-5 shadow-sm flex flex-col justify-between h-[520px]">
            <div className="flex flex-col flex-1 min-h-0">
              <h3 className="text-sm font-bold text-foreground mb-3 flex-shrink-0 uppercase tracking-wider flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-emerald-600" />
                Resumo por Convênio
              </h3>
              <div className="flex-1 min-h-0 overflow-y-auto pr-2 space-y-2 scrollbar-hide">
                {convenioChartData.map((item) => (
                  <div key={item.name} className="flex justify-between items-center border-b border-border/40 pb-1.5 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="h-2 w-2 rounded-full bg-primary/70 flex-shrink-0" />
                      <span className="font-medium text-foreground truncate" title={item.name}>
                        {item.name}
                      </span>
                    </div>
                    <span className="font-bold text-foreground flex-shrink-0">
                      {formatCurrency(item.value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="border-t border-border pt-3 mt-3 flex-shrink-0 flex justify-between items-center text-xs font-bold text-foreground">
              <span>Total Período:</span>
              <span className="text-sm text-primary">{formatCurrency(kpis.totalGeral)}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── BARRA DE FILTROS ── */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Busca Livre */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Pesquisar por nº protocolo ou convênio..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder-muted-foreground/60 transition-colors"
            />
          </div>

          {/* Filtro de Convênio */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground text-slate-700 dark:text-slate-300">Convênio:</span>
            <select
              value={convenioFilter}
              onChange={e => setConvenioFilter(e.target.value)}
              className="px-3 py-1.5 text-sm rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="Todos">Todos</option>
              {listConvenios.map(conv => (
                <option key={conv} value={conv}>{conv}</option>
              ))}
            </select>
          </div>

          {/* Filtro de Status */}
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground text-slate-700 dark:text-slate-300">Status:</span>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 text-sm rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="Todos">Todos</option>
              <option value="1">Provisório</option>
              <option value="2">Definitivo</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── GRADE/TABELA DE PROTOCOLOS ── */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-muted/40 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <th className="px-6 py-4">Nº Protocolo</th>
                <th className="px-6 py-4">Convênio</th>
                <th className="px-6 py-4">Ref. Mês/Ano</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-right">Valor Padrão</th>
                <th className="px-6 py-4 text-right">Valor SUS</th>
                <th className="px-6 py-4 text-right">Valor Calculado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 text-sm text-foreground">
              <AnimatePresence mode="popLayout">
                {loading ? (
                  // Skeleton loader
                  Array.from({ length: 5 }).map((_, idx) => (
                    <tr key={`skeleton-${idx}`} className="animate-pulse">
                      <td className="px-6 py-4"><div className="h-4 bg-muted rounded w-20" /></td>
                      <td className="px-6 py-4"><div className="h-4 bg-muted rounded w-48" /></td>
                      <td className="px-6 py-4"><div className="h-4 bg-muted rounded w-16" /></td>
                      <td className="px-6 py-4"><div className="h-6 bg-muted rounded-full w-20 mx-auto" /></td>
                      <td className="px-6 py-4"><div className="h-4 bg-muted rounded w-24 ml-auto" /></td>
                      <td className="px-6 py-4"><div className="h-4 bg-muted rounded w-24 ml-auto" /></td>
                      <td className="px-6 py-4"><div className="h-4 bg-muted rounded w-24 ml-auto" /></td>
                    </tr>
                  ))
                ) : paginatedData.length > 0 ? (
                  paginatedData.map(item => {
                    const valorCalculado = getProtocoloValor(item);
                    const susFlag = isSusConvenio(item.convenio);

                    return (
                      <motion.tr
                        key={item.nrProtocolo}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="hover:bg-muted/30 transition-colors"
                      >
                        <td className="px-6 py-4 font-mono font-medium text-slate-700 dark:text-slate-300">
                          {item.nrProtocolo}
                        </td>
                        <td className="px-6 py-4 font-medium max-w-[280px] truncate">
                          {item.convenio}
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">
                          {item.dtMesanoReferencia || '-'}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                            item.ieStatusProtocolo === 2
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-800/50 dark:text-emerald-400'
                              : 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/20 dark:border-amber-800/50 dark:text-amber-400'
                          }`}>
                            {item.ieStatusProtocolo === 2 ? 'Definitivo' : 'Provisório'}
                          </span>
                        </td>
                        <td className={`px-6 py-4 text-right ${!susFlag ? 'font-medium' : 'text-muted-foreground/60'}`}>
                          {item.valor > 0 ? formatCurrency(item.valor) : '-'}
                        </td>
                        <td className={`px-6 py-4 text-right ${susFlag ? 'font-medium text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground/60'}`}>
                          {item.sus > 0 ? formatCurrency(item.sus) : '-'}
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-foreground">
                          {formatCurrency(valorCalculado)}
                        </td>
                      </motion.tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <AlertCircle className="h-8 w-8 text-muted-foreground/60" />
                        <span>Nenhum protocolo localizado com os filtros aplicados.</span>
                      </div>
                    </td>
                  </tr>
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {/* ── PAGINAÇÃO ── */}
        {!loading && totalPages > 1 && (
          <div className="flex justify-between items-center px-6 py-4 border-t border-border bg-muted/20">
            <span className="text-xs text-muted-foreground">
              Mostrando página <span className="font-semibold text-foreground">{currentPage}</span> de <span className="font-semibold text-foreground">{totalPages}</span> ({filteredData.length} registros no total)
            </span>
            <div className="flex gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                className="px-3 py-1.5 text-xs font-semibold rounded bg-card border border-border text-foreground hover:bg-muted disabled:opacity-40 transition-colors"
              >
                Anterior
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                className="px-3 py-1.5 text-xs font-semibold rounded bg-card border border-border text-foreground hover:bg-muted disabled:opacity-40 transition-colors"
              >
                Próximo
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default ConsultaFaturamentos;
