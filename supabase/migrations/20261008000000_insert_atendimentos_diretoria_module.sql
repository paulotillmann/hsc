-- Migração para registrar o módulo de Atendimentos (Diretoria) no banco de dados
-- Criada em: 2026-10-08

-- 1. Inserir o módulo na tabela modules se ele não existir
INSERT INTO public.modules (name, slug, icon, description, is_active, sort_order, is_system)
SELECT 
  'Atendimentos - Diretoria', 
  'atendimentos', 
  'Briefcase', 
  'Painel executivo de total de atendimentos por convênio e produtividade assistencial', 
  true, 
  85, 
  false
WHERE NOT EXISTS (
  SELECT 1 FROM public.modules WHERE slug = 'atendimentos'
);

-- 2. Atribuir permissão padrão para administradores e diretoria
INSERT INTO public.role_module_permissions (role_id, module_id)
SELECT r.id, m.id 
FROM public.roles r
CROSS JOIN public.modules m
WHERE m.slug = 'atendimentos' AND r.name IN ('admin', 'diretoria', 'Diretoria')
ON CONFLICT DO NOTHING;
