// src/types/permissions.ts
// Tipos TypeScript para o sistema de permissões por perfil (RBAC)

export interface Role {
  id: string;
  name: string;
  slug: string;
  can_informes: boolean;
  can_holerites: boolean;
  can_config: boolean;
  can_upload: boolean;
  can_send_email: boolean;
  can_view_all: boolean;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface Permissions {
  can_informes: boolean;
  can_holerites: boolean;
  can_config: boolean;
  can_upload: boolean;
  can_send_email: boolean;
  can_view_all: boolean;
}

export type PermissionKey = keyof Permissions;
