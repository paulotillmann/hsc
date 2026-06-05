-- Migração para adicionar índice de performance na coluna dt_ordem_servico
-- Criada em: 2026-06-05

CREATE INDEX IF NOT EXISTS idx_ordem_servico_dt_ordem_servico ON public.ordem_servico(dt_ordem_servico DESC);
