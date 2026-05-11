import { supabase } from '../lib/supabase';

export interface Senha {
  id: string;
  codigo: string;
  numero_sequencial: number;
  tipo: 'normal' | 'preferencial';
  status: 'pendente' | 'chamando' | 'atendido' | 'cancelado';
  guiche: string | null;
  created_at: string;
  called_at: string | null;
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

  async chamarProxima(guiche: string): Promise<Senha | null> {
    const { data, error } = await supabase.rpc('chamar_proxima_senha', { p_guiche: guiche });
    if (error) throw error;
    return data as Senha | null;
  },

  async concluirSenha(id: string): Promise<void> {
    const { error } = await supabase
      .from('senhas')
      .update({ status: 'atendido' })
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
