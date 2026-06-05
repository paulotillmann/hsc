-- Migração para remover relatos duplicados consecutivos e criar trigger para evitar novas duplicidades
-- Criada em: 2026-06-05

-- 1. Remover relatos duplicados consecutivos existentes (deixando apenas o mais antigo de cada sequência idêntica)
DELETE FROM public.historico_ordem_servico h
WHERE h.id IN (
  SELECT id
  FROM (
    SELECT id,
           nr_sequencia,
           ds_relat_tecnico,
           created_at,
           LAG(ds_relat_tecnico) OVER (PARTITION BY nr_sequencia ORDER BY created_at ASC) as prev_relat
    FROM public.historico_ordem_servico
  ) sub
  WHERE sub.ds_relat_tecnico = sub.prev_relat
);

-- 2. Criar função para verificar relatos duplicados consecutivos antes de inserir
CREATE OR REPLACE FUNCTION public.check_duplicate_historico_ordem_servico()
RETURNS TRIGGER AS $$
DECLARE
  ultimo_relato TEXT;
BEGIN
  -- Buscar o relato mais recente para esta OS
  SELECT ds_relat_tecnico INTO ultimo_relato
  FROM public.historico_ordem_servico
  WHERE nr_sequencia = NEW.nr_sequencia
  ORDER BY created_at DESC
  LIMIT 1;

  -- Se o novo relato for idêntico ao último inserido (após remover espaços em branco), ignora a inserção retornando NULL
  IF ultimo_relato IS NOT NULL AND TRIM(ultimo_relato) = TRIM(NEW.ds_relat_tecnico) THEN
    RETURN NULL; -- Cancela o INSERT silenciosamente
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Criar o trigger BEFORE INSERT na tabela historico_ordem_servico
DROP TRIGGER IF EXISTS trigger_check_duplicate_historico ON public.historico_ordem_servico;
CREATE TRIGGER trigger_check_duplicate_historico
  BEFORE INSERT ON public.historico_ordem_servico
  FOR EACH ROW
  EXECUTE FUNCTION public.check_duplicate_historico_ordem_servico();
