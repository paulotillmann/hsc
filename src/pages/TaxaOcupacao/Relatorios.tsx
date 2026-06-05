import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  BarChart3, 
  Calendar, 
  Clock, 
  Download, 
  Printer, 
  Loader2, 
  Search, 
  TrendingUp, 
  Activity,
  Filter,
  Building2,
  Users,
  Info,
  ChevronDown
} from 'lucide-react';

interface Sector {
  id: string;
  nome_setor: string;
  total_leitos: number;
  total_leitos_sus: number;
  leitos_tipo: string | null;
  calcular_taxa: string | null;
}

interface SectorMetrics {
  id: string;
  nome_setor: string;
  leitos_tipo: string | null;
  calcular_taxa: string | null;
  current_capacity_geral: number;
  current_capacity_sus: number;
  dias_com_dados: number;
  pacientes_dias_geral: number;
  pacientes_dias_sus: number;
  leitos_dias_geral: number;
  leitos_dias_sus: number;
  media_ocupacao_geral: number;
  media_ocupacao_sus: number;
  taxa_ocupacao_geral: number;
  taxa_ocupacao_sus: number;
}

const monthNames = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const years = [2024, 2025, 2026, 2027];

export default function Relatorios() {
  const [loading, setLoading] = useState(true);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  
  // Filtros
  const [selectedMonth, setSelectedMonth] = useState<number>(() => new Date().getMonth() + 1); // 1-12
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
  const [selectedHour, setSelectedHour] = useState<string>('20:00'); // Padrão recomendado
  const [visaoFiltro, setVisaoFiltro] = useState<'Geral' | 'SUS' | 'Ambos'>('Ambos');
  const [searchTerm, setSearchTerm] = useState('');

  // Filtro de Setor (Multi-Select)
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
  const [isSectorDropdownOpen, setIsSectorDropdownOpen] = useState(false);
  const [sectorSearchTerm, setSectorSearchTerm] = useState('');
  const sectorDropdownRef = React.useRef<HTMLDivElement>(null);

  // Fecha o dropdown de setores ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (sectorDropdownRef.current && !sectorDropdownRef.current.contains(event.target as Node)) {
        setIsSectorDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Busca inicial dos setores ativos e data mais recente de lançamentos
  useEffect(() => {
    async function initData() {
      try {
        setLoading(true);
        // 1. Carregar todos os setores ativos
        const { data: sectorsData, error: sectorsErr } = await supabase
          .from('taxa_setores')
          .select('id, nome_setor, total_leitos, total_leitos_sus, leitos_tipo, calcular_taxa')
          .eq('ativo', true)
          .order('nome_setor', { ascending: true });

        if (sectorsErr) throw sectorsErr;
        const loadedSectors = sectorsData || [];
        setSectors(loadedSectors);
        setSelectedSectors(loadedSectors.map(s => s.id)); // Inicializa com todos os setores selecionados

        // 2. Tentar obter o lançamento mais recente para sugerir mês/ano padrão coerente com os dados
        const { data: latestRecords, error: latestErr } = await supabase
          .from('taxa_ocupacao_dia')
          .select('data')
          .order('data', { ascending: false })
          .limit(1);

        if (!latestErr && latestRecords && latestRecords.length > 0 && latestRecords[0].data) {
          const parts = latestRecords[0].data.split('-');
          if (parts.length === 3) {
            setSelectedMonth(parseInt(parts[1], 10));
            setSelectedYear(parseInt(parts[0], 10));
          }
        }
      } catch (error) {
        console.error('Erro ao inicializar dados de setores:', error);
      } finally {
        setLoading(false);
      }
    }
    initData();
  }, []);

  // Busca os lançamentos de ocupação para o período selecionado
  useEffect(() => {
    async function fetchPeriodData() {
      try {
        setLoading(true);
        
        // Determina os limites de data do mês
        const monthStr = String(selectedMonth).padStart(2, '0');
        const startDateStr = `${selectedYear}-${monthStr}-01`;
        const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
        const endDateStr = `${selectedYear}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

        let query = supabase
          .from('taxa_ocupacao_dia')
          .select(`
            id,
            data,
            horario_envio,
            total_leitos,
            total_leitos_sus,
            setor_id,
            taxa_ocupacao_dia_setor_leito (
              qtd_leitos_dia,
              qtd_leitos_sus,
              padrao
            )
          `)
          .gte('data', startDateStr)
          .lte('data', endDateStr);

        // Se o horário selecionado não for 'Ambos', filtra por ele
        if (selectedHour !== 'Ambos') {
          query = query.eq('horario_envio', selectedHour);
        }

        const { data, error } = await query;
        if (error) throw error;
        setRecords(data || []);
      } catch (error) {
        console.error('Erro ao carregar dados do período:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchPeriodData();
  }, [selectedMonth, selectedYear, selectedHour]);

  // Consolida as métricas por setor
  const consolidatedMetrics = useMemo<SectorMetrics[]>(() => {
    return sectors.map(sector => {
      const sectorRecords = records.filter(r => r.setor_id === sector.id);
      const N = sectorRecords.length;

      let totalOcupadosGeralSum = 0;
      let totalOcupadosSusSum = 0;
      let capacityGeralSum = 0;
      let capacitySusSum = 0;

      sectorRecords.forEach(record => {
        const detalhes = record.taxa_ocupacao_dia_setor_leito || [];
        
        // Filtrar leitos padrão (padrao !== false)
        const ocupadosNaoSus = detalhes
          .filter((d: any) => d.padrao !== false)
          .reduce((acc: number, curr: any) => acc + Number(curr.qtd_leitos_dia || 0), 0);
        
        const ocupadosSus = detalhes
          .filter((d: any) => d.padrao !== false)
          .reduce((acc: number, curr: any) => acc + Number(curr.qtd_leitos_sus || 0), 0);

        const totalOcupadosGeral = ocupadosNaoSus + ocupadosSus;
        const totalOcupadosSus = ocupadosSus;

        totalOcupadosGeralSum += totalOcupadosGeral;
        totalOcupadosSusSum += totalOcupadosSus;

        // Se o total de leitos não estiver preenchido no registro diário, usa o padrão do setor
        const recordTotalLeitos = record.total_leitos !== null && record.total_leitos !== undefined 
          ? record.total_leitos 
          : sector.total_leitos;
        const recordTotalLeitosSus = record.total_leitos_sus !== null && record.total_leitos_sus !== undefined 
          ? record.total_leitos_sus 
          : sector.total_leitos_sus;

        capacityGeralSum += Number(recordTotalLeitos || 0);
        capacitySusSum += Number(recordTotalLeitosSus || 0);
      });

      const mediaOcupacaoGeral = N > 0 ? totalOcupadosGeralSum / N : 0;
      const mediaOcupacaoSus = N > 0 ? totalOcupadosSusSum / N : 0;

      const taxaOcupacaoGeral = capacityGeralSum > 0 ? (totalOcupadosGeralSum / capacityGeralSum) * 100 : 0;
      const taxaOcupacaoSus = capacitySusSum > 0 ? (totalOcupadosSusSum / capacitySusSum) * 100 : 0;

      return {
        id: sector.id,
        nome_setor: sector.nome_setor,
        leitos_tipo: sector.leitos_tipo,
        calcular_taxa: sector.calcular_taxa,
        current_capacity_geral: sector.total_leitos,
        current_capacity_sus: sector.total_leitos_sus,
        dias_com_dados: N,
        pacientes_dias_geral: totalOcupadosGeralSum,
        pacientes_dias_sus: totalOcupadosSusSum,
        leitos_dias_geral: capacityGeralSum,
        leitos_dias_sus: capacitySusSum,
        media_ocupacao_geral: mediaOcupacaoGeral,
        media_ocupacao_sus: mediaOcupacaoSus,
        taxa_ocupacao_geral: taxaOcupacaoGeral,
        taxa_ocupacao_sus: taxaOcupacaoSus,
      };
    });
  }, [sectors, records]);

  // Filtra métricas de acordo com a pesquisa por texto e setores selecionados
  const filteredMetrics = useMemo(() => {
    return consolidatedMetrics.filter(m => 
      m.nome_setor.toLowerCase().includes(searchTerm.toLowerCase()) &&
      selectedSectors.includes(m.id)
    );
  }, [consolidatedMetrics, searchTerm, selectedSectors]);

  // Calcula os Totais do Hospital
  const totalHospital = useMemo(() => {
    // Dias distintos do período com qualquer dado no hospital
    const uniqueDays = Array.from(new Set(records.map(r => r.data)));
    const N_hospital = uniqueDays.length || 1;

    let capacity_geral = 0;
    let capacity_sus = 0;
    let pacientes_dias_geral = 0;
    let pacientes_dias_sus = 0;
    let leitos_dias_geral = 0;
    let leitos_dias_sus = 0;

    filteredMetrics.forEach(item => {
      capacity_geral += item.current_capacity_geral;
      capacity_sus += item.current_capacity_sus;
      pacientes_dias_geral += item.pacientes_dias_geral;
      pacientes_dias_sus += item.pacientes_dias_sus;
      leitos_dias_geral += item.leitos_dias_geral;
      leitos_dias_sus += item.leitos_dias_sus;
    });

    const media_ocupacao_geral = N_hospital > 0 ? pacientes_dias_geral / N_hospital : 0;
    const media_ocupacao_sus = N_hospital > 0 ? pacientes_dias_sus / N_hospital : 0;

    const taxa_ocupacao_geral = leitos_dias_geral > 0 ? (pacientes_dias_geral / leitos_dias_geral) * 100 : 0;
    const taxa_ocupacao_sus = leitos_dias_sus > 0 ? (pacientes_dias_sus / leitos_dias_sus) * 100 : 0;

    return {
      capacity_geral,
      capacity_sus,
      pacientes_dias_geral,
      pacientes_dias_sus,
      media_ocupacao_geral,
      media_ocupacao_sus,
      taxa_ocupacao_geral,
      taxa_ocupacao_sus,
      dias_com_dados: N_hospital
    };
  }, [filteredMetrics, records]);

  // Helper para formatar números
  const formatNumber = (num: number, fractionDigits = 1) => {
    return num.toLocaleString('pt-BR', { 
      minimumFractionDigits: fractionDigits, 
      maximumFractionDigits: fractionDigits 
    });
  };

  // Cores de Badge de acordo com a taxa de ocupação
  const getRateBadgeStyles = (rate: number) => {
    if (rate > 85) {
      return 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 font-bold';
    } else if (rate >= 70) {
      return 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20 font-bold';
    } else {
      return 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20 font-bold';
    }
  };

  // Exportar dados para CSV
  const handleExportCSV = () => {
    const monthStr = String(selectedMonth).padStart(2, '0');
    
    // Configura colunas a exportar baseado na visualização ativa
    const headers = ['Setor', 'Dias Registrados'];
    if (visaoFiltro === 'Geral' || visaoFiltro === 'Ambos') {
      headers.push('Capacidade Geral', 'Pacientes/Dias Geral', 'Média Ocupação/Dia Geral', 'Taxa Ocupação Geral (%)');
    }
    if (visaoFiltro === 'SUS' || visaoFiltro === 'Ambos') {
      headers.push('Capacidade SUS', 'Pacientes/Dias SUS', 'Média Ocupação/Dia SUS', 'Taxa Ocupação SUS (%)');
    }

    const rows = filteredMetrics.map(item => {
      const row = [item.nome_setor, item.dias_com_dados.toString()];
      
      if (visaoFiltro === 'Geral' || visaoFiltro === 'Ambos') {
        row.push(
          item.current_capacity_geral.toString(),
          item.pacientes_dias_geral.toString(),
          item.media_ocupacao_geral.toFixed(2).replace('.', ','),
          item.taxa_ocupacao_geral.toFixed(1).replace('.', ',') + '%'
        );
      }
      if (visaoFiltro === 'SUS' || visaoFiltro === 'Ambos') {
        row.push(
          item.current_capacity_sus.toString(),
          item.pacientes_dias_sus.toString(),
          item.media_ocupacao_sus.toFixed(2).replace('.', ','),
          item.taxa_ocupacao_sus.toFixed(1).replace('.', ',') + '%'
        );
      }
      return row;
    });

    // Adiciona linha de Totais
    const totalRow = ['TOTAL HOSPITALAR', totalHospital.dias_com_dados.toString()];
    if (visaoFiltro === 'Geral' || visaoFiltro === 'Ambos') {
      totalRow.push(
        totalHospital.capacity_geral.toString(),
        totalHospital.pacientes_dias_geral.toString(),
        totalHospital.media_ocupacao_geral.toFixed(2).replace('.', ','),
        totalHospital.taxa_ocupacao_geral.toFixed(1).replace('.', ',') + '%'
      );
    }
    if (visaoFiltro === 'SUS' || visaoFiltro === 'Ambos') {
      totalRow.push(
        totalHospital.capacity_sus.toString(),
        totalHospital.pacientes_dias_sus.toString(),
        totalHospital.media_ocupacao_sus.toFixed(2).replace('.', ','),
        totalHospital.taxa_ocupacao_sus.toFixed(1).replace('.', ',') + '%'
      );
    }
    rows.push(totalRow);

    // Constrói arquivo com acentuação compatível com Excel (BOM UTF-8)
    const csvContent = "\uFEFF" + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `relatorio_taxa_ocupacao_${selectedYear}_${monthStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Disparar a Impressão PDF do Navegador
  const handlePrint = () => {
    window.print();
  };

  const monthStr = String(selectedMonth).padStart(2, '0');

  return (
    <div className="flex flex-1 flex-col gap-6 w-full animate-in fade-in zoom-in duration-500">
      
      {/* ── SEÇÃO EXCLUSIVA PARA IMPRESSÃO (PDF) ── */}
      <div className="hidden print:block mb-6 text-black">
        <div className="flex items-center justify-between border-b border-slate-300 pb-4 mb-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Hospital Santa Casa de Araguari</h1>
            <p className="text-sm text-slate-500 font-medium">Relatório Mensal de Taxa de Ocupação por Setor</p>
          </div>
          <div className="text-right text-xs text-slate-400">
            <p>Emitido em: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        </div>
        
        <div className="grid grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-sm mb-6">
          <div>
            <span className="text-slate-500 block font-semibold text-xs uppercase">Mês de Referência</span>
            <span className="font-bold text-slate-800">{monthNames[selectedMonth - 1]} / {selectedYear}</span>
          </div>
          <div>
            <span className="text-slate-500 block font-semibold text-xs uppercase">Horário Censo</span>
            <span className="font-bold text-slate-800">{selectedHour === 'Ambos' ? '10:00 & 20:00 (Consolidado)' : selectedHour}</span>
          </div>
          <div>
            <span className="text-slate-500 block font-semibold text-xs uppercase">Escopo/Visão</span>
            <span className="font-bold text-slate-800">{visaoFiltro === 'Geral' ? 'Hospital Geral' : visaoFiltro === 'SUS' ? 'Leitos SUS' : 'Ambos (Consolidado)'}</span>
          </div>
          <div>
            <span className="text-slate-500 block font-semibold text-xs uppercase">Setores</span>
            <span className="font-bold text-slate-800 truncate block max-w-[150px]">
              {selectedSectors.length === sectors.length 
                ? 'Todos' 
                : selectedSectors.length === 0 
                ? 'Nenhum' 
                : `${selectedSectors.length} selecionado(s)`}
            </span>
          </div>
        </div>
      </div>

      {/* ── CABEÇALHO DA TELA (INTERATIVO - HIDDEN NA IMPRESSÃO) ── */}
      <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 print:hidden">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl">
              <BarChart3 className="h-6 w-6 text-primary" />
            </div>
            Relatório de Ocupação
          </h1>
          <p className="text-muted-foreground text-sm">
            Indicadores de Pacientes-Dia, Médias e Taxas consolidadas por setor e período.
          </p>
        </div>
        
        {/* Ações da Tela */}
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
          <button
            onClick={handlePrint}
            className="flex items-center justify-center gap-2 bg-card hover:bg-muted border text-foreground px-4 py-2 rounded-xl font-medium transition-all shadow-sm flex-1 sm:flex-initial"
            title="Exportar para PDF"
          >
            <Printer className="h-4 w-4 text-muted-foreground" />
            Imprimir PDF
          </button>
          
          <button
            onClick={handleExportCSV}
            className="flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/95 px-4 py-2 rounded-xl font-medium transition-all shadow-sm hover:shadow flex-1 sm:flex-initial"
            title="Exportar para Planilha Excel (CSV)"
          >
            <Download className="h-4 w-4" />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* ── CARDS KPI RESUMO (MODO DIGITAL: FLEX | IMPRESSÃO: REDUZIDO E ESTILIZADO) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* KPI: Taxa de Ocupação Média Geral */}
        {(visaoFiltro === 'Geral' || visaoFiltro === 'Ambos') && (
          <div className="bg-card rounded-2xl border p-5 shadow-sm relative overflow-hidden flex flex-col justify-between print:border-slate-300 print:shadow-none">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-muted-foreground print:text-slate-500">Ocupação Média Geral</span>
              <div className="p-2 bg-primary/10 rounded-lg print:hidden">
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold tracking-tight text-foreground print:text-black">
                {formatNumber(totalHospital.taxa_ocupacao_geral)}%
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1 print:text-slate-400">
              <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0 print:hidden" />
              Consolidado dos leitos gerais no mês.
            </p>
          </div>
        )}

        {/* KPI: Taxa de Ocupação Média SUS */}
        {(visaoFiltro === 'SUS' || visaoFiltro === 'Ambos') && (
          <div className="bg-card rounded-2xl border p-5 shadow-sm relative overflow-hidden flex flex-col justify-between print:border-slate-300 print:shadow-none">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-muted-foreground print:text-slate-500">Ocupação Média SUS</span>
              <div className="p-2 bg-primary/10 rounded-lg print:hidden">
                <Activity className="h-4 w-4 text-primary" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold tracking-tight text-foreground print:text-black">
                {formatNumber(totalHospital.taxa_ocupacao_sus)}%
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1 print:text-slate-400">
              <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0 print:hidden" />
              Consolidado dos leitos SUS no mês.
            </p>
          </div>
        )}

        {/* KPI: Pacientes-Dia Geral */}
        {(visaoFiltro === 'Geral' || visaoFiltro === 'Ambos') && (
          <div className="bg-card rounded-2xl border p-5 shadow-sm relative overflow-hidden flex flex-col justify-between print:border-slate-300 print:shadow-none">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-muted-foreground print:text-slate-500">Pacientes-Dia Geral</span>
              <div className="p-2 bg-primary/10 rounded-lg print:hidden">
                <Users className="h-4 w-4 text-primary" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold tracking-tight text-foreground print:text-black">
                {totalHospital.pacientes_dias_geral}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1 print:text-slate-400">
              <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0 print:hidden" />
              Soma de ocupantes diários.
            </p>
          </div>
        )}

        {/* KPI: Dias com Registro */}
        <div className="bg-card rounded-2xl border p-5 shadow-sm relative overflow-hidden flex flex-col justify-between print:border-slate-300 print:shadow-none">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-muted-foreground print:text-slate-500">Dias Monitorados</span>
            <div className="p-2 bg-primary/10 rounded-lg print:hidden">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-foreground print:text-black">
              {totalHospital.dias_com_dados} dias
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1 print:text-slate-400">
            <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0 print:hidden" />
            Quantidade de dias com censo.
          </p>
        </div>

      </div>

      {/* ── GRID DE DADOS (TABELA PRINCIPAL) ── */}
      <div className="bg-card border rounded-2xl shadow-sm flex flex-col overflow-hidden print:border-slate-300 print:shadow-none">
        
        {/* Barra de Filtros e Pesquisa (Hides on print) */}
        <div className="p-4 border-b flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-muted/20 print:hidden">
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            {/* Campo Pesquisar por setor (reduzido) */}
            <div className="relative w-full sm:w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Pesquisar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/60"
              />
            </div>

            <div className="hidden sm:block w-px h-6 bg-border"></div>

            {/* Seletor de Período */}
            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex gap-1">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="bg-background border border-border rounded-lg text-xs px-2 py-1.5 focus:ring-1 focus:ring-primary outline-none font-medium cursor-pointer"
                >
                  {monthNames.map((m, idx) => (
                    <option key={idx} value={idx + 1}>{m}</option>
                  ))}
                </select>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="bg-background border border-border rounded-lg text-xs px-2 py-1.5 focus:ring-1 focus:ring-primary outline-none font-medium cursor-pointer"
                >
                  {years.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="hidden sm:block w-px h-6 bg-border"></div>

            {/* Seletor de Censo */}
            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
              <select
                value={selectedHour}
                onChange={(e) => setSelectedHour(e.target.value)}
                className="bg-background border border-border rounded-lg text-xs px-2.5 py-1.5 focus:ring-1 focus:ring-primary outline-none font-medium cursor-pointer w-full sm:w-auto"
              >
                <option value="20:00">20:00 (Censo Principal)</option>
                <option value="10:00">10:00 (Censo Extra)</option>
                <option value="Ambos">Ambos Horários</option>
              </select>
            </div>

            <div className="hidden sm:block w-px h-6 bg-border"></div>

            {/* Filtro de Setor Multi-Select */}
            <div className="relative shrink-0 w-full sm:w-auto" ref={sectorDropdownRef}>
              <button
                onClick={() => setIsSectorDropdownOpen(!isSectorDropdownOpen)}
                className="flex items-center justify-between gap-2 bg-background border border-border rounded-lg text-xs px-2.5 py-1.5 focus:ring-1 focus:ring-primary outline-none font-medium cursor-pointer w-full sm:w-[180px]"
                type="button"
              >
                <span className="truncate">
                  {selectedSectors.length === sectors.length 
                    ? 'Todos os Setores' 
                    : selectedSectors.length === 0 
                    ? 'Nenhum Setor' 
                    : `${selectedSectors.length} setores`}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </button>

              {isSectorDropdownOpen && (
                <div className="absolute left-0 mt-1 z-50 w-full sm:w-[240px] bg-card border border-border rounded-xl shadow-lg p-3 flex flex-col gap-2">
                  <div className="flex items-center gap-1.5 bg-muted/30 border border-border rounded-lg px-2.5 py-1">
                    <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <input
                      type="text"
                      placeholder="Pesquisar setor..."
                      value={sectorSearchTerm}
                      onChange={(e) => setSectorSearchTerm(e.target.value)}
                      className="bg-transparent border-none text-xs outline-none focus:ring-0 w-full"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2 text-[10px] font-bold text-muted-foreground border-b pb-1.5 uppercase px-1">
                    <button
                      type="button"
                      onClick={() => setSelectedSectors(sectors.map(s => s.id))}
                      className="hover:text-primary transition-colors cursor-pointer"
                    >
                      Todos
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedSectors([])}
                      className="hover:text-primary transition-colors cursor-pointer"
                    >
                      Nenhum
                    </button>
                  </div>

                  <div className="max-h-[180px] overflow-y-auto flex flex-col gap-1 pr-1 scrollbar-hide">
                    {sectors
                      .filter(s => s.nome_setor.toLowerCase().includes(sectorSearchTerm.toLowerCase()))
                      .map(s => {
                        const isChecked = selectedSectors.includes(s.id);
                        return (
                          <label
                            key={s.id}
                            className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-muted/40 cursor-pointer text-xs select-none"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                if (isChecked) {
                                  setSelectedSectors(selectedSectors.filter(id => id !== s.id));
                                } else {
                                  setSelectedSectors([...selectedSectors, s.id]);
                                }
                              }}
                              className="rounded text-primary focus:ring-primary h-3.5 w-3.5 border-border"
                            />
                            <span className="truncate text-foreground font-medium">{s.nome_setor}</span>
                          </label>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>

            <div className="hidden sm:block w-px h-6 bg-border"></div>

            {/* Seletor de Visão */}
            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
              <select
                value={visaoFiltro}
                onChange={(e) => setVisaoFiltro(e.target.value as any)}
                className="bg-background border border-border rounded-lg text-xs px-2.5 py-1.5 focus:ring-1 focus:ring-primary outline-none font-medium cursor-pointer w-full sm:w-auto"
              >
                <option value="Ambos">Geral e SUS</option>
                <option value="Geral">Geral apenas</option>
                <option value="SUS">SUS apenas</option>
              </select>
            </div>
          </div>

          <div className="text-xs text-muted-foreground font-medium shrink-0 w-full lg:w-auto text-right">
            Exibindo {filteredMetrics.length} setores ativos
          </div>
        </div>

        {/* Tabela do Relatório */}
        <div className="overflow-x-auto w-full">
          {loading ? (
            <div className="flex items-center justify-center h-full min-h-[300px] py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredMetrics.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhum dado encontrado para os filtros selecionados.
            </div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b print:bg-slate-100 print:text-slate-800">
                <tr>
                  <th className="px-4 py-3.5 font-bold text-left">Setor</th>
                  <th className="px-4 py-3.5 font-bold text-center">Dias Registrados</th>
                  
                  {/* Colunas do Hospital Geral */}
                  {(visaoFiltro === 'Geral' || visaoFiltro === 'Ambos') && (
                    <>
                      <th className="px-3 py-3.5 font-bold text-center bg-blue-500/5 print:bg-transparent">Capacidade Geral</th>
                      <th className="px-3 py-3.5 font-bold text-center bg-blue-500/5 print:bg-transparent">Pacientes/Dias Geral</th>
                      <th className="px-3 py-3.5 font-bold text-center bg-blue-500/5 print:bg-transparent">Média Ocup./Dia</th>
                      <th className="px-4 py-3.5 font-bold text-center bg-blue-500/5 print:bg-transparent">Taxa Ocup. Geral</th>
                    </>
                  )}

                  {/* Colunas do SUS */}
                  {(visaoFiltro === 'SUS' || visaoFiltro === 'Ambos') && (
                    <>
                      <th className="px-3 py-3.5 font-bold text-center bg-green-500/5 print:bg-transparent">Capacidade SUS</th>
                      <th className="px-3 py-3.5 font-bold text-center bg-green-500/5 print:bg-transparent">Pacientes/Dias SUS</th>
                      <th className="px-3 py-3.5 font-bold text-center bg-green-500/5 print:bg-transparent">Média Ocup. SUS</th>
                      <th className="px-4 py-3.5 font-bold text-center bg-green-500/5 print:bg-transparent">Taxa Ocup. SUS</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border print:divide-slate-300">
                {filteredMetrics.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                    
                    {/* Nome do Setor */}
                    <td className="px-4 py-4 font-semibold text-foreground print:text-black">
                      <div className="flex flex-col">
                        <span>{item.nome_setor}</span>
                        {item.leitos_tipo && (
                          <span className="inline-flex w-fit px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 uppercase tracking-tight mt-0.5 print:hidden">
                            {item.leitos_tipo}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Dias Registrados */}
                    <td className="px-4 py-4 text-center text-muted-foreground font-medium print:text-slate-800">
                      {item.dias_com_dados}
                    </td>

                    {/* Dados Geral */}
                    {(visaoFiltro === 'Geral' || visaoFiltro === 'Ambos') && (
                      <>
                        <td className="px-3 py-4 text-center font-medium bg-blue-500/5 print:bg-transparent print:text-slate-800">
                          {item.current_capacity_geral}
                        </td>
                        <td className="px-3 py-4 text-center font-medium bg-blue-500/5 print:bg-transparent print:text-slate-800">
                          {item.pacientes_dias_geral}
                        </td>
                        <td className="px-3 py-4 text-center bg-blue-500/5 print:bg-transparent print:text-slate-800">
                          {formatNumber(item.media_ocupacao_geral, 2)}
                        </td>
                        <td className="px-4 py-4 text-center bg-blue-500/5 print:bg-transparent">
                          <span className={`inline-flex px-2 py-1 text-xs rounded-full ${getRateBadgeStyles(item.taxa_ocupacao_geral)}`}>
                            {formatNumber(item.taxa_ocupacao_geral)}%
                          </span>
                        </td>
                      </>
                    )}

                    {/* Dados SUS */}
                    {(visaoFiltro === 'SUS' || visaoFiltro === 'Ambos') && (
                      <>
                        <td className="px-3 py-4 text-center font-medium bg-green-500/5 print:bg-transparent print:text-slate-800">
                          {item.current_capacity_sus}
                        </td>
                        <td className="px-3 py-4 text-center font-medium bg-green-500/5 print:bg-transparent print:text-slate-800">
                          {item.pacientes_dias_sus}
                        </td>
                        <td className="px-3 py-4 text-center bg-green-500/5 print:bg-transparent print:text-slate-800">
                          {formatNumber(item.media_ocupacao_sus, 2)}
                        </td>
                        <td className="px-4 py-4 text-center bg-green-500/5 print:bg-transparent">
                          {item.current_capacity_sus > 0 || item.leitos_dias_sus > 0 ? (
                            <span className={`inline-flex px-2 py-1 text-xs rounded-full ${getRateBadgeStyles(item.taxa_ocupacao_sus)}`}>
                              {formatNumber(item.taxa_ocupacao_sus)}%
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                ))}

                {/* LINHA DE TOTAIS DO HOSPITAL */}
                <tr className="bg-muted/70 font-extrabold border-t-2 border-border print:bg-slate-200 print:text-black">
                  <td className="px-4 py-4 text-left font-bold text-foreground print:text-black">
                    TOTAL HOSPITALAR
                  </td>
                  <td className="px-4 py-4 text-center font-bold text-foreground print:text-black">
                    {totalHospital.dias_com_dados}
                  </td>

                  {/* Totais Geral */}
                  {(visaoFiltro === 'Geral' || visaoFiltro === 'Ambos') && (
                    <>
                      <td className="px-3 py-4 text-center bg-blue-500/10 print:bg-transparent print:text-black">
                        {totalHospital.capacity_geral}
                      </td>
                      <td className="px-3 py-4 text-center bg-blue-500/10 print:bg-transparent print:text-black">
                        {totalHospital.pacientes_dias_geral}
                      </td>
                      <td className="px-3 py-4 text-center bg-blue-500/10 print:bg-transparent print:text-black">
                        {formatNumber(totalHospital.media_ocupacao_geral, 2)}
                      </td>
                      <td className="px-4 py-4 text-center bg-blue-500/10 print:bg-transparent">
                        <span className={`inline-flex px-2.5 py-1 text-xs rounded-full ${getRateBadgeStyles(totalHospital.taxa_ocupacao_geral)}`}>
                          {formatNumber(totalHospital.taxa_ocupacao_geral)}%
                        </span>
                      </td>
                    </>
                  )}

                  {/* Totais SUS */}
                  {(visaoFiltro === 'SUS' || visaoFiltro === 'Ambos') && (
                    <>
                      <td className="px-3 py-4 text-center bg-green-500/10 print:bg-transparent print:text-black">
                        {totalHospital.capacity_sus}
                      </td>
                      <td className="px-3 py-4 text-center bg-green-500/10 print:bg-transparent print:text-black">
                        {totalHospital.pacientes_dias_sus}
                      </td>
                      <td className="px-3 py-4 text-center bg-green-500/10 print:bg-transparent print:text-black">
                        {formatNumber(totalHospital.media_ocupacao_sus, 2)}
                      </td>
                      <td className="px-4 py-4 text-center bg-green-500/10 print:bg-transparent">
                        <span className={`inline-flex px-2.5 py-1 text-xs rounded-full ${getRateBadgeStyles(totalHospital.taxa_ocupacao_sus)}`}>
                          {formatNumber(totalHospital.taxa_ocupacao_sus)}%
                        </span>
                      </td>
                    </>
                  )}
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
