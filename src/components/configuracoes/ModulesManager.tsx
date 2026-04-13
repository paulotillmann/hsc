// src/components/configuracoes/ModulesManager.tsx
// Aba de gerenciamento de módulos/telas do sistema com matriz de permissões por perfil

import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Pencil, Trash2, Loader2, X, Check, Layout,
  ToggleLeft, ToggleRight, PackagePlus,
} from 'lucide-react';
import { Role } from '../../types/permissions';
import {
  fetchModulesWithRoles, ModuleWithRoles,
  createModule, updateModule, deleteModule, setRoleModuleAccess,
} from '../../services/modulesService';
import DynamicIcon from '../DynamicIcon';

interface ModulesManagerProps {
  roles: Role[];
  showToast: (type: 'success' | 'error', message: string) => void;
}

// ── Formulário de módulo ──────────────────────────────────────────────────────
interface ModuleForm {
  id?: string;
  name: string;
  slug: string;
  icon: string;
  description: string;
  sort_order: number;
}

const EMPTY_FORM: ModuleForm = {
  name: '', slug: '', icon: 'Layout', description: '', sort_order: 0,
};

// Ícones sugeridos para facilitar a seleção
const ICON_SUGGESTIONS = [
  'Layout', 'FileText', 'Receipt', 'Settings', 'BarChart2', 'Users',
  'Briefcase', 'Calendar', 'ClipboardList', 'Database', 'FolderOpen',
  'Globe', 'Home', 'Mail', 'Map', 'MessageSquare', 'Package',
  'PieChart', 'Shield', 'Star', 'Table', 'Truck', 'Wallet',
];

