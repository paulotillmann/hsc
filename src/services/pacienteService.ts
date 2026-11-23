import { supabase } from '../lib/supabase';

export interface Paciente {
  id: string;
  nome: string;
  clinica: string;
  leito: string;
  apartamento: string;
  data_internacao: string; // ISO 8601
  convenio: string;
  // Novos campos do JSON do n8n
  dt_nascimento: string;
  medico: string;
  categoria: string;
  responsavel: string;
  cpf_responsavel: string;
  probabilidade_alta: string;
  nr_prontuario: number | null;
  dias_internado: number | null;
  previsao_alta: string;
  data_alta: string;
  cd_setor_atendimento: number | null;
}

// Variáveis de cache local e controle de sincronização
let cachedPacientes: Paciente[] | null = null;
let cacheTimestamp = 0;
let lastEdgeSyncTimestamp = 0;
let isEdgeSyncing = false;
let forceEdgeSync = false;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos de cache

/**
 * Extrai a data (YYYY-MM-DD) de uma string ISO ou timestamp do banco
 */
function extractDatePart(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  return String(dateStr).split('T')[0].split(' ')[0];
}

/**
 * Extrai o nome completo limpo do paciente removendo o sufixo de idade (ex: " - 73 Anos")
 */
function extractCleanPatientName(rawNomeIdade: string | null | undefined, fallbackPaciente?: string | null): string {
  const source = (rawNomeIdade || fallbackPaciente || '').trim();
  if (!source) return 'Nome Indisponível';

  const match = source.match(/^(.*?)\s*-\s*\d+\s*(?:Anos?|Meses?|Mês|Dias?)/i);
  if (match && match[1]?.trim()) {
    return match[1].trim();
  }

  return source.split(' - ')[0]?.trim() || source;
}

/**
 * Mapeia os registros da tabela `pacientes_internados` do Supabase para a interface `Paciente` da Recepção
 */
function mapDbRowToPaciente(item: any, index: number): Paciente {
  const nome = extractCleanPatientName(
    item.nome_idade || item["A.NM_PACIENTE||'-'||A.DS_IDADE"] || item.NM_PESSOA_FISICA || item.NM_PACIENTE,
    item.paciente || item.PACIENTE
  );

  return {
    id: item.nr_atendimento?.toString() || item.NR_ATENDIMENTO?.toString() || item.id?.toString() || String(index),
    nome,
    clinica: item.ds_setor_atendimento || item.DS_SETOR_ATENDIMENTO || item.SETOR || item.DS_CLINICA || '',
    leito: (item.leito || item.LEITO || item.cd_unidade || item.CD_UNIDADE || '').trim(),
    apartamento: item.apartamento || item.APARTAMENTO || '',
    data_internacao: extractDatePart(item.dt_entrada || item.DT_ENTRADA),
    convenio: item.ds_convenio || item.DS_CONVENIO || 'SUS',
    dt_nascimento: extractDatePart(item.dt_nascimento || item.DT_NASCIMENTO),
    medico: item.nm_guerra || item.NM_GUERRA || item.MEDICO || '',
    categoria: item.ds_categoria || item.DS_CATEGORIA || item.CATEGORIA || '',
    responsavel: item.responsavel || item.RESPONSAVEL || '',
    cpf_responsavel: item.cpf_responsavel || item.CPF_RESPONSAVEL || '',
    probabilidade_alta: item.ds_probabilidade || item.DS_PROBABILIDADE || item.PROBABILIDADE_ALTA || '',
    nr_prontuario: item.nr_prontuario ?? item.NR_PRONTUARIO ?? null,
    dias_internado: item.dias_internado ?? item.DIAS_INTERNADO ?? item.QT_DIA_PERMANENCIA ?? null,
    previsao_alta: item.previsao_alta || item.PREVISAO_ALTA || item.DT_PREVISTO_ALTA || '',
    data_alta: item.data_alta || item.DT_ALTA_MEDICO || item.DT_ALTA || '',
    cd_setor_atendimento: item.cd_setor_atendimento ?? item.CD_SETOR_ATENDIMENTO ?? null,
  };
}

/**
 * Consulta os pacientes internados ativos diretamente na tabela `pacientes_internados` do Supabase
 */
async function carregarPacientesDoBanco(): Promise<Paciente[]> {
  const { data, error } = await supabase
    .from('pacientes_internados')
    .select('*')
    .eq('ativo', true)
    .order('nome_idade', { ascending: true });

  if (error) {
    throw error;
  }

  return (data || []).map((item, index) => mapDbRowToPaciente(item, index));
}

/**
 * Aciona a Edge Function `trigger_n8n_sync_pacientes` no Supabase para atualizar a tabela `pacientes_internados`
 */
async function sincronizarPacientesViaEdgeFunction(): Promise<void> {
  if (isEdgeSyncing) return;
  isEdgeSyncing = true;
  try {
    const { error } = await supabase.functions.invoke('trigger_n8n_sync_pacientes', {
      method: 'POST',
    });
    if (error) {
      console.warn('[PacienteService] Aviso ao sincronizar via Edge Function:', error.message);
    } else {
      lastEdgeSyncTimestamp = Date.now();
    }
  } catch (err) {
    console.warn('[PacienteService] Falha ao invocar trigger_n8n_sync_pacientes:', err);
  } finally {
    isEdgeSyncing = false;
  }
}

/**
 * Busca pacientes internados a partir da tabela `pacientes_internados` do Supabase
 * (sincronizada com o Tasy/n8n pela Edge Function `trigger_n8n_sync_pacientes`).
 * Faz cache em memória por 5 minutos para otimizar as buscas.
 * @param query Nome do paciente para pesquisa (opcional)
 */
export async function buscarPacientes(query?: string): Promise<Paciente[]> {
  try {
    const now = Date.now();

    // Se o usuário clicou em "Atualizar Lista" (forceEdgeSync), aguarda a sincronização com o n8n primeiro
    if (forceEdgeSync) {
      forceEdgeSync = false;
      await sincronizarPacientesViaEdgeFunction();
      cachedPacientes = await carregarPacientesDoBanco();
      cacheTimestamp = Date.now();
    } else if (!cachedPacientes || now - cacheTimestamp > CACHE_DURATION) {
      // Carrega imediatamente do banco Supabase para resposta instantânea
      cachedPacientes = await carregarPacientesDoBanco();
      cacheTimestamp = Date.now();

      // Se a última sincronização via Edge Function ocorreu há mais de 5 minutos, dispara em background
      if (now - lastEdgeSyncTimestamp > CACHE_DURATION && !isEdgeSyncing) {
        sincronizarPacientesViaEdgeFunction().then(async () => {
          try {
            cachedPacientes = await carregarPacientesDoBanco();
            cacheTimestamp = Date.now();
          } catch {
            // Mantém os dados já carregados em cache
          }
        });
      }
    }

    if (!query || query.trim().length === 0) {
      return cachedPacientes || [];
    }

    const q = query.toLowerCase().trim();
    return (cachedPacientes || []).filter(p => p.nome.toLowerCase().includes(q));
  } catch (error) {
    console.error('[PacienteService] Erro ao buscar pacientes:', error);
    return cachedPacientes || [];
  }
}

/** Limpa o cache para forçar uma nova sincronização e busca no banco */
export function limparCachePacientes() {
  cachedPacientes = null;
  cacheTimestamp = 0;
  forceEdgeSync = true;
}
