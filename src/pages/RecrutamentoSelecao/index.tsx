import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserCheck,
  UserX,
  Mail,
  Phone,
  Search,
  RefreshCw,
  Plus,
  FileText,
  Send,
  CheckCircle2,
  Clock,
  AlertCircle,
  Filter,
  Eye,
  Trash2,
  Settings2,
  Sparkles,
  MessageSquare,
  ExternalLink,
  X,
  Check,
  Loader2,
  Upload,
  BookmarkCheck,
  Briefcase,
  Tag,
  ChevronRight,
  ShieldOff,
  Server,
  Lock,
  EyeOff,
  Wifi,
  Inbox,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import {
  CandidatoTriagem,
  StatusCandidato,
  TemplateFeedback,
  RecrutamentoConfig,
  fetchCandidatosTriagem,
  fetchTemplatesFeedback,
  saveTemplateFeedback,
  createCandidatoTriagem,
  updateCandidatoStatus,
  deleteCandidatoTriagem,
  dispararFeedbackReprovacao,
  sincronizarCurriculosEmailN8n,
  formatarTextoFeedback,
  getRecrutamentoConfig,
  fetchRecrutamentoConfigAsync,
  saveRecrutamentoConfigAsync,
  testarConexaoEmailLeitura,
  testarDisparoEmailSmtp,
  uploadCurriculoPdf,
} from '../../services/recrutamentoService';

// ── Metadados visuais e de ação de cada Status ───────────────────────────────
const STATUS_CONFIG: Record<
  StatusCandidato,
  {
    label: string;
    badgeClass: string;
    dotColor: string;
    actionLabel: string;
    actionResendLabel: string;
    actionBtnClass: string;
    modalTitle: string;
    confirmLabel: string;
    headerBg: string;
    iconBg: string;
  }
> = {
  aguardando_triagem: {
    label: 'Aguardando Triagem',
    badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    dotColor: 'bg-amber-500',
    actionLabel: 'Envio de Triagem',
    actionResendLabel: 'Reenviar Triagem',
    actionBtnClass: 'bg-amber-600 hover:bg-amber-700 text-white',
    modalTitle: 'Enviar Confirmação de Triagem por E-mail',
    confirmLabel: 'Confirmar e Enviar Triagem',
    headerBg: 'bg-amber-500/5',
    iconBg: 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400',
  },
  em_analise: {
    label: 'Em Análise',
    badgeClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    dotColor: 'bg-blue-500',
    actionLabel: 'Envio de Análise',
    actionResendLabel: 'Reenviar Análise',
    actionBtnClass: 'bg-blue-600 hover:bg-blue-700 text-white',
    modalTitle: 'Enviar Comunicado de Currículo em Análise',
    confirmLabel: 'Confirmar e Enviar Análise',
    headerBg: 'bg-blue-500/5',
    iconBg: 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400',
  },
  entrevista: {
    label: 'Em Entrevista',
    badgeClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    dotColor: 'bg-purple-500',
    actionLabel: 'Envio de Entrevista',
    actionResendLabel: 'Reenviar Entrevista',
    actionBtnClass: 'bg-purple-600 hover:bg-purple-700 text-white',
    modalTitle: 'Enviar Convocação para Entrevista por E-mail',
    confirmLabel: 'Confirmar e Enviar Entrevista',
    headerBg: 'bg-purple-500/5',
    iconBg: 'bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400',
  },
  aprovado: {
    label: 'Aprovado',
    badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    dotColor: 'bg-emerald-500',
    actionLabel: 'Envio de Aprovado',
    actionResendLabel: 'Reenviar Aprovado',
    actionBtnClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    modalTitle: 'Enviar Comunicado de Aprovação por E-mail',
    confirmLabel: 'Confirmar e Enviar Aprovação',
    headerBg: 'bg-emerald-500/5',
    iconBg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400',
  },
  banco_talentos: {
    label: 'Banco de Talentos',
    badgeClass: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
    dotColor: 'bg-cyan-500',
    actionLabel: 'Envio Banco de Talentos',
    actionResendLabel: 'Reenviar Banco Talentos',
    actionBtnClass: 'bg-cyan-600 hover:bg-cyan-700 text-white',
    modalTitle: 'Enviar Comunicado de Banco de Talentos',
    confirmLabel: 'Confirmar e Enviar Banco de Talentos',
    headerBg: 'bg-cyan-500/5',
    iconBg: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-600 dark:text-cyan-400',
  },
  reprovado: {
    label: 'Reprovado',
    badgeClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    dotColor: 'bg-rose-500',
    actionLabel: 'Envio de Reprovado',
    actionResendLabel: 'Reenviar Reprovado',
    actionBtnClass: 'bg-rose-600 hover:bg-rose-700 text-white',
    modalTitle: 'Enviar Feedback de Reprovação por E-mail',
    confirmLabel: 'Confirmar e Enviar Reprovação',
    headerBg: 'bg-rose-500/5',
    iconBg: 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400',
  },
};

const formatDateTime = (iso: string | null) => {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  } catch {
    return iso;
  }
};

const cleanPhoneForWhatsApp = (phone: string | null) => {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return null;
  return digits.startsWith('55') ? digits : `55${digits}`;
};

