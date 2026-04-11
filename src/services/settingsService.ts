// src/services/settingsService.ts
// Serviço para gerenciar configurações SMTP armazenadas em app_settings

import { supabase } from '../lib/supabase';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export interface SmtpSettings {
  smtp_host: string;
  smtp_port: string;
  smtp_user: string;
  smtp_pass: string;
  smtp_from_name: string;
  smtp_from_email: string;
  smtp_secure: 'tls' | 'ssl' | 'none';
}

const SMTP_KEYS: (keyof SmtpSettings)[] = [
  'smtp_host',
  'smtp_port',
  'smtp_user',
  'smtp_pass',
  'smtp_from_name',
  'smtp_from_email',
  'smtp_secure',
];

const DEFAULTS: SmtpSettings = {
  smtp_host: '',
  smtp_port: '587',
  smtp_user: '',
  smtp_pass: '',
  smtp_from_name: 'Hospital Santa Casa',
  smtp_from_email: '',
  smtp_secure: 'tls',
};

// ─────────────────────────────────────────────────────────────
// FETCH
// ─────────────────────────────────────────────────────────────

export async function fetchSmtpSettings(): Promise<SmtpSettings> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('key, value')
    .in('key', SMTP_KEYS);

  if (error) {
    console.error('[Settings] Erro ao carregar configurações:', error.message);
    return { ...DEFAULTS };
  }

  const settings = { ...DEFAULTS };
  for (const row of data ?? []) {
    if (SMTP_KEYS.includes(row.key as keyof SmtpSettings)) {
      (settings as any)[row.key] = row.value;
    }
  }

  return settings;
}

// ─────────────────────────────────────────────────────────────
// SAVE
// ─────────────────────────────────────────────────────────────

export async function saveSmtpSettings(
  settings: SmtpSettings,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const rows = SMTP_KEYS.map(key => ({
      key,
      value: settings[key],
      updated_at: new Date().toISOString(),
      updated_by: userId,
    }));

    const { error } = await supabase
      .from('app_settings')
      .upsert(rows, { onConflict: 'key' });

    if (error) {
      console.error('[Settings] Erro ao salvar:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ─────────────────────────────────────────────────────────────
// TESTE DE E-MAIL
// ─────────────────────────────────────────────────────────────

export async function sendTestEmail(
  toEmail: string,
  toName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('send-document-email', {
      body: {
        to: toEmail,
        nomeColaborador: toName,
        tipoDocumento: 'informe',
        periodoReferencia: 'Teste de Configuração SMTP',
        cpf: '000.000.000-00',
        pdfUrl: '#',
        isTest: true,
      },
    });

    if (error) {
      return { success: false, error: error.message || 'Falha no envio de teste.' };
    }

    if (data?.error) {
      return { success: false, error: data.error };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

