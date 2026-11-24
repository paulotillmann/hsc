// src/config/navigationConfig.ts
// Fonte única de verdade para Categorias e Módulos do HSC (Hub estilo Tasy + Topbar Contextual)

import { Module } from '../types/permissions';

export interface NavModuleItem {
  id: string;
  label: string;
  description?: string;
  path: string;
  icon: string;
  /** Slugs de módulo no banco que liberam este item (se vazio, herda/livre) */
  requiredSlugs?: string[];
  /** Se true, isAdmin sempre tem acesso mesmo sem o slug listado em userModules */
  allowAdmin?: boolean;
  /** Se true, apenas administradores visualizam */
  adminOnly?: boolean;
  /** Se true, abre em nova aba (<a target="_blank">) */
  external?: boolean;
  /** Prefixos extras de rota para identificar item ativo */
  matchPrefixes?: string[];
}

export interface NavCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  items: NavModuleItem[];
}

/** Todos os slugs já contemplados nas categorias fixas (para não duplicar em "Outros Módulos") */
const CATEGORIZED_SLUGS = new Set([
  'configuracoes',
  'pacientes-internados',
  'centro-cirurgico',
  'pronto-atendimento',
  'notificacoes',
  'taxa-ocupacao',
  'gestao-novidades',
  'atendimentos',
  'diretoria-atendimentos',
  'gestao-escuta-santa-casa',
  'gestao-pendencias',
  'financeiro',
  'gestao-prontuarios',
  'internato-secretaria',
  'internato-notas',
  'internato-agenda',
  'recepcao',
  'dashboard',
  'holerites',
  'informes',
  'recrutamento-selecao',
  'plantao-ti',
  'ordem-servico',
  'ordem-servico-mobile',
  'equipamentos',
  'custos-ti',
  'usuarios-tasy',
  'centro-medico',
]);

