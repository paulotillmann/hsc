import React, { useState, useEffect } from 'react';
import { BedDouble, Search, Loader2, RefreshCcw, Calendar, CheckCircle, XCircle, ChevronDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import SyncModal from './SyncModal';

interface Paciente {
  id: string;
  nr_atendimento: number;
  paciente: string;
  ds_setor_atendimento: string | null;
  cd_cid_principal: string | null;
  dias_internado: number | null;
  teve_evolucao_hoje: string | null;
  previsao_alta: string | null;
  ativo: boolean;
  dt_entrada: string | null;
}

export default function PacientesInternados() {
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [setorTerm, setSetorTerm] = useState('');
  
  // Pagination (12 records per page)
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 12;

  // Sync Modal
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

  useEffect(() => {
    fetchPacientes();
  }, []);

  const fetchPacientes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('pacientes_internados')
      .select('id, nr_atendimento, paciente, ds_setor_atendimento, cd_cid_principal, dias_internado, teve_evolucao_hoje, previsao_alta, ativo, dt_entrada')
      .eq('ativo', true) // Mostrar por padrão apenas ativos
      .order('paciente', { ascending: true });

    if (!error && data) {
      setPacientes(data);
    }
    setLoading(false);
  };

  // Setores únicos para o dropdown
  const uniqueSetores = Array.from(
    new Set(pacientes.map(p => p.ds_setor_atendimento).filter(Boolean))
  ).sort() as string[];

  // Filtragem
  const filteredPacientes = pacientes.filter(p => {
    const matchName = p.paciente?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchSetor = p.ds_setor_atendimento?.toLowerCase().includes(setorTerm.toLowerCase()) || setorTerm === '';
    return matchName && matchSetor;
  });

  // Paginação
  const totalPages = Math.ceil(filteredPacientes.length / recordsPerPage);
  const indexOfLastRecord = currentPage * recordsPerPage;
  const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
  const currentRecords = filteredPacientes.slice(indexOfFirstRecord, indexOfLastRecord);

  // Reseta paginação ao pesquisar
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, setorTerm]);

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 md:p-8 animate-in fade-in zoom-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl">
              <BedDouble className="h-6 w-6 text-primary" />
            </div>
            Pacientes Internados
          </h1>
          <p className="text-muted-foreground">
            Acompanhamento de pacientes atualmente internados na instituição.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={() => setIsSyncModalOpen(true)}
            className="flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 rounded-md font-medium transition-colors shadow-sm"
          >
            <RefreshCcw className="h-5 w-5" />
            Sincronizar Pacientes
          </button>
        </div>
      </div>

      <div className="bg-card border rounded-lg shadow-sm flex flex-col flex-1 overflow-hidden min-h-[500px]">
        {/* Toolbar & Filters */}
        <div className="p-4 border-b flex flex-col md:flex-row gap-4 justify-between bg-muted/20">
          <div className="flex flex-1 gap-4 max-w-2xl">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar por nome do paciente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm bg-background"
              />
            </div>
            <div className="relative flex-1">
              <BedDouble className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <select
                value={setorTerm}
                onChange={(e) => setSetorTerm(e.target.value)}
                className="w-full pl-9 pr-8 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm bg-background appearance-none cursor-pointer"
              >
                <option value="">Todos os Setores</option>
                {uniqueSetores.map(setor => (
                  <option key={setor} value={setor}>
                    {setor}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full min-h-[400px]">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : currentRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-muted-foreground gap-2">
              <BedDouble className="h-12 w-12 opacity-20" />
              <p>Nenhum paciente internado encontrado com os filtros atuais.</p>
            </div>
          ) : (
            <table className="w-full text-base text-left">
              <thead className="text-sm text-muted-foreground uppercase bg-muted/50 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-6 py-3 font-semibold">Atendimento</th>
                  <th className="px-6 py-3 font-semibold">Paciente</th>
                  <th className="px-6 py-3 font-semibold">Setor</th>
                  <th className="px-6 py-3 font-semibold text-center">CID</th>
                  <th className="px-6 py-3 font-semibold text-center">Data Entrada</th>
                  <th className="px-6 py-3 font-semibold text-center">Dias Internado</th>
                  <th className="px-6 py-3 font-semibold text-center">Prev. Alta</th>
                  <th className="px-6 py-3 font-semibold text-center">Evolução Hoje</th>
                  <th className="px-6 py-3 font-semibold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {currentRecords.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4 font-mono text-muted-foreground">
                      {p.nr_atendimento}
                    </td>
                    <td className="px-6 py-4 font-medium text-foreground">
                      {p.paciente}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {p.ds_setor_atendimento || '-'}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {p.cd_cid_principal ? (
                        <span className="inline-flex items-center justify-center px-2.5 py-1 rounded text-sm font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300 font-mono tracking-wider border border-indigo-200 dark:border-indigo-800/50 shadow-sm min-w-[3rem]">
                          {p.cd_cid_principal}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center text-muted-foreground">
                      {p.dt_entrada ? new Date(p.dt_entrada).toLocaleDateString('pt-BR') : '-'}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center items-center gap-1.5 text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>{p.dias_internado ?? 0}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center text-muted-foreground">
                      {p.previsao_alta ? new Date(p.previsao_alta).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '-'}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {p.teve_evolucao_hoje === 'S' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                          <CheckCircle className="h-4 w-4" />
                          Sim
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                          <XCircle className="h-4 w-4" />
                          Não
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex px-3 py-1.5 text-sm font-semibold rounded-full ${
                        p.ativo 
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' 
                          : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        {p.ativo ? 'Internado' : 'Alta'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Footer */}
        {!loading && filteredPacientes.length > 0 && (
          <div className="p-4 border-t bg-muted/20 flex flex-col md:flex-row items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">
              Mostrando <span className="font-medium text-foreground">{indexOfFirstRecord + 1}</span> a{' '}
              <span className="font-medium text-foreground">
                {Math.min(indexOfLastRecord, filteredPacientes.length)}
              </span>{' '}
              de <span className="font-medium text-foreground">{filteredPacientes.length}</span> resultados
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 border rounded-md text-sm font-medium hover:bg-muted disabled:opacity-50 transition-colors"
              >
                Anterior
              </button>
              <div className="flex items-center gap-1 text-sm font-medium px-2">
                Página {currentPage} de {totalPages}
              </div>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 border rounded-md text-sm font-medium hover:bg-muted disabled:opacity-50 transition-colors"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>

      <SyncModal 
        isOpen={isSyncModalOpen} 
        onClose={() => setIsSyncModalOpen(false)} 
        onSuccess={fetchPacientes} 
      />
      
    </div>
  );
}
