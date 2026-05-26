-- Migração para registrar o módulo do Centro Cirúrgico no banco de dados
-- Criada em: 2026-05-26

-- 1. Inserir o módulo na tabela modules se ele não existir
INSERT INTO public.modules (name, slug, icon, description, is_active, sort_order, is_system)
SELECT 
  'Centro Cirúrgico', 
  'centro-cirurgico', 
  'Activity', 
  'Módulo de monitoramento e acompanhamento de cirurgias agendadas', 
  true, 
  25, 
  false
WHERE NOT EXISTS (
  SELECT 1 FROM public.modules WHERE slug = 'centro-cirurgico'
);

-- 2. Atribuir o módulo para todas as roles existentes por padrão (para facilitar a transição)
-- As roles de admin e colaboradores receberão permissão de acesso a este módulo.
-- O administrador poderá gerenciar e desativar acessos posteriormente na tela de configurações de módulos.
INSERT INTO public.role_module_permissions (role_id, module_id)
SELECT r.id, m.id 
FROM public.roles r
CROSS JOIN public.modules m
WHERE m.slug = 'centro-cirurgico'
ON CONFLICT DO NOTHING;
