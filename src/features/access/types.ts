import type { AccessScope, PermissionKey, RoleKey } from '@/features/access/catalog';

export type PermissionGrant = {
  permission: PermissionKey;
  scope: AccessScope;
};

export type AccessSnapshot = {
  userId: string;
  roles: readonly RoleKey[];
  grants: readonly PermissionGrant[];
};
