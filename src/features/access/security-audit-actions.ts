'use server';

import { z } from 'zod';
import { createSupabaseMutationClient } from '@/lib/supabase/server';

const inputSchema = z
  .object({
    page: z.number().int().min(0).max(10000),
    targetId: z.string().uuid().nullable(),
  })
  .strict();

const pageSchema = inputSchema.extend({
  hasMore: z.boolean(),
  events: z
    .array(
      z.object({
        id: z.string().uuid(),
        at: z.string().max(64),
        source: z.enum(['roles', 'employee_status', 'invitations']),
        action: z.string().max(100),
        actorId: z.string().uuid().nullable(),
        actorKind: z.enum(['employee', 'trusted_service', 'database', 'system']),
        targetId: z.string().uuid(),
        targetKind: z.enum(['account', 'invitation']),
        detail: z.string().max(254),
      }),
    )
    .max(25),
});

export type SecurityAuditPage = z.infer<typeof pageSchema>;

export async function loadSecurityAudit(
  input: unknown,
): Promise<{ status: 'ok'; data: SecurityAuditPage } | { status: 'invalid' | 'unavailable' }> {
  const parsed = inputSchema.safeParse(input);

  if (!parsed.success) return { status: 'invalid' };

  try {
    const client = await createSupabaseMutationClient();

    const result = await client.rpc('crm_get_security_audit', {
      p_page: parsed.data.page,
      p_target_id: parsed.data.targetId,
    });

    const data = pageSchema.safeParse(result.data);

    return !result.error && data.success
      ? { status: 'ok', data: data.data }
      : { status: 'unavailable' };
  } catch {
    return { status: 'unavailable' };
  }
}