const ModuleModal: React.FC<{
  initial: ModuleForm;
  onSave: (data: ModuleForm) => void;
  onClose: () => void;
  saving: boolean;
}> = ({ initial, onSave, onClose, saving }) => {
  const [form, setForm] = useState<ModuleForm>(initial);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.slug.trim() || !form.icon.trim()) return;
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
          <h3 className="font-bold text-foreground">
            {initial.id ? 'Editar Módulo' : 'Novo Módulo'}
          </h3>
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
                placeholder="Ex: Relatórios"
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Slug (rota)</label>
              <input
                type="text" required
                value={form.slug}
                onChange={e => setForm(p => ({ ...p, slug: e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') }))}
                placeholder="Ex: relatorios"
                disabled={!!initial.id}
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Descrição</label>
            <input
              type="text"
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="Breve descrição do módulo"
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Ícone (Lucide)</label>
              <div className="flex gap-2">
                <input
                  type="text" required
                  value={form.icon}
                  onChange={e => setForm(p => ({ ...p, icon: e.target.value }))}
                  placeholder="Ex: BarChart2"
                  className="flex-1 bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <div className="h-9 w-9 flex-shrink-0 flex items-center justify-center bg-primary/10 rounded-md border border-border">
                  <DynamicIcon name={form.icon} className="h-5 w-5 text-primary" />
                </div>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Ordem no Menu</label>
              <input
                type="number" min={0}
                value={form.sort_order}
                onChange={e => setForm(p => ({ ...p, sort_order: Number(e.target.value) }))}
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* Sugestões de ícones */}
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Sugestões de ícones:</p>
            <div className="flex flex-wrap gap-1.5">
              {ICON_SUGGESTIONS.map(icon => (
                <button
                  key={icon}
                  type="button"
                  title={icon}
                  onClick={() => setForm(p => ({ ...p, icon }))}
                  className={`h-8 w-8 flex items-center justify-center rounded-md border transition-all ${
                    form.icon === icon
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'bg-background border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <DynamicIcon name={icon} className="h-4 w-4" />
                </button>
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
              {saving ? 'Salvando...' : 'Salvar Módulo'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-md border border-border text-foreground text-sm hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

// ── ModulesManager ────────────────────────────────────────────────────────────
const ModulesManager: React.FC<ModulesManagerProps> = ({ roles, showToast }) => {
  const [modules, setModules] = useState<ModuleWithRoles[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModuleForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [togglingAccess, setTogglingAccess] = useState<string | null>(null); // "roleId-moduleId"

  const loadModules = useCallback(async () => {
    setLoading(true);
    try {
      setModules(await fetchModulesWithRoles());
    } catch {
      showToast('error', 'Erro ao carregar módulos.');
    }
    setLoading(false);
  }, [showToast]);

  useEffect(() => { loadModules(); }, [loadModules]);

  const handleSave = async (data: ModuleForm) => {
    setSaving(true);
    const { id, ...rest } = data;
    const result = id
      ? await updateModule(id, { name: rest.name, icon: rest.icon, description: rest.description, sort_order: rest.sort_order })
      : await createModule(rest);
    setSaving(false);
    if (result.success) {
      showToast('success', id ? 'Módulo atualizado!' : 'Módulo criado!');
      setModal(null);
      await loadModules();
    } else {
      showToast('error', result.error || 'Erro ao salvar módulo.');
    }
  };

  const handleDelete = async (m: ModuleWithRoles) => {
    if (!window.confirm(`Excluir o módulo "${m.name}"? Todos os acessos vinculados serão removidos.`)) return;
    setDeleting(m.id);
    const result = await deleteModule(m.id);
    setDeleting(null);
    result.success ? (showToast('success', 'Módulo excluído.'), loadModules()) : showToast('error', result.error || 'Erro ao excluir.');
  };

  const handleToggleActive = async (m: ModuleWithRoles) => {
    const result = await updateModule(m.id, { is_active: !m.is_active });
    result.success ? loadModules() : showToast('error', result.error || 'Erro ao atualizar status.');
  };

  const handleAccessToggle = async (roleId: string, moduleId: string, currentHasAccess: boolean) => {
    const key = `${roleId}-${moduleId}`;
    setTogglingAccess(key);
    const result = await setRoleModuleAccess(roleId, moduleId, !currentHasAccess);
    setTogglingAccess(null);
    result.success ? await loadModules() : showToast('error', result.error || 'Erro ao atualizar permissão.');
  };

  if (loading) {
    return (
      <div className="p-12 flex flex-col items-center gap-3 text-muted-foreground">
        <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        Carregando módulos...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Lista de Módulos ── */}
      <div className="bg-card border border-border shadow-sm rounded-xl overflow-hidden">
        <div className="p-5 border-b border-border bg-muted/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Layout className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Módulos do Sistema</h2>
              <p className="text-xs text-muted-foreground">Telas registradas e suas permissões por perfil</p>
            </div>
          </div>
          <button
            onClick={() => setModal({ ...EMPTY_FORM })}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-all shadow"
          >
            <Plus className="h-4 w-4" />
            Novo Módulo
          </button>
        </div>

        {modules.length === 0 ? (
          <div className="p-12 flex flex-col items-center gap-4 text-center text-muted-foreground">
            <PackagePlus className="h-12 w-12 opacity-30" />
            <p className="text-sm">Nenhum módulo cadastrado. Crie o primeiro módulo.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Módulo</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Slug / Rota</th>
                  {roles.map(role => (
                    <th key={role.id} className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {role.name}
                    </th>
                  ))}
                  <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {modules.map(m => (
                  <tr key={m.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <DynamicIcon name={m.icon} className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">{m.name}</p>
                          {m.description && <p className="text-xs text-muted-foreground truncate">{m.description}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground">/{m.slug}</span>
                        {m.is_system && (
                          <span className="text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full">Sistema</span>
                        )}
                      </div>
                    </td>

                    {/* Matriz de permissões: checkbox por perfil */}
                    {roles.map(role => {
                      const hasAccess = m.roleIds.includes(role.id);
                      const key = `${role.id}-${m.id}`;
                      const isToggling = togglingAccess === key;
                      return (
                        <td key={role.id} className="px-4 py-3.5 text-center">
                          <button
                            onClick={() => handleAccessToggle(role.id, m.id, hasAccess)}
                            disabled={isToggling}
                            title={hasAccess ? `Remover acesso de ${role.name}` : `Dar acesso a ${role.name}`}
                            className={`inline-flex items-center justify-center h-7 w-7 rounded-md border transition-all ${
                              hasAccess
                                ? 'bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-400 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-500'
                                : 'bg-muted border-border text-muted-foreground hover:bg-primary/10 hover:border-primary/30 hover:text-primary'
                            } ${isToggling ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
                          >
                            {isToggling
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : hasAccess
                                ? <Check className="h-3.5 w-3.5" />
                                : <X className="h-3.5 w-3.5" />
                            }
                          </button>
                        </td>
                      );
                    })}

                    {/* Toggle ativo/inativo */}
                    <td className="px-4 py-3.5 text-center">
                      <button
                        onClick={() => handleToggleActive(m)}
                        title={m.is_active ? 'Desativar módulo' : 'Ativar módulo'}
                        className={`inline-flex items-center justify-center transition-colors ${
                          m.is_active ? 'text-green-500 hover:text-muted-foreground' : 'text-muted-foreground hover:text-green-500'
                        }`}
                      >
                        {m.is_active
                          ? <ToggleRight className="h-6 w-6" />
                          : <ToggleLeft className="h-6 w-6" />
                        }
                      </button>
                    </td>

                    {/* Ações */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => setModal({
                            id: m.id, name: m.name, slug: m.slug,
                            icon: m.icon, description: m.description ?? '', sort_order: m.sort_order,
                          })}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          title="Editar módulo"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(m)}
                          disabled={m.is_system || deleting === m.id}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          title={m.is_system ? 'Módulo de sistema não pode ser excluído' : 'Excluir módulo'}
                        >
                          {deleting === m.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Legenda ── */}
      <div className="flex items-center gap-6 text-xs text-muted-foreground px-1">
        <div className="flex items-center gap-1.5">
          <div className="h-5 w-5 rounded bg-green-500/10 border border-green-500/30 flex items-center justify-center">
            <Check className="h-3 w-3 text-green-600" />
          </div>
          <span>Perfil tem acesso ao módulo</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-5 w-5 rounded bg-muted border border-border flex items-center justify-center">
            <X className="h-3 w-3 text-muted-foreground" />
          </div>
          <span>Sem acesso — clique para conceder</span>
        </div>
      </div>

      {/* ── Modal ── */}
      <AnimatePresence>
        {modal && (
          <ModuleModal
            initial={modal}
            onSave={handleSave}
            onClose={() => setModal(null)}
            saving={saving}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default ModulesManager;
