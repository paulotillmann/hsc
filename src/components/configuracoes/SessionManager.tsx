// src/components/configuracoes/SessionManager.tsx
// Aba de Configuração de Sessão, Timeout de Inatividade e Gestão de Sessões Ativas

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock,
  Users,
  ShieldCheck,
  Save,
  Loader2,
  LogOut,
  Search,
  Check,
  AlertCircle,
  ShieldAlert,
  Info,
  Tv
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { fetchSessionSettings, saveSessionSettings } from '../../services/settingsService';

interface SessionManagerProps {
  showToast: (type: 'success' | 'error', message: string) => void;
}

const PRESET_TIMEOUTS = [15, 30, 45, 60, 120];

export const SessionManager: React.FC<SessionManagerProps> = ({ showToast }) => {
  const { user: currentUser, activeUsers, terminateUserSessions } = useAuth();

  // Estados de Configuração de Timeout
  const [timeoutMinutes, setTimeoutMinutes] = useState<number>(30);
  const [customMinutes, setCustomMinutes] = useState<string>('30');
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  // Estados de Gestão de Usuários Ativos
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [terminating, setTerminating] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<string[] | null>(null);

  // Carrega configurações iniciais
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoadingSettings(true);
    try {
      const data = await fetchSessionSettings();
      setTimeoutMinutes(data.inactivity_timeout_minutes);
      setCustomMinutes(data.inactivity_timeout_minutes.toString());
    } catch {
      showToast('error', 'Erro ao carregar configurações de sessão.');
    } finally {
      setLoadingSettings(false);
    }
  };

  const handleSaveTimeout = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentUser?.id) return;

    const parsed = parseInt(customMinutes, 10);
    if (isNaN(parsed) || parsed < 5 || parsed > 720) {
      showToast('error', 'O tempo limite deve ser entre 5 e 720 minutos (12 horas).');
      return;
    }

    setSavingSettings(true);
    const res = await saveSessionSettings(parsed, currentUser.id);
    setSavingSettings(false);

    if (res.success) {
      setTimeoutMinutes(parsed);
      showToast('success', `Tempo limite de inatividade atualizado para ${parsed} minutos!`);
    } else {
      showToast('error', res.error || 'Erro ao salvar tempo limite.');
    }
  };

  const handleSelectPreset = (minutes: number) => {
    setCustomMinutes(minutes.toString());
    setTimeoutMinutes(minutes);
  };

  // Filtros de Usuários Ativos
  const filteredUsers = activeUsers.filter((u) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    const name = (u.full_name || '').toLowerCase();
    const email = (u.email || '').toLowerCase();
    return name.includes(q) || email.includes(q);
  });

  const isAllSelected =
    filteredUsers.length > 0 &&
    filteredUsers.every((u) => selectedIds.includes(u.id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredUsers.map((u) => u.id));
    }
  };

  const toggleUser = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleConfirmTerminate = async () => {
    if (!confirmTarget || confirmTarget.length === 0) return;
    setTerminating(true);
    try {
      await terminateUserSessions(confirmTarget);
      setSelectedIds((prev) => prev.filter((id) => !confirmTarget.includes(id)));
      showToast(
        'success',
        confirmTarget.length === 1
          ? 'Sessão do usuário encerrada com sucesso!'
          : `${confirmTarget.length} sessões encerradas com sucesso!`
      );
      setConfirmTarget(null);
    } catch {
      showToast('error', 'Erro ao encerrar sessões selecionadas.');
    } finally {
      setTerminating(false);
    }
  };

  const formatOnlineTime = (dateStr?: string) => {
    if (!dateStr) return 'Online';
    try {
      const date = new Date(dateStr);
      return `Conectado às ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return 'Online';
    }
  };

  return (
    <div className="space-y-6">
      {/* ── CARD 1: CONFIGURAÇÃO DE TEMPO DE INATIVIDADE ── */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-base">Tempo Limite de Inatividade (Auto-Logout)</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Defina após quantos minutos sem interação o sistema deslogará os usuários automaticamente
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-muted border border-border text-foreground">
              Configuração Atual: <strong>{timeoutMinutes} min</strong>
            </span>
          </div>
        </div>

        {loadingSettings ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
            <Loader2 className="h-4 w-4 animate-spin text-primary" /> Carregando configurações...
          </div>
        ) : (
          <form onSubmit={handleSaveTimeout} className="space-y-5">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-2">
                Atalhos Rápidos
              </label>
              <div className="flex flex-wrap gap-2">
                {PRESET_TIMEOUTS.map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => handleSelectPreset(mins)}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all duration-200 ${
                      customMinutes === mins.toString()
                        ? 'bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/25 scale-105'
                        : 'bg-muted/40 text-foreground border-border hover:bg-muted hover:border-border/80'
                    }`}
                  >
                    {mins} minutos {mins === 30 ? '(Padrão)' : ''}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                  Tempo Personalizado (em minutos)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={5}
                    max={720}
                    value={customMinutes}
                    onChange={(e) => setCustomMinutes(e.target.value)}
                    placeholder="Ex: 30"
                    className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-medium"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-semibold">
                    min
                  </span>
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-all shadow-sm"
                >
                  {savingSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Salvar Tempo Limite
                </button>
              </div>
            </div>

            {/* Avisos informativos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <div className="p-3 bg-muted/30 border border-border rounded-xl flex items-start gap-2.5 text-xs text-muted-foreground leading-relaxed">
                <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>
                  O temporizador zera sempre que o usuário move o mouse, digita no teclado, rola a tela ou clica.
                </span>
              </div>
              <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl flex items-start gap-2.5 text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                <Tv className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <span>
                  Contas configuradas como <strong>Exceção de TV/Painel</strong> ignoram este tempo limite e permanecem ativas 24/7.
                </span>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* ── CARD 2: GESTÃO DE SESSÕES ATIVAS EM TEMPO REAL ── */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-foreground text-base">Sessões Ativas no Momento</h3>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  {activeUsers.length} online
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Visualize quem está conectado no sistema e encerre sessões remotamente se necessário
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setConfirmTarget(selectedIds)}
              disabled={selectedIds.length === 0 || terminating}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold shadow-sm transition-all"
            >
              {terminating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
              Desconectar Selecionados {selectedIds.length > 0 ? `(${selectedIds.length})` : ''}
            </button>
          </div>
        </div>

        {/* Toolbar: Busca e Seleção */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-muted/20 border border-border/60 p-3 rounded-xl">
          <div className="relative w-full sm:w-80">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar usuário ativo..."
              className="w-full bg-background border border-border rounded-lg pl-9 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="flex items-center justify-between w-full sm:w-auto gap-4 text-xs text-muted-foreground">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={toggleSelectAll}
                disabled={filteredUsers.length === 0}
                className="rounded border-border h-4 w-4"
                style={{ accentColor: '#8E1C1C', color: '#8E1C1C' }}
              />
              <span className="font-medium text-foreground">Selecionar todos</span>
            </label>
            <span className="font-medium">
              {selectedIds.length > 0 ? `${selectedIds.length} selecionado(s)` : `${filteredUsers.length} online`}
            </span>
          </div>
        </div>

        {/* Lista de Sessões Ativas */}
        <div className="border border-border rounded-xl divide-y divide-border overflow-hidden">
          {filteredUsers.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {search ? 'Nenhum usuário encontrado para esta busca.' : 'Nenhum usuário ativo conectado no momento.'}
            </div>
          ) : (
            filteredUsers.map((u) => {
              const isSelected = selectedIds.includes(u.id);
              const isSelf = currentUser?.id === u.id;
              const initials = (u.full_name || u.email || 'U').substring(0, 2).toUpperCase();

              return (
                <div
                  key={u.id}
                  className={`flex items-center justify-between p-3.5 transition-colors ${
                    isSelected ? 'bg-primary/5' : 'hover:bg-muted/30'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleUser(u.id)}
                      className="rounded border-border h-4 w-4 shrink-0"
                      style={{ accentColor: '#8E1C1C', color: '#8E1C1C' }}
                    />

                    <div className="relative shrink-0">
                      {u.avatar_url ? (
                        <img src={u.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover border border-border" />
                      ) : (
                        <div className="h-9 w-9 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center justify-center border border-emerald-500/20">
                          {initials}
                        </div>
                      )}
                      <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-background ring-1 ring-emerald-500/30" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm text-foreground truncate">{u.full_name || 'Usuário'}</p>
                        {isSelf && (
                          <span className="text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.2 rounded">
                            Você
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span className="truncate max-w-[220px]">{u.email}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1 text-[11px]">
                          <Clock className="h-3 w-3 text-muted-foreground/70" />
                          {formatOnlineTime(u.online_at)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setConfirmTarget([u.id])}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-500/10 text-xs font-semibold transition-colors shrink-0 ml-2"
                    title="Encerrar a sessão deste usuário"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Desconectar</span>
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── MODAL DE CONFIRMAÇÃO DE FORCE-LOGOUT ── */}
      <AnimatePresence>
        {confirmTarget && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border border-border rounded-2xl shadow-2xl p-6 text-center max-w-sm w-full space-y-4"
            >
              <div className="h-12 w-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto border border-red-500/20">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <div>
                <h4 className="font-bold text-foreground text-base">Encerrar Sessão</h4>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Tem certeza que deseja forçar o logout de{' '}
                  <strong className="text-foreground">
                    {confirmTarget.length === 1 ? '1 usuário' : `${confirmTarget.length} usuários`}
                  </strong>
                  ? A sessão será encerrada imediatamente nos dispositivos deles.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setConfirmTarget(null)}
                  disabled={terminating}
                  className="flex-1 px-4 py-2 rounded-xl border border-border text-foreground hover:bg-muted text-sm font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmTerminate}
                  disabled={terminating}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors"
                >
                  {terminating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SessionManager;
