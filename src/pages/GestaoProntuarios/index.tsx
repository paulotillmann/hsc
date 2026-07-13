import React, { useEffect, useState } from 'react';
import { 
  FileSpreadsheet, 
  Search, 
  Eye, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  FileCheck, 
  FileText, 
  Play, 
  ArrowRight, 
  History, 
  Download, 
  AlertCircle, 
  FileUp, 
  RotateCw,
  User,
  Phone,
  FileMinus
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { VisaoGeralCard } from '../../components/recepcao/VisaoGeralCard';
import { 
  fetchSolicitacoes, 
  fetchIndicadores, 
  iniciarAnalise, 
  aprovarSolicitacao, 
  disponibilizarDocumento, 
  rejeitarSolicitacao, 
  atualizarSolicitacaoCompleta,
  fetchHistorico,
  criarSolicitacaoTeste,
  SolicitacaoProntuario, 
  HistoricoSolicitacao, 
  IndicadoresProntuario 
} from '../../services/prontuarioService';


export default function GestaoProntuarios() {
  const { profile } = useAuth();
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoProntuario[]>([]);
  const [indicadores, setIndicadores] = useState<IndicadoresProntuario>({
    pendentes: 0,
    emAnalise: 0,
    aprovadas: 0,
    rejeitadas: 0,
    disponibilizados: 0
  });

  const [loading, setLoading] = useState(true);
  const [loadingAction, setLoadingAction] = useState(false);
  const [busca, setBusca] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('Todos');

  // Estados do Modal
  const [selectedSolicitacao, setSelectedSolicitacao] = useState<SolicitacaoProntuario | null>(null);
  const [historico, setHistorico] = useState<HistoricoSolicitacao[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState<'dados' | 'historico'>('dados');

  // Estados de Ação (Aprovação / Rejeição)
  const [modoAcao, setModoAcao] = useState<'visualizar' | 'aprovar' | 'rejeitar'>('visualizar');
  const [novoStatusSelecionado, setNovoStatusSelecionado] = useState<SolicitacaoProntuario['status']>('Pendente');
  const [arquivoSelecionado, setArquivoSelecionado] = useState<File | null>(null);
  const [justificativa, setJustificativa] = useState('');
  const [erroAcao, setErroAcao] = useState('');

  // Feedbacks gerais da página
  const [notificacao, setNotificacao] = useState<{ tipo: 'sucesso' | 'erro'; mensagem: string } | null>(null);
  const [criandoTeste, setCriandoTeste] = useState(false);

  const handleCriarSolicitacaoTeste = async () => {
    setCriandoTeste(true);
    try {
      await criarSolicitacaoTeste();
      mostrarNotificacao('sucesso', 'Solicitação de teste criada com sucesso! O webhook de WhatsApp foi disparado.');
      carregarDados();
    } catch (err: any) {
      console.error(err);
      mostrarNotificacao('erro', `Erro ao criar solicitação de teste: ${err.message || err}`);
    } finally {
      setCriandoTeste(false);
    }
  };


  const carregarDados = async () => {
    setLoading(true);
    try {
      const [list, inds] = await Promise.all([
        fetchSolicitacoes(busca, statusFiltro),
        fetchIndicadores()
      ]);
      setSolicitacoes(list);
      setIndicadores(inds);
    } catch (err) {
      console.error('Erro ao carregar dados de prontuários:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, [busca, statusFiltro]);

  const mostrarNotificacao = (tipo: 'sucesso' | 'erro', mensagem: string) => {
    setNotificacao({ tipo, mensagem });
    setTimeout(() => {
      setNotificacao(null);
    }, 5000);
  };

  const handleOpenDetails = async (solicitacao: SolicitacaoProntuario) => {
    setLoadingAction(true);
    try {
      const hist = await fetchHistorico(solicitacao.id);
      setHistorico(hist);
      setSelectedSolicitacao(solicitacao);
      setNovoStatusSelecionado(solicitacao.status);
      setAbaAtiva('dados');
      setModoAcao('visualizar');
      setArquivoSelecionado(null);
      setJustificativa(solicitacao.justificativa_rejeicao || '');
      setErroAcao('');
      setIsModalOpen(true);
    } catch (err) {
      console.error('Erro ao abrir detalhes:', err);
      mostrarNotificacao('erro', 'Falha ao buscar histórico da solicitação.');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleIniciarAnalise = async (solicitacao: SolicitacaoProntuario) => {
    setLoadingAction(true);
    try {
      const userName = profile?.full_name || profile?.email || 'Gestor';
      const userId = profile?.id || null;
      await iniciarAnalise(solicitacao.id, userName, userId);
      
      mostrarNotificacao('sucesso', `Análise da solicitação #${String(solicitacao.numero_solicitacao).padStart(4, '0')} iniciada.`);
      setIsModalOpen(false);
      carregarDados();
    } catch (err) {
      console.error(err);
      mostrarNotificacao('erro', 'Erro ao iniciar análise.');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleAprovar = async () => {
    if (!selectedSolicitacao) return;
    setLoadingAction(true);
    try {
      const userName = profile?.full_name || profile?.email || 'Gestor';
      const userId = profile?.id || null;
      await aprovarSolicitacao(selectedSolicitacao.id, userName, userId);
      
      // Atualiza o estado local do modal
      const atualizada = { ...selectedSolicitacao, status: 'Aprovado' as const, responsavel_nome: userName };
      setSelectedSolicitacao(atualizada);
      
      const hist = await fetchHistorico(selectedSolicitacao.id);
      setHistorico(hist);

      setModoAcao('visualizar');
      mostrarNotificacao('sucesso', 'Solicitação aprovada com sucesso! Prossiga com o upload do PDF.');
      carregarDados();
    } catch (err) {
      console.error(err);
      setErroAcao('Erro ao aprovar solicitação.');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.type !== 'application/pdf') {
        setErroAcao('Apenas arquivos PDF são permitidos.');
        setArquivoSelecionado(null);
        return;
      }
      setArquivoSelecionado(file);
      setNovoStatusSelecionado('Documento Disponibilizado');
      setErroAcao('');
    }
  };

  const handleSalvarDisponibilizar = async () => {
    if (!selectedSolicitacao || !arquivoSelecionado) {
      setErroAcao('Por favor, anexe o arquivo PDF do prontuário.');
      return;
    }
    setLoadingAction(true);
    setErroAcao('');
    try {
      const userName = profile?.full_name || profile?.email || 'Gestor';
      const userId = profile?.id || null;
      await disponibilizarDocumento(selectedSolicitacao.id, arquivoSelecionado, userName, userId);
      
      mostrarNotificacao('sucesso', 'Documento anexado e disponibilizado para o solicitante com sucesso.');
      setIsModalOpen(false);
      carregarDados();
    } catch (err: any) {
      console.error(err);
      setErroAcao(`Falha ao realizar upload do arquivo: ${err.message || err}`);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleRejeitar = async () => {
    if (!selectedSolicitacao) return;
    if (!justificativa.trim()) {
      setErroAcao('A justificativa é obrigatória para rejeitar a solicitação.');
      return;
    }
    setLoadingAction(true);
    setErroAcao('');
    try {
      const userName = profile?.full_name || profile?.email || 'Gestor';
      const userId = profile?.id || null;
      await rejeitarSolicitacao(selectedSolicitacao.id, justificativa, userName, userId);
      
      mostrarNotificacao('sucesso', 'Solicitação rejeitada e justificativa registrada.');
      setIsModalOpen(false);
      carregarDados();
    } catch (err) {
      console.error(err);
      setErroAcao('Erro ao rejeitar a solicitação.');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleSalvarAlteracoesGestor = async () => {
    if (!selectedSolicitacao) return;

    if (novoStatusSelecionado === 'Rejeitado' && !justificativa.trim()) {
      setErroAcao('A justificativa é obrigatória para o status Rejeitado.');
      return;
    }

    if (novoStatusSelecionado === 'Documento Disponibilizado' && !arquivoSelecionado && !selectedSolicitacao.arquivo_url) {
      setErroAcao('Por favor, anexe o arquivo PDF do prontuário para disponibilizá-lo.');
      return;
    }

    setLoadingAction(true);
    setErroAcao('');

    try {
      const userName = profile?.full_name || profile?.email || 'Gestor';
      const userId = profile?.id || null;
      
      await atualizarSolicitacaoCompleta(
        selectedSolicitacao.id,
        novoStatusSelecionado,
        userName,
        userId,
        novoStatusSelecionado === 'Rejeitado' ? justificativa : undefined,
        arquivoSelecionado
      );

      mostrarNotificacao('sucesso', 'Solicitação atualizada com sucesso pelo gestor.');
      setIsModalOpen(false);
      carregarDados();
    } catch (err: any) {
      console.error(err);
      setErroAcao(`Erro ao salvar alterações: ${err.message || err}`);
    } finally {
      setLoadingAction(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const base = "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider";
    switch (status) {
      case 'Pendente':
        return `${base} bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800/40 dark:text-slate-300 dark:border-slate-700/60`;
      case 'Em Análise':
        return `${base} bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/35`;
      case 'Aprovado':
        return `${base} bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/35`;
      case 'Rejeitado':
        return `${base} bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/35`;
      case 'Documento Disponibilizado':
        return `${base} bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/35`;
      default:
        return `${base} bg-slate-100 text-slate-700`;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Pendente':
        return <Clock className="w-4 h-4 text-slate-500" />;
      case 'Em Análise':
        return <RotateCw className="w-4 h-4 text-amber-500 animate-spin-slow" />;
      case 'Aprovado':
        return <CheckCircle2 className="w-4 h-4 text-blue-500" />;
      case 'Rejeitado':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'Documento Disponibilizado':
        return <FileCheck className="w-4 h-4 text-emerald-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-8 p-6 md:p-8 animate-in fade-in duration-500 bg-background text-foreground pb-16">
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
            <div className="p-2.5 bg-red-500/10 rounded-2xl border border-red-500/20 text-[#8a1515] dark:text-[#f43f5e] shadow-[0_0_15px_rgba(138,21,21,0.1)]">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            Gestão de Prontuários
          </h1>
          <p className="text-sm text-muted-foreground">
            Receba, analise, aprove ou rejeite solicitações de prontuários com entrega digital ou controle físico.
          </p>
        </div>
        
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleCriarSolicitacaoTeste}
            disabled={criandoTeste}
            className="inline-flex items-center justify-center rounded-xl text-sm font-semibold transition-all bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 shadow-md gap-2 cursor-pointer disabled:opacity-50"
          >
            <Play className={`h-4 w-4 ${criandoTeste ? 'animate-pulse' : ''}`} />
            {criandoTeste ? 'Criando Teste...' : 'Criar Solicitação Teste'}
          </button>
          
          <button
            onClick={carregarDados}
            className="inline-flex items-center justify-center rounded-xl text-sm font-semibold transition-all border border-border bg-card hover:bg-muted text-foreground px-4 py-2.5 shadow-md gap-2 cursor-pointer"
          >
            <RotateCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar Lista
          </button>
        </div>

      </div>

      {/* FEEDBACK TOAST */}
      {notificacao && (
        <div className={`p-4 rounded-xl border flex items-center gap-3 shadow-lg animate-in slide-in-from-top-4 duration-300 ${
          notificacao.tipo === 'sucesso' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-900/35 dark:text-emerald-300' 
            : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/20 dark:border-red-900/35 dark:text-red-300'
        }`}>
          {notificacao.tipo === 'sucesso' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span className="text-sm font-medium">{notificacao.mensagem}</span>
        </div>
      )}

      {/* INDICADORES GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
        <VisaoGeralCard 
          title="Pendentes" 
          value={indicadores.pendentes} 
          icon={Clock} 
          subtext="⏳ Aguardando triagem"
          subtextColorClass="text-slate-500 dark:text-slate-400"
          isLoading={loading}
        />
        <VisaoGeralCard 
          title="Em Análise" 
          value={indicadores.emAnalise} 
          icon={RotateCw} 
          subtext="🔄 Em verificação interna"
          subtextColorClass="text-amber-600 dark:text-amber-400"
          isLoading={loading}
        />
        <VisaoGeralCard 
          title="Aprovadas" 
          value={indicadores.aprovadas} 
          icon={CheckCircle2} 
          subtext="✓ Aguardando anexo PDF"
          subtextColorClass="text-blue-600 dark:text-blue-400"
          isLoading={loading}
        />
        <VisaoGeralCard 
          title="Rejeitadas" 
          value={indicadores.rejeitadas} 
          icon={XCircle} 
          subtext="✕ Solicitações indeferidas"
          subtextColorClass="text-red-600 dark:text-red-400"
          isLoading={loading}
        />
        <VisaoGeralCard 
          title="Documentos Entregues" 
          value={indicadores.disponibilizados} 
          icon={FileCheck} 
          subtext="📂 PDFs disponibilizados"
          subtextColorClass="text-emerald-600 dark:text-emerald-400"
          isLoading={loading}
        />
      </div>

      {/* FILTROS E BUSCA */}
      <div className="bg-card p-5 rounded-2xl border border-border flex flex-col md:flex-row justify-between items-center gap-4 shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por Paciente, CPF ou Número..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 hover:border-border/80 transition-all text-sm placeholder:text-muted-foreground"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider hidden sm:inline">
            Status:
          </label>
          <select
            value={statusFiltro}
            onChange={(e) => setStatusFiltro(e.target.value)}
            className="w-full sm:w-48 bg-background border border-border rounded-xl px-3 py-2.5 text-xs text-foreground font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer hover:border-border/80 transition-all shadow-sm"
          >
            <option value="Todos">Todos os Status</option>
            <option value="Pendente">Pendentes</option>
            <option value="Em Análise">Em Análise</option>
            <option value="Aprovado">Aprovadas</option>
            <option value="Rejeitado">Rejeitadas</option>
            <option value="Documento Disponibilizado">Documentos Entregues</option>
          </select>
        </div>
      </div>

      {/* TABELA PRINCIPAL */}
      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-slate-50/50 dark:bg-slate-900/20">
                <th className="p-4.5 text-xs font-bold uppercase tracking-wider text-muted-foreground w-28">Número</th>
                <th className="p-4.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Paciente</th>
                <th className="p-4.5 text-xs font-bold uppercase tracking-wider text-muted-foreground w-36">CPF</th>
                <th className="p-4.5 text-xs font-bold uppercase tracking-wider text-muted-foreground w-32">Data Solicit.</th>
                <th className="p-4.5 text-xs font-bold uppercase tracking-wider text-muted-foreground w-28">Tipo</th>
                <th className="p-4.5 text-xs font-bold uppercase tracking-wider text-muted-foreground w-56">Status</th>
                <th className="p-4.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Analista</th>
                <th className="p-4.5 text-xs font-bold uppercase tracking-wider text-muted-foreground text-right w-36">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="p-4.5"><div className="h-4 bg-muted rounded w-16" /></td>
                    <td className="p-4.5"><div className="h-4 bg-muted rounded w-48" /></td>
                    <td className="p-4.5"><div className="h-4 bg-muted rounded w-28" /></td>
                    <td className="p-4.5"><div className="h-4 bg-muted rounded w-24" /></td>
                    <td className="p-4.5"><div className="h-4 bg-muted rounded w-16" /></td>
                    <td className="p-4.5"><div className="h-6 bg-muted rounded w-32" /></td>
                    <td className="p-4.5"><div className="h-4 bg-muted rounded w-36" /></td>
                    <td className="p-4.5 text-right"><div className="h-8 bg-muted rounded w-24 ml-auto" /></td>
                  </tr>
                ))
              ) : solicitacoes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <FileMinus className="w-10 h-10 text-muted-foreground/60" />
                      <span className="text-sm">Nenhuma solicitação de prontuário encontrada.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                solicitacoes.map((sol) => (
                  <tr 
                    key={sol.id} 
                    onClick={() => handleOpenDetails(sol)}
                    className="hover:bg-slate-50/40 dark:hover:bg-slate-900/10 transition-colors cursor-pointer"
                  >
                    <td className="p-4.5 font-mono text-sm font-semibold text-[#8a1515] dark:text-[#f43f5e]">
                      #{String(sol.numero_solicitacao).padStart(4, '0')}
                    </td>
                    <td className="p-4.5 font-medium text-foreground">
                      {sol.paciente_nome}
                    </td>
                    <td className="p-4.5 text-sm text-muted-foreground">
                      {sol.paciente_cpf}
                    </td>
                    <td className="p-4.5 text-sm text-muted-foreground">
                      {new Date(sol.data_solicitacao).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="p-4.5 text-sm">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        sol.tipo_solicitacao === 'Digital' 
                          ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/20 dark:text-purple-400' 
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400'
                      }`}>
                        {sol.tipo_solicitacao}
                      </span>
                    </td>
                    <td className="p-4.5">
                      <span className={getStatusBadge(sol.status)}>
                        {getStatusIcon(sol.status)}
                        {sol.status}
                      </span>
                    </td>
                    <td className="p-4.5 text-sm text-muted-foreground font-medium">
                      {sol.responsavel_nome || '-'}
                    </td>
                    <td className="p-4.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {sol.status === 'Pendente' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleIniciarAnalise(sol);
                            }}
                            title="Iniciar Análise"
                            disabled={loadingAction}
                            className="p-2 hover:bg-amber-50 text-amber-600 hover:text-amber-700 rounded-lg transition-colors border border-transparent hover:border-amber-200 cursor-pointer disabled:opacity-50"
                          >
                            <Play className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDetails(sol);
                          }}
                          title="Visualizar Detalhes"
                          className="p-2 hover:bg-slate-100 text-slate-600 hover:text-slate-800 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100 rounded-lg transition-colors border border-transparent hover:border-border cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
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

      {/* MODAL DETALHAMENTO & AÇÃO */}
      {isModalOpen && selectedSolicitacao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-card border border-border w-full max-w-3xl rounded-2xl shadow-xl flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-200">
            
            {/* Header Modal */}
            <div className="p-5 border-b border-border flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/20">
              <div className="flex items-center gap-3">
                <span className="font-mono text-lg font-bold text-[#8a1515] dark:text-[#f43f5e]">
                  #{String(selectedSolicitacao.numero_solicitacao).padStart(4, '0')}
                </span>
                <h2 className="text-lg font-bold text-foreground truncate max-w-sm sm:max-w-md">
                  {selectedSolicitacao.paciente_nome}
                </h2>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-all"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Abas de Navegação interna do Modal */}
            <div className="flex border-b border-border px-5 bg-card">
              <button
                onClick={() => setAbaAtiva('dados')}
                className={`py-3 px-4 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                  abaAtiva === 'dados' 
                    ? 'border-[#8a1515] text-[#8a1515] dark:border-[#f43f5e] dark:text-[#f43f5e]' 
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <FileText className="w-4 h-4" />
                Dados da Solicitação
              </button>
              <button
                onClick={() => setAbaAtiva('historico')}
                className={`py-3 px-4 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                  abaAtiva === 'historico' 
                    ? 'border-[#8a1515] text-[#8a1515] dark:border-[#f43f5e] dark:text-[#f43f5e]' 
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <History className="w-4 h-4" />
                Histórico / Log
              </button>
            </div>

            {/* Conteúdo Modal */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {abaAtiva === 'dados' ? (
                <>
                  {/* Grid de Informações */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* Paciente */}
                    <div className="space-y-3.5 bg-slate-50/50 dark:bg-slate-900/10 p-4.5 rounded-xl border border-border/60">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-[#8a1515] dark:text-[#f43f5e]" />
                        Dados do Paciente
                      </h3>
                      <div className="space-y-2">
                        <div>
                          <span className="text-[11px] text-muted-foreground uppercase block font-semibold">Nome Completo</span>
                          <span className="text-sm font-medium text-foreground">{selectedSolicitacao.paciente_nome}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-[11px] text-muted-foreground uppercase block font-semibold">CPF</span>
                            <span className="text-sm font-medium text-foreground">{selectedSolicitacao.paciente_cpf}</span>
                          </div>
                          <div>
                            <span className="text-[11px] text-muted-foreground uppercase block font-semibold">Nascimento</span>
                            <span className="text-sm font-medium text-foreground">
                              {new Date(selectedSolicitacao.paciente_data_nascimento).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                        </div>
                        <div>
                          <span className="text-[11px] text-muted-foreground uppercase block font-semibold">Contato</span>
                          <span className="text-sm font-medium text-foreground flex items-center gap-1">
                            <Phone className="w-3 h-3 text-muted-foreground" />
                            {selectedSolicitacao.paciente_contato}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Solicitação */}
                    <div className="space-y-3.5 bg-slate-50/50 dark:bg-slate-900/10 p-4.5 rounded-xl border border-border/60">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-[#8a1515] dark:text-[#f43f5e]" />
                        Detalhes do Pedido
                      </h3>
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-[11px] text-muted-foreground uppercase block font-semibold">Data Abertura</span>
                            <span className="text-sm font-medium text-foreground">
                              {new Date(selectedSolicitacao.data_solicitacao).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                          <div>
                            <span className="text-[11px] text-muted-foreground uppercase block font-semibold">Tipo Entrega</span>
                            <span className="text-sm font-medium text-foreground">{selectedSolicitacao.tipo_solicitacao}</span>
                          </div>
                        </div>
                        <div>
                          <span className="text-[11px] text-muted-foreground uppercase block font-semibold">Motivo do Pedido</span>
                          <span className="text-xs font-medium text-foreground block bg-background p-2 rounded-lg border border-border/40">
                            {selectedSolicitacao.motivo}
                          </span>
                        </div>
                        {selectedSolicitacao.observacoes && (
                          <div>
                            <span className="text-[11px] text-muted-foreground uppercase block font-semibold">Observações</span>
                            <span className="text-xs text-muted-foreground block bg-background p-2 rounded-lg border border-border/40">
                              {selectedSolicitacao.observacoes}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* PAINEL DE AÇÃO E GESTÃO DE STATUS (EXCLUSIVO DO GESTOR) */}
                  <div className="pt-6 border-t border-border space-y-5">
                    <div className="flex items-center gap-2 pb-2">
                      <div className="p-1.5 bg-[#8a1515]/10 text-[#8a1515] dark:text-[#fb7185] dark:bg-[#fb7185]/10 rounded-lg">
                        <FileUp className="w-4.5 h-4.5" />
                      </div>
                      <h4 className="text-sm font-bold text-foreground uppercase tracking-wider">
                        Controle e Ações do Gestor
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Seletor de Novo Status */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-muted-foreground uppercase">
                          Alterar Status da Solicitação
                        </label>
                        <select
                          value={novoStatusSelecionado}
                          onChange={(e) => {
                            setNovoStatusSelecionado(e.target.value as any);
                            setErroAcao('');
                          }}
                          className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer hover:border-border/80 transition-all shadow-sm"
                        >
                          <option value="Pendente">Pendente</option>
                          <option value="Em Análise">Em Análise</option>
                          <option value="Aprovado">Aprovado</option>
                          <option value="Rejeitado">Rejeitado</option>
                          <option value="Documento Disponibilizado">Documento Disponibilizado</option>
                        </select>
                      </div>

                      {/* Info do Status Atual */}
                      <div className="flex flex-col justify-center p-3 bg-slate-50/50 dark:bg-slate-900/10 rounded-xl border border-border/40 text-xs">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold">Status Atual</span>
                        <div className="mt-1 flex items-center gap-2">
                          <span className={getStatusBadge(selectedSolicitacao.status)}>
                            {getStatusIcon(selectedSolicitacao.status)}
                            {selectedSolicitacao.status}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Exibe arquivo atual se já existir */}
                    {selectedSolicitacao.arquivo_url && (
                      <div className="p-3.5 bg-emerald-50/30 border border-emerald-100 rounded-xl flex items-center justify-between text-xs dark:bg-emerald-950/5 dark:border-emerald-900/20">
                        <div className="flex items-center gap-2 truncate">
                          <FileCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          <span className="font-semibold text-foreground truncate">{selectedSolicitacao.arquivo_nome}</span>
                        </div>
                        <a
                          href={selectedSolicitacao.arquivo_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#8a1515] dark:text-[#f43f5e] hover:underline font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Visualizar PDF Atual
                        </a>
                      </div>
                    )}

                    {/* SEÇÃO DINÂMICA: SE SELECIONOU 'REJEITADO' */}
                    {novoStatusSelecionado === 'Rejeitado' && (
                      <div className="space-y-1.5 animate-in fade-in duration-200">
                        <label className="text-[11px] font-bold text-muted-foreground uppercase">
                          Justificativa da Rejeição <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          placeholder="Informe detalhadamente o motivo da rejeição da solicitação..."
                          value={justificativa}
                          onChange={(e) => setJustificativa(e.target.value)}
                          rows={3}
                          className="w-full p-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-red-500/20 text-sm placeholder:text-muted-foreground/60 resize-none"
                        />
                      </div>
                    )}

                    {/* SEÇÃO DINÂMICA: SE SELECIONOU 'APROVADO' OU 'DOCUMENTO DISPONIBILIZADO' */}
                    {(novoStatusSelecionado === 'Aprovado' || novoStatusSelecionado === 'Documento Disponibilizado') && (
                      <div className="space-y-3 animate-in fade-in duration-200">
                        <label className="text-[11px] font-bold text-muted-foreground uppercase block">
                          Anexar Arquivo do Prontuário (PDF) {novoStatusSelecionado === 'Documento Disponibilizado' && <span className="text-red-500">*</span>}
                        </label>
                        
                        <div className="flex flex-col items-center justify-center border border-dashed border-border/80 rounded-lg p-5 bg-card hover:bg-slate-50/20 transition-all relative">
                          <input
                            type="file"
                            accept="application/pdf"
                            id="file-prontuario"
                            onChange={handleFileChange}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          />
                          <FileText className="w-8 h-8 text-muted-foreground mb-1" />
                          <span className="text-xs font-semibold text-[#8a1515] dark:text-[#f43f5e] hover:underline">
                            {arquivoSelecionado ? 'Substituir arquivo selecionado' : 'Selecionar arquivo PDF'}
                          </span>
                          <span className="text-[10px] text-muted-foreground mt-0.5">Apenas PDF, Máximo 50MB</span>
                        </div>

                        {arquivoSelecionado && (
                          <div className="p-3 bg-card border border-border rounded-lg flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2 truncate">
                              <FileText className="w-4 h-4 text-red-500" />
                              <span className="font-semibold text-foreground truncate">{arquivoSelecionado.name}</span>
                              <span className="text-muted-foreground text-[10px]">({(arquivoSelecionado.size / 1024 / 1024).toFixed(2)} MB)</span>
                            </div>
                            <button
                              onClick={() => setArquivoSelecionado(null)}
                              className="text-red-500 hover:text-red-600 font-bold ml-2 cursor-pointer"
                            >
                              Excluir
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {erroAcao && (
                      <p className="text-xs text-red-500 font-semibold">{erroAcao}</p>
                    )}

                    {/* Botões do painel do Gestor */}
                    {(novoStatusSelecionado !== selectedSolicitacao.status || arquivoSelecionado) && (
                      <div className="flex gap-2 justify-end pt-2 animate-in fade-in duration-200">
                        <button
                          onClick={() => {
                            setNovoStatusSelecionado(selectedSolicitacao.status);
                            setJustificativa(selectedSolicitacao.justificativa_rejeicao || '');
                            setArquivoSelecionado(null);
                            setErroAcao('');
                          }}
                          className="px-4 py-2 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
                        >
                          Descartar Alterações
                        </button>
                        <button
                          onClick={handleSalvarAlteracoesGestor}
                          disabled={loadingAction}
                          className="bg-[#8a1515] hover:bg-[#720e0e] text-white px-5 py-2.5 text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50"
                        >
                          {loadingAction ? 'Salvando...' : 'Salvar Alterações'}
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                /* Aba Histórico / Log Timeline */
                <div className="space-y-6 py-2">
                  {historico.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">Nenhum evento registrado no histórico.</p>
                  ) : (
                    <div className="relative border-l-2 border-slate-200 dark:border-slate-800 ml-4.5 space-y-6">
                      {historico.map((hist, idx) => (
                        <div key={hist.id || idx} className="relative pl-7">
                          {/* Marcador na Timeline */}
                          <div className="absolute -left-[10px] top-1 flex items-center justify-center w-[18px] h-[18px] rounded-full bg-card border-2 border-[#8a1515] dark:border-[#f43f5e] z-10">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#8a1515] dark:bg-[#f43f5e]" />
                          </div>
                          
                          {/* Detalhes do Evento */}
                          <div className="bg-slate-50/60 dark:bg-slate-900/10 p-3.5 rounded-xl border border-border/40">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1.5">
                              <span className="text-xs font-bold text-foreground">
                                {hist.usuario_nome}
                              </span>
                              <span className="text-[10px] text-muted-foreground font-mono">
                                {new Date(hist.data).toLocaleString('pt-BR')}
                              </span>
                            </div>
                            
                            <p className="text-xs text-muted-foreground mb-2 leading-relaxed">
                              {hist.descricao}
                            </p>

                            <div className="flex items-center gap-1.5 mt-2">
                              {hist.status_anterior && (
                                <>
                                  <span className="text-[10px] px-2 py-0.5 rounded-sm bg-slate-100 text-slate-600 font-semibold dark:bg-slate-800 dark:text-slate-400">
                                    {hist.status_anterior}
                                  </span>
                                  <ArrowRight className="w-3 h-3 text-muted-foreground" />
                                </>
                              )}
                              <span className="text-[10px] px-2 py-0.5 rounded-sm bg-[#8a1515]/10 text-[#8a1515] font-semibold dark:text-[#fb7185] dark:bg-[#fb7185]/10">
                                {hist.status_novo}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer Modal */}
            <div className="p-4.5 border-t border-border flex justify-end bg-slate-50/50 dark:bg-slate-900/20">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-2.5 bg-background border border-border text-foreground hover:bg-muted text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm"
              >
                Fechar
              </button>
            </div>
            
          </div>
        </div>
      )}

    </div>
  );
}
