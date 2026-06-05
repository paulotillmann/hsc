-- Migração para criação da tabela ordem_servico
-- Criada em: 2026-06-02

-- 1. Criação da tabela ordem_servico
CREATE TABLE IF NOT EXISTS public.ordem_servico (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  nr_sequencia INTEGER NOT NULL,
  ds_grupo_des VARCHAR(255),
  nr_seq_localizacao INTEGER,
  ds_localizacao VARCHAR(255),
  nr_seq_equipamento INTEGER,
  ds_equipamento VARCHAR(255),
  nm_solicitante VARCHAR(255),
  telefone_solicitante VARCHAR(50),
  nm_executor VARCHAR(255),
  nm_usuario_encer VARCHAR(255),
  nm_usuario VARCHAR(255),
  dt_ordem_servico TIMESTAMP WITH TIME ZONE,
  dt_atualizacao TIMESTAMP WITH TIME ZONE,
  minutos_atualiza NUMERIC,
  ds_estagio VARCHAR(255),
  ie_status_ordem VARCHAR(50),
  ie_prioridade VARCHAR(50),
  ds_prioridade VARCHAR(100),
  ie_parado VARCHAR(50),
  ds_dano_breve TEXT,
  ds_dano TEXT,
  nr_seq_estagio INTEGER,
  ds_situacao VARCHAR(100),
  ds_solucao TEXT,
  ds_relat_tecnico TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

  CONSTRAINT ordem_servico_pkey PRIMARY KEY (id),
  CONSTRAINT ordem_servico_nr_sequencia_key UNIQUE (nr_sequencia)
);

-- Comentários para documentação
COMMENT ON TABLE public.ordem_servico IS 'Tabela que armazena os dados das ordens de serviço importados do n8n';
COMMENT ON COLUMN public.ordem_servico.nr_sequencia IS 'Chave de negócio exclusiva da ordem de serviço';

-- 2. Habilitar Row Level Security (RLS)
ALTER TABLE public.ordem_servico ENABLE ROW LEVEL SECURITY;

-- 3. Criar políticas de segurança (RLS Policies)
-- Permitir leitura para todos os usuários autenticados
CREATE POLICY "Permitir leitura de OS para usuarios autenticados" 
  ON public.ordem_servico 
  FOR SELECT 
  TO authenticated 
  USING (true);

-- Permitir escrita apenas para administradores
CREATE POLICY "Permitir escrita de OS apenas para administradores" 
  ON public.ordem_servico 
  FOR ALL 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() 
      AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() 
      AND p.role = 'admin'
    )
  );

-- Permitir controle total para a role de sistema (service_role)
CREATE POLICY "Permitir controle total de OS para service_role" 
  ON public.ordem_servico 
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

-- 4. Índices de performance
CREATE INDEX IF NOT EXISTS idx_ordem_servico_nr_sequencia ON public.ordem_servico(nr_sequencia);

-- 5. Trigger para atualização automática de updated_at
CREATE OR REPLACE TRIGGER set_ordem_servico_updated_at
  BEFORE UPDATE ON public.ordem_servico
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
