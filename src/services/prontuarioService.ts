// src/services/prontuarioService.ts
// Serviço responsável pela comunicação com o Supabase para a Gestão de Prontuários,
// contendo fallback automático para LocalStorage caso as tabelas não estejam prontas no banco.

import { supabase } from '../lib/supabase';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export interface SolicitacaoProntuario {
  id: string;
  numero_solicitacao: number;
  paciente_nome: string;
  paciente_cpf: string;
  paciente_data_nascimento: string;
  paciente_contato: string;
  motivo: string;
  observacoes: string | null;
  status: 'Pendente' | 'Em Análise' | 'Aprovado' | 'Rejeitado' | 'Documento Disponibilizado';
  responsavel_id: string | null;
  responsavel_nome: string | null;
  data_solicitacao: string;
  tipo_solicitacao: string;
  justificativa_rejeicao: string | null;
  arquivo_url: string | null;
  arquivo_nome: string | null;
  data_finalizacao: string | null;
  created_at: string;
  updated_at: string;
}

export interface HistoricoSolicitacao {
  id: string;
  solicitacao_id: string;
  data: string;
  status_anterior: string | null;
  status_novo: string;
  descricao: string;
  usuario_id: string | null;
  usuario_nome: string;
  created_at: string;
}

export interface IndicadoresProntuario {
  pendentes: number;
  emAnalise: number;
  aprovadas: number;
  rejeitadas: number;
  disponibilizados: number;
}

// ─────────────────────────────────────────────────────────────
// LOCAL STORAGE FALLBACK CONSTANTS & MOCK DATA
// ─────────────────────────────────────────────────────────────

const STORAGE_KEY_SOLICITACOES = 'hsc_solicitacoes_prontuario';
const STORAGE_KEY_HISTORICO = 'hsc_historico_solicitacoes_prontuario';

const MOCK_SOLICITACOES: SolicitacaoProntuario[] = [
  {
    id: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    numero_solicitacao: 1,
    paciente_nome: 'João da Silva',
    paciente_cpf: '123.456.789-00',
    paciente_data_nascimento: '1985-05-15',
    paciente_contato: '(11) 98765-4321 / joao.silva@email.com',
    motivo: 'Necessidade de apresentação do prontuário para consulta com médico especialista em outra instituição.',
    observacoes: 'Solicitou urgência no envio.',
    status: 'Pendente',
    responsavel_id: null,
    responsavel_nome: null,
    data_solicitacao: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    tipo_solicitacao: 'Digital',
    justificativa_rejeicao: null,
    arquivo_url: null,
    arquivo_nome: null,
    data_finalizacao: null,
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e',
    numero_solicitacao: 2,
    paciente_nome: 'Maria Oliveira Santos',
    paciente_cpf: '987.654.321-11',
    paciente_data_nascimento: '1992-08-20',
    paciente_contato: '(11) 99999-8888 / maria.santos@email.com',
    motivo: 'Acompanhamento de histórico cirúrgico anterior realizado no HSC em 2024.',
    observacoes: 'Prefere receber por e-mail.',
    status: 'Em Análise',
    responsavel_id: 'dev-user-id',
    responsavel_nome: 'Gestor de Teste',
    data_solicitacao: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    tipo_solicitacao: 'Digital',
    justificativa_rejeicao: null,
    arquivo_url: null,
    arquivo_nome: null,
    data_finalizacao: null,
    created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'c3d4e5f6-a7b8-9c0d-1e2f-3a4b5c6d7e8f',
    numero_solicitacao: 3,
    paciente_nome: 'Carlos Eduardo Souza',
    paciente_cpf: '456.789.123-22',
    paciente_data_nascimento: '1970-11-02',
    paciente_contato: '(11) 97777-6666 / carlos.souza@email.com',
    motivo: 'Retirada de prontuário físico para apresentação em junta médica pericial do INSS.',
    observacoes: 'Retirará pessoalmente na recepção se aprovado.',
    status: 'Aprovado',
    responsavel_id: 'dev-user-id',
    responsavel_nome: 'Gestor de Teste',
    data_solicitacao: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    tipo_solicitacao: 'Físico',
    justificativa_rejeicao: null,
    arquivo_url: null,
    arquivo_nome: null,
    data_finalizacao: null,
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'd4e5f6a7-b8c9-0d1e-2f3a-4b5c6d7e8f9a',
    numero_solicitacao: 4,
    paciente_nome: 'Ana Beatriz Ferreira',
    paciente_cpf: '789.123.456-33',
    paciente_data_nascimento: '2000-01-30',
    paciente_contato: '(11) 96666-5555 / ana.ferreira@email.com',
    motivo: 'Solicitação para fins de seguro de saúde e reembolso de despesas de internação.',
    observacoes: 'Requer cópia integral.',
    status: 'Rejeitado',
    responsavel_id: 'dev-user-id',
    responsavel_nome: 'Gestor de Teste',
    data_solicitacao: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    tipo_solicitacao: 'Digital',
    justificativa_rejeicao: 'Falta de documento de identificação com foto em anexo.',
    arquivo_url: null,
    arquivo_nome: null,
    data_finalizacao: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'e5f6a7b8-c9d0-1e2f-3a4b-5c6d7e8f9a0b',
    numero_solicitacao: 5,
    paciente_nome: 'Pedro Henrique Alves',
    paciente_cpf: '321.654.987-44',
    paciente_data_nascimento: '1963-04-10',
    paciente_contato: '(11) 95555-4444 / pedro.alves@email.com',
    motivo: 'Exames e relatórios médicos de internação do ano de 2025.',
    observacoes: 'Necessita apenas do relatório de alta.',
    status: 'Documento Disponibilizado',
    responsavel_id: 'dev-user-id',
    responsavel_nome: 'Gestor de Teste',
    data_solicitacao: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    tipo_solicitacao: 'Digital',
    justificativa_rejeicao: null,
    arquivo_url: 'https://mock.url/prontuarios/PRONTUARIO_PEDRO_ALVES.pdf',
    arquivo_nome: 'PRONTUARIO_PEDRO_ALVES.pdf',
    data_finalizacao: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
  }
];

