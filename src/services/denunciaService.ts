// src/services/denunciaService.ts
import { supabase } from '../lib/supabase';

export interface Denuncia {
  id: string;
  protocolo: string;
  categoria: string;
  categoriaLabel: string;
  descricao: string;
  dataSubmetida: string;
  dataOcorrencia?: string;
  localOcorrencia?: string;
  anonimo: boolean;
  nomeRelator?: string;
  emailRelator?: string;
  telefoneRelator?: string;
  cargoRelator?: string;
  status: 'Pendente' | 'Em Investigação' | 'Concluído' | 'Arquivado';
  prioridade: 'Baixa' | 'Média' | 'Alta' | 'Crítica';
  timeline: {
    data: string;
    titulo: string;
    descricao: string;
    usuario: string;
  }[];
  anexos?: string[];
}

export interface AuditLog {
  id: string;
  data: string;
  protocolo: string;
  acao: string;
  usuario: string;
  origem: string;
}

const LOCAL_STORAGE_DENUNCIAS_KEY = 'hsc_denuncias';
const LOCAL_STORAGE_LOGS_KEY = 'hsc_audit_logs';

// Dados Mockados para fallback caso o banco não esteja criado
const DEFAULT_DENUNCIAS: Denuncia[] = [
  {
    id: '1',
    protocolo: 'HSC-2026-AXK82',
    categoria: 'assedio-moral',
    categoriaLabel: 'Assédio Moral / Abuso de Poder',
    descricao: 'O gestor do setor de recepção tem se dirigido à equipe de forma desrespeitosa e agressiva de forma sistemática, gritando na frente de pacientes e ameaçando demissões sem justificativa viável.',
    dataSubmetida: '2026-05-24T10:15:00Z',
    dataOcorrencia: '2026-05-23',
    localOcorrencia: 'Recepção Central',
    anonimo: true,
    status: 'Pendente',
    prioridade: 'Alta',
    timeline: [
      {
        data: '2026-05-24T10:15:00Z',
        titulo: 'Denúncia Registrada',
        descricao: 'O relato foi recebido de forma 100% anônima pelo canal ético.',
        usuario: 'Sistema'
      }
    ],
    anexos: []
  },
  {
    id: '2',
    protocolo: 'HSC-2026-PLW19',
    categoria: 'fraude-corrupcao',
    categoriaLabel: 'Fraude / Desvio / Corrupção / Roubo',
    descricao: 'Constatamos divergência recorrente no inventário físico de medicamentos controlados de alto custo na farmácia satélite do bloco cirúrgico durante a passagem de plantão nos últimos três finais de semana.',
    dataSubmetida: '2026-05-22T21:40:00Z',
    dataOcorrencia: '2026-05-17',
    localOcorrencia: 'Farmácia Bloco Cirúrgico',
    anonimo: true,
    status: 'Em Investigação',
    prioridade: 'Crítica',
    timeline: [
      {
        data: '2026-05-22T21:40:00Z',
        titulo: 'Denúncia Registrada',
        descricao: 'O relato foi recebido de forma 100% anônima pelo canal ético.',
        usuario: 'Sistema'
      },
      {
        data: '2026-05-23T08:30:00Z',
        titulo: 'Triagem Inicial Concluída',
        descricao: 'Prioridade definida como Crítica pelo comitê ético devido ao teor da ocorrência.',
        usuario: 'Auditoria Interna'
      },
      {
        data: '2026-05-23T09:00:00Z',
        titulo: 'Status alterado para Em Investigação',
        descricao: 'Iniciada a auditoria dos prontuários e registros eletrônicos de dispensação de medicamentos del bloco cirúrgico.',
        usuario: 'Comitê de Ética'
      }
    ],
    anexos: ['divergencias_farmacia_SAT.xlsx', 'foto_estoque_lacres.jpg']
  },
  {
    id: '3',
    protocolo: 'HSC-2026-MTR54',
    categoria: 'seguranca-paciente',
    categoriaLabel: 'Segurança do Paciente',
    descricao: 'Omissão grave de protocolo de segurança na administração de medicação injetável no leito 12 da UTI Adulta. O erro gerou intercorrência grave no paciente, que precisou ser revertida às pressas, e os envolvidos tentaram ocultar a ficha de ocorrência clínica.',
    dataSubmetida: '2026-05-20T14:30:00Z',
    dataOcorrencia: '2026-05-19',
    localOcorrencia: 'UTI Adulta - Leito 12',
    anonimo: false,
    nomeRelator: 'Clara Silveira Mendonça',
    emailRelator: 'clara.mendonca@hsc.com.br',
    telefoneRelator: '(34) 98822-1144',
    cargoRelator: 'Enfermeira Assistencial',
    status: 'Concluído',
    prioridade: 'Crítica',
    timeline: [
      {
        data: '2026-05-20T14:30:00Z',
        titulo: 'Denúncia Registrada',
        descricao: 'Relato confidencial registrado pela colaboradora enfermeira.',
        usuario: 'Sistema'
      },
      {
        data: '2026-05-21T10:00:00Z',
        titulo: 'Status alterado para Em Investigação',
        descricao: 'Convocação do supervisor do setor para apresentação do livro de registros clínicos.',
        usuario: 'Diretoria Clínica'
      },
      {
        data: '2026-05-25T09:15:00Z',
        titulo: 'Status alterado para Concluído',
        descricao: 'Processo administrativo aberto para aplicação de medidas disciplinares. Protocolo de segurança da UTI reforçado com a equipe.',
        usuario: 'Comitê de Ética'
      }
    ],
    anexos: ['prontuario_leito12_ocultado.pdf']
  }
];

