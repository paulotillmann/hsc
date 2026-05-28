-- Migração para adicionar colunas clínicas e de equipe à tabela de cirurgias
-- Criada em: 2026-05-28

ALTER TABLE public.cirurgias
ADD COLUMN IF NOT EXISTS circulante TEXT,
ADD COLUMN IF NOT EXISTS enfermeiro TEXT,
ADD COLUMN IF NOT EXISTS setor_origem TEXT,
ADD COLUMN IF NOT EXISTS precaucao TEXT,
ADD COLUMN IF NOT EXISTS alergia TEXT;

COMMENT ON COLUMN public.cirurgias.circulante IS 'Nome do circulante de sala';
COMMENT ON COLUMN public.cirurgias.enfermeiro IS 'Nome do enfermeiro responsável';
COMMENT ON COLUMN public.cirurgias.setor_origem IS 'Setor de origem do paciente';
COMMENT ON COLUMN public.cirurgias.precaucao IS 'Precauções recomendadas para o paciente';
COMMENT ON COLUMN public.cirurgias.alergia IS 'Alergias relatadas do paciente';
