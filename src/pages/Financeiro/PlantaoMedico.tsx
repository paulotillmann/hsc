import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Stethoscope, Filter, RefreshCw, FileText, Calendar, Search, 
  ChevronLeft, ChevronRight, BarChart3, PieChart, ArrowUpRight, 
  TrendingUp, Info, Check, ChevronDown, UserCheck, DollarSign, 
  FileSpreadsheet, Award, Activity, X, Layers, Edit3, Save, Baby,
  ClipboardList, CheckCircle2, Plus, Trash2, GraduationCap, Briefcase, Clock, Mail, MailCheck, Send, Loader2
} from 'lucide-react';
import { webhookService } from '../../services/webhookService';
import { MedicoEmailsModal } from './MedicoEmailsModal';
import { DisparoEmailLoteModal } from './DisparoEmailLoteModal';
import { PlantaoMedicoTiposModal, getTipoColorClass } from './PlantaoMedicoTiposModal';
import { plantaoMedicoContatosService, MedicoContato } from '../../services/plantaoMedicoContatosService';
import { plantaoMedicoProducoesService, PlantaoMedicoProducaoDB } from '../../services/plantaoMedicoProducoesService';
import { plantaoMedicoTiposProducaoService, PlantaoMedicoTipoProducao, DEFAULT_TIPOS_PRODUCAO } from '../../services/plantaoMedicoTiposProducaoService';
import { sendPlantaoMedicoEmail } from '../../services/plantaoEmailService';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart as ReChartsPie, Pie, Cell
} from 'recharts';

export interface PlantaoMedicoItem {
  id: string;
  DT_CHAMADO: string;
  MEDICO: string;
  ESPECIALIDADE: string;
  VALOR: number;
  VALOR_RAW: string | number;
  TIPO_PLANTAO: string;
  tipoProducao?: 'Procedimento' | 'Consulta' | 'Parto' | 'Aula' | 'CC' | 'Coordenação' | string;
  valorProducao?: number;
}

export interface ProducaoItem {
  id: string;
  tipoProducao: 'Procedimento' | 'Consulta' | 'Parto' | 'Aula' | 'CC' | 'Coordenação' | string;
  valorProducao: number;
}

export interface PlantaoMedicoSintetico {
  id: string;
  MEDICO: string;
  ESPECIALIDADE: string;
  TIPO_PLANTAO: string;
  QTD_PLANTOES: number;
  VALOR_TOTAL: number;
  VALOR_MEDIO: number;
  producoes?: ProducaoItem[];
  valorProducaoTotal?: number;
  valorPago?: number;
  valorPendente?: number;
  status: 'Pago' | 'Pendente' | 'Parcial';
  emailEnviado?: boolean;
  emailEnviadoEm?: string;
  emailEnviadoPara?: string[];
  ITEMS: PlantaoMedicoItem[];
}

const parseValor = (val: any): number => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const str = String(val).trim();
  const clean = str.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
};

