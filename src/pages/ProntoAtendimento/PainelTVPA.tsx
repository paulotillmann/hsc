import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Users,
  Hourglass,
  HeartPulse,
  Clock,
  Activity,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Tv,
  Sun,
  Moon
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { fetchPATvSettings, DEFAULT_PA_TV_SETTINGS } from '../../services/paTvService';

interface PacientePA {
  id: string;
  nr_atendimento: number;
  nm_paciente: string;
  dt_entrada: string | null;
  dt_alta: string | null;
  ds_clinica: string | null;
  hr_inicio_consulta: string | null;
  dt_lib_medico: string | null;
  ie_status: string | null;
  status: string | null;
  ds_triagem: string | null;
  ie_internado: string | null;
  created_at: string;
  updated_at: string;
}

const parseLocalDate = (dateStr: string | null | undefined): Date | null => {
  if (!dateStr) return null;
  try {
    const cleanStr = dateStr.replace(/Z$/, '').replace(/[+-]\d{2}:\d{2}$/, '');
    const d = new Date(cleanStr);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
};

const getYoutubeVideoId = (url: string) => {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

const SYNC_INTERVAL_MS = 3 * 60 * 1000; // 3 minutos

export default function PainelTVPA() {
  const [pacientes, setPacientes] = useState<PacientePA[]>([]);
  const [videoUrl, setVideoUrl] = useState(DEFAULT_PA_TV_SETTINGS.video_url);
  const [tickerText, setTickerText] = useState(DEFAULT_PA_TV_SETTINGS.ticker_text);
  const [isMuted, setIsMuted] = useState(true); // TV padrão mudo para autorun sem bloqueio de áudio do navegador
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Tema Escuro / Claro
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return document.documentElement.classList.contains('dark');
  });

  const toggleTheme = () => {
    const root = document.documentElement;
    if (root.classList.contains('dark')) {
      root.classList.remove('dark');
      root.classList.add('light');
      setIsDarkMode(false);
    } else {
      root.classList.add('dark');
      root.classList.remove('light');
      setIsDarkMode(true);
    }
  };

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const isMutedRef = useRef(isMuted);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  // Relógio digital em tempo real
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Carregar configurações do Painel TV (Vídeo + Ticker)
  const loadConfig = useCallback(async () => {
    const cfg = await fetchPATvSettings();
    if (cfg.video_url) setVideoUrl(cfg.video_url);
    if (cfg.ticker_text) setTickerText(cfg.ticker_text);
  }, []);

  // Buscar Pacientes do PA
  const fetchPacientes = useCallback(async () => {
    try {
      const localNow = new Date();
      const local24hAgo = new Date(localNow.getTime() - 24 * 60 * 60 * 1000);
      const year = local24hAgo.getFullYear();
      const month = String(local24hAgo.getMonth() + 1).padStart(2, '0');
      const day = String(local24hAgo.getDate()).padStart(2, '0');
      const hours = String(local24hAgo.getHours()).padStart(2, '0');
      const minutes = String(local24hAgo.getMinutes()).padStart(2, '0');
      const seconds = String(local24hAgo.getSeconds()).padStart(2, '0');
      const milliseconds = String(local24hAgo.getMilliseconds()).padStart(3, '0');
      const local24hAgoAsUTC = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}Z`;

      const { data, error } = await supabase
        .from('pacientes_pronto_atendimento')
        .select('*')
        .gte('dt_entrada', local24hAgoAsUTC)
        .order('dt_entrada', { ascending: false });

      if (error) throw error;
      if (data) setPacientes(data);
    } catch (err) {
      console.error('[PainelTVPA] Erro ao carregar pacientes do PA:', err);
    }
  }, []);

  // Invocar Edge Function de Sincronização
  const runSync = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://drbzogwimvaziaydwqfk.supabase.co';
      const response = await fetch(`${supabaseUrl}/functions/v1/sync-pacientes-pa`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        await fetchPacientes();
      }
    } catch (err) {
      console.error('[PainelTVPA] Erro na sincronização:', err);
    }
  }, [fetchPacientes]);

  useEffect(() => {
    loadConfig();
    fetchPacientes();
    runSync();

    const interval = setInterval(() => {
      runSync();
      fetchPacientes();
    }, SYNC_INTERVAL_MS);

    // Subscrição a tempo real das configurações na app_settings
    const settingsSub = supabase
      .channel('pa_tv_settings_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, (payload) => {
        if (payload.new && 'key' in payload.new) {
          const key = (payload.new as any).key;
          const val = (payload.new as any).value;
          if (key === 'pa_tv_video_url') setVideoUrl(val);
          if (key === 'pa_tv_ticker_text') setTickerText(val);
        } else {
          loadConfig();
        }
      })
      .subscribe();

    // Subscrição a tempo real de pacientes
    const pacientesSub = supabase
      .channel('pa_pacientes_tv_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pacientes_pronto_atendimento' }, () => {
        fetchPacientes();
      })
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(settingsSub);
      supabase.removeChannel(pacientesSub);
    };
  }, [loadConfig, fetchPacientes, runSync]);

  // Sincronizar Mute Iframe YouTube
  const syncMuteState = useCallback(() => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: isMuted ? 'mute' : 'unMute', args: [] }),
        '*'
      );
    }
  }, [isMuted]);

  useEffect(() => {
    syncMuteState();
  }, [isMuted, syncMuteState]);

  const iframeSrc = useMemo(() => {
    const videoId = getYoutubeVideoId(videoUrl) || 'uaGeDkNoSHk';
    return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=${isMuted ? 1 : 0}&loop=1&playlist=${videoId}&controls=1&enablejsapi=1&cc_load_policy=0&iv_load_policy=3`;
  }, [videoUrl, isMuted]);

  // Alternar Tela Cheia
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(console.error);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => setIsFullscreen(false)).catch(console.error);
      }
    }
  };

  // Funções de Cálculo de Tempos
  const getWaitTimeMinutes = (entrada: string | null, inicio: string | null): number => {
    if (!entrada) return 0;
    const startObj = parseLocalDate(entrada);
    if (!startObj) return 0;
    const start = startObj.getTime();

    let end = Date.now();
    if (inicio) {
      const endObj = parseLocalDate(inicio);
      if (endObj) end = endObj.getTime();
    }
    return Math.max(0, Math.round((end - start) / 60000));
  };

  const getAtendimentoTimeMinutes = (inicio: string | null, libMedica: string | null, alta: string | null): number => {
    if (!inicio) return 0;
    const startObj = parseLocalDate(inicio);
    if (!startObj) return 0;
    const start = startObj.getTime();

    let end = Date.now();
    if (libMedica) {
      const endObj = parseLocalDate(libMedica);
      if (endObj) end = endObj.getTime();
    } else if (alta) {
      const endObj = parseLocalDate(alta);
      if (endObj) end = endObj.getTime();
    }
    return Math.max(0, Math.round((end - start) / 60000));
  };

  const formatWaitTime = (minutes: number): string => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  // Cálculos dos Indicadores Clínicos (Apenas Pacientes Ativos)
  const ativos = pacientes.filter(p =>
    !p.dt_alta &&
    p.status?.toLowerCase() !== 'alta' &&
    p.ie_internado !== 'S' &&
    p.status?.toLowerCase() !== 'internado' &&
    p.ie_status?.toUpperCase() !== 'IN'
  );
  const totalAtivos = ativos.length;
  const aguardandoAtendimento = ativos.filter(p => !p.hr_inicio_consulta).length;
  const emAtendimentoMedico = ativos.filter(p => p.hr_inicio_consulta && !p.dt_lib_medico).length;

  const pacientesComTempoEspera = ativos;
  const tempoMedioEsperaMinutos = pacientesComTempoEspera.length > 0
    ? Math.round(
      pacientesComTempoEspera.reduce((sum, p) => sum + getWaitTimeMinutes(p.dt_entrada, p.hr_inicio_consulta), 0) /
      pacientesComTempoEspera.length
    )
    : 0;

  const pacientesComAtendimento = ativos.filter(p => p.hr_inicio_consulta);
  const tempoMedioAtendimentoMinutos = pacientesComAtendimento.length > 0
    ? Math.round(
      pacientesComAtendimento.reduce((sum, p) => sum + getAtendimentoTimeMinutes(p.hr_inicio_consulta, p.dt_lib_medico, p.dt_alta), 0) /
      pacientesComAtendimento.length
    )
    : 0;

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-100 text-slate-900 overflow-hidden font-sans select-none">
      {/* ── CABEÇALHO SUPERIOR ── */}
      <header className="h-20 bg-white/95 border-b border-slate-200 px-6 flex items-center justify-between shrink-0 shadow-md backdrop-blur-md z-10">
        <div className="flex items-center gap-5">
          <div className="flex items-center pr-4 border-r border-slate-200 h-12">
            <img src="/LOGO_HSC_PRIMARY.png" alt="Santa Casa" className="h-12 w-auto object-contain" />
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/20 rounded-xl text-primary border border-primary/30">
              <Tv className="h-7 w-7 animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-wider uppercase text-slate-900 flex items-center gap-2">
                Pronto Atendimento
              </h1>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
                Painel de Indicadores & Informativo
              </p>
            </div>
          </div>
        </div>

        {/* Relógio na Cor Preta */}
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end">
            <span className="text-[20pt] font-black tracking-wide text-black">
              {currentTime.toLocaleTimeString('pt-BR')}
            </span>
            <span className="text-[16px] lg:text-[18px] font-black tracking-wide text-black capitalize mt-0.5">
              {currentTime.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'long' })}
            </span>
          </div>
        </div>
      </header>

      {/* ── CONTEÚDO PRINCIPAL (VÍDEO 80% + INDICADORES 20%) ── */}
      <div className="flex-1 flex flex-col landscape:flex-row overflow-hidden">
        {/* ÁREA DO VÍDEO (80%) */}
        <main className="w-full h-[80%] landscape:w-[80%] landscape:h-full shrink-0 relative bg-black flex items-center justify-center overflow-hidden">
          {iframeSrc ? (
            <iframe
              ref={iframeRef}
              src={iframeSrc}
              title="Vídeo Institucional PA"
              className="w-full h-full border-0 object-cover"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              onLoad={syncMuteState}
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-4 text-slate-500">
              <Tv className="h-16 w-16 stroke-1 animate-bounce" />
              <p className="text-lg font-semibold">Carregando vídeo institucional...</p>
            </div>
          )}
        </main>

        {/* COLUNA/LINHA DE INDICADORES (20%) */}
        <aside className="w-full h-[20%] landscape:w-[20%] landscape:h-full bg-slate-200/80 border-t landscape:border-t-0 landscape:border-l border-slate-300 p-[28px] md:p-[32px] landscape:py-[32px] landscape:px-[32px] flex flex-row landscape:flex-col justify-between items-center landscape:items-stretch gap-[36px] md:gap-[40px] landscape:gap-[38px] shrink-0 z-10 shadow-sm backdrop-blur-md overflow-x-auto landscape:overflow-x-hidden landscape:overflow-y-auto">
          {/* Card 1: Pacientes no PA */}
          <div className="flex-1 min-w-[88px] sm:min-w-[108px] max-w-[238px] landscape:max-w-none h-[85px] sm:h-[95px] landscape:h-auto bg-white border border-slate-200 border-l-4 border-l-blue-500 rounded-xl p-2.5 sm:p-3 landscape:py-3.5 landscape:px-3 flex items-center justify-between shadow-sm relative overflow-hidden group hover:border-blue-500/40 transition-all duration-300">
            <div className="flex flex-col min-w-0">
              <span className="text-[17px] sm:text-[18px] md:text-[19px] landscape:text-[20px] landscape:md:text-[22px] font-bold text-[#851c1c] uppercase tracking-wider leading-tight">Pacientes no PA</span>
              <span className="text-3xl sm:text-3xl md:text-4xl landscape:text-4xl landscape:md:text-5xl landscape:lg:text-6xl font-black font-extrabold tracking-tight text-slate-900 mt-0.5 sm:mt-1">
                {totalAtivos}
              </span>
            </div>
            <div className="text-blue-500/25 group-hover:text-blue-500/45 transition-colors shrink-0 ml-2">
              <Users className="h-[30px] w-[30px] sm:h-[34px] sm:w-[34px] landscape:h-[34px] landscape:w-[34px] landscape:md:h-[42px] landscape:md:w-[42px] landscape:lg:h-[50px] landscape:lg:w-[50px]" />
            </div>
          </div>

          {/* Card 2: Aguardando Médico */}
          <div className="flex-1 min-w-[88px] sm:min-w-[108px] max-w-[238px] landscape:max-w-none h-[85px] sm:h-[95px] landscape:h-auto bg-white border border-slate-200 border-l-4 border-l-amber-500 rounded-xl p-2.5 sm:p-3 landscape:py-3.5 landscape:px-3 flex items-center justify-between shadow-sm relative overflow-hidden group hover:border-amber-500/40 transition-all duration-300">
            <div className="flex flex-col min-w-0">
              <span className="text-[17px] sm:text-[18px] md:text-[19px] landscape:text-[20px] landscape:md:text-[22px] font-bold text-[#851c1c] uppercase tracking-wider leading-tight">Aguardando Médico</span>
              <span className="text-3xl sm:text-3xl md:text-4xl landscape:text-4xl landscape:md:text-5xl landscape:lg:text-6xl font-black font-extrabold tracking-tight text-slate-900 mt-0.5 sm:mt-1">
                {aguardandoAtendimento}
              </span>
            </div>
            <div className="text-amber-500/25 group-hover:text-amber-500/45 transition-colors shrink-0 ml-2">
              <Hourglass className="h-[30px] w-[30px] sm:h-[34px] sm:w-[34px] landscape:h-[34px] landscape:w-[34px] landscape:md:h-[42px] landscape:md:w-[42px] landscape:lg:h-[50px] landscape:lg:w-[50px] animate-spin-slow" />
            </div>
          </div>

          {/* Card 3: Em Atendimento */}
          <div className="flex-1 min-w-[88px] sm:min-w-[108px] max-w-[238px] landscape:max-w-none h-[85px] sm:h-[95px] landscape:h-auto bg-white border border-slate-200 border-l-4 border-l-emerald-500 rounded-xl p-2.5 sm:p-3 landscape:py-3.5 landscape:px-3 flex items-center justify-between shadow-sm relative overflow-hidden group hover:border-emerald-500/40 transition-all duration-300">
            <div className="flex flex-col min-w-0">
              <span className="text-[17px] sm:text-[18px] md:text-[19px] landscape:text-[20px] landscape:md:text-[22px] font-bold text-[#851c1c] uppercase tracking-wider leading-tight">Em Atendimento</span>
              <span className="text-3xl sm:text-3xl md:text-4xl landscape:text-4xl landscape:md:text-5xl landscape:lg:text-6xl font-black font-extrabold tracking-tight text-slate-900 mt-0.5 sm:mt-1">
                {emAtendimentoMedico}
              </span>
            </div>
            <div className="text-emerald-500/25 group-hover:text-emerald-500/45 transition-colors shrink-0 ml-2">
              <HeartPulse className="h-[30px] w-[30px] sm:h-[34px] sm:w-[34px] landscape:h-[34px] landscape:w-[34px] landscape:md:h-[42px] landscape:md:w-[42px] landscape:lg:h-[50px] landscape:lg:w-[50px]" />
            </div>
          </div>

          {/* Card 4: Média de Espera */}
          <div className="flex-1 min-w-[88px] sm:min-w-[108px] max-w-[238px] landscape:max-w-none h-[85px] sm:h-[95px] landscape:h-auto bg-white border border-slate-200 border-l-4 border-l-cyan-500 rounded-xl p-2.5 sm:p-3 landscape:py-3.5 landscape:px-3 flex items-center justify-between shadow-sm relative overflow-hidden group hover:border-cyan-500/40 transition-all duration-300">
            <div className="flex flex-col min-w-0">
              <span className="text-[17px] sm:text-[18px] md:text-[19px] landscape:text-[20px] landscape:md:text-[22px] font-bold text-[#851c1c] uppercase tracking-wider leading-tight">Média de Espera</span>
              <span className="text-3xl sm:text-3xl md:text-4xl landscape:text-4xl landscape:md:text-5xl landscape:lg:text-6xl font-black font-extrabold tracking-tight text-slate-900 mt-0.5 sm:mt-1">
                {formatWaitTime(tempoMedioEsperaMinutos)}
              </span>
            </div>
            <div className="text-cyan-500/25 group-hover:text-cyan-500/45 transition-colors shrink-0 ml-2">
              <Clock className="h-[30px] w-[30px] sm:h-[34px] sm:w-[34px] landscape:h-[34px] landscape:w-[34px] landscape:md:h-[42px] landscape:md:w-[42px] landscape:lg:h-[50px] landscape:lg:w-[50px]" />
            </div>
          </div>

          {/* Card 5: Média Atendimento */}
          <div className="flex-1 min-w-[88px] sm:min-w-[108px] max-w-[238px] landscape:max-w-none h-[85px] sm:h-[95px] landscape:h-auto bg-white border border-slate-200 border-l-4 border-l-violet-500 rounded-xl p-2.5 sm:p-3 landscape:py-3.5 landscape:px-3 flex items-center justify-between shadow-sm relative overflow-hidden group hover:border-violet-500/40 transition-all duration-300">
            <div className="flex flex-col min-w-0">
              <span className="text-[17px] sm:text-[18px] md:text-[19px] landscape:text-[20px] landscape:md:text-[22px] font-bold text-[#851c1c] uppercase tracking-wider leading-tight">Média Atendimento</span>
              <span className="text-3xl sm:text-3xl md:text-4xl landscape:text-4xl landscape:md:text-5xl landscape:lg:text-6xl font-black font-extrabold tracking-tight text-slate-900 mt-0.5 sm:mt-1">
                {formatWaitTime(tempoMedioAtendimentoMinutos)}
              </span>
            </div>
            <div className="text-violet-500/25 group-hover:text-violet-500/45 transition-colors shrink-0 ml-2">
              <Activity className="h-[30px] w-[30px] sm:h-[34px] sm:w-[34px] landscape:h-[34px] landscape:w-[34px] landscape:md:h-[42px] landscape:md:w-[42px] landscape:lg:h-[50px] landscape:lg:w-[50px] animate-pulse" />
            </div>
          </div>
        </aside>
      </div>

      {/* ── LETREIRO DIGITAL INFERIOR (TICKER MARQUEE) ── */}
      <footer className="h-20 bg-slate-200 dark:bg-slate-900 border-t border-slate-300 dark:border-slate-800 flex items-center shrink-0 overflow-hidden relative shadow-2xl z-20">
        {/* Container do Marquee Animado sem badge à esquerda */}
        <div className="w-full overflow-hidden relative flex items-center py-2">
          <div className="animate-marquee whitespace-nowrap flex items-center">
            <span className="text-2xl md:text-3xl lg:text-4xl font-black tracking-wide text-slate-900 dark:text-white px-16">
              {tickerText}
            </span>
            <span className="text-2xl md:text-3xl lg:text-4xl font-black tracking-wide text-slate-900 dark:text-white px-16">
              {tickerText}
            </span>
          </div>
        </div>
      </footer>

      {/* Estilos customizados para a animação do Marquee */}
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          display: inline-flex;
          animation: marquee 40s linear infinite;
        }
        .animate-marquee:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
}
