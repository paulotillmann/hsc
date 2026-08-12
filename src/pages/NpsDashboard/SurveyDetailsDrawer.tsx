import React from 'react';
import { X, Star, Calendar, MessageSquare, CheckCircle, AlertTriangle, Smile, User, Phone, MapPin } from 'lucide-react';
import { SurveyDetail } from './types';

interface SurveyDetailsDrawerProps {
  detail: SurveyDetail | null;
  loading: boolean;
  onClose: () => void;
}

export const SurveyDetailsDrawer: React.FC<SurveyDetailsDrawerProps> = ({
  detail,
  loading,
  onClose
}) => {
  if (!detail && !loading) return null;

  const formatDate = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleString('pt-BR');
    } catch {
      return isoString;
    }
  };

  const hasValidName = detail?.nome && detail.nome.trim() && detail.nome.trim().toUpperCase() !== 'NÃO INFORMADO';
  const hasValidPhone = detail?.telefone && detail.telefone.trim() && detail.telefone.trim().toUpperCase() !== 'NÃO INFORMADO';
  const hasValidAddress = detail?.endereco && detail.endereco.trim() && detail.endereco.trim().toUpperCase() !== 'NÃO INFORMADO';

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-card h-full shadow-2xl flex flex-col justify-between border-l border-border animate-in slide-in-from-right duration-300">
        <div className="p-6 border-b border-border flex items-center justify-between bg-muted/30">
          <div>
            <h2 className="text-lg font-bold text-foreground">Detalhes da Pesquisa</h2>
            <p className="text-xs text-muted-foreground font-semibold mt-0.5">
              Visualização individual das respostas do participante
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {loading ? (
            <div className="py-20 text-center text-muted-foreground text-sm font-semibold animate-pulse">
              Carregando detalhes da pesquisa...
            </div>
          ) : detail ? (
            <>
              {/* Card Nota NPS */}
              <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-sm border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    Nota NPS Recomendação
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-4xl font-black text-white">
                      {detail.npsScore !== undefined ? detail.npsScore : '-'}
                    </span>
                    <span className="text-xs text-slate-400">/ 10</span>
                  </div>
                </div>

                <div>
                  {detail.npsClassification === 'promoter' && (
                    <span className="bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4" /> Promotor
                    </span>
                  )}
                  {detail.npsClassification === 'neutral' && (
                    <span className="bg-amber-500 text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5">
                      <Smile className="w-4 h-4" /> Neutro
                    </span>
                  )}
                  {detail.npsClassification === 'detractor' && (
                    <span className="bg-rose-600 text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4" /> Detrator
                    </span>
                  )}
                </div>
              </div>

              {/* Bloco de Dados Pessoais / Identificação */}
              <div className="bg-muted/40 p-4 rounded-xl border border-border text-xs space-y-3">
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <span className="font-extrabold text-foreground uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <User className="w-4 h-4 text-primary" /> Dados Pessoais do Respondente
                  </span>
                  <span className="text-[11px] text-muted-foreground font-semibold flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" /> Envio: {formatDate(detail.createdAt)}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {/* Nome */}
                  <div>
                    <span className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1 mb-0.5">
                      <User className="w-3 h-3" /> Nome Completo
                    </span>
                    <span className="font-bold text-foreground">
                      {hasValidName ? (
                        detail.nome
                      ) : (
                        <span className="text-muted-foreground/70 font-semibold italic text-[11px]">NÃO INFORMADO</span>
                      )}
                    </span>
                  </div>

                  {/* Telefone */}
                  <div>
                    <span className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1 mb-0.5">
                      <Phone className="w-3 h-3" /> Telefone / Contato
                    </span>
                    <span className="font-bold text-foreground">
                      {hasValidPhone ? (
                        detail.telefone
                      ) : (
                        <span className="text-muted-foreground/70 font-semibold italic text-[11px]">NÃO INFORMADO</span>
                      )}
                    </span>
                  </div>

                  {/* Endereço */}
                  <div className="sm:col-span-2">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1 mb-0.5">
                      <MapPin className="w-3 h-3" /> Endereço / Cidade
                    </span>
                    <span className="font-bold text-foreground">
                      {hasValidAddress ? (
                        detail.endereco
                      ) : (
                        <span className="text-muted-foreground/70 font-semibold italic text-[11px]">NÃO INFORMADO</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Respostas da Pesquisa */}
              <div className="space-y-4 pt-2">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                  Respostas Fornecidas
                </h3>

                {detail.respostas.map((item, idx) => (
                  <div key={item.perguntaId} className="bg-card p-4 rounded-xl border border-border shadow-2xs space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-muted text-muted-foreground text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <p className="text-xs font-bold text-foreground leading-snug">
                        {item.perguntaTitle}
                      </p>
                    </div>

                    <div className="pl-7">
                      {item.type === 'rating' ? (
                        <div className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-900 border border-amber-200 px-3 py-1 rounded-xl text-xs font-extrabold">
                          <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
                          <span>{item.resposta ? `${item.resposta} / 5 Estrelas` : 'Sem resposta'}</span>
                        </div>
                      ) : item.type === 'nps' ? (
                        <span className="text-sm font-extrabold text-foreground bg-muted px-3 py-1 rounded-lg">
                          Nota {item.resposta}
                        </span>
                      ) : item.type === 'multiple_choice' ? (
                        <div className="flex flex-wrap gap-1.5">
                          {Array.isArray(item.resposta) ? (
                            item.resposta.map((opt: string) => (
                              <span key={opt} className="bg-muted text-foreground text-xs font-semibold px-2.5 py-1 rounded-lg border border-border">
                                {opt}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-foreground">{item.resposta || 'Sem resposta'}</span>
                          )}
                        </div>
                      ) : (
                        <div className="bg-muted/40 p-3 rounded-xl border border-border text-xs text-foreground italic font-medium whitespace-pre-wrap">
                          {item.resposta && String(item.resposta).trim().length > 0 ? (
                            `"${item.resposta}"`
                          ) : (
                            <span className="text-muted-foreground not-italic">Nenhum comentário preenchido.</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {detail.duvida && detail.duvida.trim().length > 0 && (
                  <div className="bg-amber-50 dark:bg-amber-950/40 p-4 rounded-xl border border-amber-200 dark:border-amber-800 space-y-1">
                    <p className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                      <MessageSquare className="w-4 h-4 text-amber-600" /> Dúvida ou Solicitação Registrada:
                    </p>
                    <p className="text-xs text-amber-800 dark:text-amber-200 italic pl-5">"{detail.duvida}"</p>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>

        <div className="p-4 border-t border-border bg-muted/30 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-primary text-primary-foreground font-bold text-xs rounded-xl cursor-pointer hover:bg-primary/90 transition-colors"
          >
            Fechar Painel
          </button>
        </div>
      </div>
    </div>
  );
};
