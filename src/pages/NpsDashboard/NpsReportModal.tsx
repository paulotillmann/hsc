import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Mail,
  Calendar,
  Eye,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  ArrowLeft
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { PeriodOption, DateRange } from './types';
import {
  fetchNpsReportData,
  buildNpsReportHtml,
  sendNpsReportEmail,
  NpsReportData
} from '../../services/npsReportEmailService';

interface NpsReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultPeriod?: PeriodOption;
  defaultCustomRange?: DateRange;
}

export const NpsReportModal: React.FC<NpsReportModalProps> = ({
  isOpen,
  onClose,
  defaultPeriod = '30d',
  defaultCustomRange
}) => {
  const { user, profile } = useAuth();

  // Estados do formulário
  const [selectedPreset, setSelectedPreset] = useState<PeriodOption>(defaultPeriod);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [periodoLabel, setPeriodoLabel] = useState<string>('Últimos 30 dias');
  const [recipientsInput, setRecipientsInput] = useState<string>('');
  const [customSubject, setCustomSubject] = useState<string>('');
  const [showSubjectInput, setShowSubjectInput] = useState<boolean>(false);

  // Estados de execução
  const [sending, setSending] = useState<boolean>(false);
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<NpsReportData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState<{
    recipientsCount: number;
    recipients: string[];
  } | null>(null);

  // Inicializa datas com base no preset selecionado
  useEffect(() => {
    if (!isOpen) return;

    const now = new Date();
    const formatDateInput = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    let start = new Date(now);
    let end = new Date(now);
    let label = 'Últimos 30 dias';

    switch (selectedPreset) {
      case 'today':
        label = `Hoje (${now.toLocaleDateString('pt-BR')})`;
        break;
      case 'yesterday':
        start.setDate(now.getDate() - 1);
        end.setDate(now.getDate() - 1);
        label = `Ontem (${start.toLocaleDateString('pt-BR')})`;
        break;
      case '7d':
        start.setDate(now.getDate() - 7);
        label = `Últimos 7 dias (${start.toLocaleDateString('pt-BR')} a ${end.toLocaleDateString('pt-BR')})`;
        break;
      case '30d':
        start.setDate(now.getDate() - 30);
        label = `Últimos 30 dias (${start.toLocaleDateString('pt-BR')} a ${end.toLocaleDateString('pt-BR')})`;
        break;
      case 'this_month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        label = `Este Mês (${now.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })})`;
        break;
      case 'last_month':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
        label = `Mês Anterior (${start.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })})`;
        break;
      case 'this_year':
        start = new Date(now.getFullYear(), 0, 1);
        label = `Ano de ${now.getFullYear()}`;
        break;
      case 'custom':
        if (defaultCustomRange?.startDate && defaultCustomRange?.endDate) {
          setStartDate(defaultCustomRange.startDate);
          setEndDate(defaultCustomRange.endDate);
          const d1 = new Date(`${defaultCustomRange.startDate}T00:00:00`);
          const d2 = new Date(`${defaultCustomRange.endDate}T00:00:00`);
          setPeriodoLabel(`${d1.toLocaleDateString('pt-BR')} a ${d2.toLocaleDateString('pt-BR')}`);
          return;
        }
        break;
    }

    setStartDate(formatDateInput(start));
    setEndDate(formatDateInput(end));
    setPeriodoLabel(label);
  }, [selectedPreset, isOpen, defaultCustomRange]);

  // Pré-preenche e-mail do usuário logado se vazio
  useEffect(() => {
    if (isOpen && !recipientsInput) {
      const emailUser = profile?.email || user?.email || '';
      if (emailUser) {
        setRecipientsInput(emailUser);
      }
    }
  }, [isOpen, profile, user, recipientsInput]);

  // Lista de e-mails limpos e validados
  const parsedRecipients = useMemo(() => {
    if (!recipientsInput) return [];
    const parts = recipientsInput.split(/[,;\s\n\r]+/);
    const valid: string[] = [];
    for (const p of parts) {
      const match = p.match(/<([^>]+)>/);
      const emailCandidate = (match ? match[1] : p).trim();
      const clean = emailCandidate.replace(/[<>'"\(\)\s]/g, '').toLowerCase();
      if (clean && /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/.test(clean)) {
        if (!valid.includes(clean)) valid.push(clean);
      }
    }
    return valid;
  }, [recipientsInput]);

  // Gerar pré-visualização HTML
  const handleGeneratePreview = async () => {
    if (!startDate || !endDate) {
      setErrorMsg('Por favor, informe a Data Inicial e a Data Final.');
      return;
    }
    setPreviewLoading(true);
    setErrorMsg(null);
    try {
      const data = await fetchNpsReportData({
        startDate,
        endDate,
        periodoLabel
      });
      const html = buildNpsReportHtml(data);
      setPreviewData(data);
      setPreviewHtml(html);
    } catch (err: any) {
      console.error('Erro ao gerar preview de NPS:', err);
      setErrorMsg(err.message || 'Erro ao consultar indicadores do período.');
    } finally {
      setPreviewLoading(false);
    }
  };

  // Enviar relatório por e-mail
  const handleSendEmail = async () => {
    if (parsedRecipients.length === 0) {
      setErrorMsg('Informe ao menos um endereço de e-mail válido para destinatário.');
      return;
    }
    if (!startDate || !endDate) {
      setErrorMsg('Informe as datas de início e fim do relatório.');
      return;
    }

    setSending(true);
    setErrorMsg(null);

    try {
      const res = await sendNpsReportEmail({
        to: parsedRecipients,
        startDate,
        endDate,
        periodoLabel,
        customSubject: customSubject.trim() ? customSubject.trim() : undefined
      });

      if (!res.success) {
        throw new Error(res.error || 'Falha ao enviar e-mail.');
      }

      setSendSuccess({
        recipientsCount: res.recipientsCount || parsedRecipients.length,
        recipients: res.recipients || parsedRecipients
      });
    } catch (err: any) {
      console.error('Erro ao enviar relatório de NPS:', err);
      setErrorMsg(err.message || 'Ocorreu um erro ao enviar o relatório por e-mail.');
    } finally {
      setSending(false);
    }
  };

  const handleReset = () => {
    setSendSuccess(null);
    setPreviewHtml(null);
    setPreviewData(null);
    setErrorMsg(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-50 p-3 md:p-6 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-card text-card-foreground rounded-2xl w-full max-w-3xl shadow-2xl border border-border overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Cabeçalho do Modal */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-foreground tracking-tight flex items-center gap-2">
                Relatório de Indicadores NPS por E-mail
              </h2>
              <p className="text-xs text-muted-foreground font-medium">
                Gere e envie o relatório executivo completo em HTML com KPIs, gráficos e comentários
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground rounded-xl hover:bg-muted transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo Principal */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {errorMsg && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-sm font-semibold flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="flex-1">
                <strong className="block font-bold">Atenção</strong>
                <span>{errorMsg}</span>
              </div>
            </div>
          )}

          {sendSuccess ? (
            /* Tela de Confirmação de Sucesso */
            <div className="py-8 px-4 text-center space-y-5 animate-in zoom-in-95 duration-150">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-extrabold text-foreground">Relatório Enviado com Sucesso!</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  O relatório de NPS para o período <strong>{periodoLabel}</strong> foi enviado via SMTP corporativo.
                </p>
              </div>

              <div className="bg-muted/50 border border-border rounded-xl p-4 max-w-md mx-auto text-left space-y-2 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Destinatários ({sendSuccess.recipientsCount}):</span>
                </div>
                <div className="flex flex-wrap gap-1.5 font-mono">
                  {sendSuccess.recipients.map((em, idx) => (
                    <span key={idx} className="bg-background px-2.5 py-1 rounded-md border border-border text-foreground">
                      {em}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex justify-center gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-muted hover:bg-muted/80 text-foreground transition-colors cursor-pointer"
                >
                  Enviar Outro Relatório
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors cursor-pointer"
                >
                  Concluir e Fechar
                </button>
              </div>
            </div>
          ) : previewHtml ? (
            /* Visualização Prévia do HTML */
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-muted/40 p-3 rounded-xl border border-border">
                <button
                  type="button"
                  onClick={() => setPreviewHtml(null)}
                  className="flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Voltar para configurações
                </button>
                <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                  <Sparkles className="w-4 h-4 text-emerald-500" />
                  Pré-visualização do e-mail HTML
                </div>
              </div>

              {previewData && (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
                  <div className="bg-muted/30 p-2.5 rounded-xl border border-border">
                    <span className="text-muted-foreground block text-[10px] uppercase font-bold">NPS Score</span>
                    <strong className="text-base text-foreground font-black">
                      {previewData.npsScore > 0 ? `+${previewData.npsScore}` : previewData.npsScore}
                    </strong>
                  </div>
                  <div className="bg-muted/30 p-2.5 rounded-xl border border-border">
                    <span className="text-muted-foreground block text-[10px] uppercase font-bold">Pesquisas (Pessoas)</span>
                    <strong className="text-base text-foreground font-black">{previewData.totalRespondentes}</strong>
                  </div>
                  <div className="bg-muted/30 p-2.5 rounded-xl border border-border">
                    <span className="text-muted-foreground block text-[10px] uppercase font-bold">Promotores</span>
                    <strong className="text-base text-emerald-600 font-black">{previewData.promotoresPct}%</strong>
                  </div>
                  <div className="bg-muted/30 p-2.5 rounded-xl border border-border">
                    <span className="text-muted-foreground block text-[10px] uppercase font-bold">Setores</span>
                    <strong className="text-base text-sky-600 font-black">{previewData.distribuicaoSetores.length}</strong>
                  </div>
                  <div className="bg-muted/30 p-2.5 rounded-xl border border-border">
                    <span className="text-muted-foreground block text-[10px] uppercase font-bold">Comentários</span>
                    <strong className="text-base text-foreground font-black">{previewData.comentarios.length}</strong>
                  </div>
                </div>
              )}

              <div className="border border-border rounded-xl overflow-hidden bg-slate-100 shadow-inner">
                <iframe
                  title="Prévia do Relatório NPS"
                  srcDoc={previewHtml}
                  className="w-full h-[460px] border-none bg-slate-100"
                />
              </div>
            </div>
          ) : (
            /* Formulário de Configuração */
            <>
              {/* 1. Seleção de Período */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <Calendar className="w-4 h-4 text-emerald-500" />
                  1. Período do Relatório
                </label>

                {/* Presets em Grade */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'today', label: 'Hoje' },
                    { id: 'yesterday', label: 'Ontem' },
                    { id: '7d', label: 'Últimos 7 dias' },
                    { id: '30d', label: 'Últimos 30 dias' },
                    { id: 'this_month', label: 'Este Mês' },
                    { id: 'last_month', label: 'Mês Anterior' },
                    { id: 'this_year', label: 'Este Ano' },
                    { id: 'custom', label: 'Personalizado' }
                  ].map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setSelectedPreset(preset.id as PeriodOption)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                        selectedPreset === preset.id
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-muted/40 hover:bg-muted text-foreground border-border'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {/* Datas Início e Fim */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">
                      Data Inicial
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        setSelectedPreset('custom');
                        setPeriodoLabel(`Personalizado: ${e.target.value} a ${endDate}`);
                      }}
                      className="w-full p-2.5 rounded-xl border border-border bg-background text-foreground text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">
                      Data Final
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => {
                        setEndDate(e.target.value);
                        setSelectedPreset('custom');
                        setPeriodoLabel(`Personalizado: ${startDate} a ${e.target.value}`);
                      }}
                      className="w-full p-2.5 rounded-xl border border-border bg-background text-foreground text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium bg-muted/30 px-3 py-2 rounded-xl border border-border/60">
                  <Clock className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Rótulo no relatório: <strong>{periodoLabel}</strong></span>
                </div>
              </div>

              {/* 2. Destinatários de E-mail */}
              <div className="space-y-2 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    <Mail className="w-4 h-4 text-emerald-500" />
                    2. Destinatários do E-mail
                  </label>
                  <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    {parsedRecipients.length} destinatário{parsedRecipients.length === 1 ? '' : 's'} detectado{parsedRecipients.length === 1 ? '' : 's'}
                  </span>
                </div>

                <textarea
                  rows={2}
                  value={recipientsInput}
                  onChange={(e) => setRecipientsInput(e.target.value)}
                  placeholder="exemplo@santacasaaraguari.com.br, diretoria@santacasaaraguari.com.br"
                  className="w-full p-3 rounded-xl border border-border bg-background text-foreground text-sm outline-none focus:ring-2 focus:ring-emerald-500 font-sans"
                />
                <p className="text-[11px] text-muted-foreground">
                  Separe múltiplos e-mails por vírgula ou ponto-e-vírgula. O e-mail do seu usuário logado já foi preenchido por padrão.
                </p>
              </div>

              {/* 3. Assunto Opcional Customizado */}
              <div className="pt-2 border-t border-border space-y-2">
                <button
                  type="button"
                  onClick={() => setShowSubjectInput(!showSubjectInput)}
                  className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  {showSubjectInput ? '- Ocultar personalização de assunto' : '+ Personalizar assunto do e-mail (opcional)'}
                </button>

                {showSubjectInput && (
                  <div className="animate-in fade-in duration-100">
                    <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">
                      Assunto Personalizado
                    </label>
                    <input
                      type="text"
                      value={customSubject}
                      onChange={(e) => setCustomSubject(e.target.value)}
                      placeholder={`Relatório de Indicadores NPS (${periodoLabel}) | Hospital Santa Casa`}
                      className="w-full p-2.5 rounded-xl border border-border bg-background text-foreground text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Rodapé com Botões de Ação */}
        <div className="px-6 py-4 border-t border-border bg-muted/20 flex flex-wrap items-center justify-between gap-3">
          <div>
            {previewHtml && (
              <button
                type="button"
                onClick={() => setPreviewHtml(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                ← Voltar
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={sending || previewLoading}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>

            {!sendSuccess && !previewHtml && (
              <button
                type="button"
                onClick={handleGeneratePreview}
                disabled={sending || previewLoading || !startDate || !endDate}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-muted hover:bg-muted/80 text-foreground border border-border transition-all cursor-pointer disabled:opacity-50"
              >
                {previewLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                    <span>Carregando Prévia...</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4 text-emerald-500" />
                    <span>Pré-visualizar HTML</span>
                  </>
                )}
              </button>
            )}

            {!sendSuccess && (
              <button
                type="button"
                onClick={handleSendEmail}
                disabled={sending || previewLoading || parsedRecipients.length === 0}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Disparando E-mail...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Enviar Relatório por E-mail</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
