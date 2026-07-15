import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Wallet, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, 
  Search, Filter, RefreshCw, FileText, CheckCircle2, Clock, 
  AlertCircle, X, User, ShieldCheck, HeartPulse, ChevronLeft, ChevronRight
} from 'lucide-react';
import { webhookService } from '../../services/webhookService';
import { supabase } from '../../lib/supabase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export interface RecebimentoDetalhe {
  valor: number;
  tipo: string;
}

export interface TransacaoFaturamento {
  nrAtendimento: number;
  nrInternoConta: number;
  dtEntrada: string;
  dtAlta: string | null;
  ieStatusAcerto: number; // 2 = Pago/Acertado, outros = Pendente
  convenio: string;
  valorConta: number;
  vlRecebido: number;
  tipoRecebimento: string;
  paciente: string;
  medico: string;
  detalhesRecebimento?: RecebimentoDetalhe[];
}

const cleanString = (val: any, fallback: string = ''): string => {
  if (val === undefined || val === null) return fallback;
  const str = String(val).trim();
  if (str.toLowerCase() === 'null' || str.toLowerCase() === 'undefined' || str === 'Não Informado') return fallback;
  return str;
};

const parseStatusAcerto = (val: any): number => {
  if (val === undefined || val === null) return 1;
  const str = String(val).trim().toLowerCase();
  // 2 = Pago/Acertado/Definitivo
  if (str === '2' || str.includes('definitivo') || str.includes('pago')) {
    return 2;
  }
  // 1 = Pendente/Provisório
  if (str === '1' || str.includes('provisorio') || str.includes('provisório') || str.includes('pendente')) {
    return 1;
  }
  const num = Number(val);
  return isNaN(num) ? 1 : num;
};

const processAndGroupTransactions = (list: TransacaoFaturamento[]): TransacaoFaturamento[] => {
  const formattedList = list.map(item => {
    return {
      ...item,
      paciente: cleanString(item.paciente, 'Sem Nome'),
      medico: cleanString(item.medico, ''),
      tipoRecebimento: cleanString(item.tipoRecebimento, ''),
      convenio: cleanString(item.convenio, 'Particular')
    };
  });

  const groupedMap = new Map<string, TransacaoFaturamento>();

  formattedList.forEach(item => {
    // Se nrInternoConta for 0 ou menor, agrupamos por nrAtendimento + um identificador aleatório para não mesclar
    const key = item.nrInternoConta > 0 
      ? `conta-${item.nrInternoConta}` 
      : `atend-${item.nrAtendimento}-${Math.random()}`;

    if (!groupedMap.has(key)) {
      const copy = { ...item };
      if (!copy.detalhesRecebimento) {
        copy.detalhesRecebimento = [];
        const tipoLimpo = item.tipoRecebimento || '-';
        if (item.vlRecebido > 0 || (item.tipoRecebimento && item.tipoRecebimento !== 'A faturar')) {
          copy.detalhesRecebimento.push({
            valor: item.vlRecebido,
            tipo: tipoLimpo
          });
        } else {
          copy.detalhesRecebimento.push({
            valor: 0,
            tipo: tipoLimpo
          });
        }
      } else {
        copy.detalhesRecebimento = copy.detalhesRecebimento.map(d => ({ ...d }));
      }
      groupedMap.set(key, copy);
    } else {
      const existing = groupedMap.get(key)!;
      
      // Somar os valores recebidos
      existing.vlRecebido += item.vlRecebido;
      
      // Adicionar aos detalhes de recebimento
      const tipoLimpo = item.tipoRecebimento || '-';
      if (!existing.detalhesRecebimento) {
        existing.detalhesRecebimento = [];
      }
      
      if (item.detalhesRecebimento && item.detalhesRecebimento.length > 0) {
        item.detalhesRecebimento.forEach(d => {
          const detalheExistente = existing.detalhesRecebimento!.find(
            ed => ed.tipo.toLowerCase() === d.tipo.toLowerCase()
          );
          if (detalheExistente) {
            detalheExistente.valor += d.valor;
          } else {
            existing.detalhesRecebimento!.push({ ...d });
          }
        });
      } else {
        const detalheExistente = existing.detalhesRecebimento.find(
          d => d.tipo.toLowerCase() === tipoLimpo.toLowerCase()
        );
        
        if (detalheExistente) {
          detalheExistente.valor += item.vlRecebido;
        } else {
          existing.detalhesRecebimento.push({
            valor: item.vlRecebido,
            tipo: tipoLimpo
          });
        }
      }
      
      // Agrupar tipos de recebimento únicos sem duplicados
      const types = new Set<string>();
      if (existing.tipoRecebimento) {
        existing.tipoRecebimento.split(',').map(s => s.trim()).filter(Boolean).forEach(t => types.add(t));
      }
      if (item.tipoRecebimento) {
        item.tipoRecebimento.split(',').map(s => s.trim()).filter(Boolean).forEach(t => types.add(t));
      }
      existing.tipoRecebimento = Array.from(types).join(', ');
      
      // Manter o maior valor da conta
      existing.valorConta = Math.max(existing.valorConta, item.valorConta);
      
      // Ajustar status se algum item for pago ou se o valor recebido atingir o valor da conta
      if (item.ieStatusAcerto === 2 || existing.vlRecebido >= existing.valorConta) {
        existing.ieStatusAcerto = 2;
      }
      
      // Atualizar data de alta se disponível
      if (!existing.dtAlta && item.dtAlta) {
        existing.dtAlta = item.dtAlta;
      }
    }
  });

  return Array.from(groupedMap.values());
};

