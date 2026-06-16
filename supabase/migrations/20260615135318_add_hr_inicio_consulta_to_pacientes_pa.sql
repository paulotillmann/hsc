-- Migration para adicionar a coluna hr_inicio_consulta na tabela de pacientes do Pronto Atendimento
-- Criada em: 2026-06-15

ALTER TABLE public.pacientes_pronto_atendimento
ADD COLUMN IF NOT EXISTS hr_inicio_consulta TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN public.pacientes_pronto_atendimento.hr_inicio_consulta IS 'Data e hora do início da consulta médica, enviado pelo n8n';

-- Copia dados históricos do campo antigo para o novo se necessário (apenas para quem já passou da triagem)
UPDATE public.pacientes_pronto_atendimento 
SET hr_inicio_consulta = dt_inicio_atendimento 
WHERE hr_inicio_consulta IS NULL 
  AND dt_inicio_atendimento IS NOT NULL
  AND status NOT IN ('Aguardando triagem', 'Em triagem', 'Fim triagem');


