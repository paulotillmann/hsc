import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  GraduationCap, Search, Users, Award, Save, RefreshCw,
  CheckCircle2, XCircle, AlertCircle, Info, ChevronRight, BarChart2
} from 'lucide-react';

interface Turma {
  id: string;
  nome: string;
  periodo: string;
}

interface Aluno {
  id: string;
  nome: string;
  matricula: string | null;
}

interface NotasAluno {
  teorica: string;
  processual: string;
  osce1: string;
  osce2: string;
  bonificacao: string;
  notaFinal: string;
}

interface NotaLancada {
  aluno_id: string;
  nota: number;
}

interface HistoricoAvaliacao {
  descricao: string;
  clinica: string;
  media: number;
  data: string;
}

interface NotaDetalhe {
  aluno_nome: string;
  aluno_matricula: string | null;
  descricao: string;
  nota: number;
  clinica: string;
}

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
      { id: 'GO', nome: 'Ginecologia e Obstetrícia (G.O.)' },
      { id: 'Pediatria', nome: 'Pediatria' },
      { id: 'Clinica Medica', nome: 'Clínica Médica' },
      { id: 'Clinica Cirurgica', nome: 'Clínica Cirúrgica (Cirurgia)' }
    ];
  }
  if (cleanPeriodo.includes('12º') || cleanPeriodo.includes('12')) {
    return [
      { id: 'GO', nome: 'Ginecologia e Obstetrícia (G.O.)' },
      { id: 'Pediatria', nome: 'Pediatria' },
      { id: 'Clinica Medica', nome: 'Clínica Médica' },
      { id: 'Clinica Cirurgica', nome: 'Clínica Cirúrgica (Cirurgia)' },
      { id: 'Saude Mental', nome: 'Saúde Mental' },
      { id: 'Urgencia Emergencia', nome: 'Urgência e Emergência' }
    ];
  }
  return CLINICAS;
};

const getLimitForCampo = (campo: keyof NotasAluno) => {
  if (campo === 'teorica') return 30;
  if (campo === 'processual') return 30;
  if (campo === 'osce1') return 20;
  if (campo === 'osce2') return 20;
  return 100;
};

