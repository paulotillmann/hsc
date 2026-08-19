-- Migration: Adicionar coluna exempt_session_timeout na tabela profiles
-- Permite que administradores definam exceção para contas de painéis em TV, Totens e dashboards 24/7
-- Usuários marcados como exempt_session_timeout = TRUE não serão deslogados por inatividade nem ao fechar o navegador.

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS exempt_session_timeout BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.profiles.exempt_session_timeout IS 'Indica se o usuário é isento de timeout por inatividade e persistência ao fechar navegador (ex: TV/Painéis).';
