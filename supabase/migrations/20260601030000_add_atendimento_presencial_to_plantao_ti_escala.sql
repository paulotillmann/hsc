-- Migração para adicionar o campo atendimento_presencial à tabela plantao_ti_escala
-- Criada em: 2026-06-01

ALTER TABLE public.plantao_ti_escala
ADD COLUMN IF NOT EXISTS atendimento_presencial BOOLEAN DEFAULT FALSE NOT NULL;

-- Adicionar comentário explicativo
COMMENT ON COLUMN public.plantao_ti_escala.atendimento_presencial IS 'Indica se o atendimento realizado no plantão foi presencial';
