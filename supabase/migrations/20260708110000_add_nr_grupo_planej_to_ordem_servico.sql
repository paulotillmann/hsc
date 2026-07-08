-- Migração para adicionar nr_grupo_planej na tabela ordem_servico
-- Criada em: 2026-07-08

ALTER TABLE public.ordem_servico 
ADD COLUMN IF NOT EXISTS nr_grupo_planej INTEGER;

COMMENT ON COLUMN public.ordem_servico.nr_grupo_planej IS 'Grupo de planejamento da ordem de serviço no Tasy (22 para TI)';
