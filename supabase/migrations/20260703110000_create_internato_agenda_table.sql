-- Migração para criar a tabela de Agenda do Internato e registrar o módulo
-- Criada em: 2026-07-03

BEGIN;

-- 1. Inserir o módulo na tabela modules se ele não existir
INSERT INTO public.modules (name, slug, icon, description, is_active, sort_order, is_system)
SELECT 
  'Agenda (Internato)', 
  'internato-agenda', 
  'Calendar', 
  'Módulo de planejamento de salas, professores e horários de internato', 
  true, 
  42, 
  false
WHERE NOT EXISTS (
  SELECT 1 FROM public.modules WHERE slug = 'internato-agenda'
);

-- 2. Atribuir permissões iniciais para a role 'admin' e 'colaborador'
INSERT INTO public.role_module_permissions (role_id, module_id)
SELECT r.id, m.id 
FROM public.roles r
CROSS JOIN public.modules m
WHERE m.slug = 'internato-agenda' 
  AND r.slug IN ('admin', 'colaborador')
ON CONFLICT DO NOTHING;

-- 3. Criar a tabela de Agenda
CREATE TABLE IF NOT EXISTS public.internato_agenda (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  data DATE NOT NULL,
  turma_id UUID REFERENCES public.internato_turmas(id) ON DELETE CASCADE,
  clinica VARCHAR(100),
  sala VARCHAR(150) NOT NULL,
  professor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  horario VARCHAR(100) NOT NULL,
  observacao TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  CONSTRAINT internato_agenda_pkey PRIMARY KEY (id)
);

-- 4. Criar índices para otimizar buscas
CREATE INDEX IF NOT EXISTS internato_agenda_data_idx ON public.internato_agenda(data);
CREATE INDEX IF NOT EXISTS internato_agenda_turma_idx ON public.internato_agenda(turma_id);

-- 5. Habilitar RLS (Row Level Security)
ALTER TABLE public.internato_agenda ENABLE ROW LEVEL SECURITY;

-- 6. Criar políticas RLS para a tabela internato_agenda
-- Leitura permitida para quem tem acesso a secretaria, notas ou agenda
CREATE POLICY "Permitir leitura de agenda para secretaria, notas ou agenda"
  ON public.internato_agenda FOR SELECT TO authenticated
  USING (
    public.has_internato_role(auth.uid(), 'internato-secretaria') OR 
    public.has_internato_role(auth.uid(), 'internato-notas') OR 
    public.has_internato_role(auth.uid(), 'internato-agenda')
  );

-- Escrita (Inserção, Atualização, Exclusão) permitida para secretaria ou agenda
CREATE POLICY "Permitir escrita de agenda para secretaria ou agenda"
  ON public.internato_agenda FOR ALL TO authenticated
  USING (
    public.has_internato_role(auth.uid(), 'internato-secretaria') OR 
    public.has_internato_role(auth.uid(), 'internato-agenda')
  )
  WITH CHECK (
    public.has_internato_role(auth.uid(), 'internato-secretaria') OR 
    public.has_internato_role(auth.uid(), 'internato-agenda')
  );

-- 7. Adicionar política de leitura na tabela de turmas para quem tem acesso apenas a agenda
CREATE POLICY "Permitir leitura de turmas para agenda" 
  ON public.internato_turmas FOR SELECT TO authenticated 
  USING (public.has_internato_role(auth.uid(), 'internato-agenda'));

-- 8. Habilitar o Realtime para a tabela internato_agenda
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.internato_agenda;
  end if;
exception
  when duplicate_object then
    null;
end $$;

COMMIT;
