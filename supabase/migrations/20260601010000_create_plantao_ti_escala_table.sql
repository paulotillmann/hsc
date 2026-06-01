-- Migração para criação da tabela de escala de plantão da TI
-- Criada em: 2026-06-01

-- 1. Criação da tabela plantao_ti_escala
CREATE TABLE IF NOT EXISTS public.plantao_ti_escala (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  data_plantao DATE NOT NULL,
  usuario_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  CONSTRAINT plantao_ti_escala_pkey PRIMARY KEY (id),
  CONSTRAINT plantao_ti_escala_data_usuario_key UNIQUE (data_plantao, usuario_id)
);

-- Comentários para documentação
COMMENT ON TABLE public.plantao_ti_escala IS 'Tabela que armazena a escala diária dos plantonistas de TI';
COMMENT ON COLUMN public.plantao_ti_escala.data_plantao IS 'Data do plantão (formato YYYY-MM-DD)';
COMMENT ON COLUMN public.plantao_ti_escala.usuario_id IS 'ID do colaborador/usuário escalado (referencia public.profiles.id)';

-- 2. Habilitar Row Level Security (RLS)
ALTER TABLE public.plantao_ti_escala ENABLE ROW LEVEL SECURITY;

-- 3. Criar políticas de segurança (RLS Policies)
-- Permitir leitura para todos os usuários autenticados
CREATE POLICY "Permitir leitura de escalas para usuarios autenticados" 
  ON public.plantao_ti_escala 
  FOR SELECT 
  TO authenticated 
  USING (true);

-- Permitir escrita (INSERT/UPDATE/DELETE) apenas para administradores
CREATE POLICY "Permitir escrita de escalas apenas para administradores" 
  ON public.plantao_ti_escala 
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
CREATE POLICY "Permitir controle total de escalas para service_role" 
  ON public.plantao_ti_escala 
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

-- 4. Índices de performance
CREATE INDEX IF NOT EXISTS idx_plantao_ti_escala_data_plantao ON public.plantao_ti_escala(data_plantao);

-- 5. Trigger para atualização automática de updated_at
CREATE OR REPLACE TRIGGER set_plantao_ti_escala_updated_at
  BEFORE UPDATE ON public.plantao_ti_escala
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 6. Habilitar Supabase Realtime para a tabela de escala
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.plantao_ti_escala;
  end if;
exception
  when duplicate_object then
    null;
end $$;
