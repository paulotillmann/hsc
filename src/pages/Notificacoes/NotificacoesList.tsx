import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Filter, Plus, UserCircle2, ArrowUpDown, ChevronLeft, ChevronRight, Edit, Trash2, AlertTriangle, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fetchNotificacoes, deleteNotificacao, NotificacaoRecord } from '../../services/notificacaoService';

const getSetorColorClass = (setor?: string) => {
  if (!setor) return 'bg-muted border-border text-muted-foreground';
  const s = setor.toLowerCase();
  
  if (s.includes('posto 1')) return 'bg-emerald-950/60 border-emerald-800 text-emerald-400';
  if (s.includes('posto 2') && s.includes('rn')) return 'bg-cyan-950/60 border-cyan-800 text-cyan-400';
  if (s.includes('posto 2') && s.includes('g.o')) return 'bg-sky-950/60 border-sky-800 text-sky-400';
  if (s.includes('posto 2')) return 'bg-blue-950/60 border-blue-800 text-blue-400';
  if (s.includes('posto 3')) return 'bg-amber-950/60 border-amber-800 text-amber-400';
  if (s.includes('posto 4')) return 'bg-orange-950/60 border-orange-800 text-orange-400';
  if (s.includes('posto 5') || s.includes('pediatria')) return 'bg-purple-950/60 border-purple-800 text-purple-400';
  
  if (s.includes('uti unidade 1')) return 'bg-rose-950/60 border-rose-800 text-rose-400';
  if (s.includes('uti unidade 2')) return 'bg-red-950/60 border-red-800 text-red-400';
  if (s.includes('uti neonatal')) return 'bg-pink-950/60 border-pink-800 text-pink-400';
  
  if (s.includes('pronto atendimento') || s.includes('pa')) return 'bg-violet-950/60 border-violet-800 text-violet-400';

  return 'bg-slate-900 border-slate-700 text-slate-300';
};

