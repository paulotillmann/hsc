-- Criar a tabela de Reposição de Aulas de Internato
CREATE TABLE IF NOT EXISTS public.internato_reposicoes (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  aluno_id UUID NOT NULL REFERENCES public.internato_alunos(id) ON DELETE CASCADE,
  turma_id UUID REFERENCES public.internato_turmas(id) ON DELETE SET NULL,
  data_falta DATE NOT NULL,
  data_reposicao DATE,
  clinica VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'concluida')),
  observacao TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  CONSTRAINT internato_reposicoes_pkey PRIMARY KEY (id)
);

-- Habilitar RLS
ALTER TABLE public.internato_reposicoes ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Acesso completo para autenticados em internato_reposicoes" 
  ON public.internato_reposicoes TO authenticated USING (true) WITH CHECK (true);

-- Criar o bucket de storage para atestados se ele não existir
INSERT INTO storage.buckets (id, name, public)
VALUES ('atestados-internato', 'atestados-internato', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de acesso ao bucket
CREATE POLICY "Acesso leitura publica bucket atestados"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'atestados-internato');

CREATE POLICY "Acesso total autenticados bucket atestados"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'atestados-internato')
WITH CHECK (bucket_id = 'atestados-internato');