const DEFAULT_LOGS: AuditLog[] = [
  {
    id: 'L1',
    data: '2026-05-25T14:55:00Z',
    protocolo: 'HSC-2026-AXK82',
    acao: 'Visualização completa dos detalhes da denúncia',
    usuario: 'Comitê de Ética',
    origem: '[IP BLINDADO POR SEGURANÇA]'
  },
  {
    id: 'L2',
    data: '2026-05-25T14:30:00Z',
    protocolo: 'HSC-2026-PLW19',
    acao: 'Visualização completa dos detalhes da denúncia',
    usuario: 'Compliance HSC',
    origem: '[IP BLINDADO POR SEGURANÇA]'
  }
];

// Métodos de Fallback para LocalStorage
const getLocalDenuncias = (): Denuncia[] => {
  const saved = localStorage.getItem(LOCAL_STORAGE_DENUNCIAS_KEY);
  if (!saved) {
    localStorage.setItem(LOCAL_STORAGE_DENUNCIAS_KEY, JSON.stringify(DEFAULT_DENUNCIAS));
    return DEFAULT_DENUNCIAS;
  }
  return JSON.parse(saved);
};

const saveLocalDenuncias = (denuncias: Denuncia[]) => {
  localStorage.setItem(LOCAL_STORAGE_DENUNCIAS_KEY, JSON.stringify(denuncias));
};

const getLocalLogs = (): AuditLog[] => {
  const saved = localStorage.getItem(LOCAL_STORAGE_LOGS_KEY);
  if (!saved) {
    localStorage.setItem(LOCAL_STORAGE_LOGS_KEY, JSON.stringify(DEFAULT_LOGS));
    return DEFAULT_LOGS;
  }
  return JSON.parse(saved);
};

const saveLocalLogs = (logs: AuditLog[]) => {
  localStorage.setItem(LOCAL_STORAGE_LOGS_KEY, JSON.stringify(logs));
};

