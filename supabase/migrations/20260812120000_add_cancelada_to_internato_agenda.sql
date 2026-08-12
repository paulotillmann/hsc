-- Migração para adicionar coluna cancelada na tabela internato_agenda
-- Criada em: 2026-08-12

ALTER TABLE public.internato_agenda ADD COLUMN IF NOT EXISTS cancelada BOOLEAN DEFAULT false;
