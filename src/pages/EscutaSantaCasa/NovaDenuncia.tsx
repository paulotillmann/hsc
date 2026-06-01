import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, ArrowLeft, ArrowRight, ShieldCheck, Check, Copy, Upload, Paperclip, AlertCircle, Info, Lock } from 'lucide-react';
import { denunciaService } from '../../services/denunciaService';

const CATEGORIES = [
  { id: 'assedio-moral', label: 'Assédio Moral / Abuso de Poder' },
  { id: 'assedio-sexual', label: 'Assédio Sexual' },
  { id: 'desvio-conduta', label: 'Desvio de Conduta Ética / Violamento de Normas' },
  { id: 'discriminacao', label: 'Discriminação (Raça, Gênero, Orientação, Religião)' },
  { id: 'fraude-corrupcao', label: 'Fraude / Desvio / Corrupção / Roubo' },
  { id: 'outro', label: 'Outro Assunto (Não listado acima)' },
];

export default function NovaDenuncia() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [copied, setCopied] = useState(false);

  // Form States
  const [categoria, setCategoria] = useState('');
  const [descricao, setDescricao] = useState('');
  const [dataOcorrencia, setDataOcorrencia] = useState('');
  const [localOcorrencia, setLocalOcorrencia] = useState('');
  const [anonimo, setAnonimo] = useState(true);
  
  // Dados de Identificação (se não anônimo)
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [cargo, setCargo] = useState('');

  // Anexos Mockados
  const [anexos, setAnexos] = useState<string[]>([]);
  const [dragActive, setDragActive] = useState(false);

  // Protocolo Final
  const [protocoloGerado, setProtocoloGerado] = useState('');

  const handleNextStep = async () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      // Finalizar e gerar protocolo
      const randomPart = Math.random().toString(36).substring(2, 7).toUpperCase();
      const code = `HSC-2026-${randomPart}`;
      setProtocoloGerado(code);

      // Obter label da categoria
      const catObj = CATEGORIES.find(c => c.id === categoria);
      const categoriaLabel = catObj ? catObj.label : 'Outro Assunto (Não listado acima)';

      try {
        await denunciaService.criarDenuncia({
          protocolo: code,
          categoria,
          categoriaLabel,
          descricao,
          dataOcorrencia: dataOcorrencia || undefined,
          localOcorrencia: localOcorrencia || undefined,
          anonimo,
          nomeRelator: anonimo ? undefined : nome,
          emailRelator: anonimo ? undefined : email,
          telefoneRelator: anonimo ? undefined : telefone,
          cargoRelator: anonimo ? undefined : cargo,
          anexos
        });
      } catch (err) {
        console.error("Erro ao submeter denúncia ao serviço:", err);
      }

      setStep(4);
    }
  };

  const handlePrevStep = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const fileNames = Array.from(e.dataTransfer.files).map(f => f.name);
      setAnexos(prev => [...prev, ...fileNames]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const fileNames = Array.from(e.target.files).map(f => f.name);
      setAnexos(prev => [...prev, ...fileNames]);
    }
  };

  const handleCopiarProtocolo = () => {
    navigator.clipboard.writeText(protocoloGerado);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isNextDisabled = () => {
    if (step === 1 && !categoria) return true;
    if (step === 2 && (!descricao.trim() || !dataOcorrencia || !localOcorrencia.trim())) return true;
    if (step === 3 && !anonimo && (!nome.trim() || !email.trim())) return true;
    return false;
  };

  const transitionVariants = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0, transition: { duration: 0.3 } },
    exit: { opacity: 0, x: -20, transition: { duration: 0.2 } }
  };

  return (
    <div className="flex-1 min-h-screen pb-16 w-full mx-auto px-4 sm:px-6 lg:px-8 pt-8 max-w-4xl space-y-6">
      {/* ── HEADER DE NAVEGAÇÃO ── */}
      <div className="flex items-center justify-between pb-4 border-b">
        <button
          onClick={() => navigate('/escuta-santa-casa')}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground font-medium transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para a Introdução
        </button>
        {step < 4 && (
          <span className="text-xs font-semibold text-muted-foreground uppercase bg-muted px-2.5 py-1 rounded-full">
            Passo {step} de 3
          </span>
        )}
      </div>

      {/* ── INDICADORES DE PROGRESSO ── */}
      {step < 4 && (
        <div className="grid grid-cols-3 gap-2">
          <div className={`h-1.5 rounded-full transition-all duration-300 ${step >= 1 ? 'bg-primary' : 'bg-muted'}`} />
          <div className={`h-1.5 rounded-full transition-all duration-300 ${step >= 2 ? 'bg-primary' : 'bg-muted'}`} />
          <div className={`h-1.5 rounded-full transition-all duration-300 ${step >= 3 ? 'bg-primary' : 'bg-muted'}`} />
        </div>
      )}

      {/* ── CORPO DO FORMULÁRIO COM ANIMAÇÕES ── */}
      <div className="bg-card border rounded-2xl shadow-lg overflow-hidden">
        <div className="p-6 md:p-8">
          <AnimatePresence mode="wait">
            
            {/* ── PASSO 1: CATEGORIA DO RELATO ── */}
            {step === 1 && (
              <motion.div
                key="step1"
                variants={transitionVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="space-y-6"
              >
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold text-foreground flex items-center gap-2.5">
                    <ShieldAlert className="h-6 w-6 text-primary" />
                    Qual a natureza do seu relato?
                  </h2>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Selecione abaixo a categoria que melhor define a ocorrência que você deseja reportar. Suas informações serão mantidas sob sigilo total.
                  </p>
                </div>



                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategoria(cat.id)}
                      className={`text-left p-4 rounded-xl border-2 transition-all text-sm font-medium ${
                        categoria === cat.id
                          ? 'border-primary bg-primary/5 text-primary shadow-sm'
                          : 'border-border bg-card hover:bg-muted text-foreground'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ── PASSO 2: DETALHES E PROVAS ── */}
            {step === 2 && (
              <motion.div
                key="step2"
                variants={transitionVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="space-y-6"
              >
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold text-foreground flex items-center gap-2.5">
                    <Paperclip className="h-6 w-6 text-primary" />
                    Detalhes da Ocorrência
                  </h2>
                  <p className="text-muted-foreground text-sm">
                    Forneça o máximo de informações possível para viabilizar uma investigação ética, imparcial e ágil.
                  </p>
                </div>

                {/* Descrição Detalhada */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-foreground">
                    Descrição Detalhada dos Fatos <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={6}
                    placeholder="Descreva detalhadamente o ocorrido. Considere informar: O que aconteceu? Quem estava envolvido? Ocorreu de forma pontual ou repetida? Quem mais sabe desse fato?"
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    className="w-full border rounded-xl p-4 bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm leading-relaxed"
                  />
                </div>

                {/* Campos Adicionais de Contexto */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-foreground">Data da Ocorrência <span className="text-red-500">*</span></label>
                    <input
                      type="date"
                      value={dataOcorrencia}
                      onChange={(e) => setDataOcorrencia(e.target.value)}
                      className="w-full h-11 border rounded-lg px-4 bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-foreground">Local / Setor do Hospital <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      placeholder="Ex: Recepção do Pronto Socorro, UTI"
                      value={localOcorrencia}
                      onChange={(e) => setLocalOcorrencia(e.target.value)}
                      className="w-full h-11 border rounded-lg px-4 bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                    />
                  </div>
                </div>

                {/* Anexo de Arquivos (Drag and Drop Mock) */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-foreground">Anexos e Evidências (Opcional)</label>
                  <p className="text-xs text-muted-foreground">Documentos, fotos, planilhas ou capturas de tela ajudam no processo de investigação.</p>
                  
                  <div
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${
                      dragActive ? 'border-primary bg-primary/5' : 'border-border bg-background'
                    }`}
                  >
                    <input
                      type="file"
                      id="file-upload"
                      multiple
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center gap-3">
                      <div className="p-3 bg-primary/10 rounded-full text-primary">
                        <Upload className="h-6 w-6" />
                      </div>
                      <div>
                        <span className="text-sm font-semibold text-primary hover:underline">Selecione arquivos</span>
                        <span className="text-sm text-muted-foreground"> ou arraste e solte aqui</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground uppercase">Tamanho máximo: 15MB por arquivo</span>
                    </label>
                  </div>

                  {anexos.length > 0 && (
                    <div className="pt-2 space-y-2">
                      <div className="text-xs font-bold text-foreground uppercase tracking-wider">Arquivos anexados:</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {anexos.map((name, i) => (
                          <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg border bg-muted/40 text-xs font-medium min-w-0">
                            <Paperclip className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span className="truncate flex-1">{name}</span>
                            <button
                              type="button"
                              onClick={() => setAnexos(prev => prev.filter((_, idx) => idx !== i))}
                              className="text-red-500 hover:text-red-600 px-1 font-bold"
                            >
                              Remover
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* ── PASSO 3: IDENTIFICAÇÃO DO USUÁRIO ── */}
            {step === 3 && (
              <motion.div
                key="step3"
                variants={transitionVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="space-y-6"
              >
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold text-foreground flex items-center gap-2.5">
                    <Lock className="h-6 w-6 text-primary" />
                    Opção de Identificação
                  </h2>
                  <p className="text-muted-foreground text-sm">
                    Decida se prefere enviar este relato de forma totalmente anônima ou se deseja se identificar.
                  </p>
                </div>

                {/* Escolha Anônimo vs Identificado */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setAnonimo(true)}
                    className={`flex flex-col gap-2 p-5 text-left rounded-xl border-2 transition-all ${
                      anonimo
                        ? 'border-primary bg-primary/5 text-primary shadow-sm'
                        : 'border-border bg-card hover:bg-muted text-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`h-4 w-4 rounded-full border-4 flex items-center justify-center shrink-0 ${anonimo ? 'border-primary bg-primary' : 'border-muted-foreground bg-transparent'}`} />
                      <span className="font-bold text-sm text-foreground">Relatar Anonimamente</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                      Sua identidade será totalmente preservada. Nenhuma informação pessoal será coletada ou compartilhada pelo sistema.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAnonimo(false)}
                    className={`flex flex-col gap-2 p-5 text-left rounded-xl border-2 transition-all ${
                      !anonimo
                        ? 'border-primary bg-primary/5 text-primary shadow-sm'
                        : 'border-border bg-card hover:bg-muted text-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`h-4 w-4 rounded-full border-4 flex items-center justify-center shrink-0 ${!anonimo ? 'border-primary bg-primary' : 'border-muted-foreground bg-transparent'}`} />
                      <span className="font-bold text-sm text-foreground">Identificar-se (Confidencial)</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                      Identificar-se ajuda na apuração, permitindo que o comitê entre em contato para tirar dúvidas. Seus dados são guardados sob absoluto sigilo.
                    </p>
                  </button>
                </div>

                {/* Campos de Identificação (Visíveis apenas se NOT anonimo) */}
                <AnimatePresence>
                  {!anonimo && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden border rounded-xl bg-muted/20 p-5 space-y-4"
                    >
                      <div className="text-xs font-bold text-foreground uppercase tracking-wider pb-1 border-b">
                        Dados de Identificação
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Nome Completo <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            placeholder="Seu nome"
                            value={nome}
                            onChange={(e) => setNome(e.target.value)}
                            className="w-full h-11 border rounded-lg px-4 bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            E-mail <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="email"
                            placeholder="seuemail@exemplo.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full h-11 border rounded-lg px-4 bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Telefone (WhatsApp)</label>
                          <input
                            type="tel"
                            placeholder="(00) 00000-0000"
                            value={telefone}
                            onChange={(e) => setTelefone(e.target.value)}
                            className="w-full h-11 border rounded-lg px-4 bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cargo / Setor</label>
                          <input
                            type="text"
                            placeholder="Ex: Enfermeiro da UTI, Administrativo"
                            value={cargo}
                            onChange={(e) => setCargo(e.target.value)}
                            className="w-full h-11 border rounded-lg px-4 bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {/* ── PASSO 4: SUCESSO E PROTOCOLO ── */}
            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-6 space-y-8"
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="h-16 w-16 bg-emerald-500/10 text-emerald-600 rounded-full border border-emerald-500/20 flex items-center justify-center shadow-inner animate-bounce">
                    <ShieldCheck className="h-10 w-10" />
                  </div>
                  <h2 className="text-3xl font-extrabold text-foreground">Relato Recebido com Sucesso!</h2>
                  <p className="text-muted-foreground text-sm max-w-md mx-auto leading-relaxed font-medium">
                    Agradecemos o seu compromisso com a ética e a segurança no Hospital Santa Casa. Seu relato foi gravado com segurança e encaminhado para análise confidencial.
                  </p>
                </div>

                {/* Protocolo Gerado Box */}
                <div className="max-w-md mx-auto bg-muted/30 border border-border rounded-2xl p-6 space-y-4">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">Seu Protocolo de Acompanhamento</span>
                    <span className="text-sm text-muted-foreground block">Guarde este código em local seguro. Ele será necessário para consultar o andamento do seu relato.</span>
                  </div>

                  <div className="flex items-center justify-between gap-3 bg-background border border-border rounded-xl px-4 py-3 font-mono text-lg font-bold text-foreground relative overflow-hidden group shadow-sm">
                    <span className="tracking-wider select-all">{protocoloGerado}</span>
                    <button
                      type="button"
                      onClick={handleCopiarProtocolo}
                      className="inline-flex h-9 items-center justify-center gap-1.5 px-3 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold transition-all"
                    >
                      {copied ? (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          Copiado!
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          Copiar
                        </>
                      )}
                    </button>
                  </div>

                  <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/5 border border-amber-500/10 text-left text-amber-800 dark:text-amber-400 text-xs">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-foreground font-bold">Atenção:</strong> Por motivos de segurança e privacidade absoluta do canal ético, não enviamos e-mails de confirmação contendo este código (especialmente para relatos anônimos). Salve-o ou anote-o agora.
                    </span>
                  </div>
                </div>

                {/* Botões Finais */}
                <div className="pt-4 flex justify-center gap-3">
                  <button
                    onClick={() => navigate('/escuta-santa-casa')}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-primary-foreground text-sm font-semibold shadow hover:opacity-95 transition-all"
                  >
                    Voltar para o Início do Canal
                  </button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* ── BOTÕES DE NAVEGAÇÃO DO FORMULÁRIO ── */}
        {step < 4 && (
          <div className="px-6 py-4 bg-muted/30 border-t flex justify-between gap-3">
            <button
              onClick={handlePrevStep}
              disabled={step === 1}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-secondary hover:bg-muted text-foreground border text-sm font-semibold transition-all px-4 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowLeft className="h-4 w-4" />
              Anterior
            </button>

            <button
              onClick={handleNextStep}
              disabled={isNextDisabled()}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold transition-all px-5 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow active:scale-98"
            >
              {step === 3 ? 'Enviar Denúncia' : 'Avançar'}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
