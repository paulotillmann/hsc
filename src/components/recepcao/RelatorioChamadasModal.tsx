import React, { useState, useEffect } from 'react';
import { X, Search, Calendar, User, FileText, Download } from 'lucide-react';
import { senhaService, Senha } from '../../services/senhaService';

interface RelatorioChamadasModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const RelatorioChamadasModal: React.FC<RelatorioChamadasModalProps> = ({ isOpen, onClose }) => {
  const [dataFiltro, setDataFiltro] = useState<string>(new Date().toISOString().split('T')[0]);
  const [userIdFiltro, setUserIdFiltro] = useState<string>('');
  const [usuarios, setUsuarios] = useState<{ id: string; full_name: string }[]>([]);
  const [chamadas, setChamadas] = useState<Senha[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      carregarUsuarios();
      buscarRelatorio();
    }
  }, [isOpen]);

  const carregarUsuarios = async () => {
    try {
      const users = await senhaService.listarUsuariosChamadas();
      setUsuarios(users);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
    }
  };

  const buscarRelatorio = async () => {
    if (!dataFiltro) return;
    
    setLoading(true);
    try {
      const data = await senhaService.listarChamadasRelatorio(dataFiltro, userIdFiltro);
      setChamadas(data);
    } catch (error) {
      console.error('Erro ao buscar relatório:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm">
      <div className="bg-background rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col max-h-[90vh] overflow-hidden border border-border animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
              <FileText size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Relatório de Chamadas</h2>
              <p className="text-sm text-muted-foreground">Histórico de senhas chamadas e concluídas</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:bg-muted rounded-xl transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Filters */}
        <div className="p-6 border-b border-border bg-card flex flex-col sm:flex-row items-end gap-4">
          <div className="w-full sm:w-auto">
            <label className="block text-sm font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
              <Calendar size={16} /> Data
            </label>
            <input
              type="date"
              value={dataFiltro}
              onChange={(e) => setDataFiltro(e.target.value)}
              className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-foreground focus:ring-2 focus:ring-primary outline-none"
            />
          </div>
          <div className="w-full sm:w-64">
            <label className="block text-sm font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
              <User size={16} /> Atendente
            </label>
            <select
              value={userIdFiltro}
              onChange={(e) => setUserIdFiltro(e.target.value)}
              className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-foreground focus:ring-2 focus:ring-primary outline-none"
            >
              <option value="">Todos os atendentes</option>
              {usuarios.map(u => (
                <option key={u.id} value={u.id}>{u.full_name}</option>
              ))}
            </select>
          </div>
          <button
            onClick={buscarRelatorio}
            disabled={loading}
            className="w-full sm:w-auto px-6 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            ) : (
              <><Search size={18} /> Filtrar</>
            )}
          </button>
        </div>

        {/* Grid / Table */}
        <div className="flex-1 overflow-auto bg-muted/10 p-6">
          {chamadas.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <Search className="text-muted-foreground" size={32} />
              </div>
              <h3 className="text-lg font-bold text-foreground">Nenhuma chamada encontrada</h3>
              <p className="text-muted-foreground mt-1">Ajuste os filtros de data e atendente para buscar.</p>
            </div>
          ) : (
            <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border">
                      <th className="p-4 font-bold text-sm text-foreground">Senha</th>
                      <th className="p-4 font-bold text-sm text-foreground">Guichê</th>
                      <th className="p-4 font-bold text-sm text-foreground">Status</th>
                      <th className="p-4 font-bold text-sm text-foreground">Atendente</th>
                      <th className="p-4 font-bold text-sm text-foreground">Horário que Chamou</th>
                      <th className="p-4 font-bold text-sm text-foreground">Horário que Atendeu</th>
                      <th className="p-4 font-bold text-sm text-foreground">Tempo de Atendimento</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {chamadas.map((senha) => {
                      const calledAt = senha.called_at ? new Date(senha.called_at) : null;
                      const completedAt = senha.completed_at ? new Date(senha.completed_at) : null;
                      let duration = '-';
                      
                      if (calledAt && completedAt) {
                        const diffMs = completedAt.getTime() - calledAt.getTime();
                        const diffMins = Math.floor(diffMs / 60000);
                        const diffSecs = Math.floor((diffMs % 60000) / 1000);
                        duration = `${diffMins}m ${diffSecs}s`;
                      }

                      return (
                        <tr key={senha.id} className="hover:bg-muted/30 transition-colors">
                          <td className="p-4">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold border ${
                              senha.tipo === 'preferencial' 
                                ? 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30'
                                : 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30'
                            }`}>
                              {senha.codigo}
                            </span>
                          </td>
                          <td className="p-4 font-medium text-foreground">{senha.guiche || '-'}</td>
                          <td className="p-4">
                            {senha.status === 'atendido' ? (
                              <span className="text-emerald-600 dark:text-emerald-400 font-bold text-sm">Atendido</span>
                            ) : senha.status === 'chamando' ? (
                              <span className="text-blue-600 dark:text-blue-400 font-bold text-sm">Chamando</span>
                            ) : (
                              <span className="text-muted-foreground font-medium text-sm capitalize">{senha.status}</span>
                            )}
                          </td>
                          <td className="p-4 font-medium text-foreground text-sm">
                            {senha.profiles?.full_name ? senha.profiles.full_name.split(' ')[0] : '-'}
                          </td>
                          <td className="p-4 text-sm text-muted-foreground">
                            {calledAt ? calledAt.toLocaleTimeString() : '-'}
                          </td>
                          <td className="p-4 text-sm text-muted-foreground">
                            {completedAt ? completedAt.toLocaleTimeString() : '-'}
                          </td>
                          <td className="p-4 font-medium text-foreground text-sm">
                            {duration}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="p-4 border-t border-border bg-muted/30 flex justify-between items-center text-sm">
                <span className="text-muted-foreground font-medium">Total de registros: {chamadas.length}</span>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default RelatorioChamadasModal;
