import { supabase } from '../lib/supabase';

export interface PATvSettings {
  video_url: string;
  ticker_text: string;
}

export const DEFAULT_PA_TV_SETTINGS: PATvSettings = {
  video_url: 'https://www.youtube.com/watch?v=uaGeDkNoSHk',
  ticker_text: 'Bem-vindo ao Pronto Atendimento do Hospital Santa Casa. Por gentileza, mantenha seus documentos em mãos. Para dúvidas ou esclarecimentos, procure nossa recepção.',
};

export async function fetchPATvSettings(): Promise<PATvSettings> {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['pa_tv_video_url', 'pa_tv_ticker_text']);

    if (error) {
      console.error('[PATvService] Erro ao carregar configurações:', error.message);
      return { ...DEFAULT_PA_TV_SETTINGS };
    }

    const settings = { ...DEFAULT_PA_TV_SETTINGS };
    if (data && data.length > 0) {
      data.forEach((row) => {
        if (row.key === 'pa_tv_video_url' && row.value) {
          settings.video_url = row.value;
        }
        if (row.key === 'pa_tv_ticker_text' && row.value) {
          settings.ticker_text = row.value;
        }
      });
    }

    return settings;
  } catch (err) {
    console.error('[PATvService] Exceção ao buscar configurações:', err);
    return { ...DEFAULT_PA_TV_SETTINGS };
  }
}

export async function savePATvSettings(
  videoUrl: string,
  tickerText: string,
  userId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const rows = [
      {
        key: 'pa_tv_video_url',
        value: videoUrl,
        updated_at: new Date().toISOString(),
        updated_by: userId || null,
      },
      {
        key: 'pa_tv_ticker_text',
        value: tickerText,
        updated_at: new Date().toISOString(),
        updated_by: userId || null,
      },
    ];

    const { error } = await supabase
      .from('app_settings')
      .upsert(rows, { onConflict: 'key' });

    if (error) {
      console.error('[PATvService] Erro ao salvar configurações:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error('[PATvService] Exceção ao salvar:', err);
    return { success: false, error: err.message || 'Erro ao salvar configurações.' };
  }
}
