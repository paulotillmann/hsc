import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, ChevronDown, Plus, Trash2,
  Loader2, UserPlus, X, CalendarX, AlertCircle, CheckCircle, Info,
  FileText, MapPin, Monitor, Coins
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  fetchColaboradoresTI, fetchEscalasMes, adicionarPlantonista,
  removerPlantonista, limparEscalaDia, adicionarOcorrenciaPlantao,
  removerOcorrenciaPlantao, fetchSetoresInternacao, buscarNomesSolicitantes,
  ColaboradorTI, EscalaPlantao, OcorrenciaPlantao, ALLOWED_EMAILS
} from '../../services/plantaoTiService';
const COLABORADORES_CORES: Record<string, { bullet: string; text: string; bg: string; border: string }> = {
  'talysson': {
    bullet: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]',
    text: 'text-emerald-700 dark:text-emerald-300',
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
    border: 'border-emerald-500/20 dark:border-emerald-500/30',
  },
  'bruno': {
    bullet: 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]',
    text: 'text-blue-700 dark:text-blue-300',
    bg: 'bg-blue-500/10 dark:bg-blue-500/20',
    border: 'border-blue-500/20 dark:border-blue-500/30',
  },
  'jessica': {
    bullet: 'bg-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.5)]',
    text: 'text-pink-700 dark:text-pink-300',
    bg: 'bg-pink-500/10 dark:bg-pink-500/20',
    border: 'border-pink-500/20 dark:border-pink-500/30',
  },
  'jhon': {
    bullet: 'bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]',
    text: 'text-purple-700 dark:text-purple-300',
    bg: 'bg-purple-500/10 dark:bg-purple-500/20',
    border: 'border-purple-500/20 dark:border-purple-500/30',
  },
};

function getColaboradorEstilo(fullName?: string | null) {
  if (!fullName) {
    return {
      bullet: 'bg-slate-500',
      text: 'text-slate-700 dark:text-slate-300',
      bg: 'bg-slate-500/10',
      border: 'border-slate-500/20',
    };
  }
  const name = fullName.toLowerCase();
  if (name.includes('talysson')) return COLABORADORES_CORES['talysson'];
  if (name.includes('bruno')) return COLABORADORES_CORES['bruno'];
  if (name.includes('jessica') || name.includes('jéssica')) return COLABORADORES_CORES['jessica'];
  if (name.includes('jhon') || name.includes('willy')) return COLABORADORES_CORES['jhon'];

  return {
    bullet: 'bg-slate-500',
    text: 'text-slate-700 dark:text-slate-300',
    bg: 'bg-slate-500/10',
    border: 'border-slate-500/20',
  };
}

function obterPrimeiroNome(fullName?: string | null) {
  if (!fullName) return 'Sem nome';
  return fullName.split(' ')[0];
}

// ── Cálculo e Lista de Feriados Nacionais do Brasil ────────────────────────
interface Feriado {
  name: string;
  isHoliday: boolean; // true para feriado nacional, false para ponto facultativo
}

// Algoritmo de Butcher-Meeus para cálculo da Páscoa
function obterPascoa(ano: number): Date {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes - 1, dia);
}

