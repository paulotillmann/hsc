import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Save, Send, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2,
  Server, Mail, Shield, Users, Plus, Pencil, Trash2, X, Check, Layout,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  fetchSmtpSettings, saveSmtpSettings, sendTestEmail, SmtpSettings,
} from '../services/settingsService';
import {
  fetchRoles, createRole, updateRole, deleteRole,
  fetchUsers, updateUserRole, updateUserDefaultModule, UserProfile,
} from '../services/rolesService';
import { Role } from '../types/permissions';
import { fetchModulesWithRoles, ModuleWithRoles } from '../services/modulesService';
import ModulesManager from '../components/configuracoes/ModulesManager';

// ── Tabs ─────────────────────────────────────────────────────────────────
type Tab = 'smtp' | 'perfis' | 'usuarios' | 'modulos';

// ── Permission flags label map ────────────────────────────────────────────
const PERM_LABELS: { key: keyof Role; label: string; desc: string }[] = [
  { key: 'can_informes',   label: 'Informes',       desc: 'Acessa tela de Informes de Rendimento' },
  { key: 'can_holerites',  label: 'Holerites',      desc: 'Acessa tela de Holerites' },
  { key: 'can_config',     label: 'Configurações',  desc: 'Acessa painel de Configurações' },
  { key: 'can_upload',     label: 'Upload',         desc: 'Faz upload em massa de PDFs' },
  { key: 'can_send_email', label: 'Enviar E-mail',  desc: 'Usa botão de envio de e-mail' },
  { key: 'can_view_all',   label: 'Ver Tudo',       desc: 'Vê todos os registros (não só os próprios)' },
];

const EMPTY_ROLE: Omit<Role, 'id' | 'created_at' | 'updated_at'> = {
  name: '', slug: '',
  can_informes: false, can_holerites: false, can_config: false,
  can_upload: false, can_send_email: false, can_view_all: false,
  is_system: false,
};

// ── Toast helper ──────────────────────────────────────────────────────────
interface Toast { type: 'success' | 'error'; message: string; }

// ── Toggle Switch ─────────────────────────────────────────────────────────
const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }> = ({ checked, onChange, disabled }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
      checked ? 'bg-primary' : 'bg-muted-foreground/30'
    } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
  >
    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200 ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
  </button>
);

// ── RoleModal ─────────────────────────────────────────────────────────────
interface RoleModalProps {
  initial: Omit<Role, 'id' | 'created_at' | 'updated_at'> & { id?: string };
  isSystemRole: boolean;
  onSave: (data: Omit<Role, 'id' | 'created_at' | 'updated_at'> & { id?: string }) => void;
  onClose: () => void;
  saving: boolean;
}