const BASE_CATEGORIES: NavCategory[] = [
  {
    id: 'assistencial',
    name: 'Assistencial',
    description: 'Internação, centro cirúrgico, PA, notificações e leitos',
    icon: 'HeartPulse',
    items: [
      {
        id: 'pacientes-internados',
        label: 'Pacientes Internados',
        description: 'Painel de acompanhamento de internações',
        path: '/pacientes-internados',
        icon: 'BedDouble',
        requiredSlugs: ['pacientes-internados'],
      },
      {
        id: 'centro-cirurgico',
        label: 'Centro Cirúrgico',
        description: 'Gestão e monitoramento cirúrgico',
        path: '/centro-cirurgico',
        icon: 'Scissors',
        requiredSlugs: ['centro-cirurgico'],
      },
      {
        id: 'pronto-atendimento',
        label: 'Pronto Atendimento',
        description: 'Fluxo e acompanhamento do PA',
        path: '/pronto-atendimento',
        icon: 'Siren',
        requiredSlugs: ['pronto-atendimento'],
      },
      {
        id: 'notificacoes-cadastros',
        label: 'Notificações — Cadastros',
        description: 'Registro e gestão de notificações',
        path: '/notificacoes',
        icon: 'Bell',
        requiredSlugs: ['notificacoes'],
      },
      {
        id: 'notificacoes-graficos',
        label: 'Notificações — Gráficos',
        description: 'Indicadores e análises de notificações',
        path: '/notificacoes/graficos',
        icon: 'BarChart3',
        requiredSlugs: ['notificacoes'],
      },
      {
        id: 'taxa-ocupacao-visao',
        label: 'Taxa de Ocupação',
        description: 'Visão geral de ocupação hospitalar',
        path: '/taxa-ocupacao',
        icon: 'Activity',
        requiredSlugs: ['taxa-ocupacao'],
      },
      {
        id: 'taxa-ocupacao-setores',
        label: 'Cadastro Setor e Leitos',
        description: 'Configuração de setores e leitos',
        path: '/taxa-ocupacao/cadastro-setor-leitos',
        icon: 'Building2',
        requiredSlugs: ['taxa-ocupacao'],
        adminOnly: true,
      },
      {
        id: 'taxa-ocupacao-lancamento',
        label: 'Lançamento de Taxas',
        description: 'Registro diário de taxas de ocupação',
        path: '/taxa-ocupacao/lancamento-taxas',
        icon: 'ClipboardEdit',
        requiredSlugs: ['taxa-ocupacao'],
      },
      {
        id: 'taxa-ocupacao-relatorios',
        label: 'Relatórios de Ocupação',
        description: 'Relatórios consolidados de leitos',
        path: '/taxa-ocupacao/relatorios',
        icon: 'FileBarChart',
        requiredSlugs: ['taxa-ocupacao'],
      },
    ],
  },
  {
    id: 'centro-medico',
    name: 'Centro Médico',
    description: 'Agendamentos e confirmações de consultas',
    icon: 'Stethoscope',
    items: [
      {
        id: 'centro-medico-agendamentos',
        label: 'Agendamentos',
        description: 'Esteira e gestão de agendamentos',
        path: '/centro-medico',
        icon: 'CalendarCheck',
        requiredSlugs: ['centro-medico'],
        allowAdmin: true,
      },
      {
        id: 'centro-medico-confirmacao',
        label: 'Confirmação de Consulta',
        description: 'Página pública de confirmação do paciente',
        path: '/confirmar-consulta',
        icon: 'ExternalLink',
        requiredSlugs: ['centro-medico'],
        allowAdmin: true,
        external: true,
      },
    ],
  },
  {
    id: 'conecta-saude',
    name: 'Conecta Saúde',
    description: 'Comunicação e gestão de novidades',
    icon: 'Smartphone',
    items: [
      {
        id: 'gestao-novidades',
        label: 'Novidades',
        description: 'Publicação e gestão de comunicados',
        path: '/gestao-novidades',
        icon: 'Newspaper',
        requiredSlugs: ['gestao-novidades'],
      },
    ],
  },
  {
    id: 'diretoria',
    name: 'Diretoria',
    description: 'Indicadores estratégicos e atendimentos',
    icon: 'Briefcase',
    items: [
      {
        id: 'diretoria-atendimentos',
        label: 'Atendimentos',
        description: 'Painel executivo de atendimentos',
        path: '/atendimentos',
        icon: 'TrendingUp',
        requiredSlugs: ['atendimentos', 'diretoria-atendimentos'],
        allowAdmin: true,
        matchPrefixes: ['/atendimentos', '/diretoria-atendimentos'],
      },
    ],
  },
  {
    id: 'gestao-escuta-santa-casa',
    name: 'Escuta Santa Casa',
    description: 'Ouvidoria, canal de escuta e denúncias',
    icon: 'Headphones',
    items: [
      {
        id: 'escuta-gestao',
        label: 'Gestão de Denúncias',
        description: 'Tratamento e acompanhamento de relatos',
        path: '/gestao-escuta-santa-casa',
        icon: 'ShieldAlert',
        requiredSlugs: ['gestao-escuta-santa-casa'],
        allowAdmin: true,
      },
      {
        id: 'escuta-publico',
        label: 'Canal Público',
        description: 'Acesso externo ao canal de escuta',
        path: '/escuta-santa-casa',
        icon: 'ExternalLink',
        requiredSlugs: ['gestao-escuta-santa-casa'],
        allowAdmin: true,
        external: true,
      },
    ],
  },
  {
    id: 'faturamento',
    name: 'Faturamento',
    description: 'Pendências, consultas e repasses médicos',
    icon: 'DollarSign',
    items: [
      {
        id: 'faturamento-pendencias',
        label: 'Gestão de Pendências',
        description: 'Controle de pendências de faturamento',
        path: '/gestao-pendencias',
        icon: 'ClipboardList',
        requiredSlugs: ['gestao-pendencias'],
        allowAdmin: true,
      },
      {
        id: 'faturamento-consultas',
        label: 'Consulta Faturamentos',
        description: 'Pesquisa e conferência de faturamentos',
        path: '/gestao-pendencias/consulta-faturamentos',
        icon: 'FileSearch',
        requiredSlugs: ['gestao-pendencias'],
        allowAdmin: true,
      },
      {
        id: 'faturamento-repasses',
        label: 'Repasses Médicos',
        description: 'Apuração e gestão de repasses',
        path: '/gestao-pendencias/repasses-medicos',
        icon: 'HandCoins',
        requiredSlugs: ['gestao-pendencias'],
        allowAdmin: true,
      },
    ],
  },
  {
    id: 'financeiro',
    name: 'Financeiro',
    description: 'Tesouraria e gestão de plantões médicos',
    icon: 'Wallet',
    items: [
      {
        id: 'financeiro-tesouraria',
        label: 'Tesouraria',
        description: 'Controle financeiro e tesouraria',
        path: '/financeiro/tesouraria',
        icon: 'Landmark',
        requiredSlugs: ['financeiro'],
        allowAdmin: true,
      },
      {
        id: 'financeiro-plantao',
        label: 'Plantão Médico',
        description: 'Apuração e fechamento de plantões',
        path: '/financeiro/plantao-medico',
        icon: 'Clock',
        requiredSlugs: ['financeiro'],
        allowAdmin: true,
      },
    ],
  },
  {
    id: 'gestao-prontuarios',
    name: 'Gestão de Prontuários',
    description: 'Solicitações e controle de prontuários',
    icon: 'FileText',
    items: [
      {
        id: 'prontuarios-solicitacoes',
        label: 'Solicitações',
        description: 'Acompanhamento de solicitações de prontuários',
        path: '/gestao-prontuarios',
        icon: 'FolderOpen',
        requiredSlugs: ['gestao-prontuarios'],
        allowAdmin: true,
      },
    ],
  },
  {
    id: 'internato',
    name: 'Internato',
    description: 'Secretaria, notas e agenda acadêmica',
    icon: 'GraduationCap',
    items: [
      {
        id: 'internato-secretaria',
        label: 'Secretaria',
        description: 'Gestão administrativa do internato',
        path: '/internato-secretaria',
        icon: 'Building',
        requiredSlugs: ['internato-secretaria'],
      },
      {
        id: 'internato-notas',
        label: 'Notas',
        description: 'Lançamento e consulta de notas',
        path: '/internato-notas',
        icon: 'Award',
        requiredSlugs: ['internato-notas'],
      },
      {
        id: 'internato-agenda',
        label: 'Agenda',
        description: 'Escalas e calendário do internato',
        path: '/internato-agenda',
        icon: 'Calendar',
        requiredSlugs: ['internato-agenda'],
      },
    ],
  },
  {
    id: 'recepcao',
    name: 'Recepção',
    description: 'Visitantes, terceiros, pacientes e senhas',
    icon: 'Users',
    items: [
      {
        id: 'recepcao-visao',
        label: 'Visão Geral',
        description: 'Painel principal da recepção',
        path: '/recepcao',
        icon: 'LayoutDashboard',
        requiredSlugs: ['recepcao'],
        allowAdmin: true,
      },
      {
        id: 'recepcao-visitantes',
        label: 'Visitantes',
        description: 'Controle de entrada de visitantes',
        path: '/recepcao/visitantes',
        icon: 'UserCheck',
        requiredSlugs: ['recepcao'],
        allowAdmin: true,
      },
      {
        id: 'recepcao-terceiros',
        label: 'Terceiros',
        description: 'Registro de prestadores e terceiros',
        path: '/recepcao/terceiros',
        icon: 'Briefcase',
        requiredSlugs: ['recepcao'],
        allowAdmin: true,
      },
      {
        id: 'recepcao-pacientes',
        label: 'Pacientes',
        description: 'Consulta de pacientes na recepção',
        path: '/recepcao/pacientes',
        icon: 'HeartHandshake',
        requiredSlugs: ['recepcao'],
        allowAdmin: true,
      },
      {
        id: 'recepcao-relatorio',
        label: 'Relatório de Visitas',
        description: 'Histórico e relatórios de acesso',
        path: '/recepcao/relatorio',
        icon: 'FileSpreadsheet',
        requiredSlugs: ['recepcao'],
        allowAdmin: true,
      },
      {
        id: 'recepcao-senhas',
        label: 'Painel de Senhas',
        description: 'Chamada de senhas do atendimento',
        path: '/senhas-atendente',
        icon: 'Ticket',
        requiredSlugs: ['recepcao'],
        allowAdmin: true,
      },
    ],
  },
  {
    id: 'recursos-humanos',
    name: 'Recursos Humanos',
    description: 'Dashboard, holerites, informes e recrutamento',
    icon: 'UsersRound',
    items: [
      {
        id: 'rh-dashboard',
        label: 'Visão Geral',
        description: 'Dashboard e indicadores de RH',
        path: '/dashboard',
        icon: 'LayoutDashboard',
        requiredSlugs: ['dashboard'],
      },
      {
        id: 'rh-holerites',
        label: 'Holerite',
        description: 'Consulta e gestão de holerites',
        path: '/holerites',
        icon: 'Receipt',
        requiredSlugs: ['holerites'],
      },
      {
        id: 'rh-informes',
        label: 'Informe de Rendimentos',
        description: 'Comprovantes anuais (DIRF)',
        path: '/informes',
        icon: 'FileText',
        requiredSlugs: ['informes'],
      },
      {
        id: 'rh-recrutamento',
        label: 'Triagem de Currículos',
        description: 'Recrutamento e seleção de candidatos',
        path: '/recrutamento-selecao',
        icon: 'UserSearch',
        requiredSlugs: ['recrutamento-selecao'],
        allowAdmin: true,
      },
    ],
  },
  {
    id: 'tecnologia-informacao',
    name: 'T.I',
    description: 'Plantão, ordens de serviço, equipamentos e Tasy',
    icon: 'Cpu',
    items: [
      {
        id: 'ti-plantao',
        label: 'Plantão TI',
        description: 'Escalas e acionamentos de plantão',
        path: '/plantao-ti',
        icon: 'Headset',
        requiredSlugs: ['plantao-ti'],
        allowAdmin: true,
      },
      {
        id: 'ti-ordem-servico',
        label: 'Ordem de Serviço',
        description: 'Gestão de chamados e O.S.',
        path: '/ordem-servico',
        icon: 'Wrench',
        requiredSlugs: ['ordem-servico'],
        allowAdmin: true,
      },
      {
        id: 'ti-ordem-servico-mobile',
        label: 'Ordem de Serviço (Móbile)',
        description: 'Versão móvel de chamados',
        path: '/ordem-servico-mobile',
        icon: 'Smartphone',
        requiredSlugs: ['ordem-servico'],
        allowAdmin: true,
      },
      {
        id: 'ti-equipamentos',
        label: 'Equipamentos',
        description: 'Inventário de ativos e hardware',
        path: '/equipamentos',
        icon: 'Monitor',
        requiredSlugs: ['equipamentos'],
        allowAdmin: true,
      },
      {
        id: 'ti-custos',
        label: 'Custos TI',
        description: 'Controle de contratos e custos',
        path: '/custos-ti',
        icon: 'CircleDollarSign',
        requiredSlugs: ['custos-ti'],
        allowAdmin: true,
      },
      {
        id: 'ti-usuarios-tasy',
        label: 'Usuários Tasy',
        description: 'Gestão de acessos e usuários Tasy',
        path: '/usuarios-tasy',
        icon: 'UserCog',
        requiredSlugs: ['usuarios-tasy'],
        allowAdmin: true,
      },
    ],
  },
];