const MOCK_HISTORICO: HistoricoSolicitacao[] = [
  {
    id: 'h1',
    solicitacao_id: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    data: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    status_anterior: null,
    status_novo: 'Pendente',
    descricao: 'Solicitação realizada pelo paciente via portal.',
    usuario_id: null,
    usuario_nome: 'Paciente (João da Silva)',
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'h2',
    solicitacao_id: 'b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e',
    data: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    status_anterior: null,
    status_novo: 'Pendente',
    descricao: 'Solicitação realizada pelo paciente via portal.',
    usuario_id: null,
    usuario_nome: 'Paciente (Maria Oliveira Santos)',
    created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'h3',
    solicitacao_id: 'b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e',
    data: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    status_anterior: 'Pendente',
    status_novo: 'Em Análise',
    descricao: 'Análise da solicitação iniciada pelo gestor.',
    usuario_id: 'dev-user-id',
    usuario_nome: 'Gestor de Teste',
    created_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'h4',
    solicitacao_id: 'c3d4e5f6-a7b8-9c0d-1e2f-3a4b5c6d7e8f',
    data: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    status_anterior: null,
    status_novo: 'Pendente',
    descricao: 'Solicitação realizada pelo paciente via portal.',
    usuario_id: null,
    usuario_nome: 'Paciente (Carlos Eduardo Souza)',
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'h5',
    solicitacao_id: 'c3d4e5f6-a7b8-9c0d-1e2f-3a4b5c6d7e8f',
    data: new Date(Date.now() - 2.8 * 24 * 60 * 60 * 1000).toISOString(),
    status_anterior: 'Pendente',
    status_novo: 'Em Análise',
    descricao: 'Análise da solicitação iniciada pelo gestor.',
    usuario_id: 'dev-user-id',
    usuario_nome: 'Gestor de Teste',
    created_at: new Date(Date.now() - 2.8 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'h6',
    solicitacao_id: 'c3d4e5f6-a7b8-9c0d-1e2f-3a4b5c6d7e8f',
    data: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    status_anterior: 'Em Análise',
    status_novo: 'Aprovado',
    descricao: 'Solicitação aprovada. Aguardando upload do arquivo do prontuário.',
    usuario_id: 'dev-user-id',
    usuario_nome: 'Gestor de Teste',
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'h7',
    solicitacao_id: 'd4e5f6a7-b8c9-0d1e-2f3a-4b5c6d7e8f9a',
    data: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    status_anterior: null,
    status_novo: 'Pendente',
    descricao: 'Solicitação realizada pelo paciente via portal.',
    usuario_id: null,
    usuario_nome: 'Paciente (Ana Beatriz Ferreira)',
    created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'h8',
    solicitacao_id: 'd4e5f6a7-b8c9-0d1e-2f3a-4b5c6d7e8f9a',
    data: new Date(Date.now() - 3.8 * 24 * 60 * 60 * 1000).toISOString(),
    status_anterior: 'Pendente',
    status_novo: 'Em Análise',
    descricao: 'Análise da solicitação iniciada pelo gestor.',
    usuario_id: 'dev-user-id',
    usuario_nome: 'Gestor de Teste',
    created_at: new Date(Date.now() - 3.8 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'h9',
    solicitacao_id: 'd4e5f6a7-b8c9-0d1e-2f3a-4b5c6d7e8f9a',
    data: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    status_anterior: 'Em Análise',
    status_novo: 'Rejeitado',
    descricao: 'Solicitação rejeitada. Motivo: Falta de documento de identificação com foto em anexo.',
    usuario_id: 'dev-user-id',
    usuario_nome: 'Gestor de Teste',
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'h10',
    solicitacao_id: 'e5f6a7b8-c9d0-1e2f-3a4b-5c6d7e8f9a0b',
    data: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    status_anterior: null,
    status_novo: 'Pendente',
    descricao: 'Solicitação realizada pelo paciente via portal.',
    usuario_id: null,
    usuario_nome: 'Paciente (Pedro Henrique Alves)',
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'h11',
    solicitacao_id: 'e5f6a7b8-c9d0-1e2f-3a4b-5c6d7e8f9a0b',
    data: new Date(Date.now() - 4.8 * 24 * 60 * 60 * 1000).toISOString(),
    status_anterior: 'Pendente',
    status_novo: 'Em Análise',
    descricao: 'Análise da solicitação iniciada pelo gestor.',
    usuario_id: 'dev-user-id',
    usuario_nome: 'Gestor de Teste',
    created_at: new Date(Date.now() - 4.8 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'h12',
    solicitacao_id: 'e5f6a7b8-c9d0-1e2f-3a4b-5c6d7e8f9a0b',
    data: new Date(Date.now() - 4.5 * 24 * 60 * 60 * 1000).toISOString(),
    status_anterior: 'Em Análise',
    status_novo: 'Aprovado',
    descricao: 'Solicitação aprovada. Aguardando upload do arquivo do prontuário.',
    usuario_id: 'dev-user-id',
    usuario_nome: 'Gestor de Teste',
    created_at: new Date(Date.now() - 4.5 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'h13',
    solicitacao_id: 'e5f6a7b8-c9d0-1e2f-3a4b-5c6d7e8f9a0b',
    data: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    status_anterior: 'Aprovado',
    status_novo: 'Documento Disponibilizado',
    descricao: 'Documento do prontuário anexado e disponibilizado para o solicitante.',
    usuario_id: 'dev-user-id',
    usuario_nome: 'Gestor de Teste',
    created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString()
  }
];

// Inicializa LocalStorage se necessário
function initializeLocalStorage() {
  if (!localStorage.getItem(STORAGE_KEY_SOLICITACOES)) {
    localStorage.setItem(STORAGE_KEY_SOLICITACOES, JSON.stringify(MOCK_SOLICITACOES));
  }
  if (!localStorage.getItem(STORAGE_KEY_HISTORICO)) {
    localStorage.setItem(STORAGE_KEY_HISTORICO, JSON.stringify(MOCK_HISTORICO));
  }
}

// ─────────────────────────────────────────────────────────────
// SERVIÇOS DO DATABASE / LOCALSTORAGE
// ─────────────────────────────────────────────────────────────

// Helper para ler LocalStorage
function getLocalSolicitacoes(): SolicitacaoProntuario[] {
  initializeLocalStorage();
  const raw = localStorage.getItem(STORAGE_KEY_SOLICITACOES);
  return raw ? JSON.parse(raw) : [];
}

function saveLocalSolicitacoes(list: SolicitacaoProntuario[]) {
  localStorage.setItem(STORAGE_KEY_SOLICITACOES, JSON.stringify(list));
}

function getLocalHistorico(): HistoricoSolicitacao[] {
  initializeLocalStorage();
  const raw = localStorage.getItem(STORAGE_KEY_HISTORICO);
  return raw ? JSON.parse(raw) : [];
}

function saveLocalHistorico(list: HistoricoSolicitacao[]) {
  localStorage.setItem(STORAGE_KEY_HISTORICO, JSON.stringify(list));
}

function registrarLocalHistorico(solicitacaoId: string, statusAnterior: string | null, statusNovo: string, descricao: string, usuarioId: string | null, usuarioNome: string) {
  const list = getLocalHistorico();
  const newHist: HistoricoSolicitacao = {
    id: `h_gen_${Date.now()}`,
    solicitacao_id: solicitacaoId,
    data: new Date().toISOString(),
    status_anterior: statusAnterior,
    status_novo: statusNovo,
    descricao,
    usuario_id: usuarioId,
    usuario_nome: usuarioNome,
    created_at: new Date().toISOString()
  };
  list.push(newHist);
  saveLocalHistorico(list);
}

// ─────────────────────────────────────────────────────────────
// MÉTODOS DE NEGÓCIO EXPORTADOS
// ─────────────────────────────────────────────────────────────

/**
 * Busca todas as solicitações, suportando filtros por termo de busca e status.
 */
export async function fetchSolicitacoes(busca?: string, statusFilter?: string): Promise<SolicitacaoProntuario[]> {
  try {
    let query = supabase
      .from('solicitacoes_prontuario')
      .select('*')
      .order('numero_solicitacao', { ascending: false });

    if (statusFilter && statusFilter !== 'Todos') {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;

    if (error) throw error;

    let result = (data ?? []) as SolicitacaoProntuario[];

    if (busca) {
      const term = busca.toLowerCase();
      result = result.filter(s =>
        s.paciente_nome.toLowerCase().includes(term) ||
        s.paciente_cpf.includes(term) ||
        `#${String(s.numero_solicitacao).padStart(4, '0')}`.includes(term)
      );
    }

    return result;

  } catch (dbErr) {
    console.warn('[Supabase Dev] Erro ao listar do banco, usando LocalStorage:', dbErr);
    let local = getLocalSolicitacoes();

    if (statusFilter && statusFilter !== 'Todos') {
      local = local.filter(s => s.status === statusFilter);
    }

    if (busca) {
      const term = busca.toLowerCase();
      local = local.filter(s =>
        s.paciente_nome.toLowerCase().includes(term) ||
        s.paciente_cpf.includes(term) ||
        `#${String(s.numero_solicitacao).padStart(4, '0')}`.includes(term)
      );
    }

    // Ordenar de forma decrescente pelo número da solicitação
    return local.sort((a, b) => b.numero_solicitacao - a.numero_solicitacao);
  }
}

/**
 * Calcula indicadores com base nas solicitações.
 */
export async function fetchIndicadores(): Promise<IndicadoresProntuario> {
  try {
    const { data, error } = await supabase
      .from('solicitacoes_prontuario')
      .select('status');

    if (error) throw error;

    const list = data ?? [];
    return {
      pendentes: list.filter(item => item.status === 'Pendente').length,
      emAnalise: list.filter(item => item.status === 'Em Análise').length,
      aprovadas: list.filter(item => item.status === 'Aprovado').length,
      rejeitadas: list.filter(item => item.status === 'Rejeitado').length,
      disponibilizados: list.filter(item => item.status === 'Documento Disponibilizado').length
    };
  } catch (dbErr) {
    console.warn('[Supabase Dev] Erro de indicadores no banco, usando LocalStorage:', dbErr);
    const list = getLocalSolicitacoes();
    return {
      pendentes: list.filter(item => item.status === 'Pendente').length,
      emAnalise: list.filter(item => item.status === 'Em Análise').length,
      aprovadas: list.filter(item => item.status === 'Aprovado').length,
      rejeitadas: list.filter(item => item.status === 'Rejeitado').length,
      disponibilizados: list.filter(item => item.status === 'Documento Disponibilizado').length
    };
  }
}

/**
 * Altera o status da solicitação para "Em Análise" e registra o gestor responsável.
 */
export async function iniciarAnalise(
  solicitacaoId: string,
  usuarioNome: string,
  usuarioId: string | null
): Promise<void> {
  const status_novo = 'Em Análise';
  const descricao = `Análise da solicitação iniciada pelo gestor.`;

  try {
    // 1. Busca status atual para o histórico
    const { data: current } = await supabase
      .from('solicitacoes_prontuario')
      .select('status')
      .eq('id', solicitacaoId)
      .single();

    const status_anterior = current?.status || 'Pendente';

    // 2. Atualiza a solicitação
    const { error: updateErr } = await supabase
      .from('solicitacoes_prontuario')
      .update({
        status: status_novo,
        responsavel_id: usuarioId,
        responsavel_nome: usuarioNome,
        updated_at: new Date().toISOString()
      })
      .eq('id', solicitacaoId);

    if (updateErr) throw updateErr;

    // 3. Grava histórico
    await supabase.from('historico_solicitacoes_prontuario').insert({
      solicitacao_id: solicitacaoId,
      status_anterior,
      status_novo,
      descricao,
      usuario_id: usuarioId,
      usuario_nome: usuarioNome
    });

  } catch (dbErr) {
    console.warn('[Supabase Dev] Erro ao iniciar análise no banco, salvando no LocalStorage:', dbErr);
    const local = getLocalSolicitacoes();
    const index = local.findIndex(s => s.id === solicitacaoId);
    if (index !== -1) {
      const status_anterior = local[index].status;
      local[index].status = status_novo;
      local[index].responsavel_id = usuarioId;
      local[index].responsavel_nome = usuarioNome;
      local[index].updated_at = new Date().toISOString();
      saveLocalSolicitacoes(local);

      registrarLocalHistorico(solicitacaoId, status_anterior, status_novo, descricao, usuarioId, usuarioNome);
    }
  }
}

/**
 * Aprova a solicitação (muda status para Aprovado), preparando para upload do arquivo.
 */
export async function aprovarSolicitacao(
  solicitacaoId: string,
  usuarioNome: string,
  usuarioId: string | null
): Promise<void> {
  const status_novo = 'Aprovado';
  const descricao = 'Solicitação aprovada pelo gestor. Aguardando disponibilização do documento.';

  try {
    const { data: current } = await supabase
      .from('solicitacoes_prontuario')
      .select('status')
      .eq('id', solicitacaoId)
      .single();

    const status_anterior = current?.status || 'Em Análise';

    const { error: updateErr } = await supabase
      .from('solicitacoes_prontuario')
      .update({
        status: status_novo,
        responsavel_id: usuarioId,
        responsavel_nome: usuarioNome,
        updated_at: new Date().toISOString()
      })
      .eq('id', solicitacaoId);

    if (updateErr) throw updateErr;

    await supabase.from('historico_solicitacoes_prontuario').insert({
      solicitacao_id: solicitacaoId,
      status_anterior,
      status_novo,
      descricao,
      usuario_id: usuarioId,
      usuario_nome: usuarioNome
    });

  } catch (dbErr) {
    console.warn('[Supabase Dev] Erro ao aprovar no banco, salvando no LocalStorage:', dbErr);
    const local = getLocalSolicitacoes();
    const index = local.findIndex(s => s.id === solicitacaoId);
    if (index !== -1) {
      const status_anterior = local[index].status;
      local[index].status = status_novo;
      local[index].responsavel_id = usuarioId;
      local[index].responsavel_nome = usuarioNome;
      local[index].updated_at = new Date().toISOString();
      saveLocalSolicitacoes(local);

      registrarLocalHistorico(solicitacaoId, status_anterior, status_novo, descricao, usuarioId, usuarioNome);
    }
  }
}

/**
 * Faz upload do prontuário PDF, salva URL e muda status para "Documento Disponibilizado".
 */
export async function disponibilizarDocumento(
  solicitacaoId: string,
  file: File,
  usuarioNome: string,
  usuarioId: string | null
): Promise<string> {
  const status_novo = 'Documento Disponibilizado';
  const cleanCpf = file.name.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
  const storagePath = `${solicitacaoId}/${Date.now()}_${cleanCpf}`;
  let pdfUrl = '';

  // 1. Upload do Arquivo para o Supabase Storage
  try {
    const { error: storageError } = await supabase.storage
      .from('prontuarios-pdfs')
      .upload(storagePath, file, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (storageError) throw storageError;

    const { data: urlData } = supabase.storage
      .from('prontuarios-pdfs')
      .getPublicUrl(storagePath);
      
    pdfUrl = urlData.publicUrl;
  } catch (storageErr: any) {
    console.warn('[Supabase Dev] Falha no upload ao storage, gerando mock URL:', storageErr);
    // Cria uma URL fictícia ou uma objectURL temporária para o local
    pdfUrl = URL.createObjectURL(file);
  }

  const descricao = `Documento do prontuário (${file.name}) anexado e disponibilizado para o solicitante.`;

  // 2. Atualizar no Banco
  try {
    const { data: current } = await supabase
      .from('solicitacoes_prontuario')
      .select('status')
      .eq('id', solicitacaoId)
      .single();

    const status_anterior = current?.status || 'Aprovado';

    const { error: updateErr } = await supabase
      .from('solicitacoes_prontuario')
      .update({
        status: status_novo,
        arquivo_url: pdfUrl,
        arquivo_nome: file.name,
        responsavel_id: usuarioId,
        responsavel_nome: usuarioNome,
        data_finalizacao: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', solicitacaoId);

    if (updateErr) throw updateErr;

    await supabase.from('historico_solicitacoes_prontuario').insert({
      solicitacao_id: solicitacaoId,
      status_anterior,
      status_novo,
      descricao,
      usuario_id: usuarioId,
      usuario_nome: usuarioNome
    });

  } catch (dbErr) {
    console.warn('[Supabase Dev] Erro ao salvar disponibilização no banco, usando LocalStorage:', dbErr);
    const local = getLocalSolicitacoes();
    const index = local.findIndex(s => s.id === solicitacaoId);
    if (index !== -1) {
      const status_anterior = local[index].status;
      local[index].status = status_novo;
      local[index].arquivo_url = pdfUrl;
      local[index].arquivo_nome = file.name;
      local[index].responsavel_id = usuarioId;
      local[index].responsavel_nome = usuarioNome;
      local[index].data_finalizacao = new Date().toISOString();
      local[index].updated_at = new Date().toISOString();
      saveLocalSolicitacoes(local);

      registrarLocalHistorico(solicitacaoId, status_anterior, status_novo, descricao, usuarioId, usuarioNome);
    }
  }

  return pdfUrl;
}

/**
 * Rejeita a solicitação de prontuário salvando uma justificativa.
 */
export async function rejeitarSolicitacao(
  solicitacaoId: string,
  justificativa: string,
  usuarioNome: string,
  usuarioId: string | null
): Promise<void> {
  const status_novo = 'Rejeitado';
  const descricao = `Solicitação rejeitada. Motivo: ${justificativa}`;

  try {
    const { data: current } = await supabase
      .from('solicitacoes_prontuario')
      .select('status')
      .eq('id', solicitacaoId)
      .single();

    const status_anterior = current?.status || 'Em Análise';

    const { error: updateErr } = await supabase
      .from('solicitacoes_prontuario')
      .update({
        status: status_novo,
        justificativa_rejeicao: justificativa,
        responsavel_id: usuarioId,
        responsavel_nome: usuarioNome,
        data_finalizacao: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', solicitacaoId);

    if (updateErr) throw updateErr;

    await supabase.from('historico_solicitacoes_prontuario').insert({
      solicitacao_id: solicitacaoId,
      status_anterior,
      status_novo,
      descricao,
      usuario_id: usuarioId,
      usuario_nome: usuarioNome
    });

  } catch (dbErr) {
    console.warn('[Supabase Dev] Erro ao rejeitar no banco, usando LocalStorage:', dbErr);
    const local = getLocalSolicitacoes();
    const index = local.findIndex(s => s.id === solicitacaoId);
    if (index !== -1) {
      const status_anterior = local[index].status;
      local[index].status = status_novo;
      local[index].justificativa_rejeicao = justificativa;
      local[index].responsavel_id = usuarioId;
      local[index].responsavel_nome = usuarioNome;
      local[index].data_finalizacao = new Date().toISOString();
      local[index].updated_at = new Date().toISOString();
      saveLocalSolicitacoes(local);

      registrarLocalHistorico(solicitacaoId, status_anterior, status_novo, descricao, usuarioId, usuarioNome);
    }
  }
}

/**
 * Busca o histórico de movimentações de uma solicitação específica.
 */
export async function fetchHistorico(solicitacaoId: string): Promise<HistoricoSolicitacao[]> {
  try {
    const { data, error } = await supabase
      .from('historico_solicitacoes_prontuario')
      .select('*')
      .eq('solicitacao_id', solicitacaoId)
      .order('data', { ascending: true });

    if (error) throw error;
    return (data ?? []) as HistoricoSolicitacao[];

  } catch (dbErr) {
    console.warn('[Supabase Dev] Erro ao buscar histórico no banco, usando LocalStorage:', dbErr);
    const localHist = getLocalHistorico();
    return localHist
      .filter(h => h.solicitacao_id === solicitacaoId)
      .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());
  }
}

/**
 * Atualiza qualquer status de forma genérica e permite anexar arquivo ou adicionar justificativa.
 */
export async function atualizarSolicitacaoCompleta(
  solicitacaoId: string,
  novoStatus: 'Pendente' | 'Em Análise' | 'Aprovado' | 'Rejeitado' | 'Documento Disponibilizado',
  usuarioNome: string,
  usuarioId: string | null,
  justificativaRejeicao?: string,
  arquivoPDF?: File | null
): Promise<void> {
  const dataAtual = new Date().toISOString();
  let pdfUrl: string | null = null;
  let pdfName: string | null = null;

  // Se um arquivo PDF for enviado, forçamos o status final para 'Documento Disponibilizado'
  const statusEfetivo = arquivoPDF ? 'Documento Disponibilizado' : novoStatus;

  // 1. Se foi enviado um arquivo PDF, realizar o upload
  if (arquivoPDF) {
    const cleanCpf = arquivoPDF.name.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
    const storagePath = `${solicitacaoId}/${cleanCpf}`;
    try {
      const { error: storageError } = await supabase.storage
        .from('prontuarios-pdfs')
        .upload(storagePath, arquivoPDF, {
          contentType: 'application/pdf',
          upsert: true,
        });

      if (storageError) throw storageError;

      const { data: urlData } = supabase.storage
        .from('prontuarios-pdfs')
        .getPublicUrl(storagePath);
        
      pdfUrl = urlData.publicUrl;
      pdfName = arquivoPDF.name;
    } catch (storageErr: any) {
      console.warn('[Supabase Dev] Falha no upload ao storage, gerando mock URL:', storageErr);
      pdfUrl = URL.createObjectURL(arquivoPDF);
      pdfName = arquivoPDF.name;
    }
  }

  const descricao = `Solicitação atualizada para '${statusEfetivo}' pelo gestor.${
    justificativaRejeicao ? ` Motivo: ${justificativaRejeicao}` : ''
  }${pdfName ? ` Arquivo anexado: ${pdfName}` : ''}`;

  try {
    // Busca o status anterior
    const { data: current } = await supabase
      .from('solicitacoes_prontuario')
      .select('status')
      .eq('id', solicitacaoId)
      .single();

    const status_anterior = current?.status || 'Pendente';

    // Monta o payload de update
    const updateData: any = {
      status: statusEfetivo,
      responsavel_id: usuarioId,
      responsavel_nome: usuarioNome,
      updated_at: dataAtual
    };

    if (statusEfetivo === 'Rejeitado') {
      updateData.justificativa_rejeicao = justificativaRejeicao || null;
      updateData.data_finalizacao = dataAtual;
    } else if (statusEfetivo === 'Documento Disponibilizado') {
      updateData.data_finalizacao = dataAtual;
      if (pdfUrl) {
        updateData.arquivo_url = pdfUrl;
        updateData.arquivo_nome = pdfName;
      }
    } else if (statusEfetivo === 'Aprovado') {
      if (pdfUrl) {
        updateData.arquivo_url = pdfUrl;
        updateData.arquivo_nome = pdfName;
      }
    }

    const { error: updateErr } = await supabase
      .from('solicitacoes_prontuario')
      .update(updateData)
      .eq('id', solicitacaoId);

    if (updateErr) throw updateErr;

    // Grava histórico
    await supabase.from('historico_solicitacoes_prontuario').insert({
      solicitacao_id: solicitacaoId,
      status_anterior,
      status_novo: novoStatus,
      descricao,
      usuario_id: usuarioId,
      usuario_nome: usuarioNome
    });

  } catch (dbErr) {
    console.warn('[Supabase Dev] Erro na atualização completa no banco, usando LocalStorage:', dbErr);
    const local = getLocalSolicitacoes();
    const index = local.findIndex(s => s.id === solicitacaoId);
    if (index !== -1) {
      const status_anterior = local[index].status;
      local[index].status = novoStatus;
      local[index].responsavel_id = usuarioId;
      local[index].responsavel_nome = usuarioNome;
      local[index].updated_at = dataAtual;

      if (novoStatus === 'Rejeitado') {
        local[index].justificativa_rejeicao = justificativaRejeicao || null;
        local[index].data_finalizacao = dataAtual;
      } else if (novoStatus === 'Documento Disponibilizado') {
        local[index].data_finalizacao = dataAtual;
        if (pdfUrl) {
          local[index].arquivo_url = pdfUrl;
          local[index].arquivo_nome = pdfName;
        }
      } else if (novoStatus === 'Aprovado') {
        if (pdfUrl) {
          local[index].arquivo_url = pdfUrl;
          local[index].arquivo_nome = pdfName;
        }
      }

      saveLocalSolicitacoes(local);
      registrarLocalHistorico(solicitacaoId, status_anterior, novoStatus, descricao, usuarioId, usuarioNome);
    }
  }
}

/**
 * Cria uma solicitação de teste no banco de dados.
 */
export async function criarSolicitacaoTeste(): Promise<void> {
  const nomesTeste = ['Antônio da Silva Santos', 'Regina Célia de Souza', 'Cláudio Ferreira Lima', 'Beatriz Rocha Melo'];
  const cpfsTeste = ['111.222.333-44', '555.666.777-88', '999.888.777-66', '333.444.555-66'];
  const contatosTeste = ['(34) 98888-7777', '(34) 99999-8888', '(34) 97777-6666', '(34) 96666-5555'];
  const motivosTeste = [
    'Consulta com cardiologista em outra clínica médica.',
    'Necessidade de histórico cirúrgico completo para perícia médica.',
    'Apresentação de prontuário em processo judicial de aposentadoria.',
    'Acompanhamento de tratamento oncológico de rotina.'
  ];

  const indice = Math.floor(Math.random() * nomesTeste.length);

  const novaSolicitacao = {
    paciente_nome: nomesTeste[indice],
    paciente_cpf: cpfsTeste[indice],
    paciente_data_nascimento: '1980-01-01',
    paciente_contato: contatosTeste[indice],
    motivo: motivosTeste[indice],
    observacoes: 'SOLICITAÇÃO DE TESTE DO SISTEMA',
    status: 'Pendente',
    tipo_solicitacao: Math.random() > 0.5 ? 'Digital' : 'Físico'
  };

  const { error } = await supabase
    .from('solicitacoes_prontuario')
    .insert(novaSolicitacao);

  if (error) throw error;
}

