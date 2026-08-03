import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, ChevronLeft, ChevronRight, RefreshCw, Loader2, UserCircle2, X, ArrowUp, ArrowDown, History, LogOut, Printer } from 'lucide-react';
import { buscarPacientes, limparCachePacientes, Paciente } from '../../services/pacienteService';
import { listarVisitasPorPaciente, buscarContagemVisitasAbertas, registrarSaidaVisita } from '../../services/visitaService';

export default function Pacientes() {
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<'nome' | 'clinica' | 'data_internacao'>('nome');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const itemsPerPage = 12;

  const [visitasAbertas, setVisitasAbertas] = useState<Record<string, { visitante: number, acompanhante: number }>>({});

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPaciente, setSelectedPaciente] = useState<Paciente | null>(null);
  const [visitasPaciente, setVisitasPaciente] = useState<any[]>([]);
  const [loadingVisitas, setLoadingVisitas] = useState(false);

  const [encerrarVisitaModalOpen, setEncerrarVisitaModalOpen] = useState(false);
  const [visitaToEncerrar, setVisitaToEncerrar] = useState<any | null>(null);
  const [encerrarVisitaLoading, setEncerrarVisitaLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [searchTerm]);

  const loadData = async (forceRefresh = false) => {
    setLoading(true);
    if (forceRefresh) {
      limparCachePacientes();
    }
    try {
      const [data, contagens] = await Promise.all([
        buscarPacientes(searchTerm),
        buscarContagemVisitasAbertas()
      ]);
      setPacientes(data);
      setVisitasAbertas(contagens);
      setCurrentPage(1); // Volta para a primeira página ao pesquisar
    } catch (err) {
      console.error('Erro ao carregar pacientes:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: 'nome' | 'clinica' | 'data_internacao') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Ordenação e Paginação
  const sortedPacientes = [...pacientes].sort((a, b) => {
    let valA = '';
    let valB = '';

    if (sortField === 'nome') {
      valA = a.nome?.toLowerCase() || '';
      valB = b.nome?.toLowerCase() || '';
    } else if (sortField === 'clinica') {
      valA = a.clinica?.toLowerCase() || '';
      valB = b.clinica?.toLowerCase() || '';
    } else if (sortField === 'data_internacao') {
      valA = a.data_internacao || '';
      valB = b.data_internacao || '';
    }

    if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = sortedPacientes.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(sortedPacientes.length / itemsPerPage);

  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

  const handleOpenVisitas = async (paciente: Paciente) => {
    setSelectedPaciente(paciente);
    setModalOpen(true);
    setLoadingVisitas(true);
    try {
      const visitas = await listarVisitasPorPaciente(paciente.nome);
      setVisitasPaciente(visitas);
    } catch (error) {
      console.error('Erro ao buscar visitas', error);
    } finally {
      setLoadingVisitas(false);
    }
  };

  const handleEncerrarVisita = (visita: any) => {
    setVisitaToEncerrar(visita);
    setEncerrarVisitaModalOpen(true);
  };

  const confirmEncerrarVisita = async () => {
    if (!visitaToEncerrar) return;
    setEncerrarVisitaLoading(true);
    try {
      const updatedVisita = await registrarSaidaVisita(visitaToEncerrar.id);
      setVisitasPaciente(prev => prev.map(v => v.id === updatedVisita.id ? updatedVisita : v));
      
      // Update counters in the main grid
      if (selectedPaciente) {
        setVisitasAbertas(prev => {
           const pName = selectedPaciente.nome;
           if (!prev[pName]) return prev;
           
           const tipo = visitaToEncerrar.identificado_como?.toUpperCase();
           const novoCount = { ...prev[pName] };
           
           if (tipo === 'VISITANTE') novoCount.visitante = Math.max(0, novoCount.visitante - 1);
           else if (tipo === 'ACOMPANHANTE') novoCount.acompanhante = Math.max(0, novoCount.acompanhante - 1);
           
           return { ...prev, [pName]: novoCount };
        });
      }

      setEncerrarVisitaModalOpen(false);
      setVisitaToEncerrar(null);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setEncerrarVisitaLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 pb-12"
    >
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Pacientes</h1>
          <p className="text-sm text-muted-foreground">Consulta de pacientes internados (Atendimentos Tasy)</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadData(true)}
            disabled={loading}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none border border-border bg-background hover:bg-muted text-foreground px-4 py-2 shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar Lista
          </button>
        </div>
      </div>

      {/* FILTERS */}
      <div className="bg-card border border-border shadow-sm rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/20 flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Pesquisar por nome do paciente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-background border border-border rounded-md pl-9 pr-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="text-xs text-muted-foreground font-medium">
            Exibindo {pacientes.length} pacientes encontrados
          </div>
        </div>

        {/* TABLE */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th scope="col" className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                  <button 
                    onClick={() => handleSort('nome')}
                    className="flex items-center gap-2 hover:text-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                  >
                    Paciente
                    {sortField === 'nome' && (sortOrder === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />)}
                  </button>
                </th>
                <th scope="col" className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                  <button 
                    onClick={() => handleSort('clinica')}
                    className="flex items-center gap-2 hover:text-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                  >
                    Clínica / Setor
                    {sortField === 'clinica' && (sortOrder === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />)}
                  </button>
                </th>
                <th scope="col" className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Leito</th>
                <th scope="col" className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Convênio</th>
                <th scope="col" className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Categoria</th>
                <th scope="col" className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Médico</th>
                <th scope="col" className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                  <button 
                    onClick={() => handleSort('data_internacao')}
                    className="flex items-center gap-2 hover:text-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                  >
                    Internação
                    {sortField === 'data_internacao' && (sortOrder === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />)}
                  </button>
                </th>
                <th scope="col" className="h-12 px-4 text-center align-middle font-medium text-muted-foreground">Dias Int.</th>
                <th scope="col" className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Prev. Alta</th>
                <th scope="col" className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Responsável</th>
                <th scope="col" className="h-12 px-4 text-center align-middle font-medium text-muted-foreground">Visitantes</th>
                <th scope="col" className="h-12 px-4 text-center align-middle font-medium text-muted-foreground">Acompanhantes</th>
                <th scope="col" className="h-12 px-4 text-center align-middle font-medium text-muted-foreground w-20">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={13} className="h-48 text-center">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <p className="text-muted-foreground font-medium">Carregando dados do Tasy...</p>
                    </div>
                  </td>
                </tr>
              ) : currentItems.length === 0 ? (
                <tr>
                  <td colSpan={13} className="h-32 text-center text-muted-foreground">
                    Nenhum paciente encontrado.
                  </td>
                </tr>
              ) : (
                currentItems.map((paciente) => (
                  <tr key={paciente.id} className="hover:bg-muted/50 transition-colors group">
                    <td className="p-4 align-middle">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shrink-0">
                          <UserCircle2 className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-bold text-foreground leading-tight uppercase">{paciente.nome}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 align-middle">
                      <span className="px-2 py-1 rounded bg-muted text-foreground text-[11px] font-semibold border border-border uppercase">
                        {paciente.clinica || 'N/A'}
                      </span>
                    </td>
                    <td className="p-4 align-middle">
                      <span className="font-bold text-primary">{paciente.leito || '-'}</span>
                    </td>
                    <td className="p-4 align-middle text-muted-foreground">
                      {paciente.convenio}
                    </td>
                    <td className="p-4 align-middle">
                      <span className="text-xs text-muted-foreground">{paciente.categoria || '-'}</span>
                    </td>
                    <td className="p-4 align-middle">
                      <span className="text-xs text-foreground">{paciente.medico || '-'}</span>
                    </td>
                    <td className="p-4 align-middle font-medium">
                      {paciente.data_internacao ? new Date(paciente.data_internacao + 'T12:00:00Z').toLocaleDateString('pt-BR') : '-'}
                    </td>
                    <td className="p-4 align-middle text-center">
                      <span className={`inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full text-xs font-bold border ${(paciente.dias_internado ?? 0) > 5 ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20' : 'bg-muted text-muted-foreground border-transparent'}`}>
                        {paciente.dias_internado ?? 0}
                      </span>
                    </td>
                    <td className="p-4 align-middle text-xs">
                      {paciente.previsao_alta ? new Date(paciente.previsao_alta).toLocaleDateString('pt-BR') : '-'}
                    </td>
                    <td className="p-4 align-middle">
                      <span className="text-xs text-muted-foreground uppercase">{paciente.responsavel || '-'}</span>
                    </td>
                    <td className="p-4 align-middle text-center">
                      <span className={`inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full text-xs font-bold border ${visitasAbertas[paciente.nome]?.visitante > 0 ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20' : 'bg-muted text-muted-foreground border-transparent'}`}>
                        {visitasAbertas[paciente.nome]?.visitante || 0}
                      </span>
                    </td>
                    <td className="p-4 align-middle text-center">
                      <span className={`inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full text-xs font-bold border ${visitasAbertas[paciente.nome]?.acompanhante > 0 ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/20' : 'bg-muted text-muted-foreground border-transparent'}`}>
                        {visitasAbertas[paciente.nome]?.acompanhante || 0}
                      </span>
                    </td>
                    <td className="p-4 align-middle text-center">
                      <button
                        onClick={() => handleOpenVisitas(paciente)}
                        className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
                        title="Ver Visitas"
                      >
                        <History className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        {!loading && totalPages > 1 && (
          <div className="p-4 border-t border-border bg-muted/10 flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              Mostrando <span className="font-medium text-foreground">{indexOfFirstItem + 1}</span> a <span className="font-medium text-foreground">{Math.min(indexOfLastItem, pacientes.length)}</span> de <span className="font-medium text-foreground">{pacientes.length}</span> pacientes
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => paginate(currentPage - 1)}
                disabled={currentPage === 1}
                className="h-8 w-8 inline-flex items-center justify-center rounded border border-border bg-background text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum = currentPage;
                  if (currentPage <= 3) pageNum = i + 1;
                  else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                  else pageNum = currentPage - 2 + i;

                  if (pageNum <= 0 || pageNum > totalPages) return null;

                  return (
                    <button
                      key={pageNum}
                      onClick={() => paginate(pageNum)}
                      className={`h-8 w-8 rounded text-xs font-medium transition-all ${
                        currentPage === pageNum
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'bg-background border border-border text-foreground hover:bg-muted'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => paginate(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="h-8 w-8 inline-flex items-center justify-center rounded border border-border bg-background text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL VISITAS */}
      <AnimatePresence>
        {modalOpen && selectedPaciente && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
              onClick={() => setModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-4xl bg-card border border-border shadow-lg sm:rounded-xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="flex items-center justify-between p-6 border-b border-border">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Visitas: <span className="uppercase">{selectedPaciente.nome}</span></h2>
                  <p className="text-sm text-muted-foreground">Histórico de acessos ao paciente</p>
                </div>
                <button
                  onClick={() => setModalOpen(false)}
                  className="rounded-full p-2 hover:bg-muted text-muted-foreground transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1">
                {loadingVisitas ? (
                  <div className="flex flex-col items-center justify-center h-40 gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-muted-foreground font-medium">Buscando visitas...</p>
                  </div>
                ) : visitasPaciente.length === 0 ? (
                  <div className="flex items-center justify-center h-40 text-muted-foreground">
                    Nenhuma visita registrada para este paciente.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left border-collapse">
                      <thead>
                        <tr className="border-b border-border bg-muted/30">
                          <th className="h-10 px-4 text-left font-medium text-muted-foreground">Visitante</th>
                          <th className="h-10 px-4 text-left font-medium text-muted-foreground">Crachá</th>
                          <th className="h-10 px-4 text-left font-medium text-muted-foreground">Entrada</th>
                          <th className="h-10 px-4 text-left font-medium text-muted-foreground">Saída</th>
                          <th className="h-10 px-4 text-center font-medium text-muted-foreground w-24">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {visitasPaciente.map((v: any) => (
                          <tr key={v.id} className="hover:bg-muted/50 transition-colors">
                            <td className="p-4 font-medium text-foreground">
                              {v.visitante?.nome || 'N/A'}
                              <div className="text-xs text-muted-foreground font-normal mt-0.5 uppercase">
                                {v.identificado_como} {v.parentesco ? `(${v.parentesco})` : ''}
                              </div>
                            </td>
                            <td className="p-4">
                              <span className="font-mono bg-muted px-2 py-1 rounded text-xs border border-border">
                                {v.id_cracha ? String(v.id_cracha).padStart(3, '0') : '-'}
                              </span>
                            </td>
                            <td className="p-4">
                              {v.data_hora_entrada ? new Date(v.data_hora_entrada).toLocaleString('pt-BR') : '-'}
                            </td>
                            <td className="p-4">
                              {v.data_hora_saida ? new Date(v.data_hora_saida).toLocaleString('pt-BR') : '-'}
                            </td>
                            <td className="p-4 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => window.open(`/imprimir/etiqueta/${v.id}`, '_blank')}
                                  className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                                  title="Reimprimir Crachá"
                                >
                                  <Printer className="h-4 w-4" />
                                </button>
                                {!v.data_hora_saida && (
                                  <button
                                    onClick={() => handleEncerrarVisita(v)}
                                    className="p-1 rounded hover:bg-amber-500/10 text-muted-foreground hover:text-amber-500 transition-colors"
                                    title="Encerrar Visita"
                                  >
                                    <LogOut className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div className="p-4 border-t border-border bg-muted/10 flex justify-end">
                <button
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-border bg-background text-foreground hover:bg-muted font-medium rounded-md text-sm transition-colors"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Encerrar Visita Modal */}
      <AnimatePresence>
        {encerrarVisitaModalOpen && visitaToEncerrar && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#1a1f2e] w-full max-w-sm rounded-3xl border border-white/5 shadow-2xl overflow-hidden p-8"
            >
              <div className="flex flex-col items-center text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-amber-500/10 mb-6 border border-amber-500/20">
                  <LogOut className="h-10 w-10 text-amber-500" />
                </div>

                <h3 className="text-2xl font-bold text-white mb-2">Encerrar Visita</h3>
                <p className="text-slate-400 text-sm mb-6 px-4">
                  Deseja registrar a saída para a visita abaixo?
                </p>

                <div className="w-full bg-[#242b3d] rounded-2xl p-4 mb-8 text-left border border-white/5">
                  <p className="text-white font-bold text-sm uppercase truncate mb-1">
                    {visitaToEncerrar.visitante?.nome || 'VISITANTE'}
                  </p>
                  <p className="text-slate-500 text-xs font-medium">
                    Crachá: {visitaToEncerrar.id_cracha || '-'}
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4 w-full">
                  <button
                    onClick={() => setEncerrarVisitaModalOpen(false)}
                    disabled={encerrarVisitaLoading}
                    className="flex items-center justify-center rounded-2xl text-sm font-bold border border-white/10 bg-[#242b3d]/50 text-slate-300 h-14 hover:bg-[#242b3d] transition-all disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmEncerrarVisita}
                    disabled={encerrarVisitaLoading}
                    className="flex items-center justify-center rounded-2xl text-sm font-bold bg-amber-600 text-white h-14 hover:bg-amber-700 transition-all shadow-[0_0_20px_rgba(217,119,6,0.3)] disabled:opacity-50"
                  >
                    {encerrarVisitaLoading ? (
                      <div className="h-5 w-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    ) : (
                      'Confirmar Saída'
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
