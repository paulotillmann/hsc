import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShieldAlert, 
  ShieldCheck, 
  Lock, 
  Scale, 
  ArrowRight, 
  Sparkles, 
  Search, 
  X, 
  Calendar, 
  Clock, 
  AlertCircle, 
  Info, 
  FileText, 
  MessageSquare, 
  ClipboardCheck, 
  EyeOff, 
  Shield, 
  ChevronLeft,
  ArrowUpRight
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { denunciaService, Denuncia } from '../../services/denunciaService';

export default function EscutaLanding() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  // Estados para Acompanhamento de Denúncia
  const [modalAberto, setModalAberto] = useState(false);
  const [protocoloPesquisa, setProtocoloPesquisa] = useState('');
  const [loadingPesquisa, setLoadingPesquisa] = useState(false);
  const [denunciaEncontrada, setDenunciaEncontrada] = useState<Denuncia | null>(null);
  const [pesquisaRealizada, setPesquisaRealizada] = useState(false);
  const [erroPesquisa, setErroPesquisa] = useState('');

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: i * 0.1,
        duration: 0.5,
        ease: 'easeOut' as const
      }
    })
  };

  // Cores de Status
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Pendente':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20';
      case 'Em Investigação':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20';
      case 'Concluído':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20';
      case 'Arquivado':
        return 'bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400';
      default:
        return 'bg-slate-100 text-slate-500';
    }
  };

  const handleBuscarProtocolo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!protocoloPesquisa.trim()) return;

    setLoadingPesquisa(true);
    setErroPesquisa('');
    setPesquisaRealizada(false);
    setDenunciaEncontrada(null);

    try {
      const data = await denunciaService.obterDenunciaPorProtocolo(protocoloPesquisa);
      if (data) {
        setDenunciaEncontrada(data);
      } else {
        setErroPesquisa('Nenhum relato encontrado com o protocolo informado.');
      }
    } catch (err) {
      console.error('Erro ao buscar protocolo:', err);
      setErroPesquisa('Ocorreu um erro ao processar sua busca. Tente novamente.');
    } finally {
      setLoadingPesquisa(false);
      setPesquisaRealizada(true);
    }
  };

  const handleFecharModal = () => {
    setModalAberto(false);
    setProtocoloPesquisa('');
    setDenunciaEncontrada(null);
    setPesquisaRealizada(false);
    setErroPesquisa('');
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50/40 dark:bg-slate-950 transition-colors duration-300 w-full overflow-x-hidden font-sans">
      
      {/* ── HEADER/NAVBAR SUPERIOR ELÉGICO ── */}
      <header className="w-full border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0 z-40 transition-colors dark:bg-slate-900/80 dark:border-slate-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center pr-3 border-r border-slate-200 dark:border-slate-800 h-9">
              <img src="/LOGO_HSC_PRIMARY.png" alt="Santa Casa" className="h-8 w-auto dark:hidden object-contain" />
              <img src="/LOGO_HSC_WHITE.png" alt="Santa Casa" className="h-8 w-auto hidden dark:block object-contain" />
            </div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-primary/10 rounded-lg text-primary border border-primary/20">
                <ShieldAlert className="h-4.5 w-4.5" />
              </div>
              <span className="font-bold text-slate-900 dark:text-white text-lg tracking-tight">Escuta Santa Casa</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-bold text-emerald-600 uppercase tracking-wider dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Conexão Segura e Criptografada
            </div>
            
            {profile && (
              <button
                onClick={() => navigate('/dashboard')}
                className="inline-flex h-9 items-center justify-center gap-1.5 border bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 text-xs font-bold rounded-lg px-3.5 transition-all shadow-sm shrink-0 cursor-pointer border-slate-200 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <ChevronLeft className="h-4 w-4" />
                Voltar ao Dashboard
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── HERO SECTION ── */}
      <section className="relative py-20 md:py-28 overflow-hidden border-b border-slate-100 dark:border-slate-900 bg-white/40 dark:bg-slate-900/10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            
            {/* Coluna Esquerda */}
            <div className="lg:col-span-7 space-y-8 text-left">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-[9px] font-bold text-primary uppercase tracking-widest dark:text-red-400">
                <Sparkles className="h-3.5 w-3.5" />
                Plataforma Protegida & Criptografada
              </div>

              <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-slate-900 dark:text-white leading-[1.1]">
                Sua voz importa. <br />
                <span className="text-primary dark:text-red-400">Sua identidade está protegida.</span>
              </h1>

              <p className="text-slate-500 dark:text-slate-400 text-base sm:text-lg leading-relaxed font-medium max-w-xl">
                Relate desvios de conduta, assédio, fraude ou qualquer situação contrária à ética de forma totalmente confidencial. Garantimos anonimato absoluto e proteção jurídica completa.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <button
                  onClick={() => navigate('/escuta-santa-casa/nova-denuncia')}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-8 text-primary-foreground text-sm font-bold shadow-lg shadow-primary/20 hover:bg-primary/95 hover:shadow-xl active:scale-98 transition-all group cursor-pointer"
                >
                  Registrar relato seguro
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </button>
                <button
                  onClick={() => setModalAberto(true)}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-8 text-slate-700 hover:bg-slate-50 hover:border-slate-300 text-sm font-bold shadow-sm active:scale-98 transition-all group cursor-pointer dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Acompanhar andamento
                  <Search className="h-4 w-4 text-slate-400 group-hover:scale-105 transition-transform" />
                </button>
              </div>
            </div>

            {/* Coluna Direita (Visual Abstrato Premium) */}
            <div className="lg:col-span-5 flex justify-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8 }}
                className="relative"
              >
                {/* Glow decorativo de fundo */}
                <div className="absolute inset-0 bg-primary/20 rounded-full blur-3xl filter opacity-30 animate-pulse pointer-events-none" />
                
                <div className="relative p-8 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-2xl flex flex-col items-center justify-center h-64 w-64 sm:h-72 sm:w-72">
                  <div className="p-5 bg-primary/5 rounded-2xl border border-primary/10">
                    <ShieldAlert className="h-20 w-20 text-primary opacity-90" />
                  </div>
                  <div className="absolute -top-3 -right-3 p-3 bg-emerald-500 rounded-full border-4 border-white dark:border-slate-900 shadow-xl text-white">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <div className="mt-4 text-center">
                    <span className="text-xs font-bold text-slate-900 dark:text-white block">Canal de Denúncias</span>
                    <span className="text-[10px] font-semibold text-slate-400 block mt-0.5">Santa Casa de Misericórdia de Araguari</span>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PILARES DA SEGURANÇA ── */}
      <section className="py-24 bg-slate-50/30 dark:bg-slate-900/5 border-b border-slate-100 dark:border-slate-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-16">
          
          <div className="text-center max-w-2xl mx-auto space-y-4">
            <span className="text-[10px] font-bold text-primary uppercase tracking-widest dark:text-red-400">Proteção Inviolável</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Pilares da sua segurança
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed font-medium">
              Segurança de nível corporativo e garantias jurídicas estritas projetadas para assegurar a tranquilidade absoluta de quem relata.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <motion.div
              custom={0}
              initial="hidden"
              animate="visible"
              variants={cardVariants}
              className="p-8 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between group"
            >
              <div className="space-y-6">
                <div className="p-3.5 bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl w-fit group-hover:scale-105 transition-transform">
                  <EyeOff className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Anonimato Absoluto</h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed font-medium">
                  Garantia de zero rastreamento de dados pessoais. Não registramos IPs, cookies, geolocalização ou qualquer dado capaz de identificar o relator.
                </p>
              </div>
            </motion.div>

            <motion.div
              custom={1}
              initial="hidden"
              animate="visible"
              variants={cardVariants}
              className="p-8 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between group"
            >
              <div className="space-y-6">
                <div className="p-3.5 bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-xl w-fit group-hover:scale-105 transition-transform">
                  <Lock className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Criptografia de Dados</h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed font-medium">
                  Seus relatos e documentos anexados são protegidos com criptografia avançada de ponta a ponta, blindando-os contra qualquer acesso não autorizado.
                </p>
              </div>
            </motion.div>

            <motion.div
              custom={2}
              initial="hidden"
              animate="visible"
              variants={cardVariants}
              className="p-8 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between group"
            >
              <div className="space-y-6">
                <div className="p-3.5 bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl w-fit group-hover:scale-105 transition-transform">
                  <Scale className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Imparcialidade Isenta</h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed font-medium">
                  Processo sob responsabilidade exclusiva da comissão de ética, garantindo independência no andamento das investigações e zero represálias ou conflitos.
                </p>
              </div>
            </motion.div>

            <motion.div
              custom={3}
              initial="hidden"
              animate="visible"
              variants={cardVariants}
              className="p-8 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between group"
            >
              <div className="space-y-6">
                <div className="p-3.5 bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary-foreground rounded-xl w-fit group-hover:scale-105 transition-transform">
                  <Shield className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Conformidade Legal</h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed font-medium">
                  Segurança total em estrita conformidade com a Lei Geral de Proteção de Dados (LGPD) e legislações vigentes de proteção ao relator.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── PASSO A PASSO COMO DENUNCIAR ── */}
      <section className="py-24 bg-white dark:bg-slate-950 border-b border-slate-100 dark:border-slate-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-16">
          
          <div className="text-center max-w-2xl mx-auto space-y-4">
            <span className="text-[10px] font-bold text-primary uppercase tracking-widest dark:text-red-400">Processo Simples e Estruturado</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Como realizar sua denúncia no <br /> Escuta Santa Casa
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed font-medium">
              Siga as quatro etapas simplificadas abaixo para registrar seu relato em ambiente blindado e seguro.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <motion.div
              custom={0}
              initial="hidden"
              animate="visible"
              variants={cardVariants}
              className="p-8 bg-slate-50/50 dark:bg-slate-900/30 border border-slate-100/80 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 relative flex flex-col justify-between"
            >
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10 text-primary text-xs font-black">
                    01
                  </span>
                  <FileText className="h-5 w-5 text-slate-400" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">1. Escolha a Categoria</h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed font-medium">
                  Selecione a natureza da ocorrência que melhor define a situação (ex: desvio de conduta, assédio, fraude).
                </p>
              </div>
            </motion.div>

            <motion.div
              custom={1}
              initial="hidden"
              animate="visible"
              variants={cardVariants}
              className="p-8 bg-slate-50/50 dark:bg-slate-900/30 border border-slate-100/80 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 relative flex flex-col justify-between"
            >
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10 text-primary text-xs font-black">
                    02
                  </span>
                  <MessageSquare className="h-5 w-5 text-slate-400" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">2. Detalhe a Ocorrência</h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed font-medium">
                  Descreva os fatos com data, local e setor. Se possuir evidências (fotos, documentos), anexe-as de forma opcional.
                </p>
              </div>
            </motion.div>

            <motion.div
              custom={2}
              initial="hidden"
              animate="visible"
              variants={cardVariants}
              className="p-8 bg-slate-50/50 dark:bg-slate-900/30 border border-slate-100/80 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 relative flex flex-col justify-between"
            >
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10 text-primary text-xs font-black">
                    03
                  </span>
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">3. Defina o Anonimato</h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed font-medium">
                  Escolha se deseja enviar o relato sob anonimato absoluto ou se prefere se identificar. Seus dados estarão protegidos.
                </p>
              </div>
            </motion.div>

            <motion.div
              custom={3}
              initial="hidden"
              animate="visible"
              variants={cardVariants}
              className="p-8 bg-slate-50/50 dark:bg-slate-900/30 border border-slate-100/80 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 relative flex flex-col justify-between"
            >
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10 text-primary text-xs font-black">
                    04
                  </span>
                  <ClipboardCheck className="h-5 w-5 text-slate-400" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">4. Guarde o Protocolo</h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed font-medium">
                  Após enviar, anote e guarde o protocolo gerado. Ele é o seu único meio de acompanhar e interagir com o Comitê.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── BANNER DE REASSEGURAMENTO ── */}
      <section className="py-16 bg-slate-50/50 dark:bg-slate-900/20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="p-8 md:p-12 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-xl flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="space-y-3 max-w-xl text-left">
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">Um compromisso institucional rígido</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                Esta plataforma de ouvidoria ética é um sistema independente projetado especificamente para resguardar relatores de retaliações. Todos os processos são regidos sob termos legais rígidos de confidencialidade e segurança da informação.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex -space-x-2">
                <div className="w-10 h-10 rounded-full border-2 border-white dark:border-slate-900 bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shadow-md">
                  A
                </div>
                <div className="w-10 h-10 rounded-full border-2 border-white dark:border-slate-900 bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-xs shadow-md">
                  LGPD
                </div>
                <div className="w-10 h-10 rounded-full border-2 border-white dark:border-slate-900 bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold text-xs shadow-md">
                  SSL
                </div>
              </div>
              <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">Plataforma Certificada</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── MODAL PREMIUM DE ACOMPANHAMENTO ── */}
      <AnimatePresence>
        {modalAberto && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            
            {/* Backdrop com blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleFecharModal}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
            />

            {/* Container do Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: 'spring', duration: 0.4 }}
              className="relative w-full max-w-2xl bg-white border border-slate-100 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] z-10 dark:bg-slate-900 dark:border-slate-800"
            >
              {/* Header */}
              <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/20 dark:bg-slate-950/20 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-primary/10 rounded-lg text-primary">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <span className="font-extrabold text-slate-900 text-lg dark:text-white">Acompanhar Relato</span>
                </div>
                <button
                  onClick={handleFecharModal}
                  className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-slate-50 text-slate-400 hover:text-slate-600 transition-colors border border-slate-100 dark:border-slate-800 dark:hover:bg-slate-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Corpo com Rolagem Interna */}
              <div className="flex-1 overflow-y-auto p-8 space-y-6">
                
                {/* Formulário de Busca Inicial */}
                {!denunciaEncontrada && (
                  <form onSubmit={handleBuscarProtocolo} className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-800 uppercase tracking-wider dark:text-slate-200">Código do Protocolo</label>
                      <div className="relative flex gap-2">
                        <input
                          type="text"
                          required
                          placeholder="Ex: HSC-2026-XXXXX"
                          value={protocoloPesquisa}
                          onChange={(e) => setProtocoloPesquisa(e.target.value.toUpperCase())}
                          className="flex-1 h-12 px-4 bg-slate-50 border border-slate-150 rounded-xl focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm font-mono tracking-wider font-bold dark:bg-slate-950 dark:border-slate-800"
                        />
                        <button
                          type="submit"
                          disabled={loadingPesquisa || !protocoloPesquisa.trim()}
                          className="h-12 px-6 rounded-xl bg-primary text-primary-foreground text-sm font-bold shadow hover:bg-primary/95 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                        >
                          {loadingPesquisa ? 'Buscando...' : 'Buscar'}
                        </button>
                      </div>
                      <span className="text-xs text-slate-400 leading-relaxed block mt-1">
                        Insira o código gerado no final da submissão para verificar andamentos e feedbacks do comitê.
                      </span>
                    </div>

                    {pesquisaRealizada && erroPesquisa && (
                      <div className="flex items-start gap-2.5 p-4 rounded-xl bg-red-500/5 border border-red-500/10 text-red-800 dark:text-red-400 text-xs leading-relaxed">
                        <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                        <span>{erroPesquisa}</span>
                      </div>
                    )}
                  </form>
                )}

                {/* Exibição de Resultado Encontrado */}
                {denunciaEncontrada && (
                  <div className="space-y-8">
                    {/* Status da Ocorrência */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/50 p-6 rounded-2xl border border-slate-100 dark:bg-slate-950/30 dark:border-slate-800">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Código do Protocolo</span>
                        <span className="font-mono font-extrabold text-slate-800 text-base tracking-wide dark:text-white">
                          {denunciaEncontrada.protocolo}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Status Atual</span>
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold mt-1 ${getStatusBadge(denunciaEncontrada.status)}`}>
                          {denunciaEncontrada.status}
                        </span>
                      </div>
                    </div>

                    {/* Informações da Denúncia */}
                    <div className="space-y-4">
                      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2 dark:text-white dark:border-slate-800">Detalhes do Relato</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                        <div>
                          <span className="text-slate-400 block mb-0.5">Natureza do Ocorrido</span>
                          <span className="text-slate-800 dark:text-white font-bold">{denunciaEncontrada.categoriaLabel}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block mb-0.5">Data de Envio</span>
                          <span className="text-slate-800 dark:text-white font-bold">
                            {new Date(denunciaEncontrada.dataSubmetida).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric'
                            })}
                          </span>
                        </div>
                        {denunciaEncontrada.localOcorrencia && (
                          <div>
                            <span className="text-slate-400 block mb-0.5">Setor/Local</span>
                            <span className="text-slate-800 dark:text-white font-bold">{denunciaEncontrada.localOcorrencia}</span>
                          </div>
                        )}
                        {denunciaEncontrada.dataOcorrencia && (
                          <div>
                            <span className="text-slate-400 block mb-0.5">Data do Ocorrido</span>
                            <span className="text-slate-800 dark:text-white font-bold">
                              {new Date(denunciaEncontrada.dataOcorrencia).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Descrição do relato */}
                    <div className="space-y-2 bg-slate-50/30 border border-slate-100 p-6 rounded-2xl dark:bg-slate-950/20 dark:border-slate-800">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Relato Enviado</span>
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap font-medium">
                        {denunciaEncontrada.descricao}
                      </p>
                    </div>

                    {/* Timeline de Evolução */}
                    <div className="space-y-6 pt-2">
                      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2 dark:text-white dark:border-slate-800">Andamento do Relato</h3>
                      <div className="relative pl-6 border-l-2 border-primary/20 space-y-6 ml-2.5">
                        {denunciaEncontrada.timeline.map((step, index) => (
                          <div key={index} className="relative">
                            {/* Marcador flutuante da Timeline */}
                            <div className="absolute -left-[31px] top-0.5 h-3.5 w-3.5 rounded-full bg-primary border-4 border-white ring-2 ring-primary/20 dark:border-slate-900" />
                            
                            <div className="space-y-1">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                                <span className="text-xs font-bold text-slate-900 dark:text-white">{step.titulo}</span>
                                <span className="text-[9px] text-slate-400 font-mono font-bold">
                                  {new Date(step.data).toLocaleString('pt-BR')}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                                {step.descricao}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Banner de Garantia de Identidade Blindada */}
                    <div className="flex items-start gap-3 p-4 border border-blue-100 dark:border-blue-900/30 rounded-xl bg-blue-500/5 text-blue-850 dark:text-blue-300 text-[11px] leading-relaxed">
                      <Info className="h-4.5 w-4.5 text-blue-500 shrink-0 mt-0.5" />
                      <span>
                        <strong className="text-slate-900 dark:text-white font-bold">Privacidade Garantida:</strong> Por motivos estritos de segurança, seus dados de contato nunca são exibidos de forma aberta em telas de consulta pública.
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-8 py-5 border-t border-slate-100 bg-slate-50/10 flex justify-end gap-2 dark:border-slate-800">
                {denunciaEncontrada && (
                  <button
                    onClick={() => {
                      setDenunciaEncontrada(null);
                      setProtocoloPesquisa('');
                      setPesquisaRealizada(false);
                      setErroPesquisa('');
                    }}
                    className="inline-flex h-10 items-center justify-center border hover:bg-slate-50 text-slate-700 dark:text-slate-300 dark:border-slate-800 dark:hover:bg-slate-800 text-xs font-bold rounded-xl px-4 transition-colors cursor-pointer"
                  >
                    Consultar Outro
                  </button>
                )}
                <button
                  onClick={handleFecharModal}
                  className="inline-flex h-10 items-center justify-center bg-primary text-primary-foreground text-xs font-bold rounded-xl px-5 shadow hover:bg-primary/95 transition-all cursor-pointer"
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
