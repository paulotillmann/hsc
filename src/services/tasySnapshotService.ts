import { supabase } from '../lib/supabase';

export interface SlotSnapshot {
  diaMes: string;
  hora: string;
  quant: number;
  isPeak?: boolean;
}

export interface UsuarioSnapshot {
  login: string;
  nome: string;
  setor: string;
  inicio: string;
  fim: string;
  duracaoFormatada: string;
  duracaoMinutos?: number;
  status: string;
  [key: string]: any;
}

export interface TasyDailySnapshot {
  id?: string;
  data_referencia: string; // Formato YYYY-MM-DD (ex: 2026-09-10)
  total_conectados: number;
  pico_quantidade: number;
  pico_horario: string;
  percentual_ocupacao: number;
  media_tempo_formatada: string;
  media_tempo_minutos?: number;
  historico_slots: SlotSnapshot[];
  usuarios_lista?: UsuarioSnapshot[];
  image_url?: string | null;
  created_at?: string;
  updated_at?: string;
}

export const tasySnapshotService = {
  /**
   * Lista todos os snapshots diários salvos, ordenados pela data mais recente
   */
  async listarSnapshots(limit: number = 60): Promise<TasyDailySnapshot[]> {
    try {
      const { data, error } = await supabase
        .from('tasy_snapshots_diarios')
        .select('*')
        .order('data_referencia', { ascending: false })
        .limit(limit);

      if (error) {
        console.warn('[tasySnapshotService] Tabela tasy_snapshots_diarios pode não estar criada ou sem permissão:', error.message);
        return [];
      }

      return (data || []) as TasyDailySnapshot[];
    } catch (err: any) {
      console.error('[tasySnapshotService] Erro ao listar snapshots:', err);
      return [];
    }
  },

  /**
   * Obtém os dados de snapshot de um dia específico
   */
  async obterSnapshotPorData(dataReferencia: string): Promise<TasyDailySnapshot | null> {
    try {
      const { data, error } = await supabase
        .from('tasy_snapshots_diarios')
        .select('*')
        .eq('data_referencia', dataReferencia)
        .maybeSingle();

      if (error) {
        console.error('[tasySnapshotService] Erro ao buscar snapshot por data:', error);
        return null;
      }

      return data as TasyDailySnapshot | null;
    } catch (err: any) {
      console.error('[tasySnapshotService] Erro inesperado ao obter snapshot:', err);
      return null;
    }
  },

  /**
   * Salva ou atualiza o snapshot do dia no Supabase (usado por automações ou gravação manual)
   */
  async salvarSnapshot(snapshot: TasyDailySnapshot): Promise<TasyDailySnapshot | null> {
    try {
      const payload = {
        ...snapshot,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('tasy_snapshots_diarios')
        .upsert(payload, { onConflict: 'data_referencia' })
        .select()
        .single();

      if (error) {
        console.error('[tasySnapshotService] Erro ao salvar snapshot diário:', error);
        throw error;
      }

      return data as TasyDailySnapshot;
    } catch (err: any) {
      console.error('[tasySnapshotService] Falha ao persistir snapshot no Supabase:', err);
      throw err;
    }
  },

  /**
   * Faz upload da imagem/print do snapshot para o Supabase Storage (bucket 'tasy-snapshots')
   */
  async uploadPrintSnapshot(dataReferencia: string, imageBlob: Blob): Promise<string | null> {
    try {
      const fileName = `snapshot_${dataReferencia}_2350.png`;
      const filePath = `prints/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('tasy-snapshots')
        .upload(filePath, imageBlob, {
          contentType: 'image/png',
          upsert: true
        });

      if (uploadError) {
        console.warn('[tasySnapshotService] Storage tasy-snapshots não disponível ou sem permissão:', uploadError.message);
        return null;
      }

      const { data: publicUrlData } = supabase.storage
        .from('tasy-snapshots')
        .getPublicUrl(filePath);

      const publicUrl = publicUrlData?.publicUrl || null;

      if (publicUrl) {
        await supabase
          .from('tasy_snapshots_diarios')
          .update({ image_url: publicUrl, updated_at: new Date().toISOString() })
          .eq('data_referencia', dataReferencia);
      }

      return publicUrl;
    } catch (err) {
      console.error('[tasySnapshotService] Erro ao fazer upload de print:', err);
      return null;
    }
  }
};