const RecrutamentoSelecaoPage: React.FC = () => {
  const { profile } = useAuth();
  const { canAccess, isAdmin } = usePermissions();

  // Estados principais
  const [candidatos, setCandidatos] = useState<CandidatoTriagem[]>([]);
  const [templates, setTemplates] = useState<TemplateFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [feedbackFilter, setFeedbackFilter] = useState<'todos' | 'pendente' | 'enviado'>('todos');

  // Seleção em lote
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modais
  const [reprovacaoModalTargets, setReprovacaoModalTargets] = useState<CandidatoTriagem[] | null>(null);
  const [novoCandidatoModalOpen, setNovoCandidatoModalOpen] = useState(false);
  const [templatesModalOpen, setTemplatesModalOpen] = useState(false);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [detalheCandidato, setDetalheCandidato] = useState<CandidatoTriagem | null>(null);

  const showToast = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast(prev => (prev?.message === message ? null : prev));
    }, 5000);
  }, []);

  const carregarDados = useCallback(async () => {
    setLoading(true);
    try {
      const [candRes, tplRes] = await Promise.all([
        fetchCandidatosTriagem(),
        fetchTemplatesFeedback(),
      ]);
      setCandidatos(candRes.data);
      setTemplates(tplRes);
    } catch (err: any) {
      showToast('error', err?.message || 'Erro ao carregar candidatos.');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  // Verifica se o usuário tem permissão de acesso ao módulo
  if (!isAdmin && !canAccess('recrutamento-selecao')) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center min-h-[60vh] gap-6 p-8">
        <div className="flex items-center justify-center h-20 w-20 rounded-full bg-destructive/10 text-destructive">
          <ShieldOff className="h-10 w-10" />
        </div>
        <div className="text-center max-w-sm">
          <h2 className="text-xl font-bold text-foreground mb-2">Acesso Restrito ao RH</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Somente usuários com liberação para o módulo de Triagem de Currículos (Recursos Humanos) podem acessar esta página.
          </p>
        </div>
      </div>
    );
  }

  // ── Indicadores (KPIs) ─────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const total = candidatos.length;
    const aguardando = candidatos.filter(c => c.status === 'aguardando_triagem').length;
    const emProcesso = candidatos.filter(c =>
      ['em_analise', 'entrevista', 'aprovado', 'banco_talentos'].includes(c.status)
    ).length;
    const reprovados = candidatos.filter(c => c.status === 'reprovado').length;
    const feedbacksEnviados = candidatos.filter(c => c.feedback_enviado).length;
    const reprovadosSemEmail = candidatos.filter(c => c.status === 'reprovado' && !c.feedback_enviado).length;

    return { total, aguardando, emProcesso, reprovados, feedbacksEnviados, reprovadosSemEmail };
  }, [candidatos]);

  // ── Lista Filtrada ─────────────────────────────────────────────────────────
  const candidatosFiltrados = useMemo(() => {
    return candidatos.filter(c => {
      if (statusFilter !== 'todos' && c.status !== statusFilter) return false;
      if (feedbackFilter === 'pendente' && c.feedback_enviado) return false;
      if (feedbackFilter === 'enviado' && !c.feedback_enviado) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchNome = c.nome_candidato?.toLowerCase().includes(q);
        const matchEmail = c.email_candidato?.toLowerCase().includes(q);
        const matchTel = c.telefone?.toLowerCase().includes(q);
        const matchVaga = c.vaga_identificada?.toLowerCase().includes(q);
        const matchAssunto = c.assunto_email?.toLowerCase().includes(q);
        return matchNome || matchEmail || matchTel || matchVaga || matchAssunto;
      }

      return true;
    });
  }, [candidatos, statusFilter, feedbackFilter, searchTerm]);

  // ── Handlers de Seleção ────────────────────────────────────────────────────
  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]));
  };

  const toggleSelectAllFiltered = () => {
    const visibleIds = candidatosFiltrados.map(c => c.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedIds(Array.from(new Set([...selectedIds, ...visibleIds])));
    }
  };

  // ── Sincronizar E-mails via n8n ────────────────────────────────────────────
  const handleSyncEmails = async () => {
    setSyncing(true);
    const res = await sincronizarCurriculosEmailN8n();
    setSyncing(false);
    if (res.success) {
      showToast('success', res.message);
      await carregarDados();
    } else {
      showToast('info', res.message);
    }
  };

  // ── Mudança rápida de Status ───────────────────────────────────────────────
  const handleStatusChange = async (candidato: CandidatoTriagem, novoStatus: StatusCandidato) => {
    const res = await updateCandidatoStatus([candidato.id], novoStatus);
    if (res.success) {
      const meta = STATUS_CONFIG[novoStatus];
      showToast('success', `Status alterado para "${meta.label}". Botão atualizado para "${meta.actionLabel}".`);
      await carregarDados();
    } else {
      showToast('error', res.error || 'Erro ao atualizar status.');
    }
  };

  const handleExcluir = async (candidato: CandidatoTriagem) => {
    if (!window.confirm(`Deseja realmente remover o registro de "${candidato.nome_candidato}"?`)) return;
    const res = await deleteCandidatoTriagem(candidato.id);
    if (res.success) {
      setSelectedIds(prev => prev.filter(id => id !== candidato.id));
      showToast('success', 'Registro removido.');
      await carregarDados();
    }
  };

  const selectedObjects = useMemo(
    () => candidatos.filter(c => selectedIds.includes(c.id)),
    [candidatos, selectedIds]
  );

  return (
    <div className="flex-1 flex flex-col w-full max-w-none min-h-[calc(100vh-3rem)] space-y-4 sm:space-y-5 animate-in fade-in duration-300">
      {/* ── Toast Notification ── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-5 right-5 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium ${
              toast.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
                : toast.type === 'error'
                  ? 'bg-rose-950/90 border-rose-500/40 text-rose-200'
                  : 'bg-slate-900/95 border-primary/40 text-slate-100'
            }`}
          >
            {toast.type === 'success' && <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />}
            {toast.type === 'error' && <AlertCircle className="h-4 w-4 text-rose-400 flex-shrink-0" />}
            {toast.type === 'info' && <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />}
            <span>{toast.message}</span>
            <button onClick={() => setToast(null)} className="ml-2 opacity-70 hover:opacity-100">
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Cabeçalho Principal ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-card border border-border rounded-2xl p-5 shadow-sm">
        <div className="flex items-start sm:items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary flex-shrink-0">
            <UserCheck className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-primary/10 text-primary">
                Recursos Humanos
              </span>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" /> Captura de Currículos & Retorno de Seleção
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground mt-1">
              Triagem de Currículos e Feedback
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Visualize currículos recebidos por e-mail e envie respostas padronizadas de reprovação com 1 clique.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleSyncEmails}
            disabled={syncing}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-border bg-background hover:bg-muted text-foreground text-xs sm:text-sm font-medium transition-all disabled:opacity-50"
            title="Buscar novos e-mails com palavras-chave (Currículo, Vaga, Seleção)"
          >
            <RefreshCw className={`h-4 w-4 text-primary ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Buscando E-mails...' : 'Sincronizar E-mails'}</span>
          </button>

          <button
            onClick={() => setTemplatesModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-border bg-background hover:bg-muted text-foreground text-xs sm:text-sm font-medium transition-all"
          >
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span>Pré-Textos de E-mail</span>
          </button>

          <button
            onClick={() => setConfigModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-border bg-background hover:bg-muted text-foreground text-xs sm:text-sm font-medium transition-all"
            title="Configurar leitura do Webmail (IMAP/SMTP), palavras-chave e n8n"
          >
            <Settings2 className="h-4 w-4 text-primary" />
            <span>Configurar Leitura de E-mail</span>
          </button>

          <button
            onClick={() => setNovoCandidatoModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 text-xs sm:text-sm font-semibold shadow-sm transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>Novo Candidato</span>
          </button>
        </div>
      </div>

      {/* ── Cards de Indicadores (KPIs) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          onClick={() => {
            setStatusFilter('aguardando_triagem');
            setFeedbackFilter('todos');
          }}
          className={`text-left p-4 rounded-xl border transition-all ${
            statusFilter === 'aguardando_triagem'
              ? 'bg-card border-amber-500 ring-1 ring-amber-500/20 shadow-sm'
              : 'bg-card border-border hover:border-amber-500/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Triagem
            </span>
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-2">{kpis.aguardando}</p>
          <p className="text-xs text-muted-foreground mt-1">Pendentes de avaliação e resposta</p>
        </button>

        <button
          onClick={() => {
            setStatusFilter('em_analise');
            setFeedbackFilter('todos');
          }}
          className={`text-left p-4 rounded-xl border transition-all ${
            ['em_analise', 'entrevista', 'aprovado', 'banco_talentos'].includes(statusFilter)
              ? 'bg-card border-blue-500 ring-1 ring-blue-500/20 shadow-sm'
              : 'bg-card border-border hover:border-blue-500/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Em Análise / Processo
            </span>
            <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <Briefcase className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-2">{kpis.emProcesso}</p>
          <p className="text-xs text-muted-foreground mt-1">Em análise, entrevista ou aprovados</p>
        </button>

        <button
          onClick={() => {
            setStatusFilter('reprovado');
            setFeedbackFilter('todos');
          }}
          className={`text-left p-4 rounded-xl border transition-all ${
            statusFilter === 'reprovado'
              ? 'bg-card border-rose-500 ring-1 ring-rose-500/20 shadow-sm'
              : 'bg-card border-border hover:border-rose-500/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Reprovados
            </span>
            <div className="h-8 w-8 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center">
              <Send className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">{kpis.reprovados}</p>
            <span className="text-xs text-muted-foreground">({kpis.feedbacksEnviados} e-mails enviados)</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {kpis.reprovadosSemEmail > 0
              ? `${kpis.reprovadosSemEmail} reprovado(s) aguardando e-mail`
              : 'Todos os reprovados já receberam retorno'}
          </p>
        </button>

        <button
          onClick={() => {
            setStatusFilter('todos');
            setFeedbackFilter('todos');
          }}
          className={`text-left p-4 rounded-xl border transition-all ${
            statusFilter === 'todos' && feedbackFilter === 'todos'
              ? 'bg-card border-primary ring-1 ring-primary/20 shadow-sm'
              : 'bg-card border-border hover:border-primary/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total
            </span>
            <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Mail className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground mt-2">{kpis.total}</p>
          <p className="text-xs text-muted-foreground mt-1">Capturados por palavra-chave ou manual</p>
        </button>
      </div>

      {/* ── Barra de Filtros e Pesquisa ── */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Busca */}
          <div className="relative flex-1">
            <Search className="h-4 w-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome do candidato, e-mail, telefone, vaga ou palavra-chave do assunto..."
              className="w-full bg-background border border-border rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Filtro por Status */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground hidden sm:block" />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="todos">Todas as Etapas</option>
              <option value="aguardando_triagem">Aguardando Triagem</option>
              <option value="em_analise">Em Análise</option>
              <option value="entrevista">Em Entrevista</option>
              <option value="aprovado">Aprovado</option>
              <option value="banco_talentos">Banco de Talentos</option>
              <option value="reprovado">Reprovado</option>
            </select>

            <select
              value={feedbackFilter}
              onChange={e => setFeedbackFilter(e.target.value as any)}
              className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="todos">E-mail: Todos</option>
              <option value="pendente">Feedback Pendente</option>
              <option value="enviado">Feedback Já Enviado</option>
            </select>
          </div>
        </div>

        {/* Barra de Ação em Lote quando há candidatos selecionados */}
        <AnimatePresence>
          {selectedObjects.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="pt-2 border-t border-border flex flex-wrap items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2 text-sm">
                <span className="inline-flex items-center justify-center h-6 px-2.5 rounded-full bg-primary text-primary-foreground font-bold text-xs">
                  {selectedObjects.length}
                </span>
                <span className="font-medium text-foreground">
                  candidato(s) selecionado(s)
                </span>
                <button
                  onClick={() => setSelectedIds([])}
                  className="text-xs text-muted-foreground hover:text-foreground underline ml-2"
                >
                  Limpar seleção
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={async () => {
                    await updateCandidatoStatus(selectedIds, 'em_analise');
                    setSelectedIds([]);
                    showToast('success', 'Candidatos movidos para Em Análise.');
                    carregarDados();
                  }}
                  className="px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-xs font-medium text-foreground transition-colors"
                >
                  Mover para Em Análise
                </button>

                <button
                  onClick={() => setReprovacaoModalTargets(selectedObjects)}
                  className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-semibold shadow-sm transition-all"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Reprovar e Enviar E-mail ({selectedObjects.length})</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Tabela / Lista Responsiva de Candidatos (Ocupa altura e largura total) ── */}
      <div className="flex-1 flex flex-col bg-card border border-border rounded-xl shadow-sm overflow-hidden w-full">
        {loading ? (
          <div className="flex-1 p-16 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm">Carregando lista de candidatos...</p>
          </div>
        ) : candidatosFiltrados.length === 0 ? (
          <div className="flex-1 p-16 flex flex-col items-center justify-center text-center gap-3">
            <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
              <Mail className="h-7 w-7" />
            </div>
            <h3 className="text-base font-bold text-foreground">Nenhum candidato encontrado</h3>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-md">
              Não há currículos para os filtros selecionados. Clique em <strong>Sincronizar E-mails</strong> ou adicione um candidato manualmente.
            </p>
          </div>
        ) : (
          <>
            {/* Visão Mobile / Tablet (Cards Responsivos) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 sm:p-4 xl:hidden">
              {candidatosFiltrados.map(cand => {
                const isSelected = selectedIds.includes(cand.id);
                const whatsNumber = cleanPhoneForWhatsApp(cand.telefone);
                const statusMeta = STATUS_CONFIG[cand.status] || STATUS_CONFIG.aguardando_triagem;

                return (
                  <div
                    key={cand.id}
                    className={`flex flex-col justify-between rounded-xl border p-4 transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                        : 'border-border bg-background/60 hover:border-primary/30'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectOne(cand.id)}
                            className="rounded border-border text-primary focus:ring-primary cursor-pointer h-4 w-4 mt-1 flex-shrink-0"
                          />
                          <div className="min-w-0">
                            <button
                              onClick={() => setDetalheCandidato(cand)}
                              className="font-bold text-foreground hover:text-primary text-left truncate block w-full"
                            >
                              {cand.nome_candidato}
                            </button>
                            <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                              <Mail className="h-3 w-3 flex-shrink-0" />
                              {cand.email_candidato}
                            </p>
                          </div>
                        </div>

                        <select
                          value={cand.status}
                          onChange={e => handleStatusChange(cand, e.target.value as StatusCandidato)}
                          className={`text-[11px] font-semibold px-2 py-1 rounded-lg border cursor-pointer focus:outline-none flex-shrink-0 ${statusMeta.badgeClass}`}
                        >
                          <option value="aguardando_triagem">Aguardando Triagem</option>
                          <option value="em_analise">Em Análise</option>
                          <option value="entrevista">Em Entrevista</option>
                          <option value="aprovado">Aprovado</option>
                          <option value="banco_talentos">Banco de Talentos</option>
                          <option value="reprovado">Reprovado</option>
                        </select>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="inline-flex items-center gap-1 font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                          <Briefcase className="h-3 w-3" />
                          {cand.vaga_identificada || 'Geral'}
                        </span>

                        {cand.telefone && (
                          <span className="inline-flex items-center gap-1 text-foreground font-medium">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            {cand.telefone}
                          </span>
                        )}

                        {whatsNumber && (
                          <a
                            href={`https://wa.me/${whatsNumber}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold hover:underline"
                          >
                            <MessageSquare className="h-3 w-3" />
                            WhatsApp
                          </a>
                        )}
                      </div>

                      {cand.assunto_email && (
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          <strong className="text-foreground/80">Assunto:</strong> {cand.assunto_email}
                        </p>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-border flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-[11px] text-muted-foreground">
                        {cand.feedback_enviado ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium inline-flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Feedback Enviado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" /> Sem retorno enviado
                          </span>
                        )}
                      </span>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setReprovacaoModalTargets([cand])}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm ${
                            cand.feedback_enviado
                              ? 'border border-border bg-background hover:bg-muted text-muted-foreground'
                              : statusMeta.actionBtnClass
                          }`}
                        >
                          <Send className="h-3.5 w-3.5" />
                          <span>{cand.feedback_enviado ? statusMeta.actionResendLabel : statusMeta.actionLabel}</span>
                        </button>
                        <button
                          onClick={() => setDetalheCandidato(cand)}
                          className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleExcluir(cand)}
                          className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-rose-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Visão Desktop Full-Screen (Tabela Ocupando 100% da Largura) */}
            <div className="hidden xl:block flex-1 overflow-x-auto w-full">
              <table className="w-full text-sm table-auto">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left">
                    <th className="px-4 py-3.5 w-10">
                      <input
                        type="checkbox"
                        checked={
                          candidatosFiltrados.length > 0 &&
                          candidatosFiltrados.every(c => selectedIds.includes(c.id))
                        }
                        onChange={toggleSelectAllFiltered}
                        className="rounded border-border text-primary focus:ring-primary cursor-pointer h-4 w-4"
                      />
                    </th>
                    <th className="px-4 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Candidato / E-mail
                    </th>
                    <th className="px-4 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Telefone
                    </th>
                    <th className="px-4 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Vaga / Assunto do E-mail
                    </th>
                    <th className="px-4 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Currículo
                    </th>
                    <th className="px-4 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Status / Retorno
                    </th>
                    <th className="px-4 py-3.5 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Ações de Feedback
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {candidatosFiltrados.map(cand => {
                    const isSelected = selectedIds.includes(cand.id);
                    const whatsNumber = cleanPhoneForWhatsApp(cand.telefone);
                    const statusMeta = STATUS_CONFIG[cand.status] || STATUS_CONFIG.aguardando_triagem;

                    return (
                      <tr
                        key={cand.id}
                        className={`transition-colors ${
                          isSelected ? 'bg-primary/5' : 'hover:bg-muted/20'
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="px-4 py-3.5 align-top">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectOne(cand.id)}
                            className="rounded border-border text-primary focus:ring-primary cursor-pointer h-4 w-4 mt-1"
                          />
                        </td>

                        {/* Candidato + E-mail + Data */}
                        <td className="px-4 py-3.5 align-top">
                          <div className="flex flex-col">
                            <button
                              onClick={() => setDetalheCandidato(cand)}
                              className="font-semibold text-foreground hover:text-primary text-left transition-colors"
                            >
                              {cand.nome_candidato}
                            </button>
                            <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Mail className="h-3 w-3 flex-shrink-0" />
                              {cand.email_candidato}
                            </span>
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              <span className="text-[11px] text-muted-foreground">
                                Recebido em {formatDateTime(cand.data_recebimento)}
                              </span>
                              {cand.palavras_chave_detectadas && cand.palavras_chave_detectadas.length > 0 && (
                                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                                  <Tag className="h-2.5 w-2.5" />
                                  {cand.palavras_chave_detectadas.join(', ')}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Telefone + Botão WhatsApp */}
                        <td className="px-4 py-3.5 align-top whitespace-nowrap">
                          {cand.telefone ? (
                            <div className="flex flex-col gap-1">
                              <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
                                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                                {cand.telefone}
                              </span>
                              {whatsNumber && (
                                <a
                                  href={`https://wa.me/${whatsNumber}?text=${encodeURIComponent(
                                    `Olá ${cand.nome_candidato.split(' ')[0]}, tudo bem? Entramos em contato pelo setor de Recursos Humanos do Hospital Santa Casa de Araguari referente ao seu currículo enviado para a vaga de ${cand.vaga_identificada}.`
                                  )}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
                                >
                                  <MessageSquare className="h-3 w-3" />
                                  Chamar no WhatsApp
                                </a>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Não informado</span>
                          )}
                        </td>

                        {/* Vaga Identificada + Assunto do E-mail */}
                        <td className="px-4 py-3.5 align-top max-w-md 2xl:max-w-xl">
                          <div className="flex flex-col gap-1">
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/10 px-2.5 py-0.5 rounded-md w-fit">
                              <Briefcase className="h-3 w-3" />
                              {cand.vaga_identificada || 'Geral / Banco de Talentos'}
                            </span>
                            {cand.assunto_email && (
                              <p
                                className="text-xs text-foreground/90 truncate"
                                title={cand.assunto_email}
                              >
                                <span className="text-muted-foreground">Assunto:</span> {cand.assunto_email}
                              </p>
                            )}
                            {cand.resumo_perfil && (
                              <p
                                className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed"
                                title={cand.resumo_perfil}
                              >
                                {cand.resumo_perfil}
                              </p>
                            )}
                          </div>
                        </td>

                        {/* Anexo / Currículo */}
                        <td className="px-4 py-3.5 align-top whitespace-nowrap">
                          {cand.curriculo_url ? (
                            <a
                              href={cand.curriculo_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-xs font-medium text-primary transition-colors"
                              title={cand.curriculo_nome || 'Abrir arquivo do currículo'}
                            >
                              <FileText className="h-3.5 w-3.5" />
                              <span>
                                {/\.(png|jpe?g|webp)$/i.test(cand.curriculo_url)
                                  ? 'Ver Imagem'
                                  : /\.(docx?|rtf)$/i.test(cand.curriculo_url)
                                    ? 'Baixar Word'
                                    : 'Abrir PDF'}
                              </span>
                              <ExternalLink className="h-3 w-3 opacity-60" />
                            </a>
                          ) : cand.curriculo_nome ? (
                            <button
                              onClick={() => setDetalheCandidato(cand)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-muted/40 hover:bg-muted text-xs text-foreground transition-colors"
                              title={cand.curriculo_nome}
                            >
                              <FileText className="h-3.5 w-3.5 text-primary" />
                              <span className="max-w-[160px] truncate">{cand.curriculo_nome}</span>
                            </button>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Sem anexo</span>
                          )}
                        </td>

                        {/* Seletor de Etapa + Indicador de E-mail Enviado */}
                        <td className="px-4 py-3.5 align-top">
                          <div className="flex flex-col gap-1.5">
                            <select
                              value={cand.status}
                              onChange={e => handleStatusChange(cand, e.target.value as StatusCandidato)}
                              className={`text-xs font-semibold px-2.5 py-1 rounded-lg border cursor-pointer focus:outline-none ${statusMeta.badgeClass}`}
                            >
                              <option value="aguardando_triagem">Aguardando Triagem</option>
                              <option value="em_analise">Em Análise</option>
                              <option value="entrevista">Em Entrevista</option>
                              <option value="aprovado">Aprovado</option>
                              <option value="banco_talentos">Banco de Talentos</option>
                              <option value="reprovado">Reprovado</option>
                            </select>

                            {cand.feedback_enviado ? (
                              <span
                                className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium"
                                title={`Enviado em ${formatDateTime(cand.feedback_enviado_em)} por ${cand.feedback_enviado_por_nome || 'RH'}`}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
                                <span>E-mail enviado ({cand.feedback_enviado_em ? new Date(cand.feedback_enviado_em).toLocaleDateString('pt-BR') : 'OK'})</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                                <Clock className="h-3 w-3 flex-shrink-0" />
                                <span>Feedback não enviado</span>
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Botões de Ação Principal */}
                        <td className="px-4 py-3.5 align-top text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setReprovacaoModalTargets([cand])}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm ${
                                cand.feedback_enviado
                                  ? 'border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground'
                                  : statusMeta.actionBtnClass
                              }`}
                              title={
                                cand.feedback_enviado
                                  ? `O e-mail de ${statusMeta.label.toLowerCase()} já foi enviado. Clique para visualizar ou reenviar.`
                                  : `Abrir pré-texto de ${statusMeta.label.toLowerCase()} e enviar por e-mail para o candidato`
                              }
                            >
                              <Send className="h-3.5 w-3.5" />
                              <span>{cand.feedback_enviado ? statusMeta.actionResendLabel : statusMeta.actionLabel}</span>
                            </button>

                            <button
                              onClick={() => setDetalheCandidato(cand)}
                              className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                              title="Ver Detalhes e Observações"
                            >
                              <Eye className="h-4 w-4" />
                            </button>

                            <button
                              onClick={() => handleExcluir(cand)}
                              className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                              title="Remover candidato"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ── MODAL 1: DISPARO DE E-MAIL DE REPROVAÇÃO COM PRÉ-TEXTO ── */}
      <AnimatePresence>
        {reprovacaoModalTargets && reprovacaoModalTargets.length > 0 && (
          <ReprovacaoEmailModal
            candidatos={reprovacaoModalTargets}
            templates={templates}
            usuarioId={profile?.id}
            usuarioNome={profile?.full_name || profile?.email || 'Equipe RH'}
            onClose={() => setReprovacaoModalTargets(null)}
            onSuccess={async msg => {
              setReprovacaoModalTargets(null);
              setSelectedIds([]);
              showToast('success', msg);
              await carregarDados();
            }}
            onError={msg => showToast('error', msg)}
          />
        )}
      </AnimatePresence>

      {/* ── MODAL 2: CADASTRO MANUAL DE CANDIDATO ── */}
      <AnimatePresence>
        {novoCandidatoModalOpen && (
          <NovoCandidatoModal
            onClose={() => setNovoCandidatoModalOpen(false)}
            onSaved={async () => {
              setNovoCandidatoModalOpen(false);
              showToast('success', 'Candidato adicionado à fila de triagem!');
              await carregarDados();
            }}
          />
        )}
      </AnimatePresence>

      {/* ── MODAL 3: GERENCIAR PRÉ-TEXTOS / MODELOS DE FEEDBACK ── */}
      <AnimatePresence>
        {templatesModalOpen && (
          <TemplatesManagerModal
            templates={templates}
            onClose={() => setTemplatesModalOpen(false)}
            onSaved={async () => {
              const updated = await fetchTemplatesFeedback();
              setTemplates(updated);
              showToast('success', 'Modelo de mensagem salvo com sucesso!');
            }}
          />
        )}
      </AnimatePresence>

      {/* ── MODAL 4: CONFIGURAÇÃO DA AUTOMAÇÃO DE E-MAIL / N8N ── */}
      <AnimatePresence>
        {configModalOpen && (
          <ConfigAutomacaoModal
            onClose={() => setConfigModalOpen(false)}
            onSaved={async () => {
              setConfigModalOpen(false);
              await carregarDados();
              showToast('success', 'Configurações e filtros de captura aplicados com sucesso!');
            }}
          />
        )}
      </AnimatePresence>

      {/* ── MODAL 5: DETALHES E HISTÓRICO DO CANDIDATO ── */}
      <AnimatePresence>
        {detalheCandidato && (
          <DetalheCandidatoModal
            candidato={detalheCandidato}
            onClose={() => setDetalheCandidato(null)}
            onOpenReprovar={cand => {
              setDetalheCandidato(null);
              setReprovacaoModalTargets([cand]);
            }}
            onSaved={async () => {
              await carregarDados();
              showToast('success', 'Observações atualizadas!');
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// ============================================================================
// SUB-COMPONENTE: MODAL DE DISPARO DE E-MAIL POR STATUS (PRÉ-TEXTO + ENVIO)
// ============================================================================
const ReprovacaoEmailModal: React.FC<{
  candidatos: CandidatoTriagem[];
  templates: TemplateFeedback[];
  usuarioId?: string | null;
  usuarioNome?: string | null;
  onClose: () => void;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}> = ({ candidatos, templates, usuarioId, usuarioNome, onClose, onSuccess, onError }) => {
  const candidatoExemplo = candidatos[0];
  const [statusDestino, setStatusDestino] = useState<StatusCandidato>(
    candidatoExemplo?.status || 'reprovado'
  );

  const statusMeta = STATUS_CONFIG[statusDestino] || STATUS_CONFIG.reprovado;

  const matchingTpl = useMemo(() => {
    return (
      templates.find(t => t.status_vinculado === statusDestino) ||
      templates.find(t => t.is_default) ||
      templates[0]
    );
  }, [templates, statusDestino]);

  const [selectedTplId, setSelectedTplId] = useState<string>(matchingTpl?.id || '');
  const [assunto, setAssunto] = useState<string>(matchingTpl?.assunto || '');
  const [corpoTexto, setCorpoTexto] = useState<string>(matchingTpl?.corpo_texto || '');
  const [abaVisualizacao, setAbaVisualizacao] = useState<'editar' | 'preview'>('editar');
  const [enviando, setEnviando] = useState(false);

  const handleSelectTemplate = (tplId: string) => {
    setSelectedTplId(tplId);
    const found = templates.find(t => t.id === tplId);
    if (found) {
      setAssunto(found.assunto);
      setCorpoTexto(found.corpo_texto);
      if (found.status_vinculado) {
        setStatusDestino(found.status_vinculado);
      }
    }
  };

  const assuntoPreview = useMemo(
    () => formatarTextoFeedback(assunto, candidatoExemplo),
    [assunto, candidatoExemplo]
  );

  const corpoPreview = useMemo(
    () => formatarTextoFeedback(corpoTexto, candidatoExemplo),
    [corpoTexto, candidatoExemplo]
  );

  const handleConfirmarDisparo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assunto.trim() || !corpoTexto.trim()) {
      onError('Preencha o assunto e o texto da mensagem antes de enviar.');
      return;
    }

    setEnviando(true);
    const res = await dispararFeedbackReprovacao({
      candidatos,
      assuntoTemplate: assunto,
      mensagemTemplate: corpoTexto,
      statusDestino,
      usuarioId,
      usuarioNome,
    });
    setEnviando(false);

    if (res.success) {
      onSuccess(
        candidatos.length === 1
          ? `E-mail (${statusMeta.label}) enviado com sucesso para ${candidatoExemplo.nome_candidato} (${candidatoExemplo.email_candidato})!`
          : `E-mail (${statusMeta.label}) enviado com sucesso para ${res.enviados} candidato(s)!`
      );
    } else {
      onError(res.detalhesErro || 'Falha ao disparar o e-mail de feedback.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden my-8"
      >
        {/* Header dinâmico conforme o status */}
        <div className={`p-5 border-b border-border ${statusMeta.headerBg} flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-xl border ${statusMeta.iconBg} flex items-center justify-center`}>
              <Send className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-foreground text-base">
                  {statusMeta.modalTitle}
                </h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusMeta.badgeClass}`}>
                  {statusMeta.label}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {candidatos.length === 1
                  ? `Destinatário: ${candidatoExemplo.nome_candidato} <${candidatoExemplo.email_candidato}>`
                  : `Disparo em lote para ${candidatos.length} candidatos selecionados`}
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

        <form onSubmit={handleConfirmarDisparo} className="p-5 space-y-4">
          {/* Resumo do(s) destinatário(s) */}
          <div className="p-3 rounded-xl bg-muted/40 border border-border flex flex-wrap items-center justify-between gap-2 text-xs">
            {candidatos.length === 1 ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">{candidatoExemplo.nome_candidato}</span>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-primary font-medium">{candidatoExemplo.email_candidato}</span>
                </div>
                <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-semibold">
                  Vaga: {candidatoExemplo.vaga_identificada}
                </span>
              </>
            ) : (
              <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto w-full">
                {candidatos.map(c => (
                  <span
                    key={c.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-background border border-border text-foreground"
                  >
                    <span className="font-medium">{c.nome_candidato}</span>
                    <span className="text-muted-foreground">({c.email_candidato})</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Escolha do Modelo de Pré-Texto */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                Modelo de Pré-Texto
              </label>
              <select
                value={selectedTplId}
                onChange={e => handleSelectTemplate(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {templates.map(tpl => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.titulo} {tpl.is_default ? '(Padrão)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Alternar entre Editar e Pré-visualizar */}
            <div className="flex items-center bg-muted p-1 rounded-lg self-end">
              <button
                type="button"
                onClick={() => setAbaVisualizacao('editar')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  abaVisualizacao === 'editar'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Editar Pré-Texto
              </button>
              <button
                type="button"
                onClick={() => setAbaVisualizacao('preview')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  abaVisualizacao === 'preview'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Ver Prévia do E-mail
              </button>
            </div>
          </div>

          {abaVisualizacao === 'editar' ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                  Assunto do E-mail
                </label>
                <input
                  type="text"
                  required
                  value={assunto}
                  onChange={e => setAssunto(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Mensagem para o Candidato
                  </label>
                  <span className="text-[11px] text-muted-foreground">
                    Variáveis automáticas: <code className="text-primary">{'{{nome}}'}</code> e{' '}
                    <code className="text-primary">{'{{vaga}}'}</code>
                  </span>
                </div>
                <textarea
                  rows={10}
                  required
                  value={corpoTexto}
                  onChange={e => setCorpoTexto(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg p-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary font-sans"
                />
              </div>
            </div>
          ) : (
            /* Pré-visualização de como o candidato vai receber */
            <div className="border border-border rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-900 p-4 max-h-[360px] overflow-y-auto">
              <div className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm max-w-lg mx-auto">
                <div className="bg-slate-900 text-white p-4 text-center">
                  <p className="text-xs font-bold tracking-widest uppercase text-slate-300">
                    Hospital Santa Casa de Misericórdia de Araguari
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Recursos Humanos • Processo Seletivo
                  </p>
                </div>
                <div className="p-5 space-y-3">
                  <div className="pb-2 border-b border-slate-100 dark:border-slate-800 text-xs text-slate-500">
                    <strong>Assunto:</strong> {assuntoPreview}
                  </div>
                  <div className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-line leading-relaxed">
                    {corpoPreview}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Rodapé do Modal */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={enviando}
              className={`inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold shadow-sm transition-all disabled:opacity-50 ${statusMeta.actionBtnClass}`}
            >
              {enviando ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Disparando E-mail...</span>
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  <span>{statusMeta.confirmLabel}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

// ============================================================================
// SUB-COMPONENTE: MODAL DE NOVO CANDIDATO (MANUAL / UPLOAD DE CURRÍCULO)
// ============================================================================
const NovoCandidatoModal: React.FC<{
  onClose: () => void;
  onSaved: () => void;
}> = ({ onClose, onSaved }) => {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [vaga, setVaga] = useState('');
  const [assunto, setAssunto] = useState('');
  const [resumo, setResumo] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !email.trim()) return;

    setSalvando(true);
    let curriculoUrl: string | null = null;
    if (arquivo) {
      const up = await uploadCurriculoPdf(arquivo);
      if (up.url) curriculoUrl = up.url;
    }

    await createCandidatoTriagem({
      nome_candidato: nome.trim(),
      email_candidato: email.trim(),
      telefone: telefone.trim() || null,
      vaga_identificada: vaga.trim() || 'Geral / Banco de Talentos',
      assunto_email: assunto.trim() || 'Cadastro Manual no RH',
      resumo_perfil: resumo.trim() || null,
      curriculo_url: curriculoUrl,
      curriculo_nome: arquivo ? arquivo.name : null,
      observacoes: null,
      origem: 'manual',
    });

    setSalvando(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
      >
        <div className="p-5 border-b border-border flex items-center justify-between">
          <h3 className="font-bold text-foreground">Adicionar Candidato Manualmente</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">
              Nome do Candidato *
            </label>
            <input
              type="text"
              required
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Ex: Ana Paula Ribeiro"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">
                E-mail do Candidato *
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="candidato@email.com"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">
                Telefone / WhatsApp
              </label>
              <input
                type="text"
                value={telefone}
                onChange={e => setTelefone(e.target.value)}
                placeholder="(34) 99999-0000"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">
                Vaga Pretendida
              </label>
              <input
                type="text"
                value={vaga}
                onChange={e => setVaga(e.target.value)}
                placeholder="Ex: Enfermeiro(a), Recepção..."
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">
                Origem / Assunto
              </label>
              <input
                type="text"
                value={assunto}
                onChange={e => setAssunto(e.target.value)}
                placeholder="Ex: Entregue na Recepção / E-mail"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">
              Resumo / Observações Iniciais
            </label>
            <textarea
              rows={2}
              value={resumo}
              onChange={e => setResumo(e.target.value)}
              placeholder="Breve resumo das qualificações do candidato..."
              className="w-full bg-background border border-border rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">
              Anexar Currículo (PDF)
            </label>
            <label className="flex items-center justify-center gap-2 border-2 border-dashed border-border hover:border-primary/50 rounded-xl p-4 cursor-pointer transition-colors bg-background/50">
              <Upload className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">
                {arquivo ? arquivo.name : 'Clique para selecionar o Currículo (PDF, Word ou Imagem)'}
              </span>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp"
                className="hidden"
                onChange={e => setArquivo(e.target.files?.[0] || null)}
              />
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-border text-sm text-foreground hover:bg-muted"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              <span>Salvar Candidato</span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

// ============================================================================
// SUB-COMPONENTE: GERENCIADOR DE PRÉ-TEXTOS DE REPROVAÇÃO
// ============================================================================
const TemplatesManagerModal: React.FC<{
  templates: TemplateFeedback[];
  onClose: () => void;
  onSaved: () => void;
}> = ({ templates, onClose, onSaved }) => {
  const [editing, setEditing] = useState<TemplateFeedback | null>(templates[0] || null);
  const [titulo, setTitulo] = useState(templates[0]?.titulo || '');
  const [assunto, setAssunto] = useState(templates[0]?.assunto || '');
  const [corpo, setCorpo] = useState(templates[0]?.corpo_texto || '');
  const [statusVinculado, setStatusVinculado] = useState<StatusCandidato>(
    templates[0]?.status_vinculado || 'reprovado'
  );
  const [isDefault, setIsDefault] = useState(templates[0]?.is_default || false);
  const [saving, setSaving] = useState(false);

  const selectTpl = (tpl: TemplateFeedback | null) => {
    setEditing(tpl);
    setTitulo(tpl?.titulo || '');
    setAssunto(
      tpl?.assunto || 'Retorno sobre Processo Seletivo - {{vaga}} | Hospital Santa Casa de Araguari'
    );
    setCorpo(tpl?.corpo_texto || 'Olá, {{nome}}!\n\n');
    setStatusVinculado(tpl?.status_vinculado || 'reprovado');
    setIsDefault(tpl?.is_default || false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await saveTemplateFeedback({
      id: editing?.id,
      titulo,
      assunto,
      corpo_texto: corpo,
      status_vinculado: statusVinculado,
      is_default: isDefault,
    });
    setSaving(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden"
      >
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="font-bold text-foreground">Modelos de Pré-Texto por Status</h3>
            <p className="text-xs text-muted-foreground">
              Personalize as mensagens automáticas vinculadas a cada etapa do processo seletivo
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border">
          {/* Lista lateral */}
          <div className="p-4 space-y-2 bg-muted/20 max-h-[480px] overflow-y-auto">
            <button
              type="button"
              onClick={() => selectTpl(null)}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 mb-2"
            >
              <Plus className="h-3.5 w-3.5" />
              Novo Modelo de Texto
            </button>

            {templates.map(t => {
              const sMeta = t.status_vinculado ? STATUS_CONFIG[t.status_vinculado] : null;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => selectTpl(t)}
                  className={`w-full text-left p-2.5 rounded-lg border text-xs transition-all space-y-1 ${
                    editing?.id === t.id
                      ? 'bg-primary/10 border-primary text-primary font-semibold'
                      : 'bg-card border-border text-foreground hover:bg-muted'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate">{t.titulo}</span>
                    {t.is_default && (
                      <BookmarkCheck className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                    )}
                  </div>
                  {sMeta && (
                    <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded border ${sMeta.badgeClass}`}>
                      {sMeta.label}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Editor */}
          <form onSubmit={handleSave} className="md:col-span-2 p-5 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">
                  Nome do Modelo
                </label>
                <input
                  type="text"
                  required
                  value={titulo}
                  onChange={e => setTitulo(e.target.value)}
                  placeholder="Ex: Aprovação na Vaga"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">
                  Status Vinculado
                </label>
                <select
                  value={statusVinculado}
                  onChange={e => setStatusVinculado(e.target.value as StatusCandidato)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="aguardando_triagem">Aguardando Triagem</option>
                  <option value="em_analise">Em Análise</option>
                  <option value="entrevista">Em Entrevista</option>
                  <option value="aprovado">Aprovado</option>
                  <option value="banco_talentos">Banco de Talentos</option>
                  <option value="reprovado">Reprovado</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">
                Assunto Padrão do E-mail
              </label>
              <input
                type="text"
                required
                value={assunto}
                onChange={e => setAssunto(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">
                Corpo do Pré-Texto (Use {'{{nome}}'} e {'{{vaga}}'})
              </label>
              <textarea
                rows={8}
                required
                value={corpo}
                onChange={e => setCorpo(e.target.value)}
                className="w-full bg-background border border-border rounded-lg p-3 text-sm leading-relaxed"
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={e => setIsDefault(e.target.checked)}
                className="rounded border-border text-primary"
              />
              <span>Definir como modelo principal padrão ao abrir a tela de reprovação</span>
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-border text-xs font-medium"
              >
                Fechar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                <span>Salvar Modelo</span>
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
};

// ============================================================================
// SUB-COMPONENTE: MODAL DE CONFIGURAÇÃO DE LEITURA DE E-MAIL (WEBMAIL IMAP / SMTP / PALAVRAS-CHAVE / N8N)
// ============================================================================
const ConfigAutomacaoModal: React.FC<{
  onClose: () => void;
  onSaved: () => void;
}> = ({ onClose, onSaved }) => {
  const [config, setConfig] = useState<RecrutamentoConfig>(() => getRecrutamentoConfig());
  const [abaAtiva, setAbaAtiva] = useState<'servidor' | 'regras' | 'integracao'>('servidor');
  const [novaPalavra, setNovaPalavra] = useState('');
  const [novaPalavraIgnorada, setNovaPalavraIgnorada] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [carregandoConfig, setCarregandoConfig] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [testandoConexao, setTestandoConexao] = useState(false);
  const [resultadoTeste, setResultadoTeste] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const [emailTesteEnvio, setEmailTesteEnvio] = useState('');
  const [testandoEnvioSmtp, setTestandoEnvioSmtp] = useState(false);
  const [resultadoTesteEnvio, setResultadoTesteEnvio] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    let mounted = true;
    fetchRecrutamentoConfigAsync().then(loaded => {
      if (mounted) {
        setConfig(loaded);
        setCarregandoConfig(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const addPalavra = (palavraCustom?: string) => {
    const clean = (palavraCustom ?? novaPalavra).trim();
    if (!clean || config.palavrasChave.includes(clean)) return;
    setConfig(prev => ({ ...prev, palavrasChave: [...prev.palavrasChave, clean] }));
    if (!palavraCustom) setNovaPalavra('');
  };

  const removePalavra = (palavra: string) => {
    setConfig(prev => ({
      ...prev,
      palavrasChave: prev.palavrasChave.filter(p => p !== palavra),
    }));
  };

  const addPalavraIgnorada = (termoCustom?: string) => {
    const clean = (termoCustom ?? novaPalavraIgnorada).trim();
    const listaAtual = config.palavrasIgnoradas || [];
    if (!clean || listaAtual.some(p => p.toLowerCase() === clean.toLowerCase())) return;
    setConfig(prev => ({
      ...prev,
      palavrasIgnoradas: [...(prev.palavrasIgnoradas || []), clean],
    }));
    if (!termoCustom) setNovaPalavraIgnorada('');
  };

  const removePalavraIgnorada = (termo: string) => {
    setConfig(prev => ({
      ...prev,
      palavrasIgnoradas: (prev.palavrasIgnoradas || []).filter(p => p !== termo),
    }));
  };

  const handleTestarImap = async () => {
    setTestandoConexao(true);
    setResultadoTeste(null);
    const res = await testarConexaoEmailLeitura(config);
    setResultadoTeste(res);
    setTestandoConexao(false);
  };

  const handleTestarEnvioSmtp = async () => {
    setTestandoEnvioSmtp(true);
    setResultadoTesteEnvio(null);
    const res = await testarDisparoEmailSmtp(config, emailTesteEnvio);
    setResultadoTesteEnvio(res);
    setTestandoEnvioSmtp(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    // Sincroniza emailMonitorado com imapUser se preenchido
    const finalConfig: RecrutamentoConfig = {
      ...config,
      emailMonitorado: config.imapUser?.trim() || config.emailMonitorado?.trim(),
      imapUser: config.imapUser?.trim() || config.emailMonitorado?.trim(),
    };
    await saveRecrutamentoConfigAsync(finalConfig);
    setSalvando(false);
    onSaved();
  };

  const sugestoesPalavras = [
    'Currículo',
    'Vaga',
    'Seleção',
    'CV',
    'Trabalhe Conosco',
    'Emprego',
    'Enfermagem',
    'Administrativo',
    'Recepção',
    'Farmácia',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden my-8"
      >
        {/* Header */}
        <div className="p-5 border-b border-border bg-primary/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center">
              <Server className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-base">
                Configuração da Leitura de E-mails (Webmail RH)
              </h3>
              <p className="text-xs text-muted-foreground">
                Configure a caixa de entrada que recebe os currículos, filtros de captura e servidor de disparo
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

        {/* Navegação em Abas */}
        <div className="flex border-b border-border bg-muted/30 px-5 pt-2 gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setAbaAtiva('servidor')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
              abaAtiva === 'servidor'
                ? 'border-primary text-primary bg-card rounded-t-lg'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Inbox className="h-3.5 w-3.5" />
            <span>1. Conta & Servidor Webmail (IMAP/SMTP)</span>
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva('regras')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
              abaAtiva === 'regras'
                ? 'border-primary text-primary bg-card rounded-t-lg'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Tag className="h-3.5 w-3.5" />
            <span>2. Palavras-Chave & Regras de Captura</span>
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva('integracao')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
              abaAtiva === 'integracao'
                ? 'border-primary text-primary bg-card rounded-t-lg'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Settings2 className="h-3.5 w-3.5" />
            <span>3. Modo de Leitura & n8n</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {carregandoConfig ? (
            <div className="py-10 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span>Carregando configurações salvas...</span>
            </div>
          ) : abaAtiva === 'servidor' ? (
            /* ── ABA 1: SERVIDOR WEBMAIL IMAP & SMTP ── */
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/20 text-xs text-muted-foreground flex items-start gap-2.5">
                <Mail className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                <div>
                  Informe os dados do <strong>Webmail do RH</strong> que recebe os currículos. O sistema se conecta via{' '}
                  <strong>IMAP</strong> para buscar novos e-mails com as palavras-chave e utiliza o <strong>SMTP</strong>{' '}
                  para enviar os retornos de seleção.
                </div>
              </div>

              {/* Credenciais da Conta */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">
                    E-mail da Caixa de Currículos (Usuário) *
                  </label>
                  <input
                    type="email"
                    required
                    value={config.imapUser}
                    onChange={e =>
                      setConfig(p => ({
                        ...p,
                        imapUser: e.target.value,
                        emailMonitorado: e.target.value,
                      }))
                    }
                    placeholder="rh@santacasaaraguari.org.br"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">
                    Senha do Webmail *
                  </label>
                  <div className="relative">
                    <input
                      type={mostrarSenha ? 'text' : 'password'}
                      value={config.imapPass}
                      onChange={e => setConfig(p => ({ ...p, imapPass: e.target.value }))}
                      placeholder="Digite a senha do e-mail do RH..."
                      className="w-full bg-background border border-border rounded-lg pl-3 pr-9 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <button
                      type="button"
                      onClick={() => setMostrarSenha(v => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      title={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                    >
                      {mostrarSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Host IMAP, Porta e Criptografia */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">
                    Servidor de Entrada (Host IMAP) *
                  </label>
                  <input
                    type="text"
                    required
                    value={config.imapHost}
                    onChange={e => setConfig(p => ({ ...p, imapHost: e.target.value }))}
                    placeholder="mail.santacasaaraguari.org.br"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">
                    Porta IMAP
                  </label>
                  <input
                    type="text"
                    value={config.imapPort}
                    onChange={e => setConfig(p => ({ ...p, imapPort: e.target.value }))}
                    placeholder="993"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">
                    Segurança
                  </label>
                  <select
                    value={config.imapSecure}
                    onChange={e => {
                      const sec = e.target.value as 'ssl' | 'tls' | 'none';
                      setConfig(p => ({
                        ...p,
                        imapSecure: sec,
                        imapPort: sec === 'ssl' ? '993' : '143',
                      }));
                    }}
                    className="w-full bg-background border border-border rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="ssl">SSL/TLS (993)</option>
                    <option value="tls">STARTTLS (143)</option>
                    <option value="none">Sem SSL (143)</option>
                  </select>
                </div>
              </div>

              {/* Pasta Monitorada e Quantidade */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">
                    Pasta da Caixa de Entrada
                  </label>
                  <input
                    type="text"
                    value={config.imapMailbox}
                    onChange={e => setConfig(p => ({ ...p, imapMailbox: e.target.value }))}
                    placeholder="INBOX"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">
                    E-mails lidos por busca
                  </label>
                  <select
                    value={config.maxMessages}
                    onChange={e => setConfig(p => ({ ...p, maxMessages: Number(e.target.value) }))}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                  >
                    <option value={15}>Últimos 15 e-mails</option>
                    <option value={30}>Últimos 30 e-mails (Padrão)</option>
                    <option value={50}>Últimos 50 e-mails</option>
                    <option value={100}>Últimos 100 e-mails</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">
                    Nome do Remetente (RH)
                  </label>
                  <input
                    type="text"
                    value={config.remetenteNome}
                    onChange={e => setConfig(p => ({ ...p, remetenteNome: e.target.value }))}
                    placeholder="Recursos Humanos - Santa Casa"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {/* Configuração SMTP para envio (DP / RH) */}
              <div className="pt-2 border-t border-border space-y-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.useSameSmtp}
                      onChange={e => setConfig(p => ({ ...p, useSameSmtp: e.target.checked }))}
                      className="rounded border-border text-primary"
                    />
                    <span>
                      Usar a mesma conta de leitura acima para o envio de e-mails de resposta (desmarque para enviar por outra conta, ex: <strong>DP</strong>)
                    </span>
                  </label>
                </div>

                {!config.useSameSmtp && (
                  <div className="space-y-3 bg-muted/30 p-3.5 rounded-xl border border-border">
                    <p className="text-[11px] font-semibold text-primary uppercase tracking-wider">
                      Conta de Envio das Respostas (Ex: E-mail do DP)
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">
                          E-mail de Disparo (DP / RH) *
                        </label>
                        <input
                          type="email"
                          value={config.smtpUser || ''}
                          onChange={e => setConfig(p => ({ ...p, smtpUser: e.target.value }))}
                          placeholder="dp@santacasaaraguari.org.br"
                          className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">
                          Senha do E-mail de Disparo *
                        </label>
                        <input
                          type={mostrarSenha ? 'text' : 'password'}
                          value={config.smtpPass || ''}
                          onChange={e => setConfig(p => ({ ...p, smtpPass: e.target.value }))}
                          placeholder="Senha do e-mail do DP..."
                          className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-sm"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2">
                        <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">
                          Host SMTP de Saída
                        </label>
                        <input
                          type="text"
                          value={config.smtpHost}
                          onChange={e => setConfig(p => ({ ...p, smtpHost: e.target.value }))}
                          placeholder={config.imapHost || 'mail.santacasaaraguari.org.br'}
                          className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-sm font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">
                          Porta SMTP
                        </label>
                        <select
                          value={config.smtpPort}
                          onChange={e => setConfig(p => ({ ...p, smtpPort: e.target.value }))}
                          className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-sm font-mono"
                        >
                          <option value="465">465 (SSL/TLS)</option>
                          <option value="587">587 (STARTTLS)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* Campo de Teste de Envio de E-mail (SMTP / DP) */}
                <div className="p-3 rounded-xl bg-muted/30 border border-border space-y-2.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase block">
                    Testar Envio de Resposta (SMTP / DP)
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="email"
                      value={emailTesteEnvio}
                      onChange={e => setEmailTesteEnvio(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleTestarEnvioSmtp();
                        }
                      }}
                      placeholder="Digite um e-mail para receber o teste (ex: seuemail@santacasa...)"
                      className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <button
                      type="button"
                      onClick={handleTestarEnvioSmtp}
                      disabled={testandoEnvioSmtp || !emailTesteEnvio.trim()}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-all disabled:opacity-50 whitespace-nowrap shadow-sm"
                    >
                      {testandoEnvioSmtp ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Enviando Teste...</span>
                        </>
                      ) : (
                        <>
                          <Send className="h-3.5 w-3.5" />
                          <span>Enviar Teste</span>
                        </>
                      )}
                    </button>
                  </div>

                  {resultadoTesteEnvio && (
                    <div
                      className={`p-2.5 rounded-lg border text-xs flex items-start gap-2 ${
                        resultadoTesteEnvio.success
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                          : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {resultadoTesteEnvio.success ? (
                        <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      )}
                      <span>{resultadoTesteEnvio.message}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Botão de Teste de Conexão IMAP */}
              <div className="pt-2 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handleTestarImap}
                    disabled={testandoConexao}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold transition-all disabled:opacity-50"
                  >
                    {testandoConexao ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Testando conexão com o Webmail...</span>
                      </>
                    ) : (
                      <>
                        <Wifi className="h-3.5 w-3.5" />
                        <span>Testar Conexão de Leitura (IMAP)</span>
                      </>
                    )}
                  </button>

                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Lock className="h-3 w-3" /> Credenciais protegidas no banco
                  </span>
                </div>

                {resultadoTeste && (
                  <div
                    className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                      resultadoTeste.success
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {resultadoTeste.success ? (
                      <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    )}
                    <span>{resultadoTeste.message}</span>
                  </div>
                )}
              </div>
            </div>
          ) : abaAtiva === 'regras' ? (
            /* ── ABA 2: PALAVRAS-CHAVE E REGRAS DE CAPTURA ── */
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">
                    Onde buscar as palavras-chave?
                  </label>
                  <select
                    value={config.buscarEm}
                    onChange={e =>
                      setConfig(p => ({
                        ...p,
                        buscarEm: e.target.value as 'assunto_e_corpo' | 'apenas_assunto',
                      }))
                    }
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="assunto_e_corpo">No Assunto e no Corpo do E-mail (Geral)</option>
                    <option value="apenas_assunto">Somente no Assunto do E-mail</option>
                  </select>
                </div>

                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.apenasNaoLidos}
                      onChange={e => setConfig(p => ({ ...p, apenasNaoLidos: e.target.checked }))}
                      className="rounded border-border text-primary"
                    />
                    <span>Capturar apenas e-mails ainda não lidos na caixa</span>
                  </label>
                </div>
              </div>

              {/* Validação Inteligente de Currículo */}
              <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 flex items-start gap-2.5">
                <input
                  type="checkbox"
                  id="chk-evidencia-curriculo"
                  checked={config.exigirEvidenciaCurriculo ?? true}
                  onChange={e =>
                    setConfig(p => ({ ...p, exigirEvidenciaCurriculo: e.target.checked }))
                  }
                  className="mt-0.5 rounded border-border text-primary cursor-pointer"
                />
                <label
                  htmlFor="chk-evidencia-curriculo"
                  className="text-xs text-foreground cursor-pointer leading-relaxed"
                >
                  <strong className="text-emerald-600 dark:text-emerald-400 block">
                    Filtro Inteligente de Currículo Real (Recomendado)
                  </strong>
                  Exige que o e-mail tenha evidência real de candidatura (assunto/arquivo de currículo ou seções de{' '}
                  <em>Experiência, Formação, Escolaridade, Objetivo</em> dentro do PDF/Word/Imagem) e ignora automaticamente logos de assinatura e documentos de Departamento Pessoal.
                </label>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">
                  1. Palavras-Chave Positivas (Identificam um Currículo)
                </label>
                <p className="text-xs text-muted-foreground mb-2">
                  Verificadas como <strong>palavra inteira</strong> no assunto, corpo ou anexo do e-mail:
                </p>
                <div className="flex gap-2 mb-2.5">
                  <input
                    type="text"
                    value={novaPalavra}
                    onChange={e => setNovaPalavra(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addPalavra();
                      }
                    }}
                    placeholder="Digite uma palavra-chave (ex: Currículo, Vaga, Enfermeiro)..."
                    className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={() => addPalavra()}
                    className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90"
                  >
                    + Adicionar
                  </button>
                </div>

                {/* Lista de tags ativas */}
                <div className="flex flex-wrap gap-1.5 p-3 rounded-xl bg-muted/40 border border-border min-h-[52px]">
                  {config.palavrasChave.length === 0 ? (
                    <span className="text-xs text-muted-foreground italic">
                      Nenhuma palavra-chave definida (todos os e-mails serão lidos).
                    </span>
                  ) : (
                    config.palavrasChave.map(palavra => (
                      <span
                        key={palavra}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-card border border-border text-xs font-semibold text-foreground shadow-sm"
                      >
                        <Tag className="h-3 w-3 text-primary" />
                        {palavra}
                        <button
                          type="button"
                          onClick={() => removePalavra(palavra)}
                          className="text-muted-foreground hover:text-rose-500 ml-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))
                  )}
                </div>

                {/* Sugestões rápidas */}
                <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] text-muted-foreground">Sugestões rápidas:</span>
                  {sugestoesPalavras
                    .filter(s => !config.palavrasChave.includes(s))
                    .map(sug => (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => addPalavra(sug)}
                        className="text-[11px] px-2 py-0.5 rounded-md border border-dashed border-border hover:border-primary text-muted-foreground hover:text-primary transition-colors"
                      >
                        + {sug}
                      </button>
                    ))}
                </div>
              </div>

              {/* Palavras e Remetentes Bloqueados (Negativos) */}
              <div className="pt-3 border-t border-border">
                <label className="text-xs font-semibold text-rose-500 uppercase block mb-1">
                  2. Termos e Remetentes Bloqueados (Ignorar na Leitura)
                </label>
                <p className="text-xs text-muted-foreground mb-2">
                  E-mails cujo remetente, assunto ou anexo contenham qualquer um dos termos abaixo (ex: <strong>Pessoal Consulte</strong>, <strong>Rescisão</strong>, <strong>Dispensa</strong>) serão bloqueados e <strong>não</strong> entrarão na triagem:
                </p>
                <div className="flex gap-2 mb-2.5">
                  <input
                    type="text"
                    value={novaPalavraIgnorada}
                    onChange={e => setNovaPalavraIgnorada(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addPalavraIgnorada();
                      }
                    }}
                    placeholder="Adicionar remetente ou termo para bloquear (ex: Pessoal Consulte, Rescisão, Folha)..."
                    className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                  <button
                    type="button"
                    onClick={() => addPalavraIgnorada()}
                    className="px-4 py-2 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700"
                  >
                    + Bloquear Termo
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5 p-3 rounded-xl bg-rose-500/5 border border-rose-500/20 max-h-36 overflow-y-auto">
                  {(config.palavrasIgnoradas || []).length === 0 ? (
                    <span className="text-xs text-muted-foreground italic">
                      Nenhum termo bloqueado configurado.
                    </span>
                  ) : (
                    (config.palavrasIgnoradas || []).map(termo => (
                      <span
                        key={termo}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-card border border-rose-500/30 text-xs font-medium text-rose-600 dark:text-rose-400 shadow-sm"
                      >
                        <span>{termo}</span>
                        <button
                          type="button"
                          onClick={() => removePalavraIgnorada(termo)}
                          className="text-muted-foreground hover:text-rose-500 ml-0.5"
                          title="Remover bloqueio"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* ── ABA 3: MODO DE LEITURA E INTEGRAÇÃO N8N ── */
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">
                    Modo de Leitura dos E-mails
                  </label>
                  <select
                    value={config.modoLeitura}
                    onChange={e =>
                      setConfig(p => ({
                        ...p,
                        modoLeitura: e.target.value as 'imap_direto' | 'n8n_webhook' | 'ambos',
                      }))
                    }
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="ambos">Híbrido: Leitura Direta IMAP + n8n (Recomendado)</option>
                    <option value="imap_direto">Apenas Leitura Direta IMAP (Sem n8n)</option>
                    <option value="n8n_webhook">Apenas via Workflow n8n</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">
                    Modo de Disparo das Respostas
                  </label>
                  <select
                    value={config.modoDisparo}
                    onChange={e =>
                      setConfig(p => ({
                        ...p,
                        modoDisparo: e.target.value as 'n8n_ou_smtp' | 'apenas_n8n' | 'apenas_smtp',
                      }))
                    }
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="n8n_ou_smtp">Automático (n8n ou Servidor SMTP Direto)</option>
                    <option value="apenas_smtp">Direto pelo Servidor SMTP do Webmail</option>
                    <option value="apenas_n8n">Apenas via Webhook n8n</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">
                  Webhook n8n — Sincronização de E-mails (Opcional se usar IMAP Direto)
                </label>
                <input
                  type="url"
                  value={config.webhookSyncUrl}
                  onChange={e => setConfig(p => ({ ...p, webhookSyncUrl: e.target.value }))}
                  placeholder="https://n8n.../webhook/rh_sincronizar_curriculos"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">
                  Webhook n8n — Disparo de E-mail de Feedback (Opcional se usar SMTP Direto)
                </label>
                <input
                  type="url"
                  value={config.webhookEmailUrl}
                  onChange={e => setConfig(p => ({ ...p, webhookEmailUrl: e.target.value }))}
                  placeholder="https://n8n.../webhook/rh_enviar_feedback_candidato"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs font-mono"
                />
              </div>
            </div>
          )}

          {/* Rodapé */}
          <div className="flex items-center justify-between pt-3 border-t border-border">
            <span className="text-[11px] text-muted-foreground">
               Caixa monitorada: <strong className="text-foreground">{config.imapUser || config.emailMonitorado}</strong>
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-border text-xs font-medium hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={salvando}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 disabled:opacity-50 shadow-sm"
              >
                {salvando ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    <span>Salvar Configurações de Leitura</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

// ============================================================================
// SUB-COMPONENTE: MODAL DE DETALHES E OBSERVAÇÕES DO CANDIDATO
// ============================================================================
const DetalheCandidatoModal: React.FC<{
  candidato: CandidatoTriagem;
  onClose: () => void;
  onOpenReprovar: (c: CandidatoTriagem) => void;
  onSaved: () => void;
}> = ({ candidato, onClose, onOpenReprovar, onSaved }) => {
  const [obs, setObs] = useState(candidato.observacoes || '');
  const [saving, setSaving] = useState(false);

  const handleSaveObs = async () => {
    setSaving(true);
    await updateCandidatoStatus([candidato.id], candidato.status, obs);
    setSaving(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
      >
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="font-bold text-foreground">{candidato.nome_candidato}</h3>
            <p className="text-xs text-muted-foreground">{candidato.email_candidato}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3 bg-muted/30 p-3 rounded-xl border border-border text-xs">
            <div>
              <span className="text-muted-foreground block">Telefone:</span>
              <strong className="text-foreground">{candidato.telefone || 'Não informado'}</strong>
            </div>
            <div>
              <span className="text-muted-foreground block">Vaga Identificada:</span>
              <strong className="text-primary">{candidato.vaga_identificada}</strong>
            </div>
            <div className="col-span-2">
              <span className="text-muted-foreground block">Assunto Original do E-mail:</span>
              <strong className="text-foreground">{candidato.assunto_email || '-'}</strong>
            </div>
            {candidato.curriculo_url && (
              <div className="col-span-2 pt-2 border-t border-border/60 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground flex items-center gap-1.5 truncate">
                    <FileText className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                    <span className="truncate">{candidato.curriculo_nome || 'Arquivo do Currículo'}</span>
                  </span>
                  <a
                    href={candidato.curriculo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 flex-shrink-0"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span>
                      {/\.(png|jpe?g|webp)$/i.test(candidato.curriculo_url)
                        ? 'Abrir Imagem em Nova Aba'
                        : /\.(docx?|rtf)$/i.test(candidato.curriculo_url)
                          ? 'Baixar Arquivo Word'
                          : 'Abrir Currículo PDF'}
                    </span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                {/\.(png|jpe?g|webp)$/i.test(candidato.curriculo_url) && (
                  <div className="rounded-lg border border-border overflow-hidden bg-black/20 max-h-56 overflow-y-auto">
                    <img
                      src={candidato.curriculo_url}
                      alt={candidato.nome_candidato}
                      className="w-full h-auto object-contain"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {candidato.resumo_perfil && (
            <div>
              <span className="text-xs font-semibold text-muted-foreground uppercase block mb-1">
                Resumo Extraído do Currículo
              </span>
              <p className="text-xs bg-muted/40 p-3 rounded-lg border border-border leading-relaxed">
                {candidato.resumo_perfil}
              </p>
            </div>
          )}

          {candidato.feedback_enviado && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs space-y-1">
              <p className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" />
                E-mail de Feedback Enviado em {formatDateTime(candidato.feedback_enviado_em)}
              </p>
              {candidato.feedback_enviado_por_nome && (
                <p className="text-muted-foreground">Disparado por: {candidato.feedback_enviado_por_nome}</p>
              )}
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">
              Anotações Internas do RH
            </label>
            <textarea
              rows={3}
              value={obs}
              onChange={e => setObs(e.target.value)}
              placeholder="Adicione observações da entrevista ou triagem..."
              className="w-full bg-background border border-border rounded-lg p-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border">
            <button
              type="button"
              onClick={() => onOpenReprovar(candidato)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold ${
                (STATUS_CONFIG[candidato.status] || STATUS_CONFIG.aguardando_triagem).actionBtnClass
              }`}
            >
              <Send className="h-3.5 w-3.5" />
              <span>{(STATUS_CONFIG[candidato.status] || STATUS_CONFIG.aguardando_triagem).actionLabel}</span>
            </button>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-2 rounded-lg border border-border text-xs font-medium"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={handleSaveObs}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                <span>Salvar Anotação</span>
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default RecrutamentoSelecaoPage;

