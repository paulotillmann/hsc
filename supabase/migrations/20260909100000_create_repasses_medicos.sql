-- Migração para o Módulo de Repasses Médicos e Honorários de Convênios
-- Criada em: 2026-09-09
-- Autor: HSC Sistemas

-- 1. Tabela de Competências/Fechamentos de Repasse por Convênio
CREATE TABLE IF NOT EXISTS public.repasse_competencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  convenio text NOT NULL DEFAULT 'UNIMED',
  competencia text NOT NULL, -- Exemplo: '07-2026'
  numero_nota_fiscal text,
  valor_nota_fiscal numeric(14, 2) DEFAULT 0 NOT NULL,
  status text NOT NULL DEFAULT 'em_andamento' CHECK (status IN ('em_andamento', 'finalizado', 'cancelado')),
  observacoes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT unq_repasse_convenio_competencia UNIQUE (convenio, competencia)
);

CREATE INDEX IF NOT EXISTS idx_repasse_competencias_convenio_comp 
  ON public.repasse_competencias (convenio, competencia);

CREATE INDEX IF NOT EXISTS idx_repasse_competencias_status 
  ON public.repasse_competencias (status);

-- 2. Tabela de Itens do Resumo de Repasse (Médicos ou Setores)
CREATE TABLE IF NOT EXISTS public.repasse_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competencia_id uuid NOT NULL REFERENCES public.repasse_competencias(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('profissional', 'setor')),
  descricao text NOT NULL, -- Nome do Médico ou Nome do Setor
  medico_id uuid REFERENCES public.plantao_medico_contatos(id) ON DELETE SET NULL,
  setor_id uuid REFERENCES public.taxa_setores(id) ON DELETE SET NULL,
  valor_bruto numeric(14, 2) DEFAULT 0 NOT NULL,
  desconto_percentual numeric(5, 2) DEFAULT 0 NOT NULL,
  desconto_valor numeric(14, 2) DEFAULT 0 NOT NULL,
  valor_liquido numeric(14, 2) DEFAULT 0 NOT NULL,
  possui_detalhes boolean DEFAULT false NOT NULL,
  ordem integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_repasse_itens_competencia 
  ON public.repasse_itens (competencia_id);

CREATE INDEX IF NOT EXISTS idx_repasse_itens_tipo 
  ON public.repasse_itens (tipo);

CREATE INDEX IF NOT EXISTS idx_repasse_itens_ordem 
  ON public.repasse_itens (ordem, descricao);

-- 3. Tabela de Detalhamento de Produção/Procedimentos por Paciente (Ex: UTI Adulto I)
CREATE TABLE IF NOT EXISTS public.repasse_detalhes_producao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repasse_item_id uuid NOT NULL REFERENCES public.repasse_itens(id) ON DELETE CASCADE,
  paciente text NOT NULL,
  procedimento text NOT NULL,
  data_procedimento date NOT NULL,
  quantidade numeric(10, 2) DEFAULT 1 NOT NULL,
  valor_total numeric(14, 2) DEFAULT 0 NOT NULL,
  ordem integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_repasse_detalhes_item 
  ON public.repasse_detalhes_producao (repasse_item_id);

CREATE INDEX IF NOT EXISTS idx_repasse_detalhes_data 
  ON public.repasse_detalhes_producao (data_procedimento);

-- 4. Habilitar RLS em todas as tabelas
ALTER TABLE public.repasse_competencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repasse_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repasse_detalhes_producao ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para repasse_competencias
DROP POLICY IF EXISTS "Permitir leitura de repasse_competencias para autenticados" ON public.repasse_competencias;
CREATE POLICY "Permitir leitura de repasse_competencias para autenticados" ON public.repasse_competencias
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Permitir gerenciamento de repasse_competencias para autenticados" ON public.repasse_competencias;
CREATE POLICY "Permitir gerenciamento de repasse_competencias para autenticados" ON public.repasse_competencias
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Políticas de RLS para repasse_itens
DROP POLICY IF EXISTS "Permitir leitura de repasse_itens para autenticados" ON public.repasse_itens;
CREATE POLICY "Permitir leitura de repasse_itens para autenticados" ON public.repasse_itens
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Permitir gerenciamento de repasse_itens para autenticados" ON public.repasse_itens;
CREATE POLICY "Permitir gerenciamento de repasse_itens para autenticados" ON public.repasse_itens
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Políticas de RLS para repasse_detalhes_producao
DROP POLICY IF EXISTS "Permitir leitura de repasse_detalhes_producao para autenticados" ON public.repasse_detalhes_producao;
CREATE POLICY "Permitir leitura de repasse_detalhes_producao para autenticados" ON public.repasse_detalhes_producao
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Permitir gerenciamento de repasse_detalhes_producao para autenticados" ON public.repasse_detalhes_producao;
CREATE POLICY "Permitir gerenciamento de repasse_detalhes_producao para autenticados" ON public.repasse_detalhes_producao
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. Triggers para updated_at automático
CREATE OR REPLACE FUNCTION public.handle_repasse_generic_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_repasse_competencias_updated_at ON public.repasse_competencias;
CREATE TRIGGER tr_repasse_competencias_updated_at
  BEFORE UPDATE ON public.repasse_competencias
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_repasse_generic_updated_at();

DROP TRIGGER IF EXISTS tr_repasse_itens_updated_at ON public.repasse_itens;
CREATE TRIGGER tr_repasse_itens_updated_at
  BEFORE UPDATE ON public.repasse_itens
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_repasse_generic_updated_at();

DROP TRIGGER IF EXISTS tr_repasse_detalhes_updated_at ON public.repasse_detalhes_producao;
CREATE TRIGGER tr_repasse_detalhes_updated_at
  BEFORE UPDATE ON public.repasse_detalhes_producao
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_repasse_generic_updated_at();

-- 6. Gatilho para sincronização e recálculo automático de totais do setor quando detalhes são alterados
CREATE OR REPLACE FUNCTION public.handle_repasse_detalhes_totais()
RETURNS TRIGGER AS $$
DECLARE
  target_item_id uuid;
  total_calculado numeric(14, 2);
  desc_perc numeric(5, 2);
  desc_val numeric(14, 2);
  tem_linhas boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_item_id := OLD.repasse_item_id;
  ELSE
    target_item_id := NEW.repasse_item_id;
  END IF;

  SELECT COALESCE(SUM(valor_total), 0), COUNT(*) > 0
  INTO total_calculado, tem_linhas
  FROM public.repasse_detalhes_producao
  WHERE repasse_item_id = target_item_id;

  SELECT COALESCE(desconto_percentual, 0)
  INTO desc_perc
  FROM public.repasse_itens
  WHERE id = target_item_id;

  -- Se o item tem percentual de desconto, recalcula o valor do desconto
  desc_val := ROUND((total_calculado * (desc_perc / 100.0)), 2);

  UPDATE public.repasse_itens
  SET 
    valor_bruto = total_calculado,
    desconto_valor = desc_val,
    valor_liquido = total_calculado - desc_val,
    possui_detalhes = tem_linhas,
    updated_at = timezone('utc'::text, now())
  WHERE id = target_item_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_repasse_detalhes_totais_aiud ON public.repasse_detalhes_producao;
CREATE TRIGGER tr_repasse_detalhes_totais_aiud
  AFTER INSERT OR UPDATE OR DELETE ON public.repasse_detalhes_producao
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_repasse_detalhes_totais();
