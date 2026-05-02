import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Filter, Plus, UserCircle2, ArrowUpDown, ChevronLeft, ChevronRight, Edit, Trash2, AlertTriangle, RefreshCw, X, CheckCircle2, Link2, History, PlusCircle, QrCode, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { 
  listarVisitantes, 
  sincronizarVisitantes, 
  desativarVisitante, 
  listarCidadesVisitantes,
  Visitante, 
  SyncProgress 
} from '../../services/visitanteService';
import { 
  sincronizarVisitas, 
  resolverVisitantesFk,
  listarVisitasPorVisitante,
  excluirVisita,
  SyncProgress as VisitaSyncProgress,
  ResolverFkProgress,
  Visita
} from '../../services/visitaService';
import { supabase } from '../../lib/supabase';
import NovaVisitaModal from '../../components/recepcao/NovaVisitaModal';
import SaidaQRCodeModal from '../../components/recepcao/SaidaQRCodeModal';
import SaidaLoteModal from '../../components/recepcao/SaidaLoteModal';
import { useAuth } from '../../contexts/AuthContext';

export default function Visitantes() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [data, setData] = useState<Visitante[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterCidade, setFilterCidade] = useState('');
  const [cidadesDisponiveis, setCidadesDisponiveis] = useState<string[]>([]);
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Sync Modal State
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const cancelSyncRef = useRef({ current: false });

  // Sorting
  const [sortCol, setSortCol] = useState('nome');
  const [sortAsc, setSortAsc] = useState(true);

  // Delete Modal State
  const [itemToDelete, setItemToDelete] = useState<Visitante | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  // Delete Visita Modal State
  const [deleteVisitaModalOpen, setDeleteVisitaModalOpen] = useState(false);
  const [visitaToDelete, setVisitaToDelete] = useState<Visita | null>(null);
  const [deleteVisitaLoading, setDeleteVisitaLoading] = useState(false);

  // Saída via QRCode Modal State
  const [saidaQRCodeModalOpen, setSaidaQRCodeModalOpen] = useState(false);
  // Saída em Lote Modal State
  const [saidaLoteModalOpen, setSaidaLoteModalOpen] = useState(false);

  const [manualStartCursor, setManualStartCursor] = useState<number | ''>('');
  const [reverseSync, setReverseSync] = useState(false);

  // Sync Visitas Modal State
  const [syncVisitasModalOpen, setSyncVisitasModalOpen] = useState(false);
  const [isSyncingVisitas, setIsSyncingVisitas] = useState(false);
  const [syncVisitasProgress, setSyncVisitasProgress] = useState<VisitaSyncProgress | null>(null);
  const cancelSyncVisitasRef = useRef({ current: false });
  const [manualStartCursorVisitas, setManualStartCursorVisitas] = useState<number | ''>('');
  const [reverseSyncVisitas, setReverseSyncVisitas] = useState(false);
  const [dateFromVisitas, setDateFromVisitas] = useState('');
  const [dateToVisitas, setDateToVisitas] = useState('');

  // Resolver FK Modal State
  const [resolverFkModalOpen, setResolverFkModalOpen] = useState(false);
  const [isResolvingFk, setIsResolvingFk] = useState(false);
  const [resolverFkResult, setResolverFkResult] = useState<number | null>(null);
  const [resolverFkProgress, setResolverFkProgress] = useState<ResolverFkProgress | null>(null);

  // Visitas do Visitante Modal State
  const [visitasModalOpen, setVisitasModalOpen] = useState(false);
  const [visitasDoVisitante, setVisitasDoVisitante] = useState<Visita[]>([]);
  const [loadingVisitas, setLoadingVisitas] = useState(false);
  const [visitanteSelecionadoNome, setVisitanteSelecionadoNome] = useState('');

  // Nova Visita Modal State
  const [novaVisitaModalOpen, setNovaVisitaModalOpen] = useState(false);
  const [visitanteParaNovaVisita, setVisitanteParaNovaVisita] = useState<{id: string, nome: string} | null>(null);

  const handleOpenVisitas = async (visitanteId: string, visitanteNome: string) => {
    setVisitanteSelecionadoNome(visitanteNome);
    setVisitasModalOpen(true);
    setLoadingVisitas(true);
    try {
      const visitas = await listarVisitasPorVisitante(visitanteId);
      setVisitasDoVisitante(visitas);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingVisitas(false);
    }
  };

  const handleDeleteVisita = (visita: Visita) => {
    setVisitaToDelete(visita);
    setDeleteVisitaModalOpen(true);
  };

  const confirmDeleteVisita = async () => {
    if (!visitaToDelete) return;
    setDeleteVisitaLoading(true);
    try {
      await excluirVisita(visitaToDelete.id);
      setVisitasDoVisitante(prev => prev.filter(v => v.id !== visitaToDelete.id));
      setDeleteVisitaModalOpen(false);
      setVisitaToDelete(null);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setDeleteVisitaLoading(false);
    }
  };

  useEffect(() => {
    listarCidadesVisitantes().then(setCidadesDisponiveis);
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      loadData();
    }, 300);

    const channel = supabase
      .channel('visitantes_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'visitantes' },
        (payload) => {
          console.log('Alteração em visitantes recebida:', payload);
          loadData();
        }
      )
      .subscribe();

    return () => {
      clearTimeout(delayDebounceFn);
      supabase.removeChannel(channel);
    };
  }, [searchTerm, filterCidade, sortCol, sortAsc, currentPage]);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await listarVisitantes({ 
        busca: searchTerm, 
        cidade: filterCidade,
        page: currentPage, 
        perPage: itemsPerPage, 
        orderBy: sortCol, 
        orderAsc: sortAsc 
      });
      setData(result.data);
      setTotalCount(result.count);
    } catch (err) {
      console.error('Erro ao buscar visitantes', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenSync = () => {
    setSyncProgress(null);
    cancelSyncRef.current = false;
    setSyncModalOpen(true);
  };

  const handleStartSync = async () => {
    setIsSyncing(true);
    cancelSyncRef.current = false;
    
    const startCursor = typeof manualStartCursor === 'number' ? manualStartCursor : undefined;

    await sincronizarVisitantes(
      (progress) => {
        setSyncProgress(progress);
      },
      cancelSyncRef,
      { startCursor, reverseOrder: reverseSync }
    );

    setIsSyncing(false);
  };

  const handleResumeSync = async () => {
    if (!syncProgress || !syncProgress.nextCursor) return;
    setIsSyncing(true);
    cancelSyncRef.current = false;
    
    await sincronizarVisitantes(
      (progress) => {
        setSyncProgress(progress);
      },
      cancelSyncRef,
      { startCursor: syncProgress.nextCursor, reverseOrder: reverseSync, previousProgress: syncProgress }
    );

    setIsSyncing(false);
  };

  const handleCancelSync = () => {
    cancelSyncRef.current = true;
  };

  const handleCloseSyncModal = () => {
    setSyncModalOpen(false);
    if (syncProgress?.concluido) {
      loadData();
    }
  };

  // ── Sync Visitas Handlers ──
  const handleOpenSyncVisitas = () => {
    setSyncVisitasProgress(null);
    cancelSyncVisitasRef.current = false;
    setSyncVisitasModalOpen(true);
  };

  const handleStartSyncVisitas = async () => {
    setIsSyncingVisitas(true);
    cancelSyncVisitasRef.current = false;
    const startCursor = typeof manualStartCursorVisitas === 'number' ? manualStartCursorVisitas : undefined;
    await sincronizarVisitas(
      (progress) => { setSyncVisitasProgress(progress); },
      cancelSyncVisitasRef,
      { 
        startCursor, 
        reverseOrder: reverseSyncVisitas,
        dateFrom: dateFromVisitas || undefined,
        dateTo: dateToVisitas || undefined
      }
    );
    setIsSyncingVisitas(false);
  };

  const handleResumeSyncVisitas = async () => {
    if (!syncVisitasProgress || !syncVisitasProgress.nextCursor) return;
    setIsSyncingVisitas(true);
    cancelSyncVisitasRef.current = false;
    await sincronizarVisitas(
      (progress) => { setSyncVisitasProgress(progress); },
      cancelSyncVisitasRef,
      { 
        startCursor: syncVisitasProgress.nextCursor, 
        reverseOrder: reverseSyncVisitas, 
        previousProgress: syncVisitasProgress,
        dateFrom: dateFromVisitas || undefined,
        dateTo: dateToVisitas || undefined
      }
    );
    setIsSyncingVisitas(false);
  };

  const handleCancelSyncVisitas = () => {
    cancelSyncVisitasRef.current = true;
  };

  const handleCloseSyncVisitasModal = () => {
    setSyncVisitasModalOpen(false);
  };

  // ── Resolver FK Handler ──
  const handleOpenResolverFk = () => {
    setResolverFkResult(null);
    setResolverFkProgress(null);
    setResolverFkModalOpen(true);
  };

  const handleResolverFk = async () => {
    setIsResolvingFk(true);
    setResolverFkProgress(null);
    try {
      const count = await resolverVisitantesFk((progress) => {
        setResolverFkProgress({ ...progress });
      });
      setResolverFkResult(count);
    } catch (err: any) {
      setResolverFkResult(-1);
      alert('Erro ao resolver FKs: ' + err.message);
    } finally {
      setIsResolvingFk(false);
    }
  };

  const confirmDelete = (visitante: Visitante) => {
    setItemToDelete(visitante);
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    setDeleteLoading(true);
    try {
      await desativarVisitante(itemToDelete.id);
      setData(prev => prev.filter(v => v.id !== itemToDelete.id));
      setItemToDelete(null);
    } catch (err: any) {
      alert('Erro ao excluir: ' + err.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  // Pagination logic
  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 pb-12"
    >
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Visitantes</h1>
          <p className="text-sm text-muted-foreground">Gerenciamento de visitantes cadastrados no sistema</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setSaidaQRCodeModalOpen(true)}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-amber-600 text-white hover:bg-amber-700 px-4 py-2 shadow-sm"
            title="Registrar Saída via QR Code"
          >
            <QrCode className="mr-2 h-4 w-4" />
            Registrar Saída
          </button>
          <button
            onClick={() => setSaidaLoteModalOpen(true)}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-amber-800 text-white hover:bg-amber-900 px-4 py-2 shadow-sm"
            title="Registrar saída para todas as visitas em aberto"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Saída em Lote
          </button>
          <button
            onClick={() => { navigate('/recepcao/visitantes/novo'); }}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 shadow-sm"
          >
            <Plus className="mr-2 h-4 w-4" />
            Novo Visitante
          </button>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-card border border-border shadow-sm rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/20 flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto flex-1">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Pesquisar por nome, CPF ou telefone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-background border border-border rounded-md pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-all"
              />
            </div>
            
            <div className="relative group w-full sm:w-auto">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors pointer-events-none" />
              <select
                value={filterCidade}
                onChange={(e) => {
                  setFilterCidade(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full sm:w-[200px] pl-9 pr-4 py-2 rounded-md border border-border bg-background hover:bg-muted/50 text-foreground font-medium text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none cursor-pointer transition-all shadow-sm"
              >
                <option value="" className="bg-card text-foreground font-normal">Todas as Cidades</option>
                {cidadesDisponiveis.map(c => (
                  <option key={c} value={c} className="bg-card text-foreground font-normal">{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="text-xs font-medium text-muted-foreground whitespace-nowrap">
            {data.length} de {totalCount} registros
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-muted-foreground">
                <th scope="col" className="h-12 px-4 text-left align-middle font-medium cursor-pointer select-none group" onClick={() => { setSortCol('nome'); setSortAsc(sortCol === 'nome' ? !sortAsc : true); }}>
                  <div className="flex items-center gap-2">
                    Nome
                    <ArrowUpDown className={`h-3 w-3 ${sortCol === 'nome' ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'}`} />
                  </div>
                </th>
                <th scope="col" className="h-12 px-4 text-left align-middle font-medium">Telefone</th>
                <th scope="col" className="h-12 px-4 text-left align-middle font-medium">Documento</th>
                <th scope="col" className="h-12 px-4 text-left align-middle font-medium">Endereço</th>
                <th scope="col" className="h-12 px-4 text-left align-middle font-medium cursor-pointer select-none group" onClick={() => { setSortCol('cidade'); setSortAsc(sortCol === 'cidade' ? !sortAsc : true); }}>
                  <div className="flex items-center gap-2">
                    Cidade
                    <ArrowUpDown className={`h-3 w-3 ${sortCol === 'cidade' ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'}`} />
                  </div>
                </th>
                <th scope="col" className="h-12 px-4 text-right align-middle font-medium w-[100px]">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="h-24 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                      <span className="text-muted-foreground">Carregando...</span>
                    </div>
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={5} className="h-24 text-center text-muted-foreground">
                    Nenhum visitante encontrado.
                  </td>
                </tr>
              ) : (
                data.map((item) => (
                  <tr key={item.id} className="border-b border-border transition-colors hover:bg-muted/50">
                    <td className="p-4 align-middle">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0 overflow-hidden">
                          {item.foto_url ? (
                            <img src={item.foto_url} alt={item.nome} className="h-full w-full object-cover" />
                          ) : (
                            <UserCircle2 className="h-5 w-5" />
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground truncate">{item.nome}</span>
                          <div className="flex items-center gap-1 mt-0.5">
                            {item.bloqueado && (
                              <span className="inline-flex items-center rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-destructive border border-destructive/20">
                                Bloqueado
                              </span>
                            )}
                            {item.terceiro && (
                              <span className="inline-flex items-center rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                Terceiro
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 align-middle text-muted-foreground">
                      {item.telefone || '-'}
                    </td>
                    <td className="p-4 align-middle text-muted-foreground">
                      {item.documento || '-'}
                    </td>
                    <td className="p-4 align-middle text-muted-foreground truncate max-w-[200px]" title={item.endereco}>
                      {item.endereco || '-'}
                    </td>
                    <td className="p-4 align-middle text-muted-foreground">
                      {item.cidade || '-'}
                    </td>
                    <td className="p-4 align-middle text-right">
                       <div className="flex items-center justify-end gap-2">
                         <button 
                           onClick={() => {
                             setVisitanteParaNovaVisita({ id: item.id, nome: item.nome });
                             setNovaVisitaModalOpen(true);
                           }}
                           className="p-1.5 rounded-md hover:bg-emerald-500/10 text-muted-foreground hover:text-emerald-500 transition-colors"
                           title="Registrar Nova Visita"
                         >
                           <PlusCircle className="h-4 w-4" />
                         </button>
                         <button 
                           onClick={() => handleOpenVisitas(item.id, item.nome)}
                           className="p-1.5 rounded-md hover:bg-blue-500/10 text-muted-foreground hover:text-blue-500 transition-colors"
                           title="Ver Visitas"
                         >
                           <History className="h-4 w-4" />
                         </button>
                         <button 
                           onClick={() => { navigate(`/recepcao/visitantes/editar/${item.id}`); }}
                           className="p-1.5 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                           title="Editar"
                         >
                           <Edit className="h-4 w-4" />
                         </button>
                         {isAdmin && (
                           <button 
                             onClick={() => confirmDelete(item)}
                             className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                             title="Excluir"
                           >
                             <Trash2 className="h-4 w-4" />
                           </button>
                         )}
                       </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* PAGINATION FOOTER */}
        <div className="p-4 border-t border-border flex justify-between items-center bg-muted/20">
          <span className="text-sm text-muted-foreground">
            Página <span className="font-semibold text-foreground">{currentPage}</span> de <span className="font-semibold text-foreground">{Math.max(1, totalPages)}</span> - {data.length} registros
          </span>
          
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="w-8 h-8 flex items-center justify-center rounded-md border border-border bg-background hover:bg-muted text-muted-foreground disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              
              {(() => {
                let startPage = Math.max(1, currentPage - 2);
                let endPage = startPage + 4;
                if (endPage > totalPages) {
                  endPage = totalPages;
                  startPage = Math.max(1, endPage - 4);
                }
                const visiblePages = Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);
                
                return visiblePages.map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-8 h-8 flex items-center justify-center rounded-md text-sm font-medium transition-colors ${
                      page === currentPage
                        ? 'bg-primary text-primary-foreground shadow-sm border-transparent'
                        : 'border border-border bg-background hover:bg-muted text-foreground'
                    }`}
                  >
                    {page}
                  </button>
                ));
              })()}

              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="w-8 h-8 flex items-center justify-center rounded-md border border-border bg-background hover:bg-muted text-muted-foreground disabled:opacity-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Sync Modal */}
      <AnimatePresence>
        {syncModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card w-full max-w-lg rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <RefreshCw className={`h-5 w-5 text-primary ${isSyncing ? 'animate-spin' : ''}`} />
                  Sincronização Bubble.io
                </h3>
                {!isSyncing && (
                  <button onClick={handleCloseSyncModal} className="text-muted-foreground hover:text-foreground transition-colors">
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>
              
              <div className="p-6 space-y-6">
                {!syncProgress ? (
                  <div className="text-sm text-muted-foreground">
                    <p className="mb-4">Este processo irá importar ou atualizar os registros de visitantes da API legada do Bubble para o Supabase.</p>
                    <ul className="list-disc pl-5 space-y-1 mb-6">
                      <li>O processo é idempotente (não duplica registros existentes).</li>
                      <li>Registros modificados no Bubble terão seus dados atualizados aqui.</li>
                      <li>Dependendo do volume, a operação pode demorar alguns minutos.</li>
                    </ul>

                    <div className="bg-muted/50 p-4 rounded-lg border border-border">
                      <label className="block text-sm font-medium mb-2 text-foreground">
                        Retomar de um ponto específico? (Opcional)
                      </label>
                      <input
                        type="number"
                        placeholder="Ex: 49400"
                        value={manualStartCursor}
                        onChange={(e) => setManualStartCursor(e.target.value ? parseInt(e.target.value, 10) : '')}
                        className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        disabled={isSyncing}
                      />
                      <p className="text-xs text-muted-foreground mt-2">
                        Se a migração foi interrompida e você recarregou a página, insira o número do último registro processado para poupar tempo.
                      </p>
                      
                      <div className="mt-5 pt-4 border-t border-border flex items-start space-x-3">
                        <input 
                          type="checkbox" 
                          id="reverseSync"
                          checked={reverseSync}
                          onChange={(e) => setReverseSync(e.target.checked)}
                          className="mt-0.5 h-4 w-4 rounded border-input text-primary focus:ring-primary"
                        />
                        <div className="space-y-1">
                          <label htmlFor="reverseSync" className="text-sm font-medium leading-none cursor-pointer">
                            Importar de trás para frente (Ignorar limite de 50k)
                          </label>
                          <p className="text-xs text-muted-foreground">
                            A API do Bubble trava ao tentar buscar dados com índice (cursor) maior que 50.000. Marque esta opção para baixar do final para o começo, cobrindo os registros finais.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-muted rounded-lg p-4 font-mono text-sm">
                      {syncProgress.mensagem}
                    </div>
                    
                    {syncProgress.total > 0 && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Progresso</span>
                          <span>{Math.round((syncProgress.processado / syncProgress.total) * 100)}% ({syncProgress.processado}/{syncProgress.total})</span>
                        </div>
                        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary transition-all duration-300"
                            style={{ width: `${Math.max(2, (syncProgress.processado / syncProgress.total) * 100)}%` }}
                          />
                        </div>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 text-emerald-600 dark:text-emerald-400">
                        <div className="text-2xl font-bold">{syncProgress.inseridos}</div>
                        <div className="text-xs uppercase tracking-wider font-semibold">Inseridos/Atualizados</div>
                      </div>
                      <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-amber-600 dark:text-amber-400">
                        <div className="text-2xl font-bold">{syncProgress.ignorados}</div>
                        <div className="text-xs uppercase tracking-wider font-semibold">Sem alterações</div>
                      </div>
                    </div>
                    
                    {syncProgress.concluido && (
                      <div className="flex items-center gap-2 text-emerald-500 font-medium mt-4">
                        <CheckCircle2 className="h-5 w-5" />
                        Sincronização Finalizada
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              <div className="bg-muted/30 px-6 py-4 flex items-center justify-end gap-3 border-t border-border">
                {isSyncing ? (
                  <button
                    onClick={handleCancelSync}
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-muted hover:text-destructive h-10 px-6 transition-colors"
                  >
                    Cancelar Operação
                  </button>
                ) : syncProgress?.concluido ? (
                  <button
                    onClick={handleCloseSyncModal}
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-6 transition-colors"
                  >
                    Fechar
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleCloseSyncModal}
                      className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-muted text-foreground h-10 px-6 transition-colors"
                    >
                      Cancelar
                    </button>
                    {syncProgress && syncProgress.nextCursor && syncProgress.nextCursor > 0 ? (
                      <button
                        onClick={handleResumeSync}
                        className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-6 transition-colors"
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Continuar de onde parou
                      </button>
                    ) : (
                      <button
                        onClick={handleStartSync}
                        className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-6 transition-colors"
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Iniciar Sincronização
                      </button>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal (Visitante) */}
      <AnimatePresence>
        {itemToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#1a1f2e] w-full max-w-sm rounded-3xl border border-white/5 shadow-2xl overflow-hidden p-8"
            >
              <div className="flex flex-col items-center text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10 mb-6 border border-red-500/20">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-600">
                    <span className="text-white text-3xl font-bold">!</span>
                  </div>
                </div>

                <h3 className="text-2xl font-bold text-white mb-2">Confirmar Exclusão</h3>
                <p className="text-slate-400 text-sm mb-6 px-4">
                  Você está prestes a excluir permanentemente o registro abaixo:
                </p>

                <div className="w-full bg-[#242b3d] rounded-2xl p-4 mb-8 text-left border border-white/5">
                  <p className="text-white font-bold text-sm uppercase truncate mb-1">
                    {itemToDelete.nome}
                  </p>
                  <p className="text-slate-500 text-xs font-medium">
                    {itemToDelete.documento || 'SEM DOCUMENTO'}
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4 w-full">
                  <button
                    onClick={() => setItemToDelete(null)}
                    disabled={deleteLoading}
                    className="flex items-center justify-center rounded-2xl text-sm font-bold border border-white/10 bg-[#242b3d]/50 text-slate-300 h-14 hover:bg-[#242b3d] transition-all disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleteLoading}
                    className="flex items-center justify-center rounded-2xl text-sm font-bold bg-[#ff1e1e] text-white h-14 hover:bg-[#e60000] transition-all shadow-[0_0_20px_rgba(255,30,30,0.3)] disabled:opacity-50"
                  >
                    {deleteLoading ? (
                      <div className="h-5 w-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    ) : (
                      'Confirmar Exclusão'
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Sync Visitas Modal */}
      <AnimatePresence>
        {syncVisitasModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card w-full max-w-lg rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <RefreshCw className={`h-5 w-5 text-primary ${isSyncingVisitas ? 'animate-spin' : ''}`} />
                  Sincronização Visitas — Bubble.io
                </h3>
                {!isSyncingVisitas && (
                  <button onClick={handleCloseSyncVisitasModal} className="text-muted-foreground hover:text-foreground transition-colors">
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>
              
              <div className="p-6 space-y-6">
                {!syncVisitasProgress ? (
                  <div className="text-sm text-muted-foreground">
                    <p className="mb-4">Este processo irá importar ou atualizar os registros de <strong>Visitas</strong> da API legada do Bubble para o Supabase.</p>
                    <ul className="list-disc pl-5 space-y-1 mb-6">
                      <li>O processo é idempotente (não duplica registros existentes).</li>
                      <li>Registros modificados no Bubble terão seus dados atualizados aqui.</li>
                      <li>Volume estimado: ~226.000 registros — pode demorar bastante.</li>
                      <li>Após a importação, use o botão "Resolver Visitantes" para vincular os IDs.</li>
                    </ul>

                    <div className="bg-muted/50 p-4 rounded-lg border border-border">
                      <label className="block text-sm font-medium mb-2 text-foreground">
                        📅 Filtrar por período (para contornar limite de 50k)
                      </label>
                      <p className="text-xs text-muted-foreground mb-3">
                        A API do Bubble limita a 50.000 registros por consulta. Use filtros por data para importar fatias menores. Registros já importados serão atualizados (não duplicados).
                      </p>
                      
                      <div className="flex flex-wrap gap-2 mb-3">
                        {[
                          { label: '2023 S1', from: '2023-01-01', to: '2023-07-01' },
                          { label: '2023 S2', from: '2023-07-01', to: '2024-01-01' },
                          { label: '2024 S1', from: '2024-01-01', to: '2024-07-01' },
                          { label: '2024 S2', from: '2024-07-01', to: '2025-01-01' },
                          { label: '2025 S1', from: '2025-01-01', to: '2025-07-01' },
                          { label: '2025 S2', from: '2025-07-01', to: '2026-01-01' },
                          { label: '2026', from: '2026-01-01', to: '2026-07-01' },
                        ].map((p) => (
                          <button
                            key={p.label}
                            type="button"
                            onClick={() => { setDateFromVisitas(p.from); setDateToVisitas(p.to); }}
                            disabled={isSyncingVisitas}
                            className={`px-3 py-1.5 text-xs rounded-md border transition-colors font-medium ${
                              dateFromVisitas === p.from && dateToVisitas === p.to
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-background border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                            }`}
                          >
                            {p.label}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => { setDateFromVisitas(''); setDateToVisitas(''); }}
                          disabled={isSyncingVisitas}
                          className="px-3 py-1.5 text-xs rounded-md border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground transition-colors font-medium"
                        >
                          Limpar
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium mb-1 text-foreground">De:</label>
                          <input
                            type="date"
                            value={dateFromVisitas}
                            onChange={(e) => setDateFromVisitas(e.target.value)}
                            className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            disabled={isSyncingVisitas}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1 text-foreground">Até:</label>
                          <input
                            type="date"
                            value={dateToVisitas}
                            onChange={(e) => setDateToVisitas(e.target.value)}
                            className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            disabled={isSyncingVisitas}
                          />
                        </div>
                      </div>
                      {dateFromVisitas && dateToVisitas && (
                        <p className="text-xs text-emerald-500 font-medium mt-2">
                          ✓ Filtrando: {dateFromVisitas} → {dateToVisitas}
                        </p>
                      )}
                    </div>

                    <div className="bg-muted/50 p-4 rounded-lg border border-border mt-4">
                      <label className="block text-sm font-medium mb-2 text-foreground">
                        Retomar de um ponto específico? (Opcional)
                      </label>
                      <input
                        type="number"
                        placeholder="Ex: 49400"
                        value={manualStartCursorVisitas}
                        onChange={(e) => setManualStartCursorVisitas(e.target.value ? parseInt(e.target.value, 10) : '')}
                        className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        disabled={isSyncingVisitas}
                      />
                      <p className="text-xs text-muted-foreground mt-2">
                        Se a migração foi interrompida, insira o número do último registro processado.
                      </p>
                      
                      <div className="mt-5 pt-4 border-t border-border flex items-start space-x-3">
                        <input 
                          type="checkbox" 
                          id="reverseSyncVisitas"
                          checked={reverseSyncVisitas}
                          onChange={(e) => setReverseSyncVisitas(e.target.checked)}
                          className="mt-0.5 h-4 w-4 rounded border-input text-primary focus:ring-primary"
                        />
                        <div className="space-y-1">
                          <label htmlFor="reverseSyncVisitas" className="text-sm font-medium leading-none cursor-pointer">
                            Importar de trás para frente (Ignorar limite de 50k)
                          </label>
                          <p className="text-xs text-muted-foreground">
                            A API do Bubble trava ao tentar buscar dados com cursor maior que 50.000. Marque esta opção para baixar do final para o começo.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-muted rounded-lg p-4 font-mono text-sm">
                      {syncVisitasProgress.mensagem}
                    </div>
                    
                    {syncVisitasProgress.total > 0 && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Progresso</span>
                          <span>{Math.round((syncVisitasProgress.processado / syncVisitasProgress.total) * 100)}% ({syncVisitasProgress.processado}/{syncVisitasProgress.total})</span>
                        </div>
                        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary transition-all duration-300"
                            style={{ width: `${Math.max(2, (syncVisitasProgress.processado / syncVisitasProgress.total) * 100)}%` }}
                          />
                        </div>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 text-emerald-600 dark:text-emerald-400">
                        <div className="text-2xl font-bold">{syncVisitasProgress.inseridos}</div>
                        <div className="text-xs uppercase tracking-wider font-semibold">Inseridos/Atualizados</div>
                      </div>
                      <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-amber-600 dark:text-amber-400">
                        <div className="text-2xl font-bold">{syncVisitasProgress.ignorados}</div>
                        <div className="text-xs uppercase tracking-wider font-semibold">Sem alterações</div>
                      </div>
                    </div>
                    
                    {syncVisitasProgress.concluido && (
                      <div className="flex items-center gap-2 text-emerald-500 font-medium mt-4">
                        <CheckCircle2 className="h-5 w-5" />
                        Sincronização de Visitas Finalizada
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              <div className="bg-muted/30 px-6 py-4 flex items-center justify-end gap-3 border-t border-border">
                {isSyncingVisitas ? (
                  <button
                    onClick={handleCancelSyncVisitas}
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-muted hover:text-destructive h-10 px-6 transition-colors"
                  >
                    Cancelar Operação
                  </button>
                ) : syncVisitasProgress?.concluido ? (
                  <button
                    onClick={handleCloseSyncVisitasModal}
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-6 transition-colors"
                  >
                    Fechar
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleCloseSyncVisitasModal}
                      className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-muted text-foreground h-10 px-6 transition-colors"
                    >
                      Cancelar
                    </button>
                    {syncVisitasProgress && syncVisitasProgress.nextCursor && syncVisitasProgress.nextCursor > 0 ? (
                      <button
                        onClick={handleResumeSyncVisitas}
                        className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-6 transition-colors"
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Continuar de onde parou
                      </button>
                    ) : (
                      <button
                        onClick={handleStartSyncVisitas}
                        className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-6 transition-colors"
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Iniciar Sincronização
                      </button>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Resolver FK Modal */}
      <AnimatePresence>
        {resolverFkModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Link2 className="h-5 w-5 text-primary" />
                  Resolver Visitantes (FK)
                </h3>
                {!isResolvingFk && (
                  <button onClick={() => setResolverFkModalOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>
              
              <div className="p-6 space-y-4">
                {resolverFkResult === null ? (
                  <div className="text-sm text-muted-foreground">
                    <p className="mb-4">
                      Este processo irá vincular cada registro de <strong>Visita</strong> importada ao <strong>Visitante</strong> correspondente no Supabase, 
                      cruzando o <code className="bg-muted px-1 py-0.5 rounded text-xs">visitante_bubble_id</code> com o <code className="bg-muted px-1 py-0.5 rounded text-xs">bubble_id</code> da tabela de visitantes.
                    </p>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Apenas registros com <code className="bg-muted px-1 py-0.5 rounded text-xs">visitante_id</code> ainda NULL serão atualizados.</li>
                      <li>O processo é seguro e pode ser executado múltiplas vezes.</li>
                      <li>Execute <strong>após</strong> ter importado tanto os Visitantes quanto as Visitas.</li>
                    </ul>
                  </div>
                ) : isResolvingFk ? (
                  <div className="flex flex-col items-center gap-4 py-8 w-full">
                    <div className="h-10 w-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                    {resolverFkProgress ? (
                      <div className="w-full space-y-3">
                        <p className="text-sm font-medium text-center text-muted-foreground">{resolverFkProgress.mensagem}</p>
                        {resolverFkProgress.total > 0 && (
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>Progresso</span>
                              <span>{Math.round((resolverFkProgress.processado / resolverFkProgress.total) * 100)}% ({resolverFkProgress.processado.toLocaleString('pt-BR')}/{resolverFkProgress.total.toLocaleString('pt-BR')})</span>
                            </div>
                            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-primary transition-all duration-300"
                                style={{ width: `${Math.max(2, (resolverFkProgress.processado / resolverFkProgress.total) * 100)}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-muted-foreground">Contando registros pendentes...</p>
                        <p className="text-xs text-muted-foreground">Preparando para processar em lotes.</p>
                      </>
                    )}
                  </div>
                ) : resolverFkResult >= 0 ? (
                  <div className="flex flex-col items-center gap-3 py-6">
                    <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
                      <CheckCircle2 className="h-9 w-9 text-emerald-500" />
                    </div>
                    <h4 className="text-xl font-bold text-foreground">{resolverFkResult.toLocaleString('pt-BR')}</h4>
                    <p className="text-sm text-muted-foreground">registros de visitas vinculados a visitantes</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 py-6">
                    <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
                      <AlertTriangle className="h-9 w-9 text-destructive" />
                    </div>
                    <p className="text-sm text-destructive font-medium">Erro ao resolver FKs. Verifique o console.</p>
                  </div>
                )}
              </div>
              
              <div className="bg-muted/30 px-6 py-4 flex items-center justify-end gap-3 border-t border-border">
                {resolverFkResult === null && !isResolvingFk ? (
                  <>
                    <button
                      onClick={() => setResolverFkModalOpen(false)}
                      className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-muted text-foreground h-10 px-6 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleResolverFk}
                      className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-6 transition-colors"
                    >
                      <Link2 className="mr-2 h-4 w-4" />
                      Executar Resolução
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setResolverFkModalOpen(false)}
                    disabled={isResolvingFk}
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-6 transition-colors disabled:opacity-50"
                  >
                    Fechar
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Visitas Modal */}
      <AnimatePresence>
        {visitasModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card w-full max-w-6xl rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <History className="h-5 w-5 text-primary" />
                  Histórico de Visitas: {visitanteSelecionadoNome}
                </h3>
                <button onClick={() => setVisitasModalOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto flex-1">
                {loadingVisitas ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                    <span className="mt-4 text-sm text-muted-foreground">Carregando visitas...</span>
                  </div>
                ) : visitasDoVisitante.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <p>Nenhuma visita encontrada para este visitante.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="border-b border-border bg-muted text-foreground">
                          <th className="h-10 px-4 font-bold uppercase text-[10px] tracking-widest">Entrada</th>
                          <th className="h-10 px-4 font-bold uppercase text-[10px] tracking-widest">Saída</th>
                          <th className="h-10 px-4 font-bold uppercase text-[10px] tracking-widest">Paciente</th>
                          <th className="h-10 px-4 font-bold uppercase text-[10px] tracking-widest">Clínica / Leito</th>
                          <th className="h-10 px-4 font-bold uppercase text-[10px] tracking-widest">Internação</th>
                          <th className="h-10 px-4 font-bold uppercase text-[10px] tracking-widest">Identificado</th>
                          <th className="h-10 px-4 font-bold uppercase text-[10px] tracking-widest">Parentesco</th>
                          <th className="h-10 px-4 font-bold uppercase text-[10px] tracking-widest">Atendente</th>
                          {isAdmin && <th className="h-10 px-4 font-bold uppercase text-[10px] tracking-widest text-right">Ações</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {visitasDoVisitante.map((v) => (
                          <tr key={v.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                            <td className="p-3 whitespace-nowrap">{v.data_hora_entrada ? new Date(v.data_hora_entrada).toLocaleString('pt-BR') : '-'}</td>
                            <td className="p-3 whitespace-nowrap">{v.data_hora_saida ? new Date(v.data_hora_saida).toLocaleString('pt-BR') : '-'}</td>
                            <td className="p-3 font-medium min-w-[150px]">{v.paciente}</td>
                            <td className="p-3 min-w-[120px]">{v.clinica || '-'} / {v.leito || '-'} {v.apartamento ? `(${v.apartamento})` : ''}</td>
                            <td className="p-3 whitespace-nowrap text-muted-foreground">
                              {v.data_internacao ? new Date(v.data_internacao + 'T12:00:00Z').toLocaleDateString('pt-BR') : '-'}
                            </td>
                            <td className="p-3">
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                v.identificado_como?.toUpperCase() === 'VISITANTE'
                                  ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                                  : v.identificado_como?.toUpperCase() === 'ACOMPANHANTE'
                                  ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                                  : v.identificado_como?.toUpperCase() === 'PRESTADOR'
                                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                  : 'bg-muted text-muted-foreground border border-border'
                              }`}>
                                {v.identificado_como}
                              </span>
                            </td>
                            <td className="p-3 text-muted-foreground text-[11px] max-w-[120px] truncate" title={v.parentesco || ''}>
                              {v.parentesco || '-'}
                            </td>
                            <td className="p-3 text-muted-foreground text-[11px] max-w-[100px] truncate" title={v.atendente || ''}>
                              {v.atendente || '-'}
                            </td>
                            {isAdmin && (
                              <td className="p-3 text-right">
                                <button
                                  onClick={() => handleDeleteVisita(v)}
                                  className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                  title="Excluir Visita"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              
              <div className="bg-muted/30 px-6 py-4 flex items-center justify-end border-t border-border">
                <button
                  onClick={() => setVisitasModalOpen(false)}
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-muted text-foreground h-10 px-6 transition-colors"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Nova Visita Modal */}
      {visitanteParaNovaVisita && (
        <NovaVisitaModal 
          isOpen={novaVisitaModalOpen}
          onClose={() => setNovaVisitaModalOpen(false)}
          visitanteId={visitanteParaNovaVisita.id}
          visitanteNome={visitanteParaNovaVisita.nome}
          onVisitaCriada={() => {
            // Optional: Show success toast or refresh visits if history modal is open
            console.log('Visita registrada com sucesso!');
          }}
        />
      )}

      {/* Delete Visita Modal */}
      <AnimatePresence>
        {deleteVisitaModalOpen && visitaToDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#1a1f2e] w-full max-w-sm rounded-3xl border border-white/5 shadow-2xl overflow-hidden p-8"
            >
              <div className="flex flex-col items-center text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10 mb-6 border border-red-500/20">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-600">
                    <span className="text-white text-3xl font-bold">!</span>
                  </div>
                </div>

                <h3 className="text-2xl font-bold text-white mb-2">Confirmar Exclusão</h3>
                <p className="text-slate-400 text-sm mb-6 px-4">
                  Você está prestes a excluir permanentemente o registro da visita abaixo:
                </p>

                <div className="w-full bg-[#242b3d] rounded-2xl p-4 mb-8 text-left border border-white/5">
                  <p className="text-white font-bold text-sm uppercase truncate mb-1">
                    PACIENTE: {visitaToDelete.paciente}
                  </p>
                  <p className="text-slate-500 text-xs font-medium">
                    ENTRADA: {visitaToDelete.data_hora_entrada ? new Date(visitaToDelete.data_hora_entrada).toLocaleString('pt-BR') : '-'}
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4 w-full">
                  <button
                    onClick={() => {
                      setDeleteVisitaModalOpen(false);
                      setVisitaToDelete(null);
                    }}
                    disabled={deleteVisitaLoading}
                    className="flex items-center justify-center rounded-2xl text-sm font-bold border border-white/10 bg-[#242b3d]/50 text-slate-300 h-14 hover:bg-[#242b3d] transition-all disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmDeleteVisita}
                    disabled={deleteVisitaLoading}
                    className="flex items-center justify-center rounded-2xl text-sm font-bold bg-[#ff1e1e] text-white h-14 hover:bg-[#e60000] transition-all shadow-[0_0_20px_rgba(255,30,30,0.3)] disabled:opacity-50"
                  >
                    {deleteVisitaLoading ? (
                      <div className="h-5 w-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    ) : (
                      'Confirmar Exclusão'
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Saída via QRCode Modal */}
      <SaidaQRCodeModal
        isOpen={saidaQRCodeModalOpen}
        onClose={() => setSaidaQRCodeModalOpen(false)}
        onSuccess={() => {
          if (visitasModalOpen && visitanteParaNovaVisita?.id && visitanteParaNovaVisita?.nome) {
            handleOpenVisitas(visitanteParaNovaVisita.id, visitanteParaNovaVisita.nome);
          }
        }}
      />

      {/* Saída em Lote Modal */}
      <SaidaLoteModal
        isOpen={saidaLoteModalOpen}
        onClose={() => setSaidaLoteModalOpen(false)}
      />

    </motion.div>
  );
}
