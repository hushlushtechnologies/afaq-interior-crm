'use server';

import { revalidatePath } from 'next/cache';
import { connection } from 'next/server';
import { AccessDeniedError, requireCapability } from '@/features/access/server';
import { roleChangeSchema, roleLookupSchema } from '@/features/access/role-admin-schemas';
import { changeRoleAccount, lookupRoleAccount } from '@/features/access/role-admin-service';
import type { RoleChangeState, RoleLookupState } from '@/features/access/role-admin-types';
import { getAuthState } from '@/features/auth/session';

type RoleAuthorization = 'allowed' | 'unauthenticated' | 'denied' | 'unavailable';

async function authorizeRoleAdministration(): Promise<RoleAuthorization> {
  await connection();

  const auth = await getAuthState();

  if (auth.status === 'anonymous') {
    return 'unauthenticated';
  }

  if (auth.status === 'unavailable') {
    return 'unavailable';
  }

  try {
    await requireCapability('access.roles.manage', 'company');

    return 'allowed';
  } catch (error) {
    return error instanceof AccessDeniedError ? 'denied' : 'unavailable';
  }
}

export async function lookupRoleAccountAction(input: unknown): Promise<RoleLookupState> {
  const authorization = await authorizeRoleAdministration();

  if (authorization !== 'allowed') {
    return {
      status: authorization === 'unavailable' ? 'error' : authorization,
      message:
        authorization === 'unauthenticated'
          ? 'Sign in again to continue.'
          : authorization === 'denied'
            ? 'Only Super Admin can administer employee roles.'
            : 'Role administration is temporarily unavailable.',
      account: null,
    };
  }

  const parsed = roleLookupSchema.safeParse(input);

  if (!parsed.success) {
    return {
      status: 'invalid',
      message: null,
      fieldError: parsed.error.flatten().fieldErrors.email?.[0],
      account: null,
    };
  }

  const result = await lookupRoleAccount(parsed.data.email);

  if (result.status === 'ok') {
    return {
      status: 'found',
      message: null,
      account: result.account,
    };
  }

  return {
    status:
      result.status === 'missing' ? 'not-found' : result.status === 'denied' ? 'denied' : 'error',
    message:
      result.status === 'missing'
        ? 'No existing account was found for that email.'
        : result.status === 'denied'
          ? 'Only Super Admin can administer employee roles.'
          : 'Account roles could not be loaded. Please try again.',
    account: null,
  };
}

export async function changeUserRoleAction(input: unknown): Promise<RoleChangeState> {
  const authorization = await authorizeRoleAdministration();

  if (authorization !== 'allowed') {
    return {
      status: authorization === 'unavailable' ? 'error' : authorization,
      message:
        authorization === 'unauthenticated'
          ? 'Sign in again to continue.'
          : authorization === 'denied'
            ? 'Only Super Admin can administer employee roles.'
            : 'Role administration is temporarily unavailable.',
      account: null,
    };
  }

  const parsed = roleChangeSchema.safeParse(input);

  if (!parsed.success) {
    return {
      status: 'error',
      message: 'Choose a valid account, role, and operation.',
      account: null,
    };
  }

  const result = await changeRoleAccount(parsed.data);

  if (result.status === 'ok') {
    revalidatePath('/', 'layout');

    return {
      status: 'changed',
      message: 'Role assignments are up to date.',
      account: result.account,
    };
  }

  return {
    status: result.status === 'denied' ? 'denied' : 'error',
    message:
      result.status === 'last-admin'
        ? 'Keep at least one confirmed, unblocked Super Admin.'
        : result.status === 'missing'
          ? 'The account or role is no longer available.'
          : result.status === 'denied'
            ? 'Only Super Admin can administer employee roles.'
            : 'The role change could not be completed. Please try again.',
    account: null,
  };
}
