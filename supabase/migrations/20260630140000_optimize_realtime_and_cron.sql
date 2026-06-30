-- =====================================================================
-- MIGRATION: OTIMIZAÇÃO DE REALTIME E CRONS CENTRALIZADOS
-- DATA: 30/06/2026
-- DESCRITIVO: Remove tabelas desnecessárias da publicação Realtime e
--              agenda a sincronização centralizada de cirurgias via pg_cron.
-- =====================================================================

-- 1. Remover tabelas não utilizadas ou de alto volume do Realtime
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime drop table if exists public.internato_presencas;
    exception when others then null;
    end;
    
    begin
      alter publication supabase_realtime drop table if exists public.internato_notas;
    exception when others then null;
    end;
    
    begin
      alter publication supabase_realtime drop table if exists public.ordem_servico_estagio_log;
    exception when others then null;
    end;
    
    begin
      alter publication supabase_realtime drop table if exists public.historico_ordem_servico;
    exception when others then null;
    end;
  end if;
end $$;

-- 2. Garantir que as extensões pg_cron e pg_net estejam habilitadas
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 3. Agendar ou atualizar a sincronização do Centro Cirúrgico no pg_cron (a cada 3 minutos)
do $$
begin
  perform cron.unschedule('sync-cirurgias-every-3-min');
exception when others then null;
end $$;

select cron.schedule(
  'sync-cirurgias-every-3-min',
  '*/3 * * * *',
  $$
  select
    net.http_post(
      url := 'https://drbzogwimvaziaydwqfk.supabase.co/functions/v1/sync-cirurgias',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer SUA_SERVICE_ROLE_KEY"}'::jsonb,
      body := '{}'::jsonb
    );
  $$
);