function userCanAccessItem(item: NavModuleItem, userModules: Module[], isAdmin: boolean): boolean {
  if (item.adminOnly && !isAdmin) return false;
  if (item.allowAdmin && isAdmin) return true;
  if (!item.requiredSlugs || item.requiredSlugs.length === 0) return true;
  return item.requiredSlugs.some((slug) => userModules.some((m) => m.slug === slug));
}

/**
 * Retorna todas as categorias visíveis para o usuário logado,
 * já filtradas por permissão + eventuais módulos dinâmicos cadastrados no banco.
 */
export function getVisibleCategories(userModules: Module[], isAdmin: boolean): NavCategory[] {
  const categories: NavCategory[] = [];

  for (const cat of BASE_CATEGORIES) {
    const visibleItems = cat.items.filter((item) => userCanAccessItem(item, userModules, isAdmin));
    if (visibleItems.length > 0) {
      categories.push({
        ...cat,
        items: visibleItems,
      });
    }
  }

  // Demais módulos dinâmicos cadastrados no banco fora das categorias fixas
  const dynamicModules = userModules
    .filter((m) => !CATEGORIZED_SLUGS.has(m.slug))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  if (dynamicModules.length > 0) {
    categories.push({
      id: 'outros-modulos',
      name: 'Outros Módulos',
      description: 'Módulos adicionais liberados para o seu perfil',
      icon: 'LayoutGrid',
      items: dynamicModules.map((mod) => ({
        id: `dyn-${mod.slug}`,
        label: mod.name,
        description: mod.description || 'Acessar módulo',
        path: `/${mod.slug}`,
        icon: mod.icon || 'Layout',
        requiredSlugs: [mod.slug],
      })),
    });
  }

  // Configurações do sistema (para admin ou quem tem permissão)
  if (isAdmin || userModules.some((m) => m.slug === 'configuracoes')) {
    categories.push({
      id: 'sistema',
      name: 'Configurações',
      description: 'Usuários, perfis, permissões e parâmetros',
      icon: 'Settings',
      items: [
        {
          id: 'configuracoes',
          label: 'Configurações do Sistema',
          description: 'Gerenciamento geral da plataforma',
          path: '/configuracoes',
          icon: 'Settings',
          requiredSlugs: ['configuracoes'],
          allowAdmin: true,
        },
      ],
    });
  }

  return categories;
}

/**
 * Encontra a categoria e o item ativo com base no pathname atual.
 */
export function findActiveNavigation(
  pathname: string,
  categories: NavCategory[]
): { category: NavCategory | null; item: NavModuleItem | null } {
  let bestMatch: { category: NavCategory; item: NavModuleItem; score: number } | null = null;

  for (const category of categories) {
    for (const item of category.items) {
      if (item.external) continue;

      const candidates = [item.path, ...(item.matchPrefixes || [])];
      for (const prefix of candidates) {
        const isExact = pathname === prefix;
        const isNested = pathname.startsWith(`${prefix}/`);
        if (isExact || isNested) {
          const score = isExact ? prefix.length + 1000 : prefix.length;
          if (!bestMatch || score > bestMatch.score) {
            bestMatch = { category, item, score };
          }
        }
      }
    }
  }

  return {
    category: bestMatch?.category ?? null,
    item: bestMatch?.item ?? null,
  };
}
