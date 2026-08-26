import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, Mail, MailCheck, CheckCircle2, AlertCircle, Loader2, X, Users, 
  FileText, ArrowRight, ShieldCheck, CheckSquare, Square
} from 'lucide-react';
import { PlantaoMedicoSintetico } from './PlantaoMedico';
import { MedicoContato } from '../../services/plantaoMedicoContatosService';
import { plantaoMedicoProducoesService } from '../../services/plantaoMedicoProducoesService';
import { sendPlantaoMedicoEmail } from '../../services/plantaoEmailService';

interface DisparoEmailLoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  plantaosSinteticos: PlantaoMedicoSintetico[];
  contatosMedicos: MedicoContato[];
  periodoReferencia: string;
  periodoDe?: string;
  periodoAte?: string;
  onEmailsDisparados?: () => void;
}

export const DisparoEmailLoteModal: React.FC<DisparoEmailLoteModalProps> = ({
  isOpen,
  onClose,
  plantaosSinteticos,
  contatosMedicos,
  periodoReferencia,
  periodoDe,
  periodoAte,
  onEmailsDisparados
}) => {
  // Mapa de e-mails por médico
  const contatosMap = useMemo(() => {
    const map = new Map<string, string[]>();
    contatosMedicos.forEach(c => {
      if (c.nome_medico && c.emails && c.emails.length > 0) {
        map.set(c.nome_medico.toUpperCase().trim(), c.emails);
      }
    });
    return map;
  }, [contatosMedicos]);

  // Lista enriquecida de médicos
  const medicosComStatus = useMemo(() => {
    return plantaosSinteticos.map(item => {
      const emails = contatosMap.get(item.MEDICO.toUpperCase().trim()) || [];
      return {
        item,
        temEmail: emails.length > 0,
        emails
      };
    });
  }, [plantaosSinteticos, contatosMap]);

  // Médicos selecionados para o disparo (IDs)
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    return medicosComStatus.filter(m => m.temEmail).map(m => m.item.id);
  });

  // Atualizar seleção padrão ao abrir
  React.useEffect(() => {
    if (isOpen) {
      setSelectedIds(medicosComStatus.filter(m => m.temEmail).map(m => m.item.id));
      setDisparando(false);
      setLogs([]);
      setProgress({ total: 0, current: 0 });
    }
  }, [isOpen, medicosComStatus]);

  // Estado do processo de envio
  const [disparando, setDisparando] = useState<boolean>(false);
  const [progress, setProgress] = useState<{ total: number; current: number }>({ total: 0, current: 0 });
  const [logs, setLogs] = useState<{ medico: string; success: boolean; message: string }[]>([]);

  const toggleSelectAll = () => {
    const comEmailIds = medicosComStatus.filter(m => m.temEmail).map(m => m.item.id);
    if (selectedIds.length === comEmailIds.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(comEmailIds);
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleIniciarDisparo = async () => {
    const selecionados = medicosComStatus.filter(m => selectedIds.includes(m.item.id) && m.temEmail);
    if (selecionados.length === 0) return;

    setDisparando(true);
    setLogs([]);
    setProgress({ total: selecionados.length, current: 0 });

    for (let i = 0; i < selecionados.length; i++) {
      const { item, emails } = selecionados[i];
      const basePlantao = item.ITEMS.reduce((acc, p) => acc + p.VALOR, 0);
      const prodVal = item.valorProducaoTotal || 0;

      try {
        const res = await sendPlantaoMedicoEmail({
          to: emails,
          nomeMedico: item.MEDICO,
          periodoReferencia,
          tipoPlantao: item.TIPO_PLANTAO,
          resumo: {
            totalPlantoes: item.QTD_PLANTOES,
            valorPlantoes: basePlantao,
            valorProducao: prodVal,
            valorTotalGeral: item.VALOR_TOTAL,
            valorPago: item.valorPago || 0,
            valorPendente: item.valorPendente || 0,
            status: item.status,
            tipoPlantao: item.TIPO_PLANTAO
          },
          sinteticoItem: item
        });

        if (res.success) {
          if (periodoDe && periodoAte) {
            try {
              await plantaoMedicoProducoesService.registrarEnvioEmail({
                medico: item.MEDICO,
                especialidade: item.ESPECIALIDADE,
                tipo_plantao: item.TIPO_PLANTAO,
                periodo_de: periodoDe,
                periodo_ate: periodoAte,
                destinatarios: emails
              });
            } catch (errDb) {
              console.warn('Erro ao registrar envio no Supabase (Lote):', errDb);
            }
          }

          setLogs(prev => [...prev, {
            medico: item.MEDICO,
            success: true,
            message: `Enviado com sucesso para ${emails.join(', ')}`
          }]);
        } else {
          setLogs(prev => [...prev, {
            medico: item.MEDICO,
            success: false,
            message: res.error || 'Erro no envio'
          }]);
        }
      } catch (err: any) {
        setLogs(prev => [...prev, {
          medico: item.MEDICO,
          success: false,
          message: err.message || 'Falha inesperada'
        }]);
      }

      setProgress({ total: selecionados.length, current: i + 1 });
    }

    setDisparando(false);
    onEmailsDisparados?.();
  };

  if (!isOpen) return null;

  const totalComEmail = medicosComStatus.filter(m => m.temEmail).length;
  const totalSemEmail = medicosComStatus.length - totalComEmail;
  const percentual = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 10 }}
        className="bg-card dark:bg-slate-900 border border-border w-full max-w-3xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-foreground font-sans"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/40">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#8a1515]/10 dark:bg-[#8a1515]/20 flex items-center justify-center text-[#8a1515] dark:text-[#f43f5e] border border-[#8a1515]/20">
              <Send className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Disparo de Relatórios por E-mail</h2>
              <p className="text-xs text-muted-foreground">
                Remetente: <span className="font-semibold text-foreground">financeiro@santacasaaraguari.org.br</span> • Período: <span className="font-semibold text-[#8a1515] dark:text-[#f43f5e]">{periodoReferencia}</span>
              </p>
            </div>
          </div>
          {!disparando && (
            <button
              onClick={onClose}
              className="h-9 w-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Resumo e Estatísticas */}
        <div className="p-6 space-y-4 flex-1 min-h-0 overflow-y-auto">
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-muted/40 border border-border rounded-xl">
              <span className="text-[11px] text-muted-foreground font-semibold block">Total de Médicos</span>
              <span className="text-xl font-bold text-foreground font-mono">{medicosComStatus.length}</span>
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-xl">
              <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold block">Com E-mails</span>
              <span className="text-xl font-bold text-emerald-700 dark:text-emerald-400 font-mono">{totalComEmail}</span>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl">
              <span className="text-[11px] text-amber-700 dark:text-amber-400 font-semibold block">Sem E-mail Cadastrado</span>
              <span className="text-xl font-bold text-amber-700 dark:text-amber-400 font-mono">{totalSemEmail}</span>
            </div>
          </div>

          {/* Barra de Progresso durante o disparo */}
          {disparando && (
            <div className="p-4 bg-muted/60 border border-border rounded-xl space-y-2 animate-in fade-in">
              <div className="flex justify-between items-center text-xs font-semibold">
                <span className="flex items-center gap-2 text-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-[#8a1515]" />
                  Enviando relatórios... ({progress.current} de {progress.total})
                </span>
                <span className="font-mono text-[#8a1515] font-bold">{percentual}%</span>
              </div>
              <div className="w-full h-2.5 bg-background rounded-full overflow-hidden border border-border">
                <div 
                  className="h-full bg-[#8a1515] transition-all duration-300 rounded-full"
                  style={{ width: `${percentual}%` }}
                />
              </div>
            </div>
          )}

          {/* Lista de Médicos com Checkbox */}
          <div className="border border-border rounded-xl overflow-hidden bg-background">
            <div className="p-3 bg-muted/40 border-b border-border flex items-center justify-between">
              <button
                type="button"
                onClick={toggleSelectAll}
                disabled={disparando || totalComEmail === 0}
                className="flex items-center gap-2 text-xs font-bold text-foreground hover:text-[#8a1515] transition-colors cursor-pointer disabled:opacity-50"
              >
                {selectedIds.length === totalComEmail && totalComEmail > 0 ? (
                  <CheckSquare className="h-4 w-4 text-[#8a1515]" />
                ) : (
                  <Square className="h-4 w-4 text-muted-foreground" />
                )}
                <span>Selecionar Todos com E-mail ({selectedIds.length}/{totalComEmail})</span>
              </button>
            </div>

            <div className="max-h-[260px] overflow-y-auto divide-y divide-border/60">
              {medicosComStatus.map(({ item, temEmail, emails }) => {
                const isSelected = selectedIds.includes(item.id);
                return (
                  <div 
                    key={item.id}
                    className={`p-3 flex items-center justify-between gap-3 text-xs transition-colors ${
                      !temEmail ? 'opacity-50 bg-muted/10' : isSelected ? 'bg-[#8a1515]/5' : 'hover:bg-muted/30'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        type="button"
                        disabled={!temEmail || disparando}
                        onClick={() => toggleSelectOne(item.id)}
                        className="cursor-pointer disabled:cursor-not-allowed"
                      >
                        {isSelected ? (
                          <CheckSquare className="h-4 w-4 text-[#8a1515]" />
                        ) : (
                          <Square className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-foreground truncate">{item.MEDICO}</span>
                          {item.emailEnviado && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              <MailCheck className="h-3 w-3" />
                              Já enviado
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {temEmail ? emails.join(', ') : '⚠️ Nenhum e-mail cadastrado'}
                        </div>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <div className="font-bold font-mono text-foreground">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.VALOR_TOTAL)}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {item.QTD_PLANTOES} plantão(ões)
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Logs de Envio */}
          {logs.length > 0 && (
            <div className="space-y-1.5 pt-2">
              <h4 className="text-xs font-bold text-muted-foreground uppercase">Resultado dos Envios ({logs.length})</h4>
              <div className="max-h-[140px] overflow-y-auto space-y-1 p-2 bg-muted/30 border border-border rounded-xl">
                {logs.map((log, idx) => (
                  <div 
                    key={idx} 
                    className={`p-2 rounded-lg text-xs flex items-center justify-between border ${
                      log.success 
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {log.success ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                      <span className="font-semibold">{log.medico}</span>
                    </div>
                    <span className="text-[11px]">{log.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer com Ações */}
        <div className="flex items-center justify-between p-4 border-t border-border bg-muted/20">
          <button
            type="button"
            onClick={onClose}
            disabled={disparando}
            className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer"
          >
            {logs.length > 0 ? 'Fechar' : 'Cancelar'}
          </button>

          <button
            type="button"
            onClick={handleIniciarDisparo}
            disabled={disparando || selectedIds.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#8a1515] hover:bg-[#701010] text-white text-xs font-bold rounded-lg shadow-md hover:shadow transition-all disabled:opacity-50 cursor-pointer"
          >
            {disparando ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Disparando ({progress.current}/{progress.total})...</span>
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                <span>Enviar Demonstrativos ({selectedIds.length})</span>
              </>
            )}
          </button>
        </div>

      </motion.div>
    </div>
  );
};
