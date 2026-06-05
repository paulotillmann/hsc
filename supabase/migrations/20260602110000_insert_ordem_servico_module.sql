-- Migração para registrar o módulo do Ordem de Serviço no banco de dados
-- Criada em: 2026-06-02

-- 1. Inserir o módulo na tabela modules se ele não existir
INSERT INTO public.modules (name, slug, icon, description, is_active, sort_order, is_system)
SELECT 
  'Ordem de Serviço', 
  'ordem-servico', 
  'Wrench', 
  'Módulo de gerenciamento e abertura de ordens de serviço', 
  true, 
  35, 
  false
WHERE NOT EXISTS (
  SELECT 1 FROM public.modules WHERE slug = 'ordem-servico'
);

-- 2. Atribuir o módulo para a role 'admin'
INSERT INTO public.role_module_permissions (role_id, module_id)
SELECT r.id, m.id 
FROM public.roles r
CROSS JOIN public.modules m
WHERE m.slug = 'ordem-servico' AND r.slug = 'admin'
ON CONFLICT DO NOTHING;
