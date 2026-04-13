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
  // Exemplo:
  // 'relatorios': lazy(() => import('../pages/Relatorios')),
};
