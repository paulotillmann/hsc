-- Habilita as extensões pg_cron e pg_net se não estiverem habilitadas
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove o cron job anterior se existir para evitar duplicações de forma segura
DO $$
BEGIN
  PERFORM cron.unschedule('sync-status-ordem-servico-every-10-min');
EXCEPTION
  WHEN OTHERS THEN
    NULL; -- Ignora o erro se o job não existir
END $$;

-- Cria o novo cron job para rodar a cada 10 minutos
-- NOTA: O placeholder 'SUA_SERVICE_ROLE_KEY' deve ser substituído no ambiente do Supabase pela Service Role Key correspondente.
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
