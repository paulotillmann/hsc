-- =====================================================================
-- MIGRATION: HABILITA REALTIME E CONFIGURA RLS PARA A TABELA app_settings
-- DATA: 31/07/2026
-- DESCRITIVO: Permite que as atualizações de configurações de TV
--             sejam transmitidas em tempo real para a TV do PA e
--             organiza as políticas de segurança RLS da tabela.
-- =====================================================================

-- 1. Habilitar o Realtime para a tabela app_settings
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.app_settings;
    exception
      when duplicate_object then null; -- já está na publicação
      when others then null;
    end;
  end if;
end $$;

-- 2. Garantir RLS habilitada na tabela app_settings
alter table public.app_settings enable row level security;

-- 3. Limpar políticas antigas se existirem
drop policy if exists "Permitir leitura de configurações para todos" on public.app_settings;
drop policy if exists "Permitir leitura para autenticados e anon" on public.app_settings;
drop policy if exists "Permitir escrita apenas para administradores" on public.app_settings;
drop policy if exists "Allow read for authenticated" on public.app_settings;
drop policy if exists "Allow all for admin" on public.app_settings;

-- 4. Criar política de leitura pública/autenticada
create policy "Permitir leitura para autenticados e anon" on public.app_settings
  for select
  to authenticated, anon
  using (true);

-- 5. Criar política de escrita restrita para administradores (admin)
create policy "Permitir escrita apenas para administradores" on public.app_settings
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      join public.roles r on p.role_id = r.id
      where p.id = auth.uid() and r.slug = 'admin'
    )
  );
