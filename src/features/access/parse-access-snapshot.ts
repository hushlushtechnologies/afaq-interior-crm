import 'server-only';

import { z } from 'zod';
import {
  ACCESS_SCOPES,
  isPermissionKey,
  ROLE_KEYS,
  type PermissionKey,
} from '@/features/access/catalog';
import type { AccessSnapshot } from '@/features/access/types';

const permissionGrantSchema = z
  .object({
    permission: z.custom<PermissionKey>(isPermissionKey, {
      message: 'Unknown permission.',
    }),

    scope: z.enum(ACCESS_SCOPES),
  })
  .strict();

const accessSnapshotSchema = z
  .object({
    userId: z.string().uuid(),
    roles: z.array(z.enum(ROLE_KEYS)),
    grants: z.array(permissionGrantSchema),
  })
  .strict();

/**
 * Parse only the result of the trusted database access query.
 *
 * expectedUserId must come from server-validated authentication.
 * Never pass a browser-supplied role or permission payload here.
 */
export function parseDatabaseAccessSnapshot(raw: unknown, expectedUserId: string): AccessSnapshot {
  const result = accessSnapshotSchema.safeParse(raw);

  if (!result.success) {
    throw new Error('The database returned invalid access information.');
  }

  if (result.data.userId !== expectedUserId) {
    throw new Error('Access information does not match the authenticated account.');
  }

  return result.data;
}
