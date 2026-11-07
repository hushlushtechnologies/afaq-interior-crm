'use server';

import { requireCapability } from '@/features/access/server';
import { bulkAssignmentSchema, type BulkResult } from './bulk-schemas';
import { bulkAssignLeads } from './bulk-service';
import type { Result } from './schemas';

export async function submitBulkAssignment(input: unknown): Promise<Result<BulkResult>> {
  const parsed = bulkAssignmentSchema.safeParse(input);

  if (!parsed.success)
    return {
      status: 'error',
      message: 'Select up to 50 distinct leads and a valid owner.',
      retryable: false,
    };

  try {
    await requireCapability('leads.assign');
  } catch {
    return {
      status: 'error',
      message: 'Your session or assignment permission could not be verified.',
      retryable: false,
    };
  }

  return bulkAssignLeads(parsed.data);
}
