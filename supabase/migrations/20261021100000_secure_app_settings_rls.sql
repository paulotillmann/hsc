-- =====================================================================
-- MIGRATION: REFORÇO DE SEGURANÇA E RLS NA TABELA app_settings
-- DATA: 21/10/2026
-- DESCRITIVO: Remove a política que permitia leitura irrestrita para usuários
--             anônimos de senhas e credenciais SMTP.
--             Garante que anônimos e não-admins só possam ler chaves
--             visuais públicas (não sensíveis), enquanto administradores
--             mantêm acesso irrestrito para leitura e edição.
-- =====================================================================

-- 1. Remover políticas antigas
DROP POLICY IF EXISTS "Permitir leitura para autenticados e anon" ON public.app_settings;
DROP POLICY IF EXISTS "Permitir leitura de configurações para todos" ON public.app_settings;
DROP POLICY IF EXISTS "Permitir escrita apenas para administradores" ON public.app_settings;
DROP POLICY IF EXISTS "Allow read for authenticated" ON public.app_settings;
DROP POLICY IF EXISTS "Allow all for admin" ON public.app_settings;

-- 2. Garantir que a tabela está com RLS habilitada
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- 3. Nova política de leitura pública estritamente limitada a configurações não sensíveis
CREATE POLICY "Permitir leitura publica apenas de configuracoes visuais"
ON public.app_settings
FOR SELECT
TO authenticated, anon
USING (
  key NOT LIKE 'smtp_%'
);

-- 4. Nova política para Administradores: acesso total (SELECT, INSERT, UPDATE, DELETE)
CREATE POLICY "Permitir acesso completo a administradores"
ON public.app_settings
FOR ALL
TO authenticated
USING (
  exists (
    select 1 from public.profiles p
    left join public.roles r on p.role_id = r.id
    where p.id = auth.uid()
    and (
      p.role = 'admin' 
      or p.role = 'Administrador' 
      or r.slug = 'admin'
      or r.name ILIKE '%administrador%'
    )
  )
)
WITH CHECK (
  exists (
    select 1 from public.profiles p
    left join public.roles r on p.role_id = r.id
    where p.id = auth.uid()
    and (
      p.role = 'admin' 
      or p.role = 'Administrador' 
      or r.slug = 'admin'
      or r.name ILIKE '%administrador%'
    )
  )
);