export function obterFeriadosBrasil(ano: number): Record<string, Feriado> {
  const feriados: Record<string, Feriado> = {};

  const formatarData = (d: Date) => {
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${ano}-${month}-${day}`;
  };

  // Feriados Fixos Nacionais
  feriados[`${ano}-01-01`] = { name: 'Confraternização Universal', isHoliday: true };
  feriados[`${ano}-04-21`] = { name: 'Tiradentes', isHoliday: true };
  feriados[`${ano}-05-01`] = { name: 'Dia do Trabalhador', isHoliday: true };
  feriados[`${ano}-09-07`] = { name: 'Independência do Brasil', isHoliday: true };
  feriados[`${ano}-10-12`] = { name: 'Nossa Senhora Aparecida', isHoliday: true };
  feriados[`${ano}-11-02`] = { name: 'Finados', isHoliday: true };
  feriados[`${ano}-11-15`] = { name: 'Proclamação da República', isHoliday: true };
  feriados[`${ano}-11-20`] = { name: 'Consciência Negra', isHoliday: true };
  feriados[`${ano}-12-25`] = { name: 'Natal', isHoliday: true };

  // Feriados Municipais - Araguari / MG (Agosto)
  feriados[`${ano}-08-06`] = { name: 'Bom Jesus da Cana Verde (Mun.)', isHoliday: true };
  feriados[`${ano}-08-15`] = { name: 'N. Sra. da Abadia (Mun.)', isHoliday: true };
  feriados[`${ano}-08-28`] = { name: 'Aniversário de Araguari (Mun.)', isHoliday: true };

  // Feriados Móveis
  const pascoa = obterPascoa(ano);

  // Sexta-feira Santa (2 dias antes da Páscoa)
  const sextaSanta = new Date(pascoa);
  sextaSanta.setDate(pascoa.getDate() - 2);
  feriados[formatarData(sextaSanta)] = { name: 'Paixão de Cristo', isHoliday: true };

  // Carnaval (47 dias antes da Páscoa)
  const carnaval = new Date(pascoa);
  carnaval.setDate(pascoa.getDate() - 47);
  feriados[formatarData(carnaval)] = { name: 'Carnaval', isHoliday: false };

  // Corpus Christi (60 dias após a Páscoa)
  const corpusChristi = new Date(pascoa);
  corpusChristi.setDate(pascoa.getDate() + 60);
  feriados[formatarData(corpusChristi)] = { name: 'Corpus Christi', isHoliday: false };

  return feriados;
}

const DIAS_SEMANA = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export default function PlantaoTI() {
  const { isAdmin, profile } = useAuth();

  const canDoPlantao = useMemo(() => {
    if (!profile?.email) return false;
    return ALLOWED_EMAILS.includes(profile.email.toLowerCase());
  }, [profile]);

  // Estados de data e navegação
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());

  // Estados de dados
  const [escalas, setEscalas] = useState<EscalaPlantao[]>([]);
  const [colaboradores, setColaboradores] = useState<ColaboradorTI[]>([]);
  const [loading, setLoading] = useState(true);
  const [operando, setOperando] = useState(false);

  // Estados de Modais / Popups
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedColaboradorId, setSelectedColaboradorId] = useState('');

  // Estados para ocorrência/chamado do plantão
  const [selectedEscala, setSelectedEscala] = useState<EscalaPlantao | null>(null);
  const [formNomeSolicitante, setFormNomeSolicitante] = useState('');
  const [formSetorSolicitante, setFormSetorSolicitante] = useState('');
  const [formDescricaoPlantao, setFormDescricaoPlantao] = useState('');
  const [formAtendimentoPresencial, setFormAtendimentoPresencial] = useState(false);
  const [setores, setSetores] = useState<string[]>([]);
  const [sugestoesNomes, setSugestoesNomes] = useState<string[]>([]);
  const [loadingSugestoes, setLoadingSugestoes] = useState(false);
  const [showSugestoes, setShowSugestoes] = useState(false);
  const [nomeSelecionado, setNomeSelecionado] = useState(false);

  // Estados de controle para múltiplas ocorrências
  const [showOcorrenciaForm, setShowOcorrenciaForm] = useState(false);
  const [viewingOcorrencia, setViewingOcorrencia] = useState<OcorrenciaPlantao | null>(null);

  // Estado de Toasts locais
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const showToast = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  }, []);

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  // Feriados do ano ativo
  const feriadosDoAno = useMemo(() => {
    return obterFeriadosBrasil(currentYear);
  }, [currentYear]);

  const selectedDateString = useMemo(() => {
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, [selectedDate]);

  const resumoValoresTodos = useMemo(() => {
    if (!canDoPlantao || colaboradores.length === 0) return [];

    const jhonColab = colaboradores.find(c => c.email.toLowerCase() === 'jhon.silva@santacasaaraguari.org.br');
    const jhonId = jhonColab?.id;

    const reducedGroupEmails = [
      'talysson.resende@santacasaaraguari.org.br',
      'bruno.lima@santacasaaraguari.org.br',
      'jessica.araujo@santacasaaraguari.org.br'
    ];

    return colaboradores.map(colab => {
      let total = 0;
      let diasUteisNormais = 0;
      let diasUteisReduzidos = 0;
      let finaisFeriadosNormais = 0;
      let finaisFeriadosReduzidos = 0;

      const escalasUsuario = escalas.filter(e => e.usuario_id === colab.id);
      const isReducedGroup = reducedGroupEmails.includes(colab.email.toLowerCase());

      escalasUsuario.forEach(e => {
        const dateParts = e.data_plantao.split('-');
        const year = parseInt(dateParts[0], 10);
        const month = parseInt(dateParts[1], 10) - 1;
        const day = parseInt(dateParts[2], 10);
        const dateObj = new Date(year, month, day);
        
        const dayOfWeek = dateObj.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const isFeriado = !!feriadosDoAno[e.data_plantao];
        const isWeekendOrFeriado = isWeekend || isFeriado;

        // Verificar se Jhon também está escalado no mesmo dia
        const isJhonTogether = escalas.some(other => 
          other.data_plantao === e.data_plantao && 
          (other.profiles?.email.toLowerCase() === 'jhon.silva@santacasaaraguari.org.br' || 
           (jhonId && other.usuario_id === jhonId))
        );

        if (isReducedGroup && isJhonTogether) {
          if (isWeekendOrFeriado) {
            total += 100;
            finaisFeriadosReduzidos++;
          } else {
            total += 50;
            diasUteisReduzidos++;
          }
        } else {
          if (isWeekendOrFeriado) {
            total += 200;
            finaisFeriadosNormais++;
          } else {
            total += 100;
            diasUteisNormais++;
          }
        }
      });

      return {
        id: colab.id,
        nome: colab.full_name,
        email: colab.email,
        total,
        diasUteisNormais,
        diasUteisReduzidos,
        finaisFeriadosNormais,
        finaisFeriadosReduzidos,
        isSelf: colab.id === profile?.id
      };
    }).sort((a, b) => b.total - a.total);
  }, [escalas, colaboradores, canDoPlantao, feriadosDoAno, profile]);

  // Estatísticas de ocorrências do mês selecionado
  const estatisticasMes = useMemo(() => {
    let total = 0;
    let presencial = 0;
    let remoto = 0;

    escalas.forEach(escala => {
      if (escala.ocorrencias) {
        total += escala.ocorrencias.length;
        escala.ocorrencias.forEach(o => {
          if (o.atendimento_presencial) {
            presencial++;
          } else {
            remoto++;
          }
        });
      }
    });

    return { total, presencial, remoto };
  }, [escalas]);

  // Resetar escala selecionada ao mudar a data do calendário
  useEffect(() => {
    setSelectedEscala(null);
    setShowOcorrenciaForm(false);
    setViewingOcorrencia(null);
  }, [selectedDateString]);

  // Resetar formulário de ocorrência ao abrir
  useEffect(() => {
    if (showOcorrenciaForm) {
      setFormNomeSolicitante('');
      setFormSetorSolicitante('');
      setFormDescricaoPlantao('');
      setFormAtendimentoPresencial(false);
      setSugestoesNomes([]);
      setShowSugestoes(false);
      setNomeSelecionado(false);
    }
  }, [showOcorrenciaForm]);

  // Efeito para buscar sugestões de nomes com debounce de 300ms
  useEffect(() => {
    if (nomeSelecionado || formNomeSolicitante.trim().length < 2) {
      setSugestoesNomes([]);
      setShowSugestoes(false);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setLoadingSugestoes(true);
      try {
        const results = await buscarNomesSolicitantes(formNomeSolicitante);
        setSugestoesNomes(results);
        setShowSugestoes(results.length > 0);
      } catch (err) {
        console.error('Erro ao buscar sugestões de nomes:', err);
      } finally {
        setLoadingSugestoes(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [formNomeSolicitante, nomeSelecionado]);

  // Fechar formulário ao mudar a escala selecionada
  useEffect(() => {
    setShowOcorrenciaForm(false);
    setViewingOcorrencia(null);
  }, [selectedEscala]);

  // ── Carregar escalas do mês selecionado ─────────────────────────────────────
  const loadEscalas = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchEscalasMes(currentYear, currentMonth + 1);
      setEscalas(data);
    } catch (err) {
      showToast('error', 'Erro ao carregar escalas do mês.');
    } finally {
      setLoading(false);
    }
  }, [currentYear, currentMonth, showToast]);

  // ── Carregar colaboradores e setores ao montar o componente ─────────────────────────
  useEffect(() => {
    const loadColaboradores = async () => {
      try {
        const data = await fetchColaboradoresTI();
        setColaboradores(data);
      } catch (err) {
        showToast('error', 'Erro ao carregar colaboradores do banco.');
      }
    };

    const loadSetores = async () => {
      try {
        const data = await fetchSetoresInternacao();
        setSetores(data);
      } catch (err) {
        console.error('Erro ao carregar setores de pacientes internados:', err);
      }
    };

    loadColaboradores();
    loadSetores();
  }, [showToast]);

  useEffect(() => {
    loadEscalas();
  }, [loadEscalas]);

  // Manter selectedEscala sincronizado com as escalas carregadas (realtime ou atualizações locais)
  useEffect(() => {
    if (selectedEscala) {
      const escalaAtualizada = escalas.find(item => item.id === selectedEscala.id);
      if (escalaAtualizada) {
        setSelectedEscala(escalaAtualizada);
      } else {
        setSelectedEscala(null);
      }
    }
  }, [escalas]);

  // Configurar o Supabase Realtime para escalas e ocorrências
  useEffect(() => {
    console.log('[Realtime] Conectando ao canal plantao_ti_realtime...');
    const channel = supabase
      .channel('plantao_ti_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'plantao_ti_escala' },
        (payload) => {
          console.log('[Realtime] Mudança na tabela plantao_ti_escala recebida:', payload);
          loadEscalas();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'plantao_ti_ocorrencias' },
        (payload) => {
          console.log('[Realtime] Mudança na tabela plantao_ti_ocorrencias recebida:', payload);
          loadEscalas();
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Status da inscrição:', status);
      });

    return () => {
      console.log('[Realtime] Removendo canal plantao_ti_realtime...');
      supabase.removeChannel(channel);
    };
  }, [loadEscalas]);

  // ── Navegação do calendário ────────────────────────────────────────────────
  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  };

  // ── Operações de Plantonistas ──────────────────────────────────────────────
  const handleAddPlantonista = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedColaboradorId) return;

    setOperando(true);
    try {
      const result = await adicionarPlantonista(selectedDateString, selectedColaboradorId);
      if (result.success) {
        showToast('success', 'Colaborador adicionado com sucesso!');
        setShowAddModal(false);
        setSelectedColaboradorId('');
        await loadEscalas();
      } else {
        showToast('error', result.error || 'Erro ao adicionar plantonista.');
      }
    } catch {
      showToast('error', 'Erro inesperado ao realizar operação.');
    } finally {
      setOperando(false);
    }
  };

  const handleRemovePlantonista = async (escalaId: string, nome: string) => {
    if (!isAdmin) return;
    if (!window.confirm(`Remover ${nome} do plantão neste dia?`)) return;

    setOperando(true);
    try {
      const result = await removerPlantonista(escalaId);
      if (result.success) {
        showToast('success', 'Plantonista removido da escala.');
        await loadEscalas();
      } else {
        showToast('error', result.error || 'Erro ao remover colaborador.');
      }
    } catch {
      showToast('error', 'Erro ao remover colaborador do plantão.');
    } finally {
      setOperando(false);
    }
  };

  const handleLimparDia = async () => {
    if (!isAdmin) return;
    const formattedDate = selectedDate.toLocaleDateString('pt-BR');
    if (!window.confirm(`Tem certeza que deseja remover todos os plantonistas do dia ${formattedDate}?`)) return;

    setOperando(true);
    try {
      const result = await limparEscalaDia(selectedDateString);
      if (result.success) {
        showToast('success', `Escala do dia ${formattedDate} limpa.`);
        await loadEscalas();
      } else {
        showToast('error', result.error || 'Erro ao limpar dia.');
      }
    } catch {
      showToast('error', 'Erro ao limpar escala do dia.');
    } finally {
      setOperando(false);
    }
  };

  const handleSaveOcorrencia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEscala) return;

    setOperando(true);
    try {
      const result = await adicionarOcorrenciaPlantao(selectedEscala.id, {
        nome_solicitante: formNomeSolicitante,
        setor_solicitante: formSetorSolicitante,
        descricao_plantao: formDescricaoPlantao,
        atendimento_presencial: formAtendimentoPresencial,
      });

      if (result.success) {
        showToast('success', 'Ocorrência registrada com sucesso!');
        setShowOcorrenciaForm(false);

        // Recarregar as escalas
        await loadEscalas();

        // Atualizar a escala selecionada localmente
        const todasEscalas = await fetchEscalasMes(currentYear, currentMonth + 1);
        const escalaAtualizada = todasEscalas.find(item => item.id === selectedEscala.id);
        if (escalaAtualizada) {
          setSelectedEscala(escalaAtualizada);
        }
      } else {
        showToast('error', result.error || 'Erro ao salvar ocorrência.');
      }
    } catch {
      showToast('error', 'Erro inesperado ao salvar ocorrência.');
    } finally {
      setOperando(false);
    }
  };

  const handleRemoveOcorrencia = async (ocorrenciaId: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta ocorrência?')) return;

    setOperando(true);
    try {
      const result = await removerOcorrenciaPlantao(ocorrenciaId);
      if (result.success) {
        showToast('success', 'Ocorrência excluída com sucesso!');
        setViewingOcorrencia(null);

        // Recarregar as escalas
        await loadEscalas();

        // Atualizar a escala selecionada localmente
        if (selectedEscala) {
          const todasEscalas = await fetchEscalasMes(currentYear, currentMonth + 1);
          const escalaAtualizada = todasEscalas.find(item => item.id === selectedEscala.id);
          setSelectedEscala(escalaAtualizada || null);
        }
      } else {
        showToast('error', result.error || 'Erro ao excluir ocorrência.');
      }
    } catch {
      showToast('error', 'Erro inesperado ao excluir ocorrência.');
    } finally {
      setOperando(false);
    }
  };

  // ── Estruturação dos slots do calendário (42 dias) ──────────────────────────
  const slotsCalendario = useMemo(() => {
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
    const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();

    const slots: { day: number; date: Date; isCurrentMonth: boolean; dateStr: string }[] = [];

    // Dias do mês anterior
    const prevMonthTotalDays = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = prevMonthTotalDays - i;
      const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      const date = new Date(prevYear, prevMonth, d);
      const dateStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      slots.push({ day: d, date, isCurrentMonth: false, dateStr });
    }

    // Dias do mês atual
    for (let d = 1; d <= totalDays; d++) {
      const date = new Date(currentYear, currentMonth, d);
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      slots.push({ day: d, date, isCurrentMonth: true, dateStr });
    }

    // Dias do próximo mês para fechar 42 slots (6 semanas)
    const remainingSlots = 42 - slots.length;
    for (let d = 1; d <= remainingSlots; d++) {
      const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
      const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
      const date = new Date(nextYear, nextMonth, d);
      const dateStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      slots.push({ day: d, date, isCurrentMonth: false, dateStr });
    }

    return slots;
  }, [currentYear, currentMonth]);

  // Escalas agrupadas por string de data para busca rápida O(1)
  const escalasAgrupadas = useMemo(() => {
    const mapa: Record<string, EscalaPlantao[]> = {};
    escalas.forEach(e => {
      if (!mapa[e.data_plantao]) {
        mapa[e.data_plantao] = [];
      }
      mapa[e.data_plantao].push(e);
    });
    return mapa;
  }, [escalas]);

  const plantonistasDoDiaSelecionado = useMemo(() => {
    return escalasAgrupadas[selectedDateString] ?? [];
  }, [escalasAgrupadas, selectedDateString]);

  const colaboradoresDisponiveis = useMemo(() => {
    const idsEscalados = plantonistasDoDiaSelecionado.map(p => p.usuario_id);
    return colaboradores.filter(c => !idsEscalados.includes(c.id));
  }, [colaboradores, plantonistasDoDiaSelecionado]);

  const hojeStr = useMemo(() => {
    const hoje = new Date();
    return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
  }, []);

  return (
    <div className="flex-1 space-y-3 min-h-[60vh] pb-2 w-full mx-auto px-1 pt-2 text-foreground transition-all">
      {/* ── Toast de Notificação Local ── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border text-sm max-w-sm ${toast.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                : toast.type === 'error'
                  ? 'bg-destructive/10 border-destructive/30 text-destructive'
                  : 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400'
              }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle className="h-5 w-5 flex-shrink-0" />
            ) : toast.type === 'error' ? (
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
            ) : (
              <Info className="h-5 w-5 flex-shrink-0" />
            )}
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Cabeçalho do Módulo ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <CalendarIcon className="h-8 w-8 text-primary" />
            Plantão TI
          </h1>
          <p className="text-muted-foreground mt-1 text-xs">
            Calendário de escalas e controle de plantonistas de tecnologia.
          </p>
        </div>
      </div>
      {/* ── Grid Principal de dois painéis ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* ── Painel da Esquerda: Agenda do Mês (8/12) ── */}
        <div className="lg:col-span-8 bg-card border border-border/80 shadow-md rounded-xl p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/55 pb-2">
            <div>
              <h2 className="text-lg font-bold text-foreground">Agenda do Mês</h2>
              <p className="text-xs text-muted-foreground">Visão geral dos compromissos registrados.</p>
            </div>

            {/* Controle de Navegação de Mês */}
            <div className="flex items-center gap-2 self-center bg-background border border-border/70 rounded-lg p-1">
              <button
                onClick={handlePrevMonth}
                className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="Mês anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-semibold px-3 text-center min-w-[120px]">
                {MESES[currentMonth]} {currentYear}
              </span>
              <button
                onClick={handleNextMonth}
                className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="Próximo mês"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Grade de Dias do Calendário */}
          {loading ? (
            <div className="h-[380px] flex flex-col items-center justify-center text-muted-foreground gap-3">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <span>Carregando escala do mês...</span>
            </div>
          ) : (
            <div className="space-y-1">
              {/* Dias da semana */}
              <div className="grid grid-cols-7 text-center">
                {DIAS_SEMANA.map(dia => (
                  <span
                    key={dia}
                    className="text-xs font-semibold text-muted-foreground uppercase tracking-wider py-1"
                  >
                    {dia}
                  </span>
                ))}
              </div>

              {/* Grid 6x7 de slots de dias */}
              <div className="grid grid-cols-7 gap-1">
                {slotsCalendario.map((slot, index) => {
                  const diaEscalas = escalasAgrupadas[slot.dateStr] ?? [];
                  const isSelected = selectedDateString === slot.dateStr;
                  const isToday = hojeStr === slot.dateStr;
                  const feriadoInfo = feriadosDoAno[slot.dateStr];
                  const hasFeriado = !!feriadoInfo;
                  const temOcorrenciaDia = diaEscalas.some(e => e.ocorrencias && e.ocorrencias.length > 0);

                  // Estilos de destaque para feriados e pontos facultativos
                  let feriadoClasses = '';
                  if (hasFeriado && !isSelected) {
                    feriadoClasses = 'border-rose-200/80 dark:border-rose-950/80 bg-rose-500/[0.04] dark:bg-rose-500/[0.06] text-foreground';
                  }

                  return (
                    <button
                      key={index}
                      onClick={() => setSelectedDate(slot.date)}
                      className={`min-h-[75px] md:min-h-[85px] p-1.5 rounded-lg border flex flex-col justify-between items-stretch text-left transition-all relative ${
                        slot.isCurrentMonth
                          ? feriadoClasses || 'bg-card border-border/50 text-foreground'
                          : 'bg-muted/10 border-border/20 text-muted-foreground opacity-50'
                        } ${isSelected
                          ? 'ring-2 ring-primary border-transparent bg-primary/5 shadow-inner'
                          : 'hover:border-border-hover hover:bg-muted/20'
                        }`}
                    >
                      {/* Número do Dia com destaque se for hoje e feriado */}
                      <div className="flex justify-between items-center w-full gap-2">
                        {isToday ? (
                          <span className="text-xs font-bold bg-primary text-primary-foreground h-5 w-5 rounded-full flex items-center justify-center shadow-sm">
                            {slot.day}
                          </span>
                        ) : (
                          <span className={`text-xs font-bold ${
                            isSelected
                              ? 'text-primary'
                              : feriadoInfo
                                ? 'text-rose-600 dark:text-rose-400'
                                : ''
                          }`}>
                            {slot.day}
                          </span>
                        )}

                        <div className="flex items-center gap-1.5 ml-auto shrink-0">
                          {feriadoInfo && (
                            <span
                              className={`text-[8.5px] px-1.5 py-0.5 rounded font-bold leading-tight text-right break-words max-w-[70px] bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20`}
                              title={feriadoInfo.name}
                            >
                              {feriadoInfo.name}
                            </span>
                          )}

                          {temOcorrenciaDia && (
                            <FileText 
                              className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400 shrink-0" 
                              title="Há ocorrências registradas neste dia" 
                            />
                          )}

                          {isAdmin && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDate(slot.date);
                                setShowAddModal(true);
                              }}
                              className="p-1 rounded-full bg-primary/10 text-primary hover:bg-primary/20 dark:bg-primary/20 dark:hover:bg-primary/30 transition-all shrink-0 shadow-sm border border-primary/10"
                              title="Adicionar plantonista"
                              type="button"
                            >
                              <Plus className="h-3.5 w-3.5" strokeWidth={3} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Plantonistas do Dia */}
                      <div className="flex-1 mt-1.5 space-y-1 overflow-y-auto max-h-[50px] pr-0.5 scrollbar-thin">
                        {diaEscalas.map(escala => {
                          const estilo = getColaboradorEstilo(escala.profiles?.full_name);
                          const temOcorrenciaPlantonista = escala.ocorrencias && escala.ocorrencias.length > 0;
                          return (
                            <div
                              key={escala.id}
                              className={`flex items-center justify-between gap-1 px-1 py-0.5 rounded text-[9px] font-medium border ${estilo.bg} ${estilo.border}`}
                              title={escala.profiles?.full_name || ''}
                            >
                              <div className="flex items-center gap-1 min-w-0">
                                <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${estilo.bullet}`} />
                                <span className={`truncate ${estilo.text}`}>
                                  {obterPrimeiroNome(escala.profiles?.full_name)}
                                </span>
                              </div>
                              {temOcorrenciaPlantonista && (
                                <FileText 
                                  className="h-2.5 w-2.5 text-blue-500 dark:text-blue-400 shrink-0" 
                                  title={`${escala.ocorrencias.length} ocorrência(s) registrada(s)`}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Painel da Direita: Escala do Dia (4/12) ── */}
        <div className="lg:col-span-4 space-y-3">
          {/* Indicadores de Ocorrências do Mês */}
          <div className="grid grid-cols-2 gap-3">
            {/* Card 1: Total de Ocorrências */}
            <div className="bg-card border border-border/80 shadow-md rounded-xl p-3 flex items-center justify-between relative overflow-hidden transition-all hover:shadow-lg">
              <div className="space-y-1 z-10">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Total de Ocorrências no Mês
                </p>
                <p className="text-2xl font-extrabold text-foreground tracking-tight">
                  {estatisticasMes.total}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-primary/10 text-primary z-10">
                <FileText className="h-5 w-5" />
              </div>
              <div className="absolute -right-4 -bottom-4 w-12 h-12 bg-primary/5 rounded-full blur-md" />
            </div>

            {/* Card 2: Presencial vs Remoto */}
            <div className="bg-card border border-border/80 shadow-md rounded-xl p-3 flex flex-col justify-between relative overflow-hidden transition-all hover:shadow-lg">
              <div className="space-y-1.5 z-10 w-full">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Tipos de Atendimento
                </p>
                <div className="flex items-center justify-between text-sm font-bold text-foreground">
                  <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400" title="Atendimento Presencial">
                    <MapPin className="h-4 w-4" />
                    <span className="text-lg font-extrabold">{estatisticasMes.presencial}</span>
                    <span className="text-[10px] font-medium text-muted-foreground">Presencial</span>
                  </span>
                  <span className="text-xs text-muted-foreground/60 font-normal">/</span>
                  <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400" title="Atendimento Remoto">
                    <Monitor className="h-4 w-4" />
                    <span className="text-lg font-extrabold">{estatisticasMes.remoto}</span>
                    <span className="text-[10px] font-medium text-muted-foreground">Remoto</span>
                  </span>
                </div>
                {/* Barra de Proporção */}
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden flex mt-0.5">
                  {estatisticasMes.total > 0 ? (
                    <>
                      <div 
                        className="bg-amber-500 transition-all duration-500" 
                        style={{ width: `${(estatisticasMes.presencial / estatisticasMes.total) * 100}%` }}
                        title={`Presencial: ${Math.round((estatisticasMes.presencial / estatisticasMes.total) * 100)}%`}
                      />
                      <div 
                        className="bg-blue-500 transition-all duration-500" 
                        style={{ width: `${(estatisticasMes.remoto / estatisticasMes.total) * 100}%` }}
                        title={`Remoto: ${Math.round((estatisticasMes.remoto / estatisticasMes.total) * 100)}%`}
                      />
                    </>
                  ) : (
                    <div className="w-full bg-muted" />
                  )}
                </div>
              </div>
              <div className="absolute -right-4 -bottom-4 w-12 h-12 bg-amber-500/5 rounded-full blur-md" />
            </div>
          </div>

          {/* Painel Detalhado do Dia Selecionado */}
          <div className="bg-card border border-border/80 shadow-md rounded-xl p-5 md:p-6 space-y-4">
            <div className="border-b border-border/50 pb-3 flex justify-between items-center">
              <div className="min-w-0 flex-1 mr-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-foreground">Escala do Dia</h3>
                  {isAdmin && plantonistasDoDiaSelecionado.length > 0 && (
                    <button
                      onClick={handleLimparDia}
                      className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      title="Limpar todos os plantonistas deste dia"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {selectedDate.toLocaleDateString('pt-BR', { dateStyle: 'long' })}
                </p>
                {feriadosDoAno[selectedDateString] && (
                  <span className={`inline-block mt-1 text-[9px] px-2 py-0.5 rounded-full font-bold border bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20`}>
                    {feriadosDoAno[selectedDateString].name}
                  </span>
                )}
              </div>
              <span className="text-xs font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full shrink-0">
                {plantonistasDoDiaSelecionado.length}{' '}
                {plantonistasDoDiaSelecionado.length === 1 ? 'plantonista' : 'plantonistas'}
              </span>
            </div>

            {loading ? (
              <div className="py-4 flex justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : plantonistasDoDiaSelecionado.length === 0 ? (
              <div className="py-4 text-center text-muted-foreground space-y-2">
                <CalendarIcon className="h-8 w-8 mx-auto opacity-30 text-foreground" />
                <p className="text-xs">Nenhum plantonista cadastrado para este dia.</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {plantonistasDoDiaSelecionado.map(escala => {
                  const estilo = getColaboradorEstilo(escala.profiles?.full_name);
                  const isEscalaSelecionada = selectedEscala?.id === escala.id;
                  const temOcorrencia = !!escala.ocorrencias && escala.ocorrencias.length > 0;
                  const ePresencial = !!escala.ocorrencias && escala.ocorrencias.some(o => o.atendimento_presencial);
                  return (
                    <div
                      key={escala.id}
                      onClick={() => {
                        setSelectedEscala(isEscalaSelecionada ? null : escala);
                      }}
                      className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer hover:border-primary/50 transition-all ${
                        isEscalaSelecionada ? 'ring-2 ring-primary bg-primary/5 shadow-inner' : estilo.bg
                      } ${estilo.border}`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <span className={`h-2 w-2 flex-shrink-0 rounded-full ${estilo.bullet}`} />
                        <div className="min-w-0 flex-1 flex flex-col justify-center">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {escala.profiles?.full_name || 'Usuário Sem Nome'}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {escala.profiles?.email || ''}
                          </p>
                        </div>
                        {(temOcorrencia || ePresencial) && (
                          <div className="flex items-center gap-1.5 shrink-0 ml-2">
                            {temOcorrencia && (
                              <span 
                                className="flex items-center gap-1.5 px-2 py-1 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold" 
                                title={`${escala.ocorrencias?.length || 0} ocorrência(s) registrada(s)`}
                              >
                                <FileText className="h-5 w-5" />
                                <span>{escala.ocorrencias?.length || 0}</span>
                              </span>
                            )}
                            {ePresencial && (
                              <span className="p-1 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400" title="Houve atendimento presencial">
                                <MapPin className="h-5 w-5" />
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Ações no lado direito */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Botão de exclusão (apenas para admin) */}
                        {isAdmin && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemovePlantonista(escala.id, escala.profiles?.full_name || '');
                            }}
                            disabled={operando}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                            title="Remover plantonista"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Ocorrências do Plantonista Selecionado */}
          <AnimatePresence>
            {selectedEscala && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 15 }}
                className="bg-card border border-border/80 shadow-md rounded-xl p-4 space-y-2.5"
              >
                {/* Cabeçalho */}
                <div className="flex items-center justify-between border-b border-border/50 pb-1.5">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold text-foreground">Ocorrências do Plantão</h3>
                    <p className="text-[10px] text-muted-foreground truncate">
                      Plantonista: <strong className="text-foreground/90">{selectedEscala.profiles?.full_name}</strong>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!showOcorrenciaForm && (
                      <button
                        onClick={() => setShowOcorrenciaForm(true)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 text-xs font-semibold transition-colors"
                        type="button"
                      >
                        <Plus className="h-3.5 w-3.5" /> Adicionar
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedEscala(null)}
                      className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted transition-colors shrink-0"
                      type="button"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Exibição Condicional: Grid ou Formulário */}
                {showOcorrenciaForm ? (
                  <form onSubmit={handleSaveOcorrencia} className="space-y-3.5">
                    <div className="relative">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                        Nome do Solicitante
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          value={formNomeSolicitante}
                          onChange={e => {
                            setFormNomeSolicitante(e.target.value);
                            setNomeSelecionado(false);
                          }}
                          onFocus={() => {
                            if (sugestoesNomes.length > 0) {
                              setShowSugestoes(true);
                            }
                          }}
                          onBlur={() => {
                            setTimeout(() => {
                              setShowSugestoes(false);
                            }, 200);
                          }}
                          placeholder="Digite para buscar..."
                          className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary text-foreground pr-9"
                          autoComplete="off"
                        />
                        {loadingSugestoes && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          </div>
                        )}
                      </div>

                      {/* Lista de sugestões flutuante */}
                      <AnimatePresence>
                        {showSugestoes && (
                          <motion.ul
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            className="absolute z-50 w-full mt-1 bg-background dark:bg-zinc-900 border border-border/80 rounded-md shadow-2xl max-h-48 overflow-y-auto divide-y divide-border"
                          >
                            {sugestoesNomes.map((nome, idx) => (
                              <li
                                key={idx}
                                onClick={() => {
                                  setFormNomeSolicitante(nome);
                                  setNomeSelecionado(true);
                                  setShowSugestoes(false);
                                }}
                                className="px-3 py-2 text-sm text-foreground hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors"
                              >
                                {nome}
                              </li>
                            ))}
                          </motion.ul>
                        )}
                      </AnimatePresence>
                    </div>

                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                        Setor Solicitante
                      </label>
                      <div className="relative">
                        <select
                          required
                          value={formSetorSolicitante}
                          onChange={e => setFormSetorSolicitante(e.target.value)}
                          className="w-full bg-background border border-border rounded-md pl-3 pr-9 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary text-foreground cursor-pointer appearance-none"
                        >
                          <option value="" disabled>Selecione um setor...</option>
                          {setores.map(setor => (
                            <option key={setor} value={setor}>
                              {setor}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                        Breve Descrição do Plantão
                      </label>
                      <textarea
                        required
                        rows={3}
                        value={formDescricaoPlantao}
                        onChange={e => setFormDescricaoPlantao(e.target.value)}
                        placeholder="Descrição da ocorrência ou chamado..."
                        className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary text-foreground resize-none"
                      />
                    </div>

                    <div className="flex items-center gap-2 py-1">
                      <input
                        type="checkbox"
                        id="atendimento_presencial"
                        checked={formAtendimentoPresencial}
                        onChange={e => setFormAtendimentoPresencial(e.target.checked)}
                        className="h-4 w-4 rounded border-border text-primary focus:ring-primary bg-background cursor-pointer"
                      />
                      <label htmlFor="atendimento_presencial" className="text-xs font-medium text-foreground cursor-pointer select-none">
                        Houve atendimento presencial
                      </label>
                    </div>

                    <div className="flex gap-2 pt-2.5 border-t border-border mt-2">
                      <button
                        type="submit"
                        disabled={operando}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-all shadow"
                      >
                        {operando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Gravar Informações
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowOcorrenciaForm(false)}
                        className="px-4 py-2 rounded-md border border-border text-foreground text-sm hover:bg-muted transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                ) : (
                  /* Grid de Ocorrências Cadastradas */
                  <div className="space-y-2">
                    {!selectedEscala.ocorrencias || selectedEscala.ocorrencias.length === 0 ? (
                      <div className="py-4 text-center text-muted-foreground space-y-2.5">
                        <FileText className="h-8 w-8 mx-auto opacity-30 text-foreground" />
                        <p className="text-xs">Nenhuma ocorrência registrada para este plantão.</p>
                        <button
                          onClick={() => setShowOcorrenciaForm(true)}
                          className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-95 text-xs font-semibold transition-all shadow-sm"
                          type="button"
                        >
                          <Plus className="h-3.5 w-3.5" /> Registrar Ocorrência
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-2 max-h-[140px] overflow-y-auto pr-0.5 scrollbar-thin">
                        {selectedEscala.ocorrencias.map(ocorrencia => (
                          <div
                            key={ocorrencia.id}
                            onClick={() => setViewingOcorrencia(ocorrencia)}
                            className="p-3 rounded-lg border border-border/70 hover:border-primary/45 bg-muted/10 hover:bg-primary/[0.02] cursor-pointer transition-all flex items-start justify-between gap-2.5 group"
                          >
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex items-center gap-2">
                                <h4 className="text-xs font-bold text-foreground truncate">
                                  {ocorrencia.nome_solicitante}
                                </h4>
                                <span className="text-[10px] text-muted-foreground/80">
                                  ({ocorrencia.setor_solicitante})
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground line-clamp-1">
                                {ocorrencia.descricao_plantao}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0 self-center">
                              {ocorrencia.atendimento_presencial && (
                                <span className="p-1 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400" title="Atendimento presencial">
                                  <MapPin className="h-4 w-4" />
                                </span>
                              )}

                              {isAdmin && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveOcorrencia(ocorrencia.id);
                                  }}
                                  disabled={operando}
                                  className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                                  title="Excluir ocorrência"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Card de Resumo Financeiro do Mês para Plantonistas de TI */}
          <AnimatePresence>
            {canDoPlantao && resumoValoresTodos.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 15 }}
                className="bg-card border border-border/80 shadow-md rounded-xl p-4 space-y-3"
              >
                <div className="flex items-center gap-2.5 border-b border-border/50 pb-1.5">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <Coins className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Ganhos do Mês (Estimado)</h3>
                    <p className="text-[10px] text-muted-foreground">
                      Valores a serem recebidos por cada plantonista.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  {resumoValoresTodos.map(pl => {
                    const estilo = getColaboradorEstilo(pl.nome);
                    return (
                      <div
                        key={pl.id}
                        className={`p-2 rounded-lg border flex flex-col gap-1.5 ${
                          pl.isSelf ? 'ring-1 ring-primary bg-primary/[0.02] border-primary/20' : 'bg-muted/10 border-border/40'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="min-w-0 flex-1 flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full flex-shrink-0 ${estilo.bullet}`} />
                            <span className="text-xs font-bold text-foreground truncate">
                              {pl.nome} {pl.isSelf && "(Você)"}
                            </span>
                          </div>
                          <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 shrink-0 ml-2">
                            R$ {pl.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex flex-col text-[10px] text-muted-foreground pl-4 space-y-0.5 border-t border-border/10 pt-1.5 mt-0.5">
                          <div className="flex justify-between gap-2">
                            <span>Dias Úteis (R$100): <strong>{pl.diasUteisNormais}x</strong></span>
                            {pl.diasUteisReduzidos > 0 && (
                              <span className="text-amber-600 dark:text-amber-400 font-medium">sistema (R$50): <strong>{pl.diasUteisReduzidos}x</strong></span>
                            )}
                          </div>
                          <div className="flex justify-between gap-2">
                            <span>Finais/Feriados (R$200): <strong>{pl.finaisFeriadosNormais}x</strong></span>
                            {pl.finaisFeriadosReduzidos > 0 && (
                              <span className="text-amber-600 dark:text-amber-400 font-medium">sistema (R$100): <strong>{pl.finaisFeriadosReduzidos}x</strong></span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Modal de Adicionar Plantonista ── */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border border-border shadow-2xl rounded-xl w-full max-w-md overflow-hidden"
            >
              <div className="p-5 border-b border-border flex items-center justify-between bg-muted/20">
                <div className="flex items-center gap-2.5">
                  <UserPlus className="h-5 w-5 text-primary" />
                  <h3 className="font-bold text-foreground">Escalar Plantonista</h3>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleAddPlantonista} className="p-5 space-y-4">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                    Data do Plantão
                  </label>
                  <div className="w-full bg-muted/30 border border-border rounded-md px-3 py-2.5 text-sm text-foreground font-medium">
                    {selectedDate.toLocaleDateString('pt-BR', { dateStyle: 'long' })}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                    Colaborador
                  </label>
                  {colaboradoresDisponiveis.length === 0 ? (
                    <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 p-3 rounded-md flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                      <span>Todos os colaboradores já estão escalados para este dia.</span>
                    </div>
                  ) : (
                    <select
                      required
                      value={selectedColaboradorId}
                      onChange={e => setSelectedColaboradorId(e.target.value)}
                      className="w-full bg-background border border-border rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
                    >
                      <option value="">Selecione o colaborador...</option>
                      {colaboradoresDisponiveis.map(colab => (
                        <option key={colab.id} value={colab.id}>
                          {colab.full_name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="flex gap-2 pt-2 border-t border-border mt-5">
                  <button
                    type="submit"
                    disabled={operando || !selectedColaboradorId || colaboradoresDisponiveis.length === 0}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-all shadow"
                  >
                    {operando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Adicionar Escala
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setSelectedColaboradorId('');
                    }}
                    className="px-4 py-2.5 rounded-md border border-border text-foreground text-sm hover:bg-muted transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Modal de Detalhes da Ocorrência ── */}
      <AnimatePresence>
        {viewingOcorrencia && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border border-border shadow-2xl rounded-xl w-full max-w-md overflow-hidden"
            >
              <div className="p-5 border-b border-border flex items-center justify-between bg-muted/20">
                <div className="flex items-center gap-2.5">
                  <FileText className="h-5 w-5 text-primary" />
                  <h3 className="font-bold text-foreground text-sm sm:text-base">Detalhes da Ocorrência</h3>
                </div>
                <button
                  onClick={() => setViewingOcorrencia(null)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Solicitante</h4>
                    <p className="text-sm font-semibold text-foreground mt-0.5">{viewingOcorrencia.nome_solicitante}</p>
                  </div>
                  <div>
                    <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Setor</h4>
                    <p className="text-sm font-semibold text-foreground mt-0.5">{viewingOcorrencia.setor_solicitante}</p>
                  </div>
                </div>

                <div>
                  <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Atendimento</h4>
                  <div className="mt-1">
                    {viewingOcorrencia.atendimento_presencial ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        <MapPin className="h-3 w-3" /> Presencial
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border">
                        Remoto / Telefone
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Descrição do Ocorrido</h4>
                  <div className="mt-1 p-3 rounded-lg bg-muted/40 border border-border/60 text-sm text-foreground leading-relaxed whitespace-pre-wrap max-h-[180px] overflow-y-auto scrollbar-thin">
                    {viewingOcorrencia.descricao_plantao}
                  </div>
                </div>
              </div>

              <div className="p-5 border-t border-border bg-muted/10 flex gap-3">
                {isAdmin && (
                  <button
                    onClick={() => handleRemoveOcorrencia(viewingOcorrencia.id)}
                    disabled={operando}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-all shadow-sm"
                  >
                    {operando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    Excluir Ocorrência
                  </button>
                )}
                <button
                  onClick={() => setViewingOcorrencia(null)}
                  className={`px-4 py-2 rounded-md border border-border text-foreground text-sm hover:bg-muted transition-colors ${isAdmin ? 'w-28' : 'w-full'}`}
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
}
