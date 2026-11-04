'use server';
import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient, createSupabaseMutationClient } from '@/lib/supabase/server';
import {
  directoryQuerySchema,
  directorySchema,
  statusChangeSchema,
  type DirectoryResult,
  type StatusResult,
} from '@/features/employee/directory-schemas';

export async function loadEmployeeDirectory(input: unknown): Promise<DirectoryResult> {
  const parsed = directoryQuerySchema.safeParse(input);
  if (!parsed.success)
    return { status: 'error', message: 'Enter a search within 100 characters and a valid page.' };
  try {
    const client = await createSupabaseServerClient();
    const result = await client.rpc('crm_employee_directory', {
      p_search: parsed.data.search,
      p_page: parsed.data.page,
    });
    if (result.error)
      return {
        status: 'error',
        message: 'The directory is unavailable or your session has insufficient permission.',
      };
    const data = directorySchema.safeParse(result.data);
    return data.success
      ? { status: 'ok', directory: data.data }
      : { status: 'error', message: 'Directory data could not be verified.' };
  } catch {
    return { status: 'error', message: 'The directory could not be loaded. Please try again.' };
  }
}

export async function changeEmployeeStatus(input: unknown): Promise<StatusResult> {
  const parsed = statusChangeSchema.safeParse(input);
  if (!parsed.success)
    return { status: 'error', message: 'Choose a valid account and status change.' };
  try {
    const client = await createSupabaseMutationClient();
    const result = await client.rpc('crm_change_employee_status', {
      p_request_id: parsed.data.requestId,
      p_user_id: parsed.data.userId,
      p_expected: parsed.data.expected,
      p_status: parsed.data.status,
    });
    if (result.error) {
      const code = result.error.code;
      return {
        status: code === '40001' ? 'conflict' : 'error',
        message:
          code === '23514'
            ? 'Keep at least one confirmed, unblocked, active Super Admin.'
            : code === '42501'
              ? 'Only an active Super Admin can change account status.'
              : code === '40001'
                ? 'The account changed. Review the refreshed directory before trying again.'
                : code === '22023'
                  ? 'The account or request is no longer valid. Reload the directory.'
                  : 'The result could not be confirmed. Retry the same confirmation.',
      };
    }
    if (typeof result.data?.replayed !== 'boolean')
      return {
        status: 'error',
        message: 'The result could not be verified. Retry the same confirmation.',
      };
    revalidatePath('/', 'layout');
    return { status: 'ok', replayed: result.data.replayed };
  } catch {
    return {
      status: 'error',
      message: 'The result could not be confirmed. Retry the same confirmation.',
    };
  }
}
