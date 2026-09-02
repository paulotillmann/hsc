import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { 
  Users, 
  UserCheck, 
  Clock, 
  Activity, 
  Search, 
  RefreshCw, 
  FileSpreadsheet, 
  FileText, 
  X, 
  Building2, 
  Layers, 
  ChevronLeft, 
  ChevronRight, 
  Eye, 
  Copy, 
  Check, 
  Timer,
  Calendar,
  AlertTriangle,
  RotateCcw,
  TrendingUp
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
  CartesianGrid 
} from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { webhookService } from '../../services/webhookService';

export interface UsuarioTasy {
  login: string;
  nome: string;
  setor: string;
  inicio: string;
  fim: string;
  duracaoFormatada: string;
  duracaoMinutos: number;
  status: 'ATIVO' | 'OCIOSO';
  [key: string]: any;
}

const CACHE_KEY = 'hsc_tasy_users_cache';
const CACHE_TIME_KEY = 'hsc_tasy_users_cache_time';
const PEAK_KEY_PREFIX = 'hsc_tasy_peak_concurrent_';

const COLORS = [
  '#0284c7', '#0d9488', '#8b5cf6', '#f59e0b', '#ec4899', 
  '#10b981', '#6366f1', '#f43f5e', '#14b8a6', '#eab308'
];

// Retorna a chave da data de hoje no fuso oficial de Brasília (YYYY-MM-DD)
function getTodayDateKey(): string {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const parts = formatter.formatToParts(now);
    const day = parts.find(p => p.type === 'day')?.value || '01';
    const month = parts.find(p => p.type === 'month')?.value || '01';
    const year = parts.find(p => p.type === 'year')?.value || '2026';
    return `${year}-${month}-${day}`;
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

// Helper para extrair minutos do dia a partir de "HH:MM" ou "DD/MM/YYYY HH:MM:SS"
function getMinutesFromTimeStr(timeStr: string): number | null {
  if (!timeStr || timeStr === '-') return null;
  try {
    const parts = timeStr.trim().split(' ');
    const timePart = parts.length > 1 ? parts[parts.length - 1] : parts[0];
    const timeElements = timePart.split(':');
    if (timeElements.length < 2) return null;

    const h = parseInt(timeElements[0], 10);
    const m = parseInt(timeElements[1], 10);
    if (isNaN(h) || isNaN(m)) return null;
    return h * 60 + m;
  } catch {
    return null;
  }
}

// Retorna os minutos do momento atual no fuso oficial de Brasília (America/Sao_Paulo)
function getBrasiliaCurrentMinutes(): number {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    const parts = formatter.format(now).split(':');
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (!isNaN(h) && !isNaN(m)) {
      return h * 60 + m;
    }
    return now.getHours() * 60 + now.getMinutes();
  } catch {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }
}

// Helper para calcular duração real entre o Início e o Sysdate (Horário de Brasília)
function calculateDuration(inicioStr: string): { formatada: string; minutos: number } {
  const minInicio = getMinutesFromTimeStr(inicioStr);
  if (minInicio === null) {
    return { formatada: '-', minutos: 0 };
  }

  // Sysdate no horário oficial de Brasília
  const minRef = getBrasiliaCurrentMinutes();

  let totalMinutos = minRef - minInicio;
  if (totalMinutos < 0) {
    // Virada de meia-noite (ex: logou às 23:30 e agora são 01:15)
    totalMinutos += 24 * 60;
  }

  const horas = Math.floor(totalMinutos / 60);
  const minutos = totalMinutos % 60;

  if (horas === 0) {
    return { formatada: `${minutos}min`, minutos: totalMinutos };
  }
  return { formatada: `${horas}h ${minutos.toString().padStart(2, '0')}m`, minutos: totalMinutos };
}

