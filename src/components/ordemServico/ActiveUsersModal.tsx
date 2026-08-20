// src/components/ordemServico/ActiveUsersModal.tsx
// Modal interativo para visualização de usuários ativos em tempo real e encerramento de sessões

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Users,
  Search,
  LogOut,
  Check,
  AlertCircle,
  Loader2,
  Clock,
  ShieldAlert
} from 'lucide-react';
import { OnlineUser, useAuth } from '../../contexts/AuthContext';

interface ActiveUsersModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ActiveUsersModal: React.FC<ActiveUsersModalProps> = ({ isOpen, onClose }) => {
  const { user: currentUser, activeUsers, terminateUserSessions } = useAuth();
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [terminating, setTerminating] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<string[] | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

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
      setSuccessMessage(
        confirmTarget.length === 1
          ? 'Sessão do usuário encerrada com sucesso!'
          : `${confirmTarget.length} sessões encerradas com sucesso!`
      );
      setTimeout(() => setSuccessMessage(null), 3000);
      setConfirmTarget(null);
    } catch (err) {
      console.error('Erro ao encerrar sessão:', err);
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
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-xl flex flex-col max-h-[85vh] overflow-hidden relative"
      >
        {/* Header */}
        <div className="p-5 border-b border-border flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-foreground text-base">Usuários Ativos</h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {activeUsers.length} online
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Usuários conectados ao sistema em tempo real
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Notificação de Sucesso */}
        <AnimatePresence>
          {successMessage && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-emerald-500/10 border-b border-emerald-500/20 px-5 py-2.5 flex items-center gap-2 text-xs font-medium text-emerald-600 dark:text-emerald-400"
            >
              <Check className="h-4 w-4 shrink-0" />
              {successMessage}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Toolbar: Busca e Seleção */}
        <div className="p-4 border-b border-border/60 bg-muted/10 space-y-3">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar usuário por nome ou e-mail..."
              className="w-full bg-background border border-border rounded-xl pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className="flex items-center justify-between text-xs px-1 text-muted-foreground">
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
            <span>
              {selectedIds.length > 0
                ? `${selectedIds.length} selecionado(s)`
                : `${filteredUsers.length} visível(is)`}
            </span>
          </div>
        </div>

        {/* Lista de Usuários */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 divide-y divide-border/30">
          {filteredUsers.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {search ? 'Nenhum usuário encontrado para esta busca.' : 'Nenhum usuário ativo no momento.'}
            </div>
          ) : (
            filteredUsers.map((u) => {
              const isSelected = selectedIds.includes(u.id);
              const isSelf = currentUser?.id === u.id;
              const initials = (u.full_name || u.email || 'U').substring(0, 2).toUpperCase();

              return (
                <div
                  key={u.id}
                  className={`flex items-center justify-between p-3 rounded-xl transition-all border ${
                    isSelected
                      ? 'bg-primary/5 border-primary/30'
                      : 'bg-background hover:bg-muted/30 border-border/50'
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
                        <img
                          src={u.avatar_url}
                          alt=""
                          className="h-10 w-10 rounded-full object-cover border border-border"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center justify-center border border-emerald-500/20">
                          {initials}
                        </div>
                      )}
                      <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 border-2 border-background ring-1 ring-emerald-500/30" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm text-foreground truncate">
                          {u.full_name || u.email || 'Usuário'}
                        </p>
                        {isSelf && (
                          <span className="text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.2 rounded">
                            Você
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span className="truncate max-w-[200px]">{u.email}</span>
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
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-500/10 text-xs font-medium transition-colors shrink-0 ml-2"
                    title="Encerrar sessão deste usuário"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Desconectar</span>
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-muted/20 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-border text-foreground hover:bg-muted text-sm font-medium transition-colors"
          >
            Fechar
          </button>

          <button
            onClick={() => setConfirmTarget(selectedIds)}
            disabled={selectedIds.length === 0 || terminating}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium shadow-sm transition-all"
          >
            {terminating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="h-4 w-4" />
            )}
            Desconectar Selecionados {selectedIds.length > 0 ? `(${selectedIds.length})` : ''}
          </button>
        </div>

        {/* Modal de Confirmação de Force-Logout */}
        <AnimatePresence>
          {confirmTarget && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
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
                  <h4 className="font-bold text-foreground text-base">
                    Encerrar Sessão
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Tem certeza que deseja forçar o logout de{' '}
                    <strong className="text-foreground">
                      {confirmTarget.length === 1 ? '1 usuário' : `${confirmTarget.length} usuários`}
                    </strong>
                    ? A sessão será fechada imediatamente nos navegadores deles.
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
      </motion.div>
    </div>
  );
};

export default ActiveUsersModal;