const RoleModal: React.FC<RoleModalProps> = ({ initial, isSystemRole, onSave, onClose, saving }) => {
  const [form, setForm] = useState(initial);

  const setFlag = (key: keyof Role, value: boolean) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.slug.trim()) return;
    onSave(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md"
      >
        <div className="p-5 border-b border-border flex items-center justify-between">
          <h3 className="font-bold text-foreground">{initial.id ? 'Editar Perfil' : 'Novo Perfil'}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Nome</label>
              <input
                type="text" required
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Ex: Recursos Humanos"
                disabled={isSystemRole}
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Slug</label>
              <input
                type="text" required
                value={form.slug}
                onChange={e => setForm(p => ({ ...p, slug: e.target.value.toLowerCase().replace(/\s+/g, '_') }))}
                placeholder="Ex: rh"
                disabled={!!initial.id}
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">Permissões</label>
            <div className="space-y-2">
              {PERM_LABELS.map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 border border-border/50">
                  <div>
                    <p className="text-sm font-medium text-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                  <Toggle
                    checked={Boolean(form[key])}
                    onChange={v => setFlag(key, v)}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-all"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {saving ? 'Salvando...' : 'Salvar Perfil'}
            </button>
            <button type="button" onClick={onClose}
              className="px-4 py-2.5 rounded-md border border-border text-foreground text-sm hover:bg-muted transition-colors">
              Cancelar
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────
const Configuracoes: React.FC = () => {
  const { user, profile, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('smtp');
  const [toast, setToast] = useState<Toast | null>(null);

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  }, []);

  // ── SMTP state ──
  const [settings, setSettings] = useState<SmtpSettings>({
    smtp_host: '', smtp_port: '587', smtp_user: '', smtp_pass: '',
    smtp_from_name: 'Hospital Santa Casa', smtp_from_email: '', smtp_secure: 'tls',
  });
  const [smtpLoading, setSmtpLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    (async () => {
      setSmtpLoading(true);
      const data = await fetchSmtpSettings();
      setSettings(data);
      setSmtpLoading(false);
    })();
  }, []);

  const handleSmtpChange = (field: keyof SmtpSettings, value: string) =>
    setSettings(prev => ({ ...prev, [field]: value }));

  const handleSaveSmtp = async () => {
    if (!user) return;
    setSaving(true);
    const result = await saveSmtpSettings(settings, user.id);
    setSaving(false);
    result.success ? showToast('success', 'Configurações SMTP salvas!') : showToast('error', result.error || 'Erro ao salvar.');
  };

  const handleTestSmtp = async () => {
    if (!profile?.email) { showToast('error', 'Seu perfil não possui e-mail cadastrado.'); return; }
    setTesting(true);
    const result = await sendTestEmail(profile.email, profile.full_name || 'Administrador');
    setTesting(false);
    result.success ? showToast('success', `E-mail de teste enviado para ${profile.email}`) : showToast('error', result.error || 'Falha no envio de teste.');
  };

  // ── ROLES state ──
  const [roles, setRoles] = useState<Role[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [roleModal, setRoleModal] = useState<null | (Omit<Role, 'id' | 'created_at' | 'updated_at'> & { id?: string })>(null);
  const [roleSaving, setRoleSaving] = useState(false);
  const [roleDeleting, setRoleDeleting] = useState<string | null>(null);

  const loadRoles = useCallback(async () => {
    setRolesLoading(true);
    try { setRoles(await fetchRoles()); } catch (e) { showToast('error', 'Erro ao carregar perfis.'); }
    setRolesLoading(false);
  }, [showToast]);

  useEffect(() => { if (activeTab === 'perfis') loadRoles(); }, [activeTab, loadRoles]);

  const handleSaveRole = async (data: Omit<Role, 'id' | 'created_at' | 'updated_at'> & { id?: string }) => {
    setRoleSaving(true);
    const { id, ...rest } = data;
    const result = id ? await updateRole(id, rest) : await createRole(rest);
    setRoleSaving(false);
    if (result.success) {
      showToast('success', id ? 'Perfil atualizado!' : 'Perfil criado!');
      setRoleModal(null);
      await loadRoles();
    } else {
      showToast('error', result.error || 'Erro ao salvar perfil.');
    }
  };

  const handleDeleteRole = async (role: Role) => {
    if (!window.confirm(`Excluir o perfil "${role.name}"? Esta ação não pode ser desfeita.`)) return;
    setRoleDeleting(role.id);
    const result = await deleteRole(role.id);
    setRoleDeleting(null);
    result.success ? (showToast('success', 'Perfil excluído.'), loadRoles()) : showToast('error', result.error || 'Erro ao excluir.');
  };

  // ── USERS state ──
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [updatingUser, setUpdatingUser] = useState<string | null>(null);
  const [updatingDefaultModule, setUpdatingDefaultModule] = useState<string | null>(null);
  const [allModules, setAllModules] = useState<ModuleWithRoles[]>([]);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const [usersData, modulesData] = await Promise.all([
        fetchUsers(),
        fetchModulesWithRoles(),
      ]);
      setUsers(usersData);
      setAllModules(modulesData.filter(m => m.is_active));
    } catch (e) { showToast('error', 'Erro ao carregar usuários.'); }
    setUsersLoading(false);
  }, [showToast]);

  useEffect(() => { if (activeTab === 'usuarios') { loadRoles(); loadUsers(); } }, [activeTab, loadRoles, loadUsers]);
  useEffect(() => { if (activeTab === 'modulos' && roles.length === 0) loadRoles(); }, [activeTab, loadRoles, roles.length]);

  const handleUserRoleChange = async (userId: string, roleId: string) => {
    setUpdatingUser(userId);
    const result = await updateUserRole(userId, roleId);
    setUpdatingUser(null);
    result.success ? showToast('success', 'Perfil do usuário atualizado!') : showToast('error', result.error || 'Erro ao atualizar.');
    if (result.success) await loadUsers();
  };

  const handleUserDefaultModuleChange = async (userId: string, slug: string | null) => {
    setUpdatingDefaultModule(userId);
    const result = await updateUserDefaultModule(userId, slug);
    setUpdatingDefaultModule(null);
    result.success
      ? showToast('success', 'Módulo padrão atualizado!')
      : showToast('error', result.error || 'Erro ao atualizar módulo padrão.');
    if (result.success) await loadUsers();
  };

  // ── Tabs definition ──
  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'smtp',     label: 'Servidor SMTP', icon: <Server className="h-4 w-4" /> },
    { id: 'perfis',   label: 'Perfis',        icon: <Shield className="h-4 w-4" /> },
    { id: 'modulos',  label: 'Módulos',       icon: <Layout className="h-4 w-4" /> },
    { id: 'usuarios', label: 'Usuários',      icon: <Users className="h-4 w-4" /> },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 relative">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Configurações</h1>
        <p className="text-muted-foreground mt-1 text-sm">Gerencie SMTP, perfis de acesso e usuários do sistema</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/50 p-1 rounded-xl border border-border w-fit">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === tab.id
                ? 'bg-card text-foreground shadow-sm border border-border'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── TAB: SMTP ── */}
      {activeTab === 'smtp' && (
        <div className="bg-card border border-border shadow-sm rounded-xl overflow-hidden">
          <div className="p-5 border-b border-border bg-muted/20 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Server className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Servidor SMTP</h2>
              <p className="text-xs text-muted-foreground">Credenciais para envio de e-mail</p>
            </div>
          </div>

          {smtpLoading ? (
            <div className="p-12 flex flex-col items-center gap-3 text-muted-foreground">
              <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
              Carregando configurações...
            </div>
          ) : (
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Servidor SMTP</label>
                  <input type="text" value={settings.smtp_host}
                    onChange={e => handleSmtpChange('smtp_host', e.target.value)}
                    placeholder="mail.santacasaaraguari.org.br"
                    className="w-full bg-background border border-border rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Porta</label>
                  <input type="number" value={settings.smtp_port}
                    onChange={e => handleSmtpChange('smtp_port', e.target.value)}
                    placeholder="587"
                    className="w-full bg-background border border-border rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Segurança da Conexão</label>
                <div className="flex gap-2">
                  {(['tls', 'ssl', 'none'] as const).map(opt => (
                    <button key={opt} onClick={() => handleSmtpChange('smtp_secure', opt)}
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

              <hr className="border-border" />

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Usuário de Autenticação</label>
                <input type="text" value={settings.smtp_user}
                  onChange={e => handleSmtpChange('smtp_user', e.target.value)}
                  placeholder="noreply@santacasaaraguari.org.br"
                  className="w-full bg-background border border-border rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Senha</label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} value={settings.smtp_pass}
                    onChange={e => handleSmtpChange('smtp_pass', e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-background border border-border rounded-md px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <hr className="border-border" />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Nome do Remetente</label>
                  <input type="text" value={settings.smtp_from_name}
                    onChange={e => handleSmtpChange('smtp_from_name', e.target.value)}
                    placeholder="Hospital Santa Casa"
                    className="w-full bg-background border border-border rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">E-mail do Remetente</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <input type="email" value={settings.smtp_from_email}
                      onChange={e => handleSmtpChange('smtp_from_email', e.target.value)}
                      placeholder="noreply@santacasaaraguari.org.br"
                      className="w-full bg-background border border-border rounded-md pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button onClick={handleSaveSmtp} disabled={saving}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-md bg-primary text-primary-foreground shadow font-medium text-sm hover:opacity-90 disabled:opacity-50 transition-all">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {saving ? 'Salvando...' : 'Salvar Configurações'}
                </button>
                <button onClick={handleTestSmtp} disabled={testing || !settings.smtp_host}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-md border border-border bg-background text-foreground shadow-sm font-medium text-sm hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                  {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {testing ? 'Enviando...' : 'Enviar E-mail de Teste'}
                </button>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                O e-mail de teste será enviado para o endereço do seu perfil ({profile?.email}).
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: PERFIS ── */}
      {activeTab === 'perfis' && (
        <div className="bg-card border border-border shadow-sm rounded-xl overflow-hidden">
          <div className="p-5 border-b border-border bg-muted/20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">Perfis de Acesso</h2>
                <p className="text-xs text-muted-foreground">Gerencie os perfis e suas permissões por tela</p>
              </div>
            </div>
            <button
              onClick={() => setRoleModal({ ...EMPTY_ROLE })}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-all shadow"
            >
              <Plus className="h-4 w-4" />
              Novo Perfil
            </button>
          </div>

          {rolesLoading ? (
            <div className="p-12 flex flex-col items-center gap-3 text-muted-foreground">
              <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
              Carregando perfis...
            </div>
          ) : roles.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground text-sm">Nenhum perfil encontrado.</div>
          ) : (
            <div className="divide-y divide-border">
              {roles.map(role => (
                <div key={role.id} className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-foreground">{role.name}</h3>
                        <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-mono">{role.slug}</span>
                        {role.is_system && (
                          <span className="text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full">Sistema</span>
                        )}
                      </div>
                      {/* Permission badges */}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {PERM_LABELS.map(({ key, label }) => (
                          <span key={key} className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${
                            role[key as keyof Role]
                              ? 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20'
                              : 'bg-muted text-muted-foreground border-border opacity-50'
                          }`}>
                            {role[key as keyof Role] ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                            {label}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => setRoleModal({ ...role })}
                        className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        title="Editar perfil"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteRole(role)}
                        disabled={role.is_system || roleDeleting === role.id}
                        className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        title={role.is_system ? 'Perfil de sistema não pode ser excluído' : 'Excluir perfil'}
                      >
                        {roleDeleting === role.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: USUÁRIOS ── */}
      {activeTab === 'usuarios' && (
        <div className="bg-card border border-border shadow-sm rounded-xl overflow-hidden">
          <div className="p-5 border-b border-border bg-muted/20 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Gerenciamento de Usuários</h2>
              <p className="text-xs text-muted-foreground">Visualize e atribua perfis aos usuários do sistema</p>
            </div>
          </div>

          {/* ── Guard: apenas admin ── */}
          {!isAdmin ? (
            <div className="p-12 flex flex-col items-center gap-4 text-center">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                <Shield className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Acesso Restrito</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Apenas usuários com perfil <span className="font-mono font-semibold text-primary">admin</span> podem visualizar o gerenciamento de usuários.
                </p>
              </div>
            </div>
          ) : usersLoading ? (
            <div className="p-12 flex flex-col items-center gap-3 text-muted-foreground">
              <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
              Carregando usuários...
            </div>
          ) : users.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground text-sm">Nenhum usuário encontrado.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Usuário</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">CPF</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Perfil</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Módulo Inicial</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Criado em</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs flex-shrink-0 overflow-hidden border border-primary/20">
                            {u.avatar_url
                              ? <img src={u.avatar_url} alt="" className="h-full w-full object-cover" />
                              : (u.full_name || u.email || 'U')[0].toUpperCase()
                            }
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate">{u.full_name || '—'}</p>
                            <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground hidden md:table-cell font-mono text-xs">
                        {u.cpf || '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          {updatingUser === u.id
                            ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            : (
                              <select
                                value={u.role_id || ''}
                                onChange={e => handleUserRoleChange(u.id, e.target.value)}
                                className="bg-background border border-border rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-all cursor-pointer max-w-[180px]"
                              >
                                <option value="" disabled>Selecionar perfil</option>
                                {roles.map(r => (
                                  <option key={r.id} value={r.id}>{r.name}</option>
                                ))}
                              </select>
                            )
                          }
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          {updatingDefaultModule === u.id
                            ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            : (
                              <select
                                value={u.default_module_slug || ''}
                                onChange={e => handleUserDefaultModuleChange(u.id, e.target.value || null)}
                                className="bg-background border border-border rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-all cursor-pointer max-w-[180px]"
                              >
                                <option value="">Padrão do sistema</option>
                                {allModules.map(m => (
                                  <option key={m.id} value={m.slug}>{m.name}</option>
                                ))}
                              </select>
                            )
                          }
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground text-xs hidden lg:table-cell">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString('pt-BR') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: MÓDULOS ── */}
      {activeTab === 'modulos' && (
        <ModulesManager roles={roles} showToast={showToast} />
      )}

      {/* ── Role Modal ── */}
      <AnimatePresence>
        {roleModal && (
          <RoleModal
            initial={roleModal}
            isSystemRole={!!roleModal.is_system}
            onSave={handleSaveRole}
            onClose={() => setRoleModal(null)}
            saving={roleSaving}
          />
        )}
      </AnimatePresence>

      {/* ── Toast ── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key="toast"
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
      </AnimatePresence>
    </motion.div>
  );
};

export default Configuracoes;
