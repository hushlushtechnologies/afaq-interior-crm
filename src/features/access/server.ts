import 'server-only';

import { cache } from 'react';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import type { AccessScope, PermissionKey } from '@/features/access/catalog';
import { parseDatabaseAccessSnapshot } from '@/features/access/parse-access-snapshot';
import { hasCapability, hasRequiredScope } from '@/features/access/permissions';
import type { AccessSnapshot } from '@/features/access/types';
import { getAuthState } from '@/features/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export class AccessDeniedError extends Error {
  readonly code = 'access_denied';
  readonly status = 403;

  constructor() {
    super('You do not have permission for this operation.');

    this.name = 'AccessDeniedError';
  }
}

export class AccessUnavailableError extends Error {
  readonly code = 'access_unavailable';

  constructor() {
    super('Access information could not be verified. Please try again shortly.');

    this.name = 'AccessUnavailableError';
  }
}

type AccessLoadState =
  | {
      status: 'ready';
      snapshot: AccessSnapshot;
    }
  | {
      status: 'unavailable';
    };

export const getMyAccess = cache(async (): Promise<AccessSnapshot> => {
  await connection();

  const auth = await getAuthState();

  if (auth.status === 'anonymous') {
    redirect('/login');
  }

  if (auth.status === 'unavailable') {
    throw new AccessUnavailableError();
  }

  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase.rpc('crm_get_my_access');

    if (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('AFAQ_ACCESS_DIAGNOSTIC', {
          stage: 'get-my-access',
          code: error.code,
        });
      }

      throw new AccessUnavailableError();
    }

    return parseDatabaseAccessSnapshot(data, auth.user.id);
  } catch {
    throw new AccessUnavailableError();
  }
});

export async function getMyAccessState(): Promise<AccessLoadState> {
  try {
    return {
      status: 'ready',
      snapshot: await getMyAccess(),
    };
  } catch (error) {
    if (error instanceof AccessUnavailableError) {
      return {
        status: 'unavailable',
      };
    }

    // Preserve framework redirects and unexpected control flow.
    throw error;
  }
}

/**
 * Checks capability and optional scope coverage.
 *
 * Record operations must also verify actual ownership or assignment
 * using trusted database relationships and applicable RLS.
 */
export async function requireCapability(
  permission: PermissionKey,
  requiredScope?: AccessScope,
): Promise<AccessSnapshot> {
  const snapshot = await getMyAccess();

  const permitted = requiredScope
    ? hasRequiredScope(snapshot, permission, requiredScope)
    : hasCapability(snapshot, permission);

  if (!permitted) {
    throw new AccessDeniedError();
  }

  return snapshot;
}
