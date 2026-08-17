import { supabase } from '../lib/supabase';

export interface MedicoContato {
  id?: string;
  nome_medico: string;
  emails: string[];
  created_at?: string;
  updated_at?: string;
}

export const plantaoMedicoContatosService = {
  async listar(): Promise<MedicoContato[]> {
    const { data, error } = await supabase
      .from('plantao_medico_contatos')
      .select('*')
      .order('nome_medico', { ascending: true });

    if (error) {
      console.error('Erro ao buscar contatos dos médicos:', error);
      throw error;
    }

    return data || [];
  },

  async salvar(nome_medico: string, emails: string[]): Promise<MedicoContato> {
    const cleanNome = nome_medico.trim();
    // Limpar e validar e-mails duplicados e vazios
    const cleanEmails = Array.from(
      new Set(
        emails
          .map((e) => e.trim().toLowerCase())
          .filter((e) => e.length > 0 && e.includes('@'))
      )
    );

    const { data, error } = await supabase
      .from('plantao_medico_contatos')
      .upsert(
        {
          nome_medico: cleanNome,
          emails: cleanEmails,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'nome_medico' }
      )
      .select()
      .single();

    if (error) {
      console.error('Erro ao salvar contato do médico:', error);
      throw error;
    }

    return data;
  },

  async excluir(id: string): Promise<void> {
    const { error } = await supabase
      .from('plantao_medico_contatos')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao excluir contato do médico:', error);
      throw error;
    }
  }
};
