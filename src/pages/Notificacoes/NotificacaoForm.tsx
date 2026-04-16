import React, { useState, useRef, useEffect as useEffectHook } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Search, Loader2, X, CheckCircle2, AlertCircle, ChevronDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getNotificacaoById, getTodasOcupacoes, getTodosResultados } from '../../services/notificacaoService';

interface DoencaItem {
  DS_DOENCA_COMPULSORIA: string;
  CD_DOENCA_CID: string | null;
}

interface SetorItem {
  CD_SETOR_ATENDIMENTO: number;
  DS_SETOR_ATENDIMENTO: string;
}

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

  // Toast
  type ToastAction = { type: 'success' | 'error'; message: string };
  const [toast, setToast] = useState<ToastAction | null>(null);

  const showToast = (type: 'success' | 'error', message: string, onComplete?: () => void) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast(null);
      if (onComplete) onComplete();
    }, 2000);
  };

  // Campos do formulário
  const [paciente, setPaciente] = useState('');
  const [idade, setIdade] = useState('');
  const [sexo, setSexo] = useState('');
  const [corRaca, setCorRaca] = useState('');
  const [escolaridade, setEscolaridade] = useState('');
  const [endereco, setEndereco] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
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

  // Dropdowns dinâmicos do banco
  const [ocupacoesList, setOcupacoesList] = useState<string[]>([]);
  const [resultadosList, setResultadosList] = useState<string[]>([]);

  // Doenças da API n8n
  const [doencasList, setDoencasList] = useState<DoencaItem[]>([]);
  const [doencasLoading, setDoencasLoading] = useState(false);
  const [doencaSearch, setDoencaSearch] = useState('');
  const [doencaDropdownOpen, setDoencaDropdownOpen] = useState(false);
  const doencaRef = useRef<HTMLDivElement>(null);

  // Setores da API n8n
  const [setoresList, setSetoresList] = useState<SetorItem[]>([]);
  const [setoresLoading, setSetoresLoading] = useState(false);
  const [setorSearch, setSetorSearch] = useState('');
  const [setorDropdownOpen, setSetorDropdownOpen] = useState(false);
  const setorRef = useRef<HTMLDivElement>(null);

  // Modal de Busca
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchName, setSearchName] = useState('');

  // Fecha os dropdowns ao clicar fora
  useEffectHook(() => {
    const handler = (e: MouseEvent) => {
      if (doencaRef.current && !doencaRef.current.contains(e.target as Node)) {
        setDoencaDropdownOpen(false);
      }
      if (setorRef.current && !setorRef.current.contains(e.target as Node)) {
        setSetorDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  React.useEffect(() => {
    async function loadDropdowns() {
      const [ocupData, resData] = await Promise.all([
        getTodasOcupacoes(),
        getTodosResultados()
      ]);
      setOcupacoesList(ocupData);
      setResultadosList(resData);
    }
    loadDropdowns();
    loadDoencas();
    loadSetores();

    if (id) {
      loadNotification(id);
    }
  }, [id]);

  const loadDoencas = async () => {
    setDoencasLoading(true);
    try {
      const resp = await fetch('https://n8n.technocode.site/webhook/consulta_doencas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!resp.ok) throw new Error('Falha ao carregar doenças.');
      const data: DoencaItem[] = await resp.json();
      // Ordena alfabeticamente
      data.sort((a, b) => a.DS_DOENCA_COMPULSORIA.localeCompare(b.DS_DOENCA_COMPULSORIA, 'pt-BR'));
      setDoencasList(data);
    } catch (err) {
      console.error('Erro ao carregar doenças:', err);
    } finally {
      setDoencasLoading(false);
    }
  };

  const loadSetores = async () => {
    setSetoresLoading(true);
    try {
      const resp = await fetch('https://n8n.technocode.site/webhook/consulta_setores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!resp.ok) throw new Error('Falha ao carregar setores.');
      const data: SetorItem[] = await resp.json();
      data.sort((a, b) => a.DS_SETOR_ATENDIMENTO.localeCompare(b.DS_SETOR_ATENDIMENTO, 'pt-BR'));
      setSetoresList(data);
    } catch (err) {
      console.error('Erro ao carregar setores:', err);
    } finally {
      setSetoresLoading(false);
    }
  };

  const loadNotification = async (notificacaoId: string) => {
    setIsLoadingForm(true);
    try {
      const data = await getNotificacaoById(notificacaoId);
      if (data) {
        setPaciente(data.Paciente || '');
        setIdade(data.IdadePaciente || '');
        setDataNascimento(data.DataNascimento ? data.DataNascimento.substring(0, 10) : '');
        setSexo((data.SexoPaciente || '').toUpperCase());
        setCorRaca(data.CorRacaPaciente || '');
        setEndereco(data.Endereco || '');
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
      showToast('error', 'Erro ao carregar notificação para edição.');
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
      
      let data;
      try {
        data = await resp.json();
      } catch (jsonErr) {
        // Se a API retornar vazio ou falhar no JSON (ex: webhook encerrou sem corpo)
        setSearchError('Nenhum paciente encontrado com este nome.');
        setIsSearching(false);
        return;
      }

      if (!data || !Array.isArray(data)) {
        setSearchError('Nenhum paciente encontrado com este nome.');
      } else {
        setSearchResults(data);
        if (data.length === 0) setSearchError('Nenhum paciente encontrado com este nome.');
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
    // N8N return DT_NASCIMENTO inside p. If unavailable, it'll remain early.
    if (p.DT_NASCIMENTO) {
      setDataNascimento(p.DT_NASCIMENTO.substring(0, 10));
    } else {
      setDataNascimento('');
    }
    setSexo(p.DS_SEXO || '');
    setEscolaridade(p.ESCOLARIDADE || '');
    setCorRaca(p.COR || '');
    setEndereco(p.DS_ENDERECO || '');
    setSearchResults([]);  
    setIsModalOpen(false);
  };

  const handleCancel = () => {
    setPaciente('');
    setIdade('');
    setDataNascimento('');
    setSexo('');
    setCorRaca('');
    setEscolaridade('');
    setEndereco('');
    setOcupacao('');
    setDataSintoma('');
    setDoencaAgravo('');
    setSetor('');
    setResultado('');
    setSaida('');
    window.scrollTo(0, 0);
    navigate('/notificacoes');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const payload = {
        Paciente: paciente?.toUpperCase(),
        IdadePaciente: idade?.toUpperCase(),
        DataNascimento: dataNascimento || null,
        SexoPaciente: sexo?.toUpperCase(),
        CorRacaPaciente: corRaca?.toUpperCase(),
        EscolaridadePaciente: escolaridade?.toUpperCase(),
        OcupacaoPaciente: ocupacao?.toUpperCase(),
        Endereco: endereco?.toUpperCase(),
        DataSintoma: dataSintoma ? new Date(dataSintoma).toISOString() : null,
        DoencaAgravo: doencaAgravo,
        Resultado: resultado?.toUpperCase(),
        Saida: saida?.toUpperCase(),
        Setor: setor?.toUpperCase()
      };

      if (id) {
        // Atualiza
        const { error } = await supabase.from('notificacao').update({
          ...payload,
          DataNotificacao: new Date().toISOString()
        }).eq('id', id);
        if (error) throw error;
        showToast('success', 'Notificação atualizada com sucesso!', () => navigate('/notificacoes'));
      } else {
        // Insere
        const fakeBubbleId = `manual_${Date.now()}`;
        const { error } = await supabase.from('notificacao').insert([{
          ...payload,
          bubble_id: fakeBubbleId,
          DataNotificacao: new Date().toISOString()
        }]);
        if (error) throw error;
        showToast('success', 'Notificação salva com sucesso!', () => navigate('/notificacoes'));
      }
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Erro ao salvar: ' + (err.message || 'Falha desconhecida.'));
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
                <label className="block text-sm font-medium mb-1">Data Nascimento</label>
                <input
                  type="date"
                  className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={dataNascimento}
                  onChange={(e) => setDataNascimento(e.target.value)}
                />
              </div>
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
                  <option className="bg-background text-foreground" value="MASCULINO">Masculino</option>
                  <option className="bg-background text-foreground" value="FEMININO">Feminino</option>
                  <option className="bg-background text-foreground" value="IGNORADO">Ignorado</option>
                </select>
              </div>
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
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Escolaridade</label>
                <input
                  type="text"
                  placeholder="Escolaridade do paciente"
                  className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={escolaridade}
                  onChange={(e) => setEscolaridade(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Ocupação</label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={ocupacao}
                  onChange={(e) => setOcupacao(e.target.value)}
                >
                  <option className="bg-background text-foreground" value="">Selecione...</option>
                  {ocupacoesList.map((oc) => (
                    <option key={oc} className="bg-background text-foreground" value={oc}>{oc}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Endereço</label>
              <input
                type="text"
                placeholder="Endereço completo do paciente"
                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={endereco}
                onChange={(e) => setEndereco(e.target.value)}
              />
            </div>

          </div>
        </div>

        {/* Bloco Doença */}
        <div className="bg-card text-card-foreground rounded-xl border border-border shadow-sm overflow-visible">
          <div className="border-b border-border bg-muted/20 px-6 py-4 rounded-t-xl">
            <h2 className="text-lg font-semibold">Dados da Notificação</h2>
          </div>
          <div className="p-6 space-y-6">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div ref={doencaRef} className="relative">
                <label className="block text-sm font-medium mb-1">Agravo / Doença</label>
                {/* Combobox pesquisável */}
                <div
                  className={`flex h-10 w-full rounded-md border bg-transparent text-sm cursor-pointer items-center justify-between px-3 transition-all ${
                    doencaDropdownOpen ? 'border-ring ring-2 ring-ring' : 'border-input'
                  }`}
                  onClick={() => {
                    setDoencaDropdownOpen(prev => !prev);
                    setDoencaSearch('');
                  }}
                >
                  <span className={doencaAgravo ? 'text-foreground' : 'text-muted-foreground'}>
                    {doencaAgravo || (doencasLoading ? 'Carregando doenças...' : 'Selecione ou pesquise...')}
                  </span>
                  {doencasLoading
                    ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    : <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${doencaDropdownOpen ? 'rotate-180' : ''}`} />
                  }
                </div>

                <AnimatePresence>
                  {doencaDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15 }}
                      className="absolute z-50 mt-1 w-full bg-card border border-border rounded-md shadow-xl overflow-hidden"
                    >
                      {/* Campo de pesquisa */}
                      <div className="p-2 border-b border-border">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                          <input
                            autoFocus
                            type="text"
                            placeholder="Pesquisar doença..."
                            className="w-full pl-8 pr-3 py-1.5 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                            value={doencaSearch}
                            onChange={e => setDoencaSearch(e.target.value)}
                            onClick={e => e.stopPropagation()}
                          />
                        </div>
                      </div>

                      {/* Lista filtrada */}
                      <div className="max-h-60 overflow-y-auto">
                        {/* Opção limpar */}
                        <button
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm text-muted-foreground hover:bg-muted/60 transition-colors"
                          onClick={() => { setDoencaAgravo(''); setDoencaDropdownOpen(false); }}
                        >
                          — Nenhum / Limpar —
                        </button>

                        {doencasList
                          .filter(d =>
                            d.DS_DOENCA_COMPULSORIA.toLowerCase().includes(doencaSearch.toLowerCase()) ||
                            (d.CD_DOENCA_CID || '').toLowerCase().includes(doencaSearch.toLowerCase())
                          )
                          .map((d, i) => (
                            <button
                              key={i}
                              type="button"
                              className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/60 transition-colors flex items-center justify-between gap-2 ${
                                doencaAgravo === d.DS_DOENCA_COMPULSORIA ? 'bg-primary/10 text-primary font-medium' : 'text-foreground'
                              }`}
                              onClick={() => {
                                setDoencaAgravo(d.DS_DOENCA_COMPULSORIA);
                                setDoencaDropdownOpen(false);
                                setDoencaSearch('');
                              }}
                            >
                              <span>{d.DS_DOENCA_COMPULSORIA}</span>
                              {d.CD_DOENCA_CID && (
                                <span className="text-xs text-muted-foreground font-mono shrink-0">{d.CD_DOENCA_CID}</span>
                              )}
                            </button>
                          ))
                        }

                        {doencasList.filter(d =>
                          d.DS_DOENCA_COMPULSORIA.toLowerCase().includes(doencaSearch.toLowerCase()) ||
                          (d.CD_DOENCA_CID || '').toLowerCase().includes(doencaSearch.toLowerCase())
                        ).length === 0 && (
                          <p className="px-3 py-4 text-sm text-center text-muted-foreground">Nenhuma doença encontrada.</p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div ref={setorRef} className="relative">
                <label className="block text-sm font-medium mb-1">Setor</label>
                {/* Combobox pesquisável */}
                <div
                  className={`flex h-10 w-full rounded-md border bg-transparent text-sm cursor-pointer items-center justify-between px-3 transition-all ${
                    setorDropdownOpen ? 'border-ring ring-2 ring-ring' : 'border-input'
                  }`}
                  onClick={() => {
                    setSetorDropdownOpen(prev => !prev);
                    setSetorSearch('');
                  }}
                >
                  <span className={setor ? 'text-foreground' : 'text-muted-foreground'}>
                    {setor || (setoresLoading ? 'Carregando setores...' : 'Selecione ou pesquise...')}
                  </span>
                  {setoresLoading
                    ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    : <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${setorDropdownOpen ? 'rotate-180' : ''}`} />
                  }
                </div>

                <AnimatePresence>
                  {setorDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15 }}
                      className="absolute z-50 mt-1 w-full bg-card border border-border rounded-md shadow-xl overflow-hidden"
                    >
                      {/* Campo de pesquisa */}
                      <div className="p-2 border-b border-border">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                          <input
                            autoFocus
                            type="text"
                            placeholder="Pesquisar setor..."
                            className="w-full pl-8 pr-3 py-1.5 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                            value={setorSearch}
                            onChange={e => setSetorSearch(e.target.value)}
                            onClick={e => e.stopPropagation()}
                          />
                        </div>
                      </div>

                      {/* Lista filtrada */}
                      <div className="max-h-60 overflow-y-auto">
                        {/* Opção limpar */}
                        <button
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm text-muted-foreground hover:bg-muted/60 transition-colors"
                          onClick={() => { setSetor(''); setSetorDropdownOpen(false); }}
                        >
                          — Nenhum / Limpar —
                        </button>

                        {setoresList
                          .filter(s =>
                            s.DS_SETOR_ATENDIMENTO.toLowerCase().includes(setorSearch.toLowerCase())
                          )
                          .map((s) => (
                            <button
                              key={s.CD_SETOR_ATENDIMENTO}
                              type="button"
                              className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/60 transition-colors flex items-center justify-between gap-2 ${
                                setor === s.DS_SETOR_ATENDIMENTO ? 'bg-primary/10 text-primary font-medium' : 'text-foreground'
                              }`}
                              onClick={() => {
                                setSetor(s.DS_SETOR_ATENDIMENTO);
                                setSetorDropdownOpen(false);
                                setSetorSearch('');
                              }}
                            >
                              <span>{s.DS_SETOR_ATENDIMENTO}</span>
                              <span className="text-xs text-muted-foreground font-mono shrink-0">{s.CD_SETOR_ATENDIMENTO}</span>
                            </button>
                          ))
                        }

                        {setoresList.filter(s =>
                          s.DS_SETOR_ATENDIMENTO.toLowerCase().includes(setorSearch.toLowerCase())
                        ).length === 0 && (
                          <p className="px-3 py-4 text-sm text-center text-muted-foreground">Nenhum setor encontrado.</p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
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
                  {resultadosList.map((res) => (
                    <option key={res} className="bg-background text-foreground" value={res}>{res}</option>
                  ))}
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
                  <option className="bg-background text-foreground" value="INTERNAÇÃO">INTERNAÇÃO</option>
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
        <div className="flex justify-end pt-4 gap-3">
          <button
            type="button"
            onClick={handleCancel}
            disabled={isSaving}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-muted hover:text-foreground h-10 px-6 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-6 disabled:opacity-50 transition-colors"
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
                <h3 className="font-semibold text-lg">Buscar Paciente</h3>
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

      {/* ── Toast ── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-lg shadow-lg border text-sm font-medium ${
              toast.type === 'success'
                ? 'bg-green-50 border-green-200 text-green-700 dark:bg-green-500/10 dark:border-green-500/20 dark:text-green-400'
                : 'bg-red-50 border-red-200 text-red-700 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-400'
            }`}
          >
            {toast.type === 'success' ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}
