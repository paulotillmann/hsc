// src/services/emailService.ts
// Serviço responsável por disparar e-mails de documentos (holerites / informes)
// através da Edge Function `send-document-email`

import { supabase } from '../lib/supabase';

interface SendDocumentEmailParams {
  to: string;
  nomeColaborador: string;
  tipoDocumento: 'holerite' | 'informe';
  periodoReferencia: string;
  cpf: string;
  pdfUrl: string;
}

interface SendEmailResult {
  success: boolean;
  error?: string;
}

/**
 * Envia o e-mail com o documento para o colaborador via Supabase Edge Function.
 * Utiliza supabase.functions.invoke() para autenticação automática.
 */
export async function sendDocumentEmail(params: SendDocumentEmailParams): Promise<SendEmailResult> {
  try {
    const { data, error } = await supabase.functions.invoke('send-document-email', {
      body: params,
    });

    if (error) {
      console.error('[Email] Erro ao enviar:', error);
      return { success: false, error: error.message || 'Falha ao enviar e-mail.' };
    }

    if (data?.error) {
      console.error('[Email] Erro retornado pela função:', data.error);
      return { success: false, error: data.error };
    }

    console.log(`[Email] ✓ E-mail enviado para ${params.to}`);
    return { success: true };
  } catch (err: any) {
    console.error('[Email] Exception:', err);
    return { success: false, error: err.message || 'Erro inesperado ao enviar e-mail.' };
  }
}
