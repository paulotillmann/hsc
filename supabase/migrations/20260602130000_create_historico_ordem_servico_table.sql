-- Migração para criação da tabela historico_ordem_servico
-- Criada em: 2026-06-02

-- 1. Criação da tabela historico_ordem_servico
CREATE TABLE IF NOT EXISTS public.historico_ordem_servico (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  nr_sequencia INTEGER NOT NULL,
  ds_relat_tecnico TEXT NOT NULL,
  nm_usuario VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  CONSTRAINT historico_ordem_servico_pkey PRIMARY KEY (id),
  CONSTRAINT fk_historico_os_nr_sequencia FOREIGN KEY (nr_sequencia) REFERENCES public.ordem_servico(nr_sequencia) ON DELETE CASCADE
);

-- 2. Habilitar RLS (Row Level Security)
ALTER TABLE public.historico_ordem_servico ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de Segurança (RLS Policies)
-- Qualquer usuário autenticado pode consultar o histórico de relatos
CREATE POLICY "Permitir leitura de histórico para usuários autenticados" 
  ON public.historico_ordem_servico 
  FOR SELECT 
  TO authenticated 
  USING (true);

-- Apenas administradores (ou a Service Role no backend) podem inserir/atualizar/excluir registros de histórico
CREATE POLICY "Permitir escrita de histórico apenas para administradores" 
  ON public.historico_ordem_servico 
  FOR ALL 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() 
      AND p.role = 'admin'
    )
  );

-- Permitir controle total para a role de sistema (service_role)
CREATE POLICY "Permitir controle total de histórico para service_role" 
  ON public.historico_ordem_servico 
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

-- 4. Criação de índices para performance nas consultas
CREATE INDEX IF NOT EXISTS idx_historico_os_nr_sequencia ON public.historico_ordem_servico(nr_sequencia);
CREATE INDEX IF NOT EXISTS idx_historico_os_created_at ON public.historico_ordem_servico(created_at DESC);
