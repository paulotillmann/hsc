-- Migração para armazenar produções médicas e status de pagamento no módulo de Plantão Médico
-- Criada em: 2026-08-19

CREATE TABLE IF NOT EXISTS public.plantao_medico_producoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medico text NOT NULL,
  especialidade text NOT NULL DEFAULT '',
  tipo_plantao text NOT NULL DEFAULT '',
  periodo_de date NOT NULL,
  periodo_ate date NOT NULL,
  producoes jsonb DEFAULT '[]'::jsonb NOT NULL,
  valor_pago numeric(12, 2) DEFAULT 0 NOT NULL,
  status text DEFAULT 'Pendente' NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT unq_plantao_medico_producoes UNIQUE (periodo_de, periodo_ate, medico, especialidade, tipo_plantao)
);

-- Índices para buscas rápidas por período e médico
CREATE INDEX IF NOT EXISTS idx_plantao_medico_producoes_periodo 
  ON public.plantao_medico_producoes (periodo_de, periodo_ate);

CREATE INDEX IF NOT EXISTS idx_plantao_medico_producoes_medico 
  ON public.plantao_medico_producoes (medico);

-- Ativar Row Level Security
ALTER TABLE public.plantao_medico_producoes ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS:
-- 1. Leitura permitida para usuários autenticados
DROP POLICY IF EXISTS "Permitir leitura de produções de plantão para autenticados" ON public.plantao_medico_producoes;
CREATE POLICY "Permitir leitura de produções de plantão para autenticados" ON public.plantao_medico_producoes
  FOR SELECT TO authenticated
  USING (true);

-- 2. Inserção / Edição / Deleção permitida para autenticados
DROP POLICY IF EXISTS "Permitir gerenciamento de produções de plantão para autenticados" ON public.plantao_medico_producoes;
CREATE POLICY "Permitir gerenciamento de produções de plantão para autenticados" ON public.plantao_medico_producoes
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Gatilho para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.handle_plantao_medico_producoes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_plantao_medico_producoes_updated_at ON public.plantao_medico_producoes;
CREATE TRIGGER tr_plantao_medico_producoes_updated_at
  BEFORE UPDATE ON public.plantao_medico_producoes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_plantao_medico_producoes_updated_at();
