import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Plus, Search, Users, BookOpen, Calendar, FileText, Check, X, 
  Trash2, Edit2, CheckCircle2, XCircle, AlertCircle, RefreshCw, UserPlus, Info,
  Archive, FolderOpen, ChevronLeft, ChevronRight, Upload, Award
} from 'lucide-react';
import { 
  fetchProfessores, 
  criarProfessor, 
  atualizarProfessor, 
  excluirProfessor,
  Professor 
} from '../../services/internatoAgendaService';

interface Turma {
  id: string;
  nome: string;
  periodo: string;
  ativa: boolean;
  alunos_count?: number;
}

interface Aluno {
  id: string;
  nome: string;
  email: string | null;
  matricula: string | null;
  grupo?: string | null;
  internato_turma_alunos?: {
    turma_id: string;
    internato_turmas: {
      nome: string;
      ativa: boolean;
    } | null;
  }[];
}

const TABS = [
  { id: 'turmas', label: 'Turmas' },
  { id: 'alunos', label: 'Alunos' },
  { id: 'presenca', label: 'Frequência' },
  { id: 'atestados', label: 'Atestados' },
  { id: 'professores', label: 'Professores' }
] as const;
const CLINICAS = [
  { id: 'GO', nome: 'Ginecologia e Obstetrícia (G.O.)' },
  { id: 'Pediatria', nome: 'Pediatria' },
  { id: 'Clinica Medica', nome: 'Clínica Médica' },
  { id: 'Clinica Cirurgica', nome: 'Clínica Cirúrgica' },
  { id: 'Saude Mental', nome: 'Saúde Mental' },
  { id: 'Urgencia Emergencia', nome: 'Urgência e Emergência' }
];

const getClinicasPorPeriodo = (periodo: string) => {
  const cleanPeriodo = (periodo || '').toLowerCase();
  if (cleanPeriodo.includes('10º') || cleanPeriodo.includes('10')) {
    return [
      { id: 'GO', nome: 'Ginecologia e Obstetrícia (G.O.)' },
      { id: 'Pediatria', nome: 'Pediatria' }
    ];
  }
  if (cleanPeriodo.includes('11º') || cleanPeriodo.includes('11')) {
    return [
      { id: 'Clinica Medica', nome: 'Clínica Médica' },
      { id: 'Clinica Cirurgica', nome: 'Clínica Cirúrgica (Cirurgia)' }
    ];
  }
  if (cleanPeriodo.includes('12º') || cleanPeriodo.includes('12')) {
    return [
      { id: 'Saude Mental', nome: 'Saúde Mental' },
      { id: 'Urgencia Emergencia', nome: 'Urgência e Emergência' }
    ];
  }
  return CLINICAS;
};

const getRotacaoInfo = (periodo: string, grupo: string | null) => {
  if (!grupo) return '';
  const cleanPeriodo = (periodo || '').toLowerCase();
  
  if (cleanPeriodo.includes('10º') || cleanPeriodo.includes('10')) {
    return grupo === 'A' ? 'GO ➔ Pediatria' : 'Pediatria ➔ GO';
  }
  if (cleanPeriodo.includes('11º') || cleanPeriodo.includes('11')) {
    return grupo === 'A' ? 'Clínica ➔ Cirurgia' : 'Cirurgia ➔ Clínica';
  }
  if (cleanPeriodo.includes('12º') || cleanPeriodo.includes('12')) {
    return grupo === 'A' ? 'Saúde Mental ➔ Urgência' : 'Urgência ➔ Saúde Mental';
  }
  return '';
};

const getGrupoLabel = (periodo: string, grupo: string | null) => {
  if (!grupo) return '';
  const cleanPeriodo = (periodo || '').toLowerCase();
  
  if (cleanPeriodo.includes('10º') || cleanPeriodo.includes('10')) {
    return grupo === 'A' ? 'G.O.' : 'Pediatria';
  }
  if (cleanPeriodo.includes('11º') || cleanPeriodo.includes('11')) {
    return grupo === 'A' ? 'Clínica Médica' : 'Clínica Cirúrgica';
  }
  if (cleanPeriodo.includes('12º') || cleanPeriodo.includes('12')) {
    return grupo === 'A' ? 'Saúde Mental' : 'Urgência e Emergência';
  }
  return `Grupo ${grupo}`;
};

interface Presenca {
  aluno_id: string;
  status: 'presente' | 'ausente' | 'justificado';
  observacao: string;
}

interface Atestado {
  id: string;
  aluno_id: string;
  aluno_nome?: string;
  data_inicio: string;
  data_fim: string;
  motivo: string;
  documento_url?: string | null;
}

