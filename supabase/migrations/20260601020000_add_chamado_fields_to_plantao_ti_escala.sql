-- Migração para adicionar campos de ocorrência/chamado à tabela plantao_ti_escala
-- Criada em: 2026-06-01

ALTER TABLE public.plantao_ti_escala
ADD COLUMN IF NOT EXISTS nome_solicitante VARCHAR(255),
ADD COLUMN IF NOT EXISTS setor_solicitante VARCHAR(255),
ADD COLUMN IF NOT EXISTS descricao_plantao TEXT;

-- Adicionar comentários explicativos
COMMENT ON COLUMN public.plantao_ti_escala.nome_solicitante IS 'Nome do profissional que solicitou o atendimento durante o plantão';
COMMENT ON COLUMN public.plantao_ti_escala.setor_solicitante IS 'Setor onde ocorreu o chamado ou solicitação de atendimento';
COMMENT ON COLUMN public.plantao_ti_escala.descricao_plantao IS 'Breve descrição sobre a ocorrência ou chamado atendido durante o plantão';