const cleanString = (val: any, fallback: string = ''): string => {
  if (val === undefined || val === null) return fallback;
  const str = String(val).trim();
  if (str.toLowerCase() === 'null' || str.toLowerCase() === 'undefined') return fallback;
  return str;
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

const getSyntheticKey = (medico: string, especialidade: string, tipoPlantao: string): string => {
  const m = (medico || '').trim().toUpperCase();
  const e = (especialidade || '').trim().toUpperCase();
  const t = (tipoPlantao || '').trim().toUpperCase();
  return `${m}|||${e}|||${t}`;
};

const parseTasyDate = (dateStr: string | null): Date | null => {
  if (!dateStr) return null;
  const str = String(dateStr).trim();
  if (!str || str.toLowerCase() === 'null' || str.toLowerCase() === 'undefined') return null;

  // Formato DD/MM/YYYY ou DD/MM/YYYY HH:mm:ss (Padrão Tasy)
  if (/^\d{2}\/\d{2}\/\d{4}/.test(str)) {
    const [datePart, timePart] = str.split(' ');
    const [day, month, year] = datePart.split('/');
    const timeStr = timePart || '00:00:00';
    return new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${timeStr}-03:00`);
  }

  // Formato YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return new Date(`${str}T00:00:00-03:00`);
  }

  // String ISO com ajuste estrito para UTC-3 (America/Sao_Paulo)
  const normalizedStr = str.replace(/(Z|\+00:00|\+00)$/i, '-03:00');
  const d = new Date(normalizedStr);
  return isNaN(d.getTime()) ? null : d;
};

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '-';
  const d = parseTasyDate(dateStr);
  if (!d) return dateStr;
  
  // Formatação garantida no Horário de Brasília (America/Sao_Paulo)
  const brFormatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  const parts = brFormatter.formatToParts(d);
  let day = '', month = '', year = '', hour = '', minute = '';
  for (const part of parts) {
    if (part.type === 'day') day = part.value;
    if (part.type === 'month') month = part.value;
    if (part.type === 'year') year = part.value;
    if (part.type === 'hour') hour = part.value;
    if (part.type === 'minute') minute = part.value;
  }

  if (hour === '00' && minute === '00') {
    return `${day}/${month}/${year}`;
  }
  return `${day}/${month}/${year} ${hour}:${minute}`;
};

const formatDateTime = (isoDateStr?: string | null): string => {
  if (!isoDateStr) return '-';
  try {
    const d = new Date(isoDateStr);
    if (isNaN(d.getTime())) return String(isoDateStr);
    return d.toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return String(isoDateStr);
  }
};

const COLORS = ['#8a1515', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#34d399', '#f87171'];

const getDefaultDates = () => {
  const now = new Date();
  const brFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const todayStr = brFormatter.format(now);
  const [yearStr, monthStr] = todayStr.split('-');
  let year = parseInt(yearStr, 10);
  let month = parseInt(monthStr, 10);

  // Primeiro e último dia do MÊS ANTERIOR ao atual
  let prevMonth = month - 1;
  let prevYear = year;
  if (prevMonth <= 0) {
    prevMonth = 12;
    prevYear -= 1;
  }

  const prevMonthStr = String(prevMonth).padStart(2, '0');
  const firstDay = `${prevYear}-${prevMonthStr}-01`;

  const lastDayObj = new Date(prevYear, prevMonth, 0);
  const lastDayNum = String(lastDayObj.getDate()).padStart(2, '0');
  const lastDay = `${prevYear}-${prevMonthStr}-${lastDayNum}`;

  return {
    from: firstDay,
    to: lastDay
  };
};

// Helpers de Armazenamento Local / Sessão
const getStorageItem = (key: string): string | null => {
  try {
    return localStorage.getItem(key) || sessionStorage.getItem(key);
  } catch (e) {
    return null;
  }
};

const setStorageItem = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
    sessionStorage.setItem(key, value);
  } catch (e) {
    console.error('Erro ao salvar no storage:', e);
  }
};

const PlantaoMedico: React.FC = () => {
  // Filtros de Data Inicializados do Cache se existirem
  const [periodFrom, setPeriodFrom] = useState<string>(() => {
    return getStorageItem('hsc_plantao_medico_cache_from') || getDefaultDates().from;
  });
  const [periodTo, setPeriodTo] = useState<string>(() => {
    return getStorageItem('hsc_plantao_medico_cache_to') || getDefaultDates().to;
  });

  const [plantaos, setPlantaos] = useState<PlantaoMedicoItem[]>(() => {
    try {
      const from = getStorageItem('hsc_plantao_medico_cache_from') || getDefaultDates().from;
      const to = getStorageItem('hsc_plantao_medico_cache_to') || getDefaultDates().to;
      const keyed = getStorageItem(`hsc_plantao_medico_cache_${from}_${to}`);
      if (keyed) {
        const parsed = JSON.parse(keyed);
        return parsed.list || parsed;
      }
      const cached = getStorageItem('hsc_plantao_medico_cache_data');
      if (cached) return JSON.parse(cached);
    } catch (e) {}
    return [];
  });

  const [loading, setLoading] = useState<boolean>(() => {
    const from = getStorageItem('hsc_plantao_medico_cache_from') || getDefaultDates().from;
    const to = getStorageItem('hsc_plantao_medico_cache_to') || getDefaultDates().to;
    const keyed = getStorageItem(`hsc_plantao_medico_cache_${from}_${to}`);
    const cached = getStorageItem('hsc_plantao_medico_cache_data');
    return !keyed && !cached;
  });

  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>(() => {
    return (getStorageItem('hsc_plantao_medico_cache_status') as any) || 'idle';
  });
  const [syncTime, setSyncTime] = useState<string | null>(() => {
    return getStorageItem('hsc_plantao_medico_cache_time');
  });

  // Filtros
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // Dropdown Filtro: Especialidades
  const [selectedEspecialidades, setSelectedEspecialidades] = useState<string[]>([]);
  const [isEspecialidadesOpen, setIsEspecialidadesOpen] = useState<boolean>(false);
  const [especialidadeSearch, setEspecialidadeSearch] = useState<string>('');
  const espDropdownRef = useRef<HTMLDivElement>(null);

  // Dropdown Filtro: Médicos
  const [selectedMedicos, setSelectedMedicos] = useState<string[]>([]);
  const [isMedicosOpen, setIsMedicosOpen] = useState<boolean>(false);
  const [medicoSearch, setMedicoSearch] = useState<string>('');
  const medDropdownRef = useRef<HTMLDivElement>(null);

  // Dropdown Filtro: Tipo de Plantão (Requisitado)
  const [selectedTipos, setSelectedTipos] = useState<string[]>([]);
  const [isTiposOpen, setIsTiposOpen] = useState<boolean>(false);
  const [tipoSearch, setTipoSearch] = useState<string>('');
  const tipoDropdownRef = useRef<HTMLDivElement>(null);

  // Filtro de Status de Pagamento (Sintético): 'todos' | 'Pago' | 'Pendente' | 'Parcial'
  const [statusFilter, setStatusFilter] = useState<'todos' | 'Pago' | 'Pendente' | 'Parcial'>('todos');

  // Ordenação
  const [sortField, setSortField] = useState<keyof PlantaoMedicoItem>('DT_CHAMADO');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Paginação
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 10;

  // Modo de exibição: Analítico (detalhado) ou Sintético (agrupado)
  const [viewMode, setViewMode] = useState<'analitico' | 'sintetico'>('analitico');
  const [sortFieldSintetico, setSortFieldSintetico] = useState<keyof PlantaoMedicoSintetico>('VALOR_TOTAL');
  const [sortAscSintetico, setSortAscSintetico] = useState<boolean>(false);
  // Armazenamento de edições de produção e valor pago para a visão Sintética
  const [dbProducoesMap, setDbProducoesMap] = useState<Record<string, PlantaoMedicoProducaoDB>>({});
  const [loadingProducoes, setLoadingProducoes] = useState<boolean>(false);
  const [isSavingProducao, setIsSavingProducao] = useState<boolean>(false);

  const [syntheticEdits, setSyntheticEdits] = useState<Record<string, { producoes?: ProducaoItem[]; status?: 'Pago' | 'Pendente' | 'Parcial'; valorPago?: number }>>(() => {
    try {
      const cached = getStorageItem('hsc_plantao_medico_synthetic_edits');
      if (cached) return JSON.parse(cached);
    } catch (e) {}
    return {};
  });

  // Carregar produções salvas do Supabase para o período ativo
  const carregarProducoesSupabase = useCallback(async (from: string, to: string) => {
    if (!from || !to) return;
    try {
      setLoadingProducoes(true);
      const lista = await plantaoMedicoProducoesService.listarPorPeriodo(from, to);
      const map: Record<string, PlantaoMedicoProducaoDB> = {};
      lista.forEach(item => {
        const k = getSyntheticKey(item.medico, item.especialidade, item.tipo_plantao);
        map[k] = item;
      });
      setDbProducoesMap(map);
    } catch (err) {
      console.error('Erro ao carregar produções do Supabase:', err);
    } finally {
      setLoadingProducoes(false);
    }
  }, []);

  useEffect(() => {
    carregarProducoesSupabase(periodFrom, periodTo);
  }, [carregarProducoesSupabase, periodFrom, periodTo]);

  // Modal de Gestão de E-mails dos Médicos e Disparo em Lote
  const [isEmailsModalOpen, setIsEmailsModalOpen] = useState<boolean>(false);
  const [isDisparoLoteOpen, setIsDisparoLoteOpen] = useState<boolean>(false);
  const [isTiposModalOpen, setIsTiposModalOpen] = useState<boolean>(false);
  const [tiposProducaoList, setTiposProducaoList] = useState<PlantaoMedicoTipoProducao[]>(DEFAULT_TIPOS_PRODUCAO);
  const [contatosMedicos, setContatosMedicos] = useState<MedicoContato[]>([]);
  const [singleSendingId, setSingleSendingId] = useState<string | null>(null);
  const [singleSendFeedback, setSingleSendFeedback] = useState<{ id: string; success: boolean; message: string } | null>(null);

  // Carregar tipos de produção do Supabase
  const carregarTiposProducao = useCallback(async () => {
    try {
      const data = await plantaoMedicoTiposProducaoService.listar(false);
      setTiposProducaoList(data);
    } catch (err) {
      console.error('Erro ao carregar tipos de produção:', err);
    }
  }, []);

  useEffect(() => {
    carregarTiposProducao();
  }, [carregarTiposProducao]);

  const tiposProducaoAtivos = useMemo(() => {
    return tiposProducaoList.filter(t => t.ativo !== false);
  }, [tiposProducaoList]);

  const tiposColorMap = useMemo(() => {
    const map = new Map<string, string>();
    tiposProducaoList.forEach(t => {
      if (t.nome) {
        map.set(t.nome.toLowerCase().trim(), t.cor || 'blue');
      }
    });
    return map;
  }, [tiposProducaoList]);

  // Carregar contatos dos médicos para exibir ou sincronizar
  const carregarContatosMedicos = useCallback(async () => {
    try {
      const data = await plantaoMedicoContatosService.listar();
      setContatosMedicos(data);
    } catch (err) {
      console.error('Erro ao carregar contatos dos médicos:', err);
    }
  }, []);

  useEffect(() => {
    carregarContatosMedicos();
  }, [carregarContatosMedicos]);

  // Mapa de e-mails para consulta instantânea na interface
  const contatosMedicosMap = useMemo(() => {
    const map = new Map<string, string[]>();
    contatosMedicos.forEach(c => {
      if (c.nome_medico && c.emails && c.emails.length > 0) {
        map.set(c.nome_medico.toUpperCase().trim(), c.emails);
      }
    });
    return map;
  }, [contatosMedicos]);

  const [selectedSinteticoItem, setSelectedSinteticoItem] = useState<PlantaoMedicoSintetico | null>(null);
  const [selectedItem, setSelectedItem] = useState<PlantaoMedicoItem | null>(null);

  // Form state para Múltiplas Produções Médicas, Status e Valor Pago (Sintético)
  const [editProducoesList, setEditProducoesList] = useState<{ id: string; tipoProducao: string; valorProducao: string }[]>([]);
  const [editStatus, setEditStatus] = useState<'Pago' | 'Pendente' | 'Parcial'>('Pendente');
  const [editValorPago, setEditValorPago] = useState<string>('0');
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<boolean>(false);

  const handleOpenSinteticoModal = (item: PlantaoMedicoSintetico) => {
    setSelectedSinteticoItem(item);
    setEditStatus(item.status || 'Pendente');
    setEditValorPago(item.valorPago !== undefined ? String(item.valorPago) : (item.status === 'Pago' ? String(item.VALOR_TOTAL) : '0'));
    const defaultTipo = tiposProducaoAtivos[0]?.nome || 'Procedimento';
    if (item.producoes && item.producoes.length > 0) {
      setEditProducoesList(
        item.producoes.map((p, i) => ({
          id: p.id || `prod-${i}`,
          tipoProducao: p.tipoProducao || defaultTipo,
          valorProducao: String(p.valorProducao || 0)
        }))
      );
    } else {
      // Iniciar com 1 item padrão
      setEditProducoesList([
        { id: `prod-${Date.now()}-0`, tipoProducao: defaultTipo, valorProducao: '0' }
      ]);
    }
    setSaveSuccessMessage(false);
  };

  const handleAddProducaoRow = () => {
    const defaultTipo = tiposProducaoAtivos[0]?.nome || 'Procedimento';
    setEditProducoesList(prev => [
      ...prev,
      { id: `prod-${Date.now()}-${prev.length}`, tipoProducao: defaultTipo, valorProducao: '0' }
    ]);
  };

  const handleRemoveProducaoRow = (id: string) => {
    setEditProducoesList(prev => prev.filter(p => p.id !== id));
  };

  const handleUpdateProducaoRow = (id: string, field: 'tipoProducao' | 'valorProducao', value: string) => {
    setEditProducoesList(prev => prev.map(p => {
      if (p.id === id) {
        return { ...p, [field]: value };
      }
      return p;
    }));
  };

  const handleSaveSinteticoProducao = async () => {
    if (!selectedSinteticoItem) return;
    setIsSavingProducao(true);

    try {
      const validProducoes: ProducaoItem[] = editProducoesList.map(p => {
        const cleanStr = String(p.valorProducao).replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
        const numVal = parseFloat(cleanStr);
        return {
          id: p.id,
          tipoProducao: p.tipoProducao,
          valorProducao: isNaN(numVal) ? 0 : Math.max(0, numVal)
        };
      });

      const cleanValorPagoStr = String(editValorPago).replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
      const parsedValorPago = parseFloat(cleanValorPagoStr);
      const validValorPago = isNaN(parsedValorPago) ? 0 : Math.max(0, parsedValorPago);

      // Calcular o total final esperado (Base Plantões + Produções)
      const basePlantaoTotal = selectedSinteticoItem.ITEMS.reduce((acc, p) => acc + p.VALOR, 0);
      const prodTotal = validProducoes.reduce((acc, p) => acc + (p.valorProducao || 0), 0);
      const totalEsperado = basePlantaoTotal + prodTotal;

      let finalStatus: 'Pago' | 'Pendente' | 'Parcial' = editStatus;
      if (validValorPago >= totalEsperado && totalEsperado > 0) {
        finalStatus = 'Pago';
      } else if (validValorPago > 0 && validValorPago < totalEsperado) {
        finalStatus = 'Parcial';
      } else if (validValorPago === 0) {
        finalStatus = 'Pendente';
      }

      const itemKey = getSyntheticKey(
        selectedSinteticoItem.MEDICO,
        selectedSinteticoItem.ESPECIALIDADE,
        selectedSinteticoItem.TIPO_PLANTAO
      );

      // 1. Salvar no Supabase de forma persistente
      const saved = await plantaoMedicoProducoesService.salvarProducao({
        medico: selectedSinteticoItem.MEDICO,
        especialidade: selectedSinteticoItem.ESPECIALIDADE,
        tipo_plantao: selectedSinteticoItem.TIPO_PLANTAO,
        periodo_de: periodFrom,
        periodo_ate: periodTo,
        producoes: validProducoes,
        valor_pago: validValorPago,
        status: finalStatus
      });

      // 2. Atualizar estado em memória do Supabase
      setDbProducoesMap(prev => ({
        ...prev,
        [itemKey]: saved
      }));

      // 3. Atualizar fallback em cache
      const updatedEdits = {
        ...syntheticEdits,
        [itemKey]: {
          producoes: validProducoes,
          status: finalStatus,
          valorPago: validValorPago
        },
        [selectedSinteticoItem.id]: {
          producoes: validProducoes,
          status: finalStatus,
          valorPago: validValorPago
        }
      };

      setSyntheticEdits(updatedEdits);
      setStorageItem('hsc_plantao_medico_synthetic_edits', JSON.stringify(updatedEdits));

      setSaveSuccessMessage(true);
      setTimeout(() => {
        setSaveSuccessMessage(false);
        setSelectedSinteticoItem(null);
      }, 600);
    } catch (err) {
      console.error('Erro ao salvar produção no Supabase:', err);
      alert('Erro ao salvar os lançamentos no banco de dados. Verifique a conexão e tente novamente.');
    } finally {
      setIsSavingProducao(false);
    }
  };

  // Fechar dropdowns ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (espDropdownRef.current && !espDropdownRef.current.contains(event.target as Node)) {
        setIsEspecialidadesOpen(false);
      }
      if (medDropdownRef.current && !medDropdownRef.current.contains(event.target as Node)) {
        setIsMedicosOpen(false);
      }
      if (tipoDropdownRef.current && !tipoDropdownRef.current.contains(event.target as Node)) {
        setIsTiposOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const saveToCache = (
    list: PlantaoMedicoItem[],
    time: string | null,
    status: 'idle' | 'success' | 'error',
    from: string,
    to: string
  ) => {
    try {
      const dataStr = JSON.stringify(list);
      setStorageItem('hsc_plantao_medico_cache_data', dataStr);
      if (time) setStorageItem('hsc_plantao_medico_cache_time', time);
      setStorageItem('hsc_plantao_medico_cache_status', status);
      setStorageItem('hsc_plantao_medico_cache_from', from);
      setStorageItem('hsc_plantao_medico_cache_to', to);

      // Cache chaveado por período
      const keyedPayload = JSON.stringify({ list, time, status });
      setStorageItem(`hsc_plantao_medico_cache_${from}_${to}`, keyedPayload);
    } catch (e) {
      console.error('Erro ao salvar cache de plantão médico:', e);
    }
  };

  // Busca dados do webhook n8n/plantao com suporte a cache local
  const fetchPlantaos = useCallback(async (showLoading = true, forceRefresh = false) => {
    if (!forceRefresh) {
      try {
        const keyed = getStorageItem(`hsc_plantao_medico_cache_${periodFrom}_${periodTo}`);
        if (keyed) {
          const parsed = JSON.parse(keyed);
          setPlantaos(parsed.list || parsed);
          if (parsed.time) setSyncTime(parsed.time);
          setSyncStatus(parsed.status || 'success');
          setLoading(false);
          return;
        }

        const cachedData = getStorageItem('hsc_plantao_medico_cache_data');
        const cachedTime = getStorageItem('hsc_plantao_medico_cache_time');
        const cachedStatus = getStorageItem('hsc_plantao_medico_cache_status');
        const cachedFrom = getStorageItem('hsc_plantao_medico_cache_from');
        const cachedTo = getStorageItem('hsc_plantao_medico_cache_to');

        if (cachedData && cachedFrom === periodFrom && cachedTo === periodTo) {
          const parsed = JSON.parse(cachedData);
          setPlantaos(parsed);
          setSyncTime(cachedTime);
          setSyncStatus((cachedStatus as any) || 'success');
          setLoading(false);
          return;
        }
      } catch (e) {
        console.error('Erro ao ler cache de plantão médico:', e);
      }
    }

    if (showLoading) setLoading(true);
    setSyncStatus('idle');

    // Mapear edições existentes para preservar
    const existingEditsMap = new Map<string, { tipoProducao?: string; valorProducao?: number }>();
    try {
      const currentCached = getStorageItem('hsc_plantao_medico_cache_data');
      if (currentCached) {
        const parsed: PlantaoMedicoItem[] = JSON.parse(currentCached);
        parsed.forEach(p => {
          if (p.id && (p.tipoProducao || p.valorProducao !== undefined)) {
            existingEditsMap.set(p.id, {
              tipoProducao: p.tipoProducao,
              valorProducao: p.valorProducao
            });
          }
        });
      }
    } catch (e) {}

    try {
      const response = await webhookService.fetchPlantaoMedicoCustos({
        dt_inicio: periodFrom || null,
        dt_fim: periodTo || null
      });

      const nowTime = new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });

      if (response && Array.isArray(response)) {
        const mappedList: PlantaoMedicoItem[] = response
          .filter((item: any) => {
            if (!item) return false;
            const rawDt = item.DT_CHAMADO !== undefined ? item.DT_CHAMADO : item.dt_chamado;
            if (rawDt === null || rawDt === undefined) return false;
            const strDt = String(rawDt).trim().toLowerCase();
            return strDt !== '' && strDt !== 'null' && strDt !== 'undefined';
          })
          .map((item: any, idx: number) => {
            const itemId = `plantao-${idx}-${item.DT_CHAMADO || ''}-${item.MEDICO || ''}`;
            const existingEdit = existingEditsMap.get(itemId);
            const valNum = parseValor(item.VALOR !== undefined ? item.VALOR : item.valor);

            return {
              id: itemId,
              DT_CHAMADO: String(item.DT_CHAMADO !== undefined ? item.DT_CHAMADO : (item.dt_chamado || '')),
              MEDICO: cleanString(item.MEDICO !== undefined ? item.MEDICO : item.medico, 'Médico Não Informado'),
              ESPECIALIDADE: cleanString(item.ESPECIALIDADE !== undefined ? item.ESPECIALIDADE : item.especialidade, 'Geral'),
              VALOR: valNum,
              VALOR_RAW: item.VALOR !== undefined ? item.VALOR : (item.valor || '0,00'),
              TIPO_PLANTAO: cleanString(item.TIPO_PLANTAO !== undefined ? item.TIPO_PLANTAO : item.tipo_plantao, 'Plantão'),
              tipoProducao: existingEdit?.tipoProducao || item.tipoProducao || item.tipo_producao,
              valorProducao: existingEdit?.valorProducao !== undefined ? existingEdit.valorProducao : (item.valorProducao !== undefined ? item.valorProducao : item.valor_producao)
            };
          });

        setPlantaos(mappedList);
        setSyncTime(nowTime);
        setSyncStatus('success');
        saveToCache(mappedList, nowTime, 'success', periodFrom, periodTo);
      } else {
        setSyncStatus('error');
      }
    } catch (e) {
      console.error('Erro ao carregar dados de plantão médico:', e);
      setSyncStatus('error');
    } finally {
      setLoading(false);
    }
  }, [periodFrom, periodTo]);

  const activeParamsRef = useRef<string>('');

  // Efeito inteligente de busca/recuperação de cache baseado nos parâmetros selecionados
  useEffect(() => {
    const paramKey = `${periodFrom}_${periodTo}`;
    
    // Tenta carregar do cache para as datas selecionadas
    const keyed = getStorageItem(`hsc_plantao_medico_cache_${periodFrom}_${periodTo}`);
    const cachedFrom = getStorageItem('hsc_plantao_medico_cache_from');
    const cachedTo = getStorageItem('hsc_plantao_medico_cache_to');
    const cachedData = getStorageItem('hsc_plantao_medico_cache_data');

    if (keyed) {
      try {
        const parsed = JSON.parse(keyed);
        setPlantaos(parsed.list || parsed);
        if (parsed.time) setSyncTime(parsed.time);
        setSyncStatus(parsed.status || 'success');
        setLoading(false);
        activeParamsRef.current = paramKey;
        return;
      } catch (e) {}
    }

    if (cachedData && cachedFrom === periodFrom && cachedTo === periodTo) {
      try {
        const parsed = JSON.parse(cachedData);
        setPlantaos(parsed);
        setSyncTime(getStorageItem('hsc_plantao_medico_cache_time'));
        setSyncStatus((getStorageItem('hsc_plantao_medico_cache_status') as any) || 'success');
        setLoading(false);
        activeParamsRef.current = paramKey;
        return;
      } catch (e) {}
    }

    // Se já buscamos este exato parâmetro na execução atual da API, evita requisição duplicada
    if (activeParamsRef.current === paramKey) {
      return;
    }
    activeParamsRef.current = paramKey;

    fetchPlantaos(true, false);
  }, [fetchPlantaos, periodFrom, periodTo]);

  // Reset de página ao alterar filtros ou modo de visão
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedEspecialidades, selectedMedicos, selectedTipos, periodFrom, periodTo, viewMode, statusFilter]);

  // Listas únicas para os seletores
  const especialidadesDisponiveis = useMemo(() => {
    const list = Array.from(new Set(plantaos.map(p => p.ESPECIALIDADE).filter(Boolean)));
    return list.sort((a, b) => a.localeCompare(b));
  }, [plantaos]);

  const especialidadesFiltradas = useMemo(() => {
    return especialidadesDisponiveis.filter(e =>
      e.toLowerCase().includes(especialidadeSearch.toLowerCase())
    );
  }, [especialidadesDisponiveis, especialidadeSearch]);

  const medicosDisponiveis = useMemo(() => {
    const list = Array.from(new Set(plantaos.map(p => p.MEDICO).filter(Boolean)));
    return list.sort((a, b) => a.localeCompare(b));
  }, [plantaos]);

  const medicosFiltrados = useMemo(() => {
    return medicosDisponiveis.filter(m =>
      m.toLowerCase().includes(medicoSearch.toLowerCase())
    );
  }, [medicosDisponiveis, medicoSearch]);

  const tiposDisponiveis = useMemo(() => {
    const list = Array.from(new Set(plantaos.map(p => p.TIPO_PLANTAO).filter(Boolean)));
    return list.sort((a, b) => a.localeCompare(b));
  }, [plantaos]);

  const tiposFiltrados = useMemo(() => {
    return tiposDisponiveis.filter(t =>
      t.toLowerCase().includes(tipoSearch.toLowerCase())
    );
  }, [tiposDisponiveis, tipoSearch]);

  // Ordenação por colunas
  const handleSort = (field: keyof PlantaoMedicoItem) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // Filtragem local inteligente
  const plantaosFiltrados = useMemo(() => {
    let result = plantaos.filter(item => {
      // 0. Garante que DT_CHAMADO não é nulo/vazio
      if (!item.DT_CHAMADO) return false;
      const cleanDtStr = String(item.DT_CHAMADO).trim().toLowerCase();
      if (cleanDtStr === '' || cleanDtStr === 'null' || cleanDtStr === 'undefined') return false;

      // 1. Filtro de Data do Chamado
      if (periodFrom || periodTo) {
        const itemDate = parseTasyDate(item.DT_CHAMADO);
        if (itemDate && !isNaN(itemDate.getTime())) {
          if (periodFrom) {
            const fromDate = parseTasyDate(periodFrom);
            if (fromDate && itemDate < fromDate) return false;
          }
          if (periodTo) {
            const toDate = parseTasyDate(periodTo);
            if (toDate) {
              const endOfDay = new Date(toDate);
              endOfDay.setHours(23, 59, 59, 999);
              if (itemDate > endOfDay) return false;
            }
          }
        }
      }

      // 2. Filtro de Busca Livre
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matches = 
          item.MEDICO.toLowerCase().includes(term) || 
          item.ESPECIALIDADE.toLowerCase().includes(term) || 
          item.TIPO_PLANTAO.toLowerCase().includes(term) ||
          String(item.VALOR).includes(term);
        
        if (!matches) return false;
      }

      // 3. Filtro de Especialidades
      if (selectedEspecialidades.length > 0) {
        if (!selectedEspecialidades.includes(item.ESPECIALIDADE)) return false;
      }

      // 4. Filtro de Médicos
      if (selectedMedicos.length > 0) {
        if (!selectedMedicos.includes(item.MEDICO)) return false;
      }

      // 5. Filtro de Tipo de Plantão
      if (selectedTipos.length > 0) {
        if (!selectedTipos.includes(item.TIPO_PLANTAO)) return false;
      }

      return true;
    });

    // Ordenação
    result.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

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
  }, [plantaos, searchTerm, selectedEspecialidades, selectedMedicos, selectedTipos, periodFrom, periodTo, sortField, sortAsc]);

  // Agrupamento Sintético dos Plantões Filtrados (Médico + Especialidade + Tipo)
  const plantaosSinteticos = useMemo(() => {
    const map = new Map<string, {
      medico: string;
      especialidade: string;
      tipoPlantao: string;
      qtd: number;
      valorTotal: number;
      items: PlantaoMedicoItem[];
    }>();

    plantaosFiltrados.forEach(item => {
      const key = getSyntheticKey(item.MEDICO, item.ESPECIALIDADE, item.TIPO_PLANTAO);
      
      const existing = map.get(key);
      if (existing) {
        existing.qtd += 1;
        existing.valorTotal += item.VALOR;
        existing.items.push(item);
      } else {
        map.set(key, {
          medico: item.MEDICO,
          especialidade: item.ESPECIALIDADE,
          tipoPlantao: item.TIPO_PLANTAO,
          qtd: 1,
          valorTotal: item.VALOR,
          items: [item]
        });
      }
    });

    let filteredResult = Array.from(map.entries()).map(([key, data]) => {
      const syntheticId = `sintetico-${key}`;
      const dbItem = dbProducoesMap[key];
      const localEdit = syntheticEdits[key] || syntheticEdits[syntheticId];

      const producoesList: ProducaoItem[] = dbItem?.producoes || localEdit?.producoes || [];
      const valProducaoTotal = producoesList.reduce((acc, p) => acc + (p.valorProducao || 0), 0);
      const valPlantaoBase = data.valorTotal;
      const finalValorTotal = valPlantaoBase + valProducaoTotal;

      let computedStatus: 'Pago' | 'Pendente' | 'Parcial' = (dbItem?.status as any) || localEdit?.status || 'Pendente';
      let valPago = dbItem?.valor_pago !== undefined ? dbItem.valor_pago : localEdit?.valorPago;
      if (valPago === undefined) {
        valPago = computedStatus === 'Pago' ? finalValorTotal : 0;
      }

      if (valPago >= finalValorTotal && finalValorTotal > 0) {
        computedStatus = 'Pago';
      } else if (valPago > 0 && valPago < finalValorTotal) {
        computedStatus = 'Parcial';
      } else if (valPago === 0) {
        computedStatus = 'Pendente';
      }

      const valPendenteCalculado = Math.max(0, finalValorTotal - valPago);

      return {
        id: syntheticId,
        MEDICO: data.medico,
        ESPECIALIDADE: data.especialidade,
        TIPO_PLANTAO: data.tipoPlantao,
        QTD_PLANTOES: data.qtd,
        VALOR_TOTAL: finalValorTotal,
        VALOR_MEDIO: data.qtd > 0 ? finalValorTotal / data.qtd : 0,
        producoes: producoesList,
        valorProducaoTotal: valProducaoTotal,
        valorPago: valPago,
        valorPendente: valPendenteCalculado,
        status: computedStatus,
        emailEnviado: dbItem?.email_enviado || false,
        emailEnviadoEm: dbItem?.email_enviado_em,
        emailEnviadoPara: dbItem?.email_enviado_para || [],
        ITEMS: data.items
      };
    });

    // Filtro por Status (Pago, Pendente, Parcial ou Todos)
    if (statusFilter !== 'todos') {
      filteredResult = filteredResult.filter(item => item.status === statusFilter);
    }

    filteredResult.sort((a, b) => {
      let valA = a[sortFieldSintetico];
      let valB = b[sortFieldSintetico];

      if (valA === null || valA === undefined) return sortAscSintetico ? -1 : 1;
      if (valB === null || valB === undefined) return sortAscSintetico ? 1 : -1;

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortAscSintetico ? valA - valB : valB - valA;
      }

      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();

      if (strA < strB) return sortAscSintetico ? -1 : 1;
      if (strA > strB) return sortAscSintetico ? 1 : -1;
      return 0;
    });

    return filteredResult;
  }, [plantaosFiltrados, sortFieldSintetico, sortAscSintetico, dbProducoesMap, syntheticEdits, statusFilter]);

  // KPIs
  const kpis = useMemo(() => {
    let totalValor = 0;
    let totalPago = 0;
    let totalPendente = 0;
    const medicosUnicos = new Set<string>();

    if (viewMode === 'sintetico') {
      plantaosSinteticos.forEach(s => {
        totalValor += s.VALOR_TOTAL;
        totalPago += s.valorPago || 0;
        totalPendente += s.valorPendente || 0;
        if (s.MEDICO) medicosUnicos.add(s.MEDICO);
      });
    } else {
      plantaosFiltrados.forEach(p => {
        totalValor += p.VALOR;
        if (p.MEDICO) medicosUnicos.add(p.MEDICO);
      });
      // Na visão analítica, estimamos pago/pendente a partir do sintético consolidado
      plantaosSinteticos.forEach(s => {
        totalPago += s.valorPago || 0;
        totalPendente += s.valorPendente || 0;
      });
    }

    const count = plantaosFiltrados.length;
    const mediaPorPlantao = count > 0 ? totalValor / count : 0;

    return {
      totalValor,
      totalPago,
      totalPendente,
      count,
      mediaPorPlantao,
      medicosAtivos: medicosUnicos.size
    };
  }, [plantaosFiltrados, plantaosSinteticos, viewMode]);

  // Gráficos
  const { monthlyChartData, especialidadeChartData } = useMemo(() => {
    const monthMap: Record<string, number> = {};
    const espMap: Record<string, number> = {};

    plantaosFiltrados.forEach(p => {
      const val = p.VALOR;
      if (p.DT_CHAMADO) {
        const date = parseTasyDate(p.DT_CHAMADO);
        if (date && !isNaN(date.getTime())) {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const key = `${year}-${month}`;
          monthMap[key] = (monthMap[key] || 0) + val;
        }
      }

      const esp = p.ESPECIALIDADE || 'Outras';
      espMap[esp] = (espMap[esp] || 0) + val;
    });

    const sortedMonthKeys = Object.keys(monthMap).sort();
    const monthsAbbr = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    
    const monthlyData = sortedMonthKeys.map(key => {
      const [year, monthStr] = key.split('-');
      const monthIdx = parseInt(monthStr, 10) - 1;
      const yearShort = year.substring(2);
      return {
        name: `${monthsAbbr[monthIdx]}/${yearShort}`,
        value: monthMap[key]
      };
    });

    const espData = Object.entries(espMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    return {
      monthlyChartData: monthlyData,
      especialidadeChartData: espData
    };
  }, [plantaosFiltrados]);

  // Ordenação por colunas da visão sintética
  const handleSortSintetico = (field: keyof PlantaoMedicoSintetico | 'tipoProducao' | 'valorProducao') => {
    if (sortFieldSintetico === (field as any)) {
      setSortAscSintetico(!sortAscSintetico);
    } else {
      setSortFieldSintetico(field as any);
      setSortAscSintetico(true);
    }
  };

  // Paginação
  const paginatedPlantaos = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return plantaosFiltrados.slice(start, start + itemsPerPage);
  }, [plantaosFiltrados, currentPage]);

  const paginatedSinteticos = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return plantaosSinteticos.slice(start, start + itemsPerPage);
  }, [plantaosSinteticos, currentPage]);

  const totalPages = viewMode === 'sintetico'
    ? Math.ceil(plantaosSinteticos.length / itemsPerPage)
    : Math.ceil(plantaosFiltrados.length / itemsPerPage);

  // Exportar PDF Executivo (Sintético ou Analítico em Modo Paisagem / Landscape)
  const handleExportPDF = async () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    
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

    const titleText = viewMode === 'sintetico'
      ? 'Relatório Sintético de Plantão e Produção Médica (Agrupado)'
      : 'Relatório Executivo de Plantão Médico';

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(titleText, 10, 26);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })} às ${new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })}`, 10, 32);
    
    const activeFilters = [];
    if (periodFrom || periodTo) {
      const format = (p: string) => p.split('-').reverse().join('/');
      activeFilters.push(`Período: ${format(periodFrom)} a ${format(periodTo)}`);
    }
    if (selectedTipos.length > 0) activeFilters.push(`Tipos: ${selectedTipos.join(', ')}`);
    if (selectedEspecialidades.length > 0) activeFilters.push(`Especialidades: ${selectedEspecialidades.join(', ')}`);
    if (statusFilter !== 'todos') activeFilters.push(`Status: ${statusFilter}`);

    if (activeFilters.length > 0) {
      doc.text(`Filtros: ${activeFilters.join(' | ')}`, 10, 37);
    }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text('Resumo Financeiro de Plantões', 10, 45);

    autoTable(doc, {
      startY: 48,
      margin: { left: 10, right: 10 },
      head: [['Total de Plantões', 'Valor Previsto', 'Total Pago Realizado', 'Saldo Pendente (A Pagar)', 'Médicos Ativos']],
      body: [[
        kpis.count.toString(),
        formatCurrency(kpis.totalValor),
        formatCurrency(kpis.totalPago),
        formatCurrency(kpis.totalPendente),
        kpis.medicosAtivos.toString()
      ]],
      theme: 'grid',
      headStyles: { fillColor: [138, 21, 21], halign: 'center', fontSize: 8.5 },
      styles: { fontSize: 8.5, cellPadding: 2 },
      columnStyles: {
        0: { halign: 'center', fontStyle: 'bold' },
        1: { halign: 'center' },
        2: { halign: 'center', fontStyle: 'bold' },
        3: { halign: 'center', fontStyle: 'bold' },
        4: { halign: 'center', fontStyle: 'bold' }
      }
    });

    const nextY = (doc as any).lastAutoTable.finalY + 9;

    if (viewMode === 'sintetico') {
      doc.text('Consolidado Sintético por Médico, Setor e Produção Médica', 10, nextY);

      const tableBody = plantaosSinteticos.map(s => {
        const tiposStr = s.producoes && s.producoes.length > 0
          ? s.producoes.map(p => `${p.tipoProducao}${p.valorProducao ? ` (${formatCurrency(p.valorProducao)})` : ''}`).join(', ')
          : 'Não informado';
        return [
          s.MEDICO,
          s.ESPECIALIDADE,
          s.TIPO_PLANTAO,
          tiposStr,
          s.QTD_PLANTOES.toString(),
          formatCurrency(s.VALOR_TOTAL),
          formatCurrency(s.valorPago || 0),
          formatCurrency(s.valorPendente || 0),
          s.status === 'Pago' ? 'PAGO' : s.status === 'Parcial' ? 'PARCIAL' : 'PENDENTE'
        ];
      });

      autoTable(doc, {
        startY: nextY + 4,
        margin: { left: 10, right: 10 },
        head: [['Médico / Plantonista', 'Especialidade', 'Tipo Plantão', 'Tipos Produção Adicionais', 'Qtd.', 'Valor Total (R$)', 'Valor Pago (R$)', 'Saldo Pendente (R$)', 'Status']],
        body: tableBody,
        theme: 'striped',
        headStyles: { 
          fillColor: [138, 21, 21], 
          textColor: [255, 255, 255], 
          fontStyle: 'bold', 
          fontSize: 8,
          valign: 'middle',
          halign: 'left'
        },
        styles: { 
          fontSize: 8, 
          cellPadding: 2.2, 
          overflow: 'linebreak',
          valign: 'middle'
        },
        columnStyles: {
          0: { halign: 'left', fontStyle: 'bold', cellWidth: 46 },
          1: { halign: 'left', cellWidth: 32 },
          2: { halign: 'left', cellWidth: 26 },
          3: { halign: 'left', cellWidth: 42 },
          4: { halign: 'center', fontStyle: 'bold', cellWidth: 12 },
          5: { halign: 'right', fontStyle: 'bold', cellWidth: 28 },
          6: { halign: 'right', cellWidth: 28 },
          7: { halign: 'right', fontStyle: 'bold', cellWidth: 30 },
          8: { halign: 'center', fontStyle: 'bold', cellWidth: 23 }
        }
      });

      doc.save(`HSC_Relatorio_Sintetico_Plantao_Medico_${new Date().toISOString().split('T')[0]}.pdf`);
    } else {
      doc.text('Detalhamento de Escalas e Honorários', 10, nextY);

      const tableBody = plantaosFiltrados.map(p => [
        formatDate(p.DT_CHAMADO),
        p.MEDICO,
        p.ESPECIALIDADE,
        p.TIPO_PLANTAO,
        formatCurrency(p.VALOR)
      ]);

      autoTable(doc, {
        startY: nextY + 4,
        margin: { left: 10, right: 10 },
        head: [['Data/Hora Chamado', 'Médico / Plantonista', 'Especialidade', 'Tipo Plantão', 'Valor (R$)']],
        body: tableBody,
        theme: 'striped',
        headStyles: { fillColor: [138, 21, 21] },
        columnStyles: {
          0: { halign: 'center' },
          1: { halign: 'left' },
          2: { halign: 'left' },
          3: { halign: 'left' },
          4: { halign: 'right', fontStyle: 'bold' }
        }
      });

      doc.save(`HSC_Relatorio_Plantao_Medico_${new Date().toISOString().split('T')[0]}.pdf`);
    }
  };

  // Exportar CSV
  const handleExportCSV = () => {
    if (viewMode === 'sintetico') {
      const headers = ['Medico', 'Especialidade', 'Tipo_Plantao', 'Tipos_Producao', 'Qtd_Plantoes', 'Valor_Total_Reais', 'Valor_Pago_Reais', 'Saldo_Pendente_Reais', 'Status'];
      const rows = plantaosSinteticos.map(s => {
        const tiposStr = s.producoes && s.producoes.length > 0
          ? s.producoes.map(p => p.tipoProducao).join(', ')
          : '';
        return [
          s.MEDICO,
          s.ESPECIALIDADE,
          s.TIPO_PLANTAO,
          tiposStr,
          s.QTD_PLANTOES,
          s.VALOR_TOTAL,
          s.valorPago || 0,
          s.valorPendente || 0,
          s.status
        ];
      });

      const csvContent = 
        'data:text/csv;charset=utf-8,\uFEFF' + 
        [headers.join(';'), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(';'))].join('\n');

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `HSC_Relatorio_Sintetico_Plantao_Medico_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const headers = ['Data_Chamado', 'Medico', 'Especialidade', 'Tipo_Plantao', 'Valor_Reais'];
      const rows = plantaosFiltrados.map(p => [
        p.DT_CHAMADO,
        p.MEDICO,
        p.ESPECIALIDADE,
        p.TIPO_PLANTAO,
        p.VALOR
      ]);

      const csvContent = 
        'data:text/csv;charset=utf-8,\uFEFF' + 
        [headers.join(';'), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(';'))].join('\n');

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `HSC_Plantao_Medico_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="space-y-6 w-full px-[40px] max-w-none pb-12 animate-in fade-in duration-500 bg-background text-foreground font-sans">
      
      {/* ── HEADER (EXATAMENTE NO MESMO PADRÃO DA TESOURARIA) ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border/60 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-[#8a1515]/10 flex items-center justify-center border border-[#8a1515]/20 text-[#8a1515] dark:text-[#f43f5e]">
              <Stethoscope className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground font-sans">Plantão Médico</h1>
              <p className="text-sm text-muted-foreground mt-0.5 font-sans">Gestão e controle financeiro de escalas, repasses e honorários médicos</p>
            </div>
          </div>
        </div>

        {/* Status de Sincronismo do Webhook & Botões do Topo (Mesmo padrão da Tesouraria) */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
          {syncTime && syncStatus === 'success' && (
            <div className="flex items-center gap-1.5 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 px-3 py-1.5 rounded-full text-xs font-semibold border border-emerald-200 dark:border-emerald-900/50 shadow-sm">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
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
            onClick={() => setIsTiposModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-semibold bg-card border border-border hover:bg-muted text-foreground transition-all shadow-sm cursor-pointer"
            title="Gerenciar tipos e modalidades de produção médica"
          >
            <Layers className="h-4 w-4 text-[#8a1515] dark:text-[#f43f5e]" />
            <span>Tipos de Produção</span>
            {tiposProducaoAtivos.length > 0 && (
              <span className="ml-1 bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 px-1.5 py-0.5 rounded-full text-[10px] font-bold border border-rose-300 dark:border-rose-800">
                {tiposProducaoAtivos.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setIsEmailsModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-semibold bg-card border border-border hover:bg-muted text-foreground transition-all shadow-sm cursor-pointer"
            title="Gerenciar cadastro de múltiplos e-mails por médico"
          >
            <Mail className="h-4 w-4 text-[#8a1515] dark:text-[#f43f5e]" />
            <span>Gerenciar E-mails</span>
            {contatosMedicos.length > 0 && (
              <span className="ml-1 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded-full text-[10px] font-bold border border-emerald-300 dark:border-emerald-800">
                {contatosMedicos.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setIsDisparoLoteOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-bold bg-[#8a1515] hover:bg-[#701010] text-white transition-all shadow-sm cursor-pointer"
            title="Enviar relatórios em lote por e-mail para os médicos"
          >
            <Send className="h-4 w-4" />
            <span>Disparar E-mails</span>
          </button>

          <button
            onClick={() => fetchPlantaos(true, true)}
            disabled={loading}
            className="flex items-center justify-center rounded-md text-sm font-semibold bg-card border border-border text-foreground hover:bg-muted h-10 w-10 transition-all shadow-sm cursor-pointer"
            title="Recarregar do n8n"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>


        </div>
      </div>

      {/* ── FILTROS ── */}
      <div className="bg-card dark:bg-slate-950 border border-border/80 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-border/40 pb-3">
          <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
            <Filter className="h-4 w-4 text-[#8a1515] dark:text-[#f43f5e]" />
            <span className="font-sans">Filtros de Pesquisa</span>
          </div>
          {(searchTerm || selectedEspecialidades.length > 0 || selectedMedicos.length > 0 || selectedTipos.length > 0 || statusFilter !== 'todos' || periodFrom !== getDefaultDates().from || periodTo !== getDefaultDates().to) && (
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedEspecialidades([]);
                setSelectedMedicos([]);
                setSelectedTipos([]);
                setStatusFilter('todos');
                const defaults = getDefaultDates();
                setPeriodFrom(defaults.from);
                setPeriodTo(defaults.to);
              }}
              className="text-xs text-[#8a1515] dark:text-[#f43f5e] hover:underline flex items-center gap-1 font-medium font-sans"
            >
              <X className="h-3 w-3" />
              Limpar Filtros
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
          {/* Data Início */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1 font-sans">
              <Calendar className="h-3.5 w-3.5" />
              Data Chamado (Início)
            </label>
            <input
              type="date"
              value={periodFrom}
              onChange={(e) => setPeriodFrom(e.target.value)}
              className="w-full bg-background border border-border hover:border-muted-foreground/40 focus:border-[#8a1515] focus:ring-1 focus:ring-[#8a1515] rounded-lg px-3 py-2 text-sm text-foreground outline-none transition-colors"
            />
          </div>

          {/* Data Fim */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1 font-sans">
              <Calendar className="h-3.5 w-3.5" />
              Data Chamado (Fim)
            </label>
            <input
              type="date"
              value={periodTo}
              onChange={(e) => setPeriodTo(e.target.value)}
              className="w-full bg-background border border-border hover:border-muted-foreground/40 focus:border-[#8a1515] focus:ring-1 focus:ring-[#8a1515] rounded-lg px-3 py-2 text-sm text-foreground outline-none transition-colors"
            />
          </div>

          {/* Filtro: Tipo de Plantão (Novo Requisitado) */}
          <div className="flex flex-col gap-1.5" ref={tipoDropdownRef}>
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1 font-sans">
              <Layers className="h-3.5 w-3.5" />
              Tipo de Plantão
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsTiposOpen(!isTiposOpen)}
                className="w-full flex items-center justify-between bg-background border border-border hover:border-muted-foreground/40 rounded-lg px-3 py-2 text-sm text-foreground outline-none transition-colors text-left font-sans"
              >
                <span className="truncate">
                  {selectedTipos.length === 0
                    ? 'Todos os tipos'
                    : selectedTipos.length === 1
                    ? selectedTipos[0]
                    : `${selectedTipos.length} selecionados`}
                </span>
                <ChevronDown className="h-4 w-4 text-muted-foreground/60 flex-shrink-0 ml-1" />
              </button>

              <AnimatePresence>
                {isTiposOpen && (
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
                        placeholder="Buscar tipo de plantão..."
                        value={tipoSearch}
                        onChange={(e) => setTipoSearch(e.target.value)}
                        className="w-full bg-background border border-border rounded-md pl-8 pr-3 py-1.5 text-xs text-foreground outline-none focus:border-[#8a1515]"
                      />
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground/60" />
                    </div>

                    <div className="flex justify-between text-[10px] border-b border-border/40 pb-1.5 px-1">
                      <button
                        type="button"
                        onClick={() => setSelectedTipos(tiposDisponiveis)}
                        className="text-[#8a1515] dark:text-[#f43f5e] hover:underline font-semibold font-sans"
                      >
                        Selecionar Todos
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedTipos([])}
                        className="text-muted-foreground hover:underline font-semibold font-sans"
                      >
                        Limpar
                      </button>
                    </div>

                    <div className="max-h-[180px] overflow-y-auto space-y-0.5 pr-1 custom-scrollbar">
                      {tiposFiltrados.length === 0 ? (
                        <div className="text-center py-4 text-xs text-muted-foreground font-sans">
                          Nenhum tipo encontrado
                        </div>
                      ) : (
                        tiposFiltrados.map((tipo) => {
                          const isSelected = selectedTipos.includes(tipo);
                          return (
                            <button
                              key={tipo}
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedTipos(selectedTipos.filter((item) => item !== tipo));
                                } else {
                                  setSelectedTipos([...selectedTipos, tipo]);
                                }
                              }}
                              className="w-full flex items-center gap-2 rounded px-2 py-1.5 text-xs text-left hover:bg-muted dark:hover:bg-slate-800 transition-colors text-foreground font-sans"
                            >
                              <div className={`h-3.5 w-3.5 rounded border border-border flex items-center justify-center flex-shrink-0 transition-colors ${
                                isSelected ? 'bg-[#8a1515] border-[#8a1515] text-white' : 'bg-background'
                              }`}>
                                {isSelected && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                              </div>
                              <span className="truncate" title={tipo}>{tipo}</span>
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

          {/* Especialidades Dropdown */}
          <div className="flex flex-col gap-1.5" ref={espDropdownRef}>
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1 font-sans">
              <Award className="h-3.5 w-3.5" />
              Especialidades
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsEspecialidadesOpen(!isEspecialidadesOpen)}
                className="w-full flex items-center justify-between bg-background border border-border hover:border-muted-foreground/40 rounded-lg px-3 py-2 text-sm text-foreground outline-none transition-colors text-left font-sans"
              >
                <span className="truncate">
                  {selectedEspecialidades.length === 0
                    ? 'Todas as especialidades'
                    : selectedEspecialidades.length === 1
                    ? selectedEspecialidades[0]
                    : `${selectedEspecialidades.length} selecionadas`}
                </span>
                <ChevronDown className="h-4 w-4 text-muted-foreground/60 flex-shrink-0 ml-1" />
              </button>

              <AnimatePresence>
                {isEspecialidadesOpen && (
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
                        placeholder="Buscar especialidade..."
                        value={especialidadeSearch}
                        onChange={(e) => setEspecialidadeSearch(e.target.value)}
                        className="w-full bg-background border border-border rounded-md pl-8 pr-3 py-1.5 text-xs text-foreground outline-none focus:border-[#8a1515]"
                      />
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground/60" />
                    </div>

                    <div className="flex justify-between text-[10px] border-b border-border/40 pb-1.5 px-1">
                      <button
                        type="button"
                        onClick={() => setSelectedEspecialidades(especialidadesDisponiveis)}
                        className="text-[#8a1515] dark:text-[#f43f5e] hover:underline font-semibold font-sans"
                      >
                        Selecionar Todas
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedEspecialidades([])}
                        className="text-muted-foreground hover:underline font-semibold font-sans"
                      >
                        Limpar
                      </button>
                    </div>

                    <div className="max-h-[180px] overflow-y-auto space-y-0.5 pr-1 custom-scrollbar">
                      {especialidadesFiltradas.length === 0 ? (
                        <div className="text-center py-4 text-xs text-muted-foreground font-sans">
                          Nenhuma especialidade encontrada
                        </div>
                      ) : (
                        especialidadesFiltradas.map((esp) => {
                          const isSelected = selectedEspecialidades.includes(esp);
                          return (
                            <button
                              key={esp}
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedEspecialidades(selectedEspecialidades.filter((item) => item !== esp));
                                } else {
                                  setSelectedEspecialidades([...selectedEspecialidades, esp]);
                                }
                              }}
                              className="w-full flex items-center gap-2 rounded px-2 py-1.5 text-xs text-left hover:bg-muted dark:hover:bg-slate-800 transition-colors text-foreground font-sans"
                            >
                              <div className={`h-3.5 w-3.5 rounded border border-border flex items-center justify-center flex-shrink-0 transition-colors ${
                                isSelected ? 'bg-[#8a1515] border-[#8a1515] text-white' : 'bg-background'
                              }`}>
                                {isSelected && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                              </div>
                              <span className="truncate" title={esp}>{esp}</span>
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

          {/* Médicos Dropdown */}
          <div className="flex flex-col gap-1.5" ref={medDropdownRef}>
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1 font-sans">
              <UserCheck className="h-3.5 w-3.5" />
              Médicos / Plantonistas
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsMedicosOpen(!isMedicosOpen)}
                className="w-full flex items-center justify-between bg-background border border-border hover:border-muted-foreground/40 rounded-lg px-3 py-2 text-sm text-foreground outline-none transition-colors text-left font-sans"
              >
                <span className="truncate">
                  {selectedMedicos.length === 0
                    ? 'Todos os médicos'
                    : selectedMedicos.length === 1
                    ? selectedMedicos[0]
                    : `${selectedMedicos.length} selecionados`}
                </span>
                <ChevronDown className="h-4 w-4 text-muted-foreground/60 flex-shrink-0 ml-1" />
              </button>

              <AnimatePresence>
                {isMedicosOpen && (
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
                        placeholder="Buscar médico..."
                        value={medicoSearch}
                        onChange={(e) => setMedicoSearch(e.target.value)}
                        className="w-full bg-background border border-border rounded-md pl-8 pr-3 py-1.5 text-xs text-foreground outline-none focus:border-[#8a1515]"
                      />
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground/60" />
                    </div>

                    <div className="flex justify-between text-[10px] border-b border-border/40 pb-1.5 px-1">
                      <button
                        type="button"
                        onClick={() => setSelectedMedicos(medicosDisponiveis)}
                        className="text-[#8a1515] dark:text-[#f43f5e] hover:underline font-semibold font-sans"
                      >
                        Selecionar Todos
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedMedicos([])}
                        className="text-muted-foreground hover:underline font-semibold font-sans"
                      >
                        Limpar
                      </button>
                    </div>

                    <div className="max-h-[180px] overflow-y-auto space-y-0.5 pr-1 custom-scrollbar">
                      {medicosFiltrados.length === 0 ? (
                        <div className="text-center py-4 text-xs text-muted-foreground font-sans">
                          Nenhum médico encontrado
                        </div>
                      ) : (
                        medicosFiltrados.map((med) => {
                          const isSelected = selectedMedicos.includes(med);
                          return (
                            <button
                              key={med}
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedMedicos(selectedMedicos.filter((item) => item !== med));
                                } else {
                                  setSelectedMedicos([...selectedMedicos, med]);
                                }
                              }}
                              className="w-full flex items-center gap-2 rounded px-2 py-1.5 text-xs text-left hover:bg-muted dark:hover:bg-slate-800 transition-colors text-foreground font-sans"
                            >
                              <div className={`h-3.5 w-3.5 rounded border border-border flex items-center justify-center flex-shrink-0 transition-colors ${
                                isSelected ? 'bg-[#8a1515] border-[#8a1515] text-white' : 'bg-background'
                              }`}>
                                {isSelected && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                              </div>
                              <span className="truncate" title={med}>{med}</span>
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

          {/* Filtro: Status de Pagamento (Pago / Parcial / Pendente / Todos) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1 font-sans">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Status Pagamento
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'todos' | 'Pago' | 'Pendente' | 'Parcial')}
              className="w-full bg-background border border-border hover:border-muted-foreground/40 focus:border-[#8a1515] focus:ring-1 focus:ring-[#8a1515] rounded-lg px-3 py-2 text-sm text-foreground outline-none transition-colors cursor-pointer font-sans"
            >
              <option value="todos">Todos os Status</option>
              <option value="Pago">Somente Pagos (Integral)</option>
              <option value="Parcial">Somente Parciais (Com Saldo)</option>
              <option value="Pendente">Somente Pendentes (0% Pago)</option>
            </select>
          </div>
        </div>


      </div>

      {/* ── KPI CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Valor Previsto */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider font-sans">Valor Total Previsto</span>
              <h3 className="text-xl font-bold tracking-tight text-foreground font-sans">{formatCurrency(kpis.totalValor)}</h3>
            </div>
            <div className="p-2 bg-[#8a1515]/10 text-[#8a1515] dark:text-[#f43f5e] rounded-lg border border-[#8a1515]/20">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 font-sans">
            Plantões + Produções Adicionais
          </p>
        </div>

        {/* Total Pago Realizado */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider font-sans">Total Pago Realizado</span>
              <h3 className="text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 font-sans">{formatCurrency(kpis.totalPago)}</h3>
            </div>
            <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg border border-emerald-500/20">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 font-sans">
            Valores já quitados aos médicos
          </p>
        </div>

        {/* Saldo Pendente */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider font-sans">Saldo Pendente</span>
              <h3 className="text-xl font-bold tracking-tight text-amber-600 dark:text-amber-400 font-sans">{formatCurrency(kpis.totalPendente)}</h3>
            </div>
            <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg border border-amber-500/20">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 font-sans">
            Saldo restante a ser pago
          </p>
        </div>

        {/* Total Plantões */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider font-sans">Total de Escalas</span>
              <h3 className="text-xl font-bold tracking-tight text-blue-600 dark:text-blue-400 font-sans">{kpis.count}</h3>
            </div>
            <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg border border-blue-500/20">
              <Activity className="h-4 w-4" />
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 font-sans">
            Número total de chamados
          </p>
        </div>

        {/* Médicos Ativos */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider font-sans">Médicos Ativos</span>
              <h3 className="text-xl font-bold tracking-tight text-foreground font-sans">{kpis.medicosAtivos}</h3>
            </div>
            <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-lg border border-indigo-500/20">
              <UserCheck className="h-4 w-4" />
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 font-sans">
            Plantonistas distintos no período
          </p>
        </div>
      </div>

      {/* ── GRÁFICOS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico Mensal */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-[#8a1515] dark:text-[#f43f5e]" />
              <h2 className="text-base font-bold text-foreground font-sans">Evolução Mensal de Plantões</h2>
            </div>
            <span className="text-xs text-muted-foreground font-sans">Valores acumulados por mês</span>
          </div>

          <div className="h-[280px] w-full pt-4">
            {monthlyChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground font-sans">
                Nenhum dado no período selecionado
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyChartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#888888' }} axisLine={false} tickLine={false} />
                  <YAxis 
                    tickFormatter={(v) => formatCompactCurrency(v)} 
                    tick={{ fontSize: 11, fill: '#888888' }} 
                    axisLine={false} 
                    tickLine={false} 
                  />
                  <Tooltip 
                    formatter={(value: number) => [formatCurrency(value), 'Valor Total']}
                    contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc', fontSize: '12px' }}
                  />
                  <Bar dataKey="value" fill="#8a1515" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Gráfico de Especialidades */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PieChart className="h-5 w-5 text-[#8a1515] dark:text-[#f43f5e]" />
              <h2 className="text-base font-bold text-foreground font-sans">Top Especialidades</h2>
            </div>
          </div>

          <div className="h-[280px] w-full pt-2 flex flex-col justify-between">
            {especialidadeChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground font-sans">
                Nenhuma especialidade encontrada
              </div>
            ) : (
              <>
                <div className="h-[180px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ReChartsPie>
                      <Pie
                        data={especialidadeChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={75}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {especialidadeChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: number) => [formatCurrency(value), 'Total']}
                        contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc', fontSize: '12px' }}
                      />
                    </ReChartsPie>
                  </ResponsiveContainer>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] pt-2 border-t border-border/40">
                  {especialidadeChartData.slice(0, 4).map((entry, idx) => (
                    <div key={entry.name} className="flex items-center gap-1.5 truncate">
                      <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                      <span className="truncate text-muted-foreground font-sans" title={entry.name}>{entry.name}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── TABELA DE DADOS ── */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border/60 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-muted/20">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-foreground font-sans">
                {viewMode === 'sintetico' ? 'Relatório Sintético de Plantões' : 'Escalas e Chamados Médicos'}
              </h3>
              {viewMode === 'sintetico' ? (
                <span className="text-[11px] font-semibold bg-[#8a1515]/10 text-[#8a1515] dark:text-[#f43f5e] px-2.5 py-0.5 rounded-full border border-[#8a1515]/20 font-sans flex items-center gap-1">
                  <Layers className="h-3 w-3" />
                  Sintético (Agrupado)
                </span>
              ) : (
                <span className="text-[11px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2.5 py-0.5 rounded-full border border-blue-500/20 font-sans flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  Analítico (Detalhado)
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground font-sans mt-0.5">
              {viewMode === 'sintetico'
                ? `Exibindo ${paginatedSinteticos.length} de ${plantaosSinteticos.length} grupos consolidados (somando ${plantaosFiltrados.length} lançamentos)`
                : `Exibindo ${paginatedPlantaos.length} de ${plantaosFiltrados.length} lançamentos encontrados`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-between md:justify-end">
            {/* Seletor de Visão (Segmented Control) */}
            <div className="flex items-center bg-background border border-border rounded-lg p-1 shadow-sm">
              <button
                type="button"
                onClick={() => setViewMode('analitico')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-all cursor-pointer ${
                  viewMode === 'analitico'
                    ? 'bg-[#8a1515] text-white font-bold shadow-sm'
                    : 'text-muted-foreground hover:text-foreground font-medium'
                }`}
              >
                <FileText className="h-3.5 w-3.5" />
                <span>Visão Analítica</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('sintetico')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-all cursor-pointer ${
                  viewMode === 'sintetico'
                    ? 'bg-[#8a1515] text-white font-bold shadow-sm'
                    : 'text-muted-foreground hover:text-foreground font-medium'
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                <span>Relatório Sintético</span>
              </button>
            </div>

            {/* Exportações */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportCSV}
                disabled={plantaosFiltrados.length === 0}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 font-sans cursor-pointer"
                title={`Exportar CSV (${viewMode === 'sintetico' ? 'Sintético' : 'Analítico'})`}
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span>CSV</span>
              </button>

              <button
                onClick={handleExportPDF}
                disabled={plantaosFiltrados.length === 0}
                className="flex items-center gap-1.5 bg-[#8a1515] hover:bg-[#6b1010] text-white font-medium text-xs px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 font-sans cursor-pointer"
                title={`Exportar PDF (${viewMode === 'sintetico' ? 'Sintético' : 'Analítico'})`}
              >
                <FileText className="h-3.5 w-3.5" />
                <span>PDF</span>
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          {viewMode === 'sintetico' ? (
            /* TABELA SINTÉTICA (AGRUPADA E COM PRODUÇÃO) */
            <table className="w-full text-left text-sm font-sans border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-muted-foreground text-xs uppercase font-semibold">
                  <th className="py-3 px-4 cursor-pointer hover:text-foreground" onClick={() => handleSortSintetico('MEDICO')}>
                    Médico / Plantonista
                  </th>
                  <th className="py-3 px-4 cursor-pointer hover:text-foreground" onClick={() => handleSortSintetico('ESPECIALIDADE')}>
                    Especialidade
                  </th>
                  <th className="py-3 px-4 cursor-pointer hover:text-foreground" onClick={() => handleSortSintetico('TIPO_PLANTAO')}>
                    TIPO PLANTÃO
                  </th>
                  <th className="py-3 px-4 text-center cursor-pointer hover:text-foreground" onClick={() => handleSortSintetico('tipoProducao' as any)}>
                    Tipo Produção
                  </th>
                  <th className="py-3 px-4 text-center cursor-pointer hover:text-foreground" onClick={() => handleSortSintetico('QTD_PLANTOES')}>
                    Qtd.
                  </th>
                  <th className="py-3 px-4 text-right cursor-pointer hover:text-foreground" onClick={() => handleSortSintetico('VALOR_TOTAL')}>
                    Valor Total (R$)
                  </th>
                  <th className="py-3 px-4 text-right cursor-pointer hover:text-foreground" onClick={() => handleSortSintetico('valorPago' as any)}>
                    Valor Pago (R$)
                  </th>
                  <th className="py-3 px-4 text-right cursor-pointer hover:text-foreground" onClick={() => handleSortSintetico('valorPendente' as any)}>
                    Saldo Pendente (R$)
                  </th>
                  <th className="py-3 px-4 text-center cursor-pointer hover:text-foreground" onClick={() => handleSortSintetico('status')}>
                    STATUS
                  </th>
                  <th className="py-3 px-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <RefreshCw className="h-6 w-6 animate-spin text-[#8a1515]" />
                        <span>Carregando dados de plantão médico...</span>
                      </div>
                    </td>
                  </tr>
                ) : paginatedSinteticos.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-muted-foreground">
                      Nenhum registro agrupado encontrado com os filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  paginatedSinteticos.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-semibold text-foreground max-w-[220px] truncate" title={item.MEDICO}>
                        {item.MEDICO}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground text-xs font-medium whitespace-nowrap">
                        <span className="bg-[#8a1515]/10 text-[#8a1515] dark:text-[#f43f5e] px-2 py-0.5 rounded-full border border-[#8a1515]/20">
                          {item.ESPECIALIDADE}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground text-xs whitespace-nowrap">
                        {item.TIPO_PLANTAO || '-'}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {item.producoes && item.producoes.length > 0 ? (
                          <div className="flex flex-wrap justify-center gap-1">
                            {item.producoes.map((p, pIdx) => {
                              const tipoCor = tiposColorMap.get((p.tipoProducao || '').toLowerCase().trim());
                              return (
                                <span
                                  key={p.id || pIdx}
                                  className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${getTipoColorClass(tipoCor)}`}
                                >
                                  {p.tipoProducao === 'Procedimento' && <ClipboardList className="h-3 w-3" />}
                                  {p.tipoProducao === 'Consulta' && <Stethoscope className="h-3 w-3" />}
                                  {p.tipoProducao === 'Parto' && <Baby className="h-3 w-3" />}
                                  {p.tipoProducao === 'Aula' && <GraduationCap className="h-3 w-3" />}
                                  {p.tipoProducao === 'CC' && <Activity className="h-3 w-3" />}
                                  {p.tipoProducao === 'Coordenação' && <Briefcase className="h-3 w-3" />}
                                  {!['Procedimento', 'Consulta', 'Parto', 'Aula', 'CC', 'Coordenação'].includes(p.tipoProducao) && (
                                    <Layers className="h-3 w-3" />
                                  )}
                                  {p.tipoProducao}
                                  {p.valorProducao > 0 && ` (${formatCurrency(p.valorProducao)})`}
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-muted-foreground/60 text-xs italic">Não informado</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-foreground whitespace-nowrap">
                        <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-md border border-emerald-500/20 font-mono text-xs">
                          {item.QTD_PLANTOES}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-foreground text-sm whitespace-nowrap font-mono">
                        {formatCurrency(item.VALOR_TOTAL)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400 text-sm whitespace-nowrap font-mono">
                        {formatCurrency(item.valorPago || 0)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-amber-600 dark:text-amber-400 text-sm whitespace-nowrap font-mono">
                        {(item.valorPendente || 0) > 0 ? (
                          <span className="text-red-600 dark:text-red-400">
                            {formatCurrency(item.valorPendente || 0)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground font-normal">R$ 0,00</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {item.status === 'Pago' ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Pago
                          </span>
                        ) : item.status === 'Parcial' ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            <Clock className="h-3.5 w-3.5" />
                            Parcial
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                            <X className="h-3.5 w-3.5" />
                            Pendente
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {(() => {
                            const emails = contatosMedicosMap.get(item.MEDICO.toUpperCase().trim()) || [];
                            const isSending = singleSendingId === item.id;
                            const temEmail = emails.length > 0;
                            const isEnviado = !!item.emailEnviado;

                            const handleDispararUnico = async () => {
                              if (!temEmail) {
                                alert(`O Dr(a). ${item.MEDICO} ainda não possui e-mail cadastrado. Clique em 'Gerenciar E-mails' para cadastrar.`);
                                return;
                              }

                              const confirmMsg = isEnviado
                                ? `Este demonstrativo já foi enviado para Dr(a). ${item.MEDICO} em ${formatDateTime(item.emailEnviadoEm)} (${emails.join(', ')}).\n\nDeseja enviar novamente?`
                                : `Deseja enviar o demonstrativo em PDF para Dr(a). ${item.MEDICO} (${emails.join(', ')})?`;

                              if (!confirm(confirmMsg)) return;

                              setSingleSendingId(item.id);
                              const basePlantao = item.ITEMS.reduce((acc, p) => acc + p.VALOR, 0);
                              const prodVal = item.valorProducaoTotal || 0;
                              const formatPer = (p: string) => p.split('-').reverse().join('/');
                              const periodoStr = `${formatPer(periodFrom)} a ${formatPer(periodTo)}`;

                              try {
                                const res = await sendPlantaoMedicoEmail({
                                  to: emails,
                                  nomeMedico: item.MEDICO,
                                  periodoReferencia: periodoStr,
                                  resumo: {
                                    totalPlantoes: item.QTD_PLANTOES,
                                    valorPlantoes: basePlantao,
                                    valorProducao: prodVal,
                                    valorTotalGeral: item.VALOR_TOTAL,
                                    valorPago: item.valorPago || 0,
                                    valorPendente: item.valorPendente || 0,
                                    status: item.status
                                  },
                                  sinteticoItem: item
                                });

                                if (res.success) {
                                  // Registrar envio no banco de dados Supabase
                                  try {
                                    const updated = await plantaoMedicoProducoesService.registrarEnvioEmail({
                                      medico: item.MEDICO,
                                      especialidade: item.ESPECIALIDADE,
                                      tipo_plantao: item.TIPO_PLANTAO,
                                      periodo_de: periodFrom,
                                      periodo_ate: periodTo,
                                      destinatarios: emails
                                    });
                                    const itemKey = getSyntheticKey(item.MEDICO, item.ESPECIALIDADE, item.TIPO_PLANTAO);
                                    setDbProducoesMap(prev => ({
                                      ...prev,
                                      [itemKey]: updated
                                    }));
                                  } catch (dbErr) {
                                    console.error('Erro ao registrar envio no Supabase:', dbErr);
                                  }

                                  alert(`Demonstrativo enviado com sucesso para ${emails.join(', ')}!`);
                                } else {
                                  alert(`Erro no envio: ${res.error}`);
                                }
                              } catch (err: any) {
                                alert(`Erro: ${err.message || 'Falha ao enviar'}`);
                              } finally {
                                setSingleSendingId(null);
                              }
                            };

                            let btnClasses = 'text-muted-foreground/30 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40';
                            let btnTitle = 'Sem e-mail cadastrado (Clique para gerenciar)';

                            if (isEnviado) {
                              btnClasses = 'bg-emerald-50 text-emerald-600 border border-emerald-300 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-700/60 dark:hover:bg-emerald-900/60 shadow-xs';
                              const destinatariosTexto = item.emailEnviadoPara && item.emailEnviadoPara.length > 0 
                                ? item.emailEnviadoPara.join(', ') 
                                : emails.join(', ');
                              btnTitle = `✓ E-mail já enviado no período em ${formatDateTime(item.emailEnviadoEm)}\nDestinatário(s): ${destinatariosTexto}\n(Clique para reenviar se desejar)`;
                            } else if (temEmail) {
                              btnClasses = 'text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40';
                              btnTitle = `Enviar demonstrativo por e-mail (${emails.join(', ')})`;
                            }

                            return (
                              <button
                                onClick={handleDispararUnico}
                                disabled={isSending}
                                className={`p-1.5 rounded-md transition-all cursor-pointer ${btnClasses}`}
                                title={btnTitle}
                              >
                                {isSending ? (
                                  <Loader2 className="h-4 w-4 animate-spin text-emerald-600 dark:text-emerald-400" />
                                ) : isEnviado ? (
                                  <MailCheck className="h-4 w-4" />
                                ) : (
                                  <Mail className="h-4 w-4" />
                                )}
                              </button>
                            );
                          })()}

                          <button
                            onClick={() => handleOpenSinteticoModal(item)}
                            className="p-1.5 text-muted-foreground hover:text-[#8a1515] hover:bg-[#8a1515]/10 rounded-md transition-colors cursor-pointer"
                            title="Lançar Produção Médica / Editar Pagamento"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            /* TABELA ANALÍTICA (DETALHADA - SIMPLES) */
            <table className="w-full text-left text-sm font-sans border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-muted-foreground text-xs uppercase font-semibold">
                  <th className="py-3 px-4 cursor-pointer hover:text-foreground" onClick={() => handleSort('DT_CHAMADO')}>
                    Data/Hora Chamado
                  </th>
                  <th className="py-3 px-4 cursor-pointer hover:text-foreground" onClick={() => handleSort('MEDICO')}>
                    Médico / Plantonista
                  </th>
                  <th className="py-3 px-4 cursor-pointer hover:text-foreground" onClick={() => handleSort('ESPECIALIDADE')}>
                    Especialidade
                  </th>
                  <th className="py-3 px-4 cursor-pointer hover:text-foreground" onClick={() => handleSort('TIPO_PLANTAO')}>
                    TIPO PLANTÃO
                  </th>
                  <th className="py-3 px-4 text-right cursor-pointer hover:text-foreground" onClick={() => handleSort('VALOR')}>
                    Valor (R$)
                  </th>
                  <th className="py-3 px-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <RefreshCw className="h-6 w-6 animate-spin text-[#8a1515]" />
                        <span>Carregando dados de plantão médico...</span>
                      </div>
                    </td>
                  </tr>
                ) : paginatedPlantaos.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-muted-foreground">
                      Nenhum plantão encontrado com os filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  paginatedPlantaos.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-mono text-xs text-foreground whitespace-nowrap">
                        {formatDate(item.DT_CHAMADO)}
                      </td>
                      <td className="py-3 px-4 font-semibold text-foreground max-w-[260px] truncate" title={item.MEDICO}>
                        {item.MEDICO}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground text-xs font-medium whitespace-nowrap">
                        <span className="bg-[#8a1515]/10 text-[#8a1515] dark:text-[#f43f5e] px-2 py-0.5 rounded-full border border-[#8a1515]/20">
                          {item.ESPECIALIDADE}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground text-xs whitespace-nowrap">
                        {item.TIPO_PLANTAO || '-'}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-foreground whitespace-nowrap">
                        {formatCurrency(item.VALOR)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => setSelectedItem(item)}
                          className="p-1.5 text-muted-foreground hover:text-[#8a1515] hover:bg-[#8a1515]/10 rounded-md transition-colors cursor-pointer"
                          title="Ver Detalhes"
                        >
                          <Info className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {totalPages > 1 && (
          <div className="p-4 border-t border-border flex flex-col sm:flex-row justify-between items-center gap-3 bg-muted/20">
            <span className="text-xs text-muted-foreground font-sans">
              Página {currentPage} de {totalPages}
            </span>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-border bg-background hover:bg-muted disabled:opacity-40 transition-colors cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-3 text-xs font-semibold text-foreground font-mono">
                {currentPage}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-border bg-background hover:bg-muted disabled:opacity-40 transition-colors cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── MODAL PRODUÇÃO MÉDICA SINTÉTICA ── */}
      <AnimatePresence>
        {selectedSinteticoItem && (() => {
          const basePlantaoTotal = selectedSinteticoItem.ITEMS.reduce((acc, p) => acc + p.VALOR, 0);
          const currentProdValTotal = editProducoesList.reduce((acc, row) => {
            const cleanStr = String(row.valorProducao).replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
            const numVal = parseFloat(cleanStr);
            return acc + (isNaN(numVal) ? 0 : numVal);
          }, 0);
          const calculatedFinalTotal = basePlantaoTotal + currentProdValTotal;

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-card dark:bg-slate-900 border border-border rounded-xl shadow-2xl max-w-2xl w-full p-6 space-y-5"
              >
                <div className="flex justify-between items-center border-b border-border pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-[#8a1515]/10 rounded-lg text-[#8a1515] dark:text-[#f43f5e] border border-[#8a1515]/20">
                      <Edit3 className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-foreground font-sans">
                        Lançamento de Produção Médica (Sintético)
                      </h3>
                      <p className="text-xs text-muted-foreground font-sans">
                        Adicione um ou mais tipos de produção e valores que serão somados ao total dos plantões.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedSinteticoItem(null)}
                    className="p-1 rounded-lg hover:bg-muted text-muted-foreground transition-colors cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Resumo do Grupo */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-muted/30 p-3.5 rounded-lg border border-border/40 font-sans text-xs">
                  <div>
                    <span className="text-muted-foreground block font-medium">Médico / Plantonista</span>
                    <span className="font-bold text-foreground text-sm">{selectedSinteticoItem.MEDICO}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block font-medium">Especialidade</span>
                    <span className="font-semibold text-foreground">{selectedSinteticoItem.ESPECIALIDADE}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block font-medium">Tipo Plantão</span>
                    <span className="font-semibold text-foreground">{selectedSinteticoItem.TIPO_PLANTAO}</span>
                  </div>
                </div>

                {/* Seção de Lançamento de Pagamento & Saldo Pendente */}
                {(() => {
                  const cleanPagoStr = String(editValorPago).replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
                  const parsedPago = parseFloat(cleanPagoStr);
                  const currentValorPago = isNaN(parsedPago) ? 0 : Math.max(0, parsedPago);
                  const currentSaldoPendente = Math.max(0, calculatedFinalTotal - currentValorPago);
                  let calculatedStatusBadge = 'Pendente';
                  if (currentValorPago >= calculatedFinalTotal && calculatedFinalTotal > 0) {
                    calculatedStatusBadge = 'Pago';
                  } else if (currentValorPago > 0 && currentValorPago < calculatedFinalTotal) {
                    calculatedStatusBadge = 'Parcial';
                  }

                  return (
                    <div className="p-4 bg-muted/40 border border-border rounded-xl space-y-3 font-sans">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                        <div>
                          <label className="text-xs font-bold text-foreground block">
                            Valor Pago Realizado (R$) *
                          </label>
                          <span className="text-[11px] text-muted-foreground block">
                            Informe o valor efetivamente quitado. Se houver saldo restante, será classificado como Parcial.
                          </span>
                        </div>

                        {/* Botões de Ação Rápida */}
                        <div className="flex items-center gap-1.5 self-end sm:self-auto">
                          <button
                            type="button"
                            onClick={() => {
                              setEditValorPago(String(calculatedFinalTotal));
                              setEditStatus('Pago');
                            }}
                            className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition-all shadow-sm cursor-pointer"
                          >
                            Quitar Total
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditValorPago('0');
                              setEditStatus('Pendente');
                            }}
                            className="px-2.5 py-1 rounded bg-rose-600/20 hover:bg-rose-600/30 text-rose-700 dark:text-rose-300 text-[11px] font-bold transition-all cursor-pointer"
                          >
                            Zerar (Pendente)
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div>
                          <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                            Valor Efetivamente Pago (R$)
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-2 text-sm font-bold text-emerald-600 font-mono">R$</span>
                            <input
                              type="text"
                              value={editValorPago}
                              onChange={(e) => setEditValorPago(e.target.value)}
                              placeholder="0,00"
                              className="w-full bg-background border border-border focus:border-[#8a1515] rounded-lg pl-9 pr-3 py-1.5 text-sm font-bold text-foreground font-mono outline-none"
                            />
                          </div>
                        </div>

                        <div className="flex flex-col justify-end">
                          <div className="p-2 bg-background border border-border rounded-lg flex justify-between items-center">
                            <span className="text-xs font-semibold text-muted-foreground">Status Atual:</span>
                            {calculatedStatusBadge === 'Pago' ? (
                              <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-mono">
                                <CheckCircle2 className="h-3 w-3" />
                                PAGO INTEGRAL
                              </span>
                            ) : calculatedStatusBadge === 'Parcial' ? (
                              <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-mono">
                                <Clock className="h-3 w-3" />
                                PAGO PARCIAL
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 font-mono">
                                <X className="h-3 w-3" />
                                PENDENTE
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Form de Múltiplos Tipos de Produção e Valores */}
                <div className="space-y-3 pt-1 font-sans">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                      Lançamentos de Produção ({editProducoesList.length}) *
                    </label>
                    <button
                      type="button"
                      onClick={handleAddProducaoRow}
                      className="flex items-center gap-1 text-xs font-semibold text-[#8a1515] dark:text-[#f43f5e] hover:underline cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>+ Adicionar Produção</span>
                    </button>
                  </div>

                  <div className="space-y-2.5 max-h-[170px] overflow-y-auto pr-1 custom-scrollbar">
                    {editProducoesList.length === 0 ? (
                      <div className="p-4 bg-muted/20 border border-dashed border-border rounded-xl text-center space-y-2">
                        <p className="text-xs text-muted-foreground">Nenhuma produção cadastrada para este grupo de plantão.</p>
                        <button
                          type="button"
                          onClick={handleAddProducaoRow}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#8a1515] dark:text-[#f43f5e] hover:underline cursor-pointer"
                        >
                          <Plus className="h-4 w-4" />
                          <span>Adicionar Produção</span>
                        </button>
                      </div>
                    ) : (
                      editProducoesList.map((prodRow, index) => (
                        <div key={prodRow.id} className="p-3 bg-muted/30 border border-border rounded-xl space-y-2 relative">
                          <div className="flex justify-between items-center">
                            <span className="text-[11px] font-bold text-muted-foreground">
                              Produção #{index + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveProducaoRow(prodRow.id)}
                              className="text-muted-foreground hover:text-red-500 p-1 transition-colors cursor-pointer"
                              title="Remover este item de produção"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] font-semibold text-muted-foreground block mb-1">
                              Tipo de Produção
                            </label>
                            <select
                              value={prodRow.tipoProducao}
                              onChange={(e) => handleUpdateProducaoRow(prodRow.id, 'tipoProducao', e.target.value)}
                              className="w-full bg-background border border-border focus:border-[#8a1515] rounded-lg px-2.5 py-1.5 text-xs font-semibold text-foreground outline-none cursor-pointer"
                            >
                              {tiposProducaoAtivos.map((t, idx) => (
                                <option key={t.id || t.nome} value={t.nome}>
                                  {idx + 1} - {t.nome}{t.descricao ? ` (${t.descricao})` : ''}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="text-[10px] font-semibold text-muted-foreground block mb-1">
                              Valor Adicional (R$)
                            </label>
                            <div className="relative">
                              <span className="absolute left-2.5 top-1.5 text-xs font-bold text-emerald-600 font-mono">R$</span>
                              <input
                                type="text"
                                value={prodRow.valorProducao}
                                onChange={(e) => handleUpdateProducaoRow(prodRow.id, 'valorProducao', e.target.value)}
                                placeholder="0,00"
                                className="w-full bg-background border border-border focus:border-[#8a1515] rounded-lg pl-8 pr-2.5 py-1 text-xs font-bold text-foreground font-mono outline-none"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )))}
                  </div>

                  {/* CÁLCULO FINANCEIRO COMPLETO EM TEMPO REAL */}
                  {(() => {
                    const cleanPagoStr = String(editValorPago).replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
                    const parsedPago = parseFloat(cleanPagoStr);
                    const currentValorPago = isNaN(parsedPago) ? 0 : Math.max(0, parsedPago);
                    const currentSaldoPendente = Math.max(0, calculatedFinalTotal - currentValorPago);

                    return (
                      <div className="p-3.5 bg-muted/40 rounded-xl border border-border grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs font-sans">
                        <div>
                          <span className="text-muted-foreground block font-medium text-[11px]">Base Plantões:</span>
                          <span className="font-semibold text-foreground font-mono">{formatCurrency(basePlantaoTotal)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block font-medium text-[11px]">Total Produções:</span>
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono">{formatCurrency(currentProdValTotal)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block font-medium text-[11px]">Valor Total Previsto:</span>
                          <span className="font-bold text-[#8a1515] dark:text-[#f43f5e] font-mono">{formatCurrency(calculatedFinalTotal)}</span>
                        </div>
                        <div className="border-l border-border/60 sm:pl-3">
                          <span className="text-muted-foreground block font-medium text-[11px]">Saldo Pendente:</span>
                          <span className={`font-bold font-mono text-sm ${currentSaldoPendente > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {formatCurrency(currentSaldoPendente)}
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Lista dos Lançamentos Integrantes */}
                <div className="space-y-1.5 pt-1">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground font-sans">
                    Lançamentos Individuais Integrantes ({selectedSinteticoItem.ITEMS.length})
                  </h4>
                  <div className="max-h-[110px] overflow-y-auto border border-border rounded-lg divide-y divide-border/60 custom-scrollbar">
                    {selectedSinteticoItem.ITEMS.map((item, idx) => (
                      <div key={item.id || idx} className="flex justify-between items-center px-3 py-1.5 text-xs hover:bg-muted/30 font-sans">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-muted-foreground">{formatDate(item.DT_CHAMADO)}</span>
                          <span className="text-foreground font-medium">{item.TIPO_PLANTAO}</span>
                        </div>
                        <span className="font-bold text-foreground">{formatCurrency(item.VALOR)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Botões do Modal */}
                <div className="flex justify-between items-center pt-3 border-t border-border">
                  {saveSuccessMessage ? (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Produções salvas com sucesso!</span>
                    </div>
                  ) : (
                    <div />
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedSinteticoItem(null)}
                      className="px-4 py-2 rounded-lg text-xs font-semibold border border-border hover:bg-muted text-muted-foreground transition-colors cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={isSavingProducao}
                      onClick={handleSaveSinteticoProducao}
                      className="flex items-center gap-1.5 bg-[#8a1515] hover:bg-[#6b1010] text-white px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSavingProducao ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Salvando no Supabase...</span>
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4" />
                          <span>Salvar Produções</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* ── MODAL DETALHES ANALÍTICO (SIMPLES) ── */}
      <AnimatePresence>
        {selectedItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card dark:bg-slate-900 border border-border rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-5"
            >
              <div className="flex justify-between items-center border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <Stethoscope className="h-5 w-5 text-[#8a1515] dark:text-[#f43f5e]" />
                  <h3 className="text-lg font-bold text-foreground font-sans">
                    Detalhes da Escala Médica
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="p-1 rounded-lg hover:bg-muted text-muted-foreground transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-3 text-sm font-sans">
                <div className="grid grid-cols-2 gap-3 bg-muted/30 p-3.5 rounded-lg border border-border/40">
                  <div className="col-span-2">
                    <span className="text-xs text-muted-foreground block">Médico / Plantonista</span>
                    <span className="font-bold text-foreground text-base">{selectedItem.MEDICO}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">Especialidade</span>
                    <span className="font-medium text-foreground">{selectedItem.ESPECIALIDADE}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">Tipo Plantão</span>
                    <span className="font-medium text-foreground">{selectedItem.TIPO_PLANTAO || '-'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-xs text-muted-foreground block">Data e Hora do Chamado</span>
                    <span className="font-mono text-foreground">{formatDate(selectedItem.DT_CHAMADO)}</span>
                  </div>
                </div>

                <div className="p-4 bg-[#8a1515]/10 rounded-lg border border-[#8a1515]/20 flex justify-between items-center">
                  <div>
                    <span className="text-xs text-muted-foreground block">Valor do Plantão</span>
                    <span className="text-2xl font-bold text-[#8a1515] dark:text-[#f43f5e]">
                      {formatCurrency(selectedItem.VALOR)}
                    </span>
                  </div>
                  <span className="text-xs font-semibold px-3 py-1 rounded-full bg-[#8a1515]/20 text-[#8a1515] dark:text-[#f43f5e]">
                    {selectedItem.ESPECIALIDADE}
                  </span>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setSelectedItem(null)}
                  className="bg-primary text-primary-foreground hover:bg-primary/95 px-4 py-2 rounded-lg text-xs font-semibold font-sans transition-colors cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Gestão de Tipos de Produção Médica */}
      <PlantaoMedicoTiposModal
        isOpen={isTiposModalOpen}
        onClose={() => setIsTiposModalOpen(false)}
        onTiposUpdated={carregarTiposProducao}
      />

      {/* Modal de Gestão de E-mails dos Médicos */}
      <MedicoEmailsModal
        isOpen={isEmailsModalOpen}
        onClose={() => setIsEmailsModalOpen(false)}
        medicosDisponiveis={medicosDisponiveis}
        onContatosUpdated={carregarContatosMedicos}
      />

      {/* Modal de Disparo de E-mails em Lote */}
      <DisparoEmailLoteModal
        isOpen={isDisparoLoteOpen}
        onClose={() => setIsDisparoLoteOpen(false)}
        plantaosSinteticos={plantaosSinteticos}
        contatosMedicos={contatosMedicos}
        periodoReferencia={(() => {
          const formatPer = (p: string) => p.split('-').reverse().join('/');
          return `${formatPer(periodFrom)} a ${formatPer(periodTo)}`;
        })()}
        periodoDe={periodFrom}
        periodoAte={periodTo}
        onEmailsDisparados={() => carregarProducoesSupabase(periodFrom, periodTo)}
      />
    </div>
  );
};

export default PlantaoMedico;