export default function NotificacoesList() {
  const navigate = useNavigate();
  const [data, setData] = useState<NotificacaoRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [sexoFilter, setSexoFilter] = useState('');
  const [escolaridadeFilter, setEscolaridadeFilter] = useState('');
  
  // Calcula datas padrão (Primeiro e Último dia do mês atual)
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
  
  const [dateFrom, setDateFrom] = useState(firstDay);
  const [dateTo, setDateTo] = useState(lastDay);

  const [currentPage, setCurrentPage] = useState(() => {
    const saved = sessionStorage.getItem('notificacoes_current_page');
    return saved ? parseInt(saved, 10) : 1;
  });
  
  useEffect(() => {
    sessionStorage.setItem('notificacoes_current_page', currentPage.toString());
  }, [currentPage]);

  const itemsPerPage = 10;

  const [sortConfig, setSortConfig] = useState<{ key: keyof NotificacaoRecord; direction: 'asc' | 'desc' } | null>(null);

  // Estados de Exclusão
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await fetchNotificacoes({ limit: 1000 });
      setData(result.data);
    } catch (err) {
      console.error('Erro ao buscar notificações', err);
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = (id: string) => {
    setItemToDelete(id);
    setDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    setDeleteLoading(true);
    try {
      await deleteNotificacao(itemToDelete);
      setData(prev => prev.filter(p => p.id !== itemToDelete));
      setDeleteModalOpen(false);
      setItemToDelete(null);
    } catch (err: any) {
      alert('Erro ao excluir: ' + err.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  // Local Sort & Filter
  const filteredData = data.filter((item) => {
    const term = searchTerm.toLowerCase();
    const nomeOriginal = (item.Paciente || '').toLowerCase();
    const matchBusca = nomeOriginal.includes(term) || (item.DoencaAgravo || '').toLowerCase().includes(term);

    const matchSexo = sexoFilter ? item.SexoPaciente === sexoFilter : true;
    const matchEscolaridade = escolaridadeFilter ? item.EscolaridadePaciente === escolaridadeFilter : true;

    // Filter by Period
    let matchDate = true;
    if (item.DataNotificacao) {
      const itemDate = item.DataNotificacao.substring(0, 10);
      if (dateFrom && itemDate < dateFrom) matchDate = false;
      if (dateTo && itemDate > dateTo) matchDate = false;
    } else {
      matchDate = (!dateFrom && !dateTo);
    }

    return matchBusca && matchSexo && matchEscolaridade && matchDate;
  });

  const prevFilters = React.useRef({ searchTerm, sexoFilter, escolaridadeFilter, dateFrom, dateTo });

  // Reset page *only* when filters actually change
  useEffect(() => {
    const p = prevFilters.current;
    if (
      p.searchTerm !== searchTerm ||
      p.sexoFilter !== sexoFilter ||
      p.escolaridadeFilter !== escolaridadeFilter ||
      p.dateFrom !== dateFrom ||
      p.dateTo !== dateTo
    ) {
      setCurrentPage(1);
      prevFilters.current = { searchTerm, sexoFilter, escolaridadeFilter, dateFrom, dateTo };
    }
  }, [searchTerm, sexoFilter, escolaridadeFilter, dateFrom, dateTo]);

  const sortedData = [...filteredData];
  if (sortConfig !== null) {
    sortedData.sort((a, b) => {
      const aVal = a[sortConfig.key] || '';
      const bVal = b[sortConfig.key] || '';
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }

  const handleSort = (key: keyof NotificacaoRecord) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const totalPages = Math.ceil(sortedData.length / itemsPerPage);
  const paginatedData = sortedData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const tableHeaders: { label: string; key: keyof NotificacaoRecord }[] = [
    { label: 'Paciente', key: 'Paciente' },
    { label: 'Doença/Agravo', key: 'DoencaAgravo' },
    { label: 'Sexo', key: 'SexoPaciente' },
    { label: 'Escolaridade', key: 'EscolaridadePaciente' },
    { label: 'Setor', key: 'Setor' },
    { label: 'Notificado Em', key: 'DataNotificacao' },
  ];

  const handleGeneratePDF = () => {
    const doc = new jsPDF('landscape', 'pt', 'a4');

    doc.setFontSize(16);
    doc.text('Relatório de Notificações Epidemiológicas', 40, 40);

    const tableColumn = [
      "Paciente", "Idade", "Sexo", "Cor/Raça", "Escolaridade", "Ocupação", 
      "Data Sintoma", "Data Notif.", "Doença/Agravo", "Resultado", "Saída", "Setor"
    ];

    const tableRows: any[] = [];

    sortedData.forEach(item => {
      const rowData = [
        item.Paciente || '-',
        item.IdadePaciente || '-',
        item.SexoPaciente || '-',
        item.CorRacaPaciente || '-',
        item.EscolaridadePaciente || '-',
        item.OcupacaoPaciente || '-',
        item.DataSintoma ? new Date(item.DataSintoma).toLocaleDateString('pt-BR') : '-',
        item.DataNotificacao ? new Date(item.DataNotificacao).toLocaleDateString('pt-BR') : '-',
        item.DoencaAgravo || '-',
        item.Resultado || '-',
        item.Saida || '-',
        item.Setor || '-'
      ];
      tableRows.push(rowData);
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 55,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { top: 55 }
    });

    // Gera o PDF como Blob e abre em uma nova aba
    const pdfBlob = doc.output('blob');
    const blobUrl = URL.createObjectURL(pdfBlob);
    window.open(blobUrl, '_blank');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 w-full px-[40px] max-w-none"
    >
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Notificações</h1>
          <p className="text-sm text-muted-foreground">Listagem e busca de registros epidemiológicos</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleGeneratePDF}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none border border-border bg-background hover:bg-muted text-foreground h-10 px-4 py-2"
            title="Exportar dados filtrados para PDF"
          >
            <FileText className="mr-2 h-4 w-4" />
            Gerar Relatório
          </button>
          <button
            onClick={() => navigate('/notificacoes/nova')}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nova Notificação
          </button>
        </div>
      </div>

      {/* FILTERS */}
      <div className="bg-card text-card-foreground rounded-xl border border-border shadow-sm">
        <div className="p-4 md:p-6 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por Nome do Paciente ou Agravo..."
              className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="w-full md:w-36">
            <input
              type="date"
              className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&::-webkit-calendar-picker-indicator]:dark:invert"
              title="Data Inicial"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="w-full md:w-36">
            <input
              type="date"
              className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&::-webkit-calendar-picker-indicator]:dark:invert"
              title="Data Final"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>

          <div className="w-full md:w-48">
            <select
              className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              value={sexoFilter}
              onChange={(e) => setSexoFilter(e.target.value)}
            >
              <option className="bg-background text-foreground" value="">Todos (Sexo)</option>
              <option className="bg-background text-foreground" value="M">Masculino</option>
              <option className="bg-background text-foreground" value="F">Feminino</option>
            </select>
          </div>

          <div className="w-full md:w-48">
            <select
              className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              value={escolaridadeFilter}
              onChange={(e) => setEscolaridadeFilter(e.target.value)}
            >
              <option className="bg-background text-foreground" value="">Todas (Escolaridade)</option>
              <option className="bg-background text-foreground" value="Sem instrução">Sem instrução</option>
              <option className="bg-background text-foreground" value="Educação infantil">Educação infantil</option>
              <option className="bg-background text-foreground" value="Primário">Primário</option>
              <option className="bg-background text-foreground" value="Nível Fundamental Incompleto">Fundamental Incompleto</option>
              <option className="bg-background text-foreground" value="Nível Fundamental Completo">Fundamental Completo</option>
              <option className="bg-background text-foreground" value="Nível Médio Incompleto">Médio Incompleto</option>
              <option className="bg-background text-foreground" value="Nível Médio Completo">Médio Completo</option>
              <option className="bg-background text-foreground" value="Superior incompleto">Superior incompleto</option>
              <option className="bg-background text-foreground" value="Superior">Superior completo</option>
              <option className="bg-background text-foreground" value="Pós-graduação">Pós-graduação</option>
              <option className="bg-background text-foreground" value="Não informado pela pessoa">Não informado</option>
            </select>
          </div>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-card text-card-foreground rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-muted-foreground">
                {tableHeaders.map((header) => (
                  <th
                    key={header.key}
                    scope="col"
                    className="h-12 px-4 text-left align-middle font-medium cursor-pointer hover:bg-muted/80 transition-colors"
                    onClick={() => handleSort(header.key)}
                  >
                    <div className="flex items-center gap-1">
                      {header.label}
                      <ArrowUpDown className="h-3 w-3 opacity-50" />
                    </div>
                  </th>
                ))}
                <th scope="col" className="h-12 px-4 text-right align-middle font-medium w-[100px]">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="h-24 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                      <span className="text-muted-foreground">Carregando...</span>
                    </div>
                  </td>
                </tr>
              ) : sortedData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="h-24 text-center text-muted-foreground">
                    Nenhum registro encontrado.
                  </td>
                </tr>
              ) : (
                paginatedData.map((item) => (
                  <tr key={item.id} className="border-b border-border transition-colors hover:bg-muted/50">
                    <td className="p-4 align-middle">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                          <UserCircle2 className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{item.Paciente || 'Sem Nome'}</span>
                          <span className="text-xs text-muted-foreground">{item.IdadePaciente}</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 align-middle text-foreground font-medium">
                      {item.DoencaAgravo}
                    </td>
                    <td className="p-4 align-middle">
                      <span className={`inline-flex items-center justify-center rounded-full border-2 px-3 py-1 text-[11px] font-black uppercase tracking-widest ${
                        item.SexoPaciente === 'Masculino' || item.SexoPaciente === 'M'
                          ? 'bg-slate-950 text-white border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)]'
                          : item.SexoPaciente === 'Feminino' || item.SexoPaciente === 'F'
                          ? 'bg-slate-950 text-white border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.3)]'
                          : 'bg-muted text-muted-foreground border-border'
                      }`}>
                        {item.SexoPaciente === 'M' ? 'MASCULINO' : item.SexoPaciente === 'F' ? 'FEMININO' : (item.SexoPaciente || '-').toUpperCase()}
                      </span>
                    </td>
                    <td className="p-4 align-middle text-muted-foreground">
                      {item.EscolaridadePaciente}
                    </td>
                    <td className="p-4 align-middle">
                      {item.Setor ? (
                        <span className={`inline-flex items-center justify-center rounded-full border px-3 py-1 text-xs font-bold capitalize ${getSetorColorClass(item.Setor)}`}>
                          {item.Setor.toLowerCase()}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="p-4 align-middle text-muted-foreground whitespace-nowrap">
                      {item.DataNotificacao ? new Date(item.DataNotificacao).toLocaleDateString('pt-BR') : '-'}
                    </td>
                    <td className="p-4 align-middle text-right">
                       <div className="flex items-center justify-end gap-2">
                         <button 
                           onClick={() => navigate(`/notificacoes/editar/${item.id}`)}
                           className="p-1.5 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                           title="Editar"
                         >
                           <Edit className="h-4 w-4" />
                         </button>
                         <button 
                           onClick={() => confirmDelete(item.id)}
                           className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                           title="Excluir"
                         >
                           <Trash2 className="h-4 w-4" />
                         </button>
                       </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-border flex justify-between items-center bg-muted/20">
          <span className="text-sm text-muted-foreground">
            Página <span className="font-semibold text-foreground">{currentPage}</span> de <span className="font-semibold text-foreground">{Math.max(1, totalPages)}</span> - {filteredData.length} registros
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
                let startPage = Math.max(1, currentPage - 1);
                let endPage = startPage + 3;
                if (endPage > totalPages) {
                  endPage = totalPages;
                  startPage = Math.max(1, endPage - 3);
                }
                const visiblePages = Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);
                
                return visiblePages.map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-8 h-8 flex items-center justify-center rounded-md text-sm font-medium transition-colors ${
                      page === currentPage
                        ? 'bg-emerald-500 text-white shadow-sm border-transparent'
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

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card w-full max-w-md rounded-2xl border border-destructive/20 shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-6 flex gap-4">
                <div className="flex-shrink-0 w-12 h-12 mt-1 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold tracking-tight mb-2 text-foreground">Excluir Notificação</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Você tem certeza que deseja excluir esta notificação permanentemente? Esta ação não poderá ser desfeita.
                  </p>
                </div>
              </div>
              <div className="bg-muted/30 px-6 py-4 flex items-center justify-end gap-3 border-t border-border">
                <button
                  onClick={() => setDeleteModalOpen(false)}
                  disabled={deleteLoading}
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-muted hover:text-foreground h-10 px-6 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleteLoading}
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-6 disabled:opacity-50 transition-colors"
                >
                  {deleteLoading ? (
                    <div className="mr-2 h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  {deleteLoading ? 'Excluindo...' : 'Sim, excluir'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}