const Secretaria: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'turmas' | 'alunos' | 'presenca' | 'atestados' | 'professores'>('turmas');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Estados de Professores
  const [professores, setProfessores] = useState<Professor[]>([]);
  const [loadingProfessores, setLoadingProfessores] = useState(false);
  const [searchTermProfessores, setSearchTermProfessores] = useState('');
  const [showProfessorModal, setShowProfessorModal] = useState(false);
  const [showEditProfessorModal, setShowEditProfessorModal] = useState(false);
  const [professorForm, setProfessorForm] = useState({ nome: '', email: '', especialidade: '' });
  const [editProfessorForm, setEditProfessorForm] = useState({ id: '', nome: '', email: '', especialidade: '' });
  // Estados de dados
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [atestados, setAtestados] = useState<Atestado[]>([]);

  // Estados de Modais
  const [showTurmaModal, setShowTurmaModal] = useState(false);
  const [showEditTurmaModal, setShowEditTurmaModal] = useState(false);
  const [showAlunoModal, setShowAlunoModal] = useState(false);
  const [showEditAlunoModal, setShowEditAlunoModal] = useState(false);
  const [showVincularModal, setShowVincularModal] = useState(false);
  const [showAtestadoModal, setShowAtestadoModal] = useState(false);
  const [selectedTurma, setSelectedTurma] = useState<Turma | null>(null);
  const [selectedTurmaAlunos, setSelectedTurmaAlunos] = useState<Aluno[]>([]);

  // Formulários
  const [turmaForm, setTurmaForm] = useState({ nome: '', periodo: '' });
  const [editTurmaForm, setEditTurmaForm] = useState({ id: '', nome: '', periodo: '' });
  const [alunoForm, setAlunoForm] = useState({ nome: '', email: '', matricula: '', turma_id: '' });
  const [editAlunoForm, setEditAlunoForm] = useState({ id: '', nome: '', email: '', matricula: '' });
  const [vincularAlunosIds, setVincularAlunosIds] = useState<string[]>([]);
  const [atestadoForm, setAtestadoForm] = useState({ aluno_id: '', data_inicio: '', data_fim: '', motivo: '' });

  // Controle de Presença
  const [presencaTurmaId, setPresencaTurmaId] = useState<string>('');
  const [presencaClinica, setPresencaClinica] = useState<string>('');
  const [presencaData, setPresencaData] = useState<string>(new Date().toISOString().split('T')[0]);
  const [presencasMap, setPresencasMap] = useState<Record<string, { status: 'presente' | 'ausente' | 'justificado'; observacao: string }>>({});
  const [presencaAlunos, setPresencaAlunos] = useState<Aluno[]>([]);

  // Filtros/Busca
  const [searchTermAlunos, setSearchTermAlunos] = useState('');
  const [currentPageAlunos, setCurrentPageAlunos] = useState(1);
  const [itemsPerPageAlunos, setItemsPerPageAlunos] = useState(15);
  const [filtroTurmaAluno, setFiltroTurmaAluno] = useState<string>('');
  const [searchTermTurmas, setSearchTermTurmas] = useState('');
  const [mostrarArquivadas, setMostrarArquivadas] = useState(false);
  const [filtroClinicaTurma, setFiltroClinicaTurma] = useState<string | null>(null);

  // Ficha do Aluno (Master-Detail)
  const [selectedFichaAluno, setSelectedFichaAluno] = useState<Aluno | null>(null);
  const [fichaAbaAtiva, setFichaAbaAtiva] = useState<'notas' | 'atestados' | 'reposicoes'>('notas');
  const [fichaNotas, setFichaNotas] = useState<any[]>([]);
  const [fichaAtestados, setFichaAtestados] = useState<any[]>([]);
  const [fichaReposicoes, setFichaReposicoes] = useState<any[]>([]);
  const [fichaTurmas, setFichaTurmas] = useState<any[]>([]);
  const [fichaPresencasCount, setFichaPresencasCount] = useState({ presente: 0, ausente: 0, justificado: 0 });
  const [loadingFicha, setLoadingFicha] = useState(false);
  const [submittingFichaAction, setSubmittingFichaAction] = useState(false);

  // Formulários da Ficha
  const [novoAtestadoFicha, setNovoAtestadoFicha] = useState<{
    data_inicio: string;
    data_fim: string;
    motivo: string;
    arquivo: File | null;
  }>({
    data_inicio: '',
    data_fim: '',
    motivo: '',
    arquivo: null
  });

  const [novaReposicaoFicha, setNovaReposicaoFicha] = useState<{
    turma_id: string;
    data_falta: string;
    data_reposicao: string;
    clinica: string;
    status: 'pendente' | 'concluida';
    observacao: string;
  }>({
    turma_id: '',
    data_falta: '',
    data_reposicao: '',
    clinica: '',
    status: 'pendente',
    observacao: ''
  });

  useEffect(() => {
    fetchTurmas();
  }, [mostrarArquivadas]);

  useEffect(() => {
    fetchAlunos();
    fetchAtestados();
    fetchProfessoresData();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('internato_professores_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'internato_professores' },
        () => {
          fetchProfessoresData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  useEffect(() => {
    setCurrentPageAlunos(1);
  }, [searchTermAlunos, filtroTurmaAluno]);

  useEffect(() => {
    const calcularItensPorPagina = () => {
      // Altura total da tela menos cabecalhos, busca e paginacao (aprox 350px)
      const alturaDisponivel = window.innerHeight - 350;
      // Altura aproximada de cada linha tr (52px)
      const alturaLinha = 52;
      const calculado = Math.floor(alturaDisponivel / alturaLinha);
      // Garante pelo menos 5 itens por pagina e no maximo 50
      setItemsPerPageAlunos(Math.max(5, Math.min(50, calculado)));
    };

    calcularItensPorPagina();
    window.addEventListener('resize', calcularItensPorPagina);
    return () => window.removeEventListener('resize', calcularItensPorPagina);
  }, []);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage({ text, type });
  };

  const fetchProfessoresData = async () => {
    setLoadingProfessores(true);
    try {
      const data = await fetchProfessores();
      setProfessores(data);
    } catch (err: any) {
      showToast(err.message || 'Erro ao carregar professores', 'error');
    } finally {
      setLoadingProfessores(false);
    }
  };

  const handleCreateProfessor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!professorForm.nome) return;

    try {
      const res = await criarProfessor(professorForm.nome, professorForm.email || null, professorForm.especialidade || null);
      if (res.success) {
        showToast('Professor cadastrado com sucesso!');
        setProfessorForm({ nome: '', email: '', especialidade: '' });
        setShowProfessorModal(false);
        fetchProfessoresData();
      } else {
        showToast(res.error || 'Erro ao cadastrar professor', 'error');
      }
    } catch (error: any) {
      showToast(error.message || 'Erro ao cadastrar professor', 'error');
    }
  };

  const handleUpdateProfessor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProfessorForm.id || !editProfessorForm.nome) return;

    try {
      const res = await atualizarProfessor(editProfessorForm.id, editProfessorForm.nome, editProfessorForm.email || null, editProfessorForm.especialidade || null);
      if (res.success) {
        showToast('Professor atualizado com sucesso!');
        setShowEditProfessorModal(false);
        fetchProfessoresData();
      } else {
        showToast(res.error || 'Erro ao atualizar professor', 'error');
      }
    } catch (error: any) {
      showToast(error.message || 'Erro ao atualizar professor', 'error');
    }
  };

  const handleDeleteProfessor = async (id: string) => {
    if (!confirm('Deseja realmente remover este professor?')) return;

    try {
      const res = await excluirProfessor(id);
      if (res.success) {
        showToast('Professor removido com sucesso!');
        fetchProfessoresData();
      } else {
        showToast(res.error || 'Erro ao remover professor', 'error');
      }
    } catch (error: any) {
      showToast(error.message || 'Erro ao remover professor', 'error');
    }
  };
  // ----------------------------------------------------
  // BUSCA DE DADOS
  // ----------------------------------------------------

  const fetchTurmas = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('internato_turmas')
        .select(`
          *,
          internato_turma_alunos (count)
        `);

      if (!mostrarArquivadas) {
        query = query.eq('ativa', true);
      }

      const { data, error } = await query.order('nome');

      if (error) throw error;
      
      const formatted = data.map((t: any) => ({
        id: t.id,
        nome: t.nome,
        periodo: t.periodo,
        ativa: t.ativa,
        alunos_count: t.internato_turma_alunos[0]?.count || 0
      }));

      setTurmas(formatted);
    } catch (error: any) {
      showToast(error.message || 'Erro ao carregar turmas', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchAlunos = async () => {
    try {
      const { data, error } = await supabase
        .from('internato_alunos')
        .select(`
          *,
          internato_turma_alunos (
            turma_id,
            internato_turmas (
              nome,
              ativa
            )
          )
        `)
        .order('nome');

      if (error) throw error;
      setAlunos(data || []);
    } catch (error: any) {
      showToast(error.message || 'Erro ao carregar alunos', 'error');
    }
  };

  const fetchAtestados = async () => {
    try {
      const { data, error } = await supabase
        .from('internato_atestados')
        .select(`
          *,
          internato_alunos (nome)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const formatted = data.map((a: any) => ({
        id: a.id,
        aluno_id: a.aluno_id,
        aluno_nome: a.internato_alunos?.nome || 'Aluno Removido',
        data_inicio: a.data_inicio,
        data_fim: a.data_fim,
        motivo: a.motivo,
        documento_url: a.documento_url
      }));

      setAtestados(formatted);
    } catch (error: any) {
      showToast(error.message || 'Erro ao carregar atestados', 'error');
    }
  };

  const handleVerDetalhesTurma = async (turma: Turma) => {
    setSelectedTurma(turma);
    setFiltroClinicaTurma(null);
    try {
      const { data, error } = await supabase
        .from('internato_turma_alunos')
        .select(`
          aluno_id,
          grupo,
          internato_alunos (*)
        `)
        .eq('turma_id', turma.id);

      if (error) throw error;

      const turmaAlunos = data
        .map((d: any) => ({
          ...d.internato_alunos,
          grupo: d.grupo
        }))
        .filter((a: any) => a !== null) as Aluno[];

      turmaAlunos.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

      setSelectedTurmaAlunos(turmaAlunos);
    } catch (error: any) {
      showToast(error.message || 'Erro ao carregar alunos da turma', 'error');
    }
  };

  const handleUpdateAlunoGrupo = async (alunoId: string, novoGrupo: string | null) => {
    if (!selectedTurma) return;
    try {
      const { error } = await supabase
        .from('internato_turma_alunos')
        .update({ grupo: novoGrupo || null })
        .eq('turma_id', selectedTurma.id)
        .eq('aluno_id', alunoId);

      if (error) throw error;
      showToast('Clínica do aluno atualizada!');
      handleVerDetalhesTurma(selectedTurma);
    } catch (error: any) {
      showToast(error.message || 'Erro ao atualizar grupo do aluno', 'error');
    }
  };

  const handleRodarTurma = async () => {
    if (!selectedTurma || selectedTurmaAlunos.length === 0) return;
    
    const countA = selectedTurmaAlunos.filter(a => a.grupo === 'A').length;
    const countB = selectedTurmaAlunos.filter(a => a.grupo === 'B').length;
    
    if (countA === 0 && countB === 0) {
      showToast('Nenhum aluno desta turma possui clínica definida para rodar.', 'error');
      return;
    }

    if (!confirm(`Deseja realmente rodar a turma "${selectedTurma.nome}"?\n\nIsso inverterá a clínica atual de todos os ${countA + countB} alunos que possuem clínica definida.`)) {
      return;
    }

    setLoading(true);
    try {
      const updates = selectedTurmaAlunos
        .filter(aluno => aluno.grupo === 'A' || aluno.grupo === 'B')
        .map(aluno => ({
          turma_id: selectedTurma.id,
          aluno_id: aluno.id,
          grupo: aluno.grupo === 'A' ? 'B' : 'A'
        }));

      const { error } = await supabase
        .from('internato_turma_alunos')
        .upsert(updates, { onConflict: 'turma_id,aluno_id' });

      if (error) throw error;
      
      showToast('Rotação da turma realizada com sucesso!');
      handleVerDetalhesTurma(selectedTurma);
    } catch (error: any) {
      showToast(error.message || 'Erro ao realizar rotação da turma', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ----------------------------------------------------
  // CADASTROS E AÇÕES
  // ----------------------------------------------------

  const handleCreateTurma = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!turmaForm.nome || !turmaForm.periodo) return;

    try {
      const { error } = await supabase
        .from('internato_turmas')
        .insert([turmaForm]);

      if (error) throw error;
      showToast('Turma cadastrada com sucesso!');
      setTurmaForm({ nome: '', periodo: '' });
      setShowTurmaModal(false);
      fetchTurmas();
    } catch (error: any) {
      showToast(error.message || 'Erro ao criar turma', 'error');
    }
  };

  const handleUpdateTurma = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTurmaForm.id || !editTurmaForm.nome || !editTurmaForm.periodo) return;

    try {
      const { error } = await supabase
        .from('internato_turmas')
        .update({
          nome: editTurmaForm.nome,
          periodo: editTurmaForm.periodo
        })
        .eq('id', editTurmaForm.id);

      if (error) throw error;
      showToast('Turma atualizada com sucesso!');
      
      if (selectedTurma && selectedTurma.id === editTurmaForm.id) {
        setSelectedTurma(prev => prev ? { ...prev, nome: editTurmaForm.nome, periodo: editTurmaForm.periodo } : null);
      }

      setShowEditTurmaModal(false);
      fetchTurmas();
    } catch (error: any) {
      showToast(error.message || 'Erro ao atualizar turma', 'error');
    }
  };

  const handleToggleArquivarTurma = async (turma: Turma) => {
    const acao = turma.ativa ? 'arquivar' : 'reativar';
    if (!confirm(`Deseja realmente ${acao} a turma "${turma.nome}"?`)) return;

    try {
      const { error } = await supabase
        .from('internato_turmas')
        .update({ ativa: !turma.ativa })
        .eq('id', turma.id);

      if (error) throw error;
      showToast(`Turma ${turma.ativa ? 'arquivada' : 'reativada'} com sucesso!`);
      
      if (selectedTurma && selectedTurma.id === turma.id) {
        setSelectedTurma(null);
        setSelectedTurmaAlunos([]);
      }

      fetchTurmas();
    } catch (error: any) {
      showToast(error.message || 'Erro ao alterar status da turma', 'error');
    }
  };

  const handleCreateAluno = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alunoForm.nome) return;

    try {
      // 1. Inserir o aluno e retornar o id criado
      const { data, error } = await supabase
        .from('internato_alunos')
        .insert([{
          nome: alunoForm.nome,
          email: alunoForm.email || null,
          matricula: alunoForm.matricula || null
        }])
        .select();

      if (error) throw error;
      
      const novoAluno = data?.[0];

      // 2. Vincular aluno na turma se tiver selecionado
      if (novoAluno && alunoForm.turma_id) {
        const { error: linkError } = await supabase
          .from('internato_turma_alunos')
          .insert([{
            turma_id: alunoForm.turma_id,
            aluno_id: novoAluno.id
          }]);

        if (linkError) throw linkError;
      }

      showToast('Aluno cadastrado com sucesso!');
      
      // Se a turma selecionada no momento for a mesma que vinculamos, atualizar lista
      if (selectedTurma && selectedTurma.id === alunoForm.turma_id) {
        handleVerDetalhesTurma(selectedTurma);
      }

      setAlunoForm({ nome: '', email: '', matricula: '', turma_id: '' });
      setShowAlunoModal(false);
      fetchAlunos();
      fetchTurmas(); // Atualiza a contagem de alunos na lista de turmas
    } catch (error: any) {
      showToast(error.message || 'Erro ao cadastrar aluno', 'error');
    }
  };

  const handleUpdateAluno = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editAlunoForm.id || !editAlunoForm.nome) return;

    try {
      const { error } = await supabase
        .from('internato_alunos')
        .update({
          nome: editAlunoForm.nome,
          email: editAlunoForm.email || null,
          matricula: editAlunoForm.matricula || null
        })
        .eq('id', editAlunoForm.id);

      if (error) throw error;
      showToast('Aluno atualizado com sucesso!');
      
      if (selectedTurma) {
        handleVerDetalhesTurma(selectedTurma);
      }

      setShowEditAlunoModal(false);
      setEditAlunoForm({ id: '', nome: '', email: '', matricula: '' });
      fetchAlunos();
    } catch (error: any) {
      showToast(error.message || 'Erro ao atualizar aluno', 'error');
    }
  };

  const handleVincularAlunos = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTurma || vincularAlunosIds.length === 0) return;

    // Verificar se algum selecionado já está em outra turma ativa
    const alunosComDuplicidade = alunos
      .filter(aluno => vincularAlunosIds.includes(aluno.id))
      .filter(aluno => aluno.internato_turma_alunos?.some(v => v.internato_turmas?.ativa));

    if (alunosComDuplicidade.length > 0) {
      const nomes = alunosComDuplicidade.map(a => {
        const turmaNome = a.internato_turma_alunos?.find(v => v.internato_turmas?.ativa)?.internato_turmas?.nome || '';
        return `- ${a.nome} (já na turma: ${turmaNome})`;
      }).join('\n');

      if (!confirm(`Atenção: Os seguintes alunos já estão vinculados a outras turmas ativas:\n\n${nomes}\n\nDeseja realmente vinculá-los a esta nova turma também?`)) {
        return;
      }
    }

    try {
      const inserts = vincularAlunosIds.map(aluno_id => ({
        turma_id: selectedTurma.id,
        aluno_id
      }));

      const { error } = await supabase
        .from('internato_turma_alunos')
        .insert(inserts);

      if (error) throw error;
      showToast('Alunos vinculados com sucesso!');
      setVincularAlunosIds([]);
      setShowVincularModal(false);
      handleVerDetalhesTurma(selectedTurma);
      fetchAlunos(); // Atualiza dados dos alunos vinculados localmente
      fetchTurmas(); // Atualizar contagem
    } catch (error: any) {
      showToast(error.message || 'Erro ao vincular alunos', 'error');
    }
  };

  const handleDesvincularAluno = async (alunoId: string) => {
    if (!selectedTurma) return;
    if (!confirm('Deseja realmente desvincular este aluno da turma?')) return;

    try {
      const { error } = await supabase
        .from('internato_turma_alunos')
        .delete()
        .eq('turma_id', selectedTurma.id)
        .eq('aluno_id', alunoId);

      if (error) throw error;
      showToast('Aluno desvinculado com sucesso!');
      handleVerDetalhesTurma(selectedTurma);
      fetchAlunos(); // Atualiza a lista local de alunos e seus vínculos
      fetchTurmas(); // Atualizar contagem
    } catch (error: any) {
      showToast(error.message || 'Erro ao desvincular aluno', 'error');
    }
  };

  const loadFichaAlunoData = async (alunoId: string) => {
    setLoadingFicha(true);
    try {
      const [notasRes, atestadosRes, reposicoesRes, presencasRes, turmasRes] = await Promise.all([
        supabase.from('internato_notas').select('*, internato_turmas(nome, periodo)').eq('aluno_id', alunoId),
        supabase.from('internato_atestados').select('*').eq('aluno_id', alunoId).order('created_at', { ascending: false }),
        supabase.from('internato_reposicoes').select('*, internato_turmas(nome, periodo)').eq('aluno_id', alunoId).order('created_at', { ascending: false }),
        supabase.from('internato_presencas').select('status').eq('aluno_id', alunoId),
        supabase.from('internato_turma_alunos').select('grupo, internato_turmas(id, nome, periodo, ativa)').eq('aluno_id', alunoId)
      ]);

      if (notasRes.error) throw notasRes.error;
      if (atestadosRes.error) throw atestadosRes.error;
      if (reposicoesRes.error) throw reposicoesRes.error;
      if (presencasRes.error) throw presencasRes.error;
      if (turmasRes.error) throw turmasRes.error;

      setFichaNotas(notasRes.data || []);
      setFichaAtestados(atestadosRes.data || []);
      setFichaReposicoes(reposicoesRes.data || []);
      setFichaTurmas(turmasRes.data || []);

      const presencas = presencasRes.data || [];
      const counts = presencas.reduce(
        (acc, cur) => {
          if (cur.status === 'presente') acc.presente++;
          else if (cur.status === 'ausente') acc.ausente++;
          else if (cur.status === 'justificado') acc.justificado++;
          return acc;
        },
        { presente: 0, ausente: 0, justificado: 0 }
      );
      setFichaPresencasCount(counts);
    } catch (err: any) {
      showToast(err.message || 'Erro ao carregar dados do aluno', 'error');
    } finally {
      setLoadingFicha(false);
    }
  };

  const handleAbrirFichaAluno = (aluno: Aluno) => {
    setSelectedFichaAluno(aluno);
    setFichaAbaAtiva('notas');
    loadFichaAlunoData(aluno.id);
    
    // Inicializar formulários da ficha
    setNovoAtestadoFicha({ data_inicio: '', data_fim: '', motivo: '', arquivo: null });
    setNovaReposicaoFicha({ turma_id: '', data_falta: '', data_reposicao: '', clinica: '', status: 'pendente', observacao: '' });
  };

  const handleCreateAtestadoFicha = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFichaAluno) return;
    const { data_inicio, data_fim, motivo, arquivo } = novoAtestadoFicha;
    if (!data_inicio || !data_fim || !motivo) return;

    setSubmittingFichaAction(true);
    try {
      let documentoUrl: string | null = null;
      if (arquivo) {
        const fileExt = arquivo.name.split('.').pop();
        const fileName = `${selectedFichaAluno.id}-${Date.now()}.${fileExt}`;
        const filePath = `atestados/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('atestados-internato')
          .upload(filePath, arquivo);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('atestados-internato')
          .getPublicUrl(filePath);

        documentoUrl = publicUrl;
      }

      const { error } = await supabase
        .from('internato_atestados')
        .insert({
          aluno_id: selectedFichaAluno.id,
          data_inicio,
          data_fim,
          motivo,
          documento_url: documentoUrl
        });

      if (error) throw error;
      showToast('Atestado registrado com sucesso!');
      setNovoAtestadoFicha({ data_inicio: '', data_fim: '', motivo: '', arquivo: null });
      
      // Limpar campo de file do DOM
      const fileInput = document.getElementById('atestado-file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

      loadFichaAlunoData(selectedFichaAluno.id);
      fetchAtestados(); // Atualiza a aba principal de atestados se necessário
    } catch (err: any) {
      showToast(err.message || 'Erro ao registrar atestado', 'error');
    } finally {
      setSubmittingFichaAction(false);
    }
  };

  const handleCreateReposicaoFicha = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFichaAluno) return;
    const { turma_id, data_falta, data_reposicao, clinica, status, observacao } = novaReposicaoFicha;
    if (!data_falta || !clinica) return;

    setSubmittingFichaAction(true);
    try {
      const { error } = await supabase
        .from('internato_reposicoes')
        .insert({
          aluno_id: selectedFichaAluno.id,
          turma_id: turma_id || null,
          data_falta,
          data_reposicao: data_reposicao || null,
          clinica,
          status,
          observacao: observacao || null
        });

      if (error) throw error;
      showToast('Reposição de aula registrada com sucesso!');
      setNovaReposicaoFicha({
        turma_id: '',
        data_falta: '',
        data_reposicao: '',
        clinica: '',
        status: 'pendente',
        observacao: ''
      });
      loadFichaAlunoData(selectedFichaAluno.id);
    } catch (err: any) {
      showToast(err.message || 'Erro ao registrar reposição', 'error');
    } finally {
      setSubmittingFichaAction(false);
    }
  };

  const handleToggleStatusReposicao = async (rep: any) => {
    const novoStatus = rep.status === 'pendente' ? 'concluida' : 'pendente';
    const hoje = new Date().toISOString().split('T')[0];
    try {
      const { error } = await supabase
        .from('internato_reposicoes')
        .update({
          status: novoStatus,
          data_reposicao: novoStatus === 'concluida' ? hoje : null
        })
        .eq('id', rep.id);

      if (error) throw error;
      showToast(`Reposição marcada como ${novoStatus === 'concluida' ? 'Concluída' : 'Pendente'}!`);
      if (selectedFichaAluno) {
        loadFichaAlunoData(selectedFichaAluno.id);
      }
    } catch (err: any) {
      showToast(err.message || 'Erro ao atualizar status da reposição', 'error');
    }
  };

  const handleDeleteReposicao = async (id: string) => {
    if (!confirm('Deseja realmente remover esta reposição?')) return;
    try {
      const { error } = await supabase
        .from('internato_reposicoes')
        .delete()
        .eq('id', id);

      if (error) throw error;
      showToast('Reposição removida com sucesso!');
      if (selectedFichaAluno) {
        loadFichaAlunoData(selectedFichaAluno.id);
      }
    } catch (err: any) {
      showToast(err.message || 'Erro ao remover reposição', 'error');
    }
  };

  const handleCreateAtestado = async (e: React.FormEvent) => {
    e.preventDefault();
    const { aluno_id, data_inicio, data_fim, motivo } = atestadoForm;
    if (!aluno_id || !data_inicio || !data_fim || !motivo) return;

    try {
      const { error } = await supabase
        .from('internato_atestados')
        .insert([atestadoForm]);

      if (error) throw error;
      showToast('Atestado registrado com sucesso!');
      setAtestadoForm({ aluno_id: '', data_inicio: '', data_fim: '', motivo: '' });
      setShowAtestadoModal(false);
      fetchAtestados();
    } catch (error: any) {
      showToast(error.message || 'Erro ao registrar atestado', 'error');
    }
  };

  // ----------------------------------------------------
  // FREQUÊNCIA / PRESENÇA
  // ----------------------------------------------------

  const handleLoadPresencaAlunos = async () => {
    if (!presencaTurmaId || !presencaClinica) return;
    setLoading(true);
    try {
      // 1. Buscar alunos da turma
      const { data: taData, error: taError } = await supabase
        .from('internato_turma_alunos')
        .select(`
          aluno_id,
          grupo,
          internato_alunos (*)
        `)
        .eq('turma_id', presencaTurmaId);

      if (taError) throw taError;

      const loadedAlunos = taData
        .map((d: any) => ({
          ...d.internato_alunos,
          grupo: d.grupo
        }))
        .filter((a: any) => a !== null) as Aluno[];

      setPresencaAlunos(loadedAlunos);

      // 2. Buscar presenças já lançadas para essa turma na data e clínica selecionada
      const { data: presData, error: presError } = await supabase
        .from('internato_presencas')
        .select('*')
        .eq('turma_id', presencaTurmaId)
        .eq('clinica', presencaClinica)
        .eq('data', presencaData);

      if (presError) throw presError;

      // 3. Mapear presenças existentes ou inicializar como 'presente'
      const newMap: Record<string, { status: 'presente' | 'ausente' | 'justificado'; observacao: string }> = {};
      
      loadedAlunos.forEach(aluno => {
        const found = presData?.find(p => p.aluno_id === aluno.id);
        newMap[aluno.id] = {
          status: found ? found.status : 'presente',
          observacao: found ? (found.observacao || '') : ''
        };
      });

      setPresencasMap(newMap);
    } catch (error: any) {
      showToast(error.message || 'Erro ao carregar chamada', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = (alunoId: string, status: 'presente' | 'ausente' | 'justificado') => {
    setPresencasMap(prev => ({
      ...prev,
      [alunoId]: {
        ...prev[alunoId],
        status
      }
    }));
  };

  const handleObservacaoChange = (alunoId: string, observacao: string) => {
    setPresencasMap(prev => ({
      ...prev,
      [alunoId]: {
        ...prev[alunoId],
        observacao
      }
    }));
  };

  const handleMarcarTodosPresentes = () => {
    const updated = { ...presencasMap };
    Object.keys(updated).forEach(id => {
      updated[id].status = 'presente';
    });
    setPresencasMap(updated);
  };

  const handleSalvarPresenca = async () => {
    if (!presencaTurmaId || !presencaClinica || presencaAlunos.length === 0) return;
    setLoading(true);
    try {
      const updates = presencaAlunos.map(aluno => ({
        turma_id: presencaTurmaId,
        aluno_id: aluno.id,
        clinica: presencaClinica,
        data: presencaData,
        status: presencasMap[aluno.id].status,
        observacao: presencasMap[aluno.id].observacao || null
      }));

      const { error } = await supabase
        .from('internato_presencas')
        .upsert(updates, { onConflict: 'turma_id,aluno_id,data' });

      if (error) throw error;
      showToast('Frequência salva com sucesso!');
    } catch (error: any) {
      showToast(error.message || 'Erro ao salvar frequência', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Filtros em memória
  const filteredAlunos = alunos.filter(a => {
    const matchesSearch = a.nome.toLowerCase().includes(searchTermAlunos.toLowerCase()) || 
      (a.matricula && a.matricula.toLowerCase().includes(searchTermAlunos.toLowerCase()));
      
    if (!matchesSearch) return false;
    
    if (filtroTurmaAluno) {
      const temTurma = a.internato_turma_alunos?.some(ta => ta.turma_id === filtroTurmaAluno);
      return !!temTurma;
    }
    
    return true;
  });

  // Paginação dos Alunos
  const indexOfLastAluno = currentPageAlunos * itemsPerPageAlunos;
  const indexOfFirstAluno = indexOfLastAluno - itemsPerPageAlunos;
  const currentAlunos = filteredAlunos.slice(indexOfFirstAluno, indexOfLastAluno);
  const totalPagesAlunos = Math.ceil(filteredAlunos.length / itemsPerPageAlunos);

  const filteredTurmas = turmas.filter(t => 
    t.nome.toLowerCase().includes(searchTermTurmas.toLowerCase()) ||
    t.periodo.toLowerCase().includes(searchTermTurmas.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-4 p-4 w-full h-full min-h-[calc(100vh-5rem)]">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center flex-wrap gap-3">
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Secretaria de Internato
            </h1>
            {message && (
              <div className={`py-1 px-3 rounded-lg flex items-center gap-2 border shadow-xs transition-all duration-300 animate-in fade-in slide-in-from-left-2 duration-250 ${
                message.type === 'success' 
                  ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/30 text-emerald-800 dark:text-emerald-300' 
                  : 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/30 text-rose-800 dark:text-rose-300'
              }`}>
                {message.type === 'success' ? <CheckCircle2 className="h-4 w-4 flex-shrink-0" /> : <XCircle className="h-4 w-4 flex-shrink-0" />}
                <span className="text-xs font-semibold">{message.text}</span>
              </div>
            )}
          </div>
          <p className="text-muted-foreground mt-1">
            Gestão escolar de alunos, turmas, atestados médicos e controle de frequência diária.
          </p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'turmas' && (
            <button 
              onClick={() => setShowTurmaModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg shadow-sm hover:shadow-md hover:bg-primary/95 transition-all text-sm font-semibold"
            >
              <Plus className="h-4 w-4" /> Nova Turma
            </button>
          )}
          {activeTab === 'alunos' && (
            <button 
              onClick={() => setShowAlunoModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg shadow-sm hover:shadow-md hover:bg-primary/95 transition-all text-sm font-semibold"
            >
              <Plus className="h-4 w-4" /> Novo Aluno
            </button>
          )}
          {activeTab === 'atestados' && (
            <button 
              onClick={() => setShowAtestadoModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg shadow-sm hover:shadow-md hover:bg-primary/95 transition-all text-sm font-semibold"
            >
              <Plus className="h-4 w-4" /> Registrar Atestado
            </button>
          )}
<<<<<<< HEAD
=======
          {activeTab === 'professores' && (
            <button 
              onClick={() => setShowProfessorModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg shadow-sm hover:shadow-md hover:bg-primary/95 transition-all text-sm font-semibold"
            >
              <Plus className="h-4 w-4" /> Novo Professor
            </button>
          )}
>>>>>>> origin/main
        </div>
      </div>



      {/* Navegação por Abas */}
      <div className="flex border-b border-border">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              setSelectedFichaAluno(null);
            }}
            className={`px-4 py-2.5 border-b-2 text-sm font-semibold transition-colors ${
              activeTab === tab.id 
                ? 'border-primary text-primary font-bold' 
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Conteúdo das Abas */}
      <div className="flex-1">
        
        {/* ABA: TURMAS */}
        {activeTab === 'turmas' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
            
            {/* Lista de Turmas */}
            <div className="lg:col-span-2 flex flex-col gap-3 max-h-[calc(100vh-16rem)] overflow-y-auto pr-1">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <input 
                    type="text"
                    placeholder="Buscar turmas..."
                    value={searchTermTurmas}
                    onChange={e => setSearchTermTurmas(e.target.value)}
                    className="pl-9 pr-4 py-2 border rounded-lg w-full bg-card placeholder-muted-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground cursor-pointer select-none bg-card border px-3 py-2 rounded-lg hover:text-foreground transition-all">
                  <input 
                    type="checkbox"
                    checked={mostrarArquivadas}
                    onChange={e => setMostrarArquivadas(e.target.checked)}
                    className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
                  />
                  Mostrar arquivadas
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredTurmas.length > 0 ? (
                  filteredTurmas.map(turma => (
                    <div 
                      key={turma.id}
                      onClick={() => handleVerDetalhesTurma(turma)}
                      className={`p-5 rounded-xl border bg-card hover:shadow-md transition-all cursor-pointer flex flex-col justify-between ${
                        selectedTurma?.id === turma.id ? 'border-primary ring-1 ring-primary' : 'border-border'
                      } ${!turma.ativa ? 'opacity-65 border-dashed bg-slate-50/40 dark:bg-slate-900/40' : ''}`}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          {!turma.ativa ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center gap-1">
                              <Archive className="h-3 w-3" /> Arquivada
                            </span>
                          ) : (
                            <div />
                          )}
                          <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                            <Users className="h-3.5 w-3.5" />
                            {turma.alunos_count} alunos
                          </span>
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-3 truncate">
                          {turma.nome}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1 font-medium">
                          Período: {turma.periodo}
                        </p>
                      </div>
                      <div className="text-xs text-primary font-bold mt-4 flex items-center gap-1">
                        Ver detalhes <Info className="h-3.5 w-3.5" />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-2 p-8 text-center border border-dashed rounded-xl">
                    <p className="text-muted-foreground">Nenhuma turma cadastrada ou encontrada.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Painel de Detalhes da Turma Selecionada */}
            <div className="bg-card border rounded-xl p-4 flex flex-col gap-3 shadow-sm h-[calc(100vh-16rem)] min-h-[400px]">
              {selectedTurma ? (
                <>
                  <div className="border-b border-border pb-3 flex flex-col gap-2">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-extrabold text-lg truncate flex items-center gap-1.5">
                          {selectedTurma.nome}
                          {!selectedTurma.ativa && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                              Arquivada
                            </span>
                          )}
                        </h3>
                        <p className="text-xs text-muted-foreground">Período: {selectedTurma.periodo}</p>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditTurmaForm({
                              id: selectedTurma.id,
                              nome: selectedTurma.nome,
                              periodo: selectedTurma.periodo
                            });
                            setShowEditTurmaModal(true);
                          }}
                          className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-all"
                          title="Editar Turma"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleToggleArquivarTurma(selectedTurma)}
                          className={`p-1.5 hover:bg-muted rounded-lg transition-all ${
                            selectedTurma.ativa 
                              ? 'text-muted-foreground hover:text-amber-600' 
                              : 'text-amber-600 hover:text-amber-700'
                          }`}
                          title={selectedTurma.ativa ? 'Arquivar Turma' : 'Reativar Turma'}
                        >
                          {selectedTurma.ativa ? <Archive className="h-4 w-4" /> : <FolderOpen className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 mt-1">
                      <button 
                        onClick={() => setShowVincularModal(true)}
                        disabled={!selectedTurma.ativa}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-primary/10 hover:bg-primary/15 disabled:opacity-50 text-primary rounded-lg text-xs font-bold transition-all"
                      >
                        <UserPlus className="h-3.5 w-3.5" /> Vincular Aluno
                      </button>
                      <button 
                        onClick={handleRodarTurma}
                        disabled={!selectedTurma.ativa || selectedTurmaAlunos.length === 0}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-amber-500/10 hover:bg-amber-500/15 disabled:opacity-50 text-amber-600 dark:text-amber-400 rounded-lg text-xs font-bold transition-all"
                        title="Rodar todos os alunos da turma"
                      >
                        <RefreshCw className="h-3.5 w-3.5" /> Rodar Turma
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto pr-1">
                    <div className="flex flex-col gap-2 mb-3 border-b pb-3 border-border/40">
                      <h4 className="text-xs font-bold uppercase text-muted-foreground tracking-wider">
                        Alunos Matriculados ({selectedTurmaAlunos.length})
                      </h4>
                      {selectedTurma && selectedTurmaAlunos.length > 0 && (
                        <div className="flex items-center flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => setFiltroClinicaTurma(filtroClinicaTurma === 'A' ? null : 'A')}
                            className={`text-xs font-semibold px-2.5 py-0.5 rounded-md border transition-all ${
                              filtroClinicaTurma === 'A'
                                ? 'bg-primary border-primary text-primary-foreground shadow-xs'
                                : 'bg-primary/10 border-transparent text-primary hover:bg-primary/20'
                            }`}
                            title="Filtrar por esta clínica"
                          >
                            {getGrupoLabel(selectedTurma.periodo, 'A')}: {selectedTurmaAlunos.filter(a => a.grupo === 'A').length}
                          </button>
                          <button
                            type="button"
                            onClick={() => setFiltroClinicaTurma(filtroClinicaTurma === 'B' ? null : 'B')}
                            className={`text-xs font-semibold px-2.5 py-0.5 rounded-md border transition-all ${
                              filtroClinicaTurma === 'B'
                                ? 'bg-primary border-primary text-primary-foreground shadow-xs'
                                : 'bg-primary/10 border-transparent text-primary hover:bg-primary/20'
                            }`}
                            title="Filtrar por esta clínica"
                          >
                            {getGrupoLabel(selectedTurma.periodo, 'B')}: {selectedTurmaAlunos.filter(a => a.grupo === 'B').length}
                          </button>
                          {selectedTurmaAlunos.some(a => !a.grupo) && (
                            <button
                              type="button"
                              onClick={() => setFiltroClinicaTurma(filtroClinicaTurma === 'sem_clinica' ? null : 'sem_clinica')}
                              className={`text-xs font-semibold px-2.5 py-0.5 rounded-md border transition-all ${
                                filtroClinicaTurma === 'sem_clinica'
                                  ? 'bg-slate-700 border-slate-700 text-slate-100 shadow-xs dark:bg-slate-600 dark:border-slate-600'
                                  : 'bg-slate-200 border-transparent text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700'
                              }`}
                              title="Filtrar por alunos sem clínica"
                            >
                              Sem Clínica: {selectedTurmaAlunos.filter(a => !a.grupo).length}
                            </button>
                          )}
                          {filtroClinicaTurma && (
                            <button
                              type="button"
                              onClick={() => setFiltroClinicaTurma(null)}
                              className="text-[10px] text-muted-foreground hover:text-foreground underline ml-1"
                            >
                              Limpar Filtro
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    {selectedTurmaAlunos.length > 0 ? (
                      <div className="flex flex-col gap-2">
                        {selectedTurmaAlunos
                          .filter(aluno => {
                            if (!filtroClinicaTurma) return true;
                            if (filtroClinicaTurma === 'A') return aluno.grupo === 'A';
                            if (filtroClinicaTurma === 'B') return aluno.grupo === 'B';
                            if (filtroClinicaTurma === 'sem_clinica') return !aluno.grupo;
                            return true;
                          })
                          .map(aluno => (
                          <div 
                            key={aluno.id}
                            className="p-3 bg-slate-50 dark:bg-slate-900 border border-border/40 rounded-lg flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors group"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{aluno.nome}</p>
                              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                <p className="text-xs text-muted-foreground truncate">{aluno.matricula || 'Sem matrícula'}</p>
                                {aluno.grupo ? (
                                  <span className="text-[10px] font-bold px-1.5 py-0.2 bg-primary/10 text-primary rounded-sm uppercase">
                                    {selectedTurma ? getGrupoLabel(selectedTurma.periodo, aluno.grupo) : `Grupo ${aluno.grupo}`}
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-medium px-1.5 py-0.2 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-sm">
                                    Sem Clínica
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <select
                                value={aluno.grupo || ''}
                                onChange={(e) => handleUpdateAlunoGrupo(aluno.id, e.target.value || null)}
                                className="text-xs border rounded px-1.5 py-0.5 bg-card text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary max-w-[150px]"
                              >
                                <option value="">Sem Clínica</option>
                                <option value="A">
                                  {selectedTurma ? getGrupoLabel(selectedTurma.periodo, 'A') : 'Grupo A'}
                                </option>
                                <option value="B">
                                  {selectedTurma ? getGrupoLabel(selectedTurma.periodo, 'B') : 'Grupo B'}
                                </option>
                              </select>
                              <button 
                                onClick={() => handleDesvincularAluno(aluno.id)}
                                className="text-muted-foreground hover:text-rose-600 p-1.5 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/20 opacity-0 group-hover:opacity-100 transition-all"
                                title="Desvincular Aluno"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-8 text-center text-muted-foreground text-sm border border-dashed rounded-lg mt-2">
                        Nenhum aluno vinculado a esta turma.
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center text-center text-muted-foreground p-6">
                  <BookOpen className="h-10 w-10 text-muted-foreground/40 mb-3" />
                  <p className="font-semibold text-sm">Nenhuma turma selecionada</p>
                  <p className="text-xs mt-1">Clique em uma turma ao lado para visualizar os alunos vinculados e gerenciá-los.</p>
                </div>
              )}
            </div>

          </div>
        )}

        {/* ABA: ALUNOS */}
        {activeTab === 'alunos' && (
          selectedFichaAluno ? (
            <div className="bg-card border rounded-xl p-6 shadow-sm flex flex-col gap-6 animate-in fade-in duration-200">
              {/* Topo da Ficha (Nome e Botão Voltar) */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setSelectedFichaAluno(null)}
                    className="p-2 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-all border flex items-center gap-1 text-xs font-bold"
                  >
                    <ChevronLeft className="h-4 w-4" /> Voltar para a lista
                  </button>
                  <div>
                    <h2 className="text-2xl font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                      {selectedFichaAluno.nome}
                    </h2>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      {selectedFichaAluno.matricula && (
                        <span>Matrícula: <strong className="font-mono text-slate-700 dark:text-slate-300">{selectedFichaAluno.matricula}</strong></span>
                      )}
                      {selectedFichaAluno.email && (
                        <span>E-mail: <strong className="text-slate-700 dark:text-slate-300">{selectedFichaAluno.email}</strong></span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Resumo de Frequência Rápido */}
                <div className="flex items-center gap-2.5">
                  <div className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-lg text-center min-w-[70px]">
                    <p className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400">Presenças</p>
                    <p className="text-lg font-black text-emerald-700 dark:text-emerald-300">{fichaPresencasCount.presente}</p>
                  </div>
                  <div className="px-3 py-1.5 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-lg text-center min-w-[70px]">
                    <p className="text-[10px] uppercase font-bold text-rose-600 dark:text-rose-400">Faltas</p>
                    <p className="text-lg font-black text-rose-700 dark:text-rose-300">{fichaPresencasCount.ausente}</p>
                  </div>
                  <div className="px-3 py-1.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-lg text-center min-w-[70px]">
                    <p className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400">Justificativas</p>
                    <p className="text-lg font-black text-amber-700 dark:text-amber-300">{fichaPresencasCount.justificado}</p>
                  </div>
                </div>
              </div>

              {loadingFicha ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
                  <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm font-semibold">Carregando ficha acadêmica...</p>
                </div>
              ) : (
                <div className="flex flex-col lg:flex-row gap-6">
                  {/* Navegação Lateral das Abas da Ficha */}
                  <div className="flex lg:flex-col gap-1 border-b lg:border-b-0 lg:border-r border-border pb-4 lg:pb-0 lg:pr-6 lg:w-[220px] shrink-0">
                    <button
                      onClick={() => setFichaAbaAtiva('notas')}
                      className={`px-4 py-2 text-left text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${
                        fichaAbaAtiva === 'notas' 
                          ? 'bg-primary text-primary-foreground shadow-xs' 
                          : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Award className="h-4 w-4" /> Desempenho e Notas
                    </button>
                    <button
                      onClick={() => setFichaAbaAtiva('atestados')}
                      className={`px-4 py-2 text-left text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${
                        fichaAbaAtiva === 'atestados' 
                          ? 'bg-primary text-primary-foreground shadow-xs' 
                          : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <FileText className="h-4 w-4" /> Atestados Médicos
                    </button>
                    <button
                      onClick={() => setFichaAbaAtiva('reposicoes')}
                      className={`px-4 py-2 text-left text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${
                        fichaAbaAtiva === 'reposicoes' 
                          ? 'bg-primary text-primary-foreground shadow-xs' 
                          : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Calendar className="h-4 w-4" /> Reposição de Aulas
                    </button>

                    {/* Vínculo de Turmas Atuais na barra lateral */}
                    <div className="hidden lg:block mt-6 pt-6 border-t border-border/60">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider mb-2">Turmas Ativas</p>
                      {fichaTurmas.length > 0 ? (
                        <div className="flex flex-col gap-1.5">
                          {fichaTurmas.map((t: any, idx: number) => (
                            <div key={idx} className="p-2 rounded bg-slate-50 dark:bg-slate-900 border text-xs">
                              <p className="font-semibold text-slate-800 dark:text-slate-200">{t.internato_turmas?.nome}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">Período: {t.internato_turmas?.periodo}</p>
                              {t.grupo && (
                                <span className="mt-1 text-[9px] font-bold px-1 py-0.2 bg-primary/10 text-primary rounded-sm uppercase inline-block">
                                  {getGrupoLabel(t.internato_turmas?.periodo, t.grupo)}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">Sem turmas associadas.</p>
                      )}
                    </div>
                  </div>

                  {/* Área de Conteúdo da Aba Ativa */}
                  <div className="flex-1 min-w-0">
                    {/* ABA: DESEMPENHO E NOTAS */}
                    {fichaAbaAtiva === 'notas' && (
                      <div className="flex flex-col gap-4 animate-in fade-in duration-150">
                        <div className="flex items-center justify-between border-b pb-2">
                          <h3 className="text-lg font-bold text-slate-800 dark:text-white">Desempenho e Notas</h3>
                          {fichaNotas.length > 0 && (
                            <span className="text-xs font-semibold px-2.5 py-1 bg-primary/10 text-primary rounded-full">
                              Média Geral: {(fichaNotas.reduce((acc, c) => acc + Number(c.nota), 0) / fichaNotas.length).toFixed(2)}
                            </span>
                          )}
                        </div>

                        {fichaNotas.length > 0 ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Agrupar notas por clínica */}
                            {Array.from(new Set(fichaNotas.map(n => n.clinica))).map(clinica => {
                              const notasClinica = fichaNotas.filter(n => n.clinica === clinica);
                              const mediaClinica = notasClinica.reduce((acc, c) => acc + Number(c.nota), 0) / notasClinica.length;

                              return (
                                <div key={clinica} className="border border-border/60 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-900/30 flex flex-col gap-3 shadow-xs">
                                  <div className="flex items-center justify-between border-b pb-1.5">
                                    <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-100 uppercase tracking-wider">{clinica}</h4>
                                    <span className="text-xs font-black text-primary bg-primary/10 px-2 py-0.5 rounded">
                                      Média: {mediaClinica.toFixed(2)}
                                    </span>
                                  </div>
                                  <div className="flex flex-col gap-2">
                                    {notasClinica.map(nota => (
                                      <div key={nota.id} className="flex justify-between items-center text-xs py-1 hover:bg-muted/30 px-1 rounded transition-colors">
                                        <div className="min-w-0 flex-1">
                                          <p className="font-semibold text-slate-700 dark:text-slate-300 truncate">{nota.descricao}</p>
                                          <p className="text-[10px] text-muted-foreground truncate">{nota.internato_turmas?.nome}</p>
                                        </div>
                                        <span className="font-black text-sm text-slate-800 dark:text-slate-200 ml-4">{Number(nota.nota).toFixed(1)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="p-8 text-center text-muted-foreground text-sm border border-dashed rounded-xl">
                            Nenhuma nota lançada para este aluno.
                          </div>
                        )}
                      </div>
                    )}

                    {/* ABA: ATESTADOS MÉDICOS */}
                    {fichaAbaAtiva === 'atestados' && (
                      <div className="flex flex-col lg:flex-row gap-6 animate-in fade-in duration-150">
                        {/* Listagem de Atestados */}
                        <div className="flex-1 flex flex-col gap-4">
                          <h3 className="text-lg font-bold text-slate-800 dark:text-white border-b pb-2">Histórico de Atestados</h3>
                          {fichaAtestados.length > 0 ? (
                            <div className="flex flex-col gap-3">
                              {fichaAtestados.map(atest => (
                                <div key={atest.id} className="p-3 bg-slate-50 dark:bg-slate-900 border border-border/50 rounded-lg flex items-start justify-between gap-4">
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                      Período: {new Date(atest.data_inicio).toLocaleDateString('pt-BR')} até {new Date(atest.data_fim).toLocaleDateString('pt-BR')}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line">{atest.motivo}</p>
                                  </div>
                                  {atest.documento_url && (
                                    <a 
                                      href={atest.documento_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="py-1 px-2.5 bg-primary text-primary-foreground text-[10px] font-bold rounded hover:bg-primary/95 flex items-center gap-1 transition-all shrink-0"
                                    >
                                      Visualizar Anexo
                                    </a>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="p-8 text-center text-muted-foreground text-sm border border-dashed rounded-xl">
                              Nenhum atestado registrado.
                            </div>
                          )}
                        </div>

                        {/* Formulário Novo Atestado */}
                        <div className="w-full lg:w-[320px] shrink-0 bg-slate-50 dark:bg-slate-950 p-4 border border-border/80 rounded-xl flex flex-col gap-4">
                          <h4 className="font-extrabold text-sm text-slate-800 dark:text-white flex items-center gap-1">
                            Registrar Novo Atestado
                          </h4>
                          <form onSubmit={handleCreateAtestadoFicha} className="flex flex-col gap-3">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 block">Início</label>
                                <input 
                                  type="date"
                                  required
                                  value={novoAtestadoFicha.data_inicio}
                                  onChange={e => setNovoAtestadoFicha(prev => ({ ...prev, data_inicio: e.target.value }))}
                                  className="w-full border rounded px-2.5 py-1.5 bg-card text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 block">Fim</label>
                                <input 
                                  type="date"
                                  required
                                  value={novoAtestadoFicha.data_fim}
                                  onChange={e => setNovoAtestadoFicha(prev => ({ ...prev, data_fim: e.target.value }))}
                                  className="w-full border rounded px-2.5 py-1.5 bg-card text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 block">Motivo / Justificativa</label>
                              <textarea 
                                required
                                rows={3}
                                placeholder="CID, justificativa médica"
                                value={novoAtestadoFicha.motivo}
                                onChange={e => setNovoAtestadoFicha(prev => ({ ...prev, motivo: e.target.value }))}
                                className="w-full border rounded px-2.5 py-1.5 bg-card text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                              />
                            </div>

                            <div>
                              <label className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 block">Anexar Documento (Opcional)</label>
                              <input 
                                id="atestado-file-input"
                                type="file"
                                accept="image/*,application/pdf"
                                onChange={e => setNovoAtestadoFicha(prev => ({ ...prev, arquivo: e.target.files ? e.target.files[0] : null }))}
                                className="w-full text-xs text-muted-foreground file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[10px] file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
                              />
                            </div>

                            <button 
                              type="submit"
                              disabled={submittingFichaAction}
                              className="w-full py-2 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/95 text-xs transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                            >
                              {submittingFichaAction ? (
                                <>
                                  <RefreshCw className="h-3 w-3 animate-spin" /> Registrando...
                                </>
                              ) : (
                                <>
                                  <Upload className="h-3.5 w-3.5" /> Registrar Atestado
                                </>
                              )}
                            </button>
                          </form>
                        </div>
                      </div>
                    )}

                    {/* ABA: REPOSIÇÃO DE AULAS */}
                    {fichaAbaAtiva === 'reposicoes' && (
                      <div className="flex flex-col lg:flex-row gap-6 animate-in fade-in duration-150">
                        {/* Listagem de Reposições */}
                        <div className="flex-1 flex flex-col gap-4">
                          <h3 className="text-lg font-bold text-slate-800 dark:text-white border-b pb-2">Reposições Solicitadas</h3>
                          {fichaReposicoes.length > 0 ? (
                            <div className="flex flex-col gap-3">
                              {fichaReposicoes.map(rep => (
                                <div key={rep.id} className="p-3 bg-slate-50 dark:bg-slate-900 border border-border/50 rounded-lg flex items-start justify-between gap-4">
                                  <div className="min-w-0 flex-1 flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
                                      <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-sm uppercase ${
                                        rep.status === 'concluida' 
                                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400' 
                                          : 'bg-amber-100 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400'
                                      }`}>
                                        {rep.status === 'concluida' ? 'Concluída' : 'Pendente'}
                                      </span>
                                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                        Clínica: {rep.clinica}
                                      </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                      Data da Falta: <strong className="font-semibold text-slate-700 dark:text-slate-300">{new Date(rep.data_falta).toLocaleDateString('pt-BR')}</strong>
                                    </p>
                                    {rep.data_reposicao && (
                                      <p className="text-xs text-muted-foreground">
                                        Data da Reposição: <strong className="font-semibold text-slate-700 dark:text-slate-300">{new Date(rep.data_reposicao).toLocaleDateString('pt-BR')}</strong>
                                      </p>
                                    )}
                                    {rep.observacao && (
                                      <p className="text-xs text-muted-foreground mt-1 bg-card/60 p-1.5 border rounded border-border/40 italic">
                                        Obs: {rep.observacao}
                                      </p>
                                    )}
                                    {rep.internato_turmas && (
                                      <p className="text-[10px] text-muted-foreground">Turma: {rep.internato_turmas.nome}</p>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      onClick={() => handleToggleStatusReposicao(rep)}
                                      className={`py-1 px-2 text-[10px] font-bold rounded-lg border transition-all ${
                                        rep.status === 'concluida'
                                          ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                                          : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                                      }`}
                                      title={rep.status === 'concluida' ? 'Marcar como Pendente' : 'Marcar como Concluída'}
                                    >
                                      {rep.status === 'concluida' ? 'Pendente' : 'Concluída'}
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteReposicao(rep.id)}
                                      className="text-muted-foreground hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all"
                                      title="Excluir Reposição"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="p-8 text-center text-muted-foreground text-sm border border-dashed rounded-xl">
                              Nenhuma reposição de aula solicitada ou pendente.
                            </div>
                          )}
                        </div>

                        {/* Formulário Nova Reposição */}
                        <div className="w-full lg:w-[320px] shrink-0 bg-slate-50 dark:bg-slate-950 p-4 border border-border/80 rounded-xl flex flex-col gap-4">
                          <h4 className="font-extrabold text-sm text-slate-800 dark:text-white flex items-center gap-1">
                            Lançar Reposição de Aula
                          </h4>
                          <form onSubmit={handleCreateReposicaoFicha} className="flex flex-col gap-3">
                            <div>
                              <label className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 block">Vincular à Turma</label>
                              <select 
                                value={novaReposicaoFicha.turma_id}
                                onChange={e => setNovaReposicaoFicha(prev => ({ ...prev, turma_id: e.target.value }))}
                                className="w-full border rounded px-2.5 py-1.5 bg-card text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                              >
                                <option value="">Selecione a turma...</option>
                                {fichaTurmas.map((t: any, idx: number) => (
                                  <option key={idx} value={t.internato_turmas?.id}>
                                    {t.internato_turmas?.nome} ({t.internato_turmas?.periodo})
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 block">Clínica</label>
                              <select 
                                required
                                value={novaReposicaoFicha.clinica}
                                onChange={e => setNovaReposicaoFicha(prev => ({ ...prev, clinica: e.target.value }))}
                                className="w-full border rounded px-2.5 py-1.5 bg-card text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                              >
                                <option value="">Selecione a clínica...</option>
                                {CLINICAS.map(c => (
                                  <option key={c.id} value={c.nome}>{c.nome}</option>
                                ))}
                              </select>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 block">Data Falta</label>
                                <input 
                                  type="date"
                                  required
                                  value={novaReposicaoFicha.data_falta}
                                  onChange={e => setNovaReposicaoFicha(prev => ({ ...prev, data_falta: e.target.value }))}
                                  className="w-full border rounded px-2.5 py-1.5 bg-card text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 block">Data Reposição</label>
                                <input 
                                  type="date"
                                  value={novaReposicaoFicha.data_reposicao}
                                  onChange={e => setNovaReposicaoFicha(prev => ({ ...prev, data_reposicao: e.target.value }))}
                                  className="w-full border rounded px-2.5 py-1.5 bg-card text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 block">Status Inicial</label>
                              <div className="flex gap-2">
                                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                                  <input 
                                    type="radio" 
                                    name="status_reposicao" 
                                    checked={novaReposicaoFicha.status === 'pendente'}
                                    onChange={() => setNovaReposicaoFicha(prev => ({ ...prev, status: 'pendente' }))}
                                    className="rounded border-gray-300 text-primary focus:ring-primary h-3.5 w-3.5"
                                  />
                                  Pendente
                                </label>
                                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                                  <input 
                                    type="radio" 
                                    name="status_reposicao" 
                                    checked={novaReposicaoFicha.status === 'concluida'}
                                    onChange={() => setNovaReposicaoFicha(prev => ({ ...prev, status: 'concluida' }))}
                                    className="rounded border-gray-300 text-primary focus:ring-primary h-3.5 w-3.5"
                                  />
                                  Concluída
                                </label>
                              </div>
                            </div>

                            <div>
                              <label className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 block">Observação</label>
                              <textarea 
                                rows={2}
                                placeholder="Detalhes, justificativa, etc."
                                value={novaReposicaoFicha.observacao}
                                onChange={e => setNovaReposicaoFicha(prev => ({ ...prev, observacao: e.target.value }))}
                                className="w-full border rounded px-2.5 py-1.5 bg-card text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                              />
                            </div>

                            <button 
                              type="submit"
                              disabled={submittingFichaAction}
                              className="w-full py-2 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/95 text-xs transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                            >
                              {submittingFichaAction ? (
                                <>
                                  <RefreshCw className="h-3 w-3 animate-spin" /> Salvando...
                                </>
                              ) : (
                                <>
                                  <Plus className="h-3.5 w-3.5" /> Lançar Reposição
                                </>
                              )}
                            </button>
                          </form>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-card border rounded-xl p-4 shadow-sm flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row gap-3 items-center">
                <div className="relative w-full max-w-md">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <input 
                    type="text"
                    placeholder="Buscar aluno por nome ou matrícula..."
                    value={searchTermAlunos}
                    onChange={e => setSearchTermAlunos(e.target.value)}
                    className="pl-9 pr-4 py-2 border rounded-lg w-full bg-card placeholder-muted-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                
                <select
                  value={filtroTurmaAluno}
                  onChange={e => setFiltroTurmaAluno(e.target.value)}
                  className="border rounded-lg px-3 py-2 bg-card text-sm focus:outline-none focus:ring-1 focus:ring-primary font-medium w-full sm:w-64"
                >
                  <option value="">Todas as Turmas</option>
                  {turmas.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.nome} ({t.periodo})
                    </option>
                  ))}
                </select>
              </div>

              <div className="overflow-auto rounded-lg border border-border max-h-[calc(100vh-17rem)]">
                <table className="w-full text-left text-sm border-collapse">
                  <thead className="bg-slate-50 dark:bg-slate-900 border-b border-border text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-3.5">Nome</th>
                      <th className="px-6 py-3.5">Matrícula</th>
                      <th className="px-6 py-3.5">E-mail</th>
                      <th className="px-6 py-3.5 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border font-medium">
                    {currentAlunos.length > 0 ? (
                      currentAlunos.map(aluno => (
                        <tr key={aluno.id} className="hover:bg-muted/40 transition-colors">
                          <td className="px-6 py-3">
                            <button
                              onClick={() => handleAbrirFichaAluno(aluno)}
                              className="text-slate-800 dark:text-slate-200 font-bold text-left hover:underline hover:text-primary transition-all focus:outline-none"
                            >
                              {aluno.nome}
                            </button>
                          </td>
                          <td className="px-6 py-3 font-mono text-muted-foreground">{aluno.matricula || '-'}</td>
                          <td className="px-6 py-3 text-muted-foreground">{aluno.email || '-'}</td>
                          <td className="px-6 py-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => {
                                  setEditAlunoForm({
                                    id: aluno.id,
                                    nome: aluno.nome,
                                    email: aluno.email,
                                    matricula: aluno.matricula
                                  });
                                  setShowEditAlunoModal(true);
                                }}
                                className="text-muted-foreground hover:text-primary p-1.5 rounded-lg hover:bg-primary/10 transition-all"
                                title="Editar Aluno"
                              >
                                <Edit2 className="h-4.5 w-4.5" />
                              </button>
                              <button 
                                onClick={async () => {
                                  if (confirm(`Deseja realmente remover o aluno ${aluno.nome}?`)) {
                                    try {
                                      const { error } = await supabase.from('internato_alunos').delete().eq('id', aluno.id);
                                      if (error) throw error;
                                      showToast('Aluno removido com sucesso!');
                                      fetchAlunos();
                                    } catch (err: any) {
                                      showToast(err.message || 'Erro ao remover aluno', 'error');
                                    }
                                  }
                                }}
                                className="text-muted-foreground hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all"
                                title="Remover Aluno"
                              >
                                <Trash2 className="h-4.5 w-4.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-6 py-10 text-center text-muted-foreground border-none">
                          Nenhum aluno encontrado ou cadastrado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* PAGINAÇÃO DE ALUNOS */}
              {totalPagesAlunos > 1 && (
                <div className="p-4 border-t border-border bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-between mt-3 rounded-lg border">
                  <div className="text-xs text-muted-foreground">
                    Mostrando <span className="font-semibold text-foreground">{indexOfFirstAluno + 1}</span> a <span className="font-semibold text-foreground">{Math.min(indexOfLastAluno, filteredAlunos.length)}</span> de <span className="font-semibold text-foreground">{filteredAlunos.length}</span> alunos
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPageAlunos(p => Math.max(1, p - 1))}
                      disabled={currentPageAlunos === 1}
                      className="h-8 w-8 inline-flex items-center justify-center rounded border border-border bg-card text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPagesAlunos) }, (_, i) => {
                        let pageNum = currentPageAlunos;
                        if (currentPageAlunos <= 3) pageNum = i + 1;
                        else if (currentPageAlunos >= totalPagesAlunos - 2) pageNum = totalPagesAlunos - 4 + i;
                        else pageNum = currentPageAlunos - 2 + i;

                        if (pageNum <= 0 || pageNum > totalPagesAlunos) return null;

                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPageAlunos(pageNum)}
                            className={`h-8 w-8 rounded text-xs font-semibold transition-all ${
                              currentPageAlunos === pageNum
                                ? 'bg-primary text-primary-foreground shadow-sm'
                                : 'bg-card border border-border text-foreground hover:bg-muted'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      onClick={() => setCurrentPageAlunos(p => Math.min(totalPagesAlunos, p + 1))}
                      disabled={currentPageAlunos === totalPagesAlunos}
                      className="h-8 w-8 inline-flex items-center justify-center rounded border border-border bg-card text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        )}

        {/* ABA: FREQUÊNCIA (PRESENÇA) */}
        {activeTab === 'presenca' && (
          <div className="bg-card border rounded-xl p-4 shadow-sm flex flex-col gap-4 h-[calc(100vh-16rem)] min-h-[450px]">
            
            {/* Controles de Lançamento */}
            <div className="flex flex-col md:flex-row md:items-end gap-4 border-b border-border/50 pb-5">
              <div className="flex-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2 block">
                  Selecione a Turma
                </label>
                <select 
                  value={presencaTurmaId}
                  onChange={e => {
                    setPresencaTurmaId(e.target.value);
                    setPresencaAlunos([]);
                  }}
                  className="w-full border rounded-lg px-3 py-2 bg-card text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Selecione uma turma...</option>
                  {turmas.filter(t => t.ativa).map(t => (
                    <option key={t.id} value={t.id}>{t.nome} ({t.periodo})</option>
                  ))}
                </select>
              </div>

              <div className="flex-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2 block">
                  Clínica / Rodízio
                </label>
                <select 
                  value={presencaClinica}
                  onChange={e => {
                    setPresencaClinica(e.target.value);
                    setPresencaAlunos([]);
                  }}
                  className="w-full border rounded-lg px-3 py-2 bg-card text-sm focus:outline-none focus:ring-1 focus:ring-primary font-medium"
                >
                  <option value="">Selecione a clínica...</option>
                  {(() => {
                    const turmaSel = turmas.find(t => t.id === presencaTurmaId);
                    const clinicasFiltradas = turmaSel ? getClinicasPorPeriodo(turmaSel.periodo) : CLINICAS;
                    return clinicasFiltradas.map(c => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ));
                  })()}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2 block">
                  Data da Chamada
                </label>
                <input 
                  type="date"
                  value={presencaData}
                  onChange={e => {
                    setPresencaData(e.target.value);
                    setPresencaAlunos([]);
                  }}
                  className="w-full border rounded-lg px-3 py-2 bg-card text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <button 
                onClick={handleLoadPresencaAlunos}
                disabled={!presencaTurmaId || !presencaClinica}
                className="flex items-center justify-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/95 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Carregar Chamada
              </button>
            </div>

            {/* Listagem de Alunos para Lançamento */}
            {presencaAlunos.length > 0 ? (
              <div className="flex flex-col gap-3 flex-1 overflow-hidden">
                <div className="flex items-center justify-between border-b border-border/40 pb-3">
                  <h3 className="font-bold text-sm text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Alunos da Turma ({presencaAlunos.length})
                  </h3>
                  <button
                    onClick={handleMarcarTodosPresentes}
                    className="text-xs text-primary hover:underline font-bold"
                  >
                    Marcar todos como Presente
                  </button>
                </div>

                <div className="flex flex-col gap-2 flex-1 overflow-y-auto pr-1">
                  {presencaAlunos.map(aluno => {
                    const localPres = presencasMap[aluno.id] || { status: 'presente', observacao: '' };
                    return (
                      <div 
                        key={aluno.id}
                        className="p-4 bg-slate-50 dark:bg-slate-900 border border-border/60 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-slate-800 dark:text-slate-100">{aluno.nome}</p>
                            {aluno.grupo && (
                              <span className="text-[9px] font-extrabold px-1.5 py-0.2 bg-primary/10 text-primary rounded-sm uppercase">
                                {(() => {
                                  const turmaSel = turmas.find(t => t.id === presencaTurmaId);
                                  return turmaSel ? getGrupoLabel(turmaSel.periodo, aluno.grupo) : `Grupo ${aluno.grupo}`;
                                })()}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">Matrícula: {aluno.matricula || 'Sem matrícula'}</p>
                        </div>

                        {/* Botões de Ações de Presença */}
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => handleStatusChange(aluno.id, 'presente')}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all flex items-center gap-1 ${
                              localPres.status === 'presente'
                                ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm shadow-emerald-500/20'
                                : 'bg-card text-muted-foreground hover:text-foreground border-border'
                            }`}
                          >
                            <Check className="h-3.5 w-3.5" /> Presente
                          </button>
                          
                          <button
                            onClick={() => handleStatusChange(aluno.id, 'ausente')}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all flex items-center gap-1 ${
                              localPres.status === 'ausente'
                                ? 'bg-rose-500 text-white border-rose-500 shadow-sm shadow-rose-500/20'
                                : 'bg-card text-muted-foreground hover:text-foreground border-border'
                            }`}
                          >
                            <X className="h-3.5 w-3.5" /> Ausente
                          </button>

                          <button
                            onClick={() => handleStatusChange(aluno.id, 'justificado')}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all flex items-center gap-1 ${
                              localPres.status === 'justificado'
                                ? 'bg-amber-500 text-white border-amber-500 shadow-sm shadow-amber-500/20'
                                : 'bg-card text-muted-foreground hover:text-foreground border-border'
                            }`}
                          >
                            <AlertCircle className="h-3.5 w-3.5" /> Justificado
                          </button>

                          <input 
                            type="text"
                            placeholder="Obs. (ex: Atestado)"
                            value={localPres.observacao}
                            onChange={e => handleObservacaoChange(aluno.id, e.target.value)}
                            className="border rounded-lg px-2.5 py-1 text-xs bg-card focus:outline-none focus:ring-1 focus:ring-primary w-40 placeholder-muted-foreground/60 text-slate-700 dark:text-slate-300"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-end mt-4 border-t border-border/40 pt-4">
                  <button 
                    onClick={handleSalvarPresenca}
                    disabled={loading}
                    className="px-6 py-2.5 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/95 transition-all text-sm shadow-sm hover:shadow-md"
                  >
                    {loading ? 'Salvando...' : 'Salvar Frequência'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                <Calendar className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <h4 className="font-semibold text-slate-700 dark:text-slate-300 text-sm">Lançamento de Frequência</h4>
                <p className="text-xs max-w-sm mt-1">
                  Selecione uma turma e a data da chamada, depois clique em "Carregar Chamada" para lançar a frequência dos alunos.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ABA: ATESTADOS */}
        {activeTab === 'atestados' && (
          <div className="bg-card border rounded-xl p-4 shadow-sm flex flex-col gap-3">
            <h3 className="font-extrabold text-lg text-slate-800 dark:text-slate-100">Atestados Registrados</h3>
            
            <div className="overflow-auto rounded-lg border border-border max-h-[calc(100vh-17rem)]">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-900 border-b border-border text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3.5">Aluno</th>
                    <th className="px-6 py-3.5">Início</th>
                    <th className="px-6 py-3.5">Fim</th>
                    <th className="px-6 py-3.5">Motivo / Observação</th>
                    <th className="px-6 py-3.5 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-medium">
                  {atestados.length > 0 ? (
                    atestados.map(atestado => (
                      <tr key={atestado.id} className="hover:bg-muted/40 transition-colors">
                        <td className="px-6 py-3 text-slate-800 dark:text-slate-200 font-bold">{atestado.aluno_nome}</td>
                        <td className="px-6 py-3 text-muted-foreground">{new Date(atestado.data_inicio).toLocaleDateString('pt-BR')}</td>
                        <td className="px-6 py-3 text-muted-foreground">{new Date(atestado.data_fim).toLocaleDateString('pt-BR')}</td>
                        <td className="px-6 py-3 text-slate-700 dark:text-slate-300 max-w-xs truncate">{atestado.motivo}</td>
                        <td className="px-6 py-3 text-center">
                          <button 
                            onClick={async () => {
                              if (confirm('Deseja realmente excluir este atestado?')) {
                                try {
                                  const { error } = await supabase.from('internato_atestados').delete().eq('id', atestado.id);
                                  if (error) throw error;
                                  showToast('Atestado excluído com sucesso!');
                                  fetchAtestados();
                                } catch (err: any) {
                                  showToast(err.message || 'Erro ao excluir atestado', 'error');
                                }
                              }
                            }}
                            className="text-muted-foreground hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all"
                            title="Remover Atestado"
                          >
                            <Trash2 className="h-4.5 w-4.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-muted-foreground border-none">
                        Nenhum atestado registrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ABA: PROFESSORES */}
        {activeTab === 'professores' && (
          <div className="bg-card border rounded-xl p-4 shadow-sm flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-extrabold text-lg text-slate-800 dark:text-slate-100">Professores Cadastrados</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Gerencie os professores disponíveis para vinculação na agenda do internato.</p>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <input 
                  type="text"
                  placeholder="Buscar professor..."
                  value={searchTermProfessores}
                  onChange={e => setSearchTermProfessores(e.target.value)}
                  className="pl-9 pr-4 py-2 border rounded-lg w-full bg-card placeholder-muted-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
            
            <div className="overflow-auto rounded-lg border border-border max-h-[calc(100vh-17rem)]">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-900 border-b border-border text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3.5">Nome</th>
                    <th className="px-6 py-3.5">E-mail</th>
                    <th className="px-6 py-3.5">Especialidade</th>
                    <th className="px-6 py-3.5 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-medium">
                  {loadingProfessores ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-10 text-center text-muted-foreground border-none">
                        <div className="flex items-center justify-center gap-2">
                          <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                          <span>Carregando professores...</span>
                        </div>
                      </td>
                    </tr>
                  ) : professores.filter(p => 
                      p.nome.toLowerCase().includes(searchTermProfessores.toLowerCase()) || 
                      (p.email && p.email.toLowerCase().includes(searchTermProfessores.toLowerCase())) ||
                      (p.especialidade && p.especialidade.toLowerCase().includes(searchTermProfessores.toLowerCase()))
                    ).length > 0 ? (
                    professores
                      .filter(p => 
                        p.nome.toLowerCase().includes(searchTermProfessores.toLowerCase()) || 
                        (p.email && p.email.toLowerCase().includes(searchTermProfessores.toLowerCase())) ||
                        (p.especialidade && p.especialidade.toLowerCase().includes(searchTermProfessores.toLowerCase()))
                      )
                      .map(prof => (
                        <tr key={prof.id} className="hover:bg-muted/40 transition-colors">
                          <td className="px-6 py-3 text-slate-800 dark:text-slate-200 font-bold">{prof.nome}</td>
                          <td className="px-6 py-3 text-muted-foreground">{prof.email || 'Não informado'}</td>
                          <td className="px-6 py-3 text-slate-700 dark:text-slate-300">{prof.especialidade || 'Não informada'}</td>
                          <td className="px-6 py-3 text-center">
                            <div className="flex justify-center items-center gap-2">
                              <button 
                                onClick={() => {
                                  setEditProfessorForm({ id: prof.id, nome: prof.nome, email: prof.email || '', especialidade: prof.especialidade || '' });
                                  setShowEditProfessorModal(true);
                                }}
                                className="text-muted-foreground hover:text-primary p-1.5 rounded-lg hover:bg-primary/10 transition-all"
                                title="Editar Professor"
                              >
                                <Edit2 className="h-4.5 w-4.5" />
                              </button>
                              <button 
                                onClick={() => handleDeleteProfessor(prof.id)}
                                className="text-muted-foreground hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all"
                                title="Remover Professor"
                              >
                                <Trash2 className="h-4.5 w-4.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-6 py-10 text-center text-muted-foreground border-none">
                        Nenhum professor encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ----------------------------------------------------
          MODAIS
      ---------------------------------------------------- */}

      {/* MODAL: NOVA TURMA */}
      {showTurmaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-card border rounded-2xl w-full max-w-md p-6 shadow-xl relative animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setShowTurmaModal(false)}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground p-1 hover:bg-muted rounded-lg"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="font-extrabold text-xl mb-4 text-slate-800 dark:text-white">Criar Nova Turma</h3>
            
            <form onSubmit={handleCreateTurma} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 block">Nome da Turma</label>
                <input 
                  type="text"
                  required
                  placeholder="Ex: Internato Pediatria 2026.1 A"
                  value={turmaForm.nome}
                  onChange={e => setTurmaForm(prev => ({ ...prev, nome: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 bg-card text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 block">Período Letivo</label>
                <select 
                  required
                  value={turmaForm.periodo}
                  onChange={e => setTurmaForm(prev => ({ ...prev, periodo: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 bg-card text-sm focus:outline-none focus:ring-1 focus:ring-primary font-medium"
                >
                  <option value="">Selecione o período...</option>
                  <option value="10º Período">10º Período</option>
                  <option value="11º Período">11º Período</option>
                  <option value="12º Período">12º Período</option>
                  <option value="Concluído / Formado">Concluído / Formado</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                <button 
                  type="button"
                  onClick={() => setShowTurmaModal(false)}
                  className="px-4 py-2 border rounded-lg text-sm font-semibold hover:bg-muted"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/95 text-sm"
                >
                  Criar Turma
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NOVO ALUNO */}
      {showAlunoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-card border rounded-2xl w-full max-w-md p-6 shadow-xl relative animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setShowAlunoModal(false)}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground p-1 hover:bg-muted rounded-lg"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="font-extrabold text-xl mb-4 text-slate-800 dark:text-white">Cadastrar Novo Aluno</h3>
            
            <form onSubmit={handleCreateAluno} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 block">Nome Completo</label>
                <input 
                  type="text"
                  required
                  placeholder="Nome do aluno"
                  value={alunoForm.nome}
                  onChange={e => setAlunoForm(prev => ({ ...prev, nome: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 bg-card text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 block">E-mail</label>
                <input 
                  type="email"
                  placeholder="Ex: aluno@medicina.com"
                  value={alunoForm.email}
                  onChange={e => setAlunoForm(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 bg-card text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 block">Nº Matrícula / Registro</label>
                <input 
                  type="text"
                  placeholder="Nº Matrícula"
                  value={alunoForm.matricula}
                  onChange={e => setAlunoForm(prev => ({ ...prev, matricula: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 bg-card text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 block">Vincular a uma Turma (Opcional)</label>
                <select 
                  value={alunoForm.turma_id}
                  onChange={e => setAlunoForm(prev => ({ ...prev, turma_id: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 bg-card text-sm focus:outline-none focus:ring-1 focus:ring-primary font-medium"
                >
                  <option value="">Não vincular agora...</option>
                  {turmas.map(t => (
                    <option key={t.id} value={t.id}>{t.nome} ({t.periodo})</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                <button 
                  type="button"
                  onClick={() => {
                    setShowAlunoModal(false);
                    setAlunoForm({ nome: '', email: '', matricula: '', turma_id: '' });
                  }}
                  className="px-4 py-2 border rounded-lg text-sm font-semibold hover:bg-muted"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/95 text-sm"
                >
                  Cadastrar Aluno
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: VINCULAR ALUNO À TURMA */}
      {showVincularModal && selectedTurma && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-card border rounded-2xl w-full max-w-lg p-6 shadow-xl relative animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <button 
              onClick={() => {
                setShowVincularModal(false);
                setVincularAlunosIds([]);
              }}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground p-1 hover:bg-muted rounded-lg"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="font-extrabold text-xl mb-1 text-slate-800 dark:text-white">Vincular Alunos</h3>
            <p className="text-xs text-muted-foreground mb-4">Adicionando alunos na turma: <span className="font-bold text-primary">{selectedTurma.nome}</span></p>
            
            <form onSubmit={handleVincularAlunos} className="flex flex-col gap-4 flex-1 overflow-hidden">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <input 
                  type="text"
                  placeholder="Buscar alunos para vincular..."
                  value={searchTermAlunos}
                  onChange={e => setSearchTermAlunos(e.target.value)}
                  className="pl-9 pr-4 py-1.5 border rounded-lg w-full bg-card placeholder-muted-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex-1 overflow-y-auto max-h-[300px] border border-border rounded-lg p-3">
                {alunos
                  .filter(aluno => !selectedTurmaAlunos.some(sa => sa.id === aluno.id))
                  .filter(aluno => aluno.nome.toLowerCase().includes(searchTermAlunos.toLowerCase()))
                  .map(aluno => {
                    const vinculos = aluno.internato_turma_alunos || [];
                    const turmaAtivaVinculada = vinculos.find(v => v.internato_turmas?.ativa);
                    
                    return (
                      <label 
                        key={aluno.id}
                        className="flex items-start gap-3 p-2 hover:bg-muted rounded-lg cursor-pointer transition-colors text-sm"
                      >
                        <input 
                          type="checkbox"
                          checked={vincularAlunosIds.includes(aluno.id)}
                          onChange={e => {
                            if (e.target.checked) {
                              setVincularAlunosIds(prev => [...prev, aluno.id]);
                            } else {
                              setVincularAlunosIds(prev => prev.filter(id => id !== aluno.id));
                            }
                          }}
                          className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4 mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center flex-wrap gap-x-2">
                            <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{aluno.nome}</span>
                            {aluno.matricula && <span className="text-xs text-muted-foreground font-mono">({aluno.matricula})</span>}
                          </div>
                          {turmaAtivaVinculada && (
                            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-sm inline-block mt-0.5">
                              ⚠️ Já na turma ativa: {turmaAtivaVinculada.internato_turmas?.nome}
                            </span>
                          )}
                        </div>
                      </label>
                    );
                  })}
              </div>

              <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                <button 
                  type="button"
                  onClick={() => {
                    setShowVincularModal(false);
                    setVincularAlunosIds([]);
                  }}
                  className="px-4 py-2 border rounded-lg text-sm font-semibold hover:bg-muted"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={vincularAlunosIds.length === 0}
                  className="px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/95 text-sm disabled:opacity-50"
                >
                  Vincular ({vincularAlunosIds.length})
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REGISTRAR ATESTADO */}
      {showAtestadoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-card border rounded-2xl w-full max-w-md p-6 shadow-xl relative animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setShowAtestadoModal(false)}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground p-1 hover:bg-muted rounded-lg"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="font-extrabold text-xl mb-4 text-slate-800 dark:text-white">Lançar Atestado Médico</h3>
            
            <form onSubmit={handleCreateAtestado} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 block">Selecione o Aluno</label>
                <select 
                  required
                  value={atestadoForm.aluno_id}
                  onChange={e => setAtestadoForm(prev => ({ ...prev, aluno_id: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 bg-card text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Selecione o aluno...</option>
                  {alunos.map(aluno => (
                    <option key={aluno.id} value={aluno.id}>{aluno.nome}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 block">Data Início</label>
                  <input 
                    type="date"
                    required
                    value={atestadoForm.data_inicio}
                    onChange={e => setAtestadoForm(prev => ({ ...prev, data_inicio: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 bg-card text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 block">Data Fim</label>
                  <input 
                    type="date"
                    required
                    value={atestadoForm.data_fim}
                    onChange={e => setAtestadoForm(prev => ({ ...prev, data_fim: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 bg-card text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 block">Motivo / Descrição</label>
                <textarea 
                  required
                  rows={3}
                  placeholder="CID, observações médicas, justificativa"
                  value={atestadoForm.motivo}
                  onChange={e => setAtestadoForm(prev => ({ ...prev, motivo: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 bg-card text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                <button 
                  type="button"
                  onClick={() => setShowAtestadoModal(false)}
                  className="px-4 py-2 border rounded-lg text-sm font-semibold hover:bg-muted"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/95 text-sm"
                >
                  Registrar Atestado
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDITAR TURMA */}
      {showEditTurmaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-card border rounded-2xl w-full max-w-md p-6 shadow-xl relative animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setShowEditTurmaModal(false)}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground p-1 hover:bg-muted rounded-lg"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="font-extrabold text-xl mb-4 text-slate-800 dark:text-white">Editar Turma</h3>
            
            <form onSubmit={handleUpdateTurma} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 block">Nome da Turma</label>
                <input 
                  type="text"
                  required
                  placeholder="Nome da Turma"
                  value={editTurmaForm.nome}
                  onChange={e => setEditTurmaForm(prev => ({ ...prev, nome: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 bg-card text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 block">Período Letivo</label>
                <select 
                  required
                  value={editTurmaForm.periodo}
                  onChange={e => setEditTurmaForm(prev => ({ ...prev, periodo: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 bg-card text-sm focus:outline-none focus:ring-1 focus:ring-primary font-medium"
                >
                  <option value="">Selecione o período...</option>
                  <option value="10º Período">10º Período</option>
                  <option value="11º Período">11º Período</option>
                  <option value="12º Período">12º Período</option>
                  <option value="Concluído / Formado">Concluído / Formado</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                <button 
                  type="button"
                  onClick={() => setShowEditTurmaModal(false)}
                  className="px-4 py-2 border rounded-lg text-sm font-semibold hover:bg-muted"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/95 text-sm"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDITAR ALUNO */}
      {showEditAlunoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-card border rounded-2xl w-full max-w-md p-6 shadow-xl relative animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => {
                setShowEditAlunoModal(false);
                setEditAlunoForm({ id: '', nome: '', email: '', matricula: '' });
              }}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground p-1 hover:bg-muted rounded-lg"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="font-extrabold text-xl mb-4 text-slate-800 dark:text-white">Editar Aluno</h3>
            
            <form onSubmit={handleUpdateAluno} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 block">Nome Completo</label>
                <input 
                  type="text"
                  required
                  placeholder="Nome do aluno"
                  value={editAlunoForm.nome}
                  onChange={e => setEditAlunoForm(prev => ({ ...prev, nome: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 bg-card text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 block">E-mail</label>
                <input 
                  type="email"
                  placeholder="Ex: aluno@medicina.com"
                  value={editAlunoForm.email || ''}
                  onChange={e => setEditAlunoForm(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 bg-card text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 block">Nº Matrícula / Registro</label>
                <input 
                  type="text"
                  placeholder="Nº Matrícula"
                  value={editAlunoForm.matricula || ''}
                  onChange={e => setEditAlunoForm(prev => ({ ...prev, matricula: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 bg-card text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                <button 
                  type="button"
                  onClick={() => {
                    setShowEditAlunoModal(false);
                    setEditAlunoForm({ id: '', nome: '', email: '', matricula: '' });
                  }}
                  className="px-4 py-2 border rounded-lg text-sm font-semibold hover:bg-muted"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/95 text-sm"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NOVO PROFESSOR */}
      {showProfessorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-card border rounded-2xl w-full max-w-md p-6 shadow-xl relative animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setShowProfessorModal(false)}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground p-1 hover:bg-muted rounded-lg"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="font-extrabold text-xl mb-4 text-slate-800 dark:text-white">Cadastrar Novo Professor</h3>
            
            <form onSubmit={handleCreateProfessor} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 block">Nome Completo</label>
                <input 
                  type="text"
                  required
                  placeholder="Ex: Dr. João da Silva"
                  value={professorForm.nome}
                  onChange={e => setProfessorForm(prev => ({ ...prev, nome: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 bg-card text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 block">E-mail</label>
                <input 
                  type="email"
                  placeholder="Ex: joao.silva@hsc.com.br"
                  value={professorForm.email}
                  onChange={e => setProfessorForm(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 bg-card text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 block">Especialidade / Clínica</label>
                <input 
                  type="text"
                  placeholder="Ex: Ginecologia e Obstetrícia, Pediatria..."
                  value={professorForm.especialidade}
                  onChange={e => setProfessorForm(prev => ({ ...prev, especialidade: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 bg-card text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex justify-end gap-2 border-t pt-4 mt-2">
                <button 
                  type="button"
                  onClick={() => setShowProfessorModal(false)}
                  className="px-4 py-2 border rounded-lg text-sm font-semibold hover:bg-muted"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/95 shadow-sm"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDITAR PROFESSOR */}
      {showEditProfessorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-card border rounded-2xl w-full max-w-md p-6 shadow-xl relative animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setShowEditProfessorModal(false)}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground p-1 hover:bg-muted rounded-lg"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="font-extrabold text-xl mb-4 text-slate-800 dark:text-white">Editar Professor</h3>
            
            <form onSubmit={handleUpdateProfessor} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 block">Nome Completo</label>
                <input 
                  type="text"
                  required
                  value={editProfessorForm.nome}
                  onChange={e => setEditProfessorForm(prev => ({ ...prev, nome: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 bg-card text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 block">E-mail</label>
                <input 
                  type="email"
                  value={editProfessorForm.email}
                  onChange={e => setEditProfessorForm(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 bg-card text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 block">Especialidade / Clínica</label>
                <input 
                  type="text"
                  placeholder="Ex: Ginecologia e Obstetrícia, Pediatria..."
                  value={editProfessorForm.especialidade}
                  onChange={e => setEditProfessorForm(prev => ({ ...prev, especialidade: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 bg-card text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex justify-end gap-2 border-t pt-4 mt-2">
                <button 
                  type="button"
                  onClick={() => setShowEditProfessorModal(false)}
                  className="px-4 py-2 border rounded-lg text-sm font-semibold hover:bg-muted"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/95 shadow-sm"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Secretaria;
