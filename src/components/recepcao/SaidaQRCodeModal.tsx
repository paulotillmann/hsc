import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QrCode, X, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { registrarSaidaVisita, buscarVisitaAbertaPorQRCode, Visita } from '../../services/visitaService';

interface SaidaQRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function SaidaQRCodeModal({ isOpen, onClose, onSuccess }: SaidaQRCodeModalProps) {
  const [qrcode, setQrcode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [visitaEncontrada, setVisitaEncontrada] = useState<Visita | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQrcode('');
      setError(null);
      setSuccess(false);
      setVisitaEncontrada(null);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSearch = async () => {
    if (!qrcode.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const visita = await buscarVisitaAbertaPorQRCode(qrcode.trim());
      if (visita) {
        setVisitaEncontrada(visita);
      } else {
        setError('Nenhuma visita em andamento encontrada para este QR Code.');
        setQrcode('');
        inputRef.current?.focus();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!visitaEncontrada) return;
    setLoading(true);
    setError(null);
    try {
      await registrarSaidaVisita(visitaEncontrada.id);
      setSuccess(true);
      if (onSuccess) onSuccess();
      setTimeout(() => onClose(), 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (visitaEncontrada) {
      handleConfirm();
    } else {
      handleSearch();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-[#1a1f2e] w-full max-w-sm rounded-3xl border border-white/5 shadow-2xl overflow-hidden p-8"
          >
            <div className="flex flex-col items-center text-center">
              {success ? (
                <>
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10 mb-6 border border-emerald-500/20">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-white">
                      <CheckCircle2 className="h-7 w-7" />
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">Saída Registrada!</h3>
                  <p className="text-slate-400 text-sm">A data e hora de saída foram atualizadas com sucesso.</p>
                </>
              ) : (
                <div className="w-full">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      <QrCode className="h-5 w-5 text-amber-500" />
                      Registrar Saída
                    </h3>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  {!visitaEncontrada ? (
                    <form onSubmit={handleSubmit} className="space-y-6">
                      <div className="text-left space-y-2">
                        <label className="text-sm font-medium text-slate-300">
                          Leia o QR Code do crachá
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <QrCode className="h-5 w-5 text-slate-500" />
                          </div>
                          <input
                            ref={inputRef}
                            type="text"
                            value={qrcode}
                            onChange={(e) => setQrcode(e.target.value)}
                            placeholder="Aguardando bip..."
                            className="flex h-14 w-full rounded-2xl border border-white/10 bg-[#242b3d] pl-12 pr-4 py-2 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
                            disabled={loading}
                            autoFocus
                          />
                        </div>
                        <p className="text-[11px] text-slate-500 px-1">
                          O sistema irá localizar a visita ativa vinculada a este código.
                        </p>
                      </div>

                      {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2 text-red-400 text-xs text-left">
                          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          <span>{error}</span>
                        </div>
                      )}

                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={onClose}
                          className="flex-1 h-12 rounded-xl border border-white/10 bg-[#242b3d]/50 text-slate-300 text-sm font-bold hover:bg-[#242b3d] transition-all"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={loading || !qrcode.trim()}
                          className="flex-1 h-12 rounded-xl bg-amber-600 text-white text-sm font-bold hover:bg-amber-700 transition-all shadow-[0_0_20px_rgba(245,158,11,0.2)] disabled:opacity-50"
                        >
                          {loading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : 'Buscar'}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="space-y-6">
                      <p className="text-slate-400 text-sm">
                        Visita encontrada! Confirme os dados:
                      </p>

                      <div className="w-full bg-[#242b3d] rounded-2xl p-4 text-left border border-white/5 space-y-1">
                        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Paciente</p>
                        <p className="text-white font-bold text-sm uppercase truncate mb-2">
                          {visitaEncontrada.paciente}
                        </p>
                        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Entrada</p>
                        <p className="text-slate-300 text-xs">
                          {visitaEncontrada.data_hora_entrada ? new Date(visitaEncontrada.data_hora_entrada).toLocaleString('pt-BR') : '-'}
                        </p>
                      </div>

                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setVisitaEncontrada(null);
                            setQrcode('');
                            setTimeout(() => inputRef.current?.focus(), 100);
                          }}
                          disabled={loading}
                          className="flex-1 h-14 rounded-2xl border border-white/10 bg-[#242b3d]/50 text-slate-300 text-sm font-bold hover:bg-[#242b3d] transition-all"
                        >
                          Trocar
                        </button>
                        <button
                          onClick={handleConfirm}
                          disabled={loading}
                          className="flex-2 px-6 h-14 rounded-2xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] disabled:opacity-50"
                        >
                          {loading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : 'Confirmar Saída'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
