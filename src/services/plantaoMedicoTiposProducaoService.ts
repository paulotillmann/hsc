import { supabase } from '../lib/supabase';

export interface PlantaoMedicoTipoProducao {
  id?: string;
  nome: string;
  descricao?: string;
  cor?: string;
  icone?: string;
  ordem?: number;
  ativo?: boolean;
  created_at?: string;
  updated_at?: string;
}

// Fallback de segurança para quando a tabela ainda não estiver criada no Supabase ou offline
export const DEFAULT_TIPOS_PRODUCAO: PlantaoMedicoTipoProducao[] = [
  { id: 'def-1', nome: 'Procedimento', descricao: 'Exames e Cirurgias', cor: 'blue', icone: 'ClipboardList', ordem: 1, ativo: true },
  { id: 'def-2', nome: 'Consulta', descricao: 'Atendimento clínico ambulatorial', cor: 'emerald', icone: 'Stethoscope', ordem: 2, ativo: true },
  { id: 'def-3', nome: 'Parto', descricao: 'Procedimento obstétrico / cesárea / parto normal', cor: 'pink', icone: 'Baby', ordem: 3, ativo: true },
  { id: 'def-4', nome: 'Aula', descricao: 'Treinamento e instrução acadêmica/médica', cor: 'purple', icone: 'GraduationCap', ordem: 4, ativo: true },
  { id: 'def-5', nome: 'CC', descricao: 'Centro Cirúrgico', cor: 'amber', icone: 'Activity', ordem: 5, ativo: true },
  { id: 'def-6', nome: 'Coordenação', descricao: 'Coordenação e gestão médica de escala', cor: 'slate', icone: 'Briefcase', ordem: 6, ativo: true },
];

export const plantaoMedicoTiposProducaoService = {
  async listar(apenasAtivos: boolean = false): Promise<PlantaoMedicoTipoProducao[]> {
    try {
      let query = supabase
        .from('plantao_medico_tipos_producao')
        .select('*')
        .order('ordem', { ascending: true })
        .order('nome', { ascending: true });

      if (apenasAtivos) {
        query = query.eq('ativo', true);
      }

      const { data, error } = await query;

      if (error) {
        console.warn('Tabela plantao_medico_tipos_producao não encontrada ou erro ao listar. Usando padrões.', error);
        return apenasAtivos ? DEFAULT_TIPOS_PRODUCAO.filter(t => t.ativo) : DEFAULT_TIPOS_PRODUCAO;
      }

      if (!data || data.length === 0) {
        return apenasAtivos ? DEFAULT_TIPOS_PRODUCAO.filter(t => t.ativo) : DEFAULT_TIPOS_PRODUCAO;
      }

      return data;
    } catch (err) {
      console.error('Falha ao listar tipos de produção:', err);
      return apenasAtivos ? DEFAULT_TIPOS_PRODUCAO.filter(t => t.ativo) : DEFAULT_TIPOS_PRODUCAO;
    }
  },

  async criar(tipo: Omit<PlantaoMedicoTipoProducao, 'id' | 'created_at' | 'updated_at'>): Promise<PlantaoMedicoTipoProducao> {
    const payload = {
      nome: tipo.nome.trim(),
      descricao: (tipo.descricao || '').trim(),
      cor: tipo.cor || 'blue',
      icone: tipo.icone || 'Activity',
      ordem: tipo.ordem !== undefined ? tipo.ordem : 0,
      ativo: tipo.ativo !== undefined ? tipo.ativo : true,
    };

    const { data, error } = await supabase
      .from('plantao_medico_tipos_producao')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar tipo de produção:', error);
      throw error;
    }

    return data;
  },

  async atualizar(id: string, tipo: Partial<PlantaoMedicoTipoProducao>): Promise<PlantaoMedicoTipoProducao> {
    const payload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (tipo.nome !== undefined) payload.nome = tipo.nome.trim();
    if (tipo.descricao !== undefined) payload.descricao = tipo.descricao.trim();
    if (tipo.cor !== undefined) payload.cor = tipo.cor;
    if (tipo.icone !== undefined) payload.icone = tipo.icone;
    if (tipo.ordem !== undefined) payload.ordem = tipo.ordem;
    if (tipo.ativo !== undefined) payload.ativo = tipo.ativo;

    const { data, error } = await supabase
      .from('plantao_medico_tipos_producao')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar tipo de produção:', error);
      throw error;
    }

    return data;
  },

  async toggleAtivo(id: string, ativo: boolean): Promise<PlantaoMedicoTipoProducao> {
    return this.atualizar(id, { ativo });
  },

  async excluir(id: string): Promise<void> {
    const { error } = await supabase
      .from('plantao_medico_tipos_producao')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao excluir tipo de produção:', error);
      throw error;
    }
  },
};
