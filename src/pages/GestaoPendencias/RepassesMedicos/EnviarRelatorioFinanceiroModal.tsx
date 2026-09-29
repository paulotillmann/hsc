import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, Mail, X, CheckCircle2, AlertCircle, Loader2, 
  FileText, Download, Plus, Check, ExternalLink, ShieldCheck
} from 'lucide-react';
import { RepasseItem, RepasseCompetencia } from '../../../services/repasseService';
import { 
  sendRelatorioRepasseFinanceiroEmail, 
  gerarPdfConsolidadoBase64 
} from '../../../services/repasseEmailService';

interface EnviarRelatorioFinanceiroModalProps {
  isOpen: boolean;
  onClose: () => void;
  competencia: RepasseCompetencia;
  itens: RepasseItem[];
  totalBruto: number;
  totalRetencao: number;
  totalLiquido: number;
  onEnviadoComSucesso: () => void;
}

const formatCurrency = (val: number = 0) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
};

const formatDateTime = (dateStr?: string | null) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
};

export const EnviarRelatorioFinanceiroModal: React.FC<EnviarRelatorioFinanceiroModalProps> = ({
  isOpen,
  onClose,
  competencia,
  itens,
  totalBruto,
  totalRetencao,
  totalLiquido,
  onEnviadoComSucesso
}) => {
  // Destinatários padrão: financeiro e contas a pagar
  const [emails, setEmails] = useState<string[]>([
    'financeiro@santacasaaraguari.org.br',
    'contasapagar@santacasaaraguari.org.br'
  ]);
  const [novoEmailInput, setNovoEmailInput] = useState<string>('');
  const [observacoes, setObservacoes] = useState<string>('');
  const [enviando, setEnviando] = useState<boolean>(false);
  const [gerandoPrevia, setGerandoPrevia] = useState<boolean>(false);
  const [statusFeedback, setStatusFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setStatusFeedback(null);
      setNovoEmailInput('');
      setEnviando(false);
      setObservacoes('');

      // Se a competência já tiver destinatários gravados, recupera
      if (competencia.email_enviado_para && competencia.email_enviado_para.length > 0) {
        setEmails([...competencia.email_enviado_para]);
      } else {
        setEmails([
          'financeiro@santacasaaraguari.org.br',
          'contasapagar@santacasaaraguari.org.br'
        ]);
      }
    }
  }, [isOpen, competencia]);

  if (!isOpen) return null;

  const handleAddEmail = () => {
    const limpo = novoEmailInput.trim().toLowerCase();
    if (!limpo || !limpo.includes('@')) return;
    if (!emails.includes(limpo)) {
      setEmails(prev => [...prev, limpo]);
    }
    setNovoEmailInput('');
  };

  const handleRemoveEmail = (indexToRemove: number) => {
    setEmails(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleVisualizarPdf = async () => {
    try {
      setGerandoPrevia(true);
      const dataUri = await gerarPdfConsolidadoBase64(competencia, itens);
      const win = window.open();
      if (win) {
        win.document.write(`<iframe src="${dataUri}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
      }
    } catch (e: any) {
      alert('Erro ao gerar prévia do PDF: ' + (e.message || 'Falha'));
    } finally {
      setGerandoPrevia(false);
    }
  };

  const handleEnviar = async () => {
    const destinatariosValidos = emails.filter(e => e.includes('@'));
    if (destinatariosValidos.length === 0) {
      setStatusFeedback({ type: 'error', message: 'Informe pelo menos um e-mail de destino válido.' });
      return;
    }

    try {
      setEnviando(true);
      setStatusFeedback(null);

      const res = await sendRelatorioRepasseFinanceiroEmail({
        to: destinatariosValidos,
        competencia,
        itens,
        totalBruto,
        totalRetencao,
        totalLiquido,
        observacoes
      });

      if (res.success) {
        setStatusFeedback({
          type: 'success',
          message: `Relatório consolidado enviado com sucesso para ${destinatariosValidos.join(', ')}!`
        });
        onEnviadoComSucesso();
        setTimeout(() => {
          onClose();
        }, 1800);
      } else {
        setStatusFeedback({
          type: 'error',
          message: res.error || 'Erro ao enviar e-mail ao Financeiro.'
        });
      }
    } catch (e: any) {
      setStatusFeedback({
        type: 'error',
        message: e.message || 'Falha inesperada no envio.'
      });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          className="bg-card w-full max-w-xl rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col"
        >
          {/* Topo / Header */}
          <div className="px-6 py-4 bg-muted/40 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                <Send className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Enviar Relatório de Repasse ao Financeiro
                </h3>
                <p className="text-xs text-muted-foreground">
                  {competencia.convenio} • Competência {competencia.competencia}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              disabled={enviando}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Conteúdo */}
          <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
            {/* Card com Resumo do Fechamento */}
            <div className="p-4 bg-background rounded-xl border border-border space-y-3">
              <div className="flex items-center justify-between border-b border-border/60 pb-2">
                <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                  Resumo Contábil da Competência
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
                  NF: {competencia.numero_nota_fiscal || 'Não informada'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Total Bruto:</span>
                  <span className="font-mono font-semibold text-foreground">
                    {formatCurrency(totalBruto)}
                  </span>
                </div>

                <div>
                  <span className="text-muted-foreground block text-[11px]">Retenção Hospitalar:</span>
                  <span className="font-mono font-semibold text-destructive">
                    - {formatCurrency(totalRetencao)}
                  </span>
                </div>

                <div>
                  <span className="text-muted-foreground block text-[11px]">Líquido a Repassar:</span>
                  <span className="font-mono font-bold text-primary">
                    {formatCurrency(totalLiquido)}
                  </span>
                </div>
              </div>

              <div className="text-[11px] text-muted-foreground pt-1 border-t border-border/60 flex items-center justify-between">
                <span>Total de médicos e setores na planilha:</span>
                <strong className="font-mono text-foreground">{itens.length} lançamentos</strong>
              </div>
            </div>

            {/* Aviso se já foi enviado anteriormente */}
            {competencia.email_enviado && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-start gap-2.5 text-xs text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-semibold">Este fechamento já foi enviado anteriormente:</strong>
                  <span>Em {formatDateTime(competencia.email_enviado_em)}</span>
                  {competencia.email_enviado_para && competencia.email_enviado_para.length > 0 && (
                    <span className="block text-[11px] opacity-90 mt-0.5">
                      Para: {competencia.email_enviado_para.join(', ')}
                    </span>
                  )}
                  <span className="block text-[10px] opacity-75 mt-1">
                    Você pode reenviar a qualquer momento com as informações e PDF atualizados.
                  </span>
                </div>
              </div>
            )}

            {/* Remetente e Destinatários */}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Origem / Remetente:
                </label>
                <div className="px-3 py-2 text-xs rounded-xl bg-muted/50 border border-border text-muted-foreground font-mono">
                  faturamento@santacasaaraguari.org.br (Setor de Faturamento HSC)
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                  <span>Destinatários no Financeiro:</span>
                  <span className="text-[11px] font-normal text-muted-foreground">
                    {emails.length} destinatário(s)
                  </span>
                </label>

                {/* Lista de tags de emails */}
                <div className="min-h-[44px] p-2 bg-background rounded-xl border border-border flex flex-wrap gap-1.5 items-center">
                  {emails.map((email, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg bg-primary/10 text-primary border border-primary/20 font-medium font-mono"
                    >
                      {email}
                      <button
                        type="button"
                        onClick={() => handleRemoveEmail(idx)}
                        disabled={enviando}
                        className="hover:text-destructive transition-colors cursor-pointer"
                        title="Remover e-mail"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}

                  {emails.length === 0 && (
                    <span className="text-xs text-muted-foreground italic px-1">
                      Nenhum e-mail adicionado. Digite abaixo para incluir.
                    </span>
                  )}
                </div>

                {/* Input para adicionar mais e-mails */}
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={novoEmailInput}
                    onChange={(e) => setNovoEmailInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddEmail();
                      }
                    }}
                    disabled={enviando}
                    placeholder="Adicionar outro e-mail (ex: diretoria@...) e pressione Enter"
                    className="flex-1 px-3 py-2 text-xs rounded-xl bg-background border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddEmail}
                    disabled={!novoEmailInput.trim() || enviando}
                    className="px-3 py-2 text-xs font-semibold rounded-xl bg-muted hover:bg-muted/80 text-foreground border border-border transition-colors disabled:opacity-50 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Adicionar
                  </button>
                </div>
              </div>
            </div>

            {/* Aviso sobre o PDF Anexo */}
            <div className="p-3 bg-muted/40 rounded-xl border border-border/70 text-xs text-muted-foreground space-y-1">
              <div className="flex items-center gap-1.5 text-foreground font-semibold">
                <FileText className="w-3.5 h-3.5 text-primary" />
                <span>Arquivo Anexo ao E-mail:</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Será anexado o <strong>Relatório Consolidado em PDF</strong> oficial da Santa Casa, contendo a planilha de repasses dos médicos e a discriminação de todos os procedimentos dos setores.
              </p>
            </div>

            {/* Feedback */}
            {statusFeedback && (
              <div
                className={`p-3 rounded-xl border flex items-center gap-2 text-xs ${
                  statusFeedback.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                    : 'bg-destructive/10 border-destructive/30 text-destructive'
                }`}
              >
                {statusFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{statusFeedback.message}</span>
              </div>
            )}
          </div>

          {/* Rodapé / Ações */}
          <div className="px-6 py-4 bg-muted/40 border-t border-border flex items-center justify-between">
            <button
              type="button"
              onClick={handleVisualizarPdf}
              disabled={gerandoPrevia || enviando}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-foreground bg-background hover:bg-muted border border-border rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
              title="Abrir prévia do PDF do relatório"
            >
              {gerandoPrevia ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
              ) : (
                <Download className="w-3.5 h-3.5 text-primary" />
              )}
              <span>Visualizar PDF</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={enviando}
                className="px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground border border-border rounded-xl hover:bg-muted transition-colors disabled:opacity-50 cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleEnviar}
                disabled={emails.length === 0 || enviando}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-primary hover:bg-primary/90 rounded-xl shadow-sm transition-all disabled:opacity-50 cursor-pointer"
              >
                {enviando ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Enviando ao Financeiro...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Disparar ao Financeiro</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
