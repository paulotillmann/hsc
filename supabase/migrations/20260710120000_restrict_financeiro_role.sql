-- Migration to restrict existing 'financeiro' role permissions to only the 'financeiro' module.
-- Date: 10/07/2026

-- 1. Remove all existing permissions for the 'financeiro' role
DELETE FROM public.role_module_permissions
WHERE role_id IN (
  SELECT id FROM public.roles WHERE slug = 'financeiro'
);

-- 2. Insert only the 'financeiro' module permission for the 'financeiro' role
INSERT INTO public.role_module_permissions (role_id, module_id)
SELECT r.id, m.id
FROM public.roles r
CROSS JOIN public.modules m
WHERE r.slug = 'financeiro'
  AND m.slug = 'financeiro'
ON CONFLICT DO NOTHING;
