-- Habilita a extensão pg_cron para agendamentos e pg_net para requisições HTTP (se não estiverem habilitadas)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove o cron job anterior se existir para evitar duplicações
SELECT cron.unschedule('sync-cirurgias-every-3-min');

-- Cria o novo cron job para rodar a cada 3 minutos
-- IMPORTANTE: Substitua 'SUA_SERVICE_ROLE_KEY' pela chave correspondente nas configurações de API do Supabase Dashboard
SELECT cron.schedule(
  'sync-cirurgias-every-3-min',
  '*/3 * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://drbzogwimvaziaydwqfk.supabase.co/functions/v1/sync-cirurgias',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer SUA_SERVICE_ROLE_KEY"}'::jsonb,
      body := '{}'::jsonb
    );
  $$
);

COMMENT ON COLUMN cron.job.jobname IS 'Cron job para sincronização de cirurgias do HSC';
