-- Migração para criar a tabela de professores do internato
-- Criada em: 2026-07-03

BEGIN;

-- 1. Criar a tabela de professores
CREATE TABLE IF NOT EXISTS public.internato_professores (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  nome VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  especialidade VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  CONSTRAINT internato_professores_pkey PRIMARY KEY (id)
);

-- Garantir que a coluna especialidade exista caso a tabela já tenha sido criada anteriormente sem ela
ALTER TABLE public.internato_professores ADD COLUMN IF NOT EXISTS especialidade VARCHAR(255);

-- 2. Habilitar RLS (Row Level Security)
ALTER TABLE public.internato_professores ENABLE ROW LEVEL SECURITY;

-- 3. Criar políticas RLS para a tabela de professores (removendo se já existirem)
DROP POLICY IF EXISTS "Permitir leitura de professores para secretaria, notas ou agenda" ON public.internato_professores;
CREATE POLICY "Permitir leitura de professores para secretaria, notas ou agenda"
  ON public.internato_professores FOR SELECT TO authenticated
  USING (
    public.has_internato_role(auth.uid(), 'internato-secretaria') OR 
    public.has_internato_role(auth.uid(), 'internato-notas') OR 
    public.has_internato_role(auth.uid(), 'internato-agenda')
  );

DROP POLICY IF EXISTS "Permitir escrita de professores apenas para secretaria" ON public.internato_professores;
CREATE POLICY "Permitir escrita de professores apenas para secretaria"
  ON public.internato_professores FOR ALL TO authenticated
  USING (public.has_internato_role(auth.uid(), 'internato-secretaria'))
  WITH CHECK (public.has_internato_role(auth.uid(), 'internato-secretaria'));

-- 3.5. Importar professores da tabela de profiles que já estão agendados na internato_agenda
-- Isso evita erro de violação de chave estrangeira ao aplicar a nova constraint de FK.
INSERT INTO public.internato_professores (id, nome, email)
SELECT DISTINCT 
  a.professor_id, 
  COALESCE(p.full_name, 'Professor Migrado (' || LEFT(a.professor_id::text, 8) || ')') as nome, 
  p.email as email
FROM public.internato_agenda a
LEFT JOIN public.profiles p ON p.id = a.professor_id
WHERE a.professor_id IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- 4. Ajustar chave estrangeira na tabela internato_agenda para referenciar internato_professores
ALTER TABLE public.internato_agenda DROP CONSTRAINT IF EXISTS internato_agenda_professor_id_fkey;

ALTER TABLE public.internato_agenda 
  ADD CONSTRAINT internato_agenda_professor_id_fkey 
  FOREIGN KEY (professor_id) REFERENCES public.internato_professores(id) ON DELETE SET NULL;

-- 5. Habilitar o Realtime para a tabela internato_professores
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.internato_professores;
  end if;
exception
  when duplicate_object then
    null;
end $$;

COMMIT;
