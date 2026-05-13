import React, { useState } from 'react';
import { X, RefreshCcw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface SyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function SyncModal({ isOpen, onClose, onSuccess }: SyncModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSync = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Dispara a chamada para a Edge Function que se comunica com o n8n e atualiza o banco
      const { data, error: fnError } = await supabase.functions.invoke('trigger_n8n_sync_pacientes', {
        method: 'POST',
      });

      if (fnError) {
        throw new Error(fnError.message || 'Erro ao comunicar com a Edge Function.');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setSuccess(`Sincronização concluída! ${data?.upserted || 0} registros atualizados.`);
      
      // Fecha o modal após 2 segundos de sucesso e atualiza a grid
      setTimeout(() => {
        onSuccess();
        onClose();
        setSuccess(null);
      }, 2000);
      
    } catch (err: any) {
      console.error('Erro na sincronização:', err);
      setError(err.message || 'Falha ao sincronizar dados do n8n.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-md rounded-xl border shadow-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-muted/20">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <RefreshCcw className="h-5 w-5 text-primary" />
            Sincronizar Pacientes
          </h2>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-muted-foreground hover:bg-muted p-1.5 rounded-md transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {!success ? (
            <div className="flex flex-col gap-4">
              <div className="flex gap-3 text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-950/30 p-4 rounded-lg border border-amber-200 dark:border-amber-900/50">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <p className="text-sm">
                  Esta ação fará o sistema consultar os dados atualizados do hospital através do n8n.
                  Pacientes novos serão inseridos, pacientes existentes terão seus dados atualizados e pacientes que já receberam alta não constarão mais como ativos.
                </p>
              </div>

              {error && (
                <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg dark:bg-red-950/30 dark:border-red-900/50 dark:text-red-400">
                  {error}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 py-6 text-green-600 dark:text-green-500">
              <CheckCircle2 className="h-12 w-12 animate-in zoom-in duration-300" />
              <p className="font-medium text-center">{success}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {!success && (
          <div className="flex items-center justify-end gap-2 p-4 border-t bg-muted/10">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium hover:bg-muted rounded-md transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSync}
              disabled={loading}
              className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 shadow-sm"
            >
              {loading ? (
                <>
                  <RefreshCcw className="h-4 w-4 animate-spin" />
                  Sincronizando...
                </>
              ) : (
                'Iniciar Sincronização'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