const generateMockTransacoes = (): TransacaoFaturamento[] => {
  return [
    { nrAtendimento: 4498, nrInternoConta: 49141, dtEntrada: '2026-06-25T14:12:02.000Z', dtAlta: '2026-06-25T17:29:54.000Z', ieStatusAcerto: 2, convenio: 'Particular', valorConta: 300.00, vlRecebido: 300.00, tipoRecebimento: 'Pix', paciente: 'Maria Alice Felix Pereira Dias de Deus', medico: 'Caroline Gabriele Ferreira Santos' },
    // Conta 49172 dividida em duas transações com recebimentos e meios diferentes para fins de teste
    { nrAtendimento: 4522, nrInternoConta: 49172, dtEntrada: '2026-06-25T17:37:28.000Z', dtAlta: '2026-06-27T10:03:07.000Z', ieStatusAcerto: 2, convenio: 'Particular', valorConta: 2389.00, vlRecebido: 1000.00, tipoRecebimento: 'Pix', paciente: 'Luana Caetano Pereira', medico: 'Magno de Freitas Malafaia' },
    { nrAtendimento: 4522, nrInternoConta: 49172, dtEntrada: '2026-06-25T17:37:28.000Z', dtAlta: '2026-06-27T10:03:07.000Z', ieStatusAcerto: 2, convenio: 'Particular', valorConta: 2389.00, vlRecebido: 1389.00, tipoRecebimento: 'Cartão de Crédito', paciente: 'Luana Caetano Pereira', medico: 'Magno de Freitas Malafaia' },
    { nrAtendimento: 4544, nrInternoConta: 49196, dtEntrada: '2026-06-25T20:35:35.000Z', dtAlta: '2026-06-26T08:35:35.000Z', ieStatusAcerto: 2, convenio: 'Particular', valorConta: 200.00, vlRecebido: 200.00, tipoRecebimento: 'Dinheiro', paciente: 'Maria Aparecida de Moura Silva', medico: 'Rogerio da Cruz Cunha' },
    { nrAtendimento: 4548, nrInternoConta: 49204, dtEntrada: '2026-06-25T20:34:30.000Z', dtAlta: '2026-06-27T10:03:07.000Z', ieStatusAcerto: 1, convenio: 'Particular', valorConta: 450.00, vlRecebido: 0, tipoRecebimento: 'A faturar', paciente: 'Arthur Ramos Souza', medico: 'Caroline Gabriele Ferreira Santos' },
    { nrAtendimento: 4580, nrInternoConta: 49220, dtEntrada: '2026-06-26T08:15:00.000Z', dtAlta: '2026-06-26T12:00:00.000Z', ieStatusAcerto: 1, convenio: 'Unimed', valorConta: 1250.00, vlRecebido: 0, tipoRecebimento: 'Convênio', paciente: 'Carlos Eduardo Oliveira', medico: 'Magno de Freitas Malafaia' },
    { nrAtendimento: 4592, nrInternoConta: 49235, dtEntrada: '2026-06-26T10:30:00.000Z', dtAlta: '2026-06-28T14:20:00.000Z', ieStatusAcerto: 2, convenio: 'Bradesco Saúde', valorConta: 3200.00, vlRecebido: 3200.00, tipoRecebimento: 'Faturamento', paciente: 'Beatriz Santos Pinheiro', medico: 'Rogerio da Cruz Cunha' },
    // Conta 49250 com valores null em dtAlta, tipoRecebimento e medico para fins de teste
    { nrAtendimento: 4610, nrInternoConta: 49250, dtEntrada: '2026-06-27T09:00:00.000Z', dtAlta: 'null', ieStatusAcerto: 1, convenio: 'SUS', valorConta: 850.00, vlRecebido: 0, tipoRecebimento: 'null', paciente: 'Jose Silva Ferreira', medico: 'null' },
  ];
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

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '-';
  const cleanStr = String(dateStr).trim().toLowerCase();
  if (cleanStr === 'null' || cleanStr === 'undefined' || cleanStr === '') return '-';
  const cleanDate = dateStr.split('T')[0];
  const parts = cleanDate.split('-');
  if (parts.length !== 3) return dateStr;
  const [year, month, day] = parts;
  return `${day}/${month}/${year}`;
};

const getExibidosRecebimentos = (t: TransacaoFaturamento, filter: string) => {
  if (filter === 'Todos') {
    return t.detalhesRecebimento && t.detalhesRecebimento.length > 0
      ? t.detalhesRecebimento
      : [{ valor: t.vlRecebido, tipo: t.tipoRecebimento || '-' }];
  } else {
    const matches = (t.detalhesRecebimento || []).filter(
      d => d.tipo.toLowerCase() === filter.toLowerCase()
    );
    if (matches.length > 0) return matches;
    if (t.tipoRecebimento && t.tipoRecebimento.toLowerCase().includes(filter.toLowerCase())) {
      return [{ valor: t.vlRecebido, tipo: filter }];
    }
    return [{ valor: 0, tipo: '-' }];
  }
};

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

