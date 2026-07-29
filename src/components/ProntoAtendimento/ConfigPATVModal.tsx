import React, { useState, useEffect } from 'react';
import { X, Tv, Video, MessageSquare, Save, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { fetchPATvSettings, savePATvSettings } from '../../services/paTvService';
import { useAuth } from '../../contexts/AuthContext';

interface ConfigPATVModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ConfigPATVModal: React.FC<ConfigPATVModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [videoUrl, setVideoUrl] = useState('');
  const [tickerText, setTickerText] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const config = await fetchPATvSettings();
      setVideoUrl(config.video_url);
      setTickerText(config.ticker_text);
    } catch (err) {
      console.error('Erro ao carregar configurações do Painel TV PA:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const res = await savePATvSettings(videoUrl.trim(), tickerText.trim(), user?.id);

    if (res.success) {
      setMessage({ type: 'success', text: 'Configurações do Painel TV salvas com sucesso!' });
      setTimeout(() => {
        onClose();
      }, 1500);
    } else {
      setMessage({ type: 'error', text: res.error || 'Erro ao salvar configurações.' });
    }
    setSaving(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-card text-card-foreground border border-border w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border bg-muted/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
              <Tv className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">Configurar Painel TV (PA)</h2>
              <p className="text-xs text-muted-foreground">
                Ajuste o vídeo institucional e o letreiro informativo exibidos nos monitores do PA
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSave} className="p-6 space-y-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Carregando configurações...</p>
            </div>
          ) : (
            <>
              {message && (
                <div
                  className={`p-4 rounded-xl text-sm flex items-center gap-3 ${
                    message.type === 'success'
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                      : 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                  }`}
                >
                  {message.type === 'success' ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0" />
                  ) : (
                    <AlertCircle className="h-5 w-5 shrink-0" />
                  )}
                  <span>{message.text}</span>
                </div>
              )}

              {/* Link do Vídeo */}
              <div className="space-y-2">
                <label className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <Video className="h-4 w-4 text-primary" />
                  Link do Vídeo (YouTube)
                </label>
                <input
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Insira um link do YouTube válido (ex: watch?v=... ou youtu.be/...). O vídeo será reproduzido em loop.
                </p>
              </div>

              {/* Frase em Loop */}
              <div className="space-y-2">
                <label className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  Frase em Loop (Letreiro Inferior)
                </label>
                <textarea
                  value={tickerText}
                  onChange={(e) => setTickerText(e.target.value)}
                  rows={4}
                  placeholder="Digite a mensagem que ficará rodando na parte inferior da tela do PA..."
                  className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all resize-none"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Esta mensagem ficará deslizando continuamente da direita para a esquerda no rodapé da TV dos pacientes.
                </p>
              </div>
            </>
          )}

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-input bg-background hover:bg-muted text-sm font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || loading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-bold shadow-md transition-all disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Salvar Configurações
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
