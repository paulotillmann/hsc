-- Migração para registrar o módulo do Canal de Escuta no banco de dados
-- Criada em: 2026-06-01

-- 1. Inserir o módulo na tabela modules se ele não existir
INSERT INTO public.modules (name, slug, icon, description, is_active, sort_order, is_system)
SELECT 
  'Gestão Escuta Santa Casa', 
  'gestao-escuta-santa-casa', 
  'ShieldAlert', 
  'Canal de ética confidencial para relatar desvios de conduta, fraudes ou violações das políticas internas', 
  true, 
  80, 
  false
WHERE NOT EXISTS (
  SELECT 1 FROM public.modules WHERE slug = 'gestao-escuta-santa-casa'
);

-- 2. Atribuir o módulo para todas as roles existentes por padrão (para facilitar a transição)
-- As roles de admin e colaboradores receberão permissão de acesso a este módulo.
-- O administrador poderá gerenciar e desativar acessos posteriormente na tela de configurações de módulos.
INSERT INTO public.role_module_permissions (role_id, module_id)
SELECT r.id, m.id 
FROM public.roles r
CROSS JOIN public.modules m
WHERE m.slug = 'gestao-escuta-santa-casa'
ON CONFLICT DO NOTHING;

