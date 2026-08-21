-- Migração para tabela de Tipos de Produção no módulo de Plantão Médico
-- Criada em: 2026-08-21

CREATE TABLE IF NOT EXISTS public.plantao_medico_tipos_producao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  descricao text DEFAULT '',
  cor text DEFAULT 'blue',
  icone text DEFAULT 'Activity',
  ordem integer DEFAULT 0 NOT NULL,
  ativo boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índices para ordenação e busca
CREATE INDEX IF NOT EXISTS idx_plantao_medico_tipos_ordem 
  ON public.plantao_medico_tipos_producao (ordem, nome);

CREATE INDEX IF NOT EXISTS idx_plantao_medico_tipos_ativo 
  ON public.plantao_medico_tipos_producao (ativo);

-- Ativar Row Level Security
ALTER TABLE public.plantao_medico_tipos_producao ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DROP POLICY IF EXISTS "Permitir leitura de tipos de produção para autenticados" ON public.plantao_medico_tipos_producao;
CREATE POLICY "Permitir leitura de tipos de produção para autenticados" ON public.plantao_medico_tipos_producao
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Permitir gerenciamento de tipos de produção para autenticados" ON public.plantao_medico_tipos_producao;
CREATE POLICY "Permitir gerenciamento de tipos de produção para autenticados" ON public.plantao_medico_tipos_producao
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Gatilho de atualização de updated_at
CREATE OR REPLACE FUNCTION public.handle_plantao_medico_tipos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_plantao_medico_tipos_producao_updated_at ON public.plantao_medico_tipos_producao;
CREATE TRIGGER tr_plantao_medico_tipos_producao_updated_at
  BEFORE UPDATE ON public.plantao_medico_tipos_producao
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_plantao_medico_tipos_updated_at();

-- Carga inicial com os 6 tipos existentes
INSERT INTO public.plantao_medico_tipos_producao (nome, descricao, cor, icone, ordem, ativo)
VALUES
  ('Procedimento', 'Exames e Cirurgias', 'blue', 'ClipboardList', 1, true),
  ('Consulta', 'Atendimento clínico ambulatorial', 'emerald', 'Stethoscope', 2, true),
  ('Parto', 'Procedimento obstétrico / cesárea / parto normal', 'pink', 'Baby', 3, true),
  ('Aula', 'Treinamento e instrução acadêmica/médica', 'purple', 'GraduationCap', 4, true),
  ('CC', 'Centro Cirúrgico', 'amber', 'Activity', 5, true),
  ('Coordenação', 'Coordenação e gestão médica de escala', 'slate', 'Briefcase', 6, true)
ON CONFLICT (nome) DO NOTHING;
