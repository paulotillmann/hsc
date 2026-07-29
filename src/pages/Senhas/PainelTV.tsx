import React, { useState, useEffect, useRef, useMemo } from 'react';
import { VolumeX, Volume2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { senhaService, Senha } from '../../services/senhaService';

const tocarCampainha = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const playTone = (freq: number, startTime: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime);
      
      gain.gain.setValueAtTime(0, ctx.currentTime + startTime);
      gain.gain.linearRampToValueAtTime(1, ctx.currentTime + startTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + startTime + duration);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + startTime);
      osc.stop(ctx.currentTime + startTime + duration);
    };

    // Ding (F5)
    playTone(698.46, 0, 1.0);
    // Dong (C5)
    playTone(523.25, 0.4, 1.5);
    
  } catch (e) {
    console.error("Erro AudioContext", e);
  }
};

const getYoutubeVideoId = (url: string) => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

const PainelTV: React.FC = () => {
  const [senhaAtual, setSenhaAtual] = useState<Senha | null>(null);
  const [historico, setHistorico] = useState<Senha[]>([]);
  const [videoUrl, setVideoUrl] = useState('');
  const [isMuted, setIsMuted] = useState(false); // Inicia com som por padrão
  const isMutedRef = useRef(false);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const [piscar, setPiscar] = useState(false);
  const [interagiu, setInteragiu] = useState(false);
  const interagiuRef = useRef(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  const iframeSrc = useMemo(() => {
    if (!videoUrl) return '';
    const id = getYoutubeVideoId(videoUrl);
    if (!id) return '';
    return `https://www.youtube.com/embed/${id}?autoplay=1&mute=${isMutedRef.current ? 1 : 0}&loop=1&playlist=${id}&controls=1&enablejsapi=1&cc_load_policy=0&iv_load_policy=3`;
  }, [videoUrl]);

  const syncMuteState = () => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      const shouldBeMuted = isMuted || isPlayingVoice;
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: shouldBeMuted ? 'mute' : 'unMute', args: [] }),
        '*'
      );
    }
  };

  useEffect(() => {
    syncMuteState();
  }, [isMuted, isPlayingVoice]);

  const handleIframeLoad = () => {
    syncMuteState();
    setTimeout(syncMuteState, 1000);
    setTimeout(syncMuteState, 3000);
  };

  useEffect(() => {
    carregarDadosIniciais();

    const subConfig = supabase
      .channel('tv_config')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'configuracoes_tv' }, (payload) => {
        if (payload.new && 'youtube_url' in payload.new) {
          setVideoUrl((payload.new as any).youtube_url);
        } else {
          carregarConfigTV();
        }
      })
      .subscribe();

    const subSenhas = supabase
      .channel('tv_senhas')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'senhas', filter: "status=eq.chamando" }, payload => {
        const novaSenha = payload.new as Senha;
        chamarSenhaNaTV(novaSenha);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subConfig);
      supabase.removeChannel(subSenhas);
    };
  }, []); // Vazio para inscrever apenas uma vez

  const carregarDadosIniciais = async () => {
    await carregarConfigTV();
    const response = await senhaService.listarHistorico(1, 5);
    const h = response.data;
    setHistorico(h);
    if (h.length > 0 && h[0].status === 'chamando') {
      setSenhaAtual(h[0]);
    }
  };

  const carregarConfigTV = async () => {
    const config = await senhaService.obterConfiguracaoTV();
    if (config?.youtube_url) {
      setVideoUrl(config.youtube_url);
    }
  };

  const chamarSenhaNaTV = async (novaSenha: Senha) => {
    setSenhaAtual(novaSenha);
    
    setPiscar(true);
    setTimeout(() => setPiscar(false), 5000);

    setHistorico(prev => {
      const semNova = prev.filter(p => p.id !== novaSenha.id);
      return [novaSenha, ...semNova].slice(0, 5);
    });

    if (interagiuRef.current) {
      setIsPlayingVoice(true); // Muta o vídeo antes da campainha

      try {
        tocarCampainha();
      } catch (e) {
        console.error("Erro ao tocar som", e);
      }

      setTimeout(() => {
        const criarUtterance = () => {
          const texto = `Senha ${novaSenha.tipo === 'preferencial' ? 'preferencial' : 'normal'}, ${novaSenha.codigo.replace('-', ' ')}, guichê ${novaSenha.guiche}`;
          const utterance = new SpeechSynthesisUtterance(texto);
          utterance.lang = 'pt-BR';
          utterance.rate = 0.9;
          utterance.pitch = 1.1;

          const voices = window.speechSynthesis.getVoices();
          const vozMasculina = voices.find(v => v.lang === 'pt-BR' && (v.name.includes('Daniel') || v.name.includes('Thiago') || v.name.toLowerCase().includes('masculin')));
          if (vozMasculina) {
            utterance.voice = vozMasculina;
          } else {
            // Fallback caso não ache uma voz especificamente masculina
            const fallback = voices.find(v => v.lang === 'pt-BR');
            if (fallback) utterance.voice = fallback;
          }
          
          return utterance;
        };

        const utterance1 = criarUtterance();
        const utterance2 = criarUtterance();

        utterance1.onend = () => {
          setTimeout(() => {
            window.speechSynthesis.speak(utterance2);
          }, 2000);
        };

        utterance2.onend = () => {
          setIsPlayingVoice(false);
        };

        window.speechSynthesis.speak(utterance1);
      }, 1500);
    }
  };

  if (!interagiu) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900 text-white">
        <button 
          onClick={() => {
            setInteragiu(true);
            interagiuRef.current = true;
            tocarCampainha();
            window.speechSynthesis.getVoices();
          }}
          className="px-12 py-6 bg-blue-600 hover:bg-blue-700 text-3xl font-bold rounded-2xl animate-pulse"
        >
          INICIAR PAINEL DA TV
        </button>
      </div>
    );
  }

  return (
    <div className="dark flex flex-col min-h-screen bg-slate-950 text-white overflow-hidden">
      
      <div className="flex-1 flex flex-row">
        
        {/* LADO ESQUERDO: VÍDEO */}
        <div className="flex-1 bg-black relative border-r-8 border-slate-800 overflow-hidden group">
          {iframeSrc ? (
            <>
              <iframe
                ref={iframeRef}
                onLoad={handleIframeLoad}
                width="100%"
                height="100%"
                src={iframeSrc}
                title="YouTube video player"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                style={{ position: 'absolute', top: 0, left: 0 }}
              ></iframe>
              <button 
                onClick={() => setIsMuted(!isMuted)}
                className="absolute top-4 right-4 bg-black/50 hover:bg-black/80 text-white p-3 rounded-full z-50 transition-all"
                title={isMuted ? "Ativar som do vídeo" : "Desativar som do vídeo"}
              >
                {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
              </button>
              <div className="absolute bottom-4 left-4 bg-black/60 text-white/50 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity z-50">
                URL Original: {videoUrl}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center w-full h-full text-slate-700 font-bold p-8 text-center">
              <span className="text-2xl mb-2">NENHUM VÍDEO CONFIGURADO OU URL INVÁLIDA</span>
              {videoUrl && <span className="text-sm font-normal break-all">Link recebido: {videoUrl}</span>}
            </div>
          )}
        </div>

        {/* LADO DIREITO: SENHA ATUAL */}
        <div className="w-[35%] xl:w-[30%] flex flex-col bg-slate-900 border-l border-slate-800/50 shadow-2xl relative z-10">
          <div className="bg-white py-4 text-center border-b border-slate-200">
            <h2 className="text-2xl font-bold text-slate-900 uppercase tracking-widest">Senha Atual</h2>
          </div>
          
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center relative overflow-hidden">
            <div className={`absolute inset-0 bg-[#7c1c1c]/20 transition-opacity duration-500 ${piscar ? 'opacity-100' : 'opacity-0'}`}></div>

            {senhaAtual ? (
              <div className={`z-10 transition-transform duration-500 ${piscar ? 'scale-110' : 'scale-100'}`}>
                <div className="text-4xl md:text-5xl font-black mb-4 uppercase tracking-widest text-slate-300">
                  {senhaAtual.tipo === 'preferencial' ? (
                    <span className="text-amber-400">Preferencial</span>
                  ) : (
                    <span className="text-white">Normal</span>
                  )}
                </div>
                
                <div className={`text-[8rem] xl:text-[10rem] leading-none font-black tracking-tighter shadow-black drop-shadow-2xl mb-8 ${senhaAtual.tipo === 'preferencial' ? 'text-amber-400' : 'text-white'}`}>
                  {senhaAtual.codigo}
                </div>
                
                <div className="bg-slate-800 rounded-3xl py-4 px-12 inline-block border-2 border-slate-700 shadow-2xl">
                  <div className="text-3xl text-slate-400 font-bold uppercase tracking-widest mb-1">Dirija-se ao</div>
                  <div className="text-7xl font-black text-white">Guichê {senhaAtual.guiche}</div>
                </div>
              </div>
            ) : (
              <div className="text-4xl font-bold text-slate-700">Aguardando...</div>
            )}
          </div>
        </div>

      </div>

      {/* RODAPÉ: HISTÓRICO */}
      <div className="h-40 bg-slate-950 border-t-4 border-slate-800 flex overflow-hidden shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-20 relative">
        <div className="w-80 bg-white flex items-center justify-center shrink-0 z-10 shadow-2xl border-r border-slate-700">
          <span className="text-3xl font-black uppercase tracking-widest text-slate-900 text-center">Últimas<br/>Chamadas</span>
        </div>
        
        <div className="flex-1 flex items-center px-8 gap-8 overflow-hidden bg-slate-900">
          {historico.slice(1).map((senha, idx) => (
            <div key={senha.id + idx} className="flex items-center gap-6 bg-slate-800/80 px-8 py-4 rounded-3xl border border-slate-700 whitespace-nowrap opacity-80">
              <span className={`text-5xl font-black ${senha.tipo === 'preferencial' ? 'text-amber-400' : 'text-white'}`}>
                {senha.codigo}
              </span>
              <div className="w-4 h-4 rounded-full bg-slate-600"></div>
              <span className="text-4xl font-bold text-slate-300">
                Guichê {senha.guiche}
              </span>
            </div>
          ))}
          {historico.length <= 1 && (
             <div className="text-xl text-slate-600 font-bold">Nenhum histórico recente.</div>
          )}
        </div>
      </div>

    </div>
  );
};

export default PainelTV;
