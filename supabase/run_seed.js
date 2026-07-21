import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
      const parts = line.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const val = parts.slice(1).join('=').trim().replace(/(^['"]|['"]$)/g, '');
        process.env[key] = val;
      }
    });
  }
}

loadEnv();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Erro: VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não definidos no .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function runSeed() {
  console.log('Iniciando inserção via API cliente Supabase...');
  
  // 1. Roles
  const roles = [
    { name: 'Administrador', slug: 'admin', can_upload: true, can_send_email: true, can_view_all: true, can_informes: true, can_holerites: true, can_config: true, is_system: true },
    { name: 'Colaborador', slug: 'user', can_upload: false, can_send_email: false, can_view_all: false, can_informes: true, can_holerites: true, can_config: false, is_system: true },
    { name: 'Financeiro', slug: 'financeiro', can_upload: false, can_send_email: false, can_view_all: true, can_informes: false, can_holerites: false, can_config: false, is_system: false },
    { name: 'Faturamento', slug: 'faturamento', can_upload: false, can_send_email: false, can_view_all: true, can_informes: false, can_holerites: false, can_config: false, is_system: false }
  ];

  console.log('Inserindo Roles...');
  for (const role of roles) {
    const { data, error } = await supabase.from('roles').upsert(role, { onConflict: 'slug' }).select();
    if (error) {
      console.error(`Erro ao inserir role ${role.slug}:`, error.message);
    } else {
      console.log(`Role ${role.slug} ok:`, data?.[0]?.id);
    }
  }

  // 2. Modules
  const modules = [
    { name: 'Dashboard', slug: 'dashboard', icon: 'LayoutDashboard', description: 'Painel principal de indicadores', is_active: true, sort_order: 10, is_system: true },
    { name: 'Informes de Rendimento', slug: 'informes', icon: 'FileText', description: 'Consulta e envio de informes de rendimento', is_active: true, sort_order: 20, is_system: true },
    { name: 'Holerites', slug: 'holerites', icon: 'Receipt', description: 'Consulta e envio de holerites', is_active: true, sort_order: 22, is_system: true },
    { name: 'Centro Cirúrgico', slug: 'centro-cirurgico', icon: 'Activity', description: 'Módulo de monitoramento e acompanhamento de cirurgias agendadas', is_active: true, sort_order: 25, is_system: false },
    { name: 'Pacientes Internados', slug: 'pacientes-internados', icon: 'BedDouble', description: 'Monitoramento de pacientes internados por setor', is_active: true, sort_order: 28, is_system: false },
    { name: 'Plantão TI', slug: 'plantao-ti', icon: 'Clock', description: 'Módulo de escala e controle de Plantão de TI', is_active: true, sort_order: 30, is_system: false },
    { name: 'Ordem de Serviço', slug: 'ordem-servico', icon: 'Wrench', description: 'Módulo de gerenciamento e abertura de ordens de serviço', is_active: true, sort_order: 35, is_system: false },
    { name: 'Pronto Atendimento', slug: 'pronto-atendimento', icon: 'Activity', description: 'Painel de monitoramento de pacientes do pronto atendimento em tempo real', is_active: true, sort_order: 38, is_system: false },
    { name: 'Secretaria (Internato)', slug: 'internato-secretaria', icon: 'ClipboardList', description: 'Módulo de gestão de turmas, alunos, presença e atestados de internato', is_active: true, sort_order: 40, is_system: false },
    { name: 'Notas (Internato)', slug: 'internato-notas', icon: 'GraduationCap', description: 'Módulo de lançamento de notas por professores de internato', is_active: true, sort_order: 41, is_system: false },
    { name: 'Notificações', slug: 'notificacoes', icon: 'AlertTriangle', description: 'Central de notificações do sistema', is_active: true, sort_order: 50, is_system: false },
    { name: 'Recepção', slug: 'recepcao', icon: 'Users', description: 'Painel de acompanhamento de senhas da recepção', is_active: true, sort_order: 60, is_system: false },
    { name: 'Taxa de Ocupação', slug: 'taxa-ocupacao', icon: 'TrendingUp', description: 'Indicadores de taxa de ocupação hospitalar', is_active: true, sort_order: 70, is_system: false },
    { name: 'Gestão de Pendências', slug: 'gestao-pendencias', icon: 'DollarSign', description: 'Gestão de pendências e consulta de faturamentos', is_active: true, sort_order: 75, is_system: false },
    { name: 'Gestão Escuta Santa Casa', slug: 'gestao-escuta-santa-casa', icon: 'ShieldAlert', description: 'Canal de ética confidencial para relatar desvios de conduta, fraudes ou violações das políticas internas', is_active: true, sort_order: 80, is_system: false },
    { name: 'Gestão de Prontuários', slug: 'gestao-prontuarios', icon: 'FileSpreadsheet', description: 'Recebimento, análise, aprovação ou rejeição de solicitações de prontuários com entrega segura de documentos.', is_active: true, sort_order: 85, is_system: false },
    { name: 'Financeiro', slug: 'financeiro', icon: 'Wallet', description: 'Módulo financeiro e tesouraria do hospital', is_active: true, sort_order: 86, is_system: false },
    { name: 'Equipamentos', slug: 'equipamentos', icon: 'Monitor', description: 'Módulo de consulta e indicadores de equipamentos de TI', is_active: true, sort_order: 38, is_system: false },
    { name: 'Custos TI', slug: 'custos-ti', icon: 'Coins', description: 'Módulo de conciliação de contas a pagar e despesas de TI', is_active: true, sort_order: 39, is_system: false },
    { name: 'Configurações', slug: 'configuracoes', icon: 'Settings', description: 'Gestão de perfis, módulos e usuários do sistema', is_active: true, sort_order: 90, is_system: true }
  ];

  console.log('Inserindo Módulos...');
  for (const mod of modules) {
    const { data, error } = await supabase.from('modules').upsert(mod, { onConflict: 'slug' }).select();
    if (error) {
      console.error(`Erro ao inserir módulo ${mod.slug}:`, error.message);
    } else {
      console.log(`Módulo ${mod.slug} ok:`, data?.[0]?.id);
    }
  }

  // 3. Permissions mapping (admin gets all, user gets default, etc.)
  console.log('Processando permissões...');
  
  // Buscar IDs de roles e modules
  const { data: dbRoles } = await supabase.from('roles').select('id, slug');
  const { data: dbModules } = await supabase.from('modules').select('id, slug');

  if (!dbRoles || !dbModules) {
    console.error('Não foi possível obter IDs de roles ou modules.');
    return;
  }

  const roleMap = new Map(dbRoles.map(r => [r.slug, r.id]));
  const moduleMap = new Map(dbModules.map(m => [m.slug, m.id]));

  const permsToInsert = [];

  // Admin gets all
  dbRoles.forEach(r => {
    if (r.slug === 'admin') {
      dbModules.forEach(m => {
        permsToInsert.push({ role_id: r.id, module_id: m.id });
      });
    }
  });

  // User: dashboard, informes, holerites
  const userRole = roleMap.get('user');
  if (userRole) {
    ['dashboard', 'informes', 'holerites'].forEach(slug => {
      const modId = moduleMap.get(slug);
      if (modId) permsToInsert.push({ role_id: userRole, module_id: modId });
    });
  }

  // Financeiro: financeiro ONLY
  const finRole = roleMap.get('financeiro');
  if (finRole) {
    ['financeiro'].forEach(slug => {
      const modId = moduleMap.get(slug);
      if (modId) permsToInsert.push({ role_id: finRole, module_id: modId });
    });
  }

  // Faturamento: dashboard, gestao-pendencias
  const fatRole = roleMap.get('faturamento');
  if (fatRole) {
    ['dashboard', 'gestao-pendencias'].forEach(slug => {
      const modId = moduleMap.get(slug);
      if (modId) permsToInsert.push({ role_id: fatRole, module_id: modId });
    });
  }

  // Limpar antigas permissões e inserir novas
  console.log('Limpando antigas permissões e aplicando novas...');
  const { error: delError } = await supabase.from('role_module_permissions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (delError) {
    console.error('Erro ao deletar permissões antigas:', delError.message);
  }

  const { error: insError } = await supabase.from('role_module_permissions').insert(permsToInsert);
  if (insError) {
    console.error('Erro ao inserir novas permissões:', insError.message);
  } else {
    console.log('Permissões aplicadas com sucesso!');
  }
}

runSeed();
