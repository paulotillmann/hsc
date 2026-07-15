-- Migração para adicionar dt_historico na tabela historico_ordem_servico e atualizar verificação de duplicidade
-- Criada em: 2026-07-08

-- 1. Adicionar coluna dt_historico
ALTER TABLE public.historico_ordem_servico 
ADD COLUMN IF NOT EXISTS dt_historico TIMESTAMP WITH TIME ZONE;

-- 2. Recriar índice para otimização incluindo a nova data
CREATE INDEX IF NOT EXISTS idx_historico_os_dt_historico ON public.historico_ordem_servico(dt_historico DESC NULLS LAST);

-- 3. Atualizar função de trigger para verificação robusta de duplicidades
CREATE OR REPLACE FUNCTION public.check_duplicate_historico_ordem_servico()
RETURNS TRIGGER AS $$
DECLARE
  ultimo_relato TEXT;
  ultima_data TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Buscar o relato e data mais recentes para esta OS (priorizando a data do histórico)
  SELECT ds_relat_tecnico, dt_historico INTO ultimo_relato, ultima_data
  FROM public.historico_ordem_servico
  WHERE nr_sequencia = NEW.nr_sequencia
  ORDER BY dt_historico DESC NULLS LAST, created_at DESC
  LIMIT 1;

  -- Se o novo registro tiver dt_historico e este for idêntico ao último inserido, cancela a inserção
  IF NEW.dt_historico IS NOT NULL AND ultima_data IS NOT NULL AND NEW.dt_historico = ultima_data THEN
    RETURN NULL; -- Cancela o INSERT silenciosamente
  END IF;

  -- Fallback de segurança para dados legados: cancela se o texto do relato for idêntico
  IF (NEW.dt_historico IS NULL OR ultima_data IS NULL) AND ultimo_relato IS NOT NULL AND TRIM(ultimo_relato) = TRIM(NEW.ds_relat_tecnico) THEN
    RETURN NULL; -- Cancela o INSERT silenciosamente
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
