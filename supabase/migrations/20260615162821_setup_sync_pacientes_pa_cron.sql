-- Habilita a extensão pg_cron e pg_net para requisições HTTP (se não estiverem habilitadas)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove o cron job anterior se existir para evitar duplicações de forma segura
DO $$
BEGIN
  PERFORM cron.unschedule('sync-pacientes-pa-every-3-min');
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END;
$$;

-- Cria o novo cron job para rodar a cada 3 minutos no banco de dados do Supabase
-- NOTA: Como a Edge Function sync-pacientes-pa não valida o token, podemos usar qualquer header de Authorization de placeholder.
SELECT cron.schedule(
  'sync-pacientes-pa-every-3-min',
  '*/3 * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://drbzogwimvaziaydwqfk.supabase.co/functions/v1/sync-pacientes-pa',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer SUA_SERVICE_ROLE_KEY"}'::jsonb,
      body := '{}'::jsonb
    );
  $$
);
