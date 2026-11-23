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

export interface PeriodoSalvoResumo {
  periodo_de: string;
  periodo_ate: string;
  total: number;
  com_producoes: number;
  emails_enviados: number;
}

const getMonthBounds = (periodoDe: string, periodoAte: string): { start: string; end: string } | null => {
  const matchFrom = /^(\d{4})-(\d{2})-\d{2}$/.exec(periodoDe);
  const matchTo = /^(\d{4})-(\d{2})-\d{2}$/.exec(periodoAte);
  if (!matchFrom || !matchTo) return null;

  const start = `${matchFrom[1]}-${matchFrom[2]}-01`;
  const endYear = parseInt(matchTo[1], 10);
  const endMonth = parseInt(matchTo[2], 10);
  const lastDay = String(new Date(endYear, endMonth, 0).getDate()).padStart(2, '0');
  const end = `${matchTo[1]}-${matchTo[2]}-${lastDay}`;

  return start <= end ? { start, end } : { start: end, end: start };
};

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
   * Detecta outros recortes de período salvos no Supabase dentro do(s) mesmo(s) mês(es)
   * do filtro atual (ex.: registros salvos em 01/10..30/10 quando o usuário abre 01/10..31/10).
   */
  async listarPeriodosRelacionados(periodoDe: string, periodoAte: string): Promise<PeriodoSalvoResumo[]> {
    if (!periodoDe || !periodoAte) return [];
    const bounds = getMonthBounds(periodoDe, periodoAte);
    if (!bounds) return [];

    const pageSize = 1000;
    let fromIdx = 0;
    const allRows: {
      periodo_de: string;
      periodo_ate: string;
      producoes: ProducaoItemDB[] | null;
      email_enviado: boolean | null;
    }[] = [];

    while (true) {
      const { data, error } = await supabase
        .from('plantao_medico_producoes')
        .select('periodo_de, periodo_ate, producoes, email_enviado')
        .lte('periodo_de', bounds.end)
        .gte('periodo_ate', bounds.start)
        .range(fromIdx, fromIdx + pageSize - 1);

      if (error) {
        console.error('Erro ao buscar períodos relacionados de plantão médico:', error);
        return [];
      }

      if (!data || data.length === 0) break;
      allRows.push(...data);
      if (data.length < pageSize) break;
      fromIdx += pageSize;
    }

    const grouped = new Map<string, PeriodoSalvoResumo>();

    allRows.forEach(row => {
      if (row.periodo_de === periodoDe && row.periodo_ate === periodoAte) return;
      const key = `${row.periodo_de}|||${row.periodo_ate}`;
      const existing = grouped.get(key) || {
        periodo_de: row.periodo_de,
        periodo_ate: row.periodo_ate,
        total: 0,
        com_producoes: 0,
        emails_enviados: 0
      };

      existing.total += 1;
      if (Array.isArray(row.producoes) && row.producoes.length > 0) {
        existing.com_producoes += 1;
      }
      if (row.email_enviado) {
        existing.emails_enviados += 1;
      }

      grouped.set(key, existing);
    });

    return Array.from(grouped.values()).sort((a, b) => {
      if (b.com_producoes !== a.com_producoes) return b.com_producoes - a.com_producoes;
      if (b.emails_enviados !== a.emails_enviados) return b.emails_enviados - a.emails_enviados;
      return b.total - a.total;
    });
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

    // 1. Buscar registro existente para nunca sobrescrever produções, valor pago ou status
    const { data: existing, error: selectError } = await supabase
      .from('plantao_medico_producoes')
      .select('id')
      .eq('medico', cleanMedico)
      .eq('especialidade', cleanEsp)
      .eq('tipo_plantao', cleanTipo)
      .eq('periodo_de', params.periodo_de)
      .eq('periodo_ate', params.periodo_ate)
      .maybeSingle();

    if (selectError) {
      console.error('Erro ao consultar registro antes de registrar envio de e-mail:', selectError);
      throw selectError;
    }

    const emailFields = {
      email_enviado: true,
      email_enviado_em: nowIso,
      email_enviado_para: params.destinatarios || [],
      updated_at: nowIso
    };

    let data: PlantaoMedicoProducaoDB | null = null;
    let error: any = null;

    if (existing?.id) {
      // Atualização parcial preserva integralmente producoes, valor_pago e status
      const updateRes = await supabase
        .from('plantao_medico_producoes')
        .update(emailFields)
        .eq('id', existing.id)
        .select()
        .single();
      data = updateRes.data;
      error = updateRes.error;
    } else {
      const insertRes = await supabase
        .from('plantao_medico_producoes')
        .insert({
          medico: cleanMedico,
          especialidade: cleanEsp,
          tipo_plantao: cleanTipo,
          periodo_de: params.periodo_de,
          periodo_ate: params.periodo_ate,
          producoes: [],
          valor_pago: 0,
          status: 'Pendente',
          ...emailFields
        })
        .select()
        .single();

      // Em caso de concorrência (registro criado entre SELECT e INSERT), faz update parcial na chave natural
      if (insertRes.error?.code === '23505') {
        const retryUpdate = await supabase
          .from('plantao_medico_producoes')
          .update(emailFields)
          .eq('medico', cleanMedico)
          .eq('especialidade', cleanEsp)
          .eq('tipo_plantao', cleanTipo)
          .eq('periodo_de', params.periodo_de)
          .eq('periodo_ate', params.periodo_ate)
          .select()
          .single();
        data = retryUpdate.data;
        error = retryUpdate.error;
      } else {
        data = insertRes.data;
        error = insertRes.error;
      }
    }

    if (error || !data) {
      console.error('Erro ao registrar status de envio de e-mail:', error);
      throw error || new Error('Não foi possível registrar o envio de e-mail.');
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
