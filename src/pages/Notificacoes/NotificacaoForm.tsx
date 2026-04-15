import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Search, Loader2, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getNotificacaoById } from '../../services/notificacaoService';

interface N8nPaciente {
  CD_PESSOA_FISICA: string;
  NM_PACIENTE: string;
  DT_NASCIMENTO?: string;
  DS_IDADE: string;
  DS_SEXO: string;
  ESCOLARIDADE: string;
  COR: string;
  DS_ENDERECO: string;
}

export default function NotificacaoForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  // Campos do formulário
  const [paciente, setPaciente] = useState('');
  const [idade, setIdade] = useState('');
  const [sexo, setSexo] = useState('');
  const [corRaca, setCorRaca] = useState('');
  const [escolaridade, setEscolaridade] = useState('');
  const [ocupacao, setOcupacao] = useState('');
  const [dataSintoma, setDataSintoma] = useState('');
  const [doencaAgravo, setDoencaAgravo] = useState('');
  const [setor, setSetor] = useState('');
  const [resultado, setResultado] = useState('');
  const [saida, setSaida] = useState('');

  // Estados N8N
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<N8nPaciente[]>([]);
  const [searchError, setSearchError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingForm, setIsLoadingForm] = useState(false);

  // Modal de Busca
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchName, setSearchName] = useState('');

  React.useEffect(() => {
    if (id) {
      loadNotification(id);
    }
  }, [id]);

  const loadNotification = async (notificacaoId: string) => {
    setIsLoadingForm(true);
    try {
      const data = await getNotificacaoById(notificacaoId);
      if (data) {
        setPaciente(data.Paciente || '');
        setIdade(data.IdadePaciente || '');
        setSexo(data.SexoPaciente || '');
        setCorRaca(data.CorRacaPaciente || '');
        setEscolaridade(data.EscolaridadePaciente || '');
        setOcupacao(data.OcupacaoPaciente || '');
        setDataSintoma(data.DataSintoma ? data.DataSintoma.substring(0, 10) : '');
        setDoencaAgravo(data.DoencaAgravo || '');
        setSetor(data.Setor || '');
        setResultado(data.Resultado || '');
        setSaida(data.Saida || '');
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao carregar notificação para edição.');
    } finally {
      setIsLoadingForm(false);
    }
  };

  // Busca na API webhook N8N
  const handleSearchN8n = async () => {
    if (searchName.trim().length < 3) {
      setSearchError('Digite pelo menos 3 caracteres do nome.');
      return;
    }
    setSearchError('');
    setIsSearching(true);
    setSearchResults([]);

    try {
      const resp = await fetch('https://n8n.technocode.site/webhook/consulta_pac', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome_paciente: searchName }),
      });
      if (!resp.ok) throw new Error('Falha ao comunicar com API de consulta.');
      const data = await resp.json();
      if (!data || !Array.isArray(data)) {
        setSearchError('Nenhum paciente encontrado.');
      } else {
        setSearchResults(data);
        if (data.length === 0) setSearchError('Nenhum paciente encontrado.');
      }
    } catch (err: any) {
      setSearchError(err.message || 'Erro ao buscar paciente.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectN8nPaciente = (p: N8nPaciente) => {
    setPaciente(p.NM_PACIENTE);
    setIdade(p.DS_IDADE || '');
    setSexo(p.DS_SEXO || '');
    setEscolaridade(p.ESCOLARIDADE || '');
    setCorRaca(p.COR || '');
    setSearchResults([]); 
    setIsModalOpen(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const payload = {
        Paciente: paciente,
        IdadePaciente: idade,
        SexoPaciente: sexo,
        CorRacaPaciente: corRaca,
        EscolaridadePaciente: escolaridade,
        OcupacaoPaciente: ocupacao,
        DataSintoma: dataSintoma ? new Date(dataSintoma).toISOString() : null,
        DoencaAgravo: doencaAgravo,
        Resultado: resultado,
        Saida: saida,
        Setor: setor
      };

      if (id) {
        // Atualiza
        const { error } = await supabase.from('notificacao').update({
          ...payload,
          DataNotificacao: new Date().toISOString()
        }).eq('id', id);
        if (error) throw error;
        alert('Notificação atualizada com sucesso!');
      } else {
        // Insere
        const fakeBubbleId = `manual_${Date.now()}`;
        const { error } = await supabase.from('notificacao').insert([{
          ...payload,
          bubble_id: fakeBubbleId,
          DataNotificacao: new Date().toISOString()
        }]);
        if (error) throw error;
        alert('Notificação salva com sucesso!');
      }
      
      navigate('/notificacoes');
    } catch (err: any) {
      console.error(err);
      alert('Erro ao salvar notificação: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-5xl mx-auto pb-10"
    >
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/notificacoes')}
            className="p-2 -ml-2 rounded-full hover:bg-muted text-muted-foreground transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{id ? 'Editar Notificação' : 'Nova Notificação'}</h1>
            <p className="text-sm text-muted-foreground">Preencha os dados epidemiológicos do caso.</p>
          </div>
        </div>
      </div>

      {/* FORM */}
      <form onSubmit={handleSave} className="space-y-6 relative">
        
        {isLoadingForm && (
          <div className="absolute inset-0 bg-background/50 z-10 flex items-center justify-center rounded-xl">
             <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}
        
        {/* Bloco Paciente */}
        <div className="bg-card text-card-foreground rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="border-b border-border bg-muted/20 px-6 py-4">
            <h2 className="text-lg font-semibold">Identificação do Paciente</h2>
          </div>
          <div className="p-6 space-y-6">
            
            {/* Input com Busca N8N */}
            <div>
              <label className="block text-sm font-medium mb-1">Nome Completo</label>
              <div className="flex gap-2 relative">
                <input
                  type="text"
                  required
                  placeholder="Nome do paciente"
                  className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={paciente}
                  onChange={(e) => setPaciente(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setIsModalOpen(true)}
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 h-10 px-4 whitespace-nowrap"
                >
                  <Search className="mr-2 h-4 w-4" />
                  Buscar Paciente
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Idade</label>
                <input
                  type="text"
                  placeholder="Ex: 52 Anos"
                  className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={idade}
                  onChange={(e) => setIdade(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Sexo</label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={sexo}
                  onChange={(e) => setSexo(e.target.value)}
                >
                  <option className="bg-background text-foreground" value="">Selecione...</option>
                  <option className="bg-background text-foreground" value="Masculino">Masculino</option>
                  <option className="bg-background text-foreground" value="Feminino">Feminino</option>
                  <option className="bg-background text-foreground" value="Ignorado">Ignorado</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Escolaridade</label>
                <input
                  type="text"
                  placeholder="Escolaridade do paciente"
                  className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={escolaridade}
                  onChange={(e) => setEscolaridade(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Cor / Raça</label>
                <input
                  type="text"
                  placeholder="Branca, Parda, etc."
                  className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={corRaca}
                  onChange={(e) => setCorRaca(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Ocupação</label>
                <input
                  type="text"
                  placeholder="Enfermeiro, Médico, etc."
                  className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={ocupacao}
                  onChange={(e) => setOcupacao(e.target.value)}
                />
              </div>
            </div>

          </div>
        </div>

        {/* Bloco Doença */}
        <div className="bg-card text-card-foreground rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="border-b border-border bg-muted/20 px-6 py-4">
            <h2 className="text-lg font-semibold">Dados da Notificação</h2>
          </div>
          <div className="p-6 space-y-6">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Agravo / Doença</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Arbovirose (Dengue, Zika...)"
                  className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={doencaAgravo}
                  onChange={(e) => setDoencaAgravo(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Setor</label>
                <input
                  type="text"
                  placeholder="Setor da notificação"
                  className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={setor}
                  onChange={(e) => setSetor(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Data dos 1ºs Sintomas</label>
                <input
                  type="date"
                  className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={dataSintoma}
                  onChange={(e) => setDataSintoma(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Resultado Exame</label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={resultado}
                  onChange={(e) => setResultado(e.target.value)}
                >
                  <option className="bg-background text-foreground" value="">Selecione...</option>
                  <option className="bg-background text-foreground" value="POSITIVO">POSITIVO</option>
                  <option className="bg-background text-foreground" value="NEGATIVO">NEGATIVO</option>
                  <option className="bg-background text-foreground" value="INCONCLUSIVO">INCONCLUSIVO</option>
                  <option className="bg-background text-foreground" value="AGUARDANDO RESULTADO">AGUARDANDO RESULTADO</option>
                  <option className="bg-background text-foreground" value="NÃO COLETOU">NÃO COLETOU</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Saída (Desfecho)</label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={saida}
                  onChange={(e) => setSaida(e.target.value)}
                >
                  <option className="bg-background text-foreground" value="">Selecione...</option>
                  <option className="bg-background text-foreground" value="ALTA">ALTA</option>
                  <option className="bg-background text-foreground" value="ÓBITO">ÓBITO</option>
                  <option className="bg-background text-foreground" value="TRANSFERÊNCIA">TRANSFERÊNCIA</option>
                  <option className="bg-background text-foreground" value="EVASÃO">EVASÃO</option>
                </select>
              </div>
            </div>

          </div>
        </div>

        {/* ACTIONS */}
        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-6 disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar Notificação
          </button>
        </div>

      </form>

      {/* Modal Busca N8N */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-5xl bg-card border border-border shadow-lg rounded-xl overflow-hidden flex flex-col"
              style={{ maxHeight: '90vh' }}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h3 className="font-semibold text-lg">Buscar Paciente (Integração N8N)</h3>
                <button
                  onClick={() => {
                    setIsModalOpen(false);
                    setSearchResults([]);
                    setSearchName('');
                    setSearchError('');
                  }}
                  className="p-1 rounded-md hover:bg-muted text-muted-foreground transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 flex flex-col gap-4 flex-1 overflow-hidden">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Nome do paciente..."
                    className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={searchName}
                    onChange={(e) => setSearchName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSearchN8n();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleSearchN8n}
                    disabled={isSearching}
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-6 whitespace-nowrap disabled:opacity-50"
                  >
                    {isSearching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                    Buscar
                  </button>
                </div>
                {searchError && <p className="text-sm text-destructive">{searchError}</p>}

                {/* Grid Resultados */}
                <div className="flex-1 overflow-auto border border-border rounded-md">
                  <table className="w-full text-sm text-left">
                    <thead className="sticky top-0 bg-muted text-muted-foreground shadow-sm">
                      <tr>
                        <th className="h-10 px-4 font-medium">Nome</th>
                        <th className="h-10 px-4 font-medium">Idade</th>
                        <th className="h-10 px-4 font-medium">Sexo</th>
                        <th className="h-10 px-4 font-medium">Raça/Cor</th>
                        <th className="h-10 px-4 font-medium">Endereço</th>
                      </tr>
                    </thead>
                    <tbody>
                      {searchResults.length === 0 && !isSearching && (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-muted-foreground">
                            Nenhum resultado para exibir. Realize uma busca.
                          </td>
                        </tr>
                      )}
                      {searchResults.map((p, idx) => (
                        <tr
                          key={idx}
                          onClick={() => handleSelectN8nPaciente(p)}
                          className="border-b last:border-0 border-border hover:bg-muted/50 cursor-pointer transition-colors"
                        >
                          <td className="p-3 align-middle font-medium text-foreground">{p.NM_PACIENTE}</td>
                          <td className="p-3 align-middle">{p.DS_IDADE}</td>
                          <td className="p-3 align-middle">{p.DS_SEXO}</td>
                          <td className="p-3 align-middle">{p.COR}</td>
                          <td className="p-3 align-middle text-muted-foreground truncate max-w-[200px]" title={p.DS_ENDERECO}>
                            {p.DS_ENDERECO}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}