const Tesouraria: React.FC = () => {
  const [transacoes, setTransacoes] = useState<TransacaoFaturamento[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [syncTime, setSyncTime] = useState<string | null>(null);

  // Filtros
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [convenioFilter, setConvenioFilter] = useState<string>('Todos');
  const [medicoFilter, setMedicoFilter] = useState<string>('Todos');
  const [statusFilter, setStatusFilter] = useState<string>('Todos');
  const [tipoRecebimentoFilter, setTipoRecebimentoFilter] = useState<string>('Todos');
  
  // Datas de filtro
  const [periodFrom, setPeriodFrom] = useState<string>(() => getDefaultDates().from);
  const [periodTo, setPeriodTo] = useState<string>(() => getDefaultDates().to);

  // Paginação
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 10;

  // Modal de Detalhes
  const [selectedTransacao, setSelectedTransacao] = useState<TransacaoFaturamento | null>(null);
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);

  const saveToCache = (
    list: TransacaoFaturamento[],
    time: string | null,
    isDemo: boolean,
    status: 'idle' | 'success' | 'error',
    from: string,
    to: string
  ) => {
    try {
      sessionStorage.setItem('hsc_tesouraria_v4_cache_data', JSON.stringify(list));
      if (time) sessionStorage.setItem('hsc_tesouraria_v4_cache_time', time);
      sessionStorage.setItem('hsc_tesouraria_v4_cache_is_demo', String(isDemo));
      sessionStorage.setItem('hsc_tesouraria_v4_cache_status', status);
      sessionStorage.setItem('hsc_tesouraria_v4_cache_from', from);
      sessionStorage.setItem('hsc_tesouraria_v4_cache_to', to);
    } catch (e) {
      console.error('Erro ao salvar cache de tesouraria:', e);
    }
  };

  const fetchTransacoes = useCallback(async (showLoading = true, forceRefresh = false) => {
    if (!forceRefresh) {
      try {
        const cachedData = sessionStorage.getItem('hsc_tesouraria_v4_cache_data');
        const cachedTime = sessionStorage.getItem('hsc_tesouraria_v4_cache_time');
        const cachedIsDemo = sessionStorage.getItem('hsc_tesouraria_v4_cache_is_demo');
        const cachedStatus = sessionStorage.getItem('hsc_tesouraria_v4_cache_status');
        const cachedFrom = sessionStorage.getItem('hsc_tesouraria_v4_cache_from');
        const cachedTo = sessionStorage.getItem('hsc_tesouraria_v4_cache_to');

        if (cachedData && cachedFrom === periodFrom && cachedTo === periodTo) {
          const parsed = JSON.parse(cachedData);
          setTransacoes(parsed);
          setSyncTime(cachedTime);
          setIsDemoMode(cachedIsDemo === 'true');
          setSyncStatus((cachedStatus as any) || 'success');
          setLoading(false);
          return;
        }
      } catch (e) {
        console.error('Erro ao ler cache de tesouraria:', e);
      }
    }

    if (showLoading) setLoading(true);
    setSyncStatus('idle');

    try {
      const response = await webhookService.triggerFinanceiro({
        action: 'list',
        dateFrom: periodFrom,
        dateTo: periodTo,
        timestamp: new Date().toISOString()
      });

      const nowTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      if (response && (Array.isArray(response) || Array.isArray(response.data))) {
        const rawList = Array.isArray(response) ? response : response.data;
        const formatted: TransacaoFaturamento[] = rawList.map((item: any) => {
          const valorConta = Number(
            item.VALOR_CONTA !== undefined ? item.VALOR_CONTA : 
            item.valor_conta !== undefined ? item.valor_conta : 0
          );
          const vlRecebido = Number(
            item.VL_RECEBIDO !== undefined ? item.VL_RECEBIDO : 
            item.vl_recebido !== undefined ? item.vl_recebido : 
            item.VALOR_RECEBIDO !== undefined ? item.VALOR_RECEBIDO :
            item.valor_recebido !== undefined ? item.valor_recebido : 0
          );
          const tipoRecebimento = cleanString(
            item.TIPO_RECEBIMENTO !== undefined ? item.TIPO_RECEBIMENTO : 
            item.tipo_recebimento !== undefined ? item.tipo_recebimento : ''
          );

          return {
            nrAtendimento: Number(item.NR_ATENDIMENTO || 0),
            nrInternoConta: Number(item.NR_INTERNO_CONTA || 0),
            dtEntrada: String(item.DT_ENTRADA || new Date().toISOString()),
            dtAlta: item.DT_ALTA ? String(item.DT_ALTA) : null,
            ieStatusAcerto: parseStatusAcerto(item.IE_STATUS_ACERTO !== undefined ? item.IE_STATUS_ACERTO : (item.ie_status_acerto !== undefined ? item.ie_status_acerto : 1)),
            convenio: cleanString(item.CONVENIO || item.convenio, 'Particular'),
            valorConta,
            vlRecebido,
            tipoRecebimento,
            paciente: cleanString(item.PACIENTE || item.paciente, 'Sem Nome'),
            medico: cleanString(item.MEDICO || item.medico, '')
          };
        });

        const groupedAndCleaned = processAndGroupTransactions(formatted);

        setTransacoes(groupedAndCleaned);
        setIsDemoMode(false);
        setSyncStatus('success');
        setSyncTime(nowTime);
        saveToCache(groupedAndCleaned, nowTime, false, 'success', periodFrom, periodTo);

        // Log de Auditoria no Supabase
        try {
          await supabase.from('pendencias_webhook_logs').insert({
            date_from: periodFrom,
            date_to: periodTo,
            payload: { webhook: 'financeiro', recordsCount: groupedAndCleaned.length },
            status: 'sucesso'
          });
        } catch (e) {
          console.warn('Logging no Supabase ignorado:', e);
        }
      } else {
        // Fallback para mock
        const mockData = processAndGroupTransactions(generateMockTransacoes());
        setTransacoes(mockData);
        setIsDemoMode(true);
        setSyncStatus('success');
        setSyncTime(nowTime);
        saveToCache(mockData, nowTime, true, 'success', periodFrom, periodTo);
      }
    } catch (error) {
      console.error('Erro no webhook de tesouraria:', error);
      const mockData = processAndGroupTransactions(generateMockTransacoes());
      setTransacoes(mockData);
      setIsDemoMode(true);
      setSyncStatus('error');
      const nowTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      setSyncTime(nowTime);
      saveToCache(mockData, nowTime, true, 'error', periodFrom, periodTo);
    } finally {
      setLoading(false);
    }
  }, [periodFrom, periodTo]);

  useEffect(() => {
    fetchTransacoes();
  }, [fetchTransacoes]);

  // Lista dinâmica de convênios para filtro
  const conveniosUnicos = useMemo(() => {
    const set = new Set<string>();
    transacoes.forEach(t => {
      if (t.convenio) set.add(t.convenio);
    });
    return Array.from(set).sort();
  }, [transacoes]);

  // Lista dinâmica de médicos para filtro
  const medicosUnicos = useMemo(() => {
    const set = new Set<string>();
    transacoes.forEach(t => {
      if (t.medico) set.add(t.medico);
    });
    return Array.from(set).sort();
  }, [transacoes]);

  // Lista dinâmica de tipos de recebimento para filtro desmembrados
  const tiposRecebimentoUnicos = useMemo(() => {
    const set = new Set<string>();
    transacoes.forEach(t => {
      if (t.detalhesRecebimento && t.detalhesRecebimento.length > 0) {
        t.detalhesRecebimento.forEach(d => {
          if (d.tipo && d.tipo !== '-' && d.tipo !== 'Não Informado') {
            set.add(d.tipo);
          }
        });
      } else if (t.tipoRecebimento) {
        t.tipoRecebimento.split(',').map(s => s.trim()).filter(
          s => s && s !== '-' && s !== 'Não Informado'
        ).forEach(x => set.add(x));
      }
    });
    return Array.from(set).sort();
  }, [transacoes]);

  // Filtragem local
  const transacoesFiltradas = useMemo(() => {
    return transacoes.filter(t => {
      // 1. Filtro de período local (Entrada / Alta)
      if (periodFrom || periodTo) {
        const entStr = t.dtEntrada ? t.dtEntrada.substring(0, 10) : '';
        const altStr = t.dtAlta ? t.dtAlta.substring(0, 10) : '';
        
        let matchPeriod = false;
        
        const isEntradaOk = (!periodFrom || entStr >= periodFrom) && (!periodTo || entStr <= periodTo);
        const isAltaOk = t.dtAlta ? ((!periodFrom || altStr >= periodFrom) && (!periodTo || altStr <= periodTo)) : false;
        
        if (isEntradaOk || isAltaOk) {
          matchPeriod = true;
        }
        
        if (!matchPeriod) return false;
      }

      // 2. Busca Livre por Paciente, Médico, Atendimento ou Conta
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matches = t.paciente.toLowerCase().includes(term) || 
                        t.medico.toLowerCase().includes(term) || 
                        String(t.nrAtendimento).includes(term) || 
                        String(t.nrInternoConta).includes(term);
        if (!matches) return false;
      }

      // 3. Filtro de convênio
      if (convenioFilter !== 'Todos' && t.convenio !== convenioFilter) return false;

      // 4. Filtro de médico
      if (medicoFilter !== 'Todos' && t.medico !== medicoFilter) return false;
      
      // 5. Filtro de status da conta
      if (statusFilter !== 'Todos') {
        const isPago = t.ieStatusAcerto === 2;
        if (statusFilter === 'PAGO' && !isPago) return false;
        if (statusFilter === 'PENDENTE' && isPago) return false;
      }

      // 6. Filtro de tipo de recebimento
      if (tipoRecebimentoFilter !== 'Todos') {
        const temTipo = (t.detalhesRecebimento || []).some(
          d => d.tipo.toLowerCase() === tipoRecebimentoFilter.toLowerCase()
        ) || (t.tipoRecebimento && t.tipoRecebimento.toLowerCase().includes(tipoRecebimentoFilter.toLowerCase()));
        if (!temTipo) return false;
      }

      return true;
    });
  }, [transacoes, searchTerm, convenioFilter, medicoFilter, statusFilter, periodFrom, periodTo, tipoRecebimentoFilter]);

  // Cálculos de KPIs
  const kpis = useMemo(() => {
    let totalFaturado = 0;
    let totalRecebido = 0;
    let totalPendente = 0;

    transacoesFiltradas.forEach(t => {
      totalFaturado += t.valorConta;
      
      const exibidos = getExibidosRecebimentos(t, tipoRecebimentoFilter);
      const recEfetivo = exibidos.reduce((sum, d) => sum + d.valor, 0);
      const recTotal = t.vlRecebido > 0 ? t.vlRecebido : (t.ieStatusAcerto === 2 ? t.valorConta : 0);

      totalRecebido += recEfetivo;
      totalPendente += Math.max(0, t.valorConta - recTotal);
    });

    return {
      totalFaturado,
      totalRecebido,
      totalPendente,
      totalAtendimentos: transacoesFiltradas.length
    };
  }, [transacoesFiltradas, tipoRecebimentoFilter]);

  // Dados para Gráfico de Recharts por Convênio
  const chartData = useMemo(() => {
    const dataMap: Record<string, { convenio: string; Pago: number; Pendente: number }> = {};
    
    transacoesFiltradas.forEach(t => {
      if (!dataMap[t.convenio]) {
        dataMap[t.convenio] = { convenio: t.convenio, Pago: 0, Pendente: 0 };
      }
      
      const exibidos = getExibidosRecebimentos(t, tipoRecebimentoFilter);
      const recEfetivo = exibidos.reduce((sum, d) => sum + d.valor, 0);
      const recTotal = t.vlRecebido > 0 ? t.vlRecebido : (t.ieStatusAcerto === 2 ? t.valorConta : 0);
      const pend = Math.max(0, t.valorConta - recTotal);
      
      dataMap[t.convenio].Pago += recEfetivo;
      dataMap[t.convenio].Pendente += pend;
    });

    return Object.values(dataMap).sort((a, b) => (b.Pago + b.Pendente) - (a.Pago + a.Pendente));
  }, [transacoesFiltradas, tipoRecebimentoFilter]);

  // Paginação
  const paginatedTransacoes = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return transacoesFiltradas.slice(start, start + itemsPerPage);
  }, [transacoesFiltradas, currentPage]);

  const totalPages = Math.ceil(transacoesFiltradas.length / itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, convenioFilter, medicoFilter, statusFilter, periodFrom, periodTo, tipoRecebimentoFilter]);

  // Marcar como Pago localmente (Ação Simulada)
  const handleMarkAsPaid = async (nrAtendimento: number, nrInternoConta: number) => {
    setIsActionLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const updated = transacoes.map(t => {
        if (t.nrAtendimento === nrAtendimento && t.nrInternoConta === nrInternoConta) {
          const newTipo = t.tipoRecebimento && t.tipoRecebimento !== 'Não Informado' ? t.tipoRecebimento : 'Tesouraria';
          return {
            ...t,
            ieStatusAcerto: 2,
            dtAlta: t.dtAlta || new Date().toISOString(),
            vlRecebido: t.valorConta,
            tipoRecebimento: newTipo,
            detalhesRecebimento: [{ valor: t.valorConta, tipo: newTipo }]
          };
        }
        return t;
      });

      setTransacoes(updated);
      saveToCache(updated, syncTime, isDemoMode, syncStatus, periodFrom, periodTo);
      setSelectedTransacao(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsActionLoading(false);
    }
  };

  // Exportar PDF Executivo
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
    doc.text('Relatório Executivo de Contas e Receitas', 14, 32);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, 38);
    
    const activeFilters = [];
    if (convenioFilter !== 'Todos') activeFilters.push(`Convênio: ${convenioFilter}`);
    if (medicoFilter !== 'Todos') activeFilters.push(`Médico: ${medicoFilter}`);
    if (statusFilter !== 'Todos') activeFilters.push(`Status: ${statusFilter}`);
    if (tipoRecebimentoFilter !== 'Todos') activeFilters.push(`Tipo Rec.: ${tipoRecebimentoFilter}`);
    if (periodFrom || periodTo) {
      const format = (p: string) => p.split('-').reverse().join('/');
      activeFilters.push(`Período: ${format(periodFrom)} a ${format(periodTo)}`);
    }

    if (activeFilters.length > 0) {
      doc.text(`Filtros: ${activeFilters.join(' | ')}`, 14, 43);
    }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text('Resumo Financeiro', 14, 52);

    autoTable(doc, {
      startY: 56,
      head: [['Total Faturado', 'Total Recebido (Pago)', 'Total Pendente', 'Total Atendimentos']],
      body: [[
        formatCurrency(kpis.totalFaturado),
        formatCurrency(kpis.totalRecebido),
        formatCurrency(kpis.totalPendente),
        kpis.totalAtendimentos.toString()
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
    doc.text('Lista de Contas por Atendimento', 14, nextY);

    const tableBody = transacoesFiltradas.map(t => {
      const exibidos = getExibidosRecebimentos(t, tipoRecebimentoFilter);
      const vlsStr = exibidos.map(d => formatCurrency(d.valor)).join('\n');
      const tiposStr = exibidos.map(d => d.tipo).join('\n');

      return [
        t.nrAtendimento,
        t.nrInternoConta,
        t.paciente,
        t.convenio,
        formatDate(t.dtEntrada),
        formatCurrency(t.valorConta),
        vlsStr || formatCurrency(0),
        tiposStr || '-',
        t.ieStatusAcerto === 2 ? 'Pago' : 'Pendente'
      ];
    });

    autoTable(doc, {
      startY: nextY + 4,
      head: [['Atend.', 'Conta', 'Paciente', 'Convênio', 'Entrada', 'Valor Conta', 'Valor Rec.', 'Tipo Rec.', 'Status']],
      body: tableBody,
      theme: 'striped',
      headStyles: { fillColor: [90, 16, 16] },
      columnStyles: {
        5: { halign: 'right', fontStyle: 'bold' },
        6: { halign: 'right' },
        7: { halign: 'center' },
        8: { halign: 'center' }
      }
    });

    doc.save(`HSC_Relatorio_Tesouraria_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="space-y-6 w-full px-[40px] max-w-none pb-12 animate-in fade-in duration-500 bg-background text-foreground">
      
      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border/60 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-[#8a1515]/10 flex items-center justify-center border border-[#8a1515]/20 text-[#8a1515] dark:text-[#f43f5e]">
              <Wallet className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground font-sans">Tesouraria</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Gestão e controle de caixa baseado em entradas de faturamento hospitalar</p>
            </div>
          </div>
        </div>

        {/* Status de Sincronismo do Webhook */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
          {isDemoMode && (
            <div className="flex items-center gap-1 bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 px-3 py-1.5 rounded-full text-xs font-semibold border border-amber-200 dark:border-amber-900/50">
              Modo Demonstração
            </div>
          )}

          {syncTime && syncStatus === 'success' && (
            <div className="flex items-center gap-1.5 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 px-3 py-1.5 rounded-full text-xs font-semibold border border-emerald-200 dark:border-emerald-900/50 shadow-sm">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Sincronizado {syncTime}
            </div>
          )}

          {syncStatus === 'error' && (
            <div className="flex items-center gap-1.5 bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 px-3 py-1.5 rounded-full text-xs font-semibold border border-red-200 dark:border-red-900/50 shadow-sm">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
              Conexão Webhook Falhou
            </div>
          )}

          <button
            onClick={() => fetchTransacoes(true, true)}
            disabled={loading}
            className="flex items-center justify-center rounded-md text-sm font-semibold bg-card border border-border text-foreground hover:bg-muted h-10 w-10 transition-all shadow-sm cursor-pointer"
            title="Recarregar do n8n"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleExportPDF}
            disabled={loading || transacoesFiltradas.length === 0}
            className="flex-1 md:flex-none inline-flex items-center justify-center rounded-md text-sm font-semibold bg-card border border-border text-foreground hover:bg-muted h-10 px-4 transition-all shadow-sm disabled:opacity-50 cursor-pointer"
          >
            <FileText className="mr-2 h-4 w-4 text-rose-600" />
            PDF Financeiro
          </button>
        </div>
      </div>

      {/* ── KPIs CARD ROW ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Faturado */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-center">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Total Faturado</p>
              <h3 className="text-2xl font-bold tracking-tight text-foreground">
                {loading ? '---' : formatCurrency(kpis.totalFaturado)}
              </h3>
            </div>
            <div className="h-10 w-10 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 text-indigo-600 dark:text-indigo-400">
              <Wallet className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 text-[10px] text-muted-foreground">
            Soma de todas as contas no período
          </div>
        </div>

        {/* Total Recebido */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-center">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Total Recebido</p>
              <h3 className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                {loading ? '---' : formatCurrency(kpis.totalRecebido)}
              </h3>
            </div>
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 text-[10px] text-muted-foreground">
            Contas com acerto efetuado
          </div>
        </div>

        {/* Total Pendente */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-center">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Total Pendente</p>
              <h3 className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
                {loading ? '---' : formatCurrency(kpis.totalPendente)}
              </h3>
            </div>
            <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center border border-amber-500/20 text-amber-600 dark:text-amber-400">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 text-[10px] text-muted-foreground">
            Contas aguardando liquidação/repasses
          </div>
        </div>

        {/* Total Atendimentos */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-center">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Atendimentos</p>
              <h3 className="text-2xl font-bold tracking-tight text-foreground font-sans">
                {loading ? '---' : kpis.totalAtendimentos}
              </h3>
            </div>
            <div className="h-10 w-10 rounded-lg bg-[#8a1515]/10 flex items-center justify-center border border-[#8a1515]/20 text-[#8a1515] dark:text-[#f43f5e]">
              <HeartPulse className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 text-[10px] text-muted-foreground">
            Contas associadas a atendimentos
          </div>
        </div>
      </div>

      {/* ── SELETOR DE PERÍODO & GRÁFICO ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Seletor de Período de Entrada/Alta */}
        <div className="lg:col-span-4 bg-card text-card-foreground p-5 rounded-xl border border-[#8a1515]/20 bg-[#8a1515]/5 shadow-sm flex flex-col justify-center">
          <p className="text-xs font-bold text-[#8a1515] dark:text-[#f43f5e] uppercase tracking-wider flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4" />
            Filtro por Período (Entrada / Alta)
          </p>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div>
              <label className="text-[10px] text-muted-foreground uppercase font-bold">Data Inicial</label>
              <input
                type="date"
                value={periodFrom}
                onChange={(e) => setPeriodFrom(e.target.value)}
                className="w-full bg-background border border-input rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#8a1515] [&::-webkit-calendar-picker-indicator]:dark:invert"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase font-bold">Data Final</label>
              <input
                type="date"
                value={periodTo}
                onChange={(e) => setPeriodTo(e.target.value)}
                className="w-full bg-background border border-input rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#8a1515] [&::-webkit-calendar-picker-indicator]:dark:invert"
              />
            </div>
          </div>
          <div className="mt-3 text-[10.5px] text-muted-foreground leading-relaxed">
            * Altere as datas acima para fazer novas requisições diretamente ao banco do hospital via n8n.
          </div>
        </div>

        {/* Gráfico de Faturamento por Convênio */}
        <div className="lg:col-span-8 bg-card border border-border rounded-xl p-5 shadow-sm flex flex-col h-[320px]">
          <div className="mb-4 flex-shrink-0 flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Faturamento por Convênio</h3>
              <p className="text-[10px] text-muted-foreground">Valores acumulados divididos por repasses pagos e pendentes</p>
            </div>
          </div>
          <div className="flex-1 min-h-0 w-full">
            {chartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                Nenhum lançamento no período filtrado.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="convenio" stroke="#a1a1aa" fontSize={10} tickLine={false} />
                  <YAxis tickFormatter={formatCompactCurrency} stroke="#a1a1aa" fontSize={10} tickLine={false} />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value)]}
                    contentStyle={{ 
                      backgroundColor: 'var(--color-card)', 
                      borderColor: 'var(--color-border)', 
                      color: 'var(--color-foreground)', 
                      borderRadius: '8px' 
                    }}
                  />
                  <Legend verticalAlign="top" height={36} iconType="circle" fontSize={11} />
                  <Bar dataKey="Pago" name="Recebido / Acertado" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Pendente" name="Aguardando Acerto" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* ── BARRA DE FILTROS (CONVÊNIO, MÉDICO, BUSCA) ── */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-4">
          
          {/* Busca Livre por Paciente ou Atendimento */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar paciente, médico ou conta..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-[#8a1515] placeholder-muted-foreground/60 transition-colors"
            />
          </div>

          {/* Filtro de Convênio */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase">Convênio:</span>
            <select
              value={convenioFilter}
              onChange={e => setConvenioFilter(e.target.value)}
              className="px-3 py-1.5 text-sm rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-[#8a1515]"
            >
              <option value="Todos">Todos</option>
              {conveniosUnicos.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Filtro de Médico Responsável */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase">Médico:</span>
            <select
              value={medicoFilter}
              onChange={e => setMedicoFilter(e.target.value)}
              className="px-3 py-1.5 text-sm rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-[#8a1515] max-w-[220px]"
            >
              <option value="Todos">Todos os Médicos</option>
              {medicosUnicos.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Filtro de Status da Conta */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase">Status da Conta:</span>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 text-sm rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-[#8a1515]"
            >
              <option value="Todos">Todos</option>
              <option value="PAGO">PAGO</option>
              <option value="PENDENTE">PENDENTE</option>
            </select>
          </div>

          {/* Filtro de Tipo de Recebimento */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase">Tipo Rec.:</span>
            <select
              value={tipoRecebimentoFilter}
              onChange={e => setTipoRecebimentoFilter(e.target.value)}
              className="px-3 py-1.5 text-sm rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-[#8a1515]"
            >
              <option value="Todos">Todos</option>
              {tiposRecebimentoUnicos.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── TABELA DE DADOS ── */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-center border-collapse border-spacing-0">
            <thead>
              <tr className="bg-muted/40 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <th className="p-4 w-24 text-center">Atendimento</th>
                <th className="p-4 w-24 text-center">Nº Conta</th>
                <th className="p-4 text-center">Paciente</th>
                <th className="p-4 w-32 text-center">Convênio</th>
                <th className="p-4 w-32 text-center">Médico</th>
                <th className="p-4 w-28 text-center">Entrada</th>
                <th className="p-4 w-28 text-center">Alta</th>
                <th className="p-4 w-28 text-center">Valor Conta</th>
                <th className="p-4 w-28 text-center">Vl. Recebido</th>
                <th className="p-4 w-28 text-center">Tipo Rec.</th>
                <th className="p-4 w-32 text-center">Status da Conta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="p-4"><div className="h-4 bg-muted rounded w-12 mx-auto" /></td>
                    <td className="p-4"><div className="h-4 bg-muted rounded w-12 mx-auto" /></td>
                    <td className="p-4"><div className="h-4 bg-muted rounded w-40 mx-auto" /></td>
                    <td className="p-4"><div className="h-4 bg-muted rounded w-20 mx-auto" /></td>
                    <td className="p-4"><div className="h-4 bg-muted rounded w-16 mx-auto" /></td>
                    <td className="p-4"><div className="h-4 bg-muted rounded w-16 mx-auto" /></td>
                    <td className="p-4"><div className="h-4 bg-muted rounded w-20 mx-auto" /></td>
                    <td className="p-4"><div className="h-4 bg-muted rounded w-20 mx-auto" /></td>
                    <td className="p-4"><div className="h-4 bg-muted rounded w-20 mx-auto" /></td>
                    <td className="p-4"><div className="h-4 bg-muted rounded w-20 mx-auto" /></td>
                    <td className="p-4"><div className="h-6 bg-muted rounded w-16 mx-auto" /></td>
                  </tr>
                ))
              ) : transacoesFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-12 text-center text-muted-foreground text-sm">
                    Nenhuma conta encontrada com os filtros e período aplicados.
                  </td>
                </tr>
              ) : (
                paginatedTransacoes.map(t => {
                  const isPago = t.ieStatusAcerto === 2;
                  return (
                    <tr 
                      key={`${t.nrAtendimento}-${t.nrInternoConta}`} 
                      onClick={() => setSelectedTransacao(t)}
                      className="hover:bg-muted/30 transition-colors cursor-pointer text-sm"
                    >
                      <td className="p-4 text-center font-mono text-xs text-muted-foreground font-semibold">
                        {t.nrAtendimento}
                      </td>
                      <td className="p-4 text-center font-mono text-xs text-muted-foreground font-semibold">
                        {t.nrInternoConta}
                      </td>
                      <td className="p-4 text-center font-medium text-foreground">
                        {t.paciente}
                      </td>
                      <td className="p-4 text-center text-muted-foreground font-medium">{t.convenio}</td>
                      <td className="p-4 text-center text-muted-foreground text-xs">{t.medico}</td>
                      <td className="p-4 text-center text-muted-foreground text-xs">{formatDate(t.dtEntrada)}</td>
                      <td className="p-4 text-center text-muted-foreground text-xs">{formatDate(t.dtAlta)}</td>
                      <td className="p-4 text-center font-semibold text-foreground">
                        {formatCurrency(t.valorConta)}
                      </td>
                      <td className="p-4 text-center font-semibold text-emerald-600 dark:text-emerald-400">
                        <div className="flex flex-col gap-1 items-center justify-center">
                          {(() => {
                            const exibidos = getExibidosRecebimentos(t, tipoRecebimentoFilter);
                            return exibidos.map((d, idx) => (
                              <span key={idx} className="block">
                                {formatCurrency(d.valor)}
                              </span>
                            ));
                          })()}
                        </div>
                      </td>
                      <td className="p-4 text-center text-xs text-muted-foreground">
                        <div className="flex flex-col gap-1 items-center justify-center">
                          {(() => {
                            const exibidos = getExibidosRecebimentos(t, tipoRecebimentoFilter);
                            return exibidos.map((d, idx) => (
                              d.tipo && d.tipo !== '-' && d.tipo !== 'Não Informado' ? (
                                <span key={idx} className="px-2 py-0.5 bg-muted dark:bg-slate-800 rounded font-medium inline-block">
                                  {d.tipo}
                                </span>
                              ) : (
                                <span key={idx} className="text-muted-foreground/60">-</span>
                              )
                            ));
                          })()}
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex justify-center w-full">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                            isPago 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400' 
                              : 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/20 dark:text-amber-400'
                          }`}>
                            {isPago ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                            {isPago ? 'PAGO' : 'PENDENTE'}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Controles de Paginação */}
        {totalPages > 1 && (
          <div className="p-3.5 border-t border-border flex justify-between items-center text-xs bg-muted/20">
            <span className="text-xs text-muted-foreground font-medium">
              Página <span className="font-bold text-foreground">{currentPage}</span> de <span className="font-bold text-foreground">{totalPages}</span> <span className="px-1 text-muted-foreground/50">·</span> {transacoesFiltradas.length} registros
            </span>
            
            <div className="flex items-center gap-1.5">
              {/* Botão Anterior */}
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="w-7 h-7 flex items-center justify-center rounded bg-background border border-border/50 hover:bg-muted text-muted-foreground disabled:opacity-50 transition-colors cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              
              {/* Números das Páginas */}
              {(() => {
                const maxVisiblePages = 5;
                let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
                let endPage = startPage + maxVisiblePages - 1;

                if (endPage > totalPages) {
                  endPage = totalPages;
                  startPage = Math.max(1, endPage - maxVisiblePages + 1);
                }

                const pages = [];
                for (let i = startPage; i <= endPage; i++) {
                  pages.push(i);
                }

                return pages.map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-7 h-7 flex items-center justify-center rounded text-xs font-semibold transition-colors cursor-pointer ${
                      currentPage === page 
                        ? 'bg-primary text-primary-foreground shadow-sm border border-primary/50' 
                        : 'bg-background border border-border/50 text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {page}
                  </button>
                ));
              })()}

              {/* Botão Próximo */}
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="w-7 h-7 flex items-center justify-center rounded bg-background border border-border/50 hover:bg-muted text-muted-foreground disabled:opacity-50 transition-colors cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── MODAL DETALHE LANÇAMENTO ── */}
      <AnimatePresence>
        {selectedTransacao && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border border-border w-full max-w-lg rounded-2xl shadow-xl flex flex-col overflow-hidden"
            >
              <div className="p-5 border-b border-border flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/20">
                <div className="flex items-center gap-2">
                  <h2 className="text-md font-bold text-foreground">Detalhes da Conta Médica</h2>
                </div>
                <button
                  onClick={() => setSelectedTransacao(null)}
                  className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4 text-sm">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block mb-1">Paciente</span>
                  <span className="font-semibold text-foreground text-md flex items-center gap-1.5">
                    <User className="h-4 w-4 text-[#8a1515] dark:text-[#f43f5e]" />
                    {selectedTransacao.paciente}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold block mb-1">Número Atendimento</span>
                    <span className="font-semibold text-foreground font-mono">{selectedTransacao.nrAtendimento}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold block mb-1">Número Interno Conta</span>
                    <span className="font-semibold text-foreground font-mono">{selectedTransacao.nrInternoConta}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold block mb-1">Valor da Conta</span>
                    <span className="font-bold text-md text-foreground">
                      {formatCurrency(selectedTransacao.valorConta)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold block mb-1">Valor Recebido</span>
                    <div className="flex flex-col gap-1">
                      {(() => {
                        const exibidos = getExibidosRecebimentos(selectedTransacao, tipoRecebimentoFilter);
                        return exibidos.map((d, idx) => (
                          <span key={idx} className="font-bold text-md text-emerald-600 dark:text-emerald-400 block">
                            {formatCurrency(d.valor)} {d.tipo && d.tipo !== '-' ? `(${d.tipo})` : ''}
                          </span>
                        ));
                      })()}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold block mb-1">Tipo de Recebimento</span>
                    <div className="flex flex-wrap gap-1">
                      {(() => {
                        const exibidos = getExibidosRecebimentos(selectedTransacao, tipoRecebimentoFilter);
                        return exibidos.map((d, idx) => (
                          d.tipo && d.tipo !== '-' && d.tipo !== 'Não Informado' ? (
                            <span key={idx} className="font-semibold text-foreground bg-muted px-2.5 py-1 rounded text-xs inline-block">
                              {d.tipo}
                            </span>
                          ) : (
                            <span key={idx} className="text-muted-foreground">-</span>
                          )
                        ));
                      })()}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold block mb-1">Status da Conta</span>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${selectedTransacao.ieStatusAcerto === 2 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400' : 'bg-amber-100 text-amber-800 dark:bg-amber-950/20 dark:text-amber-400'}`}>
                      {selectedTransacao.ieStatusAcerto === 2 ? 'PAGO' : 'PENDENTE'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 flex-wrap">
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold block mb-1">Data de Entrada</span>
                    <span className="font-medium text-foreground">{formatDate(selectedTransacao.dtEntrada)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold block mb-1">Data de Alta</span>
                    <span className="font-medium text-foreground">{formatDate(selectedTransacao.dtAlta)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold block mb-1">Convênio</span>
                    <span className="font-medium text-foreground flex items-center gap-1">
                      <ShieldCheck className="h-4 w-4 text-emerald-600" />
                      {selectedTransacao.convenio}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold block mb-1">Médico Responsável</span>
                    <span className="font-medium text-foreground">{selectedTransacao.medico}</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-border flex justify-end gap-2">
                  <button
                    onClick={() => setSelectedTransacao(null)}
                    className="px-4 py-2 border border-border text-foreground hover:bg-muted text-xs font-semibold rounded-lg cursor-pointer transition-all"
                  >
                    Fechar
                  </button>
                  {selectedTransacao.ieStatusAcerto !== 2 && (
                    <button
                      onClick={() => handleMarkAsPaid(selectedTransacao.nrAtendimento, selectedTransacao.nrInternoConta)}
                      disabled={isActionLoading}
                      className="bg-[#8a1515] hover:bg-[#720e0e] text-white px-4 py-2 text-xs font-semibold rounded-lg cursor-pointer transition-all flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Quitar no Caixa
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default Tesouraria;
