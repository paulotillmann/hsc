-- Habilita as extensões pg_cron e pg_net se não estiverem habilitadas
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove o cron job anterior se existir para evitar duplicações
SELECT cron.unschedule('sync-ordem-servico-every-3-min');

-- Cria o novo cron job para rodar a cada 3 minutos
-- NOTA: O placeholder 'SUA_SERVICE_ROLE_KEY' deve ser substituído no ambiente do Supabase pela Service Role Key correspondente.
SELECT cron.schedule(
  'sync-ordem-servico-every-3-min',
  '*/3 * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://drbzogwimvaziaydwqfk.supabase.co/functions/v1/sync-ordem-servico',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer SUA_SERVICE_ROLE_KEY"}'::jsonb,
      body := '{}'::jsonb
    );
  $$
);

-- Habilitar Supabase Realtime para as tabelas relacionadas a Ordem de Serviço de forma segura
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.ordem_servico;
    exception when duplicate_object then null;
    end;
    
    begin
      alter publication supabase_realtime add table public.historico_ordem_servico;
    exception when duplicate_object then null;
    end;
    
    begin
      alter publication supabase_realtime add table public.ordem_servico_estagio_log;
    exception when duplicate_object then null;
    end;
  end if;
end $$;
