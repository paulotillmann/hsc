-- Migração para registrar o módulo de Custos de TI no banco de dados
-- Criada em: 2026-07-15

-- 1. Inserir o módulo na tabela modules se ele não existir
INSERT INTO public.modules (name, slug, icon, description, is_active, sort_order, is_system)
SELECT 
  'Custos TI', 
  'custos-ti', 
  'Coins', 
  'Módulo de conciliação de contas a pagar e despesas de TI', 
  true, 
  39, 
  false
WHERE NOT EXISTS (
  SELECT 1 FROM public.modules WHERE slug = 'custos-ti'
);

-- 2. Atribuir o módulo para a role 'admin'
INSERT INTO public.role_module_permissions (role_id, module_id)
SELECT r.id, m.id 
FROM public.roles r
CROSS JOIN public.modules m
WHERE m.slug = 'custos-ti' AND r.slug = 'admin'
ON CONFLICT DO NOTHING;
