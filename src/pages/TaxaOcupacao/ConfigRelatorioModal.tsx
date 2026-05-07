import React, { useEffect, useState } from 'react';
import { X, Clock, Mail, Send, Loader2, CheckCircle2, XCircle, Settings2, Plus, Trash2, ToggleLeft, ToggleRight, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface ConfigRelatorioModalProps {
  open: boolean;
  onClose: () => void;
}

interface RelatorioConfig {
  id: string;
  horario_envio_1: string;
  horario_envio_2: string;
  horario_lancamento_1: string;
  horario_lancamento_2: string;
  emails_geral: string[];
  emails_sus: string[];
  ativo: boolean;
}

interface RelatorioLog {
  id: string;
  data_referencia: string;
  horario_envio: string;
  horario_lancamento: string;
  categoria: string;
  emails_enviados: string[];
  status: string;
  error_message: string | null;
  created_at: string;
}

export default function ConfigRelatorioModal({ open, onClose }: ConfigRelatorioModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [config, setConfig] = useState<RelatorioConfig | null>(null);
  const [logs, setLogs] = useState<RelatorioLog[]>([]);
  const [novoEmailGeral, setNovoEmailGeral] = useState('');
  const [novoEmailSus, setNovoEmailSus] = useState('');

  useEffect(() => {
    if (open) {
      fetchConfig();
      fetchLogs();
    }
  }, [open]);

  async function fetchConfig() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('taxa_relatorio_config')
        .select('*')
        .limit(1)
        .single();

      if (error) throw error;
      setConfig({
        ...data,
        emails_geral: data.emails_geral || [],
        emails_sus: data.emails_sus || [],
      } as RelatorioConfig);
    } catch (err) {
      console.error('Erro ao buscar config:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchLogs() {
    try {
      const { data, error } = await supabase
        .from('taxa_relatorio_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setLogs((data as RelatorioLog[]) || []);
    } catch (err) {
      console.error('Erro ao buscar logs:', err);
    }
  }

  async function handleSave() {
    if (!config) return;
    try {
      setSaving(true);
      const { error } = await supabase
        .from('taxa_relatorio_config')
        .update({
          horario_envio_1: config.horario_envio_1,
          horario_envio_2: config.horario_envio_2,
          horario_lancamento_1: config.horario_lancamento_1,
          horario_lancamento_2: config.horario_lancamento_2,
          emails_geral: config.emails_geral,
          emails_sus: config.emails_sus,
          ativo: config.ativo,
          updated_at: new Date().toISOString(),
        })
        .eq('id', config.id);

      if (error) throw error;
      setTestResult({ success: true, message: 'Configurações salvas com sucesso!' });
      setTimeout(() => setTestResult(null), 3000);
    } catch (err) {
      console.error('Erro ao salvar:', err);
      setTestResult({ success: false, message: 'Erro ao salvar configurações.' });
    } finally {
      setSaving(false);
    }
  }

  async function handleSendTest() {
    if (!config || (config.emails_geral.length === 0 && config.emails_sus.length === 0)) {
      setTestResult({ success: false, message: 'Adicione pelo menos um e-mail antes de testar.' });
      return;
    }
    try {
      setSendingTest(true);
      setTestResult(null);

      // Salva primeiro
      await handleSave();

      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-occupancy-report`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            horario_lancamento: config.horario_lancamento_1,
            horario_envio: 'teste',
            // Envia sem categoria, o backend vai descobrir pelos emails salvos no db
          }),
        }
      );

      const result = await response.json();
      if (response.ok && result.success) {
        setTestResult({ success: true, message: `Relatório(s) enviado(s) com sucesso para ${result.enviados} destinatário(s)!` });
        fetchLogs();
      } else {
        setTestResult({ success: false, message: result.error || 'Erro ao enviar relatório de teste.' });
      }
    } catch (err) {
      console.error('Erro no teste:', err);
      setTestResult({ success: false, message: 'Erro de conexão ao enviar teste.' });
    } finally {
      setSendingTest(false);
    }
  }

  function addEmail(tipo: 'geral' | 'sus') {
    if (!config) return;
    
    const emailInput = tipo === 'geral' ? novoEmailGeral : novoEmailSus;
    if (!emailInput.trim()) return;
    
    const email = emailInput.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!emailRegex.test(email)) {
      setTestResult({ success: false, message: 'E-mail inválido.' });
      setTimeout(() => setTestResult(null), 3000);
      return;
    }
    
    const list = tipo === 'geral' ? config.emails_geral : config.emails_sus;
    
    if (list.includes(email)) {
      setTestResult({ success: false, message: 'E-mail já adicionado nesta lista.' });
      setTimeout(() => setTestResult(null), 3000);
      return;
    }
    
    if (tipo === 'geral') {
      setConfig({ ...config, emails_geral: [...config.emails_geral, email] });
      setNovoEmailGeral('');
    } else {
      setConfig({ ...config, emails_sus: [...config.emails_sus, email] });
      setNovoEmailSus('');
    }
  }

  function removeEmail(tipo: 'geral' | 'sus', email: string) {
    if (!config) return;
    if (tipo === 'geral') {
      setConfig({ ...config, emails_geral: config.emails_geral.filter(e => e !== email) });
    } else {
      setConfig({ ...config, emails_sus: config.emails_sus.filter(e => e !== email) });
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-card rounded-2xl shadow-2xl border border-border w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl">
              <Settings2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Envio Automático de Relatório</h2>
              <p className="text-xs text-muted-foreground">Configure os horários e destinatários do relatório diário</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
            </div>
          ) : config ? (
            <>
              {/* Status Toggle */}
              <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border">
                <div>
                  <p className="font-semibold text-foreground">Envio Automático</p>
                  <p className="text-xs text-muted-foreground">
                    {config.ativo ? 'O relatório será enviado nos horários configurados' : 'O envio automático está desativado'}
                  </p>
                </div>
                <button
                  onClick={() => setConfig({ ...config, ativo: !config.ativo })}
                  className="transition-colors"
                >
                  {config.ativo ? (
                    <ToggleRight className="h-10 w-10 text-emerald-500" />
                  ) : (
                    <ToggleLeft className="h-10 w-10 text-muted-foreground" />
                  )}
                </button>
              </div>

              {/* Horários */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  Horários de Envio
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-muted/20 rounded-xl border space-y-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">1º Envio</p>
                    <div className="space-y-2">
                      <label className="text-xs text-muted-foreground">Horário de envio</label>
                      <input
                        type="time"
                        value={config.horario_envio_1}
                        onChange={(e) => setConfig({ ...config, horario_envio_1: e.target.value })}
                        className="w-full bg-background border rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-primary/30 focus:border-primary"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-muted-foreground">Horário de lançamento (dados)</label>
                      <select
                        value={config.horario_lancamento_1}
                        onChange={(e) => setConfig({ ...config, horario_lancamento_1: e.target.value })}
                        className="w-full bg-background border rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-primary/30 focus:border-primary"
                      >
                        <option value="10:00">10:00</option>
                        <option value="20:00">20:00</option>
                      </select>
                    </div>
                  </div>
                  <div className="p-4 bg-muted/20 rounded-xl border space-y-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">2º Envio</p>
                    <div className="space-y-2">
                      <label className="text-xs text-muted-foreground">Horário de envio</label>
                      <input
                        type="time"
                        value={config.horario_envio_2}
                        onChange={(e) => setConfig({ ...config, horario_envio_2: e.target.value })}
                        className="w-full bg-background border rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-primary/30 focus:border-primary"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-muted-foreground">Horário de lançamento (dados)</label>
                      <select
                        value={config.horario_lancamento_2}
                        onChange={(e) => setConfig({ ...config, horario_lancamento_2: e.target.value })}
                        className="w-full bg-background border rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-primary/30 focus:border-primary"
                      >
                        <option value="10:00">10:00</option>
                        <option value="20:00">20:00</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Listas de E-mails */}
              <div className="space-y-6">
                
                {/* E-mails Geral */}
                <div className="space-y-3 p-4 bg-muted/10 border rounded-xl">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Mail className="h-4 w-4 text-primary" />
                    Destinatários - Hospital Geral
                  </h3>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      placeholder="email@exemplo.com"
                      value={novoEmailGeral}
                      onChange={(e) => setNovoEmailGeral(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addEmail('geral')}
                      className="flex-1 bg-background border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    />
                    <button
                      onClick={() => addEmail('geral')}
                      className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-1"
                    >
                      <Plus className="h-4 w-4" />
                      Adicionar
                    </button>
                  </div>
                  {config.emails_geral.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {config.emails_geral.map((email) => (
                        <div
                          key={email}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-background border rounded-full text-sm"
                        >
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          <span className="text-foreground">{email}</span>
                          <button
                            onClick={() => removeEmail('geral', email)}
                            className="p-0.5 hover:bg-destructive/10 rounded-full transition-colors"
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">Nenhum destinatário adicionado para o Hospital Geral</p>
                  )}
                </div>

                {/* E-mails SUS */}
                <div className="space-y-3 p-4 bg-muted/10 border rounded-xl">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Mail className="h-4 w-4 text-primary" />
                    Destinatários - SUS
                  </h3>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      placeholder="email@exemplo.com"
                      value={novoEmailSus}
                      onChange={(e) => setNovoEmailSus(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addEmail('sus')}
                      className="flex-1 bg-background border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    />
                    <button
                      onClick={() => addEmail('sus')}
                      className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-1"
                    >
                      <Plus className="h-4 w-4" />
                      Adicionar
                    </button>
                  </div>
                  {config.emails_sus.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {config.emails_sus.map((email) => (
                        <div
                          key={email}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-background border rounded-full text-sm"
                        >
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          <span className="text-foreground">{email}</span>
                          <button
                            onClick={() => removeEmail('sus', email)}
                            className="p-0.5 hover:bg-destructive/10 rounded-full transition-colors"
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">Nenhum destinatário adicionado para o SUS</p>
                  )}
                </div>

              </div>

              {/* Feedback */}
              {testResult && (
                <div className={`flex items-center gap-2 p-3 rounded-lg text-sm font-medium ${
                  testResult.success 
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
                    : 'bg-destructive/10 text-destructive border border-destructive/20'
                }`}>
                  {testResult.success ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  {testResult.message}
                </div>
              )}

              {/* Histórico */}
              {logs.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">Últimos Envios</h3>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {logs.map((log) => (
                      <div key={log.id} className="flex items-center justify-between p-2.5 bg-muted/20 rounded-lg border text-xs">
                        <div className="flex items-center gap-2">
                          {log.status === 'success' ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                          )}
                          <span className="text-foreground font-medium">
                            {new Date(log.data_referencia + 'T00:00:00').toLocaleDateString('pt-BR')}
                          </span>
                          <span className="text-muted-foreground">•</span>
                          <span className="text-muted-foreground">{log.horario_lancamento}</span>
                          <span className="text-muted-foreground">•</span>
                          <span className="text-muted-foreground">{log.categoria}</span>
                        </div>
                        <span className="text-muted-foreground">
                          {log.emails_enviados?.length || 0} email(s)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-muted-foreground text-center py-8">Erro ao carregar configurações</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-muted/10">
          <button
            onClick={handleSendTest}
            disabled={sendingTest || !config || (config.emails_geral.length === 0 && config.emails_sus.length === 0)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sendingTest ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Enviar Teste Agora
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
