import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Search, FileText, Trash2, UploadCloud, X,
  CheckCircle2, AlertCircle, ChevronLeft, ChevronRight,
  ArrowUpDown, ArrowUp, ArrowDown, Calendar, Mail, Loader2, Edit2, RefreshCw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import {
  fetchHolerites,
  uploadHoleritePDF,
  deleteHolerites,
  generateMesAnoOptions,
  updateHoleriteEmail,
  syncEmailsWithN8n,
  updateEmailEnviadoEm,
  HoleriteRecord,
  HoleriteUploadProgress,
  SyncProgress,
} from '../services/holeitesService';
import { sendDocumentEmail } from '../services/emailService';

// ─────────────────────────────────────────────────────────────
// OPÇÕES DE MÊS/ANO (últimos 24 meses)
// ─────────────────────────────────────────────────────────────
const MES_ANO_OPTIONS = generateMesAnoOptions(24);
const DEFAULT_MES_ANO = MES_ANO_OPTIONS[0]; // mês atual

// Formata valor em R$
function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

// ─────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────

const Holerites: React.FC = () => {
  const { user, profile } = useAuth();
  const { can, permissions } = usePermissions();

  // ── Dados ──
  const [data, setData] = useState<HoleriteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [idsToDelete, setIdsToDelete] = useState<string[]>([]);
  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);
  const [emailToast, setEmailToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // ── Filtro / Paginação / Ordenação ──
  const [filter, setFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;
  const [sortField, setSortField] = useState<'nome_completo' | 'total_liquido'>('nome_completo');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null);

  // ── Mês/Ano de referência (filtro de listagem) ──
  const [filterMesAno, setFilterMesAno] = useState<string>(DEFAULT_MES_ANO);

  // ── Modais ──
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isEditEmailModalOpen, setIsEditEmailModalOpen] = useState(false);
  const [editingHoleriteId, setEditingHoleriteId] = useState<string | null>(null);
  const [emailToEdit, setEmailToEdit] = useState('');
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

  // ── Sync N8N ──
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const abortSyncRef = useRef<AbortController | null>(null);

  // ── Upload ──
  const [uploadProgress, setUploadProgress] = useState<HoleriteUploadProgress | null>(null);
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
      const records = await fetchHolerites(filterMesAno, cpfFilter);
      setData(records);
    } catch (err) {
      console.error('Erro ao carregar holerites:', err);
    } finally {
      setLoading(false);
    }
  // permissions?.can_view_all é um booleano primitivo — referência estável
  }, [filterMesAno, permissions?.can_view_all, profile?.cpf]);

  useEffect(() => { loadData(); }, [loadData]);

  // ─────────────────────────────────────────────────────────────
  // FILTRAGEM + ORDENAÇÃO + PAGINAÇÃO
  // ─────────────────────────────────────────────────────────────
  let filteredData = data.filter(c => {
    const raw = filter.toLowerCase();
    const cleanCpf = raw.replace(/\D/g, '');
    return (
      c.nome_completo.toLowerCase().includes(raw) ||
      (cleanCpf && c.cpf.replace(/\D/g, '').includes(cleanCpf))
    );
  });

  if (sortDirection !== null) {
    filteredData = [...filteredData].sort((a, b) => {
      if (sortField === 'nome_completo') {
        const nA = a.nome_completo.toLowerCase();
        const nB = b.nome_completo.toLowerCase();
        if (nA < nB) return sortDirection === 'asc' ? -1 : 1;
        if (nA > nB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      } else {
        const vA = a.total_liquido ?? 0;
        const vB = b.total_liquido ?? 0;
        if (vA < vB) return sortDirection === 'asc' ? -1 : 1;
        if (vA > vB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      }
    });
  }

  useEffect(() => { setCurrentPage(1); }, [filter, sortDirection, sortField, filterMesAno]);

  const totalPages    = Math.ceil(filteredData.length / itemsPerPage) || 1;
  const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const maxVisible = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let endPage   = startPage + maxVisible - 1;
  if (endPage > totalPages) { endPage = totalPages; startPage = Math.max(1, endPage - maxVisible + 1); }
  const visiblePages = Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);

  // ─────────────────────────────────────────────────────────────
  // ACTIONS
  // ─────────────────────────────────────────────────────────────
  const handleSort = (field: 'nome_completo' | 'total_liquido') => {
    if (sortField === field) {
      setSortDirection(d => d === null ? 'asc' : d === 'asc' ? 'desc' : null);
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
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
      await deleteHolerites(idsToDelete, data);
      setData(prev => prev.filter(c => !idsToDelete.includes(c.id)));
      setSelectedIds([]);
      setIsDeleteModalOpen(false);
    } catch (err: any) {
      console.error(err);
      alert('Erro ao excluir: ' + err.message);
    }
  };

  const handleEditEmailConfirm = async () => {
    if (!editingHoleriteId) return;
    setIsSavingEmail(true);
    try {
      await updateHoleriteEmail(editingHoleriteId, emailToEdit);
      setData(prev => prev.map(c => c.id === editingHoleriteId ? { ...c, email: emailToEdit } : c));
      setEmailToast({ type: 'success', message: 'E-mail atualizado com sucesso!' });
      setIsEditEmailModalOpen(false);
    } catch (err: any) {
      console.error(err);
      setEmailToast({ type: 'error', message: err.message || 'Erro ao atualizar e-mail' });
    } finally {
      setIsSavingEmail(false);
      setTimeout(() => setEmailToast(null), 4000);
    }
  };

  const startSync = async () => {
    const controller = new AbortController();
    abortSyncRef.current = controller;
    
    // Passa todos os dados do mês/ano selecionado para a sincronização
    await syncEmailsWithN8n(data, setSyncProgress, controller.signal);
    
    // Atualiza os dados locais depois que terminar, se precisar refletir na tela
    loadData();
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

      const imported = await uploadHoleritePDF(file, user.id, setUploadProgress, controller.signal);
      setData(prev => {
        const withoutUpdated = prev.filter(p => !imported.some(i => i.cpf === p.cpf && i.mes_ano === p.mes_ano));
        return [...withoutUpdated, ...imported].sort((a, b) => a.nome_completo.localeCompare(b.nome_completo));
      });
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
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Holerites</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Demonstrativos de pagamento
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Filtro de Mês/Ano */}
          <div className="relative group">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors pointer-events-none" />
            <select
              value={filterMesAno}
              onChange={e => setFilterMesAno(e.target.value)}
              className="pl-9 pr-4 py-1.5 rounded-md border border-border bg-muted/20 hover:bg-muted/50 text-foreground font-medium text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none cursor-pointer transition-all shadow-sm"
            >
              {MES_ANO_OPTIONS.map(m => (
                <option key={m} value={m} className="bg-card text-foreground font-normal">{m}</option>
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

          {can('can_upload') && (
            <button
              onClick={() => { setUploadProgress(null); setIsImportModalOpen(true); }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground shadow transition-colors hover:opacity-90 font-medium text-sm cursor-pointer"
            >
              <UploadCloud className="h-4 w-4" />
              Importar Holerite PDF
            </button>
          )}

          {can('can_upload') && (
            <button
              onClick={() => { setSyncProgress(null); setIsSyncModalOpen(true); }}
              disabled={data.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 text-white shadow transition-colors hover:bg-blue-700 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className="h-4 w-4" />
              Sincronizar E-mails com Tasy
            </button>
          )}
        </div>
      </div>

      {/* ── TABELA ── */}
      <div className="bg-card border border-border shadow-sm rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/20 flex flex-col sm:flex-row gap-4 justify-between items-center">
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
                    onClick={() => handleSort('nome_completo')}
                    className="flex items-center gap-2 hover:text-foreground transition-colors outline-none uppercase font-semibold"
                  >
                    Nome Completo
                    {sortField === 'nome_completo' && sortDirection === 'asc'  && <ArrowUp   className="w-4 h-4" />}
                    {sortField === 'nome_completo' && sortDirection === 'desc' && <ArrowDown className="w-4 h-4" />}
                    {(sortField !== 'nome_completo' || sortDirection === null)   && <ArrowUpDown className="w-4 h-4 opacity-50" />}
                  </button>
                </th>
                <th className="px-6 py-4 font-semibold w-56">E-mail</th>
                <th className="px-6 py-4 font-semibold w-40">CPF</th>
                <th className="px-6 py-4 font-semibold w-28 text-center">Mês/Ano</th>
                <th className="px-6 py-4 font-semibold w-36 text-right">
                  <button
                    onClick={() => handleSort('total_liquido')}
                    className="w-full flex justify-end items-center gap-2 hover:text-foreground transition-colors outline-none uppercase font-semibold"
                  >
                    Total Líquido
                    {sortField === 'total_liquido' && sortDirection === 'asc'  && <ArrowUp   className="w-4 h-4" />}
                    {sortField === 'total_liquido' && sortDirection === 'desc' && <ArrowDown className="w-4 h-4" />}
                    {(sortField !== 'total_liquido' || sortDirection === null)   && <ArrowUpDown className="w-4 h-4 opacity-50" />}
                  </button>
                </th>
                <th className="px-6 py-4 font-semibold w-44">Último E-mail</th>
                <th className="px-6 py-4 font-semibold w-40 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-3">
                    <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                    Buscando holerites...
                  </div>
                </td></tr>
              ) : paginatedData.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                  Nenhum holerite encontrado para {filterMesAno}.
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
                      <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                        {colab.email ?? <span className="opacity-50 italic">Não vinculado</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{colab.cpf}</td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-muted text-muted-foreground">
                        {colab.mes_ano}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-semibold text-foreground">
                        {formatCurrency(colab.total_liquido)}
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
                              tipoDocumento: 'holerite',
                              periodoReferencia: colab.mes_ano,
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
                        title="Editar E-mail"
                        onClick={() => {
                          setEditingHoleriteId(colab.id);
                          setEmailToEdit(colab.email || '');
                          setIsEditEmailModalOpen(true);
                        }}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border text-muted-foreground hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 dark:hover:bg-orange-500/10 dark:hover:text-orange-500 transition-colors text-sm font-medium"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
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
              <h3 className="text-xl font-bold mb-1">Importar Holerite PDF</h3>
              <p className="text-sm text-muted-foreground mb-5">
                Selecione o PDF com os holerites consolidados. Iremos extrair cada colaborador por CPF e Nome.
              </p>

              {/* Área de Drop */}
              <div className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center text-center transition-colors ${
                uploadProgress?.stage === 'error' ? 'border-red-500/50 bg-red-500/5' : 'border-border hover:border-primary/50 hover:bg-primary/5'
              }`}>
                {/* IDLE / ERROR */}
                {(!uploadProgress || uploadProgress.stage === 'error') && (
                  <>
                    <UploadCloud className={`h-12 w-12 mb-3 ${uploadProgress?.stage === 'error' ? 'text-red-500' : 'text-primary'}`} />
                    <h4 className="text-sm font-medium">Clique ou Arraste o arquivo PDF aqui</h4>
                    <p className="text-xs text-muted-foreground mt-1 max-w-[220px]">Somente PDFs do sistema de Holerites da Santa Casa.</p>
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
                  <div className="w-full flex flex-col items-center gap-3">
                    {uploadProgress.skippedPages && uploadProgress.skippedPages.length > 0 ? (
                      <>
                        <AlertCircle className="h-16 w-16 text-yellow-500 mb-2" />
                        <h4 className="text-lg font-bold text-yellow-600">Importação com Alertas</h4>
                        <p className="text-sm text-muted-foreground text-center">
                          {uploadProgress.message}
                        </p>
                        <div className="w-full text-left bg-yellow-500/5 dark:bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 text-xs max-h-40 overflow-y-auto space-y-1 mt-2">
                          <p className="font-bold text-yellow-700 dark:text-yellow-400 mb-1">Páginas não importadas ({uploadProgress.skippedPages.length}):</p>
                          {uploadProgress.skippedPages.map(sp => (
                            <div key={sp.page} className="text-muted-foreground border-b border-border/50 pb-1 last:border-0 last:pb-0">
                              <strong>Página {sp.page}:</strong> {sp.reason}
                              {sp.nome && <span className="block text-foreground/80 mt-0.5">Funcionário: {sp.nome}</span>}
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-16 w-16 text-green-500 mb-2" />
                        <h4 className="text-lg font-bold text-green-600">Concluído!</h4>
                        <p className="text-sm text-muted-foreground">{uploadProgress.message}</p>
                      </>
                    )}
                  </div>
                )}

                {/* INTERROMPIDO */}
                {uploadProgress?.stage === 'interrupted' && (
                  <div className="w-full flex flex-col items-center gap-3">
                    <AlertCircle className="h-16 w-16 text-yellow-500 mb-2" />
                    <h4 className="text-lg font-bold text-yellow-600">Processo Interrompido</h4>
                    <p className="text-sm text-muted-foreground font-medium">{uploadProgress.message}</p>
                    {uploadProgress.skippedPages && uploadProgress.skippedPages.length > 0 && (
                      <div className="w-full text-left bg-yellow-500/5 dark:bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 text-xs max-h-40 overflow-y-auto space-y-1 mt-2">
                        <p className="font-bold text-yellow-700 dark:text-yellow-400 mb-1">Páginas não importadas até a interrupção ({uploadProgress.skippedPages.length}):</p>
                        {uploadProgress.skippedPages.map(sp => (
                          <div key={sp.page} className="text-muted-foreground border-b border-border/50 pb-1 last:border-0 last:pb-0">
                            <strong>Página {sp.page}:</strong> {sp.reason}
                            {sp.nome && <span className="block text-foreground/80 mt-0.5">Funcionário: {sp.nome}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">Você pode fechar esta janela agora.</p>
                  </div>
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
                        {data.find(c => c.id === idsToDelete[0])?.cpf} · {data.find(c => c.id === idsToDelete[0])?.mes_ano}
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
      {/* MODAL — EDITAR E-MAIL                                 */}
      {/* ══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {isEditEmailModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-card w-full max-w-sm rounded-2xl border shadow-xl p-6 relative">
              <button
                onClick={() => setIsEditEmailModalOpen(false)}
                className="absolute right-4 top-4 text-muted-foreground hover:bg-muted p-1 rounded-full"
              >
                <X className="h-5 w-5" />
              </button>
              <h3 className="text-xl font-bold mb-4">Editar E-mail</h3>
              <div className="mb-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Colaborador
                  </label>
                  <div className="bg-muted/50 px-3 py-2 rounded-md border border-border text-sm font-medium text-foreground">
                    {data.find(c => c.id === editingHoleriteId)?.nome_completo}
                  </div>
                </div>
                <div>
                  <label htmlFor="email-edit" className="block text-sm font-medium text-foreground mb-1">
                    Endereço de E-mail
                  </label>
                  <input
                    id="email-edit"
                    type="email"
                    value={emailToEdit}
                    onChange={e => setEmailToEdit(e.target.value)}
                    placeholder="exemplo@email.com"
                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsEditEmailModalOpen(false)}
                  className="px-4 py-2 border rounded-md text-sm font-medium flex-1 hover:bg-muted cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleEditEmailConfirm}
                  disabled={isSavingEmail}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium flex-1 hover:opacity-90 cursor-pointer shadow disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSavingEmail && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isSavingEmail ? 'Salvando...' : 'Salvar E-mail'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════ */}
      {/* MODAL — SINCRONIZAÇÃO DE E-MAILS n8n                  */}
      {/* ══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {isSyncModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-card w-full max-w-md rounded-2xl border shadow-xl p-6 relative">
              <button
                onClick={() => { if (!syncProgress || syncProgress.stage === 'done' || syncProgress.stage === 'interrupted') { setIsSyncModalOpen(false); } }}
                className="absolute right-4 top-4 text-muted-foreground hover:bg-muted p-1 rounded-full"
              >
                <X className="h-5 w-5" />
              </button>
              <h3 className="text-xl font-bold mb-1">Sincronizar E-mails com Tasy</h3>
              <p className="text-sm text-muted-foreground mb-5">
                Buscando e-mails na base do n8n para os <strong>{data.length}</strong> colaboradores deste mês.
              </p>

              <div className="border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center justify-center text-center">
                {(!syncProgress || syncProgress.stage === 'error') && (
                  <>
                    <RefreshCw className="h-12 w-12 text-blue-500 mb-3" />
                    <h4 className="text-sm font-medium">Pronto para iniciar</h4>
                    <p className="text-xs text-muted-foreground mt-1 mb-4">Pode demorar um pouco dependendo da quantidade.</p>
                    <button onClick={startSync} className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 cursor-pointer">
                      Iniciar Sincronização
                    </button>
                  </>
                )}

                {syncProgress?.stage === 'syncing' && (
                  <div className="w-full flex flex-col items-center gap-3">
                    <RefreshCw className="h-10 w-10 text-blue-500 animate-spin" />
                    <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-blue-500 rounded-full"
                        animate={{ width: `${syncProgress.percent}%` }}
                        transition={{ duration: 0.2 }}
                      />
                    </div>
                    <p className="text-sm font-medium">{syncProgress.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {syncProgress.current} de {syncProgress.total} · {syncProgress.updatedCount} atualizados
                    </p>
                    <button
                      onClick={() => abortSyncRef.current?.abort()}
                      className="mt-4 px-4 py-2 border border-yellow-500 text-black rounded-md bg-yellow-400 hover:bg-yellow-500 transition-colors text-sm font-bold cursor-pointer"
                    >
                      Interromper
                    </button>
                  </div>
                )}

                {syncProgress?.stage === 'done' && (
                  <>
                    <CheckCircle2 className="h-16 w-16 text-green-500 mb-2" />
                    <h4 className="text-lg font-bold text-green-600">Sincronização Concluída!</h4>
                    <p className="text-sm text-muted-foreground mt-1">{syncProgress.message}</p>
                  </>
                )}

                {syncProgress?.stage === 'interrupted' && (
                  <>
                    <AlertCircle className="h-16 w-16 text-yellow-500 mb-2" />
                    <h4 className="text-lg font-bold text-yellow-600">Interrompido</h4>
                    <p className="text-sm text-muted-foreground font-medium">{syncProgress.message}</p>
                  </>
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

export default Holerites;
