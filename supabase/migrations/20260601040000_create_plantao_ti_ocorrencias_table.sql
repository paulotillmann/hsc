-- Migração para criar a tabela plantao_ti_ocorrencias
-- Criada em: 2026-06-01

CREATE TABLE IF NOT EXISTS public.plantao_ti_ocorrencias (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  escala_id UUID NOT NULL REFERENCES public.plantao_ti_escala(id) ON DELETE CASCADE,
  nome_solicitante VARCHAR(255) NOT NULL,
  setor_solicitante VARCHAR(255) NOT NULL,
  descricao_plantao TEXT NOT NULL,
  atendimento_presencial BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  CONSTRAINT plantao_ti_ocorrencias_pkey PRIMARY KEY (id)
);

-- Criar índices de busca para performance
CREATE INDEX IF NOT EXISTS plantao_ti_ocorrencias_escala_id_idx ON public.plantao_ti_ocorrencias(escala_id);

-- Ativar Row Level Security (RLS)
ALTER TABLE public.plantao_ti_ocorrencias ENABLE ROW LEVEL SECURITY;

-- Políticas de Acesso
CREATE POLICY "Permitir leitura de ocorrencias para autenticados" 
  ON public.plantao_ti_ocorrencias FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "Permitir insercao de ocorrencias para autenticados" 
  ON public.plantao_ti_ocorrencias FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

CREATE POLICY "Permitir atualizacao de ocorrencias para administradores" 
  ON public.plantao_ti_ocorrencias FOR UPDATE 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Permitir delecao de ocorrencias para administradores" 
  ON public.plantao_ti_ocorrencias FOR DELETE 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Habilitar Supabase Realtime para a tabela de ocorrencias
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.plantao_ti_ocorrencias;
  end if;
exception
  when duplicate_object then
    null;
end $$;
