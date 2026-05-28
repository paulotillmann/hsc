-- Migração para adicionar colunas evento e dt_registro à tabela cirurgias
-- Criada em: 2026-05-26

ALTER TABLE public.cirurgias
ADD COLUMN IF NOT EXISTS evento TEXT,
ADD COLUMN IF NOT EXISTS dt_registro TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN public.cirurgias.evento IS 'Eventos da cirurgia';
COMMENT ON COLUMN public.cirurgias.dt_registro IS 'Data do registro do evento';
