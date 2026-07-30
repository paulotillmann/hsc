-- Migração para registrar a tabela de novidades e o módulo de Gestão de Novidades
-- Criada em: 2026-07-30

-- 1. Criar a tabela de novidades
CREATE TABLE IF NOT EXISTS public.novidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descricao text NOT NULL,
  tag text NOT NULL,
  categoria text NOT NULL,
  link text,
  ativa boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Ativar RLS (Row Level Security)
ALTER TABLE public.novidades ENABLE ROW LEVEL SECURITY;

-- 3. Criar políticas de segurança
-- Permitir leitura pública (para os pacientes no app Conecta Saúde)
DROP POLICY IF EXISTS "Permitir leitura pública de novidades" ON public.novidades;
CREATE POLICY "Permitir leitura pública de novidades" ON public.novidades
  FOR SELECT USING (true);

-- Permitir controle total apenas para administradores (Admins no HSC)
DROP POLICY IF EXISTS "Permitir controle total para autenticados" ON public.novidades;
DROP POLICY IF EXISTS "Permitir controle total para administradores" ON public.novidades;
CREATE POLICY "Permitir controle total para administradores" ON public.novidades
  FOR ALL TO authenticated
  USING (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  )
  WITH CHECK (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

-- 4. Inserir o módulo na tabela de módulos do HSC
INSERT INTO public.modules (name, slug, icon, description, is_active, sort_order, is_system)
SELECT 
  'Gestão de Novidades', 
  'gestao-novidades', 
  'Newspaper', 
  'Módulo de gerenciamento de novidades do aplicativo Conecta Saúde', 
  true, 
  45, 
  false
WHERE NOT EXISTS (
  SELECT 1 FROM public.modules WHERE slug = 'gestao-novidades'
);

-- 5. Atribuir o módulo para a role 'admin'
INSERT INTO public.role_module_permissions (role_id, module_id)
SELECT r.id, m.id 
FROM public.roles r
CROSS JOIN public.modules m
WHERE m.slug = 'gestao-novidades' AND r.slug = 'admin'
ON CONFLICT DO NOTHING;

-- 6. Inserir sementes de dados (novidades padrão) se a tabela estiver vazia
INSERT INTO public.novidades (titulo, descricao, tag, categoria, link, ativa)
SELECT 'Vacinação contra Gripe e Influenza', 'A campanha de imunização está ativa no setor de triagem. Traga sua carteira de vacinação.', 'Campanha', 'campanha', '', true
WHERE NOT EXISTS (SELECT 1 FROM public.novidades WHERE titulo = 'Vacinação contra Gripe e Influenza');

INSERT INTO public.novidades (titulo, descricao, tag, categoria, link, ativa)
SELECT 'Doação de Sangue Necessária', 'O estoque do nosso banco de sangue do tipo O- e A+ está em nível crítico. Faça sua parte.', 'Urgente', 'urgente', '', true
WHERE NOT EXISTS (SELECT 1 FROM public.novidades WHERE titulo = 'Doação de Sangue Necessária');

INSERT INTO public.novidades (titulo, descricao, tag, categoria, link, ativa)
SELECT 'Nova Ala de Diagnóstico por Imagem', 'Adquirimos novos equipamentos de ressonância magnética para exames mais rápidos e precisos.', 'Tecnologia', 'tecnologia', '', true
WHERE NOT EXISTS (SELECT 1 FROM public.novidades WHERE titulo = 'Nova Ala de Diagnóstico por Imagem');
