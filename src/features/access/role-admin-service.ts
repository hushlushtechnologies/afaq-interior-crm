import 'server-only';

import {
  roleAccountSchema,
  type RoleAccount,
  type RoleChangeValues,
} from '@/features/access/role-admin-schemas';
import { createSupabaseMutationClient } from '@/lib/supabase/server';

type RoleAccountResult =
  | { status: 'ok'; account: RoleAccount }
  | { status: 'missing' }
  | { status: 'denied' }
  | { status: 'last-admin' }
  | { status: 'unavailable' };

async function invokeRoleRpc(
  name: 'crm_get_role_account' | 'crm_change_user_role',
  args: Record<string, string>,
): Promise<RoleAccountResult> {
  try {
    const supabase = await createSupabaseMutationClient();

    const { data, error } = await supabase.rpc(name, args);

    if (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('AFAQ_ACCESS_DIAGNOSTIC', {
          stage: name,
          code: error.code,
        });
      }

      if (error.code === '42501') {
        return { status: 'denied' };
      }

      if (error.code === '23514') {
        return { status: 'last-admin' };
      }

      if (error.code === '22023') {
        return { status: 'missing' };
      }

      return { status: 'unavailable' };
    }

    if (data === null) {
      return { status: 'missing' };
    }

    const parsed = roleAccountSchema.safeParse(data);

    if (!parsed.success) {
      return { status: 'unavailable' };
    }

    return {
      status: 'ok',
      account: parsed.data,
    };
  } catch {
    return { status: 'unavailable' };
  }
}

export async function lookupRoleAccount(email: string) {
  return invokeRoleRpc('crm_get_role_account', {
    p_email: email,
  });
}

export async function changeRoleAccount(values: RoleChangeValues) {
  return invokeRoleRpc('crm_change_user_role', {
    p_email: values.email,
    p_role_key: values.roleKey,
    p_operation: values.operation,
  });
}
