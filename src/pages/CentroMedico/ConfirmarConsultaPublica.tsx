import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import {
  Stethoscope,
  Calendar,
  Clock,
  Building2,
  CheckCircle2,
  ShieldCheck,
  Phone,
  MapPin,
  AlertCircle,
  CalendarClock,
  XCircle,
  RotateCcw
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

const KANBAN_CONFIRMED_KEY = 'hsc_centro_medico_confirmacoes_v1';
const KANBAN_STORAGE_KEY = 'hsc_centro_medico_kanban_manual_status_v1';
const KANBAN_ADDED_ORDER_KEY = 'hsc_centro_medico_kanban_added_order_v1';

type PublicActionState = 'pendente' | 'confirmada' | 'remarcar' | 'cancelada';

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

  // ID seguro da consulta obtido estritamente via rota (:id) ou query string (?id=)
  const targetId = params.id || searchParams.get('id') || '';
  const [selectedId, setSelectedId] = useState<string>(targetId);

  const [loadingAction, setLoadingAction] = useState<'Confirmadas' | 'Remarcar' | 'Canceladas' | null>(null);
  const [loadingDetails, setLoadingDetails] = useState<boolean>(Boolean(targetId));
  const [notFound, setNotFound] = useState<boolean>(!targetId);
  const [actionState, setActionState] = useState<PublicActionState>('pendente');
  const [remoteDetails, setRemoteDetails] = useState<any>(null);

  // Sincroniza se o parâmetro de rota ou query string mudar
  useEffect(() => {
    const nextId = params.id || searchParams.get('id') || '';
    if (nextId !== selectedId) {
      setSelectedId(nextId);
      if (!nextId) {
        setNotFound(true);
        setLoadingDetails(false);
      } else {
        setLoadingDetails(true);
      }
    }
  }, [params.id, searchParams]);

  // Consulta via RPC Segura no Supabase para obter status e detalhes validados (LGPD & Anti-tampering)
  useEffect(() => {
    let isMounted = true;

    if (!selectedId) {
      setNotFound(true);
      setLoadingDetails(false);
      return;
    }

    // 1. Checa no localStorage local se já houve ação anteriormente neste navegador
    try {
      const storedStatusRaw = localStorage.getItem(KANBAN_STORAGE_KEY);
      if (storedStatusRaw) {
        const statusMap = JSON.parse(storedStatusRaw);
        if (statusMap[selectedId] === 'Remarcar') {
          setActionState('remarcar');
        } else if (statusMap[selectedId] === 'Canceladas') {
          setActionState('cancelada');
        } else if (statusMap[selectedId] === 'Confirmadas') {
          setActionState('confirmada');
        }
      }

      const storedConfRaw = localStorage.getItem(KANBAN_CONFIRMED_KEY);
      if (storedConfRaw) {
        const confMap = JSON.parse(storedConfRaw);
        if (confMap[selectedId]?.confirmadoPeloPaciente) {
          setActionState('confirmada');
        }
      }
    } catch { }

    // 2. Consulta via RPC Segura no Supabase (recupera dados estritamente do paciente do card_id)
    const checkRemoteDetails = async () => {
      try {
        setLoadingDetails(true);
        const { data, error } = await supabase.rpc('obter_detalhes_consulta_publica', { p_card_id: selectedId });

        if (!isMounted) return;

        if (!error && data && (data as any).encontrado) {
          const rec = data as any;
          setRemoteDetails(rec);
          setNotFound(false);

          if (rec.status === 'Remarcar') {
            setActionState('remarcar');
          } else if (rec.status === 'Canceladas') {
            setActionState('cancelada');
          } else if (rec.confirmado_pelo_paciente || rec.status === 'Confirmadas') {
            setActionState('confirmada');
          }
        } else {
          // Se não encontrou na RPC, checa se há parâmetros de contingência na URL (ex: paciente)
          const pacienteParam = searchParams.get('paciente');
          if (pacienteParam) {
            setNotFound(false);
          } else {
            setNotFound(true);
          }
        }
      } catch (err) {
        console.warn('[ConfirmarConsulta] Falha ao verificar detalhes remotos:', err);
        if (isMounted) {
          const pacienteParam = searchParams.get('paciente');
          setNotFound(!pacienteParam);
        }
      } finally {
        if (isMounted) {
          setLoadingDetails(false);
        }
      }
    };

    checkRemoteDetails();

    return () => {
      isMounted = false;
    };
  }, [selectedId, searchParams]);

  // Monta os dados completos do agendamento priorizando a RPC do Supabase e impedindo vazamento de terceiros
  const patientData = useMemo(() => {
    // 1. Snapshot oficial sanitizado retornado da RPC Segura do banco de dados
    if (remoteDetails) {
      return {
        id: remoteDetails.card_id || selectedId,
        paciente: remoteDetails.paciente || 'Paciente do Centro Médico',
        prontuario: 'Agendamento Centro Médico',
        idade: 0,
        medico: remoteDetails.medico || 'Médico Plantonista',
        crm: remoteDetails.crm || 'CRM/MG',
        especialidade: remoteDetails.especialidade || 'Consulta Especializada',
        horario: remoteDetails.horario || 'Por ordem de chegada',
        data: formatDateToBR(remoteDetails.data_consulta),
        consultorio: remoteDetails.consultorio || 'Centro Médico Santa Casa',
        convenio: remoteDetails.convenio || 'Particular / Convênio',
        telefone: '(34) 3249-1500',
        local: 'Centro Médico Santa Casa',
        endereco: 'Araguari-MG, Praça Dom Almir Marques, n.º 2, Rosário, CEP 38.440-036',
        bairro: 'Rosário'
      };
    }

    // 2. Fallback de contingência apenas se os parâmetros explícitos deste agendamento existirem na URL
    const pacienteParam = searchParams.get('paciente');
    if (pacienteParam && selectedId) {
      const rawDate = searchParams.get('data') || new Date().toISOString().split('T')[0];
      return {
        id: selectedId,
        paciente: pacienteParam,
        prontuario: 'Agendamento Centro Médico',
        idade: 0,
        medico: searchParams.get('medico') || 'Médico Plantonista',
        crm: searchParams.get('crm') || 'CRM/MG',
        especialidade: searchParams.get('esp') || 'Consulta Especializada',
        horario: searchParams.get('hora') || 'Por ordem de chegada',
        data: formatDateToBR(rawDate),
        consultorio: searchParams.get('consultorio') || 'Centro Médico Santa Casa',
        convenio: searchParams.get('convenio') || 'Particular / Convênio',
        telefone: '(34) 3249-1500',
        local: searchParams.get('local') || 'Centro Médico Santa Casa',
        endereco: 'Araguari-MG, Praça Dom Almir Marques, n.º 2, Rosário, CEP 38.440-036',
        bairro: 'Rosário'
      };
    }

    return null;
  }, [remoteDetails, selectedId, searchParams]);

  // Handler unificado para Confirmar, Remarcar ou Cancelar a Consulta
  const handleUpdateStatus = async (targetStatus: 'Confirmadas' | 'Remarcar' | 'Canceladas') => {
    if (!selectedId || !patientData) return;
    setLoadingAction(targetStatus);

    try {
      const now = Date.now();
      const timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const isConfirmed = targetStatus === 'Confirmadas';

      // 1. Atualiza no localStorage as confirmações deste navegador
      let confMap: Record<string, any> = {};
      try {
        const raw = localStorage.getItem(KANBAN_CONFIRMED_KEY);
        if (raw) confMap = JSON.parse(raw);
      } catch { }

      if (isConfirmed) {
        confMap[selectedId] = {
          confirmadoPeloPaciente: true,
          confirmadoEm: timeStr,
          data: new Date().toISOString()
        };
      } else {
        delete confMap[selectedId];
      }
      localStorage.setItem(KANBAN_CONFIRMED_KEY, JSON.stringify(confMap));

      // 2. Move para a coluna correspondente no Kanban (Confirmadas, Remarcar ou Canceladas)
      let statusMap: Record<string, string> = {};
      try {
        const rawStatus = localStorage.getItem(KANBAN_STORAGE_KEY);
        if (rawStatus) statusMap = JSON.parse(rawStatus);
      } catch { }
      statusMap[selectedId] = targetStatus;
      localStorage.setItem(KANBAN_STORAGE_KEY, JSON.stringify(statusMap));

      // 3. Salva a sequência/ordem de atualização
      try {
        let orderMap: Record<string, number> = {};
        const rawOrder = localStorage.getItem(KANBAN_ADDED_ORDER_KEY);
        if (rawOrder) orderMap = JSON.parse(rawOrder);
        orderMap[selectedId] = now;
        localStorage.setItem(KANBAN_ADDED_ORDER_KEY, JSON.stringify(orderMap));
      } catch { }

      // 4. Atualiza no Supabase via Edge Function com Service Role (suporta Confirmadas, Remarcar e Canceladas)
      try {
        await supabase.functions.invoke('whatsapp-agendamento-enviado', {
          body: {
            action: 'atualizar_status_publico',
            cardId: selectedId,
            status: targetStatus,
            paciente: patientData.paciente,
            data_consulta: patientData.data,
            medico: patientData.medico,
            especialidade: patientData.especialidade,
            horario: patientData.horario
          }
        });
      } catch (fnErr) {
        console.warn('[ConfirmarConsulta] Falha ao invocar Edge Function de status público:', fnErr);
      }

      // 5. Se for confirmação, também chama a RPC dedicada por redundância
      if (isConfirmed) {
        try {
          await supabase.rpc('confirmar_presenca_paciente', {
            p_card_id: selectedId,
            p_paciente: patientData.paciente,
            p_data_consulta: patientData.data,
            p_medico: patientData.medico,
            p_especialidade: patientData.especialidade,
            p_horario: patientData.horario
          });
        } catch (rpcErr) {
          console.warn('[ConfirmarConsulta] Falha ao executar RPC de confirmação:', rpcErr);
        }
      }

      // Dispara evento global para sincronizar caso outra aba esteja aberta no mesmo navegador
      window.dispatchEvent(
        new CustomEvent('consulta_confirmada_evento', {
          detail: {
            cardId: selectedId,
            confirmado: isConfirmed,
            status: targetStatus,
            timestamp: timeStr,
            addedAt: now
          }
        })
      );

      setTimeout(() => {
        if (targetStatus === 'Confirmadas') setActionState('confirmada');
        else if (targetStatus === 'Remarcar') setActionState('remarcar');
        else if (targetStatus === 'Canceladas') setActionState('cancelada');
        setLoadingAction(null);
      }, 300);
    } catch (err) {
      console.error('Erro ao atualizar status da consulta:', err);
      setLoadingAction(null);
    }
  };

  // ── ESTADO 1: CARREGANDO DETALHES ──
  if (loadingDetails) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-md w-full text-center space-y-4 relative z-10">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-inner animate-pulse">
            <Stethoscope className="h-8 w-8 animate-spin" style={{ animationDuration: '3s' }} />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-white tracking-tight">Verificando Agendamento</h2>
            <p className="text-xs text-slate-400">Consultando os dados do Centro Médico...</p>
          </div>
        </div>
      </div>
    );
  }

  // ── ESTADO 2: AGENDAMENTO NÃO LOCALIZADO OU SEM ID (LGPD & Anti-vazamento) ──
  if (notFound || !patientData) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 relative overflow-hidden selection:bg-rose-500 selection:text-white">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-md w-full space-y-4 relative z-10">
          <div className="text-center space-y-1.5">
            <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 shadow-inner mb-0.5">
              <AlertCircle className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Agendamento Não Localizado
            </h1>
            <p className="text-xs text-slate-400">
              Não identificamos uma consulta válida com o link acessado.
            </p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 shadow-2xl backdrop-blur-md space-y-4 text-center">
            <p className="text-xs text-slate-300 leading-relaxed">
              Por favor, certifique-se de clicar no <strong>link completo</strong> enviado diretamente pela equipe da Santa Casa via WhatsApp.
            </p>

            <div className="p-3.5 bg-slate-800/60 border border-slate-700/50 rounded-xl space-y-2 text-xs text-slate-300">
              <div className="flex items-center justify-center gap-2 text-white font-bold">
                <Building2 className="h-4 w-4 text-emerald-400" />
                <span>Centro Médico Santa Casa</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-emerald-300 font-mono font-semibold">
                <Phone className="h-3.5 w-3.5" />
                <span>(34) 3249-1500</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Praça Dom Almir Marques, n.º 2, Rosário — Araguari/MG
              </p>
            </div>
          </div>

          <div className="text-center text-slate-500 text-xs">
            Hospital Santa Casa de Misericórdia • Centro Médico
          </div>
        </div>
      </div>
    );
  }

  // ── ESTADO 3A: CONSULTA CONFIRMADA (VERDE ESMERALDA) ──
  if (actionState === 'confirmada') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-600 via-emerald-700 to-emerald-950 text-white flex flex-col items-center justify-center p-4 selection:bg-white selection:text-emerald-900 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-400/25 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-80 h-80 bg-teal-400/20 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-md w-full space-y-4 relative z-10">
          <div className="w-full bg-emerald-800/90 border-2 border-emerald-400/60 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-emerald-950/60 backdrop-blur-md text-center space-y-5 transition-all">
            <div className="relative mx-auto w-16 h-16">
              <div className="absolute inset-0 rounded-full bg-emerald-300/40 animate-ping" />
              <div className="relative w-16 h-16 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xl border-2 border-white">
                <CheckCircle2 className="h-9 w-9 text-white" />
              </div>
            </div>

            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white drop-shadow-sm">
                Consulta Confirmada
              </h1>
              <p className="text-xs text-emerald-100 font-medium">
                Presença confirmada com sucesso para este agendamento!
              </p>
            </div>

            <div className="bg-emerald-900/85 border border-emerald-400/40 rounded-2xl p-5 text-center space-y-3.5 shadow-inner">
              <div className="space-y-0.5 border-b border-emerald-700/60 pb-3">
                <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-300">
                  Paciente
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide">
                  {patientData.paciente}
                </h2>
              </div>

              <div className="space-y-1">
                <div className="text-lg sm:text-xl font-black text-white tracking-wide">
                  {patientData.medico}
                </div>
                <p className="text-xs font-semibold text-emerald-200">
                  {patientData.especialidade} {patientData.crm ? `• ${patientData.crm}` : ''}
                </p>
              </div>

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

              <div className="pt-2 border-t border-emerald-600/60 space-y-1.5 text-xs">
                <p className="font-extrabold text-white text-sm sm:text-base flex items-center justify-center gap-1.5">
                  <Building2 className="h-4 w-4 text-emerald-300 shrink-0" />
                  <span>Centro Médico Santa Casa</span>
                </p>
                <p className="font-mono text-emerald-200 font-bold text-xs flex items-center justify-center gap-1.5 pt-0.5">
                  <Phone className="h-3.5 w-3.5 text-emerald-300" />
                  <span>(34) 3249-1500</span>
                </p>
                <p className="text-emerald-100 font-medium pt-1 text-center leading-snug px-2">
                  <MapPin className="h-3.5 w-3.5 text-emerald-300 shrink-0 inline-block align-middle mr-1.5 -mt-0.5" />
                  <span className="align-middle">Araguari-MG, Praça Dom Almir Marques, n.º 2, Rosário, CEP 38.440-036</span>
                </p>
              </div>
            </div>

            <div className="p-3 bg-emerald-900/50 border border-emerald-500/30 rounded-xl text-[11px] text-emerald-100/90 space-y-1">
              <p>• Chegue com 15 minutos de antecedência.</p>
              <p>• Apresente seu documento oficial com foto e carteirinha na recepção.</p>
            </div>

            <button
              type="button"
              onClick={() => setActionState('pendente')}
              className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-200 hover:text-white underline underline-offset-4 transition-colors cursor-pointer pt-1"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Alterar minha resposta</span>
            </button>
          </div>

          <div className="text-center text-emerald-200/80 text-xs">
            Hospital Santa Casa de Misericórdia • Centro Médico
          </div>
        </div>
      </div>
    );
  }

  // ── ESTADO 3B: SOLICITAÇÃO DE REMARCAÇÃO (ÂMBAR / LARANJA) ──
  if (actionState === 'remarcar') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-600 via-amber-700 to-slate-950 text-white flex flex-col items-center justify-center p-4 selection:bg-white selection:text-amber-900 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-amber-400/20 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-md w-full space-y-4 relative z-10">
          <div className="w-full bg-amber-900/90 border-2 border-amber-400/60 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-amber-950/60 backdrop-blur-md text-center space-y-5 transition-all">
            <div className="relative mx-auto w-16 h-16">
              <div className="relative w-16 h-16 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-xl border-2 border-white">
                <CalendarClock className="h-9 w-9 text-white" />
              </div>
            </div>

            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white drop-shadow-sm">
                Remarcação Solicitada
              </h1>
              <p className="text-xs text-amber-100 font-medium leading-relaxed">
                Recebemos seu pedido para remarcar a consulta. Nossa equipe do Centro Médico entrará em contato para agendar uma nova data!
              </p>
            </div>

            <div className="bg-amber-950/80 border border-amber-400/40 rounded-2xl p-5 text-center space-y-3.5 shadow-inner">
              <div className="space-y-0.5 border-b border-amber-700/60 pb-3">
                <span className="text-[10px] uppercase font-bold tracking-widest text-amber-300">
                  Paciente
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide">
                  {patientData.paciente}
                </h2>
              </div>

              <div className="space-y-1">
                <div className="text-lg sm:text-xl font-black text-white tracking-wide">
                  {patientData.medico}
                </div>
                <p className="text-xs font-semibold text-amber-200">
                  {patientData.especialidade} {patientData.crm ? `• ${patientData.crm}` : ''}
                </p>
              </div>

              <div className="text-sm font-bold text-amber-100 flex flex-col sm:flex-row items-center justify-center gap-1.5 bg-amber-900/70 py-2.5 px-3 rounded-xl border border-amber-600/50 text-center">
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-amber-300 shrink-0" />
                  <span>Data original: {patientData.data}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-amber-700/60 space-y-1.5 text-xs">
                <p className="font-extrabold text-white text-sm flex items-center justify-center gap-1.5">
                  <Building2 className="h-4 w-4 text-amber-300 shrink-0" />
                  <span>Centro Médico Santa Casa</span>
                </p>
                <p className="font-mono text-amber-200 font-bold text-xs flex items-center justify-center gap-1.5 pt-0.5">
                  <Phone className="h-3.5 w-3.5 text-amber-300" />
                  <span>(34) 3249-1500</span>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActionState('pendente')}
              className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-amber-200 hover:text-white underline underline-offset-4 transition-colors cursor-pointer pt-1"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Alterar minha resposta</span>
            </button>
          </div>

          <div className="text-center text-amber-200/80 text-xs">
            Hospital Santa Casa de Misericórdia • Centro Médico
          </div>
        </div>
      </div>
    );
  }

  // ── ESTADO 3C: CONSULTA CANCELADA (VERMELHO / ROSE) ──
  if (actionState === 'cancelada') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-rose-700 via-rose-800 to-slate-950 text-white flex flex-col items-center justify-center p-4 selection:bg-white selection:text-rose-900 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-rose-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-md w-full space-y-4 relative z-10">
          <div className="w-full bg-rose-900/90 border-2 border-rose-400/60 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-rose-950/60 backdrop-blur-md text-center space-y-5 transition-all">
            <div className="relative mx-auto w-16 h-16">
              <div className="relative w-16 h-16 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-xl border-2 border-white">
                <XCircle className="h-9 w-9 text-white" />
              </div>
            </div>

            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white drop-shadow-sm">
                Consulta Cancelada
              </h1>
              <p className="text-xs text-rose-100 font-medium leading-relaxed">
                Sua solicitação de cancelamento foi registrada no Centro Médico Santa Casa.
              </p>
            </div>

            <div className="bg-rose-950/80 border border-rose-400/40 rounded-2xl p-5 text-center space-y-3.5 shadow-inner">
              <div className="space-y-0.5 border-b border-rose-700/60 pb-3">
                <span className="text-[10px] uppercase font-bold tracking-widest text-rose-300">
                  Paciente
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide">
                  {patientData.paciente}
                </h2>
              </div>

              <div className="space-y-1">
                <div className="text-lg sm:text-xl font-black text-white tracking-wide">
                  {patientData.medico}
                </div>
                <p className="text-xs font-semibold text-rose-200">
                  {patientData.especialidade} {patientData.crm ? `• ${patientData.crm}` : ''}
                </p>
              </div>

              <div className="text-sm font-bold text-rose-100 flex flex-col sm:flex-row items-center justify-center gap-1.5 bg-rose-900/70 py-2.5 px-3 rounded-xl border border-rose-600/50 text-center">
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-rose-300 shrink-0" />
                  <span>Data: {patientData.data}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-rose-700/60 space-y-1.5 text-xs">
                <p className="font-extrabold text-white text-sm flex items-center justify-center gap-1.5">
                  <Building2 className="h-4 w-4 text-rose-300 shrink-0" />
                  <span>Centro Médico Santa Casa</span>
                </p>
                <p className="font-mono text-rose-200 font-bold text-xs flex items-center justify-center gap-1.5 pt-0.5">
                  <Phone className="h-3.5 w-3.5 text-rose-300" />
                  <span>(34) 3249-1500</span>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActionState('pendente')}
              className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-rose-200 hover:text-white underline underline-offset-4 transition-colors cursor-pointer pt-1"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Alterar minha resposta</span>
            </button>
          </div>

          <div className="text-center text-rose-200/80 text-xs">
            Hospital Santa Casa de Misericórdia • Centro Médico
          </div>
        </div>
      </div>
    );
  }

  // ── ESTADO 4: TELA INICIAL DE RESPOSTA DO PACIENTE (CONFIRMAR, REMARCAR OU CANCELAR) ──
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
            Confirme sua presença, solicite remarcação ou cancele o agendamento
          </p>
        </div>

        {/* Card Principal de Confirmação com as 3 Opções */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 shadow-2xl backdrop-blur-md space-y-5">
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

          {/* ── BOTÕES DE AÇÃO: CONFIRMAR, REMARCAR E CANCELAR ── */}
          <div className="pt-2 space-y-2.5">
            {/* Botão Principal: Confirmar */}
            <button
              type="button"
              onClick={() => handleUpdateStatus('Confirmadas')}
              disabled={loadingAction !== null}
              className="w-full py-3.5 px-4 rounded-xl font-bold text-sm bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/40 hover:shadow-emerald-900/60 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              {loadingAction === 'Confirmadas' ? (
                <span>Confirmando...</span>
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5" />
                  <span>Confirmar Presença</span>
                </>
              )}
            </button>

            {/* Opções Secundárias: Remarcar e Cancelar */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => handleUpdateStatus('Remarcar')}
                disabled={loadingAction !== null}
                className="w-full py-3 px-3 rounded-xl font-bold text-xs sm:text-sm bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 hover:border-amber-400 flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
              >
                {loadingAction === 'Remarcar' ? (
                  <span>Enviando...</span>
                ) : (
                  <>
                    <CalendarClock className="h-4 w-4 text-amber-400 shrink-0" />
                    <span>Remarcar</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleUpdateStatus('Canceladas')}
                disabled={loadingAction !== null}
                className="w-full py-3 px-3 rounded-xl font-bold text-xs sm:text-sm bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/40 hover:border-rose-400 flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
              >
                {loadingAction === 'Canceladas' ? (
                  <span>Cancelando...</span>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 text-rose-400 shrink-0" />
                    <span>Cancelar</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 text-center flex items-center justify-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>Confirmação de Consulta • Hospital Santa Casa</span>
          </div>
        </div>

        {/* Rodapé */}
        <div className="text-center text-slate-500 text-xs">
          Hospital Santa Casa de Misericórdia • Centro Médico
        </div>
      </div>
    </div>
  );
}
