-- Migração para registrar o módulo do Centro Médico no banco de dados
-- Criada em: 2026-08-31

-- 1. Inserir o módulo na tabela modules se ele não existir
INSERT INTO public.modules (name, slug, icon, description, is_active, sort_order, is_system)
SELECT 
  'Centro Médico', 
  'centro-medico', 
  'Stethoscope', 
  'Módulo de escalas médicas, consultas e agendamentos do Centro Médico', 
  true, 
  75, 
  false
WHERE NOT EXISTS (
  SELECT 1 FROM public.modules WHERE slug = 'centro-medico'
);

-- 2. Atribuir o módulo para todas as roles existentes para permitir o acesso dos usuários com permissão
INSERT INTO public.role_module_permissions (role_id, module_id)
SELECT r.id, m.id 
FROM public.roles r
CROSS JOIN public.modules m
WHERE m.slug = 'centro-medico'
ON CONFLICT DO NOTHING;
