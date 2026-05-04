import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Network, Plus, Search, Loader2, Edit, Trash2, Database } from 'lucide-react';
import { supabase } from '../../lib/supabase';
interface Setor {
  id: string;
  nome_setor: string;
  nome_identificacao: string;
  ativo: boolean;
  total_leitos: number;
  leitos_tipo: string | null;
}

export default function CadastroSetorLeitos() {
  const navigate = useNavigate();
  const [setores, setSetores] = useState<Setor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchSetores();
  }, []);

  const fetchSetores = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('taxa_setores')
      .select('id, nome_setor, nome_identificacao, ativo, total_leitos, leitos_tipo')
      .order('nome_setor', { ascending: true });

    if (!error && data) {
      setSetores(data);
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este setor? Todos os leitos vinculados também serão excluídos.')) {
      await supabase.from('taxa_setores').delete().eq('id', id);
      fetchSetores();
    }
  };

  const filteredSetores = setores.filter(s => 
    s.nome_setor.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (s.nome_identificacao && s.nome_identificacao.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 md:p-8 animate-in fade-in zoom-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl">
              <Network className="h-6 w-6 text-primary" />
            </div>
            Setores e Leitos
          </h1>
          <p className="text-muted-foreground">
            Gerenciamento da estrutura de setores e mapeamento de leitos do hospital.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={() => navigate('/taxa-ocupacao/cadastro-setor-leitos/novo')}
            className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md font-medium transition-colors shadow-sm"
          >
            <Plus className="h-5 w-5" />
            Novo Setor
          </button>
        </div>
      </div>

      <div className="bg-card border rounded-lg shadow-sm flex flex-col flex-1 overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b flex flex-col md:flex-row gap-4 justify-between bg-muted/20">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar setor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm bg-background"
            />
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full min-h-[400px]">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredSetores.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-muted-foreground gap-2">
              <Network className="h-12 w-12 opacity-20" />
              <p>Nenhum setor encontrado.</p>
            </div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-3 font-semibold">Nome do Setor</th>
                  <th className="px-6 py-3 font-semibold">Identificação</th>
                  <th className="px-6 py-3 font-semibold text-center">Total Leitos</th>
                  <th className="px-6 py-3 font-semibold text-center">Status</th>
                  <th className="px-6 py-3 font-semibold text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredSetores.map((setor) => (
                  <tr key={setor.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4 font-medium text-foreground">
                      <div className="flex flex-col gap-1">
                        <span>{setor.nome_setor}</span>
                        {setor.leitos_tipo && (
                          <span className="inline-flex w-fit px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 uppercase tracking-wider">
                            {setor.leitos_tipo}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {setor.nome_identificacao || '-'}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center justify-center font-bold px-2.5 py-0.5 rounded-full text-xs ${
                        setor.ativo 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
                          : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        {setor.total_leitos}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        setor.ativo 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
                          : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        {setor.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => navigate(`/taxa-ocupacao/cadastro-setor-leitos/editar/${setor.id}`)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
                          title="Editar Setor"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(setor.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                          title="Excluir Setor"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