// ── SERVIÇO DE CONEXÃO HÍBRIDA ──
export const denunciaService = {
  
  /**
   * Lista todas as denúncias cadastradas
   */
  async listarDenuncias(): Promise<Denuncia[]> {
    try {
      const { data, error } = await supabase
        .from('denuncias')
        .select('*')
        .order('data_submetida', { ascending: false });

      if (error) throw error;
      
      // Mapeia do banco de dados (snake_case) para a interface do frontend (camelCase)
      return data.map((d: any) => ({
        id: d.id,
        protocolo: d.protocolo,
        categoria: d.categoria,
        categoriaLabel: d.categoria_label,
        descricao: d.descricao,
        dataSubmetida: d.data_submetida,
        dataOcorrencia: d.data_ocorrencia,
        localOcorrencia: d.local_ocorrencia,
        anonimo: d.anonimo,
        nomeRelator: d.nome_relator,
        emailRelator: d.email_relator,
        telefoneRelator: d.telefone_relator,
        cargoRelator: d.cargo_relator,
        status: d.status,
        prioridade: d.prioridade,
        timeline: d.timeline || [],
        anexos: d.anexos || []
      }));
    } catch (e) {
      console.warn('[Supabase Dev] Erro ao listar do banco, usando localStorage:', e);
      return getLocalDenuncias();
    }
  },

  /**
   * Lista logs de auditoria
   */
  async listarLogs(): Promise<AuditLog[]> {
    try {
      const { data, error } = await supabase
        .from('denuncia_audit_logs')
        .select('*')
        .order('data', { ascending: false });

      if (error) throw error;

      return data.map((l: any) => ({
        id: l.id,
        data: l.data,
        protocolo: l.protocolo,
        acao: l.acao,
        usuario: l.usuario,
        origem: l.origem
      }));
    } catch (e) {
      console.warn('[Supabase Dev] Erro ao listar logs do banco, usando localStorage:', e);
      return getLocalLogs();
    }
  },

  /**
   * Cria um novo relato
   */
  async criarDenuncia(denuncia: Omit<Denuncia, 'id' | 'dataSubmetida' | 'timeline' | 'status' | 'prioridade'>): Promise<Denuncia> {
    const dataAtual = new Date().toISOString();
    const defaultTimeline = [
      {
        data: dataAtual,
        titulo: 'Denúncia Registrada',
        descricao: denuncia.anonimo 
          ? 'O relato foi recebido de forma 100% anônima pelo canal ético.'
          : 'Relato confidencial registrado pelo colaborador.',
        usuario: 'Sistema'
      }
    ];

    try {
      const payload = {
        protocolo: denuncia.protocolo,
        categoria: denuncia.categoria,
        categoria_label: denuncia.categoriaLabel,
        descricao: denuncia.descricao,
        data_submetida: dataAtual,
        data_ocorrencia: denuncia.dataOcorrencia || null,
        local_ocorrencia: denuncia.localOcorrencia || null,
        anonimo: denuncia.anonimo,
        nome_relator: denuncia.anonimo ? null : (denuncia.nomeRelator || null),
        email_relator: denuncia.anonimo ? null : (denuncia.emailRelator || null),
        telefone_relator: denuncia.anonimo ? null : (denuncia.telefoneRelator || null),
        cargo_relator: denuncia.anonimo ? null : (denuncia.cargoRelator || null),
        status: 'Pendente',
        prioridade: 'Baixa',
        timeline: defaultTimeline,
        anexos: denuncia.anexos || []
      };

      const { data, error } = await supabase
        .from('denuncias')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      return {
        id: data.id,
        protocolo: data.protocolo,
        categoria: data.categoria,
        categoriaLabel: data.categoria_label,
        descricao: data.descricao,
        dataSubmetida: data.data_submetida,
        dataOcorrencia: data.data_ocorrencia,
        localOcorrencia: data.local_ocorrencia,
        anonimo: data.anonimo,
        nomeRelator: data.nome_relator,
        emailRelator: data.email_relator,
        telefoneRelator: data.telefone_relator,
        cargoRelator: data.cargo_relator,
        status: data.status,
        prioridade: data.prioridade,
        timeline: data.timeline,
        anexos: data.anexos || []
      };
    } catch (e) {
      console.warn('[Supabase Dev] Erro ao criar no banco, salvando no localStorage:', e);
      const local = getLocalDenuncias();
      const novoRelato: Denuncia = {
        ...denuncia,
        id: 'D' + Date.now(),
        dataSubmetida: dataAtual,
        status: 'Pendente',
        prioridade: 'Baixa',
        timeline: defaultTimeline,
        anexos: denuncia.anexos || []
      };
      
      saveLocalDenuncias([novoRelato, ...local]);
      return novoRelato;
    }
  },

  /**
   * Atualiza o status e/ou prioridade de uma denúncia
   */
  async atualizarDenuncia(
    id: string, 
    status: 'Pendente' | 'Em Investigação' | 'Concluído' | 'Arquivado', 
    prioridade: 'Baixa' | 'Média' | 'Alta' | 'Crítica',
    timelineItem: { data: string; titulo: string; descricao: string; usuario: string }
  ): Promise<Denuncia> {
    
    // Obter denúncia atual primeiro para append de timeline
    let denunciaAtual: Denuncia | null = null;
    
    try {
      const { data, error } = await supabase
        .from('denuncias')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      denunciaAtual = {
        id: data.id,
        protocolo: data.protocolo,
        categoria: data.categoria,
        categoriaLabel: data.categoria_label,
        descricao: data.descricao,
        dataSubmetida: data.data_submetida,
        dataOcorrencia: data.data_ocorrencia,
        localOcorrencia: data.local_ocorrencia,
        anonimo: data.anonimo,
        nomeRelator: data.nome_relator,
        emailRelator: data.email_relator,
        telefoneRelator: data.telefone_relator,
        cargoRelator: data.cargo_relator,
        status: data.status,
        prioridade: data.prioridade,
        timeline: data.timeline || [],
        anexos: data.anexos || []
      };
    } catch (e) {
      // Fallback local se falhar na consulta
      const local = getLocalDenuncias();
      denunciaAtual = local.find(d => d.id === id) || null;
    }

    if (!denunciaAtual) {
      throw new Error(`Denúncia com o ID ${id} não foi encontrada.`);
    }

    const novaTimeline = [...denunciaAtual.timeline, timelineItem];

    try {
      const { data, error } = await supabase
        .from('denuncias')
        .update({
          status,
          prioridade,
          timeline: novaTimeline
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return {
        id: data.id,
        protocolo: data.protocolo,
        categoria: data.categoria,
        categoriaLabel: data.categoria_label,
        descricao: data.descricao,
        dataSubmetida: data.data_submetida,
        dataOcorrencia: data.data_ocorrencia,
        localOcorrencia: data.local_ocorrencia,
        anonimo: data.anonimo,
        nomeRelator: data.nome_relator,
        emailRelator: data.email_relator,
        telefoneRelator: data.telefone_relator,
        cargoRelator: data.cargo_relator,
        status: data.status,
        prioridade: data.prioridade,
        timeline: data.timeline,
        anexos: data.anexos || []
      };
    } catch (e) {
      console.warn('[Supabase Dev] Erro ao atualizar no banco, salvando localmente:', e);
      const local = getLocalDenuncias();
      let updated: Denuncia | null = null;
      
      const newLocal = local.map(d => {
        if (d.id === id) {
          updated = {
            ...d,
            status,
            prioridade,
            timeline: novaTimeline
          };
          return updated;
        }
        return d;
      });

      saveLocalDenuncias(newLocal);
      return updated || denunciaAtual;
    }
  },

  /**
   * Registra log de auditoria
   */
  async registrarLog(protocolo: string, acao: string, usuario: string): Promise<void> {
    try {
      const payload = {
        protocolo,
        acao,
        usuario,
        origem: '[IP BLINDADO POR SEGURANÇA]'
      };

      const { error } = await supabase
        .from('denuncia_audit_logs')
        .insert(payload);

      if (error) throw error;
    } catch (e) {
      console.warn('[Supabase Dev] Erro ao registrar log no banco, salvando localmente:', e);
      const localLogs = getLocalLogs();
      const newLog: AuditLog = {
        id: 'L' + Date.now(),
        data: new Date().toISOString(),
        protocolo,
        acao,
        usuario,
        origem: '[IP BLINDADO POR SEGURANÇA]'
      };
      saveLocalLogs([newLog, ...localLogs]);
    }
  },

  /**
   * Obtém os detalhes de uma denúncia a partir de seu protocolo único (para acompanhamento público seguro)
   */
  async obterDenunciaPorProtocolo(protocolo: string): Promise<Denuncia | null> {
    try {
      const { data, error } = await supabase
        .from('denuncias')
        .select('*')
        .eq('protocolo', protocolo.trim().toUpperCase())
        .single();

      if (error) throw error;

      return {
        id: data.id,
        protocolo: data.protocolo,
        categoria: data.categoria,
        categoriaLabel: data.categoria_label,
        descricao: data.descricao,
        dataSubmetida: data.data_submetida,
        dataOcorrencia: data.data_ocorrencia,
        localOcorrencia: data.local_ocorrencia,
        anonimo: data.anonimo,
        nomeRelator: data.nome_relator,
        emailRelator: data.email_relator,
        telefoneRelator: data.telefone_relator,
        cargoRelator: data.cargo_relator,
        status: data.status,
        prioridade: data.prioridade,
        timeline: data.timeline || [],
        anexos: data.anexos || []
      };
    } catch (e) {
      console.warn('[Supabase Dev] Erro ao obter denúncia por protocolo, usando localStorage:', e);
      const local = getLocalDenuncias();
      return local.find(d => d.protocolo.toUpperCase() === protocolo.trim().toUpperCase()) || null;
    }
  }
};
