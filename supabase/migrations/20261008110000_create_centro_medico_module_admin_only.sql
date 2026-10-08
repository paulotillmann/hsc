-- =====================================================================
-- MIGRATION: REGISTRO DO MÓDULO CENTRO MÉDICO (EXCLUSIVO PARA ADMIN)
-- DATA: 08/10/2026
-- DESCRITIVO: Garante o registro do módulo Centro Médico na tabela
--             public.modules e vincula a permissão de acesso
--             exclusivamente à role de Administrador (admin).
-- =====================================================================

-- 1. Inserir ou atualizar o módulo na tabela public.modules
INSERT INTO public.modules (name, slug, icon, description, is_active, sort_order, is_system)
VALUES (
  'Centro Médico',
  'centro-medico',
  'Stethoscope',
  'Módulo de escalas médicas, consultas e agendamentos do Centro Médico',
  true,
  75,
  false
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  description = EXCLUDED.description,
  is_active = true,
  updated_at = now();

-- 2. Revogar qualquer permissão existente do módulo para perfis que NÃO sejam administrador
DELETE FROM public.role_module_permissions
WHERE module_id IN (SELECT id FROM public.modules WHERE slug = 'centro-medico')
  AND role_id NOT IN (
    SELECT id FROM public.roles 
    WHERE slug = 'admin' OR name ILIKE '%Administrador%'
  );

-- 3. Vincular a permissão do Centro Médico exclusivamente para a role de Administrador
INSERT INTO public.role_module_permissions (role_id, module_id)
SELECT r.id, m.id
FROM public.roles r
CROSS JOIN public.modules m
WHERE m.slug = 'centro-medico'
  AND (r.slug = 'admin' OR r.name ILIKE '%Administrador%')
ON CONFLICT DO NOTHING;
