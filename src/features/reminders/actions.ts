'use server';

import { requireCapability } from '@/features/access/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Result } from '@/features/leads/schemas';
import {
  reminderPageSchema,
  reminderQuerySchema,
  reminderReadInputSchema,
  reminderReadSchema,
  type ReminderPage,
  type ReminderRead,
} from './contracts';

const denied = {
  status: 'error',
  message: 'Your current session cannot access these reminders.',
  retryable: false,
} as const;

const failed = {
  status: 'error',
  message: 'The reminder result could not be confirmed. Retry the same request.',
  retryable: true,
} as const;

async function allowed() {
  try {
    await requireCapability('leads.view');
    return true;
  } catch {
    return false;
  }
}

export async function loadReminders(input: unknown): Promise<Result<ReminderPage>> {
  const query = reminderQuerySchema.safeParse(input);

  if (!query.success)
    return {
      status: 'error',
      message: 'Choose a valid reminder page.',
      retryable: false,
    };

  if (!(await allowed())) return denied;

  try {
    const client = await createSupabaseServerClient();

    const response = await client.rpc('crm_my_reminders', {
      p_page: query.data.page,
    });

    if (response.error) return response.error.code === '42501' ? denied : failed;

    const parsed = reminderPageSchema.safeParse(response.data);

    return parsed.success ? { status: 'ok', data: parsed.data } : failed;
  } catch {
    return failed;
  }
}

export async function markReminderRead(input: unknown): Promise<Result<ReminderRead>> {
  const query = reminderReadInputSchema.safeParse(input);

  if (!query.success)
    return {
      status: 'error',
      message: 'Choose a valid reminder.',
      retryable: false,
    };

  if (!(await allowed())) return denied;

  try {
    const client = await createSupabaseServerClient();

    const response = await client.rpc('crm_read_reminder', {
      p_id: query.data.id,
    });

    if (response.error) return response.error.code === '42501' ? denied : failed;

    const parsed = reminderReadSchema.safeParse(response.data);

    return parsed.success ? { status: 'ok', data: parsed.data } : failed;
  } catch {
    return failed;
  }
}
