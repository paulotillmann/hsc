import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Save, Send, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2, Server, Mail, Shield } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  fetchSmtpSettings,
  saveSmtpSettings,
  sendTestEmail,
  SmtpSettings,
} from '../services/settingsService';

const Configuracoes: React.FC = () => {
  const { user, profile } = useAuth();

  // ── Estado do formulário ──
  const [settings, setSettings] = useState<SmtpSettings>({
    smtp_host: '',
    smtp_port: '587',
    smtp_user: '',
    smtp_pass: '',
    smtp_from_name: 'Hospital Santa Casa',
    smtp_from_email: '',
    smtp_secure: 'tls',
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // ── Carregar configurações ──
  useEffect(() => {
    (async () => {
      setLoading(true);
      const data = await fetchSmtpSettings();
      setSettings(data);
      setLoading(false);
    })();
  }, []);

  // ── Handlers ──
  const handleChange = (field: keyof SmtpSettings, value: string) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const result = await saveSmtpSettings(settings, user.id);
    setSaving(false);
    if (result.success) {
      showToast('success', 'Configurações SMTP salvas com sucesso!');
    } else {
      showToast('error', result.error || 'Erro ao salvar configurações.');
    }
  };

  const handleTest = async () => {
    if (!profile?.email) {
      showToast('error', 'Seu perfil não possui e-mail cadastrado.');
      return;
    }
    setTesting(true);
    const result = await sendTestEmail(profile.email, profile.full_name || 'Administrador');
    setTesting(false);
    if (result.success) {
      showToast('success', `E-mail de teste enviado para ${profile.email}`);
    } else {
      showToast('error', result.error || 'Falha no envio de teste.');
    }
  };

  // ── Guard: acesso restrito a admins ──
  if (profile && profile.role !== 'admin') {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <Shield className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-40" />
          <h2 className="text-xl font-bold text-foreground">Acesso Restrito</h2>
          <p className="text-sm text-muted-foreground mt-2">Somente administradores podem acessar esta página.</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-2xl"
    >
      {/* ── HEADER ── */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Configurações</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Configuração do servidor de e-mail para envio de documentos
        </p>
      </div>

      {/* ── CARD SMTP ── */}
      <div className="bg-card border border-border shadow-sm rounded-xl overflow-hidden">
        {/* Header do card */}
        <div className="p-5 border-b border-border bg-muted/20 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Server className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">Servidor SMTP</h2>
            <p className="text-xs text-muted-foreground">Credenciais para envio de e-mail</p>
          </div>
        </div>

        {loading ? (
          <div className="p-12 flex flex-col items-center gap-3 text-muted-foreground">
            <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
            Carregando configurações...
          </div>
        ) : (
          <div className="p-6 space-y-5">
            {/* Linha 1: Host + Porta */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                  Servidor SMTP
                </label>
                <input
                  type="text"
                  value={settings.smtp_host}
                  onChange={e => handleChange('smtp_host', e.target.value)}
                  placeholder="mail.santacasaaraguari.org.br"
                  className="w-full bg-background border border-border rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                  Porta
                </label>
                <input
                  type="number"
                  value={settings.smtp_port}
                  onChange={e => handleChange('smtp_port', e.target.value)}
                  placeholder="587"
                  className="w-full bg-background border border-border rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                />
              </div>
            </div>

            {/* Linha 2: Segurança */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                Segurança da Conexão
              </label>
              <div className="flex gap-2">
                {(['tls', 'ssl', 'none'] as const).map(opt => (
                  <button
                    key={opt}
                    onClick={() => handleChange('smtp_secure', opt)}
                    className={`px-4 py-2 rounded-md text-sm font-medium border transition-all ${
                      settings.smtp_secure === opt
                        ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                        : 'bg-background text-muted-foreground border-border hover:bg-muted'
                    }`}
                  >
                    {opt === 'tls' ? 'STARTTLS (587)' : opt === 'ssl' ? 'SSL/TLS (465)' : 'Nenhuma (25)'}
                  </button>
                ))}
              </div>
            </div>

            {/* Divider */}
            <hr className="border-border" />

            {/* Linha 3: Usuário */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                Usuário de Autenticação
              </label>
              <input
                type="text"
                value={settings.smtp_user}
                onChange={e => handleChange('smtp_user', e.target.value)}
                placeholder="noreply@santacasaaraguari.org.br"
                className="w-full bg-background border border-border rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-all"
              />
            </div>

            {/* Linha 4: Senha */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                Senha
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={settings.smtp_pass}
                  onChange={e => handleChange('smtp_pass', e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-background border border-border rounded-md px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Divider */}
            <hr className="border-border" />

            {/* Linha 5: Nome + E-mail remetente */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                  Nome do Remetente
                </label>
                <input
                  type="text"
                  value={settings.smtp_from_name}
                  onChange={e => handleChange('smtp_from_name', e.target.value)}
                  placeholder="Hospital Santa Casa"
                  className="w-full bg-background border border-border rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                  E-mail do Remetente
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <input
                    type="email"
                    value={settings.smtp_from_email}
                    onChange={e => handleChange('smtp_from_email', e.target.value)}
                    placeholder="noreply@santacasaaraguari.org.br"
                    className="w-full bg-background border border-border rounded-md pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Botões */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-md bg-primary text-primary-foreground shadow transition-colors hover:opacity-90 font-medium text-sm cursor-pointer disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? 'Salvando...' : 'Salvar Configurações'}
              </button>
              <button
                onClick={handleTest}
                disabled={testing || !settings.smtp_host}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-md border border-border bg-background text-foreground shadow-sm transition-colors hover:bg-muted font-medium text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {testing ? 'Enviando...' : 'Enviar E-mail de Teste'}
              </button>
            </div>

            {/* Nota informativa */}
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              O e-mail de teste será enviado para o endereço do seu perfil ({profile?.email}).
              Certifique-se de que as credenciais estão corretas antes de salvar.
            </p>
          </div>
        )}
      </div>

      {/* ── TOAST ── */}
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-lg shadow-lg border text-sm font-medium ${
            toast.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-700 dark:bg-green-500/10 dark:border-green-500/20 dark:text-green-400'
              : 'bg-red-50 border-red-200 text-red-700 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-400'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
          {toast.message}
        </motion.div>
      )}
    </motion.div>
  );
};

export default Configuracoes;
