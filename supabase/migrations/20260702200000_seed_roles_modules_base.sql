-- =====================================================================
-- MIGRATION: SEED COMPLETO DE ROLES, MÓDULOS E PERMISSÕES
-- DATA: 02/07/2026
-- DESCRITIVO: Popula as tabelas base do sistema RBAC que estão vazias
--             em produção. Cria as roles (admin, user, financeiro),
--             todos os módulos do sistema e vincula as permissões.
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- 1. ROLES (Perfis de Acesso)
-- ─────────────────────────────────────────────────────────────────────

-- Role: Administrador (acesso total)
INSERT INTO public.roles (name, slug, can_upload, can_send_email, can_view_all, can_informes, can_holerites, can_config, is_system)
SELECT 'Administrador', 'admin', true, true, true, true, true, true, true
WHERE NOT EXISTS (SELECT 1 FROM public.roles WHERE slug = 'admin');

-- Role: Colaborador (acesso básico: RH somente)
INSERT INTO public.roles (name, slug, can_upload, can_send_email, can_view_all, can_informes, can_holerites, can_config, is_system)
SELECT 'Colaborador', 'user', false, false, false, true, true, false, true
WHERE NOT EXISTS (SELECT 1 FROM public.roles WHERE slug = 'user');

-- Role: Financeiro (acesso exclusivo ao módulo financeiro)
INSERT INTO public.roles (name, slug, can_upload, can_send_email, can_view_all, can_informes, can_holerites, can_config, is_system)
SELECT 'Financeiro', 'financeiro', false, false, true, false, false, false, false
WHERE NOT EXISTS (SELECT 1 FROM public.roles WHERE slug = 'financeiro');

-- Role: Faturamento (acesso ao módulo de gestão de pendências e faturamento)
INSERT INTO public.roles (name, slug, can_upload, can_send_email, can_view_all, can_informes, can_holerites, can_config, is_system)
SELECT 'Faturamento', 'faturamento', false, false, true, false, false, false, false
WHERE NOT EXISTS (SELECT 1 FROM public.roles WHERE slug = 'faturamento');


-- ─────────────────────────────────────────────────────────────────────
-- 2. MÓDULOS (Telas do Sistema)
-- ─────────────────────────────────────────────────────────────────────

-- Módulos de sistema (is_system = true)
INSERT INTO public.modules (name, slug, icon, description, is_active, sort_order, is_system)
SELECT 'Dashboard', 'dashboard', 'LayoutDashboard', 'Painel principal de indicadores', true, 10, true
WHERE NOT EXISTS (SELECT 1 FROM public.modules WHERE slug = 'dashboard');

INSERT INTO public.modules (name, slug, icon, description, is_active, sort_order, is_system)
SELECT 'Informes de Rendimento', 'informes', 'FileText', 'Consulta e envio de informes de rendimento', true, 20, true
WHERE NOT EXISTS (SELECT 1 FROM public.modules WHERE slug = 'informes');

INSERT INTO public.modules (name, slug, icon, description, is_active, sort_order, is_system)
SELECT 'Holerites', 'holerites', 'Receipt', 'Consulta e envio de holerites', true, 22, true
WHERE NOT EXISTS (SELECT 1 FROM public.modules WHERE slug = 'holerites');

-- Módulos assistenciais
INSERT INTO public.modules (name, slug, icon, description, is_active, sort_order, is_system)
SELECT 'Centro Cirúrgico', 'centro-cirurgico', 'Activity', 'Módulo de monitoramento e acompanhamento de cirurgias agendadas', true, 25, false
WHERE NOT EXISTS (SELECT 1 FROM public.modules WHERE slug = 'centro-cirurgico');

INSERT INTO public.modules (name, slug, icon, description, is_active, sort_order, is_system)
SELECT 'Pacientes Internados', 'pacientes-internados', 'BedDouble', 'Monitoramento de pacientes internados por setor', true, 28, false
WHERE NOT EXISTS (SELECT 1 FROM public.modules WHERE slug = 'pacientes-internados');

INSERT INTO public.modules (name, slug, icon, description, is_active, sort_order, is_system)
SELECT 'Plantão TI', 'plantao-ti', 'Clock', 'Módulo de escala e controle de Plantão de TI', true, 30, false
WHERE NOT EXISTS (SELECT 1 FROM public.modules WHERE slug = 'plantao-ti');

INSERT INTO public.modules (name, slug, icon, description, is_active, sort_order, is_system)
SELECT 'Ordem de Serviço', 'ordem-servico', 'Wrench', 'Módulo de gerenciamento e abertura de ordens de serviço', true, 35, false
WHERE NOT EXISTS (SELECT 1 FROM public.modules WHERE slug = 'ordem-servico');

INSERT INTO public.modules (name, slug, icon, description, is_active, sort_order, is_system)
SELECT 'Pronto Atendimento', 'pronto-atendimento', 'Activity', 'Painel de monitoramento de pacientes do pronto atendimento em tempo real', true, 38, false
WHERE NOT EXISTS (SELECT 1 FROM public.modules WHERE slug = 'pronto-atendimento');

INSERT INTO public.modules (name, slug, icon, description, is_active, sort_order, is_system)
SELECT 'Secretaria (Internato)', 'internato-secretaria', 'ClipboardList', 'Módulo de gestão de turmas, alunos, presença e atestados de internato', true, 40, false
WHERE NOT EXISTS (SELECT 1 FROM public.modules WHERE slug = 'internato-secretaria');

