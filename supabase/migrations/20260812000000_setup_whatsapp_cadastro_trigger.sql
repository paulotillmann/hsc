-- Migração para configurar o trigger de Webhook do WhatsApp para Aprovação de Cadastros
-- Criada em: 12/08/2026

-- 1. Criar a tabela whatsapp_cadastro_notification_logs (Idempotência)
CREATE TABLE IF NOT EXISTS public.whatsapp_cadastro_notification_logs (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  solicitacao_id INT NOT NULL,
  status TEXT NOT NULL, -- 'enviando', 'sucesso', 'erro'
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  CONSTRAINT whatsapp_cadastro_notification_logs_pkey PRIMARY KEY (id),
  CONSTRAINT whatsapp_cadastro_notification_logs_solicitacao_id_key UNIQUE (solicitacao_id),
  CONSTRAINT fk_solicitacao_cadastro FOREIGN KEY (solicitacao_id) REFERENCES public.solicitacoes_cadastro(id) ON DELETE CASCADE
);

-- 2. Comentários para documentação
COMMENT ON TABLE public.whatsapp_cadastro_notification_logs IS 'Tabela que armazena os envios de mensagens automáticas de WhatsApp para cadastros aprovados (idempotência)';

-- 3. Habilitar Row Level Security (RLS)
ALTER TABLE public.whatsapp_cadastro_notification_logs ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'whatsapp_cadastro_notification_logs' AND policyname = 'Permitir leitura de logs para autenticados'
    ) THEN
        CREATE POLICY "Permitir leitura de logs para autenticados"
        ON public.whatsapp_cadastro_notification_logs
        FOR SELECT
        TO authenticated
        USING (true);
    END IF;
END $$;

-- 4. Trigger Function para Cadastro Aprovado (UPDATE)
CREATE OR REPLACE FUNCTION public.trg_fn_whatsapp_cadastro_aprovado()
RETURNS TRIGGER AS $$
DECLARE
  payload jsonb;
  request_id bigint;
BEGIN
  -- Dispara apenas quando o status é alterado de qualquer outro para 'Aprovado'
  IF (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'Aprovado') THEN
    payload := jsonb_build_object(
      'type', 'UPDATE',
      'table', 'solicitacoes_cadastro',
      'record', to_jsonb(NEW),
      'old_record', to_jsonb(OLD)
    );

    SELECT net.http_post(
      url := 'https://drbzogwimvaziaydwqfk.supabase.co/functions/v1/whatsapp-cadastro-aprovado',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyYnpvZ3dpbXZhemlheWR3cWZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NTg5MzIsImV4cCI6MjA5MTQzNDkzMn0.lpt8rnIy0NjdX11T3P12_YzGzyotwJ2WvRK_GiDivlI"}'::jsonb,
      body := payload
    ) INTO request_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remover trigger antigo se existir para evitar duplicações
DROP TRIGGER IF EXISTS trg_whatsapp_cadastro_aprovado ON public.solicitacoes_cadastro;

-- Criar o trigger de UPDATE
CREATE TRIGGER trg_whatsapp_cadastro_aprovado
  AFTER UPDATE ON public.solicitacoes_cadastro
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_whatsapp_cadastro_aprovado();
