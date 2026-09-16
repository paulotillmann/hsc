-- supabase/migrations/20260910100000_add_last_seen_at_to_profiles.sql
-- Adiciona coluna last_seen_at para controle de presença leve via heartbeat no PostgreSQL

-- 1. Adicionar coluna na tabela profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT now();

-- 2. Criar índice para buscas eficientes de usuários online
CREATE INDEX IF NOT EXISTS idx_profiles_last_seen_at ON public.profiles(last_seen_at);

-- 3. Função RPC com SECURITY DEFINER para atualização rápida e segura de heartbeat
CREATE OR REPLACE FUNCTION public.heartbeat_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    UPDATE public.profiles
    SET last_seen_at = now()
    WHERE id = auth.uid();
  END IF;
END;
$$;

-- Permitir execução da função para usuários autenticados
GRANT EXECUTE ON FUNCTION public.heartbeat_user() TO authenticated;
