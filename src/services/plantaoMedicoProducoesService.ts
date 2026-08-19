import { supabase } from '../lib/supabase';

export interface ProducaoItemDB {
  id: string;
  tipoProducao: string;
  valorProducao: number;
}

export interface PlantaoMedicoProducaoDB {
  id?: string;
  medico: string;
  especialidade: string;
  tipo_plantao: string;
  periodo_de: string;
  periodo_ate: string;
  producoes: ProducaoItemDB[];
  valor_pago: number;
  status: 'Pago' | 'Pendente' | 'Parcial';
  email_enviado?: boolean;
  email_enviado_em?: string;
  email_enviado_para?: string[];
  created_at?: string;
  updated_at?: string;
  created_by?: string;
}

export const plantaoMedicoProducoesService = {
  /**
   * Lista todas as produções salvas no Supabase para o período especificado
   */
  async listarPorPeriodo(periodoDe: string, periodoAte: string): Promise<PlantaoMedicoProducaoDB[]> {
    if (!periodoDe || !periodoAte) return [];

    const { data, error } = await supabase
      .from('plantao_medico_producoes')
      .select('*')
      .eq('periodo_de', periodoDe)
      .eq('periodo_ate', periodoAte);

    if (error) {
      console.error('Erro ao listar produções de plantão médico:', error);
      throw error;
    }

    return data || [];
  },

  /**
   * Salva ou atualiza uma produção de plantão médico via upsert baseado no período + médico + especialidade + tipo_plantao
   */
  async salvarProducao(payload: {
    medico: string;
    especialidade: string;
    tipo_plantao: string;
    periodo_de: string;
    periodo_ate: string;
    producoes: ProducaoItemDB[];
    valor_pago: number;
    status: 'Pago' | 'Pendente' | 'Parcial';
  }): Promise<PlantaoMedicoProducaoDB> {
    const cleanPayload = {
      medico: payload.medico.trim(),
      especialidade: (payload.especialidade || '').trim(),
      tipo_plantao: (payload.tipo_plantao || '').trim(),
      periodo_de: payload.periodo_de,
      periodo_ate: payload.periodo_ate,
      producoes: payload.producoes || [],
      valor_pago: payload.valor_pago || 0,
      status: payload.status || 'Pendente',
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('plantao_medico_producoes')
      .upsert(cleanPayload, {
        onConflict: 'periodo_de,periodo_ate,medico,especialidade,tipo_plantao'
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao salvar produção de plantão médico:', error);
      throw error;
    }

    return data;
  },

  /**
   * Registra que o e-mail do demonstrativo foi enviado com sucesso para o médico no período
   */
  async registrarEnvioEmail(params: {
    medico: string;
    especialidade?: string;
    tipo_plantao?: string;
    periodo_de: string;
    periodo_ate: string;
    destinatarios: string[];
  }): Promise<PlantaoMedicoProducaoDB> {
    const cleanMedico = params.medico.trim();
    const cleanEsp = (params.especialidade || '').trim();
    const cleanTipo = (params.tipo_plantao || '').trim();
    const nowIso = new Date().toISOString();

    // 1. Buscar registro existente para manter produções e status intactos
    const { data: existing } = await supabase
      .from('plantao_medico_producoes')
      .select('id, producoes, valor_pago, status')
      .eq('medico', cleanMedico)
      .eq('especialidade', cleanEsp)
      .eq('tipo_plantao', cleanTipo)
      .eq('periodo_de', params.periodo_de)
      .eq('periodo_ate', params.periodo_ate)
      .maybeSingle();

    const { data, error } = await supabase
      .from('plantao_medico_producoes')
      .upsert({
        id: existing?.id,
        medico: cleanMedico,
        especialidade: cleanEsp,
        tipo_plantao: cleanTipo,
        periodo_de: params.periodo_de,
        periodo_ate: params.periodo_ate,
        producoes: existing?.producoes || [],
        valor_pago: existing?.valor_pago || 0,
        status: existing?.status || 'Pendente',
        email_enviado: true,
        email_enviado_em: nowIso,
        email_enviado_para: params.destinatarios || [],
        updated_at: nowIso
      }, {
        onConflict: 'periodo_de,periodo_ate,medico,especialidade,tipo_plantao'
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao registrar status de envio de e-mail:', error);
      throw error;
    }

    // 2. Registrar no log de auditoria
    try {
      await supabase
        .from('plantao_medico_email_logs')
        .insert({
          medico: cleanMedico,
          especialidade: cleanEsp,
          tipo_plantao: cleanTipo,
          periodo_de: params.periodo_de,
          periodo_ate: params.periodo_ate,
          destinatarios: params.destinatarios || [],
          status: 'sucesso',
          enviado_em: nowIso
        });
    } catch (logErr) {
      console.warn('Não foi possível gravar log de auditoria de e-mail:', logErr);
    }

    return data;
  },

  /**
   * Exclui um registro de produção médica caso necessário
   */
  async excluirProducao(id: string): Promise<void> {
    const { error } = await supabase
      .from('plantao_medico_producoes')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao excluir produção de plantão médico:', error);
      throw error;
    }
  }
};
