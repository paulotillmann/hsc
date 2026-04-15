import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Search, ExternalLink, FileText, Trash2, UploadCloud, X, CheckCircle2, AlertCircle, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, Calendar, Mail, Loader2, Edit, RefreshCw, UserCheck, UserX, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import {
  fetchInformes,
  uploadInformePDF,
  deleteInformes,
  updateEmailEnviadoEm,
  updateInformeEmail,
  syncMissingEmailsFromN8n,
  InformeRecord,
  UploadProgress,
  SyncEmailsProgress,
} from '../services/informesService';
import { sendDocumentEmail } from '../services/emailService';

// ─────────────────────────────────────────────────────────────
// ANO ATUAL + RANGE DE SELEÇÃO
// ─────────────────────────────────────────────────────────────
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - i);

// ─────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────

const Informes: React.FC = () => {
  const { user, profile } = useAuth();
  const { can, permissions } = usePermissions();

  // ── Dados ──
  const [data, setData] = useState<InformeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [idsToDelete, setIdsToDelete] = useState<string[]>([]);
  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);
  const [isSendingMassEmail, setIsSendingMassEmail] = useState(false);
  const [emailToast, setEmailToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // ── Filtro / Paginação / Ordenação ──
  const [filter, setFilter] = useState('');
  const [emailFilter, setEmailFilter] = useState<'todos' | 'com_email' | 'sem_email'>('todos');
  const [sendStatusFilter, setSendStatusFilter] = useState<'todos' | 'enviado' | 'nao_enviado'>('todos');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null);

  // ── Ano de referência (filtro de listagem) ──
  const [filterAno, setFilterAno] = useState<number>(CURRENT_YEAR);

  // ── Modais ──
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingInforme, setEditingInforme] = useState<InformeRecord | null>(null);
  const [editEmailValue, setEditEmailValue] = useState('');
  const [isSavingEmail, setIsSavingEmail] = useState(false);

  // ── Sync E-mails via N8N ──
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncEmailsProgress | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const syncAbortRef = useRef<AbortController | null>(null);

  // ── Upload ──
  const [importAno, setImportAno] = useState<number>(CURRENT_YEAR);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // ─────────────────────────────────────────────────────────────
  // LOAD DATA
  // ─────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Se o perfil não pode ver todos, filtra pelo próprio CPF
      const cpfFilter = !permissions?.can_view_all && profile?.cpf ? profile.cpf : undefined;
      const records = await fetchInformes(filterAno, cpfFilter);
      setData(records);
    } catch (err) {
      console.error('Erro ao carregar informes:', err);
    } finally {
      setLoading(false);
    }
  // permissions?.can_view_all é um booleano primitivo — referência estável
  }, [filterAno, permissions?.can_view_all, profile?.cpf]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─────────────────────────────────────────────────────────────
  // FILTRAGEM + ORDENAÇÃO + PAGINAÇÃO
  // ─────────────────────────────────────────────────────────────
  let filteredData = data.filter(c => {
    const rawFilter     = filter.toLowerCase();
    const cleanSearchCpf = rawFilter.replace(/\D/g, '');
    const rawCpf        = c.cpf.replace(/\D/g, '');

    if (emailFilter === 'com_email' && !c.email) return false;
    if (emailFilter === 'sem_email' && c.email) return false;

    if (sendStatusFilter === 'enviado' && !c.email_enviado_em) return false;
    if (sendStatusFilter === 'nao_enviado' && c.email_enviado_em) return false;

    return (
      c.nome_completo.toLowerCase().includes(rawFilter) ||
      (cleanSearchCpf && rawCpf.includes(cleanSearchCpf))
    );
  });

  if (sortDirection !== null) {
    filteredData = [...filteredData].sort((a, b) => {
      const nA = a.nome_completo.toLowerCase();
      const nB = b.nome_completo.toLowerCase();
      if (nA < nB) return sortDirection === 'asc' ? -1 : 1;
      if (nA > nB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }

  useEffect(() => { setCurrentPage(1); }, [filter, sortDirection, filterAno, emailFilter, sendStatusFilter]);

  const totalPages   = Math.ceil(filteredData.length / itemsPerPage) || 1;
  const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const maxVisible = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let endPage   = startPage + maxVisible - 1;
  if (endPage > totalPages) { endPage = totalPages; startPage = Math.max(1, endPage - maxVisible + 1); }
  const visiblePages = Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);

  // ─────────────────────────────────────────────────────────────
  // ACTIONS
  // ─────────────────────────────────────────────────────────────
  const handleSortNome = () => {
    setSortDirection(d => d === null ? 'asc' : d === 'asc' ? 'desc' : null);
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    const currentPageIds = paginatedData.map(c => c.id);
    if (e.target.checked) {
      setSelectedIds(prev => Array.from(new Set([...prev, ...currentPageIds])));
    } else {
      setSelectedIds(prev => prev.filter(id => !currentPageIds.includes(id)));
    }
  };

  const handleSelectOne = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleDeleteConfirm = async () => {
    try {
      await deleteInformes(idsToDelete, data);
      setData(prev => prev.filter(c => !idsToDelete.includes(c.id)));
      setSelectedIds([]);
      setIsDeleteModalOpen(false);
    } catch (err: any) {
      console.error(err);
      alert('Erro ao excluir: ' + err.message);
    }
  };

  const handleSendMassEmail = async () => {
    setIsSendingMassEmail(true);
    let successCount = 0;
    let errorCount = 0;

    for (const id of selectedIds) {
      const colab = data.find(c => c.id === id);
      if (!colab || !colab.email) {
        errorCount++;
        continue;
      }
      
      setSendingEmailId(colab.id);
      
      const result = await sendDocumentEmail({
        to: colab.email,
        nomeColaborador: colab.nome_completo,
        tipoDocumento: 'informe',
        periodoReferencia: `Ano ${colab.ano_referencia}`,
        cpf: colab.cpf,
        pdfUrl: colab.pdf_url,
      });

      if (result.success) {
        successCount++;
        try {
          const sentAt = await updateEmailEnviadoEm(colab.id);
          setData(prev => prev.map(r => r.id === colab.id ? { ...r, email_enviado_em: sentAt } : r));
        } catch (_) { /* falha silenciosa ao atualizar data no banco */ }
      } else {
        errorCount++;
      }
    }

    setSendingEmailId(null);
    setIsSendingMassEmail(false);
    
    if (successCount > 0 && errorCount === 0) {
      setEmailToast({ type: 'success', message: `${successCount} e-mails enviados com sucesso!` });
    } else if (successCount > 0 && errorCount > 0) {
      setEmailToast({ type: 'success', message: `${successCount} enviados, ${errorCount} falhas/sem e-mail.` });
    } else {
      setEmailToast({ type: 'error', message: `Nenhum e-mail pôde ser enviado (verifique os cadastros).` });
    }
    
    setTimeout(() => setEmailToast(null), 5000);
    // Opcional: limpar a seleção após o envio
    setSelectedIds([]);
  };

  const handleSyncEmails = async () => {
    setIsSyncing(true);
    setSyncProgress(null);
    const controller = new AbortController();
    syncAbortRef.current = controller;

    // Pega TODOS os registros do ano atual sem e-mail
    const semEmail = data.filter(c => !c.email);

    if (semEmail.length === 0) {
      setSyncProgress({
        stage: 'done',
        current: 0,
        total: 0,
        percent: 100,
        currentName: '',
        currentEmail: null,
        results: [],
      });
      setIsSyncing(false);
      return;
    }

    const result = await syncMissingEmailsFromN8n(
      semEmail,
      setSyncProgress,
      controller.signal
    );

    // Atualiza o state local com os e-mails encontrados
    setData(prev => prev.map(r => {
      const found = result.results.find(x => x.id === r.id);
      if (found?.atualizado && found.emailEncontrado) {
        return { ...r, email: found.emailEncontrado };
      }
      return r;
    }));

    setIsSyncing(false);
    syncAbortRef.current = null;
  };

  const handleSaveEmail = async () => {
    if (!editingInforme) return;
    setIsSavingEmail(true);
    try {
      await updateInformeEmail(editingInforme.id, editEmailValue);
      setData(prev => prev.map(c => c.id === editingInforme.id ? { ...c, email: editEmailValue } : c));
      setEmailToast({ type: 'success', message: 'E-mail atualizado com sucesso!' });
      setIsEditModalOpen(false);
    } catch (err: any) {
      setEmailToast({ type: 'error', message: 'Erro ao atualizar e-mail: ' + err.message });
    } finally {
      setIsSavingEmail(false);
    }
    setTimeout(() => setEmailToast(null), 3000);
  };

  // ─────────────────────────────────────────────────────────────
  // UPLOAD HANDLER
  // ─────────────────────────────────────────────────────────────
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    if (file.type !== 'application/pdf') {
      setUploadProgress({ stage: 'error', current: 0, total: 0, percent: 0, message: '', error: 'Selecione um arquivo PDF válido.' });
      return;
    }

    if (!user) {
      setUploadProgress({ stage: 'error', current: 0, total: 0, percent: 0, message: '', error: 'Sessão expirada. Faça login novamente.' });
      return;
    }

    try {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const imported = await uploadInformePDF(file, importAno, user.id, setUploadProgress, controller.signal);
      // Atualiza apenas os novos registros na lista atual
      setData(prev => {
        const withoutUpdated = prev.filter(p => !imported.some(i => i.cpf === p.cpf && i.ano_referencia === p.ano_referencia));
        return [...withoutUpdated, ...imported].sort((a, b) => a.nome_completo.localeCompare(b.nome_completo));
      });
      // O modal só será fechado manualmente pelo usuário (sem setTimeout)
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      setUploadProgress({ stage: 'error', current: 0, total: 0, percent: 0, message: '', error: err.message });
    }
  };

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────
  const isUploading = uploadProgress !== null && uploadProgress.stage !== 'done' && uploadProgress.stage !== 'error';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 relative"
    >
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Informes de Rendimento</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Ano calendário {filterAno} / Exercício {filterAno + 1}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Filtro de ano */}
          <div className="relative group">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors pointer-events-none" />
            <select
              value={filterAno}
              onChange={e => setFilterAno(Number(e.target.value))}
              className="pl-9 pr-4 py-1.5 rounded-md border border-border bg-muted/20 hover:bg-muted/50 text-foreground font-medium text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none cursor-pointer transition-all shadow-sm"
            >
              {YEAR_OPTIONS.map(y => (
                <option key={y} value={y} className="bg-card text-foreground font-normal">{y}</option>
              ))}
            </select>
          </div>

          {selectedIds.length > 0 && (
            <button
              onClick={() => { setIdsToDelete(selectedIds); setIsDeleteModalOpen(true); }}
              className="inline-flex items-center gap-2 px-4 py-2 border border-red-200 bg-red-50 text-red-600 rounded-md shadow-sm transition-colors hover:bg-red-100 font-medium text-sm dark:bg-red-500/10 dark:border-red-500/20 dark:hover:bg-red-500/20"
            >
              <Trash2 className="h-4 w-4" />
              Excluir ({selectedIds.length})
            </button>
          )}

          {selectedIds.length > 0 && can('can_send_email') && (
            <button
              onClick={handleSendMassEmail}
              disabled={isSendingMassEmail}
              className="inline-flex items-center gap-2 px-4 py-2 border border-blue-200 bg-blue-50 text-blue-600 rounded-md shadow-sm transition-colors hover:bg-blue-100 font-medium text-sm dark:bg-blue-500/10 dark:border-blue-500/20 dark:hover:bg-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSendingMassEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Enviar E-mails ({selectedIds.length})
            </button>
          )}

          {can('can_upload') && (
            <>
              <button
                onClick={() => { setSyncProgress(null); setIsSyncModalOpen(true); }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:border-indigo-500/20 dark:text-indigo-400 dark:hover:bg-indigo-500/20 shadow-sm transition-colors font-medium text-sm cursor-pointer"
              >
                <Zap className="h-4 w-4" />
                Atualizar E-mails
              </button>
              <button
                onClick={() => { setUploadProgress(null); setIsImportModalOpen(true); }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground shadow transition-colors hover:opacity-90 font-medium text-sm cursor-pointer"
              >
                <UploadCloud className="h-4 w-4" />
                Importar arquivo Informe PDF
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── TABELA ── */}
      <div className="bg-card border border-border shadow-sm rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/20 flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto flex-1">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Pesquisar por nome ou CPF..."
                value={filter}
                onChange={e => setFilter(e.target.value)}
                className="w-full bg-background border border-border rounded-md pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-all"
              />
            </div>
            
            <div className="flex flex-wrap gap-2">
              <div className="flex bg-background border border-border rounded-md p-1 self-start sm:self-center">
                <button 
                  onClick={() => setEmailFilter('todos')} 
                  className={`px-3 py-1 text-xs font-medium rounded-sm transition-colors ${emailFilter === 'todos' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted'}`}
                >
                  Qualquer E-mail
                </button>
                <button 
                  onClick={() => setEmailFilter('com_email')} 
                  className={`px-3 py-1 text-xs font-medium rounded-sm transition-colors ${emailFilter === 'com_email' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted'}`}
                >
                  Com E-mail
                </button>
                <button 
                  onClick={() => setEmailFilter('sem_email')} 
                  className={`px-3 py-1 text-xs font-medium rounded-sm transition-colors ${emailFilter === 'sem_email' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted'}`}
                >
                  Sem E-mail
                </button>
              </div>
              
              <div className="flex bg-background border border-border rounded-md p-1 self-start sm:self-center">
                <button 
                  onClick={() => setSendStatusFilter('todos')} 
                  className={`px-3 py-1 text-xs font-medium rounded-sm transition-colors ${sendStatusFilter === 'todos' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted'}`}
                >
                  Qualquer Envio
                </button>
                <button 
                  onClick={() => setSendStatusFilter('enviado')} 
                  className={`px-3 py-1 text-xs font-medium rounded-sm transition-colors ${sendStatusFilter === 'enviado' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted'}`}
                >
                  Já Enviado
                </button>
                <button 
                  onClick={() => setSendStatusFilter('nao_enviado')} 
                  className={`px-3 py-1 text-xs font-medium rounded-sm transition-colors ${sendStatusFilter === 'nao_enviado' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted'}`}
                >
                  Não Enviado
                </button>
              </div>
            </div>
          </div>
          <div className="text-xs font-medium text-muted-foreground">
            {filteredData.length} de {data.length} registros
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-6 py-4 font-semibold w-12 text-center">
                  <input
                    type="checkbox"
                    onChange={handleSelectAll}
                    checked={paginatedData.length > 0 && paginatedData.every(c => selectedIds.includes(c.id))}
                    className="w-4 h-4 rounded border-border accent-primary cursor-pointer"
                  />
                </th>
                <th className="px-6 py-4 font-semibold">
                  <button
                    onClick={handleSortNome}
                    className="flex items-center gap-2 hover:text-foreground transition-colors outline-none uppercase font-semibold"
                  >
                    Nome Completo
                    {sortDirection === 'asc'  && <ArrowUp   className="w-4 h-4" />}
                    {sortDirection === 'desc' && <ArrowDown className="w-4 h-4" />}
                    {sortDirection === null   && <ArrowUpDown className="w-4 h-4 opacity-50" />}
                  </button>
                </th>
                <th className="px-6 py-4 font-semibold w-64">E-mail</th>
                <th className="px-6 py-4 font-semibold w-40">CPF</th>
                <th className="px-6 py-4 font-semibold w-24 text-center">Páginas</th>
                <th className="px-6 py-4 font-semibold w-44">Último E-mail</th>
                <th className="px-6 py-4 font-semibold w-56 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-3">
                    <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                    Buscando informes...
                  </div>
                </td></tr>
              ) : paginatedData.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                  Nenhum informe encontrado para o ano {filterAno}.
                </td></tr>
              ) : (
                paginatedData.map(colab => (
                  <tr key={colab.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(colab.id)}
                        onChange={() => handleSelectOne(colab.id)}
                        className="w-4 h-4 rounded border-border accent-primary cursor-pointer"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-foreground text-sm">{colab.nome_completo}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-muted-foreground">
                        {colab.email ?? <span className="opacity-50 italic">Não vinculado</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{colab.cpf}</td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-muted text-muted-foreground">
                        [{colab.paginas[0]}-{colab.paginas.length > 1 ? colab.paginas[1] : colab.paginas[0]}]
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {colab.email_enviado_em ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 dark:text-green-400">
                          <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
                          {new Date(colab.email_enviado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Não enviado</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right flex justify-end gap-2">
                      <a
                        href={colab.pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-colors text-sm font-medium"
                      >
                        <FileText className="h-4 w-4" />Abrir
                      </a>
                      {can('can_send_email') && (
                        <button
                          disabled={!colab.email || sendingEmailId === colab.id}
                          title={!colab.email ? 'Colaborador sem e-mail vinculado' : 'Enviar por e-mail'}
                          onClick={async () => {
                            if (!colab.email) return;
                            setSendingEmailId(colab.id);
                            const result = await sendDocumentEmail({
                              to: colab.email,
                              nomeColaborador: colab.nome_completo,
                              tipoDocumento: 'informe',
                              periodoReferencia: `Ano ${colab.ano_referencia}`,
                              cpf: colab.cpf,
                              pdfUrl: colab.pdf_url,
                            });
                            setSendingEmailId(null);
                            if (result.success) {
                              setEmailToast({ type: 'success', message: `E-mail enviado para ${colab.email}` });
                              try {
                                const sentAt = await updateEmailEnviadoEm(colab.id);
                                setData(prev => prev.map(r => r.id === colab.id ? { ...r, email_enviado_em: sentAt } : r));
                              } catch (_) { /* falha silenciosa — não bloqueia UX */ }
                            } else {
                              setEmailToast({ type: 'error', message: result.error || 'Erro ao enviar e-mail' });
                            }
                            setTimeout(() => setEmailToast(null), 4000);
                          }}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border text-muted-foreground hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 dark:hover:bg-blue-500/10 dark:hover:text-blue-500 transition-colors text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {sendingEmailId === colab.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                        </button>
                      )}
                      <button
                        title="Editar"
                        onClick={() => {
                          setEditingInforme(colab);
                          setEditEmailValue(colab.email || '');
                          setIsEditModalOpen(true);
                        }}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border text-muted-foreground hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 dark:hover:bg-orange-500/10 dark:hover:text-orange-500 transition-colors text-sm font-medium"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        title="Excluir"
                        onClick={() => { setIdsToDelete([colab.id]); setIsDeleteModalOpen(true); }}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border text-muted-foreground hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:hover:bg-red-500/10 dark:hover:text-red-500 transition-colors text-sm font-medium"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── PAGINAÇÃO ── */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-border bg-muted/10 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="text-sm text-muted-foreground">
              Página <span className="font-bold text-foreground">{currentPage}</span> de <span className="font-bold text-foreground">{totalPages}</span>
              <span className="mx-1">&middot;</span>{filteredData.length} registros
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="w-9 h-8 flex items-center justify-center text-sm border bg-card rounded-md hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="flex gap-1 mx-1">
                {visiblePages.map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-9 h-8 flex items-center justify-center text-sm border rounded-md transition-colors ${
                      currentPage === page
                        ? 'bg-primary text-primary-foreground border-primary shadow-sm font-bold'
                        : 'bg-card hover:bg-muted text-foreground'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="w-9 h-8 flex items-center justify-center text-sm border bg-card rounded-md hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════ */}
      {/* MODAL — IMPORTAÇÃO                                    */}
      {/* ══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {isImportModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-card w-full max-w-lg rounded-2xl border shadow-xl p-6 relative">
              <button
                onClick={() => { if (!isUploading || uploadProgress?.stage === 'interrupted') { setIsImportModalOpen(false); setUploadProgress(null); } }}
                className="absolute right-4 top-4 text-muted-foreground hover:bg-muted p-1 rounded-full"
              >
                <X className="h-5 w-5" />
              </button>
              <h3 className="text-xl font-bold mb-1">Importar Informe de Rendimento</h3>
              <p className="text-sm text-muted-foreground mb-5">
                Selecione o PDF com os informes agregados. Iremos extrair cada colaborador por CPF e Nome.
              </p>

              {/* Seletor de Ano */}
              {!isUploading && uploadProgress?.stage !== 'done' && (
                <div className="mb-5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                    Ano de Referência do Informe
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <select
                      value={importAno}
                      onChange={e => setImportAno(Number(e.target.value))}
                      className="w-full pl-9 pr-4 py-2.5 h-11 rounded-md border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary appearance-none cursor-pointer"
                    >
                      {YEAR_OPTIONS.map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Área de Drop */}
              <div className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center text-center transition-colors ${
                uploadProgress?.stage === 'error' ? 'border-red-500/50 bg-red-500/5' : 'border-border hover:border-primary/50 hover:bg-primary/5'
              }`}>
                {/* IDLE / ERROR */}
                {(!uploadProgress || uploadProgress.stage === 'error') && (
                  <>
                    <UploadCloud className={`h-12 w-12 mb-3 ${uploadProgress?.stage === 'error' ? 'text-red-500' : 'text-primary'}`} />
                    <h4 className="text-sm font-medium">Clique ou Arraste o arquivo PDF aqui</h4>
                    <p className="text-xs text-muted-foreground mt-1 max-w-[220px]">Somente PDFs do sistema da Santa Casa.</p>
                    <button onClick={() => fileInputRef.current?.click()} className="mt-4 px-4 py-2 border rounded-md text-sm font-medium hover:bg-muted cursor-pointer">
                      Procurar no Computador
                    </button>
                    <input type="file" accept="application/pdf" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
                    {uploadProgress?.error && (
                      <p className="text-xs text-red-500 mt-4 font-medium">{uploadProgress.error}</p>
                    )}
                  </>
                )}

                {/* PROGRESSO */}
                {isUploading && uploadProgress?.stage !== 'interrupted' && (
                  <div className="w-full flex flex-col items-center gap-3">
                    <FileText className="h-10 w-10 text-primary animate-bounce" />
                    <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-primary rounded-full"
                        animate={{ width: `${uploadProgress!.percent}%` }}
                        transition={{ duration: 0.4 }}
                      />
                    </div>
                    <p className="text-sm font-medium">{uploadProgress!.message}</p>
                    {uploadProgress!.total > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {uploadProgress!.current} de {uploadProgress!.total} colaboradores · {uploadProgress!.percent}%
                      </p>
                    )}
                    
                    <button
                      onClick={() => abortControllerRef.current?.abort()}
                      className="mt-4 px-4 py-2 border border-yellow-500 text-black rounded-md bg-yellow-400 hover:bg-yellow-500 transition-colors text-sm font-bold cursor-pointer"
                    >
                      Interromper Processo
                    </button>
                  </div>
                )}

                {/* SUCESSO */}
                {uploadProgress?.stage === 'done' && (
                  <>
                    <CheckCircle2 className="h-16 w-16 text-green-500 mb-2" />
                    <h4 className="text-lg font-bold text-green-600">Concluído!</h4>
                    <p className="text-sm text-muted-foreground">{uploadProgress.message}</p>
                  </>
                )}

                {/* INTERROMPIDO */}
                {uploadProgress?.stage === 'interrupted' && (
                  <>
                    <AlertCircle className="h-16 w-16 text-yellow-500 mb-2" />
                    <h4 className="text-lg font-bold text-yellow-600">Processo Interrompido</h4>
                    <p className="text-sm text-muted-foreground font-medium">{uploadProgress.message}</p>
                    <p className="text-xs text-muted-foreground mt-2">Você pode fechar esta janela agora.</p>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════ */}
      {/* MODAL — CONFIRMAÇÃO DE EXCLUSÃO                       */}
      {/* ══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {isDeleteModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-card w-full max-w-sm rounded-2xl border shadow-xl p-6 text-center">
              <AlertCircle className="h-14 w-14 text-red-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">Confirmar Exclusão</h3>
              <div className="text-sm text-muted-foreground mb-6">
                {idsToDelete.length === 1 ? (
                  <>
                    <p className="mb-2">Você está prestes a excluir permanentemente o registro abaixo:</p>
                    <div className="bg-muted/50 p-3 rounded-md text-left border border-border">
                      <p className="font-semibold text-foreground">
                        {data.find(c => c.id === idsToDelete[0])?.nome_completo}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {data.find(c => c.id === idsToDelete[0])?.cpf}
                      </p>
                    </div>
                  </>
                ) : (
                  <p>
                    Sua ação abrange <strong>{idsToDelete.length} registros</strong>. Eles serão removidos do banco e do Storage permanentemente. Confirma?
                  </p>
                )}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setIsDeleteModalOpen(false)} className="px-4 py-2 border rounded-md text-sm font-medium flex-1 hover:bg-muted cursor-pointer">
                  Cancelar
                </button>
                <button onClick={handleDeleteConfirm} className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium flex-1 hover:bg-red-700 cursor-pointer shadow">
                  Confirmar Exclusão
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════ */}
      {/* MODAL — EDIÇÃO DE INFORME                              */}
      {/* ══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {isEditModalOpen && editingInforme && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-card w-full max-w-md rounded-2xl border shadow-xl p-6 relative">
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="absolute right-4 top-4 text-muted-foreground hover:bg-muted p-1 rounded-full"
              >
                <X className="h-5 w-5" />
              </button>
              <h3 className="text-xl font-bold mb-4">Editar Informe</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Nome Completo</label>
                  <input type="text" value={editingInforme.nome_completo} disabled className="w-full bg-muted/50 border border-border rounded-md px-3 py-2 text-sm text-foreground opacity-70 cursor-not-allowed" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">CPF</label>
                    <input type="text" value={editingInforme.cpf} disabled className="w-full bg-muted/50 border border-border rounded-md px-3 py-2 text-sm text-foreground opacity-70 cursor-not-allowed" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Ano Referência</label>
                    <input type="text" value={editingInforme.ano_referencia} disabled className="w-full bg-muted/50 border border-border rounded-md px-3 py-2 text-sm text-foreground opacity-70 cursor-not-allowed" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">E-mail</label>
                  <input 
                    type="email" 
                    value={editEmailValue}
                    onChange={e => setEditEmailValue(e.target.value)}
                    placeholder="E-mail do colaborador"
                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all" 
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Insira um e-mail válido. Se deixado em branco, o e-mail não será enviado.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 border rounded-md text-sm font-medium flex-1 hover:bg-muted cursor-pointer transition-colors">
                  Cancelar
                </button>
                <button 
                  onClick={handleSaveEmail} 
                  disabled={isSavingEmail}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium flex-1 hover:opacity-90 cursor-pointer shadow transition-colors flex justify-center items-center gap-2 disabled:opacity-50"
                >
                  {isSavingEmail && <Loader2 className="h-4 w-4 animate-spin" />}
                  Salvar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* ══════════════════════════════════════════════════════ */}
      {/* MODAL — SINCRONIZAR E-MAILS VIA API (N8N)            */}
      {/* ══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {isSyncModalOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
              className="bg-card w-full max-w-xl rounded-2xl border shadow-2xl relative overflow-hidden"
            >
              {/* Header com gradiente */}
              <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 pt-6 pb-5 text-white">
                <button
                  onClick={() => { if (!isSyncing) { setIsSyncModalOpen(false); setSyncProgress(null); } }}
                  className="absolute right-4 top-4 text-white/70 hover:text-white hover:bg-white/10 p-1.5 rounded-full transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
                <div className="flex items-center gap-3 mb-1">
                  <div className="p-2 bg-white/15 rounded-lg">
                    <Zap className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-bold">Atualizar E-mails</h3>
                </div>
                <p className="text-sm text-white/75 leading-relaxed">
                  Pesquisaremos o banco de dados da Santa Casa para cada colaborador sem e-mail cadastrado e atualizaremos automaticamente os registros encontrados.
                </p>
              </div>

              <div className="p-6">
                {/* ESTADO INICIAL */}
                {!syncProgress && !isSyncing && (
                  <div className="space-y-4">
                    <div className="bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 rounded-xl p-4">
                      <div className="flex items-start gap-3">
                        <div className="p-1.5 bg-indigo-100 dark:bg-indigo-500/20 rounded-lg mt-0.5 flex-shrink-0">
                          <Mail className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-indigo-800 dark:text-indigo-300 mb-0.5">O que será feito:</p>
                          <ul className="text-sm text-indigo-700 dark:text-indigo-400 space-y-1 list-disc list-inside">
                            <li>Identifica todos os colaboradores do ano <strong>{filterAno}</strong> sem e-mail</li>
                            <li>Consulta o banco da Santa Casa para cada CPF via API</li>
                            <li>Atualiza automaticamente os e-mails encontrados</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/40 rounded-lg p-3">
                      <UserX className="h-4 w-4 flex-shrink-0 text-amber-500" />
                      <span>
                        <strong className="text-foreground">{data.filter(c => !c.email).length}</strong> colaborador(es) sem e-mail no ano {filterAno}
                      </span>
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => { setIsSyncModalOpen(false); setSyncProgress(null); }}
                        className="px-4 py-2 border rounded-md text-sm font-medium flex-1 hover:bg-muted cursor-pointer transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleSyncEmails}
                        disabled={data.filter(c => !c.email).length === 0}
                        className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-md text-sm font-bold flex-1 hover:opacity-90 cursor-pointer shadow transition-all flex justify-center items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Zap className="h-4 w-4" />
                        Iniciar Busca
                      </button>
                    </div>
                  </div>
                )}

                {/* PROGRESSO */}
                {syncProgress && syncProgress.stage === 'running' && (
                  <div className="space-y-4">
                    {/* Barra de progresso */}
                    <div>
                      <div className="flex justify-between text-xs font-medium text-muted-foreground mb-2">
                        <span>Processando {syncProgress.current} de {syncProgress.total}</span>
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">{syncProgress.percent}%</span>
                      </div>
                      <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full"
                          animate={{ width: `${syncProgress.percent}%` }}
                          transition={{ duration: 0.4 }}
                        />
                      </div>
                    </div>

                    {/* Colaborador atual */}
                    <div className="bg-muted/40 rounded-lg p-3 flex items-center gap-3 min-h-[52px]">
                      <Loader2 className="h-4 w-4 animate-spin text-indigo-500 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground font-medium">Processando agora</p>
                        <p className="text-sm font-semibold text-foreground truncate">{syncProgress.currentName}</p>
                        {syncProgress.currentEmail !== null && (
                          <p className="text-xs text-green-600 dark:text-green-400 mt-0.5 truncate">
                            ✓ {syncProgress.currentEmail}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Lista de resultados parciais */}
                    {syncProgress.results.length > 0 && (
                      <div className="border border-border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                        {[...syncProgress.results].reverse().map((r) => (
                          <div key={r.id} className="flex items-center gap-3 px-3 py-2 border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                            {r.atualizado
                              ? <UserCheck className="h-4 w-4 text-green-500 flex-shrink-0" />
                              : <UserX className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            }
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium text-foreground truncate">{r.nome_completo}</p>
                              <p className={`text-xs truncate ${r.emailEncontrado ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground italic'}`}>
                                {r.emailEncontrado ?? 'Não encontrado'}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <button
                      onClick={() => syncAbortRef.current?.abort()}
                      className="w-full px-4 py-2 border border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-400 rounded-md text-sm font-medium hover:bg-amber-100 transition-colors cursor-pointer"
                    >
                      Interromper Processo
                    </button>
                  </div>
                )}

                {/* CONCLUÍDO */}
                {syncProgress && syncProgress.stage === 'done' && (
                  <div className="space-y-4">
                    {syncProgress.total === 0 ? (
                      <div className="text-center py-6">
                        <CheckCircle2 className="h-14 w-14 text-green-500 mx-auto mb-3" />
                        <p className="text-lg font-bold text-foreground">Tudo certo!</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Todos os colaboradores já possuem e-mail cadastrado.
                        </p>
                      </div>
                    ) : (
                      <>
                        {/* Resumo */}
                        <div className="grid grid-cols-3 gap-3">
                          <div className="bg-muted/40 rounded-xl p-3 text-center">
                            <p className="text-2xl font-bold text-foreground">{syncProgress.total}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">Total</p>
                          </div>
                          <div className="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-xl p-3 text-center">
                            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                              {syncProgress.results.filter(r => r.atualizado).length}
                            </p>
                            <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">Atualizados</p>
                          </div>
                          <div className="bg-muted/40 rounded-xl p-3 text-center">
                            <p className="text-2xl font-bold text-muted-foreground">
                              {syncProgress.results.filter(r => !r.atualizado).length}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">Não encontrado</p>
                          </div>
                        </div>

                        {/* Lista final */}
                        <div className="border border-border rounded-lg overflow-hidden max-h-52 overflow-y-auto">
                          {syncProgress.results.map((r) => (
                            <div key={r.id} className="flex items-center gap-3 px-3 py-2 border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                              {r.atualizado
                                ? <UserCheck className="h-4 w-4 text-green-500 flex-shrink-0" />
                                : <UserX className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              }
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium text-foreground truncate">{r.nome_completo}</p>
                                <p className={`text-xs truncate ${r.emailEncontrado ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground italic'}`}>
                                  {r.emailEncontrado ?? 'Não encontrado na API'}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    <button
                      onClick={() => { setIsSyncModalOpen(false); setSyncProgress(null); }}
                      className="w-full px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-md text-sm font-bold hover:opacity-90 cursor-pointer shadow transition-all"
                    >
                      Fechar
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── TOAST DE E-MAIL ── */}

      <AnimatePresence>
        {emailToast && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-lg shadow-lg border text-sm font-medium ${
              emailToast.type === 'success'
                ? 'bg-green-50 border-green-200 text-green-700 dark:bg-green-500/10 dark:border-green-500/20 dark:text-green-400'
                : 'bg-red-50 border-red-200 text-red-700 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-400'
            }`}
          >
            {emailToast.type === 'success' ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
            {emailToast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Informes;
