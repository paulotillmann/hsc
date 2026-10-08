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
      let errorMessage = error.message;
      if ('context' in error && error.context) {
        try {
          const ctx: any = error.context;
          if (typeof ctx.json === 'function') {
            const errBody = await ctx.json();
            if (errBody?.error) errorMessage = errBody.error;
          } else if (typeof ctx.text === 'function') {
            const errText = await ctx.text();
            try {
              const parsed = JSON.parse(errText);
              if (parsed?.error) errorMessage = parsed.error;
              else if (errText) errorMessage = errText;
            } catch {
              if (errText) errorMessage = errText;
            }
          }
        } catch (_) {}
      }
      console.error('[Email] Erro detalhado ao enviar:', errorMessage, error);
      return { success: false, error: errorMessage || 'Falha ao enviar e-mail.' };
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
