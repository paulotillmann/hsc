// src/types/permissions.ts
// Tipos TypeScript para o sistema de módulos dinâmicos (RBAC)

// ── Módulo / Tela do sistema ─────────────────────────────────────────────────
export interface Module {
  id: string;
  name: string;
  slug: string;
  icon: string;
  description?: string | null;
  is_active: boolean;
  sort_order: number;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

// ── Perfil de acesso (roles table) ───────────────────────────────────────────
// As colunas booleanas de "ações" continuam na tabela roles.
// As permissões de "telas" agora são gerenciadas pela tabela role_module_permissions.
export interface Role {
  id: string;
  name: string;
  slug: string;
  // Permissões de ação (não são telas, portanto permanecem como colunas)
  can_upload: boolean;
  can_send_email: boolean;
  can_view_all: boolean;
  // Legado — mantido para compatibilidade durante transição
  can_informes: boolean;
  can_holerites: boolean;
  can_config: boolean;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

// ── Permissões de ação do usuário logado (não são telas) ─────────────────────
export interface ActionPermissions {
  can_upload: boolean;
  can_send_email: boolean;
  can_view_all: boolean;
}

// Alias legado para compatibilidade com código existente que usa Permissions
export type Permissions = ActionPermissions & {
  can_informes: boolean;
  can_holerites: boolean;
  can_config: boolean;
};

export type PermissionKey = keyof Permissions;