const UsuariosTasy: React.FC = () => {
  const [usuarios, setUsuarios] = useState<UsuarioTasy[]>(() => {
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) return JSON.parse(cached);
    } catch {}
    return [];
  });

  const [isLoading, setIsLoading] = useState<boolean>(() => {
    try {
      return !sessionStorage.getItem(CACHE_KEY);
    } catch {
      return true;
    }
  });

  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(CACHE_TIME_KEY) || null;
    } catch {
      return null;
    }
  });

  const [snapshotHeader, setSnapshotHeader] = useState<{ hora: string | null; quant: number | null }>({ hora: null, quant: null });

  // Filtros
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedSetor, setSelectedSetor] = useState<string>('TODOS');
  const [selectedDuracao, setSelectedDuracao] = useState<string>('TODOS');

  // Auto-refresh (segundos) - Padrão 5 minutos
  const [refreshInterval, setRefreshInterval] = useState<number>(300);
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState<number>(300);

  // Paginação & Ordenação
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 12;
  const [sortField, setSortField] = useState<keyof UsuarioTasy>('nome');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // Modal de Detalhes
  const [selectedUser, setSelectedUser] = useState<UsuarioTasy | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Pico simultâneo de conexões do dia
  const [peakToday, setPeakToday] = useState<{ count: number; time: string }>(() => {
    try {
      const todayKey = getTodayDateKey();
      const stored = localStorage.getItem(PEAK_KEY_PREFIX + todayKey);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {}
    return { count: 0, time: '-' };
  });

  // Normalização blindada do retorno
  const normalizeData = (rawList: any[]): { list: UsuarioTasy[]; headerInfo: { hora: string | null; quant: number | null } } => {
    if (!Array.isArray(rawList) || rawList.length === 0) {
      return { list: [], headerInfo: { hora: null, quant: 0 } };
    }

    let snapshotHora: string | null = null;
    let quantTotal: number | null = null;

    const first = rawList[0];
    if (first) {
      if (first['Dia/Mês Hora']) snapshotHora = String(first['Dia/Mês Hora']).trim();
      if (first['Quant.'] !== undefined && first['Quant.'] !== null) quantTotal = Number(first['Quant.']);
    }

    const list: UsuarioTasy[] = [];

    rawList.forEach((raw, idx) => {
      if (!raw || typeof raw !== 'object') return;
      
      const item = raw.json && typeof raw.json === 'object' ? raw.json : raw;

      const rawNome = item.NOME || item.nome || item.NM_USUARIO || item.nm_usuario || item.name;
      const rawLogin = item.LOGIN || item.login || item.CD_USUARIO || item.cd_usuario || item.usuario || item.user;
      const rawSetor = item.DS_SETOR || item.ds_setor || item.setor || item.departamento || item.unidade || item.posto;
      const rawInicio = item['Início'] || item.inicio || item.INICIO || item.hr_inicio || item.dt_inicio;
      const rawFim = item['Fim'] || item.fim || item.FIM || item.hr_fim || item.dt_fim;

      // Pula somente registros vazios que não tenham nem nome nem login
      if (!rawNome && !rawLogin) return;

      const nome = (rawNome || rawLogin || `Usuário ${idx + 1}`).toString().trim();
      const login = (rawLogin || '-').toString().trim();
      const setor = (rawSetor || 'Não Informado').toString().trim();
      const inicio = (rawInicio || '-').toString().trim();
      const fim = (rawFim || '-').toString().trim();

      // Calcula o tempo conectado comparando o Início com o Sysdate (Horário oficial de Brasília)
      const { formatada: duracaoFormatada, minutos: duracaoMinutos } = calculateDuration(inicio);

      list.push({
        login,
        nome,
        setor,
        inicio,
        fim,
        duracaoFormatada,
        duracaoMinutos,
        status: 'ATIVO',
        ...item
      });
    });

    return { list, headerInfo: { hora: snapshotHora, quant: quantTotal || list.length } };
  };

  const loadData = useCallback(async (isSilent = false) => {
    if (!isSilent) {
      setIsLoading(prev => usuarios.length === 0 ? true : prev);
    }
    setIsRefreshing(true);
    setErrorMessage(null);

    try {
      console.log('[UsuariosTasy] Chamando webhook...');
      const data = await webhookService.fetchUsuariosAtivosTasy();
      console.log('[UsuariosTasy] Resposta recebida:', Array.isArray(data) ? `${data.length} itens` : typeof data);
      
      if (Array.isArray(data) && data.length > 0) {
        const { list, headerInfo } = normalizeData(data);
        console.log(`[UsuariosTasy] ${list.length} usuários normalizados com sucesso.`);
        
        setUsuarios(list);
        setSnapshotHeader(headerInfo);
        
        const nowTime = new Date().toLocaleTimeString('pt-BR', {
          timeZone: 'America/Sao_Paulo',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
        setLastSyncTime(nowTime);
        
        // Atualiza e persiste o pico de conexões do dia
        const totalConexoes = headerInfo.quant || list.length;
        if (totalConexoes > 0) {
          const todayKey = getTodayDateKey();
          const shortTime = new Date().toLocaleTimeString('pt-BR', {
            timeZone: 'America/Sao_Paulo',
            hour: '2-digit',
            minute: '2-digit'
          });

          setPeakToday(prev => {
            if (totalConexoes >= prev.count) {
              const newPeak = { count: totalConexoes, time: shortTime };
              try {
                localStorage.setItem(PEAK_KEY_PREFIX + todayKey, JSON.stringify(newPeak));
              } catch {}
              return newPeak;
            }
            return prev;
          });
        }
        
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify(list));
          sessionStorage.setItem(CACHE_TIME_KEY, nowTime);
        } catch {}
      } else {
        console.warn('[UsuariosTasy] Webhook retornou lista vazia.');
        if (usuarios.length === 0) {
          setUsuarios([]);
        }
      }
    } catch (error: any) {
      console.error('[UsuariosTasy] Erro ao carregar usuários Tasy:', error);
      setErrorMessage(error.message || 'Falha ao conectar com o serviço do Tasy.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      setSecondsUntilRefresh(refreshInterval);
    }
  }, [refreshInterval, usuarios.length]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Cronômetro do Auto-Refresh
  useEffect(() => {
    if (refreshInterval <= 0) return;

    const timer = setInterval(() => {
      setSecondsUntilRefresh(prev => {
        if (prev <= 1) {
          loadData(true);
          return refreshInterval;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [refreshInterval, loadData]);

  // Lista única de setores para os filtros
  const setoresList = useMemo(() => {
    const sets = new Set<string>();
    usuarios.forEach(u => {
      if (u.setor) sets.add(u.setor);
    });
    return ['TODOS', ...Array.from(sets).sort((a, b) => a.localeCompare(b, 'pt-BR'))];
  }, [usuarios]);

  // Filtragem ultra-segura
  const filteredUsuarios = useMemo(() => {
    const term = (searchTerm || '').toLowerCase().trim();

    return usuarios.filter(u => {
      const login = (u.login || '').toLowerCase();
      const nome = (u.nome || '').toLowerCase();
      const setor = (u.setor || '').toLowerCase();

      const matchesSearch = !term || 
        login.includes(term) ||
        nome.includes(term) ||
        setor.includes(term);

      const matchesSetor = selectedSetor === 'TODOS' || u.setor === selectedSetor;
      
      let matchesDuracao = true;
      if (selectedDuracao === 'MENOS_2H') matchesDuracao = (u.duracaoMinutos || 0) < 120;
      else if (selectedDuracao === '2H_4H') matchesDuracao = (u.duracaoMinutos || 0) >= 120 && (u.duracaoMinutos || 0) <= 240;
      else if (selectedDuracao === 'MAIS_4H') matchesDuracao = (u.duracaoMinutos || 0) > 240;

      return matchesSearch && matchesSetor && matchesDuracao;
    });
  }, [usuarios, searchTerm, selectedSetor, selectedDuracao]);

  // Ordenação segura
  const sortedUsuarios = useMemo(() => {
    return [...filteredUsuarios].sort((a, b) => {
      if (sortField === 'duracaoMinutos') {
        return sortAsc ? (a.duracaoMinutos || 0) - (b.duracaoMinutos || 0) : (b.duracaoMinutos || 0) - (a.duracaoMinutos || 0);
      }

      const valA = (a[sortField] || '').toString().toLowerCase();
      const valB = (b[sortField] || '').toString().toLowerCase();

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [filteredUsuarios, sortField, sortAsc]);

  // Paginação
  const totalPages = Math.max(1, Math.ceil(sortedUsuarios.length / itemsPerPage));
  const paginatedUsuarios = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedUsuarios.slice(start, start + itemsPerPage);
  }, [sortedUsuarios, currentPage, itemsPerPage]);

  const handleSort = (field: keyof UsuarioTasy) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // KPIs
  const kpis = useMemo(() => {
    const total = snapshotHeader.quant || usuarios.length;
    
    // Setor com mais usuários
    const setorCounts: Record<string, number> = {};
    usuarios.forEach(u => {
      if (u.setor) {
        setorCounts[u.setor] = (setorCounts[u.setor] || 0) + 1;
      }
    });
    const topSetorEntry = Object.entries(setorCounts).sort((a, b) => b[1] - a[1])[0];
    const topSetor = topSetorEntry ? `${topSetorEntry[0]} (${topSetorEntry[1]})` : '-';

    // Média de tempo conectado
    const totalMinutos = usuarios.reduce((acc, u) => acc + (u.duracaoMinutos || 0), 0);
    const mediaMinutos = usuarios.length > 0 ? Math.round(totalMinutos / usuarios.length) : 0;
    const mediaHoras = Math.floor(mediaMinutos / 60);
    const mediaResto = mediaMinutos % 60;
    const mediaFormatada = mediaHoras > 0 ? `${mediaHoras}h ${mediaResto.toString().padStart(2, '0')}m` : `${mediaResto}m`;

    return { total, topSetor, mediaFormatada, totalSetores: Object.keys(setorCounts).length };
  }, [usuarios, snapshotHeader]);

  // Dados para Gráficos
  const chartSetores = useMemo(() => {
    const counts: Record<string, number> = {};
    usuarios.forEach(u => {
      if (u.setor) {
        counts[u.setor] = (counts[u.setor] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [usuarios]);

  const chartDonutSetores = useMemo(() => {
    return chartSetores.slice(0, 5).map((item) => ({
      name: item.name.length > 18 ? item.name.substring(0, 15) + '...' : item.name,
      value: item.count
    }));
  }, [chartSetores]);

  // Copiar campo para a área de transferência
  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Exportação CSV
  const exportCSV = () => {
    if (filteredUsuarios.length === 0) return;

    const headers = ['Login', 'Nome Completo', 'Setor', 'Hora Inicio', 'Timeout / Expiracao', 'Tempo Conectado'];
    const rows = filteredUsuarios.map(u => [
      `"${u.login}"`,
      `"${u.nome}"`,
      `"${u.setor}"`,
      `"${u.inicio}"`,
      `"${u.fim}"`,
      `"${u.duracaoFormatada}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `HSC_Usuarios_Tasy_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Exportação PDF
  const exportPDF = () => {
    if (filteredUsuarios.length === 0) return;

    const doc = new jsPDF('landscape');
    
    // Cabeçalho institucional HSC
    doc.setFillColor(2, 132, 199);
    doc.rect(0, 0, 297, 20, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('HOSPITAL SANTA CASA - USUÁRIOS ATIVOS NO TASY', 14, 13);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const dataHora = new Date().toLocaleString('pt-BR');
    doc.text(`Gerado em: ${dataHora} | Total de Conexões: ${filteredUsuarios.length}`, 14, 27);

    const tableData = filteredUsuarios.map(u => [
      u.login,
      u.nome,
      u.setor,
      u.inicio,
      u.fim,
      u.duracaoFormatada
    ]);

    autoTable(doc, {
      startY: 32,
      head: [['Login', 'Colaborador', 'Setor / Unidade', 'Início', 'Timeout / Exp.', 'Tempo Conectado']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [30, 41, 59]
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      margin: { left: 14, right: 14 }
    });

    doc.save(`HSC_Usuarios_Tasy_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="space-y-6 w-full max-w-none animate-in fade-in duration-300">
      
      {/* ── HEADER ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-card/60 backdrop-blur-md p-6 rounded-2xl border border-border/60 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold tracking-tight text-foreground font-sans">
                  Usuários Ativos no Tasy
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Conexões Reais Tasy
                </span>
                {lastSyncTime && (
                  <span className="text-[11px] text-muted-foreground font-sans">
                    • Sincronizado às {lastSyncTime}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5 font-sans">
                Monitoramento em tempo real de sessões e colaboradores conectados por setor no ERP Tasy
              </p>
            </div>
          </div>
        </div>

        {/* Ações do Header */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Seletor de Auto-Refresh */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-background/50 text-xs font-medium text-muted-foreground">
            <Timer className="h-3.5 w-3.5 text-sky-500" />
            <select
              value={refreshInterval}
              onChange={(e) => {
                const val = Number(e.target.value);
                setRefreshInterval(val);
                setSecondsUntilRefresh(val);
              }}
              className="bg-transparent text-foreground border-none outline-none cursor-pointer text-xs"
              title="Intervalo de atualização automática"
            >
              <option value={0}>Auto: Desativado</option>
              <option value={15}>Auto: a cada 15s</option>
              <option value={30}>Auto: a cada 30s</option>
              <option value={60}>Auto: a cada 1 min</option>
              <option value={300}>Auto: a cada 5 min</option>
            </select>
            {refreshInterval > 0 && (
              <span className="font-mono text-sky-600 dark:text-sky-400 font-semibold min-w-[32px] text-center">
                {secondsUntilRefresh >= 60 
                  ? `${Math.floor(secondsUntilRefresh / 60)}:${(secondsUntilRefresh % 60).toString().padStart(2, '0')}`
                  : `${secondsUntilRefresh}s`}
              </span>
            )}
          </div>

          {/* Botão Sincronizar / Atualizar */}
          <button
            onClick={() => loadData(false)}
            disabled={isLoading || isRefreshing}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-all shadow-sm active:scale-95 disabled:opacity-50"
            title="Atualizar sessões agora"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </button>

          {/* Exportar CSV */}
          <button
            onClick={exportCSV}
            disabled={filteredUsuarios.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-card hover:bg-muted text-foreground text-xs font-medium transition-colors disabled:opacity-50"
            title="Exportar para planilha CSV"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500" />
            <span>CSV</span>
          </button>

          {/* Exportar PDF */}
          <button
            onClick={exportPDF}
            disabled={filteredUsuarios.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-card hover:bg-muted text-foreground text-xs font-medium transition-colors disabled:opacity-50"
            title="Exportar relatório em PDF"
          >
            <FileText className="h-3.5 w-3.5 text-rose-500" />
            <span>PDF</span>
          </button>
        </div>
      </div>

      {/* ── ALERTA DE ERRO OU AVISO ────────────────────────────────────────── */}
      {errorMessage && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-500 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button 
            onClick={() => loadData(false)}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-900 dark:text-rose-100 font-semibold transition-colors flex-shrink-0"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Tentar Novamente</span>
          </button>
        </div>
      )}

      {/* ── KPI CARDS ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Conectados */}
        <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card to-card/50 p-5 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider font-sans">
              Usuários Conectados
            </p>
            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-500">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-foreground font-sans">
              {kpis.total}
            </span>
            <span className="text-xs text-muted-foreground font-sans">sessões ativas</span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium">
            <Activity className="h-3.5 w-3.5 text-sky-500" />
            <span>Sessões simultâneas ativas</span>
          </div>
        </div>

        {/* Setor com Mais Usuários */}
        <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card to-card/50 p-5 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider font-sans">
              Setor com Mais Sessões
            </p>
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500">
              <Building2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-lg font-bold tracking-tight text-foreground font-sans block truncate" title={kpis.topSetor}>
              {kpis.topSetor}
            </span>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium">
            <Layers className="h-3.5 w-3.5 text-purple-500" />
            <span>Maior concentração de acessos</span>
          </div>
        </div>

        {/* Média de Tempo Conectado */}
        <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card to-card/50 p-5 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider font-sans">
              Média de Tempo Logado
            </p>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-foreground font-sans">
              {kpis.mediaFormatada}
            </span>
            <span className="text-xs text-muted-foreground font-sans">por sessão</span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium">
            <UserCheck className="h-3.5 w-3.5 text-emerald-500" />
            <span>Duração calculada da conexão</span>
          </div>
        </div>

        {/* Pico Simultâneo do Dia */}
        <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card to-card/50 p-5 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider font-sans">
              Pico Simultâneo Hoje
            </p>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-foreground font-sans">
              {peakToday.count > 0 ? peakToday.count : kpis.total}
            </span>
            <span className="text-xs text-muted-foreground font-sans">sessões máximas</span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium">
            <TrendingUp className="h-3.5 w-3.5 text-amber-500" />
            <span>{peakToday.time !== '-' ? `Registrado às ${peakToday.time}` : 'Recorde de conexões hoje'}</span>
          </div>
        </div>
      </div>

      {/* ── GRÁFICOS ANALÍTICOS ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico de Barras: Setores */}
        <div className="lg:col-span-2 rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-foreground font-sans">Ranking de Usuários por Setor</h2>
              <p className="text-xs text-muted-foreground font-sans">Top 10 setores com maior quantidade de colaboradores logados</p>
            </div>
            <Building2 className="h-4 w-4 text-muted-foreground opacity-60" />
          </div>

          <div className="h-[240px] w-full">
            {chartSetores.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartSetores} margin={{ top: 10, right: 10, left: -20, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 10, fill: 'currentColor' }} 
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                    className="text-muted-foreground"
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'currentColor' }} className="text-muted-foreground" />
                  <RechartsTooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(15, 23, 42, 0.95)', 
                      border: '1px solid rgba(255,255,255,0.1)', 
                      borderRadius: '8px', 
                      color: '#fff',
                      fontSize: '12px'
                    }} 
                    cursor={{ fill: 'rgba(2, 132, 199, 0.1)' }}
                  />
                  <Bar dataKey="count" name="Usuários Ativos" fill="#0284c7" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-xs">
                Nenhum dado para exibir no gráfico
              </div>
            )}
          </div>
        </div>

        {/* Gráfico de Rosca: Distribuição */}
        <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-base font-bold text-foreground font-sans">Top Setores</h2>
              <Layers className="h-4 w-4 text-muted-foreground opacity-60" />
            </div>
            <p className="text-xs text-muted-foreground font-sans mb-4">Proporção dos principais setores</p>

            <div className="h-[150px] w-full relative">
              {chartDonutSetores.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartDonutSetores}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {chartDonutSetores.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(15, 23, 42, 0.95)', 
                        border: '1px solid rgba(255,255,255,0.1)', 
                        borderRadius: '8px', 
                        color: '#fff',
                        fontSize: '12px'
                      }} 
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-xs">
                  Sem dados
                </div>
              )}
            </div>
          </div>

          <div className="mt-2 space-y-1.5">
            {chartDonutSetores.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                  <span className="text-muted-foreground truncate font-sans">{item.name}</span>
                </div>
                <span className="font-semibold text-foreground ml-2">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── FILTROS E BUSCA ────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Campo de Pesquisa */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por colaborador, login (@usuario) ou setor..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-8 py-2 rounded-xl border border-border bg-background/50 text-foreground placeholder:text-muted-foreground text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-sans"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Filtros Dropdown */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Setor */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-background/50 text-xs">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
              <select
                value={selectedSetor}
                onChange={(e) => {
                  setSelectedSetor(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-transparent text-foreground border-none outline-none cursor-pointer max-w-[180px] truncate font-sans"
              >
                {setoresList.map(s => (
                  <option key={s} value={s}>{s === 'TODOS' ? 'Todos os Setores' : s}</option>
                ))}
              </select>
            </div>

            {/* Duração */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-background/50 text-xs">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <select
                value={selectedDuracao}
                onChange={(e) => {
                  setSelectedDuracao(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-transparent text-foreground border-none outline-none cursor-pointer font-sans"
              >
                <option value="TODOS">Todas as Durações</option>
                <option value="MENOS_2H">&lt; 2 horas</option>
                <option value="2H_4H">Entre 2h e 4h</option>
                <option value="MAIS_4H">&gt; 4 horas logado</option>
              </select>
            </div>

            {/* Limpar Filtros */}
            {(searchTerm || selectedSetor !== 'TODOS' || selectedDuracao !== 'TODOS') && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedSetor('TODOS');
                  setSelectedDuracao('TODOS');
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1.5 rounded-xl text-xs text-rose-600 hover:bg-rose-500/10 transition-colors font-medium font-sans"
                title="Limpar todos os filtros"
              >
                Limpar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── TABELA DE SESSÕES CONECTADAS ───────────────────────────────────── */}
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border/80 bg-muted/40 text-muted-foreground text-xs uppercase tracking-wider font-semibold font-sans">
                <th className="p-4 w-12 text-center">Status</th>
                <th className="p-4 cursor-pointer hover:text-foreground select-none" onClick={() => handleSort('nome')}>
                  Colaborador / Login {sortField === 'nome' && (sortAsc ? '↑' : '↓')}
                </th>
                <th className="p-4 cursor-pointer hover:text-foreground select-none" onClick={() => handleSort('setor')}>
                  Setor / Posto {sortField === 'setor' && (sortAsc ? '↑' : '↓')}
                </th>
                <th className="p-4 cursor-pointer hover:text-foreground select-none text-center" onClick={() => handleSort('inicio')}>
                  Início {sortField === 'inicio' && (sortAsc ? '↑' : '↓')}
                </th>
                <th className="p-4 cursor-pointer hover:text-foreground select-none text-center" onClick={() => handleSort('fim')} title="Limite de inatividade / Horário programado de timeout">
                  Timeout / Expiração {sortField === 'fim' && (sortAsc ? '↑' : '↓')}
                </th>
                <th className="p-4 cursor-pointer hover:text-foreground select-none" onClick={() => handleSort('duracaoMinutos')}>
                  Tempo Conectado {sortField === 'duracaoMinutos' && (sortAsc ? '↑' : '↓')}
                </th>
                <th className="p-4 text-center w-16">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 text-xs font-sans">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <RefreshCw className="h-6 w-6 animate-spin text-primary" />
                      <span>Consultando usuários ativos no Tasy...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedUsuarios.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Users className="h-8 w-8 opacity-40 text-muted-foreground" />
                      <span className="font-medium text-foreground">Nenhum usuário encontrado</span>
                      <span className="text-xs">
                        {usuarios.length === 0 
                          ? 'Não foram retornados registros na consulta ao Tasy.' 
                          : 'Nenhum usuário coincide com os filtros aplicados.'}
                      </span>
                      <button
                        onClick={() => loadData(false)}
                        className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-all"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        <span>Recarregar Dados</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedUsuarios.map((user, idx) => (
                  <tr 
                    key={`${user.login}_${idx}`} 
                    className="hover:bg-muted/30 transition-colors group cursor-pointer"
                    onClick={() => setSelectedUser(user)}
                  >
                    {/* Status */}
                    <td className="p-4 text-center">
                      <span 
                        className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50 animate-pulse"
                        title="Conectado no Tasy"
                      />
                    </td>

                    {/* Colaborador / Login */}
                    <td className="p-4">
                      <div>
                        <span className="font-bold text-foreground block group-hover:text-primary transition-colors text-sm">
                          {user.nome}
                        </span>
                        <span className="text-[11px] text-muted-foreground font-mono">
                          @{user.login}
                        </span>
                      </div>
                    </td>

                    {/* Setor */}
                    <td className="p-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-sky-500/10 text-sky-700 dark:text-sky-300 font-semibold text-[11px] border border-sky-500/20">
                        <Building2 className="h-3 w-3 text-sky-500" />
                        {user.setor}
                      </span>
                    </td>

                    {/* Início */}
                    <td className="p-4 text-center">
                      <span className="font-mono text-xs text-foreground bg-muted/60 px-2 py-0.5 rounded border border-border/40 font-medium">
                        {user.inicio}
                      </span>
                    </td>

                    {/* Fim / Timeout */}
                    <td className="p-4 text-center">
                      <span className="font-mono text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 font-medium" title="Horário limite de timeout por inatividade">
                        {user.fim}
                      </span>
                    </td>

                    {/* Tempo Conectado */}
                    <td className="p-4">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-mono font-bold text-foreground">
                          {user.duracaoFormatada}
                        </span>
                      </div>
                    </td>

                    {/* Ações */}
                    <td className="p-4 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedUser(user);
                        }}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        title="Ver detalhes da sessão"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        <div className="flex flex-col sm:flex-row items-center justify-between p-4 border-t border-border/60 gap-3 text-xs text-muted-foreground font-sans">
          <span>
            Mostrando <strong>{paginatedUsuarios.length}</strong> de <strong>{filteredUsuarios.length}</strong> usuários ({kpis.total} no Tasy)
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Página anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span>
              Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong>
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Próxima página"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── MODAL DE DETALHES DO USUÁRIO ───────────────────────────────────── */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-6">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                  <Users className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground font-sans">Detalhes da Sessão</h3>
                  <p className="text-xs text-muted-foreground font-sans">Informações do colaborador conectado no Tasy</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="p-2 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Detalhes em Grid */}
            <div className="grid grid-cols-2 gap-4 text-xs font-sans">
              <div className="col-span-2 p-3.5 rounded-xl bg-muted/40 border border-border/50 space-y-1 relative group">
                <span className="text-muted-foreground text-[11px] block">Colaborador</span>
                <span className="font-bold text-foreground text-sm block">{selectedUser.nome}</span>
                <span className="font-mono text-muted-foreground text-[11px]">Login: @{selectedUser.login}</span>
                <button
                  onClick={() => copyToClipboard(selectedUser.nome, 'nome')}
                  className="absolute right-2.5 top-2.5 p-1 rounded hover:bg-muted text-muted-foreground"
                  title="Copiar Nome"
                >
                  {copiedField === 'nome' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                </button>
              </div>

              <div className="p-3.5 rounded-xl bg-muted/40 border border-border/50 space-y-1 relative group">
                <span className="text-muted-foreground text-[11px] block">Login Tasy</span>
                <span className="font-mono font-bold text-foreground block text-sm">{selectedUser.login}</span>
                <button
                  onClick={() => copyToClipboard(selectedUser.login, 'login')}
                  className="absolute right-2.5 top-2.5 p-1 rounded hover:bg-muted text-muted-foreground"
                  title="Copiar Login"
                >
                  {copiedField === 'login' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                </button>
              </div>

              <div className="p-3.5 rounded-xl bg-muted/40 border border-border/50 space-y-1">
                <span className="text-muted-foreground text-[11px] block">Status da Conexão</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">Conectado Ativo</span>
                </div>
              </div>

              <div className="col-span-2 p-3.5 rounded-xl bg-muted/40 border border-border/50 space-y-1">
                <span className="text-muted-foreground text-[11px] block">Setor / Posto de Trabalho</span>
                <span className="font-semibold text-foreground block text-sm">{selectedUser.setor}</span>
              </div>

              <div className="p-3.5 rounded-xl bg-muted/40 border border-border/50 space-y-1">
                <span className="text-muted-foreground text-[11px] block">Horário de Entrada (Início)</span>
                <span className="font-mono text-foreground font-semibold block text-sm">{selectedUser.inicio}</span>
              </div>

              <div className="p-3.5 rounded-xl bg-muted/40 border border-border/50 space-y-1">
                <span className="text-muted-foreground text-[11px] block">Limite de Inatividade (Timeout Tasy)</span>
                <span className="font-mono text-amber-600 dark:text-amber-400 font-semibold block text-sm">{selectedUser.fim}</span>
              </div>

              <div className="col-span-2 p-3.5 rounded-xl bg-sky-500/10 border border-sky-500/20 space-y-1">
                <span className="text-sky-700 dark:text-sky-300 text-[11px] block font-medium">Tempo Conectado (Desde o Início)</span>
                <span className="font-mono font-bold text-sky-800 dark:text-sky-200 text-base block">{selectedUser.duracaoFormatada}</span>
              </div>
            </div>

            {/* Footer do Modal */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
              <button
                onClick={() => setSelectedUser(null)}
                className="px-4 py-2 rounded-xl bg-muted text-foreground text-xs font-semibold hover:bg-muted/80 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default UsuariosTasy;
