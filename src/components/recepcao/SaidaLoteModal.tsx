import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, X, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { registrarSaidaLoteVisitantes, SaidaLoteProgress } from '../../services/visitaService';

interface SaidaLoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function SaidaLoteModal({ isOpen, onClose, onSuccess }: SaidaLoteModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [registrosAtualizados, setRegistrosAtualizados] = useState(0);
  const [progress, setProgress] = useState<SaidaLoteProgress | null>(null);

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    setProgress(null);
    try {
      const count = await registrarSaidaLoteVisitantes((p) => setProgress(p));
      setRegistrosAtualizados(count);
      setSuccess(true);
      if (onSuccess) onSuccess();
      
      setTimeout(() => {
        setSuccess(false);
        setProgress(null);
        onClose();
      }, 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    setError(null);
    setSuccess(false);
    setProgress(null);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-[#1a1f2e] w-full max-w-md rounded-3xl border border-white/5 shadow-2xl overflow-hidden p-8"
          >
            <div className="flex flex-col items-center text-center">
              {success ? (
                <>
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10 mb-6 border border-emerald-500/20">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-white">
                      <CheckCircle2 className="h-7 w-7" />
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">Saídas Registradas!</h3>
                  <p className="text-slate-400 text-sm mb-2">
                    Operação concluída com sucesso.
                  </p>
                  <p className="text-amber-400 text-sm font-bold bg-amber-500/10 py-2 px-4 rounded-full">
                    {registrosAtualizados} registro(s) atualizado(s)
                  </p>
                </>
              ) : (
                <div className="w-full">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      <LogOut className="h-5 w-5 text-amber-500" />
                      Encerrar Visitas em Aberto
                    </h3>
                    <button onClick={handleClose} disabled={loading} className="text-slate-500 hover:text-white transition-colors disabled:opacity-50">
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="space-y-6">
                    {loading && progress ? (
                      <div className="bg-[#242b3d] rounded-2xl p-6 text-left border border-white/5 space-y-4">
                        <div className="flex justify-between text-sm text-slate-300 font-medium">
                          <span>{progress.mensagem}</span>
                          <span>{progress.total > 0 ? Math.round((progress.processado / progress.total) * 100) : 0}%</span>
                        </div>
                        <div className="w-full bg-[#1a1f2e] rounded-full h-3 overflow-hidden border border-white/10">
                          <motion.div 
                            className="bg-amber-500 h-full rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: progress.total > 0 ? `${(progress.processado / progress.total) * 100}%` : '0%' }}
                            transition={{ duration: 0.3 }}
                          />
                        </div>
                        <p className="text-xs text-slate-500 text-center animate-pulse">
                          Por favor, não feche esta janela...
                        </p>
                      </div>
                    ) : (
                      <>
                        <p className="text-slate-400 text-sm text-left">
                          Esta ação irá localizar todas as visitas em andamento de pessoas identificadas como <strong className="text-amber-400">VISITANTE</strong> e irá registrar a <strong className="text-white">data e hora atual</strong> como horário de saída para todas elas.
                        </p>

                        <div className="w-full bg-red-500/10 rounded-2xl p-4 text-left border border-red-500/20 flex items-start gap-3">
                          <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                          <p className="text-red-400 text-xs leading-relaxed">
                            <strong>Atenção:</strong> Esta ação é irreversível. Certifique-se de que o horário de visitação já encerrou antes de executar este comando. Acompanhantes não serão afetados.
                          </p>
                        </div>
                      </>
                    )}

                    {error && (
                      <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2 text-red-400 text-xs text-left">
                        <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <span>{error}</span>
                      </div>
                    )}

                    {!loading && (
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={handleClose}
                          disabled={loading}
                          className="flex-1 h-12 rounded-xl border border-white/10 bg-[#242b3d]/50 text-slate-300 text-sm font-bold hover:bg-[#242b3d] transition-all disabled:opacity-50"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={handleConfirm}
                          disabled={loading}
                          className="flex-1 h-12 rounded-xl bg-amber-600 text-white text-sm font-bold hover:bg-amber-700 transition-all shadow-[0_0_20px_rgba(245,158,11,0.2)] disabled:opacity-50"
                        >
                          Confirmar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
