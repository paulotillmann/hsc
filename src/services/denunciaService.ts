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

// Dados Mockados para fallback caso o banco não esteja criado (Inicializado vazio para produção)
const DEFAULT_DENUNCIAS: Denuncia[] = [];

const DEFAULT_LOGS: AuditLog[] = [];

// Métodos de Fallback para LocalStorage
const getLocalDenuncias = (): Denuncia[] => {
  const saved = localStorage.getItem(LOCAL_STORAGE_DENUNCIAS_KEY);
  if (!saved) {
    localStorage.setItem(LOCAL_STORAGE_DENUNCIAS_KEY, JSON.stringify(DEFAULT_DENUNCIAS));
    return DEFAULT_DENUNCIAS;
  }
  // Limpa denúncias antigas do mock
  const parsed = JSON.parse(saved);
  const filtered = parsed.filter((d: any) => d.id !== '1' && d.id !== '2' && d.id !== '3');
  if (filtered.length !== parsed.length) {
    localStorage.setItem(LOCAL_STORAGE_DENUNCIAS_KEY, JSON.stringify(filtered));
    return filtered;
  }
  return parsed;
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
  // Limpa logs antigos do mock
  const parsed = JSON.parse(saved);
  const filtered = parsed.filter((l: any) => l.id !== 'L1' && l.id !== 'L2');
  if (filtered.length !== parsed.length) {
    localStorage.setItem(LOCAL_STORAGE_LOGS_KEY, JSON.stringify(filtered));
    return filtered;
  }
  return parsed;
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
