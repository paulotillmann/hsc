import React, { useState, useEffect } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
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
  User
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { INITIAL_CONSULTAS } from './consultasData';

const KANBAN_CONFIRMED_KEY = 'hsc_centro_medico_confirmacoes_v1';
const KANBAN_STORAGE_KEY = 'hsc_centro_medico_kanban_manual_status_v1';
const KANBAN_ADDED_ORDER_KEY = 'hsc_centro_medico_kanban_added_order_v1';

export default function ConfirmarConsultaPublica() {
  const [searchParams] = useSearchParams();
  const params = useParams<{ id: string }>();
  const cardId = params.id || searchParams.get('id') || 'cons-101';

  // Busca dados na base caso não venha tudo via querystring
  const consultaEncontrada = INITIAL_CONSULTAS.find(c => c.id === cardId);

  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  // Formatação dos dados com suporte a parâmetros, busca por ID ou valores padrão solicitados
  const [patientData] = useState<any>({
    id: cardId,
    paciente: searchParams.get('paciente') || consultaEncontrada?.paciente || 'Paciente do Centro Médico',
    medico: searchParams.get('medico') || consultaEncontrada?.medico || 'Dr. Diogo Martins de Deus',
    crm: searchParams.get('crm') || consultaEncontrada?.crm || 'CRM/MG',
    especialidade: searchParams.get('esp') || consultaEncontrada?.especialidade || 'Consulta Médica Especializada',
    horario: searchParams.get('hora') || consultaEncontrada?.horario || '11:30',
    data: searchParams.get('data') || consultaEncontrada?.data || 'Segunda, 10/08/2026',
    convenio: searchParams.get('convenio') || consultaEncontrada?.convenio || 'Particular / Convênio',
    local: searchParams.get('local') || 'Humani - Medicina e Cuidado',
    telefone: searchParams.get('tel') || '(34) 3513-2213',
    endereco: searchParams.get('end') || 'Rua Joaquim Aníbal, 204',
    bairro: searchParams.get('bairro') || 'Centro'
  });

  useEffect(() => {
    // Verifica se já está confirmado no localStorage
    try {
      const stored = localStorage.getItem(KANBAN_CONFIRMED_KEY);
      if (stored) {
        const map = JSON.parse(stored);
        if (map[cardId]?.confirmadoPeloPaciente) {
          setConfirmed(true);
        }
      }
    } catch {
      // Ignora erro de leitura local
    }
  }, [cardId]);

  const handleConfirmar = async () => {
    setLoading(true);

    try {
      // 1. Atualiza no localStorage as confirmações
      let confMap: Record<string, any> = {};
      try {
        const raw = localStorage.getItem(KANBAN_CONFIRMED_KEY);
        if (raw) confMap = JSON.parse(raw);
      } catch {}

      const timestamp = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      confMap[cardId] = {
        confirmadoPeloPaciente: true,
        confirmadoEm: timestamp,
        data: new Date().toISOString()
      };
      localStorage.setItem(KANBAN_CONFIRMED_KEY, JSON.stringify(confMap));

      // 2. Move também para a coluna Confirmadas no Kanban
      let statusMap: Record<string, string> = {};
      try {
        const rawStatus = localStorage.getItem(KANBAN_STORAGE_KEY);
        if (rawStatus) statusMap = JSON.parse(rawStatus);
      } catch {}
      statusMap[cardId] = 'Confirmadas';
      localStorage.setItem(KANBAN_STORAGE_KEY, JSON.stringify(statusMap));

      // 3. Salva a sequência/ordem em que for sendo adicionado
      const now = Date.now();
      try {
        let orderMap: Record<string, number> = {};
        const rawOrder = localStorage.getItem(KANBAN_ADDED_ORDER_KEY);
        if (rawOrder) orderMap = JSON.parse(rawOrder);
        orderMap[cardId] = now;
        localStorage.setItem(KANBAN_ADDED_ORDER_KEY, JSON.stringify(orderMap));
      } catch {}

      // 4. Salva no Supabase se houver tabela
      try {
        await supabase.from('centro_medico_kanban_cards').upsert({
          card_id: cardId,
          status: 'Confirmadas',
          confirmado_pelo_paciente: true,
          updated_at: new Date(now).toISOString()
        }, { onConflict: 'card_id' });
      } catch {}

      // Dispara evento global para atualizar o Centro Médico em tempo real se estiver aberto
      window.dispatchEvent(
        new CustomEvent('consulta_confirmada_evento', {
          detail: { cardId, confirmado: true, timestamp, addedAt: now }
        })
      );

      setTimeout(() => {
        setConfirmed(true);
        setLoading(false);
      }, 500);

    } catch (err) {
      console.error('Erro ao registrar confirmação:', err);
      setLoading(false);
    }
  };

  // ── SE JÁ ESTÁ CONFIRMADO: RENDERIZA A TELA TOTALMENTE EM VERDE COM A MENSAGEM SOLICITADA ──
  if (confirmed) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-600 via-emerald-700 to-emerald-950 text-white flex flex-col items-center justify-center p-4 selection:bg-white selection:text-emerald-900 relative overflow-hidden">
        {/* Efeitos de Luzes em Verde Esmeralda */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-400/25 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-80 h-80 bg-teal-400/20 rounded-full blur-3xl pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 25 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="max-w-md w-full bg-emerald-800/90 border-2 border-emerald-400/60 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-emerald-950/60 backdrop-blur-md text-center space-y-6 relative z-10"
        >
          {/* Ícone de Sucesso Animado */}
          <div className="relative mx-auto w-20 h-20">
            <div className="absolute inset-0 rounded-full bg-emerald-300/40 animate-ping" />
            <div className="relative w-20 h-20 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xl border-2 border-white">
              <CheckCircle2 className="h-10 w-10 text-white" />
            </div>
          </div>

          {/* Título Principal Exato */}
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white drop-shadow-sm">
              Consulta Confirmada
            </h1>
            <p className="text-xs text-emerald-100 font-medium">
              Sua consulta foi confirmada com sucesso!
            </p>
          </div>

          {/* Card com as informações exatas solicitadas */}
          <div className="bg-emerald-900/85 border border-emerald-400/40 rounded-2xl p-5 text-center space-y-3.5 shadow-inner">
            {/* Nome do Médico */}
            <div className="text-lg sm:text-xl font-black text-white tracking-wide">
              {patientData.medico}
            </div>

            {/* Data e Horário */}
            <div className="text-sm font-bold text-emerald-100 flex items-center justify-center gap-2">
              <Calendar className="h-4 w-4 text-emerald-300" />
              <span>
                {patientData.data} às {patientData.horario}
              </span>
            </div>

            {/* Linha Divisória */}
            <div className="pt-3 border-t border-emerald-600/60 space-y-1.5 text-xs">
              {/* Clínica / Local */}
              <p className="font-extrabold text-white text-sm sm:text-base flex items-center justify-center gap-1.5">
                <Building2 className="h-4 w-4 text-emerald-300 shrink-0" />
                <span>{patientData.local}</span>
              </p>

              {/* Telefone */}
              <p className="font-mono text-emerald-200 font-bold text-xs flex items-center justify-center gap-1.5 pt-0.5">
                <Phone className="h-3.5 w-3.5 text-emerald-300" />
                <span>{patientData.telefone}</span>
              </p>

              {/* Endereço */}
              <p className="text-emerald-100 font-medium pt-0.5 flex items-center justify-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-emerald-300 shrink-0" />
                <span>{patientData.endereco}</span>
              </p>

              {/* Bairro */}
              <p className="text-emerald-300 font-black uppercase tracking-widest text-[11px]">
                {patientData.bairro}
              </p>
            </div>
          </div>

          {/* Instruções Adicionais */}
          <div className="p-3 bg-emerald-900/50 border border-emerald-500/30 rounded-xl text-[11px] text-emerald-100/90 space-y-1">
            <p>• Chegue com 15 minutos de antecedência.</p>
            <p>• Apresente seu documento oficial com foto na recepção.</p>
          </div>

          {/* Selo de Confirmação no Centro Médico */}
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-emerald-200 font-semibold">
            <span className="h-2 w-2 rounded-full bg-emerald-300 animate-pulse" />
            <span>O agendamento já está verde na tela Centro Médico</span>
          </div>

          {/* Opção para voltar/desfazer se necessário */}
          <div className="pt-1">
            <button
              onClick={() => setConfirmed(false)}
              className="text-xs text-emerald-200 hover:text-white underline transition-colors cursor-pointer"
            >
              Visualizar dados do agendamento
            </button>
          </div>
        </motion.div>

        {/* Rodapé Oficial */}
        <div className="mt-6 text-center text-emerald-200/80 text-xs">
          Hospital Santa Casa de Misericórdia • Confirmação de Consulta
        </div>
      </div>
    );
  }

  // ── SE AINDA NÃO CONFIRMOU: EXIBE A TELA DE CONFIRMAÇÃO COM O BOTÃO "CONFIRMAR" ──
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 selection:bg-emerald-500 selection:text-white relative overflow-hidden">
      {/* Background Decorativo Glassmorphism */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full space-y-6 relative z-10">
        {/* Header com Identidade da Santa Casa */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-inner mb-1">
            <Stethoscope className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
            Confirmação de Consulta
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium">
              Santa Casa
            </span>
          </h1>
          <p className="text-xs text-slate-400">
            Validação de presença e horário de atendimento
          </p>
        </div>

        {/* Card Principal de Confirmação com o Botão "Confirmar" */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 shadow-2xl backdrop-blur-md space-y-5"
        >
          {/* Dados do Paciente */}
          <div className="space-y-1 border-b border-slate-800 pb-4">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
              Dados do Paciente
            </span>
            <h2 className="text-lg font-bold text-white">
              {patientData.paciente}
            </h2>
            <p className="text-xs text-slate-400">
              Convênio: <span className="text-slate-200 font-medium">{patientData.convenio}</span>
            </p>
          </div>

          {/* Informações da Consulta */}
          <div className="space-y-3 text-xs">
            <div className="flex items-start gap-2.5">
              <Stethoscope className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-white">{patientData.medico}</p>
                <p className="text-slate-400">{patientData.especialidade} • {patientData.crm}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
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
                  <p className="font-bold text-white text-xs">{patientData.horario}</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <div>
                <p className="text-[10px] text-slate-400">Local de Atendimento</p>
                <p className="font-bold text-white text-xs">{patientData.local}</p>
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
