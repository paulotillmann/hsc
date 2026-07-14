-- Migration para atualizar e otimizar o agendamento da sincronização de status de OS no pg_cron
-- Criada em: 2026-07-14

-- 1. Garantir que as extensões pg_cron e pg_net estejam ativas
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Desagendar de forma segura o cron job existente (para evitar duplicações)
DO $$
BEGIN
  PERFORM cron.unschedule('sync-status-ordem-servico-every-10-min');
EXCEPTION
  WHEN OTHERS THEN
    NULL; -- Ignora se o job não existir
END $$;

-- 3. Agendar o job otimizado a cada 10 minutos
-- NOTA: O placeholder 'SUA_SERVICE_ROLE_KEY' deve ser substituído no ambiente de produção pela chave Service Role real do projeto.
SELECT cron.schedule(
  'sync-status-ordem-servico-every-10-min',
  '*/10 * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://drbzogwimvaziaydwqfk.supabase.co/functions/v1/sync-status-ordem-servico',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer SUA_SERVICE_ROLE_KEY"}'::jsonb,
      body := '{}'::jsonb
    );
  $$
);

COMMENT ON COLUMN cron.job.jobname IS 'Tarefa automatizada de sincronização de status de ordens de serviço (Tasy -> Supabase)';
