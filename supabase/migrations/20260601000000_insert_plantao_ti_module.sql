-- Migração para registrar o módulo do Plantão TI no banco de dados
-- Criada em: 2026-06-01

-- 1. Inserir o módulo na tabela modules se ele não existir
INSERT INTO public.modules (name, slug, icon, description, is_active, sort_order, is_system)
SELECT 
  'Plantão TI', 
  'plantao-ti', 
  'Clock', 
  'Módulo de escala e controle de Plantão de TI', 
  true, 
  30, 
  false
WHERE NOT EXISTS (
  SELECT 1 FROM public.modules WHERE slug = 'plantao-ti'
);

-- 2. Atribuir o módulo apenas para a role 'admin'
INSERT INTO public.role_module_permissions (role_id, module_id)
SELECT r.id, m.id 
FROM public.roles r
CROSS JOIN public.modules m
WHERE m.slug = 'plantao-ti' AND r.slug = 'admin'
ON CONFLICT DO NOTHING;