INSERT INTO public.modules (name, slug, icon, description, is_active, sort_order, is_system)
SELECT 'Notas (Internato)', 'internato-notas', 'GraduationCap', 'Módulo de lançamento de notas por professores de internato', true, 41, false
WHERE NOT EXISTS (SELECT 1 FROM public.modules WHERE slug = 'internato-notas');

INSERT INTO public.modules (name, slug, icon, description, is_active, sort_order, is_system)
SELECT 'Notificações', 'notificacoes', 'AlertTriangle', 'Central de notificações do sistema', true, 50, false
WHERE NOT EXISTS (SELECT 1 FROM public.modules WHERE slug = 'notificacoes');

INSERT INTO public.modules (name, slug, icon, description, is_active, sort_order, is_system)
SELECT 'Recepção', 'recepcao', 'Users', 'Painel de acompanhamento de senhas da recepção', true, 60, false
WHERE NOT EXISTS (SELECT 1 FROM public.modules WHERE slug = 'recepcao');

INSERT INTO public.modules (name, slug, icon, description, is_active, sort_order, is_system)
SELECT 'Taxa de Ocupação', 'taxa-ocupacao', 'TrendingUp', 'Indicadores de taxa de ocupação hospitalar', true, 70, false
WHERE NOT EXISTS (SELECT 1 FROM public.modules WHERE slug = 'taxa-ocupacao');

INSERT INTO public.modules (name, slug, icon, description, is_active, sort_order, is_system)
SELECT 'Gestão de Pendências', 'gestao-pendencias', 'DollarSign', 'Gestão de pendências e consulta de faturamentos', true, 75, false
WHERE NOT EXISTS (SELECT 1 FROM public.modules WHERE slug = 'gestao-pendencias');

INSERT INTO public.modules (name, slug, icon, description, is_active, sort_order, is_system)
SELECT 'Gestão Escuta Santa Casa', 'gestao-escuta-santa-casa', 'ShieldAlert', 'Canal de ética confidencial para relatar desvios de conduta, fraudes ou violações das políticas internas', true, 80, false
WHERE NOT EXISTS (SELECT 1 FROM public.modules WHERE slug = 'gestao-escuta-santa-casa');

INSERT INTO public.modules (name, slug, icon, description, is_active, sort_order, is_system)
SELECT 'Gestão de Prontuários', 'gestao-prontuarios', 'FileSpreadsheet', 'Recebimento, análise, aprovação ou rejeição de solicitações de prontuários com entrega segura de documentos.', true, 85, false
WHERE NOT EXISTS (SELECT 1 FROM public.modules WHERE slug = 'gestao-prontuarios');

INSERT INTO public.modules (name, slug, icon, description, is_active, sort_order, is_system)
SELECT 'Financeiro', 'financeiro', 'Wallet', 'Módulo financeiro e tesouraria do hospital', true, 86, false
WHERE NOT EXISTS (SELECT 1 FROM public.modules WHERE slug = 'financeiro');

-- Módulo de sistema (admin only)
INSERT INTO public.modules (name, slug, icon, description, is_active, sort_order, is_system)
SELECT 'Configurações', 'configuracoes', 'Settings', 'Gestão de perfis, módulos e usuários do sistema', true, 90, true
WHERE NOT EXISTS (SELECT 1 FROM public.modules WHERE slug = 'configuracoes');


-- ─────────────────────────────────────────────────────────────────────
-- 3. PERMISSÕES: ROLE → MÓDULO
-- ─────────────────────────────────────────────────────────────────────

-- 3.1 ADMIN: acesso a TODOS os módulos
INSERT INTO public.role_module_permissions (role_id, module_id)
SELECT r.id, m.id
FROM public.roles r
CROSS JOIN public.modules m
WHERE r.slug = 'admin'
ON CONFLICT DO NOTHING;

-- 3.2 COLABORADOR (user): acesso apenas aos módulos de RH base
INSERT INTO public.role_module_permissions (role_id, module_id)
SELECT r.id, m.id
FROM public.roles r
CROSS JOIN public.modules m
WHERE r.slug = 'user'
  AND m.slug IN ('dashboard', 'informes', 'holerites')
ON CONFLICT DO NOTHING;

-- 3.3 FINANCEIRO: acesso apenas ao módulo financeiro
INSERT INTO public.role_module_permissions (role_id, module_id)
SELECT r.id, m.id
FROM public.roles r
CROSS JOIN public.modules m
WHERE r.slug = 'financeiro'
  AND m.slug IN ('financeiro')
ON CONFLICT DO NOTHING;

-- 3.4 FATURAMENTO: acesso ao módulo de gestão de pendências + dashboard
INSERT INTO public.role_module_permissions (role_id, module_id)
SELECT r.id, m.id
FROM public.roles r
CROSS JOIN public.modules m
WHERE r.slug = 'faturamento'
  AND m.slug IN ('dashboard', 'gestao-pendencias')
ON CONFLICT DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────
-- 4. VALIDAÇÃO: Contagem de registros inseridos
-- ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  _roles_count INT;
  _modules_count INT;
  _perms_count INT;
BEGIN
  SELECT count(*) INTO _roles_count FROM public.roles;
  SELECT count(*) INTO _modules_count FROM public.modules;
  SELECT count(*) INTO _perms_count FROM public.role_module_permissions;
  
  RAISE NOTICE '✅ Seed concluído com sucesso!';
  RAISE NOTICE '   Roles: %', _roles_count;
  RAISE NOTICE '   Modules: %', _modules_count;
  RAISE NOTICE '   Permissions: %', _perms_count;
END $$;
