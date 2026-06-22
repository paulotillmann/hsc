-- Migração para criação da tabela de pacientes do Pronto Atendimento integrada com o n8n
-- Criada em: 2026-06-12

-- 1. Criação da tabela pacientes_pronto_atendimento
CREATE TABLE IF NOT EXISTS public.pacientes_pronto_atendimento (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  nr_atendimento INTEGER NOT NULL,
  nm_paciente TEXT NOT NULL,
  dt_entrada TIMESTAMP WITH TIME ZONE,
  dt_alta TIMESTAMP WITH TIME ZONE,
  ds_clinica TEXT,
  dt_inicio_atendimento TIMESTAMP WITH TIME ZONE,
  dt_lib_medico TIMESTAMP WITH TIME ZONE,
  ie_status TEXT,
  status TEXT,
  ds_triagem TEXT,
  ie_internado TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  CONSTRAINT pacientes_pronto_atendimento_pkey PRIMARY KEY (id),
  CONSTRAINT pacientes_pronto_atendimento_nr_atendimento_key UNIQUE (nr_atendimento)
);

-- 2. Comentários para documentação da tabela e colunas
COMMENT ON TABLE public.pacientes_pronto_atendimento IS 'Tabela que armazena informações dos pacientes no Pronto Atendimento sincronizados com o n8n';
COMMENT ON COLUMN public.pacientes_pronto_atendimento.nr_atendimento IS 'Número do atendimento do paciente (chave única de negócio)';
COMMENT ON COLUMN public.pacientes_pronto_atendimento.nm_paciente IS 'Nome completo do paciente';
COMMENT ON COLUMN public.pacientes_pronto_atendimento.dt_entrada IS 'Data e hora de entrada no pronto atendimento';
COMMENT ON COLUMN public.pacientes_pronto_atendimento.dt_alta IS 'Data e hora de alta médica do paciente (se houver)';
COMMENT ON COLUMN public.pacientes_pronto_atendimento.ds_clinica IS 'Especialidade médica/clínica em que o paciente está alocado';
COMMENT ON COLUMN public.pacientes_pronto_atendimento.dt_inicio_atendimento IS 'Data e hora do início do atendimento médico';
COMMENT ON COLUMN public.pacientes_pronto_atendimento.dt_lib_medico IS 'Data e hora em que o médico liberou o paciente';
COMMENT ON COLUMN public.pacientes_pronto_atendimento.ie_status IS 'Indicador de status (código curto)';
COMMENT ON COLUMN public.pacientes_pronto_atendimento.status IS 'Descrição detalhada do status do paciente (ex: Alta, Em Atendimento)';
COMMENT ON COLUMN public.pacientes_pronto_atendimento.ds_triagem IS 'Classificação de risco da triagem (ex: 3 - Urgente)';
COMMENT ON COLUMN public.pacientes_pronto_atendimento.ie_internado IS 'Indica se o paciente foi internado (S/N)';

-- 3. Habilitar Row Level Security (RLS)
ALTER TABLE public.pacientes_pronto_atendimento ENABLE ROW LEVEL SECURITY;

-- 4. Criar políticas de segurança (RLS Policies)
-- Permitir leitura para todos os usuários autenticados
CREATE POLICY "Permitir leitura de pacientes PA para usuarios autenticados" 
  ON public.pacientes_pronto_atendimento 
  FOR SELECT 
  TO authenticated 
  USING (true);

-- Permitir controle completo apenas para a service_role (usada no backend / Edge Functions)
CREATE POLICY "Permitir controle total para service_role" 
  ON public.pacientes_pronto_atendimento 
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

-- 5. Índices de performance
CREATE INDEX IF NOT EXISTS idx_pacientes_pa_nr_atendimento ON public.pacientes_pronto_atendimento(nr_atendimento);
CREATE INDEX IF NOT EXISTS idx_pacientes_pa_dt_entrada ON public.pacientes_pronto_atendimento(dt_entrada);
CREATE INDEX IF NOT EXISTS idx_pacientes_pa_status ON public.pacientes_pronto_atendimento(status);

-- 6. Trigger para atualização automática do campo updated_at (reutilizando a função handle_updated_at se já existir)
CREATE OR REPLACE TRIGGER set_updated_at_pacientes_pa
  BEFORE UPDATE ON public.pacientes_pronto_atendimento
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 7. Inserir o módulo na tabela modules se ele não existir
INSERT INTO public.modules (name, slug, icon, description, is_active, sort_order, is_system)
SELECT 
  'Pronto Atendimento', 
  'pronto-atendimento', 
  'Activity', 
  'Painel de monitoramento de pacientes do pronto atendimento em tempo real', 
  true, 
  40, 
  false
WHERE NOT EXISTS (
  SELECT 1 FROM public.modules WHERE slug = 'pronto-atendimento'
);

-- 8. Atribuir o módulo para todas as roles existentes por padrão
INSERT INTO public.role_module_permissions (role_id, module_id)
SELECT r.id, m.id 
FROM public.roles r
CROSS JOIN public.modules m
WHERE m.slug = 'pronto-atendimento'
ON CONFLICT DO NOTHING;
