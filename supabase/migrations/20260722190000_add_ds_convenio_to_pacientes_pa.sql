-- Migration para adicionar a coluna ds_convenio na tabela de pacientes do Pronto Atendimento
-- Criada em: 2026-07-22

ALTER TABLE public.pacientes_pronto_atendimento
ADD COLUMN IF NOT EXISTS ds_convenio TEXT;

COMMENT ON COLUMN public.pacientes_pronto_atendimento.ds_convenio IS 'Descrição do convênio do paciente, enviado pelo n8n';
