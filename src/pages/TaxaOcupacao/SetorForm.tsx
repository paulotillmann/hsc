import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Plus, Trash2, Edit2, Loader2, Network, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface SetorFormData {
  ativo: boolean;
  calcular_taxa: string;
  leitos_tipo: string;
  nome_setor: string;
  nome_identificacao: string;
  total_leitos: number | '';
  total_leitos_sus: number | '';
}

interface LeitoData {
  id: string;
  nome_leito: string;
  nome_identificacao: string;
  padrao: boolean;
  qtd_leitos: number;
  qtd_leitos_sus: number;
}

interface Profile {
  id: string;
  full_name: string;
  email: string;
}

export default function SetorForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = !!id;

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<SetorFormData>({
    ativo: true,
    calcular_taxa: 'Geral',
    leitos_tipo: 'Ambos',
    nome_setor: '',
    nome_identificacao: '',
    total_leitos: 0,
    total_leitos_sus: 0,
  });

  const [usuarios, setUsuarios] = useState<Profile[]>([]);
  const [selectedUsuarios, setSelectedUsuarios] = useState<string[]>([]);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Leitos State
  const [leitos, setLeitos] = useState<LeitoData[]>([]);
  const [showLeitoForm, setShowLeitoForm] = useState(false);
  const [leitoFormLoading, setLeitoFormLoading] = useState(false);
  const [currentLeito, setCurrentLeito] = useState<Partial<LeitoData>>({
    nome_leito: '',
    nome_identificacao: '',
    padrao: false,
    qtd_leitos: 0,
    qtd_leitos_sus: 0
  });

  useEffect(() => {
    fetchProfiles();
    if (isEditing) {
      fetchSetor();
      fetchLeitos();
      fetchSetorUsuarios();
    }
  }, [id]);

  const fetchProfiles = async () => {
    const { data, error } = await supabase.from('profiles').select('id, full_name, email').order('full_name');
    if (data && !error) {
      setUsuarios(data);
    }
  };

  const fetchSetorUsuarios = async () => {
    const { data, error } = await supabase.from('taxa_setores_usuarios').select('usuario_id').eq('setor_id', id);
    if (data && !error) {
      setSelectedUsuarios(data.map(d => d.usuario_id));
    }
  };

  const fetchSetor = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('taxa_setores').select('*').eq('id', id).single();
    if (data && !error) {
      setFormData({
        ativo: data.ativo,
        calcular_taxa: data.calcular_taxa,
        leitos_tipo: data.leitos_tipo,
        nome_setor: data.nome_setor || '',
        nome_identificacao: data.nome_identificacao || '',
        total_leitos: data.total_leitos,
        total_leitos_sus: data.total_leitos_sus,
      });
    }
    setLoading(false);
  };

  const filteredUsuarios = usuarios.filter(user => 
    user.full_name?.toLowerCase().includes(userSearchTerm.toLowerCase()) || 
    user.email?.toLowerCase().includes(userSearchTerm.toLowerCase())
  );

  const fetchLeitos = async () => {
    const { data, error } = await supabase
      .from('taxa_leitos')
      .select('*')
      .eq('setor_id', id)
      .order('padrao', { ascending: false })
      .order('created_at', { ascending: true });
      
    if (data && !error) {
      setLeitos(data);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
    } else if (type === 'number') {
      setFormData(prev => ({ ...prev, [name]: value === '' ? '' : parseInt(value, 10) }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleLeitoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox') {
      setCurrentLeito(prev => ({ ...prev, [name]: checked }));
    } else if (type === 'number') {
      setCurrentLeito(prev => ({ ...prev, [name]: value === '' ? 0 : parseInt(value, 10) }));
    } else {
      setCurrentLeito(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const payload = {
      ...formData,
      total_leitos: formData.total_leitos || 0,
      total_leitos_sus: formData.total_leitos_sus || 0,
    };

    if (isEditing) {
      await supabase.from('taxa_setores').update(payload).eq('id', id);
      
      // Atualiza usuários com acesso
      await supabase.from('taxa_setores_usuarios').delete().eq('setor_id', id);
      if (selectedUsuarios.length > 0) {
        const userPayload = selectedUsuarios.map(uid => ({ setor_id: id, usuario_id: uid }));
        await supabase.from('taxa_setores_usuarios').insert(userPayload);
      }
      
      setSuccessMessage('Setor atualizado com sucesso!');
      setTimeout(() => setSuccessMessage(''), 4000);
    } else {
      const { data, error } = await supabase.from('taxa_setores').insert(payload).select().single();
      if (data && !error) {
        // Insere usuários com acesso para o novo setor
        if (selectedUsuarios.length > 0) {
          const userPayload = selectedUsuarios.map(uid => ({ setor_id: data.id, usuario_id: uid }));
          await supabase.from('taxa_setores_usuarios').insert(userPayload);
        }
        
        setSuccessMessage('Setor criado com sucesso!');
        setTimeout(() => setSuccessMessage(''), 4000);
        navigate(`/taxa-ocupacao/cadastro-setor-leitos/editar/${data.id}`, { replace: true });
      }
    }
    setLoading(false);
  };

  const handleSaveLeito = async () => {
    if (!currentLeito.nome_leito || currentLeito.qtd_leitos === '' || currentLeito.qtd_leitos_sus === '') {
      alert("Por favor, preencha todos os campos obrigatórios do leito.");
      return;
    }
    
    setLeitoFormLoading(true);
    const payload = {
      ...currentLeito,
      setor_id: id,
    };

    if (currentLeito.id) {
      await supabase.from('taxa_leitos').update(payload).eq('id', currentLeito.id);
    } else {
      await supabase.from('taxa_leitos').insert(payload);
    }
    
    await fetchLeitos();
    setShowLeitoForm(false);
    setLeitoFormLoading(false);
    setCurrentLeito({
      nome_leito: '',
      nome_identificacao: '',
      padrao: false,
      qtd_leitos: 0,
      qtd_leitos_sus: 0
    });
  };

  const handleEditLeito = (leito: LeitoData) => {
    setCurrentLeito(leito);
    setShowLeitoForm(true);
  };

  const handleDeleteLeito = async (leitoId: string) => {
    if (window.confirm('Excluir este leito?')) {
      await supabase.from('taxa_leitos').delete().eq('id', leitoId);
      fetchLeitos();
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 md:p-8 animate-in fade-in zoom-in duration-500">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/taxa-ocupacao/cadastro-setor-leitos')}
            className="p-2 hover:bg-muted rounded-full transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-3">
              {isEditing ? 'Editar Setor' : 'Novo Setor'}
            </h1>
            <p className="text-muted-foreground text-sm">
              Preencha os dados do setor para o controle de ocupação.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Formulário do Setor (Mestre) */}
        <div className="bg-card border rounded-lg shadow-sm p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className="flex items-center justify-between border-b pb-4 mb-2">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Network className="h-5 w-5 text-primary" />
                Dados Principais
              </h2>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-muted-foreground cursor-pointer select-none">Setor Ativo?</label>
                <div className="relative inline-block w-12 mr-2 align-middle select-none transition duration-200 ease-in">
                  <input 
                    type="checkbox" 
                    name="ativo"
                    id="toggle-ativo" 
                    checked={formData.ativo}
                    onChange={handleChange}
                    className="peer toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 border-muted appearance-none cursor-pointer transition-transform duration-200 ease-in-out checked:translate-x-6 checked:border-red-600"
                  />
                  <label htmlFor="toggle-ativo" className="toggle-label block overflow-hidden h-6 rounded-full bg-muted cursor-pointer transition-colors duration-200 ease-in-out peer-checked:bg-red-600"></label>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold">Nome do Setor <span className="text-red-500">*</span></label>
                <input
                  required
                  name="nome_setor"
                  value={formData.nome_setor}
                  onChange={handleChange}
                  className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm bg-background"
                  placeholder="Ex: UTI Adulto"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold">Nome de Identificação (Opcional)</label>
                <input
                  name="nome_identificacao"
                  value={formData.nome_identificacao}
                  onChange={handleChange}
                  className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm bg-background"
                  placeholder="Nome abreviado ou de sistema"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold">Calcular Taxa <span className="text-red-500">*</span></label>
                <select
                  required
                  name="calcular_taxa"
                  value={formData.calcular_taxa}
                  onChange={handleChange}
                  className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm bg-background"
                >
                  <option value="Geral">Geral</option>
                  <option value="SUS">SUS</option>
                  <option value="Ambos">Ambos</option>
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold">Tipo de Leitos <span className="text-red-500">*</span></label>
                <select
                  required
                  name="leitos_tipo"
                  value={formData.leitos_tipo}
                  onChange={handleChange}
                  className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm bg-background"
                >
                  <option value="SUS">SUS</option>
                  <option value="Particular ou convênio">Particular ou convênio</option>
                  <option value="Ambos">Ambos</option>
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold">Total de Leitos <span className="text-red-500">*</span></label>
                <input
                  required
                  type="number"
                  min="0"
                  name="total_leitos"
                  value={formData.total_leitos}
                  onChange={handleChange}
                  className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm bg-background"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold">Total de Leitos SUS <span className="text-red-500">*</span></label>
                <input
                  required
                  type="number"
                  min="0"
                  name="total_leitos_sus"
                  value={formData.total_leitos_sus}
                  onChange={handleChange}
                  className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm bg-background"
                />
              </div>

              <div className="flex flex-col gap-2 md:col-span-2 mt-2">
                <label className="text-sm font-semibold">Acesso de Usuários</label>
                <p className="text-xs text-muted-foreground mb-1">Selecione os usuários que terão acesso a este setor:</p>
                
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Buscar usuário por nome ou e-mail..."
                    value={userSearchTerm}
                    onChange={(e) => setUserSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm bg-background"
                  />
                </div>

                <div className="border rounded-md p-3 max-h-48 overflow-y-auto bg-background flex flex-col gap-2">
                  {filteredUsuarios.map(user => (
                    <div key={user.id} className="flex items-center gap-2 hover:bg-muted/50 p-1 rounded-sm transition-colors">
                      <input 
                        type="checkbox" 
                        id={`user-${user.id}`}
                        checked={selectedUsuarios.includes(user.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedUsuarios(prev => [...prev, user.id]);
                          } else {
                            setSelectedUsuarios(prev => prev.filter(id => id !== user.id));
                          }
                        }}
                        className="h-4 w-4 rounded border-gray-300 accent-red-600 text-red-600 focus:ring-red-500 cursor-pointer"
                      />
                      <label htmlFor={`user-${user.id}`} className="text-sm cursor-pointer select-none flex-1">
                        {user.full_name} <span className="text-muted-foreground text-xs ml-1">({user.email})</span>
                      </label>
                    </div>
                  ))}
                  {filteredUsuarios.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-2">Nenhum usuário encontrado.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 mt-4 pt-4 border-t">
              {successMessage && (
                <div className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 p-3 rounded-md border border-green-200 dark:border-green-900 text-sm flex items-center justify-between animate-in fade-in slide-in-from-bottom-2">
                  <span>{successMessage}</span>
                  <button type="button" onClick={() => setSuccessMessage('')} className="text-green-700 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300 font-bold px-2">×</button>
                </div>
              )}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/taxa-ocupacao/cadastro-setor-leitos')}
                  className="px-4 py-2 border border-border text-foreground rounded-md hover:bg-muted font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md font-medium transition-colors disabled:opacity-50"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Salvar Setor
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Formulário/Grid de Leitos (Detalhe) */}
        {isEditing && (
          <div className="bg-card border rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between border-b pb-4 mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Network className="h-5 w-5 text-primary" />
                Leitos do Setor
              </h2>
              <button
                type="button"
                onClick={() => {
                  setCurrentLeito({ nome_leito: '', nome_identificacao: '', padrao: false, qtd_leitos: 0, qtd_leitos_sus: 0 });
                  setShowLeitoForm(!showLeitoForm);
                }}
                className="flex items-center gap-2 text-sm bg-secondary text-secondary-foreground hover:bg-secondary/80 px-3 py-1.5 rounded-md font-medium transition-colors"
              >
                {showLeitoForm ? 'Cancelar' : <><Plus className="h-4 w-4" /> Adicionar Leito</>}
              </button>
            </div>

            {/* In-line Leito Form */}
            {showLeitoForm && (
              <div className="bg-muted/30 p-4 rounded-md border mb-6 grid grid-cols-1 md:grid-cols-5 gap-4 items-end animate-in fade-in slide-in-from-top-4">
                <div className="flex flex-col gap-2 md:col-span-2">
                  <label className="text-sm font-semibold">Nome do Leito <span className="text-red-500">*</span></label>
                  <input
                    name="nome_leito"
                    value={currentLeito.nome_leito}
                    onChange={handleLeitoChange}
                    className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm bg-background"
                    placeholder="Ex: Leito 01"
                  />
                </div>
                <div className="flex flex-col gap-2 md:col-span-2">
                  <label className="text-sm font-semibold">Identificação</label>
                  <input
                    name="nome_identificacao"
                    value={currentLeito.nome_identificacao}
                    onChange={handleLeitoChange}
                    className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm bg-background"
                    placeholder="Ex: L01"
                  />
                </div>
                <div className="flex items-center gap-2 pb-2">
                  <input
                    type="checkbox"
                    id="leito-padrao"
                    name="padrao"
                    checked={currentLeito.padrao}
                    onChange={handleLeitoChange}
                    className="h-4 w-4 rounded border-gray-300 accent-red-600 text-red-600 focus:ring-red-500"
                  />
                  <label htmlFor="leito-padrao" className="text-sm font-semibold cursor-pointer">Padrão</label>
                </div>
                <div className="flex flex-col gap-2 md:col-span-2">
                  <label className="text-sm font-semibold">Qtd Leitos <span className="text-red-500">*</span></label>
                  <input
                    required
                    type="number"
                    min="0"
                    name="qtd_leitos"
                    value={currentLeito.qtd_leitos}
                    onChange={handleLeitoChange}
                    className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm bg-background"
                  />
                </div>
                <div className="flex flex-col gap-2 md:col-span-2">
                  <label className="text-sm font-semibold">Qtd Leitos SUS <span className="text-red-500">*</span></label>
                  <input
                    required
                    type="number"
                    min="0"
                    name="qtd_leitos_sus"
                    value={currentLeito.qtd_leitos_sus}
                    onChange={handleLeitoChange}
                    className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm bg-background"
                  />
                </div>
                <div className="flex justify-end gap-2 md:col-span-1">
                  <button
                    onClick={handleSaveLeito}
                    disabled={leitoFormLoading}
                    className="w-full flex justify-center items-center gap-1 bg-primary text-primary-foreground hover:bg-primary/90 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    {leitoFormLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
                  </button>
                </div>
              </div>
            )}

            {/* Tabela de Leitos */}
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Nome</th>
                    <th className="px-4 py-3 font-semibold">Identificação</th>
                    <th className="px-4 py-3 font-semibold text-center">Padrão</th>
                    <th className="px-4 py-3 font-semibold text-center">Qtd</th>
                    <th className="px-4 py-3 font-semibold text-center">Qtd SUS</th>
                    <th className="px-4 py-3 font-semibold text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {leitos.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                        Nenhum leito cadastrado neste setor.
                      </td>
                    </tr>
                  ) : (
                    leitos.map((leito) => (
                      <tr key={leito.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium text-foreground">{leito.nome_leito}</td>
                        <td className="px-4 py-3 text-muted-foreground">{leito.nome_identificacao || '-'}</td>
                        <td className="px-4 py-3 text-center">
                          {leito.padrao ? <span className="text-green-600 font-bold">Sim</span> : 'Não'}
                        </td>
                        <td className="px-4 py-3 text-center font-semibold">{leito.qtd_leitos}</td>
                        <td className="px-4 py-3 text-center font-semibold">{leito.qtd_leitos_sus}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleEditLeito(leito)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md"
                              title="Editar Leito"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteLeito(leito.id)}
                              className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md"
                              title="Excluir Leito"
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
          </div>
        )}
      </div>
    </div>
  );
}