const Notas: React.FC = () => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Estados de dados
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [historicoAvaliacoes, setHistoricoAvaliacoes] = useState<HistoricoAvaliacao[]>([]);
  const [notasDetalhes, setNotasDetalhes] = useState<NotaDetalhe[]>([]);

  // Formulário/Seleção
  const [selectedTurmaId, setSelectedTurmaId] = useState<string>('');
  const [notaClinica, setNotaClinica] = useState<string>('GO');
  const [notasMap, setNotasMap] = useState<Record<string, NotasAluno>>({});
  const [originalNotasMap, setOriginalNotasMap] = useState<Record<string, NotasAluno>>({});

  // Abas de visualização internas
  const [subTab, setSubTab] = useState<'lancar' | 'historico'>('lancar');
  const [selectedAvaliacaoFiltro, setSelectedAvaliacaoFiltro] = useState<string>('');
  const [savingStatus, setSavingStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [consolidatedNotas, setConsolidatedNotas] = useState<Record<string, Record<string, number>>>({});

  useEffect(() => {
    fetchTurmas();
  }, []);

  useEffect(() => {
    if (selectedTurmaId) {
      const turmaSel = turmas.find(t => t.id === selectedTurmaId);
      if (turmaSel) {
        const clinicasFiltradas = getClinicasPorPeriodo(turmaSel.periodo);
        if (clinicasFiltradas.length > 0 && !clinicasFiltradas.some(c => c.id === notaClinica)) {
          setNotaClinica(clinicasFiltradas[0].id);
        }
      }
      fetchAlunosDaTurma();
      fetchHistoricoAvaliacoes();
      fetchConsolidatedNotas(selectedTurmaId);
    } else {
      setAlunos([]);
      setHistoricoAvaliacoes([]);
      setNotasMap({});
      setOriginalNotasMap({});
      setConsolidatedNotas({});
    }
  }, [selectedTurmaId, turmas]);

  useEffect(() => {
    if (selectedTurmaId && notaClinica && alunos.length > 0) {
      fetchNotasDaClinica(selectedTurmaId, notaClinica, alunos);
    }
  }, [selectedTurmaId, notaClinica, alunos.length]);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage({ text, type });
  };

  const fetchTurmas = async () => {
    try {
      const { data, error } = await supabase
        .from('internato_turmas')
        .select('*')
        .eq('ativa', true)
        .order('nome');

      if (error) throw error;
      setTurmas(data || []);
    } catch (error: any) {
      showToast(error.message || 'Erro ao carregar turmas', 'error');
    }
  };

  const fetchAlunosDaTurma = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('internato_turma_alunos')
        .select(`
          aluno_id,
          internato_alunos (*)
        `)
        .eq('turma_id', selectedTurmaId);

      if (error) throw error;

      const loadedAlunos = data
        .map((d: any) => d.internato_alunos)
        .filter((a: any) => a !== null) as Aluno[];

      loadedAlunos.sort((a, b) => a.nome.localeCompare(b.nome));
      setAlunos(loadedAlunos);
    } catch (error: any) {
      showToast(error.message || 'Erro ao carregar alunos', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchNotasDaClinica = async (turmaId: string, clinica: string, currentAlunos: Aluno[]) => {
    try {
      const { data, error } = await supabase
        .from('internato_notas')
        .select('*')
        .eq('turma_id', turmaId)
        .eq('clinica', clinica);

      if (error) throw error;

      const initialMap: Record<string, NotasAluno> = {};
      currentAlunos.forEach(aluno => {
        initialMap[aluno.id] = { teorica: '', processual: '', osce1: '', osce2: '', bonificacao: '', notaFinal: '' };
      });

      data?.forEach(n => {
        const alunoId = n.aluno_id;
        if (initialMap[alunoId]) {
          const desc = n.descricao;
          if (desc === 'Teórica') initialMap[alunoId].teorica = String(n.nota);
          else if (desc === 'Processual') initialMap[alunoId].processual = String(n.nota);
          else if (desc === 'OSCE 1') initialMap[alunoId].osce1 = String(n.nota);
          else if (desc === 'OSCE 2') initialMap[alunoId].osce2 = String(n.nota);
          else if (desc === 'Bonificação') initialMap[alunoId].bonificacao = String(n.nota);
          else if (desc === 'Nota Final') initialMap[alunoId].notaFinal = String(n.nota);
        }
      });

      // Se a Nota Final não existir no banco mas as outras existirem, calcula a soma
      currentAlunos.forEach(aluno => {
        const item = initialMap[aluno.id];
        if (!item.notaFinal && (item.teorica || item.processual || item.osce1 || item.osce2 || item.bonificacao)) {
          const t = Number(item.teorica) || 0;
          const p = Number(item.processual) || 0;
          const o1 = Number(item.osce1) || 0;
          const o2 = Number(item.osce2) || 0;
          const b = Number(item.bonificacao) || 0;
          const sum = Math.min(10, t + p + o1 + o2 + b);
          item.notaFinal = sum > 0 ? String(Number(sum.toFixed(2))) : '';
        }
      });

      setNotasMap(initialMap);
      setOriginalNotasMap(JSON.parse(JSON.stringify(initialMap)));
    } catch (error: any) {
      showToast(error.message || 'Erro ao carregar notas da clínica', 'error');
    }
  };

  const fetchConsolidatedNotas = async (turmaId: string) => {
    try {
      const { data, error } = await supabase
        .from('internato_notas')
        .select('aluno_id, clinica, nota')
        .eq('turma_id', turmaId)
        .eq('descricao', 'Nota Final');

      if (error) throw error;

      const map: Record<string, Record<string, number>> = {};
      data?.forEach(row => {
        if (!map[row.aluno_id]) {
          map[row.aluno_id] = {};
        }
        map[row.aluno_id][row.clinica] = row.nota;
      });

      setConsolidatedNotas(map);
    } catch (err: any) {
      console.error('Erro ao carregar notas consolidadas:', err);
    }
  };

  const getAverageForClinica = (clinicaId: string) => {
    let sum = 0;
    let count = 0;
    alunos.forEach(aluno => {
      const nota = consolidatedNotas[aluno.id]?.[clinicaId];
      if (nota !== undefined) {
        sum += nota;
        count++;
      }
    });
    return count > 0 ? (sum / count).toFixed(1).replace('.', ',') : '-';
  };

  const fetchHistoricoAvaliacoes = async () => {
    try {
      // Carregar todas as notas da turma para calcular médias por avaliação
      const { data, error } = await supabase
        .from('internato_notas')
        .select(`
          descricao,
          nota,
          clinica,
          created_at,
          internato_alunos (nome, matricula)
        `)
        .eq('turma_id', selectedTurmaId);

      if (error) throw error;

      // Mapear detalhes completos das notas
      const detalhes = (data || []).map((n: any) => ({
        aluno_nome: n.internato_alunos?.nome || 'Aluno Removido',
        aluno_matricula: n.internato_alunos?.matricula || '',
        descricao: n.descricao,
        nota: Number(n.nota),
        clinica: n.clinica || 'Geral'
      }));
      setNotasDetalhes(detalhes);

      // Agrupar médias por avaliação e clínica
      const grupos: Record<string, { total: number; count: number; date: string }> = {};
      data?.forEach(n => {
        const clinica = n.clinica || 'Geral';
        const key = `${clinica}|${n.descricao}`;
        if (!grupos[key]) {
          grupos[key] = { total: 0, count: 0, date: n.created_at };
        }
        grupos[key].total += Number(n.nota);
        grupos[key].count += 1;
      });

      const historico: HistoricoAvaliacao[] = Object.keys(grupos).map(key => {
        const [clinica, desc] = key.split('|');
        return {
          descricao: desc,
          clinica: clinica,
          media: Number((grupos[key].total / grupos[key].count).toFixed(2)),
          data: grupos[key].date
        };
      });

      setHistoricoAvaliacoes(historico);

      if (historico.length > 0 && !selectedAvaliacaoFiltro) {
        const first = historico[0];
        setSelectedAvaliacaoFiltro(`${first.clinica}|${first.descricao}`);
      }
    } catch (error: any) {
      showToast(error.message || 'Erro ao carregar histórico de notas', 'error');
    }
  };

  const handleLoadNotasParaEdicao = (filtroKey: string) => {
    const [clinica] = filtroKey.split('|');
    setNotaClinica(clinica);
    setSubTab('lancar');
    showToast(`Notas da clínica "${clinica}" carregadas para edição.`);
  };

  const handleNotaChange = (alunoId: string, campo: keyof NotasAluno, val: string) => {
    const cleanVal = val.replace(',', '.');
    // Regex para validar digitação de números decimais (permite ponto ou vírgula intermediários)
    const regex = /^\d*[.,]?\d*$/;
    const limit = getLimitForCampo(campo);

    if (val === '' || (regex.test(val) && (cleanVal === '.' || cleanVal === '' || (Number(cleanVal) >= 0 && Number(cleanVal) <= limit)))) {
      setNotasMap(prev => {
        const studentNotas = {
          ...prev[alunoId],
          [campo]: val
        };

        const tStr = studentNotas.teorica || '';
        const pStr = studentNotas.processual || '';
        const o1Str = studentNotas.osce1 || '';
        const o2Str = studentNotas.osce2 || '';
        const bStr = studentNotas.bonificacao || '';
        const hasAnyGrade = tStr.trim() !== '' || pStr.trim() !== '' || o1Str.trim() !== '' || o2Str.trim() !== '' || bStr.trim() !== '';

        const t = Number(tStr.replace(',', '.')) || 0;
        const p = Number(pStr.replace(',', '.')) || 0;
        const o1 = Number(o1Str.replace(',', '.')) || 0;
        const o2 = Number(o2Str.replace(',', '.')) || 0;
        const b = Number(bStr.replace(',', '.')) || 0;

        const sum = t + p + o1 + o2 + b;
        const finalSum = Math.min(100, sum); // Capar em 100 devido ao limite máximo do tipo NUMERIC

        studentNotas.notaFinal = hasAnyGrade ? String(Number(finalSum.toFixed(2))) : '';

        return {
          ...prev,
          [alunoId]: studentNotas
        };
      });
    }
  };

  const handleNotaBlur = async (alunoId: string, campo: keyof NotasAluno) => {
    const currentVal = notasMap[alunoId]?.[campo] || '';
    let formattedVal = currentVal.trim();

    if (formattedVal !== '') {
      const cleanVal = formattedVal.replace(',', '.');
      const num = Number(cleanVal);
      if (!isNaN(num)) {
        if (Number.isInteger(num)) {
          formattedVal = num.toFixed(1).replace('.', ',');
        } else {
          formattedVal = cleanVal.replace('.', ',');
        }
      }
    }

    // 1. Atualizar o notasMap com a formatação
    setNotasMap(prev => {
      const studentNotas = {
        ...prev[alunoId],
        [campo]: formattedVal
      };

      const t = Number((studentNotas.teorica || '').replace(',', '.')) || 0;
      const p = Number((studentNotas.processual || '').replace(',', '.')) || 0;
      const o1 = Number((studentNotas.osce1 || '').replace(',', '.')) || 0;
      const o2 = Number((studentNotas.osce2 || '').replace(',', '.')) || 0;
      const b = Number((studentNotas.bonificacao || '').replace(',', '.')) || 0;

      const tStr = studentNotas.teorica || '';
      const pStr = studentNotas.processual || '';
      const o1Str = studentNotas.osce1 || '';
      const o2Str = studentNotas.osce2 || '';
      const bStr = studentNotas.bonificacao || '';
      const hasAnyGrade = tStr.trim() !== '' || pStr.trim() !== '' || o1Str.trim() !== '' || o2Str.trim() !== '' || bStr.trim() !== '';

      const sum = t + p + o1 + o2 + b;
      const finalSum = Math.min(100, sum);
      studentNotas.notaFinal = hasAnyGrade ? String(Number(finalSum.toFixed(2))) : '';

      return {
        ...prev,
        [alunoId]: studentNotas
      };
    });

    // 2. Chamar o salvamento automático
    await autoSalvarCampo(alunoId, campo, formattedVal);
  };

  const autoSalvarCampo = async (alunoId: string, campo: keyof NotasAluno, novoValor: string) => {
    if (!selectedTurmaId || !notaClinica) return;

    const val = novoValor.trim();
    const origVal = originalNotasMap[alunoId]?.[campo] || '';

    // Se o valor não mudou no banco, não precisa salvar
    if (val === origVal) return;

    setSavingStatus('saving');

    const mapeamentoCampos = {
      teorica: 'Teórica',
      processual: 'Processual',
      osce1: 'OSCE 1',
      osce2: 'OSCE 2',
      bonificacao: 'Bonificação',
      notaFinal: 'Nota Final'
    };

    const descName = mapeamentoCampos[campo];
    if (!descName) return;

    try {
      // 1. Salvar ou deletar o campo
      if (val !== '') {
        const { error } = await supabase
          .from('internato_notas')
          .upsert({
            turma_id: selectedTurmaId,
            aluno_id: alunoId,
            clinica: notaClinica,
            descricao: descName,
            nota: Number(val.replace(',', '.')),
            professor_id: profile?.id || null
          }, { onConflict: 'turma_id,aluno_id,clinica,descricao' });

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('internato_notas')
          .delete()
          .eq('turma_id', selectedTurmaId)
          .eq('clinica', notaClinica)
          .eq('aluno_id', alunoId)
          .eq('descricao', descName);

        if (error) throw error;
      }

      // 2. Recalcular e salvar a Nota Final correspondente
      const currentStudent = { ...(notasMap[alunoId] || {}) };
      currentStudent[campo] = val; // garante o valor recém-salvo no cálculo

      const t = Number((currentStudent.teorica || '').replace(',', '.')) || 0;
      const p = Number((currentStudent.processual || '').replace(',', '.')) || 0;
      const o1 = Number((currentStudent.osce1 || '').replace(',', '.')) || 0;
      const o2 = Number((currentStudent.osce2 || '').replace(',', '.')) || 0;
      const b = Number((currentStudent.bonificacao || '').replace(',', '.')) || 0;

      const tStr = currentStudent.teorica || '';
      const pStr = currentStudent.processual || '';
      const o1Str = currentStudent.osce1 || '';
      const o2Str = currentStudent.osce2 || '';
      const bStr = currentStudent.bonificacao || '';
      const hasAnyGrade = tStr.trim() !== '' || pStr.trim() !== '' || o1Str.trim() !== '' || o2Str.trim() !== '' || bStr.trim() !== '';

      const sum = t + p + o1 + o2 + b;
      const finalSum = Math.min(100, sum);
      const calculatedNotaFinal = hasAnyGrade ? String(Number(finalSum.toFixed(2))) : '';

      const origNotaFinal = originalNotasMap[alunoId]?.notaFinal || '';

      if (calculatedNotaFinal !== origNotaFinal) {
        if (calculatedNotaFinal !== '') {
          const { error: finalError } = await supabase
            .from('internato_notas')
            .upsert({
              turma_id: selectedTurmaId,
              aluno_id: alunoId,
              clinica: notaClinica,
              descricao: 'Nota Final',
              nota: Number(calculatedNotaFinal),
              professor_id: profile?.id || null
            }, { onConflict: 'turma_id,aluno_id,clinica,descricao' });

          if (finalError) throw finalError;
        } else {
          const { error: finalError } = await supabase
            .from('internato_notas')
            .delete()
            .eq('turma_id', selectedTurmaId)
            .eq('clinica', notaClinica)
            .eq('aluno_id', alunoId)
            .eq('descricao', 'Nota Final');

          if (finalError) throw finalError;
        }
      }

      // Atualiza o originalNotasMap para refletir o novo estado salvo
      setOriginalNotasMap(prev => {
        const existing = prev[alunoId] || {
          teorica: '',
          processual: '',
          osce1: '',
          osce2: '',
          bonificacao: '',
          notaFinal: ''
        };
        const studentOrig = {
          ...existing,
          [campo]: val,
          notaFinal: calculatedNotaFinal
        };
        return {
          ...prev,
          [alunoId]: studentOrig
        };
      });

      setSavingStatus('saved');
      setTimeout(() => {
        setSavingStatus(current => current === 'saved' ? 'idle' : current);
      }, 2000);

      // Recarregar histórico e notas consolidadas
      fetchHistoricoAvaliacoes();
      fetchConsolidatedNotas(selectedTurmaId);
    } catch (err: any) {
      console.error(err);
      setSavingStatus('error');
      showToast('Erro ao salvar alteração automaticamente: ' + (err.message || ''), 'error');
    }
  };

  const handleSalvarNotas = (e: React.FormEvent) => {
    e.preventDefault();
  };

  return (
    <div className="flex flex-col gap-4 p-4 w-full h-full min-h-[calc(100vh-5rem)]">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <GraduationCap className="h-8 w-8 text-primary" /> Lançamento de Notas (Secretaria)
          </h1>
          <p className="text-muted-foreground mt-1">
            Controle e lançamento consolidado de notas avaliativas dos alunos do Internato.
          </p>
        </div>
      </div>

      {/* Toast Alert */}
      {message && (
        <div className={`p-4 rounded-lg flex items-center gap-3 border shadow-sm transition-all duration-300 ${message.type === 'success'
            ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/30 text-emerald-800 dark:text-emerald-300'
            : 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/30 text-rose-800 dark:text-rose-300'
          }`}>
          {message.type === 'success' ? <CheckCircle2 className="h-5 w-5 flex-shrink-0" /> : <XCircle className="h-5 w-5 flex-shrink-0" />}
          <span className="text-sm font-medium">{message.text}</span>
        </div>
      )}

      {/* Filtros de Seleção */}
      <div className="bg-card border rounded-xl p-5 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 block">
            Selecione a Turma para Trabalhar
          </label>
          <select
            value={selectedTurmaId}
            onChange={e => setSelectedTurmaId(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 bg-card text-sm focus:outline-none focus:ring-1 focus:ring-primary font-medium"
          >
            <option value="">Selecione uma turma...</option>
            {turmas.map(t => (
              <option key={t.id} value={t.id}>{t.nome} ({t.periodo})</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 block">
            Clínica / Rodízio
          </label>
          <select
            value={notaClinica}
            onChange={e => setNotaClinica(e.target.value)}
            disabled={!selectedTurmaId}
            className="w-full border rounded-lg px-3 py-2 bg-card text-sm focus:outline-none focus:ring-1 focus:ring-primary font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">Selecione a clínica...</option>
            {(() => {
              const turmaSel = turmas.find(t => t.id === selectedTurmaId);
              const clinicasFiltradas = turmaSel ? getClinicasPorPeriodo(turmaSel.periodo) : CLINICAS;
              return clinicasFiltradas.map(c => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ));
            })()}
          </select>
        </div>
      </div>

      {selectedTurmaId ? (
        <div className="flex flex-col gap-6">
          {/* Navegação Secundária (Lançar vs Histórico) */}
          <div className="flex border-b border-border">

            <button
              onClick={() => setSubTab('lancar')}
              className={`px-4 py-2 border-b-2 text-sm font-semibold transition-colors ${subTab === 'lancar'
                  ? 'border-primary text-primary font-bold'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
            >
              Notas Finais
            </button>
            <button
              onClick={() => setSubTab('historico')}
              className={`px-4 py-2 border-b-2 text-sm font-semibold transition-colors ${subTab === 'historico'
                  ? 'border-primary text-primary font-bold'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
            >
              Consolidado por Clínica
            </button>
          </div>

          {/* ABA INTERNA: LANÇAMENTO DE NOTAS */}
          {subTab === 'lancar' && (
            <form onSubmit={handleSalvarNotas} className="bg-card border rounded-xl p-4 shadow-sm flex flex-col gap-4 h-[calc(100vh-18rem)] min-h-[450px]">
              {notaClinica && (
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 pb-4">
                  <div className="text-xs text-muted-foreground bg-muted/40 p-3 rounded-lg border border-border/30 w-full">
                    <p className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1">
                      <Info className="h-3.5 w-3.5 text-primary" /> Lançamento de notas em lote
                    </p>
                    As notas de Teórica, Processual, OSCE 1, OSCE 2 e Bonificação serão gravadas em lote para a clínica/rodízio correspondente.
                  </div>
                </div>
              )}

              {notaClinica ? (
                alunos.length > 0 ? (
                  <div className="flex flex-col gap-3 flex-1 overflow-hidden">
                    <h3 className="font-bold text-sm text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Alunos Matriculados ({alunos.length})
                    </h3>

                    <div className="overflow-x-auto rounded-xl border border-border flex-1">
                      <table className="w-full text-left text-sm border-collapse min-w-[700px]">
                        <thead className="bg-slate-50 dark:bg-slate-900 border-b border-border text-xs font-bold text-muted-foreground uppercase tracking-wider sticky top-0 z-10">
                          <tr>
                            <th className="px-6 py-4">Aluno</th>
                            <th className="px-6 py-4 text-center w-28">Teórica (30)</th>
                            <th className="px-6 py-4 text-center w-28">Processual (30)</th>
                            <th className="px-6 py-4 text-center w-28">OSCE 1 (20)</th>
                            <th className="px-6 py-4 text-center w-28">OSCE 2 (20)</th>
                            <th className="px-6 py-4 text-center w-28">Bonificação</th>
                            <th className="px-6 py-4 text-center w-28">Nota Final</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border font-medium bg-card">
                          {alunos.map(aluno => {
                            const alunoNotas = notasMap[aluno.id] || { teorica: '', processual: '', osce1: '', osce2: '', bonificacao: '', notaFinal: '' };
                            return (
                              <tr key={aluno.id} className="hover:bg-muted/40 transition-colors">
                                <td className="px-6 py-3.5">
                                  <p className="font-bold text-slate-800 dark:text-slate-200">{aluno.nome}</p>
                                  {aluno.matricula && (
                                    <p className="text-xs text-muted-foreground font-mono mt-0.5">
                                      Matrícula: {aluno.matricula}
                                    </p>
                                  )}
                                </td>
                                <td className="px-6 py-3.5 text-center">
                                  <input
                                    type="text"
                                    placeholder="-"
                                    value={alunoNotas.teorica}
                                    onChange={e => handleNotaChange(aluno.id, 'teorica', e.target.value)}
                                    onBlur={() => handleNotaBlur(aluno.id, 'teorica')}
                                    className="w-20 text-center border rounded-lg py-1.5 bg-background text-sm font-bold text-primary focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                                  />
                                </td>
                                <td className="px-6 py-3.5 text-center">
                                  <input
                                    type="text"
                                    placeholder="-"
                                    value={alunoNotas.processual}
                                    onChange={e => handleNotaChange(aluno.id, 'processual', e.target.value)}
                                    onBlur={() => handleNotaBlur(aluno.id, 'processual')}
                                    className="w-20 text-center border rounded-lg py-1.5 bg-background text-sm font-bold text-primary focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                                  />
                                </td>
                                <td className="px-6 py-3.5 text-center">
                                  <input
                                    type="text"
                                    placeholder="-"
                                    value={alunoNotas.osce1}
                                    onChange={e => handleNotaChange(aluno.id, 'osce1', e.target.value)}
                                    onBlur={() => handleNotaBlur(aluno.id, 'osce1')}
                                    className="w-20 text-center border rounded-lg py-1.5 bg-background text-sm font-bold text-primary focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                                  />
                                </td>
                                <td className="px-6 py-3.5 text-center">
                                  <input
                                    type="text"
                                    placeholder="-"
                                    value={alunoNotas.osce2}
                                    onChange={e => handleNotaChange(aluno.id, 'osce2', e.target.value)}
                                    onBlur={() => handleNotaBlur(aluno.id, 'osce2')}
                                    className="w-20 text-center border rounded-lg py-1.5 bg-background text-sm font-bold text-primary focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                                  />
                                </td>
                                <td className="px-6 py-3.5 text-center">
                                  <input
                                    type="text"
                                    placeholder="-"
                                    value={alunoNotas.bonificacao}
                                    onChange={e => handleNotaChange(aluno.id, 'bonificacao', e.target.value)}
                                    onBlur={() => handleNotaBlur(aluno.id, 'bonificacao')}
                                    className="w-20 text-center border rounded-lg py-1.5 bg-background text-sm font-bold text-primary focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                                  />
                                </td>
                                <td className="px-6 py-3.5 text-center">
                                  <span className={`inline-block w-20 text-center py-1.5 rounded-lg text-sm font-extrabold ${(() => {
                                      if (alunoNotas.notaFinal === undefined || alunoNotas.notaFinal === '') return 'text-muted-foreground';
                                      const val = Number(alunoNotas.notaFinal);

                                      if (val >= 60) {
                                        return 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/30';
                                      } else {
                                        return 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/30';
                                      }
                                    })()
                                    }`}>
                                    {alunoNotas.notaFinal !== undefined && alunoNotas.notaFinal !== '' ? Number(alunoNotas.notaFinal).toFixed(1).replace('.', ',') : '-'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-border/40 mt-4">
                      <div className="flex items-center gap-2">
                        {savingStatus === 'saving' && (
                          <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5 animate-pulse">
                            <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
                            Salvando alterações...
                          </span>
                        )}
                        {savingStatus === 'saved' && (
                          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            Todas as alterações foram salvas!
                          </span>
                        )}
                        {savingStatus === 'error' && (
                          <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                            <XCircle className="h-4 w-4 text-rose-500" />
                            Erro ao salvar. Verifique sua conexão.
                          </span>
                        )}
                        {savingStatus === 'idle' && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            Alterações salvas automaticamente.
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center text-muted-foreground text-sm border border-dashed rounded-lg">
                    Nenhum aluno cadastrado nesta turma. Acesse a tela da Secretaria para matricular alunos.
                  </div>
                )
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground text-center p-8 border border-dashed rounded-lg">
                  <Info className="h-10 w-10 text-muted-foreground/30 mb-2" />
                  <p className="text-sm font-semibold">Nenhuma clínica/rodízio selecionada</p>
                  <p className="text-xs mt-0.5">Selecione uma clínica no painel de filtros acima para lançar as notas dos alunos.</p>
                </div>
              )}
            </form>
          )}

          {/* ABA INTERNA: CONSOLIDADO POR CLÍNICA */}
          {subTab === 'historico' && (
            <div className="bg-card border rounded-xl p-4 shadow-sm flex flex-col gap-4 h-[calc(100vh-18rem)] min-h-[450px]">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 pb-4">
                <div className="text-xs text-muted-foreground bg-muted/40 p-3 rounded-lg border border-border/30 w-full">
                  <p className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1">
                    <Info className="h-3.5 w-3.5 text-primary" /> Quadro Geral de Notas do Internato
                  </p>
                  Esta visão consolidada exibe a Nota Final obtida pelos alunos em cada uma das clínicas/rodízios ativos no período desta turma.
                </div>
              </div>

              {alunos.length > 0 ? (
                <div className="flex flex-col gap-3 flex-1 overflow-hidden">
                  <div className="overflow-x-auto rounded-xl border border-border flex-1">
                    <table className="w-full text-left text-sm border-collapse min-w-[700px]">
                      <thead className="bg-slate-50 dark:bg-slate-900 border-b border-border text-xs font-bold text-muted-foreground uppercase tracking-wider sticky top-0 z-10">
                        <tr>
                          <th className="px-6 py-4">Aluno</th>
                          {(() => {
                            const turmaSel = turmas.find(t => t.id === selectedTurmaId);
                            const clinicasFiltradas = turmaSel ? getClinicasPorPeriodo(turmaSel.periodo) : CLINICAS;
                            return clinicasFiltradas.map(c => (
                              <th key={c.id} className="px-6 py-4 text-center">{c.nome}</th>
                            ));
                          })()}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border font-medium bg-card">
                        {alunos.map(aluno => {
                          const turmaSel = turmas.find(t => t.id === selectedTurmaId);
                          const clinicasFiltradas = turmaSel ? getClinicasPorPeriodo(turmaSel.periodo) : CLINICAS;
                          return (
                            <tr key={aluno.id} className="hover:bg-muted/40 transition-colors">
                              <td className="px-6 py-3.5">
                                <p className="font-bold text-slate-800 dark:text-slate-200">{aluno.nome}</p>
                                {aluno.matricula && (
                                  <p className="text-xs text-muted-foreground font-mono mt-0.5">
                                    Matrícula: {aluno.matricula}
                                  </p>
                                )}
                              </td>
                              {clinicasFiltradas.map(c => {
                                const nota = consolidatedNotas[aluno.id]?.[c.id];
                                return (
                                  <td key={c.id} className="px-6 py-3.5 text-center">
                                    {nota !== undefined ? (
                                      <span className={`inline-block w-20 text-center py-1.5 rounded-lg text-sm font-extrabold ${(() => {
                                          if (nota >= 60) {
                                            return 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/30';
                                          } else {
                                            return 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/30';
                                          }
                                        })()
                                        }`}>
                                        {nota.toFixed(1).replace('.', ',')}
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground font-semibold">-</span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                      {/* Linha de médias da turma */}
                      <tfoot className="bg-slate-50 dark:bg-slate-900 border-t border-border font-bold text-xs">
                        <tr>
                          <td className="px-6 py-4 text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                            Média da Turma
                          </td>
                          {(() => {
                            const turmaSel = turmas.find(t => t.id === selectedTurmaId);
                            const clinicasFiltradas = turmaSel ? getClinicasPorPeriodo(turmaSel.periodo) : CLINICAS;
                            return clinicasFiltradas.map(c => {
                              const avg = getAverageForClinica(c.id);
                              return (
                                <td key={c.id} className="px-6 py-4 text-center text-slate-800 dark:text-slate-200 text-sm font-extrabold">
                                  {avg}
                                </td>
                              );
                            });
                          })()}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-muted-foreground text-sm border border-dashed rounded-lg">
                  Nenhum aluno cadastrado nesta turma.
                </div>
              )}
            </div>
          )}

        </div>
      ) : (
        <div className="bg-card border rounded-xl p-12 text-center text-muted-foreground shadow-sm flex flex-col items-center justify-center">
          <GraduationCap className="h-14 w-14 text-muted-foreground/30 mb-4" />
          <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-lg">Lançamento de Notas</h3>
          <p className="text-sm max-w-md mt-1.5">
            Por favor, selecione uma turma de internato no menu acima para começar a gerenciar as avaliações e preencher as notas dos alunos.
          </p>
        </div>
      )}
    </div>
  );
};

export default Notas;
