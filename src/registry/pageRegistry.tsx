// src/registry/pageRegistry.tsx
// Dicionário central: slug do módulo → componente React da tela
//
// COMO ADICIONAR UMA NOVA TELA:
// 1. Crie o arquivo TSX em src/pages/NomeDaTela.tsx
// 2. Adicione uma entrada aqui: 'slug-da-tela': lazy(() => import('../pages/NomeDaTela'))
// 3. No painel de Configurações → Módulos, cadastre o módulo com o mesmo slug
// 4. Atribua os perfis que terão acesso – sem mais nenhuma mudança de código!

import React, { lazy } from 'react';

export const pageRegistry: Record<string, React.LazyExoticComponent<React.ComponentType<any>>> = {
  // Módulos de sistema
  'dashboard':    lazy(() => import('../pages/Dashboard')),
  'informes':     lazy(() => import('../pages/Informes')),
  'holerites':    lazy(() => import('../pages/Holerites')),
  'configuracoes':lazy(() => import('../pages/Configuracoes')),

  // ── Adicione novas telas abaixo ──────────────────────────────────────────
  'notificacoes': lazy(() => import('../pages/Notificacoes/index')),
  'recepcao':     lazy(() => import('../pages/Recepcao/index')),
  'taxa-ocupacao':lazy(() => import('../pages/TaxaOcupacao/index')),
  'gestao-pendencias': lazy(() => import('../pages/GestaoPendencias/index')),
  'centro-cirurgico':  lazy(() => import('../pages/CentroCirurgico/index')),
  'gestao-escuta-santa-casa': lazy(() => import('../pages/EscutaSantaCasa/index')),
  'plantao-ti':        lazy(() => import('../pages/PlantaoTI/index')),
  'ordem-servico':     lazy(() => import('../pages/OrdemServico/index')),
  'gestao-prontuarios': lazy(() => import('../pages/GestaoProntuarios/index')),
  'ordem-servico-mobile': lazy(() => import('../pages/OrdemServicoMobile/index')),
  'pronto-atendimento': lazy(() => import('../pages/ProntoAtendimento/index')),
  'internato-secretaria': lazy(() => import('../pages/Internato/Secretaria')),
  'internato-notas': lazy(() => import('../pages/Internato/Notas')),
  'internato-agenda': lazy(() => import('../pages/Internato/Agenda')),
  'equipamentos': lazy(() => import('../pages/Equipamentos/index')),
  'financeiro': lazy(() => import('../pages/Financeiro/index')),
  // 'relatorios': lazy(() => import('../pages/Relatorios')),
};
