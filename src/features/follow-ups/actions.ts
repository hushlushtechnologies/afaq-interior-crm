'use server';

import { requireCapability } from '@/features/access/server';
import type { Result } from '@/features/leads/schemas';
import { followUpCommandSchema, manualActivityCommandSchema } from './schemas';
import {
  followUpQuerySchema,
  activityQuerySchema,
  type FollowUpPage,
  type FollowUpSave,
  type ManualActivityPage,
  type ManualActivitySave,
} from './contracts';
import { fetchFollowUps, fetchManualActivities, saveFollowUp, logManualActivity } from './service';

const denied = {
  status: 'error',
  message: 'Your session or lead permission could not be verified.',
  retryable: false,
} as const;

const invalid = {
  status: 'error',
  message: 'Review the lead, fields, current Sales owner, time and required reason.',
  retryable: false,
} as const;

async function authorized(write: boolean) {
  try {
    await requireCapability('leads.view');

    if (write) await requireCapability('leads.update');

    return true;
  } catch {
    return false;
  }
}

export async function loadFollowUps(input: unknown): Promise<Result<FollowUpPage>> {
  const parsed = followUpQuerySchema.safeParse(input);

  if (!parsed.success) return invalid;
  if (!(await authorized(false))) return denied;

  return fetchFollowUps(parsed.data);
}

export async function loadManualActivities(input: unknown): Promise<Result<ManualActivityPage>> {
  const parsed = activityQuerySchema.safeParse(input);

  if (!parsed.success) return invalid;
  if (!(await authorized(false))) return denied;

  return fetchManualActivities(parsed.data);
}

export async function submitFollowUp(input: unknown): Promise<Result<FollowUpSave>> {
  const parsed = followUpCommandSchema.safeParse(input);

  if (!parsed.success) return invalid;
  if (!(await authorized(true))) return denied;

  return saveFollowUp(parsed.data);
}

export async function submitManualActivity(input: unknown): Promise<Result<ManualActivitySave>> {
  const parsed = manualActivityCommandSchema.safeParse(input);

  if (!parsed.success) return invalid;
  if (!(await authorized(true))) return denied;

  return logManualActivity(parsed.data);
}
