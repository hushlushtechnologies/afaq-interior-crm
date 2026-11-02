import type { AccessScope, PermissionKey } from '@/features/access/catalog';
import type { AccessSnapshot } from '@/features/access/types';

export function hasCapability(snapshot: AccessSnapshot, permission: PermissionKey): boolean {
  return snapshot.grants.some((grant) => grant.permission === permission);
}

export function hasRequiredScope(
  snapshot: AccessSnapshot,
  permission: PermissionKey,
  requiredScope: AccessScope,
): boolean {
  return snapshot.grants.some(
    (grant) =>
      grant.permission === permission &&
      (grant.scope === 'company' || grant.scope === requiredScope),
  );
}
