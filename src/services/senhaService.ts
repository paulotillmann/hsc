import { supabase } from '../lib/supabase';

export interface Senha {
  id: string;
  codigo: string;
  numero_sequencial: number;
  tipo: 'normal' | 'preferencial';
  status: 'pendente' | 'chamando' | 'atendido' | 'cancelado';
  guiche: string | null;
  user_id: string | null;
  created_at: string;
  called_at: string | null;
  completed_at: string | null;
  profiles?: {
    full_name: string;
  } | null;
}

export interface ConfiguracaoTV {
  id: string;
  youtube_url: string;
  updated_at: string;
}

export const senhaService = {
  async emitirSenha(tipo: 'normal' | 'preferencial'): Promise<Senha> {
    const { data, error } = await supabase.rpc('gerar_senha', { p_tipo: tipo });
    if (error) throw error;
    return data as Senha;
  },

  async chamarProxima(guiche: string, userId?: string): Promise<Senha | null> {
    const params: any = { p_guiche: guiche };
    if (userId) params.p_user_id = userId;
    
    const { data, error } = await supabase.rpc('chamar_proxima_senha', params);
    if (error) throw error;
    return data as Senha | null;
  },

  async concluirSenha(id: string): Promise<void> {
    const { error } = await supabase
      .from('senhas')
      .update({ status: 'atendido', completed_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async rechamarSenha(id: string): Promise<void> {
    const { error } = await supabase
      .from('senhas')
      .update({ 
        status: 'chamando',
        called_at: new Date().toISOString()
      })
      .eq('id', id);
    if (error) throw error;
  },


  async listarFila(): Promise<Senha[]> {
    const { data, error } = await supabase
      .from('senhas')
      .select('*')
      .eq('status', 'pendente')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data as Senha[];
  },

  async listarHistorico(page: number = 1, limit: number = 10): Promise<{ data: Senha[], count: number }> {
    const start = (page - 1) * limit;
    const end = start + limit - 1;

    const { data, error, count } = await supabase
      .from('senhas')
      .select('*', { count: 'exact' })
      .in('status', ['chamando', 'atendido'])
      .order('called_at', { ascending: false })
      .range(start, end);
      
    if (error) throw error;
    return { data: data as Senha[], count: count || 0 };
  },

  async listarUsuariosChamadas(): Promise<{ id: string; full_name: string }[]> {
    // Busca apenas usuários que possuem senhas atreladas a eles
    const { data, error } = await supabase
      .from('senhas')
      .select('user_id, profiles:user_id(id, full_name)')
      .not('user_id', 'is', null);

    if (error) throw error;

    const uniqueUsers = new Map<string, { id: string; full_name: string }>();
    data?.forEach((row: any) => {
      if (row.profiles && row.profiles.id) {
        uniqueUsers.set(row.profiles.id, {
          id: row.profiles.id,
          full_name: row.profiles.full_name || 'Usuário Desconhecido'
        });
      }
    });

    return Array.from(uniqueUsers.values()).sort((a, b) => a.full_name.localeCompare(b.full_name));
  },

  async listarChamadasRelatorio(dataFiltro: string, userId?: string): Promise<Senha[]> {
    let query = supabase
      .from('senhas')
      .select('*, profiles:user_id(full_name)')
      .gte('created_at', `${dataFiltro}T00:00:00.000Z`)
      .lte('created_at', `${dataFiltro}T23:59:59.999Z`)
      .in('status', ['chamando', 'atendido'])
      .order('called_at', { ascending: false });

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as Senha[];
  },

  async obterConfiguracaoTV(): Promise<ConfiguracaoTV | null> {
    const { data, error } = await supabase
      .from('configuracoes_tv')
      .select('*')
      .limit(1)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data as ConfiguracaoTV | null;
  },

  async atualizarConfiguracaoTV(youtube_url: string): Promise<void> {
    const { data: config } = await supabase.from('configuracoes_tv').select('id').limit(1).single();
    
    if (config) {
      await supabase.from('configuracoes_tv').update({ youtube_url, updated_at: new Date().toISOString() }).eq('id', config.id);
    } else {
      await supabase.from('configuracoes_tv').insert([{ youtube_url }]);
    }
  }
};
