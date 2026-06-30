-- Migração para criar o sistema de Internato de Medicina
-- Criada em: 2026-06-25

-- 1. Inserir os módulos na tabela modules se eles não existirem
INSERT INTO public.modules (name, slug, icon, description, is_active, sort_order, is_system)
SELECT 
  'Secretaria (Internato)', 
  'internato-secretaria', 
  'ClipboardList', 
  'Módulo de gestão de turmas, alunos, presença e atestados de internato', 
  true, 
  40, 
  false
WHERE NOT EXISTS (
  SELECT 1 FROM public.modules WHERE slug = 'internato-secretaria'
);

INSERT INTO public.modules (name, slug, icon, description, is_active, sort_order, is_system)
SELECT 
  'Notas (Internato)', 
  'internato-notas', 
  'GraduationCap', 
  'Módulo de lançamento de notas por professores de internato', 
  true, 
  41, 
  false
WHERE NOT EXISTS (
  SELECT 1 FROM public.modules WHERE slug = 'internato-notas'
);

-- 2. Atribuir permissões iniciais para a role 'admin' e 'colaborador'
INSERT INTO public.role_module_permissions (role_id, module_id)
SELECT r.id, m.id 
FROM public.roles r
CROSS JOIN public.modules m
WHERE m.slug IN ('internato-secretaria', 'internato-notas') 
  AND r.slug IN ('admin', 'colaborador')
ON CONFLICT DO NOTHING;

-- 3. Criar a tabela de Turmas
CREATE TABLE IF NOT EXISTS public.internato_turmas (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  nome VARCHAR(255) NOT NULL,
  periodo VARCHAR(100) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  CONSTRAINT internato_turmas_pkey PRIMARY KEY (id)
);

-- 4. Criar a tabela de Alunos
CREATE TABLE IF NOT EXISTS public.internato_alunos (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  nome VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  matricula VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  CONSTRAINT internato_alunos_pkey PRIMARY KEY (id)
);

-- 5. Criar a tabela de junção Turma x Alunos
CREATE TABLE IF NOT EXISTS public.internato_turma_alunos (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  turma_id UUID NOT NULL REFERENCES public.internato_turmas(id) ON DELETE CASCADE,
  aluno_id UUID NOT NULL REFERENCES public.internato_alunos(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  CONSTRAINT internato_turma_alunos_pkey PRIMARY KEY (id),
  CONSTRAINT internato_turma_alunos_unique UNIQUE (turma_id, aluno_id)
);

-- 6. Criar a tabela de Presenças
CREATE TABLE IF NOT EXISTS public.internato_presencas (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  turma_id UUID NOT NULL REFERENCES public.internato_turmas(id) ON DELETE CASCADE,
  aluno_id UUID NOT NULL REFERENCES public.internato_alunos(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('presente', 'ausente', 'justificado')),
  observacao TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  CONSTRAINT internato_presencas_pkey PRIMARY KEY (id),
  CONSTRAINT internato_presencas_unique UNIQUE (turma_id, aluno_id, data)
);

-- 7. Criar a tabela de Atestados
CREATE TABLE IF NOT EXISTS public.internato_atestados (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  aluno_id UUID NOT NULL REFERENCES public.internato_alunos(id) ON DELETE CASCADE,
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  motivo TEXT NOT NULL,
  documento_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  CONSTRAINT internato_atestados_pkey PRIMARY KEY (id)
);

-- 8. Criar a tabela de Notas
CREATE TABLE IF NOT EXISTS public.internato_notas (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  turma_id UUID NOT NULL REFERENCES public.internato_turmas(id) ON DELETE CASCADE,
  aluno_id UUID NOT NULL REFERENCES public.internato_alunos(id) ON DELETE CASCADE,
  descricao VARCHAR(255) NOT NULL,
  nota NUMERIC(4, 2) NOT NULL CHECK (nota >= 0 AND nota <= 10),
  professor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  CONSTRAINT internato_notas_pkey PRIMARY KEY (id),
  CONSTRAINT internato_notas_unique UNIQUE (turma_id, aluno_id, descricao)
);

-- 9. Criar índices para otimização de consultas
CREATE INDEX IF NOT EXISTS internato_turma_alunos_turma_idx ON public.internato_turma_alunos(turma_id);
CREATE INDEX IF NOT EXISTS internato_turma_alunos_aluno_idx ON public.internato_turma_alunos(aluno_id);
CREATE INDEX IF NOT EXISTS internato_presencas_turma_aluno_date_idx ON public.internato_presencas(turma_id, aluno_id, data);
CREATE INDEX IF NOT EXISTS internato_atestados_aluno_idx ON public.internato_atestados(aluno_id);
CREATE INDEX IF NOT EXISTS internato_notas_turma_aluno_idx ON public.internato_notas(turma_id, aluno_id);

-- 10. Habilitar RLS em todas as tabelas
ALTER TABLE public.internato_turmas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internato_alunos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internato_turma_alunos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internato_presencas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internato_atestados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internato_notas ENABLE ROW LEVEL SECURITY;

-- 11. Criar políticas de acesso (Leitura/Escrita liberada para usuários autenticados)
CREATE POLICY "Acesso completo para autenticados em internato_turmas" 
  ON public.internato_turmas TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Acesso completo para autenticados em internato_alunos" 
  ON public.internato_alunos TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Acesso completo para autenticados em internato_turma_alunos" 
  ON public.internato_turma_alunos TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Acesso completo para autenticados em internato_presencas" 
  ON public.internato_presencas TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Acesso completo para autenticados em internato_atestados" 
  ON public.internato_atestados TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Acesso completo para autenticados em internato_notas" 
  ON public.internato_notas TO authenticated USING (true) WITH CHECK (true);

-- 12. Habilitar o Realtime para as tabelas que requerem reatividade (Presenças e Notas)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.internato_presencas;
    alter publication supabase_realtime add table public.internato_notas;
  end if;
exception
  when duplicate_object then
    null;
end $$;
