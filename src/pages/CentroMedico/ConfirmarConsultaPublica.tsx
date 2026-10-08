import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Stethoscope,
  Calendar,
  Clock,
  Building2,
  CheckCircle2,
  ShieldCheck,
  Phone,
  MapPin,
  Sparkles,
  ArrowRight,
  User,
  CreditCard,
  ChevronDown
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { INITIAL_CONSULTAS, ConsultaAgendada } from './consultasData';

const KANBAN_CONFIRMED_KEY = 'hsc_centro_medico_confirmacoes_v1';
const KANBAN_STORAGE_KEY = 'hsc_centro_medico_kanban_manual_status_v1';
const KANBAN_ADDED_ORDER_KEY = 'hsc_centro_medico_kanban_added_order_v1';
const KANBAN_CONSULTAS_CACHE_KEY = 'hsc_centro_medico_consultas_cache_v1';

// Função para buscar lista completa de consultas (cache dinâmico do Centro Médico + mock inicial)
const getAvailableConsultas = (): ConsultaAgendada[] => {
  try {
    const raw = localStorage.getItem(KANBAN_CONSULTAS_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {}
  return INITIAL_CONSULTAS;
};

// Função para formatar data na sequência: dia, mês e ano (DD/MM/AAAA)
const formatDateToBR = (dateStr?: string): string => {
  if (!dateStr) return '';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return dateStr;

  const parts = dateStr.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    const [year, month, day] = parts;
    return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
  }
  return dateStr;
};

export default function ConfirmarConsultaPublica() {
  const [searchParams] = useSearchParams();
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Lista de todas as consultas disponíveis no sistema
  const [consultasList, setConsultasList] = useState<ConsultaAgendada[]>(getAvailableConsultas);

  // ID selecionado (via URL param :id, query param ?id, ou primeiro paciente da lista)
  const initialId = params.id || searchParams.get('id') || consultasList[0]?.id || 'cons-101';
  const [selectedId, setSelectedId] = useState<string>(initialId);

  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  // Sincroniza quando a URL muda
  useEffect(() => {
    if (params.id && params.id !== selectedId) {
      setSelectedId(params.id);
    } else if (searchParams.get('id') && searchParams.get('id') !== selectedId) {
      setSelectedId(searchParams.get('id')!);
    }
  }, [params.id, searchParams]);

  // Recarrega lista se houver atualização em cache
  useEffect(() => {
    const handleStorageUpdate = () => {
      setConsultasList(getAvailableConsultas());
    };
    window.addEventListener('storage', handleStorageUpdate);
    return () => window.removeEventListener('storage', handleStorageUpdate);
  }, []);

  // Agendamento do paciente atual encontrado
  const consultaAtual = useMemo(() => {
    return consultasList.find(c => c.id === selectedId) || consultasList[0];
  }, [consultasList, selectedId]);

  // Monta os dados completos do agendamento do paciente respeitando a fonte de cada paciente
  const patientData = useMemo(() => {
    const c = consultaAtual;
    const rawDate = searchParams.get('data') || c?.data || new Date().toISOString().split('T')[0];
    const formattedDate = formatDateToBR(rawDate);

    return {
      id: c?.id || selectedId,
      paciente: searchParams.get('paciente') || c?.paciente || 'Paciente do Centro Médico',
      prontuario: searchParams.get('prontuario') || c?.prontuario || 'PRONT-00000',
      idade: c?.idade || 0,
      medico: searchParams.get('medico') || c?.medico || 'Médico Plantonista',
      crm: searchParams.get('crm') || c?.crm || 'CRM/MG',
      especialidade: searchParams.get('esp') || c?.especialidade || 'Consulta Especializada',
      horario: searchParams.get('hora') || c?.horario || '11:30',
      data: formattedDate,
      consultorio: searchParams.get('consultorio') || c?.consultorio || 'Centro Médico',
      convenio: searchParams.get('convenio') || c?.convenio || 'Particular / Convênio',
      telefone: '(34) 3249-1500',
      local: searchParams.get('local') || 'Centro Médico Santa Casa',
      endereco: 'Araguari-MG, Praça Dom Almir Marques, n.º 2, Rosário, CEP 38.440-036',
      bairro: 'Rosário'
    };
  }, [consultaAtual, selectedId, searchParams]);

  // Verifica se o paciente atual já está confirmado
  useEffect(() => {
    try {
      const stored = localStorage.getItem(KANBAN_CONFIRMED_KEY);
      if (stored) {
        const map = JSON.parse(stored);
        setConfirmed(Boolean(map[selectedId]?.confirmadoPeloPaciente));
      } else {
        setConfirmed(false);
      }
    } catch {
      setConfirmed(false);
    }
  }, [selectedId]);

  // Handler de Confirmação da Consulta
  const handleConfirmar = async () => {
    setLoading(true);

    try {
      const now = Date.now();
      const timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      // 1. Atualiza no localStorage as confirmações
      let confMap: Record<string, any> = {};
      try {
        const raw = localStorage.getItem(KANBAN_CONFIRMED_KEY);
        if (raw) confMap = JSON.parse(raw);
      } catch {}

      confMap[selectedId] = {
        confirmadoPeloPaciente: true,
        confirmadoEm: timeStr,
        data: new Date().toISOString()
      };
      localStorage.setItem(KANBAN_CONFIRMED_KEY, JSON.stringify(confMap));

      // 2. Move também para a coluna Confirmadas no Kanban
      let statusMap: Record<string, string> = {};
      try {
        const rawStatus = localStorage.getItem(KANBAN_STORAGE_KEY);
        if (rawStatus) statusMap = JSON.parse(rawStatus);
      } catch {}
      statusMap[selectedId] = 'Confirmadas';
      localStorage.setItem(KANBAN_STORAGE_KEY, JSON.stringify(statusMap));

      // 3. Salva a sequência/ordem em que for sendo adicionado (mais recente no topo)
      try {
        let orderMap: Record<string, number> = {};
        const rawOrder = localStorage.getItem(KANBAN_ADDED_ORDER_KEY);
        if (rawOrder) orderMap = JSON.parse(rawOrder);
        orderMap[selectedId] = now;
        localStorage.setItem(KANBAN_ADDED_ORDER_KEY, JSON.stringify(orderMap));
      } catch {}

      // 4. Salva no Supabase se houver tabela
      try {
        await supabase.from('centro_medico_kanban_cards').upsert({
          card_id: selectedId,
          status: 'Confirmadas',
          confirmado_pelo_paciente: true,
          updated_at: new Date(now).toISOString()
        }, { onConflict: 'card_id' });
      } catch {}

      // Dispara evento global para atualizar o Centro Médico em tempo real
      window.dispatchEvent(
        new CustomEvent('consulta_confirmada_evento', {
          detail: { cardId: selectedId, confirmado: true, timestamp: timeStr, addedAt: now }
        })
      );

      setTimeout(() => {
        setConfirmed(true);
        setLoading(false);
      }, 400);

    } catch (err) {
      console.error('Erro ao registrar confirmação:', err);
      setLoading(false);
    }
  };

  // ── SE JÁ ESTÁ CONFIRMADO: RENDERIZA A TELA TOTALMENTE EM VERDE COM OS DADOS DO AGENDAMENTO DESTE PACIENTE ──
  if (confirmed) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-600 via-emerald-700 to-emerald-950 text-white flex flex-col items-center justify-center p-4 selection:bg-white selection:text-emerald-900 relative overflow-hidden">
        {/* Efeitos de Luzes em Verde Esmeralda */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-400/25 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-80 h-80 bg-teal-400/20 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-md w-full space-y-4 relative z-10">

          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 25 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            className="w-full bg-emerald-800/90 border-2 border-emerald-400/60 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-emerald-950/60 backdrop-blur-md text-center space-y-5"
          >
            {/* Ícone de Sucesso Animado */}
            <div className="relative mx-auto w-16 h-16">
              <div className="absolute inset-0 rounded-full bg-emerald-300/40 animate-ping" />
              <div className="relative w-16 h-16 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xl border-2 border-white">
                <CheckCircle2 className="h-9 w-9 text-white" />
              </div>
            </div>

            {/* Título Principal */}
            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white drop-shadow-sm">
                Consulta Confirmada
              </h1>
              <p className="text-xs text-emerald-100 font-medium">
                Presença confirmada com sucesso para este agendamento!
              </p>
            </div>

            {/* Card com os dados do agendamento do paciente */}
            <div className="bg-emerald-900/85 border border-emerald-400/40 rounded-2xl p-5 text-center space-y-3.5 shadow-inner">
              {/* DADOS DO PACIENTE */}
              <div className="space-y-0.5 border-b border-emerald-700/60 pb-3">
                <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-300">
                  Paciente
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide">
                  {patientData.paciente}
                </h2>
              </div>

              {/* MÉDICO E ESPECIALIDADE DO AGENDAMENTO */}
              <div className="space-y-1">
                <div className="text-lg sm:text-xl font-black text-white tracking-wide">
                  {patientData.medico}
                </div>
                <p className="text-xs font-semibold text-emerald-200">
                  {patientData.especialidade} {patientData.crm ? `• ${patientData.crm}` : ''}
                </p>
              </div>

              {/* DATA E HORÁRIO DO AGENDAMENTO */}
              <div className="text-sm font-bold text-emerald-100 flex flex-col sm:flex-row items-center justify-center gap-1.5 bg-emerald-800/80 py-2.5 px-3 rounded-xl border border-emerald-600/50 text-center">
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-emerald-300 shrink-0" />
                  <span>{patientData.data}</span>
                </div>
                <span className="hidden sm:inline text-emerald-300/80">•</span>
                <span className="text-xs text-emerald-200">
                  Por ordem de chegada
                </span>
              </div>

              {/* LOCALIZAÇÃO, TELEFONE E ENDEREÇO */}
              <div className="pt-2 border-t border-emerald-600/60 space-y-1.5 text-xs">
                {/* Local de Atendimento */}
                <p className="font-extrabold text-white text-sm sm:text-base flex items-center justify-center gap-1.5">
                  <Building2 className="h-4 w-4 text-emerald-300 shrink-0" />
                  <span>Centro Médico Santa Casa</span>
                </p>

                {/* Telefone */}
                <p className="font-mono text-emerald-200 font-bold text-xs flex items-center justify-center gap-1.5 pt-0.5">
                  <Phone className="h-3.5 w-3.5 text-emerald-300" />
                  <span>(34) 3249-1500</span>
                </p>

                {/* Endereço */}
                <p className="text-emerald-100 font-medium pt-1 text-center leading-snug px-2">
                  <MapPin className="h-3.5 w-3.5 text-emerald-300 shrink-0 inline-block align-middle mr-1.5 -mt-0.5" />
                  <span className="align-middle">Araguari-MG, Praça Dom Almir Marques, n.º 2, Rosário, CEP 38.440-036</span>
                </p>
              </div>
            </div>

            {/* Instruções Adicionais */}
            <div className="p-3 bg-emerald-900/50 border border-emerald-500/30 rounded-xl text-[11px] text-emerald-100/90 space-y-1">
              <p>• Chegue com 15 minutos de antecedência.</p>
              <p>• Apresente seu documento oficial com foto e carteirinha na recepção.</p>
            </div>



          </motion.div>

          {/* Rodapé Oficial */}
          <div className="text-center text-emerald-200/80 text-xs">
            Hospital Santa Casa de Misericórdia • Centro Médico
          </div>
        </div>
      </div>
    );
  }

  // ── SE AINDA NÃO CONFIRMOU: EXIBE A TELA DE CONFIRMAÇÃO COM OS DADOS DE CADA PACIENTE E O BOTÃO "CONFIRMAR" ──
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 selection:bg-emerald-500 selection:text-white relative overflow-hidden">
      {/* Background Decorativo Glassmorphism */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full space-y-4 relative z-10">
        {/* Header com Identidade da Santa Casa */}
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-inner mb-0.5">
            <Stethoscope className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
            Confirmação de Consulta
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium">
              Centro Médico
            </span>
          </h1>
          <p className="text-xs text-slate-400">
            Validação de presença e horário do agendamento
          </p>
        </div>

        {/* Card Principal de Confirmação com o Botão "Confirmar" */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 shadow-2xl backdrop-blur-md space-y-5"
        >
          {/* Dados do Paciente do Agendamento */}
          <div className="space-y-1 border-b border-slate-800 pb-4">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
              Dados do Paciente
            </span>
            <h2 className="text-xl font-black text-white">
              {patientData.paciente}
            </h2>
          </div>

          {/* Informações da Consulta e Médico */}
          <div className="space-y-3 text-xs">
            <div className="flex items-start gap-2.5">
              <Stethoscope className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
              <div>
                <p className="font-bold text-white text-sm">{patientData.medico}</p>
                <p className="text-slate-400">{patientData.especialidade} {patientData.crm ? `• ${patientData.crm}` : ''}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-emerald-400 shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-400">Data</p>
                  <p className="font-bold text-white text-xs">{patientData.data}</p>
                </div>
              </div>

              <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50 flex items-center gap-2">
                <Clock className="h-4 w-4 text-emerald-400 shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-400">Horário</p>
                  <p className="font-bold text-white text-xs leading-tight">Por ordem de chegada</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <div>
                <p className="text-[10px] text-slate-400">Local de Atendimento</p>
                <p className="font-bold text-white text-xs">Centro Médico Santa Casa</p>
              </div>
            </div>

            <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50 flex items-center gap-2">
              <Phone className="h-4 w-4 text-emerald-400 shrink-0" />
              <div>
                <p className="text-[10px] text-slate-400">Telefone / Contato</p>
                <p className="font-mono text-white text-xs">(34) 3249-1500</p>
              </div>
            </div>

            <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50 flex items-start gap-2.5">
              <MapPin className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] text-slate-400">Endereço</p>
                <p className="text-white text-xs leading-snug">Araguari-MG, Praça Dom Almir Marques, n.º 2, Rosário, CEP 38.440-036</p>
              </div>
            </div>
          </div>

          {/* ── BOTÃO "CONFIRMAR" ── */}
          <div className="pt-2">
            <button
              onClick={handleConfirmar}
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-xl font-bold text-sm bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/40 hover:shadow-emerald-900/60 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <span>Confirmando...</span>
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5" />
                  <span>Confirmar</span>
                </>
              )}
            </button>
          </div>

          <div className="text-[11px] text-slate-400 text-center flex items-center justify-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>Confirmação de Consulta • Hospital Santa Casa</span>
          </div>
        </motion.div>

        {/* Rodapé */}
        <div className="text-center text-slate-500 text-xs">
          Hospital Santa Casa de Misericórdia • Centro Médico
        </div>
      </div>
    </div>
  );
}
