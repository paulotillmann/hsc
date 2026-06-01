-- Migração para criação da tabela de cirurgias integrada com o webhook do n8n
-- Criada em: 2026-05-26

-- 1. Criação da tabela cirurgias
CREATE TABLE IF NOT EXISTS public.cirurgias (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  nr_atendimento INTEGER,
  nm_paciente TEXT,
  ds_sexo TEXT,
  idade INTEGER,
  nr_cirurgia INTEGER NOT NULL,
  medico TEXT,
  procedimento TEXT,
  dt_agenda TIMESTAMP WITH TIME ZONE,
  nm_anestesista TEXT,
  ds_carater TEXT,
  sala TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  CONSTRAINT cirurgias_pkey PRIMARY KEY (id),
  CONSTRAINT cirurgias_nr_cirurgia_key UNIQUE (nr_cirurgia)
);

-- 2. Comentários para documentação da tabela e colunas
COMMENT ON TABLE public.cirurgias IS 'Tabela que armazena informações sobre as cirurgias agendadas sincronizadas com o n8n';
COMMENT ON COLUMN public.cirurgias.nr_atendimento IS 'Número do atendimento do paciente no hospital';
COMMENT ON COLUMN public.cirurgias.nm_paciente IS 'Nome completo do paciente';
COMMENT ON COLUMN public.cirurgias.ds_sexo IS 'Sexo/gênero do paciente';
COMMENT ON COLUMN public.cirurgias.idade IS 'Idade do paciente';
COMMENT ON COLUMN public.cirurgias.nr_cirurgia IS 'Identificador/Número único da cirurgia (chave de negócio)';
COMMENT ON COLUMN public.cirurgias.medico IS 'Nome do médico cirurgião responsável';
COMMENT ON COLUMN public.cirurgias.procedimento IS 'Descrição do procedimento cirúrgico a ser realizado';
COMMENT ON COLUMN public.cirurgias.dt_agenda IS 'Data e hora agendadas para a cirurgia';
COMMENT ON COLUMN public.cirurgias.nm_anestesista IS 'Nome do médico anestesista/anestesiologista responsável';
COMMENT ON COLUMN public.cirurgias.ds_carater IS 'Caráter da cirurgia (ex: Eletiva, Urgência, Emergência)';
COMMENT ON COLUMN public.cirurgias.sala IS 'Identificação da sala cirúrgica';

-- 3. Habilitar Row Level Security (RLS)
ALTER TABLE public.cirurgias ENABLE ROW LEVEL SECURITY;

-- 4. Criar políticas de segurança (RLS Policies)
-- Permitir leitura para todos os usuários autenticados
CREATE POLICY "Permitir leitura de cirurgias para usuarios autenticados" 
  ON public.cirurgias 
  FOR SELECT 
  TO authenticated 
  USING (true);

-- Permitir controle completo apenas para a service_role (usada no backend / Edge Functions)
CREATE POLICY "Permitir controle total para service_role" 
  ON public.cirurgias 
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

-- 5. Índices de performance
CREATE INDEX IF NOT EXISTS idx_cirurgias_nr_cirurgia ON public.cirurgias(nr_cirurgia);
CREATE INDEX IF NOT EXISTS idx_cirurgias_dt_agenda ON public.cirurgias(dt_agenda);

-- 6. Trigger para atualização automática do campo updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER set_updated_at
  BEFORE UPDATE ON public.cirurgias
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
