-- Migração para configurar triggers de Webhook do WhatsApp em nível de banco de dados
-- Criada em: 2026-07-13

-- 1. Garantir que a extensão pg_net está ativa no schema extensions ou public
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Trigger Function para Nova Solicitação (INSERT)
CREATE OR REPLACE FUNCTION public.trg_fn_whatsapp_nova_solicitacao()
RETURNS TRIGGER AS $$
DECLARE
  payload jsonb;
  request_id bigint;
BEGIN
  payload := jsonb_build_object(
    'type', 'INSERT',
    'table', 'solicitacoes_prontuario',
    'record', to_jsonb(NEW)
  );

  SELECT net.http_post(
    url := 'https://drbzogwimvaziaydwqfk.supabase.co/functions/v1/whatsapp-solicitacao-prontuario',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyYnpvZ3dpbXZhemlheWR3cWZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NTg5MzIsImV4cCI6MjA5MTQzNDkzMn0.lpt8rnIy0NjdX11T3P12_YzGzyotwJ2WvRK_GiDivlI"}'::jsonb,
    body := payload
  ) INTO request_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remover trigger antigo se existir para evitar duplicações
DROP TRIGGER IF EXISTS trg_whatsapp_nova_solicitacao ON public.solicitacoes_prontuario;

-- Criar o trigger de INSERT
CREATE TRIGGER trg_whatsapp_nova_solicitacao
  AFTER INSERT ON public.solicitacoes_prontuario
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_whatsapp_nova_solicitacao();


-- 3. Trigger Function para Documento Anexado (UPDATE)
CREATE OR REPLACE FUNCTION public.trg_fn_whatsapp_documento_anexado()
RETURNS TRIGGER AS $$
DECLARE
  payload jsonb;
  request_id bigint;
BEGIN
  -- Dispara apenas quando o arquivo_url é alterado de nulo para preenchido
  IF (OLD.arquivo_url IS NULL OR OLD.arquivo_url = '') AND (NEW.arquivo_url IS NOT NULL AND NEW.arquivo_url <> '') THEN
    payload := jsonb_build_object(
      'type', 'UPDATE',
      'table', 'solicitacoes_prontuario',
      'record', to_jsonb(NEW),
      'old_record', to_jsonb(OLD)
    );

    SELECT net.http_post(
      url := 'https://drbzogwimvaziaydwqfk.supabase.co/functions/v1/whatsapp-documento-anexado',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyYnpvZ3dpbXZhemlheWR3cWZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NTg5MzIsImV4cCI6MjA5MTQzNDkzMn0.lpt8rnIy0NjdX11T3P12_YzGzyotwJ2WvRK_GiDivlI"}'::jsonb,
      body := payload
    ) INTO request_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remover trigger antigo se existir para evitar duplicações
DROP TRIGGER IF EXISTS trg_whatsapp_documento_anexado ON public.solicitacoes_prontuario;

-- Criar o trigger de UPDATE
CREATE TRIGGER trg_whatsapp_documento_anexado
  AFTER UPDATE ON public.solicitacoes_prontuario
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_whatsapp_documento_anexado();

-- 4. Adicionar políticas de RLS para leitura dos logs por usuários autenticados (necessário para testes e auditoria dos gestores)
CREATE POLICY "Permitir leitura de logs para autenticados"
ON public.whatsapp_notification_logs
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Permitir leitura de logs para autenticados"
ON public.whatsapp_document_notification_logs
FOR SELECT
TO authenticated
USING (true);
