-- Migração para registrar o módulo Financeiro no banco de dados
-- Criada em: 2026-07-02

-- 1. Inserir o módulo na tabela modules se ele não existir
INSERT INTO public.modules (name, slug, icon, description, is_active, sort_order, is_system)
SELECT 
  'Financeiro', 
  'financeiro', 
  'Wallet', 
  'Módulo financeiro e tesouraria do hospital', 
  true, 
  86, 
  false
WHERE NOT EXISTS (
  SELECT 1 FROM public.modules WHERE slug = 'financeiro'
);

-- 2. Atribuir o módulo para a role 'admin'
INSERT INTO public.role_module_permissions (role_id, module_id)
SELECT r.id, m.id 
FROM public.roles r
CROSS JOIN public.modules m
WHERE m.slug = 'financeiro' AND r.slug = 'admin'
ON CONFLICT DO NOTHING;
